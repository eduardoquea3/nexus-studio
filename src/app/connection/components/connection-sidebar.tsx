import { useNavigate } from "@tanstack/react-router";
import {
  RiArrowLeftRightLine,
  RiDatabase2Line,
  RiEditLine,
  RiEyeLine,
  RiFunctionLine,
  RiGitBranchLine,
  RiLogoutBoxLine,
  RiTableLine,
} from "@remixicon/react";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/animate-ui/components/radix/dropdown-menu";
import {
  FileItem,
  Files,
  FolderContent,
  FolderItem,
  FolderTrigger,
} from "@/components/animate-ui/components/radix/files";
import { useDatabases } from "@/app/connection/hooks/use-databases";
import { useSchemaObjects } from "@/app/connection/hooks/use-schema-objects";
import { useConnections } from "@/app/home/hooks/use-connections";
import { getInitialDatabase } from "@/app/connection/services/database-service";
import { markConnectionOpened } from "@/app/home/services/connection-service";
import { Select } from "@/shared/components/ui/select";
import { useModalStore } from "@/shared/store/modalStore";
import { useThemeStore } from "@/shared/store/theme-store";
import type { ConnectionProfile } from "@/shared/types/models";
import { cn } from "@/lib/utils";

type ConnectionSidebarProps = {
  profile: ConnectionProfile;
  selectedDatabase: string;
  onDatabaseChange: (database: string) => void;
  onTableSelect: (table: string) => void;
};

type DatabaseOption = {
  value: string;
  label: string;
};

const explorerGroups = [
  {
    id: "tables",
    label: "Tables",
    objectType: "table",
    emptyLabel: "No tables found",
    icon: RiTableLine,
  },
  {
    id: "views",
    label: "Views",
    objectType: "view",
    emptyLabel: "No views found",
    icon: RiEyeLine,
  },
  {
    id: "functions",
    label: "Functions",
    objectType: "function",
    emptyLabel: "No functions found",
    icon: RiFunctionLine,
  },
  {
    id: "procedures",
    label: "Procedures",
    objectType: "procedure",
    emptyLabel: "No procedures found",
    icon: RiGitBranchLine,
  },
] as const;

export function ConnectionSidebar({
  profile,
  selectedDatabase,
  onDatabaseChange,
  onTableSelect,
}: ConnectionSidebarProps) {
  const navigate = useNavigate();
  const openModal = useModalStore((state) => state.openModal);
  const initialDatabase = getInitialDatabase(profile);
  const {
    data: databaseValues = [],
    error: databaseError,
    isLoading: isLoadingDatabases,
  } = useDatabases(profile);
  const {
    data: schemaObjects = [],
    error: schemaError,
    isLoading: isLoadingSchema,
  } = useSchemaObjects(profile, selectedDatabase);
  const { data: connections = [] } = useConnections();
  const databases = Array.from(
    new Set(initialDatabase ? [initialDatabase, ...databaseValues] : databaseValues),
  ).map((value) => ({ value, label: value }));
  const sidebarOpen = useThemeStore((state) => state.sidebarOpen);
  const engine = profile.db_type === "postgres" ? "postgresql" : profile.db_type;
  const endpoint =
    profile.connect_mode.type === "fields"
      ? `${profile.connect_mode.host}:${profile.connect_mode.port}`
      : profile.connect_mode.value;
  const sortedConnections = connections
    .filter((connection) => connection.id !== profile.id)
    .sort((left, right) => (right.last_opened_at ?? 0) - (left.last_opened_at ?? 0));
  const recentConnections = sortedConnections.slice(0, 4);
  const otherConnections = sortedConnections.slice(4);

  const switchConnection = async (connectionId: string) => {
    await markConnectionOpened(connectionId);
    await navigate({ to: "/connections/$connectionId", params: { connectionId } });
  };

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
              onDatabaseChange(option.value);
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
      <ScrollArea className="min-h-0 flex-1 overflow-hidden [&_[data-slot=scroll-area-scrollbar]]:hidden">
        <div className="min-w-0 p-3">
          <p className="px-2 py-2 text-[0.65rem] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Explorer
          </p>
          <Files defaultOpen={["tables"]} className="min-w-0 p-0">
            {explorerGroups.map((group) => {
              const objects = schemaObjects.filter(
                (object) => object.object_type === group.objectType,
              );

              return (
                <FolderItem key={group.id} value={group.id}>
                  <FolderTrigger icon={group.icon} className="text-xs">
                    <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2">
                        <span>{group.label}</span>
                      </span>
                      <span className="text-[0.65rem] text-muted-foreground">{objects.length}</span>
                    </span>
                  </FolderTrigger>
                  <FolderContent>
                    {isLoadingSchema ? (
                      <p className="px-2 py-1 text-[0.65rem] text-muted-foreground">Loading...</p>
                    ) : schemaError ? (
                      <p className="px-2 py-1 text-[0.65rem] text-destructive">Unable to load objects</p>
                    ) : objects.length === 0 ? (
                      <p className="px-2 py-1 text-[0.65rem] text-muted-foreground">{group.emptyLabel}</p>
                    ) : (
                      objects.map((object) => (
                        <FileItem
                          key={object.name}
                          icon={group.icon}
                          className={cn(
                            "text-xs",
                            group.objectType === "table" && "cursor-pointer hover:text-foreground",
                          )}
                          onClick={
                            group.objectType === "table"
                              ? () => onTableSelect(object.name)
                              : undefined
                          }
                        >
                          {object.name}
                        </FileItem>
                      ))
                    )}
                  </FolderContent>
                </FolderItem>
              );
            })}
          </Files>
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
          <DropdownMenuContent
            side="top"
            align="start"
            className="max-h-none w-56 overflow-y-hidden"
          >
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
            {sortedConnections.length > 0 ? (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <RiArrowLeftRightLine />
                  Switch Connection
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-56">
                  <DropdownMenuLabel>Recent Connections</DropdownMenuLabel>
                  {recentConnections.map((connection) => (
                    <DropdownMenuItem
                      key={connection.id}
                      onSelect={() => void switchConnection(connection.id)}
                    >
                      <RiDatabase2Line />
                      <span className="truncate">{connection.name}</span>
                    </DropdownMenuItem>
                  ))}
                  {otherConnections.length > 0 ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger>More Connections</DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="w-56">
                          {otherConnections.map((connection) => (
                            <DropdownMenuItem
                              key={connection.id}
                              onSelect={() => void switchConnection(connection.id)}
                            >
                              <RiDatabase2Line />
                              <span className="truncate">{connection.name}</span>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                    </>
                  ) : null}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            ) : null}
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
