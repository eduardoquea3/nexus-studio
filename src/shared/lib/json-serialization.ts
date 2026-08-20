import type { JsonIssue, JsonPayload } from "@/shared/types/models";

type JsonScope = {
  page: number;
  pageSize: number;
};

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

const MAX_SAFE_RENDER_ROWS = 10_000;

export function serializeJson(columns: string[], rows: Record<string, unknown>[], scope?: JsonScope): JsonPayload {
  const issues: JsonIssue[] = [];
  const projectedRows = rows.map((row, rowIndex) => {
    const projected: Record<string, JsonValue> = {};
    for (const column of columns) {
      projected[column] = serializeValue(row[column], `$[${rowIndex}].${JSON.stringify(column).slice(1, -1)}`, issues, new WeakSet());
    }
    return projected;
  });

  return {
    text: JSON.stringify(projectedRows, null, 2),
    issues,
    rowCount: rows.length,
    ...(scope ? { scope: { ...scope, loadedCount: rows.length } } : {}),
  };
}

export function exceedsJsonRenderThreshold(rowCount: number): boolean {
  return rowCount > MAX_SAFE_RENDER_ROWS;
}

function serializeValue(value: unknown, path: string, issues: JsonIssue[], ancestors: WeakSet<object>): JsonValue {
  if (value === null) return null;
  if (value === undefined) {
    issues.push({ path, message: "Unsupported value was represented as null.", representation: "null" });
    return null;
  }
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (Number.isFinite(value)) return value;
    issues.push({ path, message: "Non-finite number was represented as text.", representation: "string" });
    return `[non-finite: ${String(value)}]`;
  }
  if (typeof value === "bigint") {
    issues.push({ path, message: "BigInt was represented as text.", representation: "string" });
    return `${value.toString()}n`;
  }
  if (typeof value === "function" || typeof value === "symbol") {
    issues.push({ path, message: "Unsupported value was represented as null.", representation: "null" });
    return null;
  }
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? serializeValue(Number.NaN, path, issues, ancestors) : value.toISOString();
  if (value instanceof Uint8Array) {
    issues.push({ path, message: "Bytes were encoded as base64.", representation: "string" });
    return `base64:${bytesToBase64(value)}`;
  }
  if (ancestors.has(value)) {
    issues.push({ path, message: "Circular value was represented as null.", representation: "null" });
    return null;
  }

  ancestors.add(value);
  try {
    if (Array.isArray(value)) return value.map((item, index) => serializeValue(item, `${path}[${index}]`, issues, ancestors));
    const object = value as Record<string, unknown>;
    const serializedObject: Record<string, JsonValue> = {};
    for (const key of Object.keys(value)) {
      serializedObject[key] = serializeValue(object[key], `${path}.${key}`, issues, ancestors);
    }
    return serializedObject;
  } finally {
    ancestors.delete(value);
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
