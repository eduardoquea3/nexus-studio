import { RiLoader4Line } from "@remixicon/react";
import { flexRender, type Row, type Table as TanStackTable } from "@tanstack/react-table";
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { memo, useCallback, useEffect, useRef, useState } from "react";

import type { ColumnInfo } from "@/shared/types/models";

import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
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
  draftRow?: Record<string, unknown> | null;
  draftColumns?: ColumnInfo[];
  onDraftChange?: (column: string, value: string) => void;
  rowNumberOffset?: number;
  onSelectionChange?: (rows: Row<TData>[]) => void;
};

type DragSelection<TData> = {
  startIndex: number;
  endIndex: number;
  rows: Row<TData>[];
};

type DataTableRowProps<TData> = {
  row: Row<TData>;
  rowNumber: number;
  isSelected: boolean;
  isSelectable: boolean;
  onPointerEnter: (row: Row<TData>, event: ReactPointerEvent<HTMLTableRowElement>) => void;
  onPointerDown: (row: Row<TData>, event: ReactPointerEvent<HTMLButtonElement>) => void;
  onKeyboardSelect: (row: Row<TData>, event: ReactMouseEvent<HTMLButtonElement>) => void;
};

const EMPTY_ROW_SELECTION = new Set<string>();

export function DataTable<TData>({
  table,
  isLoading = false,
  className,
  withShell = true,
  draftRow = null,
  draftColumns = [],
  onDraftChange,
  rowNumberOffset = 0,
  onSelectionChange,
}: DataTableProps<TData>) {
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(() => new Set());
  const dragSelectionRef = useRef<DragSelection<TData> | null>(null);
  const previousDataRef = useRef(table.options.data);
  const tableWrapperRef = useRef<HTMLDivElement>(null);
  const rows = table.getRowModel().rows;
  const visibleSelectedRowIds =
    previousDataRef.current === table.options.data ? selectedRowIds : EMPTY_ROW_SELECTION;

  useEffect(() => {
    if (previousDataRef.current === table.options.data) return;
    previousDataRef.current = table.options.data;
    dragSelectionRef.current = null;
    tableWrapperRef.current?.classList.remove("select-none");
    setSelectedRowIds(new Set());
  }, [table.options.data]);

  useEffect(() => {
    const stopDragging = () => {
      const dragSelection = dragSelectionRef.current;
      if (!dragSelection) return;

      dragSelectionRef.current = null;
      tableWrapperRef.current?.classList.remove("select-none");
      setSelectedRowIds(new Set(dragSelection.rows.map((row) => row.id)));
      onSelectionChange?.(dragSelection.rows);
    };

    window.addEventListener("pointerup", stopDragging);
    window.addEventListener("pointercancel", stopDragging);
    return () => {
      window.removeEventListener("pointerup", stopDragging);
      window.removeEventListener("pointercancel", stopDragging);
    };
  }, [onSelectionChange]);

  const setRowSelectionVisual = (rowIndex: number, isSelected: boolean) => {
    const rowElement = tableWrapperRef.current?.querySelector<HTMLTableRowElement>(
      `[data-row-index="${rowIndex}"]`,
    );
    if (!rowElement) return;

    if (isSelected) rowElement.setAttribute("data-row-selected", "true");
    else rowElement.removeAttribute("data-row-selected");
    rowElement.setAttribute("aria-selected", String(isSelected));
    rowElement
      .querySelector<HTMLButtonElement>("[data-row-selector]")
      ?.setAttribute("aria-pressed", String(isSelected));
  };
  const updateSelectionVisuals = (previousRows: Row<TData>[], nextRows: Row<TData>[]) => {
    const previousIds = new Set(previousRows.map((row) => row.id));
    const nextIds = new Set(nextRows.map((row) => row.id));

    for (const row of previousRows) {
      if (!nextIds.has(row.id)) setRowSelectionVisual(row.index, false);
    }
    for (const row of nextRows) {
      if (!previousIds.has(row.id)) setRowSelectionVisual(row.index, true);
    }
  };
  const selectRows = (selectedRows: Row<TData>[]) => {
    const previousRows = rows.filter((row) => visibleSelectedRowIds.has(row.id));
    updateSelectionVisuals(previousRows, selectedRows);
    setSelectedRowIds(new Set(selectedRows.map((row) => row.id)));
    onSelectionChange?.(selectedRows);
  };
  const startRowSelection = (row: Row<TData>, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const selectedRows = [row];
    const previousRows = rows.filter((item) => visibleSelectedRowIds.has(item.id));
    updateSelectionVisuals(previousRows, selectedRows);
    dragSelectionRef.current = {
      startIndex: row.index,
      endIndex: row.index,
      rows: selectedRows,
    };
    tableWrapperRef.current?.classList.add("select-none");
  };
  const extendRowSelection = (row: Row<TData>, event: ReactPointerEvent<HTMLTableRowElement>) => {
    const dragSelection = dragSelectionRef.current;
    if (!dragSelection || (event.buttons & 1) !== 1 || dragSelection.endIndex === row.index) return;

    dragSelection.endIndex = row.index;
    const firstIndex = Math.min(dragSelection.startIndex, row.index);
    const lastIndex = Math.max(dragSelection.startIndex, row.index);
    const selectedRows = rows.filter((item) => item.index >= firstIndex && item.index <= lastIndex);
    updateSelectionVisuals(dragSelection.rows, selectedRows);
    dragSelection.rows = selectedRows;
  };
  const selectRowWithKeyboard = (row: Row<TData>, event: ReactMouseEvent<HTMLButtonElement>) => {
    if (event.detail === 0) selectRows([row]);
  };
  const selectionHandlersRef = useRef({
    startRowSelection,
    extendRowSelection,
    selectRowWithKeyboard,
  });
  selectionHandlersRef.current = {
    startRowSelection,
    extendRowSelection,
    selectRowWithKeyboard,
  };
  const handleRowPointerDown = useCallback(
    (row: Row<TData>, event: ReactPointerEvent<HTMLButtonElement>) =>
      selectionHandlersRef.current.startRowSelection(row, event),
    [],
  );
  const handleRowPointerEnter = useCallback(
    (row: Row<TData>, event: ReactPointerEvent<HTMLTableRowElement>) =>
      selectionHandlersRef.current.extendRowSelection(row, event),
    [],
  );
  const handleKeyboardRowSelect = useCallback(
    (row: Row<TData>, event: ReactMouseEvent<HTMLButtonElement>) =>
      selectionHandlersRef.current.selectRowWithKeyboard(row, event),
    [],
  );

  if (isLoading) {
    return (
      <div
        className={cn(
          "flex h-full items-center justify-center gap-2 text-xs text-muted-foreground",
          className,
        )}
      >
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
      <ScrollArea className="h-full [&_[data-orientation=vertical]]:hidden">
        <div
          ref={tableWrapperRef}
          className="h-full min-w-full w-max pb-3 [&_[data-slot=table-container]]:h-full [&_[data-slot=table-container]]:overflow-visible"
        >
          <Table className="min-w-max text-xs">
            <TableHeader className="sticky top-0 z-10 bg-accent text-left">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  <TableHead className="w-12 border-b border-r border-border/70 px-3 py-2 text-right font-medium">
                    #
                  </TableHead>
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className="border-b border-r border-border/70 px-3 py-2 font-medium"
                      colSpan={header.colSpan}
                    >
                      {header.isPlaceholder ? null : (
                        <div className="flex min-w-28 items-baseline gap-2 whitespace-nowrap">
                          <span>
                            {flexRender(header.column.columnDef.header, header.getContext())}
                          </span>
                          {getColumnInfo(draftColumns, header.column.id) ? (
                            <span className="text-[0.625rem] font-normal text-muted-foreground/75">
                              {getDisplayType(getColumnInfo(draftColumns, header.column.id))}
                            </span>
                          ) : null}
                        </div>
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <MemoDataTableRow
                  key={row.id}
                  row={row}
                  rowNumber={row.index + rowNumberOffset + 1}
                  isSelected={visibleSelectedRowIds.has(row.id)}
                  isSelectable={Boolean(onSelectionChange)}
                  onPointerEnter={handleRowPointerEnter}
                  onPointerDown={handleRowPointerDown}
                  onKeyboardSelect={handleKeyboardRowSelect}
                />
              ))}
              {draftRow ? (
                <TableRow className="bg-primary/5 hover:bg-primary/10">
                  <TableCell className="w-12 border-b border-r border-primary/20 px-3 py-1.5 text-right font-mono text-[0.65rem] text-primary/80">
                    {table.getRowModel().rows.length + rowNumberOffset + 1}
                  </TableCell>
                  {table.getVisibleLeafColumns().map((column) => (
                    <TableCell
                      key={column.id}
                      className="h-9 border-b border-r border-primary/20 p-0"
                    >
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
        <ScrollBar
          orientation="horizontal"
          className="absolute inset-x-0 bottom-0 z-20 data-horizontal:h-1.5 border-t-transparent bg-transparent opacity-70 transition-opacity hover:opacity-100 [&_[data-slot=scroll-area-thumb]]:bg-border/60"
        />
      </ScrollArea>
    </div>
  );
}

function DataTableRow<TData>({
  row,
  rowNumber,
  isSelected,
  isSelectable,
  onPointerEnter,
  onPointerDown,
  onKeyboardSelect,
}: DataTableRowProps<TData>) {
  return (
    <TableRow
      data-row-index={row.index}
      data-row-selected={isSelected ? "true" : undefined}
      aria-selected={isSelected}
      onPointerEnter={(event) => onPointerEnter(row, event)}
      className={cn(
        "transition-none hover:bg-muted/40 data-[row-selected=true]:bg-primary/25 data-[row-selected=true]:hover:bg-primary/30",
        isSelected && "bg-primary/25 hover:bg-primary/30",
      )}
    >
      <TableCell
        aria-label={String(rowNumber)}
        className="w-12 border-b border-r border-border/50 p-0 text-right font-mono text-[0.65rem] text-muted-foreground"
      >
        {isSelectable ? (
          <button
            type="button"
            data-row-selector
            aria-label={`Select row ${rowNumber}`}
            aria-pressed={isSelected}
            onPointerDown={(event) => onPointerDown(row, event)}
            onClick={(event) => onKeyboardSelect(row, event)}
            className={cn(
              "flex min-h-9 w-full select-none items-center justify-end px-3 py-2 text-right font-mono text-[0.65rem] text-muted-foreground transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/60",
              "cursor-pointer hover:bg-muted/60 hover:text-foreground",
              isSelected && "bg-primary/30 text-foreground",
            )}
          >
            {rowNumber}
          </button>
        ) : (
          <span className="block px-3 py-2">{rowNumber}</span>
        )}
      </TableCell>
      {row.getVisibleCells().map((cell) => {
        const value = cell.getValue();
        const isNull = value === null || value === undefined;

        return (
          <TableCell
            key={cell.id}
            className={cn(
              "max-w-72 truncate border-b border-r border-border/50 px-3 py-2",
              isNull && "text-muted-foreground/60",
            )}
          >
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </TableCell>
        );
      })}
    </TableRow>
  );
}

const MemoDataTableRow = memo(DataTableRow) as typeof DataTableRow;

function getColumnInfo(columns: ColumnInfo[], name: string) {
  return columns.find((column) => column.name === name);
}

function getDisplayType(column?: ColumnInfo) {
  if (!column) return "";
  return column.enum_values.length > 0 ? "enum" : column.data_type;
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
