import type { Dispatch, KeyboardEvent, SetStateAction } from "react";

import {
  RiAddLine,
  RiArrowLeftDoubleLine,
  RiArrowLeftSLine,
  RiArrowRightDoubleLine,
  RiArrowRightSLine,
  RiCloseLine,
  RiDownloadLine,
  RiRefreshLine,
} from "@remixicon/react";

import type { ViewMode } from "@/shared/types/models";

import { TabsList, TabsTrigger } from "@/components/animate-ui/components/radix/tabs";
import { Button } from "@/components/ui/button";

type TableDataToolbarProps = {
  canShowJson: boolean;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  columnNames: string[];
  draftRow: Record<string, unknown> | null;
  setDraftRow: Dispatch<SetStateAction<Record<string, unknown> | null>>;
  selectedRowCount: number;
  onExportRows: () => void;
  isExportingRows: boolean;
  onRefresh: () => void;
  page: number;
  pageCount: number;
  isLoading: boolean;
  onPageChange: (page: number) => void;
};

export function TableDataToolbar({
  canShowJson,
  viewMode,
  setViewMode,
  columnNames,
  draftRow,
  setDraftRow,
  selectedRowCount,
  onExportRows,
  isExportingRows,
  onRefresh,
  page,
  pageCount,
  isLoading,
  onPageChange,
}: TableDataToolbarProps) {
  return (
    <div className="grid h-10 min-h-9 max-h-10 w-full shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center border-t border-border/70 bg-background/80 px-3 text-xs text-muted-foreground backdrop-blur-sm shadow-[inset_0_1px_0_hsl(var(--border)/0.35)]">
      <div className="flex min-w-0 items-center gap-2 justify-self-start">
        {canShowJson ? (
          <div
            className="flex h-8 items-center gap-0.5 rounded-md border border-border/70 bg-muted/30 p-0.5"
            role="group"
            aria-label="Table data view"
          >
            <Button
              type="button"
              size="xs"
              variant="ghost"
              className={`h-7 text-xs ${viewMode === "table" ? "border-primary/30 bg-primary/15 text-foreground" : "text-muted-foreground"}`}
              aria-pressed={viewMode === "table"}
              onClick={() => setViewMode("table")}
              onKeyDown={(event) => activateViewMode(event, "table", setViewMode)}
            >
              Table
            </Button>
            <Button
              type="button"
              size="xs"
              variant="ghost"
              className={`h-7 text-xs ${viewMode === "json" ? "border-primary/30 bg-primary/15 text-foreground" : "text-muted-foreground"}`}
              aria-pressed={viewMode === "json"}
              onClick={() => setViewMode("json")}
              onKeyDown={(event) => activateViewMode(event, "json", setViewMode)}
            >
              JSON
            </Button>
          </div>
        ) : null}
        <TabsList className="h-8 justify-start gap-0.5 rounded-md border border-border/70 bg-muted/30 p-0.5">
          <TabsTrigger
            value="data"
            className="h-7 px-2 text-xs data-active:border-primary/30 data-active:bg-primary/15 data-active:text-foreground data-active:shadow-sm"
          >
            Data
          </TabsTrigger>
          <TabsTrigger
            value="structure"
            className="h-7 px-2 text-xs data-active:border-primary/30 data-active:bg-primary/15 data-active:text-foreground data-active:shadow-sm"
          >
            Structure
          </TabsTrigger>
        </TabsList>
      </div>
      <div className="col-start-3 row-start-1 flex items-center gap-1 justify-self-end">
        <Button
          type="button"
          variant="outline"
          size="icon-xs"
          className="h-8 w-8 rounded-md border-border/70 bg-muted/70 p-0 transition-colors hover:bg-accent"
          disabled={isLoading}
          onClick={onRefresh}
          aria-label="Refresh table data"
          title="Refresh table data"
        >
          <RiRefreshLine className="size-5" />
        </Button>
        <Button
          type="button"
          variant={draftRow ? "secondary" : "outline"}
          size="icon-xs"
          className={
            draftRow
              ? "h-8 w-8 rounded-md border border-destructive/35 bg-destructive/10 p-0 text-destructive transition-colors hover:bg-destructive/15"
              : "h-8 w-8 rounded-md border-border/70 bg-muted/70 p-0 transition-colors hover:bg-accent"
          }
          disabled={!draftRow && (isLoading || columnNames.length === 0)}
          onClick={() =>
            setDraftRow(
              draftRow
                ? null
                : Object.fromEntries(columnNames.map((column) => [column, ""])),
            )
          }
          aria-label={draftRow ? "Cancel add row" : "Add row"}
          title={draftRow ? "Cancel add row" : "Add row"}
        >
          {draftRow ? <RiCloseLine className="size-4" /> : <RiAddLine className="size-5" />}
        </Button>
        {selectedRowCount > 0 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 px-2 text-xs"
            disabled={isExportingRows}
            onClick={onExportRows}
            aria-label={`Export ${selectedRowCount} selected ${selectedRowCount === 1 ? "row" : "rows"} as JSON`}
          >
            <RiDownloadLine data-icon="inline-start" /> Export row
          </Button>
        ) : null}
      </div>
      <nav
        aria-label="Table data pagination"
        className="col-start-2 row-start-1 flex h-7 items-center justify-self-center gap-1 text-[0.65rem]"
      >
        <Button
          type="button"
          size="xs"
          variant="ghost"
          className="h-7 w-7 rounded-md border border-border/70 p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-35"
          disabled={page <= 1 || isLoading}
          onClick={() => onPageChange(1)}
          aria-label="First table page"
        >
          <RiArrowLeftDoubleLine />
        </Button>
        <Button
          type="button"
          size="xs"
          variant="ghost"
          className="h-7 w-7 rounded-md border border-border/70 p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-35"
          disabled={page <= 1 || isLoading}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          aria-label="Previous table page"
        >
          <RiArrowLeftSLine />
        </Button>
        <span
          aria-label={`Current page ${page}`}
          className="flex h-7 min-w-8 items-center justify-center rounded-md border border-primary/30 bg-primary/10 px-2 text-center font-medium tabular-nums text-foreground"
        >
          {page}
        </span>
        <Button
          type="button"
          size="xs"
          variant="ghost"
          className="h-7 w-7 rounded-md border border-border/70 p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-35"
          disabled={isLoading || page >= pageCount}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next table page"
        >
          <RiArrowRightSLine />
        </Button>
        <Button
          type="button"
          size="xs"
          variant="ghost"
          className="h-7 w-7 rounded-md border border-border/70 p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-35"
          disabled={isLoading || page >= pageCount}
          onClick={() => onPageChange(pageCount)}
          aria-label="Last table page"
        >
          <RiArrowRightDoubleLine />
        </Button>
      </nav>
    </div>
  );
}

function activateViewMode(
  event: KeyboardEvent<HTMLButtonElement>,
  nextMode: ViewMode,
  setViewMode: (mode: ViewMode) => void,
) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    setViewMode(nextMode);
  }
}
