import type { DbType } from "@/shared/types/models";

export function quoteSqlIdentifier(dbType: DbType, identifier: string) {
  const quote = dbType === "mysql" ? "`" : '"';
  return `${quote}${identifier.split(quote).join(quote + quote)}${quote}`;
}

export function serializeSqlLiteral(dbType: DbType, value: unknown) {
  if (value === null || value === undefined) return "NULL";

  const text = String(value);
  if (text.includes("\0")) {
    throw new Error("NUL characters are not supported in table values.");
  }

  if (dbType === "mysql") {
    const hex = Array.from(new TextEncoder().encode(text), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    return `CONVERT(X'${hex}' USING utf8mb4)`;
  }

  if (dbType === "postgres") {
    const escaped = text.split("\\").join("\\\\").split("'").join("''");
    return `E'${escaped}'`;
  }

  return `'${text.split("'").join("''")}'`;
}
