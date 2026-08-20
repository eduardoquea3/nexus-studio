import {
  RiArrowDownSLine,
  RiArrowUpSLine,
  RiCodeBoxLine,
  RiDatabase2Line,
  RiSearchLine,
  RiTableLine,
} from "@remixicon/react";
import { useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import type { ConnectionProfile } from "@/shared/types/models";
import {
  filterCommandBarItems,
  moveSelection,
  type CommandBarItem,
  type CommandBarMode,
} from "./command-bar-utils";

type CommandBarGroup = "connections" | "tables" | "tabs";

type CommandBarProps = {
  mode: CommandBarMode;
  items: readonly CommandBarItem[];
  initialIndex?: number;
  isLoading?: boolean;
  onClose: () => void;
  onSelect: (item: CommandBarItem) => void;
  onConnectionSelect?: (profile: ConnectionProfile) => void | Promise<void>;
  cycleRequest?: { sequence: number; direction: -1 | 1 };
  onHighlightChange?: (item: CommandBarItem | undefined) => void;
  groups?: readonly CommandBarGroup[];
  inline?: boolean;
};

export function CommandBar({
  mode,
  items,
  initialIndex = 0,
  isLoading = false,
  onClose,
  onSelect,
  onConnectionSelect,
  cycleRequest,
  onHighlightChange,
  groups,
  inline = false,
}: CommandBarProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);
  const inputRef = useRef<HTMLInputElement>(null);
  const switcherRef = useRef<HTMLElement>(null);
  const filteredItems = useMemo(() => filterCommandBarItems(items, query), [items, query]);
  const selectedItem = filteredItems[selectedIndex];
  const isSwitcher = mode === "tab-switcher";
  const visibleGroups = groups ?? (isSwitcher ? ["tabs"] : inferGroups(items));
  const groupedItems = visibleGroups.map((group) => ({
    group,
    items: filteredItems.filter((item) => itemGroup(item) === group),
  }));

  useEffect(() => {
    if (isSwitcher) {
      switcherRef.current?.focus();
    } else {
      inputRef.current?.focus();
    }
  }, [isSwitcher]);

  useEffect(() => {
    setSelectedIndex((index) => (filteredItems.length === 0 ? -1 : Math.min(index, filteredItems.length - 1)));
  }, [filteredItems.length]);

  useEffect(() => {
    if (cycleRequest) {
      setSelectedIndex((index) => moveSelection(index, filteredItems.length, cycleRequest.direction));
    }
  }, [cycleRequest, filteredItems.length]);

  useEffect(() => {
    onHighlightChange?.(selectedItem);
  }, [onHighlightChange, selectedItem]);

  const selectItem = (item: CommandBarItem | undefined) => {
    if (!item || isLoading) {
      return;
    }
    if (item.kind === "connection" && onConnectionSelect) {
      onConnectionSelect(item.connection);
      return;
    }
    onSelect(item);
  };

  const selectCurrent = () => selectItem(selectedItem);

  return (
    <div
      className={cn(
        inline
          ? "absolute left-1/2 top-2 z-50 w-[min(42rem,calc(100%-2rem))] -translate-x-1/2"
          : "fixed inset-0 z-50 flex items-start justify-center bg-black/35 px-4 pt-[12vh] backdrop-blur-[2px]",
      )}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        ref={switcherRef}
        aria-label={isSwitcher ? "Open tabs" : "Command palette"}
        aria-modal={inline ? undefined : "true"}
        className={cn(
          "w-full overflow-hidden rounded-lg border border-border/80 bg-popover text-popover-foreground shadow-2xl",
          isSwitcher ? "max-w-md" : "max-w-2xl",
        )}
        role="dialog"
        tabIndex={isSwitcher ? -1 : undefined}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
            return;
          }
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setSelectedIndex((index) => moveSelection(index, filteredItems.length, 1));
            return;
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setSelectedIndex((index) => moveSelection(index, filteredItems.length, -1));
            return;
          }
          if (event.key === "Enter") {
            event.preventDefault();
            selectCurrent();
          }
        }}
      >
        {!isSwitcher ? (
          <div className="flex items-center gap-3 border-b border-border/70 px-4 py-3">
            <RiSearchLine className="size-4 shrink-0 text-primary" />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search commands"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              placeholder="Search tables and connections..."
            />
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              Ctrl P
            </kbd>
          </div>
        ) : null}
        <div className={cn(
          "overflow-y-auto",
          isSwitcher ? "max-h-[min(35vh,18rem)] p-1" : "max-h-[min(55vh,30rem)] p-2",
        )}>
          {isLoading ? <p className="px-3 py-8 text-center text-sm text-muted-foreground">Loading...</p> : null}
          {!isLoading && filteredItems.length === 0 && query.trim() ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">No matching items.</p>
          ) : null}
          {!isLoading && isSwitcher && filteredItems.length > 0 ? (
            <ul aria-label="Open tabs" className="space-y-0.5">
              {filteredItems.map((item, index) => renderItem(item, index, selectedIndex, true, setSelectedIndex, selectItem))}
            </ul>
          ) : null}
          {!isLoading && isSwitcher && filteredItems.length === 0 ? (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">No open tabs</p>
          ) : null}
          {!isLoading && !isSwitcher && !query.trim() ? (
            <div className="space-y-3" aria-label="Command results">
              {groupedItems.map(({ group, items: groupItems }) => (
                <section key={group} aria-labelledby={`command-group-${group}`}>
                  <h3 id={`command-group-${group}`} className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {groupLabel(group)}
                  </h3>
                  {groupItems.length > 0 ? (
                    <ul className="space-y-1">
                      {groupItems.map((item) => renderItem(item, filteredItems.indexOf(item), selectedIndex, isSwitcher, setSelectedIndex, selectItem))}
                    </ul>
                  ) : (
                    <p className="px-3 py-2 text-xs text-muted-foreground">{emptyGroupMessage(group)}</p>
                  )}
                </section>
              ))}
            </div>
          ) : null}
          {!isLoading && !isSwitcher && query.trim() && filteredItems.length > 0 ? (
            <ul aria-label="Command results" className="space-y-1">
              {filteredItems.map((item, index) => renderItem(item, index, selectedIndex, isSwitcher, setSelectedIndex, selectItem))}
            </ul>
          ) : null}
        </div>
        {!isSwitcher ? <footer className={cn(
          "flex items-center gap-3 border-t border-border/70 text-[10px] text-muted-foreground",
          isSwitcher ? "px-3 py-1.5" : "px-4 py-2",
        )}>
          <span><RiArrowDownSLine className="inline size-3" /><RiArrowUpSLine className="inline size-3" /> navigate</span>
          <span>Enter select</span>
          <span>Esc close</span>
          {isSwitcher ? <span className="ml-auto">Release Ctrl to switch</span> : null}
        </footer> : null}
      </section>
    </div>
  );
}

function renderItem(
  item: CommandBarItem,
  index: number,
  selectedIndex: number,
  isSwitcher: boolean,
  setSelectedIndex: (index: number) => void,
  selectItem: (item: CommandBarItem) => void,
) {
  return (
    <li key={item.id}>
      <button
        type="button"
        className={cn(
          "flex w-full items-center rounded-md text-left transition-colors",
          isSwitcher ? "gap-2 px-2 py-1.5 text-xs" : "gap-3 px-3 py-2 text-sm",
          index === selectedIndex ? "bg-accent text-accent-foreground" : "hover:bg-muted/70",
        )}
        aria-selected={index === selectedIndex}
        onMouseEnter={() => setSelectedIndex(index)}
        onClick={() => selectItem(item)}
      >
        <ItemIcon item={item} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{item.label}</span>
          <span className="block truncate text-xs text-muted-foreground">{item.detail}</span>
        </span>
        {item.kind === "connection" && item.isActive ? (
          <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">Active</span>
        ) : null}
        {isSwitcher && index === selectedIndex ? <span className="text-[10px] text-muted-foreground">Enter</span> : null}
      </button>
    </li>
  );
}

function itemGroup(item: CommandBarItem): CommandBarGroup {
  return item.kind === "connection" ? "connections" : item.kind === "table" ? "tables" : "tabs";
}

function inferGroups(items: readonly CommandBarItem[]): CommandBarGroup[] {
  return [...new Set(items.map(itemGroup))];
}

function groupLabel(group: CommandBarGroup): string {
  return group === "connections" ? "Connections" : group === "tables" ? "Tables" : "Open tabs";
}

function emptyGroupMessage(group: CommandBarGroup): string {
  return group === "connections" ? "No connections" : group === "tables" ? "No tables" : "No open tabs";
}

function ItemIcon({ item }: { item: CommandBarItem }) {
  if (item.kind === "connection") {
    return <RiDatabase2Line className="size-4 shrink-0 text-primary" />;
  }
  if (item.kind === "table") {
    return <RiTableLine className="size-4 shrink-0 text-primary" />;
  }
  return item.tab.type === "datatable" ? (
    <RiTableLine className="size-4 shrink-0 text-primary" />
  ) : (
    <RiCodeBoxLine className="size-4 shrink-0 text-primary" />
  );
}
