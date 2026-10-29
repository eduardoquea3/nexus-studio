import { useGSAP } from "@gsap/react";
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
import gsap from "gsap";
import { useRef, useState } from "react";

import { getConnectionTagColor } from "@/app/home/lib/connection-tags";
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
  tags?: string[];
  tagColor?: string;
  lastOpenedAt?: number;
};

type ConnectionCardProps = {
  connection: ConnectionItem;
  onEdit?: () => void;
  onDelete?: () => void;
  onOpen?: () => Promise<boolean>;
  compact?: boolean;
};

gsap.registerPlugin(useGSAP);

export function ConnectionCard({
  connection,
  onEdit,
  onDelete,
  onOpen,
  compact = false,
}: ConnectionCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [isOpening, setIsOpening] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const EngineIcon = connectionTypeIcons[connection.engine];
  const connectionString = connection.connectionString;
  const tagColor = getConnectionTagColor(connection.tagColor);

  useGSAP(
    () => {
      const tags = cardRef.current?.querySelectorAll("[data-connection-tag]");
      if (!tags?.length || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
      gsap.fromTo(
        tags,
        { autoAlpha: 0, y: 4, scale: 0.94 },
        { autoAlpha: 1, y: 0, scale: 1, duration: 0.2, stagger: 0.04, ease: "back.out(1.4)" },
      );
    },
    { scope: cardRef, dependencies: [connection.tags?.join("|")], revertOnUpdate: true },
  );

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
      ref={cardRef}
      role="button"
      tabIndex={0}
      aria-label={`Open ${connection.name}`}
      className={`group relative flex h-full min-h-0 cursor-pointer select-none flex-col overflow-hidden border border-border/70 bg-card transition-colors hover:border-foreground/25 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${compact ? "gap-0 rounded-xl py-0" : "rounded-md py-2"}`}
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
      {!compact ? (
        <div
          className="absolute inset-y-0 left-0 w-0.5"
          style={{ backgroundColor: `var(--${tagColor})` }}
        />
      ) : null}

      <CardHeader className={compact ? "gap-0 px-3 py-2" : "gap-2 px-4 py-2 pl-5"}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-primary transition-colors group-hover:border-primary/30">
              <EngineIcon className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              {!compact ? (
                <div className="mb-0.5 flex min-w-0 items-center justify-between gap-2">
                  <p className="font-label truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-primary/85">
                    {connection.engine}
                  </p>
                  {connection.tags && connection.tags.length > 0 ? (
                    <div
                      role="group"
                      aria-label={`Connection tags: ${connection.tags.join(", ")}`}
                      title={connection.tags.join(", ")}
                      className="flex min-w-0 shrink-0 items-center gap-1"
                    >
                      {connection.tags.slice(0, 2).map((tag) => (
                        <span
                          key={tag}
                          data-connection-tag
                          className="max-w-24 truncate rounded-full border px-2 py-0.5 text-[9px] font-medium leading-none"
                          style={{
                            backgroundColor: `color-mix(in oklch, var(--${tagColor}) 20%, var(--card))`,
                            borderColor: `color-mix(in oklch, var(--${tagColor}) 55%, var(--border))`,
                            color: "var(--foreground)",
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                      {connection.tags.length > 2 ? (
                        <span
                          aria-hidden="true"
                          className="rounded-full border border-border px-1.5 py-0.5 text-[9px] leading-none text-muted-foreground"
                        >
                          +{connection.tags.length - 2}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
              <CardTitle
                className={
                  compact
                    ? "truncate text-xs font-medium"
                    : "truncate text-base tracking-[-0.025em]"
                }
              >
                {connection.name}
              </CardTitle>
              {compact ? (
                <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                  {connection.engine} · {connectionString || "Saved connection"}
                </p>
              ) : null}
            </div>
          </div>

          <CardAction className="flex items-center gap-0.5 self-start opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            <Button
              variant="ghost"
              size="icon-sm"
              className="border border-transparent text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
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
              className="border border-transparent text-muted-foreground transition-colors hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
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

      <CardContent className={compact ? "px-3 pb-2" : "flex flex-1 flex-col gap-2 px-4 pb-2 pl-5"}>
        <details open={compact ? undefined : true}>
          <summary
            className={
              compact
                ? "cursor-pointer text-[10px] text-muted-foreground hover:text-foreground"
                : "hidden"
            }
          >
            Connection details
          </summary>
          {compact && connection.tags && connection.tags.length > 0 ? (
            <div
              role="group"
              className="flex flex-wrap gap-1.5 border-t border-border/50 pt-2"
              aria-label={`Connection tags: ${connection.tags.join(", ")}`}
            >
              {connection.tags.map((tag) => (
                <span
                  key={tag}
                  data-connection-tag
                  className="rounded-full border px-2 py-0.5 text-[10px] font-medium"
                  style={{
                    backgroundColor: `color-mix(in oklch, var(--${tagColor}) 20%, var(--card))`,
                    borderColor: `color-mix(in oklch, var(--${tagColor}) 55%, var(--border))`,
                    color: "var(--foreground)",
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
          {connection.metadata.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 border-t border-border/50 pt-2">
              {connection.metadata.map((item) => (
                <div key={item.label} className="min-w-0">
                  <p className="font-label text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {item.label}
                  </p>
                  <p className="mt-1 truncate font-mono text-[11px] text-card-foreground/80">
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
              <div className="mt-1 flex min-w-0 items-center gap-2 rounded-sm bg-muted/70 px-2 py-1 transition-colors group-hover:bg-background">
                <p className="min-w-0 flex-1 truncate font-mono text-[11px] text-card-foreground/90">
                  {connectionString}
                </p>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="shrink-0 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                  aria-label={
                    isCopied
                      ? "Connection string copied"
                      : `Copy connection string for ${connection.name}`
                  }
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
        </details>
      </CardContent>
    </Card>
  );
}

const connectionTypeIcons = {
  mysql: MySQLDark,
  postgresql: PostgreSQL,
  sqlite: SQLite,
} satisfies Record<ConnectionItem["engine"], typeof PostgreSQL>;
