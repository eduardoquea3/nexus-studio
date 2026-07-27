import { useQuery } from "@tanstack/react-query";

import { getTableData } from "@/shared/lib/tauriApi";
import type { ConnectionProfile } from "@/shared/types/models";

export const tableDataQueryKey = (connectionId: string, table: string) =>
  ["connection-table-data", connectionId, table] as const;

export function useTableData(profile: ConnectionProfile, table: string) {
  return useQuery({
    queryKey: tableDataQueryKey(profile.id, table),
    queryFn: () => getTableData(profile, table, 1, 100),
    retry: false,
  });
}
