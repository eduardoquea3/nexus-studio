import CodeMirror from "@uiw/react-codemirror";
import { sql } from "@codemirror/lang-sql";
import { RiAddLine, RiCloseLine, RiCodeBoxLine, RiPlayLine } from "@remixicon/react";
import { useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useThemeStore } from "@/shared/store/theme-store";
import type { ConnectionProfile } from "@/shared/types/models";
import { sqlEditorTheme } from "@/shared/lib/sql-editor-theme";
import { ConnectionSidebar } from "@/app/connection/components/connection-sidebar";

type ConnectionWorkspaceProps = {
  profile: ConnectionProfile;
};

export function ConnectionWorkspace({ profile }: ConnectionWorkspaceProps) {
  const [sqlTabs, setSqlTabs] = useState<SqlEditorTab[]>([createSqlTab(1)]);
  const [activeSqlTabId, setActiveSqlTabId] = useState("sql-1");
  const toggleSidebar = useThemeStore((state) => state.toggleSidebar);
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
    const nextTab = createSqlTab(sqlTabs.length + 1);
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
        <ConnectionSidebar profile={profile} />

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
