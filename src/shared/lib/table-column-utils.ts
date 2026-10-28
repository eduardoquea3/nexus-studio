import type { ColumnInfo } from "@/shared/types/models";

export function isRequiredTimestampColumn(column?: Pick<ColumnInfo, "data_type" | "nullable">) {
  return Boolean(
    column && !column.nullable && /^(?:timestamp|datetime)\b/i.test(column.data_type.trim()),
  );
}
