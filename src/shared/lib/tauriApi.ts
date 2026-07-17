import { invoke } from "@tauri-apps/api/core";
import { load } from "@tauri-apps/plugin-store";
import type {
  ConnectionProfile,
  ConnectResult,
  DataPage,
  ObjectMeta,
  QueryResult,
  TableRules,
  TableSchema,
} from "../types/models";

export interface ConnectionTestRequest {
  dbType: "postgres" | "mysql" | "sqlite";
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  sqlitePath?: string;
}

export interface ListDatabasesRequest extends ConnectionTestRequest {}

export async function listConnections(): Promise<ConnectionProfile[]> {
  const store = await load("connections.json");
  return (await store.get<ConnectionProfile[]>("profiles")) ?? [];
}

export async function testConnectionFields(request: ConnectionTestRequest): Promise<string> {
  return invoke("test_connection", { request });
}

export async function listDatabases(request: ListDatabasesRequest): Promise<string[]> {
  return invoke("list_databases", { request });
}

export async function saveConnection(profile: ConnectionProfile): Promise<void> {
  const store = await load("connections.json");
  const profiles = (await store.get<ConnectionProfile[]>("profiles")) ?? [];
  const nextProfiles = profiles.some((item) => item.id === profile.id)
    ? profiles.map((item) => (item.id === profile.id ? profile : item))
    : [...profiles, profile];

  await store.set("profiles", nextProfiles);
  await store.save();
}

export async function connect(id: string): Promise<ConnectResult> {
  return invoke("connect", { id });
}

export async function disconnect(id: string): Promise<void> {
  return invoke("disconnect", { id });
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
