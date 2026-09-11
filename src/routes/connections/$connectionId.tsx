import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

import { ConnectionWorkspace } from "@/app/connection/components/connection-workspace";
import { useConnection } from "@/app/home/hooks/use-connections";
import { WorkspaceMessage } from "@/app/connection/components/workspace-message";
import { markConnectionOpened } from "@/app/home/services/connection-service";

export const Route = createFileRoute("/connections/$connectionId")({
  component: ConnectionWorkspaceRoute,
});

function ConnectionWorkspaceRoute() {
  const { connectionId } = Route.useParams();
  const { data: profile, isLoading } = useConnection(connectionId);
  const navigate = useNavigate();

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
