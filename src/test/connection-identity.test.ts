import { describe, expect, test } from "bun:test";

import type { ConnectionProfile } from "@/shared/types/models";
import {
  assertUniqueConnection,
  createConnectionId,
  DuplicateConnectionError,
  hasSameConnectionIdentity,
} from "@/shared/lib/connection-identity";

const profile: ConnectionProfile = {
  id: "existing-id",
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

describe("connection identity", () => {
  test("generates the same ID for the same target, independent of name", async () => {
    const renamedProfile = { ...profile, id: "different-id", name: "Renamed" };

    expect(await createConnectionId(profile)).toBe(await createConnectionId(renamedProfile));
    expect(hasSameConnectionIdentity(profile, renamedProfile)).toBe(true);
  });

  test("treats host casing as equivalent and distinguishes changed credentials", () => {
    const equivalentHost = {
      ...profile,
      connect_mode: { ...profile.connect_mode, host: "LOCALHOST" },
    };
    const changedPassword = { ...profile, password: "different-secret" };

    expect(hasSameConnectionIdentity(profile, equivalentHost)).toBe(true);
    expect(hasSameConnectionIdentity(profile, changedPassword)).toBe(false);
  });

  test("changes the generated ID when connection credentials change", async () => {
    const changedPassword = { ...profile, password: "different-secret" };

    expect(await createConnectionId(profile)).not.toBe(await createConnectionId(changedPassword));
  });

  test("rejects duplicate creates, including profiles with older IDs", () => {
    const duplicate = { ...profile, id: "new-id", name: "Another name" };

    expect(() => assertUniqueConnection([profile], duplicate, "create")).toThrow(
      DuplicateConnectionError,
    );
  });

  test("allows updating the existing profile but rejects another matching profile", () => {
    expect(() => assertUniqueConnection([profile], profile, "update")).not.toThrow();
    expect(() =>
      assertUniqueConnection(
        [profile, { ...profile, id: "other-id", password: "other" }],
        profile,
        "update",
      ),
    ).not.toThrow();
    expect(() =>
      assertUniqueConnection(
        [profile, { ...profile, id: "other-id" }],
        { ...profile, id: "edited-id" },
        "update",
      ),
    ).toThrow(DuplicateConnectionError);
  });
});
