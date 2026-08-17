import { RiDeleteBinLine, RiLockLine, RiPencilLine, RiShieldLine } from "@remixicon/react";
import { MySQLDark, PostgreSQL, SQLite } from "@ridemountainpig/svgl-react";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type ConnectionItem = {
  id: string;
  name: string;
  engine: "postgresql" | "mysql" | "sqlite";
  sshEnabled: boolean;
  sslEnabled: boolean;
  metadata: { label: string; value: string }[];
  status: { label: string; tone: "neutral" | "success" | "warning" };
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
  const EngineIcon = connectionTypeIcons[connection.engine];

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

  return (
    <Card
      role="button"
      tabIndex={0}
      aria-label={`Open ${connection.name}`}
      className="group relative min-h-44 cursor-pointer select-none overflow-hidden rounded-md border border-border/80 bg-surface transition-[border-color,background,transform] duration-200 hover:-translate-y-0.5 hover:border-foreground/30 hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
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
      <div className="absolute inset-y-0 left-0 w-0.5 bg-primary" />

      <CardHeader className="gap-4 px-4 py-4 pl-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
              <EngineIcon className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="font-label mb-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {connection.engine}
              </p>
              <CardTitle className="truncate text-[15px] tracking-[-0.02em]">
                {connection.name}
              </CardTitle>
            </div>
          </div>

          <CardAction className="flex items-center gap-1 self-start">
            <Button
              variant="ghost"
              size="icon-lg"
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
              size="icon-lg"
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

      <CardContent className="flex flex-col gap-3 px-4 pb-4 pl-5">
        <div className="grid grid-cols-2 gap-3 border-t border-border/60 pt-3">
          {connection.metadata.map((item) => (
            <div key={item.label} className="min-w-0">
              <p className="font-label text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {item.label}
              </p>
              <p
                className="mt-1 truncate font-mono text-xs text-secondary-foreground"
                title={item.value}
              >
                {item.value}
              </p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="secondary"
            className="rounded-sm border border-primary/20 bg-primary/10 px-2 py-1 font-label text-[10px] font-semibold uppercase tracking-[0.08em] text-primary"
          >
            {connection.engine}
          </Badge>
          {connection.sshEnabled ? (
            <Badge
              variant="outline"
              className="gap-1.5 rounded-sm px-2 py-1 text-[10px] uppercase tracking-[0.1em]"
            >
              <RiShieldLine size={13} aria-hidden="true" />
              SSH
            </Badge>
          ) : null}
          {connection.sslEnabled ? (
            <Badge
              variant="outline"
              className="gap-1.5 rounded-sm px-2 py-1 text-[10px] uppercase tracking-[0.1em]"
            >
              <RiLockLine size={13} aria-hidden="true" />
              SSL
            </Badge>
          ) : null}
          <span
            className={`ml-auto inline-flex items-center gap-1.5 text-[11px] ${
              connection.status.tone === "success"
                ? "text-success"
                : connection.status.tone === "warning"
                  ? "text-warning"
                  : "text-muted-foreground"
            }`}
          >
            <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
            {connection.status.label}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

const connectionTypeIcons = {
  mysql: MySQLDark,
  postgresql: PostgreSQL,
  sqlite: SQLite,
} satisfies Record<ConnectionItem["engine"], typeof PostgreSQL>;
