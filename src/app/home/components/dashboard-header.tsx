import { RiAddLine, RiDatabaseLine } from "@remixicon/react";

import { Button } from "@/components/ui/button";

type DashboardHeaderProps = {
  onNewConnection: () => void;
};

export function DashboardHeader({ onNewConnection }: DashboardHeaderProps) {
  return (
    <header className="flex items-center justify-between gap-6 border-b border-border/60 pb-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <RiDatabaseLine size={15} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-[-0.02em]">Nexus Studio</p>
          <p className="font-label text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
            DB Manager
          </p>
        </div>
      </div>

      <Button className="h-9 rounded-md px-3 text-xs" onClick={onNewConnection}>
        <RiAddLine size={15} aria-hidden="true" />
        New connection
        <kbd className="ml-1 rounded-sm border border-primary-foreground/25 px-1 py-0.5 font-mono text-[9px] font-medium text-primary-foreground/80">
          Ctrl N
        </kbd>
      </Button>
    </header>
  );
}
