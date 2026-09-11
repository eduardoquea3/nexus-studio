import { useDeferredValue, useEffect, useRef, useState } from "react";

import type { ColumnInfo, ConnectionProfile, ObjectMeta } from "@/shared/types/models";

import {
  ConnectionDatabaseSelector,
  type DatabaseOption,
} from "@/app/connection/components/connection-database-selector";
import { ConnectionExplorer } from "@/app/connection/components/connection-explorer";
import { ConnectionSwitcherMenu } from "@/app/connection/components/connection-switcher-menu";
import { useDatabases } from "@/app/connection/hooks/use-databases";
import { useSchemaObjects } from "@/app/connection/hooks/use-schema-objects";
import { getInitialDatabase } from "@/app/connection/services/database-service";
import { useConnections } from "@/app/home/hooks/use-connections";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { getTableSchema } from "@/shared/lib/tauriApi";
import { useModalStore } from "@/shared/store/modalStore";
import { useThemeStore } from "@/shared/store/theme-store";

type ConnectionSidebarProps = {
  profile: ConnectionProfile;
  selectedDatabase: string;
  onDatabaseChange: (database: string) => void;
  onTableSelect: (table: string, schema?: string) => void;
  onRoutineSelect: (routine: ObjectMeta) => void;
};

export function ConnectionSidebar({
  profile,
  selectedDatabase,
  onDatabaseChange,
  onTableSelect,
  onRoutineSelect,
}: ConnectionSidebarProps) {
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
  const databases: DatabaseOption[] = Array.from(
    new Set(initialDatabase ? [initialDatabase, ...databaseValues] : databaseValues),
  ).map((value) => ({ value, label: value }));
  const sidebarOpen = useThemeStore((state) => state.sidebarOpen);

  useEffect(() => {
    const wasFiltering = previousFilterRef.current.length > 0;
    const matchingGroupIds = [
      ["tables", "table"],
      ["views", "view"],
      ["functions", "function"],
      ["procedures", "procedure"],
    ]
      .filter(([, objectType]) =>
        schemaObjects.some(
          (object) =>
            object.object_type === objectType &&
            object.name.toLowerCase().includes(normalizedFilter),
        ),
      )
      .map(([id]) => id);
    if (normalizedFilter && !wasFiltering) openGroupsBeforeFilterRef.current = openGroups;
    if (normalizedFilter) setOpenGroups(matchingGroupIds);
    else if (wasFiltering && openGroupsBeforeFilterRef.current) {
      setOpenGroups(openGroupsBeforeFilterRef.current);
      openGroupsBeforeFilterRef.current = null;
    }
    previousFilterRef.current = normalizedFilter;
  }, [normalizedFilter, schemaObjects]);

  const tableResourceKey = (schema: string | undefined, table: string) =>
    `${profile.id}:${schema ?? ""}:${table}`;
  const toggleTable = async (table: string, schema?: string) => {
    const resolvedSchema =
      schema ??
      schemaObjects.find((object) => object.object_type === "table" && object.name === table)
        ?.schema;
    const resourceKey = tableResourceKey(resolvedSchema, table);
    if (expandedTables.includes(resourceKey)) {
      setExpandedTables((current) => current.filter((key) => key !== resourceKey));
      return;
    }
    setExpandedTables((current) => [...current, resourceKey]);
    if (tableColumns[resourceKey] || loadingTables[resourceKey]) return;
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
        "w-60 basis-60 shrink-0 border-r border-border/70 bg-muted/10",
        sidebarOpen ? "flex flex-col" : "hidden",
      )}
    >
      <ConnectionDatabaseSelector
        databases={databases}
        selectedDatabase={selectedDatabase}
        onDatabaseChange={onDatabaseChange}
        isLoading={isLoadingDatabases}
        hasError={Boolean(databaseError)}
      />
      <ScrollArea className="min-h-0 flex-1 overflow-hidden [&_[data-slot=scroll-area-scrollbar]]:hidden">
        <div className="min-w-0 p-3">
          <ConnectionExplorer
            dbType={profile.db_type}
            schemaObjects={schemaObjects}
            isLoading={isLoadingSchema}
            error={schemaError}
            isFetching={isFetchingSchema}
            refetch={refetchSchema}
            filterText={filterText}
            setFilterText={setFilterText}
            normalizedFilter={normalizedFilter}
            openGroups={openGroups}
            setOpenGroups={setOpenGroups}
            expandedTables={expandedTables}
            tableColumns={tableColumns}
            loadingTables={loadingTables}
            tableSchemaErrors={tableSchemaErrors}
            tableResourceKey={tableResourceKey}
            toggleTable={toggleTable}
            onTableSelect={onTableSelect}
            onRoutineSelect={onRoutineSelect}
          />
        </div>
      </ScrollArea>
      <div className="border-t border-border/70 p-3">
        <ConnectionSwitcherMenu profile={profile} connections={connections} openModal={openModal} />
      </div>
    </aside>
  );
}
