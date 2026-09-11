export type ImportedConnection =
  | {
      dbType: "postgresql" | "mysql";
      host: string;
      port: string;
      database: string;
      username: string;
      password: string;
    }
  | {
      dbType: "sqlite";
      sqlitePath: string;
    };

export type ConnectionStringParseResult =
  | { ok: true; value: ImportedConnection }
  | { ok: false; error: string };

type DecodedComponent = { ok: true; value: string } | { ok: false; error: string };

const networkSchemes = {
  "postgres:": { dbType: "postgresql", defaultPort: 5432 },
  "postgresql:": { dbType: "postgresql", defaultPort: 5432 },
  "mysql:": { dbType: "mysql", defaultPort: 3306 },
} as const;

export function parseConnectionString(input: string): ConnectionStringParseResult {
  const value = input.trim();
  if (!value) {
    return failure("Enter a connection string or SQLite file path.");
  }

  if (value.startsWith("file:")) {
    return parseSqliteFileUri(value);
  }

  if (/^(?:postgres|postgresql|mysql):(?!\/\/)/i.test(value)) {
    return failure("The connection string is not a valid URI.");
  }

  if (!value.includes("://")) {
    return parseSqlitePath(value);
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return failure("The connection string is not a valid URI.");
  }

  const scheme = networkSchemes[url.protocol as keyof typeof networkSchemes];
  if (!scheme) {
    return failure("Only PostgreSQL, MySQL, and local SQLite paths are supported.");
  }

  if (url.search || value.includes("?")) {
    return failure("Query parameters are not supported in imported connection strings.");
  }
  if (url.hash || value.includes("#")) {
    return failure("Fragments are not supported in imported connection strings.");
  }
  if (!url.hostname) {
    return failure("A database host is required.");
  }
  if (url.hostname.includes(",")) {
    return failure("Multiple database hosts are not supported.");
  }
  if (url.pathname === "/") {
    return failure("A database name is required.");
  }

  const encodedDatabase = url.pathname.slice(1);
  if (encodedDatabase.includes("/")) {
    return failure("The database name must be a single path segment.");
  }

  const host = decodeComponent(url.hostname.replace(/^\[|\]$/g, ""), "host");
  const username = decodeComponent(url.username, "username");
  const password = decodeComponent(url.password, "password");
  const database = decodeComponent(encodedDatabase, "database name");
  if (!host.ok) {
    return failure(host.error);
  }
  if (!username.ok) {
    return failure(username.error);
  }
  if (!password.ok) {
    return failure(password.error);
  }
  if (!database.ok) {
    return failure(database.error);
  }
  if (!database.value) {
    return failure("The database name must be a single path segment.");
  }

  const port = url.port ? Number(url.port) : scheme.defaultPort;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return failure("The database port must be between 1 and 65535.");
  }

  return {
    ok: true,
    value: {
      dbType: scheme.dbType,
      host: host.value,
      port: String(port),
      database: database.value,
      username: username.value,
      password: password.value,
    },
  };
}

export function createShareableConnectionString(profile: ConnectionProfile): string | undefined {
  if (profile.connect_mode.type !== "fields" || profile.db_type === "sqlite") {
    return undefined;
  }

  return createNetworkConnectionString(profile, false);
}

export function createConnectionString(profile: ConnectionProfile): string | undefined {
  if (profile.connect_mode.type === "connection_string") {
    return profile.connect_mode.value;
  }

  if (profile.db_type === "sqlite") {
    return profile.connect_mode.database;
  }

  return createNetworkConnectionString(profile, true);
}

export function redactConnectionString(value: string): string {
  try {
    const url = new URL(value);
    const sensitiveQueryKeys = /(?:pass(?:word|wd)?|pwd|user(?:name)?|token|secret|api[_-]?key|auth)/i;
    let hasSensitiveQuery = false;
    for (const key of url.searchParams.keys()) {
      if (sensitiveQueryKeys.test(key)) {
        hasSensitiveQuery = true;
        url.searchParams.set(key, "***");
      }
    }

    if (!url.username && !url.password && !hasSensitiveQuery) {
      return value;
    }

    const credentials = url.username || url.password
      ? `${url.username ? "***" : ""}${url.password ? ":***" : ""}@`
      : "";
    return `${url.protocol}//${credentials}${url.host}${url.pathname}${url.search}${url.hash}`;
  } catch {
    return value
      .replace(/^([a-z][a-z\d+.-]*:\/\/)[^/?#@]*@/i, "$1***:***@")
      .replace(
        /([?&](?:[^=]*?(?:pass(?:word|wd)?|pwd|user(?:name)?|token|secret|api[_-]?key|auth)[^=]*?)=)[^&#]*/gi,
        "$1***",
      );
  }
}

function createNetworkConnectionString(profile: ConnectionProfile, includeCredentials: boolean): string {
  if (profile.connect_mode.type !== "fields") {
    return "";
  }

  const scheme = profile.db_type === "postgres" ? "postgresql" : "mysql";
  const host = profile.connect_mode.host;
  const formattedHost = host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
  const username = includeCredentials ? profile.connect_mode.username : "";
  const password = includeCredentials ? profile.password : undefined;
  const credentials = username || password ? `${encodeURIComponent(username)}${password ? `:${encodeURIComponent(password)}` : ""}@` : "";

  return `${scheme}://${credentials}${formattedHost}:${profile.connect_mode.port}/${encodeURIComponent(profile.connect_mode.database)}`;
}

function parseSqliteFileUri(value: string): ConnectionStringParseResult {
  if (value === "file::memory:") {
    return failure("SQLite memory databases are not supported.");
  }
  if (!value.startsWith("file:/")) {
    return failure("Relative SQLite file URIs are not supported; use a path or an absolute file URI.");
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return failure("The SQLite file URI is not valid.");
  }

  if (url.search || value.includes("?")) {
    return failure("SQLite file URIs with query parameters are not supported.");
  }
  if (url.hash || value.includes("#")) {
    return failure("SQLite file URIs with fragments are not supported.");
  }
  if (url.hostname && url.hostname !== "localhost") {
    return failure("SQLite file URIs must not use a remote host.");
  }

  const path = decodeComponent(url.pathname, "SQLite file path");
  if (!path.ok) {
    return path;
  }

  const normalizedPath = normalizeFilePath(path.value);
  if (normalizedPath.startsWith("//")) {
    return failure("SQLite file URIs must not use a remote host.");
  }
  if (normalizedPath === ":memory:" || normalizedPath === "/:memory:") {
    return failure("SQLite memory databases are not supported.");
  }

  return parseSqlitePath(normalizedPath);
}

function parseSqlitePath(path: string): ConnectionStringParseResult {
  if (!path || path === ":memory:" || path === "file::memory:") {
    return failure("SQLite memory databases are not supported.");
  }
  if (path.includes("\0")) {
    return failure("The SQLite file path contains an invalid null character.");
  }

  return { ok: true, value: { dbType: "sqlite", sqlitePath: path } };
}

function normalizeFilePath(path: string): string {
  return /^\/[A-Za-z]:\//.test(path) ? path.slice(1) : path;
}

function decodeComponent(value: string, label: string): DecodedComponent {
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.includes("\0")) {
      return { ok: false, error: `The ${label} contains an invalid null character.` };
    }
    return { ok: true, value: decoded };
  } catch {
    return { ok: false, error: `The ${label} contains invalid percent encoding.` };
  }
}

function failure(error: string): ConnectionStringParseResult {
  return { ok: false, error };
}
import type { ConnectionProfile } from "@/shared/types/models";
