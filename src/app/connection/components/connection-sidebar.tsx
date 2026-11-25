import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useDeferredValue, useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { ConnectionExplorer } from "@/app/connection/components/connection-explorer";
import { ConnectionSwitcherMenu } from "@/app/connection/components/connection-switcher-menu";
import { useSchemaObjects } from "@/app/connection/hooks/use-schema-objects";
import { useConnections } from "@/app/home/hooks/use-connections";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { getSidebarTableMetadata } from "@/shared/lib/tauriApi";
import { TOGGLE_MOBILE_SIDEBAR_EVENT } from "@/shared/keymaps/global-keymaps";
import { SIDEBAR_WIDTH_MAX, SIDEBAR_WIDTH_MIN, useThemeStore } from "@/shared/store/theme-store";
import type { ConnectionProfile, ObjectMeta } from "@/shared/types/models";
import type { SidebarTableMetadata } from "@/shared/lib/tauriApi";

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
  const [tableMetadata, setTableMetadata] = useState<Record<string, SidebarTableMetadata>>({});
  const [loadingTables, setLoadingTables] = useState<Record<string, boolean>>({});
  const [tableSchemaErrors, setTableSchemaErrors] = useState<Record<string, boolean>>({});
  const metadataRequestIds = useRef<Record<string, number>>({});
  const previousFilterRef = useRef("");
  const openGroupsBeforeFilterRef = useRef<string[] | null>(null);
  const deferredFilterText = useDeferredValue(filterText);
  const normalizedFilter = deferredFilterText.trim().toLowerCase();
  const sidebarOpen = useThemeStore((state) => state.sidebarOpen);
  const sidebarWidth = useThemeStore((state) => state.sidebarWidth);
  const sidebarPosition = useThemeStore((state) => state.sidebarPosition);
  const setSidebarWidth = useThemeStore((state) => state.setSidebarWidth);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const resizeSessionRef = useRef<{
    pointerId: number;
    startX: number;
    startWidth: number;
    width: number;
  } | null>(null);

  useEffect(() => {
    const toggleMobileSidebar = () => setMobileSidebarOpen((open) => !open);
    window.addEventListener(TOGGLE_MOBILE_SIDEBAR_EVENT, toggleMobileSidebar);
    return () => window.removeEventListener(TOGGLE_MOBILE_SIDEBAR_EVENT, toggleMobileSidebar);
  }, []);

  useGSAP(
    () => {
      const sidebar = sidebarRef.current;
      if (!sidebar) return;

      const targetWidth = sidebarOpen ? sidebarWidth : 0;
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
    { dependencies: [sidebarOpen, sidebarWidth] },
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

  const clampSidebarWidth = (width: number) =>
    Math.min(SIDEBAR_WIDTH_MAX, Math.max(SIDEBAR_WIDTH_MIN, Math.round(width)));

  const handleResizePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (sidebarRef.current) gsap.killTweensOf(sidebarRef.current);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    resizeSessionRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: sidebarWidth,
      width: sidebarWidth,
    };
  };

  const handleResizePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const session = resizeSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;

    const direction = sidebarPosition === "left" ? 1 : -1;
    const width = clampSidebarWidth(
      session.startWidth + (event.clientX - session.startX) * direction,
    );
    session.width = width;
    if (sidebarRef.current) {
      sidebarRef.current.style.width = `${width}px`;
      sidebarRef.current.style.flexBasis = `${width}px`;
    }
    event.currentTarget.setAttribute("aria-valuenow", String(width));
    event.currentTarget.setAttribute("aria-valuetext", `${width} pixels`);
  };

  const finishSidebarResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    const session = resizeSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;

    resizeSessionRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    void setSidebarWidth(session.width);
  };

  const handleResizeKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    let width: number | undefined;
    const decreaseKey = sidebarPosition === "left" ? "ArrowLeft" : "ArrowRight";
    const increaseKey = sidebarPosition === "left" ? "ArrowRight" : "ArrowLeft";
    if (event.key === decreaseKey) width = sidebarWidth - (event.shiftKey ? 32 : 16);
    else if (event.key === increaseKey) width = sidebarWidth + (event.shiftKey ? 32 : 16);
    else if (event.key === "Home") width = SIDEBAR_WIDTH_MIN;
    else if (event.key === "End") width = SIDEBAR_WIDTH_MAX;
    if (width === undefined) return;

    event.preventDefault();
    void setSidebarWidth(clampSidebarWidth(width));
  };

  const tableResourceKey = (schema: string | undefined, table: string) =>
    `${profile.id}:${selectedDatabase}:${schema ?? ""}:${table}`;
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
    if (loadingTables[resourceKey]) return;
    setLoadingTables((current) => ({ ...current, [resourceKey]: true }));
    setTableSchemaErrors((current) => ({ ...current, [resourceKey]: false }));
    const requestId = (metadataRequestIds.current[resourceKey] ?? 0) + 1;
    metadataRequestIds.current[resourceKey] = requestId;
    try {
      const metadata = await getSidebarTableMetadata(
        profile,
        table,
        resolvedSchema,
        selectedDatabase,
      );
      if (metadataRequestIds.current[resourceKey] === requestId) {
        setTableMetadata((current) => ({ ...current, [resourceKey]: metadata }));
      }
    } catch {
      if (metadataRequestIds.current[resourceKey] === requestId) {
        setTableSchemaErrors((current) => ({ ...current, [resourceKey]: true }));
      }
    } finally {
      if (metadataRequestIds.current[resourceKey] === requestId) {
        setLoadingTables((current) => ({ ...current, [resourceKey]: false }));
      }
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
          tableColumns={Object.fromEntries(
            Object.entries(tableMetadata).map(([key, metadata]) => [key, metadata.columns]),
          )}
          tableMetadata={tableMetadata}
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
        <SheetContent side={sidebarPosition} className="w-72 max-w-[85vw] gap-0 p-0 lg:hidden">
          <SheetTitle className="sr-only">Connection explorer</SheetTitle>
          {explorerContent}
          <div className="h-10 min-h-9 max-h-10 shrink-0 border-t border-border/70 p-0">
            <ConnectionSwitcherMenu profile={profile} connections={connections} />
          </div>
        </SheetContent>
      </Sheet>
      <div
        ref={sidebarRef}
        id="connection-sidebar-panel"
        aria-hidden={!sidebarOpen}
        inert={!sidebarOpen}
        style={{ width: sidebarOpen ? sidebarWidth : 0, flexBasis: sidebarOpen ? sidebarWidth : 0 }}
        className="relative h-full shrink-0 overflow-visible max-lg:hidden"
      >
        <aside
          id="connection-sidebar"
          className="flex h-full w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card"
        >
          {explorerContent}
          <div className="h-10 min-h-9 max-h-10 shrink-0 border-t border-border/70 p-0">
            <ConnectionSwitcherMenu profile={profile} connections={connections} />
          </div>
        </aside>
        {sidebarOpen ? (
          <div
            role="separator"
            aria-label="Resize connection sidebar"
            aria-controls="connection-sidebar-panel"
            aria-orientation="vertical"
            aria-valuemin={SIDEBAR_WIDTH_MIN}
            aria-valuemax={SIDEBAR_WIDTH_MAX}
            aria-valuenow={sidebarWidth}
            aria-valuetext={`${sidebarWidth} pixels`}
            tabIndex={0}
            className={`group absolute inset-y-0 ${
              sidebarPosition === "left" ? "-right-1" : "-left-1"
            } z-20 flex w-2 cursor-col-resize touch-none items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/60`}
            onPointerDown={handleResizePointerDown}
            onPointerMove={handleResizePointerMove}
            onPointerUp={finishSidebarResize}
            onPointerCancel={finishSidebarResize}
            onKeyDown={handleResizeKeyDown}
          >
            <span
              className="h-full w-px bg-transparent transition-colors group-hover:bg-border group-focus-visible:bg-primary/70 group-active:bg-primary"
              aria-hidden="true"
            />
          </div>
        ) : null}
      </div>
    </>
  );
}
