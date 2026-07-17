import { createFileRoute, Link } from "@tanstack/react-router";

import { ConnectionWorkspace } from "@/app/connection/components/connection-workspace";
import { useConnection } from "@/app/home/hooks/use-connections";
import { WorkspaceMessage } from "@/app/connection/components/workspace-message";

export const Route = createFileRoute("/connections/$connectionId")({
  component: ConnectionWorkspaceRoute,
});

function ConnectionWorkspaceRoute() {
  const { connectionId } = Route.useParams();
  const { data: profile, isLoading } = useConnection(connectionId);

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

  return <ConnectionWorkspace profile={profile} />;
}
