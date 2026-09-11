import type { ColumnDef } from "@tanstack/react-table";

import { RiFileCopyLine, RiDownloadLine, RiRefreshLine } from "@remixicon/react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { ConnectionProfile, ViewMode } from "@/shared/types/models";

import {
  TableDataStructure,
  type StructureDraft,
} from "@/app/connection/components/table-data-structure";
import { TableDataToolbar } from "@/app/connection/components/table-data-toolbar";
import { useTableData } from "@/app/connection/hooks/use-table-data";
import { useTableSchema } from "@/app/connection/hooks/use-table-schema";
import { Tabs, TabsContent } from "@/components/animate-ui/components/radix/tabs";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/shared/components/data-table";
import { JsonCodePanel } from "@/shared/components/json-code-panel";
import { useDataTable } from "@/shared/hooks/use-data-table";
import {
  copyJsonToClipboard,
  exportJsonFile,
  type JsonActionResult,
} from "@/shared/lib/json-actions";
import { exceedsJsonRenderThreshold, serializeJson } from "@/shared/lib/json-serialization";

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
        .map((column) =>
          [
            column.name,
            column.data_type,
            column.enum_values.join(","),
            column.nullable,
            column.default ?? "",
            column.is_pk,
          ].join("::"),
        )
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
    () =>
      data
        ? serializeJson(data.columns, data.rows, { page: data.page, pageSize: data.page_size })
        : null,
    [data],
  );
  const canShowJson = Boolean(data && data.rows.length > 0 && data.columns.length > 0 && payload);
  const selectedRow = selectedRowIndex === null ? null : (data?.rows[selectedRowIndex] ?? null);
  const selectedRowPayload = useMemo(
    () => (selectedRow && data ? serializeJson(data.columns, [selectedRow]) : null),
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
    if (previousRefreshTokenRef.current === refreshToken) return;
    previousRefreshTokenRef.current = refreshToken;
    void refetch();
  }, [refreshToken, refetch]);
  useEffect(() => {
    if (!schemaColumns || lastStructureSignatureRef.current === structureSignature) return;
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

  if (isLoading)
    return (
      <div className="flex h-full min-h-0 flex-col">
        <p role="status" className="sr-only">
          Loading data...
        </p>
        <DataTable table={dataTable} isLoading />
      </div>
    );
  if (error)
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-muted-foreground">
        <p>Could not load data for {table}.</p>
        <p className="max-w-xl text-[0.65rem] text-destructive/80">{getErrorMessage(error)}</p>
        <Button variant="outline" size="sm" onClick={() => void refetch()}>
          <RiRefreshLine data-icon="inline-start" />
          Retry
        </Button>
      </div>
    );

  return (
    <Tabs
      defaultValue="data"
      className="flex h-full min-h-0 flex-col gap-0"
      onValueChange={(value) => {
        if (value === "structure") void tableSchema.refetch();
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
                  largeMessage={
                    exceedsJsonRenderThreshold(payload.rowCount)
                      ? "Large page: only loaded rows are shown."
                      : undefined
                  }
                  actions={
                    <>
                      <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        onClick={() => void copyJson(payload.text).then(setFeedback)}
                        aria-label="Copy table data JSON"
                      >
                        <RiFileCopyLine data-icon="inline-start" />
                        Copy
                      </Button>
                      <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        onClick={() => setFeedback(exportJson(payload.text, exportJsonAction))}
                        aria-label="Export table data JSON"
                      >
                        <RiDownloadLine data-icon="inline-start" />
                        Export
                      </Button>
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
                  onDraftChange={(column, value) =>
                    setDraftRow((row) => (row ? { ...row, [column]: value } : row))
                  }
                />
              )}
            </div>
            <p aria-live="polite" className="sr-only">
              {feedback}
            </p>
          </div>
        </TabsContent>
        <TabsContent value="structure" className="min-h-0 max-h-full overflow-auto p-4 m-0">
          <TableDataStructure
            structureDraft={structureDraft}
            setStructureDraft={setStructureDraft}
            isLoading={tableSchema.isLoading}
            error={tableSchema.error}
          />
        </TabsContent>
      </div>
      <TableDataToolbar
        canShowJson={canShowJson}
        viewMode={viewMode}
        setViewMode={setViewMode}
        columnNames={columnNames}
        draftRow={draftRow}
        setDraftRow={setDraftRow}
        selectedRowIndex={selectedRowIndex}
        selectedRowPayload={selectedRowPayload}
        setFeedback={(value) => setFeedback(value)}
        exportJson={exportJson}
        exportJsonAction={exportJsonAction}
        total={data?.total ?? 0}
        loaded={data?.rows.length ?? 0}
      />
    </Tabs>
  );
}

async function copyJson(text: string) {
  return (await copyJsonToClipboard(text)) === "success"
    ? "JSON copied to clipboard."
    : "Could not copy JSON.";
}
function exportJson(
  text: string,
  action: (text: string, filename: string) => JsonActionResult,
  filename = "table-data.json",
) {
  const result = action(text, filename);
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
