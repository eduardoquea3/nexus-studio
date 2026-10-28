import type { ConnectionProfile } from "@/shared/types/models";

import { deleteRecords } from "@/shared/lib/tauriApi";

/**
 * Deletes the given primary-key identities in one backend transaction.
 *
 * The backend verifies that every identity still matches a row and rolls back
 * the whole batch otherwise, so callers can safely stage deletions first.
 */
export async function deleteTableRows(
  profile: ConnectionProfile,
  table: string,
  schema: string | undefined,
  pkMaps: Record<string, unknown>[],
) {
  return deleteRecords(profile, table, schema, pkMaps);
}
