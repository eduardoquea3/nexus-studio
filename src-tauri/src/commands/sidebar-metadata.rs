use super::connection::{connection_target, prepare_ssh_tunnel, SshTunnelManager};
use crate::models::{
    ColumnInfo, SidebarForeignKey, SidebarIndex, SidebarTableMetadata, TableSchemaRequest,
};
use sqlx::{
    mysql::{MySqlConnectOptions, MySqlPoolOptions},
    postgres::{PgConnectOptions, PgPoolOptions},
    sqlite::{SqliteConnectOptions, SqliteConnection},
    Connection, Row,
};
use tauri::State;

#[tauri::command]
pub async fn get_sidebar_table_metadata(
    request: TableSchemaRequest,
    tunnel_manager: State<'_, SshTunnelManager>,
) -> Result<SidebarTableMetadata, String> {
    get_sidebar_table_metadata_with_manager(request, &tunnel_manager).await
}

async fn get_sidebar_table_metadata_with_manager(
    request: TableSchemaRequest,
    manager: &SshTunnelManager,
) -> Result<SidebarTableMetadata, String> {
    super::schema::validate_table_name(&request.table)?;
    super::schema::validate_schema_name(request.schema.as_deref())?;
    let (_guard, local_port) = prepare_ssh_tunnel(manager, &request.request).await?;
    let default_port = if request.request.db_type == "mysql" {
        3306
    } else {
        5432
    };
    let (host, port) = connection_target(&request.request, local_port, default_port)?;
    match request.request.db_type.as_str() {
        "sqlite" => sqlite_metadata(&request).await,
        "postgres" => postgres_metadata(&request, host, port).await,
        "mysql" => mysql_metadata(&request, host, port).await,
        db => Err(format!("Unsupported database type: {db}")),
    }
}

async fn sqlite_metadata(r: &TableSchemaRequest) -> Result<SidebarTableMetadata, String> {
    let path = r
        .request
        .sqlite_path
        .as_deref()
        .ok_or("SQLite database path is required")?;
    let opts = SqliteConnectOptions::new()
        .filename(path)
        .create_if_missing(false);
    let mut conn = SqliteConnection::connect_with(&opts)
        .await
        .map_err(|e| format!("SQLite connection failed: {e}"))?;
    let columns = sqlx::query(&format!("PRAGMA table_xinfo(\"{}\")", r.table))
        .fetch_all(&mut conn)
        .await
        .map_err(|e| format!("Could not load table structure: {e}"))?
        .into_iter()
        .map(|row| {
            let name: String = row.get("name");
            let data_type: String = row.get("type");
            let is_pk = row.get::<i64, _>("pk") > 0;
            let is_generated = row.get::<i64, _>("hidden") > 1
                || (is_pk && data_type.trim().eq_ignore_ascii_case("INTEGER"));
            ColumnInfo {
                name,
                data_type,
                enum_values: vec![],
                nullable: row.get::<i64, _>("notnull") == 0 && !is_pk,
                default: row.get("dflt_value"),
                is_generated,
                is_pk,
                is_fk: false,
                is_unique: false,
            }
        })
        .collect::<Vec<_>>();
    let fks = sqlx::query("SELECT id, \"from\" AS source, \"table\" AS target, \"to\" AS target_column FROM pragma_foreign_key_list(?) ORDER BY id, seq").bind(&r.table).fetch_all(&mut conn).await.map_err(|e| format!("Could not load foreign keys: {e}"))?.into_iter().map(|row| SidebarForeignKey { name: format!("fk_{}_{}", r.table, row.get::<i64,_>("id")), column: row.get("source"), referenced_table: row.get("target"), referenced_column: row.try_get::<Option<String>,_>("target_column").ok().flatten().unwrap_or_default() }).collect();
    let ix_rows = sqlx::query("SELECT il.name, ii.name AS column_name, il.origin = 'pk' AS is_primary, il.\"unique\" AS is_unique FROM pragma_index_list(?) il JOIN pragma_index_info(il.name) ii ORDER BY il.seq, ii.seqno").bind(&r.table).fetch_all(&mut conn).await.map_err(|e| format!("Could not load indexes: {e}"))?;
    let indexes = ix_rows
        .into_iter()
        .map(|row| SidebarIndex {
            name: row.get("name"),
            column: row
                .try_get::<Option<String>, _>("column_name")
                .ok()
                .flatten()
                .unwrap_or_else(|| "(expression)".to_string()),
            is_primary: row.get("is_primary"),
            is_unique: row.get("is_unique"),
        })
        .collect();
    Ok(SidebarTableMetadata {
        columns,
        foreign_keys: fks,
        indexes,
    })
}

async fn postgres_metadata(
    r: &TableSchemaRequest,
    host: &str,
    port: u16,
) -> Result<SidebarTableMetadata, String> {
    let options = PgConnectOptions::new()
        .host(host)
        .port(port)
        .database(
            r.request
                .database
                .as_deref()
                .ok_or("Database is required")?,
        )
        .username(r.request.username.as_deref().unwrap_or("postgres"))
        .password(r.request.password.as_deref().unwrap_or(""));
    let pool = PgPoolOptions::new()
        .max_connections(3)
        .connect_lazy_with(options);
    let schema = r.schema.as_deref();
    let columns_fut = async {
        let rows = sqlx::query("SELECT c.column_name,c.data_type,c.is_nullable,c.column_default,c.is_identity,c.is_generated, EXISTS(SELECT 1 FROM pg_constraint p WHERE p.contype='p' AND p.conrelid=t.oid AND a.attnum=ANY(p.conkey)) AS is_pk, EXISTS(SELECT 1 FROM pg_constraint f WHERE f.contype='f' AND f.conrelid=t.oid AND a.attnum=ANY(f.conkey)) AS is_fk FROM information_schema.columns c JOIN pg_namespace n ON n.nspname=c.table_schema JOIN pg_class t ON t.relnamespace=n.oid AND t.relname=c.table_name JOIN pg_attribute a ON a.attrelid=t.oid AND a.attname=c.column_name WHERE c.table_name=$1 AND c.table_schema=COALESCE($2,current_schema()) ORDER BY c.ordinal_position")
            .bind(&r.table).bind(schema).fetch_all(&pool).await.map_err(|e| format!("Could not load table structure: {e}"))?;
        Ok::<_, String>(
            rows.into_iter()
                .map(|row| {
                    let default: Option<String> = row.get("column_default");
                    ColumnInfo {
                        name: row.get("column_name"),
                        data_type: row.get("data_type"),
                        enum_values: vec![],
                        nullable: row.get::<String, _>("is_nullable") == "YES",
                        is_generated: row.get::<String, _>("is_identity") == "YES"
                            || row.get::<String, _>("is_generated") == "ALWAYS"
                            || default
                                .as_deref()
                                .is_some_and(|v| v.starts_with("nextval(")),
                        default,
                        is_pk: row.get("is_pk"),
                        is_fk: row.get("is_fk"),
                        is_unique: false,
                    }
                })
                .collect::<Vec<_>>(),
        )
    };
    let foreign_keys_fut = async {
        let rows = sqlx::query("SELECT f.conname AS name,src.attname AS column_name,dst.relname AS referenced_table,dsta.attname AS referenced_column FROM pg_constraint f JOIN pg_class t ON t.oid=f.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace JOIN LATERAL unnest(f.conkey) WITH ORDINALITY sk(attnum,ord) ON true JOIN LATERAL unnest(f.confkey) WITH ORDINALITY tk(attnum,ord) ON tk.ord=sk.ord JOIN pg_attribute src ON src.attrelid=t.oid AND src.attnum=sk.attnum JOIN pg_class dst ON dst.oid=f.confrelid JOIN pg_attribute dsta ON dsta.attrelid=dst.oid AND dsta.attnum=tk.attnum WHERE f.contype='f' AND t.relname=$1 AND n.nspname=COALESCE($2,current_schema()) ORDER BY f.conname,sk.ord")
            .bind(&r.table).bind(schema).fetch_all(&pool).await.map_err(|e| format!("Could not load foreign keys: {e}"))?;
        Ok::<_, String>(
            rows.into_iter()
                .map(|row| SidebarForeignKey {
                    name: row.get("name"),
                    column: row.get("column_name"),
                    referenced_table: row.get("referenced_table"),
                    referenced_column: row.get("referenced_column"),
                })
                .collect::<Vec<_>>(),
        )
    };
    let indexes_fut = async {
        let rows = sqlx::query("SELECT i.relname AS name,pg_get_indexdef(ix.indexrelid,k.ord::integer,true) AS column_name,ix.indisprimary AS is_primary,ix.indisunique AS is_unique FROM pg_index ix JOIN pg_class t ON t.oid=ix.indrelid JOIN pg_namespace n ON n.oid=t.relnamespace JOIN pg_class i ON i.oid=ix.indexrelid JOIN LATERAL unnest(ix.indkey) WITH ORDINALITY k(attnum,ord) ON true WHERE t.relname=$1 AND n.nspname=COALESCE($2,current_schema()) ORDER BY i.relname,k.ord")
            .bind(&r.table).bind(schema).fetch_all(&pool).await.map_err(|e| format!("Could not load indexes: {e}"))?;
        Ok::<_, String>(
            rows.into_iter()
                .map(|row| SidebarIndex {
                    name: row.get("name"),
                    column: row
                        .try_get::<Option<String>, _>("column_name")
                        .ok()
                        .flatten()
                        .unwrap_or_else(|| "(expression)".to_string()),
                    is_primary: row.get("is_primary"),
                    is_unique: row.get("is_unique"),
                })
                .collect::<Vec<_>>(),
        )
    };
    let result = tokio::try_join!(columns_fut, foreign_keys_fut, indexes_fut);
    pool.close().await;
    let (columns, foreign_keys, indexes) = result?;
    Ok(SidebarTableMetadata {
        columns,
        foreign_keys,
        indexes,
    })
}

async fn mysql_metadata(
    r: &TableSchemaRequest,
    host: &str,
    port: u16,
) -> Result<SidebarTableMetadata, String> {
    let options = MySqlConnectOptions::new()
        .host(host)
        .port(port)
        .database(r.request.database.as_deref().unwrap_or("mysql"))
        .username(r.request.username.as_deref().unwrap_or("root"))
        .password(r.request.password.as_deref().unwrap_or(""));
    let pool = MySqlPoolOptions::new()
        .max_connections(3)
        .connect_lazy_with(options);
    let schema = r.schema.as_deref();
    let columns_fut = async {
        let rows = sqlx::query("SELECT column_name,data_type,is_nullable,column_default,extra,column_key,generation_expression FROM information_schema.columns WHERE table_schema=COALESCE(?,DATABASE()) AND table_name=? ORDER BY ordinal_position").bind(schema).bind(&r.table).fetch_all(&pool).await.map_err(|e| format!("Could not load table structure: {e}"))?;
        Ok::<_, String>(
            rows.into_iter()
                .map(|row| {
                    let extra: String = row.get("extra");
                    ColumnInfo {
                        name: row.get("column_name"),
                        data_type: row.get("data_type"),
                        enum_values: vec![],
                        nullable: row.get::<String, _>("is_nullable") == "YES",
                        default: row.get("column_default"),
                        is_generated: extra.to_ascii_lowercase().contains("auto_increment")
                            || !row.get::<String, _>("generation_expression").is_empty(),
                        is_pk: row.get::<String, _>("column_key") == "PRI",
                        is_fk: false,
                        is_unique: row.get::<String, _>("column_key") == "UNI",
                    }
                })
                .collect::<Vec<_>>(),
        )
    };
    let foreign_keys_fut = async {
        let rows = sqlx::query("SELECT k.constraint_name,k.column_name,k.referenced_table_name,k.referenced_column_name FROM information_schema.key_column_usage k WHERE k.table_schema=COALESCE(?,DATABASE()) AND k.table_name=? AND k.referenced_table_name IS NOT NULL ORDER BY k.constraint_name,k.ordinal_position").bind(schema).bind(&r.table).fetch_all(&pool).await.map_err(|e| format!("Could not load foreign keys: {e}"))?;
        Ok::<_, String>(
            rows.into_iter()
                .map(|row| SidebarForeignKey {
                    name: row.get("constraint_name"),
                    column: row.get("column_name"),
                    referenced_table: row.get("referenced_table_name"),
                    referenced_column: row.get("referenced_column_name"),
                })
                .collect::<Vec<_>>(),
        )
    };
    let indexes_fut = async {
        let rows = sqlx::query("SELECT index_name,column_name,non_unique FROM information_schema.statistics WHERE table_schema=COALESCE(?,DATABASE()) AND table_name=? ORDER BY index_name,seq_in_index").bind(schema).bind(&r.table).fetch_all(&pool).await.map_err(|e| format!("Could not load indexes: {e}"))?;
        Ok::<_, String>(
            rows.into_iter()
                .map(|row| {
                    let name: String = row.get("index_name");
                    SidebarIndex {
                        name: name.clone(),
                        column: row
                            .try_get::<Option<String>, _>("column_name")
                            .ok()
                            .flatten()
                            .unwrap_or_else(|| "(expression)".to_string()),
                        is_primary: name == "PRIMARY",
                        is_unique: row.get::<i64, _>("non_unique") == 0,
                    }
                })
                .collect::<Vec<_>>(),
        )
    };
    let result = tokio::try_join!(columns_fut, foreign_keys_fut, indexes_fut);
    pool.close().await;
    let (columns, foreign_keys, indexes) = result?;
    Ok(SidebarTableMetadata {
        columns,
        foreign_keys,
        indexes,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::ConnectionTestRequest;

    fn request(path: String, table: &str) -> TableSchemaRequest {
        TableSchemaRequest {
            request: ConnectionTestRequest {
                db_type: "sqlite".into(),
                host: None,
                port: None,
                database: None,
                username: None,
                password: None,
                sqlite_path: Some(path),
                ssh: None,
                ssh_password: None,
                connection_id: None,
                persist_ssh_tunnel: false,
            },
            table: table.into(),
            schema: None,
        }
    }

    #[test]
    fn sqlite_metadata_returns_columns_foreign_keys_and_indexes_in_order() {
        tauri::async_runtime::block_on(async {
            let path = std::env::temp_dir()
                .join(format!("sidebar-metadata-{}.sqlite", std::process::id()))
                .to_string_lossy()
                .into_owned();
            let mut db = SqliteConnection::connect_with(
                &SqliteConnectOptions::new()
                    .filename(&path)
                    .create_if_missing(true),
            )
            .await
            .unwrap();
            sqlx::query("CREATE TABLE parents(id INTEGER PRIMARY KEY, code TEXT UNIQUE)")
                .execute(&mut db)
                .await
                .unwrap();
            sqlx::query("CREATE TABLE children(id INTEGER PRIMARY KEY, parent_code TEXT REFERENCES parents(code), name TEXT)").execute(&mut db).await.unwrap();
            sqlx::query("CREATE INDEX children_parent_idx ON children(parent_code,name)")
                .execute(&mut db)
                .await
                .unwrap();
            sqlx::query("CREATE INDEX children_expression_idx ON children(lower(name))")
                .execute(&mut db)
                .await
                .unwrap();
            drop(db);
            let result = get_sidebar_table_metadata_with_manager(
                request(path.clone(), "children"),
                &SshTunnelManager::default(),
            )
            .await;
            let _ = std::fs::remove_file(path);
            let got = result.unwrap();
            assert!(got.columns.iter().any(|c| c.name == "parent_code"));
            assert_eq!(got.foreign_keys.len(), 1);
            assert_eq!(got.foreign_keys[0].referenced_table, "parents");
            let composite = got
                .indexes
                .iter()
                .filter(|i| i.name == "children_parent_idx")
                .map(|i| i.column.as_str())
                .collect::<Vec<_>>();
            assert_eq!(composite, ["parent_code", "name"]);
            assert!(got
                .indexes
                .iter()
                .any(|i| i.name == "children_expression_idx" && i.column == "(expression)"));
        });
    }
}
