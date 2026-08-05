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

export async function testSavedConnection(profile: ConnectionProfile): Promise<string> {
  if (profile.connect_mode.type === "connection_string") {
    if (profile.db_type !== "sqlite") {
      throw new Error("Connection strings are only supported for SQLite connections.");
    }

    return testConnectionFields({
      dbType: profile.db_type,
      password: profile.password,
      sqlitePath: profile.connect_mode.value,
    });
  }

  return testConnectionFields({
    dbType: profile.db_type,
    host: profile.connect_mode.host,
    port: profile.connect_mode.port,
    database: profile.connect_mode.database,
    username: profile.connect_mode.username,
    password: profile.password,
  });
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

export async function listSchemaObjects(
  profile: ConnectionProfile,
  database?: string,
): Promise<ObjectMeta[]> {
  const request: ConnectionTestRequest =
    profile.connect_mode.type === "connection_string"
      ? {
          dbType: profile.db_type,
          password: profile.password,
          sqlitePath: profile.connect_mode.value,
        }
      : {
          dbType: profile.db_type,
          host: profile.connect_mode.host,
          port: profile.connect_mode.port,
          database: database ?? profile.connect_mode.database,
          username: profile.connect_mode.username,
          password: profile.password,
        };

  return invoke("list_schema_objects", { request });
}

export async function getRoutineDefinition(
  profile: ConnectionProfile,
  routine: Pick<ObjectMeta, "name" | "object_type" | "signature">,
): Promise<string> {
  const request: ConnectionTestRequest =
    profile.connect_mode.type === "connection_string"
      ? {
          dbType: profile.db_type,
          password: profile.password,
          sqlitePath: profile.connect_mode.value,
        }
      : {
          dbType: profile.db_type,
          host: profile.connect_mode.host,
          port: profile.connect_mode.port,
          database: profile.connect_mode.database,
          username: profile.connect_mode.username,
          password: profile.password,
        };

  return invoke("get_routine_definition", {
    request: {
      request,
      routineName: routine.name,
      routineType: routine.object_type,
      signature: routine.signature ?? routine.name,
    },
  });
}

export async function getTableSchema(
  profile: ConnectionProfile,
  table: string,
): Promise<TableSchema> {
  const request: ConnectionTestRequest =
    profile.connect_mode.type === "connection_string"
      ? { dbType: profile.db_type, password: profile.password, sqlitePath: profile.connect_mode.value }
      : {
          dbType: profile.db_type,
          host: profile.connect_mode.host,
          port: profile.connect_mode.port,
          database: profile.connect_mode.database,
          username: profile.connect_mode.username,
          password: profile.password,
        };

  return invoke("get_table_schema", { request: { request, table } });
}

export async function getTableRules(id: string, table: string): Promise<TableRules> {
  return invoke("get_table_rules", { id, table });
}

export async function getTableData(
  profile: ConnectionProfile,
  table: string,
  page: number,
  pageSize: number,
  sort?: string,
  filter?: string,
): Promise<DataPage> {
  const request: ConnectionTestRequest =
    profile.connect_mode.type === "connection_string"
      ? {
          dbType: profile.db_type,
          password: profile.password,
          sqlitePath: profile.connect_mode.value,
        }
      : {
          dbType: profile.db_type,
          host: profile.connect_mode.host,
          port: profile.connect_mode.port,
          database: profile.connect_mode.database,
          username: profile.connect_mode.username,
          password: profile.password,
        };

  return invoke("get_table_data", {
    request: { request, table, page, pageSize, sort, filter },
  });
}

export async function runQuery(profile: ConnectionProfile, sql: string): Promise<QueryResult> {
  const request: ConnectionTestRequest =
    profile.connect_mode.type === "connection_string"
      ? {
          dbType: profile.db_type,
          password: profile.password,
          sqlitePath: profile.connect_mode.value,
        }
      : {
          dbType: profile.db_type,
          host: profile.connect_mode.host,
          port: profile.connect_mode.port,
          database: profile.connect_mode.database,
          username: profile.connect_mode.username,
          password: profile.password,
        };

  return invoke("run_query", { request: { request, sql } });
}

export async function listSshConfigAliases(): Promise<string[]> {
  return invoke("list_ssh_config_aliases");
}
