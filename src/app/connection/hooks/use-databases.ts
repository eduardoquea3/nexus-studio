import { useQuery } from "@tanstack/react-query";

import { getDatabases } from "@/app/connection/services/database-service";
import type { ConnectionProfile } from "@/shared/types/models";

export const databasesQueryKey = (connectionId: string) =>
  ["connection-databases", connectionId] as const;

export function useDatabases(profile: ConnectionProfile) {
  return useQuery({
    queryKey: databasesQueryKey(profile.id),
    queryFn: () => getDatabases(profile),
    retry: false,
  });
}
