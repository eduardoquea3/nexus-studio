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
import type { ColumnInfo } from "@/shared/types/models";

type DataTableProps<TData> = {
  table: TanStackTable<TData>;
  isLoading?: boolean;
  className?: string;
  withShell?: boolean;
  draftRow?: Record<string, unknown> | null;
  draftColumns?: ColumnInfo[];
  onDraftChange?: (column: string, value: string) => void;
};

export function DataTable<TData>({
  table,
  isLoading = false,
  className,
  withShell = true,
  draftRow = null,
  draftColumns = [],
  onDraftChange,
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
                <TableHead className="w-12 border-b border-r border-border/70 px-3 py-2 text-right font-medium">#</TableHead>
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
                <TableCell className="w-12 border-b border-r border-border/50 px-3 py-2 text-right font-mono text-[0.65rem] text-muted-foreground">
                  {row.index + 1}
                </TableCell>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="max-w-72 truncate border-b border-r border-border/50 px-3 py-2">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            {draftRow ? (
              <TableRow className="bg-primary/5 hover:bg-primary/10">
                <TableCell className="w-12 border-b border-r border-primary/20 px-3 py-1.5 text-right font-mono text-[0.65rem] text-primary/80">
                  {table.getRowModel().rows.length + 1}
                </TableCell>
                {table.getVisibleLeafColumns().map((column) => (
                  <TableCell key={column.id} className="h-9 border-b border-r border-primary/20 p-0">
                    <DraftEditor
                      column={draftColumns.find((draftColumn) => draftColumn?.name === column.id)}
                      columnName={column.id}
                      value={String(draftRow[column.id] ?? "")}
                      onChange={(value) => onDraftChange?.(column.id, value)}
                    />
                  </TableCell>
                ))}
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function DraftEditor({
  column,
  columnName,
  value,
  onChange,
}: {
  column?: ColumnInfo;
  columnName: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const enumValues = column?.enum_values ?? [];
  const dataType = column?.data_type.toLowerCase() ?? "";
  const isBoolean = dataType === "boolean" || dataType === "bool" || dataType === "tinyint(1)";

  if (isBoolean || enumValues.length > 0) {
    const options = isBoolean ? ["true", "false"] : enumValues;
    return (
      <select
        aria-label={`New ${columnName}`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-full min-h-9 min-w-28 w-full rounded-none border-0 bg-primary/10 px-3 text-xs text-foreground outline-none focus:bg-primary/15 focus:ring-2 focus:ring-inset focus:ring-primary/60"
      >
        <option value="">Select value</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      aria-label={`New ${columnName}`}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Enter value"
      className="h-full min-h-9 min-w-28 w-full rounded-none border-0 bg-primary/10 px-3 text-xs text-foreground outline-none placeholder:text-muted-foreground/60 focus:bg-primary/15 focus:ring-2 focus:ring-inset focus:ring-primary/60"
    />
  );
}
