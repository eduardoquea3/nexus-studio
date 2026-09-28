use crate::models::{ConnectionTestRequest, SshTunnelAuth, SshTunnelSource};
use sqlx::{
    mysql::{MySqlConnectOptions, MySqlConnection},
    postgres::{PgConnectOptions, PgConnection},
    sqlite::{SqliteConnectOptions, SqliteConnection},
    Connection, Row,
};
use std::collections::HashMap;
use std::fs::OpenOptions;
use std::io::Read;
use std::net::TcpListener;
use std::process::{Child, Command, ExitStatus, Stdio};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::State;
use tokio::net::TcpStream;
use tokio::time::sleep;

#[tauri::command]
pub async fn test_connection(
    request: ConnectionTestRequest,
    tunnel_manager: State<'_, SshTunnelManager>,
) -> Result<String, String> {
    let (temporary_tunnel, local_port) = prepare_ssh_tunnel(&tunnel_manager, &request).await?;
    let default_port = if request.db_type == "mysql" {
        3306
    } else {
        5432
    };
    let (connection_host, connection_port) = connection_target(&request, local_port, default_port)?;

    let result = match request.db_type.as_str() {
        "postgres" => {
            let options = PgConnectOptions::new()
                .host(connection_host)
                .port(connection_port)
                .database(request.database.as_deref().ok_or("Database is required")?)
                .username(request.username.as_deref().unwrap_or("postgres"))
                .password(request.password.as_deref().unwrap_or(""));

            PgConnection::connect_with(&options)
                .await
                .map(|_| "PostgreSQL connection successful".to_string())
                .map_err(|error| format!("PostgreSQL connection failed: {error}"))
        }
        "mysql" => {
            let options = MySqlConnectOptions::new()
                .host(connection_host)
                .port(connection_port)
                .database(request.database.as_deref().ok_or("Database is required")?)
                .username(request.username.as_deref().unwrap_or("root"))
                .password(request.password.as_deref().unwrap_or(""));

            MySqlConnection::connect_with(&options)
                .await
                .map(|_| "MySQL connection successful".to_string())
                .map_err(|error| format!("MySQL connection failed: {error}"))
        }
        "sqlite" => {
            let path = request
                .sqlite_path
                .as_deref()
                .ok_or("SQLite database path is required")?;
            let options = SqliteConnectOptions::new()
                .filename(path)
                .create_if_missing(false);

            SqliteConnection::connect_with(&options)
                .await
                .map(|_| "SQLite connection successful".to_string())
                .map_err(|error| format!("SQLite connection failed: {error}"))
        }
        database => Err(format!("Unsupported database type: {database}")),
    };

    if result.is_err() && request.persist_ssh_tunnel {
        if let Some(connection_id) = request.connection_id.as_deref() {
            tunnel_manager.close(connection_id);
        }
    }

    drop(temporary_tunnel);
    result
}

#[tauri::command]
pub fn close_ssh_tunnel(connection_id: String, tunnel_manager: State<'_, SshTunnelManager>) {
    tunnel_manager.close(&connection_id);
}

pub(crate) struct SshTunnelGuard {
    child: Child,
    pub(crate) local_port: u16,
}

impl Drop for SshTunnelGuard {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

#[derive(Default)]
pub(crate) struct SshTunnelManager {
    tunnels: Mutex<HashMap<String, SshTunnelGuard>>,
}

impl SshTunnelManager {
    pub(crate) async fn ensure(
        &self,
        request: &ConnectionTestRequest,
    ) -> Result<Option<u16>, String> {
        if request.ssh.is_none() {
            return Ok(None);
        }
        let connection_id = request
            .connection_id
            .as_deref()
            .ok_or("Connection id is required for a persistent SSH tunnel")?;

        {
            let mut tunnels = self
                .tunnels
                .lock()
                .map_err(|_| "Could not access SSH tunnel state".to_string())?;
            if let Some(tunnel) = tunnels.get_mut(connection_id) {
                if tunnel
                    .child
                    .try_wait()
                    .map_err(|error| format!("Could not inspect the SSH process: {error}"))?
                    .is_none()
                {
                    return Ok(Some(tunnel.local_port));
                }
                tunnels.remove(connection_id);
            }
        }

        let tunnel = open_ssh_tunnel(request).await?;
        let local_port = tunnel.as_ref().map(|tunnel| tunnel.local_port);
        if let Some(tunnel) = tunnel {
            self.tunnels
                .lock()
                .map_err(|_| "Could not access SSH tunnel state".to_string())?
                .insert(connection_id.to_string(), tunnel);
        }
        Ok(local_port)
    }

    pub(crate) fn close(&self, connection_id: &str) {
        if let Ok(mut tunnels) = self.tunnels.lock() {
            tunnels.remove(connection_id);
        }
    }
}

pub(crate) async fn prepare_ssh_tunnel(
    tunnel_manager: &SshTunnelManager,
    request: &ConnectionTestRequest,
) -> Result<(Option<SshTunnelGuard>, Option<u16>), String> {
    if request.persist_ssh_tunnel {
        return Ok((None, tunnel_manager.ensure(request).await?));
    }

    let tunnel = open_ssh_tunnel(request).await?;
    let local_port = tunnel.as_ref().map(|tunnel| tunnel.local_port);
    Ok((tunnel, local_port))
}

pub(crate) async fn open_ssh_tunnel(
    request: &ConnectionTestRequest,
) -> Result<Option<SshTunnelGuard>, String> {
    let Some(ssh) = request.ssh.as_ref() else {
        return Ok(None);
    };

    if request.db_type == "sqlite" {
        return Err("SSH tunnels are not supported for SQLite connections".to_string());
    }

    let local_port = TcpListener::bind(("127.0.0.1", 0))
        .map_err(|error| format!("Could not reserve a local SSH tunnel port: {error}"))?
        .local_addr()
        .map_err(|error| format!("Could not read the local SSH tunnel port: {error}"))?
        .port();
    let remote_host = &ssh.remote_bind_host;
    let remote_port = ssh.remote_bind_port;
    let mut command = Command::new("ssh");
    command
        .arg("-N")
        .arg("-T")
        .arg("-o")
        .arg("BatchMode=yes")
        .arg("-o")
        .arg("ExitOnForwardFailure=yes")
        .arg("-o")
        .arg("ConnectTimeout=10")
        .arg("-L")
        .arg(format!(
            "127.0.0.1:{local_port}:{remote_host}:{remote_port}"
        ));

    match &ssh.source {
        SshTunnelSource::FromSshConfig { alias } => {
            command.arg(alias);
        }
        SshTunnelSource::Manual { host, port, user } => {
            command.arg("-p").arg(port.to_string()).arg("-l").arg(user);
            if let SshTunnelAuth::KeyFile { path, .. } = &ssh.auth {
                if !path.trim().is_empty() {
                    command.arg("-i").arg(path);
                }
            }
            command.arg(host);
        }
    }

    if matches!(&ssh.auth, SshTunnelAuth::Password) {
        return Err(
            "SSH password authentication is not supported for automated tests; use a key file"
                .to_string(),
        );
    }

    let mut child = command
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("Could not start the SSH client: {error}"))?;

    if let Err(error) = wait_for_ssh_tunnel(&mut child, local_port).await {
        terminate_ssh_process(&mut child);
        return Err(error);
    }

    Ok(Some(SshTunnelGuard { child, local_port }))
}

pub(crate) fn connection_target<'a>(
    request: &'a ConnectionTestRequest,
    local_port: Option<u16>,
    default_port: u16,
) -> Result<(&'a str, u16), String> {
    if request.db_type == "sqlite" {
        return Ok(("", request.port.unwrap_or(default_port)));
    }

    let host = local_port
        .map(|_| "127.0.0.1")
        .or(request.host.as_deref())
        .ok_or("Host is required")?;
    let port = local_port.unwrap_or(request.port.unwrap_or(default_port));
    Ok((host, port))
}

async fn wait_for_ssh_tunnel(child: &mut Child, local_port: u16) -> Result<(), String> {
    let deadline = Instant::now() + Duration::from_secs(10);
    loop {
        if TcpStream::connect(("127.0.0.1", local_port)).await.is_ok() {
            return Ok(());
        }

        if let Some(status) = child
            .try_wait()
            .map_err(|error| format!("Could not inspect the SSH process: {error}"))?
        {
            return Err(format_ssh_exit_error(child, status));
        }

        if Instant::now() >= deadline {
            return Err("Timed out while opening the SSH tunnel".to_string());
        }

        sleep(Duration::from_millis(100)).await;
    }
}

fn format_ssh_exit_error(child: &mut Child, status: ExitStatus) -> String {
    let mut stderr = String::new();
    if let Some(mut pipe) = child.stderr.take() {
        let _ = pipe.read_to_string(&mut stderr);
    }
    let detail = stderr.trim();
    if detail.is_empty() {
        format!("SSH tunnel failed with status {status}")
    } else {
        format!("SSH tunnel failed: {detail}")
    }
}

fn terminate_ssh_process(child: &mut Child) {
    let _ = child.kill();
    let _ = child.wait();
}

#[tauri::command]
pub async fn list_databases(
    request: ConnectionTestRequest,
    tunnel_manager: State<'_, SshTunnelManager>,
) -> Result<Vec<String>, String> {
    let (_temporary_tunnel, local_port) = prepare_ssh_tunnel(&tunnel_manager, &request).await?;
    let default_port = if request.db_type == "mysql" {
        3306
    } else {
        5432
    };
    let (connection_host, connection_port) = connection_target(&request, local_port, default_port)?;

    match request.db_type.as_str() {
        "postgres" => {
            let options = PgConnectOptions::new()
                .host(connection_host)
                .port(connection_port)
                .database(request.database.as_deref().ok_or("Database is required")?)
                .username(request.username.as_deref().unwrap_or("postgres"))
                .password(request.password.as_deref().unwrap_or(""));
            let mut connection = PgConnection::connect_with(&options)
                .await
                .map_err(|error| format!("PostgreSQL connection failed: {error}"))?;
            let rows = sqlx::query(
                "SELECT datname FROM pg_database WHERE datallowconn = true AND datistemplate = false ORDER BY datname",
            )
            .fetch_all(&mut connection)
            .await;
            match rows {
                Ok(rows) => Ok(rows.into_iter().map(|row| row.get("datname")).collect()),
                Err(list_error) => {
                    let current = sqlx::query("SELECT current_database() AS datname")
                        .fetch_one(&mut connection)
                        .await
                        .map_err(|fallback_error| {
                            format!(
                                "Could not list PostgreSQL databases: {list_error}; could not read the current database: {fallback_error}"
                            )
                        })?;
                    Ok(vec![current.get("datname")])
                }
            }
        }
        "mysql" => {
            let options = MySqlConnectOptions::new()
                .host(connection_host)
                .port(connection_port)
                .database(request.database.as_deref().unwrap_or("mysql"))
                .username(request.username.as_deref().unwrap_or("root"))
                .password(request.password.as_deref().unwrap_or(""));
            let mut connection = MySqlConnection::connect_with(&options)
                .await
                .map_err(|error| format!("MySQL connection failed: {error}"))?;
            let rows = sqlx::query("SHOW DATABASES")
                .fetch_all(&mut connection)
                .await;
            match rows {
                Ok(rows) => Ok(rows.into_iter().map(|row| row.get(0)).collect()),
                Err(list_error) => {
                    let current = sqlx::query("SELECT DATABASE()")
                        .fetch_one(&mut connection)
                        .await
                        .map_err(|fallback_error| {
                            format!(
                                "Could not list MySQL databases: {list_error}; could not read the current database: {fallback_error}"
                            )
                        })?;
                    let current: Option<String> = current.try_get(0).map_err(|fallback_error| {
                        format!("Could not read the current MySQL database: {fallback_error}")
                    })?;
                    Ok(current.into_iter().collect())
                }
            }
        }
        "sqlite" => Ok(request.sqlite_path.into_iter().collect()),
        database => Err(format!("Unsupported database type: {database}")),
    }
}

#[tauri::command]
pub async fn create_sqlite_database(path: String) -> Result<(), String> {
    let file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&path)
        .map_err(|error| format!("Could not create SQLite database at '{path}': {error}"))?;
    drop(file);

    let options = SqliteConnectOptions::new()
        .filename(&path)
        .create_if_missing(true);

    match SqliteConnection::connect_with(&options).await {
        Ok(_) => Ok(()),
        Err(error) => {
            let _ = std::fs::remove_file(&path);
            Err(format!(
                "Could not create SQLite database at '{path}': {error}"
            ))
        }
    }
}
