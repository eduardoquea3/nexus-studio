import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type TableOptions,
  type Table,
} from "@tanstack/react-table";

type UseDataTableOptions<TData> = {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
} & Omit<TableOptions<TData>, "columns" | "data" | "getCoreRowModel">;

export function useDataTable<TData>({
  columns,
  data,
  ...tableOptions
}: UseDataTableOptions<TData>): Table<TData> {
  return useReactTable({
    ...tableOptions,
    columns,
    data,
    getCoreRowModel: getCoreRowModel(),
  });
}
