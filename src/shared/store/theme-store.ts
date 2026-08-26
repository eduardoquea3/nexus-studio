import { load } from "@tauri-apps/plugin-store";
import { create } from "zustand";
import { extractThemeVariables } from "../lib/theme-parser";
import type { ThemeMode, ThemeVariant } from "../types/theme";

const themeSources = import.meta.glob("../../../docs/themes/*.css", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

export const THEME_VARIANTS: ThemeVariant[] = Object.entries(themeSources)
  .filter(([path]) => !path.endsWith("/theme-template.css"))
  .flatMap(([path, css]) => {
    const fileName = path.split("/").pop() ?? path;
    const baseName = fileName.replace(/\.css$/, "");
    const name = baseName
      .split(/[-_]/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

    return (["light", "dark"] as const).map((mode) => ({
      id: `${baseName}-${mode}`,
      name: `${name} ${mode.charAt(0).toUpperCase()}${mode.slice(1)}`,
      fileName,
      mode,
      variables: extractThemeVariables(css, mode),
    }));
  })
  .sort((a, b) => a.name.localeCompare(b.name));

const DEFAULT_THEME_ID = THEME_VARIANTS.find((variant) => variant.id === "twitter-dark")?.id ?? THEME_VARIANTS[0]?.id ?? "";

interface ThemeState {
  theme: ThemeVariant;
  sidebarOpen: boolean;
  toggle: () => Promise<void>;
  setTheme: (themeId: string) => Promise<void>;
  toggleSidebar: () => Promise<void>;
}

const STORE_PATH = "theme.json";
const THEME_KEY = "theme";
const SIDEBAR_KEY = "sidebarOpen";

let themeStorePromise: Promise<Awaited<ReturnType<typeof load>>> | null = null;
let appliedVariables = new Set<string>();
let themePersistenceQueue = Promise.resolve();

function findVariant(themeId: string) {
  return THEME_VARIANTS.find((variant) => variant.id === themeId);
}

function getVariant(themeId: string) {
  return findVariant(themeId) ?? findVariant(DEFAULT_THEME_ID) ?? THEME_VARIANTS[0];
}

function applyTheme(theme: ThemeVariant) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme.mode === "dark");

  for (const property of appliedVariables) {
    root.style.removeProperty(property);
  }

  appliedVariables = new Set(Object.keys(theme.variables));
  for (const [property, value] of Object.entries(theme.variables)) {
    root.style.setProperty(property, value);
  }
}

async function getThemeStore() {
  themeStorePromise ??= load(STORE_PATH, {
    autoSave: false,
    defaults: { [THEME_KEY]: DEFAULT_THEME_ID, [SIDEBAR_KEY]: true },
  });
  return themeStorePromise;
}

async function persistTheme(theme: ThemeVariant) {
  const saveTheme = async () => {
    const store = await getThemeStore();
    await store.set(THEME_KEY, theme.id);
    await store.save();
  };

  themePersistenceQueue = themePersistenceQueue.catch(() => undefined).then(saveTheme);
  await themePersistenceQueue;
}

export async function initThemeStore() {
  const store = await getThemeStore();
  const savedTheme = await store.get<string>(THEME_KEY);
  const savedSidebarOpen = await store.get<boolean>(SIDEBAR_KEY);
  const legacyMode: ThemeMode | undefined = savedTheme === "light" || savedTheme === "dark" ? savedTheme : undefined;
  const theme = getVariant(legacyMode ? `${DEFAULT_THEME_ID.replace(/-(light|dark)$/, "")}-${legacyMode}` : savedTheme ?? DEFAULT_THEME_ID);
  const sidebarOpen = savedSidebarOpen ?? true;

  if (!theme) {
    return;
  }

  applyTheme(theme);
  useThemeStore.setState({ theme, sidebarOpen });
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: getVariant(DEFAULT_THEME_ID) as ThemeVariant,
  sidebarOpen: true,
  toggle: async () => {
    const current = get().theme;
    const nextMode = current.mode === "light" ? "dark" : "light";
    const next = getVariant(`${current.id.replace(/-(light|dark)$/, "")}-${nextMode}`) ?? current;
    applyTheme(next);
    set({ theme: next });
    await persistTheme(next);
  },
  setTheme: async (themeId) => {
    const theme = findVariant(themeId);
    if (!theme) {
      return;
    }

    applyTheme(theme);
    set({ theme });
    await persistTheme(theme);
  },
  toggleSidebar: async () => {
    const sidebarOpen = !get().sidebarOpen;
    set({ sidebarOpen });
    const store = await getThemeStore();
    await store.set(SIDEBAR_KEY, sidebarOpen);
    await store.save();
  },
}));
