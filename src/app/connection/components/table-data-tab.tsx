import { RiRefreshLine } from "@remixicon/react";
import { useMemo } from "react";
import { useEffect, useRef, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";

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
import { useDataTable } from "@/shared/hooks/use-data-table";
import type { ConnectionProfile } from "@/shared/types/models";

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
};

export function TableDataTab({ profile, table }: TableDataTabProps) {
  const { data, error, isLoading, refetch } = useTableData(profile, table);
  const schema = useTableSchema(profile, table, true);
  const [structureDraft, setStructureDraft] = useState<StructureDraft[]>([]);
  const schemaColumns = schema.data?.columns;
  const columnNames = data?.columns.length
    ? data.columns
    : (schemaColumns ?? []).map((column) => column.name);
  const structureSignature = schemaColumns
    ? schemaColumns
        .map((column) => [column.name, column.data_type, column.nullable, column.default ?? "", column.is_pk].join("::"))
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
    return <DataTable table={dataTable} isLoading />;
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
          void schema.refetch();
        }
      }}
    >
      <div className="min-h-0 flex-1 overflow-hidden">
        <TabsContent value="data" className="h-full min-h-0 overflow-hidden p-0 m-0">
          <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-b-xl">
            <div className="min-h-0 flex-1 overflow-hidden">
              <DataTable
                table={dataTable}
                isLoading={isLoading || (columnNames.length === 0 && schema.isLoading)}
                withShell={false}
                className="h-full"
              />
            </div>
          </div>
        </TabsContent>
        <TabsContent value="structure" className="h-full min-h-0 overflow-auto p-4 m-0">
          {schema.isLoading ? (
            <div className="text-xs text-muted-foreground">Loading structure...</div>
          ) : schema.error ? (
            <div className="text-xs text-destructive">Could not load table structure.</div>
          ) : (
            <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border/70 bg-card/40">
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
              <div className="min-h-0 flex-1 overflow-auto">
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
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={column.nullable}
                              onChange={(event) => {
                                setStructureDraft((rows) =>
                                  rows.map((row) =>
                                    row.name === column.name ? { ...row, nullable: event.target.checked } : row,
                                  ),
                                );
                              }}
                              className="size-3.5 rounded border-border bg-background text-primary focus-visible:ring-2 focus-visible:ring-ring/30"
                            />
                            <span>{column.nullable ? "YES" : "NO"}</span>
                          </label>
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
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={column.is_pk}
                              onChange={(event) => {
                                setStructureDraft((rows) =>
                                  rows.map((row) =>
                                    row.name === column.name ? { ...row, is_pk: event.target.checked } : row,
                                  ),
                                );
                              }}
                              className="size-3.5 rounded border-border bg-background text-primary focus-visible:ring-2 focus-visible:ring-ring/30"
                            />
                          </label>
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
        <TabsList className="h-auto justify-start gap-1 rounded-none bg-transparent p-0">
          <TabsTrigger value="data" className="h-7 px-2 text-xs">
            Data
          </TabsTrigger>
          <TabsTrigger value="structure" className="h-7 px-2 text-xs">
            Structure
          </TabsTrigger>
        </TabsList>
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

function formatCell(value: unknown) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
