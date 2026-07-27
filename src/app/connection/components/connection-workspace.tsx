import type { EditorView } from "@codemirror/view";

import { sql } from "@codemirror/lang-sql";
import { RiAddLine, RiCloseLine, RiCodeBoxLine, RiPlayLine, RiTableLine } from "@remixicon/react";
import CodeMirror from "@uiw/react-codemirror";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";

import type { ConnectionProfile, QueryResult } from "@/shared/types/models";

import { ConnectionSidebar } from "@/app/connection/components/connection-sidebar";
import { TableDataTab } from "@/app/connection/components/table-data-tab";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/animate-ui/components/radix/tabs";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { sqlEditorTheme } from "@/shared/lib/sql-editor-theme";
import { runQuery } from "@/shared/lib/tauriApi";

type ConnectionWorkspaceProps = {
  profile: ConnectionProfile;
};

export function ConnectionWorkspace({ profile }: ConnectionWorkspaceProps) {
  const [sqlTabs, setSqlTabs] = useState<SqlEditorTab[]>([createSqlTab(1)]);
  const [tableTabs, setTableTabs] = useState<TableTab[]>([]);
  const [activeSqlTabId, setActiveSqlTabId] = useState("sql-1");
  const [activeTabId, setActiveTabId] = useState("sql-1");
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
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

  const executeActiveQuery = async () => {
    if (!activeSqlTab || !editorViewRef.current || isRunning) {
      return;
    }

    const cursor = editorViewRef.current.state.selection.main.head;
    const query = getQuerySegment(activeSqlTab.query, cursor);
    if (!query) {
      setQueryError("Place the cursor inside a SQL statement before running it.");
      setQueryResult(null);
      return;
    }

    setIsRunning(true);
    setQueryError(null);
    try {
      setQueryResult(await runQuery(profile, query));
    } catch (error) {
      setQueryResult(null);
      setQueryError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsRunning(false);
    }
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

    if (event.key === "Enter" && activeSqlTab) {
      event.preventDefault();
      void executeActiveQuery();
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
                          {tab.type === "sql" ? (
                            <RiCodeBoxLine
                              className={cn(
                                "size-3.5",
                                tab.id === activeSqlTabId
                                  ? "text-primary"
                                  : "text-muted-foreground",
                              )}
                            />
                          ) : (
                            <RiTableLine className="size-3.5 text-primary" />
                          )}
                          {tab.type === "sql" ? tab.title : tab.table}
                        </TabsTrigger>
                        {tab.type === "sql" && sqlTabs.length <= 1 ? null : (
                          <button
                            type="button"
                            className="mr-1 rounded-sm p-1 text-muted-foreground opacity-60 outline-none hover:bg-muted hover:text-foreground hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/50"
                            onClick={() =>
                              tab.type === "sql" ? closeEditorTab(tab.id) : closeTableTab(tab.id)
                            }
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
                    <Button
                      size="sm"
                      disabled={!activeSqlTab || isRunning}
                      onClick={() => void executeActiveQuery()}
                    >
                      <RiPlayLine data-icon="inline-start" />
                      {isRunning ? "Running..." : "Run query"}
                    </Button>
                  </div>
                </div>
                {activeTableTab ? (
                  <TabsContent
                    value={activeTabId}
                    className="min-h-0 flex-1 overflow-hidden bg-muted/10 text-xs"
                  >
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
                <div className="min-h-20 max-h-64 overflow-auto border-t border-border/70 bg-muted/10 px-4 py-3 text-xs text-muted-foreground">
                  {queryError ? (
                    <p className="text-destructive">{queryError}</p>
                  ) : queryResult ? (
                    <QueryResultView result={queryResult} />
                  ) : (
                    "Place the cursor in a statement and press Ctrl+Enter to run it."
                  )}
                </div>
              </Tabs>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

export function getQuerySegment(query: string, position: number): string {
  const separators = findStatementSeparators(query);
  const previousSeparators = separators.filter((separator) => separator < position);
  const previousSeparator = previousSeparators[previousSeparators.length - 1] ?? -1;
  const nextSeparator = separators.find((separator) => separator >= position) ?? query.length;
  const end = nextSeparator < query.length ? nextSeparator + 1 : query.length;
  return query.slice(previousSeparator + 1, end).trim();
}

function findStatementSeparators(query: string): number[] {
  const separators: number[] = [];
  let quote: "'" | '"' | "`" | null = null;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < query.length; index += 1) {
    const character = query[index];
    const nextCharacter = query[index + 1];

    if (lineComment) {
      if (character === "\n") {
        lineComment = false;
      }
      continue;
    }
    if (blockComment) {
      if (character === "*" && nextCharacter === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (character === quote) {
        if (nextCharacter === quote) {
          index += 1;
        } else {
          quote = null;
        }
      }
      continue;
    }
    if ((character === "-" && nextCharacter === "-") || character === "#") {
      lineComment = true;
      if (character === "-") {
        index += 1;
      }
      continue;
    }
    if (character === "/" && nextCharacter === "*") {
      blockComment = true;
      index += 1;
      continue;
    }
    if (character === "'" || character === '"' || character === "`") {
      quote = character;
      continue;
    }
    if (character === ";") {
      separators.push(index);
    }
  }

  return separators;
}

function QueryResultView({ result }: { result: QueryResult }) {
  if (result.columns.length === 0) {
    return (
      <span>
        {result.affected} row(s) affected in {result.duration_ms} ms.
      </span>
    );
  }

  return (
    <div className="min-w-max">
      <div className="mb-2">
        {result.rows.length} row(s) in {result.duration_ms} ms.
      </div>
      <table className="border-collapse text-left">
        <thead>
          <tr>
            {result.columns.map((column) => (
              <th
                className="border border-border px-2 py-1 font-medium text-foreground"
                key={column}
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {result.columns.map((column) => (
                <td className="border border-border px-2 py-1" key={column}>
                  {formatCell(row[column])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "NULL";
  }
  return typeof value === "object" ? JSON.stringify(value) : String(value);
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
