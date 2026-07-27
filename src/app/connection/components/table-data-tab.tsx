import { RiRefreshLine } from "@remixicon/react";
import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
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

type TableDataTabProps = {
  profile: ConnectionProfile;
  table: string;
};

export function TableDataTab({ profile, table }: TableDataTabProps) {
  const { data, error, isLoading, refetch } = useTableData(profile, table);
  const schema = useTableSchema(profile, table, false);
  const columns = useMemo<ColumnDef<Record<string, unknown>, unknown>[]>(
    () =>
      (data?.columns ?? []).map((column) => ({
        accessorKey: column,
        header: column,
        cell: (context) => formatCell(context.getValue()),
      })),
    [data?.columns],
  );
  const dataTable = useDataTable({ columns, data: data?.rows ?? [] });

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

  if (!data || data.columns.length === 0) {
    return <div className="flex h-full items-center justify-center text-muted-foreground">{table} is empty.</div>;
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
      <TabsList className="h-9 shrink-0 justify-start rounded-none border-b border-border/70 bg-muted/10 px-3">
        <TabsTrigger value="data" className="h-8 text-xs">
          Data
        </TabsTrigger>
        <TabsTrigger value="structure" className="h-8 text-xs">
          Structure
        </TabsTrigger>
      </TabsList>
      <TabsContent value="data" className="min-h-0 flex-1 overflow-hidden">
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b border-border/70 px-4 py-2 text-xs text-muted-foreground">
        <span>{data.total} rows</span>
        <span>Showing {data.rows.length}</span>
      </div>
      <DataTable table={dataTable} isLoading={isLoading} className="min-h-0 flex-1" />
    </div>
      </TabsContent>
      <TabsContent value="structure" className="min-h-0 flex-1 overflow-auto p-4">
        {schema.isLoading ? (
          <div className="text-xs text-muted-foreground">Loading structure...</div>
        ) : schema.error ? (
          <div className="text-xs text-destructive">Could not load table structure.</div>
        ) : (
          <table className="w-full border-collapse text-xs">
            <thead className="bg-muted/90 text-left">
              <tr>
                <th className="border-b border-r border-border/70 px-3 py-2 font-medium">Column</th>
                <th className="border-b border-r border-border/70 px-3 py-2 font-medium">Type</th>
                <th className="border-b border-r border-border/70 px-3 py-2 font-medium">Nullable</th>
                <th className="border-b border-border/70 px-3 py-2 font-medium">Default</th>
              </tr>
            </thead>
            <tbody>
              {(schema.data?.columns ?? []).map((column) => (
                <tr key={column.name}>
                  <td className="border-b border-r border-border/50 px-3 py-2">{column.name}</td>
                  <td className="border-b border-r border-border/50 px-3 py-2 text-muted-foreground">{column.data_type}</td>
                  <td className="border-b border-r border-border/50 px-3 py-2">{column.nullable ? "YES" : "NO"}</td>
                  <td className="border-b border-border/50 px-3 py-2 text-muted-foreground">{column.default ?? "NULL"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </TabsContent>
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
