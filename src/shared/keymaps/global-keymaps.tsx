import { useHotkeys } from "react-hotkeys-hook";

import { useThemeStore } from "@/shared/store/theme-store";

export function GlobalKeymaps() {
  const toggleSidebar = useThemeStore((state) => state.toggleSidebar);

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
