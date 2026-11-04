import {
  RiCloseLine,
  RiDatabase2Line,
  RiMoonLine,
  RiSettings3Line,
  RiSubtractLine,
  RiSunLine,
} from "@remixicon/react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { getCurrentWindow } from "@tauri-apps/api/window";

import type { ConnectionProfile } from "@/shared/types/models";

import { useConnection } from "@/app/home/hooks/use-connections";
import { Button } from "@/components/ui/button";

import { useThemeStore } from "../store/theme-store";

export function TitleBar() {
  const connectionId = useRouterState({
    select: (state) => {
      const match = state.matches.find(
        (candidate) => candidate.routeId === "/connections/$connectionId",
      );
      return match && "connectionId" in match.params ? match.params.connectionId : null;
    },
  });

  return connectionId ? <ConnectionTitleBar connectionId={connectionId} /> : <TitleBarContent />;
}

function ConnectionTitleBar({ connectionId }: { connectionId: string }) {
  const { data: profile } = useConnection(connectionId, { enabled: false });
  return <TitleBarContent profile={profile} />;
}

function TitleBarContent({ profile }: { profile?: ConnectionProfile | null }) {
  const navigate = useNavigate();
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
    <header className="flex h-10 select-none items-center justify-between border-b border-border bg-background pl-3">
      <div
        data-tauri-drag-region
        className="flex h-full min-w-0 flex-1 items-center gap-3 text-sm font-medium text-muted-foreground"
      >
        {profile ? (
          <>
            <div className="flex shrink-0 items-center gap-2 font-mono text-[0.66rem] font-semibold tracking-[0.12em] text-foreground">
              <RiDatabase2Line className="size-4 text-violet-400" aria-hidden="true" />
              <span>NEXUS STUDIO</span>
            </div>
            <span className="h-4 w-px shrink-0 bg-border" aria-hidden="true" />
            <div className="flex min-w-0 items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/[0.08] px-2.5 py-1 text-[0.65rem] text-emerald-300">
              <span className="size-1.5 shrink-0 rounded-full bg-emerald-400" aria-hidden="true" />
              <span className="truncate">{profile.name}</span>
              <span className="hidden text-emerald-200/60 sm:inline">· {profile.db_type}</span>
            </div>
          </>
        ) : (
          <span>Nexus Studio</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            void toggle();
          }}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          aria-label={theme.mode === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          aria-pressed={theme.mode === "dark"}
          title={theme.mode === "dark" ? "Switch to light theme" : "Switch to dark theme"}
        >
          {theme.mode === "dark" ? <RiSunLine size={16} /> : <RiMoonLine size={16} />}
        </button>
        <button
          type="button"
          onClick={() => void navigate({ to: "/settings" })}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          aria-label="Open settings"
          title="Settings"
        >
          <RiSettings3Line size={16} />
        </button>

        <div className="flex h-10 items-stretch gap-0">
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={handleMinimize}
            className="h-10 w-12 rounded-none bg-transparent p-0 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Minimize"
          >
            <RiSubtractLine size={11} />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={handleMaximize}
            className="h-10 w-12 rounded-none bg-transparent p-0 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Maximize"
          >
            <RiCloseLine size={11} className="rotate-45" />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={handleClose}
            className="h-10 w-12 rounded-none bg-transparent p-0 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
            aria-label="Close"
          >
            <RiCloseLine size={11} />
          </Button>
        </div>
      </div>
    </header>
  );
}
