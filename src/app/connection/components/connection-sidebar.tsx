import { useNavigate } from "@tanstack/react-router";
import {
  RiArrowLeftRightLine,
  RiArrowRightSLine,
  RiDatabase2Line,
  RiEditLine,
  RiEyeLine,
  RiFunctionLine,
  RiGitBranchLine,
  RiLogoutBoxLine,
  RiRefreshLine,
  RiSearchLine,
  RiTableLine,
  RiLoader4Line,
} from "@remixicon/react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/animate-ui/components/radix/dropdown-menu";
import {
  FileItem,
  Files,
  FolderContent,
  FolderItem,
  FolderTrigger,
} from "@/components/animate-ui/components/radix/files";
import { useDatabases } from "@/app/connection/hooks/use-databases";
import { useSchemaObjects } from "@/app/connection/hooks/use-schema-objects";
import { useConnections } from "@/app/home/hooks/use-connections";
import { getInitialDatabase } from "@/app/connection/services/database-service";
import { markConnectionOpened } from "@/app/home/services/connection-service";
import { Select } from "@/shared/components/ui/select";
import { useModalStore } from "@/shared/store/modalStore";
import { useThemeStore } from "@/shared/store/theme-store";
import type { ColumnInfo, ConnectionProfile, ObjectMeta } from "@/shared/types/models";
import { getTableSchema } from "@/shared/lib/tauriApi";
import { cn } from "@/lib/utils";
import { useDeferredValue, useEffect, useRef, useState } from "react";

type ConnectionSidebarProps = {
  profile: ConnectionProfile;
  selectedDatabase: string;
  onDatabaseChange: (database: string) => void;
  onTableSelect: (table: string, schema?: string) => void;
  onRoutineSelect: (routine: ObjectMeta) => void;
};

type DatabaseOption = {
  value: string;
  label: string;
};

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

export function ConnectionSidebar({
  profile,
  selectedDatabase,
  onDatabaseChange,
  onTableSelect,
  onRoutineSelect,
}: ConnectionSidebarProps) {
  const navigate = useNavigate();
  const openModal = useModalStore((state) => state.openModal);
  const initialDatabase = getInitialDatabase(profile);
  const {
    data: databaseValues = [],
    error: databaseError,
    isLoading: isLoadingDatabases,
  } = useDatabases(profile);
  const {
    data: schemaObjects = [],
    error: schemaError,
    isLoading: isLoadingSchema,
    isFetching: isFetchingSchema,
    refetch: refetchSchema,
  } = useSchemaObjects(profile, selectedDatabase);
  const { data: connections = [] } = useConnections();
  const [filterText, setFilterText] = useState("");
  const [openGroups, setOpenGroups] = useState<string[]>(["tables"]);
  const [expandedTables, setExpandedTables] = useState<string[]>([]);
  const [tableColumns, setTableColumns] = useState<Record<string, ColumnInfo[]>>({});
  const [loadingTables, setLoadingTables] = useState<Record<string, boolean>>({});
  const [tableSchemaErrors, setTableSchemaErrors] = useState<Record<string, boolean>>({});
  const previousFilterRef = useRef("");
  const openGroupsBeforeFilterRef = useRef<string[] | null>(null);
  const deferredFilterText = useDeferredValue(filterText);
  const normalizedFilter = deferredFilterText.trim().toLowerCase();
  const databases = Array.from(
    new Set(initialDatabase ? [initialDatabase, ...databaseValues] : databaseValues),
  ).map((value) => ({ value, label: value }));
  const sidebarOpen = useThemeStore((state) => state.sidebarOpen);
  const engine = profile.db_type === "postgres" ? "postgresql" : profile.db_type;
  const endpoint =
    profile.connect_mode.type === "fields"
      ? `${profile.connect_mode.host}:${profile.connect_mode.port}`
      : profile.connect_mode.value;
  const sortedConnections = connections
    .filter((connection) => connection.id !== profile.id)
    .sort((left, right) => (right.last_opened_at ?? 0) - (left.last_opened_at ?? 0));
  const recentConnections = sortedConnections.slice(0, 4);
  const otherConnections = sortedConnections.slice(4);
  const availableExplorerGroups = explorerGroups.filter(
    (group) =>
      profile.db_type !== "sqlite" || group.objectType === "table" || group.objectType === "view",
  );
  const matchingGroupIds = availableExplorerGroups
    .filter((group) =>
      schemaObjects.some(
        (object) =>
          object.object_type === group.objectType &&
          object.name.toLowerCase().includes(normalizedFilter),
      ),
    )
    .map((group) => group.id);
  const matchingGroupKey = matchingGroupIds.join("|");

  useEffect(() => {
    const wasFiltering = previousFilterRef.current.length > 0;

    if (normalizedFilter && !wasFiltering) {
      openGroupsBeforeFilterRef.current = openGroups;
    }

    if (normalizedFilter) {
      setOpenGroups(matchingGroupIds);
    } else if (wasFiltering && openGroupsBeforeFilterRef.current) {
      setOpenGroups(openGroupsBeforeFilterRef.current);
      openGroupsBeforeFilterRef.current = null;
    }

    previousFilterRef.current = normalizedFilter;
  }, [matchingGroupKey, normalizedFilter]);

  const switchConnection = async (connectionId: string) => {
    await markConnectionOpened(connectionId);
    await navigate({ to: "/connections/$connectionId", params: { connectionId } });
  };

  const toggleTable = async (table: string, schema?: string) => {
    const resolvedSchema = schema ?? schemaObjects.find((object) => object.object_type === "table" && object.name === table)?.schema;
    const resourceKey = tableResourceKey(profile.id, resolvedSchema, table);
    onTableSelect(table, resolvedSchema);

    if (expandedTables.includes(resourceKey)) {
      setExpandedTables((current) => current.filter((key) => key !== resourceKey));
      return;
    }

    setExpandedTables((current) => [...current, resourceKey]);
    if (tableColumns[resourceKey] || loadingTables[resourceKey]) {
      return;
    }

    setLoadingTables((current) => ({ ...current, [resourceKey]: true }));
    setTableSchemaErrors((current) => ({ ...current, [resourceKey]: false }));

    try {
      const tableSchema = await getTableSchema(profile, table, resolvedSchema);
      setTableColumns((current) => ({ ...current, [resourceKey]: tableSchema.columns }));
    } catch {
      setTableSchemaErrors((current) => ({ ...current, [resourceKey]: true }));
    } finally {
      setLoadingTables((current) => ({ ...current, [resourceKey]: false }));
    }
  };

  return (
    <aside
      className={cn(
        "w-60 shrink-0 border-r border-border/70 bg-muted/10",
        sidebarOpen ? "flex flex-col" : "hidden",
      )}
    >
      <div className="border-b border-border/70 px-4 py-4">
        <div className="flex items-center gap-2">
          <RiDatabase2Line className="size-4 shrink-0 text-primary" />
          <h1 className="truncate text-sm font-semibold tracking-tight">{profile.name}</h1>
          <Badge variant="outline" className="text-[0.65rem] uppercase tracking-wider">
            {engine}
          </Badge>
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">{endpoint}</p>
      </div>
      <div className="border-b border-border/70 px-4 py-4">
        <p className="text-[0.65rem] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Database
        </p>
        <Select
          options={databases}
          value={databases.find((option) => option.value === selectedDatabase) ?? null}
          onValueChange={(option) => {
            if (option) {
              onDatabaseChange(option.value);
            }
          }}
          valueKey="value"
          labelKey="label"
          render={renderDatabaseOption}
          placeholder={
            isLoadingDatabases
              ? "Loading databases..."
              : databaseError
                ? "Database unavailable"
                : "Select database"
          }
          isLoading={isLoadingDatabases}
          className="mt-1 h-8 w-full text-xs"
          disabled={databases.length === 0 || isLoadingDatabases}
        />
        {databaseError ? (
          <p className="mt-2 text-[0.65rem] text-destructive">Database unavailable</p>
        ) : null}
      </div>
      <ScrollArea className="min-h-0 flex-1 overflow-hidden [&_[data-slot=scroll-area-scrollbar]]:hidden">
        <div className="min-w-0 p-3">
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
              onClick={() => void refetchSchema()}
              disabled={isFetchingSchema}
            >
              <RiRefreshLine className={cn(isFetchingSchema && "animate-spin")} aria-hidden="true" />
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
          {isLoadingSchema ? (
            <p className="px-2 py-2 text-[0.65rem] text-muted-foreground">Loading...</p>
          ) : schemaError ? (
            <p className="px-2 py-2 text-[0.65rem] text-destructive">Unable to load objects</p>
          ) : normalizedFilter && matchingGroupIds.length === 0 ? (
            <p className="px-2 py-2 text-[0.65rem] text-muted-foreground">No matching objects</p>
          ) : (
            <Files open={openGroups} onOpenChange={setOpenGroups} className="min-w-0 p-0">
              {availableExplorerGroups.map((group) => {
                const objects = schemaObjects.filter(
                  (object) =>
                    object.object_type === group.objectType &&
                    object.name.toLowerCase().includes(normalizedFilter),
                );

                return (
                  <FolderItem key={group.id} value={group.id}>
                    <FolderTrigger icon={group.icon} className="text-xs">
                      <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-2">
                          <span>{group.label}</span>
                        </span>
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
                          const resourceKey = tableResourceKey(profile.id, object.schema, object.name);
                          const isExpanded = expandedTables.includes(resourceKey);
                          const columns = tableColumns[resourceKey];

                          return (
                            <div key={tableResourceKey(profile.id, object.schema, object.name)}>
                              <FileItem
                                icon={group.icon}
                                className={cn(
                                  "text-xs",
                                  (isTable ||
                                    group.objectType === "function" ||
                                    group.objectType === "procedure") &&
                                    "cursor-pointer hover:text-foreground",
                                )}
                                onClick={
                                  isTable
                                    ? () => void toggleTable(object.name, object.schema)
                                    : undefined
                                }
                                onDoubleClick={
                                  group.objectType === "function" || group.objectType === "procedure"
                                    ? () => onRoutineSelect(object)
                                    : undefined
                                }
                              >
                                <span className="flex min-w-0 items-center gap-1.5">
                                  {isTable ? (
                                    <RiArrowRightSLine
                                      className={cn(
                                        "size-3.5 shrink-0 text-muted-foreground transition-transform",
                                        isExpanded && "rotate-90",
                                      )}
                                      aria-hidden="true"
                                    />
                                  ) : null}
                                  <span className="truncate">{object.name}</span>
                                </span>
                              </FileItem>
                              {isTable && isExpanded ? (
                                <div className="ml-8 border-l border-border/60 py-1 pl-2">
                                  {loadingTables[resourceKey] ? (
                                    <div className="flex items-center gap-1.5 px-2 py-1 text-[0.65rem] text-muted-foreground">
                                      <RiLoader4Line className="size-3 animate-spin" aria-hidden="true" />
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
                                          <span className="min-w-0 truncate text-foreground/80">
                                            {column.name}
                                          </span>
                                          <span className="shrink-0 truncate text-muted-foreground">
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
        </div>
      </ScrollArea>
      <div className="border-t border-border/70 p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md border border-border/70 bg-card px-3 py-2 text-left text-xs transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <RiDatabase2Line className="size-4 shrink-0 text-primary" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{profile.name}</span>
              <RiArrowLeftRightLine
                className="size-3.5 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="top"
            align="start"
            className="max-h-none w-56 overflow-y-hidden"
          >
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => void navigate({ to: "/" })}
            >
              <RiLogoutBoxLine />
              Disconnect
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                openModal("new-connection", { connectionId: profile.id });
                void navigate({ to: "/" });
              }}
            >
              <RiEditLine />
              Edit Connection
            </DropdownMenuItem>
            {sortedConnections.length > 0 ? (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <RiArrowLeftRightLine />
                  Switch Connection
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-56">
                  <DropdownMenuLabel>Recent Connections</DropdownMenuLabel>
                  {recentConnections.map((connection) => (
                    <DropdownMenuItem
                      key={connection.id}
                      onSelect={() => void switchConnection(connection.id)}
                    >
                      <RiDatabase2Line />
                      <span className="truncate">{connection.name}</span>
                    </DropdownMenuItem>
                  ))}
                  {otherConnections.length > 0 ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger>More Connections</DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="w-56">
                          {otherConnections.map((connection) => (
                            <DropdownMenuItem
                              key={connection.id}
                              onSelect={() => void switchConnection(connection.id)}
                            >
                              <RiDatabase2Line />
                              <span className="truncate">{connection.name}</span>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                    </>
                  ) : null}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}

function tableResourceKey(connectionId: string, schema: string | undefined, table: string): string {
  return `${connectionId}:${schema ?? ""}:${table}`;
}

function renderDatabaseOption(option: DatabaseOption) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <RiDatabase2Line className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
      <span className="truncate">{option.label}</span>
    </span>
  );
}
