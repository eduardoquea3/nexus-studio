import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { ConnectionWorkspace } from "@/app/connection/components/connection-workspace";
import { useConnection } from "@/app/home/hooks/use-connections";
import { WorkspaceMessage } from "@/app/connection/components/workspace-message";
import { markConnectionOpened } from "@/app/home/services/connection-service";
import { closeSshTunnel } from "@/shared/lib/tauriApi";

export const Route = createFileRoute("/connections/$connectionId")({
  component: ConnectionWorkspaceRoute,
});

function ConnectionWorkspaceRoute() {
  const { connectionId } = Route.useParams();
  const { data: profile, isLoading } = useConnection(connectionId);
  const navigate = useNavigate();

  useEffect(() => {
    return () => {
      void closeSshTunnel(connectionId);
    };
  }, [connectionId]);

  if (isLoading) {
    return <WorkspaceMessage message="Loading connection workspace..." />;
  }

  if (!profile) {
    return (
      <WorkspaceMessage
        message="This connection does not exist."
        action={<Link to="/">Return to connections</Link>}
      />
    );
  }

  return (
    <ConnectionWorkspace
      profile={profile}
      onConnectionSwitch={async (nextProfile) => {
        await markConnectionOpened(nextProfile.id);
        await navigate({ to: "/connections/$connectionId", params: { connectionId: nextProfile.id } });
      }}
    />
  );
}
