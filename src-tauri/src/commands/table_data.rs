use super::connection::{connection_target, prepare_ssh_tunnel, SshTunnelManager};
use super::schema::{validate_schema_name, validate_table_name};
use crate::models::DeleteRecordsRequest;
use serde_json::Value;
use sqlx::{
    mysql::{MySqlConnectOptions, MySqlConnection},
    postgres::{PgConnectOptions, PgConnection},
    sqlite::{SqliteConnectOptions, SqliteConnection},
    Connection, Row,
};
use std::collections::{HashMap, HashSet};
use tauri::State;

#[derive(Debug)]
enum SqlBinding {
    Text(String),
    Integer(i64),
    Float(f64),
    Boolean(bool),
}

impl SqlBinding {
    fn from_json(value: &Value) -> Result<Self, String> {
        match value {
            Value::String(value) => Ok(Self::Text(value.clone())),
            Value::Number(number) => {
                if let Some(value) = number.as_i64() {
                    Ok(Self::Integer(value))
                } else if let Some(value) = number.as_u64() {
                    Ok(Self::Text(value.to_string()))
                } else if let Some(value) = number.as_f64() {
                    Ok(Self::Float(value))
                } else {
                    Err("Unsupported numeric primary-key value.".to_string())
                }
            }
            Value::Bool(value) => Ok(Self::Boolean(*value)),
            Value::Null => Err("A selected row is missing a primary-key value.".to_string()),
            _ => serde_json::to_string(value)
                .map(Self::Text)
                .map_err(|error| format!("Could not serialize primary-key value: {error}")),
        }
    }
}

/// Deletes the rows identified by `pk_maps` in a single transaction.
///
/// The frontend stages deletions and submits them together. Every identity is
/// matched against the table's primary-key columns; if any row no longer
/// matches, the transaction rolls back so the batch is all-or-nothing.
#[tauri::command]
pub async fn delete_records(
    request: DeleteRecordsRequest,
    tunnel_manager: State<'_, SshTunnelManager>,
) -> Result<u64, String> {
    validate_delete_request(&request)?;
    let (_temporary_tunnel, local_port) =
        prepare_ssh_tunnel(&tunnel_manager, &request.request).await?;
    let default_port = if request.request.db_type == "mysql" {
        3306
    } else {
        5432
    };
    let (connection_host, connection_port) =
        connection_target(&request.request, local_port, default_port)?;

    match request.request.db_type.as_str() {
        "postgres" => delete_postgres(&request, connection_host, connection_port).await,
        "mysql" => delete_mysql(&request, connection_host, connection_port).await,
        "sqlite" => delete_sqlite(&request).await,
        database => Err(format!("Unsupported database type: {database}")),
    }
}

async fn delete_postgres(
    request: &DeleteRecordsRequest,
    host: &str,
    port: u16,
) -> Result<u64, String> {
    let options = PgConnectOptions::new()
        .host(host)
        .port(port)
        .database(
            request
                .request
                .database
                .as_deref()
                .ok_or("Database is required")?,
        )
        .username(request.request.username.as_deref().unwrap_or("postgres"))
        .password(request.request.password.as_deref().unwrap_or(""));
    let mut connection = PgConnection::connect_with(&options)
        .await
        .map_err(|error| format!("PostgreSQL connection failed: {error}"))?;
    let type_casts =
        postgres_column_type_casts(&mut connection, request.schema.as_deref(), &request.table)
            .await?;
    let (predicate, bindings) = build_postgres_delete_predicate(&request.pk_maps, &type_casts)?;
    let sql = format!(
        "DELETE FROM {} WHERE {}",
        postgres_table_name(request.schema.as_deref(), &request.table),
        predicate
    );

    let mut transaction = connection
        .begin()
        .await
        .map_err(|error| format!("Could not start PostgreSQL transaction: {error}"))?;
    let mut query = sqlx::query(&sql);
    for binding in bindings {
        query = query.bind(binding);
    }
    let result = query
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("Could not delete rows: {error}"))?;
    let affected = result.rows_affected();
    if affected != request.pk_maps.len() as u64 {
        let _ = transaction.rollback().await;
        return Err(stale_rows_error());
    }
    transaction
        .commit()
        .await
        .map_err(|error| format!("Could not commit row deletion: {error}"))?;
    Ok(affected)
}

async fn delete_mysql(
    request: &DeleteRecordsRequest,
    host: &str,
    port: u16,
) -> Result<u64, String> {
    let options = MySqlConnectOptions::new()
        .host(host)
        .port(port)
        .database(request.request.database.as_deref().unwrap_or("mysql"))
        .username(request.request.username.as_deref().unwrap_or("root"))
        .password(request.request.password.as_deref().unwrap_or(""));
    let mut connection = MySqlConnection::connect_with(&options)
        .await
        .map_err(|error| format!("MySQL connection failed: {error}"))?;
    let (predicate, bindings) =
        build_positional_delete_predicate(&request.pk_maps, quote_mysql_identifier)?;
    let sql = format!(
        "DELETE FROM {} WHERE {}",
        mysql_table_name(request.schema.as_deref(), &request.table),
        predicate
    );

    let mut transaction = connection
        .begin()
        .await
        .map_err(|error| format!("Could not start MySQL transaction: {error}"))?;
    let mut query = sqlx::query(&sql);
    for binding in &bindings {
        query = match binding {
            SqlBinding::Text(value) => query.bind(value.clone()),
            SqlBinding::Integer(value) => query.bind(*value),
            SqlBinding::Float(value) => query.bind(*value),
            SqlBinding::Boolean(value) => query.bind(*value),
        };
    }
    let result = query
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("Could not delete rows: {error}"))?;
    let affected = result.rows_affected();
    if affected != request.pk_maps.len() as u64 {
        let _ = transaction.rollback().await;
        return Err(stale_rows_error());
    }
    transaction
        .commit()
        .await
        .map_err(|error| format!("Could not commit row deletion: {error}"))?;
    Ok(affected)
}

async fn delete_sqlite(request: &DeleteRecordsRequest) -> Result<u64, String> {
    let path = request
        .request
        .sqlite_path
        .as_deref()
        .ok_or("SQLite database path is required")?;
    delete_sqlite_rows(
        path,
        &request.table,
        request.schema.as_deref(),
        &request.pk_maps,
    )
    .await
}

async fn delete_sqlite_rows(
    path: &str,
    table: &str,
    schema: Option<&str>,
    pk_maps: &[HashMap<String, Value>],
) -> Result<u64, String> {
    let options = SqliteConnectOptions::new()
        .filename(path)
        .create_if_missing(false);
    let mut connection = SqliteConnection::connect_with(&options)
        .await
        .map_err(|error| format!("SQLite connection failed: {error}"))?;
    let (predicate, bindings) =
        build_positional_delete_predicate(pk_maps, quote_sqlite_identifier)?;
    let sql = format!(
        "DELETE FROM {} WHERE {}",
        sqlite_table_name(schema, table),
        predicate
    );

    let mut transaction = connection
        .begin()
        .await
        .map_err(|error| format!("Could not start SQLite transaction: {error}"))?;
    let mut query = sqlx::query(&sql);
    for binding in &bindings {
        query = match binding {
            SqlBinding::Text(value) => query.bind(value.clone()),
            SqlBinding::Integer(value) => query.bind(*value),
            SqlBinding::Float(value) => query.bind(*value),
            SqlBinding::Boolean(value) => query.bind(*value),
        };
    }
    let result = query
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("Could not delete rows: {error}"))?;
    let affected = result.rows_affected();
    if affected != pk_maps.len() as u64 {
        let _ = transaction.rollback().await;
        return Err(stale_rows_error());
    }
    transaction
        .commit()
        .await
        .map_err(|error| format!("Could not commit row deletion: {error}"))?;
    Ok(affected)
}

fn validate_delete_request(request: &DeleteRecordsRequest) -> Result<(), String> {
    validate_table_name(&request.table)?;
    validate_schema_name(request.schema.as_deref())?;
    if request.pk_maps.is_empty() {
        return Err("At least one selected row is required.".to_string());
    }

    let mut expected_columns: Option<HashSet<String>> = None;
    for pk_map in &request.pk_maps {
        if pk_map.is_empty() {
            return Err("A selected row is missing its primary-key values.".to_string());
        }
        if pk_map.values().any(|value| value.is_null()) {
            return Err("A selected row is missing a primary-key value.".to_string());
        }
        let columns: HashSet<String> = pk_map.keys().cloned().collect();
        match &expected_columns {
            Some(expected) if expected != &columns => {
                return Err("Every deleted row must use the same primary-key columns.".to_string());
            }
            None => expected_columns = Some(columns),
            _ => {}
        }
    }

    Ok(())
}

fn build_postgres_delete_predicate(
    pk_maps: &[HashMap<String, Value>],
    type_casts: &HashMap<String, String>,
) -> Result<(String, Vec<String>), String> {
    let mut bindings = Vec::new();
    let mut row_predicates = Vec::new();
    for pk_map in pk_maps {
        let mut keys: Vec<&String> = pk_map.keys().collect();
        keys.sort();
        let mut predicates = Vec::new();
        for key in keys {
            let value = &pk_map[key];
            if value.is_null() {
                predicates.push(format!("{} IS NULL", quote_pg_identifier(key)));
                continue;
            }

            let placeholder = bindings.len() + 1;
            bindings.push(json_value_to_text(value)?);
            let predicate = match type_casts.get(key) {
                Some(cast) => format!("{} = ${}::{}", quote_pg_identifier(key), placeholder, cast),
                None => format!("{}::text = ${}", quote_pg_identifier(key), placeholder),
            };
            predicates.push(predicate);
        }
        row_predicates.push(format!("({})", predicates.join(" AND ")));
    }

    Ok((row_predicates.join(" OR "), bindings))
}

fn build_positional_delete_predicate(
    pk_maps: &[HashMap<String, Value>],
    quote: fn(&str) -> String,
) -> Result<(String, Vec<SqlBinding>), String> {
    let mut bindings = Vec::new();
    let mut row_predicates = Vec::new();
    for pk_map in pk_maps {
        let mut keys: Vec<&String> = pk_map.keys().collect();
        keys.sort();
        let mut predicates = Vec::new();
        for key in keys {
            let value = &pk_map[key];
            if value.is_null() {
                predicates.push(format!("{} IS NULL", quote(key)));
                continue;
            }

            predicates.push(format!("{} = ?", quote(key)));
            bindings.push(SqlBinding::from_json(value)?);
        }
        row_predicates.push(format!("({})", predicates.join(" AND ")));
    }

    Ok((row_predicates.join(" OR "), bindings))
}

async fn postgres_column_type_casts(
    connection: &mut PgConnection,
    schema: Option<&str>,
    table: &str,
) -> Result<HashMap<String, String>, String> {
    let rows = sqlx::query(
        "SELECT column_name, udt_schema, udt_name FROM information_schema.columns WHERE table_schema = COALESCE($1, current_schema()) AND table_name = $2",
    )
    .bind(schema)
    .bind(table)
    .fetch_all(connection)
    .await
    .map_err(|error| format!("Could not load PostgreSQL column types: {error}"))?;

    Ok(rows
        .into_iter()
        .map(|row| {
            let column: String = row.get("column_name");
            let udt_schema: String = row.get("udt_schema");
            let udt_name: String = row.get("udt_name");
            (
                column,
                format!(
                    "{}.{}",
                    quote_pg_identifier(&udt_schema),
                    quote_pg_identifier(&udt_name)
                ),
            )
        })
        .collect())
}

fn json_value_to_text(value: &Value) -> Result<String, String> {
    match value {
        Value::String(value) => Ok(value.clone()),
        Value::Number(number) => Ok(number.to_string()),
        Value::Bool(value) => Ok(value.to_string()),
        Value::Null => Err("A selected row is missing a primary-key value.".to_string()),
        _ => serde_json::to_string(value)
            .map_err(|error| format!("Could not serialize primary-key value: {error}")),
    }
}

fn postgres_table_name(schema: Option<&str>, table: &str) -> String {
    match schema {
        Some(schema) => format!(
            "{}.{}",
            quote_pg_identifier(schema),
            quote_pg_identifier(table)
        ),
        None => quote_pg_identifier(table),
    }
}

fn mysql_table_name(schema: Option<&str>, table: &str) -> String {
    match schema {
        Some(schema) => format!(
            "{}.{}",
            quote_mysql_identifier(schema),
            quote_mysql_identifier(table)
        ),
        None => quote_mysql_identifier(table),
    }
}

fn sqlite_table_name(schema: Option<&str>, table: &str) -> String {
    match schema {
        Some(schema) => format!(
            "{}.{}",
            quote_sqlite_identifier(schema),
            quote_sqlite_identifier(table)
        ),
        None => quote_sqlite_identifier(table),
    }
}

fn quote_pg_identifier(identifier: &str) -> String {
    format!("\"{}\"", identifier.replace('"', "\"\""))
}

fn quote_mysql_identifier(identifier: &str) -> String {
    format!("`{}`", identifier.replace('`', "``"))
}

fn quote_sqlite_identifier(identifier: &str) -> String {
    format!("\"{}\"", identifier.replace('"', "\"\""))
}

fn stale_rows_error() -> String {
    "Some selected rows no longer match the table. Refresh the table and try again.".to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn builds_postgres_predicate_with_catalog_type_casts() {
        let casts = HashMap::from([
            (
                "tenant_id".to_string(),
                "\"pg_catalog\".\"int8\"".to_string(),
            ),
            ("user_id".to_string(), "\"pg_catalog\".\"uuid\"".to_string()),
        ]);
        let pk_maps = vec![
            HashMap::from([
                ("user_id".to_string(), json!("9f9c")),
                ("tenant_id".to_string(), json!(7)),
            ]),
            HashMap::from([
                ("tenant_id".to_string(), json!(8)),
                ("user_id".to_string(), json!("a1b2")),
            ]),
        ];

        let (predicate, bindings) =
            build_postgres_delete_predicate(&pk_maps, &casts).expect("predicate should build");

        assert_eq!(
            predicate,
            "(\"tenant_id\" = $1::\"pg_catalog\".\"int8\" AND \"user_id\" = $2::\"pg_catalog\".\"uuid\") OR (\"tenant_id\" = $3::\"pg_catalog\".\"int8\" AND \"user_id\" = $4::\"pg_catalog\".\"uuid\")"
        );
        assert_eq!(bindings, vec!["7", "9f9c", "8", "a1b2"]);
    }

    #[test]
    fn rejects_incomplete_or_mixed_identities() {
        let base = DeleteRecordsRequest {
            request: test_request(),
            table: "users".to_string(),
            schema: None,
            pk_maps: vec![HashMap::from([("id".to_string(), json!(1))])],
        };
        assert!(validate_delete_request(&base).is_ok());

        let incomplete = DeleteRecordsRequest {
            pk_maps: vec![HashMap::from([("id".to_string(), Value::Null)])],
            ..base.clone()
        };
        assert_eq!(
            validate_delete_request(&incomplete).expect_err("null keys must be rejected"),
            "A selected row is missing a primary-key value."
        );

        let mixed = DeleteRecordsRequest {
            pk_maps: vec![
                HashMap::from([("id".to_string(), json!(1))]),
                HashMap::from([("other".to_string(), json!(2))]),
            ],
            ..base
        };
        assert_eq!(
            validate_delete_request(&mixed).expect_err("mixed keys must be rejected"),
            "Every deleted row must use the same primary-key columns."
        );
    }

    #[test]
    fn deletes_sqlite_rows_atomically() {
        tauri::async_runtime::block_on(async {
            let database_path = std::env::temp_dir().join(format!(
                "nexus-studio-delete-rows-{}-{}.sqlite",
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
                sqlx::query(
                    "CREATE TABLE users (tenant_id INTEGER NOT NULL, user_id TEXT NOT NULL, PRIMARY KEY (tenant_id, user_id))",
                )
                .execute(&mut connection)
                .await
                .expect("test table should be created");
                sqlx::query(
                    "INSERT INTO users (tenant_id, user_id) VALUES (1, 'first'), (2, 'second')",
                )
                .execute(&mut connection)
                .await
                .expect("test rows should be inserted");

                let stale = vec![
                    HashMap::from([
                        ("tenant_id".to_string(), json!(1)),
                        ("user_id".to_string(), json!("first")),
                    ]),
                    HashMap::from([
                        ("tenant_id".to_string(), json!(99)),
                        ("user_id".to_string(), json!("missing")),
                    ]),
                ];
                let error = delete_sqlite_rows(&database_path, "users", None, &stale)
                    .await
                    .expect_err("stale identities should roll back the whole batch");
                assert_eq!(error, stale_rows_error());

                let remaining: i64 = sqlx::query("SELECT COUNT(*) AS total FROM users")
                    .fetch_one(&mut connection)
                    .await
                    .expect("rows should be readable")
                    .get("total");
                assert_eq!(remaining, 2);

                let selected = vec![HashMap::from([
                    ("tenant_id".to_string(), json!(1)),
                    ("user_id".to_string(), json!("first")),
                ])];
                let affected = delete_sqlite_rows(&database_path, "users", None, &selected)
                    .await
                    .expect("selected row should be deleted");
                assert_eq!(affected, 1);

                let remaining: i64 = sqlx::query("SELECT COUNT(*) AS total FROM users")
                    .fetch_one(&mut connection)
                    .await
                    .expect("rows should be readable")
                    .get("total");
                assert_eq!(remaining, 1);
            }
            .await;

            let _ = std::fs::remove_file(&database_path);
            result
        });
    }

    fn test_request() -> crate::models::ConnectionTestRequest {
        serde_json::from_value(json!({
            "dbType": "sqlite",
            "sqlitePath": "test.sqlite"
        }))
        .expect("test request should deserialize")
    }
}
