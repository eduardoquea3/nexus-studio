import { describe, expect, test } from "bun:test";

import type { QueryTab } from "@/shared/types/connection-workspace";
import {
  filterCommandBarItems,
  moveSelection,
  nextTabIndex,
  type CommandBarItem,
} from "@/app/command-bar/command-bar-utils";

const queryTab = (id: string): QueryTab => ({
  id,
  type: "query",
  connectionId: "connection-1",
  database: "app",
  title: id,
  query: "",
  isDirty: false,
  queryResult: null,
  queryError: null,
  viewMode: "table",
});

const items: CommandBarItem[] = [
  {
    id: "connection:one",
    kind: "connection",
    label: "Production",
    detail: "postgres · db.example.test:5432",
    isActive: true,
    connection: {
      id: "connection-1",
      name: "Production",
      db_type: "postgres",
      connect_mode: { type: "connection_string", value: "postgres://example" },
      ssh_tunnel: null,
    },
  },
  {
    id: "table:users",
    kind: "table",
    label: "users",
    detail: "app · table",
    isActive: false,
    table: { name: "users", object_type: "table" },
  },
];

describe("command bar selection", () => {
  test("filters incrementally across labels, details, and item types", () => {
    expect(filterCommandBarItems(items, "prod").map((item) => item.id)).toEqual(["connection:one"]);
    expect(filterCommandBarItems(items, "table").map((item) => item.id)).toEqual(["table:users"]);
    expect(filterCommandBarItems(items, "")).toHaveLength(2);
  });

  test("wraps ArrowUp and ArrowDown selection", () => {
    expect(moveSelection(0, 3, -1)).toBe(2);
    expect(moveSelection(2, 3, 1)).toBe(0);
    expect(moveSelection(-1, 3, 1)).toBe(1);
    expect(moveSelection(0, 0, 1)).toBe(-1);
  });

  test("cycles Ctrl+Tab forward and Ctrl+Shift+Tab backward for one, two, and many tabs", () => {
    const one = [queryTab("one")];
    const two = [queryTab("one"), queryTab("two")];
    const many = [queryTab("one"), queryTab("two"), queryTab("three")];

    expect(nextTabIndex(one, "one", 1)).toBe(0);
    expect(nextTabIndex(two, "one", 1)).toBe(1);
    expect(nextTabIndex(two, "two", 1)).toBe(0);
    expect(nextTabIndex(many, "one", 1)).toBe(1);
    expect(nextTabIndex(many, "one", -1)).toBe(2);
  });

  test("does not expose tabs from another connection through the active tab list", () => {
    const tabs = [queryTab("active")];
    const otherConnectionTab = { ...queryTab("other"), connectionId: "connection-2" };

    expect(nextTabIndex(tabs, otherConnectionTab.id, 1)).toBe(0);
  });

});
