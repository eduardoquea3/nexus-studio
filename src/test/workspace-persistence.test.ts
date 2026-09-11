import { describe, expect, test } from "bun:test";

import type { QueryTab } from "@/shared/types/connection-workspace";
import type { DataTableTab, RoutineTab } from "@/shared/types/connection-workspace";
import {
  deserializeWorkspace,
  hydrateWorkspaceResources,
  serializeWorkspace,
} from "@/shared/store/workspace-persistence";
import type { ObjectMeta } from "@/shared/types/models";
import type { WorkspaceState } from "@/shared/store/workspace-store";

const queryTab: QueryTab = {
  id: "query-1",
  type: "query",
  connectionId: "connection-1",
  database: "app",
  title: "Query 1",
  query: "select 1;",
  isDirty: true,
  queryResult: null,
  queryError: "old error should not persist",
  viewMode: "json",
};

const state = {
  activeConnectionId: "connection-1",
  connections: {
    "connection-1": {
      connectionId: "connection-1",
      activeTabId: queryTab.id,
      tabs: [queryTab],
    },
  },
} satisfies Pick<WorkspaceState, "activeConnectionId" | "connections">;

const tableTab: DataTableTab = {
  id: "table-1",
  type: "datatable",
  connectionId: "connection-1",
  database: "app",
  schema: "public",
  tableName: "users",
};

const routineTab: RoutineTab = {
  id: "routine-1",
  type: "routine",
  connectionId: "connection-1",
  database: "app",
  schema: "public",
  routineName: "refresh_users",
  routineType: "function",
  signature: "refresh_users()",
  title: "refresh_users",
  query: "select refresh_users();",
  isDirty: false,
};

describe("workspace persistence", () => {
  test("serializes and deserializes the versioned workspace snapshot", () => {
    const restored = deserializeWorkspace(serializeWorkspace(state), new Set(["connection-1"]));

    expect(restored).toEqual({
      activeConnectionId: "connection-1",
      connections: {
        "connection-1": {
          connectionId: "connection-1",
          activeTabId: "query-1",
          tabs: [
            {
              ...queryTab,
              queryResult: null,
              queryError: null,
            },
          ],
        },
      },
    });
  });

  test("rejects an unknown persistence version", () => {
    expect(
      deserializeWorkspace(
        JSON.stringify({ version: 99, activeConnectionId: "connection-1", connections: {} }),
        new Set(["connection-1"]),
      ),
    ).toEqual({ activeConnectionId: null, connections: {} });
  });

  test("removes deleted connections and invalid tabs", () => {
    const raw = JSON.stringify({
      version: 1,
      activeConnectionId: "deleted",
      connections: {
        deleted: { connectionId: "deleted", activeTabId: "gone", tabs: [] },
        "connection-1": {
          connectionId: "connection-1",
          activeTabId: "missing",
          tabs: [
            { ...queryTab },
            { ...queryTab, id: "wrong-connection", connectionId: "other" },
            { id: "broken", type: "datatable", connectionId: "connection-1", tableName: 42 },
          ],
        },
      },
    });

    const restored = deserializeWorkspace(raw, new Set(["connection-1"]));

    expect(restored.connections).toEqual({
      "connection-1": {
        connectionId: "connection-1",
        activeTabId: "query-1",
        tabs: [{ ...queryTab, queryResult: null, queryError: null }],
      },
    });
    expect(restored.activeConnectionId).toBeNull();
  });

  test("restores a valid active tab and clears an invalid active tab", () => {
    const valid = deserializeWorkspace(
      serializeWorkspace(state),
      new Set(["connection-1"]),
    );
    const invalid = deserializeWorkspace(
      JSON.stringify({
        version: 1,
        activeConnectionId: "connection-1",
        connections: {
          "connection-1": { ...state.connections["connection-1"], activeTabId: "missing" },
        },
      }),
      new Set(["connection-1"]),
    );

    expect(valid.connections["connection-1"]?.activeTabId).toBe("query-1");
    expect(invalid.connections["connection-1"]?.activeTabId).toBe("query-1");
  });

  test("deduplicates datatables by database, schema, and table name", () => {
    const first = {
      id: "table-public-users",
      type: "datatable",
      connectionId: "connection-1",
      database: "app",
      schema: "public",
      tableName: "users",
    } as const;
    const duplicate = { ...first, id: "table-public-users-duplicate" };
    const otherSchema = { ...first, id: "table-admin-users", schema: "admin" };

    const restored = deserializeWorkspace(
      JSON.stringify({
        version: 1,
        activeConnectionId: "connection-1",
        connections: {
          "connection-1": {
            connectionId: "connection-1",
            activeTabId: duplicate.id,
            tabs: [first, duplicate, otherSchema],
          },
        },
      }),
      new Set(["connection-1"]),
    );

    expect(restored.connections["connection-1"]?.tabs).toHaveLength(2);
    expect(restored.connections["connection-1"]?.tabs.map((tab) => tab.id)).toEqual([
      first.id,
      otherSchema.id,
    ]);
    expect(restored.connections["connection-1"]?.activeTabId).toBe(first.id);
  });

  test("removes conclusively missing tables and routines while retaining existing resources", async () => {
    const snapshot = deserializeWorkspace(
      JSON.stringify({
        version: 1,
        activeConnectionId: "connection-1",
        connections: {
          "connection-1": {
            connectionId: "connection-1",
            activeTabId: tableTab.id,
            tabs: [tableTab, routineTab, { ...tableTab, id: "table-2", tableName: "orders" }],
          },
        },
      }),
      new Set(["connection-1"]),
    );

    const restored = await hydrateWorkspaceResources(snapshot, async () => [
      { name: "users", object_type: "table", schema: "public" },
      { name: "refresh_users", object_type: "function", schema: "public", signature: "refresh_users()" },
    ]);

    expect(restored.connections["connection-1"]?.tabs.map((tab) => tab.id)).toEqual([
      tableTab.id,
      routineTab.id,
    ]);
  });

  test("preserves resource tabs when schema validation fails", async () => {
    const snapshot = {
      ...state,
      connections: {
        ...state.connections,
        "connection-1": {
          ...state.connections["connection-1"],
          tabs: [queryTab, tableTab, routineTab],
        },
      },
    };

    const restored = await hydrateWorkspaceResources(snapshot, async () => {
      throw new Error("temporary database outage");
    });

    expect(restored).toEqual(snapshot);
  });

  test("matches schema object types and keeps SQL query tabs independent", async () => {
    const snapshot = {
      ...state,
      connections: {
        ...state.connections,
        "connection-1": {
          ...state.connections["connection-1"],
          tabs: [queryTab, tableTab, routineTab],
        },
      },
    };
    const resources: ObjectMeta[] = [
      { name: "users", object_type: "view", schema: "public" },
      { name: "refresh_users", object_type: "procedure", schema: "public", signature: "refresh_users()" },
    ];

    const restored = await hydrateWorkspaceResources(snapshot, async () => resources);

    expect(restored.connections["connection-1"]?.tabs).toEqual([queryTab]);
  });
});
