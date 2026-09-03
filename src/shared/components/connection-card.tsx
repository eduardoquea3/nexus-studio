import {
  RiCheckLine,
  RiClipboardLine,
  RiDeleteBinLine,
  RiLockLine,
  RiPencilLine,
  RiShieldLine,
} from "@remixicon/react";
import { MySQLDark, PostgreSQL, SQLite } from "@ridemountainpig/svgl-react";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type ConnectionItem = {
  id: string;
  name: string;
  engine: "postgresql" | "mysql" | "sqlite";
  sshEnabled: boolean;
  sslEnabled: boolean;
  connectionString?: string;
  copyConnectionString?: string;
  connectionStringLabel?: string;
  searchValues: string[];
  metadata: { label: string; value: string }[];
  lastOpenedAt?: number;
};

type ConnectionCardProps = {
  connection: ConnectionItem;
  onEdit?: () => void;
  onDelete?: () => void;
  onOpen?: () => Promise<boolean>;
};

export function ConnectionCard({ connection, onEdit, onDelete, onOpen }: ConnectionCardProps) {
  const navigate = useNavigate();
  const [isOpening, setIsOpening] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const EngineIcon = connectionTypeIcons[connection.engine];
  const connectionString = connection.connectionString;

  const handleOpen = async () => {
    if (isOpening) {
      return;
    }

    setIsOpening(true);
    try {
      const canOpen = await onOpen?.();
      if (canOpen === false) {
        return;
      }

      await navigate({
        to: "/connections/$connectionId",
        params: { connectionId: connection.id },
      });
    } finally {
      setIsOpening(false);
    }
  };

  const handleCopy = async (connectionString: string) => {
    await navigator.clipboard.writeText(connectionString);
    setIsCopied(true);
    window.setTimeout(() => setIsCopied(false), 1500);
  };

  return (
    <Card
      role="button"
      tabIndex={0}
      aria-label={`Open ${connection.name}`}
      className="group relative flex h-full min-h-0 cursor-pointer select-none flex-col overflow-hidden rounded-md border border-border/70 bg-card py-2 transition-[border-color,background,transform] duration-200 hover:-translate-y-0.5 hover:border-foreground/25 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      onDoubleClick={() => void handleOpen()}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) {
          return;
        }

        if (event.key === "Enter") {
          void handleOpen();
        } else if (event.key === " ") {
          event.preventDefault();
          void handleOpen();
        }
      }}
    >
      <div className="absolute inset-y-0 left-0 w-0.5 bg-primary/80" />

      <CardHeader className="gap-2 px-4 py-2 pl-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-primary transition-colors group-hover:border-primary/30">
              <EngineIcon className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="font-label mb-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary/85">
                {connection.engine}
              </p>
              <CardTitle className="truncate text-base tracking-[-0.025em]">
                {connection.name}
              </CardTitle>
            </div>
          </div>

          <CardAction className="flex items-center gap-0.5 self-start opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:bg-primary/10 hover:text-primary"
              aria-label={`Edit ${connection.name}`}
              onClick={(event) => {
                event.stopPropagation();
                onEdit?.();
              }}
            >
              <RiPencilLine size={18} />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              aria-label={`Delete ${connection.name}`}
              onClick={(event) => {
                event.stopPropagation();
                onDelete?.();
              }}
            >
              <RiDeleteBinLine size={18} />
            </Button>
          </CardAction>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-2 px-4 pb-2 pl-5">
        {connection.metadata.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 border-t border-border/50 pt-2">
            {connection.metadata.map((item) => (
              <div key={item.label} className="min-w-0">
                <p className="font-label text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {item.label}
                </p>
                <p
                  className="mt-1 truncate font-mono text-[11px] text-card-foreground/80"
                >
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        ) : null}
        {connectionString ? (
          <div className="border-t border-border/50 pt-2">
            <p className="font-label text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {connection.connectionStringLabel ?? "Connection string"}
            </p>
            <div className="mt-1 flex min-w-0 items-center gap-2 rounded-sm bg-muted/70 px-2 py-1">
              <p className="min-w-0 flex-1 truncate font-mono text-[11px] text-card-foreground/90">
                {connectionString}
              </p>
              <Button
                variant="ghost"
                size="icon-xs"
                className="shrink-0 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                aria-label={isCopied ? "Connection string copied" : `Copy connection string for ${connection.name}`}
                onClick={(event) => {
                  event.stopPropagation();
                  void handleCopy(connection.copyConnectionString ?? connectionString);
                }}
              >
                {isCopied ? <RiCheckLine size={14} /> : <RiClipboardLine size={14} />}
              </Button>
            </div>
          </div>
        ) : null}
        {connection.sshEnabled || connection.sslEnabled ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
            {connection.sshEnabled ? (
              <span className="inline-flex items-center gap-1">
                <RiShieldLine size={12} aria-hidden="true" />
                SSH
              </span>
            ) : null}
            {connection.sslEnabled ? (
              <span className="inline-flex items-center gap-1">
                <RiLockLine size={12} aria-hidden="true" />
                SSL
              </span>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

const connectionTypeIcons = {
  mysql: MySQLDark,
  postgresql: PostgreSQL,
  sqlite: SQLite,
} satisfies Record<ConnectionItem["engine"], typeof PostgreSQL>;
