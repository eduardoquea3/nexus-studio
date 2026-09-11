import { create } from "zustand";

import type { WorkspaceTab } from "../types/connection-workspace";

export interface ConnectionWorkspace {
  connectionId: string;
  activeTabId: string | null;
  tabs: WorkspaceTab[];
}

export interface WorkspaceState {
  activeConnectionId: string | null;
  connections: Record<string, ConnectionWorkspace>;
  isHydrated: boolean;
  openTab: (tab: WorkspaceTab) => void;
  closeTab: (connectionId: string, tabId: string) => void;
  activateTab: (connectionId: string, tabId: string) => void;
  setActiveConnection: (connectionId: string | null) => void;
  setConnectionWorkspace: (workspace: ConnectionWorkspace) => void;
  removeConnection: (connectionId: string) => void;
  hydrate: (snapshot: Pick<WorkspaceState, "activeConnectionId" | "connections">) => void;
}

function createWorkspace(connectionId: string): ConnectionWorkspace {
  return { connectionId, activeTabId: null, tabs: [] };
}

function sameResource(left: WorkspaceTab, right: WorkspaceTab): boolean {
  if (left.connectionId !== right.connectionId || left.type !== right.type) {
    return false;
  }

  if (left.type === "query" && right.type === "query") {
    return left.id === right.id;
  }

  if (left.type === "datatable" && right.type === "datatable") {
    return (
      left.database === right.database &&
      left.schema === right.schema &&
      left.tableName === right.tableName
    );
  }

  if (left.type === "routine" && right.type === "routine") {
    return (
      left.database === right.database &&
      left.schema === right.schema &&
      left.routineName === right.routineName &&
      left.routineType === right.routineType &&
      left.signature === right.signature
    );
  }

  return false;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  activeConnectionId: null,
  connections: {},
  isHydrated: false,
  openTab: (tab) =>
    set((state) => {
      const workspace = state.connections[tab.connectionId] ?? createWorkspace(tab.connectionId);
      const existingTab = workspace.tabs.find((candidate) => sameResource(candidate, tab));
      const nextWorkspace = existingTab
        ? { ...workspace, activeTabId: existingTab.id }
        : { ...workspace, activeTabId: tab.id, tabs: [...workspace.tabs, tab] };

      return {
        activeConnectionId: tab.connectionId,
        connections: { ...state.connections, [tab.connectionId]: nextWorkspace },
      };
    }),
  closeTab: (connectionId, tabId) =>
    set((state) => {
      const workspace = state.connections[connectionId];
      if (!workspace) {
        return state;
      }

      const tabIndex = workspace.tabs.findIndex((tab) => tab.id === tabId);
      if (tabIndex === -1) {
        return state;
      }

      const tabs = workspace.tabs.filter((tab) => tab.id !== tabId);
      const activeTabId =
        workspace.activeTabId === tabId
          ? tabs[Math.max(0, tabIndex - 1)]?.id ?? null
          : workspace.activeTabId;

      return {
        connections: {
          ...state.connections,
          [connectionId]: { ...workspace, tabs, activeTabId },
        },
      };
    }),
  activateTab: (connectionId, tabId) =>
    set((state) => {
      const workspace = state.connections[connectionId];
      if (!workspace || !workspace.tabs.some((tab) => tab.id === tabId)) {
        return state;
      }

      return {
        activeConnectionId: connectionId,
        connections: {
          ...state.connections,
          [connectionId]: { ...workspace, activeTabId: tabId },
        },
      };
    }),
  setActiveConnection: (connectionId) =>
    set((state) => ({
      activeConnectionId: connectionId,
      ...(connectionId && !state.connections[connectionId]
        ? { connections: { ...state.connections, [connectionId]: createWorkspace(connectionId) } }
      : {}),
    })),
  setConnectionWorkspace: (workspace) =>
    set((state) => ({
      activeConnectionId: workspace.connectionId,
      connections: { ...state.connections, [workspace.connectionId]: workspace },
    })),
  removeConnection: (connectionId) =>
    set((state) => {
      const { [connectionId]: _, ...connections } = state.connections;
      return {
        activeConnectionId:
          state.activeConnectionId === connectionId ? null : state.activeConnectionId,
        connections,
      };
    }),
  hydrate: (snapshot) => set({ ...snapshot, isHydrated: true }),
}));
