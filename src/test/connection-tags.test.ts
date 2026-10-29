import { describe, expect, test } from "bun:test";

import type { ConnectionProfile } from "@/shared/types/models";

import {
  CONNECTION_TAG_COLORS,
  addConnectionTag,
  getAvailableConnectionTags,
  getConnectionTagColor,
  matchesConnectionTag,
  sortConnectionsByRecent,
} from "@/app/home/lib/connection-tags";

const profile = (id: string, tags: string[], lastOpenedAt?: number): ConnectionProfile => ({
  id,
  name: id,
  db_type: "postgres",
  connect_mode: {
    type: "fields",
    host: "localhost",
    port: 5432,
    database: "test",
    username: "postgres",
    password_ref: null,
  },
  ssh_tunnel: null,
  tags,
  last_opened_at: lastOpenedAt,
});

describe("connection tags", () => {
  test("offers exactly nine fixed colors", () => {
    const colors = CONNECTION_TAG_COLORS.map((color) => color.value);
    expect(colors).toHaveLength(9);
    expect(new Set(colors).size).toBe(9);
    expect(
      colors.every(
        (color) =>
          color.startsWith("chart-") ||
          ["primary", "secondary", "accent", "destructive"].includes(color),
      ),
    ).toBe(true);
  });

  test("uses a valid theme token and safely falls back for an older hex color", () => {
    expect(getConnectionTagColor("chart-3")).toBe("chart-3");
    expect(getConnectionTagColor("#64748b")).toBe("primary");
  });

  test("adds non-empty unique tags without changing existing labels", () => {
    expect(addConnectionTag(["Production"], "  production ")).toEqual(["Production"]);
    expect(addConnectionTag(["Production"], " Staging ")).toEqual(["Production", "Staging"]);
    expect(addConnectionTag([], "   ")).toEqual([]);
  });

  test("collects unique available tags and filters connections case-insensitively", () => {
    const profiles = [
      profile("one", ["Production", "Shared"]),
      profile("two", ["shared", "Local"]),
    ];
    expect(getAvailableConnectionTags(profiles)).toEqual(["Production", "Shared", "Local"]);
    expect(
      profiles.filter((item) => matchesConnectionTag(item, "SHARED")).map((item) => item.id),
    ).toEqual(["one", "two"]);
  });

  test("sorts most recently opened first with deterministic name and id tie-breakers", () => {
    const profiles = [
      profile("Zulu", [], 10),
      profile("Beta", [], 10),
      profile("Alpha", [], 20),
      profile("Missing", []),
    ];
    expect(sortConnectionsByRecent(profiles).map((item) => item.id)).toEqual([
      "Alpha",
      "Beta",
      "Zulu",
      "Missing",
    ]);
  });
});
