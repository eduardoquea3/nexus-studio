import { CommandBar } from "@/app/command-bar/command-bar";
import {
  ConnectionDatabaseSelectorPortal,
  type DatabaseOption,
} from "@/app/connection/components/connection-database-selector";
import { ConnectionSidebar } from "@/app/connection/components/connection-sidebar";
import { ConnectionWorkspaceContent } from "@/app/connection/components/connection-workspace-content";
import { useThemeStore } from "@/shared/store/theme-store";
import type { ConnectionProfile } from "@/shared/types/models";

import { useConnectionWorkspaceController } from "./connection-workspace-controller";

export { getQuerySegment } from "./connection-workspace-utils";

type ConnectionWorkspaceProps = {
  profile: ConnectionProfile;
  isActive?: boolean;
  onConnectionSwitch?: (profile: ConnectionProfile) => void | Promise<void>;
};

export function ConnectionWorkspace({
  profile,
  isActive = true,
  onConnectionSwitch,
}: ConnectionWorkspaceProps) {
  const controller = useConnectionWorkspaceController({ profile, isActive, onConnectionSwitch });
  const sidebarOpen = useThemeStore((state) => state.sidebarOpen);
  const sidebarPosition = useThemeStore((state) => state.sidebarPosition);
  const databaseOptions: DatabaseOption[] = controller.databases.map((value) => ({
    value,
    label: value,
  }));
  const {
    commandBarMode,
    commandBarItems,
    activeTabId,
    highlightSwitcherTab,
    closeCommandBar,
    activateWorkspaceTab,
    setActiveTabId,
    setActiveSqlTabId,
    openTableTab,
    openErDiagram,
    switchConnection,
    switchingConnectionIds,
    isLoadingConnections,
    isFetchingConnections,
    isLoadingDatabases,
    isFetchingDatabases,
    isLoadingSchema,
    isFetchingSchema,
    editorSectionRef,
    handleWorkspaceKeyDown,
    selectedDatabase,
    activeTableTab,
    handleDatabaseChange,
    openRoutineTab,
  } = controller;
  return (
    <>
      <ConnectionDatabaseSelectorPortal
        databases={databaseOptions}
        selectedDatabase={selectedDatabase}
        onDatabaseChange={handleDatabaseChange}
        isLoading={controller.isLoadingDatabases}
        hasError={Boolean(controller.databaseError)}
      />
      <div className="connection-workbench relative flex h-full min-h-0 flex-col overflow-hidden bg-background p-2 text-foreground">
        {commandBarMode ? (
          <CommandBar
            mode={commandBarMode}
            items={commandBarItems}
            selectedId={commandBarMode === "tab-switcher" ? activeTabId : undefined}
            onHighlightChange={(item) => {
              if (commandBarMode !== "tab-switcher") return;
              if (item?.kind !== "tab") return;
              highlightSwitcherTab(item.tab.id);
            }}
            onClose={closeCommandBar}
            inline
            onSelect={(item) => {
              if (item.kind === "command") {
                if (item.command === "disconnect") void controller.navigate({ to: "/" });
                if (item.command === "new-connection") {
                  void controller.navigate({
                    to: "/connections/new",
                    search: { connectionId: undefined },
                  });
                }
                if (item.command === "generate-er-diagram") openErDiagram();
                closeCommandBar(true);
              } else if (item.kind === "tab") {
                activateWorkspaceTab(profile.id, item.tab.id);
                setActiveTabId(item.tab.id);
                if (item.tab.type === "query") setActiveSqlTabId(item.tab.id);
                closeCommandBar(true);
              } else if (item.kind === "table") {
                openTableTab(item.table.name, item.table.schema);
                closeCommandBar();
              } else if (item.kind === "database") {
                controller.handleDatabaseChange(item.database);
                closeCommandBar();
              }
            }}
            onConnectionSelect={(connection) => void switchConnection(connection)}
            groups={
              commandBarMode === "palette"
                ? ["connections", "databases", "tables"]
                : commandBarMode === "commands"
                  ? ["commands"]
                  : ["tabs"]
            }
            isLoading={
              commandBarMode === "palette" &&
              (switchingConnectionIds.size > 0 ||
                isLoadingConnections ||
                isFetchingConnections ||
                isLoadingDatabases ||
                isFetchingDatabases ||
                isLoadingSchema ||
                isFetchingSchema)
            }
          />
        ) : null}
        <div
          className={`flex min-h-0 flex-1 ${sidebarOpen ? "gap-2" : "gap-0"} ${
            sidebarPosition === "right" ? "flex-row-reverse" : ""
          } overflow-hidden`}
        >
          <ConnectionSidebar
            profile={profile}
            selectedDatabase={selectedDatabase}
            selectedTableName={activeTableTab?.tableName}
            selectedTableSchema={activeTableTab?.schema}
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
                className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card outline-none"
              >
                <ConnectionWorkspaceContent profile={profile} controller={controller} />
              </section>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
