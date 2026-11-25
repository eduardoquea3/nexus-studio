import "./setup";
import { afterEach, expect, mock, test } from "bun:test";
import type { ReactNode } from "react";
import type { SidebarTableMetadata } from "@/shared/lib/tauriApi";

const getSidebarTableMetadata = mock(
  (
    _profile: unknown,
    _table: string,
    _schema?: string,
    _database?: string,
  ): Promise<SidebarTableMetadata> =>
    Promise.resolve({ columns: [], foreignKeys: [], indexes: [] }),
);
const objects = [{ name: "account", schema: "public", object_type: "table" as const }];
mock.module("@/shared/lib/tauriApi", () => ({ getSidebarTableMetadata }));
mock.module("@/app/connection/hooks/use-schema-objects", () => ({
  useSchemaObjects: () => ({
    data: objects,
    isLoading: false,
    isFetching: false,
    error: null,
    refetch: () => undefined,
  }),
}));
mock.module("@/app/home/hooks/use-connections", () => ({ useConnections: () => ({ data: [] }) }));
mock.module("@gsap/react", () => ({ useGSAP: () => undefined }));
mock.module("gsap", () => ({
  default: {
    registerPlugin: () => undefined,
    to: () => undefined,
    killTweensOf: () => undefined,
  },
}));
const setSidebarWidth = mock(async (_width: number) => undefined);
const sidebarState = {
  sidebarOpen: true,
  sidebarWidth: 240,
  sidebarPosition: "left",
  setSidebarWidth,
};
mock.module("@/shared/store/theme-store", () => ({
  SIDEBAR_WIDTH_MIN: 200,
  SIDEBAR_WIDTH_MAX: 420,
  useThemeStore: (selector: (state: typeof sidebarState) => unknown) => selector(sidebarState),
}));
mock.module("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
mock.module("@/components/ui/sheet", () => ({
  Sheet: ({ children }: { children: ReactNode }) => <>{children}</>,
  SheetContent: ({ children, side }: { children: ReactNode; side?: string }) => (
    <div data-side={side}>{children}</div>
  ),
  SheetTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
mock.module("@/app/connection/components/connection-switcher-menu", () => ({
  ConnectionSwitcherMenu: () => null,
}));

const { cleanup, fireEvent, render, screen, waitFor } = await import("@testing-library/react");
const { ConnectionSidebar } = await import("@/app/connection/components/connection-sidebar");
const profile = {
  id: "c1",
  name: "test",
  db_type: "postgres",
  password: undefined,
  connect_mode: {
    type: "fields",
    host: "localhost",
    port: 5432,
    database: "one",
    username: "u",
    password_ref: null,
  },
  ssh_tunnel: null,
} as never;
const metadata = {
  columns: [],
  foreignKeys: [
    { name: "fk_pair", column: "left_id", referencedTable: "target", referencedColumn: "a" },
    { name: "fk_pair", column: "right_id", referencedTable: "target", referencedColumn: "b" },
  ],
  indexes: [
    { name: "idx_pair", column: "left_id", isPrimary: false, isUnique: true },
    { name: "idx_pair", column: "right_id", isPrimary: false, isUnique: true },
  ],
};
function renderSidebar(database = "one") {
  return render(
    <ConnectionSidebar
      profile={profile}
      selectedDatabase={database}
      onTableSelect={() => undefined}
      onRoutineSelect={() => undefined}
    />,
  );
}

afterEach(() => {
  cleanup();
  getSidebarTableMetadata.mockReset();
  getSidebarTableMetadata.mockResolvedValue(metadata);
  setSidebarWidth.mockClear();
  sidebarState.sidebarWidth = 240;
  sidebarState.sidebarPosition = "left";
});

test("fetches metadata only on table expansion and refreshes on reopen", async () => {
  getSidebarTableMetadata.mockResolvedValue(metadata);
  renderSidebar();
  expect(getSidebarTableMetadata).not.toHaveBeenCalled();
  fireEvent.click(screen.getAllByRole("button", { name: "Expand account columns" })[0]!);
  await waitFor(() => expect(getSidebarTableMetadata).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getAllByRole("button", { name: "Collapse account columns" })[0]!);
  fireEvent.click(screen.getAllByRole("button", { name: "Expand account columns" })[0]!);
  await waitFor(() => expect(getSidebarTableMetadata).toHaveBeenCalledTimes(2));
});

test("resizes the desktop sidebar by pointer and persists the resulting width", () => {
  renderSidebar();
  const separator = screen.getByRole("separator", { name: "Resize connection sidebar" });
  const sidebarPanel = document.getElementById("connection-sidebar-panel");

  expect(separator.getAttribute("aria-valuemin")).toBe("200");
  expect(separator.getAttribute("aria-valuemax")).toBe("420");
  fireEvent.pointerDown(separator, { pointerId: 1, clientX: 240 });
  fireEvent.pointerMove(separator, { pointerId: 1, clientX: 320 });
  expect(sidebarPanel?.style.width).toBe("320px");
  fireEvent.pointerUp(separator, { pointerId: 1, clientX: 320 });

  expect(setSidebarWidth).toHaveBeenCalledWith(320);
});

test("mirrors the resize handle and uses the configured mobile Sheet side", () => {
  sidebarState.sidebarPosition = "right";
  renderSidebar();

  const separator = screen.getByRole("separator", { name: "Resize connection sidebar" });
  expect(separator.className).toContain("-left-1");
  expect(document.querySelector('[data-side="right"]')).not.toBeNull();
});

test("resizes a right-side sidebar toward the left and reverses keyboard arrows", () => {
  sidebarState.sidebarPosition = "right";
  renderSidebar();
  const separator = screen.getByRole("separator", { name: "Resize connection sidebar" });
  const sidebarPanel = document.getElementById("connection-sidebar-panel");

  fireEvent.pointerDown(separator, { pointerId: 2, clientX: 240 });
  fireEvent.pointerMove(separator, { pointerId: 2, clientX: 160 });
  expect(sidebarPanel?.style.width).toBe("320px");
  fireEvent.pointerUp(separator, { pointerId: 2, clientX: 160 });
  expect(setSidebarWidth).toHaveBeenCalledWith(320);

  fireEvent.keyDown(separator, { key: "ArrowLeft" });
  expect(setSidebarWidth).toHaveBeenLastCalledWith(256);
  fireEvent.keyDown(separator, { key: "ArrowRight" });
  expect(setSidebarWidth).toHaveBeenLastCalledWith(224);
});

test("supports keyboard resizing with the accessible sidebar separator", () => {
  renderSidebar();
  const separator = screen.getByRole("separator", { name: "Resize connection sidebar" });

  fireEvent.keyDown(separator, { key: "ArrowRight" });
  expect(setSidebarWidth).toHaveBeenCalledWith(256);
  fireEvent.keyDown(separator, { key: "End" });
  expect(setSidebarWidth).toHaveBeenLastCalledWith(420);
});

test("isolates metadata by selected database and ignores stale responses", async () => {
  let resolveOld!: (value: typeof metadata) => void;
  getSidebarTableMetadata.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveOld = resolve;
      }),
  );
  const view = renderSidebar("one");
  fireEvent.click(screen.getAllByRole("button", { name: "Expand account columns" })[0]!);
  view.rerender(
    <ConnectionSidebar
      profile={profile}
      selectedDatabase="two"
      onTableSelect={() => undefined}
      onRoutineSelect={() => undefined}
    />,
  );
  fireEvent.click(screen.getAllByRole("button", { name: "Expand account columns" })[0]!);
  await waitFor(() => expect(getSidebarTableMetadata).toHaveBeenCalledTimes(2));
  resolveOld(metadata);
  await waitFor(() => expect(getSidebarTableMetadata.mock.calls[1]?.[3]).toBe("two"));
  expect(getSidebarTableMetadata.mock.calls.map((call) => call[3])).toEqual(["one", "two"]);
});
