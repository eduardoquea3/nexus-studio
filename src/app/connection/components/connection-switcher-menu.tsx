import {
  RiArrowLeftRightLine,
  RiDatabase2Line,
  RiEditLine,
  RiLogoutBoxLine,
} from "@remixicon/react";
import { useNavigate } from "@tanstack/react-router";

import type { ConnectionProfile } from "@/shared/types/models";

import { markConnectionOpened } from "@/app/home/services/connection-service";
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

type ConnectionSwitcherMenuProps = {
  profile: ConnectionProfile;
  connections: ConnectionProfile[];
  openModal: (modal: string, payload?: unknown) => void;
};

export function ConnectionSwitcherMenu({
  profile,
  connections,
  openModal,
}: ConnectionSwitcherMenuProps) {
  const navigate = useNavigate();
  const sorted = connections
    .filter((connection) => connection.id !== profile.id)
    .sort((left, right) => (right.last_opened_at ?? 0) - (left.last_opened_at ?? 0));
  const switchConnection = async (connectionId: string) => {
    await markConnectionOpened(connectionId);
    await navigate({ to: "/connections/$connectionId", params: { connectionId } });
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-full w-full items-center gap-2 rounded-none border-0 bg-card px-3 py-1 text-left text-xs transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <RiDatabase2Line className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">{profile.name}</span>
          <RiArrowLeftRightLine
            className="size-3.5 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="max-h-none w-56 overflow-y-hidden">
        <DropdownMenuItem variant="destructive" onSelect={() => void navigate({ to: "/" })}>
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
        {sorted.length > 0 ? (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <RiArrowLeftRightLine />
              Switch Connection
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-56">
              <DropdownMenuLabel>Recent Connections</DropdownMenuLabel>
              {sorted.slice(0, 4).map((connection) => (
                <DropdownMenuItem
                  key={connection.id}
                  onSelect={() => void switchConnection(connection.id)}
                >
                  <RiDatabase2Line />
                  <span className="truncate">{connection.name}</span>
                </DropdownMenuItem>
              ))}
              {sorted.length > 4 ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>More Connections</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-56">
                      {sorted.slice(4).map((connection) => (
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
  );
}
