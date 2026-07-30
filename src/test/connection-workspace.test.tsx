import "./setup";

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import type { ConnectionProfile } from "@/shared/types/models";

const invalidateQueries = mock(() => Promise.resolve());
const runQuery = mock(async () => ({
  columns: [],
  rows: [],
  affected: 0,
  duration_ms: 1,
}));
const listSchemaObjects = mock(async () => []);
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

mock.module("@/app/connection/components/connection-sidebar", () => ({
  ConnectionSidebar: ({ onDatabaseChange }: { onDatabaseChange: (database: string) => void }) => (
    <aside data-testid="connection-sidebar">
      <button type="button" onClick={() => onDatabaseChange("development")}>
        Select development
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
  testSavedConnection: mock(async () => "ok"),
}));

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

describe("ConnectionWorkspace SQL tabs", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    invalidateQueries.mockClear();
    runQuery.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  test("renders one editor and keeps one editor when tabs are added", () => {
    renderWorkspace();

    expect(screen.getAllByRole("textbox")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Create SQL editor tab" }));

    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
  });

  test("keeps the SQL results pane visible even before running a query", () => {
    renderWorkspace();

    const resultsPane = screen.getByRole("region", { name: "SQL query results" });

    expect(within(resultsPane).getByText(/press ctrl\+enter to run it/i)).not.toBeNull();
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
    fireEvent.click(screen.getByRole("button", { name: "Select development" }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Run query" }));
      await Promise.resolve();
    });

    expect(runQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({
        connect_mode: expect.objectContaining({ database: "development" }),
      }),
      "select * from users limit 100;",
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

  test("switches editors with Ctrl+Tab while CodeMirror has focus", () => {
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "Create SQL editor tab" }));
    const secondEditor = screen.getByRole("textbox", { name: "Query 2 SQL query editor" });
    secondEditor.focus();

    fireEvent.keyDown(secondEditor, { key: "Tab", code: "Tab", ctrlKey: true });
    expect(screen.getByRole("textbox", { name: "Query 1 SQL query editor" })).not.toBeNull();

    const firstEditor = screen.getByRole("textbox", { name: "Query 1 SQL query editor" });
    firstEditor.focus();
    fireEvent.keyDown(firstEditor, {
      key: "Tab",
      code: "Tab",
      ctrlKey: true,
      shiftKey: true,
    });
    expect(screen.getByRole("textbox", { name: "Query 2 SQL query editor" })).not.toBeNull();
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
});
