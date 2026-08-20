import "./setup";

import { describe, expect, mock, test } from "bun:test";

import type { CommandBarItem } from "@/app/command-bar/command-bar-utils";

const { CommandBar } = await import("@/app/command-bar/command-bar");
const { fireEvent, render, screen } = await import("@testing-library/react");

const items: CommandBarItem[] = [
  {
    id: "table:users",
    kind: "table",
    label: "users",
    detail: "public · table",
    isActive: false,
    table: { name: "users", object_type: "table" },
  },
  {
    id: "table:orders",
    kind: "table",
    label: "orders",
    detail: "public · table",
    isActive: false,
    table: { name: "orders", object_type: "table" },
  },
];

describe("CommandBar", () => {
  test("selects with ArrowDown and Enter", () => {
    const onSelect = mock((_item: CommandBarItem) => undefined);
    render(<CommandBar mode="palette" items={items} onClose={() => undefined} onSelect={onSelect} />);
    const search = screen.getByRole("textbox", { name: "Search commands" });

    fireEvent.keyDown(search, { key: "ArrowDown" });
    fireEvent.keyDown(search, { key: "Enter" });

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0]?.[0]?.id).toBe("table:orders");
  });

  test("closes on Escape and restores no underlying interaction", () => {
    const onClose = mock(() => undefined);
    const onSelect = mock((_item: CommandBarItem) => undefined);
    render(<CommandBar mode="palette" items={items} onClose={onClose} onSelect={onSelect} />);
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Search commands" }), { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  test("renders grouped results and distinguishes loading from no matches", () => {
    render(<CommandBar mode="palette" items={items} onClose={() => undefined} onSelect={() => undefined} />);

    expect(screen.getByText("Tables")).toBeTruthy();
    fireEvent.change(screen.getByRole("textbox", { name: "Search commands" }), { target: { value: "missing" } });
    expect(screen.getByText("No matching items.")).toBeTruthy();
  });

  test("shows a specific empty state for open tabs", () => {
    render(<CommandBar mode="tab-switcher" items={[]} onClose={() => undefined} onSelect={() => undefined} />);

    expect(screen.getByText("No open tabs")).toBeTruthy();
  });

  test("shows loading instead of an empty result while data is loading", () => {
    render(<CommandBar mode="palette" items={[]} isLoading onClose={() => undefined} onSelect={() => undefined} />);

    expect(screen.getByText("Loading...")).toBeTruthy();
    expect(screen.queryByText("No matching items.")).toBeNull();
  });
});
