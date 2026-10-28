import { RiAlertLine, RiArrowRightLine } from "@remixicon/react";
import { lazy, Suspense } from "react";

import type { ConnectionProfile } from "@/shared/types/models";

import { TableWorkspacePanel } from "@/app/connection/components/table-workspace-panel";
import { Tabs, TabsContent } from "@/components/animate-ui/components/radix/tabs";

import type { WorkspaceController } from "./connection-workspace-controller";

import { ConnectionWorkspaceTabs } from "./connection-workspace-tabs";
import { SqlEditorPanel } from "./sql-editor-panel";

const ErDiagramView = lazy(() =>
  import("./er-diagram-view").then((module) => ({ default: module.ErDiagramView })),
);

export function ConnectionWorkspaceContent({
  profile,
  controller,
}: {
  profile: ConnectionProfile;
  controller: WorkspaceController;
}) {
  const {
    activeTableTab,
    activeTabId,
    setActiveTabId,
    setActiveSqlTabId,
    workspaceTabs,
    tableRefreshToken,
    selectedDatabase,
    isErDiagramOpen,
  } = controller;
  return (
    <Tabs
      value={activeTabId}
      onValueChange={(value) => {
        setActiveTabId(value);
        if (workspaceTabs.find((tab) => tab.id === value)?.type === "sql") setActiveSqlTabId(value);
      }}
      className="flex min-h-0 flex-1 flex-col gap-0"
    >
      <ConnectionWorkspaceTabs controller={controller} />
      {workspaceTabs
        .filter((tab) => tab.type === "table")
        .map((tableTab) => {
          const isActive = activeTabId === tableTab.id;
          return (
            <TabsContent
              key={tableTab.id}
              value={tableTab.id}
              forceMount
              hidden={!isActive}
              className={`min-h-0 flex-1 overflow-hidden bg-muted/10 text-xs ${
                isActive ? "" : "hidden"
              }`}
              transition={{ duration: 0 }}
            >
              {tableTab.database !== selectedDatabase ? (
                <div className="flex h-full items-center justify-center overflow-y-auto px-5 py-8 sm:px-8">
                  <section
                    role="alert"
                    aria-labelledby={`table-database-mismatch-title-${tableTab.id}`}
                    className="flex w-full max-w-xl flex-col gap-4 rounded-lg border border-amber-400/20 bg-card/70 p-4 shadow-sm sm:flex-row sm:items-center sm:p-5"
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <RiAlertLine
                        className="mt-0.5 size-4 shrink-0 text-amber-300"
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <h2
                          id={`table-database-mismatch-title-${tableTab.id}`}
                          className="text-sm font-semibold text-foreground"
                        >
                          Database mismatch
                        </h2>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          <span className="font-mono text-foreground">
                            {tableTab.schema ?? "public"}.{tableTab.tableName}
                          </span>{" "}
                          belongs to{" "}
                          <span className="font-medium text-foreground">{tableTab.database}</span>
                          , but{" "}
                          <span className="font-medium text-foreground">
                            {selectedDatabase || "no database"}
                          </span>{" "}
                          is selected.
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 justify-end">
                      <button
                        type="button"
                        onClick={() => controller.handleDatabaseChange(tableTab.database)}
                        className="inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      >
                        Switch to {tableTab.database}
                        <RiArrowRightLine
                          className="size-3.5 text-muted-foreground"
                          aria-hidden="true"
                        />
                      </button>
                    </div>
                  </section>
                </div>
              ) : (
                <TableWorkspacePanel
                  key={tableTab.id}
                  profile={profile}
                  database={tableTab.database}
                  schema={tableTab.schema}
                  table={tableTab.tableName}
                  isActive={isActive}
                  refreshToken={tableRefreshToken}
                />
              )}
            </TabsContent>
          );
        })}
      {isErDiagramOpen && activeTabId === "er-diagram" ? (
        <TabsContent
          value="er-diagram"
          className="min-h-0 flex-1 overflow-hidden bg-muted/10 text-xs"
          transition={{ duration: 0 }}
        >
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                Loading ER diagram tools…
              </div>
            }
          >
            <ErDiagramView profile={profile} database={selectedDatabase} />
          </Suspense>
        </TabsContent>
      ) : !activeTableTab ? (
        <TabsContent
          value={activeTabId}
          className="min-h-0 flex-1 overflow-hidden bg-muted/10 text-xs"
          transition={{ duration: 0 }}
        >
          <SqlEditorPanel controller={controller} />
        </TabsContent>
      ) : null}
    </Tabs>
  );
}
