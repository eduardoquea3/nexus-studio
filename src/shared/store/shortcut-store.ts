import { load } from "@tauri-apps/plugin-store";
import { create } from "zustand";

import {
  findShortcutConflict,
  getShortcutDefinition,
  normalizeShortcutBinding,
  normalizeShortcutOverrides,
  type ShortcutBinding,
  type ShortcutOverrides,
} from "@/shared/keymaps/shortcut-catalog";

const STORE_PATH = "shortcuts.json";
const BINDINGS_KEY = "bindings";

export type ShortcutUpdateResult =
  | { status: "saved" }
  | { status: "invalid" }
  | { status: "conflict"; conflictingAction: string }
  | { status: "unknown-shortcut" };

interface ShortcutState {
  overrides: ShortcutOverrides;
  isLoaded: boolean;
  setBinding: (id: string, binding: unknown) => Promise<ShortcutUpdateResult>;
  resetBinding: (id: string) => Promise<ShortcutUpdateResult>;
}

let shortcutStorePromise: Promise<Awaited<ReturnType<typeof load>>> | null = null;
let shortcutPersistenceQueue: Promise<void> = Promise.resolve();

async function getShortcutStore() {
  shortcutStorePromise ??= load(STORE_PATH, {
    autoSave: false,
    defaults: { [BINDINGS_KEY]: {} },
  });
  return shortcutStorePromise;
}

async function writeOverrides(overrides: ShortcutOverrides) {
  const store = await getShortcutStore();
  await store.set(BINDINGS_KEY, overrides);
  await store.save();
}

function queueUpdate(update: () => Promise<ShortcutUpdateResult>) {
  const operation = shortcutPersistenceQueue.then(update);
  shortcutPersistenceQueue = operation.then(
    () => undefined,
    () => undefined,
  );
  return operation;
}

async function updateBinding(id: string, binding: unknown, reset: boolean) {
  const definition = getShortcutDefinition(id);
  if (!definition) return { status: "unknown-shortcut" } as const;

  const state = useShortcutStore.getState();
  const overrides = { ...state.overrides };
  let nextBinding: ShortcutBinding;

  if (reset) {
    delete overrides[definition.id];
    nextBinding = definition.defaultBinding;
  } else {
    const normalized = normalizeShortcutBinding(binding);
    if (!normalized.valid) return { status: "invalid" } as const;
    nextBinding = normalized.binding;
    const conflict = findShortcutConflict(nextBinding, overrides, definition.id);
    if (conflict) {
      return { status: "conflict", conflictingAction: conflict.action } as const;
    }
    overrides[definition.id] = nextBinding;
  }

  const resetConflict = findShortcutConflict(nextBinding, overrides, definition.id);
  if (resetConflict) {
    return { status: "conflict", conflictingAction: resetConflict.action } as const;
  }

  await writeOverrides(overrides);
  useShortcutStore.setState({ overrides, isLoaded: true });
  return { status: "saved" } as const;
}

export const useShortcutStore = create<ShortcutState>(() => ({
  overrides: {},
  isLoaded: false,
  setBinding: (id, binding) => queueUpdate(() => updateBinding(id, binding, false)),
  resetBinding: (id) => queueUpdate(() => updateBinding(id, null, true)),
}));

export async function initShortcutStore() {
  try {
    const store = await getShortcutStore();
    const persistedOverrides = await store.get<unknown>(BINDINGS_KEY);
    useShortcutStore.setState({
      overrides: normalizeShortcutOverrides(persistedOverrides),
      isLoaded: true,
    });
  } catch (error: unknown) {
    console.error("Failed to initialize shortcut preferences", error);
    useShortcutStore.setState({ overrides: {}, isLoaded: true });
  }
}
