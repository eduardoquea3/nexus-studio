import type { WorkspaceTab } from "@/shared/types/connection-workspace";
import type { ConnectionProfile, ObjectMeta } from "@/shared/types/models";

export type CommandBarMode = "palette" | "tab-switcher";

export type CommandBarItem =
  | {
      id: string;
      kind: "connection";
      label: string;
      detail: string;
      isActive: boolean;
      connection: ConnectionProfile;
    }
  | {
      id: string;
      kind: "table";
      label: string;
      detail: string;
      isActive: false;
      table: ObjectMeta;
    }
  | {
      id: string;
      kind: "tab";
      label: string;
      detail: string;
      isActive: boolean;
      tab: WorkspaceTab;
    };

export function filterCommandBarItems(items: readonly CommandBarItem[], query: string): CommandBarItem[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return [...items];
  }

  return items.filter((item) =>
    [item.label, item.detail, item.kind].some((value) => value.toLowerCase().includes(normalizedQuery)),
  );
}

export function moveSelection(currentIndex: number, count: number, direction: -1 | 1): number {
  if (count <= 0) {
    return -1;
  }

  const normalizedIndex = currentIndex < 0 || currentIndex >= count ? 0 : currentIndex;
  return (normalizedIndex + direction + count) % count;
}

export function nextTabIndex(tabs: readonly WorkspaceTab[], activeTabId: string | null, direction: -1 | 1): number {
  if (tabs.length === 0) {
    return -1;
  }

  const activeIndex = tabs.findIndex((tab) => tab.id === activeTabId);
  return moveSelection(activeIndex === -1 ? 0 : activeIndex, tabs.length, direction);
}

export function describeConnection(profile: ConnectionProfile): string {
  if (profile.connect_mode.type === "connection_string") {
    return `${profile.db_type} · connection string`;
  }

  return `${profile.db_type} · ${profile.connect_mode.host}:${profile.connect_mode.port}`;
}

export function describeTab(tab: WorkspaceTab): { label: string; detail: string } {
  if (tab.type === "datatable") {
    return { label: tab.tableName, detail: `${tab.schema ?? "public"} · table` };
  }

  if (tab.type === "routine") {
    return { label: tab.title, detail: `${tab.schema ?? "public"} · ${tab.routineType}` };
  }

  return { label: tab.title, detail: `${tab.database} · query` };
}
