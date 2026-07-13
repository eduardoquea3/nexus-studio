import { load } from "@tauri-apps/plugin-store";
import { create } from "zustand";

type Theme = "light" | "dark";

interface ThemeState {
  theme: Theme;
  toggle: () => Promise<void>;
  setTheme: (t: Theme) => Promise<void>;
}

const STORE_PATH = "theme.json";
const THEME_KEY = "theme";

let themeStorePromise: Promise<Awaited<ReturnType<typeof load>>> | null = null;

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

async function getThemeStore() {
  themeStorePromise ??= load(STORE_PATH, {
    autoSave: false,
    defaults: { [THEME_KEY]: "dark" },
  });
  return themeStorePromise;
}

async function persistTheme(theme: Theme) {
  const store = await getThemeStore();
  await store.set(THEME_KEY, theme);
  await store.save();
}

export async function initThemeStore() {
  const store = await getThemeStore();
  const savedTheme = await store.get<Theme>(THEME_KEY);
  const theme = savedTheme === "light" || savedTheme === "dark" ? savedTheme : "dark";

  applyTheme(theme);
  useThemeStore.setState({ theme });
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: "dark",
  toggle: async () => {
    const next = get().theme === "light" ? "dark" : "light";
    applyTheme(next);
    set({ theme: next });
    await persistTheme(next);
  },
  setTheme: async (theme) => {
    applyTheme(theme);
    set({ theme });
    await persistTheme(theme);
  },
}));
