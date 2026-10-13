import { createFileRoute } from "@tanstack/react-router";
import { RiAddLine, RiDatabaseLine, RiRefreshLine, RiSearchLine } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMemo, useState } from "react";

import type { ConnectionProfile } from "@/shared/types/models";

import { ConnectionGrid } from "@/app/home/components/connection-grid";
import { HomeCommandBar } from "@/app/command-bar/home-command-bar";
import type { ConnectionSort } from "@/app/home/components/connection-toolbar";
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
      <div className="relative isolate min-h-full px-5 pb-10 pt-8 sm:px-8 sm:pt-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-52 opacity-40"
          style={{
            backgroundImage:
              "linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
            maskImage: "linear-gradient(to bottom, black, transparent)",
          }}
        />
        <main className="mx-auto flex w-full max-w-6xl flex-col gap-12">
          <header className="flex flex-col items-center gap-5 pb-4">
            <div className="flex flex-col items-center gap-3">
              <div className="flex size-20 items-center justify-center rounded-3xl border border-border bg-gradient-to-b from-muted to-background shadow-lg shadow-black/10">
                <RiDatabaseLine className="size-10 text-foreground" aria-hidden="true" />
              </div>
              <h1 className="text-sm font-medium tracking-tight">Nexus Studio</h1>
            </div>
            <label className="relative w-full max-w-lg">
              <span className="sr-only">Search connections</span>
              <RiSearchLine className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search saved connections..."
                className="h-10 rounded-xl border-border/70 bg-muted/60 pl-9 text-xs shadow-none"
              />
            </label>
          </header>
          <section aria-labelledby="connections-heading">
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <h2 id="connections-heading" className="text-sm font-semibold tracking-tight">
                Saved Connections
              </h2>
              <span
                className="font-mono text-xs text-muted-foreground"
                aria-label={`${filteredConnections.length} connections`}
              >
                {String(filteredConnections.length).padStart(2, "0")}
              </span>
              <div className="ml-auto flex items-center gap-2">
                <Button variant="outline" size="icon-sm" className="rounded-full" onClick={() => void refetch()} disabled={isFetching} aria-label="Refresh connections">
                  <RiRefreshLine className={isFetching ? "size-4 animate-spin" : "size-4"} aria-hidden="true" />
                </Button>
                <Button className="h-8 rounded-full px-4 text-xs" onClick={toggleNewConnection}>
                  New connection <RiAddLine className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <span className="rounded-full bg-foreground px-3 py-1.5 text-xs font-medium text-background">All</span>
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value as ConnectionSort)}
                  aria-label="Sort connections"
                  className="h-8 rounded-lg border border-border/60 bg-background px-2 text-xs text-muted-foreground focus-visible:outline-ring"
                >
                  <option value="recent">Recently opened</option>
                  <option value="name">Name</option>
                </select>
              </div>
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
