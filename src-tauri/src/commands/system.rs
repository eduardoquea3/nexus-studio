use font_kit::source::SystemSource;
use serde::Serialize;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;

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

#[tauri::command]
pub async fn write_json_file(
    app: tauri::AppHandle,
    path: String,
    contents: String,
) -> Result<String, String> {
    let output_path = PathBuf::from(path);
    let display_path = app
        .path()
        .home_dir()
        .ok()
        .and_then(|home| display_home_relative_path(&output_path, &home))
        .unwrap_or_else(|| output_path.to_string_lossy().into_owned());
    let error_path = output_path.clone();

    tokio::task::spawn_blocking(move || fs::write(&output_path, contents))
        .await
        .map_err(|error| format!("Could not write JSON file: {error}"))?
        .map_err(|error| {
            format!(
                "Could not write JSON file '{}': {error}",
                error_path.display()
            )
        })?;

    Ok(display_path)
}

fn display_home_relative_path(path: &Path, home: &Path) -> Option<String> {
    let relative_path = path.strip_prefix(home).ok()?;
    let relative_path = relative_path.to_string_lossy().replace('\\', "/");

    Some(if relative_path.is_empty() {
        "~".to_string()
    } else {
        format!("~/{relative_path}")
    })
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
    use super::{display_home_relative_path, parse_ssh_config_hosts};
    use std::path::Path;

    #[test]
    fn shortens_paths_under_the_home_directory() {
        let display_path = display_home_relative_path(
            Path::new("home/user/Downloads/selected-rows.json"),
            Path::new("home/user"),
        );

        assert_eq!(
            display_path.as_deref(),
            Some("~/Downloads/selected-rows.json")
        );
    }

    #[test]
    fn keeps_paths_outside_the_home_directory_unshortened() {
        let display_path = display_home_relative_path(
            Path::new("mnt/shared/selected-rows.json"),
            Path::new("home/user"),
        );

        assert_eq!(display_path, None);
    }

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
