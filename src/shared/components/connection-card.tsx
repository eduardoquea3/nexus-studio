import { RiCloseLine, RiPencilLine, RiPlayLine, RiSubtractLine } from "@remixicon/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type ConnectionStatus = "connected" | "disconnected";

export type ConnectionItem = {
  id: string;
  name: string;
  status: ConnectionStatus;
  engine: "postgresql" | "mysql" | "sqlite";
  endpointLabel: "HOST" | "FILE";
  endpoint: string;
  database: string;
  user: string;
};

type ConnectionCardProps = {
  connection: ConnectionItem;
};

export function ConnectionCard({ connection }: ConnectionCardProps) {
  const isConnected = connection.status === "connected";
  const statusTone = isConnected
    ? {
        shell: "border-primary/25 ring-1 ring-primary/10",
        bar: "bg-primary",
        badge: "border-primary/20 bg-primary/10 text-primary",
        engine: "bg-secondary text-secondary-foreground",
        primaryAction: "border-primary text-primary hover:bg-accent/10",
      }
    : {
        shell: "border-border",
        bar: "bg-border",
        badge: "border-border bg-background text-muted-foreground",
        engine: "bg-muted text-muted-foreground",
        primaryAction: "border-primary text-primary hover:bg-accent/10",
      };

  return (
    <Card
      className={`overflow-hidden rounded-xl border bg-card shadow-[0_1px_0_rgba(15,23,42,0.02)] transition-shadow hover:shadow-[0_8px_24px_rgba(15,23,42,0.05)] ${statusTone.shell}`}
    >
      <div className={`h-1 w-full ${statusTone.bar}`} />

      <CardHeader className="gap-2 px-3 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${statusTone.bar}`} />
              <CardTitle className="truncate text-sm tracking-[-0.02em]">
                {connection.name}
              </CardTitle>
            </div>
            <CardDescription className="mt-1 flex items-center gap-2 text-xs">
              <Badge variant="outline" className={statusTone.badge}>
                {connection.status}
              </Badge>
            </CardDescription>
          </div>

          <CardAction className="flex items-center gap-1.5 self-start">
            <Button variant="outline" size="icon-sm" className={statusTone.primaryAction}>
              {isConnected ? <RiSubtractLine size={16} /> : <RiPlayLine size={16} />}
            </Button>
            <Button variant="outline" size="icon-sm">
              <RiPencilLine size={16} />
            </Button>
            <Button variant="outline" size="icon-sm">
              <RiCloseLine size={16} />
            </Button>
          </CardAction>
        </div>
      </CardHeader>

      <CardContent className="px-3 pb-3">
        <Badge
          variant="secondary"
          className={`mb-3 rounded-md text-xs uppercase tracking-[0.08em] ${statusTone.engine}`}
        >
          {connection.engine}
        </Badge>

        <dl className="grid grid-cols-3 gap-2 text-xs">
          <MetaCell
            label={connection.endpointLabel}
            value={connection.endpoint}
            valueClassName="text-xs"
          />
          <MetaCell label="DATABASE" value={connection.database} valueClassName="text-xs" />
          <MetaCell label="USER" value={connection.user} valueClassName="text-xs" />
        </dl>
      </CardContent>
    </Card>
  );
}

function MetaCell({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className={`truncate text-foreground ${valueClassName ?? ""}`}>{value}</dd>
    </div>
  );
}
