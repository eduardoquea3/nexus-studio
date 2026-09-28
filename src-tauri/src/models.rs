use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionTestRequest {
    pub db_type: String,
    pub host: Option<String>,
    pub port: Option<u16>,
    pub database: Option<String>,
    pub username: Option<String>,
    pub password: Option<String>,
    pub sqlite_path: Option<String>,
    pub ssh: Option<SshTunnelRequest>,
    pub connection_id: Option<String>,
    #[serde(default)]
    pub persist_ssh_tunnel: bool,
}

#[derive(Debug, Deserialize, Clone)]
pub struct SshTunnelRequest {
    pub source: SshTunnelSource,
    pub auth: SshTunnelAuth,
    pub remote_bind_host: String,
    pub remote_bind_port: u16,
}

#[derive(Debug, Deserialize, Clone)]
#[serde(tag = "type")]
pub enum SshTunnelSource {
    #[serde(rename = "from_ssh_config")]
    FromSshConfig { alias: String },
    #[serde(rename = "manual")]
    Manual {
        host: String,
        port: u16,
        user: String,
    },
}

#[derive(Debug, Deserialize, Clone)]
#[serde(tag = "type")]
pub enum SshTunnelAuth {
    #[serde(rename = "password")]
    Password,
    #[serde(rename = "key_file")]
    KeyFile { path: String },
}

#[derive(Debug, Serialize)]
pub struct ObjectMeta {
    pub name: String,
    pub object_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub schema: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub signature: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub definition: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TableDataRequest {
    pub request: ConnectionTestRequest,
    pub table: String,
    pub schema: Option<String>,
    pub page: u32,
    pub page_size: u32,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RoutineDefinitionRequest {
    pub request: ConnectionTestRequest,
    pub routine_name: String,
    pub routine_type: String,
    pub signature: String,
}

#[derive(Debug, Serialize)]
pub struct TableDataPage {
    pub columns: Vec<String>,
    pub rows: Vec<HashMap<String, serde_json::Value>>,
    pub total: usize,
    pub page: u32,
    pub page_size: u32,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TableSchemaRequest {
    pub request: ConnectionTestRequest,
    pub table: String,
    pub schema: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryRequest {
    pub request: ConnectionTestRequest,
    pub sql: String,
}

#[derive(Debug, Serialize)]
pub struct QueryResult {
    pub columns: Vec<String>,
    pub rows: Vec<HashMap<String, serde_json::Value>>,
    pub affected: u64,
    pub duration_ms: u128,
}

#[derive(Debug, Serialize)]
pub struct ColumnInfo {
    pub name: String,
    pub data_type: String,
    pub enum_values: Vec<String>,
    pub nullable: bool,
    pub default: Option<String>,
    pub is_pk: bool,
    pub is_fk: bool,
    pub is_unique: bool,
}

#[derive(Debug, Serialize)]
pub struct TableSchemaResult {
    pub columns: Vec<ColumnInfo>,
    pub indexes: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ErDiagramSchema {
    pub tables: Vec<ErDiagramTable>,
    pub relationships: Vec<ErDiagramRelationship>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ErDiagramTable {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub schema: Option<String>,
    pub column_count: usize,
    pub columns: Vec<ErDiagramColumn>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ErDiagramColumn {
    pub name: String,
    pub data_type: String,
    pub nullable: bool,
    pub is_primary_key: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ErDiagramRelationship {
    pub source_table: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_schema: Option<String>,
    pub source_column: String,
    pub target_table: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_schema: Option<String>,
    pub target_column: String,
}

#[cfg(test)]
mod tests {
    use super::ConnectionTestRequest;

    #[test]
    fn test_requests_default_to_temporary_tunnels() {
        let request: ConnectionTestRequest =
            serde_json::from_str(r#"{"dbType":"sqlite","sqlitePath":"database.sqlite"}"#)
                .expect("connection test request should deserialize");

        assert!(!request.persist_ssh_tunnel);
        assert!(request.connection_id.is_none());
    }
}
