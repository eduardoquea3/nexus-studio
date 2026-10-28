import { useQuery } from "@tanstack/react-query";

import type { ConnectionProfile } from "@/shared/types/models";

import { listSchemaObjects } from "@/shared/lib/tauriApi";

export const schemaObjectsQueryKey = (connectionId: string, database?: string) =>
  database
    ? (["connection-schema-objects", connectionId, database] as const)
    : (["connection-schema-objects", connectionId] as const);

export function useSchemaObjects(profile: ConnectionProfile, database: string) {
  return useQuery({
    queryKey: schemaObjectsQueryKey(profile.id, database),
    queryFn: () => listSchemaObjects(profile, database),
    retry: true,
  });
}
