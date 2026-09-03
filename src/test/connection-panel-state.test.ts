import { describe, expect, test } from "bun:test";

import type { ConnectionProfile } from "@/shared/types/models";

import {
  getConnectionSessionKey,
  isUnsupportedLegacyConnection,
  shouldLoadConnectionProfile,
  shouldResetConnectionSession,
} from "@/app/home/lib/connection-panel-state";

describe("connection panel session state", () => {
  test("resets when switching between new and edit identities", () => {
    expect(getConnectionSessionKey(true)).toBe("new");
    expect(getConnectionSessionKey(true, "profile-1")).toBe("profile-1");
    expect(shouldResetConnectionSession("profile-1", "new")).toBe(true);
    expect(shouldResetConnectionSession("new", "profile-1")).toBe(true);
  });

  test("requires a fresh session after the panel closes", () => {
    expect(getConnectionSessionKey(false, "profile-1")).toBeNull();
    expect(shouldResetConnectionSession(null, "profile-1")).toBe(true);
  });

  test("does not reload a profile when reopening the same edit session", () => {
    expect(shouldLoadConnectionProfile(null, "profile-1", "profile-1")).toBe(true);
    expect(shouldLoadConnectionProfile("profile-1", "profile-1", "profile-1")).toBe(false);
    expect(shouldLoadConnectionProfile("profile-1", "profile-2", "profile-2")).toBe(true);
    expect(shouldLoadConnectionProfile("profile-1", "new", undefined)).toBe(false);
  });

  test("identifies only non-SQLite connection-string profiles as unsupported legacy data", () => {
    const legacyProfile = {
      id: "legacy",
      name: "Legacy",
      db_type: "postgres",
      connect_mode: { type: "connection_string", value: "postgres://user:secret@host/db" },
      ssh_tunnel: null,
    } satisfies ConnectionProfile;
    const sqliteProfile = {
      ...legacyProfile,
      db_type: "sqlite",
      connect_mode: { type: "connection_string", value: "C:/data.sqlite" },
    } satisfies ConnectionProfile;

    expect(isUnsupportedLegacyConnection(legacyProfile)).toBe(true);
    expect(isUnsupportedLegacyConnection(sqliteProfile)).toBe(false);
  });
});
