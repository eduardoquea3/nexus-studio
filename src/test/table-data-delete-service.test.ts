import "./setup";
import { beforeEach, describe, expect, mock, test } from "bun:test";

import type { ConnectionProfile } from "@/shared/types/models";

const deleteRecords = mock(async () => 2);
mock.module("@/shared/lib/tauriApi", () => ({ deleteRecords }));

const { deleteTableRows } = await import("@/app/connection/services/table-data-delete-service");

const profile = {
  id: "connection-1",
  name: "Test connection",
  db_type: "postgres",
  connect_mode: {
    type: "fields",
    host: "localhost",
    port: 5432,
    database: "app",
    username: "postgres",
    password_ref: null,
  },
  ssh_tunnel: null,
} satisfies ConnectionProfile;

beforeEach(() => {
  deleteRecords.mockReset();
  deleteRecords.mockImplementation(async () => 2);
});

describe("deleteTableRows", () => {
  test("forwards the batch of primary-key identities to the backend command", async () => {
    const pkMaps = [
      { tenant_id: 1, user_id: "first" },
      { tenant_id: 2, user_id: "second" },
    ];

    await expect(deleteTableRows(profile, "users", "public", pkMaps)).resolves.toBe(2);
    expect(deleteRecords).toHaveBeenCalledWith(profile, "users", "public", pkMaps);
  });

  test("keeps the schema optional", async () => {
    const pkMaps = [{ id: 7 }];

    await deleteTableRows(profile, "events", undefined, pkMaps);

    expect(deleteRecords).toHaveBeenCalledWith(profile, "events", undefined, pkMaps);
  });

  test("propagates backend failures so the UI can keep pending rows", async () => {
    deleteRecords.mockImplementation(async () => {
      throw new Error("Some selected rows no longer match the table.");
    });

    await expect(deleteTableRows(profile, "users", undefined, [{ id: 1 }])).rejects.toThrow(
      "Some selected rows no longer match the table.",
    );
  });
});
