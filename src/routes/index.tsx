import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import type { ConnectionProfile } from "@/shared/types/models";

import { ConnectionGrid } from "@/app/home/components/connection-grid";
import { HomeCommandBar } from "@/app/command-bar/home-command-bar";
import { ConnectionToolbar, type ConnectionSort } from "@/app/home/components/connection-toolbar";
import { DashboardHeader } from "@/app/home/components/dashboard-header";
import { HomeKeymaps } from "@/app/home/keymaps/home-keymaps";
import { NewConnectionPanel } from "@/app/home/components/new-connection-panel";
import { HomePanels } from "@/app/home/lib/home-panels";
import { useConnections } from "@/app/home/hooks/use-connections";
import {
  createConnectionString,
  redactConnectionString,
} from "@/app/home/lib/connection-string-parser";
import { deleteConnection, markConnectionOpened } from "@/app/home/services/connection-service";
import { toast } from "@/components/ui/toast";
import { type ConnectionItem } from "@/shared/components/connection-card";
import { testSavedConnection } from "@/shared/lib/tauriApi";
import { useModalStore } from "@/shared/store/modalStore";
import { useWorkspaceStore } from "@/shared/store/workspace-store";
import { ScrollArea } from "@/components/ui/scroll-area";

export const Route = createFileRoute("/")({ component: Index });

function Index() {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<ConnectionSort>("recent");
  const [isCommandBarVisible, setIsCommandBarVisible] = useState(false);
  const openModal = useModalStore((state) => state.openModal);
  const closeModal = useModalStore((state) => state.closeModal);
  const isNewConnectionOpen = useModalStore((state) =>
    state.modals.includes(HomePanels.NewConnection),
  );
  const removeWorkspaceConnection = useWorkspaceStore((state) => state.removeConnection);
  const activeConnectionId = useWorkspaceStore((state) => state.activeConnectionId);
  const { data: profiles = [], isFetching, refetch } = useConnections();
  const toggleNewConnection = () => {
    if (isNewConnectionOpen) {
      closeModal(HomePanels.NewConnection);
      return;
    }

    openModal(HomePanels.NewConnection, { source: "dashboard" });
  };
  const connections = useMemo(() => profiles.map(toConnectionItem), [profiles]);
  const filteredConnections = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return [...connections]
      .filter((connection) =>
        [
          connection.name,
          connection.engine,
          ...connection.searchValues,
          ...connection.metadata.map((item) => item.value),
          ...(connection.sshEnabled ? ["ssh"] : []),
          ...(connection.sslEnabled ? ["ssl"] : []),
        ].some((value) => value.toLowerCase().includes(normalized)),
      )
      .sort((left, right) =>
        sort === "name"
          ? left.name.localeCompare(right.name)
          : (right.lastOpenedAt ?? 0) - (left.lastOpenedAt ?? 0),
      );
  }, [connections, query, sort]);

  const handleDelete = async (connection: ConnectionItem) => {
    if (!window.confirm(`Delete connection "${connection.name}"?`)) return;
    try {
      await deleteConnection(connection.id);
      removeWorkspaceConnection(connection.id);
      await refetch();
      toast.add({ title: "Connection deleted", type: "success" });
    } catch (error) {
      toast.add({
        title: "Could not delete connection",
        type: "error",
        description: String(error),
      });
    }
  };

  const handleOpen = async (connection: ConnectionItem) => {
    const profile = profiles.find((item) => item.id === connection.id);
    if (!profile) return false;
    const toastId = toast.add({
      title: "Checking connection...",
      type: "loading",
      description: `Testing ${profile.name}`,
      timeout: 0,
    });
    try {
      const message = await testSavedConnection(profile);
      toast.update(toastId, {
        title: "Connection successful",
        type: "success",
        description: message,
        timeout: 5000,
      });
      await markConnectionOpened(profile.id);
      return true;
    } catch (error) {
      toast.update(toastId, {
        title: "Connection failed",
        type: "error",
        description: String(error),
        timeout: 5000,
      });
      return false;
    }
  };

  return (
    <ScrollArea className="h-full bg-background text-foreground">
      <HomeKeymaps
        onNewConnection={toggleNewConnection}
        isCommandBarVisible={isCommandBarVisible}
      />
      <HomeCommandBar activeConnectionId={activeConnectionId} onOpenChange={setIsCommandBarVisible} />
      <div className="min-h-full px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
        <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-7">
          <DashboardHeader onNewConnection={toggleNewConnection} />
          <section aria-labelledby="connections-heading">
            <div className="mb-5 flex items-baseline gap-2">
              <h1 id="connections-heading" className="text-2xl font-semibold tracking-[-0.035em]">
                Connections
              </h1>
              <span
                className="font-mono text-xs text-muted-foreground"
                aria-label={`${filteredConnections.length} connections`}
              >
                {String(filteredConnections.length).padStart(2, "0")}
              </span>
            </div>
            <div className="flex flex-col gap-4">
              <ConnectionToolbar
                query={query}
                sort={sort}
                isFetching={isFetching}
                onQueryChange={setQuery}
                onSortChange={setSort}
                onRefresh={() => void refetch()}
              />
              <ConnectionGrid
                connections={filteredConnections}
                onOpen={handleOpen}
                onEdit={(connection) => openModal("new-connection", { connectionId: connection.id })}
                onDelete={(connection) => void handleDelete(connection)}
              />
            </div>
          </section>
        </main>
        <NewConnectionPanel />
      </div>
    </ScrollArea>
  );
}

function toConnectionItem(profile: ConnectionProfile): ConnectionItem {
  const engine = profile.db_type === "postgres" ? "postgresql" : profile.db_type;
  const fullConnectionString = createConnectionString(profile);
  const connectionString = fullConnectionString
    ? redactConnectionString(fullConnectionString)
    : undefined;
  const searchValues = profile.connect_mode.type === "fields"
    ? [
        profile.connect_mode.host,
        String(profile.connect_mode.port),
        profile.connect_mode.database,
        profile.connect_mode.username,
      ]
    : connectionString
      ? [connectionString]
      : [];

  return {
    id: profile.id,
    name: profile.name,
    engine,
    sshEnabled: profile.ssh_tunnel !== null,
    sslEnabled: false,
    connectionString,
    copyConnectionString: fullConnectionString,
    connectionStringLabel: profile.db_type === "sqlite" ? "Database path" : "Connection string",
    searchValues,
    metadata: [],
    lastOpenedAt: profile.last_opened_at,
  };
}
