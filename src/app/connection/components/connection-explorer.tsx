import {
  RiArrowRightSLine,
  RiFunctionLine,
  RiGitBranchLine,
  RiLoader4Line,
  RiRefreshLine,
  RiSearchLine,
  RiTableLine,
  RiEyeLine,
} from "@remixicon/react";

import type { ColumnInfo, ObjectMeta } from "@/shared/types/models";

import {
  FileItem,
  Files,
  FolderContent,
  FolderItem,
  FolderTrigger,
} from "@/components/animate-ui/components/radix/files";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const explorerGroups = [
  {
    id: "tables",
    label: "Tables",
    objectType: "table",
    emptyLabel: "No tables found",
    icon: RiTableLine,
  },
  {
    id: "views",
    label: "Views",
    objectType: "view",
    emptyLabel: "No views found",
    icon: RiEyeLine,
  },
  {
    id: "functions",
    label: "Functions",
    objectType: "function",
    emptyLabel: "No functions found",
    icon: RiFunctionLine,
  },
  {
    id: "procedures",
    label: "Procedures",
    objectType: "procedure",
    emptyLabel: "No procedures found",
    icon: RiGitBranchLine,
  },
] as const;

type ConnectionExplorerProps = {
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

export function ConnectionExplorer({
  dbType,
  schemaObjects,
  isLoading,
  error,
  isFetching,
  refetch,
  filterText,
  setFilterText,
  normalizedFilter,
  openGroups,
  setOpenGroups,
  expandedTables,
  tableColumns,
  loadingTables,
  tableSchemaErrors,
  tableResourceKey,
  toggleTable,
  onTableSelect,
  onRoutineSelect,
}: ConnectionExplorerProps) {
  const availableGroups = explorerGroups.filter(
    (group) => dbType !== "sqlite" || group.objectType === "table" || group.objectType === "view",
  );
  const matchingGroups = availableGroups
    .filter((group) =>
      schemaObjects.some(
        (object) =>
          object.object_type === group.objectType &&
          object.name.toLowerCase().includes(normalizedFilter),
      ),
    )
    .map((group) => group.id);
  return (
    <>
      <div className="flex items-center justify-between gap-2 px-2 py-2">
        <p className="text-[0.65rem] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Explorer
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="rounded-sm"
          aria-label="Refresh explorer"
          title="Refresh explorer"
          onClick={() => void refetch()}
          disabled={isFetching}
        >
          <RiRefreshLine className={cn(isFetching && "animate-spin")} aria-hidden="true" />
        </Button>
      </div>
      <div className="relative px-2 pb-2">
        <RiSearchLine
          className="pointer-events-none absolute left-4 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          aria-label="Filter explorer"
          value={filterText}
          onChange={(event) => setFilterText(event.target.value)}
          placeholder="Filter explorer..."
          className="h-7 pl-8 text-xs"
        />
      </div>
      {isLoading ? (
        <p className="px-2 py-2 text-[0.65rem] text-muted-foreground">Loading...</p>
      ) : error ? (
        <p className="px-2 py-2 text-[0.65rem] text-destructive">Unable to load objects</p>
      ) : normalizedFilter && matchingGroups.length === 0 ? (
        <p className="px-2 py-2 text-[0.65rem] text-muted-foreground">No matching objects</p>
      ) : (
        <Files open={openGroups} onOpenChange={setOpenGroups} className="min-w-0 p-0">
          {availableGroups.map((group) => {
            const objects = schemaObjects.filter(
              (object) =>
                object.object_type === group.objectType &&
                object.name.toLowerCase().includes(normalizedFilter),
            );
            return (
              <FolderItem key={group.id} value={group.id}>
                <FolderTrigger icon={group.icon} className="text-xs">
                  <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                    <span>{group.label}</span>
                    <span className="text-[0.65rem] text-muted-foreground">{objects.length}</span>
                  </span>
                </FolderTrigger>
                <FolderContent>
                  {objects.length === 0 ? (
                    <p className="px-2 py-1 text-[0.65rem] text-muted-foreground">
                      {normalizedFilter ? "No matching objects" : group.emptyLabel}
                    </p>
                  ) : (
                    objects.map((object) => {
                      const isTable = group.objectType === "table";
                      const resourceKey = tableResourceKey(object.schema, object.name);
                      const isExpanded = expandedTables.includes(resourceKey);
                      const columns = tableColumns[resourceKey];
                      return (
                        <div key={resourceKey}>
                          {isTable ? (
                            <div className="group flex items-center gap-2 rounded-md p-2 text-xs transition-colors hover:bg-muted/60 hover:text-foreground">
                              <button
                                type="button"
                                className="group/icon relative flex size-4.5 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                                aria-label={`${isExpanded ? "Collapse" : "Expand"} ${object.name} columns`}
                                title={`${isExpanded ? "Collapse" : "Expand"} columns`}
                                onClick={() => void toggleTable(object.name, object.schema)}
                              >
                                <RiTableLine
                                  className={cn(
                                    "size-4 transition-opacity",
                                    isExpanded ? "hidden" : "group-hover/icon:opacity-0",
                                  )}
                                  aria-hidden="true"
                                />
                                <RiArrowRightSLine
                                  className={cn(
                                    "absolute size-3.5 opacity-0 transition-transform group-hover/icon:opacity-100",
                                    isExpanded && "rotate-90 opacity-100",
                                  )}
                                  aria-hidden="true"
                                />
                              </button>
                              <span
                                role="button"
                                tabIndex={0}
                                className="min-w-0 flex-1 truncate cursor-default"
                                onDoubleClick={() => onTableSelect(object.name, object.schema)}
                                onKeyDown={(event) => {
                                  if (event.key === " " || event.key === "Enter") {
                                    if (event.key === " ") event.preventDefault();
                                    onTableSelect(object.name, object.schema);
                                  }
                                }}
                              >
                                {object.name}
                              </span>
                            </div>
                          ) : (
                            <FileItem
                              icon={group.icon}
                              className={cn(
                                "text-xs",
                                (group.objectType === "function" ||
                                  group.objectType === "procedure") &&
                                  "cursor-pointer hover:text-foreground",
                              )}
                              onDoubleClick={
                                group.objectType === "function" || group.objectType === "procedure"
                                  ? () => onRoutineSelect(object)
                                  : undefined
                              }
                            >
                              {object.name}
                            </FileItem>
                          )}
                          {isTable && isExpanded ? (
                            <div className="ml-8 border-l border-border/60 py-1 pl-2">
                              {loadingTables[resourceKey] ? (
                                <div className="flex items-center gap-1.5 px-2 py-1 text-[0.65rem] text-muted-foreground">
                                  <RiLoader4Line
                                    className="size-3 animate-spin"
                                    aria-hidden="true"
                                  />
                                  Loading columns...
                                </div>
                              ) : tableSchemaErrors[resourceKey] ? (
                                <p className="px-2 py-1 text-[0.65rem] text-destructive">
                                  Unable to load columns
                                </p>
                              ) : columns?.length ? (
                                <div className="space-y-0.5">
                                  {columns.map((column) => (
                                    <div
                                      key={column.name}
                                      className="flex min-w-0 items-center justify-between gap-2 rounded px-2 py-1 text-[0.65rem]"
                                      title={`${column.name}: ${column.data_type}`}
                                    >
                                      <span className="min-w-0 flex-[2] truncate text-foreground/80">
                                        {column.name}
                                      </span>
                                      <span className="min-w-0 max-w-24 flex-1 truncate text-right text-muted-foreground">
                                        {column.data_type}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="px-2 py-1 text-[0.65rem] text-muted-foreground">
                                  No columns found
                                </p>
                              )}
                            </div>
                          ) : null}
                        </div>
                      );
                    })
                  )}
                </FolderContent>
              </FolderItem>
            );
          })}
        </Files>
      )}
    </>
  );
}
