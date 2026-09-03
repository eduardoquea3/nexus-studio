import { describe, expect, test } from "bun:test";
import {
  createConnectionString,
  createShareableConnectionString,
  parseConnectionString,
  redactConnectionString,
} from "@/app/home/lib/connection-string-parser";
import type { ConnectionProfile } from "@/shared/types/models";

describe("connection string parser", () => {
  test("imports PostgreSQL credentials and decodes percent encoding", () => {
    expect(parseConnectionString("postgresql://user%40name:p%40ss@db.example.com/app%2Ddata")).toEqual({
      ok: true,
      value: {
        dbType: "postgresql",
        host: "db.example.com",
        port: "5432",
        database: "app-data",
        username: "user@name",
        password: "p@ss",
      },
    });
  });

  test("imports MySQL with its default port", () => {
    expect(parseConnectionString("mysql://root:secret@localhost/inventory")).toEqual({
      ok: true,
      value: {
        dbType: "mysql",
        host: "localhost",
        port: "3306",
        database: "inventory",
        username: "root",
        password: "secret",
      },
    });
  });

  test("round-trips percent-encoded database path separators in shareable URIs", () => {
    const profile = {
      id: "profile-1",
      name: "Production",
      db_type: "postgres",
      password: "do-not-expose",
      connect_mode: {
        type: "fields",
        host: "2001:db8::1",
        port: 5432,
        database: "app/data",
        username: "admin",
        password_ref: null,
      },
      ssh_tunnel: null,
    } satisfies ConnectionProfile;
    const uri = createShareableConnectionString(profile);

    expect(uri).toBe("postgresql://[2001:db8::1]:5432/app%2Fdata");
    expect(uri).not.toContain("admin");
    expect(uri).not.toContain("do-not-expose");
    expect(parseConnectionString(uri!)).toEqual({
      ok: true,
      value: {
        dbType: "postgresql",
        host: "2001:db8::1",
        port: "5432",
        database: "app/data",
        username: "",
        password: "",
      },
    });
  });

  test("creates a credential-bearing URI only for copying and redacts it for display", () => {
    const profile = {
      id: "profile-1",
      name: "Production",
      db_type: "postgres",
      password: "p@ss",
      connect_mode: {
        type: "fields",
        host: "db.example.com",
        port: 5432,
        database: "app",
        username: "admin@example.com",
        password_ref: null,
      },
      ssh_tunnel: null,
    } satisfies ConnectionProfile;
    const fullUri = createConnectionString(profile);

    expect(fullUri).toBe("postgresql://admin%40example.com:p%40ss@db.example.com:5432/app");
    expect(redactConnectionString(fullUri!)).toBe("postgresql://***:***@db.example.com:5432/app");
    expect(redactConnectionString(fullUri!)).not.toContain("admin");
    expect(redactConnectionString(fullUri!)).not.toContain("p@ss");
  });

  test("imports local SQLite paths and normalizes Windows file URIs", () => {
    expect(parseConnectionString("C:\\data\\app.sqlite")).toEqual({
      ok: true,
      value: { dbType: "sqlite", sqlitePath: "C:\\data\\app.sqlite" },
    });
    expect(parseConnectionString("file:///C:/data/app.sqlite")).toEqual({
      ok: true,
      value: { dbType: "sqlite", sqlitePath: "C:/data/app.sqlite" },
    });
  });

  test("rejects URI features the backend cannot honor", () => {
    expect(parseConnectionString("postgres://host/database?sslmode=require")).toEqual({
      ok: false,
      error: "Query parameters are not supported in imported connection strings.",
    });
    expect(parseConnectionString("mysql://host1,host2/database")).toEqual({
      ok: false,
      error: "Multiple database hosts are not supported.",
    });
    expect(parseConnectionString("postgres://host:0/database")).toEqual({
      ok: false,
      error: "The database port must be between 1 and 65535.",
    });
  });

  test("rejects unsupported SQLite URI modes", () => {
    expect(parseConnectionString("file::memory:")).toEqual({
      ok: false,
      error: "SQLite memory databases are not supported.",
    });
    expect(parseConnectionString("file:///:memory:")).toEqual({
      ok: false,
      error: "SQLite memory databases are not supported.",
    });
    expect(parseConnectionString("file://server/data.sqlite")).toEqual({
      ok: false,
      error: "SQLite file URIs must not use a remote host.",
    });
    expect(parseConnectionString("file:////server/data.sqlite")).toEqual({
      ok: false,
      error: "SQLite file URIs must not use a remote host.",
    });
    expect(parseConnectionString("file:///data.sqlite?mode=memory")).toEqual({
      ok: false,
      error: "SQLite file URIs with query parameters are not supported.",
    });
  });

  test("does not treat malformed network URIs as SQLite paths", () => {
    expect(parseConnectionString("postgresql:not-a-uri")).toEqual({
      ok: false,
      error: "The connection string is not a valid URI.",
    });
  });

  test("redacts credentials from invalid URIs and query parameters", () => {
    expect(redactConnectionString("postgresql://admin:secret@host/db?password=other")).toBe(
      "postgresql://***:***@host/db?password=***",
    );
    expect(redactConnectionString("postgresql://admin:secret@host")).toBe(
      "postgresql://***:***@host",
    );
    expect(redactConnectionString("postgresql://host/db?sslmode=require&api_key=secret")).toBe(
      "postgresql://host/db?sslmode=require&api_key=***",
    );
  });

  test("rejects relative SQLite file URIs instead of making them root-relative", () => {
    expect(parseConnectionString("file:relative.sqlite")).toEqual({
      ok: false,
      error: "Relative SQLite file URIs are not supported; use a path or an absolute file URI.",
    });
  });
});
