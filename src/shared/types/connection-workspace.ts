import type { QueryResult, ViewMode } from "./models";

export interface WorkspaceTabBase {
  id: string;
  connectionId: string;
}

export interface QueryTab extends WorkspaceTabBase {
  type: "query";
  database: string;
  title: string;
  query: string;
  isDirty: boolean;
  queryResult: QueryResult | null;
  queryError: string | null;
  viewMode: ViewMode;
}

export interface DataTableTab extends WorkspaceTabBase {
  type: "datatable";
  database: string;
  schema?: string;
  tableName: string;
}

export interface RoutineTab extends WorkspaceTabBase {
  type: "routine";
  database: string;
  schema?: string;
  routineName: string;
  routineType: "function" | "procedure";
  signature?: string;
  title: string;
  query: string;
  isDirty: boolean;
}

export type WorkspaceTab = QueryTab | DataTableTab | RoutineTab;
