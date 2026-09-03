import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";

import { CommandBar } from "@/app/command-bar/command-bar";
import { describeConnection, type CommandBarItem } from "@/app/command-bar/command-bar-utils";
import { useConnections } from "@/app/home/hooks/use-connections";
import { markConnectionOpened } from "@/app/home/services/connection-service";
import { toast } from "@/components/ui/toast";
import { testSavedConnection } from "@/shared/lib/tauriApi";

type HomeCommandBarProps = {
  activeConnectionId: string | null;
  onOpenChange?: (isOpen: boolean) => void;
};

export function HomeCommandBar({ activeConnectionId, onOpenChange }: HomeCommandBarProps) {
  const { data: connections = [], isLoading, isFetching } = useConnections();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [switchingConnectionIds, setSwitchingConnectionIds] = useState<ReadonlySet<string>>(new Set());
  const switchingConnectionIdsRef = useRef(new Set<string>());
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const commandBarItems: CommandBarItem[] = connections.map((connection) => ({
    id: `connection:${connection.id}`,
    kind: "connection",
    label: connection.name,
    detail: describeConnection(connection),
    isActive: connection.id === activeConnectionId,
    connection,
  }));

  const closeCommandBar = () => {
    setIsOpen(false);
    requestAnimationFrame(() => {
      if (restoreFocusRef.current?.isConnected) {
        restoreFocusRef.current.focus();
      }
    });
  };

  const openCommandBar = () => {
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setIsOpen(true);
  };

  const switchConnection = async (profile: (typeof connections)[number]) => {
    if (switchingConnectionIdsRef.current.has(profile.id)) {
      return;
    }

    switchingConnectionIdsRef.current.add(profile.id);
    setSwitchingConnectionIds((current) => new Set(current).add(profile.id));
    const toastId = toast.add({
      title: "Checking connection...",
      type: "loading",
      description: `Testing ${profile.name}`,
      timeout: 0,
    });

    try {
      const message = await testSavedConnection(profile);
      toast.update(toastId, {
        title: "Connection successful",
        type: "success",
        description: message,
        timeout: 5000,
      });
      await markConnectionOpened(profile.id);
      await navigate({ to: "/connections/$connectionId", params: { connectionId: profile.id } });
      closeCommandBar();
    } catch (error: unknown) {
      toast.update(toastId, {
        title: "Connection failed",
        type: "error",
        description: String(error),
        timeout: 5000,
      });
    } finally {
      switchingConnectionIdsRef.current.delete(profile.id);
      setSwitchingConnectionIds((current) => {
        const next = new Set(current);
        next.delete(profile.id);
        return next;
      });
    }
  };

  useEffect(() => {
    onOpenChange?.(isOpen);
  }, [isOpen, onOpenChange]);

  useEffect(() => {
    const handleGlobalKeyDown = (event: globalThis.KeyboardEvent) => {
      if (!event.ctrlKey && !event.metaKey || event.altKey || event.key.toLowerCase() !== "p") {
        return;
      }
      if (!isOpen) {
        event.preventDefault();
        event.stopPropagation();
        openCommandBar();
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown, true);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown, true);
  }, [isOpen]);

  return isOpen ? (
    <CommandBar
      mode="palette"
      items={commandBarItems}
      onClose={closeCommandBar}
      onSelect={() => undefined}
      onConnectionSelect={(profile) => void switchConnection(profile)}
      groups={["connections"]}
      isLoading={switchingConnectionIds.size > 0 || isLoading || isFetching}
    />
  ) : null;
}
