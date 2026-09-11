import type { ConnectionProfile } from "@/shared/types/models";

import { CommandBar } from "@/app/command-bar/command-bar";
import { nextTabIndex } from "@/app/command-bar/command-bar-utils";
import { ConnectionSidebar } from "@/app/connection/components/connection-sidebar";
import { ConnectionWorkspaceContent } from "@/app/connection/components/connection-workspace-content";

import { useConnectionWorkspaceController } from "./connection-workspace-controller";

export { getQuerySegment } from "./connection-workspace-utils";

type ConnectionWorkspaceProps = {
  profile: ConnectionProfile;
  onConnectionSwitch?: (profile: ConnectionProfile) => void | Promise<void>;
};

export function ConnectionWorkspace({ profile, onConnectionSwitch }: ConnectionWorkspaceProps) {
  const controller = useConnectionWorkspaceController({ profile, onConnectionSwitch });
  const {
    commandBarMode,
    commandBarItems,
    tabItems,
    activeTabId,
    switcherInitialDirection,
    switcherCycle,
    closeCommandBar,
    activateWorkspaceTab,
    setActiveTabId,
    setActiveSqlTabId,
    openTableTab,
    switchConnection,
    switchingConnectionIds,
    isLoadingConnections,
    isFetchingConnections,
    isLoadingSchema,
    isFetchingSchema,
    editorSectionRef,
    handleWorkspaceKeyDown,
    selectedDatabase,
    handleDatabaseChange,
    openRoutineTab,
  } = controller;
  return (
    <div className="relative flex h-full min-h-0 flex-col bg-background text-foreground">
      {commandBarMode ? (
        <CommandBar
          mode={commandBarMode}
          items={commandBarItems}
          initialIndex={
            commandBarMode === "tab-switcher"
              ? nextTabIndex(tabItems, activeTabId, switcherInitialDirection)
              : 0
          }
          cycleRequest={commandBarMode === "tab-switcher" ? switcherCycle : undefined}
          onHighlightChange={(item) => {
            if (commandBarMode !== "tab-switcher") return;
            if (item?.kind !== "tab") return;
            if (item.tab.id === activeTabId) return;
            activateWorkspaceTab(profile.id, item.tab.id);
            setActiveTabId(item.tab.id);
            if (item.tab.type === "query") setActiveSqlTabId(item.tab.id);
          }}
          onClose={closeCommandBar}
          inline
          onSelect={(item) => {
            if (item.kind === "command") {
              if (item.command === "disconnect") void controller.navigate({ to: "/" });
              if (item.command === "new-connection") {
                controller.openModal("new-connection", { source: "command-bar" });
                void controller.navigate({ to: "/" });
              }
              closeCommandBar(true);
            } else if (item.kind === "tab") {
              activateWorkspaceTab(profile.id, item.tab.id);
              setActiveTabId(item.tab.id);
              if (item.tab.type === "query") setActiveSqlTabId(item.tab.id);
              closeCommandBar(true);
            } else if (item.kind === "table") {
              openTableTab(item.table.name, item.table.schema);
              closeCommandBar();
            }
          }}
          onConnectionSelect={(connection) => void switchConnection(connection)}
          groups={
            commandBarMode === "palette"
              ? ["connections", "tables"]
              : commandBarMode === "commands"
                ? ["commands"]
                : ["tabs"]
          }
          isLoading={
            commandBarMode === "palette" &&
            (switchingConnectionIds.size > 0 ||
              isLoadingConnections ||
              isFetchingConnections ||
              isLoadingSchema ||
              isFetchingSchema)
          }
        />
      ) : null}
      <div className="flex min-h-0 flex-1">
        <ConnectionSidebar
          profile={profile}
          selectedDatabase={selectedDatabase}
          onDatabaseChange={handleDatabaseChange}
          onTableSelect={openTableTab}
          onRoutineSelect={(routine) => void openRoutineTab(routine)}
        />
        <main className="min-w-0 flex-1">
          <div className="flex h-full min-h-0 flex-col">
            <section
              ref={editorSectionRef}
              tabIndex={0}
              aria-label="SQL editor workspace"
              onKeyDownCapture={handleWorkspaceKeyDown}
              className="flex h-full min-h-0 flex-col overflow-hidden border border-border/70 bg-card shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <ConnectionWorkspaceContent profile={profile} controller={controller} />
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
