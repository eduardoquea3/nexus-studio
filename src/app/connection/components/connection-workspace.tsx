import { RiDatabase2Line } from "@remixicon/react";

import type { ConnectionProfile } from "@/shared/types/models";

import { CommandBar } from "@/app/command-bar/command-bar";
import { ConnectionSidebar } from "@/app/connection/components/connection-sidebar";
import { ConnectionWorkspaceContent } from "@/app/connection/components/connection-workspace-content";

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
    <div className="connection-workbench dark relative flex h-full min-h-0 flex-col overflow-hidden bg-[#111318] p-2 text-foreground">
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
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[#292d36] bg-[#090b0f] shadow-xl">
        <header className="flex h-11 shrink-0 items-center gap-3 border-b border-[#252831] px-4">
          <div className="flex items-center gap-2 text-[0.68rem] font-semibold tracking-[0.12em] text-[#e1e3e8]">
            <RiDatabase2Line className="size-4 text-violet-400" aria-hidden="true" />
            <span>NEXUS STUDIO</span>
          </div>
          <span className="h-4 w-px bg-[#30333b]" aria-hidden="true" />
          <div className="flex min-w-0 items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/[0.08] px-2.5 py-1 text-[0.65rem] text-emerald-300">
            <span className="size-1.5 shrink-0 rounded-full bg-emerald-400" aria-hidden="true" />
            <span className="truncate">{profile.name}</span>
            <span className="hidden text-emerald-200/60 sm:inline">· {profile.db_type}</span>
          </div>
        </header>
        <div className="flex min-h-0 flex-1">
          <ConnectionSidebar
            profile={profile}
            selectedDatabase={selectedDatabase}
            selectedTableName={activeTableTab?.tableName}
            selectedTableSchema={activeTableTab?.schema}
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
                className="flex h-full min-h-0 flex-col overflow-hidden border border-[#252831] bg-[#0b0d12] outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <ConnectionWorkspaceContent profile={profile} controller={controller} />
              </section>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
