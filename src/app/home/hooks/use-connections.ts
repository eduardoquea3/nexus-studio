import { useQuery } from "@tanstack/react-query";

import { getConnection, getConnections } from "@/app/home/services/connection-service";

export const connectionsQueryKey = ["connections"] as const;

export function useConnections() {
  return useQuery({
    queryKey: connectionsQueryKey,
    queryFn: getConnections,
  });
}

export function useConnection(id: string) {
  return useQuery({
    queryKey: [...connectionsQueryKey, id],
    queryFn: () => getConnection(id),
  });
}
