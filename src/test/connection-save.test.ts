import { beforeEach, describe, expect, mock, test } from "bun:test";

import type { ConnectionProfile } from "@/shared/types/models";

let savedProfiles: ConnectionProfile[] = [];

const store = {
  get: async <T>() => structuredClone(savedProfiles) as T,
  set: async (_key: string, profiles: ConnectionProfile[]) => {
    await new Promise((resolve) => setTimeout(resolve, 5));
    savedProfiles = structuredClone(profiles);
  },
  save: async () => undefined,
};

mock.module("@tauri-apps/plugin-store", () => ({
  load: async () => store,
}));

mock.module("@tauri-apps/api/core", () => ({
  invoke: async () => undefined,
  isTauri: () => false,
}));

const { saveConnection } = await import("@/shared/lib/tauriApi");

const profile: ConnectionProfile = {
  id: "connection-1",
  name: "Primary database",
  db_type: "postgres",
  password: "secret",
  connect_mode: {
    type: "fields",
    host: "localhost",
    port: 5432,
    database: "master",
    username: "postgres",
    password_ref: null,
  },
  ssh_tunnel: null,
};

describe("saveConnection", () => {
  beforeEach(() => {
    savedProfiles = [];
  });

  test("serializes simultaneous create attempts and rejects the duplicate", async () => {
    const results = await Promise.allSettled([
      saveConnection(profile, "create"),
      saveConnection({ ...profile, id: "connection-2" }, "create"),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(savedProfiles).toHaveLength(1);
  });

  test("persists optional connection tags and color", async () => {
    const taggedProfile: ConnectionProfile = {
      ...profile,
      id: "connection-tagged",
      name: "Tagged database",
      tags: ["Production", "Finance"],
      tag_color: "chart-2",
      connect_mode: {
        type: "fields",
        host: "localhost",
        port: 5432,
        database: "finance",
        username: "postgres",
        password_ref: null,
      },
    };

    await saveConnection(taggedProfile, "create");

    expect(savedProfiles).toContainEqual(taggedProfile);
  });
});
