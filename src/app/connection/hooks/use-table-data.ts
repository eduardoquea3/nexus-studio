import { useQuery } from "@tanstack/react-query";

import { getTableData } from "@/shared/lib/tauriApi";
import type { ConnectionProfile } from "@/shared/types/models";

export const tableDataQueryKey = (
  connectionId: string,
  database: string,
  schema: string | undefined,
  table: string,
  page: number,
) => ["connection-table-data", connectionId, database, schema, table, page] as const;

export function useTableData(profile: ConnectionProfile, table: string, schema?: string, page = 1) {
  const database = profile.connect_mode.type === "fields" ? profile.connect_mode.database : "";
  const queryKey = tableDataQueryKey(profile.id, database, schema, table, page);

  return useQuery({
    queryKey,
    queryFn: () => getTableData(profile, table, page, 100, undefined, undefined, schema),
    placeholderData: (previousData, previousQuery) =>
      previousQuery?.queryKey.slice(0, -1).every((key, index) => key === queryKey[index])
        ? previousData
        : undefined,
    retry: false,
  });
}
