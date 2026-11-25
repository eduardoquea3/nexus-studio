import { describe, expect, mock, test } from "bun:test";

const invoke = mock(async (_command: string, _args: unknown) => ({ columns: [], indexes: [] }));
mock.module("@tauri-apps/api/core", () => ({ invoke, isTauri: () => false }));
mock.module("@tauri-apps/plugin-store", () => ({ load: async () => undefined }));

const { getSidebarTableMetadata, getTableSchema } = await import("@/shared/lib/tauriApi");
const profile = {
  id: "connection-1",
  name: "Test connection",
  db_type: "postgres" as const,
  connect_mode: {
    type: "fields" as const,
    host: "localhost",
    port: 5432,
    database: "master",
    username: "postgres",
    password_ref: null,
  },
  ssh_tunnel: null,
};

describe("getSidebarTableMetadata", () => {
  test("invokes one metadata command with the selected database, table, and schema", async () => {
    invoke.mockClear();
    const metadata = { columns: [], foreignKeys: [], indexes: [] };
    invoke.mockResolvedValueOnce(metadata);

    await expect(getSidebarTableMetadata(profile, "company", "public", "analytics")).resolves.toBe(
      metadata,
    );

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith("get_sidebar_table_metadata", {
      request: {
        request: {
          dbType: "postgres",
          host: "localhost",
          port: 5432,
          database: "analytics",
          username: "postgres",
          password: undefined,
          ssh: undefined,
          connectionId: "connection-1",
          persistSshTunnel: true,
        },
        table: "company",
        schema: "public",
      },
    });
  });
});

describe("getTableSchema", () => {
  test("passes the selected database with the table and schema", async () => {
    invoke.mockClear();

    await getTableSchema(profile, "company", "public", "analytics");

    expect(invoke).toHaveBeenCalledWith("get_table_schema", {
      request: {
        request: {
          dbType: "postgres",
          host: "localhost",
          port: 5432,
          database: "analytics",
          username: "postgres",
          password: undefined,
          ssh: undefined,
          connectionId: "connection-1",
          persistSshTunnel: true,
        },
        table: "company",
        schema: "public",
      },
    });
  });
});
