use crate::models::{
    ColumnInfo, ConnectionTestRequest, ObjectMeta, RoutineDefinitionRequest, TableDataPage,
    TableDataRequest, TableSchemaRequest, TableSchemaResult,
};
use sqlx::{
    mysql::{MySqlConnectOptions, MySqlConnection},
    postgres::{PgConnectOptions, PgConnection},
    sqlite::{SqliteConnectOptions, SqliteConnection},
    Column, Connection, Row,
};

#[tauri::command]
pub async fn list_schema_objects(
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
                "SELECT table_schema, table_name, table_type FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog', 'information_schema') AND table_type IN ('BASE TABLE', 'VIEW') ORDER BY table_type, table_name",
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
                    schema: Some(row.get("table_schema")),
                    signature: None,
                    definition: None,
                });
            }

            let rows = sqlx::query(
                "SELECT routine_schema, routine_name, routine_type, specific_name FROM information_schema.routines WHERE routine_schema NOT IN ('pg_catalog', 'information_schema') AND routine_type IN ('FUNCTION', 'PROCEDURE') ORDER BY routine_type, routine_schema, routine_name, specific_name",
            )
            .fetch_all(&mut connection)
            .await
            .map_err(|error| format!("Could not list PostgreSQL routines: {error}"))?;

            for row in rows {
                let routine_schema: String = row.get("routine_schema");
                let routine_name: String = row.get("routine_name");
                let object_type = match row.get::<String, _>("routine_type").as_str() {
                    "PROCEDURE" => "procedure",
                    _ => "function",
                };
                objects.push(ObjectMeta {
                    name: routine_name.clone(),
                    object_type: object_type.to_string(),
                    schema: Some(routine_schema.clone()),
                    signature: Some(format!(
                        "{routine_schema}.{}",
                        row.get::<String, _>("specific_name")
                    )),
                    definition: None,
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
                "SELECT table_schema, table_name, table_type FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type IN ('BASE TABLE', 'VIEW') ORDER BY table_type, table_name",
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
                    schema: Some(row.get("table_schema")),
                    signature: None,
                    definition: None,
                });
            }

            let rows = sqlx::query(
                "SELECT routine_schema, routine_name, routine_type, specific_name FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_type IN ('FUNCTION', 'PROCEDURE') ORDER BY routine_type, routine_name, specific_name",
            )
            .fetch_all(&mut connection)
            .await
            .map_err(|error| format!("Could not list MySQL routines: {error}"))?;

            for row in rows {
                let object_type = match row.get::<String, _>("routine_type").as_str() {
                    "PROCEDURE" => "procedure",
                    _ => "function",
                };
                let routine_name: String = row.get("routine_name");
                objects.push(ObjectMeta {
                    name: routine_name.clone(),
                    object_type: object_type.to_string(),
                    schema: Some(row.get("routine_schema")),
                    signature: Some(format!(
                        "{}.{}",
                        row.get::<String, _>("routine_schema"),
                        row.get::<String, _>("specific_name")
                    )),
                    definition: None,
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
                    schema: None,
                    signature: None,
                    definition: None,
                })
                .collect())
        }
        database => Err(format!("Unsupported database type: {database}")),
    }
}

#[tauri::command]
pub async fn get_routine_definition(request: RoutineDefinitionRequest) -> Result<String, String> {
    match request.request.db_type.as_str() {
        "postgres" => {
            let routine_type = match request.routine_type.as_str() {
                "function" => "FUNCTION",
                "procedure" => "PROCEDURE",
                routine_type => {
                    return Err(format!(
                        "Unsupported PostgreSQL routine type: {routine_type}"
                    ))
                }
            };
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
            let routine_oid: String = sqlx::query(
                "SELECT p.oid::text AS routine_oid FROM information_schema.routines r JOIN pg_namespace n ON n.nspname = r.routine_schema JOIN pg_proc p ON p.pronamespace = n.oid AND p.proname = r.routine_name AND r.specific_name = format('%s_%s', p.proname, p.oid) WHERE r.routine_name = $1 AND r.routine_type = $2 AND format('%s.%s', r.routine_schema, r.specific_name) = $3",
            )
            .bind(&request.routine_name)
            .bind(routine_type)
            .bind(&request.signature)
            .fetch_optional(&mut connection)
            .await
            .map_err(|error| format!("Could not retrieve PostgreSQL routine definition: {error}"))?
            .map(|row| row.get("routine_oid"))
            .ok_or_else(|| "PostgreSQL routine not found".to_string())?;

            let row = sqlx::query("SELECT pg_get_functiondef($1::oid) AS definition")
                .bind(routine_oid)
                .fetch_one(&mut connection)
                .await
                .map_err(|error| {
                    format!("Could not retrieve PostgreSQL routine definition: {error}")
                })?;

            Ok(row.get("definition"))
        }
        "mysql" => {
            let routine_keyword = match request.routine_type.as_str() {
                "function" => "FUNCTION",
                "procedure" => "PROCEDURE",
                routine_type => {
                    return Err(format!("Unsupported MySQL routine type: {routine_type}"))
                }
            };
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
            let escaped_name = request.routine_name.replace('`', "``");
            let create_row =
                sqlx::query(&format!("SHOW CREATE {routine_keyword} `{escaped_name}`"))
                    .fetch_one(&mut connection)
                    .await
                    .map_err(|error| {
                        format!(
                            "Could not retrieve MySQL {} definition: {error}",
                            request.routine_type
                        )
                    })?;

            create_row
                .try_get(2)
                .map_err(|error| format!("Could not read MySQL routine definition: {error}"))
        }
        "sqlite" => Err("SQLite does not support routines".to_string()),
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

fn validate_schema_name(schema: Option<&str>) -> Result<(), String> {
    if let Some(schema) = schema {
        if schema.is_empty()
            || !schema
                .chars()
                .all(|character| character.is_ascii_alphanumeric() || character == '_')
        {
            return Err("Invalid schema name".to_string());
        }
    }

    Ok(())
}

pub(crate) fn postgres_value(row: &sqlx::postgres::PgRow, index: usize) -> serde_json::Value {
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

pub(crate) fn mysql_value(row: &sqlx::mysql::MySqlRow, index: usize) -> serde_json::Value {
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

pub(crate) fn sqlite_value(row: &sqlx::sqlite::SqliteRow, index: usize) -> serde_json::Value {
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
pub async fn get_table_data(request: TableDataRequest) -> Result<TableDataPage, String> {
    validate_table_name(&request.table)?;
    validate_schema_name(request.schema.as_deref())?;
    let page = request.page.max(1);
    let page_size = request.page_size.clamp(1, 100);
    let offset = (page - 1) * page_size;

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
            let count_query = match request.schema.as_deref() {
                Some(schema) => format!(
                    "SELECT COUNT(*) AS total FROM \"{}\".\"{}\"",
                    schema, request.table
                ),
                None => format!("SELECT COUNT(*) AS total FROM \"{}\"", request.table),
            };
            let total = sqlx::query(&count_query)
                .fetch_one(&mut connection)
                .await
                .map_err(|error| format!("Could not count table data: {error}"))?
                .get::<i64, _>("total") as usize;
            let query = match request.schema.as_deref() {
                Some(schema) => format!(
                    "SELECT * FROM \"{}\".\"{}\" LIMIT $1 OFFSET $2",
                    schema, request.table
                ),
                None => format!("SELECT * FROM \"{}\" LIMIT $1 OFFSET $2", request.table),
            };
            let rows = sqlx::query(&query)
                .bind(page_size as i64)
                .bind(offset as i64)
                .fetch_all(&mut connection)
                .await
                .map_err(|error| format!("Could not load table data: {error}"))?;
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
                        .map(|(index, column)| (column.clone(), postgres_value(row, index)))
                        .collect()
                })
                .collect::<Vec<_>>();
            Ok(TableDataPage {
                columns,
                total,
                rows: data_rows,
                page,
                page_size,
            })
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
            let count_query = format!("SELECT COUNT(*) AS total FROM `{}`", request.table);
            let total = sqlx::query(&count_query)
                .fetch_one(&mut connection)
                .await
                .map_err(|error| format!("Could not count table data: {error}"))?
                .get::<i64, _>("total") as usize;
            let query = format!("SELECT * FROM `{}` LIMIT ? OFFSET ?", request.table);
            let rows = sqlx::query(&query)
                .bind(page_size)
                .bind(offset)
                .fetch_all(&mut connection)
                .await
                .map_err(|error| format!("Could not load table data: {error}"))?;
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
                        .map(|(index, column)| (column.clone(), mysql_value(row, index)))
                        .collect()
                })
                .collect::<Vec<_>>();
            Ok(TableDataPage {
                columns,
                total,
                rows: data_rows,
                page,
                page_size,
            })
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
            let count_query = format!("SELECT COUNT(*) AS total FROM \"{}\"", request.table);
            let total = sqlx::query(&count_query)
                .fetch_one(&mut connection)
                .await
                .map_err(|error| format!("Could not count table data: {error}"))?
                .get::<i64, _>("total") as usize;
            let query = format!("SELECT * FROM \"{}\" LIMIT ? OFFSET ?", request.table);
            let rows = sqlx::query(&query)
                .bind(page_size as i64)
                .bind(offset as i64)
                .fetch_all(&mut connection)
                .await
                .map_err(|error| format!("Could not load table data: {error}"))?;
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
                        .map(|(index, column)| (column.clone(), sqlite_value(row, index)))
                        .collect()
                })
                .collect::<Vec<_>>();
            Ok(TableDataPage {
                columns,
                total,
                rows: data_rows,
                page,
                page_size,
            })
        }
        database => Err(format!("Unsupported database type: {database}")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn get_table_data_reports_total_across_pages() {
        tauri::async_runtime::block_on(async {
            let database_path = std::env::temp_dir().join(format!(
                "nexus-studio-table-data-{}-{}.sqlite",
                std::process::id(),
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .expect("system clock should be after the Unix epoch")
                    .as_nanos()
            ));
            let database_path = database_path.to_string_lossy().into_owned();

            let result = async {
                let options = SqliteConnectOptions::new()
                    .filename(&database_path)
                    .create_if_missing(true);
                let mut connection = SqliteConnection::connect_with(&options)
                    .await
                    .expect("test database should open");
                sqlx::query("CREATE TABLE entries (id INTEGER PRIMARY KEY, name TEXT NOT NULL)")
                    .execute(&mut connection)
                    .await
                    .expect("test table should be created");
                sqlx::query(
                    "INSERT INTO entries (id, name) VALUES (1, 'one'), (2, 'two'), (3, 'three')",
                )
                .execute(&mut connection)
                .await
                .expect("test rows should be inserted");
                drop(connection);

                get_table_data(TableDataRequest {
                    request: ConnectionTestRequest {
                        db_type: "sqlite".to_string(),
                        host: None,
                        port: None,
                        database: None,
                        username: None,
                        password: None,
                        sqlite_path: Some(database_path.clone()),
                    },
                    table: "entries".to_string(),
                    schema: None,
                    page: 2,
                    page_size: 2,
                })
                .await
            }
            .await;

            let _ = std::fs::remove_file(&database_path);
            let page = result.expect("table data should load");
            assert_eq!(page.columns, ["id", "name"]);
            assert_eq!(page.rows.len(), 1);
            assert_eq!(page.total, 3);
            assert_eq!(page.page, 2);
            assert_eq!(page.page_size, 2);
        });
    }
}
#[tauri::command]
pub async fn get_table_schema(request: TableSchemaRequest) -> Result<TableSchemaResult, String> {
    validate_table_name(&request.table)?;
    validate_schema_name(request.schema.as_deref())?;

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
            let query = "SELECT c.column_name, c.data_type, c.is_nullable, c.column_default, COALESCE(array_agg(e.enumlabel ORDER BY e.enumsortorder) FILTER (WHERE e.enumlabel IS NOT NULL), ARRAY[]::text[]) AS enum_values FROM information_schema.columns c LEFT JOIN pg_namespace n ON n.nspname = c.table_schema LEFT JOIN pg_type t ON t.typname = c.udt_name AND t.typnamespace = n.oid LEFT JOIN pg_enum e ON e.enumtypid = t.oid WHERE c.table_name = $1 AND c.table_schema NOT IN ('pg_catalog', 'information_schema')";
            let query = if request.schema.is_some() {
                format!("{query} AND c.table_schema = $2 GROUP BY c.ordinal_position, c.column_name, c.data_type, c.is_nullable, c.column_default ORDER BY c.ordinal_position")
            } else {
                format!("{query} GROUP BY c.ordinal_position, c.column_name, c.data_type, c.is_nullable, c.column_default ORDER BY c.ordinal_position")
            };
            let mut query = sqlx::query(&query).bind(&request.table);
            if let Some(schema) = request.schema.as_deref() {
                query = query.bind(schema);
            }
            let rows = query
                .fetch_all(&mut connection)
                .await
                .map_err(|error| format!("Could not load table structure: {error}"))?;

            Ok(TableSchemaResult {
                columns: rows
                    .into_iter()
                    .map(|row| ColumnInfo {
                        name: row.get("column_name"),
                        data_type: row.get("data_type"),
                        enum_values: row.get("enum_values"),
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
                        enum_values: Vec::new(),
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
            let options = SqliteConnectOptions::new()
                .filename(path)
                .create_if_missing(false);
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
                        enum_values: Vec::new(),
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
