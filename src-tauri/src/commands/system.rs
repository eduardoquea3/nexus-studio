use font_kit::source::SystemSource;
use serde::Serialize;
use std::env;
use std::fs;
use std::path::PathBuf;

#[tauri::command]
pub fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
pub fn list_system_fonts() -> Result<Vec<String>, String> {
    let mut families = SystemSource::new()
        .all_families()
        .map_err(|error| format!("Could not list system fonts: {error}"))?;
    families.sort_unstable_by_key(|family| family.to_ascii_lowercase());
    families.dedup();
    Ok(families)
}

#[tauri::command]
pub fn list_ssh_config_hosts() -> Result<Vec<SshConfigHost>, String> {
    let home = env::var_os("USERPROFILE")
        .or_else(|| env::var_os("HOME"))
        .ok_or_else(|| "Could not determine the user home directory".to_string())?;
    let config_path = PathBuf::from(home).join(".ssh").join("config");

    if !config_path.exists() {
        return Ok(Vec::new());
    }

    let config = fs::read_to_string(&config_path)
        .map_err(|error| format!("Could not read SSH config: {error}"))?;
    Ok(parse_ssh_config_hosts(&config))
}

#[derive(Debug, Serialize)]
pub struct SshConfigHost {
    alias: String,
    hostname: String,
}

fn parse_ssh_config_hosts(config: &str) -> Vec<SshConfigHost> {
    let mut hosts = Vec::new();
    let mut aliases = Vec::new();
    let mut hostname = None;

    let add_current_hosts = |hosts: &mut Vec<SshConfigHost>,
                             aliases: &mut Vec<String>,
                             hostname: &mut Option<String>| {
        for alias in aliases.drain(..) {
            if hosts.iter().any(|host: &SshConfigHost| host.alias == alias) {
                continue;
            }
            hosts.push(SshConfigHost {
                hostname: hostname.clone().unwrap_or_else(|| alias.clone()),
                alias,
            });
        }
        *hostname = None;
    };

    for line in config.lines() {
        let line = line.split('#').next().unwrap_or("").trim();
        let mut parts = line.split_whitespace();
        let Some(keyword) = parts.next() else {
            continue;
        };

        if keyword.eq_ignore_ascii_case("host") {
            add_current_hosts(&mut hosts, &mut aliases, &mut hostname);
            aliases.extend(
                parts
                    .filter(|alias| {
                        !alias.starts_with('!') && !alias.contains('*') && !alias.contains('?')
                    })
                    .map(str::to_string),
            );
        } else if keyword.eq_ignore_ascii_case("hostname") && !aliases.is_empty() {
            if let Some(value) = parts.next() {
                hostname = Some(value.to_string());
            }
        }
    }

    add_current_hosts(&mut hosts, &mut aliases, &mut hostname);
    hosts.sort_unstable_by_key(|host| host.alias.to_ascii_lowercase());
    hosts
}

#[cfg(test)]
mod tests {
    use super::parse_ssh_config_hosts;

    #[test]
    fn parses_hostnames_for_each_alias() {
        let hosts = parse_ssh_config_hosts(
            "Host back backoffice\n  HostName 192.168.1.20\nHost hetzner\n  HostName server.example.com\n",
        );

        assert_eq!(hosts.len(), 3);
        assert_eq!(hosts[0].alias, "back");
        assert_eq!(hosts[0].hostname, "192.168.1.20");
        assert_eq!(hosts[1].alias, "backoffice");
        assert_eq!(hosts[1].hostname, "192.168.1.20");
        assert_eq!(hosts[2].alias, "hetzner");
        assert_eq!(hosts[2].hostname, "server.example.com");
    }

    #[test]
    fn uses_alias_when_host_name_is_not_defined() {
        let hosts = parse_ssh_config_hosts("Host local\n  User developer\n");

        assert_eq!(hosts[0].alias, "local");
        assert_eq!(hosts[0].hostname, "local");
    }
}
