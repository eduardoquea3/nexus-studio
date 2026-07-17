export type DbType = "postgres" | "mysql" | "sqlite";

export interface ConnectionProfile {
  id: string;
  name: string;
  db_type: DbType;
  password?: string;
  connect_mode: ConnectMode;
  ssh_tunnel: SshTunnelConfig | null;
}

export type ConnectMode =
  | { type: "connection_string"; value: string }
  | {
      type: "fields";
      host: string;
      port: number;
      database: string;
      username: string;
      password_ref: string | null;
    };

export interface SshTunnelConfig {
  source: SshSource;
  auth: SshAuth;
  remote_bind_host: string;
  remote_bind_port: number;
}

export type SshSource =
  | { type: "manual"; host: string; port: number; user: string }
  | { type: "from_ssh_config"; alias: string };

export type SshAuth =
  | { type: "password" }
  | { type: "key_file"; path: string; passphrase_ref: string | null };

export interface ObjectMeta {
  name: string;
  object_type: "table" | "view" | "function" | "other";
}

export interface ColumnInfo {
  name: string;
  data_type: string;
  nullable: boolean;
  default: string | null;
  is_pk: boolean;
  is_fk: boolean;
  is_unique: boolean;
}

export interface TableSchema {
  columns: ColumnInfo[];
  indexes: string[];
}

export interface TableRules {
  constraints: string[];
  triggers: string[];
}

export interface DataPage {
  columns: string[];
  rows: Record<string, unknown>[];
  total: number;
  page: number;
  page_size: number;
}

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  affected: number;
  duration_ms: number;
}

export interface ConnectResult {
  databases: string[];
}
