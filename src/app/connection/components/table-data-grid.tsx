import type { ColumnDef } from "@tanstack/react-table";
import { memo, useMemo, type ComponentProps } from "react";

import type { DataPage } from "@/shared/types/models";
import { DataTable } from "@/shared/components/data-table";
import { useDataTable } from "@/shared/hooks/use-data-table";

type TableDataGridProps = Omit<
  ComponentProps<typeof DataTable<Record<string, unknown>>>,
  "table"
> & { data?: DataPage };

const EMPTY_ROWS: Record<string, unknown>[] = [];

export const TableDataGrid = memo(function TableDataGrid({
  data,
  draftColumns,
  withShell = false,
  ...props
}: TableDataGridProps) {
  const columns = useMemo<ColumnDef<Record<string, unknown>, unknown>[]>(() => {
    const names = data?.columns.length
      ? data.columns
      : (draftColumns ?? []).map((column) => column.name);
    return names.map((column) => ({
      accessorKey: column,
      header: column,
      cell: (context) => formatCell(context.getValue()),
    }));
  }, [data?.columns, draftColumns]);
  const table = useDataTable({ columns, data: data?.rows ?? EMPTY_ROWS });
  return <DataTable table={table} draftColumns={draftColumns} withShell={withShell} {...props} />;
});

function formatCell(value: unknown) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
