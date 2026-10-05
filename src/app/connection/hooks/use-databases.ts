import { useQuery } from "@tanstack/react-query";

import type { ConnectionProfile } from "@/shared/types/models";

import { getDatabases } from "@/app/connection/services/database-service";

export const databasesQueryKey = (connectionId: string) =>
  ["connection-databases", connectionId] as const;

export function useDatabases(profile: ConnectionProfile) {
  return useQuery({
    queryKey: databasesQueryKey(profile.id),
    queryFn: () => getDatabases(profile),
    retry: true,
  });
}
