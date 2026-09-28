use super::connection::{connection_target, prepare_ssh_tunnel, SshTunnelManager};
use crate::models::{
    ColumnInfo, ConnectionTestRequest, ErDiagramColumn, ErDiagramRelationship, ErDiagramSchema,
    ErDiagramTable, ObjectMeta, RoutineDefinitionRequest, TableDataPage, TableDataRequest,
    TableSchemaRequest, TableSchemaResult,
};
use futures_util::TryStreamExt;
use sqlx::{
    mysql::{MySqlConnectOptions, MySqlConnection},
    postgres::{PgConnectOptions, PgConnection},
    sqlite::{SqliteConnectOptions, SqliteConnection},
    Column, Connection, Row,
};
use std::collections::{HashMap, HashSet};
use tauri::State;

#[tauri::command]
pub async fn list_schema_objects(
    request: ConnectionTestRequest,
    tunnel_manager: State<'_, SshTunnelManager>,
) -> Result<Vec<ObjectMeta>, String> {
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
                .host(connection_host)
                .port(connection_port)
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
pub async fn get_er_diagram(
    request: ConnectionTestRequest,
    tunnel_manager: State<'_, SshTunnelManager>,
) -> Result<ErDiagramSchema, String> {
    get_er_diagram_with_manager(request, &tunnel_manager).await
}

async fn get_er_diagram_with_manager(
    request: ConnectionTestRequest,
    tunnel_manager: &SshTunnelManager,
) -> Result<ErDiagramSchema, String> {
    let (_temporary_tunnel, local_port) = prepare_ssh_tunnel(tunnel_manager, &request).await?;
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
                "SELECT source_ns.nspname AS source_schema, source_table.relname AS source_table, source_column.attname AS source_column, target_ns.nspname AS target_schema, target_table.relname AS target_table, target_column.attname AS target_column FROM pg_constraint constraint_row JOIN pg_class source_table ON source_table.oid = constraint_row.conrelid JOIN pg_namespace source_ns ON source_ns.oid = source_table.relnamespace JOIN pg_class target_table ON target_table.oid = constraint_row.confrelid JOIN pg_namespace target_ns ON target_ns.oid = target_table.relnamespace JOIN LATERAL unnest(constraint_row.conkey) WITH ORDINALITY AS source_key(attnum, position) ON true JOIN LATERAL unnest(constraint_row.confkey) WITH ORDINALITY AS target_key(attnum, position) ON target_key.position = source_key.position JOIN pg_attribute source_column ON source_column.attrelid = source_table.oid AND source_column.attnum = source_key.attnum JOIN pg_attribute target_column ON target_column.attrelid = target_table.oid AND target_column.attnum = target_key.attnum WHERE constraint_row.contype = 'f' AND source_ns.nspname NOT IN ('pg_catalog', 'information_schema') ORDER BY source_ns.nspname, source_table.relname, constraint_row.conname, source_key.position",
            )
            .fetch_all(&mut connection)
            .await
            .map_err(|error| format!("Could not load PostgreSQL foreign keys: {error}"))?;
            let relationships: Vec<ErDiagramRelationship> = rows
                .into_iter()
                .map(|row| ErDiagramRelationship {
                    source_schema: Some(row.get("source_schema")),
                    source_table: row.get("source_table"),
                    source_column: row.get("source_column"),
                    target_schema: Some(row.get("target_schema")),
                    target_table: row.get("target_table"),
                    target_column: row.get("target_column"),
                })
                .collect();
            let relationship_columns = relationship_columns(&relationships);
            let mut rows = sqlx::query(
                "SELECT c.table_schema, c.table_name, c.column_name, c.data_type, c.is_nullable, pk.column_name IS NOT NULL AS is_primary_key FROM information_schema.columns c JOIN information_schema.tables tab ON tab.table_catalog = c.table_catalog AND tab.table_schema = c.table_schema AND tab.table_name = c.table_name AND tab.table_type = 'BASE TABLE' LEFT JOIN information_schema.table_constraints tc ON tc.table_catalog = c.table_catalog AND tc.table_schema = c.table_schema AND tc.table_name = c.table_name AND tc.constraint_type = 'PRIMARY KEY' LEFT JOIN information_schema.key_column_usage pk ON pk.constraint_catalog = tc.constraint_catalog AND pk.constraint_schema = tc.constraint_schema AND pk.constraint_name = tc.constraint_name AND pk.table_name = tc.table_name AND pk.column_name = c.column_name WHERE c.table_schema NOT IN ('pg_catalog', 'information_schema') ORDER BY c.table_schema, c.table_name, c.ordinal_position",
            )
            .fetch(&mut connection);
            let mut table_builder = ErDiagramTableBuilder::default();
            while let Some(row) = rows
                .try_next()
                .await
                .map_err(|error| format!("Could not stream PostgreSQL table columns: {error}"))?
            {
                let schema: String = row.get("table_schema");
                table_builder.push(
                    Some(schema),
                    row.get("table_name"),
                    ErDiagramColumn {
                        name: row.get("column_name"),
                        data_type: row.get("data_type"),
                        nullable: row.get::<String, _>("is_nullable") == "YES",
                        is_primary_key: row.get("is_primary_key"),
                    },
                    &relationship_columns,
                );
            }
            let tables = table_builder.finish();
            Ok(ErDiagramSchema {
                tables,
                relationships,
            })
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
            let rows = sqlx::query(
                "SELECT kcu.table_schema AS source_schema, kcu.table_name AS source_table, kcu.column_name AS source_column, kcu.referenced_table_schema AS target_schema, kcu.referenced_table_name AS target_table, kcu.referenced_column_name AS target_column FROM information_schema.key_column_usage kcu WHERE kcu.table_schema = DATABASE() AND kcu.referenced_table_name IS NOT NULL ORDER BY kcu.table_name, kcu.constraint_name, kcu.ordinal_position",
            )
            .fetch_all(&mut connection)
            .await
            .map_err(|error| format!("Could not load MySQL foreign keys: {error}"))?;
            let relationships: Vec<ErDiagramRelationship> = rows
                .into_iter()
                .map(|row| ErDiagramRelationship {
                    source_schema: Some(row.get("source_schema")),
                    source_table: row.get("source_table"),
                    source_column: row.get("source_column"),
                    target_schema: Some(row.get("target_schema")),
                    target_table: row.get("target_table"),
                    target_column: row.get("target_column"),
                })
                .collect();
            let relationship_columns = relationship_columns(&relationships);
            let mut rows = sqlx::query(
                "SELECT c.table_schema, c.table_name, c.column_name, c.data_type, c.is_nullable, pk.column_name IS NOT NULL AS is_primary_key FROM information_schema.columns c JOIN information_schema.tables tab ON tab.table_schema = c.table_schema AND tab.table_name = c.table_name AND tab.table_type = 'BASE TABLE' LEFT JOIN information_schema.table_constraints tc ON tc.constraint_schema = c.table_schema AND tc.table_name = c.table_name AND tc.constraint_type = 'PRIMARY KEY' LEFT JOIN information_schema.key_column_usage pk ON pk.constraint_schema = tc.constraint_schema AND pk.constraint_name = tc.constraint_name AND pk.table_name = tc.table_name AND pk.column_name = c.column_name WHERE c.table_schema = DATABASE() ORDER BY c.table_name, c.ordinal_position",
            )
            .fetch(&mut connection);
            let mut table_builder = ErDiagramTableBuilder::default();
            while let Some(row) = rows
                .try_next()
                .await
                .map_err(|error| format!("Could not stream MySQL table columns: {error}"))?
            {
                let schema: String = row.get("table_schema");
                table_builder.push(
                    Some(schema),
                    row.get("table_name"),
                    ErDiagramColumn {
                        name: row.get("column_name"),
                        data_type: row.get("data_type"),
                        nullable: row.get::<String, _>("is_nullable") == "YES",
                        is_primary_key: row.get("is_primary_key"),
                    },
                    &relationship_columns,
                );
            }
            let tables = table_builder.finish();
            Ok(ErDiagramSchema {
                tables,
                relationships,
            })
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
                "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
            )
            .fetch_all(&mut connection)
            .await
            .map_err(|error| format!("Could not load SQLite tables: {error}"))?;
            let table_names: Vec<String> = rows.into_iter().map(|row| row.get("name")).collect();
            let mut relationships = Vec::new();
            let mut unresolved_relationships = Vec::new();
            for name in &table_names {
                let foreign_key_rows = sqlx::query(
                    "SELECT id, seq, \"table\" AS target_table, \"from\" AS source_column, \"to\" AS target_column FROM pragma_foreign_key_list(?) ORDER BY id, seq",
                )
                .bind(name)
                .fetch_all(&mut connection)
                .await
                .map_err(|error| format!("Could not load foreign keys for SQLite table {name}: {error}"))?;
                for foreign_key in foreign_key_rows {
                    let target_table: String = foreign_key.get("target_table");
                    let source_column: String = foreign_key.get("source_column");
                    let sequence: i64 = foreign_key.get("seq");
                    let target_column: Option<String> = foreign_key.try_get("target_column").ok();
                    let target_column = target_column.filter(|column| !column.is_empty());
                    if let Some(target_column) = target_column {
                        relationships.push(ErDiagramRelationship {
                            source_schema: None,
                            source_table: name.clone(),
                            source_column,
                            target_schema: None,
                            target_table,
                            target_column,
                        });
                    } else {
                        unresolved_relationships.push((
                            name.clone(),
                            source_column,
                            target_table,
                            sequence as usize,
                        ));
                    }
                }
            }

            let mut relation_columns = relationship_columns(&relationships);
            for (source_table, source_column, _, _) in &unresolved_relationships {
                relation_columns
                    .entry((None, source_table.clone()))
                    .or_default()
                    .insert(source_column.clone());
            }
            let mut table_builder = ErDiagramTableBuilder::default();
            for name in &table_names {
                let mut column_rows = sqlx::query(
                    "SELECT name, type, \"notnull\" AS is_not_null, pk FROM pragma_table_info(?) ORDER BY cid",
                )
                .bind(name)
                .fetch(&mut connection);
                while let Some(row) = column_rows.try_next().await.map_err(|error| {
                    format!("Could not stream columns for SQLite table {name}: {error}")
                })? {
                    let is_primary_key = row.get::<i64, _>("pk") > 0;
                    table_builder.push(
                        None,
                        name.clone(),
                        ErDiagramColumn {
                            name: row.get("name"),
                            data_type: row.get::<String, _>("type"),
                            nullable: row.get::<i64, _>("is_not_null") == 0 && !is_primary_key,
                            is_primary_key,
                        },
                        &relation_columns,
                    );
                }
            }
            let tables = table_builder.finish();
            for (source_table, source_column, target_table, sequence) in unresolved_relationships {
                if let Some(target_column) = tables
                    .iter()
                    .find(|table| table.name == target_table)
                    .and_then(|table| {
                        table
                            .columns
                            .iter()
                            .filter(|column| column.is_primary_key)
                            .nth(sequence)
                    })
                    .map(|column| column.name.clone())
                {
                    relationships.push(ErDiagramRelationship {
                        source_schema: None,
                        source_table,
                        source_column,
                        target_schema: None,
                        target_table,
                        target_column,
                    });
                }
            }
            Ok(ErDiagramSchema {
                tables,
                relationships,
            })
        }
        database => Err(format!("Unsupported database type: {database}")),
    }
}

fn relationship_columns(
    relationships: &[ErDiagramRelationship],
) -> HashMap<(Option<String>, String), HashSet<String>> {
    let mut relationship_columns: HashMap<(Option<String>, String), HashSet<String>> =
        HashMap::new();
    for relationship in relationships {
        relationship_columns
            .entry((
                relationship.source_schema.clone(),
                relationship.source_table.clone(),
            ))
            .or_default()
            .insert(relationship.source_column.clone());
        relationship_columns
            .entry((
                relationship.target_schema.clone(),
                relationship.target_table.clone(),
            ))
            .or_default()
            .insert(relationship.target_column.clone());
    }
    relationship_columns
}

#[derive(Default)]
struct ErDiagramTableBuilder {
    tables: Vec<ErDiagramTable>,
    table_indices: HashMap<(Option<String>, String), usize>,
    key_column_counts: HashMap<(Option<String>, String), usize>,
    regular_column_counts: HashMap<(Option<String>, String), usize>,
}

impl ErDiagramTableBuilder {
    fn push(
        &mut self,
        schema: Option<String>,
        table_name: String,
        column: ErDiagramColumn,
        relationship_columns: &HashMap<(Option<String>, String), HashSet<String>>,
    ) {
        const MAX_KEY_COLUMNS: usize = 24;
        const MAX_REGULAR_COLUMNS: usize = 8;
        let key = (schema.clone(), table_name.clone());
        let index = *self.table_indices.entry(key.clone()).or_insert_with(|| {
            self.tables.push(ErDiagramTable {
                name: table_name,
                schema,
                column_count: 0,
                columns: Vec::new(),
            });
            self.tables.len() - 1
        });
        let table = &mut self.tables[index];
        table.column_count += 1;
        let is_key_column = column.is_primary_key
            || relationship_columns
                .get(&key)
                .is_some_and(|columns| columns.contains(&column.name));
        if is_key_column {
            let count = self.key_column_counts.entry(key).or_default();
            if *count < MAX_KEY_COLUMNS {
                table.columns.push(column);
                *count += 1;
            }
        } else {
            let count = self.regular_column_counts.entry(key).or_default();
            if *count < MAX_REGULAR_COLUMNS {
                table.columns.push(column);
                *count += 1;
            }
        }
    }

    fn finish(self) -> Vec<ErDiagramTable> {
        self.tables
    }
}

#[tauri::command]
pub async fn get_routine_definition(
    request: RoutineDefinitionRequest,
    tunnel_manager: State<'_, SshTunnelManager>,
) -> Result<String, String> {
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
            let connection_request = request.request.clone();
            let options = PgConnectOptions::new()
                .host(connection_host)
                .port(connection_port)
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
            let connection_request = request.request.clone();
            let options = MySqlConnectOptions::new()
                .host(connection_host)
                .port(connection_port)
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
pub async fn get_table_data(
    request: TableDataRequest,
    tunnel_manager: State<'_, SshTunnelManager>,
) -> Result<TableDataPage, String> {
    get_table_data_with_manager(request, &tunnel_manager).await
}

async fn get_table_data_with_manager(
    request: TableDataRequest,
    tunnel_manager: &SshTunnelManager,
) -> Result<TableDataPage, String> {
    validate_table_name(&request.table)?;
    validate_schema_name(request.schema.as_deref())?;
    let page = request.page.max(1);
    let page_size = request.page_size.clamp(1, 100);
    let offset = (page - 1) * page_size;
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
        "postgres" => {
            let connection_request = request.request.clone();
            let options = PgConnectOptions::new()
                .host(connection_host)
                .port(connection_port)
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
            let connection_request = request.request.clone();
            let options = MySqlConnectOptions::new()
                .host(connection_host)
                .port(connection_port)
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

                get_table_data_with_manager(
                    TableDataRequest {
                        request: ConnectionTestRequest {
                            db_type: "sqlite".to_string(),
                            host: None,
                            port: None,
                            database: None,
                            username: None,
                            password: None,
                            sqlite_path: Some(database_path.clone()),
                            ssh: None,
                            connection_id: None,
                            persist_ssh_tunnel: false,
                        },
                        table: "entries".to_string(),
                        schema: None,
                        page: 2,
                        page_size: 2,
                    },
                    &SshTunnelManager::default(),
                )
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

    #[test]
    fn get_er_diagram_includes_unrelated_tables_and_foreign_keys() {
        tauri::async_runtime::block_on(async {
            let database_path = std::env::temp_dir().join(format!(
                "nexus-studio-er-diagram-{}-{}.sqlite",
                std::process::id(),
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .expect("system clock should be after the Unix epoch")
                    .as_nanos()
            ));
            let database_path = database_path.to_string_lossy().into_owned();
            let options = SqliteConnectOptions::new()
                .filename(&database_path)
                .create_if_missing(true);
            let mut connection = SqliteConnection::connect_with(&options)
                .await
                .expect("test database should open");
            sqlx::query("CREATE TABLE departments (id INTEGER PRIMARY KEY, name TEXT NOT NULL)")
                .execute(&mut connection)
                .await
                .expect("parent table should be created");
            sqlx::query("CREATE TABLE employees (id INTEGER PRIMARY KEY, department_id INTEGER REFERENCES departments)")
                .execute(&mut connection)
                .await
                .expect("child table should be created");
            sqlx::query("CREATE TABLE audit_log (id INTEGER PRIMARY KEY, message TEXT)")
                .execute(&mut connection)
                .await
                .expect("unrelated table should be created");
            let wide_columns = (0..100)
                .map(|index| format!("column_{index} TEXT"))
                .collect::<Vec<_>>()
                .join(", ");
            sqlx::query(&format!(
                "CREATE TABLE wide_table (id INTEGER PRIMARY KEY, {wide_columns})"
            ))
            .execute(&mut connection)
            .await
            .expect("wide table should be created");
            drop(connection);

            let diagram = get_er_diagram_with_manager(
                ConnectionTestRequest {
                    db_type: "sqlite".to_string(),
                    host: None,
                    port: None,
                    database: None,
                    username: None,
                    password: None,
                    sqlite_path: Some(database_path.clone()),
                    ssh: None,
                    connection_id: None,
                    persist_ssh_tunnel: false,
                },
                &SshTunnelManager::default(),
            )
            .await
            .expect("ER diagram metadata should load");
            let _ = std::fs::remove_file(&database_path);

            assert_eq!(diagram.tables.len(), 4);
            assert!(diagram.tables.iter().any(|table| table.name == "audit_log"));
            let wide_table = diagram
                .tables
                .iter()
                .find(|table| table.name == "wide_table")
                .expect("wide table should be included in the diagram");
            assert_eq!(wide_table.column_count, 101);
            assert!(wide_table.columns.len() <= 32);
            assert!(wide_table.columns.iter().any(|column| column.name == "id"));
            assert_eq!(diagram.relationships.len(), 1);
            assert_eq!(diagram.relationships[0].source_table, "employees");
            assert_eq!(diagram.relationships[0].source_column, "department_id");
            assert_eq!(diagram.relationships[0].target_table, "departments");
            assert_eq!(diagram.relationships[0].target_column, "id");
        });
    }
}
#[tauri::command]
pub async fn get_table_schema(
    request: TableSchemaRequest,
    tunnel_manager: State<'_, SshTunnelManager>,
) -> Result<TableSchemaResult, String> {
    validate_table_name(&request.table)?;
    validate_schema_name(request.schema.as_deref())?;
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
        "postgres" => {
            let connection_request = request.request.clone();
            let options = PgConnectOptions::new()
                .host(connection_host)
                .port(connection_port)
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
            let connection_request = request.request.clone();
            let options = MySqlConnectOptions::new()
                .host(connection_host)
                .port(connection_port)
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
