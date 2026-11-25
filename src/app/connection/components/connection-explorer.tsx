import { useState } from "react";
import type { ReactNode } from "react";
import {
  RiArrowRightSLine,
  RiKey2Line,
  RiLayoutColumnLine,
  RiLink,
  RiListUnordered,
  RiLoader4Line,
  RiRefreshLine,
  RiSearchLine,
  RiTableLine,
} from "@remixicon/react";

import {
  FileItem,
  Files,
  FolderContent,
  FolderItem,
  FolderTrigger,
} from "@/components/animate-ui/components/radix/files";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import type { ConnectionExplorerProps } from "../types/connection-explorer";
import type { SidebarTableMetadata } from "@/shared/lib/tauriApi";

import { getColumnTypeBadgeStyle } from "../utils/column-type-badge";
import { explorerGroups } from "../utils/connection-explorer";

function MetadataGroup({
  title,
  count,
  icon,
  children,
}: {
  title: string;
  count: number;
  icon: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section className="min-w-0">
      <button
        type="button"
        aria-label={title}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="group flex h-6 w-full min-w-0 items-center gap-1.5 rounded-sm px-1 text-[0.68rem] text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <RiArrowRightSLine
          className={cn("size-3.5 shrink-0 transition-transform", open && "rotate-90")}
          aria-hidden="true"
        />
        {icon}
        <span className="min-w-0 flex-1 truncate text-left">{title}</span>
        <span className="shrink-0 tabular-nums text-[0.625rem] text-muted-foreground/75">
          {count}
        </span>
      </button>
      {open ? <div className="ml-3.5 border-l border-border/60 py-0.5 pl-2">{children}</div> : null}
    </section>
  );
}

function groupByName<T extends { name: string }>(items: T[]) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const group = groups.get(item.name);
    if (group) group.push(item);
    else groups.set(item.name, [item]);
  }
  return [...groups.entries()];
}

type ExplorerProps = ConnectionExplorerProps & {
  tableMetadata?: Record<string, SidebarTableMetadata>;
};

export function ConnectionExplorer({
  tableMetadata,
  dbType,
  selectedTableName,
  selectedTableSchema,
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
}: ExplorerProps) {
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
        <p className="text-2xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
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
      <div className="relative mx-2 mb-2">
        <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center">
          <RiSearchLine className="size-3.5 text-muted-foreground" aria-hidden="true" />
        </span>
        <Input
          aria-label="Filter explorer"
          value={filterText}
          onChange={(event) => setFilterText(event.target.value)}
          placeholder="Filter explorer..."
          className="h-7 pl-8 text-xs"
        />
      </div>
      {isLoading ? (
        <p className="px-2 py-2 text-2xs text-muted-foreground">Loading...</p>
      ) : error ? (
        <p className="px-2 py-2 text-2xs text-destructive">Unable to load objects</p>
      ) : normalizedFilter && matchingGroups.length === 0 ? (
        <p className="px-2 py-2 text-2xs text-muted-foreground">No matching objects</p>
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
                <FolderTrigger icon={group.icon} className="text-xs text-foreground hover:bg-muted">
                  <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                    <span>{group.label}</span>
                    <span className="text-2xs text-muted-foreground">{objects.length}</span>
                  </span>
                </FolderTrigger>
                <FolderContent>
                  {objects.length === 0 ? (
                    <p className="px-2 py-1 text-2xs text-muted-foreground">
                      {normalizedFilter ? "No matching objects" : group.emptyLabel}
                    </p>
                  ) : (
                    objects.map((object) => {
                      const isTable = group.objectType === "table";
                      const isSelectedTable =
                        isTable &&
                        object.name === selectedTableName &&
                        (!selectedTableSchema || object.schema === selectedTableSchema);
                      const resourceKey = tableResourceKey(object.schema, object.name);
                      const isExpanded = expandedTables.includes(resourceKey);
                      const columns = tableColumns[resourceKey];
                      const metadata = tableMetadata?.[resourceKey];
                      const metadataIndexes = groupByName(metadata?.indexes ?? []);
                      const keyGroups = metadataIndexes.filter(([, members]) =>
                        members.some((item) => item.isPrimary || item.isUnique),
                      );
                      const foreignKeyGroups = groupByName(metadata?.foreignKeys ?? []);
                      const displayColumns = columns ?? metadata?.columns;
                      const renderIndex = (
                        name: string,
                        members: NonNullable<typeof metadata>["indexes"],
                      ) => {
                        const first = members[0];
                        return (
                          <p
                            key={name}
                            className="truncate px-2 py-0.5 text-[0.68rem] text-muted-foreground"
                            title={`${name}: ${members.map((item) => item.column).join(", ")}`}
                          >
                            {name}: {members.map((item) => item.column).join(", ")}
                            {first?.isPrimary ? " · primary" : ""}
                            {first?.isUnique ? " · unique" : ""}
                          </p>
                        );
                      };
                      return (
                        <div key={resourceKey}>
                          {isTable ? (
                            <div
                              className={cn(
                                "group flex items-center gap-2 rounded-sm px-1 py-0.5 text-xs transition-colors hover:bg-muted/70 hover:text-foreground",
                                isSelectedTable &&
                                  "bg-accent text-accent-foreground ring-1 ring-inset ring-ring/35",
                              )}
                            >
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
                                    isSelectedTable && "text-accent-foreground",
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
                            <div className="ml-7 border-l border-border/60 py-0.5 pl-2">
                              <div className="space-y-0.5">
                                {loadingTables[resourceKey] && !displayColumns ? (
                                  <div className="flex items-center gap-1.5 px-2 py-1 text-2xs text-muted-foreground">
                                    <RiLoader4Line
                                      className="size-3 animate-spin"
                                      aria-hidden="true"
                                    />
                                    Loading columns...
                                  </div>
                                ) : tableSchemaErrors[resourceKey] && !displayColumns ? (
                                  <p className="px-2 py-1 text-2xs text-destructive">
                                    Unable to load columns
                                  </p>
                                ) : displayColumns ? (
                                  <MetadataGroup
                                    title="Columns"
                                    count={displayColumns.length}
                                    icon={
                                      <RiLayoutColumnLine
                                        className="size-3.5 shrink-0 text-amber-400"
                                        aria-hidden="true"
                                      />
                                    }
                                  >
                                    {displayColumns.length ? (
                                      displayColumns.map((column) => {
                                        const typeBadge = getColumnTypeBadgeStyle(column.data_type);
                                        return (
                                          <div
                                            key={column.name}
                                            className="flex min-w-0 items-center justify-between gap-2 rounded px-2 py-0.5 text-[0.68rem] hover:bg-muted/50"
                                            title={`${column.name}: ${column.data_type}`}
                                          >
                                            <span className="min-w-0 flex-[2] truncate text-foreground/85">
                                              {column.name}
                                            </span>
                                            <Badge
                                              variant="outline"
                                              className={cn(
                                                "min-w-0 max-w-24 flex-1 truncate px-1.5 py-0 text-[0.625rem]",
                                                typeBadge.className,
                                              )}
                                              title={column.data_type}
                                            >
                                              {typeBadge.label}
                                            </Badge>
                                          </div>
                                        );
                                      })
                                    ) : (
                                      <p className="px-2 py-1 text-[0.68rem] text-muted-foreground">
                                        No columns found
                                      </p>
                                    )}
                                  </MetadataGroup>
                                ) : null}
                                {metadata ? (
                                  <>
                                    <MetadataGroup
                                      title="Keys"
                                      count={keyGroups.length}
                                      icon={
                                        <RiKey2Line
                                          className="size-3.5 shrink-0 text-orange-400"
                                          aria-hidden="true"
                                        />
                                      }
                                    >
                                      {keyGroups.length ? (
                                        keyGroups.map(([name, members]) =>
                                          renderIndex(name, members),
                                        )
                                      ) : (
                                        <p className="px-2 py-1 text-[0.68rem] text-muted-foreground">
                                          No keys found
                                        </p>
                                      )}
                                    </MetadataGroup>
                                    <MetadataGroup
                                      title="Foreign keys"
                                      count={foreignKeyGroups.length}
                                      icon={
                                        <RiLink
                                          className="size-3.5 shrink-0 text-amber-500"
                                          aria-hidden="true"
                                        />
                                      }
                                    >
                                      {foreignKeyGroups.length ? (
                                        foreignKeyGroups.map(([name, members]) => {
                                          const details = members
                                            .map(
                                              (item) =>
                                                `${item.column} → ${item.referencedTable}.${item.referencedColumn}`,
                                            )
                                            .join(", ");
                                          return (
                                            <p
                                              key={name}
                                              className="truncate px-2 py-0.5 text-[0.68rem] text-muted-foreground"
                                              title={`${name}: ${details}`}
                                            >
                                              {name}: {details}
                                            </p>
                                          );
                                        })
                                      ) : (
                                        <p className="px-2 py-1 text-[0.68rem] text-muted-foreground">
                                          No foreign keys found
                                        </p>
                                      )}
                                    </MetadataGroup>
                                    <MetadataGroup
                                      title="Indexes"
                                      count={metadataIndexes.length}
                                      icon={
                                        <RiListUnordered
                                          className="size-3.5 shrink-0 text-emerald-400"
                                          aria-hidden="true"
                                        />
                                      }
                                    >
                                      {metadataIndexes.length ? (
                                        metadataIndexes.map(([name, members]) =>
                                          renderIndex(name, members),
                                        )
                                      ) : (
                                        <p className="px-2 py-1 text-[0.68rem] text-muted-foreground">
                                          No indexes found
                                        </p>
                                      )}
                                    </MetadataGroup>
                                  </>
                                ) : null}
                              </div>
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
