import { RiDatabase2Line } from "@remixicon/react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { Select } from "@/shared/components/ui/select";

export type DatabaseOption = { value: string; label: string };

type ConnectionDatabaseSelectorProps = {
  databases: DatabaseOption[];
  selectedDatabase: string;
  onDatabaseChange: (database: string) => void;
  isLoading: boolean;
  hasError: boolean;
};

export function ConnectionDatabaseSelector({
  databases,
  selectedDatabase,
  onDatabaseChange,
  isLoading,
  hasError,
}: ConnectionDatabaseSelectorProps) {
  return (
    <Select
      options={databases}
      value={databases.find((option) => option.value === selectedDatabase) ?? null}
      onValueChange={(option) => {
        if (option) onDatabaseChange(option.value);
      }}
      valueKey="value"
      labelKey="label"
      render={renderDatabaseOption}
      placeholder={
        isLoading ? "Loading databases..." : hasError ? "Database unavailable" : "Select database"
      }
      isLoading={isLoading}
      className="h-6! min-w-0 max-w-56 rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-[0.65rem] text-foreground shadow-none hover:bg-success/15 [&>svg:last-child]:hidden"
      contentClassName="w-max min-w-(--anchor-width) max-w-72"
      disabled={databases.length === 0 || isLoading}
    />
  );
}

export function ConnectionDatabaseSelectorPortal(props: ConnectionDatabaseSelectorProps) {
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setPortalTarget(
      document.querySelector<HTMLElement>('[data-slot="title-bar-database-switcher"]'),
    );
  }, []);

  return portalTarget
    ? createPortal(<ConnectionDatabaseSelector {...props} />, portalTarget)
    : null;
}

function renderDatabaseOption(option: DatabaseOption) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <RiDatabase2Line className="size-3.5 shrink-0 text-foreground" aria-hidden="true" />
      <span className="truncate">{option.label}</span>
    </span>
  );
}
