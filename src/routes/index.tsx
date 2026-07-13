import { createFileRoute } from "@tanstack/react-router";
import { RiAddLine, RiDatabaseLine, RiRefreshLine, RiSearchLine } from "@remixicon/react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ConnectionCard, type ConnectionItem } from "@/shared/components/connection-card";
import { NewConnectionPanel } from "@/app/home/components/new-connection-panel";
import { useModalStore } from "@/shared/store/modalStore";

const CONNECTIONS: ConnectionItem[] = [
  {
    id: "prod-db",
    name: "prod-db",
    status: "connected",
    engine: "postgresql",
    endpointLabel: "HOST",
    endpoint: "pg-primary.internal:5432",
    database: "acme_prod",
    user: "app_admin",
  },
  {
    id: "analytics",
    name: "analytics",
    status: "connected",
    engine: "mysql",
    endpointLabel: "HOST",
    endpoint: "db.analytics.io:3306",
    database: "analytics_v2",
    user: "analyst",
  },
  {
    id: "staging-replica",
    name: "staging-replica",
    status: "disconnected",
    engine: "postgresql",
    endpointLabel: "HOST",
    endpoint: "staging.internal:5433",
    database: "staging_snapshot",
    user: "deploy",
  },
];

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const [query, setQuery] = useState("");
  const openModal = useModalStore((state) => state.openModal);

  const filteredConnections = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) {
      return CONNECTIONS;
    }

    return CONNECTIONS.filter((connection) => {
      return [
        connection.name,
        connection.engine,
        connection.endpoint,
        connection.database,
        connection.user,
      ].some((value) => value.toLowerCase().includes(normalized));
    });
  }, [query]);

  return (
    <div className="min-h-full bg-background px-3 py-3 text-foreground sm:px-4 lg:px-4 lg:py-4">
      <div className="flex w-full flex-col gap-3">
        <Card className="rounded-2xl border-border/80 bg-card/90 shadow-[0_1px_0_rgba(15,23,42,0.02)] backdrop-blur">
          <CardHeader className="items-center gap-3 px-4 py-3 sm:flex-row sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/15">
                <RiDatabaseLine size={18} />
              </div>
              <div>
                <CardTitle className="text-sm tracking-[-0.02em]">DB Manager</CardTitle>
                <CardDescription className="text-xs">
                  Manage database connections from one place
                </CardDescription>
              </div>
            </div>

            <CardAction className="flex flex-wrap items-center gap-2 self-auto">
              <Button
                className="h-9 rounded-xl px-3.5 text-xs"
                onClick={() => openModal("new-connection", { source: "dashboard" })}
              >
                <RiAddLine size={16} />
                New Connection
              </Button>

              <div className="relative min-w-60 flex-1 sm:flex-none">
                <RiSearchLine
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search connections..."
                  className="h-9 rounded-xl bg-muted/40 pl-9 text-xs shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]"
                />
              </div>

              <Button variant="outline" className="h-9 rounded-xl px-3.5 text-xs">
                <RiRefreshLine size={16} />
                Refresh
              </Button>
            </CardAction>
          </CardHeader>
          <Separator />
        </Card>

        <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
          {filteredConnections.map((connection) => {
            return <ConnectionCard key={connection.id} connection={connection} />;
          })}
        </section>

        {filteredConnections.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/70 px-6 py-10 text-center text-sm text-muted-foreground">
            No connections match this search.
          </div>
        ) : null}
      </div>

      <NewConnectionPanel />
    </div>
  );
}
