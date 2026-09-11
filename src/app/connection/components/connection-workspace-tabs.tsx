import { RiAddLine, RiCloseLine, RiCodeBoxLine, RiPlayLine, RiTableLine } from "@remixicon/react";

import { TabsList, TabsTrigger } from "@/components/animate-ui/components/radix/tabs";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { WorkspaceController } from "./connection-workspace-controller";

export function ConnectionWorkspaceTabs({ controller }: { controller: WorkspaceController }) {
  const {
    workspaceTabs,
    activeSqlTabId,
    isRunning,
    createEditorTab,
    closeEditorTab,
    closeTableTab,
    executeActiveQuery,
  } = controller;
  return (
    <div className="flex min-w-0 shrink-0 items-center gap-1 border-b border-border/70 bg-background/80 px-2 py-2">
      <TabsList className="min-w-0 overflow-hidden rounded-b-none bg-transparent p-0">
        {workspaceTabs.map((tab) => (
          <div key={tab.id} className="group flex h-9 items-center">
            <TabsTrigger
              value={tab.id}
              className="group/tab flex h-9 w-36 flex-none items-center gap-1.5 overflow-hidden rounded-t-md px-3 text-xs data-[state=active]:text-foreground"
              onClick={() => {
                controller.setActiveTabId(tab.id);
                if (tab.type === "sql") controller.setActiveSqlTabId(tab.id);
              }}
            >
              {tab.type === "sql" ? (
                <RiCodeBoxLine
                  className={cn(
                    "size-3.5",
                    tab.id === activeSqlTabId ? "text-primary" : "text-muted-foreground",
                  )}
                />
              ) : (
                <RiTableLine className="size-3.5 text-primary" />
              )}
              <span className="truncate">{tab.type === "sql" ? tab.title : tab.tableName}</span>
              {tab.type === "sql" ? (
                <span
                  className="inline-flex size-1.5 shrink-0 items-center justify-center"
                  data-testid={`unsaved-change-slot-${tab.id}`}
                >
                  {tab.isDirty ? (
                    <span
                      aria-label={`Unsaved changes in ${tab.title}`}
                      className="size-1.5 rounded-full bg-primary"
                    />
                  ) : null}
                </span>
              ) : null}
              <span
                role="button"
                tabIndex={0}
                className="inline-flex size-4 items-center justify-center rounded-sm text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/50 group-hover/tab:opacity-100 group-focus-within/tab:opacity-100"
                onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  tab.type === "sql" ? closeEditorTab(tab.id) : closeTableTab(tab.id);
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  event.stopPropagation();
                  tab.type === "sql" ? closeEditorTab(tab.id) : closeTableTab(tab.id);
                }}
                aria-label={`Close ${tab.type === "sql" ? tab.title : tab.tableName}`}
              >
                <RiCloseLine className="size-3" />
              </span>
            </TabsTrigger>
          </div>
        ))}
      </TabsList>
      <Button
        variant="ghost"
        size="icon-xs"
        className="mb-0.5 shrink-0"
        onClick={createEditorTab}
        aria-label="Create SQL editor tab"
      >
        <RiAddLine />
      </Button>
      <div className="ml-auto flex items-center gap-2 px-2 pb-1">
        <Button
          size="sm"
          disabled={!controller.activeSqlTab || isRunning}
          onClick={() => void executeActiveQuery()}
        >
          <RiPlayLine data-icon="inline-start" />
          {isRunning ? "Running..." : "Run query"}
        </Button>
      </div>
    </div>
  );
}
