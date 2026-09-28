import { useQuery } from "@tanstack/react-query";

import type { ConnectionProfile } from "@/shared/types/models";

import { getErDiagram } from "@/shared/lib/tauriApi";

export const erDiagramQueryKey = (connectionId: string, database: string) =>
  ["connection-er-diagram", connectionId, database] as const;

export function useErDiagram(profile: ConnectionProfile, database: string, enabled: boolean) {
  return useQuery({
    queryKey: erDiagramQueryKey(profile.id, database),
    queryFn: () => getErDiagram(profile, database),
    enabled: enabled && database.length > 0,
    staleTime: 60_000,
    gcTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
