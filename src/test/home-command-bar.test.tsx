import "./setup";
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import type { ConnectionProfile } from "@/shared/types/models";

import { useWorkspaceStore } from "@/shared/store/workspace-store";

const navigate = mock(async () => undefined);
const testSavedConnection = mock(async () => "Connection OK");
const markConnectionOpened = mock(async () => undefined);
const addToast = mock((_options: unknown) => "toast-1");
const updateToast = mock((_id: string, _options: unknown) => undefined);
const listSchemaObjects = mock(async () => []);
const profiles: ConnectionProfile[] = [
  {
    id: "connection-1",
    name: "Production",
    db_type: "postgres",
    connect_mode: { type: "connection_string", value: "postgres://example" },
    ssh_tunnel: null,
  },
];

mock.module("@/app/home/hooks/use-connections", () => ({
  useConnections: () => ({ data: profiles }),
}));

mock.module("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
}));

mock.module("@/app/home/services/connection-service", () => ({
  markConnectionOpened,
}));

mock.module("@/shared/lib/tauriApi", () => ({
  getTableData: mock(async () => ({
    columns: [],
    rows: [],
    total: 0,
    page: 1,
    page_size: 100,
  })),
  getTableSchema: mock(async () => ({ columns: [], indexes: [] })),
  getRoutineDefinition: mock(async () => ""),
  listDatabases: mock(async () => []),
  runQuery: mock(async () => ({ columns: [], rows: [], affected: 0, duration_ms: 0 })),
  testSavedConnection,
  listSchemaObjects,
}));

mock.module("@/components/ui/toast", () => ({
  toast: { add: addToast, update: updateToast },
}));

const { HomeCommandBar } = await import("@/app/command-bar/home-command-bar");
const { cleanup, fireEvent, render, screen } = await import("@testing-library/react");

describe("HomeCommandBar", () => {
  beforeEach(() => {
    profiles.splice(0, profiles.length, {
      id: "connection-1",
      name: "Production",
      db_type: "postgres",
      connect_mode: { type: "connection_string", value: "postgres://example" },
      ssh_tunnel: null,
    });
    navigate.mockClear();
    testSavedConnection.mockClear();
    markConnectionOpened.mockClear();
    addToast.mockClear();
    updateToast.mockClear();
    listSchemaObjects.mockClear();
    useWorkspaceStore.setState({ activeConnectionId: null });
  });

  afterEach(() => cleanup());

  test("opens the connections palette with Ctrl+P", () => {
    render(<HomeCommandBar activeConnectionId={null} />);

    fireEvent.keyDown(window, { key: "p", code: "KeyP", ctrlKey: true });

    expect(screen.getByRole("dialog", { name: "Command palette" })).not.toBeNull();
    expect(screen.getByRole("button", { name: /Production/ })).not.toBeNull();
  });

  test("opens the application commands with Ctrl+Shift+P", () => {
    render(<HomeCommandBar activeConnectionId={null} />);

    fireEvent.keyDown(window, { key: "p", code: "KeyP", ctrlKey: true, shiftKey: true });

    expect(screen.getByRole("dialog", { name: "Command palette" })).not.toBeNull();
    expect(screen.getByRole("button", { name: /New connection/ })).not.toBeNull();
    expect(screen.queryByRole("button", { name: /Production/ })).toBeNull();
  });
});
