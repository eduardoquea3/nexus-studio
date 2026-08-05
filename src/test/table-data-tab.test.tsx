import "./setup";

import { afterEach, describe, expect, mock, test } from "bun:test";
import type { DataPage } from "@/shared/types/models";

const emptyTableData: DataPage = {
  columns: [],
  rows: [],
  total: 0,
  page: 1,
  page_size: 100,
};
let currentTableData = emptyTableData;

mock.module("@/app/connection/hooks/use-table-data", () => ({
  useTableData: () => ({
    data: currentTableData,
    error: null,
    isLoading: false,
    refetch: mock(() => Promise.resolve()),
  }),
}));

mock.module("@/app/connection/hooks/use-table-schema", () => ({
  useTableSchema: () => ({
    data: {
      columns: [
        { name: "name", data_type: "varchar", enum_values: [], nullable: true, default: null, is_pk: true, is_fk: false, is_unique: false },
        { name: "active", data_type: "boolean", enum_values: [], nullable: false, default: null, is_pk: false, is_fk: false, is_unique: false },
        { name: "status", data_type: "USER-DEFINED", enum_values: ["draft", "published"], nullable: false, default: null, is_pk: false, is_fk: false, is_unique: false },
      ],
      indexes: [],
    },
    error: null,
    isLoading: false,
    refetch: mock(() => Promise.resolve()),
  }),
}));

const { TableDataTab } = await import("../app/connection/components/table-data-tab");
const { cleanup, fireEvent, render, screen } = await import("@testing-library/react");

const profile = {
  id: "connection-1",
  name: "Test connection",
  db_type: "postgres",
  connect_mode: {
    type: "connection_string",
    value: "localhost:5432",
  },
  ssh_tunnel: null,
} as const;

describe("TableDataTab empty rows", () => {
  afterEach(() => {
    cleanup();
    currentTableData = emptyTableData;
  });

  test("shows table headers even when there are no rows", () => {
    render(<TableDataTab profile={profile} table="auth" />);

    expect(screen.getByRole("tab", { name: "Data" })).not.toBeNull();
    expect(screen.getByRole("tab", { name: "Structure" })).not.toBeNull();
    expect(screen.getByRole("columnheader", { name: "#" })).not.toBeNull();
    expect(screen.getByRole("columnheader", { name: /^name/ })).not.toBeNull();
    expect(screen.getByRole("columnheader", { name: /^active/ })).not.toBeNull();
    expect(screen.getByRole("columnheader", { name: /^status/ })).not.toBeNull();
    expect(screen.getByText("varchar")).not.toBeNull();
    expect(screen.getByText("boolean")).not.toBeNull();
    expect(screen.getByText("enum")).not.toBeNull();
    expect(screen.getByRole("table").className.includes("min-w-max")).toBe(true);
    expect(document.querySelector('[data-slot="scroll-area"]')).not.toBeNull();
    expect(screen.getByText("0 rows")).not.toBeNull();
    expect(screen.getByText("Showing 0")).not.toBeNull();
    expect(screen.queryByText(/is empty/i)).toBeNull();
  });

  test("renders labeled structure checkboxes and toggles nullable state", async () => {
    render(<TableDataTab profile={profile} table="auth" />);

    fireEvent.mouseDown(screen.getByRole("tab", { name: "Structure" }));

    const nullableCheckbox = await screen.findByRole("checkbox", { name: "Nullable name" });
    const primaryKeyCheckbox = screen.getByRole("checkbox", { name: "Primary key name" });
    const nameRow = screen.getByRole("row", { name: /name varchar/ });

    expect(nullableCheckbox.getAttribute("aria-checked")).toBe("true");
    expect(primaryKeyCheckbox.getAttribute("aria-checked")).toBe("true");
    expect(nameRow.textContent).toContain("YES");

    fireEvent.click(nullableCheckbox);

    expect(nullableCheckbox.getAttribute("aria-checked")).toBe("false");
    expect(nameRow.textContent).toContain("NO");
  });

  test("adds a local editable row from the data toolbar", () => {
    render(<TableDataTab profile={profile} table="auth" />);

    fireEvent.click(screen.getByRole("button", { name: "Add row" }));

    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(screen.getAllByRole("combobox")).toHaveLength(2);
    expect((screen.getByRole("combobox", { name: "New active" }) as HTMLSelectElement).value).toBe("");
    expect((screen.getByRole("combobox", { name: "New status" }) as HTMLSelectElement).value).toBe("");
    expect(screen.getByRole("option", { name: "true" })).not.toBeNull();
    expect(screen.getByRole("option", { name: "published" })).not.toBeNull();
    expect((screen.getByRole("textbox") as HTMLInputElement).className.includes("bg-primary/10")).toBe(true);
    expect(screen.getByRole("cell", { name: "1" })).not.toBeNull();
    expect(screen.getByText("Draft row")).not.toBeNull();
  });

  test("shows display indexes without adding them to row data", () => {
    currentTableData = {
      columns: ["name", "active", "status"],
      rows: [
        { name: "first", active: true, status: "draft" },
        { name: "second", active: false, status: "published" },
      ],
      total: 2,
      page: 1,
      page_size: 100,
    };

    render(<TableDataTab profile={profile} table="auth" />);

    expect(screen.getByRole("cell", { name: "1" })).not.toBeNull();
    expect(screen.getByRole("cell", { name: "2" })).not.toBeNull();
    expect(screen.queryByRole("columnheader", { name: "id" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Add row" }));

    expect(screen.getByRole("cell", { name: "3" })).not.toBeNull();
  });
});
