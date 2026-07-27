import { useQuery } from "@tanstack/react-query";

import { getTableSchema } from "@/shared/lib/tauriApi";
import type { ConnectionProfile } from "@/shared/types/models";

export const tableSchemaQueryKey = (connectionId: string, table: string) =>
  ["connection-table-schema", connectionId, table] as const;

export function useTableSchema(profile: ConnectionProfile, table: string, enabled: boolean) {
  return useQuery({
    queryKey: tableSchemaQueryKey(profile.id, table),
    queryFn: () => getTableSchema(profile, table),
    enabled,
    retry: false,
  });
}
