import { EditorView } from "@codemirror/view";
import CodeMirror from "@uiw/react-codemirror";
import { Group, Panel, Separator } from "react-resizable-panels";

import type { ViewMode } from "@/shared/types/models";

import { sqlCompletionIcons } from "@/shared/lib/sql-completion-icons";
import { sqlEditorTheme } from "@/shared/lib/sql-editor-theme";

import type { WorkspaceController } from "./connection-workspace-controller";

import { QueryResultView } from "./query-result-view";

export function SqlEditorPanel({ controller }: { controller: WorkspaceController }) {
  const {
    activeSqlTab,
    activeSqlTabId,
    editorViewRef,
    focusEditor,
    sqlLanguageExtensions,
    updateActiveQuery,
    isRunning,
    setSqlTabs,
  } = controller;
  if (!activeSqlTab)
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center bg-muted/10 px-4 text-xs text-muted-foreground">
        Press Ctrl+T to open a SQL editor.
      </div>
    );
  return (
    <Group orientation="vertical" className="h-full min-h-0 overflow-hidden">
      <Panel defaultSize="30%" minSize="15%" maxSize="80%" className="min-h-0 overflow-hidden">
        <div className="sql-editor-font h-full overflow-hidden border-b border-border/70 bg-card/60">
          <CodeMirror
            value={activeSqlTab.query}
            onChange={updateActiveQuery}
            basicSetup={{ lineNumbers: true, foldGutter: true, autocompletion: false }}
            theme="none"
            extensions={[
              ...sqlLanguageExtensions,
              sqlCompletionIcons,
              sqlEditorTheme,
              EditorView.theme({
                ".cm-content": { padding: "0.35rem 0" },
                ".cm-line": { padding: "0 1rem 0 0.5rem", lineHeight: "1.5" },
                ".cm-lineNumbers": { width: "1.5rem" },
                ".cm-lineNumbers .cm-gutterElement": {
                  minWidth: "1.5rem",
                  boxSizing: "border-box",
                  padding: "0 0 0 0.5rem",
                  textAlign: "left",
                },
                ".cm-foldGutter": { width: "1rem" },
                ".cm-foldGutter .cm-gutterElement": {
                  width: "1rem",
                  boxSizing: "border-box",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  lineHeight: "1.5",
                  padding: "0",
                },
              }),
            ]}
            height="100%"
            width="100%"
            className="h-full w-full"
            onCreateEditor={(view) => {
              editorViewRef.current = view;
              focusEditor(view, activeSqlTabId);
            }}
            aria-label={`${activeSqlTab.title} SQL query editor`}
          />
        </div>
      </Panel>
      <Separator
        className="group/separator relative z-10 h-1 shrink-0 cursor-row-resize border-y border-border/70 bg-background transition-colors hover:bg-primary/30 focus-visible:bg-primary/30 focus-visible:outline-none"
        aria-label="Resize SQL editor and results"
      >
        <span className="absolute inset-x-1/2 top-1/2 h-0.5 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-muted-foreground/40 transition-colors group-hover/separator:bg-primary" />
      </Separator>
      <Panel defaultSize="70%" minSize="20%" className="min-h-0 overflow-hidden">
        <section
          aria-label="SQL query results"
          className="results-font flex h-full min-h-0 overflow-hidden bg-background/80 text-xs text-muted-foreground"
        >
          {isRunning ? (
            <p role="status">Running query...</p>
          ) : activeSqlTab.queryError ? (
            <p className="text-destructive">{activeSqlTab.queryError}</p>
          ) : activeSqlTab.queryResult ? (
            <QueryResultView
              result={activeSqlTab.queryResult}
              viewMode={activeSqlTab.viewMode}
              onViewModeChange={(viewMode: ViewMode) =>
                setSqlTabs((tabs) =>
                  tabs.map((tab) => (tab.id === activeSqlTab.id ? { ...tab, viewMode } : tab)),
                )
              }
            />
          ) : (
            "Place the cursor in a statement and press Ctrl+Enter to run it."
          )}
        </section>
      </Panel>
    </Group>
  );
}
