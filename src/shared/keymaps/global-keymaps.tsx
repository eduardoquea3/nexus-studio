import { useHotkeys } from "react-hotkeys-hook";
import { useEffect } from "react";

import { useThemeStore } from "@/shared/store/theme-store";

export function GlobalKeymaps() {
  const toggleSidebar = useThemeStore((state) => state.toggleSidebar);

  useEffect(() => {
    const preventWebviewReload = (event: globalThis.KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "r") {
        event.preventDefault();
      }
    };

    window.addEventListener("keydown", preventWebviewReload, true);
    return () => window.removeEventListener("keydown", preventWebviewReload, true);
  }, []);

  useHotkeys(
    "ctrl+b",
    (event) => {
      event.preventDefault();
      void toggleSidebar();
    },
    {
      enableOnContentEditable: true,
      enableOnFormTags: true,
      preventDefault: true,
    },
    [toggleSidebar],
  );

  return null;
}
