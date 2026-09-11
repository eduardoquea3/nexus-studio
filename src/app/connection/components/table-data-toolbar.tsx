import type { Dispatch, KeyboardEvent, SetStateAction } from "react";

import { RiAddLine, RiDownloadLine } from "@remixicon/react";

import type { JsonActionResult } from "@/shared/lib/json-actions";
import type { ViewMode } from "@/shared/types/models";

import { TabsList, TabsTrigger } from "@/components/animate-ui/components/radix/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type TableDataToolbarProps = {
  canShowJson: boolean;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  columnNames: string[];
  draftRow: Record<string, unknown> | null;
  setDraftRow: Dispatch<SetStateAction<Record<string, unknown> | null>>;
  selectedRowIndex: number | null;
  selectedRowPayload: { text: string } | null;
  setFeedback: (value: string) => void;
  exportJson: (
    text: string,
    action: (text: string, filename: string) => JsonActionResult,
    filename?: string,
  ) => string;
  exportJsonAction: (text: string, filename: string) => JsonActionResult;
  total: number;
  loaded: number;
};

export function TableDataToolbar({
  canShowJson,
  viewMode,
  setViewMode,
  columnNames,
  draftRow,
  setDraftRow,
  selectedRowIndex,
  selectedRowPayload,
  setFeedback,
  exportJson,
  exportJsonAction,
  total,
  loaded,
}: TableDataToolbarProps) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border/70 bg-background/80 px-3 py-2 text-xs text-muted-foreground backdrop-blur-sm shadow-[inset_0_1px_0_hsl(var(--border)/0.35)]">
      <div className="flex items-center gap-2">
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
        <Button
          type="button"
          variant={draftRow ? "secondary" : "outline"}
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs"
          disabled={columnNames.length === 0}
          onClick={() => setDraftRow(Object.fromEntries(columnNames.map((column) => [column, ""])))}
        >
          <RiAddLine data-icon="inline-start" /> Add row
        </Button>
        {draftRow ? <span className="text-[0.625rem] text-primary/80">Draft row</span> : null}
        {selectedRowPayload ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 px-2 text-xs"
            onClick={() =>
              setFeedback(
                exportJson(selectedRowPayload.text, exportJsonAction, "selected-row.json"),
              )
            }
            aria-label={`Export selected row ${selectedRowIndex === null ? "" : selectedRowIndex + 1} as JSON`}
          >
            <RiDownloadLine data-icon="inline-start" /> Export row
          </Button>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="h-6 rounded-full px-2 text-[0.625rem]">
          {total} rows
        </Badge>
        <Badge variant="secondary" className="h-6 rounded-full px-2 text-[0.625rem]">
          Showing {loaded}
        </Badge>
      </div>
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
