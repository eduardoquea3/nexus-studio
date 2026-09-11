import { MySQL, PostgreSQL, SQLite, sql } from "@codemirror/lang-sql";
import { EditorView } from "@codemirror/view";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";

import type { DataTableTab, QueryTab, WorkspaceTab } from "@/shared/types/connection-workspace";
import type { ConnectionProfile, ObjectMeta } from "@/shared/types/models";

import {
  describeConnection,
  describeTab,
  nextTabIndex,
  type CommandBarItem,
  type CommandBarMode,
} from "@/app/command-bar/command-bar-utils";
import { databasesQueryKey } from "@/app/connection/hooks/use-databases";
import { useSchemaObjects, schemaObjectsQueryKey } from "@/app/connection/hooks/use-schema-objects";
import { getInitialDatabase } from "@/app/connection/services/database-service";
import { useConnections } from "@/app/home/hooks/use-connections";
import { toast } from "@/components/ui/toast";
import {
  createSqlColumnCompletionSource,
  createSqlTableCompletions,
} from "@/shared/lib/sql-autocomplete";
import {
  getRoutineDefinition,
  getTableSchema,
  runQuery,
  testSavedConnection,
} from "@/shared/lib/tauriApi";
import { useModalStore } from "@/shared/store/modalStore";
import { useWorkspaceStore } from "@/shared/store/workspace-store";

import { getQuerySegment } from "./connection-workspace-utils";

export type SqlEditorTab = QueryTab;
export type TableTab = DataTableTab;
export type WorkspaceController = ReturnType<typeof useConnectionWorkspaceController>;
export type ConnectionWorkspaceControllerProps = {
  profile: ConnectionProfile;
  onConnectionSwitch?: (profile: ConnectionProfile) => void | Promise<void>;
};

export function useConnectionWorkspaceController({
  profile,
  onConnectionSwitch,
}: ConnectionWorkspaceControllerProps) {
  const navigate = useNavigate();
  const openModal = useModalStore((state) => state.openModal);
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
  const [switcherCycle, setSwitcherCycle] = useState<{ sequence: number; direction: -1 | 1 }>();
  const [switcherInitialDirection, setSwitcherInitialDirection] = useState<-1 | 1>(1);
  const [switchingConnectionIds, setSwitchingConnectionIds] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const editorSectionRef = useRef<HTMLElement>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const initializedEditorIdsRef = useRef(new Set<string>());
  const loadingRoutineIdsRef = useRef(new Set<string>());
  const restoringWorkspaceRef = useRef(false);
  const initializedWorkspaceConnectionIdRef = useRef<string | null>(null);
  const sqlTabsRef = useRef(sqlTabs);
  const activeSqlTabIdRef = useRef(activeSqlTabId);
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
  const activeSqlTab = sqlTabs.find((tab) => tab.id === activeSqlTabId) ?? sqlTabs[0];
  const activeTableTab = tableTabs.find((tab) => tab.id === activeTabId);
  const sqlTables = useMemo(
    () => schemaObjects.filter((object) => object.object_type === "table"),
    [schemaObjects],
  );
  const sqlDialect =
    profile.db_type === "postgres" ? PostgreSQL : profile.db_type === "mysql" ? MySQL : SQLite;
  const sqlIdentifierQuote = profile.db_type === "mysql" ? "`" : '"';
  const sqlLanguageExtensions = useMemo(() => {
    const support = sql({
      dialect: sqlDialect,
      schema: {},
      tables: createSqlTableCompletions(sqlTables),
    });
    const columnCompletion = createSqlColumnCompletionSource(
      sqlTables,
      (table) =>
        getTableSchema(withDatabase(profile, selectedDatabase), table.name, table.schema).then(
          (schema) => schema.columns,
        ),
      sqlIdentifierQuote,
    );
    return [support, support.language.data.of({ autocomplete: columnCompletion })];
  }, [profile, selectedDatabase, sqlDialect, sqlIdentifierQuote, sqlTables]);
  const workspaceTabs = [
    ...sqlTabs.map((tab) => ({ ...tab, type: "sql" as const })),
    ...tableTabs.map((tab) => ({ ...tab, type: "table" as const })),
  ];
  const switcherTabsRef = useRef<typeof workspaceTabs>([]);
  const commandBarTabs =
    commandBarMode === "tab-switcher" ? switcherTabsRef.current : workspaceTabs;
  const commandBarItems = useMemo<CommandBarItem[]>(
    () =>
      commandBarMode === "commands"
        ? [
            {
              id: "command:disconnect",
              kind: "command" as const,
              label: "Disconnect",
              detail: "Return to Home",
              isActive: false as const,
              command: "disconnect" as const,
            },
            {
              id: "command:new-connection",
              kind: "command" as const,
              label: "New connection",
              detail: "Create a saved connection",
              isActive: false as const,
              command: "new-connection" as const,
            },
          ]
        : commandBarMode === "tab-switcher"
          ? commandBarTabs.map((tab) => {
              const workspaceTab: QueryTab | DataTableTab =
                tab.type === "sql" ? { ...tab, type: "query" } : { ...tab, type: "datatable" };
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
    [
      activeTabId,
      commandBarMode,
      commandBarTabs,
      connections,
      profile.id,
      schemaObjects,
      selectedDatabase,
    ],
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
      if (workspaceTabs.find((tab) => tab.id === originTabId)?.type === "sql")
        setActiveSqlTabId(originTabId);
    }
    setCommandBarMode(null);
    setSwitcherCycle(undefined);
    previewOriginTabIdRef.current = null;
    requestAnimationFrame(() =>
      restoreFocusRef.current?.isConnected
        ? restoreFocusRef.current.focus()
        : editorSectionRef.current?.focus(),
    );
  };
  const openCommandBar = (mode: CommandBarMode, direction: -1 | 1 = 1) => {
    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
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
    if (switchingConnectionIdsRef.current.has(nextProfile.id)) return;
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
        description: detail
          ? `The connection was not changed. Details: ${detail}`
          : "The connection was not changed.",
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
      if (!(target instanceof HTMLElement)) return false;
      const isCodeMirror =
        Boolean(target.closest(".cm-editor, .cm-content")) ||
        target.getAttribute("aria-label")?.endsWith("SQL query editor") === true;
      return (
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
        (!isCodeMirror && target.isContentEditable) ||
        (!isCodeMirror && Boolean(target.closest("[contenteditable='true']")))
      );
    };
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      if (event.key.toLowerCase() === "p") {
        event.preventDefault();
        event.stopPropagation();
        openCommandBar(event.shiftKey ? "commands" : "palette");
        return;
      }
      if (event.key === "Tab") {
        if (
          !workspaceTabs.length ||
          (commandBarMode !== "tab-switcher" && isEditableTarget(event.target))
        )
          return;
        event.preventDefault();
        event.stopPropagation();
        if (commandBarMode !== "tab-switcher")
          openCommandBar("tab-switcher", event.shiftKey ? -1 : 1);
        else {
          const direction = event.shiftKey ? -1 : 1;
          switcherCycleRef.current += 1;
          setSwitcherCycle({ sequence: switcherCycleRef.current, direction });
        }
      }
    };
    const handleKeyUp = (event: globalThis.KeyboardEvent) => {
      if (commandBarMode !== "tab-switcher" || (event.key !== "Control" && event.key !== "Meta"))
        return;
      event.preventDefault();
      const item = commandBarItems.find(
        (candidate): candidate is Extract<CommandBarItem, { kind: "tab" }> =>
          candidate.kind === "tab" && candidate.id === selectedSwitcherTabIdRef.current,
      );
      if (item) {
        activateWorkspaceTab(profile.id, item.id);
        setActiveTabId(item.id);
        if (item.tab.type === "query") setActiveSqlTabId(item.id);
      }
      closeCommandBar(true);
    };
    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup", handleKeyUp, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", handleKeyUp, true);
    };
  }, [activateWorkspaceTab, commandBarItems, commandBarMode, profile.id, workspaceTabs.length]);
  const focusEditor = (view: EditorView, tabId: string) => {
    view.focus();
    if (!initializedEditorIdsRef.current.has(tabId)) {
      view.dispatch({ selection: { anchor: 0, head: view.state.doc.length } });
      initializedEditorIdsRef.current.add(tabId);
    }
  };
  useEffect(() => {
    if (editorViewRef.current) focusEditor(editorViewRef.current, activeSqlTabId);
  }, [activeSqlTabId]);
  useEffect(() => setSelectedDatabase(getInitialDatabase(profile)), [profile]);
  useEffect(() => {
    if (
      !workspaceHydrated ||
      restoringWorkspaceRef.current ||
      initializedWorkspaceConnectionIdRef.current === profile.id
    )
      return;
    initializedWorkspaceConnectionIdRef.current = profile.id;
    restoringWorkspaceRef.current = true;
    setActiveConnection(profile.id);
    if (storedWorkspace) {
      const restoredSqlTabs = storedWorkspace.tabs.flatMap((tab): SqlEditorTab[] =>
        tab.type === "query"
          ? [tab]
          : tab.type === "routine"
            ? [
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
              ]
            : [],
      );
      const restoredTableTabs = storedWorkspace.tabs.filter(
        (tab): tab is TableTab => tab.type === "datatable",
      );
      const activeTab = storedWorkspace.tabs.find((tab) => tab.id === storedWorkspace.activeTabId);
      setSqlTabs(restoredSqlTabs);
      sqlTabsRef.current = restoredSqlTabs;
      setTableTabs(restoredTableTabs);
      setActiveTabId(storedWorkspace.activeTabId ?? restoredSqlTabs[0]?.id ?? "");
      const activeSql = activeTab?.type === "query" ? activeTab : restoredSqlTabs[0];
      setActiveSqlTabId(activeSql?.id ?? "");
      setSelectedDatabase(
        activeSql?.database ?? activeTab?.database ?? getInitialDatabase(profile),
      );
    } else {
      const initialTab = createSqlTab(1, profile.id, getInitialDatabase(profile));
      setSqlTabs([initialTab]);
      sqlTabsRef.current = [initialTab];
      setTableTabs([]);
      setActiveTabId(initialTab.id);
      setActiveSqlTabId(initialTab.id);
      setSelectedDatabase(initialTab.database);
      setConnectionWorkspace({
        connectionId: profile.id,
        activeTabId: initialTab.id,
        tabs: [initialTab],
      });
    }
  }, [profile, setActiveConnection, setConnectionWorkspace, storedWorkspace, workspaceHydrated]);
  useEffect(() => {
    if (!workspaceHydrated) return;
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
    const handler = (event: globalThis.KeyboardEvent) => {
      if (
        event.key.toLowerCase() !== "r" ||
        !(event.ctrlKey || event.metaKey) ||
        event.altKey ||
        !activeTabId.startsWith("table-")
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      setTableRefreshToken((token) => token + 1);
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [activeTabId]);

  const createEditorTab = () => {
    const number =
      sqlTabsRef.current.reduce((highest, tab) => {
        const value = Number(tab.id.replace("sql-", ""));
        return Number.isNaN(value) ? highest : Math.max(highest, value);
      }, 0) + 1;
    const tab = createSqlTab(number, profile.id, selectedDatabase);
    const tabs = [...sqlTabsRef.current, tab];
    sqlTabsRef.current = tabs;
    setSqlTabs(tabs);
    activeSqlTabIdRef.current = tab.id;
    setActiveSqlTabId(tab.id);
    setActiveTabId(tab.id);
  };
  const removeEditorTab = (tabId: string, focusTabId?: string) => {
    const currentTabs = sqlTabsRef.current;
    const index = currentTabs.findIndex((tab) => tab.id === tabId);
    if (index < 0) return;
    const tabs = currentTabs.filter((tab) => tab.id !== tabId);
    sqlTabsRef.current = tabs;
    setSqlTabs(tabs);
    if (activeSqlTabIdRef.current === tabId) {
      const next = tabs[Math.max(0, index - 1)];
      activeSqlTabIdRef.current = next?.id ?? "";
      setActiveSqlTabId(next?.id ?? "");
      setActiveTabId(focusTabId ?? next?.id ?? "");
      if (!next) editorSectionRef.current?.focus();
    }
  };
  const closeEditorTab = (tabId: string, focusTabId?: string) => {
    const tab = sqlTabs.find((item) => item.id === tabId);
    if (!tab) return;
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
        data: { cancel: { children: "Cancel", onClick: () => undefined } },
      });
      return;
    }
    removeEditorTab(tabId, focusTabId);
  };
  const closeTableTab = (tabId: string, focusTabId?: string) => {
    setTableTabs((tabs) => tabs.filter((tab) => tab.id !== tabId));
    if (activeTabId === tabId) setActiveTabId(focusTabId ?? activeSqlTabId);
  };
  const getPreviousWorkspaceTabId = (tabId: string) => {
    const index = workspaceTabs.findIndex((tab) => tab.id === tabId);
    return index < 0 ? undefined : (workspaceTabs[index - 1]?.id ?? workspaceTabs[index + 1]?.id);
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
    const storedTab = useWorkspaceStore
      .getState()
      .connections[profile.id]?.tabs.find(
        (tab): tab is DataTableTab =>
          tab.type === "datatable" &&
          tab.database === selectedDatabase &&
          tab.schema === schema &&
          tab.tableName === table,
      );
    const active = storedTab ?? nextTab;
    setTableTabs((tabs) => (tabs.some((tab) => tab.id === active.id) ? tabs : [...tabs, active]));
    setActiveTabId(active.id);
  };
  const handleDatabaseChange = (database: string) => {
    setSelectedDatabase(database);
    const tabs = sqlTabsRef.current.map((tab) => ({ ...tab, database }));
    sqlTabsRef.current = tabs;
    setSqlTabs(tabs);
  };
  const openRoutineTab = async (routine: ObjectMeta) => {
    const id = `routine-${encodeURIComponent(selectedDatabase)}-${routine.object_type}-${encodeURIComponent(routine.signature ?? routine.name)}`;
    if (sqlTabsRef.current.some((tab) => tab.id === id)) {
      activeSqlTabIdRef.current = id;
      setActiveSqlTabId(id);
      setActiveTabId(id);
      return;
    }
    if (loadingRoutineIdsRef.current.has(id)) return;
    loadingRoutineIdsRef.current.add(id);
    try {
      const definition = await getRoutineDefinition(
        withDatabase(profile, selectedDatabase),
        routine,
      );
      const tabs = sqlTabsRef.current.some((tab) => tab.id === id)
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
      sqlTabsRef.current = tabs;
      setSqlTabs(tabs);
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
    if (!activeSqlTab) return;
    const tabs = sqlTabsRef.current.map((tab) =>
      tab.id === activeSqlTab.id ? { ...tab, query, isDirty: query.length > 0 } : tab,
    );
    sqlTabsRef.current = tabs;
    setSqlTabs(tabs);
  };
  const executeActiveQuery = async () => {
    if (!activeSqlTab || !editorViewRef.current || isRunning) return;
    const query =
      getQuerySegment(activeSqlTab.query, editorViewRef.current.state.selection.main.head) ||
      DEFAULT_QUERY;
    setIsRunning(true);
    setSqlTabs((tabs) =>
      tabs.map((tab) =>
        tab.id === activeSqlTab.id
          ? { ...tab, queryResult: null, queryError: null, viewMode: "table" }
          : tab,
      ),
    );
    try {
      const result = await runQuery(withDatabase(profile, selectedDatabase), query);
      setSqlTabs((tabs) =>
        tabs.map((tab) => (tab.id === activeSqlTab.id ? { ...tab, queryResult: result } : tab)),
      );
      if (/^create\s+table\b/i.test(query))
        await queryClient.invalidateQueries({ queryKey: schemaObjectsQueryKey(profile.id) });
      if (/^create\s+database\b/i.test(query))
        await queryClient.invalidateQueries({ queryKey: databasesQueryKey(profile.id) });
    } catch (error) {
      setSqlTabs((tabs) =>
        tabs.map((tab) =>
          tab.id === activeSqlTab.id
            ? {
                ...tab,
                queryResult: null,
                queryError: error instanceof Error ? error.message : String(error),
              }
            : tab,
        ),
      );
    } finally {
      setIsRunning(false);
    }
  };
  const handleWorkspaceKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
    if (event.key === "Enter" && activeSqlTab) {
      event.preventDefault();
      void executeActiveQuery();
    } else if (event.key.toLowerCase() === "t") {
      event.preventDefault();
      createEditorTab();
    } else if (event.key.toLowerCase() === "w" && activeTabId.startsWith("table-")) {
      event.preventDefault();
      closeTableTab(activeTabId, getPreviousWorkspaceTabId(activeTabId));
    } else if (event.key.toLowerCase() === "w" && activeSqlTab) {
      event.preventDefault();
      closeEditorTab(activeSqlTab.id, getPreviousWorkspaceTabId(activeSqlTab.id));
    }
  };
  const tabItems: WorkspaceTab[] = (
    commandBarMode === "tab-switcher" ? switcherTabsRef.current : workspaceTabs
  ).map((tab) => (tab.type === "sql" ? { ...tab, type: "query" } : { ...tab, type: "datatable" }));
  return {
    profile,
    selectedDatabase,
    activeSqlTab,
    activeTableTab,
    sqlTabs,
    tableTabs,
    activeSqlTabId,
    activeTabId,
    setActiveTabId,
    setActiveSqlTabId,
    setSqlTabs,
    isRunning,
    tableRefreshToken,
    sqlLanguageExtensions,
    editorSectionRef,
    editorViewRef,
    focusEditor,
    workspaceTabs,
    commandBarMode,
    commandBarItems,
    tabItems,
    switcherCycle,
    switcherInitialDirection,
    switchingConnectionIds,
    isLoadingConnections,
    isFetchingConnections,
    isLoadingSchema,
    isFetchingSchema,
    navigate,
    openModal,
    openCommandBar,
    closeCommandBar,
    switchConnection,
    openTableTab,
    openRoutineTab,
    handleDatabaseChange,
    createEditorTab,
    closeEditorTab,
    closeTableTab,
    updateActiveQuery,
    executeActiveQuery,
    handleWorkspaceKeyDown,
    activateWorkspaceTab,
    nextTabIndex,
  };
}

function withDatabase(profile: ConnectionProfile, database: string): ConnectionProfile {
  return profile.connect_mode.type !== "fields"
    ? profile
    : { ...profile, connect_mode: { ...profile.connect_mode, database } };
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
