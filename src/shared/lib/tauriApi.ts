import { invoke } from "@tauri-apps/api/core";
import type { ConnectionProfile, ConnectResult, DataPage, ObjectMeta, QueryResult, TableRules, TableSchema } from "../types/models";

export async function listConnections(): Promise<ConnectionProfile[]> {
  return invoke("list_connections");
}

export async function saveConnection(profile: ConnectionProfile): Promise<void> {
  return invoke("save_connection", { profile });
}

export async function deleteConnection(id: string): Promise<void> {
  return invoke("delete_connection", { id });
}

export async function testConnection(profile: ConnectionProfile): Promise<string> {
  return invoke("test_connection", { profile });
}

export async function connect(id: string): Promise<ConnectResult> {
  return invoke("connect", { id });
}

export async function disconnect(id: string): Promise<void> {
  return invoke("disconnect", { id });
}

export async function listDatabases(id: string): Promise<string[]> {
  return invoke("list_databases", { id });
}

export async function listTables(id: string): Promise<ObjectMeta[]> {
  return invoke("list_tables", { id });
}

export async function listViews(id: string): Promise<ObjectMeta[]> {
  return invoke("list_views", { id });
}

export async function listFunctions(id: string): Promise<ObjectMeta[]> {
  return invoke("list_functions", { id });
}

export async function listOtherObjects(id: string): Promise<ObjectMeta[]> {
  return invoke("list_other_objects", { id });
}

export async function getTableSchema(id: string, table: string): Promise<TableSchema> {
  return invoke("get_table_schema", { id, table });
}

export async function getTableRules(id: string, table: string): Promise<TableRules> {
  return invoke("get_table_rules", { id, table });
}

export async function getTableData(
  id: string,
  table: string,
  page: number,
  pageSize: number,
  sort?: string,
  filter?: string,
): Promise<DataPage> {
  return invoke("get_table_data", { id, table, page, pageSize, sort, filter });
}

export async function runQuery(id: string, sql: string): Promise<QueryResult> {
  return invoke("run_query", { id, sql });
}

export async function listSshConfigAliases(): Promise<string[]> {
  return invoke("list_ssh_config_aliases");
}