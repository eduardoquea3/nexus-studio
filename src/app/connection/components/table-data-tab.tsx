import type { Row } from "@tanstack/react-table";

import { RiFileCopyLine, RiDownloadLine, RiRefreshLine } from "@remixicon/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ConnectionProfile, ViewMode } from "@/shared/types/models";

import { TableDataGrid } from "@/app/connection/components/table-data-grid";
import {
  TableDataStructure,
  type StructureDraft,
} from "@/app/connection/components/table-data-structure";
import { TableDataToolbar } from "@/app/connection/components/table-data-toolbar";
import { useInvalidateTableData, useTableData } from "@/app/connection/hooks/use-table-data";
import { useTableSchema } from "@/app/connection/hooks/use-table-schema";
import { deleteTableRows } from "@/app/connection/services/table-data-delete-service";
import { exportTableDataJson } from "@/app/connection/services/table-data-export-service";
import { insertTableRow } from "@/app/connection/services/table-data-insert-service";
import {
  buildRowIdentity,
  serializeRowIdentity,
} from "@/app/connection/services/table-data-row-identity";
import { Tabs, TabsContent } from "@/components/animate-ui/components/radix/tabs";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { JsonCodePanel } from "@/shared/components/json-code-panel";
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
  isActive?: boolean;
  refreshToken?: number;
  exportJson?: (text: string, filename: string) => JsonActionResult;
};

export function TableDataTab({
  profile,
  table,
  schema,
  isActive = true,
  refreshToken = 0,
  exportJson: exportJsonAction = exportJsonFile,
}: TableDataTabProps) {
  const [page, setPage] = useState(1);
  const { data, error, isLoading, isFetching, refetch } = useTableData(
    profile,
    table,
    schema,
    page,
    isActive,
  );
  const tableSchema = useTableSchema(profile, table, isActive, schema);
  const invalidateTableData = useInvalidateTableData(profile, table, schema);
  const [structureDraft, setStructureDraft] = useState<StructureDraft[]>([]);
  const [draftRow, setDraftRow] = useState<Record<string, unknown> | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [selectedRows, setSelectedRows] = useState<Record<string, unknown>[]>([]);
  const [pendingDeletions, setPendingDeletions] = useState<Map<string, Record<string, unknown>>>(
    () => new Map(),
  );
  const [selectionResetToken, setSelectionResetToken] = useState(0);
  const [isExportingRows, setIsExportingRows] = useState(false);
  const [isInsertingRow, setIsInsertingRow] = useState(false);
  const [isApplyingDeletions, setIsApplyingDeletions] = useState(false);
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
  const handleSelectionChange = useCallback((rows: Row<Record<string, unknown>>[]) => {
    setSelectedRows(rows.map((row) => row.original));
  }, []);
  const handleDraftChange = useCallback((column: string, value: string) => {
    setDraftRow((row) => (row ? { ...row, [column]: value } : row));
  }, []);
  const handlePageChange = useCallback(
    (nextPage: number) => {
      if (nextPage !== page) setDraftRow(null);
      setPage(nextPage);
    },
    [page],
  );
  const payload = useMemo(
    () =>
      data
        ? serializeJson(data.columns, selectedRows.length > 0 ? selectedRows : data.rows, {
            page: data.page,
            pageSize: data.page_size,
          })
        : null,
    [data, selectedRows],
  );
  const canShowJson = Boolean(data && data.rows.length > 0 && data.columns.length > 0 && payload);
  const rowsToExport = selectedRows;
  const primaryKeyColumns = useMemo(
    () => (schemaColumns ?? []).filter((column) => column.is_pk),
    [schemaColumns],
  );
  const canMarkSelectedForDeletion =
    primaryKeyColumns.length > 0 &&
    selectedRows.length > 0 &&
    selectedRows.every((row) => buildRowIdentity(row, primaryKeyColumns) !== null);
  const isRowPending = useCallback(
    (row: Record<string, unknown>) => {
      const identity = buildRowIdentity(row, primaryKeyColumns);
      return identity !== null && pendingDeletions.has(serializeRowIdentity(identity));
    },
    [pendingDeletions, primaryKeyColumns],
  );

  const handleInsertRow = async () => {
    if (!draftRow || isInsertingRow) return;

    setIsInsertingRow(true);
    try {
      await insertTableRow(profile, table, schema, draftRow, schemaColumns ?? []);
      setDraftRow(null);
      toast.add({
        title: "Row inserted",
        type: "success",
        description: `A row was added to ${table}.`,
      });
      void refetch();
    } catch (error) {
      toast.add({
        title: "Could not insert row",
        type: "error",
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsInsertingRow(false);
    }
  };

  const handleMarkSelectedForDeletion = () => {
    if (!canMarkSelectedForDeletion) return;

    setPendingDeletions((current) => {
      const next = new Map(current);
      for (const row of selectedRows) {
        const identity = buildRowIdentity(row, primaryKeyColumns);
        if (identity !== null) next.set(serializeRowIdentity(identity), identity);
      }
      return next;
    });
    setSelectedRows([]);
    setSelectionResetToken((token) => token + 1);
  };

  const handleUndoPendingDeletion = () => {
    setPendingDeletions((current) => {
      if (current.size === 0) return current;
      const keys = Array.from(current.keys());
      const lastKey = keys[keys.length - 1];
      if (lastKey === undefined) return current;
      const next = new Map(current);
      next.delete(lastKey);
      return next;
    });
  };

  const handleCancelPendingDeletions = () => {
    setPendingDeletions((current) => (current.size === 0 ? current : new Map()));
  };

  const handleApplyPendingDeletions = async () => {
    if (pendingDeletions.size === 0 || isApplyingDeletions) return;

    const pkMaps = Array.from(pendingDeletions.values());
    setIsApplyingDeletions(true);
    try {
      const affectedRows = await deleteTableRows(profile, table, schema, pkMaps);
      setPendingDeletions(new Map());
      setSelectedRows([]);
      setSelectionResetToken((token) => token + 1);
      toast.add({
        title: `Deleted ${affectedRows} ${affectedRows === 1 ? "row" : "rows"}`,
        type: "success",
        description: `Deleted ${affectedRows} ${affectedRows === 1 ? "row" : "rows"} from ${table}.`,
      });
      invalidateTableData();
    } catch (error) {
      toast.add({
        title: "Could not delete rows",
        type: "error",
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsApplyingDeletions(false);
    }
  };

  useEffect(() => {
    setPage(1);
    setPendingDeletions((current) => (current.size === 0 ? current : new Map()));
    setSelectedRows([]);
  }, [profile.id, table, schema]);
  useEffect(() => {
    setViewMode("table");
    setFeedback(null);
    setSelectedRows([]);
  }, [table]);
  useEffect(() => {
    setSelectedRows([]);
  }, [data?.rows]);
  useEffect(() => {
    if (!isActive) {
      previousRefreshTokenRef.current = refreshToken;
      return;
    }
    if (previousRefreshTokenRef.current === refreshToken) return;
    previousRefreshTokenRef.current = refreshToken;
    void refetch();
  }, [isActive, refreshToken, refetch]);
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

  const handleExportRows = async () => {
    if (!data || rowsToExport.length === 0) return;

    setIsExportingRows(true);
    const rowCount = rowsToExport.length;
    const filename = rowCount === 1 ? "selected-row.json" : "selected-rows.json";
    try {
      const json = serializeJson(data.columns, rowsToExport).text;
      const result = await exportTableDataJson(json, filename);
      if (result.status === "success") {
        const noun = rowCount === 1 ? "row" : "rows";
        toast.add({
          title: `Exported ${rowCount} ${noun}`,
          type: "success",
          description: result.path,
        });
        setFeedback(`Exported ${rowCount} ${noun} to ${result.path}.`);
      } else if (result.status === "error") {
        toast.add({
          title: "Could not export rows",
          type: "error",
          description: result.message,
        });
      } else {
        setFeedback("JSON export cancelled.");
      }
    } finally {
      setIsExportingRows(false);
    }
  };

  if (isLoading)
    return (
      <div className="flex h-full min-h-0 flex-col">
        <p role="status" className="sr-only">
          Loading data...
        </p>
        <TableDataGrid data={data} draftColumns={schemaColumns} isLoading withShell />
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
        <TabsContent
          value="data"
          className="h-full min-h-0 overflow-hidden p-0 m-0"
          transition={{ duration: 0 }}
        >
          <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-b-xl">
            <div className="min-h-0 flex-1 overflow-hidden">
              {viewMode === "json" && canShowJson && payload ? (
                <JsonCodePanel
                  ariaLabel="Table data JSON"
                  text={payload.text}
                  fontScope="results"
                  meta={`Page ${data?.page ?? 0} · ${payload.rowCount} ${selectedRows.length > 0 ? "selected" : "loaded"}`}
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
                <TableDataGrid
                  data={data}
                  isLoading={
                    isLoading || isFetching || (columnNames.length === 0 && tableSchema.isLoading)
                  }
                  withShell={false}
                  className="h-full [&_tr>:first-child]:w-px [&_tr>:first-child]:text-center [&_[data-row-selector]]:justify-center [&_[data-row-selector]]:text-center"
                  rowNumberOffset={((data?.page ?? page) - 1) * (data?.page_size ?? 100)}
                  draftRow={draftRow}
                  draftColumns={schemaColumns}
                  onSelectionChange={handleSelectionChange}
                  onDraftChange={handleDraftChange}
                  isRowPending={isRowPending}
                  selectionResetToken={selectionResetToken}
                />
              )}
            </div>
            <p aria-live="polite" className="sr-only">
              {feedback}
            </p>
          </div>
        </TabsContent>
        <TabsContent
          value="structure"
          className="min-h-0 max-h-full overflow-auto p-4 m-0"
          transition={{ duration: 0 }}
        >
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
        setViewMode={(nextViewMode) => {
          if (viewMode === "json" && nextViewMode === "table") setSelectedRows([]);
          setViewMode(nextViewMode);
        }}
        columnNames={columnNames}
        draftRow={draftRow}
        setDraftRow={setDraftRow}
        selectedRowCount={rowsToExport.length}
        canMarkSelectedForDeletion={canMarkSelectedForDeletion}
        pendingDeletionCount={pendingDeletions.size}
        isApplyingDeletions={isApplyingDeletions}
        onMarkSelectedForDeletion={handleMarkSelectedForDeletion}
        onUndoPendingDeletion={handleUndoPendingDeletion}
        onCancelPendingDeletions={handleCancelPendingDeletions}
        onApplyPendingDeletions={() => void handleApplyPendingDeletions()}
        onExportRows={() => void handleExportRows()}
        isExportingRows={isExportingRows}
        onRefresh={() => void refetch()}
        page={page}
        pageCount={Math.max(1, Math.ceil((data?.total ?? 0) / (data?.page_size || 100)))}
        isLoading={isFetching}
        isInsertingRow={isInsertingRow}
        onInsertRow={() => void handleInsertRow()}
        onPageChange={handlePageChange}
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
function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
