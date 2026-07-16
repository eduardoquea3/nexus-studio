import { getCurrentWindow } from "@tauri-apps/api/window";
import { RiCloseLine, RiMoonLine, RiSubtractLine, RiSunLine } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { useThemeStore } from "../store/theme-store";

export function TitleBar() {
  const { theme, toggle } = useThemeStore();

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
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={handleClose}
            className="rounded-md bg-muted/70 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
            aria-label="Close"
          >
            <RiCloseLine size={11} />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={handleMinimize}
            className="rounded-md bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Minimize"
          >
            <RiSubtractLine size={11} />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={handleMaximize}
            className="rounded-md bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Maximize"
          >
            <RiCloseLine size={11} className="rotate-45" />
          </Button>
        </div>
      </div>
    </header>
  );
}
