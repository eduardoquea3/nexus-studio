import { useQuery } from "@tanstack/react-query";

import { getTableData } from "@/shared/lib/tauriApi";
import type { ConnectionProfile } from "@/shared/types/models";

export const tableDataQueryKey = (connectionId: string, database: string, schema: string | undefined, table: string) =>
  ["connection-table-data", connectionId, database, schema, table] as const;

export function useTableData(profile: ConnectionProfile, table: string, schema?: string) {
  const database = profile.connect_mode.type === "fields" ? profile.connect_mode.database : "";

  return useQuery({
    queryKey: tableDataQueryKey(profile.id, database, schema, table),
    queryFn: () => getTableData(profile, table, 1, 100, undefined, undefined, schema),
    retry: false,
  });
}
