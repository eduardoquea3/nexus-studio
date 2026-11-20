import { expect, test } from "bun:test";

import {
  formatShortcutBinding,
  isShortcutModifierKey,
  matchesShortcutEvent,
  toCodeMirrorKeybinding,
} from "@/shared/keymaps/shortcut-catalog";

const keyEvent = (overrides: Partial<KeyboardEvent>) => ({
  key: "p",
  ctrlKey: true,
  altKey: false,
  shiftKey: false,
  metaKey: false,
  ...overrides,
});

test("matches only the exact configured chord", () => {
  expect(matchesShortcutEvent(keyEvent({}), "ctrl+p")).toBe(true);
  expect(matchesShortcutEvent(keyEvent({ shiftKey: true }), "ctrl+shift+p")).toBe(true);
  expect(matchesShortcutEvent(keyEvent({ shiftKey: true }), "ctrl+p")).toBe(false);
  expect(matchesShortcutEvent(keyEvent({ metaKey: true, ctrlKey: false }), "ctrl+p")).toBe(false);
  expect(matchesShortcutEvent(keyEvent({ ctrlKey: false }), null)).toBe(false);
});

test("matches named keys and identifies the released chord modifier", () => {
  expect(matchesShortcutEvent(keyEvent({ key: "Enter", shiftKey: true }), "ctrl+shift+enter")).toBe(
    true,
  );
  expect(isShortcutModifierKey("Control", "ctrl+tab")).toBe(true);
  expect(isShortcutModifierKey("Alt", "alt+tab")).toBe(true);
  expect(isShortcutModifierKey("Control", "alt+tab")).toBe(false);
});

test("converts active chords for CodeMirror and omits unassigned bindings", () => {
  expect(toCodeMirrorKeybinding("ctrl+shift+enter")).toBe("Ctrl-Shift-Enter");
  expect(toCodeMirrorKeybinding("ctrl+b")).toBe("Ctrl-b");
  expect(toCodeMirrorKeybinding(null)).toBeNull();
  expect(formatShortcutBinding("ctrl+shift+enter")).toEqual(["Ctrl", "Shift", "Enter"]);
  expect(formatShortcutBinding(null)).toEqual([]);
});
