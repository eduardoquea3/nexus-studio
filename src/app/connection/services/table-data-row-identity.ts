import type { ColumnInfo } from "@/shared/types/models";

export type RowIdentity = Record<string, unknown>;

/**
 * Builds the primary-key identity for a row.
 *
 * Returns `null` when the table has no primary key or the row is missing any
 * key value. Deletions are only allowed for complete identities.
 */
export function buildRowIdentity(
  row: Record<string, unknown>,
  primaryKeyColumns: Pick<ColumnInfo, "name">[],
): RowIdentity | null {
  if (primaryKeyColumns.length === 0) return null;

  const identity: RowIdentity = {};
  for (const { name } of primaryKeyColumns) {
    const value = row[name];
    if (value === null || value === undefined) return null;
    identity[name] = value;
  }

  return identity;
}

/**
 * Serializes an identity with sorted keys so the same row always produces the
 * same key, regardless of column order or object construction.
 */
export function serializeRowIdentity(identity: RowIdentity): string {
  const sortedEntries = Object.keys(identity)
    .sort()
    .map((key) => [key, identity[key]] as const);

  return JSON.stringify(sortedEntries);
}
