use crate::models::ConnectionTestRequest;
use sqlx::{
    mysql::{MySqlConnectOptions, MySqlConnection},
    postgres::{PgConnectOptions, PgConnection},
    sqlite::{SqliteConnectOptions, SqliteConnection},
    Connection, Row,
};
use std::fs::OpenOptions;

#[tauri::command]
pub async fn test_connection(request: ConnectionTestRequest) -> Result<String, String> {
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

#[tauri::command]
pub async fn list_databases(request: ConnectionTestRequest) -> Result<Vec<String>, String> {
    match request.db_type.as_str() {
        "postgres" => {
            let options = PgConnectOptions::new()
                .host(request.host.as_deref().ok_or("Host is required")?)
                .port(request.port.unwrap_or(5432))
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
            .await
            .map_err(|error| format!("Could not list PostgreSQL databases: {error}"))?;
            Ok(rows.into_iter().map(|row| row.get("datname")).collect())
        }
        "mysql" => {
            let options = MySqlConnectOptions::new()
                .host(request.host.as_deref().ok_or("Host is required")?)
                .port(request.port.unwrap_or(3306))
                .database(request.database.as_deref().unwrap_or("mysql"))
                .username(request.username.as_deref().unwrap_or("root"))
                .password(request.password.as_deref().unwrap_or(""));
            let mut connection = MySqlConnection::connect_with(&options)
                .await
                .map_err(|error| format!("MySQL connection failed: {error}"))?;
            let rows = sqlx::query("SHOW DATABASES")
                .fetch_all(&mut connection)
                .await
                .map_err(|error| format!("Could not list MySQL databases: {error}"))?;
            Ok(rows.into_iter().map(|row| row.get(0)).collect())
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
