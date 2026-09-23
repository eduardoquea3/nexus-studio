import "./setup";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { type ReactNode, useEffect } from "react";

import type { ConnectionProfile, QueryResult } from "@/shared/types/models";

import { useWorkspaceStore } from "@/shared/store/workspace-store";

const invalidateQueries = mock(() => Promise.resolve());
const defaultRunQuery = async (): Promise<QueryResult> => ({
  columns: [],
  rows: [],
  affected: 0,
  duration_ms: 1,
});
const runQuery = mock(defaultRunQuery);
const listSchemaObjects = mock(async () => []);
const getRoutineDefinition = mock(
  async () =>
    "CREATE FUNCTION refresh_company() RETURNS void AS $$ BEGIN END; $$ LANGUAGE plpgsql;",
);
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
  Separator: ({
    children,
    className,
    "aria-label": ariaLabel,
  }: {
    children?: ReactNode;
    className?: string;
    "aria-label"?: string;
  }) => (
    <div className={className} aria-label={ariaLabel}>
      {children}
    </div>
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
      <span
        role="button"
        tabIndex={0}
        onDoubleClick={() => onTableSelect("company")}
        onKeyDown={(event) => {
          if (event.key === " " || event.key === "Enter") {
            if (event.key === " ") event.preventDefault();
            onTableSelect("company");
          }
        }}
      >
        Open company
      </span>
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
  schemaObjectsQueryKey: (connectionId: string, database?: string) => [
    "schema",
    connectionId,
    database,
  ],
  useSchemaObjects: () => ({ data: [], isLoading: false, isFetching: false }),
}));

mock.module("@/components/ui/toast", () => ({ toast: { add: addToast } }));

const { ConnectionWorkspace, getQuerySegment } =
  await import("../app/connection/components/connection-workspace");
const { splitSqlStatements } =
  await import("../app/connection/components/connection-workspace-utils");
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

function waitForAnimationFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

function setEditorQuery(query = "select 1;") {
  const editor = screen.getByRole("textbox", { name: "Query 1 SQL query editor" });
  act(() => {
    editor.textContent = query;
    fireEvent.input(editor);
  });
}

describe("ConnectionWorkspace SQL tabs", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    invalidateQueries.mockClear();
    runQuery.mockReset();
    runQuery.mockImplementation(defaultRunQuery);
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

  test("keeps the run action out of the compact tab bar", () => {
    renderWorkspace();

    expect(within(screen.getByRole("tablist")).queryByText("Run all")).toBeNull();
    expect(screen.getByRole("button", { name: "Run all queries" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Query run options" })).not.toBeNull();
    expect(screen.getByRole("tab", { name: /Query 1/ }).className).toContain("h-7");
    expect(screen.getByRole("tab", { name: /Query 1/ }).className).toContain("rounded-none");
    expect(screen.getByRole("tablist").className).toContain("rounded-none");
    const resultsToolbar = screen.getByRole("region", {
      name: "SQL query results",
    }).firstElementChild;
    expect(resultsToolbar?.className).toContain("w-full");
    expect(resultsToolbar?.className).toContain("items-center");
    expect(resultsToolbar?.className).toContain("justify-between");
  });

  test("exposes Run all and Run current in the results toolbar menu", async () => {
    renderWorkspace();
    setEditorQuery();

    await act(async () => {
      fireEvent.pointerDown(screen.getByRole("button", { name: "Query run options" }));
      await Promise.resolve();
    });

    expect(await screen.findByRole("menuitem", { name: /^Run all/ })).not.toBeNull();
    expect(await screen.findByRole("menuitem", { name: /^Run current/ })).not.toBeNull();
    expect(screen.getByRole("menuitem", { name: /^Run all/ }).textContent).toContain(
      "Ctrl + Enter",
    );
    expect(screen.getByRole("menuitem", { name: /^Run current/ }).textContent).toContain(
      "Ctrl + Shift + Enter",
    );
  });

  test("runs all statements with Ctrl+Enter and the current statement with Ctrl+Shift+Enter", async () => {
    renderWorkspace();
    const editor = screen.getByRole("textbox", { name: "Query 1 SQL query editor" });
    setEditorQuery("select 1; select 2;");

    await act(async () => {
      fireEvent.keyDown(editor, { key: "Enter", ctrlKey: true });
      await Promise.resolve();
    });

    expect(runQuery).toHaveBeenCalledTimes(2);
    expect(runQuery).toHaveBeenNthCalledWith(1, expect.anything(), "select 1;");
    expect(runQuery).toHaveBeenNthCalledWith(2, expect.anything(), "select 2;");

    runQuery.mockClear();
    await act(async () => {
      fireEvent.keyDown(editor, { key: "Enter", ctrlKey: true, shiftKey: true });
      await Promise.resolve();
    });

    expect(runQuery).toHaveBeenCalledTimes(1);
    expect(runQuery).toHaveBeenCalledWith(expect.anything(), "select 2;");
  });

  test("Run all executes each active editor statement sequentially", async () => {
    renderWorkspace();
    setEditorQuery("select 1;\nselect 2;");

    await act(async () => {
      fireEvent.pointerDown(screen.getByRole("button", { name: "Query run options" }));
      await Promise.resolve();
    });
    const runAll = await screen.findByRole("menuitem", { name: /^Run all/ });
    await act(async () => {
      fireEvent.click(runAll);
      await Promise.resolve();
    });

    expect(runQuery).toHaveBeenNthCalledWith(1, expect.anything(), "select 1;");
    expect(runQuery).toHaveBeenNthCalledWith(2, expect.anything(), "select 2;");
    expect(runQuery).toHaveBeenCalledTimes(2);
  });

  test("primary Run all action executes each active editor statement sequentially", async () => {
    renderWorkspace();
    setEditorQuery("select 1;\nselect 2;");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Run all queries" }));
      await Promise.resolve();
    });

    expect(runQuery).toHaveBeenNthCalledWith(1, expect.anything(), "select 1;");
    expect(runQuery).toHaveBeenNthCalledWith(2, expect.anything(), "select 2;");
    expect(runQuery).toHaveBeenCalledTimes(2);
  });

  test("Run all keeps parser-safe SQL statements intact", async () => {
    const query =
      "select 'one;two'; -- comment;\nselect $$body;still body$$; /* block; comment */ select 3;";
    expect(splitSqlStatements(query)).toEqual([
      "select 'one;two';",
      "-- comment;\nselect $$body;still body$$;",
      "/* block; comment */ select 3;",
    ]);
  });

  test("Run all stops after the first failed statement", async () => {
    runQuery.mockResolvedValueOnce({ columns: [], rows: [], affected: 0, duration_ms: 1 });
    runQuery.mockRejectedValueOnce(new Error("syntax error"));
    const query = "select 1; select broken; select 3;";
    renderWorkspace();
    setEditorQuery(query);

    await act(async () => {
      fireEvent.pointerDown(screen.getByRole("button", { name: "Query run options" }));
      await Promise.resolve();
    });
    await act(async () => {
      fireEvent.click(await screen.findByRole("menuitem", { name: /^Run all/ }));
      await Promise.resolve();
    });

    expect(runQuery).toHaveBeenCalledTimes(2);
    expect(runQuery).toHaveBeenNthCalledWith(2, expect.anything(), "select broken;");
    expect(screen.getByText("syntax error")).not.toBeNull();
  });

  test("disables the primary Run all action for an empty query", () => {
    renderWorkspace();

    expect(screen.getByRole("button", { name: "Run all queries" }).getAttribute("disabled")).toBe(
      "",
    );
  });

  test("keeps the SQL results pane visible even before running a query", () => {
    renderWorkspace();

    const resultsPane = screen.getByRole("region", { name: "SQL query results" });

    expect(screen.getByRole("button", { name: "Query run options" }).getAttribute("disabled")).toBe(
      "",
    );
    expect(within(resultsPane).getByText(/ctrl\+enter to run all statements/i)).not.toBeNull();
    expect(resultsPane.parentElement?.parentElement?.className ?? "").not.toContain("rounded-b-xl");
  });

  test("does not carry the previous query result into a newly created editor", async () => {
    renderWorkspace();
    const editor = screen.getByRole("textbox", { name: "Query 1 SQL query editor" });
    fireEvent.input(editor, { target: { textContent: "select 1;" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Run all queries" }));
      await Promise.resolve();
    });

    expect(screen.getByText(/0 row\(s\) affected in 1 ms/i)).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Create SQL editor tab" }));

    const resultsPane = screen.getByRole("region", { name: "SQL query results" });
    expect(within(resultsPane).getByText(/ctrl\+enter to run all statements/i)).not.toBeNull();
  });

  test("shows JSON only for tabular results and switches without rerunning", async () => {
    runQuery.mockResolvedValueOnce({
      columns: ["id", "name"],
      rows: [{ id: 1, name: "Ada" }],
      affected: 0,
      duration_ms: 2,
    });
    renderWorkspace();
    fireEvent.input(screen.getByRole("textbox", { name: "Query 1 SQL query editor" }), {
      target: { textContent: "select 1;" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Run all queries" }));
      await Promise.resolve();
    });

    expect(screen.getByRole("button", { name: "JSON" })).not.toBeNull();
    expect(screen.getByLabelText("Query result statistics").textContent).toBe(
      "1 rows2 columns2 ms",
    );
    expect(screen.getByRole("table").closest(".w-full")).not.toBeNull();
    const viewGroup = screen.getByRole("group", { name: "SQL result view" });
    expect(viewGroup.className).toContain("h-6");
    expect(viewGroup.className).toContain("justify-self-start");
    expect(viewGroup.parentElement?.className).toContain("grid-cols-[1fr_auto]");
    expect(viewGroup.parentElement?.className).toContain("w-full");
    expect(viewGroup.parentElement?.className).toContain("items-center");
    expect(screen.getByRole("button", { name: "Table" }).className).toContain("text-xs");
    expect(viewGroup.className).toContain("bg-muted/30");
    expect(screen.getByRole("button", { name: "Table" }).className).toContain("bg-primary/15");
    fireEvent.click(screen.getByRole("button", { name: "JSON" }));
    expect(screen.getByLabelText("SQL result JSON").textContent).toContain('"name": "Ada"');
    expect(screen.getByRole("button", { name: "JSON" }).className).toContain("bg-primary/15");
    expect(runQuery).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Table" }));
    expect(screen.queryByLabelText("SQL result JSON")).toBeNull();
  });

  test("paginates SQL results in pages of 100 rows", async () => {
    const rows = Array.from({ length: 205 }, (_, id) => ({ id }));
    runQuery.mockResolvedValueOnce({ columns: ["id"], rows, affected: 0, duration_ms: 2 });
    renderWorkspace();
    setEditorQuery();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Run all queries" }));
      await Promise.resolve();
    });

    const table = screen.getByRole("table");
    expect(screen.getByRole("navigation", { name: "SQL result pagination" })).not.toBeNull();
    expect(screen.getByText("Rows 1-100 of 205")).not.toBeNull();
    expect(screen.getByText("Page 1 of 3")).not.toBeNull();
    expect(table.querySelectorAll("tbody tr").length).toBe(100);

    fireEvent.click(screen.getByRole("button", { name: "Next result page" }));
    expect(screen.getByText("Rows 101-200 of 205")).not.toBeNull();
    expect(screen.getByText("Page 2 of 3")).not.toBeNull();
    expect(screen.getByRole("table").querySelectorAll("tbody tr").length).toBe(100);

    fireEvent.click(screen.getByRole("button", { name: "Next result page" }));
    expect(screen.getByText("Rows 201-205 of 205")).not.toBeNull();
    expect(screen.getByText("Page 3 of 3")).not.toBeNull();
    expect(screen.getByRole("table").querySelectorAll("tbody tr").length).toBe(5);
    expect(screen.getByRole("button", { name: "Next result page" }).getAttribute("disabled")).toBe(
      "",
    );

    fireEvent.click(screen.getByRole("button", { name: "JSON" }));
    expect(screen.getByLabelText("SQL result JSON").textContent).toContain('"id": 200');
    expect(screen.getByLabelText("SQL result JSON").textContent).toContain('"id": 204');
    expect(screen.getByLabelText("SQL result JSON").textContent).not.toContain('"id": 199');
  });

  test("hides the previous result and JSON actions while a new query is running", async () => {
    let resolveQuery: ((result: QueryResult) => void) | undefined;
    runQuery.mockResolvedValueOnce({
      columns: ["id"],
      rows: [{ id: 1 }],
      affected: 0,
      duration_ms: 1,
    });
    runQuery.mockImplementationOnce(
      () =>
        new Promise<QueryResult>((resolve) => {
          resolveQuery = resolve;
        }),
    );
    renderWorkspace();
    fireEvent.input(screen.getByRole("textbox", { name: "Query 1 SQL query editor" }), {
      target: { textContent: "select 1;" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Run all queries" }));
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole("button", { name: "JSON" }));
    expect(screen.getByLabelText("SQL result JSON").textContent).toContain('"id": 1');

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Run all queries" }));
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
    setEditorQuery();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Run all queries" }));
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole("button", { name: "JSON" }));
    expect(screen.getByLabelText("SQL result JSON").textContent).toBe("[]");
  });

  test("does not expose JSON controls for SQL errors", async () => {
    runQuery.mockRejectedValueOnce(new Error("syntax error"));
    renderWorkspace();
    setEditorQuery();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Run all queries" }));
      await Promise.resolve();
    });

    expect(screen.getByText("syntax error")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "JSON" })).toBeNull();
    expect(screen.queryByRole("button", { name: /copy sql result json/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /export sql result json/i })).toBeNull();
  });

  test("exposes selected mode and supports keyboard activation", async () => {
    runQuery.mockResolvedValueOnce({
      columns: ["id"],
      rows: [{ id: 1 }],
      affected: 0,
      duration_ms: 1,
    });
    renderWorkspace();
    setEditorQuery();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Run all queries" }));
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
    runQuery.mockResolvedValueOnce({
      columns: ["id"],
      rows: [{ id: 1 }],
      affected: 0,
      duration_ms: 1,
    });
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
    setEditorQuery();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Run all queries" }));
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
    runQuery.mockResolvedValueOnce({
      columns: ["id"],
      rows: [{ id: 1 }],
      affected: 0,
      duration_ms: 1,
    });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: mock(() => {
        throw new Error("blocked");
      }),
    });
    renderWorkspace();
    setEditorQuery();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Run all queries" }));
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

  test("paginates large SQL results without rendering every row at once", async () => {
    const rows = Array.from({ length: 10_001 }, (_, id) => ({ id }));
    runQuery.mockResolvedValueOnce({ columns: ["id"], rows, affected: 0, duration_ms: 1 });
    renderWorkspace();
    setEditorQuery();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Run all queries" }));
      await Promise.resolve();
    });
    fireEvent.click(screen.getByRole("button", { name: "JSON" }));

    expect(screen.getByText("Rows 1-100 of 10001")).not.toBeNull();
    expect(screen.getByText("Page 1 of 101")).not.toBeNull();
    expect(runQuery).toHaveBeenCalledTimes(1);
  });

  test("keeps JSON mode isolated between SQL tabs", async () => {
    runQuery
      .mockResolvedValueOnce({ columns: ["id"], rows: [{ id: 1 }], affected: 0, duration_ms: 1 })
      .mockResolvedValueOnce({ columns: ["id"], rows: [{ id: 2 }], affected: 0, duration_ms: 1 });
    renderWorkspace();
    setEditorQuery();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Run all queries" }));
      await Promise.resolve();
    });
    fireEvent.click(screen.getByRole("button", { name: "JSON" }));
    fireEvent.click(screen.getByRole("button", { name: "Create SQL editor tab" }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Run all queries" }));
      await Promise.resolve();
    });
    expect(screen.queryByLabelText("SQL result JSON")).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: /Query 1/ }));

    expect(screen.getByLabelText("SQL result JSON").textContent).toContain('"id": 1');
  });

  test("announces clipboard failure and leaves the JSON view usable", async () => {
    runQuery.mockResolvedValueOnce({
      columns: ["id"],
      rows: [{ id: 1 }],
      affected: 0,
      duration_ms: 1,
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: mock(() => Promise.reject(new Error("denied"))) },
    });
    renderWorkspace();
    setEditorQuery();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Run all queries" }));
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
    setEditorQuery();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Run all queries" }));
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
    const queryTab = screen.getByRole("tab", { name: /Query 1/ });

    expect(tabList.className).not.toContain("flex-1");
    expect(createTab.previousElementSibling).toBe(tabList);
    expect(queryTab.className).toContain("w-36");
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
      fireEvent.click(screen.getByRole("button", { name: "Run all queries" }));
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
      fireEvent.click(screen.getByRole("button", { name: "Run all queries" }));
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
      fireEvent.click(screen.getByRole("button", { name: "Run all queries" }));
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

  test("selects a multiline statement until its delimiter", () => {
    const query =
      "select name,description,document_code\nfrom document_type;\n\nselect * from operation_util;";

    expect(getQuerySegment(query, query.indexOf("document_type") + "document_type;".length)).toBe(
      "select name,description,document_code\nfrom document_type;",
    );
  });

  test("does not split semicolons inside SQL strings or comments", () => {
    const query = "select 'tenant;company' as name; -- next;\nselect 2;";

    expect(getQuerySegment(query, 10)).toBe("select 'tenant;company' as name;");
    expect(getQuerySegment(query, query.lastIndexOf("select 2"))).toBe("-- next;\nselect 2;");
  });

  test("does not split semicolons inside PostgreSQL dollar-quoted routine bodies", () => {
    const query =
      "CREATE FUNCTION refresh() RETURNS void AS $$ BEGIN PERFORM 1; END; $$ LANGUAGE plpgsql;";

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

  test("does not open a table on a single click", () => {
    renderWorkspace();

    fireEvent.click(screen.getByRole("button", { name: "Open company" }));

    expect(screen.queryByRole("tab", { name: "company" })).toBeNull();
  });

  test("opens a table on double click and focuses the workspace after render", async () => {
    renderWorkspace();

    fireEvent.doubleClick(screen.getByRole("button", { name: "Open company" }));
    await act(waitForAnimationFrame);

    expect(screen.getByRole("tab", { name: "company" })).not.toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole("region", { name: "SQL editor workspace" }),
    );
  });

  test("opens a table with Space from the focused table label", () => {
    renderWorkspace();
    const tableLabel = screen.getByRole("button", { name: "Open company" });

    fireEvent.keyDown(tableLabel, { key: " " });

    expect(screen.getByRole("tab", { name: "company" })).not.toBeNull();
  });

  test("focuses the previous workspace tab when closing with Ctrl+W", async () => {
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "Create SQL editor tab" }));
    fireEvent.doubleClick(screen.getByRole("button", { name: "Open company" }));
    await act(waitForAnimationFrame);

    const workspace = screen.getByRole("region", { name: "SQL editor workspace" });
    fireEvent.keyDown(workspace, { key: "w", code: "KeyW", ctrlKey: true });
    await act(waitForAnimationFrame);

    expect(screen.getByRole("textbox", { name: "Query 2 SQL query editor" })).not.toBeNull();
    expect(screen.queryByRole("tab", { name: "company" })).toBeNull();
    expect(document.activeElement).toBe(workspace);

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
    expect(switcher.getByRole("button", { name: /Query 2/ }).getAttribute("aria-selected")).toBe(
      "true",
    );

    fireEvent.keyDown(screen.getByRole("dialog", { name: "Open tabs" }), {
      key: "Tab",
      code: "Tab",
      ctrlKey: true,
    });
    expect(switcher.getByRole("button", { name: /Query 3/ }).getAttribute("aria-selected")).toBe(
      "true",
    );
  });

  test("cycles backward with repeated Ctrl+Shift+Tab and confirms on Ctrl release", () => {
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "Create SQL editor tab" }));
    fireEvent.click(screen.getByRole("button", { name: "Create SQL editor tab" }));
    fireEvent.click(screen.getByRole("tab", { name: "Query 1" }));
    const workspace = screen.getByRole("region", { name: "SQL editor workspace" });

    fireEvent.keyDown(workspace, { key: "Tab", code: "Tab", ctrlKey: true, shiftKey: true });
    const switcher = within(screen.getByRole("dialog", { name: "Open tabs" }));
    expect(switcher.getByRole("button", { name: /Query 3/ }).getAttribute("aria-selected")).toBe(
      "true",
    );

    fireEvent.keyDown(screen.getByRole("dialog", { name: "Open tabs" }), {
      key: "Tab",
      code: "Tab",
      ctrlKey: true,
      shiftKey: true,
    });
    expect(switcher.getByRole("button", { name: /Query 2/ }).getAttribute("aria-selected")).toBe(
      "true",
    );

    fireEvent.keyUp(screen.getByRole("dialog", { name: "Open tabs" }), {
      key: "Control",
      code: "ControlLeft",
      ctrlKey: false,
    });
    expect(screen.queryByRole("dialog", { name: "Open tabs" })).toBeNull();
    expect(screen.getByRole("tab", { name: "Query 2" }).getAttribute("data-state")).toBe("active");
  });

  test("does not carry tabs into a connection with no stored workspace", () => {
    useWorkspaceStore.setState({ isHydrated: true });
    const view = renderWorkspace();
    fireEvent.doubleClick(screen.getByRole("button", { name: "Open company" }));
    expect(screen.getByRole("tab", { name: "company" })).not.toBeNull();

    view.rerender(
      <QueryClientProvider client={new QueryClient()}>
        <ConnectionWorkspace profile={{ ...profile, id: "connection-2", name: "Analytics" }} />
      </QueryClientProvider>,
    );

    expect(screen.queryByRole("tab", { name: "company" })).toBeNull();
    expect(screen.getByRole("tab", { name: "Query 1" })).not.toBeNull();
    expect(
      useWorkspaceStore.getState().connections["connection-2"]?.tabs.map((tab) => tab.connectionId),
    ).toEqual(["connection-2"]);
  });

  test("opens the connections and tables palette with Ctrl+P", () => {
    renderWorkspace();
    const input = document.createElement("input");
    document.body.append(input);
    input.focus();

    fireEvent.keyDown(input, { key: "p", code: "KeyP", ctrlKey: true });
    fireEvent.keyDown(screen.getByRole("region", { name: "SQL editor workspace" }), {
      key: "p",
      code: "KeyP",
      ctrlKey: true,
    });
    expect(screen.getByRole("dialog", { name: "Command palette" })).not.toBeNull();
    fireEvent.keyDown(screen.getByRole("region", { name: "SQL editor workspace" }), {
      key: "p",
      code: "KeyP",
      ctrlKey: true,
      shiftKey: true,
    });
    expect(screen.getByRole("button", { name: /Disconnect/ })).not.toBeNull();
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

  test("shows implemented keyboard shortcuts when no SQL tabs are open", () => {
    renderWorkspace();

    fireEvent.keyDown(screen.getByRole("textbox", { name: "Query 1 SQL query editor" }), {
      key: "w",
      code: "KeyW",
      ctrlKey: true,
    });

    const shortcutList = screen.getByRole("list", { name: "Implemented shortcuts" });
    expect(shortcutList.textContent).toContain("Run all");
    expect(shortcutList.textContent).toContain("Run current");
    expect(shortcutList.textContent).toContain("Ctrl+Enter");
    expect(shortcutList.textContent).toContain("Ctrl+Shift+Enter");
    expect(shortcutList.textContent).toContain("New SQL tab");
    expect(shortcutList.textContent).toContain("Close active tab");
    expect(shortcutList.textContent).toContain("Next tab");
    expect(shortcutList.textContent).toContain("Previous tab");
    expect(shortcutList.textContent).toContain("Toggle sidebar");
    expect(screen.queryByText("Press Ctrl+T to open a SQL editor.")).toBeNull();
    expect(screen.queryByRole("button", { name: "Query run options" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Run all queries" })).toBeNull();
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
    expect(
      screen.getByTestId("unsaved-change-slot-routine--function-public.refresh_company()"),
    ).toBeTruthy();
    expect(
      screen.getByTestId("unsaved-change-slot-routine--function-public.refresh_company(integer)"),
    ).toBeTruthy();
  });
});
