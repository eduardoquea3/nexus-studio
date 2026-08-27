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
export const FONT_SIZE_MIN = 8;
export const FONT_SIZE_MAX = 32;
const DEFAULT_INTERFACE_FONT_SIZE = 16;
const DEFAULT_SQL_EDITOR_FONT_SIZE = 16;
const DEFAULT_RESULT_FONT_SIZE = 12;

interface ThemeState {
  theme: ThemeVariant;
  interfaceFontFamily: string | null;
  sqlEditorFontFamily: string | null;
  resultFontFamily: string | null;
  interfaceFontSize: number;
  sqlEditorFontSize: number;
  resultFontSize: number;
  sidebarOpen: boolean;
  toggle: () => Promise<void>;
  setTheme: (themeId: string) => Promise<void>;
  setInterfaceFontFamily: (fontFamily: string | null) => Promise<void>;
  setSqlEditorFontFamily: (fontFamily: string | null) => Promise<void>;
  setResultFontFamily: (fontFamily: string | null) => Promise<void>;
  setInterfaceFontSize: (fontSize: number) => Promise<void>;
  setSqlEditorFontSize: (fontSize: number) => Promise<void>;
  setResultFontSize: (fontSize: number) => Promise<void>;
  toggleSidebar: () => Promise<void>;
}

const STORE_PATH = "theme.json";
const THEME_KEY = "theme";
const INTERFACE_FONT_FAMILY_KEY = "fontFamily";
const SQL_EDITOR_FONT_FAMILY_KEY = "sqlEditorFontFamily";
const RESULT_FONT_FAMILY_KEY = "resultFontFamily";
const INTERFACE_FONT_SIZE_KEY = "interfaceFontSize";
const SQL_EDITOR_FONT_SIZE_KEY = "sqlEditorFontSize";
const RESULT_FONT_SIZE_KEY = "resultFontSize";
const SIDEBAR_KEY = "sidebarOpen";

let themeStorePromise: Promise<Awaited<ReturnType<typeof load>>> | null = null;
let appliedVariables = new Set<string>();
let appliedTheme: ThemeVariant | null = null;
let activeFontFamilies = {
  interfaceFontFamily: null as string | null,
  sqlEditorFontFamily: null as string | null,
  resultFontFamily: null as string | null,
};
let activeFontSizes = {
  interfaceFontSize: DEFAULT_INTERFACE_FONT_SIZE,
  sqlEditorFontSize: DEFAULT_SQL_EDITOR_FONT_SIZE,
  resultFontSize: DEFAULT_RESULT_FONT_SIZE,
};
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

  appliedTheme = theme;
  applyFontFamilies(activeFontFamilies);
  applyFontSizes(activeFontSizes);
}

function applyFontFamilies(fontFamilies: typeof activeFontFamilies) {
  const root = document.documentElement;
  activeFontFamilies = fontFamilies;

  if (!fontFamilies.interfaceFontFamily) {
    for (const property of ["--font-sans", "--font-label"]) {
      const themeValue = appliedTheme?.variables[property];
      if (themeValue) {
        root.style.setProperty(property, themeValue);
      } else {
        root.style.removeProperty(property);
      }
    }
  } else {
    const interfaceFontValue = toFontFamilyValue(fontFamilies.interfaceFontFamily);
    root.style.setProperty("--font-sans", interfaceFontValue);
    root.style.setProperty("--font-label", interfaceFontValue);
  }

  setScopedFontFamily(root, "--font-sql-editor", fontFamilies.sqlEditorFontFamily);
  setScopedFontFamily(root, "--font-results", fontFamilies.resultFontFamily);
}

function setScopedFontFamily(root: HTMLElement, property: string, fontFamily: string | null) {
  if (!fontFamily) {
    root.style.removeProperty(property);
    return;
  }

  root.style.setProperty(property, toFontFamilyValue(fontFamily));
}

function toFontFamilyValue(fontFamily: string) {
  const escapedFamily = fontFamily.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escapedFamily}", ui-sans-serif, system-ui, sans-serif`;
}

function applyFontSizes(fontSizes: typeof activeFontSizes) {
  const root = document.documentElement;
  activeFontSizes = fontSizes;
  root.style.fontSize = `${fontSizes.interfaceFontSize}px`;
  root.style.setProperty("--font-size-interface", `${fontSizes.interfaceFontSize}px`);
  root.style.setProperty("--font-size-sql-editor", `${fontSizes.sqlEditorFontSize}px`);
  root.style.setProperty("--font-size-results", `${fontSizes.resultFontSize}px`);
}

async function getThemeStore() {
  themeStorePromise ??= load(STORE_PATH, {
    autoSave: false,
    defaults: {
      [THEME_KEY]: DEFAULT_THEME_ID,
      [INTERFACE_FONT_SIZE_KEY]: DEFAULT_INTERFACE_FONT_SIZE,
      [SQL_EDITOR_FONT_SIZE_KEY]: DEFAULT_SQL_EDITOR_FONT_SIZE,
      [RESULT_FONT_SIZE_KEY]: DEFAULT_RESULT_FONT_SIZE,
      [SIDEBAR_KEY]: true,
    },
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

async function persistPreference(key: string, value: string | number | null) {
  const savePreference = async () => {
    const store = await getThemeStore();
    await store.set(key, value);
    await store.save();
  };

  themePersistenceQueue = themePersistenceQueue.catch(() => undefined).then(savePreference);
  await themePersistenceQueue;
}

function normalizeFontFamily(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeFontSize(value: unknown, fallback: number) {
  const numericValue = typeof value === "number"
    ? value
    : typeof value === "string" && value.trim()
      ? Number(value)
      : Number.NaN;
  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, Math.round(numericValue)));
}

export async function initThemeStore() {
  const store = await getThemeStore();
  const savedTheme = await store.get<string>(THEME_KEY);
  const savedInterfaceFontFamily = normalizeFontFamily(await store.get<unknown>(INTERFACE_FONT_FAMILY_KEY));
  const savedSqlEditorFontFamily = normalizeFontFamily(await store.get<unknown>(SQL_EDITOR_FONT_FAMILY_KEY));
  const savedResultFontFamily = normalizeFontFamily(await store.get<unknown>(RESULT_FONT_FAMILY_KEY));
  const savedInterfaceFontSize = normalizeFontSize(
    await store.get<unknown>(INTERFACE_FONT_SIZE_KEY),
    DEFAULT_INTERFACE_FONT_SIZE,
  );
  const savedSqlEditorFontSize = normalizeFontSize(
    await store.get<unknown>(SQL_EDITOR_FONT_SIZE_KEY),
    DEFAULT_SQL_EDITOR_FONT_SIZE,
  );
  const savedResultFontSize = normalizeFontSize(
    await store.get<unknown>(RESULT_FONT_SIZE_KEY),
    DEFAULT_RESULT_FONT_SIZE,
  );
  const savedSidebarOpen = await store.get<boolean>(SIDEBAR_KEY);
  const legacyMode: ThemeMode | undefined = savedTheme === "light" || savedTheme === "dark" ? savedTheme : undefined;
  const theme = getVariant(legacyMode ? `${DEFAULT_THEME_ID.replace(/-(light|dark)$/, "")}-${legacyMode}` : savedTheme ?? DEFAULT_THEME_ID);
  const sidebarOpen = savedSidebarOpen ?? true;

  if (!theme) {
    return;
  }

  activeFontFamilies = {
    interfaceFontFamily: savedInterfaceFontFamily,
    sqlEditorFontFamily: savedSqlEditorFontFamily,
    resultFontFamily: savedResultFontFamily,
  };
  activeFontSizes = {
    interfaceFontSize: savedInterfaceFontSize,
    sqlEditorFontSize: savedSqlEditorFontSize,
    resultFontSize: savedResultFontSize,
  };
  applyTheme(theme);
  useThemeStore.setState({
    theme,
    interfaceFontFamily: savedInterfaceFontFamily,
    sqlEditorFontFamily: savedSqlEditorFontFamily,
    resultFontFamily: savedResultFontFamily,
    interfaceFontSize: savedInterfaceFontSize,
    sqlEditorFontSize: savedSqlEditorFontSize,
    resultFontSize: savedResultFontSize,
    sidebarOpen,
  });
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: getVariant(DEFAULT_THEME_ID) as ThemeVariant,
  interfaceFontFamily: null,
  sqlEditorFontFamily: null,
  resultFontFamily: null,
  interfaceFontSize: DEFAULT_INTERFACE_FONT_SIZE,
  sqlEditorFontSize: DEFAULT_SQL_EDITOR_FONT_SIZE,
  resultFontSize: DEFAULT_RESULT_FONT_SIZE,
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
  setInterfaceFontFamily: async (fontFamily) => {
    const nextFontFamily = normalizeFontFamily(fontFamily);
    applyFontFamilies({ ...activeFontFamilies, interfaceFontFamily: nextFontFamily });
    set({ interfaceFontFamily: nextFontFamily });
    await persistPreference(INTERFACE_FONT_FAMILY_KEY, nextFontFamily);
  },
  setSqlEditorFontFamily: async (fontFamily) => {
    const nextFontFamily = normalizeFontFamily(fontFamily);
    applyFontFamilies({ ...activeFontFamilies, sqlEditorFontFamily: nextFontFamily });
    set({ sqlEditorFontFamily: nextFontFamily });
    await persistPreference(SQL_EDITOR_FONT_FAMILY_KEY, nextFontFamily);
  },
  setResultFontFamily: async (fontFamily) => {
    const nextFontFamily = normalizeFontFamily(fontFamily);
    applyFontFamilies({ ...activeFontFamilies, resultFontFamily: nextFontFamily });
    set({ resultFontFamily: nextFontFamily });
    await persistPreference(RESULT_FONT_FAMILY_KEY, nextFontFamily);
  },
  setInterfaceFontSize: async (fontSize) => {
    const nextFontSize = normalizeFontSize(fontSize, DEFAULT_INTERFACE_FONT_SIZE);
    applyFontSizes({ ...activeFontSizes, interfaceFontSize: nextFontSize });
    set({ interfaceFontSize: nextFontSize });
    await persistPreference(INTERFACE_FONT_SIZE_KEY, nextFontSize);
  },
  setSqlEditorFontSize: async (fontSize) => {
    const nextFontSize = normalizeFontSize(fontSize, DEFAULT_SQL_EDITOR_FONT_SIZE);
    applyFontSizes({ ...activeFontSizes, sqlEditorFontSize: nextFontSize });
    set({ sqlEditorFontSize: nextFontSize });
    await persistPreference(SQL_EDITOR_FONT_SIZE_KEY, nextFontSize);
  },
  setResultFontSize: async (fontSize) => {
    const nextFontSize = normalizeFontSize(fontSize, DEFAULT_RESULT_FONT_SIZE);
    applyFontSizes({ ...activeFontSizes, resultFontSize: nextFontSize });
    set({ resultFontSize: nextFontSize });
    await persistPreference(RESULT_FONT_SIZE_KEY, nextFontSize);
  },
  toggleSidebar: async () => {
    const sidebarOpen = !get().sidebarOpen;
    set({ sidebarOpen });
    const store = await getThemeStore();
    await store.set(SIDEBAR_KEY, sidebarOpen);
    await store.save();
  },
}));
