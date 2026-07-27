import { useNavigate } from "@tanstack/react-router";
import {
  RiArrowLeftRightLine,
  RiDatabase2Line,
  RiEditLine,
  RiLogoutBoxLine,
  RiTableLine,
} from "@remixicon/react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/animate-ui/components/radix/dropdown-menu";
import { useDatabases } from "@/app/connection/hooks/use-databases";
import { getInitialDatabase } from "@/app/connection/services/database-service";
import { Select } from "@/shared/components/ui/select";
import { useModalStore } from "@/shared/store/modalStore";
import { useThemeStore } from "@/shared/store/theme-store";
import type { ConnectionProfile } from "@/shared/types/models";
import { cn } from "@/lib/utils";

type ConnectionSidebarProps = {
  profile: ConnectionProfile;
};

type DatabaseOption = {
  value: string;
  label: string;
};

export function ConnectionSidebar({ profile }: ConnectionSidebarProps) {
  const navigate = useNavigate();
  const openModal = useModalStore((state) => state.openModal);
  const initialDatabase = getInitialDatabase(profile);
  const [selectedDatabase, setSelectedDatabase] = useState(initialDatabase);
  const {
    data: databaseValues = [],
    error: databaseError,
    isLoading: isLoadingDatabases,
  } = useDatabases(profile);
  const databases = Array.from(
    new Set(initialDatabase ? [initialDatabase, ...databaseValues] : databaseValues),
  ).map((value) => ({ value, label: value }));
  const sidebarOpen = useThemeStore((state) => state.sidebarOpen);
  const engine = profile.db_type === "postgres" ? "postgresql" : profile.db_type;
  const endpoint =
    profile.connect_mode.type === "fields"
      ? `${profile.connect_mode.host}:${profile.connect_mode.port}`
      : profile.connect_mode.value;

  useEffect(() => {
    setSelectedDatabase(initialDatabase);
  }, [initialDatabase, profile.id]);

  return (
    <aside
      className={cn(
        "w-60 shrink-0 border-r border-border/70 bg-muted/10",
        sidebarOpen ? "flex flex-col" : "hidden",
      )}
    >
      <div className="border-b border-border/70 px-4 py-4">
        <div className="flex items-center gap-2">
          <RiDatabase2Line className="size-4 shrink-0 text-primary" />
          <h1 className="truncate text-sm font-semibold tracking-tight">{profile.name}</h1>
          <Badge variant="outline" className="text-[0.65rem] uppercase tracking-wider">
            {engine}
          </Badge>
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">{endpoint}</p>
      </div>
      <div className="border-b border-border/70 px-4 py-4">
        <p className="text-[0.65rem] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Database
        </p>
        <Select
          options={databases}
          value={databases.find((option) => option.value === selectedDatabase) ?? null}
          onValueChange={(option) => {
            if (option) {
              setSelectedDatabase(option.value);
            }
          }}
          valueKey="value"
          labelKey="label"
          render={renderDatabaseOption}
          placeholder={
            isLoadingDatabases
              ? "Loading databases..."
              : databaseError
                ? "Database unavailable"
                : "Select database"
          }
          isLoading={isLoadingDatabases}
          className="mt-1 h-8 w-full text-xs"
          disabled={databases.length === 0 || isLoadingDatabases}
        />
        {databaseError ? (
          <p className="mt-2 text-[0.65rem] text-destructive">Database unavailable</p>
        ) : null}
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="p-3">
          <p className="px-2 py-2 text-[0.65rem] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Explorer
          </p>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <RiTableLine className="size-4" />
            Tables
            <span className="ml-auto text-[0.65rem]">0</span>
          </button>
          <p className="mt-6 px-2 text-xs leading-5 text-muted-foreground">
            Load the schema to browse tables and columns for this connection.
          </p>
        </div>
      </ScrollArea>
      <div className="border-t border-border/70 p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md border border-border/70 bg-card px-3 py-2 text-left text-xs transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <RiDatabase2Line className="size-4 shrink-0 text-primary" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{profile.name}</span>
              <RiArrowLeftRightLine
                className="size-3.5 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56">
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => void navigate({ to: "/" })}
            >
              <RiLogoutBoxLine />
              Disconnect
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                openModal("new-connection", { connectionId: profile.id });
                void navigate({ to: "/" });
              }}
            >
              <RiEditLine />
              Edit Connection
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void navigate({ to: "/" })}>
              <RiArrowLeftRightLine />
              Switch Connection
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}

function renderDatabaseOption(option: DatabaseOption) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <RiDatabase2Line className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
      <span className="truncate">{option.label}</span>
    </span>
  );
}
