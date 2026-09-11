import type { ConnectionProfile } from "@/shared/types/models";

import { TableDataTab } from "@/app/connection/components/table-data-tab";
import { Tabs, TabsContent } from "@/components/animate-ui/components/radix/tabs";

import type { WorkspaceController } from "./connection-workspace-controller";

import { ConnectionWorkspaceTabs } from "./connection-workspace-tabs";
import { withDatabase } from "./connection-workspace-view-utils";
import { SqlEditorPanel } from "./sql-editor-panel";

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
      {activeTableTab ? (
        <TabsContent
          value={activeTabId}
          className="min-h-0 flex-1 overflow-hidden bg-muted/10 text-xs"
        >
          <TableDataTab
            key={activeTableTab.id}
            profile={withDatabase(profile, activeTableTab.database)}
            schema={activeTableTab.schema}
            table={activeTableTab.tableName}
            refreshToken={tableRefreshToken}
          />
        </TabsContent>
      ) : (
        <TabsContent
          value={activeTabId}
          className="min-h-0 flex-1 overflow-hidden bg-muted/10 text-xs"
        >
          <SqlEditorPanel controller={controller} />
        </TabsContent>
      )}
    </Tabs>
  );
}
