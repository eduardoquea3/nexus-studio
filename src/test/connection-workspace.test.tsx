import "./setup";

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useEffect } from "react";
import type { ConnectionProfile, QueryResult } from "@/shared/types/models";
import { useWorkspaceStore } from "@/shared/store/workspace-store";

const invalidateQueries = mock(() => Promise.resolve());
const runQuery = mock(async (): Promise<QueryResult> => ({
  columns: [],
  rows: [],
  affected: 0,
  duration_ms: 1,
}));
const listSchemaObjects = mock(async () => []);
const getRoutineDefinition = mock(async () => "CREATE FUNCTION refresh_company() RETURNS void AS $$ BEGIN END; $$ LANGUAGE plpgsql;");
const getTableData = mock(async () => ({
  columns: [],
  rows: [],
  total: 0,
  page: 1,
  page_size: 100,
}));
const getTableSchema = mock(async () => ({
  columns: [],
  indexes: [],
}));
const testSavedConnection = mock(async () => "ok");
const addToast = mock((_options: unknown) => "toast-1");
const availableConnections: ConnectionProfile[] = [];

mock.module("@uiw/react-codemirror", () => ({
  default: ({
    value,
    onChange,
    onCreateEditor,
    "aria-label": ariaLabel,
  }: {
    value: string;
    onChange: (value: string) => void;
    onCreateEditor?: (view: {
      state: { selection: { main: { head: number } }; doc: { length: number } };
      focus: () => void;
      dispatch: (payload: { selection: { anchor: number; head: number } }) => void;
    }) => void;
    "aria-label": string;
  }) => {
    useEffect(() => {
      onCreateEditor?.({
        state: { selection: { main: { head: value.length } }, doc: { length: value.length } },
        focus: () => undefined,
        dispatch: () => undefined,
      });
    }, [onCreateEditor, value]);

    return (
      <div
        aria-label={ariaLabel}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        tabIndex={0}
        onInput={(event) => onChange(event.currentTarget.textContent ?? "")}
      >
        {value}
      </div>
    );
  },
}));

mock.module("react-resizable-panels", () => ({
  Group: ({ children, className }: { children?: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  Panel: ({ children, className }: { children?: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  Separator: ({ children, className, "aria-label": ariaLabel }: { children?: ReactNode; className?: string; "aria-label"?: string }) => (
    <div className={className} aria-label={ariaLabel}>{children}</div>
  ),
}));

mock.module("@/app/connection/components/connection-sidebar", () => ({
  ConnectionSidebar: ({
    onDatabaseChange,
    onTableSelect,
    onRoutineSelect,
  }: {
    onDatabaseChange: (database: string) => void;
    onTableSelect: (table: string) => void;
    onRoutineSelect: (routine: {
      name: string;
      object_type: "function";
      signature: string;
    }) => void;
  }) => (
    <aside data-testid="connection-sidebar">
      <button type="button" onClick={() => onDatabaseChange("development")}>
        Select development
      </button>
      <button type="button" onClick={() => onTableSelect("company")}>
        Open company
      </button>
      <button
        type="button"
        onDoubleClick={() =>
          onRoutineSelect({
            name: "refresh_company",
            object_type: "function",
            signature: "public.refresh_company()",
          })
        }
      >
        Open refresh_company
      </button>
      <button
        type="button"
        onDoubleClick={() =>
          onRoutineSelect({
            name: "refresh_company",
            object_type: "function",
            signature: "public.refresh_company(integer)",
          })
        }
      >
        Open refresh_company(integer)
      </button>
    </aside>
  ),
}));

mock.module("@/shared/lib/tauriApi", () => ({
  connect: mock(async () => ({ connected: true })),
  disconnect: mock(async () => undefined),
  getTableData,
  getTableRules: mock(async () => ({
    primary_key: null,
    foreign_keys: [],
    unique_constraints: [],
  })),
  getTableSchema,
  getRoutineDefinition,
  listConnections: mock(async () => []),
  listDatabases: mock(async () => []),
  listFunctions: mock(async () => []),
  listOtherObjects: mock(async () => []),
  listSchemaObjects,
  listSshConfigAliases: mock(async () => []),
  listTables: mock(async () => []),
  listViews: mock(async () => []),
  runQuery,
  saveConnection: mock(async () => undefined),
  testConnectionFields: mock(async () => "ok"),
  testSavedConnection,
}));

mock.module("@/app/home/hooks/use-connections", () => ({
  useConnections: () => ({ data: availableConnections }),
}));

mock.module("@/app/connection/hooks/use-schema-objects", () => ({
  schemaObjectsQueryKey: (connectionId: string, database?: string) => ["schema", connectionId, database],
  useSchemaObjects: () => ({ data: [], isLoading: false, isFetching: false }),
}));

mock.module("@/components/ui/toast", () => ({ toast: { add: addToast } }));

const { ConnectionWorkspace, getQuerySegment } = await import("../app/connection/components/connection-workspace");
const { act, cleanup, fireEvent, render, screen, within } = await import("@testing-library/react");

const profile = {
  id: "connection-1",
  name: "Test connection",
  db_type: "postgres",
  connect_mode: {
    type: "connection_string",
    value: "localhost:5432",
  },
  ssh_tunnel: null,
} as const;

const fieldsProfile = {
  ...profile,
  connect_mode: {
    type: "fields" as const,
    host: "localhost",
    port: 5455,
    database: "master",
    username: "postgres",
    password_ref: null,
  },
};

function renderWorkspace(connectionProfile: ConnectionProfile = profile) {
  const queryClient = new QueryClient();
  Object.assign(queryClient, { invalidateQueries });

  return render(
    <QueryClientProvider client={queryClient}>
      <ConnectionWorkspace profile={connectionProfile} />
    </QueryClientProvider>,
  );
}

function renderWorkspaceWithSwitch(onConnectionSwitch: (nextProfile: ConnectionProfile) => void | Promise<void>) {
  const queryClient = new QueryClient();
  Object.assign(queryClient, { invalidateQueries });
  useWorkspaceStore.setState({ isHydrated: true });

  return render(
    <QueryClientProvider client={queryClient}>
      <ConnectionWorkspace profile={profile} onConnectionSwitch={onConnectionSwitch} />
    </QueryClientProvider>,
  );
}

describe("ConnectionWorkspace SQL tabs", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    invalidateQueries.mockClear();
    runQuery.mockClear();
    getRoutineDefinition.mockClear();
    addToast.mockClear();
    testSavedConnection.mockReset();
    testSavedConnection.mockResolvedValue("ok");
    availableConnections.splice(0);
    useWorkspaceStore.setState(useWorkspaceStore.getInitialState());
  });

  afterEach(() => {
    cleanup();
    useWorkspaceStore.setState(useWorkspaceStore.getInitialState());
  });

  test("renders one editor and keeps one editor when tabs are added", () => {
    renderWorkspace();

    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(screen.getByRole("textbox", { name: "Query 1 SQL query editor" }).textContent).toBe("");

    fireEvent.click(screen.getByRole("button", { name: "Create SQL editor tab" }));

    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
  });

  test("keeps the SQL results pane visible even before running a query", () => {
    renderWorkspace();

    const resultsPane = screen.getByRole("region", { name: "SQL query results" });

    expect(within(resultsPane).getByText(/press ctrl\+enter to run it/i)).not.toBeNull();
  });

  test("does not carry the previous query result into a newly created editor", async () => {
    renderWorkspace();
    const editor = screen.getByRole("textbox", { name: "Query 1 SQL query editor" });
    fireEvent.input(editor, { target: { textContent: "select 1;" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Run query" }));
      await Promise.resolve();
    });

    expect(screen.getByText(/0 row\(s\) affected in 1 ms/i)).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Create SQL editor tab" }));

    const resultsPane = screen.getByRole("region", { name: "SQL query results" });
    expect(within(resultsPane).getByText(/press ctrl\+enter to run it/i)).not.toBeNull();
  });

  test("shows JSON only for tabular results and switches without rerunning", async () => {
    runQuery.mockResolvedValueOnce({
      columns: ["id", "name"],
      rows: [{ id: 1, name: "Ada" }],
      affected: 0,
      duration_ms: 2,
    });
    renderWorkspace();
    fireEvent.input(screen.getByRole("textbox", { name: "Query 1 SQL query editor" }), { target: { textContent: "select 1;" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Run query" }));
      await Promise.resolve();
    });

    expect(screen.getByRole("button", { name: "JSON" })).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "JSON" }));
    expect(screen.getByLabelText("SQL result JSON").textContent).toContain('"name": "Ada"');
    expect(runQuery).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Table" }));
    expect(screen.queryByLabelText("SQL result JSON")).toBeNull();
  });

  test("hides the previous result and JSON actions while a new query is running", async () => {
    let resolveQuery: ((result: QueryResult) => void) | undefined;
    runQuery.mockResolvedValueOnce({ columns: ["id"], rows: [{ id: 1 }], affected: 0, duration_ms: 1 });
    runQuery.mockImplementationOnce(() => new Promise<QueryResult>((resolve) => {
      resolveQuery = resolve;
    }));
    renderWorkspace();
    fireEvent.input(screen.getByRole("textbox", { name: "Query 1 SQL query editor" }), { target: { textContent: "select 1;" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Run query" }));
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole("button", { name: "JSON" }));
    expect(screen.getByLabelText("SQL result JSON").textContent).toContain('"id": 1');

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Run query" }));
      await Promise.resolve();
    });

    expect(screen.getByText(/running query/i)).not.toBeNull();
    expect(screen.queryByRole("button", { name: "JSON" })).toBeNull();
    expect(screen.queryByLabelText("SQL result JSON")).toBeNull();

    await act(async () => {
      resolveQuery?.({ columns: ["id"], rows: [{ id: 1 }], affected: 0, duration_ms: 1 });
      await Promise.resolve();
    });
    expect(screen.getByRole("button", { name: "JSON" })).not.toBeNull();
  });

  test("does not expose JSON for a zero-row SELECT with columns", async () => {
    runQuery.mockResolvedValueOnce({ columns: ["id"], rows: [], affected: 0, duration_ms: 1 });
    renderWorkspace();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Run query" }));
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole("button", { name: "JSON" }));
    expect(screen.getByLabelText("SQL result JSON").textContent).toBe("[]");
  });

  test("does not expose JSON controls for SQL errors", async () => {
    runQuery.mockRejectedValueOnce(new Error("syntax error"));
    renderWorkspace();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Run query" }));
      await Promise.resolve();
    });

    expect(screen.getByText("syntax error")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "JSON" })).toBeNull();
    expect(screen.queryByRole("button", { name: /copy sql result json/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /export sql result json/i })).toBeNull();
  });

  test("exposes selected mode and supports keyboard activation", async () => {
    runQuery.mockResolvedValueOnce({ columns: ["id"], rows: [{ id: 1 }], affected: 0, duration_ms: 1 });
    renderWorkspace();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Run query" }));
      await Promise.resolve();
    });

    const tableButton = screen.getByRole("button", { name: "Table" });
    const jsonButton = screen.getByRole("button", { name: "JSON" });
    expect(tableButton.getAttribute("aria-pressed")).toBe("true");
    expect(jsonButton.getAttribute("aria-pressed")).toBe("false");
    jsonButton.focus();
    expect(document.activeElement).toBe(jsonButton);

    fireEvent.keyDown(jsonButton, { key: "Enter" });

    expect(jsonButton.getAttribute("aria-pressed")).toBe("true");
    expect(tableButton.getAttribute("aria-pressed")).toBe("false");
  });

  test("announces export success and sends the exact displayed payload", async () => {
    runQuery.mockResolvedValueOnce({ columns: ["id"], rows: [{ id: 1 }], affected: 0, duration_ms: 1 });
    const createObjectURL = mock((value: Blob) => {
      void value;
      return "blob:sql-result";
    });
    const revokeObjectURL = mock(() => undefined);
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });
    const click = mock(() => undefined);
    const originalCreateElement = document.createElement.bind(document);
    document.createElement = ((tagName: string) => {
      const element = originalCreateElement(tagName);
      if (tagName === "a") element.click = click;
      return element;
    }) as typeof document.createElement;

    renderWorkspace();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Run query" }));
      await Promise.resolve();
    });
    fireEvent.click(screen.getByRole("button", { name: "JSON" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Export SQL result JSON" }));
      await Promise.resolve();
    });

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0]?.[0];
    expect(blob).toBeInstanceOf(Blob);
    if (!(blob instanceof Blob)) throw new Error("Expected an exported JSON Blob");
    expect(await blob.text()).toBe('[\n  {\n    "id": 1\n  }\n]');
    expect(screen.getByText("JSON export started.")).not.toBeNull();
    expect(runQuery).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
  });

  test("announces an actual export failure without mutating database state", async () => {
    runQuery.mockResolvedValueOnce({ columns: ["id"], rows: [{ id: 1 }], affected: 0, duration_ms: 1 });
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: mock(() => { throw new Error("blocked"); }) });
    renderWorkspace();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Run query" }));
      await Promise.resolve();
    });
    fireEvent.click(screen.getByRole("button", { name: "JSON" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Export SQL result JSON" }));
      await Promise.resolve();
    });

    expect(screen.getByText("Could not export JSON.")).not.toBeNull();
    expect(runQuery).toHaveBeenCalledTimes(1);
    expect(invalidateQueries).not.toHaveBeenCalled();
  });

  test("warns when a large loaded SQL page is displayed without fetching more rows", async () => {
    const rows = Array.from({ length: 10_001 }, (_, id) => ({ id }));
    runQuery.mockResolvedValueOnce({ columns: ["id"], rows, affected: 0, duration_ms: 1 });
    renderWorkspace();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Run query" }));
      await Promise.resolve();
    });
    fireEvent.click(screen.getByRole("button", { name: "JSON" }));

    expect(screen.getByText("Large result: showing only the loaded rows.")).not.toBeNull();
    expect(runQuery).toHaveBeenCalledTimes(1);
  });

  test("keeps JSON mode isolated between SQL tabs", async () => {
    runQuery
      .mockResolvedValueOnce({ columns: ["id"], rows: [{ id: 1 }], affected: 0, duration_ms: 1 })
      .mockResolvedValueOnce({ columns: ["id"], rows: [{ id: 2 }], affected: 0, duration_ms: 1 });
    renderWorkspace();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Run query" }));
      await Promise.resolve();
    });
    fireEvent.click(screen.getByRole("button", { name: "JSON" }));
    fireEvent.click(screen.getByRole("button", { name: "Create SQL editor tab" }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Run query" }));
      await Promise.resolve();
    });
    expect(screen.queryByLabelText("SQL result JSON")).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: /Query 1/ }));

    expect(screen.getByLabelText("SQL result JSON").textContent).toContain('"id": 1');
  });

  test("announces clipboard failure and leaves the JSON view usable", async () => {
    runQuery.mockResolvedValueOnce({ columns: ["id"], rows: [{ id: 1 }], affected: 0, duration_ms: 1 });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: mock(() => Promise.reject(new Error("denied"))) } });
    renderWorkspace();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Run query" }));
      await Promise.resolve();
    });
    fireEvent.click(screen.getByRole("button", { name: "JSON" }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy SQL result JSON" }));
      await Promise.resolve();
    });
    expect(screen.getByText("Could not copy JSON.")).not.toBeNull();
    expect(screen.getByLabelText("SQL result JSON").textContent).toContain('"id": 1');
  });

  test("does not expose JSON actions for non-tabular results", async () => {
    runQuery.mockResolvedValueOnce({ columns: [], rows: [], affected: 1, duration_ms: 2 });
    renderWorkspace();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Run query" }));
      await Promise.resolve();
    });

    expect(screen.queryByRole("button", { name: "JSON" })).toBeNull();
    expect(screen.getByText(/1 row\(s\) affected/i)).not.toBeNull();
  });

  test("switches the single editor to the selected tab", () => {
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "Create SQL editor tab" }));
    fireEvent.click(screen.getByRole("tab", { name: /Query 1/ }));

    expect(screen.getByRole("textbox", { name: "Query 1 SQL query editor" })).not.toBeNull();
    expect(screen.queryByRole("textbox", { name: "Query 2 SQL query editor" })).toBeNull();
  });

  test("closes tabs without leaving duplicate editors or scroll containers", () => {
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "Create SQL editor tab" }));
    fireEvent.click(screen.getByRole("button", { name: "Close Query 2" }));

    expect(screen.getAllByRole("tab")).toHaveLength(1);
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Close Query 2" })).toBeNull();
    expect(screen.getByRole("tablist").className).not.toContain("overflow-x-auto");
    expect(screen.getByRole("tablist").className).toContain("overflow-hidden");
    expect(screen.getByRole("tabpanel").className).toContain("overflow-hidden");
  });

  test("keeps the tab controls left aligned and exposes a close control for a single tab", () => {
    renderWorkspace();

    const tabList = screen.getByRole("tablist");
    const createTab = screen.getByRole("button", { name: "Create SQL editor tab" });

    expect(tabList.className).not.toContain("flex-1");
    expect(createTab.previousElementSibling).toBe(tabList);
    expect(screen.getByRole("button", { name: "Close Query 1" })).not.toBeNull();
  });

  test("marks edited SQL tabs as having unsaved changes", () => {
    renderWorkspace();
    const editor = screen.getByRole("textbox", { name: "Query 1 SQL query editor" });
    const indicatorSlot = screen.getByTestId("unsaved-change-slot-sql-1");

    expect(indicatorSlot.className).toContain("size-1.5");
    expect(within(indicatorSlot).queryByLabelText("Unsaved changes in Query 1")).toBeNull();

    fireEvent.input(editor, { target: { textContent: "select 1;" } });

    expect(within(indicatorSlot).getByLabelText("Unsaved changes in Query 1")).not.toBeNull();
  });

  test("asks via toast before Ctrl+W closes an edited SQL tab", () => {
    renderWorkspace();
    const editor = screen.getByRole("textbox", { name: "Query 1 SQL query editor" });

    fireEvent.input(editor, { target: { textContent: "select 1;" } });
    fireEvent.keyDown(editor, { key: "w", code: "KeyW", ctrlKey: true });

    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Discard changes in Query 1?",
        timeout: 0,
      }),
    );
    expect(addToast.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        actionProps: expect.objectContaining({ children: "Discard" }),
        data: expect.objectContaining({
          cancel: expect.objectContaining({ children: "Cancel" }),
        }),
      }),
    );
    expect(screen.getByRole("textbox", { name: "Query 1 SQL query editor" })).not.toBeNull();

    const options = addToast.mock.calls[0][0] as {
      actionProps: { onClick: () => void };
    };
    act(() => {
      options.actionProps.onClick();
    });

    expect(screen.queryByRole("textbox")).toBeNull();
  });

  test("updates the query in the active tab", () => {
    renderWorkspace();
    const editor = screen.getByRole("textbox", { name: "Query 1 SQL query editor" });

    fireEvent.input(editor, { target: { textContent: "select 1;" } });

    expect(editor.textContent).toBe("select 1;");
  });

  test("invalidates schema objects after a successful create table query", async () => {
    renderWorkspace();
    const editor = screen.getByRole("textbox", { name: "Query 1 SQL query editor" });

    fireEvent.input(editor, { target: { textContent: "create table sample (id int);" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Run query" }));
      await Promise.resolve();
    });

    expect(runQuery).toHaveBeenCalledTimes(1);
    expect(invalidateQueries).toHaveBeenCalledTimes(1);
  });

  test("invalidates databases after a successful create database query", async () => {
    renderWorkspace();
    const editor = screen.getByRole("textbox", { name: "Query 1 SQL query editor" });

    fireEvent.input(editor, { target: { textContent: "create database reporting;" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Run query" }));
      await Promise.resolve();
    });

    expect(runQuery).toHaveBeenCalledTimes(1);
    expect(invalidateQueries).toHaveBeenCalledTimes(1);
  });

  test("executes SQL against the database selected in the sidebar", async () => {
    renderWorkspace(fieldsProfile);
    const editor = screen.getByRole("textbox", { name: "Query 1 SQL query editor" });
    fireEvent.input(editor, { target: { textContent: "select 1;" } });
    fireEvent.click(screen.getByRole("button", { name: "Select development" }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Run query" }));
      await Promise.resolve();
    });

    expect(runQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({
        connect_mode: expect.objectContaining({ database: "development" }),
      }),
      "select 1;",
    );
  });

  test("selects the statement at the cursor", () => {
    const query = "select * from tenant;\n\nselect * from company;";

    expect(getQuerySegment(query, 8)).toBe("select * from tenant;");
    expect(getQuerySegment(query, query.indexOf("company"))).toBe("select * from company;");
  });

  test("does not split semicolons inside SQL strings or comments", () => {
    const query = "select 'tenant;company' as name; -- next;\nselect 2;";

    expect(getQuerySegment(query, 10)).toBe("select 'tenant;company' as name;");
    expect(getQuerySegment(query, query.lastIndexOf("select 2"))).toBe("-- next;\nselect 2;");
  });

  test("does not split semicolons inside PostgreSQL dollar-quoted routine bodies", () => {
    const query = "CREATE FUNCTION refresh() RETURNS void AS $$ BEGIN PERFORM 1; END; $$ LANGUAGE plpgsql;";

    expect(getQuerySegment(query, 12)).toBe(query);
  });

  test("executes the last statement when the cursor is after the final semicolon", () => {
    const query = "select * from auth;";

    expect(getQuerySegment(query, query.length)).toBe("select * from auth;");
  });

  test("creates and closes editors with Ctrl+T and Ctrl+W", () => {
    renderWorkspace();
    const editor = screen.getByRole("textbox", { name: "Query 1 SQL query editor" });

    fireEvent.keyDown(editor, { key: "t", code: "KeyT", ctrlKey: true });
    expect(screen.getAllByRole("tab")).toHaveLength(2);

    const secondEditor = screen.getByRole("textbox", { name: "Query 2 SQL query editor" });
    fireEvent.keyDown(secondEditor, { key: "w", code: "KeyW", ctrlKey: true });
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Query 1 SQL query editor" }), {
      key: "w",
      code: "KeyW",
      ctrlKey: true,
    });

    expect(screen.queryByRole("textbox")).toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole("region", { name: "SQL editor workspace" }),
    );
  });

  test("focuses the previous workspace tab when closing with Ctrl+W", () => {
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "Create SQL editor tab" }));
    fireEvent.click(screen.getByRole("button", { name: "Open company" }));

    const workspace = screen.getByRole("region", { name: "SQL editor workspace" });
    fireEvent.keyDown(workspace, { key: "w", code: "KeyW", ctrlKey: true });

    expect(screen.getByRole("textbox", { name: "Query 2 SQL query editor" })).not.toBeNull();
    expect(screen.queryByRole("tab", { name: "company" })).toBeNull();

    fireEvent.keyDown(screen.getByRole("textbox", { name: "Query 2 SQL query editor" }), {
      key: "w",
      code: "KeyW",
      ctrlKey: true,
    });

    expect(screen.getByRole("textbox", { name: "Query 1 SQL query editor" })).not.toBeNull();
    expect(screen.queryByRole("textbox", { name: "Query 2 SQL query editor" })).toBeNull();
  });

  test("opens the tab switcher while CodeMirror has focus", () => {
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "Create SQL editor tab" }));
    const secondEditor = screen.getByRole("textbox", { name: "Query 2 SQL query editor" });
    secondEditor.focus();

    fireEvent.keyDown(secondEditor, { key: "Tab", code: "Tab", ctrlKey: true });
    expect(screen.getByRole("dialog", { name: "Open tabs" })).not.toBeNull();

    fireEvent.keyDown(secondEditor, {
      key: "Tab",
      code: "Tab",
      ctrlKey: true,
      shiftKey: true,
    });
    expect(screen.getByRole("dialog", { name: "Open tabs" })).not.toBeNull();
  });

  test("repeats Ctrl+Tab cycling while the switcher input owns focus", () => {
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "Create SQL editor tab" }));
    fireEvent.click(screen.getByRole("button", { name: "Create SQL editor tab" }));
    fireEvent.click(screen.getByRole("tab", { name: "Query 1" }));
    const workspace = screen.getByRole("region", { name: "SQL editor workspace" });

    fireEvent.keyDown(workspace, { key: "Tab", code: "Tab", ctrlKey: true });
    const switcher = within(screen.getByRole("dialog", { name: "Open tabs" }));
    expect(switcher.getByRole("button", { name: /Query 2/ }).getAttribute("aria-selected")).toBe("true");

    fireEvent.keyDown(screen.getByRole("dialog", { name: "Open tabs" }), { key: "Tab", code: "Tab", ctrlKey: true });
    expect(switcher.getByRole("button", { name: /Query 3/ }).getAttribute("aria-selected")).toBe("true");
  });

  test("cycles backward with repeated Ctrl+Shift+Tab and confirms on Ctrl release", () => {
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "Create SQL editor tab" }));
    fireEvent.click(screen.getByRole("button", { name: "Create SQL editor tab" }));
    fireEvent.click(screen.getByRole("tab", { name: "Query 1" }));
    const workspace = screen.getByRole("region", { name: "SQL editor workspace" });

    fireEvent.keyDown(workspace, { key: "Tab", code: "Tab", ctrlKey: true, shiftKey: true });
    const switcher = within(screen.getByRole("dialog", { name: "Open tabs" }));
    expect(switcher.getByRole("button", { name: /Query 3/ }).getAttribute("aria-selected")).toBe("true");

    fireEvent.keyDown(screen.getByRole("dialog", { name: "Open tabs" }), { key: "Tab", code: "Tab", ctrlKey: true, shiftKey: true });
    expect(switcher.getByRole("button", { name: /Query 2/ }).getAttribute("aria-selected")).toBe("true");

    fireEvent.keyUp(screen.getByRole("dialog", { name: "Open tabs" }), { key: "Control", code: "ControlLeft", ctrlKey: false });
    expect(screen.queryByRole("dialog", { name: "Open tabs" })).toBeNull();
    expect(screen.getByRole("tab", { name: "Query 2" }).getAttribute("data-state")).toBe("active");
  });

  test("does not carry tabs into a connection with no stored workspace", () => {
    useWorkspaceStore.setState({ isHydrated: true });
    const view = renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "Open company" }));
    expect(screen.getByRole("tab", { name: "company" })).not.toBeNull();

    view.rerender(
      <QueryClientProvider client={new QueryClient()}>
        <ConnectionWorkspace profile={{ ...profile, id: "connection-2", name: "Analytics" }} />
      </QueryClientProvider>,
    );

    expect(screen.queryByRole("tab", { name: "company" })).toBeNull();
    expect(screen.getByRole("tab", { name: "Query 1" })).not.toBeNull();
    expect(useWorkspaceStore.getState().connections["connection-2"]?.tabs.map((tab) => tab.connectionId)).toEqual([
      "connection-2",
    ]);
  });

  test("opens Ctrl+P globally, including from native inputs", () => {
    renderWorkspace();
    const input = document.createElement("input");
    document.body.append(input);
    input.focus();

    fireEvent.keyDown(input, { key: "p", code: "KeyP", ctrlKey: true });
    expect(screen.getByRole("dialog", { name: "Command palette" })).not.toBeNull();
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Search commands" }), { key: "Escape" });

    fireEvent.keyDown(screen.getByRole("region", { name: "SQL editor workspace" }), {
      key: "p",
      code: "KeyP",
      ctrlKey: true,
    });
    expect(screen.getByRole("dialog", { name: "Command palette" })).not.toBeNull();
  });

  test("does not show open tabs in the Ctrl+P palette", () => {
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "Open company" }));

    fireEvent.keyDown(screen.getByRole("region", { name: "SQL editor workspace" }), {
      key: "p",
      code: "KeyP",
      ctrlKey: true,
    });

    const palette = screen.getByRole("dialog", { name: "Command palette" });
    expect(within(palette).queryByRole("button", { name: /company/ })).toBeNull();
  });

  test("validates a selected connection before navigating and closes the palette", async () => {
    const nextProfile = { ...profile, id: "connection-2", name: "Analytics" };
    availableConnections.push(profile, nextProfile);
    const onConnectionSwitch = mock(async () => undefined);
    renderWorkspaceWithSwitch(onConnectionSwitch);

    fireEvent.keyDown(screen.getByRole("region", { name: "SQL editor workspace" }), {
      key: "p",
      code: "KeyP",
      ctrlKey: true,
    });
    fireEvent.click(screen.getByRole("button", { name: /Analytics/ }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(testSavedConnection).toHaveBeenCalledWith(nextProfile);
    expect(onConnectionSwitch).toHaveBeenCalledWith(nextProfile);
    expect(screen.queryByRole("dialog", { name: "Command palette" })).toBeNull();
  });

  test("keeps the current context and shows details when connection validation fails", async () => {
    const nextProfile = { ...profile, id: "connection-2", name: "Unavailable" };
    availableConnections.push(profile, nextProfile);
    testSavedConnection.mockRejectedValueOnce(new Error("ECONNREFUSED: port 5432"));
    const onConnectionSwitch = mock(async () => undefined);
    renderWorkspaceWithSwitch(onConnectionSwitch);
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.keyDown(screen.getByRole("region", { name: "SQL editor workspace" }), {
      key: "p",
      code: "KeyP",
      ctrlKey: true,
    });
    fireEvent.click(screen.getByRole("button", { name: /Unavailable/ }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(onConnectionSwitch).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Command palette" })).not.toBeNull();
    expect(addToast).toHaveBeenCalledWith(expect.objectContaining({
      title: "Unable to connect to Unavailable",
      description: expect.stringContaining("ECONNREFUSED"),
    }));
    expect(useWorkspaceStore.getState().activeConnectionId).toBe("connection-1");
  });

  test("does not start concurrent validation attempts for one connection", async () => {
    const nextProfile = { ...profile, id: "connection-2", name: "Slow connection" };
    availableConnections.push(profile, nextProfile);
    let resolveValidation: (value: string) => void = () => undefined;
    testSavedConnection.mockImplementationOnce(() => new Promise((resolve) => {
      resolveValidation = resolve;
    }));
    renderWorkspaceWithSwitch(async () => undefined);

    fireEvent.keyDown(screen.getByRole("region", { name: "SQL editor workspace" }), {
      key: "p",
      code: "KeyP",
      ctrlKey: true,
    });
    const connectionButton = screen.getByRole("button", { name: /Slow connection/ });
    fireEvent.click(connectionButton);
    fireEvent.click(connectionButton);

    expect(testSavedConnection).toHaveBeenCalledTimes(1);
    resolveValidation("ok");
    await act(async () => {
      await Promise.resolve();
    });
  });

  test("creates another editor when Ctrl+T is pressed on the focused empty section", () => {
    renderWorkspace();
    const editor = screen.getByRole("textbox", { name: "Query 1 SQL query editor" });

    fireEvent.keyDown(editor, { key: "w", code: "KeyW", ctrlKey: true });
    const emptySection = screen.getByRole("region", { name: "SQL editor workspace" });

    expect(document.activeElement).toBe(emptySection);

    fireEvent.keyDown(emptySection, { key: "t", code: "KeyT", ctrlKey: true });

    expect(screen.getByRole("textbox", { name: "Query 1 SQL query editor" })).not.toBeNull();
  });

  test("opens and deduplicates a routine definition tab", async () => {
    renderWorkspace();

    fireEvent.click(screen.getByRole("button", { name: "Open refresh_company" }));
    expect(getRoutineDefinition).not.toHaveBeenCalled();
    expect(screen.getAllByRole("tab")).toHaveLength(1);

    fireEvent.doubleClick(screen.getByRole("button", { name: "Open refresh_company" }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(getRoutineDefinition).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("textbox", { name: "refresh_company SQL query editor" }).textContent,
    ).toContain("CREATE FUNCTION");
    expect(
        screen
        .getByTestId("unsaved-change-slot-routine--function-public.refresh_company()")
        .querySelector("[aria-label]"),
    ).toBeNull();

    fireEvent.doubleClick(screen.getByRole("button", { name: "Open refresh_company" }));
    expect(screen.getAllByRole("tab")).toHaveLength(2);
  });

  test("keeps overloaded routines in separate tabs", async () => {
    renderWorkspace();

    fireEvent.doubleClick(screen.getByRole("button", { name: "Open refresh_company" }));
    fireEvent.doubleClick(screen.getByRole("button", { name: "Open refresh_company(integer)" }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(screen.getByTestId("unsaved-change-slot-routine--function-public.refresh_company()"))
      .toBeTruthy();
    expect(screen.getByTestId("unsaved-change-slot-routine--function-public.refresh_company(integer)"))
      .toBeTruthy();
  });
});
