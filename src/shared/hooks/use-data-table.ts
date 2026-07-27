import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type Table,
} from "@tanstack/react-table";

type UseDataTableOptions<TData> = {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
};

export function useDataTable<TData>({
  columns,
  data,
}: UseDataTableOptions<TData>): Table<TData> {
  return useReactTable({
    columns,
    data,
    getCoreRowModel: getCoreRowModel(),
  });
}
