import { afterEach, describe, expect, test } from "bun:test";

import type { DataTableTab, QueryTab, RoutineTab } from "@/shared/types/connection-workspace";
import { useWorkspaceStore } from "@/shared/store/workspace-store";

const queryTab = (connectionId: string, id: string): QueryTab => ({
  id,
  type: "query",
  connectionId,
  database: "app",
  title: id,
  query: "select 1;",
  isDirty: false,
  queryResult: null,
  queryError: null,
  viewMode: "table",
});

const dataTableTab = (
  connectionId: string,
  database: string,
  schema: string | undefined,
  tableName: string,
): DataTableTab => ({
  id: `${connectionId}-${database}-${schema ?? "default"}-${tableName}`,
  type: "datatable",
  connectionId,
  database,
  schema,
  tableName,
});

const routineTab = (connectionId: string, id: string): RoutineTab => ({
  id,
  type: "routine",
  connectionId,
  database: "app",
  schema: "public",
  routineName: "refresh_company",
  routineType: "function",
  signature: "public.refresh_company()",
  title: "refresh_company",
  query: "CREATE FUNCTION refresh_company() RETURNS void;",
  isDirty: false,
});

afterEach(() => {
  useWorkspaceStore.setState(useWorkspaceStore.getInitialState());
});

describe("workspace store", () => {
  test("deduplicates datatables by connection, database, schema, and table", () => {
    const store = useWorkspaceStore.getState();
    const first = dataTableTab("connection-1", "app", "public", "company");
    const duplicate = { ...first, id: "different-id" };
    const differentSchema = dataTableTab("connection-1", "app", "sales", "company");

    store.openTab(first);
    store.openTab(duplicate);
    store.openTab(differentSchema);

    const workspace = useWorkspaceStore.getState().connections["connection-1"];
    expect(workspace?.tabs).toHaveLength(2);
    expect(workspace?.tabs[1]).toEqual(differentSchema);
    expect(workspace?.activeTabId).toBe(differentSchema.id);
  });

  test("keeps identical resources isolated between connections", () => {
    const store = useWorkspaceStore.getState();
    const first = dataTableTab("connection-1", "app", "public", "company");
    const second = dataTableTab("connection-2", "app", "public", "company");

    store.openTab(first);
    store.openTab(second);

    expect(useWorkspaceStore.getState().connections["connection-1"]?.tabs).toEqual([first]);
    expect(useWorkspaceStore.getState().connections["connection-2"]?.tabs).toEqual([second]);
    expect(useWorkspaceStore.getState().activeConnectionId).toBe("connection-2");
  });

  test("deduplicates routine tabs and activates an existing tab", () => {
    const store = useWorkspaceStore.getState();
    const first = routineTab("connection-1", "routine-1");
    const duplicate = { ...first, id: "routine-2" };

    store.openTab(first);
    store.openTab(queryTab("connection-1", "query-1"));
    store.openTab(duplicate);

    const workspace = useWorkspaceStore.getState().connections["connection-1"];
    expect(workspace?.tabs).toHaveLength(2);
    expect(workspace?.activeTabId).toBe(first.id);
  });

  test("activates only tabs that belong to the requested connection", () => {
    const store = useWorkspaceStore.getState();
    const first = queryTab("connection-1", "query-1");
    const second = queryTab("connection-2", "query-2");

    store.openTab(first);
    store.openTab(second);
    store.activateTab("connection-1", first.id);

    expect(useWorkspaceStore.getState().activeConnectionId).toBe("connection-1");
    expect(useWorkspaceStore.getState().connections["connection-1"]?.activeTabId).toBe(first.id);
    expect(useWorkspaceStore.getState().connections["connection-2"]?.activeTabId).toBe(second.id);
  });

  test("closes the active tab and selects the previous remaining tab", () => {
    const store = useWorkspaceStore.getState();
    const first = queryTab("connection-1", "query-1");
    const second = queryTab("connection-1", "query-2");
    const third = queryTab("connection-1", "query-3");

    store.openTab(first);
    store.openTab(second);
    store.openTab(third);
    store.closeTab("connection-1", third.id);

    const workspace = useWorkspaceStore.getState().connections["connection-1"];
    expect(workspace?.tabs).toEqual([first, second]);
    expect(workspace?.activeTabId).toBe(second.id);

    store.closeTab("connection-1", first.id);
    expect(useWorkspaceStore.getState().connections["connection-1"]?.activeTabId).toBe(second.id);
  });
});
