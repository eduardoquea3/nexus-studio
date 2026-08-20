import { useQuery } from "@tanstack/react-query";

import { getTableSchema } from "@/shared/lib/tauriApi";
import type { ConnectionProfile } from "@/shared/types/models";

export const tableSchemaQueryKey = (connectionId: string, database: string, schema: string | undefined, table: string) =>
  ["connection-table-schema", connectionId, database, schema, table] as const;

export function useTableSchema(profile: ConnectionProfile, table: string, enabled: boolean, schema?: string) {
  const database = profile.connect_mode.type === "fields" ? profile.connect_mode.database : "";

  return useQuery({
    queryKey: tableSchemaQueryKey(profile.id, database, schema, table),
    queryFn: () => getTableSchema(profile, table, schema),
    enabled,
    retry: false,
  });
}
