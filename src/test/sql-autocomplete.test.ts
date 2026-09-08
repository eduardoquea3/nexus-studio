import "./setup";
import { CompletionContext } from "@codemirror/autocomplete";
import { sql } from "@codemirror/lang-sql";
import { EditorState } from "@codemirror/state";
import { describe, expect, mock, test } from "bun:test";

import type { ColumnInfo } from "@/shared/types/models";

import {
  createSqlColumnCompletionSource,
  createSqlTableCompletions,
  getSqlCompletionContext,
} from "@/shared/lib/sql-autocomplete";

const tables = [
  { name: "accounts", schema: "public" },
  { name: "audit_log", schema: "public" },
] as const;
const tableQueries = [
  ["select * from ac", "tables"],
  ["update ac", "tables"],
  ["delete from ac", "tables"],
] as const;

describe("SQL autocomplete", () => {
  test.each(tableQueries)("suggests tables after %s", (query) => {
    expect(getSqlCompletionContext(query, query.length)).toEqual({ target: "tables" });
  });

  test("resolves columns for the selected table and alias in a SELECT", async () => {
    const loadColumns = mock(async (): Promise<ColumnInfo[]> => [
      {
        name: "id",
        data_type: "integer",
        enum_values: [],
        nullable: false,
        default: null,
        is_pk: true,
        is_fk: false,
        is_unique: true,
      },
      {
        name: "email",
        data_type: "text",
        enum_values: [],
        nullable: false,
        default: null,
        is_pk: false,
        is_fk: false,
        is_unique: true,
      },
      {
        name: "dbName",
        data_type: "character varying",
        enum_values: [],
        nullable: true,
        default: null,
        is_pk: false,
        is_fk: false,
        is_unique: false,
      },
    ]);
    const source = createSqlColumnCompletionSource(tables, loadColumns);
    const query = "select a. from accounts a";
    const state = EditorState.create({ doc: query, extensions: [sql()] });

    const result = await source(new CompletionContext(state, "select a.".length, false));

    expect(result?.options.map((option) => option.label)).toEqual(["id", "email", "dbName"]);
    if (!result) {
      throw new Error("Expected column completions");
    }
    const completion = result.options[2];
    expect(completion?.apply).toBeTypeOf("function");
    const dispatch = mock(() => undefined);
    const apply = completion?.apply;
    if (typeof apply !== "function") {
      throw new Error("Expected a completion apply function");
    }
    apply({ dispatch } as never, completion, 7, 13);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        changes: { from: 7, to: 13, insert: '"dbName"' },
      }),
    );
    expect(loadColumns).toHaveBeenCalledTimes(1);
    expect(loadColumns).toHaveBeenCalledWith({ name: "accounts", schema: "public" });
  });

  test("resolves columns while the cursor is before the FROM clause", () => {
    expect(getSqlCompletionContext("select a. from accounts a", "select a.".length)).toEqual({
      target: "columns",
      tableNames: ["accounts"],
      alias: "a",
    });
  });

  test("does not offer columns for UPDATE and DELETE statements", () => {
    expect(getSqlCompletionContext("update accounts set ", 21)).toBeNull();
    expect(getSqlCompletionContext("delete from accounts where ", 27)).toBeNull();
  });

  test("builds table completions with schema details", () => {
    expect(createSqlTableCompletions(tables)).toEqual([
      { label: "accounts", type: "table", detail: "public · table" },
      { label: "audit_log", type: "table", detail: "public · table" },
    ]);
  });
});
