import { useEffect } from "react";
import { useHotkeys } from "react-hotkeys-hook";

import { getShortcutBinding } from "@/shared/keymaps/shortcut-catalog";
import { useShortcutStore } from "@/shared/store/shortcut-store";
import { useThemeStore } from "@/shared/store/theme-store";

export const TOGGLE_MOBILE_SIDEBAR_EVENT = "nexus:toggle-mobile-sidebar";

export function GlobalKeymaps() {
  const toggleSidebar = useThemeStore((state) => state.toggleSidebar);
  const overrides = useShortcutStore((state) => state.overrides);
  const toggleSidebarBinding = getShortcutBinding("toggle-sidebar", overrides);

  useEffect(() => {
    const preventWebviewReload = (event: globalThis.KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "r") {
        event.preventDefault();
        event.stopImmediatePropagation();
      } else if (
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        event.key.toLowerCase() === "p"
      ) {
        event.preventDefault();
      }
    };

    window.addEventListener("keydown", preventWebviewReload, true);
    return () => window.removeEventListener("keydown", preventWebviewReload, true);
  }, []);

  useHotkeys(
    toggleSidebarBinding ?? "ctrl+b",
    (event) => {
      event.preventDefault();
      if (window.matchMedia?.("(max-width: 1023px)").matches) {
        window.dispatchEvent(new Event(TOGGLE_MOBILE_SIDEBAR_EVENT));
        return;
      }
      void toggleSidebar();
    },
    {
      enabled: toggleSidebarBinding !== null,
      enableOnContentEditable: true,
      enableOnFormTags: true,
      preventDefault: true,
    },
    [toggleSidebar, toggleSidebarBinding],
  );

  return null;
}
