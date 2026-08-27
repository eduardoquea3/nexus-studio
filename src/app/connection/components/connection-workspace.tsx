import { EditorView } from "@codemirror/view";

import { sql } from "@codemirror/lang-sql";
import { RiAddLine, RiCloseLine, RiCodeBoxLine, RiDownloadLine, RiFileCopyLine, RiPlayLine, RiTableLine } from "@remixicon/react";
import CodeMirror from "@uiw/react-codemirror";
import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/toast";

import type { ConnectionProfile, ObjectMeta, QueryResult, ViewMode } from "@/shared/types/models";
import type { DataTableTab, QueryTab, WorkspaceTab } from "@/shared/types/connection-workspace";

import { ConnectionSidebar } from "@/app/connection/components/connection-sidebar";
import { TableDataTab } from "@/app/connection/components/table-data-tab";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/animate-ui/components/radix/tabs";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/shared/components/data-table";
import { JsonCodePanel } from "@/shared/components/json-code-panel";
import { cn } from "@/lib/utils";
import { useDataTable } from "@/shared/hooks/use-data-table";
import { sqlEditorTheme } from "@/shared/lib/sql-editor-theme";
import { getRoutineDefinition, runQuery } from "@/shared/lib/tauriApi";
import { testSavedConnection } from "@/shared/lib/tauriApi";
import { exceedsJsonRenderThreshold, serializeJson } from "@/shared/lib/json-serialization";
import { copyJsonToClipboard, exportJsonFile } from "@/shared/lib/json-actions";
import { databasesQueryKey } from "@/app/connection/hooks/use-databases";
import { schemaObjectsQueryKey } from "@/app/connection/hooks/use-schema-objects";
import { useSchemaObjects } from "@/app/connection/hooks/use-schema-objects";
import { useConnections } from "@/app/home/hooks/use-connections";
import { getInitialDatabase } from "@/app/connection/services/database-service";
import { useWorkspaceStore } from "@/shared/store/workspace-store";
import { CommandBar } from "@/app/command-bar/command-bar";
import { Group, Panel, Separator } from "react-resizable-panels";
import {
  describeConnection,
  describeTab,
  nextTabIndex,
  type CommandBarItem,
  type CommandBarMode,
} from "@/app/command-bar/command-bar-utils";

type ConnectionWorkspaceProps = {
  profile: ConnectionProfile;
  onConnectionSwitch?: (profile: ConnectionProfile) => void | Promise<void>;
};

export function ConnectionWorkspace({ profile, onConnectionSwitch }: ConnectionWorkspaceProps) {
  const queryClient = useQueryClient();
  const storedWorkspace = useWorkspaceStore((state) => state.connections[profile.id]);
  const workspaceHydrated = useWorkspaceStore((state) => state.isHydrated);
  const setConnectionWorkspace = useWorkspaceStore((state) => state.setConnectionWorkspace);
  const setActiveConnection = useWorkspaceStore((state) => state.setActiveConnection);
  const openWorkspaceTab = useWorkspaceStore((state) => state.openTab);
  const activateWorkspaceTab = useWorkspaceStore((state) => state.activateTab);
  const {
    data: connections = [],
    isLoading: isLoadingConnections,
    isFetching: isFetchingConnections,
  } = useConnections();
  const [selectedDatabase, setSelectedDatabase] = useState(() => getInitialDatabase(profile));
  const [sqlTabs, setSqlTabs] = useState<SqlEditorTab[]>([
    createSqlTab(1, profile.id, getInitialDatabase(profile)),
  ]);
  const [tableTabs, setTableTabs] = useState<TableTab[]>([]);
  const [activeSqlTabId, setActiveSqlTabId] = useState("sql-1");
  const [activeTabId, setActiveTabId] = useState("sql-1");
  const [isRunning, setIsRunning] = useState(false);
  const [tableRefreshToken, setTableRefreshToken] = useState(0);
  const [commandBarMode, setCommandBarMode] = useState<CommandBarMode | null>(null);
  const [switcherCycle, setSwitcherCycle] = useState<{ sequence: number; direction: -1 | 1 } | undefined>();
  const [switcherInitialDirection, setSwitcherInitialDirection] = useState<-1 | 1>(1);
  const [switchingConnectionIds, setSwitchingConnectionIds] = useState<ReadonlySet<string>>(new Set());
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const previewOriginTabIdRef = useRef<string | null>(null);
  const switcherCycleRef = useRef(0);
  const selectedSwitcherTabIdRef = useRef<string | null>(null);
  const switchingConnectionIdsRef = useRef(new Set<string>());
  const {
    data: schemaObjects = [],
    isLoading: isLoadingSchema,
    isFetching: isFetchingSchema,
  } = useSchemaObjects(profile, selectedDatabase);
  const editorSectionRef = useRef<HTMLElement>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const initializedEditorIdsRef = useRef(new Set<string>());
  const loadingRoutineIdsRef = useRef(new Set<string>());
  const restoringWorkspaceRef = useRef(false);
  const initializedWorkspaceConnectionIdRef = useRef<string | null>(null);
  const sqlTabsRef = useRef(sqlTabs);
  const activeSqlTabIdRef = useRef(activeSqlTabId);
  const activeSqlTab = sqlTabs.find((tab) => tab.id === activeSqlTabId) ?? sqlTabs[0];
  const activeTableTab = tableTabs.find((tab) => tab.id === activeTabId);
  const workspaceTabs = [
    ...sqlTabs.map((tab) => ({ ...tab, type: "sql" as const })),
    ...tableTabs.map((tab) => ({ ...tab, type: "table" as const })),
  ];
  const switcherTabsRef = useRef<typeof workspaceTabs>([]);
  const commandBarTabs = commandBarMode === "tab-switcher" ? switcherTabsRef.current : workspaceTabs;
  const commandBarItems = useMemo<CommandBarItem[]>(
    () =>
      commandBarMode === "tab-switcher"
         ? commandBarTabs.map((tab) => {
            const workspaceTab: QueryTab | DataTableTab = tab.type === "sql"
              ? { ...tab, type: "query" }
              : { ...tab, type: "datatable" };
            const description = describeTab(workspaceTab);
            return {
              id: workspaceTab.id,
              kind: "tab",
              label: description.label,
              detail: description.detail,
              isActive: workspaceTab.id === activeTabId,
              tab: workspaceTab,
            };
          })
        : [
            ...connections.map((connection) => ({
              id: `connection:${connection.id}`,
              kind: "connection" as const,
              label: connection.name,
              detail: describeConnection(connection),
              isActive: connection.id === profile.id,
              connection,
            })),
            ...schemaObjects
              .filter((object) => object.object_type === "table")
              .map((table) => ({
                id: `table:${profile.id}:${selectedDatabase}:${table.schema ?? ""}:${table.name}`,
                kind: "table" as const,
                label: table.name,
                detail: `${table.schema ?? "public"} · ${selectedDatabase} · table`,
                isActive: false as const,
                table,
              })),
          ],
    [activeTabId, commandBarMode, commandBarTabs, connections, profile.id, schemaObjects, selectedDatabase, workspaceTabs],
  );

  const closeCommandBar = (commitPreview = false) => {
    if (
      commandBarMode === "tab-switcher" &&
      !commitPreview &&
      previewOriginTabIdRef.current &&
      previewOriginTabIdRef.current !== activeTabId
    ) {
      const originTabId = previewOriginTabIdRef.current;
      activateWorkspaceTab(profile.id, originTabId);
      setActiveTabId(originTabId);
      const originTab = workspaceTabs.find((tab) => tab.id === originTabId);
      if (originTab?.type === "sql") {
        setActiveSqlTabId(originTab.id);
      }
    }

    setCommandBarMode(null);
    setSwitcherCycle(undefined);
    previewOriginTabIdRef.current = null;
    requestAnimationFrame(() => {
      if (restoreFocusRef.current?.isConnected) {
        restoreFocusRef.current.focus();
      } else {
        editorSectionRef.current?.focus();
      }
    });
  };

  const openCommandBar = (mode: CommandBarMode, direction: -1 | 1 = 1) => {
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setCommandBarMode(mode);
    if (mode === "tab-switcher") {
      previewOriginTabIdRef.current = activeTabId;
      switcherTabsRef.current = workspaceTabs;
      selectedSwitcherTabIdRef.current = null;
      setSwitcherInitialDirection(direction);
      setSwitcherCycle(undefined);
    }
  };

  const switchConnection = async (nextProfile: ConnectionProfile) => {
    if (switchingConnectionIdsRef.current.has(nextProfile.id)) {
      return;
    }

    switchingConnectionIdsRef.current.add(nextProfile.id);
    setSwitchingConnectionIds((current) => new Set(current).add(nextProfile.id));
    try {
      await testSavedConnection(nextProfile);
      setConnectionWorkspace({
        connectionId: profile.id,
        activeTabId: activeTabId || null,
        tabs: [...sqlTabsRef.current, ...tableTabs],
      });
      await onConnectionSwitch?.(nextProfile);
      closeCommandBar();
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      toast.add({
        title: `Unable to connect to ${nextProfile.name}`,
        description: detail ? `The connection was not changed. Details: ${detail}` : "The connection was not changed.",
      });
    } finally {
      switchingConnectionIdsRef.current.delete(nextProfile.id);
      setSwitchingConnectionIds((current) => {
        const next = new Set(current);
        next.delete(nextProfile.id);
        return next;
      });
    }
  };

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) {
        return false;
      }
      const isCodeMirror = Boolean(target.closest(".cm-editor, .cm-content"))
        || target.getAttribute("aria-label")?.endsWith("SQL query editor") === true;
      return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
        || (!isCodeMirror && target.isContentEditable)
        || (!isCodeMirror && Boolean(target.closest("[contenteditable='true']")));
    };

    const handleGlobalKeyDown = (event: globalThis.KeyboardEvent) => {
      const hasModifier = event.ctrlKey || event.metaKey;
      if (!hasModifier || event.altKey) {
        return;
      }

      if (commandBarMode === "palette") {
        return;
      }

      if (event.key.toLowerCase() === "p") {
        event.preventDefault();
        event.stopPropagation();
        openCommandBar("palette");
        return;
      }

      if (event.key === "Tab") {
        if (workspaceTabs.length === 0) {
          return;
        }
        const isTabSwitcherOpen = commandBarMode === "tab-switcher";
        if (!isTabSwitcherOpen && isEditableTarget(event.target)) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        if (!isTabSwitcherOpen) {
          openCommandBar("tab-switcher", event.shiftKey ? -1 : 1);
        } else {
          const direction = event.shiftKey ? -1 : 1;
          switcherCycleRef.current += 1;
          setSwitcherCycle({ sequence: switcherCycleRef.current, direction });
        }
        return;
      }

      if (isEditableTarget(event.target)) {
        return;
      }
    };

    const handleGlobalKeyUp = (event: globalThis.KeyboardEvent) => {
      if (commandBarMode === "tab-switcher" && (event.key === "Control" || event.key === "Meta")) {
        event.preventDefault();
        const selectedTabId = selectedSwitcherTabIdRef.current;
        const selectedTab = commandBarItems.find(
          (item): item is Extract<CommandBarItem, { kind: "tab" }> => item.kind === "tab" && item.id === selectedTabId,
        );
        if (selectedTab) {
          activateWorkspaceTab(profile.id, selectedTab.id);
          setActiveTabId(selectedTab.id);
          if (selectedTab.tab.type === "query") {
            setActiveSqlTabId(selectedTab.id);
          }
        }
        closeCommandBar(true);
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown, true);
    window.addEventListener("keyup", handleGlobalKeyUp, true);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown, true);
      window.removeEventListener("keyup", handleGlobalKeyUp, true);
    };
  }, [activateWorkspaceTab, commandBarItems, commandBarMode, profile.id, workspaceTabs.length]);

  const focusEditor = (view: EditorView, tabId: string) => {
    view.focus();

    if (!initializedEditorIdsRef.current.has(tabId)) {
      view.dispatch({
        selection: { anchor: 0, head: view.state.doc.length },
      });
      initializedEditorIdsRef.current.add(tabId);
    }
  };

  useEffect(() => {
    if (editorViewRef.current) {
      focusEditor(editorViewRef.current, activeSqlTabId);
    }
  }, [activeSqlTabId]);

  useEffect(() => {
    setSelectedDatabase(getInitialDatabase(profile));
  }, [profile]);

  useEffect(() => {
    if (
      !workspaceHydrated ||
      restoringWorkspaceRef.current ||
      initializedWorkspaceConnectionIdRef.current === profile.id
    ) {
      return;
    }

    initializedWorkspaceConnectionIdRef.current = profile.id;
    restoringWorkspaceRef.current = true;
    setActiveConnection(profile.id);
    if (storedWorkspace) {
      const restoredSqlTabs = storedWorkspace.tabs.flatMap((tab): SqlEditorTab[] => {
        if (tab.type === "query") {
          return [tab];
        }
        if (tab.type === "routine") {
          return [
            {
              id: tab.id,
              type: "query",
              connectionId: tab.connectionId,
              database: tab.database,
              title: tab.title,
              query: tab.query,
              isDirty: tab.isDirty,
              queryResult: null,
              queryError: null,
              viewMode: "table",
            },
          ];
        }
        return [];
      });
      const restoredTableTabs = storedWorkspace.tabs.filter(
        (tab): tab is TableTab => tab.type === "datatable",
      );
      const activeTab = storedWorkspace.tabs.find((tab) => tab.id === storedWorkspace.activeTabId);
      setSqlTabs(restoredSqlTabs);
      sqlTabsRef.current = restoredSqlTabs;
      setTableTabs(restoredTableTabs);
      setActiveTabId(storedWorkspace.activeTabId ?? restoredSqlTabs[0]?.id ?? "");
      const activeSqlTab = activeTab?.type === "query" ? activeTab : restoredSqlTabs[0];
      setActiveSqlTabId(activeSqlTab?.id ?? "");
      setSelectedDatabase(activeSqlTab?.database ?? activeTab?.database ?? getInitialDatabase(profile));
    } else {
      const initialTab = createSqlTab(1, profile.id, getInitialDatabase(profile));
      setSqlTabs([initialTab]);
      sqlTabsRef.current = [initialTab];
      setTableTabs([]);
      setActiveTabId(initialTab.id);
      setActiveSqlTabId(initialTab.id);
      setSelectedDatabase(initialTab.database);
      setConnectionWorkspace({ connectionId: profile.id, activeTabId: initialTab.id, tabs: [initialTab] });
    }
  }, [profile, setActiveConnection, setConnectionWorkspace, sqlTabs, storedWorkspace, workspaceHydrated]);

  useEffect(() => {
    if (!workspaceHydrated) {
      return;
    }
    if (restoringWorkspaceRef.current) {
      restoringWorkspaceRef.current = false;
      return;
    }
    setConnectionWorkspace({
      connectionId: profile.id,
      activeTabId: activeTabId || null,
      tabs: [...sqlTabs, ...tableTabs],
    });
  }, [activeTabId, profile.id, setConnectionWorkspace, sqlTabs, tableTabs, workspaceHydrated]);

  useEffect(() => {
    sqlTabsRef.current = sqlTabs;
  }, [sqlTabs]);

  useEffect(() => {
    activeSqlTabIdRef.current = activeSqlTabId;
  }, [activeSqlTabId]);

  useEffect(() => {
    const handleRefreshShortcut = (event: globalThis.KeyboardEvent) => {
      if (
        event.key.toLowerCase() !== "r" ||
        (!event.ctrlKey && !event.metaKey) ||
        event.altKey ||
        !activeTabId.startsWith("table-")
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setTableRefreshToken((token) => token + 1);
    };

    window.addEventListener("keydown", handleRefreshShortcut, true);
    return () => window.removeEventListener("keydown", handleRefreshShortcut, true);
  }, [activeTabId]);

  const createEditorTab = () => {
    const nextNumber =
      sqlTabsRef.current.reduce((highest, tab) => {
        const number = Number(tab.id.replace("sql-", ""));
        return Number.isNaN(number) ? highest : Math.max(highest, number);
      }, 0) + 1;
    const nextTab = createSqlTab(nextNumber, profile.id, selectedDatabase);
    const nextTabs = [...sqlTabsRef.current, nextTab];
    sqlTabsRef.current = nextTabs;
    setSqlTabs(nextTabs);
    activeSqlTabIdRef.current = nextTab.id;
    setActiveSqlTabId(nextTab.id);
    setActiveTabId(nextTab.id);
  };

  const closeEditorTab = (tabId: string, focusTabId?: string) => {
    const tabIndex = sqlTabs.findIndex((tab) => tab.id === tabId);
    if (tabIndex === -1) {
      return;
    }

    const tab = sqlTabs[tabIndex];
    if (tab.isDirty) {
      toast.add({
        title: `Discard changes in ${tab.title}?`,
        timeout: 0,
        description: "Your SQL edits will be permanently lost.",
        actionProps: {
          children: "Discard",
          className: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
          onClick: () => removeEditorTab(tabId, focusTabId),
        },
        data: {
          cancel: {
            children: "Cancel",
            onClick: () => undefined,
          },
        },
      });
      return;
    }

    removeEditorTab(tabId, focusTabId);
  };

  const removeEditorTab = (tabId: string, focusTabId?: string) => {
    const currentTabs = sqlTabsRef.current;
    const tabIndex = currentTabs.findIndex((tab) => tab.id === tabId);
    if (tabIndex === -1) {
      return;
    }

    const nextTabs = currentTabs.filter((tab) => tab.id !== tabId);
    sqlTabsRef.current = nextTabs;
    setSqlTabs(nextTabs);

    if (activeSqlTabIdRef.current === tabId) {
      const nextActiveTab = nextTabs[Math.max(0, tabIndex - 1)];
      activeSqlTabIdRef.current = nextActiveTab?.id ?? "";
      setActiveSqlTabId(nextActiveTab?.id ?? "");
      setActiveTabId(focusTabId ?? nextActiveTab?.id ?? "");

      if (!nextActiveTab) {
        editorSectionRef.current?.focus();
      }
    }
  };

  const closeTableTab = (tabId: string, focusTabId?: string) => {
    setTableTabs((tabs) => tabs.filter((tab) => tab.id !== tabId));

    if (activeTabId === tabId) {
      setActiveTabId(focusTabId ?? activeSqlTabId);
    }
  };

  const getPreviousWorkspaceTabId = (tabId: string) => {
    const currentIndex = workspaceTabs.findIndex((tab) => tab.id === tabId);
    if (currentIndex === -1) {
      return undefined;
    }

    return workspaceTabs[currentIndex - 1]?.id ?? workspaceTabs[currentIndex + 1]?.id;
  };

  const openTableTab = (table: string, schema?: string) => {
    const id = `table-${encodeURIComponent(selectedDatabase)}-${encodeURIComponent(schema ?? "")}-${encodeURIComponent(table)}`;
    const nextTab: DataTableTab = {
      id,
      type: "datatable",
      connectionId: profile.id,
      tableName: table,
      database: selectedDatabase,
      schema,
    };
    openWorkspaceTab(nextTab);
    const storedTab = useWorkspaceStore.getState().connections[profile.id]?.tabs.find(
      (tab): tab is DataTableTab =>
        tab.type === "datatable" &&
        tab.database === selectedDatabase &&
        tab.schema === schema &&
        tab.tableName === table,
    );
    const activeTable = storedTab ?? nextTab;
    setTableTabs((tabs) => tabs.some((tab) => tab.id === activeTable.id) ? tabs : [...tabs, activeTable]);
    setActiveTabId(activeTable.id);
  };

  const handleDatabaseChange = (database: string) => {
    setSelectedDatabase(database);
    const nextTabs = sqlTabsRef.current.map((tab) => ({ ...tab, database }));
    sqlTabsRef.current = nextTabs;
    setSqlTabs(nextTabs);
  };

  const openRoutineTab = async (routine: ObjectMeta) => {
    const id = `routine-${encodeURIComponent(selectedDatabase)}-${routine.object_type}-${encodeURIComponent(routine.signature ?? routine.name)}`;
    if (sqlTabsRef.current.some((tab) => tab.id === id)) {
      activeSqlTabIdRef.current = id;
      setActiveSqlTabId(id);
      setActiveTabId(id);
      return;
    }
    if (loadingRoutineIdsRef.current.has(id)) {
      return;
    }

    loadingRoutineIdsRef.current.add(id);
    try {
      const definition = await getRoutineDefinition(withDatabase(profile, selectedDatabase), routine);
      const nextTabs = sqlTabsRef.current.some((tab) => tab.id === id)
        ? sqlTabsRef.current
        : [
            ...sqlTabsRef.current,
            {
              id,
              type: "query" as const,
              connectionId: profile.id,
              database: selectedDatabase,
              title: routine.name,
              query: definition,
              isDirty: false,
              queryResult: null,
              queryError: null,
              viewMode: "table" as const,
            },
          ];
      sqlTabsRef.current = nextTabs;
      setSqlTabs(nextTabs);
      activeSqlTabIdRef.current = id;
      setActiveSqlTabId(id);
      setActiveTabId(id);
    } catch (error) {
      toast.add({
        title: `Unable to load ${routine.name}`,
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      loadingRoutineIdsRef.current.delete(id);
    }
  };

  const updateActiveQuery = (query: string) => {
    if (!activeSqlTab) {
      return;
    }

    const nextTabs = sqlTabsRef.current.map((tab) =>
      tab.id === activeSqlTab.id ? { ...tab, query, isDirty: query.length > 0 } : tab,
    );
    sqlTabsRef.current = nextTabs;
    setSqlTabs(nextTabs);
  };

  const executeActiveQuery = async () => {
    if (!activeSqlTab || !editorViewRef.current || isRunning) {
      return;
    }

    const cursor = editorViewRef.current.state.selection.main.head;
    const query = getQuerySegment(activeSqlTab.query, cursor) || DEFAULT_QUERY;

    setIsRunning(true);
    setSqlTabs((tabs) =>
      tabs.map((tab) =>
        tab.id === activeSqlTab.id ? { ...tab, queryResult: null, queryError: null, viewMode: "table" } : tab,
      ),
    );
    try {
      const result = await runQuery(withDatabase(profile, selectedDatabase), query);
      setSqlTabs((tabs) =>
        tabs.map((tab) => (tab.id === activeSqlTab.id ? { ...tab, queryResult: result } : tab)),
      );

      if (/^create\s+table\b/i.test(query)) {
        await queryClient.invalidateQueries({ queryKey: schemaObjectsQueryKey(profile.id) });
      }

      if (/^create\s+database\b/i.test(query)) {
        await queryClient.invalidateQueries({ queryKey: databasesQueryKey(profile.id) });
      }
    } catch (error) {
      setSqlTabs((tabs) =>
        tabs.map((tab) =>
          tab.id === activeSqlTab.id
            ? { ...tab, queryResult: null, queryError: error instanceof Error ? error.message : String(error) }
            : tab,
        ),
      );
    } finally {
      setIsRunning(false);
    }
  };

  const handleWorkspaceKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if ((!event.ctrlKey && !event.metaKey) || event.altKey) {
      return;
    }

    if (event.shiftKey) {
      return;
    }

    if (event.key === "Enter" && activeSqlTab) {
      event.preventDefault();
      void executeActiveQuery();
      return;
    }

    if (event.key.toLowerCase() === "t") {
      event.preventDefault();
      createEditorTab();
      return;
    }

    if (event.key.toLowerCase() === "w" && activeTabId.startsWith("table-")) {
      event.preventDefault();
      closeTableTab(activeTabId, getPreviousWorkspaceTabId(activeTabId));
      return;
    }

    if (event.key.toLowerCase() === "w" && activeSqlTab) {
      event.preventDefault();
      closeEditorTab(activeSqlTab.id, getPreviousWorkspaceTabId(activeSqlTab.id));
    }
  };

  const tabItems: WorkspaceTab[] = (commandBarMode === "tab-switcher" ? switcherTabsRef.current : workspaceTabs).map((tab) =>
      tab.type === "sql" ? { ...tab, type: "query" } : { ...tab, type: "datatable" },
  );

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-background text-foreground">
      {commandBarMode ? (
        <CommandBar
          mode={commandBarMode}
          items={commandBarItems}
          initialIndex={commandBarMode === "tab-switcher" ? nextTabIndex(tabItems, activeTabId, switcherInitialDirection) : 0}
          cycleRequest={commandBarMode === "tab-switcher" ? switcherCycle : undefined}
           onHighlightChange={(item) => {
             if (commandBarMode === "tab-switcher") {
               if (item?.kind !== "tab") {
                 selectedSwitcherTabIdRef.current = null;
                 return;
                }

                selectedSwitcherTabIdRef.current = item.tab.id;
                if (item.tab.id === activeTabId) {
                  return;
                }

                activateWorkspaceTab(profile.id, item.tab.id);
                setActiveTabId(item.tab.id);
               if (item.tab.type === "query") {
                 setActiveSqlTabId(item.tab.id);
               }
             }
           }}
          onClose={closeCommandBar}
          inline
          onSelect={(item) => {
            if (item.kind === "tab") {
              activateWorkspaceTab(profile.id, item.tab.id);
              setActiveTabId(item.tab.id);
              if (item.tab.type === "query") {
                setActiveSqlTabId(item.tab.id);
              }
               closeCommandBar(true);
              return;
            }
            if (item.kind === "table") {
              openTableTab(item.table.name, item.table.schema);
              closeCommandBar();
              return;
            }
          }}
          onConnectionSelect={(connection) => void switchConnection(connection)}
          groups={commandBarMode === "palette" ? ["connections", "tables"] : ["tabs"]}
          isLoading={commandBarMode === "palette" && (
            switchingConnectionIds.size > 0 ||
            isLoadingConnections ||
            isFetchingConnections ||
            isLoadingSchema ||
            isFetchingSchema
          )}
        />
      ) : null}
      <div className="flex min-h-0 flex-1">
        <ConnectionSidebar
          profile={profile}
          selectedDatabase={selectedDatabase}
          onDatabaseChange={handleDatabaseChange}
          onTableSelect={openTableTab}
          onRoutineSelect={(routine) => void openRoutineTab(routine)}
        />

        <main className="min-w-0 flex-1">
          <div className="flex h-full min-h-0 flex-col">
            <section
              ref={editorSectionRef}
              tabIndex={0}
              aria-label="SQL editor workspace"
              onKeyDownCapture={handleWorkspaceKeyDown}
              className="flex h-full min-h-0 flex-col overflow-hidden border border-border/70 bg-card shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <Tabs
                value={activeTabId}
                onValueChange={(value) => {
                  setActiveTabId(value);
                  if (workspaceTabs.find((tab) => tab.id === value)?.type === "sql") {
                    setActiveSqlTabId(value);
                  }
                }}
                className="flex min-h-0 flex-1 flex-col gap-0"
              >
                <div className="flex min-w-0 shrink-0 items-center gap-1 border-b border-border/70 bg-background/80 px-2 py-2">
                  <TabsList className="min-w-0 overflow-hidden rounded-b-none bg-transparent p-0">
                    {workspaceTabs.map((tab) => (
                        <div key={tab.id} className="group flex h-9 items-center">
                          <TabsTrigger
                            value={tab.id}
                            className="group/tab flex h-9 min-w-24 max-w-40 flex-none items-center gap-1.5 overflow-hidden rounded-t-md px-3 text-xs data-[state=active]:text-foreground"
                            onClick={() => {
                              setActiveTabId(tab.id);
                              if (tab.type === "sql") {
                                setActiveSqlTabId(tab.id);
                              }
                            }}
                          >
                            {tab.type === "sql" ? (
                              <RiCodeBoxLine
                                className={cn(
                                  "size-3.5",
                                  tab.id === activeSqlTabId
                                    ? "text-primary"
                                    : "text-muted-foreground",
                                )}
                              />
                            ) : (
                              <RiTableLine className="size-3.5 text-primary" />
                            )}
                            <span className="truncate">{tab.type === "sql" ? tab.title : tab.tableName}</span>
                            {tab.type === "sql" ? (
                              <span
                                className="inline-flex size-1.5 shrink-0 items-center justify-center"
                                data-testid={`unsaved-change-slot-${tab.id}`}
                              >
                                {tab.isDirty ? (
                                  <span
                                    aria-label={`Unsaved changes in ${tab.title}`}
                                    className="size-1.5 rounded-full bg-primary"
                                  />
                                ) : null}
                              </span>
                            ) : null}
                            <span
                                role="button"
                                tabIndex={0}
                                className="inline-flex size-4 items-center justify-center rounded-sm text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/50 group-hover/tab:opacity-100 group-focus-within/tab:opacity-100"
                                onMouseDown={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                }}
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  if (tab.type === "sql") {
                                    closeEditorTab(tab.id);
                                  } else {
                                    closeTableTab(tab.id);
                                  }
                                }}
                                onKeyDown={(event) => {
                                  if (event.key !== "Enter" && event.key !== " ") {
                                    return;
                                  }

                                  event.preventDefault();
                                  event.stopPropagation();
                                  if (tab.type === "sql") {
                                    closeEditorTab(tab.id);
                                  } else {
                                    closeTableTab(tab.id);
                                  }
                                }}
                                 aria-label={`Close ${tab.type === "sql" ? tab.title : tab.tableName}`}
                              >
                                <RiCloseLine className="size-3" />
                            </span>
                          </TabsTrigger>
                        </div>
                      ))}
                  </TabsList>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="mb-0.5 shrink-0"
                    onClick={createEditorTab}
                    aria-label="Create SQL editor tab"
                  >
                    <RiAddLine />
                  </Button>
                  <div className="ml-auto flex items-center gap-2 px-2 pb-1">
                    <Button
                      size="sm"
                      disabled={!activeSqlTab || isRunning}
                      onClick={() => void executeActiveQuery()}
                    >
                      <RiPlayLine data-icon="inline-start" />
                      {isRunning ? "Running..." : "Run query"}
                    </Button>
                  </div>
                </div>
                {activeTableTab ? (
                  <TabsContent
                    value={activeTabId}
                    className="min-h-0 flex-1 overflow-hidden bg-muted/10 text-xs"
                  >
                    <TableDataTab
                      key={activeTableTab.id}
                      profile={withDatabase(profile, activeTableTab.database)}
                      schema={activeTableTab.schema}
                      table={activeTableTab.tableName}
                      refreshToken={tableRefreshToken}
                    />
                  </TabsContent>
                ) : activeSqlTab ? (
                  <TabsContent
                    value={activeTabId}
                    className="min-h-0 flex-1 overflow-hidden bg-muted/10 text-xs"
                  >
                    <Group orientation="vertical" className="h-full min-h-0 overflow-hidden rounded-b-xl">
                      <Panel defaultSize="30%" minSize="15%" maxSize="80%" className="min-h-0 overflow-hidden">
                        <div className="sql-editor-font h-full overflow-hidden border-b border-border/70 bg-card/60">
                          <CodeMirror
                            value={activeSqlTab.query}
                            onChange={updateActiveQuery}
                            basicSetup={{ lineNumbers: true, foldGutter: true }}
                            theme="none"
                            extensions={[
                              sql(),
                              sqlEditorTheme,
                              EditorView.theme({
                                ".cm-content": { padding: "0.35rem 0" },
                                ".cm-line": { padding: "0 1rem 0 0.5rem", lineHeight: "1.5" },
                                ".cm-lineNumbers": { width: "1.5rem" },
                                ".cm-lineNumbers .cm-gutterElement": {
                                  minWidth: "1.5rem",
                                  boxSizing: "border-box",
                                  padding: "0 0 0 0.5rem",
                                  textAlign: "left",
                                },
                                ".cm-foldGutter": { width: "1rem" },
                                ".cm-foldGutter .cm-gutterElement": {
                                  width: "1rem",
                                  boxSizing: "border-box",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  lineHeight: "1.5",
                                  padding: "0",
                                },
                              }),
                            ]}
                            height="100%"
                            width="100%"
                            className="h-full w-full"
                            onCreateEditor={(view) => {
                              editorViewRef.current = view;
                              focusEditor(view, activeSqlTabId);
                            }}
                            aria-label={`${activeSqlTab.title} SQL query editor`}
                          />
                        </div>
                      </Panel>
                      <Separator
                        className="group/separator relative z-10 h-1 shrink-0 cursor-row-resize border-y border-border/70 bg-background transition-colors hover:bg-primary/30 focus-visible:bg-primary/30 focus-visible:outline-none"
                        aria-label="Resize SQL editor and results"
                      >
                        <span className="absolute inset-x-1/2 top-1/2 h-0.5 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-muted-foreground/40 transition-colors group-hover/separator:bg-primary" />
                      </Separator>
                      <Panel defaultSize="70%" minSize="20%" className="min-h-0 overflow-hidden">
                        <section
                          aria-label="SQL query results"
                          className="results-font flex h-full min-h-0 overflow-hidden bg-background/80 text-xs text-muted-foreground"
                        >
                          {isRunning ? (
                            <p role="status">Running query...</p>
                          ) : activeSqlTab.queryError ? (
                            <p className="text-destructive">{activeSqlTab.queryError}</p>
                          ) : activeSqlTab.queryResult ? (
                            <QueryResultView
                              result={activeSqlTab.queryResult}
                              viewMode={activeSqlTab.viewMode}
                              onViewModeChange={(viewMode) => {
                                setSqlTabs((tabs) =>
                                  tabs.map((tab) =>
                                    tab.id === activeSqlTab.id ? { ...tab, viewMode } : tab,
                                  ),
                                );
                              }}
                            />
                          ) : (
                            "Place the cursor in a statement and press Ctrl+Enter to run it."
                          )}
                        </section>
                      </Panel>
                    </Group>
                  </TabsContent>
                ) : (
                  <div className="flex min-h-0 flex-1 items-center justify-center bg-muted/10 px-4 text-xs text-muted-foreground">
                    Press Ctrl+T to open a SQL editor.
                  </div>
                )}
              </Tabs>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

export function getQuerySegment(query: string, position: number): string {
  const separators = findStatementSeparators(query);
  const lastSeparator = separators[separators.length - 1];

  if (lastSeparator !== undefined && position > lastSeparator) {
    const trailingText = query.slice(lastSeparator + 1);
    if (trailingText.trim().length === 0) {
      const previousSeparator = separators[separators.length - 2] ?? -1;
      return query.slice(previousSeparator + 1, query.length).trim();
    }
  }

  const previousSeparators = separators.filter((separator) => separator < position);
  const previousSeparator = previousSeparators[previousSeparators.length - 1] ?? -1;
  const nextSeparator = separators.find((separator) => separator >= position) ?? query.length;
  const end = nextSeparator < query.length ? nextSeparator + 1 : query.length;
  return query.slice(previousSeparator + 1, end).trim();
}

function findStatementSeparators(query: string): number[] {
  const separators: number[] = [];
  let quote: "'" | '"' | "`" | null = null;
  let dollarQuote: string | null = null;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < query.length; index += 1) {
    const character = query[index];
    const nextCharacter = query[index + 1];

    if (lineComment) {
      if (character === "\n") {
        lineComment = false;
      }
      continue;
    }
    if (blockComment) {
      if (character === "*" && nextCharacter === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (dollarQuote) {
      if (query.startsWith(dollarQuote, index)) {
        index += dollarQuote.length - 1;
        dollarQuote = null;
      }
      continue;
    }
    if (quote) {
      if (character === quote) {
        if (nextCharacter === quote) {
          index += 1;
        } else {
          quote = null;
        }
      }
      continue;
    }
    if ((character === "-" && nextCharacter === "-") || character === "#") {
      lineComment = true;
      if (character === "-") {
        index += 1;
      }
      continue;
    }
    if (character === "/" && nextCharacter === "*") {
      blockComment = true;
      index += 1;
      continue;
    }
    if (character === "$") {
      const delimiter = query.slice(index).match(/^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/)?.[0];
      if (delimiter) {
        dollarQuote = delimiter;
        index += delimiter.length - 1;
        continue;
      }
    }
    if (character === "'" || character === '"' || character === "`") {
      quote = character;
      continue;
    }
    if (character === ";") {
      separators.push(index);
    }
  }

  return separators;
}

function QueryResultView({ result, viewMode, onViewModeChange }: { result: QueryResult; viewMode: ViewMode; onViewModeChange: (viewMode: ViewMode) => void }) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const payload = useMemo(() => serializeJson(result.columns, result.rows), [result.columns, result.rows]);
  const columns = useMemo<ColumnDef<Record<string, unknown>, unknown>[]>(
    () =>
      result.columns.map((column) => ({
        accessorKey: column,
        header: column,
        cell: (context) => formatCell(context.getValue()),
      })),
    [result.columns],
  );
  const table = useDataTable({ columns, data: result.rows });

  if (result.columns.length === 0) {
    return (
      <span>
        {result.affected} row(s) affected in {result.duration_ms} ms.
      </span>
    );
  }

  const isJson = viewMode === "json";

  const copyJson = async () => {
    setFeedback(
      (await copyJsonToClipboard(payload.text)) === "success"
        ? "JSON copied to clipboard."
        : "Could not copy JSON.",
    );
  };

  const exportJson = () => {
    const result = exportJsonFile(payload.text, "sql-result.json");
    setFeedback(
      result === "success"
        ? "JSON export started."
        : result === "cancelled"
          ? "JSON export cancelled."
          : "Could not export JSON.",
    );
  };

  const activateViewMode = (event: KeyboardEvent<HTMLButtonElement>, nextMode: ViewMode) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onViewModeChange(nextMode);
    }
  };

  return (
    <div className="flex h-full min-w-0 flex-col gap-0">
      <div
        aria-label="Query result statistics"
        className="flex shrink-0 items-center gap-3 border-b border-border/70 bg-background/80 px-3 py-1.5 text-[0.65rem] text-muted-foreground"
      >
        <span>{result.rows.length} rows</span>
        <span>{result.columns.length} columns</span>
        <span>{result.duration_ms} ms</span>
      </div>
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
        {isJson ? (
          <JsonCodePanel
            ariaLabel="SQL result JSON"
            text={payload.text}
            meta={`${result.rows.length} rows · ${result.duration_ms} ms`}
            fontScope="results"
            issues={payload.issues.length > 0}
            largeMessage={exceedsJsonRenderThreshold(payload.rowCount) ? "Large result: showing only the loaded rows." : undefined}
            actions={
              <>
                <Button type="button" size="xs" variant="ghost" onClick={() => void copyJson()} aria-label="Copy SQL result JSON"><RiFileCopyLine data-icon="inline-start" />Copy</Button>
                <Button type="button" size="xs" variant="ghost" onClick={exportJson} aria-label="Export SQL result JSON"><RiDownloadLine data-icon="inline-start" />Export</Button>
              </>
            }
          />
        ) : <DataTable table={table} className="h-full w-full" withShell={false} />}
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border/70 bg-background/80 px-2 py-2">
        <div className="flex items-center gap-1" role="group" aria-label="SQL result view">
          <Button type="button" size="xs" variant={!isJson ? "secondary" : "ghost"} aria-pressed={!isJson} onClick={() => onViewModeChange("table")} onKeyDown={(event) => activateViewMode(event, "table")}>Table</Button>
          <Button type="button" size="xs" variant={isJson ? "secondary" : "ghost"} aria-pressed={isJson} onClick={() => onViewModeChange("json")} onKeyDown={(event) => activateViewMode(event, "json")}>JSON</Button>
        </div>
      </div>
      <p aria-live="polite" className="sr-only">{feedback}</p>
    </div>
  );
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "NULL";
  }
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

type SqlEditorTab = QueryTab;
type TableTab = DataTableTab;

function withDatabase(profile: ConnectionProfile, database: string): ConnectionProfile {
  if (profile.connect_mode.type !== "fields") {
    return profile;
  }

  return {
    ...profile,
    connect_mode: { ...profile.connect_mode, database },
  };
}

function createSqlTab(number: number, connectionId: string, database: string): SqlEditorTab {
  return {
    id: `sql-${number}`,
    type: "query",
    connectionId,
    database,
    title: `Query ${number}`,
    query: "",
    isDirty: false,
    queryResult: null,
    queryError: null,
    viewMode: "table",
  };
}

const DEFAULT_QUERY = "select * from users limit 100;";
