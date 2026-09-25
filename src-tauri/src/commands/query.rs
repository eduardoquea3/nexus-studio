use crate::models::{QueryRequest, QueryResult};
use sqlx::{
    mysql::{MySqlConnectOptions, MySqlConnection},
    postgres::{PgConnectOptions, PgConnection},
    sqlite::{SqliteConnectOptions, SqliteConnection},
    Column, Connection, Row,
};

#[tauri::command]
pub async fn run_query(request: QueryRequest) -> Result<QueryResult, String> {
    let sql = request.sql.trim();
    if sql.is_empty() {
        return Err("The query is empty".to_string());
    }

    let started = std::time::Instant::now();
    let read_query = is_read_query(sql);

    match request.request.db_type.as_str() {
        "postgres" => {
            let connection_request = request.request;
            let options = PgConnectOptions::new()
                .host(
                    connection_request
                        .host
                        .as_deref()
                        .ok_or("Host is required")?,
                )
                .port(connection_request.port.unwrap_or(5432))
                .database(
                    connection_request
                        .database
                        .as_deref()
                        .ok_or("Database is required")?,
                )
                .username(connection_request.username.as_deref().unwrap_or("postgres"))
                .password(connection_request.password.as_deref().unwrap_or(""));
            let mut connection = PgConnection::connect_with(&options)
                .await
                .map_err(|error| format!("PostgreSQL connection failed: {error}"))?;
            if read_query {
                let rows = sqlx::query(sql)
                    .fetch_all(&mut connection)
                    .await
                    .map_err(|error| format!("Query failed: {error}"))?;
                let columns: Vec<String> = rows
                    .first()
                    .map(|row| {
                        row.columns()
                            .iter()
                            .map(|column| column.name().to_string())
                            .collect()
                    })
                    .unwrap_or_default();
                let data_rows = rows
                    .iter()
                    .map(|row| {
                        columns
                            .iter()
                            .enumerate()
                            .map(|(index, column)| {
                                (column.clone(), super::schema::postgres_value(row, index))
                            })
                            .collect()
                    })
                    .collect();
                Ok(QueryResult {
                    columns,
                    rows: data_rows,
                    affected: 0,
                    duration_ms: started.elapsed().as_millis(),
                })
            } else {
                let result = sqlx::query(sql)
                    .execute(&mut connection)
                    .await
                    .map_err(|error| format!("Query failed: {error}"))?;
                Ok(QueryResult {
                    columns: Vec::new(),
                    rows: Vec::new(),
                    affected: result.rows_affected(),
                    duration_ms: started.elapsed().as_millis(),
                })
            }
        }
        "mysql" => {
            let connection_request = request.request;
            let options = MySqlConnectOptions::new()
                .host(
                    connection_request
                        .host
                        .as_deref()
                        .ok_or("Host is required")?,
                )
                .port(connection_request.port.unwrap_or(3306))
                .database(connection_request.database.as_deref().unwrap_or("mysql"))
                .username(connection_request.username.as_deref().unwrap_or("root"))
                .password(connection_request.password.as_deref().unwrap_or(""));
            let mut connection = MySqlConnection::connect_with(&options)
                .await
                .map_err(|error| format!("MySQL connection failed: {error}"))?;
            if read_query {
                let rows = sqlx::query(sql)
                    .fetch_all(&mut connection)
                    .await
                    .map_err(|error| format!("Query failed: {error}"))?;
                let columns: Vec<String> = rows
                    .first()
                    .map(|row| {
                        row.columns()
                            .iter()
                            .map(|column| column.name().to_string())
                            .collect()
                    })
                    .unwrap_or_default();
                let data_rows = rows
                    .iter()
                    .map(|row| {
                        columns
                            .iter()
                            .enumerate()
                            .map(|(index, column)| {
                                (column.clone(), super::schema::mysql_value(row, index))
                            })
                            .collect()
                    })
                    .collect();
                Ok(QueryResult {
                    columns,
                    rows: data_rows,
                    affected: 0,
                    duration_ms: started.elapsed().as_millis(),
                })
            } else {
                let result = sqlx::query(sql)
                    .execute(&mut connection)
                    .await
                    .map_err(|error| format!("Query failed: {error}"))?;
                Ok(QueryResult {
                    columns: Vec::new(),
                    rows: Vec::new(),
                    affected: result.rows_affected(),
                    duration_ms: started.elapsed().as_millis(),
                })
            }
        }
        "sqlite" => {
            let path = request
                .request
                .sqlite_path
                .as_deref()
                .ok_or("SQLite database path is required")?;
            let options = SqliteConnectOptions::new()
                .filename(path)
                .create_if_missing(false);
            let mut connection = SqliteConnection::connect_with(&options)
                .await
                .map_err(|error| format!("SQLite connection failed: {error}"))?;
            if read_query {
                let rows = sqlx::query(sql)
                    .fetch_all(&mut connection)
                    .await
                    .map_err(|error| format!("Query failed: {error}"))?;
                let columns: Vec<String> = rows
                    .first()
                    .map(|row| {
                        row.columns()
                            .iter()
                            .map(|column| column.name().to_string())
                            .collect()
                    })
                    .unwrap_or_default();
                let data_rows = rows
                    .iter()
                    .map(|row| {
                        columns
                            .iter()
                            .enumerate()
                            .map(|(index, column)| {
                                (column.clone(), super::schema::sqlite_value(row, index))
                            })
                            .collect()
                    })
                    .collect();
                Ok(QueryResult {
                    columns,
                    rows: data_rows,
                    affected: 0,
                    duration_ms: started.elapsed().as_millis(),
                })
            } else {
                let result = sqlx::query(sql)
                    .execute(&mut connection)
                    .await
                    .map_err(|error| format!("Query failed: {error}"))?;
                Ok(QueryResult {
                    columns: Vec::new(),
                    rows: Vec::new(),
                    affected: result.rows_affected(),
                    duration_ms: started.elapsed().as_millis(),
                })
            }
        }
        database => Err(format!("Unsupported database type: {database}")),
    }
}

fn is_read_query(sql: &str) -> bool {
    let keyword = sql
        .trim_start()
        .split_whitespace()
        .next()
        .unwrap_or_default()
        .to_ascii_lowercase();
    matches!(
        keyword.as_str(),
        "select" | "show" | "describe" | "desc" | "explain" | "pragma" | "with"
    )
}
