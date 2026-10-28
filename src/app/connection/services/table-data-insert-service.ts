import type { ColumnInfo, ConnectionProfile, DbType } from "@/shared/types/models";

import {
  quoteSqlIdentifier,
  serializeSqlLiteral,
} from "@/app/connection/services/table-data-sql-helpers";
import { isRequiredTimestampColumn } from "@/shared/lib/table-column-utils";
import { runQuery } from "@/shared/lib/tauriApi";

type BuildInsertRowQueryOptions = {
  dbType: DbType;
  table: string;
  schema?: string;
  schemaColumns?: Pick<ColumnInfo, "name" | "data_type" | "nullable">[];
  values: Record<string, unknown>;
};

export function buildInsertRowQuery({
  dbType,
  table,
  schema,
  schemaColumns,
  values,
}: BuildInsertRowQueryOptions) {
  const entries = Object.entries(values);
  if (entries.length === 0) {
    throw new Error("A row must contain at least one column.");
  }

  const tableName = schema
    ? `${quoteSqlIdentifier(dbType, schema)}.${quoteSqlIdentifier(dbType, table)}`
    : quoteSqlIdentifier(dbType, table);
  const columns = entries.map(([column]) => quoteSqlIdentifier(dbType, column)).join(", ");
  const columnInfoByName = new Map(schemaColumns?.map((column) => [column.name, column]));
  const literals = entries
    .map(([column, value]) => toSqlLiteral(dbType, value, columnInfoByName.get(column)))
    .join(", ");

  return `INSERT INTO ${tableName} (${columns}) VALUES (${literals})`;
}

export async function insertTableRow(
  profile: ConnectionProfile,
  table: string,
  schema: string | undefined,
  values: Record<string, unknown>,
  schemaColumns: Pick<ColumnInfo, "name" | "data_type" | "nullable">[],
) {
  await runQuery(
    profile,
    buildInsertRowQuery({ dbType: profile.db_type, table, schema, schemaColumns, values }),
  );
}

function toSqlLiteral(
  dbType: DbType,
  value: unknown,
  column?: Pick<ColumnInfo, "data_type" | "nullable">,
) {
  if (value === null || value === undefined || value === "") {
    return isRequiredTimestampColumn(column) ? "CURRENT_TIMESTAMP" : "NULL";
  }

  return serializeSqlLiteral(dbType, value);
}
