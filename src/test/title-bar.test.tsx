import "./setup";
import { afterEach, describe, expect, mock, test } from "bun:test";

import type { ConnectionProfile } from "@/shared/types/models";

const profile: ConnectionProfile = {
  id: "connection-1",
  name: "Production",
  db_type: "postgres",
  connect_mode: { type: "connection_string", value: "postgres://example" },
  ssh_tunnel: null,
};
const connectionMatch = {
  routeId: "/connections/$connectionId",
  params: { connectionId: profile.id },
};
const routeState = { matches: [connectionMatch] };
const navigate = mock(async () => undefined);
const useRouterState = mock((options: { select: (state: typeof routeState) => unknown }) =>
  options.select(routeState),
);
const windowActions = {
  minimize: mock(async () => undefined),
  toggleMaximize: mock(async () => undefined),
  close: mock(async () => undefined),
};

mock.module("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
  useRouterState,
}));
mock.module("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => windowActions,
}));
mock.module("@/app/home/hooks/use-connections", () => ({
  useConnection: (id: string) => ({ data: id === profile.id ? profile : undefined }),
}));
mock.module("@/shared/store/theme-store", () => ({
  useThemeStore: () => ({ theme: { mode: "dark" }, toggle: async () => undefined }),
}));

const { TitleBar } = await import("@/shared/components/title-bar");
const { cleanup, render, screen } = await import("@testing-library/react");

describe("TitleBar", () => {
  afterEach(() => {
    cleanup();
    routeState.matches.splice(0, routeState.matches.length, connectionMatch);
  });

  test("combines connection identity and window controls into one top bar", () => {
    const { container } = render(<TitleBar />);

    expect(container.querySelectorAll("header")).toHaveLength(1);
    expect(screen.getByText("NEXUS STUDIO")).not.toBeNull();
    expect(screen.getByText("Production")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Minimize" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Maximize" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Close" })).not.toBeNull();
    expect(screen.queryByText("Nexus Studio")).toBeNull();
  });

  test("keeps the standard title on routes outside the connection workspace", () => {
    routeState.matches.splice(0, routeState.matches.length);
    render(<TitleBar />);

    expect(screen.getByText("Nexus Studio")).not.toBeNull();
    expect(screen.queryByText("NEXUS STUDIO")).toBeNull();
    expect(screen.getByRole("button", { name: "Open settings" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Close" })).not.toBeNull();
  });
});
