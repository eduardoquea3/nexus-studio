use crate::models::{SshTunnelRequest, SshTunnelSource};
use russh::client::{self, Handle, Handler};
use russh::keys::PublicKeyOrCertificate;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;
use tauri::command;
use tokio::io::copy_bidirectional;
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::{oneshot, Mutex};
use tokio::task::JoinHandle;
use tokio::time::{interval, timeout};

const SSH_PASSWORD_SERVICE: &str = "nexus-studio.ssh";
const SSH_CONNECT_TIMEOUT: Duration = Duration::from_secs(10);

struct KnownHostsHandler {
    host: String,
    port: u16,
}

impl Handler for KnownHostsHandler {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        server_public_key: &PublicKeyOrCertificate,
    ) -> Result<bool, Self::Error> {
        let public_key = server_public_key.public_key();
        Ok(russh::keys::check_known_hosts(&self.host, self.port, &public_key).unwrap_or(false))
    }
}

pub(crate) struct RusshTunnelGuard {
    pub(crate) local_port: u16,
    cancel: Option<oneshot::Sender<()>>,
    task: JoinHandle<()>,
}

impl RusshTunnelGuard {
    pub(crate) fn is_alive(&self) -> bool {
        !self.task.is_finished()
    }
}

impl Drop for RusshTunnelGuard {
    fn drop(&mut self) {
        if let Some(cancel) = self.cancel.take() {
            let _ = cancel.send(());
        }
    }
}

pub(crate) async fn open_ssh_tunnel(
    ssh: &SshTunnelRequest,
    password: String,
) -> Result<RusshTunnelGuard, String> {
    let SshTunnelSource::Manual { host, port, user } = &ssh.source else {
        return Err("SSH password authentication requires a manual SSH destination".to_string());
    };

    let listener = TcpListener::bind(("127.0.0.1", 0))
        .await
        .map_err(|error| format!("Could not bind the local SSH tunnel: {error}"))?;
    let local_port = listener
        .local_addr()
        .map_err(|error| format!("Could not read the local SSH tunnel port: {error}"))?
        .port();

    let config = client::Config {
        keepalive_interval: Some(Duration::from_secs(15)),
        keepalive_max: 3,
        ..client::Config::default()
    };
    let handler = KnownHostsHandler {
        host: host.clone(),
        port: *port,
    };

    let host_for_error = host.clone();
    let mut session = timeout(
        SSH_CONNECT_TIMEOUT,
        client::connect(Arc::new(config), (host.as_str(), *port), handler),
    )
    .await
    .map_err(|_| format!("Timed out connecting to SSH host '{host}:{port}'"))?
    .map_err(|error| format_ssh_error(error, &host_for_error, *port))?;

    if !authenticate_password_or_prompt(&mut session, user, &password, host, *port).await? {
        let _ = session
            .disconnect(
                russh::Disconnect::ByApplication,
                "SSH password authentication failed",
                "",
            )
            .await;
        return Err("SSH password authentication was rejected by the server".to_string());
    }

    let session = Arc::new(Mutex::new(session));
    let (cancel, cancel_rx) = oneshot::channel();
    let remote_host = ssh.remote_bind_host.clone();
    let remote_port = ssh.remote_bind_port;
    let task = tokio::spawn(run_forwarder(
        listener,
        session,
        remote_host,
        remote_port,
        cancel_rx,
    ));

    Ok(RusshTunnelGuard {
        local_port,
        cancel: Some(cancel),
        task,
    })
}

async fn authenticate_password_or_prompt(
    session: &mut Handle<KnownHostsHandler>,
    user: &str,
    password: &str,
    host: &str,
    port: u16,
) -> Result<bool, String> {
    let auth_result = timeout(
        SSH_CONNECT_TIMEOUT,
        session.authenticate_password(user.to_string(), password.to_string()),
    )
    .await
    .map_err(|_| format!("Timed out authenticating to SSH host '{host}:{port}'"))?
    .map_err(|error| format!("SSH password authentication failed: {error}"))?;

    if auth_result.success() {
        return Ok(true);
    }

    if matches!(
        auth_result,
        russh::client::AuthResult::Failure {
            partial_success: true,
            ..
        }
    ) {
        return Err("The SSH server requires an additional authentication factor".to_string());
    }

    let response = timeout(
        SSH_CONNECT_TIMEOUT,
        session.authenticate_keyboard_interactive_start(user.to_string(), None),
    )
    .await
    .map_err(|_| format!("Timed out starting SSH interactive authentication for '{host}:{port}'"))?
    .map_err(|error| format!("Could not start SSH interactive authentication: {error}"))?;

    match response {
        russh::client::KeyboardInteractiveAuthResponse::Success => Ok(true),
        russh::client::KeyboardInteractiveAuthResponse::Failure {
            partial_success: true,
            ..
        } => Err("The SSH server requires an additional authentication factor".to_string()),
        russh::client::KeyboardInteractiveAuthResponse::Failure { .. } => Ok(false),
        russh::client::KeyboardInteractiveAuthResponse::InfoRequest { prompts, .. }
            if is_single_password_prompt(&prompts) =>
        {
            let response = timeout(
                SSH_CONNECT_TIMEOUT,
                session.authenticate_keyboard_interactive_respond(vec![password.to_string()]),
            )
            .await
            .map_err(|_| format!("Timed out responding to SSH authentication for '{host}:{port}'"))?
            .map_err(|error| format!("SSH interactive authentication failed: {error}"))?;

            match response {
                russh::client::KeyboardInteractiveAuthResponse::Success => Ok(true),
                russh::client::KeyboardInteractiveAuthResponse::Failure {
                    partial_success: true,
                    ..
                }
                | russh::client::KeyboardInteractiveAuthResponse::InfoRequest { .. } => Err(
                    "The SSH server requested additional interactive authentication".to_string(),
                ),
                russh::client::KeyboardInteractiveAuthResponse::Failure { .. } => Ok(false),
            }
        }
        russh::client::KeyboardInteractiveAuthResponse::InfoRequest { .. } => Err(
            "The SSH server requested an unsupported interactive authentication prompt".to_string(),
        ),
    }
}

fn is_single_password_prompt(prompts: &[russh::client::Prompt]) -> bool {
    prompts.len() == 1
        && !prompts[0].echo
        && prompts[0].prompt.to_ascii_lowercase().contains("password")
}

async fn run_forwarder(
    listener: TcpListener,
    session: Arc<Mutex<Handle<KnownHostsHandler>>>,
    remote_host: String,
    remote_port: u16,
    mut cancel: oneshot::Receiver<()>,
) {
    let mut health_check = interval(Duration::from_secs(1));

    loop {
        tokio::select! {
            _ = &mut cancel => break,
            accepted = listener.accept() => {
                let Ok((local_stream, originator)) = accepted else {
                    break;
                };

                tokio::spawn(forward_connection(
                    local_stream,
                    originator,
                    Arc::clone(&session),
                    remote_host.clone(),
                    remote_port,
                ));
            }
            _ = health_check.tick() => {
                if session.lock().await.is_closed() {
                    break;
                }
            }
        }
    }

    let session = session.lock().await;
    let _ = session
        .disconnect(russh::Disconnect::ByApplication, "Tunnel closed", "")
        .await;
}

async fn forward_connection(
    mut local_stream: TcpStream,
    originator: SocketAddr,
    session: Arc<Mutex<Handle<KnownHostsHandler>>>,
    remote_host: String,
    remote_port: u16,
) {
    let channel = session
        .lock()
        .await
        .channel_open_direct_tcpip(
            remote_host,
            u32::from(remote_port),
            originator.ip().to_string(),
            u32::from(originator.port()),
        )
        .await;

    let Ok(channel) = channel else {
        return;
    };

    let mut remote_stream = channel.into_stream();
    let _ = copy_bidirectional(&mut local_stream, &mut remote_stream).await;
}

fn format_ssh_error(error: russh::Error, host: &str, port: u16) -> String {
    if matches!(error, russh::Error::UnknownKey) {
        return format!(
            "SSH host key for '{host}:{port}' is unknown or changed. Verify it and add the trusted key to your SSH known_hosts file."
        );
    }

    format!("Could not establish the SSH session: {error}")
}

fn password_entry(credential_ref: &str) -> Result<keyring::Entry, String> {
    if credential_ref.trim().is_empty() || credential_ref.len() > 128 {
        return Err("The SSH credential reference is invalid".to_string());
    }

    keyring::Entry::new(SSH_PASSWORD_SERVICE, credential_ref)
        .map_err(|error| format!("Could not access the system credential store: {error}"))
}

pub(crate) async fn load_ssh_password(credential_ref: String) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        password_entry(&credential_ref)?
            .get_password()
            .map_err(|error| format!("Could not retrieve the saved SSH password: {error}"))
    })
    .await
    .map_err(|error| format!("Could not read the saved SSH password: {error}"))?
}

#[command]
pub async fn store_ssh_password(credential_ref: String, password: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        password_entry(&credential_ref)?
            .set_password(&password)
            .map_err(|error| format!("Could not save the SSH password securely: {error}"))
    })
    .await
    .map_err(|error| format!("Could not save the SSH password: {error}"))?
}

#[command]
pub async fn delete_ssh_password(credential_ref: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        password_entry(&credential_ref)?
            .delete_credential()
            .map_err(|error| format!("Could not remove the saved SSH password: {error}"))
    })
    .await
    .map_err(|error| format!("Could not remove the saved SSH password: {error}"))?
}

#[cfg(test)]
mod tests {
    use super::{format_ssh_error, is_single_password_prompt};

    #[test]
    fn explains_unknown_or_changed_host_keys() {
        assert!(
            format_ssh_error(russh::Error::UnknownKey, "db.example.com", 22)
                .contains("unknown or changed")
        );
    }

    #[test]
    fn only_answers_a_single_hidden_password_prompt() {
        let prompt = russh::client::Prompt {
            prompt: "Password: ".to_string(),
            echo: false,
        };
        assert!(is_single_password_prompt(&[prompt]));

        let prompts = [
            russh::client::Prompt {
                prompt: "Password: ".to_string(),
                echo: false,
            },
            russh::client::Prompt {
                prompt: "Verification code: ".to_string(),
                echo: false,
            },
        ];
        assert!(!is_single_password_prompt(&prompts));
    }
}
