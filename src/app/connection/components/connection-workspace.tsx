import CodeMirror from "@uiw/react-codemirror";
import { sql } from "@codemirror/lang-sql";
import type { EditorView } from "@codemirror/view";
import { RiAddLine, RiCloseLine, RiCodeBoxLine, RiPlayLine, RiTableLine } from "@remixicon/react";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/animate-ui/components/radix/tabs";
import { cn } from "@/lib/utils";
import type { ConnectionProfile } from "@/shared/types/models";
import { sqlEditorTheme } from "@/shared/lib/sql-editor-theme";
import { ConnectionSidebar } from "@/app/connection/components/connection-sidebar";
import { TableDataTab } from "@/app/connection/components/table-data-tab";

type ConnectionWorkspaceProps = {
  profile: ConnectionProfile;
};

export function ConnectionWorkspace({ profile }: ConnectionWorkspaceProps) {
  const [sqlTabs, setSqlTabs] = useState<SqlEditorTab[]>([createSqlTab(1)]);
  const [tableTabs, setTableTabs] = useState<TableTab[]>([]);
  const [activeSqlTabId, setActiveSqlTabId] = useState("sql-1");
  const [activeTabId, setActiveTabId] = useState("sql-1");
  const editorSectionRef = useRef<HTMLElement>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const initializedEditorIdsRef = useRef(new Set<string>());
  const activeSqlTab = sqlTabs.find((tab) => tab.id === activeSqlTabId) ?? sqlTabs[0];
  const activeTableTab = tableTabs.find((tab) => tab.id === activeTabId);
  const workspaceTabs = [
    ...sqlTabs.map((tab) => ({ ...tab, type: "sql" as const })),
    ...tableTabs.map((tab) => ({ ...tab, type: "table" as const })),
  ];

  const focusEditor = (view: EditorView, tabId: string) => {
    view.focus();

    if (!initializedEditorIdsRef.current.has(tabId)) {
      view.dispatch({
        selection: { anchor: 0, head: view.state.doc.length },
      });
      initializedEditorIdsRef.current.add(tabId);
    }
  };

  useEffect(() => {
    if (editorViewRef.current) {
      focusEditor(editorViewRef.current, activeSqlTabId);
    }
  }, [activeSqlTabId]);

  const createEditorTab = () => {
    const nextNumber =
      sqlTabs.reduce((highest, tab) => {
        const number = Number(tab.id.replace("sql-", ""));
        return Number.isNaN(number) ? highest : Math.max(highest, number);
      }, 0) + 1;
    const nextTab = createSqlTab(nextNumber);
    setSqlTabs((tabs) => [...tabs, nextTab]);
    setActiveSqlTabId(nextTab.id);
    setActiveTabId(nextTab.id);
  };

  const closeEditorTab = (tabId: string) => {
    const tabIndex = sqlTabs.findIndex((tab) => tab.id === tabId);
    if (tabIndex === -1) {
      return;
    }

    const nextTabs = sqlTabs.filter((tab) => tab.id !== tabId);
    setSqlTabs(nextTabs);

      if (activeSqlTabId === tabId) {
        const nextActiveTab = nextTabs[Math.max(0, tabIndex - 1)];
        setActiveSqlTabId(nextActiveTab?.id ?? "");
        setActiveTabId(nextActiveTab?.id ?? "");

      if (!nextActiveTab) {
        editorSectionRef.current?.focus();
      }
    }
  };

  const closeTableTab = (tabId: string) => {
    setTableTabs((tabs) => tabs.filter((tab) => tab.id !== tabId));

    if (activeTabId === tabId) {
      setActiveTabId(activeSqlTabId);
    }
  };

  const openTableTab = (table: string) => {
    const id = `table-${table}`;
    setTableTabs((tabs) => (tabs.some((tab) => tab.id === id) ? tabs : [...tabs, { id, table }]));
    setActiveTabId(id);
  };

  const updateActiveQuery = (query: string) => {
    if (!activeSqlTab) {
      return;
    }

    setSqlTabs((tabs) => tabs.map((tab) => (tab.id === activeSqlTab.id ? { ...tab, query } : tab)));
  };

  const handleWorkspaceKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if ((!event.ctrlKey && !event.metaKey) || event.altKey) {
      return;
    }

    if (event.key === "Tab") {
      if (workspaceTabs.length === 0) {
        return;
      }

      event.preventDefault();
      const currentIndex = workspaceTabs.findIndex((tab) => tab.id === activeTabId);
      const direction = event.shiftKey ? -1 : 1;
      const nextIndex = (currentIndex + direction + workspaceTabs.length) % workspaceTabs.length;
      setActiveTabId(workspaceTabs[nextIndex].id);
      if (workspaceTabs[nextIndex].type === "sql") {
        setActiveSqlTabId(workspaceTabs[nextIndex].id);
      }
      return;
    }

    if (event.shiftKey) {
      return;
    }

    if (event.key.toLowerCase() === "t") {
      event.preventDefault();
      createEditorTab();
      return;
    }

    if (event.key.toLowerCase() === "w" && activeTabId.startsWith("table-")) {
      event.preventDefault();
      closeTableTab(activeTabId);
      return;
    }

    if (event.key.toLowerCase() === "w" && activeSqlTab) {
      event.preventDefault();
      closeEditorTab(activeSqlTab.id);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-background text-foreground">
      <div className="flex min-h-0 flex-1">
        <ConnectionSidebar profile={profile} onTableSelect={openTableTab} />

        <main className="min-w-0 flex-1">
          <div className="flex h-full min-h-0 flex-col p-4">
            <section
              ref={editorSectionRef}
              tabIndex={0}
              aria-label="SQL editor workspace"
              onKeyDownCapture={handleWorkspaceKeyDown}
              className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <Tabs
                value={activeTabId}
                onValueChange={(value) => {
                  setActiveTabId(value);
                  if (value.startsWith("sql-")) {
                    setActiveSqlTabId(value);
                  }
                }}
                className="flex min-h-0 flex-1 flex-col gap-0"
              >
                <div className="flex min-w-0 shrink-0 items-center border-b border-border/70 bg-muted/10 px-2 pt-2">
                  <TabsList className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden rounded-b-none bg-transparent p-0">
                    {workspaceTabs.map((tab) => (
                      <div key={tab.id} className="group flex h-9 items-center">
                        <TabsTrigger
                          value={tab.id}
                          className="h-9 rounded-t-md px-3 text-xs data-[state=active]:text-foreground"
                          onClick={() => {
                            setActiveTabId(tab.id);
                            if (tab.type === "sql") {
                              setActiveSqlTabId(tab.id);
                            }
                          }}
                        >
                          {tab.type === "sql" ? <RiCodeBoxLine
                            className={cn(
                              "size-3.5",
                              tab.id === activeSqlTabId ? "text-primary" : "text-muted-foreground",
                            )}
                          /> : <RiTableLine className="size-3.5 text-primary" />}
                          {tab.type === "sql" ? tab.title : tab.table}
                        </TabsTrigger>
                        {tab.type === "sql" && sqlTabs.length <= 1 ? null : (
                          <button
                            type="button"
                            className="mr-1 rounded-sm p-1 text-muted-foreground opacity-60 outline-none hover:bg-muted hover:text-foreground hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/50"
                            onClick={() => tab.type === "sql" ? closeEditorTab(tab.id) : closeTableTab(tab.id)}
                            aria-label={`Close ${tab.type === "sql" ? tab.title : tab.table}`}
                          >
                            <RiCloseLine className="size-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </TabsList>
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
                    <Button size="sm" disabled={!activeSqlTab}>
                      <RiPlayLine data-icon="inline-start" />
                      Run query
                    </Button>
                  </div>
                </div>
                {activeTableTab ? (
                  <TabsContent value={activeTabId} className="min-h-0 flex-1 overflow-hidden bg-muted/10 text-xs">
                    <TableDataTab profile={profile} table={activeTableTab.table} />
                  </TabsContent>
                ) : activeSqlTab ? (
                  <TabsContent
                    value={activeTabId}
                    className="min-h-0 flex-1 overflow-hidden bg-muted/10 text-xs"
                  >
                    <CodeMirror
                      value={activeSqlTab.query}
                      onChange={updateActiveQuery}
                      extensions={[sql(), sqlEditorTheme]}
                      basicSetup
                      theme="none"
                      height="100%"
                      className="h-full"
                      onCreateEditor={(view) => {
                        editorViewRef.current = view;
                        focusEditor(view, activeSqlTabId);
                      }}
                      aria-label={`${activeSqlTab.title} SQL query editor`}
                    />
                  </TabsContent>
                ) : (
                    <div className="flex min-h-0 flex-1 items-center justify-center bg-muted/10 px-4 text-xs text-muted-foreground">
                    Press Ctrl+T to open a SQL editor.
                  </div>
                )}
                <div className="border-t border-border/70 bg-muted/10 px-4 py-3 text-xs text-muted-foreground">
                  Results will appear here after the query runner is connected.
                </div>
              </Tabs>
            </section>
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

type TableTab = {
  id: string;
  table: string;
};

function createSqlTab(number: number): SqlEditorTab {
  return {
    id: `sql-${number}`,
    title: `Query ${number}`,
    query: "select * from users limit 100;",
  };
}
