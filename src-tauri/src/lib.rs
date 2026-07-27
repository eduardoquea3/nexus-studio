use serde::{Deserialize, Serialize};
use sqlx::{
    mysql::{MySqlConnectOptions, MySqlConnection},
    postgres::{PgConnectOptions, PgConnection},
    sqlite::{SqliteConnectOptions, SqliteConnection},
    Connection, Column, Row,
};
use std::collections::HashMap;
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

#[derive(Debug, Serialize)]
struct ObjectMeta {
    name: String,
    object_type: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TableDataRequest {
    request: ConnectionTestRequest,
    table: String,
    page: u32,
    page_size: u32,
}

#[derive(Debug, Serialize)]
struct TableDataPage {
    columns: Vec<String>,
    rows: Vec<HashMap<String, serde_json::Value>>,
    total: usize,
    page: u32,
    page_size: u32,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TableSchemaRequest {
    request: ConnectionTestRequest,
    table: String,
}

#[derive(Debug, Serialize)]
struct ColumnInfo {
    name: String,
    data_type: String,
    nullable: bool,
    default: Option<String>,
    is_pk: bool,
    is_fk: bool,
    is_unique: bool,
}

#[derive(Debug, Serialize)]
struct TableSchemaResult {
    columns: Vec<ColumnInfo>,
    indexes: Vec<String>,
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

#[tauri::command]
async fn list_databases(request: ConnectionTestRequest) -> Result<Vec<String>, String> {
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
async fn list_schema_objects(
    request: ConnectionTestRequest,
) -> Result<Vec<ObjectMeta>, String> {
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
            let mut objects = Vec::new();

            let rows = sqlx::query(
                "SELECT table_name, table_type FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog', 'information_schema') AND table_type IN ('BASE TABLE', 'VIEW') ORDER BY table_type, table_name",
            )
            .fetch_all(&mut connection)
            .await
            .map_err(|error| format!("Could not list PostgreSQL tables and views: {error}"))?;

            for row in rows {
                let object_type = match row.get::<String, _>("table_type").as_str() {
                    "VIEW" => "view",
                    _ => "table",
                };
                objects.push(ObjectMeta {
                    name: row.get("table_name"),
                    object_type: object_type.to_string(),
                });
            }

            let rows = sqlx::query(
                "SELECT routine_name, routine_type FROM information_schema.routines WHERE routine_schema NOT IN ('pg_catalog', 'information_schema') AND routine_type IN ('FUNCTION', 'PROCEDURE') ORDER BY routine_type, routine_name",
            )
            .fetch_all(&mut connection)
            .await
            .map_err(|error| format!("Could not list PostgreSQL routines: {error}"))?;

            for row in rows {
                let object_type = match row.get::<String, _>("routine_type").as_str() {
                    "PROCEDURE" => "procedure",
                    _ => "function",
                };
                objects.push(ObjectMeta {
                    name: row.get("routine_name"),
                    object_type: object_type.to_string(),
                });
            }

            Ok(objects)
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
            let mut objects = Vec::new();

            let rows = sqlx::query(
                "SELECT table_name, table_type FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type IN ('BASE TABLE', 'VIEW') ORDER BY table_type, table_name",
            )
            .fetch_all(&mut connection)
            .await
            .map_err(|error| format!("Could not list MySQL tables and views: {error}"))?;

            for row in rows {
                let object_type = match row.get::<String, _>("table_type").as_str() {
                    "VIEW" => "view",
                    _ => "table",
                };
                objects.push(ObjectMeta {
                    name: row.get("table_name"),
                    object_type: object_type.to_string(),
                });
            }

            let rows = sqlx::query(
                "SELECT routine_name, routine_type FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_type IN ('FUNCTION', 'PROCEDURE') ORDER BY routine_type, routine_name",
            )
            .fetch_all(&mut connection)
            .await
            .map_err(|error| format!("Could not list MySQL routines: {error}"))?;

            for row in rows {
                let object_type = match row.get::<String, _>("routine_type").as_str() {
                    "PROCEDURE" => "procedure",
                    _ => "function",
                };
                objects.push(ObjectMeta {
                    name: row.get("routine_name"),
                    object_type: object_type.to_string(),
                });
            }

            Ok(objects)
        }
        "sqlite" => {
            let path = request
                .sqlite_path
                .as_deref()
                .ok_or("SQLite database path is required")?;
            let options = SqliteConnectOptions::new()
                .filename(path)
                .create_if_missing(false);
            let mut connection = SqliteConnection::connect_with(&options)
                .await
                .map_err(|error| format!("SQLite connection failed: {error}"))?;
            let rows = sqlx::query(
                "SELECT name, type FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY type, name",
            )
            .fetch_all(&mut connection)
            .await
            .map_err(|error| format!("Could not list SQLite objects: {error}"))?;

            Ok(rows
                .into_iter()
                .map(|row| ObjectMeta {
                    name: row.get("name"),
                    object_type: match row.get::<String, _>("type").as_str() {
                        "view" => "view".to_string(),
                        _ => "table".to_string(),
                    },
                })
                .collect())
        }
        database => Err(format!("Unsupported database type: {database}")),
    }
}

fn validate_table_name(table: &str) -> Result<(), String> {
    if table.is_empty()
        || !table
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || character == '_')
    {
        return Err("Invalid table name".to_string());
    }

    Ok(())
}

fn postgres_value(row: &sqlx::postgres::PgRow, index: usize) -> serde_json::Value {
    if let Ok(value) = row.try_get::<uuid::Uuid, _>(index) {
        return serde_json::Value::String(value.to_string());
    }
    if let Ok(value) = row.try_get::<String, _>(index) {
        return serde_json::Value::String(value);
    }
    if let Ok(value) = row.try_get::<i64, _>(index) {
        return serde_json::json!(value);
    }
    if let Ok(value) = row.try_get::<i32, _>(index) {
        return serde_json::json!(value);
    }
    if let Ok(value) = row.try_get::<f64, _>(index) {
        return serde_json::json!(value);
    }
    if let Ok(value) = row.try_get::<bool, _>(index) {
        return serde_json::json!(value);
    }
    serde_json::Value::Null
}

fn mysql_value(row: &sqlx::mysql::MySqlRow, index: usize) -> serde_json::Value {
    if let Ok(value) = row.try_get::<String, _>(index) {
        return serde_json::Value::String(value);
    }
    if let Ok(value) = row.try_get::<i64, _>(index) {
        return serde_json::json!(value);
    }
    if let Ok(value) = row.try_get::<u64, _>(index) {
        return serde_json::json!(value);
    }
    if let Ok(value) = row.try_get::<f64, _>(index) {
        return serde_json::json!(value);
    }
    if let Ok(value) = row.try_get::<bool, _>(index) {
        return serde_json::json!(value);
    }
    serde_json::Value::Null
}

fn sqlite_value(row: &sqlx::sqlite::SqliteRow, index: usize) -> serde_json::Value {
    if let Ok(value) = row.try_get::<String, _>(index) {
        return serde_json::Value::String(value);
    }
    if let Ok(value) = row.try_get::<i64, _>(index) {
        return serde_json::json!(value);
    }
    if let Ok(value) = row.try_get::<f64, _>(index) {
        return serde_json::json!(value);
    }
    serde_json::Value::Null
}

#[tauri::command]
async fn get_table_data(request: TableDataRequest) -> Result<TableDataPage, String> {
    validate_table_name(&request.table)?;
    let page = request.page.max(1);
    let page_size = request.page_size.clamp(1, 100);
    let offset = (page - 1) * page_size;

    match request.request.db_type.as_str() {
        "postgres" => {
            let connection_request = request.request;
            let options = PgConnectOptions::new()
                .host(connection_request.host.as_deref().ok_or("Host is required")?)
                .port(connection_request.port.unwrap_or(5432))
                .database(connection_request.database.as_deref().ok_or("Database is required")?)
                .username(connection_request.username.as_deref().unwrap_or("postgres"))
                .password(connection_request.password.as_deref().unwrap_or(""));
            let mut connection = PgConnection::connect_with(&options)
                .await
                .map_err(|error| format!("PostgreSQL connection failed: {error}"))?;
            let query = format!(
                "SELECT * FROM \"{}\" LIMIT $1 OFFSET $2",
                request.table
            );
            let rows = sqlx::query(&query)
                .bind(page_size as i64)
                .bind(offset as i64)
                .fetch_all(&mut connection)
                .await
                .map_err(|error| format!("Could not load table data: {error}"))?;
            let columns: Vec<String> = rows
                .first()
                .map(|row| row.columns().iter().map(|column| column.name().to_string()).collect())
                .unwrap_or_default();
            let data_rows = rows
                .iter()
                .map(|row| {
                    columns
                        .iter()
                        .enumerate()
                        .map(|(index, column)| (column.clone(), postgres_value(row, index)))
                        .collect()
                })
                .collect::<Vec<_>>();
            Ok(TableDataPage { columns, total: data_rows.len(), rows: data_rows, page, page_size })
        }
        "mysql" => {
            let connection_request = request.request;
            let options = MySqlConnectOptions::new()
                .host(connection_request.host.as_deref().ok_or("Host is required")?)
                .port(connection_request.port.unwrap_or(3306))
                .database(connection_request.database.as_deref().unwrap_or("mysql"))
                .username(connection_request.username.as_deref().unwrap_or("root"))
                .password(connection_request.password.as_deref().unwrap_or(""));
            let mut connection = MySqlConnection::connect_with(&options)
                .await
                .map_err(|error| format!("MySQL connection failed: {error}"))?;
            let query = format!("SELECT * FROM `{}` LIMIT ? OFFSET ?", request.table);
            let rows = sqlx::query(&query)
                .bind(page_size)
                .bind(offset)
                .fetch_all(&mut connection)
                .await
                .map_err(|error| format!("Could not load table data: {error}"))?;
            let columns: Vec<String> = rows
                .first()
                .map(|row| row.columns().iter().map(|column| column.name().to_string()).collect())
                .unwrap_or_default();
            let data_rows = rows
                .iter()
                .map(|row| {
                    columns
                        .iter()
                        .enumerate()
                        .map(|(index, column)| (column.clone(), mysql_value(row, index)))
                        .collect()
                })
                .collect::<Vec<_>>();
            Ok(TableDataPage { columns, total: data_rows.len(), rows: data_rows, page, page_size })
        }
        "sqlite" => {
            let path = request
                .request
                .sqlite_path
                .as_deref()
                .ok_or("SQLite database path is required")?;
            let options = SqliteConnectOptions::new().filename(path).create_if_missing(false);
            let mut connection = SqliteConnection::connect_with(&options)
                .await
                .map_err(|error| format!("SQLite connection failed: {error}"))?;
            let query = format!("SELECT * FROM \"{}\" LIMIT ? OFFSET ?", request.table);
            let rows = sqlx::query(&query)
                .bind(page_size as i64)
                .bind(offset as i64)
                .fetch_all(&mut connection)
                .await
                .map_err(|error| format!("Could not load table data: {error}"))?;
            let columns: Vec<String> = rows
                .first()
                .map(|row| row.columns().iter().map(|column| column.name().to_string()).collect())
                .unwrap_or_default();
            let data_rows = rows
                .iter()
                .map(|row| {
                    columns
                        .iter()
                        .enumerate()
                        .map(|(index, column)| (column.clone(), sqlite_value(row, index)))
                        .collect()
                })
                .collect::<Vec<_>>();
            Ok(TableDataPage { columns, total: data_rows.len(), rows: data_rows, page, page_size })
        }
        database => Err(format!("Unsupported database type: {database}")),
    }
}

#[tauri::command]
async fn get_table_schema(request: TableSchemaRequest) -> Result<TableSchemaResult, String> {
    validate_table_name(&request.table)?;

    match request.request.db_type.as_str() {
        "postgres" => {
            let connection_request = request.request;
            let options = PgConnectOptions::new()
                .host(connection_request.host.as_deref().ok_or("Host is required")?)
                .port(connection_request.port.unwrap_or(5432))
                .database(connection_request.database.as_deref().ok_or("Database is required")?)
                .username(connection_request.username.as_deref().unwrap_or("postgres"))
                .password(connection_request.password.as_deref().unwrap_or(""));
            let mut connection = PgConnection::connect_with(&options)
                .await
                .map_err(|error| format!("PostgreSQL connection failed: {error}"))?;
            let rows = sqlx::query(
                "SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = $1 AND table_schema NOT IN ('pg_catalog', 'information_schema') ORDER BY ordinal_position",
            )
            .bind(&request.table)
            .fetch_all(&mut connection)
            .await
            .map_err(|error| format!("Could not load table structure: {error}"))?;

            Ok(TableSchemaResult {
                columns: rows
                    .into_iter()
                    .map(|row| ColumnInfo {
                        name: row.get("column_name"),
                        data_type: row.get("data_type"),
                        nullable: row.get::<String, _>("is_nullable") == "YES",
                        default: row.get("column_default"),
                        is_pk: false,
                        is_fk: false,
                        is_unique: false,
                    })
                    .collect(),
                indexes: Vec::new(),
            })
        }
        "mysql" => {
            let connection_request = request.request;
            let options = MySqlConnectOptions::new()
                .host(connection_request.host.as_deref().ok_or("Host is required")?)
                .port(connection_request.port.unwrap_or(3306))
                .database(connection_request.database.as_deref().unwrap_or("mysql"))
                .username(connection_request.username.as_deref().unwrap_or("root"))
                .password(connection_request.password.as_deref().unwrap_or(""));
            let mut connection = MySqlConnection::connect_with(&options)
                .await
                .map_err(|error| format!("MySQL connection failed: {error}"))?;
            let rows = sqlx::query(
                "SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? ORDER BY ordinal_position",
            )
            .bind(&request.table)
            .fetch_all(&mut connection)
            .await
            .map_err(|error| format!("Could not load table structure: {error}"))?;

            Ok(TableSchemaResult {
                columns: rows
                    .into_iter()
                    .map(|row| ColumnInfo {
                        name: row.get("column_name"),
                        data_type: row.get("data_type"),
                        nullable: row.get::<String, _>("is_nullable") == "YES",
                        default: row.get("column_default"),
                        is_pk: false,
                        is_fk: false,
                        is_unique: false,
                    })
                    .collect(),
                indexes: Vec::new(),
            })
        }
        "sqlite" => {
            let path = request
                .request
                .sqlite_path
                .as_deref()
                .ok_or("SQLite database path is required")?;
            let options = SqliteConnectOptions::new().filename(path).create_if_missing(false);
            let mut connection = SqliteConnection::connect_with(&options)
                .await
                .map_err(|error| format!("SQLite connection failed: {error}"))?;
            let query = format!("PRAGMA table_info(\"{}\")", request.table);
            let rows = sqlx::query(&query)
                .fetch_all(&mut connection)
                .await
                .map_err(|error| format!("Could not load table structure: {error}"))?;

            Ok(TableSchemaResult {
                columns: rows
                    .into_iter()
                    .map(|row| ColumnInfo {
                        name: row.get("name"),
                        data_type: row.get::<String, _>("type"),
                        nullable: row.get::<i64, _>("notnull") == 0,
                        default: row.get("dflt_value"),
                        is_pk: row.get::<i64, _>("pk") > 0,
                        is_fk: false,
                        is_unique: false,
                    })
                    .collect(),
                indexes: Vec::new(),
            })
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
        .invoke_handler(tauri::generate_handler![
            greet,
            test_connection,
            list_databases,
            list_schema_objects,
            get_table_data,
            get_table_schema
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
