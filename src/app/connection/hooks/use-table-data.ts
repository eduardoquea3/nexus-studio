import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import type { ConnectionProfile } from "@/shared/types/models";

import { getTableData } from "@/shared/lib/tauriApi";

export const tableDataQueryKeyPrefix = (
  connectionId: string,
  database: string,
  schema: string | undefined,
  table: string,
) => ["connection-table-data", connectionId, database, schema, table] as const;

export const tableDataQueryKey = (
  connectionId: string,
  database: string,
  schema: string | undefined,
  table: string,
  page: number,
) => [...tableDataQueryKeyPrefix(connectionId, database, schema, table), page] as const;

export function useTableData(
  profile: ConnectionProfile,
  table: string,
  schema?: string,
  page = 1,
  enabled = true,
) {
  const database = profile.connect_mode.type === "fields" ? profile.connect_mode.database : "";
  const queryKey = tableDataQueryKey(profile.id, database, schema, table, page);

  return useQuery({
    queryKey,
    queryFn: () => getTableData(profile, table, page, 100, undefined, undefined, schema),
    enabled,
    staleTime: Infinity,
    placeholderData: (previousData, previousQuery) =>
      previousQuery?.queryKey.slice(0, -1).every((key, index) => key === queryKey[index])
        ? previousData
        : undefined,
    retry: false,
  });
}

/**
 * Invalidates every cached page for a table after a mutation so pagination
 * reflects the new row count, not only the page that was visible.
 */
export function useInvalidateTableData(profile: ConnectionProfile, table: string, schema?: string) {
  const queryClient = useQueryClient();
  const database = profile.connect_mode.type === "fields" ? profile.connect_mode.database : "";

  return useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: tableDataQueryKeyPrefix(profile.id, database, schema, table),
    });
  }, [queryClient, profile.id, database, schema, table]);
}
