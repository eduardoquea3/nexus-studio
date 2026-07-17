import "./setup";

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

mock.module("@uiw/react-codemirror", () => ({
  default: ({
    value,
    onChange,
    "aria-label": ariaLabel,
  }: {
    value: string;
    onChange: (value: string) => void;
    "aria-label": string;
  }) => (
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
  ),
}));

mock.module("@/app/connection/components/connection-sidebar", () => ({
  ConnectionSidebar: () => <aside data-testid="connection-sidebar" />,
}));

const { ConnectionWorkspace } = await import("../app/connection/components/connection-workspace");
const { cleanup, fireEvent, render, screen } = await import("@testing-library/react");

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

describe("ConnectionWorkspace SQL tabs", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    cleanup();
  });

  test("renders one editor and keeps one editor when tabs are added", () => {
    render(<ConnectionWorkspace profile={profile} />);

    expect(screen.getAllByRole("textbox")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Create SQL editor tab" }));

    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
  });

  test("switches the single editor to the selected tab", () => {
    render(<ConnectionWorkspace profile={profile} />);
    fireEvent.click(screen.getByRole("button", { name: "Create SQL editor tab" }));
    fireEvent.click(screen.getByRole("tab", { name: /Query 1/ }));

    expect(screen.getByRole("textbox", { name: "Query 1 SQL query editor" })).not.toBeNull();
    expect(screen.queryByRole("textbox", { name: "Query 2 SQL query editor" })).toBeNull();
  });

  test("closes tabs without leaving duplicate editors or scroll containers", () => {
    render(<ConnectionWorkspace profile={profile} />);
    fireEvent.click(screen.getByRole("button", { name: "Create SQL editor tab" }));
    fireEvent.click(screen.getByRole("button", { name: "Close Query 2" }));

    expect(screen.getAllByRole("tab")).toHaveLength(1);
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Close Query 2" })).toBeNull();
    expect(screen.getByRole("tablist").className).toContain("overflow-y-hidden");
    expect(screen.getByRole("tabpanel").className).toContain("overflow-hidden");
  });

  test("updates the query in the active tab", () => {
    render(<ConnectionWorkspace profile={profile} />);
    const editor = screen.getByRole("textbox", { name: "Query 1 SQL query editor" });

    fireEvent.input(editor, { target: { textContent: "select 1;" } });

    expect(editor.textContent).toBe("select 1;");
  });

  test("creates and closes editors with Ctrl+T and Ctrl+W", () => {
    render(<ConnectionWorkspace profile={profile} />);
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
    render(<ConnectionWorkspace profile={profile} />);
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
    render(<ConnectionWorkspace profile={profile} />);
    const editor = screen.getByRole("textbox", { name: "Query 1 SQL query editor" });

    fireEvent.keyDown(editor, { key: "w", code: "KeyW", ctrlKey: true });
    const emptySection = screen.getByRole("region", { name: "SQL editor workspace" });

    expect(document.activeElement).toBe(emptySection);

    fireEvent.keyDown(emptySection, { key: "t", code: "KeyT", ctrlKey: true });

    expect(screen.getByRole("textbox", { name: "Query 1 SQL query editor" })).not.toBeNull();
  });
});
