import { flexRender, type Table as TanStackTable } from "@tanstack/react-table";
import { RiLoader4Line } from "@remixicon/react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type DataTableProps<TData> = {
  table: TanStackTable<TData>;
  isLoading?: boolean;
  className?: string;
  withShell?: boolean;
};

export function DataTable<TData>({
  table,
  isLoading = false,
  className,
  withShell = true,
}: DataTableProps<TData>) {
  if (isLoading) {
    return (
      <div className={cn("flex h-full items-center justify-center gap-2 text-xs text-muted-foreground", className)}>
        <RiLoader4Line className="size-4 animate-spin" aria-hidden="true" />
        Loading data...
      </div>
    );
  }

  return (
    <div
      className={cn(
        withShell
          ? "h-full overflow-hidden rounded-xl border border-border/70 bg-background/70 shadow-sm"
          : "h-full overflow-hidden",
        className,
      )}
    >
      <div className="h-full overflow-auto">
        <Table className="text-xs">
          <TableHeader className="sticky top-0 bg-muted/90 text-left">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="border-b border-r border-border/70 px-3 py-2 font-medium" colSpan={header.colSpan}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} className="hover:bg-muted/40">
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="max-w-72 truncate border-b border-r border-border/50 px-3 py-2">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
