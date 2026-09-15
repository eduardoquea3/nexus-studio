import type { ColumnDef } from "@tanstack/react-table";

import { RiDownloadLine, RiFileCopyLine } from "@remixicon/react";
import { type KeyboardEvent, useMemo, useState } from "react";

import type { QueryResult, ViewMode } from "@/shared/types/models";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/shared/components/data-table";
import { JsonCodePanel } from "@/shared/components/json-code-panel";
import { useDataTable } from "@/shared/hooks/use-data-table";
import { copyJsonToClipboard, exportJsonFile } from "@/shared/lib/json-actions";
import { exceedsJsonRenderThreshold, serializeJson } from "@/shared/lib/json-serialization";

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
  const payload = useMemo(
    () => serializeJson(result.columns, result.rows),
    [result.columns, result.rows],
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
  const table = useDataTable({ columns, data: result.rows });
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
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
        {isJson ? (
          <JsonCodePanel
            ariaLabel="SQL result JSON"
            text={payload.text}
            meta={`${result.rows.length} rows · ${result.duration_ms} ms`}
            fontScope="results"
            issues={payload.issues.length > 0}
            largeMessage={
              exceedsJsonRenderThreshold(payload.rowCount)
                ? "Large result: showing only the loaded rows."
                : undefined
            }
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
          <DataTable table={table} className="h-full w-fit" withShell={false} />
        )}
      </div>
      <div className="grid h-7 min-h-7 max-h-7 shrink-0 items-center justify-items-start border-t border-border/70 bg-background/80 px-2 py-0">
        <div
          className="flex h-6 items-center gap-0.5 rounded-md border border-border/70 bg-muted/30 p-0.5"
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
