import { RiArrowDownSLine, RiRefreshLine, RiSearchLine } from "@remixicon/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type ConnectionSort = "name" | "recent";

type ConnectionToolbarProps = {
  query: string;
  sort: ConnectionSort;
  isFetching: boolean;
  onQueryChange: (query: string) => void;
  onSortChange: (sort: ConnectionSort) => void;
  onRefresh: () => void;
};

export function ConnectionToolbar({
  query,
  sort,
  isFetching,
  onQueryChange,
  onSortChange,
  onRefresh,
}: ConnectionToolbarProps) {
  return (
    <div className="flex flex-col gap-3 border-b border-border/60 pb-3 sm:flex-row sm:items-center sm:justify-between">
      <h2 className="font-label text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        Saved environments
      </h2>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="relative min-w-0 sm:w-56">
          <span className="sr-only">Search connections</span>
          <RiSearchLine
            size={15}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search connections"
            aria-label="Search connections"
            className="h-9 rounded-md bg-control pl-8 text-xs"
          />
        </label>

        <label className="relative">
          <span className="sr-only">Sort connections</span>
          <select
            value={sort}
            onChange={(event) => onSortChange(event.target.value as ConnectionSort)}
            aria-label="Sort connections"
            className="h-9 w-full appearance-none rounded-md border border-border/70 bg-surface px-3 pr-8 text-xs text-muted-foreground outline-none transition-colors hover:border-foreground/30 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 sm:w-36"
          >
            <option value="recent">Recently opened</option>
            <option value="name">Name</option>
          </select>
          <RiArrowDownSLine
            size={15}
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
        </label>

        <Button
          variant="outline"
          size="icon-lg"
          className="self-end sm:self-auto"
          onClick={onRefresh}
          disabled={isFetching}
          aria-label="Refresh connections"
        >
          <RiRefreshLine
            size={16}
            className={isFetching ? "animate-spin" : undefined}
            aria-hidden="true"
          />
        </Button>
      </div>
    </div>
  );
}
