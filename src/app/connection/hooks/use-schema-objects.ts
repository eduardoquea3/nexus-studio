import { useQuery } from "@tanstack/react-query";

import { listSchemaObjects } from "@/shared/lib/tauriApi";
import type { ConnectionProfile } from "@/shared/types/models";

export const schemaObjectsQueryKey = (connectionId: string) =>
  ["connection-schema-objects", connectionId] as const;

export function useSchemaObjects(profile: ConnectionProfile) {
  return useQuery({
    queryKey: schemaObjectsQueryKey(profile.id),
    queryFn: () => listSchemaObjects(profile),
    retry: false,
  });
}
