import { createFileRoute, Link } from "@tanstack/react-router";
import CodeMirror from "@uiw/react-codemirror";
import { sql } from "@codemirror/lang-sql";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { EditorView } from "@codemirror/view";
import {
  RiAddLine,
  RiArrowLeftLine,
  RiCloseLine,
  RiCodeBoxLine,
  RiDatabase2Line,
  RiPlayLine,
  RiRefreshLine,
  RiTableLine,
} from "@remixicon/react";
import { useEffect, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { listConnections } from "@/shared/lib/tauriApi";
import { useConnectionStore } from "@/shared/store/connectionStore";
import type { ConnectionProfile } from "@/shared/types/models";

const sqlEditorTheme = [
  EditorView.theme({
    "&": {
      color: "var(--foreground)",
      backgroundColor: "var(--card)",
      height: "100%",
    },
    ".cm-content": {
      caretColor: "var(--ring)",
      padding: "1rem 0",
    },
    ".cm-line": {
      padding: "0 1rem",
      lineHeight: "1.7",
    },
    ".cm-gutters": {
      color: "var(--muted-foreground)",
      backgroundColor: "var(--card)",
      borderRight: "1px solid var(--border)",
      fontFamily: "var(--font-sans)",
      lineHeight: "1.7",
    },
    ".cm-gutterElement": {
      lineHeight: "1.7",
      padding: "0 0.75rem",
    },
    ".cm-activeLine": {
      backgroundColor: "color-mix(in srgb, var(--primary) 8%, transparent)",
    },
    ".cm-activeLineGutter": {
      color: "var(--foreground)",
      backgroundColor: "color-mix(in srgb, var(--primary) 10%, transparent)",
    },
    ".cm-selectionBackground, ::selection": {
      backgroundColor: "color-mix(in srgb, var(--primary) 24%, transparent)",
    },
    ".cm-cursor": {
      borderLeftColor: "var(--ring)",
    },
    ".cm-scroller": {
      fontFamily: "var(--font-sans)",
      lineHeight: "1.7",
    },
    ".cm-tooltip": {
      backgroundColor: "var(--popover)",
      color: "var(--popover-foreground)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius-md)",
      boxShadow: "0 8px 24px color-mix(in srgb, var(--foreground) 12%, transparent)",
      overflow: "hidden",
    },
    ".cm-tooltip-autocomplete": {
      maxHeight: "14rem",
      padding: "0.25rem",
      scrollbarColor: "var(--border) transparent",
      scrollbarWidth: "thin",
    },
    ".cm-tooltip-autocomplete ul": {
      fontFamily: "var(--font-sans)",
      fontSize: "0.75rem",
    },
    ".cm-tooltip-autocomplete ul li": {
      borderRadius: "var(--radius-sm)",
      padding: "0.35rem 0.5rem",
      color: "var(--muted-foreground)",
    },
    ".cm-tooltip-autocomplete ul li[aria-selected]": {
      backgroundColor: "var(--accent)",
      color: "var(--accent-foreground)",
    },
    ".cm-completionMatchedText": {
      color: "var(--primary)",
      fontWeight: "600",
    },
    ".cm-completionIcon": {
      color: "var(--muted-foreground)",
      opacity: "0.8",
    },
  }),
  syntaxHighlighting(
    HighlightStyle.define([
      { tag: tags.keyword, color: "var(--primary)", fontWeight: "600" },
      { tag: tags.operator, color: "var(--accent-foreground)" },
      { tag: tags.string, color: "var(--chart-2)" },
      { tag: tags.number, color: "var(--chart-3)" },
      { tag: tags.comment, color: "var(--muted-foreground)", fontStyle: "italic" },
      { tag: tags.variableName, color: "var(--foreground)" },
      { tag: tags.function(tags.variableName), color: "var(--chart-5)" },
      { tag: tags.typeName, color: "var(--chart-4)" },
    ]),
  ),
];

export const Route = createFileRoute("/connections/$connectionId")({
  component: ConnectionWorkspace,
});

function ConnectionWorkspace() {
  const { connectionId } = Route.useParams();
  const profiles = useConnectionStore((state) => state.profiles);
  const setProfiles = useConnectionStore((state) => state.setProfiles);
  const [isLoading, setIsLoading] = useState(profiles.length === 0);

  useEffect(() => {
    if (profiles.length > 0) {
      return;
    }

    void listConnections()
      .then(setProfiles)
      .finally(() => setIsLoading(false));
  }, [profiles.length, setProfiles]);

  const profile = profiles.find((item) => item.id === connectionId);

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
  const engine = profile.db_type === "postgres" ? "postgresql" : profile.db_type;
  const endpoint =
    profile.connect_mode.type === "fields"
      ? `${profile.connect_mode.host}:${profile.connect_mode.port}`
      : profile.connect_mode.value;
  const activeSqlTab = sqlTabs.find((tab) => tab.id === activeSqlTabId) ?? sqlTabs[0];

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
    setSqlTabs((tabs) =>
      tabs.map((tab) => (tab.id === activeSqlTab.id ? { ...tab, query } : tab)),
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-background text-foreground">
      <header className="flex min-h-14 items-center justify-between gap-4 border-b border-border/70 px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            render={<Link to="/" />}
            variant="ghost"
            size="icon-sm"
            aria-label="Back to connections"
          >
            <RiArrowLeftLine />
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <RiDatabase2Line className="size-4 shrink-0 text-primary" />
              <h1 className="truncate text-sm font-semibold tracking-tight">{profile.name}</h1>
              <Badge variant="outline" className="text-[0.65rem] uppercase tracking-wider">
                {engine}
              </Badge>
            </div>
            <p className="truncate text-xs text-muted-foreground">{endpoint}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="size-2 rounded-full bg-primary" />
          Connected
          <Button variant="outline" size="sm">
            <RiRefreshLine data-icon="inline-start" />
            Refresh
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-60 shrink-0 border-r border-border/70 bg-muted/10 lg:flex lg:flex-col">
          <div className="border-b border-border/70 px-4 py-4">
            <p className="text-[0.65rem] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Database
            </p>
            <p className="mt-1 truncate text-sm font-medium">{profile.connect_mode.type === "fields" ? profile.connect_mode.database : "SQLite file"}</p>
            <p className="mt-1 truncate text-xs text-muted-foreground">{profile.connect_mode.type === "fields" ? profile.connect_mode.username : endpoint}</p>
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
