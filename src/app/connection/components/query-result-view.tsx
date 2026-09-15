import type { ColumnDef } from "@tanstack/react-table";

import {
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiDownloadLine,
  RiFileCopyLine,
} from "@remixicon/react";
import { type KeyboardEvent, useEffect, useMemo, useState } from "react";

import type { QueryResult, ViewMode } from "@/shared/types/models";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/shared/components/data-table";
import { JsonCodePanel } from "@/shared/components/json-code-panel";
import { useDataTable } from "@/shared/hooks/use-data-table";
import { copyJsonToClipboard, exportJsonFile } from "@/shared/lib/json-actions";
import { serializeJson } from "@/shared/lib/json-serialization";

const QUERY_RESULT_PAGE_SIZE = 100;

export function QueryResultView({
  result,
  viewMode,
  onViewModeChange,
}: {
  result: QueryResult;
  viewMode: ViewMode;
  onViewModeChange: (viewMode: ViewMode) => void;
}) {
  const [feedback, setFeedback] = useState<string | null>(null);
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
  const exportJson = () => {
    const status = exportJsonFile(payload.text, "sql-result.json");
    setFeedback(
      status === "success"
        ? "JSON export started."
        : status === "cancelled"
          ? "JSON export cancelled."
          : "Could not export JSON.",
    );
  };
  const activateViewMode = (event: KeyboardEvent<HTMLButtonElement>, mode: ViewMode) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onViewModeChange(mode);
    }
  };
  return (
    <div className="flex h-full min-w-0 w-full flex-col gap-0">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-hidden">
          {isJson ? (
            <JsonCodePanel
              ariaLabel="SQL result JSON"
              text={payload.text}
              meta={
                hasPagination
                  ? `Rows ${firstVisibleRow}-${lastVisibleRow} of ${result.rows.length} · ${result.duration_ms} ms`
                  : `${result.rows.length} rows · ${result.duration_ms} ms`
              }
              fontScope="results"
              issues={payload.issues.length > 0}
              actions={
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
                    onClick={exportJson}
                    aria-label="Export SQL result JSON"
                  >
                    <RiDownloadLine data-icon="inline-start" />
                    Export
                  </Button>
                </>
              }
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
      <div className="grid h-9 min-h-9 max-h-9 w-full shrink-0 grid-cols-[1fr_auto] items-center border-t border-border/70 bg-background/80 px-2 py-1">
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
            <span className="hidden sm:inline">
              Rows {firstVisibleRow}-{lastVisibleRow} of {result.rows.length}
            </span>
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
