import "./setup";
import { afterEach, describe, expect, mock, test } from "bun:test";

import type { CommandBarItem } from "@/app/command-bar/command-bar-utils";

const { CommandBar } = await import("@/app/command-bar/command-bar");
const { act, cleanup, fireEvent, render, screen } = await import("@testing-library/react");

afterEach(() => cleanup());

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

const commandItems: CommandBarItem[] = [
  {
    id: "command:disconnect",
    kind: "command",
    label: "Disconnect",
    detail: "Return to Home",
    isActive: false,
    command: "disconnect",
  },
  {
    id: "command:new-connection",
    kind: "command",
    label: "New connection",
    detail: "Create a saved connection",
    isActive: false,
    command: "new-connection",
  },
  {
    id: "command:generate-er-diagram",
    kind: "command",
    label: "Generate ER diagram",
    detail: "Map all tables",
    isActive: false,
    command: "generate-er-diagram",
  },
];

describe("CommandBar", () => {
  test("preserves every batched arrow step in the uncontrolled palette", () => {
    render(
      <CommandBar
        mode="palette"
        items={items}
        onClose={() => undefined}
        onSelect={() => undefined}
      />,
    );
    const input = screen.getByRole("textbox", { name: "Search commands" });
    act(() => {
      fireEvent.keyDown(input, { key: "ArrowDown" });
      fireEvent.keyDown(input, { key: "ArrowDown" });
    });
    expect(screen.getByRole("button", { name: /users/ }).getAttribute("aria-selected")).toBe(
      "true",
    );
  });

  test("keeps controlled highlighting event-driven without replaying prop updates", () => {
    const onHighlightChange = mock((_item: CommandBarItem | undefined) => undefined);
    const props = {
      mode: "tab-switcher" as const,
      items,
      onClose: () => undefined,
      onSelect: () => undefined,
      onHighlightChange,
    };
    const { rerender } = render(<CommandBar {...props} selectedId="table:users" />);
    expect(onHighlightChange).not.toHaveBeenCalled();

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "ArrowDown" });
    expect(onHighlightChange).toHaveBeenCalledTimes(1);
    expect(onHighlightChange.mock.calls[0]?.[0]?.id).toBe("table:orders");
    rerender(<CommandBar {...props} selectedId="table:orders" />);
    expect(onHighlightChange).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: /orders/ }).getAttribute("aria-selected")).toBe(
      "true",
    );
    fireEvent.mouseEnter(screen.getByRole("button", { name: /users/ }));
    expect(onHighlightChange.mock.calls[1]?.[0]?.id).toBe("table:users");
  });

  test("selects with ArrowDown and Enter after the exit animation", async () => {
    const onSelect = mock((_item: CommandBarItem) => undefined);
    render(
      <CommandBar mode="palette" items={items} onClose={() => undefined} onSelect={onSelect} />,
    );
    const search = screen.getByRole("textbox", { name: "Search commands" });

    fireEvent.keyDown(search, { key: "ArrowDown" });
    fireEvent.keyDown(search, { key: "Enter" });

    expect(onSelect).not.toHaveBeenCalled();
    await new Promise((resolve) => setTimeout(resolve, 650));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0]?.[0]?.id).toBe("table:orders");
  });

  test("scrolls the keyboard-selected option into view", () => {
    const scrollIntoView = mock(() => undefined);
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });
    render(
      <CommandBar
        mode="palette"
        items={items}
        onClose={() => undefined}
        onSelect={() => undefined}
      />,
    );

    fireEvent.keyDown(screen.getByRole("textbox", { name: "Search commands" }), {
      key: "ArrowDown",
    });

    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
  });

  test("uses the themed scrollbar on the results list", () => {
    render(
      <CommandBar
        mode="palette"
        items={items}
        onClose={() => undefined}
        onSelect={() => undefined}
      />,
    );

    expect(document.querySelector(".command-bar-scroll")).not.toBeNull();
  });

  test("animates the command bar into view with GSAP", () => {
    render(
      <CommandBar
        mode="palette"
        items={items}
        onClose={() => undefined}
        onSelect={() => undefined}
      />,
    );

    expect(screen.getByRole("dialog").style.opacity).toBe("0");
  });

  test("shows command-specific icons and the Ctrl Shift P shortcut in commands mode", () => {
    render(
      <CommandBar
        mode="commands"
        items={commandItems}
        onClose={() => undefined}
        onSelect={() => undefined}
      />,
    );

    expect(screen.getByText("Ctrl Shift P")).toBeTruthy();
    expect(document.querySelector('[data-icon-kind="disconnect"] svg')).toBeTruthy();
    expect(document.querySelector('[data-icon-kind="new-connection"] svg')).toBeTruthy();
    expect(document.querySelector('[data-icon-kind="generate-er-diagram"] svg')).toBeTruthy();
  });

  test("animates out before closing on Escape", async () => {
    const onClose = mock(() => undefined);
    const onSelect = mock((_item: CommandBarItem) => undefined);
    render(<CommandBar mode="palette" items={items} onClose={onClose} onSelect={onSelect} />);
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Search commands" }), { key: "Escape" });

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    await new Promise((resolve) => setTimeout(resolve, 650));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  test("animates out when clicking elsewhere in the app but stays open on focus changes", async () => {
    const onClose = mock(() => undefined);
    render(
      <>
        <button type="button">Database selector</button>
        <CommandBar
          mode="palette"
          items={items}
          onClose={onClose}
          onSelect={() => undefined}
          inline
        />
      </>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Database selector" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.blur(window);
    expect(onClose).not.toHaveBeenCalled();
    await new Promise((resolve) => setTimeout(resolve, 650));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("renders grouped results and distinguishes loading from no matches", () => {
    render(
      <CommandBar
        mode="palette"
        items={items}
        onClose={() => undefined}
        onSelect={() => undefined}
      />,
    );

    expect(screen.getByText("Tables")).toBeTruthy();
    fireEvent.change(screen.getByRole("textbox", { name: "Search commands" }), {
      target: { value: "missing" },
    });
    expect(screen.getByText("No matching items.")).toBeTruthy();
  });

  test("shows a specific empty state for open tabs", () => {
    render(
      <CommandBar
        mode="tab-switcher"
        items={[]}
        onClose={() => undefined}
        onSelect={() => undefined}
      />,
    );

    expect(screen.getByText("No open tabs")).toBeTruthy();
  });

  test("shows loading instead of an empty result while data is loading", () => {
    render(
      <CommandBar
        mode="palette"
        items={[]}
        isLoading
        onClose={() => undefined}
        onSelect={() => undefined}
      />,
    );

    expect(screen.getByText("Loading...")).toBeTruthy();
    expect(screen.queryByText("No matching items.")).toBeNull();
  });
});
