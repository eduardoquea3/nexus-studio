import type { EditorView } from "@codemirror/view";

import {
  pickedCompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from "@codemirror/autocomplete";

import type { ColumnInfo, ObjectMeta } from "@/shared/types/models";

type SqlTable = Pick<ObjectMeta, "name" | "schema">;
type TableColumnLoader = (table: SqlTable) => Promise<ColumnInfo[]>;

export type SqlCompletionContext =
  | { target: "tables" }
  | { target: "columns"; tableNames: string[]; alias?: string };

const SQL_CLAUSE_KEYWORDS = new Set([
  "from",
  "group",
  "having",
  "join",
  "limit",
  "offset",
  "on",
  "order",
  "select",
  "set",
  "union",
  "where",
]);

const IDENTIFIER = String.raw`(?:[A-Za-z_$][\w$]*|"[^"]+"|` + "`[^`]+`" + String.raw`|\[[^\]]+\])`;
const QUALIFIED_IDENTIFIER = String.raw`${IDENTIFIER}(?:\s*\.\s*${IDENTIFIER})?`;

export function getSqlCompletionContext(
  query: string,
  position: number,
): SqlCompletionContext | null {
  const maskedQuery = maskSql(query);
  if (maskedQuery[position - 1] === "\0") {
    return null;
  }

  const statementStart = maskedQuery.lastIndexOf(";", Math.max(0, position - 1)) + 1;
  const statementEnd = maskedQuery.indexOf(";", position);
  const statement = maskedQuery.slice(
    statementStart,
    statementEnd === -1 ? maskedQuery.length : statementEnd,
  );
  const prefix = maskedQuery.slice(statementStart, position);
  const originalPrefix = query.slice(statementStart, position);
  const word = originalPrefix.match(/[A-Za-z_$][\w$]*$/)?.[0] ?? "";
  const tableRefs = findTableReferences(statement);
  const tableTrigger = new RegExp(
    String.raw`\b(?:from|join|update|delete\s+from)\s+(${QUALIFIED_IDENTIFIER})?\s*$`,
    "i",
  ).exec(prefix);

  if (tableTrigger && (word.length > 0 || tableRefs.length === 0)) {
    return { target: "tables" };
  }

  if (!/^\s*select\b/i.test(statement) || tableRefs.length === 0) {
    return null;
  }

  if (SQL_CLAUSE_KEYWORDS.has(word.toLowerCase())) {
    const beforeWord = prefix.slice(0, prefix.length - word.length).trimEnd();
    if (!/(?:select|from|where|having|order\s+by|group\s+by|join|on|,)\s*$/i.test(beforeWord)) {
      return null;
    }
  }

  const alias = originalPrefix.match(/([A-Za-z_$][\w$]*)\.\s*[A-Za-z_$]*$/)?.[1];
  const selectedRefs = alias
    ? tableRefs.filter((reference) => reference.alias?.toLowerCase() === alias.toLowerCase())
    : tableRefs;

  return {
    target: "columns",
    tableNames: selectedRefs.map((reference) => reference.name),
    ...(alias ? { alias } : {}),
  };
}

export function createSqlTableCompletions(tables: readonly SqlTable[]): Completion[] {
  return tables.map((table) => ({
    label: table.name,
    type: "table",
    detail: table.schema ? `${table.schema} · table` : "table",
  }));
}

export function createSqlColumnCompletionSource(
  tables: readonly SqlTable[],
  loadColumns: TableColumnLoader,
  identifierQuote: '"' | "`" = '"',
): (context: CompletionContext) => Promise<CompletionResult | null> {
  const columnsCache = new Map<string, Promise<ColumnInfo[]>>();

  return async (context) => {
    const word = context.matchBefore(/[A-Za-z_$][\w$]*$/);
    const isAfterDot = context.state.sliceDoc(Math.max(0, context.pos - 1), context.pos) === ".";
    if (!word && !context.explicit && !isAfterDot) {
      return null;
    }

    const completionContext = getSqlCompletionContext(context.state.doc.toString(), context.pos);
    if (completionContext?.target !== "columns") {
      return null;
    }

    const selectedTables = completionContext.tableNames
      .map((name) => resolveTable(name, tables))
      .filter((table): table is SqlTable => table !== undefined);
    const columnLists = await Promise.all(
      selectedTables.map((table) => {
        const key = `${table.schema ?? ""}:${table.name}`;
        let columns = columnsCache.get(key);
        if (!columns) {
          columns = loadColumns(table).catch(() => []);
          columnsCache.set(key, columns);
        }
        return columns;
      }),
    );

    if (context.aborted) {
      return null;
    }

    const seenColumns = new Set<string>();
    const options = columnLists.flatMap((columns) =>
      columns.flatMap((column) => {
        const key = column.name.toLowerCase();
        if (seenColumns.has(key)) {
          return [];
        }
        seenColumns.add(key);
        return [
          {
            label: column.name,
            type: "field",
            detail: column.data_type,
            ...(needsIdentifierQuoting(column.name)
              ? { apply: createQuotedIdentifierApply(column.name, identifierQuote) }
              : {}),
          } satisfies Completion,
        ];
      }),
    );

    return {
      from: word?.from ?? context.pos,
      options,
      validFor: /^[A-Za-z_$][\w$]*$/,
    };
  };
}

function needsIdentifierQuoting(identifier: string): boolean {
  return !/^[a-z_][a-z0-9_]*$/.test(identifier);
}

function quoteIdentifier(identifier: string, quote: '"' | "`"): string {
  return `${quote}${identifier.split(quote).join(`${quote}${quote}`)}${quote}`;
}

function createQuotedIdentifierApply(identifier: string, quote: '"' | "`"): Completion["apply"] {
  const insert = quoteIdentifier(identifier, quote);
  return (view: EditorView, completion: Completion, from: number, to: number) => {
    view.dispatch({
      changes: { from, to, insert },
      annotations: pickedCompletion.of(completion),
    });
  };
}

type TableReference = {
  name: string;
  alias?: string;
};

function findTableReferences(statement: string): TableReference[] {
  const references: TableReference[] = [];
  const tablePattern = new RegExp(
    String.raw`\b(?:from|join)\s+(${QUALIFIED_IDENTIFIER})(?:\s+(?:as\s+)?(${IDENTIFIER}))?`,
    "gi",
  );

  for (const match of statement.matchAll(tablePattern)) {
    references.push({
      name: normalizeIdentifier(match[1]),
      ...getAlias(match[2]),
    });
  }

  const updateMatch = new RegExp(
    String.raw`\bupdate\s+(${QUALIFIED_IDENTIFIER})(?:\s+(?:as\s+)?(${IDENTIFIER}))?`,
    "i",
  ).exec(statement);
  if (updateMatch) {
    references.push({ name: normalizeIdentifier(updateMatch[1]), ...getAlias(updateMatch[2]) });
  }

  const deleteMatch = new RegExp(
    String.raw`\bdelete\s+from\s+(${QUALIFIED_IDENTIFIER})(?:\s+(?:as\s+)?(${IDENTIFIER}))?`,
    "i",
  ).exec(statement);
  if (deleteMatch) {
    references.push({ name: normalizeIdentifier(deleteMatch[1]), ...getAlias(deleteMatch[2]) });
  }

  return references;
}

function getAlias(value: string | undefined): { alias?: string } {
  if (!value || SQL_CLAUSE_KEYWORDS.has(normalizeIdentifier(value).toLowerCase())) {
    return {};
  }
  return { alias: normalizeIdentifier(value) };
}

function resolveTable(name: string, tables: readonly SqlTable[]): SqlTable | undefined {
  const parts = name.split(".");
  const tableName = parts[parts.length - 1] ?? name;
  const schema = parts.length > 1 ? parts[parts.length - 2] : undefined;
  return tables.find(
    (table) =>
      table.name.toLowerCase() === tableName.toLowerCase() &&
      (schema === undefined || table.schema?.toLowerCase() === schema.toLowerCase()),
  );
}

function normalizeIdentifier(identifier: string): string {
  return identifier
    .trim()
    .split(".")
    .map((part) => part.trim().replace(/^(?:"|`|\[)|(?:"|`|\])$/g, ""))
    .join(".");
}

function maskSql(query: string): string {
  let result = "";
  let quote: "'" | null = null;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < query.length; index += 1) {
    const character = query[index];
    const nextCharacter = query[index + 1];

    if (lineComment) {
      result += character === "\n" ? "\n" : "\0";
      if (character === "\n") {
        lineComment = false;
      }
      continue;
    }
    if (blockComment) {
      result += character === "\n" ? "\n" : "\0";
      if (character === "*" && nextCharacter === "/") {
        result += "\0";
        index += 1;
        blockComment = false;
      }
      continue;
    }
    if (quote) {
      result += "\0";
      if (character === quote) {
        if (nextCharacter === quote) {
          result += "\0";
          index += 1;
        } else {
          quote = null;
        }
      }
      continue;
    }
    if (character === "-" && nextCharacter === "-") {
      result += "\0\0";
      index += 1;
      lineComment = true;
      continue;
    }
    if (character === "/" && nextCharacter === "*") {
      result += "\0\0";
      index += 1;
      blockComment = true;
      continue;
    }
    if (character === "'") {
      result += "\0";
      quote = character;
      continue;
    }
    result += character;
  }

  return result;
}
