import { RiDatabase2Line } from "@remixicon/react";

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
    <div className="border-b border-border/70 px-4 py-4">
      <p className="text-[0.65rem] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        Database
      </p>
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
        className="mt-1 h-8 w-full text-xs"
        disabled={databases.length === 0 || isLoading}
      />
      {hasError ? (
        <p className="mt-2 text-[0.65rem] text-destructive">Database unavailable</p>
      ) : null}
    </div>
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
