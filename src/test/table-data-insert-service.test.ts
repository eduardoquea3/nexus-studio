import "./setup";
import { describe, expect, test } from "bun:test";

import { buildInsertRowQuery } from "@/app/connection/services/table-data-insert-service";

describe("buildInsertRowQuery", () => {
  test("quotes identifiers and stores blank fields as NULL", () => {
    expect(
      buildInsertRowQuery({
        dbType: "postgres",
        table: 'user"records',
        schema: "public",
        values: { "display'name": "O'Reilly", empty: "", age: "42" },
      }),
    ).toBe(
      'INSERT INTO "public"."user""records" ("display\'name", "empty", "age") VALUES (E\'O\'\'Reilly\', NULL, E\'42\')',
    );
  });

  test("escapes PostgreSQL backslashes before apostrophes", () => {
    expect(
      buildInsertRowQuery({
        dbType: "postgres",
        table: "users",
        values: { name: "\\' OR 1=1 --" },
      }),
    ).toBe("INSERT INTO \"users\" (\"name\") VALUES (E'\\\\'' OR 1=1 --')");
  });

  test("uses MySQL identifier quoting and hex-encodes text literals", () => {
    expect(
      buildInsertRowQuery({
        dbType: "mysql",
        table: "users`archive",
        values: { name: "A\\B'c", empty: "" },
      }),
    ).toBe(
      "INSERT INTO `users``archive` (`name`, `empty`) VALUES (CONVERT(X'415c422763' USING utf8mb4), NULL)",
    );
  });

  test("quotes SQLite identifiers and text values", () => {
    expect(
      buildInsertRowQuery({
        dbType: "sqlite",
        table: "select",
        values: { name: "first\nsecond", optional: "" },
      }),
    ).toBe('INSERT INTO "select" ("name", "optional") VALUES (\'first\nsecond\', NULL)');
  });

  test("uses the current timestamp for required timestamp columns and NULL for optional ones", () => {
    expect(
      buildInsertRowQuery({
        dbType: "postgres",
        table: "events",
        schemaColumns: [
          { name: "created_at", data_type: "timestamp with time zone", nullable: false },
          { name: "optional_at", data_type: "timestamp without time zone", nullable: true },
        ],
        values: { created_at: "", optional_at: "" },
      }),
    ).toBe('INSERT INTO "events" ("created_at", "optional_at") VALUES (CURRENT_TIMESTAMP, NULL)');
  });

  test("recognizes required timestamp types for MySQL and SQLite", () => {
    for (const [dbType, dataType] of [
      ["mysql", "timestamp"],
      ["sqlite", "DATETIME"],
    ] as const) {
      expect(
        buildInsertRowQuery({
          dbType,
          table: "events",
          schemaColumns: [{ name: "created_at", data_type: dataType, nullable: false }],
          values: { created_at: "" },
        }),
      ).toContain("VALUES (CURRENT_TIMESTAMP)");
    }
  });

  test("rejects NUL characters before constructing SQL", () => {
    expect(() =>
      buildInsertRowQuery({
        dbType: "postgres",
        table: "users",
        values: { name: "bad\0value" },
      }),
    ).toThrow("NUL characters are not supported in table values.");
  });
});
