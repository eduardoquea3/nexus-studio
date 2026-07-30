import { useQuery } from "@tanstack/react-query";

import { getTableSchema } from "@/shared/lib/tauriApi";
import type { ConnectionProfile } from "@/shared/types/models";

export const tableSchemaQueryKey = (connectionId: string, database: string, table: string) =>
  ["connection-table-schema", connectionId, database, table] as const;

export function useTableSchema(profile: ConnectionProfile, table: string, enabled: boolean) {
  const database = profile.connect_mode.type === "fields" ? profile.connect_mode.database : "";

  return useQuery({
    queryKey: tableSchemaQueryKey(profile.id, database, table),
    queryFn: () => getTableSchema(profile, table),
    enabled,
    retry: false,
  });
}
