import { memo, useMemo, type ComponentProps } from "react";

import { TableDataTab } from "./table-data-tab";
import { withDatabase } from "./connection-workspace-view-utils";

type TableWorkspacePanelProps = ComponentProps<typeof TableDataTab> & { database: string };

export const TableWorkspacePanel = memo(function TableWorkspacePanel({
  profile,
  database,
  ...props
}: TableWorkspacePanelProps) {
  const tableProfile = useMemo(() => withDatabase(profile, database), [profile, database]);
  return <TableDataTab profile={tableProfile} {...props} />;
});
