import type { ColumnDef } from "@tanstack/react-table";

import {
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiDownloadLine,
  RiFileCopyLine,
} from "@remixicon/react";
import { type KeyboardEvent, type ReactNode, useEffect, useMemo, useState } from "react";

import type { QueryResult, ViewMode } from "@/shared/types/models";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { DataTable } from "@/shared/components/data-table";
import { JsonCodePanel } from "@/shared/components/json-code-panel";
import { useDataTable } from "@/shared/hooks/use-data-table";
import { copyJsonToClipboard } from "@/shared/lib/json-actions";
import { serializeJson } from "@/shared/lib/json-serialization";

import { exportTableDataJson } from "../services/table-data-export-service";

const QUERY_RESULT_PAGE_SIZE = 100;

export function QueryResultView({
  result,
  viewMode,
  onViewModeChange,
  toolbarActions,
}: {
  result: QueryResult;
  viewMode: ViewMode;
  onViewModeChange: (viewMode: ViewMode) => void;
  toolbarActions?: ReactNode;
}) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const pageCount = Math.ceil(result.rows.length / QUERY_RESULT_PAGE_SIZE);
  const currentPageIndex = Math.min(pageIndex, Math.max(pageCount - 1, 0));
  const pageRows = useMemo(
    () =>
      result.rows.slice(
        currentPageIndex * QUERY_RESULT_PAGE_SIZE,
        (currentPageIndex + 1) * QUERY_RESULT_PAGE_SIZE,
      ),
    [currentPageIndex, result.rows],
  );
  const hasPagination = pageCount > 1;
  const firstVisibleRow = currentPageIndex * QUERY_RESULT_PAGE_SIZE + 1;
  const lastVisibleRow = Math.min(firstVisibleRow + pageRows.length - 1, result.rows.length);
  useEffect(() => {
    setPageIndex(0);
  }, [result.rows]);
  const payload = useMemo(
    () => serializeJson(result.columns, pageRows),
    [pageRows, result.columns],
  );
  const columns = useMemo<ColumnDef<Record<string, unknown>, unknown>[]>(
    () =>
      result.columns.map((column) => ({
        accessorKey: column,
        header: column,
        cell: (context) => formatCell(context.getValue()),
      })),
    [result.columns],
  );
  const table = useDataTable({ columns, data: pageRows });
  if (result.columns.length === 0)
    return (
      <span>
        {result.affected} row(s) affected in {result.duration_ms} ms.
      </span>
    );
  const isJson = viewMode === "json";
  const copyJson = async () =>
    setFeedback(
      (await copyJsonToClipboard(payload.text)) === "success"
        ? "JSON copied to clipboard."
        : "Could not copy JSON.",
    );
  const exportJson = async () => {
    setIsExporting(true);
    try {
      const outcome = await exportTableDataJson(payload.text, "sql-result.json");
      if (outcome.status === "success") {
        setFeedback(`JSON exported to ${outcome.path}.`);
        toast.add({ title: "JSON exported", type: "success", description: outcome.path });
      } else if (outcome.status === "error") {
        setFeedback("Could not export JSON.");
        toast.add({ title: "Could not export JSON", type: "error", description: outcome.message });
      } else {
        setFeedback("JSON export cancelled.");
      }
    } finally {
      setIsExporting(false);
    }
  };
  const activateViewMode = (event: KeyboardEvent<HTMLButtonElement>, mode: ViewMode) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onViewModeChange(mode);
    }
  };
  return (
    <div className="flex h-full min-w-0 w-full flex-col gap-0">
      <div
        role="toolbar"
        aria-label="SQL result toolbar"
        className="flex w-full shrink-0 items-center justify-between gap-3 border-b border-border/70 bg-background/80 px-3 py-1"
      >
        <div
          aria-label="Query result statistics"
          className="flex min-w-0 flex-wrap items-center gap-x-3 text-[0.65rem] text-muted-foreground"
        >
          <span>
            {hasPagination
              ? `Rows ${firstVisibleRow}-${lastVisibleRow} of ${result.rows.length}`
              : `${result.rows.length} rows`}
          </span>
          <span>{result.columns.length} columns</span>
          <span>{result.duration_ms} ms</span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {isJson ? (
            <>
              <Button
                type="button"
                size="xs"
                variant="ghost"
                onClick={() => void copyJson()}
                aria-label="Copy SQL result JSON"
              >
                <RiFileCopyLine data-icon="inline-start" />
                Copy
              </Button>
              <Button
                type="button"
                size="xs"
                variant="ghost"
                onClick={() => void exportJson()}
                disabled={isExporting}
                aria-label="Export SQL result JSON"
              >
                <RiDownloadLine data-icon="inline-start" />
                {isExporting ? "Exporting..." : "Export"}
              </Button>
            </>
          ) : null}
          {toolbarActions}
        </div>
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-hidden">
          {isJson ? (
            <JsonCodePanel
              ariaLabel="SQL result JSON"
              text={payload.text}
              fontScope="results"
              issues={payload.issues.length > 0}
            />
          ) : (
            <DataTable
              table={table}
              className="h-full w-full"
              withShell={false}
              rowNumberOffset={currentPageIndex * QUERY_RESULT_PAGE_SIZE}
            />
          )}
        </div>
      </div>
      <div className="grid h-10 min-h-9 max-h-10 w-full shrink-0 grid-cols-[1fr_auto] items-center border-t border-border/70 bg-background/80 px-2">
        <div
          className="flex h-6 items-center justify-self-start gap-0.5 rounded-md border border-border/70 bg-muted/30 p-0.5"
          role="group"
          aria-label="SQL result view"
        >
          <Button
            type="button"
            size="xs"
            variant="ghost"
            className={`h-5 text-xs ${!isJson ? "border-primary/30 bg-primary/15 text-foreground" : "text-muted-foreground"}`}
            aria-pressed={!isJson}
            onClick={() => onViewModeChange("table")}
            onKeyDown={(event) => activateViewMode(event, "table")}
          >
            Table
          </Button>
          <Button
            type="button"
            size="xs"
            variant="ghost"
            className={`h-5 text-xs ${isJson ? "border-primary/30 bg-primary/15 text-foreground" : "text-muted-foreground"}`}
            aria-pressed={isJson}
            onClick={() => onViewModeChange("json")}
            onKeyDown={(event) => activateViewMode(event, "json")}
          >
            JSON
          </Button>
        </div>
        {hasPagination ? (
          <nav
            aria-label="SQL result pagination"
            className="flex h-7 items-center gap-1 text-[0.65rem] text-muted-foreground"
          >
            <Button
              type="button"
              size="xs"
              variant="ghost"
              className="h-5 px-1.5"
              disabled={currentPageIndex === 0}
              onClick={() => setPageIndex((index) => Math.max(index - 1, 0))}
              aria-label="Previous result page"
            >
              <RiArrowLeftSLine />
              <span className="hidden sm:inline">Previous</span>
            </Button>
            <span className="min-w-16 text-center">
              Page {currentPageIndex + 1} of {pageCount}
            </span>
            <Button
              type="button"
              size="xs"
              variant="ghost"
              className="h-5 px-1.5"
              disabled={currentPageIndex === pageCount - 1}
              onClick={() => setPageIndex((index) => Math.min(index + 1, pageCount - 1))}
              aria-label="Next result page"
            >
              <span className="hidden sm:inline">Next</span>
              <RiArrowRightSLine />
            </Button>
          </nav>
        ) : null}
      </div>
      <p aria-live="polite" className="sr-only">
        {feedback}
      </p>
    </div>
  );
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}
