use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionTestRequest {
    pub db_type: String,
    pub host: Option<String>,
    pub port: Option<u16>,
    pub database: Option<String>,
    pub username: Option<String>,
    pub password: Option<String>,
    pub sqlite_path: Option<String>,
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
