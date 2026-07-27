import { flexRender, type Table } from "@tanstack/react-table";
import { RiLoader4Line } from "@remixicon/react";

import { cn } from "@/lib/utils";

type DataTableProps<TData> = {
  table: Table<TData>;
  isLoading?: boolean;
  className?: string;
};

export function DataTable<TData>({ table, isLoading = false, className }: DataTableProps<TData>) {
  if (isLoading) {
    return (
      <div className={cn("flex h-full items-center justify-center gap-2 text-xs text-muted-foreground", className)}>
        <RiLoader4Line className="size-4 animate-spin" aria-hidden="true" />
        Loading data...
      </div>
    );
  }

  return (
    <div className={cn("h-full overflow-auto", className)}>
      <table className="w-full border-collapse text-xs">
        <thead className="sticky top-0 bg-muted/90 text-left">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id} className="border-b border-r border-border/70 px-3 py-2 font-medium">
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="hover:bg-muted/40">
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="max-w-72 truncate border-b border-r border-border/50 px-3 py-2">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
