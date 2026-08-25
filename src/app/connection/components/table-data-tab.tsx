import { RiAddLine, RiDownloadLine, RiFileCopyLine, RiRefreshLine } from "@remixicon/react";
import { type KeyboardEvent, useMemo } from "react";
import { useEffect, useRef, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";

import { Checkbox } from "@/components/animate-ui/components/radix/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/animate-ui/components/radix/tabs";
import { useTableSchema } from "@/app/connection/hooks/use-table-schema";
import { useTableData } from "@/app/connection/hooks/use-table-data";
import { DataTable } from "@/shared/components/data-table";
import { JsonCodePanel } from "@/shared/components/json-code-panel";
import { useDataTable } from "@/shared/hooks/use-data-table";
import type { ConnectionProfile, ViewMode } from "@/shared/types/models";
import { exceedsJsonRenderThreshold, serializeJson } from "@/shared/lib/json-serialization";
import { copyJsonToClipboard, exportJsonFile, type JsonActionResult } from "@/shared/lib/json-actions";

type StructureDraft = {
  name: string;
  data_type: string;
  nullable: boolean;
  default: string;
  comment: string;
  is_pk: boolean;
};

type TableDataTabProps = {
  profile: ConnectionProfile;
  table: string;
  schema?: string;
  refreshToken?: number;
  exportJson?: (text: string, filename: string) => JsonActionResult;
};

export function TableDataTab({
  profile,
  table,
  schema,
  refreshToken = 0,
  exportJson: exportJsonAction = exportJsonFile,
}: TableDataTabProps) {
  const { data, error, isLoading, refetch } = useTableData(profile, table, schema);
  const tableSchema = useTableSchema(profile, table, true, schema);
  const [structureDraft, setStructureDraft] = useState<StructureDraft[]>([]);
  const [draftRow, setDraftRow] = useState<Record<string, unknown> | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);
  const previousRefreshTokenRef = useRef(refreshToken);
  const schemaColumns = tableSchema.data?.columns;
  const columnNames = data?.columns.length
    ? data.columns
    : (schemaColumns ?? []).map((column) => column.name);
  const structureSignature = schemaColumns
    ? schemaColumns
        .map((column) => [column.name, column.data_type, column.enum_values.join(","), column.nullable, column.default ?? "", column.is_pk].join("::"))
        .join("|")
    : "";
  const lastStructureSignatureRef = useRef<string | null>(null);
  const columns = useMemo<ColumnDef<Record<string, unknown>, unknown>[]>(
    () =>
      columnNames.map((column) => ({
        accessorKey: column,
        header: column,
        cell: (context) => formatCell(context.getValue()),
      })),
    [columnNames],
  );
  const dataTable = useDataTable({ columns, data: data?.rows ?? [] });
  const payload = useMemo(
    () => (data ? serializeJson(data.columns, data.rows, { page: data.page, pageSize: data.page_size }) : null),
    [data],
  );
  const canShowJson = Boolean(data && data.rows.length > 0 && data.columns.length > 0 && payload);
  const selectedRow = selectedRowIndex === null ? null : data?.rows[selectedRowIndex] ?? null;
  const selectedRowPayload = useMemo(
    () =>
      selectedRow && data
        ? serializeJson(data.columns, [selectedRow])
        : null,
    [data, selectedRow],
  );

  useEffect(() => {
    setViewMode("table");
    setFeedback(null);
    setSelectedRowIndex(null);
  }, [table]);

  useEffect(() => {
    setSelectedRowIndex(null);
  }, [data]);

  useEffect(() => {
    if (previousRefreshTokenRef.current === refreshToken) {
      return;
    }

    previousRefreshTokenRef.current = refreshToken;
    void refetch();
  }, [refreshToken, refetch]);

  useEffect(() => {
    if (!schemaColumns) {
      return;
    }

    if (lastStructureSignatureRef.current === structureSignature) {
      return;
    }

    lastStructureSignatureRef.current = structureSignature;

    setStructureDraft(
      schemaColumns.map((column) => ({
        name: column.name,
        data_type: column.data_type,
        nullable: column.nullable,
        default: column.default ?? "",
        comment: "",
        is_pk: column.is_pk,
      })),
    );
  }, [schemaColumns, structureSignature]);

  if (isLoading) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <p role="status" className="sr-only">Loading data...</p>
        <DataTable table={dataTable} isLoading />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-muted-foreground">
        <p>Could not load data for {table}.</p>
        <p className="max-w-xl text-[0.65rem] text-destructive/80">
          {getErrorMessage(error)}
        </p>
        <Button variant="outline" size="sm" onClick={() => void refetch()}>
          <RiRefreshLine data-icon="inline-start" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <Tabs
      defaultValue="data"
      className="flex h-full min-h-0 flex-col gap-0"
      onValueChange={(value) => {
        if (value === "structure") {
          void tableSchema.refetch();
        }
      }}
    >
      <div className="min-h-0 flex-1 overflow-hidden">
        <TabsContent value="data" className="h-full min-h-0 overflow-hidden p-0 m-0">
          <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-b-xl">
            <div className="min-h-0 flex-1 overflow-hidden">
              {viewMode === "json" && canShowJson && payload ? (
                <JsonCodePanel
                  ariaLabel="Table data JSON"
                  text={payload.text}
                  meta={`Page ${data?.page ?? 0} · ${data?.rows.length ?? 0} loaded`}
                  issues={payload.issues.length > 0}
                  largeMessage={exceedsJsonRenderThreshold(payload.rowCount) ? "Large page: only loaded rows are shown." : undefined}
                  actions={
                    <>
                      <Button type="button" size="xs" variant="ghost" onClick={() => void copyJson(payload.text).then(setFeedback)} aria-label="Copy table data JSON"><RiFileCopyLine data-icon="inline-start" />Copy</Button>
                      <Button type="button" size="xs" variant="ghost" onClick={() => setFeedback(exportJson(payload.text, exportJsonAction))} aria-label="Export table data JSON"><RiDownloadLine data-icon="inline-start" />Export</Button>
                    </>
                  }
                />
              ) : (
                <DataTable
                  table={dataTable}
                  isLoading={isLoading || (columnNames.length === 0 && tableSchema.isLoading)}
                  withShell={false}
                  className="h-full"
                  draftRow={draftRow}
                  draftColumns={schemaColumns}
                  selectedRowId={selectedRowIndex === null ? null : String(selectedRowIndex)}
                  onRowClick={(row) => setSelectedRowIndex(row.index)}
                  onDraftChange={(column, value) => {
                    setDraftRow((row) => (row ? { ...row, [column]: value } : row));
                  }}
                />
              )}
            </div>
            <p aria-live="polite" className="sr-only">{feedback}</p>
          </div>
        </TabsContent>
        <TabsContent value="structure" className="min-h-0 max-h-full overflow-auto p-4 m-0">
          {tableSchema.isLoading ? (
            <div className="text-xs text-muted-foreground">Loading structure...</div>
          ) : tableSchema.error ? (
            <div className="text-xs text-destructive">Could not load table structure.</div>
          ) : (
            <div className="flex h-fit min-h-0 max-h-full flex-col overflow-hidden rounded-xl border border-border/70 bg-card/40">
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
                <div>
                  <div className="text-sm font-semibold text-foreground">Columns</div>
                  <div className="text-[0.65rem] text-muted-foreground">
                    Edit nullable, default and primary state locally.
                  </div>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Button variant="ghost" size="icon-xs" className="rounded-full" disabled>
                    <RiRefreshLine />
                  </Button>
                  <Button variant="ghost" size="icon-xs" className="rounded-full" disabled>
                    +
                  </Button>
                </div>
              </div>
              <div className="min-h-0 max-h-full overflow-auto">
                <table className="w-full border-collapse text-xs">
                  <thead className="sticky top-0 z-10 bg-muted/90 text-left backdrop-blur-sm">
                    <tr>
                      <th className="border-b border-r border-border/70 px-3 py-2 font-medium">Name</th>
                      <th className="border-b border-r border-border/70 px-3 py-2 font-medium">Type</th>
                      <th className="border-b border-r border-border/70 px-3 py-2 font-medium">Nullable</th>
                      <th className="border-b border-r border-border/70 px-3 py-2 font-medium">Default Value</th>
                      <th className="border-b border-r border-border/70 px-3 py-2 font-medium">Comment</th>
                      <th className="border-b border-r border-border/70 px-3 py-2 font-medium">Primary</th>
                    </tr>
                  </thead>
                  <tbody>
                    {structureDraft.map((column) => (
                      <tr key={column.name} className="hover:bg-muted/40">
                        <td className="border-b border-r border-border/50 px-3 py-2 font-medium text-foreground">
                          {column.name}
                        </td>
                        <td className="border-b border-r border-border/50 px-3 py-2 text-muted-foreground">
                          {column.data_type}
                        </td>
                        <td className="border-b border-r border-border/50 px-3 py-2">
                          <div className="inline-flex items-center gap-2">
                            <Checkbox
                              checked={column.nullable}
                              onCheckedChange={(value) => {
                                setStructureDraft((rows) =>
                                  rows.map((row) =>
                                    row.name === column.name ? { ...row, nullable: value === true } : row,
                                  ),
                                );
                              }}
                              size="sm"
                              type="button"
                              aria-label={`Nullable ${column.name}`}
                            />
                            <span>{column.nullable ? "YES" : "NO"}</span>
                          </div>
                        </td>
                        <td className="border-b border-r border-border/50 px-3 py-2">
                          <Input
                            value={column.default}
                            onChange={(event) => {
                              const nextValue = event.target.value;
                              setStructureDraft((rows) =>
                                rows.map((row) =>
                                  row.name === column.name ? { ...row, default: nextValue } : row,
                                ),
                              );
                            }}
                            placeholder="(NULL)"
                            className="h-7 bg-background/70 text-xs"
                          />
                        </td>
                        <td className="border-b border-r border-border/50 px-3 py-2">
                          <Input
                            value={column.comment}
                            onChange={(event) => {
                              const nextValue = event.target.value;
                              setStructureDraft((rows) =>
                                rows.map((row) =>
                                  row.name === column.name ? { ...row, comment: nextValue } : row,
                                ),
                              );
                            }}
                            placeholder="(NULL)"
                            className="h-7 bg-background/70 text-xs"
                          />
                        </td>
                        <td className="border-b border-border/50 px-3 py-2">
                          <div className="inline-flex items-center gap-2">
                            <Checkbox
                              checked={column.is_pk}
                              onCheckedChange={(value) => {
                                setStructureDraft((rows) =>
                                  rows.map((row) =>
                                    row.name === column.name ? { ...row, is_pk: value === true } : row,
                                  ),
                                );
                              }}
                              size="sm"
                              type="button"
                              aria-label={`Primary key ${column.name}`}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>
      </div>
      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border/70 bg-background/80 px-3 py-2 text-xs text-muted-foreground backdrop-blur-sm shadow-[inset_0_1px_0_hsl(var(--border)/0.35)]">
        <div className="flex items-center gap-2">
          {canShowJson ? (
            <div className="flex items-center gap-0.5 rounded-md border border-border/70 bg-muted/30 p-0.5" role="group" aria-label="Table data view">
              <Button type="button" size="xs" variant="ghost" className={viewMode === "table" ? "border-primary/30 bg-primary/15 text-foreground" : "text-muted-foreground"} aria-pressed={viewMode === "table"} onClick={() => setViewMode("table")} onKeyDown={(event) => activateViewMode(event, "table", setViewMode)}>Table</Button>
              <Button type="button" size="xs" variant="ghost" className={viewMode === "json" ? "border-primary/30 bg-primary/15 text-foreground" : "text-muted-foreground"} aria-pressed={viewMode === "json"} onClick={() => setViewMode("json")} onKeyDown={(event) => activateViewMode(event, "json", setViewMode)}>JSON</Button>
            </div>
          ) : null}
          <TabsList className="h-8 justify-start gap-0.5 rounded-md border border-border/70 bg-muted/30 p-0.5">
            <TabsTrigger value="data" className="h-7 px-2 text-xs data-active:border-primary/30 data-active:bg-primary/15 data-active:text-foreground data-active:shadow-sm">
              Data
            </TabsTrigger>
            <TabsTrigger value="structure" className="h-7 px-2 text-xs data-active:border-primary/30 data-active:bg-primary/15 data-active:text-foreground data-active:shadow-sm">
              Structure
            </TabsTrigger>
          </TabsList>
          <Button
            type="button"
            variant={draftRow ? "secondary" : "outline"}
            size="sm"
            className="h-7 gap-1.5 px-2 text-xs"
            disabled={columnNames.length === 0}
            onClick={() => {
              setDraftRow(Object.fromEntries(columnNames.map((column) => [column, ""])));
            }}
          >
            <RiAddLine data-icon="inline-start" />
            Add row
          </Button>
          {draftRow ? <span className="text-[0.625rem] text-primary/80">Draft row</span> : null}
          {selectedRowPayload ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 px-2 text-xs"
              onClick={() => setFeedback(exportJson(selectedRowPayload.text, exportJsonAction, "selected-row.json"))}
              aria-label={`Export selected row ${selectedRowIndex === null ? "" : selectedRowIndex + 1} as JSON`}
            >
              <RiDownloadLine data-icon="inline-start" />
              Export row
            </Button>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="h-6 rounded-full px-2 text-[0.625rem]">
            {data?.total ?? 0} rows
          </Badge>
          <Badge variant="secondary" className="h-6 rounded-full px-2 text-[0.625rem]">
            Showing {data?.rows.length ?? 0}
          </Badge>
        </div>
      </div>
    </Tabs>
  );
}

async function copyJson(text: string) {
  return (await copyJsonToClipboard(text)) === "success"
    ? "JSON copied to clipboard."
    : "Could not copy JSON.";
}

function exportJson(text: string, exportJsonAction: (text: string, filename: string) => JsonActionResult, filename = "table-data.json") {
  const result = exportJsonAction(text, filename);
  return result === "success"
    ? "JSON export started."
    : result === "cancelled"
      ? "JSON export cancelled."
      : "Could not export JSON.";
}

function formatCell(value: unknown) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function activateViewMode(event: KeyboardEvent<HTMLButtonElement>, nextMode: ViewMode, setViewMode: (mode: ViewMode) => void) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    setViewMode(nextMode);
  }
}
