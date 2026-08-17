import { RiDatabase2Line } from "@remixicon/react";

import { ConnectionCard, type ConnectionItem } from "@/shared/components/connection-card";

type ConnectionGridProps = {
  connections: ConnectionItem[];
  onOpen: (connection: ConnectionItem) => Promise<boolean>;
  onEdit: (connection: ConnectionItem) => void;
  onDelete: (connection: ConnectionItem) => void;
};

export function ConnectionGrid({ connections, onOpen, onEdit, onDelete }: ConnectionGridProps) {
  if (connections.length === 0) {
    return (
      <div className="flex min-h-44 flex-col items-center justify-center rounded-md border border-dashed border-border/80 bg-card/50 px-6 py-10 text-center">
        <RiDatabase2Line size={22} className="mb-3 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm font-medium">No saved environments found</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Try another search or add a new connection.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {connections.map((connection) => (
        <ConnectionCard
          key={connection.id}
          connection={connection}
          onOpen={() => onOpen(connection)}
          onEdit={() => onEdit(connection)}
          onDelete={() => onDelete(connection)}
        />
      ))}
    </div>
  );
}
