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
  testSavedConnection,
  listSchemaObjects,
}));

mock.module("@/components/ui/toast", () => ({
  toast: { add: addToast, update: updateToast },
}));

const { HomeCommandBar } = await import("@/app/command-bar/home-command-bar");
const { act, cleanup, fireEvent, render, screen } = await import("@testing-library/react");

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

  test("opens Ctrl+P from Home and lists only available connections without an active connection", () => {
    render(<HomeCommandBar activeConnectionId={null} />);

    fireEvent.keyDown(window, { key: "p", code: "KeyP", ctrlKey: true });

    expect(screen.getByRole("dialog", { name: "Command palette" })).not.toBeNull();
    expect(screen.getByRole("button", { name: /Production/ })).not.toBeNull();
    expect(screen.queryByText(/table/i)).toBeNull();
  });

  test("validates a selected connection before navigating", async () => {
    render(<HomeCommandBar activeConnectionId={null} />);
    fireEvent.keyDown(window, { key: "p", code: "KeyP", ctrlKey: true });
    fireEvent.click(screen.getByRole("button", { name: /Production/ }));

    await act(async () => await Promise.resolve());

    expect(testSavedConnection).toHaveBeenCalledWith(profiles[0]);
    expect(markConnectionOpened).toHaveBeenCalledWith("connection-1");
    expect(addToast).toHaveBeenCalledWith(expect.objectContaining({
      title: "Checking connection...",
      type: "loading",
    }));
    expect(updateToast).toHaveBeenCalledWith("toast-1", expect.objectContaining({
      title: "Connection successful",
    }));
    expect(navigate).toHaveBeenCalledWith({
      to: "/connections/$connectionId",
      params: { connectionId: "connection-1" },
    });
  });

  test("keeps Home context and shows a toast when validation fails", async () => {
    testSavedConnection.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    render(<HomeCommandBar activeConnectionId={null} />);
    fireEvent.keyDown(window, { key: "p", code: "KeyP", ctrlKey: true });
    fireEvent.click(screen.getByRole("button", { name: /Production/ }));

    await act(async () => await Promise.resolve());

    expect(navigate).not.toHaveBeenCalled();
    expect(markConnectionOpened).not.toHaveBeenCalled();
    expect(useWorkspaceStore.getState().activeConnectionId).toBeNull();
    expect(listSchemaObjects).not.toHaveBeenCalled();
    expect(updateToast).toHaveBeenCalledWith("toast-1", expect.objectContaining({
      title: "Connection failed",
      description: expect.stringContaining("ECONNREFUSED"),
    }));
  });

  test("prevents concurrent attempts for one connection and restores focus on Escape", async () => {
    let resolveValidation: (value: string) => void = () => undefined;
    testSavedConnection.mockImplementationOnce(() => new Promise((resolve) => {
      resolveValidation = resolve;
    }));
    render(<><button type="button" data-testid="focus-target">Focus target</button><HomeCommandBar activeConnectionId={null} /></>);
    const trigger = screen.getByTestId("focus-target");
    trigger.focus();

    fireEvent.keyDown(window, { key: "p", code: "KeyP", ctrlKey: true });
    const connectionButton = screen.getByRole("button", { name: /Production/ });
    fireEvent.click(connectionButton);
    fireEvent.click(connectionButton);
    expect(testSavedConnection).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(screen.getByRole("textbox", { name: "Search commands" }), { key: "Escape" });
    await act(async () => await Promise.resolve());
    expect(screen.queryByRole("dialog", { name: "Command palette" })).toBeNull();
    expect(document.activeElement).toBe(trigger);
    await act(async () => {
      resolveValidation("ok");
      await Promise.resolve();
    });
  });
});
