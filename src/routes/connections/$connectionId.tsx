import { createFileRoute, Link } from "@tanstack/react-router";
import CodeMirror from "@uiw/react-codemirror";
import { sql } from "@codemirror/lang-sql";
import {
  RiAddLine,
  RiCloseLine,
  RiCodeBoxLine,
  RiDatabase2Line,
  RiPlayLine,
  RiTableLine,
} from "@remixicon/react";
import { useEffect, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useDatabases } from "@/app/connection/hooks/use-databases";
import { getInitialDatabase } from "@/app/connection/services/database-service";
import { useConnection } from "@/app/home/hooks/use-connections";
import { Select } from "@/shared/components/ui/select";
import { useThemeStore } from "@/shared/store/theme-store";
import type { ConnectionProfile } from "@/shared/types/models";
import { sqlEditorTheme } from "@/shared/lib/sql-editor-theme";

export const Route = createFileRoute("/connections/$connectionId")({
  component: ConnectionWorkspace,
});

function ConnectionWorkspace() {
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

  return <WorkspaceView profile={profile} />;
}

function WorkspaceView({ profile }: { profile: ConnectionProfile }) {
  const [sqlTabs, setSqlTabs] = useState<SqlEditorTab[]>([createSqlTab(1)]);
  const [activeSqlTabId, setActiveSqlTabId] = useState("sql-1");
  const initialDatabase = getInitialDatabase(profile);
  const [selectedDatabase, setSelectedDatabase] = useState(initialDatabase);
  const {
    data: databaseValues = [],
    error: databaseError,
    isLoading: isLoadingDatabases,
  } = useDatabases(profile);
  const databases = databaseValues.map((value) => ({ value, label: value }));
  const sidebarOpen = useThemeStore((state) => state.sidebarOpen);
  const toggleSidebar = useThemeStore((state) => state.toggleSidebar);
  const engine = profile.db_type === "postgres" ? "postgresql" : profile.db_type;
  const endpoint =
    profile.connect_mode.type === "fields"
      ? `${profile.connect_mode.host}:${profile.connect_mode.port}`
      : profile.connect_mode.value;
  const activeSqlTab = sqlTabs.find((tab) => tab.id === activeSqlTabId) ?? sqlTabs[0];

  useEffect(() => {
    setSelectedDatabase(initialDatabase);
  }, [initialDatabase, profile.id]);

  useHotkeys(
    ["ctrl+tab", "meta+tab", "ctrl+shift+tab", "meta+shift+tab"],
    (event) => {
      event.preventDefault();
      const currentIndex = sqlTabs.findIndex((tab) => tab.id === activeSqlTabId);
      const direction = event.shiftKey ? -1 : 1;
      const nextIndex = (currentIndex + direction + sqlTabs.length) % sqlTabs.length;
      setActiveSqlTabId(sqlTabs[nextIndex].id);
    },
    { enableOnFormTags: ["INPUT", "TEXTAREA"], preventDefault: true },
    [activeSqlTabId, sqlTabs],
  );

  useHotkeys(
    "ctrl+b",
    (event) => {
      event.preventDefault();
      void toggleSidebar();
    },
    { enableOnFormTags: true, preventDefault: true },
    [toggleSidebar],
  );

  const createEditorTab = () => {
    const nextNumber = sqlTabs.length + 1;
    const nextTab = createSqlTab(nextNumber);
    setSqlTabs((tabs) => [...tabs, nextTab]);
    setActiveSqlTabId(nextTab.id);
  };

  const closeEditorTab = (tabId: string) => {
    if (sqlTabs.length === 1) {
      return;
    }

    const tabIndex = sqlTabs.findIndex((tab) => tab.id === tabId);
    const nextTabs = sqlTabs.filter((tab) => tab.id !== tabId);
    setSqlTabs(nextTabs);

    if (activeSqlTabId === tabId) {
      setActiveSqlTabId(nextTabs[Math.max(0, tabIndex - 1)].id);
    }
  };

  const updateActiveQuery = (query: string) => {
    setSqlTabs((tabs) => tabs.map((tab) => (tab.id === activeSqlTab.id ? { ...tab, query } : tab)));
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-background text-foreground">
      <div className="flex min-h-0 flex-1">
        <aside
          className={cn(
            "w-60 shrink-0 border-r border-border/70 bg-muted/10",
            sidebarOpen ? "flex flex-col" : "hidden",
          )}
        >
          <div className="border-b border-border/70 px-4 py-4">
            <div className="flex items-center gap-2">
              <RiDatabase2Line className="size-4 shrink-0 text-primary" />
              <h1 className="truncate text-sm font-semibold tracking-tight">{profile.name}</h1>
              <Badge variant="outline" className="text-[0.65rem] uppercase tracking-wider">
                {engine}
              </Badge>
            </div>
            <p className="mt-1 truncate text-xs text-muted-foreground">{endpoint}</p>
          </div>
          <div className="border-b border-border/70 px-4 py-4">
            <p className="text-[0.65rem] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Database
            </p>
            <Select
              options={databases}
              value={databases.find((option) => option.value === selectedDatabase) ?? null}
              onValueChange={(option) => {
                if (option) {
                  setSelectedDatabase(option.value);
                }
              }}
              valueKey="value"
              labelKey="label"
              placeholder={
                isLoadingDatabases
                  ? "Loading databases..."
                  : databaseError
                    ? "Database unavailable"
                    : "Select database"
              }
              className="mt-1 h-8 w-full text-xs"
              disabled={databases.length === 0 || isLoadingDatabases}
            />
            {databaseError ? (
              <p className="mt-2 text-[0.65rem] text-destructive">Database unavailable</p>
            ) : null}
          </div>
          <ScrollArea className="min-h-0 flex-1">
            <div className="p-3">
              <p className="px-2 py-2 text-[0.65rem] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Explorer
              </p>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <RiTableLine className="size-4" />
                Tables
                <span className="ml-auto text-[0.65rem]">0</span>
              </button>
              <p className="mt-6 px-2 text-xs leading-5 text-muted-foreground">
                Load the schema to browse tables and columns for this connection.
              </p>
            </div>
          </ScrollArea>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="flex h-full min-h-0 flex-col p-4">
            <div className="flex h-full min-h-96 flex-col overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
              <div className="flex items-center gap-1 border-b border-border/70 bg-muted/10 px-2 pt-2">
                {sqlTabs.map((tab) => (
                  <div
                    key={tab.id}
                    className={cn(
                      "group flex h-9 items-center rounded-t-md border border-b-0 text-xs transition-colors",
                      tab.id === activeSqlTabId
                        ? "border-primary/30 bg-card text-foreground shadow-[inset_0_2px_0_var(--primary)]"
                        : "border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    )}
                  >
                    <button
                      type="button"
                      aria-selected={tab.id === activeSqlTabId}
                      className="flex h-full items-center gap-2 rounded-t-md px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset"
                      onClick={() => setActiveSqlTabId(tab.id)}
                    >
                      <RiCodeBoxLine
                        className={cn(
                          "size-3.5",
                          tab.id === activeSqlTabId ? "text-primary" : "text-muted-foreground",
                        )}
                      />
                      {tab.title}
                    </button>
                    {sqlTabs.length > 1 ? (
                      <button
                        type="button"
                        className="mr-1 rounded-sm p-1 text-muted-foreground opacity-60 outline-none hover:bg-muted hover:text-foreground hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/50"
                        onClick={(event) => {
                          event.stopPropagation();
                          closeEditorTab(tab.id);
                        }}
                        aria-label={`Close ${tab.title}`}
                      >
                        <RiCloseLine className="size-3" />
                      </button>
                    ) : null}
                  </div>
                ))}
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="mb-0.5"
                  onClick={createEditorTab}
                  aria-label="Create SQL editor tab"
                >
                  <RiAddLine />
                </Button>
                <div className="ml-auto flex items-center gap-2 px-2 pb-1">
                  <Button size="sm">
                    <RiPlayLine data-icon="inline-start" />
                    Run query
                  </Button>
                </div>
              </div>
              <CodeMirror
                value={activeSqlTab.query}
                onChange={updateActiveQuery}
                extensions={[sql(), sqlEditorTheme]}
                basicSetup
                theme="none"
                height="100%"
                className="min-h-48 flex-1 overflow-auto bg-muted/10 text-xs"
                aria-label="SQL query editor"
              />
              <div className="border-t border-border/70 bg-muted/10 px-4 py-3 text-xs text-muted-foreground">
                Results will appear here after the query runner is connected.
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

type SqlEditorTab = {
  id: string;
  title: string;
  query: string;
};

function createSqlTab(number: number): SqlEditorTab {
  return {
    id: `sql-${number}`,
    title: `Query ${number}`,
    query: "select * from users limit 100;",
  };
}

function WorkspaceMessage({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <div className="flex min-h-full items-center justify-center bg-background p-8 text-center text-sm text-muted-foreground">
      <div>
        <p>{message}</p>
        {action ? <p className="mt-3 text-primary underline underline-offset-4">{action}</p> : null}
      </div>
    </div>
  );
}
