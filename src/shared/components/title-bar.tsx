import { getCurrentWindow } from "@tauri-apps/api/window";
import { RiCloseLine, RiMoonLine, RiSubtractLine, RiSunLine } from "@remixicon/react";
import { useState } from "react";
import { useThemeStore } from "../store/theme-store";

export function TitleBar() {
  const { theme, toggle } = useThemeStore();
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);

  async function handleMinimize() {
    const win = getCurrentWindow();
    await win.minimize();
  }

  async function handleMaximize() {
    const win = getCurrentWindow();
    await win.toggleMaximize();
  }

  async function handleClose() {
    const win = getCurrentWindow();
    await win.close();
  }

  return (
    <header
      data-tauri-drag-region
      className="flex h-10 select-none items-center justify-between border-b border-border bg-background px-3"
    >
      <span className="text-sm font-medium text-muted-foreground">Nexus Studio</span>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            void toggle();
          }}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <RiSunLine size={16} /> : <RiMoonLine size={16} />}
        </button>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleClose}
            onMouseEnter={() => setHoveredButton("close")}
            onMouseLeave={() => setHoveredButton(null)}
            className="relative flex h-3 w-3 items-center justify-center rounded-full bg-red-500"
            aria-label="Close"
          >
            {hoveredButton === "close" && <RiCloseLine size={10} className="text-red-900" />}
          </button>
          <button
            type="button"
            onClick={handleMinimize}
            onMouseEnter={() => setHoveredButton("minimize")}
            onMouseLeave={() => setHoveredButton(null)}
            className="relative flex h-3 w-3 items-center justify-center rounded-full bg-yellow-500"
            aria-label="Minimize"
          >
            {hoveredButton === "minimize" && (
              <RiSubtractLine size={10} className="text-yellow-900" />
            )}
          </button>
          <button
            type="button"
            onClick={handleMaximize}
            onMouseEnter={() => setHoveredButton("maximize")}
            onMouseLeave={() => setHoveredButton(null)}
            className="relative flex h-3 w-3 items-center justify-center rounded-full bg-green-500"
            aria-label="Maximize"
          >
            {hoveredButton === "maximize" && (
              <RiCloseLine size={10} className="rotate-45 text-green-900" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
