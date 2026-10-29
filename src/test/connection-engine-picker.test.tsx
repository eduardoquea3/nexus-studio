import "./setup";
import { afterEach, describe, expect, mock, test } from "bun:test";
const { cleanup, fireEvent, render, screen } = await import("@testing-library/react");
const { ConnectionEnginePicker } = await import("../app/home/components/connection-engine-picker");

afterEach(cleanup);

describe("ConnectionEnginePicker", () => {
  test("uses theme-aware horizontal engine cards without mini descriptions", () => {
    render(<ConnectionEnginePicker onSelect={() => undefined} />);

    for (const engine of ["PostgreSQL", "MySQL", "SQLite"]) {
      const card = screen.getByRole("button", { name: new RegExp(engine) });
      expect(card.getAttribute("class")).toContain("bg-card");
      expect(card.getAttribute("class")).toContain("text-card-foreground");
      expect(card.getAttribute("class")).toContain("flex-row");
      expect(card.getAttribute("class")).toContain("hover:bg-accent/60");
      expect(card.getAttribute("class")).toContain("hover:border-primary/70");
      expect(card.textContent).not.toContain("Powerful relational database");
      expect(card.textContent).not.toContain("Reliable, open-source SQL");
      expect(card.textContent).not.toContain("Lightweight, file-based database");
    }
  });

  test("offers the three supported engines and reports the selected value", () => {
    const onSelect = mock((_engine: "postgresql" | "mysql" | "sqlite") => undefined);
    render(<ConnectionEnginePicker onSelect={onSelect} />);

    expect(screen.getByRole("group", { name: "Choose a database engine" })).not.toBeNull();
    for (const engine of ["PostgreSQL", "MySQL", "SQLite"]) {
      const card = screen.getByRole("button", { name: new RegExp(engine) });
      expect(card).not.toBeNull();
      expect(card.getAttribute("class")).toContain("bg-card");
      expect(card.getAttribute("class")).toContain("text-card-foreground");
    }
    fireEvent.click(screen.getByRole("button", { name: /MySQL/ }));
    expect(onSelect).toHaveBeenCalledWith("mysql");
  });

  test("uses the provided SQLite SVG as a decorative logo", () => {
    render(<ConnectionEnginePicker onSelect={() => undefined} />);
    const sqliteCard = screen.getByRole("button", { name: /SQLite/ });
    const logo = sqliteCard.querySelector('img[src="/SQLite.svg"]');

    expect(logo).not.toBeNull();
    expect(logo?.getAttribute("alt")).toBe("");
    expect(logo?.getAttribute("class")).toContain("size-9");
  });

  test("switches MySQL logo artwork to match the active theme", () => {
    render(<ConnectionEnginePicker onSelect={() => undefined} />);
    const mysqlCard = screen.getByRole("button", { name: /MySQL/ });
    const mysqlLogos = [...(mysqlCard.querySelector(".bg-background")?.querySelectorAll("svg") ?? [])];

    expect(mysqlLogos).toHaveLength(2);
    expect(mysqlLogos[0]?.getAttribute("class")).toContain("dark:hidden");
    expect(mysqlLogos[0]?.querySelector('path[fill="#00546B"]')).not.toBeNull();
    expect(mysqlLogos[1]?.getAttribute("class")).toContain("dark:block");
    expect(mysqlLogos[1]?.querySelector('path[fill="#FFF"]')).not.toBeNull();
  });

  test("gives each database brand mark a prominent badge and display size", () => {
    render(<ConnectionEnginePicker onSelect={() => undefined} />);
    const postgresCard = screen.getByRole("button", { name: /PostgreSQL/ });
    const logo = postgresCard.querySelector("svg");

    expect(logo?.getAttribute("class")).toContain("size-9");
    expect(logo?.parentElement?.getAttribute("class")).toContain("size-14");
    expect(logo?.parentElement?.getAttribute("class")).toContain("bg-background");
    expect(postgresCard.querySelectorAll("svg")).toHaveLength(1);
    expect(postgresCard.querySelector(".rounded-full")).toBeNull();
  });

  test("uses focusable native buttons and exposes the selected state", () => {
    const onSelect = mock((_engine: "postgresql" | "mysql" | "sqlite") => undefined);
    render(<ConnectionEnginePicker onSelect={onSelect} />);
    const sqlite = screen.getByRole("button", { name: /SQLite/ });
    sqlite.focus();
    fireEvent.click(sqlite);

    expect(document.activeElement).toBe(sqlite);
    expect(onSelect).toHaveBeenCalledWith("sqlite");
    expect(sqlite.getAttribute("aria-pressed")).toBe("true");
  });

  test("keeps selection available without animating when reduced motion is preferred", () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = (() => ({ matches: true })) as unknown as typeof window.matchMedia;
    const onSelect = mock((_engine: "postgresql" | "mysql" | "sqlite") => undefined);

    try {
      render(<ConnectionEnginePicker onSelect={onSelect} />);
      const mysql = screen.getByRole("button", { name: /MySQL/ });
      fireEvent.click(mysql);

      expect(onSelect).toHaveBeenCalledWith("mysql");
      expect(mysql.style.opacity).toBe("");
      expect(mysql.style.transform).toBe("");
    } finally {
      cleanup();
      window.matchMedia = originalMatchMedia;
    }
  });
});
