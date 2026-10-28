import type { ConnectionProfile } from "@/shared/types/models";
import type { DataTableTab } from "@/shared/types/connection-workspace";

export function withDatabase(profile: ConnectionProfile, database: string): ConnectionProfile {
  return profile.connect_mode.type !== "fields"
    ? profile
    : { ...profile, connect_mode: { ...profile.connect_mode, database } };
}

type TableTabTitleInput = Pick<DataTableTab, "id" | "database" | "tableName">;

export function getTableTabTitle(tab: TableTabTitleInput, tabs: readonly TableTabTitleInput[]): string {
  const hasSameNameInAnotherDatabase = tabs.some(
    (candidate) =>
      candidate.id !== tab.id &&
      candidate.tableName === tab.tableName &&
      candidate.database !== tab.database,
  );

  return hasSameNameInAnotherDatabase ? `${tab.tableName} · ${tab.database}` : tab.tableName;
}
