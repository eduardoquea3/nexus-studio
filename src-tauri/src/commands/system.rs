use font_kit::source::SystemSource;
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
pub fn list_ssh_config_aliases() -> Result<Vec<String>, String> {
    let home = env::var_os("USERPROFILE")
        .or_else(|| env::var_os("HOME"))
        .ok_or_else(|| "Could not determine the user home directory".to_string())?;
    let config_path = PathBuf::from(home).join(".ssh").join("config");

    if !config_path.exists() {
        return Ok(Vec::new());
    }

    let config = fs::read_to_string(&config_path)
        .map_err(|error| format!("Could not read SSH config: {error}"))?;
    let mut aliases = Vec::new();

    for line in config.lines() {
        let line = line.split('#').next().unwrap_or("").trim();
        let mut parts = line.split_whitespace();
        if !parts
            .next()
            .is_some_and(|keyword| keyword.eq_ignore_ascii_case("host"))
        {
            continue;
        }

        for alias in parts {
            if alias.starts_with('!') || alias.contains('*') || alias.contains('?') {
                continue;
            }
            if !aliases.iter().any(|item| item == alias) {
                aliases.push(alias.to_string());
            }
        }
    }

    aliases.sort_unstable_by_key(|alias| alias.to_ascii_lowercase());
    Ok(aliases)
}
