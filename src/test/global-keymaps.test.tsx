import "./setup";
import { afterEach, beforeEach, expect, mock, test } from "bun:test";

const toggleSidebar = mock(async () => {});
mock.module("@/shared/store/theme-store", () => ({
  useThemeStore: (select: (state: { toggleSidebar: typeof toggleSidebar }) => unknown) =>
    select({ toggleSidebar }),
}));

const { useShortcutStore } = await import("@/shared/store/shortcut-store");
const { GlobalKeymaps } = await import("@/shared/keymaps/global-keymaps");
const { act, cleanup, fireEvent, render } = await import("@testing-library/react");

beforeEach(() => {
  toggleSidebar.mockClear();
  useShortcutStore.setState({ overrides: {} });
});

afterEach(() => cleanup());

test("uses a customized global sidebar shortcut and supports removing it", () => {
  render(<GlobalKeymaps />);

  fireEvent.keyDown(document, { key: "b", code: "KeyB", ctrlKey: true });
  expect(toggleSidebar).toHaveBeenCalledTimes(1);

  act(() => useShortcutStore.setState({ overrides: { "toggle-sidebar": "alt+shift+b" } }));
  fireEvent.keyDown(document, { key: "b", code: "KeyB", ctrlKey: true });
  expect(toggleSidebar).toHaveBeenCalledTimes(1);
  fireEvent.keyDown(document, { key: "b", code: "KeyB", altKey: true, shiftKey: true });
  expect(toggleSidebar).toHaveBeenCalledTimes(2);

  act(() => useShortcutStore.setState({ overrides: { "toggle-sidebar": null } }));
  fireEvent.keyDown(document, { key: "b", code: "KeyB", altKey: true, shiftKey: true });
  expect(toggleSidebar).toHaveBeenCalledTimes(2);
});
