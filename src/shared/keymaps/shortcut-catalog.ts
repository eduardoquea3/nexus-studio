export type ShortcutCategory = "global" | "home-workspace" | "editor-canvas";

export const SHORTCUT_CATALOG = [
  {
    id: "toggle-sidebar",
    category: "global",
    action: "Toggle sidebar",
    defaultBinding: "ctrl+b",
  },
  {
    id: "command-palette",
    category: "global",
    action: "Open command palette",
    description: "Quickly run a studio command",
    defaultBinding: "ctrl+p",
  },
  {
    id: "application-commands",
    category: "global",
    action: "Open application commands",
    defaultBinding: "ctrl+shift+p",
  },
  {
    id: "new-connection",
    category: "home-workspace",
    action: "Create connection",
    description: "Available from Home when dialogs are closed",
    defaultBinding: "ctrl+n",
  },
  {
    id: "new-sql-tab",
    category: "home-workspace",
    action: "Create SQL tab",
    defaultBinding: "ctrl+t",
  },
  {
    id: "close-active-tab",
    category: "home-workspace",
    action: "Close active tab",
    defaultBinding: "ctrl+w",
  },
  {
    id: "next-tab",
    category: "home-workspace",
    action: "Next tab / open tab switcher",
    defaultBinding: "ctrl+tab",
  },
  {
    id: "previous-tab",
    category: "home-workspace",
    action: "Previous tab",
    defaultBinding: "ctrl+shift+tab",
  },
  {
    id: "run-all-sql",
    category: "editor-canvas",
    action: "Run all SQL statements",
    description: "Runs the current query in the active workspace",
    defaultBinding: "ctrl+enter",
  },
  {
    id: "run-current-sql",
    category: "editor-canvas",
    action: "Run current SQL statement",
    description: "Runs the statement at the editor cursor",
    defaultBinding: "ctrl+shift+enter",
  },
] as const;

export type ShortcutId = (typeof SHORTCUT_CATALOG)[number]["id"];
export type ShortcutBinding = string | null;
export type ShortcutOverrides = Partial<Record<ShortcutId, ShortcutBinding>>;

export type NormalizedBindingResult = { valid: true; binding: ShortcutBinding } | { valid: false };

const MODIFIER_ORDER = ["ctrl", "alt", "shift"] as const;
const MODIFIERS = new Set<string>(MODIFIER_ORDER);
const KEY_ALIASES: Record<string, string> = {
  " ": "space",
  arrowdown: "down",
  arrowleft: "left",
  arrowright: "right",
  arrowup: "up",
  esc: "escape",
  return: "enter",
};
const NAMED_KEYS = new Set([
  "backspace",
  "delete",
  "down",
  "end",
  "enter",
  "escape",
  "home",
  "insert",
  "left",
  "page-down",
  "page-up",
  "right",
  "space",
  "tab",
  "up",
]);

export function normalizeShortcutBinding(value: unknown): NormalizedBindingResult {
  if (value === null) {
    return { valid: true, binding: null };
  }
  if (typeof value !== "string" || !value.trim()) {
    return { valid: false };
  }

  const parts = value
    .split("+")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  const modifiers = new Set<string>();
  const keys: string[] = [];

  for (const part of parts) {
    if (MODIFIERS.has(part)) {
      if (modifiers.has(part)) return { valid: false };
      modifiers.add(part);
      continue;
    }
    if (keys.length > 0) return { valid: false };
    const key = KEY_ALIASES[part] ?? part;
    if (!isSupportedKey(key)) return { valid: false };
    keys.push(key);
  }

  if (keys.length !== 1) return { valid: false };
  const orderedModifiers = MODIFIER_ORDER.filter((modifier) => modifiers.has(modifier));
  return { valid: true, binding: [...orderedModifiers, keys[0]].join("+") };
}

export function getShortcutDefinition(id: string) {
  return SHORTCUT_CATALOG.find((shortcut) => shortcut.id === id);
}

export function getShortcutBinding(id: string, overrides: ShortcutOverrides): ShortcutBinding {
  const definition = getShortcutDefinition(id);
  if (!definition) return null;
  if (Object.hasOwn(overrides, id)) return overrides[id] ?? null;
  return definition.defaultBinding;
}

export function findShortcutConflict(
  binding: ShortcutBinding,
  overrides: ShortcutOverrides,
  excludingId: string,
) {
  if (!binding) return undefined;
  return SHORTCUT_CATALOG.find(
    (shortcut) =>
      shortcut.id !== excludingId && getShortcutBinding(shortcut.id, overrides) === binding,
  );
}

export function normalizeShortcutOverrides(value: unknown): ShortcutOverrides {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};

  const rawOverrides = value as Record<string, unknown>;
  const normalized: ShortcutOverrides = {};
  for (const shortcut of SHORTCUT_CATALOG) {
    if (!Object.hasOwn(rawOverrides, shortcut.id)) continue;
    const result = normalizeShortcutBinding(rawOverrides[shortcut.id]);
    if (!result.valid) continue;
    if (findShortcutConflict(result.binding, normalized, shortcut.id)) continue;
    normalized[shortcut.id] = result.binding;
  }
  return normalized;
}

function isSupportedKey(key: string) {
  return /^[a-z0-9]$/.test(key) || /^f([1-9]|1[0-2])$/.test(key) || NAMED_KEYS.has(key);
}
