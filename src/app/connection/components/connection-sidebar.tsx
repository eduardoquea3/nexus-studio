import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useDeferredValue, useEffect, useRef, useState } from "react";
import { ConnectionExplorer } from "@/app/connection/components/connection-explorer";
import { ConnectionSwitcherMenu } from "@/app/connection/components/connection-switcher-menu";
import { useSchemaObjects } from "@/app/connection/hooks/use-schema-objects";
import { useConnections } from "@/app/home/hooks/use-connections";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { getTableSchema } from "@/shared/lib/tauriApi";
import { TOGGLE_MOBILE_SIDEBAR_EVENT } from "@/shared/keymaps/global-keymaps";
import { useThemeStore } from "@/shared/store/theme-store";
import type { ColumnInfo, ConnectionProfile, ObjectMeta } from "@/shared/types/models";

gsap.registerPlugin(useGSAP);

type ConnectionSidebarProps = {
  profile: ConnectionProfile;
  selectedDatabase: string;
  selectedTableName?: string;
  selectedTableSchema?: string;
  onTableSelect: (table: string, schema?: string) => void;
  onRoutineSelect: (routine: ObjectMeta) => void;
};

export function ConnectionSidebar({
  profile,
  selectedDatabase,
  selectedTableName,
  selectedTableSchema,
  onTableSelect,
  onRoutineSelect,
}: ConnectionSidebarProps) {
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
  const sidebarOpen = useThemeStore((state) => state.sidebarOpen);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const toggleMobileSidebar = () => setMobileSidebarOpen((open) => !open);
    window.addEventListener(TOGGLE_MOBILE_SIDEBAR_EVENT, toggleMobileSidebar);
    return () => window.removeEventListener(TOGGLE_MOBILE_SIDEBAR_EVENT, toggleMobileSidebar);
  }, []);

  useGSAP(
    () => {
      const sidebar = sidebarRef.current;
      if (!sidebar) return;

      const targetWidth = sidebarOpen ? 240 : 0;
      const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

      gsap.to(sidebar, {
        width: targetWidth,
        flexBasis: targetWidth,
        opacity: sidebarOpen ? 1 : 0,
        duration: prefersReducedMotion ? 0 : 0.28,
        ease: sidebarOpen ? "power2.out" : "power2.in",
        overwrite: "auto",
        onComplete: () => {
          sidebar.style.pointerEvents = sidebarOpen ? "" : "none";
        },
      });

      sidebar.style.pointerEvents = sidebarOpen ? "" : "none";
    },
    { dependencies: [sidebarOpen] },
  );

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

  const explorerContent = (
    <ScrollArea className="min-h-0 flex-1 overflow-hidden [&_[data-slot=scroll-area-scrollbar]]:hidden">
      <div className="min-w-0 p-3">
        <ConnectionExplorer
          dbType={profile.db_type}
          selectedTableName={selectedTableName}
          selectedTableSchema={selectedTableSchema}
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
  );

  return (
    <>
      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent side="left" className="w-72 max-w-[85vw] gap-0 p-0 lg:hidden">
          <SheetTitle className="sr-only">Connection explorer</SheetTitle>
          {explorerContent}
          <div className="h-10 min-h-9 max-h-10 shrink-0 border-t border-border/70 p-0">
            <ConnectionSwitcherMenu profile={profile} connections={connections} />
          </div>
        </SheetContent>
      </Sheet>
      <aside
        ref={sidebarRef}
        aria-hidden={!sidebarOpen}
        inert={!sidebarOpen}
        className={cn(
          "w-60 basis-60 shrink-0 overflow-hidden rounded-2xl border border-border bg-card",
          "flex flex-col max-lg:hidden",
        )}
      >
        {explorerContent}
        <div className="h-10 min-h-9 max-h-10 shrink-0 border-t border-border/70 p-0">
          <ConnectionSwitcherMenu profile={profile} connections={connections} />
        </div>
      </aside>
    </>
  );
}
