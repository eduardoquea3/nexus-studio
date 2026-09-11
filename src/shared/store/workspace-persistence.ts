import { load } from "@tauri-apps/plugin-store";

import type {
  DataTableTab,
  QueryTab,
  RoutineTab,
  WorkspaceTab,
} from "../types/connection-workspace";
import type { ObjectMeta } from "../types/models";
import type { WorkspaceState, ConnectionWorkspace } from "./workspace-store";

export const WORKSPACE_PERSISTENCE_VERSION = 1;
const STORE_PATH = "workspace.json";
const WORKSPACE_KEY = "workspace";

export type WorkspaceSnapshot = Pick<WorkspaceState, "activeConnectionId" | "connections">;
export type WorkspaceResourceValidator = (
  connectionId: string,
  database: string,
) => Promise<ReadonlyArray<ObjectMeta>>;

type PersistedWorkspace = {
  version: number;
  activeConnectionId: string | null;
  connections: Record<string, ConnectionWorkspace>;
};

const emptySnapshot = (): WorkspaceSnapshot => ({ activeConnectionId: null, connections: {} });

export function serializeWorkspace(state: WorkspaceSnapshot): string {
  const document: PersistedWorkspace = {
    version: WORKSPACE_PERSISTENCE_VERSION,
    activeConnectionId: state.activeConnectionId,
    connections: Object.fromEntries(
      Object.entries(state.connections).map(([connectionId, workspace]) => [
        connectionId,
        {
          ...workspace,
          tabs: workspace.tabs.map(toPersistedTab),
        },
      ]),
    ),
  };

  return JSON.stringify(document);
}

export function deserializeWorkspace(
  value: unknown,
  validConnectionIds?: ReadonlySet<string>,
): WorkspaceSnapshot {
  const parsed = parseValue(value);
  if (!isRecord(parsed) || parsed.version !== WORKSPACE_PERSISTENCE_VERSION) {
    return emptySnapshot();
  }

  const connections: Record<string, ConnectionWorkspace> = {};
  const persistedConnections = isRecord(parsed.connections) ? parsed.connections : {};
  for (const [connectionId, candidate] of Object.entries(persistedConnections)) {
    if (validConnectionIds && !validConnectionIds.has(connectionId)) {
      continue;
    }
    const workspace = parseWorkspace(candidate, connectionId);
    if (workspace) {
      connections[connectionId] = workspace;
    }
  }

  const activeConnectionId =
    typeof parsed.activeConnectionId === "string" && connections[parsed.activeConnectionId]
      ? parsed.activeConnectionId
      : null;

  return { activeConnectionId, connections };
}

export async function initWorkspacePersistence(
  getCurrentState: () => WorkspaceSnapshot,
  hydrate: (snapshot: WorkspaceSnapshot) => void,
  validConnectionIds: ReadonlySet<string>,
  validateResources?: WorkspaceResourceValidator,
): Promise<() => void> {
  const store = await load(STORE_PATH, { autoSave: false, defaults: {} });
  const saved = await store.get<unknown>(WORKSPACE_KEY);
  let snapshot = deserializeWorkspace(saved, validConnectionIds);
  if (validateResources) {
    snapshot = await hydrateWorkspaceResources(snapshot, validateResources);
  }
  hydrate(snapshot);

  // Repair malformed, stale, or non-canonical local data without contacting a database.
  if (serializeWorkspace(snapshot) !== canonicalSerializedValue(saved)) {
    await store.set(WORKSPACE_KEY, serializeWorkspace(snapshot));
    await store.save();
  }

  let writing = Promise.resolve();
  const persist = () => {
    writing = writing.catch(() => undefined).then(async () => {
      await store.set(WORKSPACE_KEY, serializeWorkspace(getCurrentState()));
      await store.save();
    });
  };

  return persist;
}

export async function hydrateWorkspaceResources(
  snapshot: WorkspaceSnapshot,
  validateResources: WorkspaceResourceValidator,
): Promise<WorkspaceSnapshot> {
  const connections = Object.fromEntries(
    await Promise.all(
      Object.entries(snapshot.connections).map(async ([connectionId, workspace]) => {
        const databases = [...new Set(
          workspace.tabs
            .filter((tab) => tab.type === "datatable" || tab.type === "routine")
            .map((tab) => tab.database),
        )];
        const resourceResults = await Promise.all(
          databases.map(async (database) => {
            try {
              return [database, await validateResources(connectionId, database)] as const;
            } catch {
              return [database, null] as const;
            }
          }),
        );
        const resourcesByDatabase = new Map(resourceResults);
        const tabs = workspace.tabs.filter((tab) => {
          if (tab.type === "query") {
            return true;
          }
          const resources = resourcesByDatabase.get(tab.database);
          if (!resources) {
            return true;
          }
          return resources.some((resource) => matchesPersistedResource(tab, resource));
        });
        const activeTabId = tabs.some((tab) => tab.id === workspace.activeTabId)
          ? workspace.activeTabId
          : tabs[0]?.id ?? null;
        return [connectionId, { ...workspace, tabs, activeTabId }] as const;
      }),
    ),
  );

  return {
    activeConnectionId: snapshot.activeConnectionId && connections[snapshot.activeConnectionId]
      ? snapshot.activeConnectionId
      : null,
    connections,
  };
}

function matchesPersistedResource(tab: DataTableTab | RoutineTab, resource: ObjectMeta): boolean {
  const sameLocation = resource.name === (tab.type === "datatable" ? tab.tableName : tab.routineName)
    && (resource.schema ?? "public") === (tab.schema ?? "public");
  if (!sameLocation) {
    return false;
  }
  if (tab.type === "datatable") {
    return resource.object_type === "table";
  }
  return resource.object_type === tab.routineType
    && (resource.signature ?? tab.routineName) === (tab.signature ?? tab.routineName);
}

function toPersistedTab(tab: WorkspaceTab): WorkspaceTab {
  if (tab.type === "query") {
    return { ...tab, queryResult: null, queryError: null };
  }
  return tab;
}

function parseValue(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function parseWorkspace(value: unknown, connectionId: string): ConnectionWorkspace | null {
  if (!isRecord(value) || value.connectionId !== connectionId || !Array.isArray(value.tabs)) {
    return null;
  }

  const tabs = value.tabs
    .map((tab) => parseTab(tab, connectionId))
    .filter((tab): tab is WorkspaceTab => tab !== null)
    .filter((tab, index, all) => {
      const identity = tabResourceIdentity(tab);
      return all.findIndex((candidate) => candidate.id === tab.id || tabResourceIdentity(candidate) === identity) === index;
    });
  const activeTabId =
    typeof value.activeTabId === "string" && tabs.some((tab) => tab.id === value.activeTabId)
      ? value.activeTabId
      : tabs[0]?.id ?? null;

  return { connectionId, activeTabId, tabs };
}

function parseTab(value: unknown, connectionId: string): WorkspaceTab | null {
  if (
    !isRecord(value) ||
    value.connectionId !== connectionId ||
    typeof value.id !== "string" ||
    value.id.length === 0
  ) {
    return null;
  }

  if (
    value.type === "query" &&
    typeof value.database === "string" &&
    typeof value.title === "string" &&
    typeof value.query === "string" &&
    typeof value.isDirty === "boolean" &&
    (value.viewMode === "table" || value.viewMode === "json")
  ) {
    const tab: QueryTab = {
      id: value.id,
      type: "query",
      connectionId,
      database: value.database,
      title: value.title,
      query: value.query,
      isDirty: value.isDirty,
      queryResult: null,
      queryError: null,
      viewMode: value.viewMode,
    };
    return tab;
  }

  if (
    value.type === "datatable" &&
    typeof value.database === "string" &&
    (value.schema === undefined || typeof value.schema === "string") &&
    typeof value.tableName === "string"
  ) {
    const tab: DataTableTab = {
      id: value.id,
      type: "datatable",
      connectionId,
      database: value.database,
      schema: value.schema,
      tableName: value.tableName,
    };
    return tab;
  }

  if (
    value.type === "routine" &&
    typeof value.database === "string" &&
    (value.schema === undefined || typeof value.schema === "string") &&
    typeof value.routineName === "string" &&
    (value.routineType === "function" || value.routineType === "procedure") &&
    (value.signature === undefined || typeof value.signature === "string") &&
    typeof value.title === "string" &&
    typeof value.query === "string" &&
    typeof value.isDirty === "boolean"
  ) {
    const tab: RoutineTab = {
      id: value.id,
      type: "routine",
      connectionId,
      database: value.database,
      schema: value.schema,
      routineName: value.routineName,
      routineType: value.routineType,
      signature: value.signature,
      title: value.title,
      query: value.query,
      isDirty: value.isDirty,
    };
    return tab;
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function tabResourceIdentity(tab: WorkspaceTab): string {
  if (tab.type === "query") {
    return `query:${tab.id}`;
  }
  if (tab.type === "datatable") {
    return `datatable:${tab.database}:${tab.schema ?? ""}:${tab.tableName}`;
  }
  return `routine:${tab.database}:${tab.schema ?? ""}:${tab.routineName}:${tab.routineType}:${tab.signature ?? ""}`;
}

function canonicalSerializedValue(value: unknown): string | null {
  const parsed = parseValue(value);
  return isRecord(parsed) && parsed.version === WORKSPACE_PERSISTENCE_VERSION
    ? JSON.stringify(parsed)
    : null;
}
