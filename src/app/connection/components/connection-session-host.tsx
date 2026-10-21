import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useRef, useState } from "react";

import { useConnection } from "@/app/home/hooks/use-connections";
import { markConnectionOpened } from "@/app/home/services/connection-service";
import { closeSshTunnel } from "@/shared/lib/tauriApi";

import { WorkspaceMessage } from "./workspace-message";

const ConnectionWorkspace = lazy(() =>
  import("./connection-workspace").then((module) => ({ default: module.ConnectionWorkspace })),
);

export function ConnectionSessionHost() {
  const routeConnectionId = useRouterState({
    select: (state) => {
      const match = state.matches.find(
        (candidate) => candidate.routeId === "/connections/$connectionId",
      );
      return match && "connectionId" in match.params ? match.params.connectionId : null;
    },
  });
  const isSettings = useRouterState({
    select: (state) => state.matches.some((match) => match.routeId === "/settings"),
  });
  const [retainedConnectionId, setRetainedConnectionId] = useState<string | null>(null);
  const sessionConnectionId = routeConnectionId ?? (isSettings ? retainedConnectionId : null);
  if (retainedConnectionId !== sessionConnectionId) {
    setRetainedConnectionId(sessionConnectionId);
  }

  const previousConnectionId = useRef<string | null>(null);
  useEffect(() => {
    const previous = previousConnectionId.current;
    previousConnectionId.current = sessionConnectionId;
    // Route detours and effect replay are not disconnects. Close only a committed session change.
    if (previous && previous !== sessionConnectionId) {
      void closeSshTunnel(previous).catch((error: unknown) => {
        console.error("Failed to close the connection's SSH tunnel", error);
      });
    }
  }, [sessionConnectionId]);

  if (!sessionConnectionId) return null;
  const isActive = routeConnectionId === sessionConnectionId;

  return (
    <div className="h-full" hidden={!isActive} inert={!isActive}>
      <ConnectionSession
        key={sessionConnectionId}
        connectionId={sessionConnectionId}
        isActive={isActive}
      />
    </div>
  );
}

function ConnectionSession({
  connectionId,
  isActive,
}: {
  connectionId: string;
  isActive: boolean;
}) {
  const { data: profile, isLoading } = useConnection(connectionId);
  const navigate = useNavigate();

  if (isLoading) return <WorkspaceMessage message="Loading connection workspace..." />;
  if (!profile) {
    return (
      <WorkspaceMessage
        message="This connection does not exist."
        action={<Link to="/">Return to connections</Link>}
      />
    );
  }

  return (
    <Suspense fallback={<WorkspaceMessage message="Loading connection workspace..." />}>
      <ConnectionWorkspace
        profile={profile}
        isActive={isActive}
        onConnectionSwitch={async (nextProfile) => {
          await markConnectionOpened(nextProfile.id);
          await navigate({
            to: "/connections/$connectionId",
            params: { connectionId: nextProfile.id },
          });
        }}
      />
    </Suspense>
  );
}
