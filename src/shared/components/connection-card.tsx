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
      className="group relative cursor-pointer overflow-hidden rounded-2xl border border-border/80 bg-card shadow-[0_1px_0_rgba(15,23,42,0.02)] transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_12px_30px_rgba(15,23,42,0.1)]"
      onDoubleClick={() => void handleOpen()}
    >
      <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-primary via-primary/70 to-primary/20" />

      <CardHeader className="gap-4 px-4 py-4 pl-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
              <EngineIcon className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="mb-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Connection
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

      <CardContent className="flex flex-wrap items-center gap-2 px-4 pb-4 pl-5">
        <Badge
          variant="secondary"
          className="gap-1.5 rounded-lg border border-primary/15 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary"
        >
          {connection.engine}
        </Badge>
        {connection.sshEnabled ? (
          <Badge
            variant="outline"
            className="gap-1.5 rounded-lg px-2.5 py-1 text-[10px] uppercase tracking-[0.1em]"
          >
            <RiShieldLine size={13} aria-hidden="true" />
            SSH
          </Badge>
        ) : null}
        {connection.sslEnabled ? (
          <Badge
            variant="outline"
            className="gap-1.5 rounded-lg px-2.5 py-1 text-[10px] uppercase tracking-[0.1em]"
          >
            <RiLockLine size={13} aria-hidden="true" />
            SSL
          </Badge>
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
