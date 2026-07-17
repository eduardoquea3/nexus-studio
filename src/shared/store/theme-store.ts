import { load } from "@tauri-apps/plugin-store";
import { create } from "zustand";

type Theme = "light" | "dark";

interface ThemeState {
  theme: Theme;
  sidebarOpen: boolean;
  toggle: () => Promise<void>;
  setTheme: (t: Theme) => Promise<void>;
  toggleSidebar: () => Promise<void>;
}

const STORE_PATH = "theme.json";
const THEME_KEY = "theme";
const SIDEBAR_KEY = "sidebarOpen";

let themeStorePromise: Promise<Awaited<ReturnType<typeof load>>> | null = null;

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

async function getThemeStore() {
  themeStorePromise ??= load(STORE_PATH, {
    autoSave: false,
    defaults: { [THEME_KEY]: "dark", [SIDEBAR_KEY]: true },
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
  const savedSidebarOpen = await store.get<boolean>(SIDEBAR_KEY);
  const theme = savedTheme === "light" || savedTheme === "dark" ? savedTheme : "dark";
  const sidebarOpen = savedSidebarOpen ?? true;

  applyTheme(theme);
  useThemeStore.setState({ theme, sidebarOpen });
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: "dark",
  sidebarOpen: true,
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
  toggleSidebar: async () => {
    const sidebarOpen = !get().sidebarOpen;
    set({ sidebarOpen });
    const store = await getThemeStore();
    await store.set(SIDEBAR_KEY, sidebarOpen);
    await store.save();
  },
}));
