import { afterEach, beforeEach, expect, mock, test } from "bun:test";

const savedValues = new Map<string, unknown>();
const storeSave = mock(async () => {});

mock.module("@tauri-apps/plugin-store", () => ({
  load: async () => ({
    get: async (key: string) => savedValues.get(key),
    set: async (key: string, value: unknown) => {
      savedValues.set(key, value);
    },
    save: storeSave,
  }),
}));

const { getShortcutBinding } = await import("@/shared/keymaps/shortcut-catalog");
const { initShortcutStore, useShortcutStore } = await import("@/shared/store/shortcut-store");

beforeEach(() => {
  savedValues.clear();
  storeSave.mockClear();
  useShortcutStore.setState(useShortcutStore.getInitialState());
});

afterEach(() => {
  useShortcutStore.setState(useShortcutStore.getInitialState());
});

test("persists a customized shortcut and reloads it on initialization", async () => {
  await initShortcutStore();

  const result = await useShortcutStore.getState().setBinding("toggle-sidebar", "alt+q");

  expect(result.status).toBe("saved");
  expect(getShortcutBinding("toggle-sidebar", useShortcutStore.getState().overrides)).toBe("alt+q");
  expect(storeSave).toHaveBeenCalledTimes(1);

  await initShortcutStore();
  expect(getShortcutBinding("toggle-sidebar", useShortcutStore.getState().overrides)).toBe("alt+q");
});

test("rejects a binding used by another shortcut without changing the saved binding", async () => {
  await initShortcutStore();

  const result = await useShortcutStore.getState().setBinding("toggle-sidebar", "ctrl+p");

  expect(result).toEqual({
    status: "conflict",
    conflictingAction: "Open command palette",
  });
  expect(getShortcutBinding("toggle-sidebar", useShortcutStore.getState().overrides)).toBe(
    "ctrl+b",
  );
  expect(storeSave).not.toHaveBeenCalled();
});

test("supports removing a shortcut and restoring its built-in default", async () => {
  await initShortcutStore();

  const removed = await useShortcutStore.getState().setBinding("toggle-sidebar", null);
  expect(removed.status).toBe("saved");
  expect(getShortcutBinding("toggle-sidebar", useShortcutStore.getState().overrides)).toBeNull();

  const restored = await useShortcutStore.getState().resetBinding("toggle-sidebar");
  expect(restored.status).toBe("saved");
  expect(getShortcutBinding("toggle-sidebar", useShortcutStore.getState().overrides)).toBe(
    "ctrl+b",
  );
});

test("rejects invalid key chords without persisting them", async () => {
  await initShortcutStore();

  const result = await useShortcutStore.getState().setBinding("toggle-sidebar", "ctrl+shift");

  expect(result.status).toBe("invalid");
  expect(getShortcutBinding("toggle-sidebar", useShortcutStore.getState().overrides)).toBe(
    "ctrl+b",
  );
  expect(storeSave).not.toHaveBeenCalled();
});
