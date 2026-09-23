import { Decoration, EditorView, keymap, ViewPlugin } from "@codemirror/view";
import { RiArrowDownSLine, RiPlayLine } from "@remixicon/react";
import CodeMirror from "@uiw/react-codemirror";
import { Group, Panel, Separator } from "react-resizable-panels";

import type { ViewMode } from "@/shared/types/models";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/animate-ui/components/radix/dropdown-menu";
import { Button } from "@/components/ui/button";

import { sqlCompletionIcons } from "@/shared/lib/sql-completion-icons";
import { sqlEditorTheme } from "@/shared/lib/sql-editor-theme";

import type { WorkspaceController } from "./connection-workspace-controller";
import { getQueryRange } from "./connection-workspace-utils";

import { QueryResultView } from "./query-result-view";

const EMPTY_STATE_SHORTCUTS = [
  ["Run all", ["Ctrl", "Enter"]],
  ["Run current", ["Ctrl", "Shift", "Enter"]],
  ["New SQL tab", ["Ctrl", "T"]],
  ["Close active tab", ["Ctrl", "W"]],
  ["Next tab", ["Ctrl", "Tab"]],
  ["Previous tab", ["Ctrl", "Shift", "Tab"]],
  ["Toggle sidebar", ["Ctrl", "B"]],
] as const;

const activeQueryDecoration = Decoration.mark({ class: "cm-active-query" });
const activeQueryHighlight = ViewPlugin.fromClass(
  class {
    decorations = Decoration.none;

    constructor(view: EditorView) {
      this.decorations = this.buildDecorations(view);
    }

    update(update: { docChanged: boolean; selectionSet: boolean; view: EditorView }) {
      if (update.docChanged || update.selectionSet)
        this.decorations = this.buildDecorations(update.view);
    }

    buildDecorations(view: EditorView) {
      const doc = view.state.doc.toString();
      const { from, to } = getQueryRange(doc, view.state.selection.main.head);
      return from < to ? Decoration.set([activeQueryDecoration.range(from, to)]) : Decoration.none;
    }
  },
  { decorations: (value) => value.decorations },
);

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
    executeActiveQuery,
    executeAllQuery,
  } = controller;
  const hasQuery = Boolean(activeSqlTab?.query.trim());
  if (!activeSqlTab)
    return (
      <div className="flex h-full min-h-0 flex-1 items-center justify-center bg-muted/10 px-4 py-8">
        <section
          aria-label="Available keyboard shortcuts"
          className="w-full max-w-sm rounded-lg border border-border/70 bg-card/50 p-4 shadow-sm sm:p-5"
        >
          <div className="mb-3 text-center">
            <p className="font-label text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Keyboard shortcuts
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Get around your workspace faster.</p>
          </div>
          <ul className="flex flex-col gap-1.5" aria-label="Implemented shortcuts">
            {EMPTY_STATE_SHORTCUTS.map(([label, keys]) => (
              <li
                key={label}
                className="flex min-w-0 items-center justify-between gap-3 rounded-md px-2.5 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
              >
                <span className="truncate">{label}</span>
                <span className="flex shrink-0 items-center gap-1" aria-label={`${keys.join("+")} ${label}`}>
                  {keys.map((key, index) => (
                    <span key={`${key}-${index}`} className="flex items-center gap-1">
                      {index > 0 && <span aria-hidden="true" className="text-muted-foreground/60">+</span>}
                      <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[0.65rem] text-foreground shadow-[0_1px_0_hsl(var(--border))]">
                        {key}
                      </kbd>
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </section>
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
              activeQueryHighlight,
              keymap.of([
                {
                  key: "Mod-Shift-Enter",
                  preventDefault: true,
                  run: (view) => {
                    void executeActiveQuery(view.state.selection.main.head);
                    return true;
                  },
                },
                {
                  key: "Mod-Enter",
                  preventDefault: true,
                  run: () => {
                    void executeAllQuery();
                    return true;
                  },
                },
              ]),
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
          className="results-font flex h-full min-h-0 flex-col overflow-hidden bg-background/80 text-xs text-muted-foreground"
        >
          <div className="flex w-full shrink-0 items-center justify-between gap-3 border-b border-border/70 bg-background/80 px-3 py-1">
            {activeSqlTab.queryResult ? (
              <div
                aria-label="Query result statistics"
                className="flex items-center gap-3 text-[0.65rem] text-muted-foreground"
              >
                <span>{activeSqlTab.queryResult.rows.length} rows</span>
                <span>{activeSqlTab.queryResult.columns.length} columns</span>
                <span>{activeSqlTab.queryResult.duration_ms} ms</span>
              </div>
            ) : (
              <span aria-hidden="true" />
            )}
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="sm"
                disabled={isRunning || !hasQuery}
                onClick={() => void executeAllQuery()}
                aria-label="Run all queries"
              >
                <RiPlayLine data-icon="inline-start" />
                {isRunning ? "Running..." : "Run all"}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="outline"
                    disabled={isRunning || !hasQuery}
                    aria-label="Query run options"
                  >
                    <RiArrowDownSLine />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => void executeAllQuery()}>
                    Run all
                    <DropdownMenuShortcut className="text-[0.6rem] tracking-normal">
                      Ctrl + Enter
                    </DropdownMenuShortcut>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => void executeActiveQuery()}>
                    Run current
                    <DropdownMenuShortcut className="text-[0.6rem] tracking-normal">
                      Ctrl + Shift + Enter
                    </DropdownMenuShortcut>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            {isRunning ? (
              <p className="p-2" role="status">
                Running query...
              </p>
            ) : activeSqlTab.queryError ? (
              <p className="p-2 text-destructive">{activeSqlTab.queryError}</p>
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
              <p className="p-2">
                Press Ctrl+Enter to run all statements, or Ctrl+Shift+Enter to run the current
                statement.
              </p>
            )}
          </div>
        </section>
      </Panel>
    </Group>
  );
}
