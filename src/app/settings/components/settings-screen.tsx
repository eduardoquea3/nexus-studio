import { useRouter } from "@tanstack/react-router";
import {
  RiArrowLeftLine,
  RiComputerLine,
  RiContrast2Line,
  RiLayoutLeftLine,
  RiMenuLine,
  RiMoonLine,
  RiSettings3Line,
  RiSunLine,
} from "@remixicon/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useThemeStore } from "@/shared/store/theme-store";

const sections = [
  { label: "Appearance", description: "Theme and interface", icon: RiContrast2Line },
  { label: "Workspace", description: "Editor preferences", icon: RiLayoutLeftLine },
] as const;

export function SettingsScreen() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { theme, setTheme } = useThemeStore();

  const goBack = () => {
    if (router.history.canGoBack()) {
      router.history.back();
      return;
    }
    void router.navigate({ to: "/" });
  };

  return (
    <div className="relative flex h-full min-h-0 bg-background text-foreground">
      {sidebarOpen ? (
        <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-surface">
          <ScrollArea className="min-h-0 flex-1">
            <div className="p-4">
              <div className="mb-8 flex items-center gap-2 px-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="shrink-0"
                  onClick={() => setSidebarOpen(false)}
                  aria-label="Hide settings sidebar"
                  title="Hide settings sidebar"
                >
                  <RiLayoutLeftLine aria-hidden="true" />
                </Button>
                <div className="flex size-8 items-center justify-center rounded-md bg-primary/15 text-primary">
                  <RiSettings3Line className="size-4" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-label text-sm font-semibold tracking-tight">Nexus Studio</p>
                  <p className="text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground">Settings</p>
                </div>
              </div>
              <nav aria-label="Settings sections" className="space-y-1">
                <p className="mb-3 px-2 text-[0.65rem] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Configure
                </p>
                {sections.map((section, index) => {
                  const Icon = section.icon;
                  return (
                    <button
                      key={section.label}
                      type="button"
                      className={cn(
                        "flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                        index === 0
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                      aria-current={index === 0 ? "page" : undefined}
                    >
                      <Icon className="size-4 shrink-0" aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="block text-xs font-medium">{section.label}</span>
                        <span className="block truncate text-[0.65rem] text-muted-foreground">{section.description}</span>
                      </span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </ScrollArea>
          <div className="border-t border-border p-4">
            <p className="px-2 text-[0.65rem] text-muted-foreground">Nexus Studio 0.1</p>
          </div>
        </aside>
      ) : null}

      <ScrollArea className="min-w-0 flex-1">
        <div className="mx-auto min-h-full w-full max-w-4xl px-5 py-6 sm:px-8 sm:py-8">
          <header className="mb-8 flex items-start gap-4 border-b border-border pb-6">
            <div className="flex items-start gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="mt-0.5 shrink-0"
                onClick={goBack}
                aria-label="Go back"
                title="Go back"
              >
                <RiArrowLeftLine aria-hidden="true" />
              </Button>
              <div className="min-w-0">
                <div className="mb-2 flex items-center gap-2">
                  <p className="font-label text-[0.65rem] font-medium uppercase tracking-[0.18em] text-primary">Control room</p>
                  {!sidebarOpen ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => setSidebarOpen(true)}
                      aria-label="Show settings sidebar"
                      title="Show settings sidebar"
                    >
                      <RiMenuLine aria-hidden="true" />
                    </Button>
                  ) : null}
                </div>
                <h1 className="text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">Settings</h1>
                <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                  Tune the workspace around the way you inspect and shape your data.
                </p>
              </div>
            </div>
          </header>

          <main className="space-y-8">
            <section aria-labelledby="appearance-heading">
              <div className="mb-4">
                <h2 id="appearance-heading" className="text-base font-semibold">Appearance</h2>
                <p className="mt-1 text-sm text-muted-foreground">Set the visual environment for long database sessions.</p>
              </div>
              <div className="rounded-lg border border-border bg-card">
                <div className="border-b border-border px-4 py-4 sm:px-5">
                  <p className="text-sm font-medium">Theme</p>
                  <p className="mt-1 text-xs text-muted-foreground">Choose the surface contrast that suits your workspace.</p>
                </div>
                <div className="grid gap-3 p-4 sm:grid-cols-3 sm:p-5">
                  <ThemeOption icon={RiMoonLine} label="Dark" value="dark" selected={theme === "dark"} onSelect={() => void setTheme("dark")} />
                  <ThemeOption icon={RiSunLine} label="Light" value="light" selected={theme === "light"} onSelect={() => void setTheme("light")} />
                  <ThemeOption icon={RiComputerLine} label="System" value="system" selected={false} onSelect={() => undefined} disabled />
                </div>
              </div>
            </section>

            <section aria-labelledby="workspace-heading">
              <div className="mb-4">
                <h2 id="workspace-heading" className="text-base font-semibold">Workspace</h2>
                <p className="mt-1 text-sm text-muted-foreground">Keep the interface quiet so the schema stays in focus.</p>
              </div>
              <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface px-4 py-4 sm:px-5">
                <div>
                  <p className="text-sm font-medium">Explorer sidebar</p>
                  <p className="mt-1 text-xs text-muted-foreground">Use Ctrl+B inside a connection to toggle the database explorer.</p>
                </div>
                <span className="shrink-0 rounded-sm bg-muted px-2 py-1 font-mono text-[0.65rem] text-muted-foreground">Ctrl+B</span>
              </div>
            </section>
          </main>
        </div>
      </ScrollArea>
    </div>
  );
}

type ThemeOptionProps = {
  icon: typeof RiMoonLine;
  label: string;
  value: string;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
};

function ThemeOption({ icon: Icon, label, value, selected, onSelect, disabled }: ThemeOptionProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex min-h-20 items-center gap-3 rounded-md border border-border bg-control px-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        selected ? "border-primary/70 bg-accent text-accent-foreground" : "hover:bg-muted",
        disabled && "cursor-not-allowed opacity-45",
      )}
    >
      <Icon className={cn("size-4", selected ? "text-primary" : "text-muted-foreground")} aria-hidden="true" />
      <span>
        <span className="block text-xs font-medium">{label}</span>
        <span className="mt-0.5 block font-mono text-[0.6rem] uppercase tracking-wider text-muted-foreground">{value}</span>
      </span>
    </button>
  );
}
