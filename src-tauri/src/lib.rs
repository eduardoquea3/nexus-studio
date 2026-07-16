use serde::Deserialize;
use sqlx::{
    mysql::{MySqlConnectOptions, MySqlConnection},
    postgres::{PgConnectOptions, PgConnection},
    sqlite::{SqliteConnectOptions, SqliteConnection},
    Connection,
};
use tauri_plugin_store::Builder as StoreBuilder;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ConnectionTestRequest {
    db_type: String,
    host: Option<String>,
    port: Option<u16>,
    database: Option<String>,
    username: Option<String>,
    password: Option<String>,
    sqlite_path: Option<String>,
}

#[tauri::command]
async fn test_connection(request: ConnectionTestRequest) -> Result<String, String> {
    match request.db_type.as_str() {
        "postgres" => {
            let options = PgConnectOptions::new()
                .host(request.host.as_deref().ok_or("Host is required")?)
                .port(request.port.unwrap_or(5432))
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
                .host(request.host.as_deref().ok_or("Host is required")?)
                .port(request.port.unwrap_or(3306))
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
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(StoreBuilder::default().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, test_connection])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
