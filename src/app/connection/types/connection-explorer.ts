import type { ColumnInfo, ObjectMeta } from "@/shared/types/models";

export type ConnectionExplorerProps = {
  dbType: ObjectMeta["object_type"] | string;
  schemaObjects: ObjectMeta[];
  isLoading: boolean;
  error: unknown;
  isFetching: boolean;
  refetch: () => unknown;
  filterText: string;
  setFilterText: (value: string) => void;
  normalizedFilter: string;
  openGroups: string[];
  setOpenGroups: (groups: string[]) => void;
  expandedTables: string[];
  tableColumns: Record<string, ColumnInfo[]>;
  loadingTables: Record<string, boolean>;
  tableSchemaErrors: Record<string, boolean>;
  tableResourceKey: (schema: string | undefined, table: string) => string;
  toggleTable: (table: string, schema?: string) => void;
  onTableSelect: (table: string, schema?: string) => void;
  onRoutineSelect: (routine: ObjectMeta) => void;
};
