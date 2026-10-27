import "./setup";
import type { ReactNode } from "react";

import { afterEach, describe, expect, mock, test } from "bun:test";

import type { ColumnInfo, DataPage } from "@/shared/types/models";

import { serializeJson } from "@/shared/lib/json-serialization";

const emptyTableData: DataPage = {
  columns: [],
  rows: [],
  total: 0,
  page: 1,
  page_size: 100,
};
let currentTableData = emptyTableData;
let tableLoading = false;
let tableFetching = false;
let tableError: Error | null = null;
let requestedPage = 1;
let additionalSchemaColumns: ColumnInfo[] = [];
let schemaHasPrimaryKey = true;
const refetchTable = mock(() => Promise.resolve());
const exportTableDataJson = mock(async () => ({
  status: "success" as const,
  path: "~/Downloads/selected-row.json",
}));
const insertTableRow = mock(async () => {});
const deleteTableRows = mock(async () => 2);
const invalidateTableData = mock(() => {});
const addToast = mock((_options: unknown) => "toast-1");

mock.module("@/app/connection/services/table-data-export-service", () => ({
  exportTableDataJson,
}));

mock.module("@/app/connection/services/table-data-insert-service", () => ({ insertTableRow }));

mock.module("@/app/connection/services/table-data-delete-service", () => ({ deleteTableRows }));

mock.module("@/components/ui/toast", () => ({ toast: { add: addToast } }));

mock.module("@/app/connection/hooks/use-table-data", () => ({
  useInvalidateTableData: () => invalidateTableData,
  useTableData: (_profile: unknown, _table: string, _schema: string | undefined, page: number) => {
    requestedPage = page;
    return {
      data:
        currentTableData.rows.length > 0
          ? {
              ...currentTableData,
              page: currentTableData.page === 1 ? page : currentTableData.page,
            }
          : currentTableData,
      error: tableError,
      isLoading: tableLoading,
      isFetching: tableFetching,
      refetch: refetchTable,
    };
  },
}));

mock.module("@/app/connection/hooks/use-table-schema", () => ({
  useTableSchema: () => ({
    data: {
      columns: [
        {
          name: "name",
          data_type: "varchar",
          enum_values: [],
          nullable: true,
          default: null,
          is_pk: schemaHasPrimaryKey,
          is_fk: false,
          is_unique: false,
        },
        {
          name: "active",
          data_type: "boolean",
          enum_values: [],
          nullable: false,
          default: null,
          is_pk: false,
          is_fk: false,
          is_unique: false,
        },
        {
          name: "status",
          data_type: "USER-DEFINED",
          enum_values: ["draft", "published"],
          nullable: false,
          default: null,
          is_pk: false,
          is_fk: false,
          is_unique: false,
        },
        ...additionalSchemaColumns,
      ],
      indexes: [],
    },
    error: null,
    isLoading: false,
    refetch: mock(() => Promise.resolve()),
  }),
}));

mock.module("@/shared/components/json-code-panel", () => ({
  JsonCodePanel: ({
    ariaLabel,
    text,
    meta,
    actions,
    largeMessage,
    fontScope,
  }: {
    ariaLabel: string;
    text: string;
    meta?: string;
    actions?: ReactNode;
    largeMessage?: string;
    fontScope?: "interface" | "results";
  }) => (
    <div aria-label={ariaLabel} data-font-scope={fontScope}>
      {meta ? <span>{meta}</span> : null}
      {largeMessage ? null : <pre>{text}</pre>}
      {actions}
      {largeMessage ? <p>{largeMessage}</p> : null}
    </div>
  ),
}));

const { TableDataTab } = await import("../app/connection/components/table-data-tab");
const { act, cleanup, fireEvent, render, screen } = await import("@testing-library/react");
const originalClipboard = navigator.clipboard;
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;
const originalCreateElement = document.createElement;

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
    tableLoading = false;
    tableFetching = false;
    tableError = null;
    requestedPage = 1;
    additionalSchemaColumns = [];
    schemaHasPrimaryKey = true;
    refetchTable.mockClear();
    exportTableDataJson.mockClear();
    exportTableDataJson.mockImplementation(async () => ({
      status: "success",
      path: "~/Downloads/selected-row.json",
    }));
    insertTableRow.mockClear();
    insertTableRow.mockImplementation(async () => {});
    deleteTableRows.mockClear();
    deleteTableRows.mockImplementation(async () => 2);
    invalidateTableData.mockClear();
    addToast.mockClear();
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: originalClipboard });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: originalCreateObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: originalRevokeObjectURL,
    });
    document.createElement = originalCreateElement;
  });

  test("navigates through server pages and displays page count", () => {
    currentTableData = { columns: ["id"], rows: [{ id: 1 }], total: 250, page: 1, page_size: 100 };
    render(<TableDataTab profile={profile} table="auth" />);

    expect(screen.getByLabelText("Current page 1")).not.toBeNull();
    expect(screen.queryByText(/rows/i)).toBeNull();
    expect(screen.queryByText(/showing/i)).toBeNull();
    const previousButton = screen.getByRole("button", { name: "Previous table page" });
    const nextButton = screen.getByRole("button", { name: "Next table page" });
    expect(previousButton.hasAttribute("disabled")).toBe(true);
    expect(previousButton.className).not.toContain("disabled:hidden");
    expect(nextButton.className).not.toContain("disabled:hidden");

    fireEvent.click(nextButton);
    expect(requestedPage).toBe(2);
    expect(previousButton.hasAttribute("disabled")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Next table page" }));
    expect(screen.getByLabelText("Current page 3")).not.toBeNull();
    const lastPageNextButton = screen.getByRole("button", { name: "Next table page" });
    expect(lastPageNextButton.hasAttribute("disabled")).toBe(true);
    expect(lastPageNextButton.className).not.toContain("disabled:hidden");
  });

  test("cancels an unsaved draft row when changing pages", () => {
    currentTableData = { columns: ["id"], rows: [{ id: 1 }], total: 250, page: 1, page_size: 100 };
    render(<TableDataTab profile={profile} table="auth" />);

    fireEvent.click(screen.getByRole("button", { name: "Add row" }));
    expect(screen.getByRole("button", { name: "Cancel add row" })).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Next table page" }));

    expect(screen.getByRole("button", { name: "Add row" })).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Cancel add row" })).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  test("keeps the index column content-sized and centered with px-3 padding", () => {
    currentTableData = { columns: ["id"], rows: [{ id: 1 }], total: 1, page: 1, page_size: 100 };
    render(<TableDataTab profile={profile} table="auth" />);

    const header = screen.getByRole("columnheader", { name: "#" });
    const grid = header.closest("[class*='[&_tr>:first-child]:w-px']");
    expect(grid).not.toBeNull();
    expect(grid?.classList.contains("[&_tr>:first-child]:text-center")).toBe(true);
    expect(grid?.classList.contains("[&_[data-row-selector]]:justify-center")).toBe(true);
    expect(header.classList.contains("px-3")).toBe(true);
    expect(screen.getByRole("button", { name: "Select row 1" }).classList.contains("px-3")).toBe(
      true,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add row" }));
    const draftIndex = screen.getByRole("textbox").closest("tr")?.firstElementChild;
    expect(draftIndex?.textContent).toBe("2");
    expect(draftIndex?.classList.contains("px-3")).toBe(true);
  });

  test("shows global row indexes on later pages and keeps the toolbar available", () => {
    currentTableData = {
      columns: ["id"],
      rows: Array.from({ length: 28 }, (_, index) => ({ id: index + 1 })),
      total: 228,
      page: 1,
      page_size: 100,
    };
    render(<TableDataTab profile={profile} table="auth" />);

    fireEvent.click(screen.getByRole("button", { name: "Next table page" }));
    fireEvent.click(screen.getByRole("button", { name: "Next table page" }));

    expect(screen.getByRole("cell", { name: "201" })).not.toBeNull();
    expect(screen.getByRole("cell", { name: "228" })).not.toBeNull();
    expect(screen.getByRole("group", { name: "Table data view" })).not.toBeNull();
    expect(screen.getByRole("tab", { name: "Data" })).not.toBeNull();
    expect(screen.getByRole("navigation", { name: "Table data pagination" })).not.toBeNull();
  });

  test("keeps the pagination toolbar stable and disables navigation while fetching", () => {
    currentTableData = { columns: ["id"], rows: [{ id: 1 }], total: 250, page: 1, page_size: 100 };
    tableFetching = true;
    render(<TableDataTab profile={profile} table="auth" />);

    expect(screen.getByText("Loading data...")).not.toBeNull();
    expect(screen.getByRole("group", { name: "Table data view" })).not.toBeNull();
    expect(screen.getByRole("tab", { name: "Data" })).not.toBeNull();
    expect(screen.getByRole("navigation", { name: "Table data pagination" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Next table page" }).hasAttribute("disabled")).toBe(
      true,
    );
    expect(screen.getByRole("button", { name: "Add row" }).hasAttribute("disabled")).toBe(true);
  });

  test("refreshes table data and supports first and last page navigation", () => {
    currentTableData = { columns: ["id"], rows: [{ id: 1 }], total: 250, page: 1, page_size: 100 };
    const view = render(<TableDataTab profile={profile} table="auth" refreshToken={0} />);

    expect(screen.getByRole("button", { name: "First table page" }).hasAttribute("disabled")).toBe(
      true,
    );
    expect(screen.getByRole("button", { name: "Last table page" }).hasAttribute("disabled")).toBe(
      false,
    );

    fireEvent.click(screen.getByRole("button", { name: "Last table page" }));
    expect(requestedPage).toBe(3);
    expect(screen.getByLabelText("Current page 3")).not.toBeNull();
    view.rerender(<TableDataTab profile={profile} table="auth" refreshToken={1} />);
    expect(requestedPage).toBe(3);
    expect(refetchTable).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "First table page" }));
    expect(requestedPage).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: "Refresh table data" }));
    expect(refetchTable).toHaveBeenCalledTimes(2);
  });

  test("uses icon-only refresh and add-row actions and shows only the current page", () => {
    currentTableData = { columns: ["id"], rows: [{ id: 1 }], total: 250, page: 1, page_size: 100 };
    render(<TableDataTab profile={profile} table="auth" />);

    const refreshButton = screen.getByRole("button", { name: "Refresh table data" });
    const addRowButton = screen.getByRole("button", { name: "Add row" });
    expect(refreshButton.textContent).toBe("");
    expect(addRowButton.textContent).toBe("");
    expect(refreshButton.className).toContain("h-8 w-8 rounded-md");
    expect(addRowButton.className).toContain("h-8 w-8 rounded-md");
    expect(refreshButton.querySelector("svg")?.getAttribute("class")).toContain("size-5");
    expect(addRowButton.querySelector("svg")?.getAttribute("class")).toContain("size-5");
    expect(screen.getByLabelText("Current page 1").textContent).toBe("1");
    expect(screen.getByRole("navigation", { name: "Table data pagination" }).className).toContain(
      "justify-self-center",
    );
    expect(screen.queryByText("Page 1 of 3")).toBeNull();
  });

  test("shows table headers even when there are no rows", () => {
    render(<TableDataTab profile={profile} table="auth" />);

    expect(screen.getByRole("tab", { name: "Data" })).not.toBeNull();
    expect(screen.getByRole("tab", { name: "Structure" })).not.toBeNull();
    expect(screen.getByRole("tablist").className).toContain("h-8");
    expect(screen.getByRole("columnheader", { name: "#" })).not.toBeNull();
    expect(screen.getByRole("columnheader", { name: /^name/ })).not.toBeNull();
    expect(screen.getByRole("columnheader", { name: /^active/ })).not.toBeNull();
    expect(screen.getByRole("columnheader", { name: /^status/ })).not.toBeNull();
    expect(screen.getByText("varchar")).not.toBeNull();
    expect(screen.getByText("boolean")).not.toBeNull();
    expect(screen.getByText("enum")).not.toBeNull();
    expect(screen.getByRole("table").className.includes("min-w-max")).toBe(true);
    expect(document.querySelector('[data-slot="scroll-area"]')).not.toBeNull();
    expect(screen.getByRole("navigation", { name: "Table data pagination" })).not.toBeNull();
    expect(screen.getByLabelText("Current page 1")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "JSON" })).toBeNull();
    expect(screen.queryByText(/is empty/i)).toBeNull();
    expect(screen.getByRole("table").className.includes("h-full")).toBe(false);
    expect(screen.getByRole("table").className.includes("w-full")).toBe(true);
    expect(
      document
        .querySelector('[data-slot="table-container"]')
        ?.parentElement?.className.includes("h-full"),
    ).toBe(true);
  });

  test("distinguishes table headers, selects visible rows, and mutes null cells", () => {
    currentTableData = {
      columns: ["id", "empty", "literal"],
      rows: [
        { id: 1, empty: null, literal: "NULL" },
        { id: 2, empty: "filled", literal: "text" },
      ],
      total: 2,
      page: 1,
      page_size: 100,
    };
    render(<TableDataTab profile={profile} table="auth" />);

    const tableHeader = document.querySelector('[data-slot="table-header"]');
    expect(tableHeader?.className).toContain("bg-accent");
    expect(tableHeader?.className).not.toContain("/90");

    const nullCells = screen.getAllByRole("cell", { name: "NULL" });
    expect(nullCells).toHaveLength(2);
    expect(nullCells[0]?.className).toContain("text-muted-foreground/60");
    expect(nullCells[1]?.className).not.toContain("text-muted-foreground/60");

    const indexTable = document.querySelector('[data-slot="table"]');
    expect(indexTable?.querySelector('input[type="checkbox"]')).toBeNull();

    const secondRowSelector = screen.getByRole("button", { name: "Select row 2" });
    fireEvent.click(secondRowSelector);
    expect(secondRowSelector.getAttribute("aria-pressed")).toBe("true");
    expect(document.querySelector('[data-row-index="1"]')?.getAttribute("data-row-selected")).toBe(
      "true",
    );
    expect(screen.getByRole("button", { name: "Export 1 selected row as JSON" })).not.toBeNull();
  });

  test("toggles rows independently and keeps selected-row export in sync", () => {
    currentTableData = {
      columns: ["name"],
      rows: [{ name: "first" }, { name: "second" }, { name: "third" }],
      total: 3,
      page: 1,
      page_size: 100,
    };
    render(<TableDataTab profile={profile} table="auth" />);

    const firstRow = screen.getByRole("button", { name: "Select row 1" });
    const secondRow = screen.getByRole("button", { name: "Select row 2" });
    const clickRowSelector = (rowSelector: HTMLElement) => {
      fireEvent.pointerDown(rowSelector, {
        button: 0,
        buttons: 1,
        pointerId: 1,
        pointerType: "mouse",
      });
      fireEvent.pointerUp(window, { button: 0, buttons: 0, pointerId: 1, pointerType: "mouse" });
    };
    clickRowSelector(firstRow);
    clickRowSelector(secondRow);

    expect(firstRow.getAttribute("aria-pressed")).toBe("true");
    expect(secondRow.getAttribute("aria-pressed")).toBe("true");
    const exportButton = screen.getByRole("button", { name: "Export 2 selected rows as JSON" });
    const markButton = screen.getByRole("button", { name: "Mark 2 selected rows for deletion" });
    expect(exportButton.textContent).toBe("");
    expect(markButton.textContent).toBe("");

    clickRowSelector(firstRow);

    expect(firstRow.getAttribute("aria-pressed")).toBe("false");
    expect(secondRow.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Export 1 selected row as JSON" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Mark 1 selected row for deletion" })).not.toBeNull();
  });

  test("stages selected rows and deletes them in one batch on apply", async () => {
    currentTableData = {
      columns: ["name"],
      rows: [{ name: "first" }, { name: "second" }],
      total: 2,
      page: 1,
      page_size: 100,
    };
    render(<TableDataTab profile={profile} table="auth" />);

    fireEvent.click(screen.getByRole("button", { name: "Select row 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Select row 2" }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Mark 2 selected rows for deletion" }));
    });

    expect(deleteTableRows).not.toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toBe("2 pending");
    expect(screen.getByRole("button", { name: "Apply 2 pending deletions" })).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Export 2 selected rows as JSON" })).toBeNull();

    const firstRow = document.querySelector('[data-row-index="0"]');
    const secondRow = document.querySelector('[data-row-index="1"]');
    expect(firstRow?.getAttribute("data-row-pending-delete")).toBe("true");
    expect(secondRow?.getAttribute("data-row-pending-delete")).toBe("true");
    expect(firstRow?.querySelector("td:nth-child(2)")?.className).toContain("line-through");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Apply 2 pending deletions" }));
    });

    expect(deleteTableRows).toHaveBeenCalledWith(profile, "auth", undefined, [
      { name: "first" },
      { name: "second" },
    ]);
    expect(addToast).toHaveBeenCalledWith({
      title: "Deleted 2 rows",
      type: "success",
      description: "Deleted 2 rows from auth.",
    });
    expect(invalidateTableData).toHaveBeenCalledTimes(1);
    expect(refetchTable).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).toBeNull();
    expect(document.querySelector('[data-row-pending-delete="true"]')).toBeNull();
  });

  test("undoes the last marked row and cancels all pending deletions", async () => {
    currentTableData = {
      columns: ["name"],
      rows: [{ name: "first" }, { name: "second" }],
      total: 2,
      page: 1,
      page_size: 100,
    };
    render(<TableDataTab profile={profile} table="auth" />);

    fireEvent.click(screen.getByRole("button", { name: "Select row 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Select row 2" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Mark 2 selected rows for deletion" }));
    });

    fireEvent.click(screen.getByRole("button", { name: "Undo last pending deletion" }));

    expect(screen.getByRole("status").textContent).toBe("1 pending");
    expect(
      document.querySelector('[data-row-index="0"]')?.getAttribute("data-row-pending-delete"),
    ).toBe("true");
    expect(
      document.querySelector('[data-row-index="1"]')?.getAttribute("data-row-pending-delete"),
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Cancel pending deletions" }));

    expect(screen.queryByRole("status")).toBeNull();
    expect(document.querySelector('[data-row-pending-delete="true"]')).toBeNull();
    expect(deleteTableRows).not.toHaveBeenCalled();
  });

  test("keeps pending rows marked when applying the batch fails", async () => {
    currentTableData = {
      columns: ["name"],
      rows: [{ name: "first" }],
      total: 1,
      page: 1,
      page_size: 100,
    };
    deleteTableRows.mockImplementation(async () => {
      throw new Error("foreign key constraint");
    });
    render(<TableDataTab profile={profile} table="auth" />);
    fireEvent.click(screen.getByRole("button", { name: "Select row 1" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Mark 1 selected row for deletion" }));
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Apply 1 pending deletion" }));
    });

    expect(addToast).toHaveBeenCalledWith({
      title: "Could not delete rows",
      type: "error",
      description: "foreign key constraint",
    });
    expect(invalidateTableData).not.toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toBe("1 pending");
    expect(
      document.querySelector('[data-row-index="0"]')?.getAttribute("data-row-pending-delete"),
    ).toBe("true");
  });

  test("keeps pending deletions when navigating to another page", async () => {
    currentTableData = {
      columns: ["name"],
      rows: [{ name: "first" }],
      total: 250,
      page: 1,
      page_size: 100,
    };
    render(<TableDataTab profile={profile} table="auth" />);
    fireEvent.click(screen.getByRole("button", { name: "Select row 1" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Mark 1 selected row for deletion" }));
    });

    fireEvent.click(screen.getByRole("button", { name: "Next table page" }));

    expect(requestedPage).toBe(2);
    expect(screen.getByRole("status").textContent).toBe("1 pending");
    expect(
      document.querySelector('[data-row-index="0"]')?.getAttribute("data-row-pending-delete"),
    ).toBe("true");
  });

  test("disables marking rows when the table has no primary key", () => {
    schemaHasPrimaryKey = false;
    currentTableData = {
      columns: ["name"],
      rows: [{ name: "duplicate" }],
      total: 1,
      page: 1,
      page_size: 100,
    };
    render(<TableDataTab profile={profile} table="auth" />);
    fireEvent.click(screen.getByRole("button", { name: "Select row 1" }));

    const markButton = screen.getByRole("button", {
      name: "Mark 1 selected row for deletion",
    });
    expect(markButton.hasAttribute("disabled")).toBe(true);
    expect(markButton.getAttribute("title")).toBe("Cannot delete rows without a primary key");
  });

  test("drag-selects a contiguous row range from the index without a visible delay", () => {
    currentTableData = {
      columns: ["id"],
      rows: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }],
      total: 4,
      page: 1,
      page_size: 100,
    };
    render(<TableDataTab profile={profile} table="auth" />);

    fireEvent.pointerDown(screen.getByRole("button", { name: "Select row 2" }), {
      button: 0,
      buttons: 1,
      pointerId: 1,
      pointerType: "mouse",
    });
    const lastRow = document.querySelector('[data-row-index="3"]');
    if (!lastRow) throw new Error("Could not find the row used to end the selection drag");
    fireEvent.pointerEnter(lastRow, { buttons: 1, pointerId: 1, pointerType: "mouse" });

    expect(screen.getByRole("button", { name: "Select row 2" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(screen.getByRole("button", { name: "Select row 3" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(screen.getByRole("button", { name: "Select row 4" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(document.querySelector('[data-row-index="2"]')?.getAttribute("data-row-selected")).toBe(
      "true",
    );

    fireEvent.pointerUp(window, { button: 0, buttons: 0, pointerId: 1, pointerType: "mouse" });

    expect(screen.getByRole("button", { name: "Export 3 selected rows as JSON" })).not.toBeNull();
  });

  test("exports the row selected by its index and shows its count and home-relative path", async () => {
    currentTableData = {
      columns: ["id"],
      rows: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }],
      total: 4,
      page: 1,
      page_size: 100,
    };
    render(<TableDataTab profile={profile} table="auth" />);

    fireEvent.click(screen.getByRole("button", { name: "Select row 3" }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Export 1 selected row as JSON" }));
      await Promise.resolve();
    });

    const payload = serializeJson(currentTableData.columns, [currentTableData.rows[2]!]).text;
    expect(exportTableDataJson).toHaveBeenCalledWith(payload, "selected-row.json");
    expect(addToast).toHaveBeenCalledWith({
      title: "Exported 1 row",
      type: "success",
      description: "~/Downloads/selected-row.json",
    });
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
    expect((screen.getByRole("combobox", { name: "New active" }) as HTMLSelectElement).value).toBe(
      "",
    );
    expect((screen.getByRole("combobox", { name: "New status" }) as HTMLSelectElement).value).toBe(
      "",
    );
    expect(screen.getByRole("option", { name: "true" })).not.toBeNull();
    expect(screen.getByRole("option", { name: "published" })).not.toBeNull();
    expect(
      (screen.getByRole("textbox") as HTMLInputElement).className.includes("bg-primary/10"),
    ).toBe(true);
    expect(screen.getByRole("cell", { name: "1" })).not.toBeNull();
    expect(screen.queryByText("Draft row")).toBeNull();
    expect(screen.queryByRole("button", { name: "Add row" })).toBeNull();
    expect(screen.getByRole("button", { name: "Cancel add row" }).textContent).toBe("");
  });

  test("does not ask for required timestamp values and keeps nullable timestamps editable", () => {
    additionalSchemaColumns = [
      {
        name: "created_at",
        data_type: "timestamp with time zone",
        enum_values: [],
        nullable: false,
        default: null,
        is_pk: false,
        is_fk: false,
        is_unique: false,
      },
      {
        name: "optional_at",
        data_type: "timestamp without time zone",
        enum_values: [],
        nullable: true,
        default: null,
        is_pk: false,
        is_fk: false,
        is_unique: false,
      },
    ];

    render(<TableDataTab profile={profile} table="auth" />);
    fireEvent.click(screen.getByRole("button", { name: "Add row" }));

    expect(
      screen.getByRole("status", {
        name: "Current time for created_at set automatically on insert",
      }),
    ).not.toBeNull();
    expect(screen.queryByRole("textbox", { name: "New created_at" })).toBeNull();
    expect(screen.getByRole("textbox", { name: "New optional_at" })).not.toBeNull();
  });

  test("inserts the draft row, reports success, refreshes data, and clears the draft", async () => {
    render(<TableDataTab profile={profile} table="auth" />);

    fireEvent.click(screen.getByRole("button", { name: "Add row" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Ada" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Insert row" }));
    });

    expect(insertTableRow).toHaveBeenCalledWith(
      profile,
      "auth",
      undefined,
      {
        name: "Ada",
        active: "",
        status: "",
      },
      expect.any(Array),
    );
    expect(addToast).toHaveBeenCalledWith({
      title: "Row inserted",
      type: "success",
      description: "A row was added to auth.",
    });
    expect(refetchTable).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Insert row" })).toBeNull();
    expect(screen.getByRole("button", { name: "Add row" })).not.toBeNull();
  });

  test("reports insert errors and preserves the draft row for correction", async () => {
    insertTableRow.mockImplementation(async () => {
      throw new Error("constraint violation");
    });
    render(<TableDataTab profile={profile} table="auth" />);

    fireEvent.click(screen.getByRole("button", { name: "Add row" }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Insert row" }));
    });

    expect(addToast).toHaveBeenCalledWith({
      title: "Could not insert row",
      type: "error",
      description: "constraint violation",
    });
    expect(refetchTable).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Insert row" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Cancel add row" })).not.toBeNull();
  });

  test("focuses the new row editor after adding a row", () => {
    const scrollIntoViewDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "scrollIntoView",
    );
    const scrolledElements: HTMLElement[] = [];
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value(this: HTMLElement) {
        scrolledElements.push(this);
      },
    });

    try {
      render(<TableDataTab profile={profile} table="auth" />);

      fireEvent.click(screen.getByRole("button", { name: "Add row" }));

      expect(document.activeElement).toBe(screen.getByRole("textbox"));
      expect(scrolledElements).toHaveLength(1);
      expect(scrolledElements[0]?.tagName).toBe("TR");
    } finally {
      if (scrollIntoViewDescriptor) {
        Object.defineProperty(HTMLElement.prototype, "scrollIntoView", scrollIntoViewDescriptor);
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
      }
    }
  });

  test("cancels a local draft row from the data toolbar", () => {
    render(<TableDataTab profile={profile} table="auth" />);

    fireEvent.click(screen.getByRole("button", { name: "Add row" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel add row" }));

    expect(screen.getByRole("button", { name: "Add row" })).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Cancel add row" })).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
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

  test("does not show JSON actions while loading or after a data error", () => {
    tableLoading = true;
    render(<TableDataTab profile={profile} table="auth" />);
    expect(screen.queryByRole("button", { name: "JSON" })).toBeNull();
    cleanup();

    tableLoading = false;
    tableError = new Error("connection lost");
    render(<TableDataTab profile={profile} table="auth" />);
    expect(screen.queryByRole("button", { name: "JSON" })).toBeNull();
    expect(screen.getByText("Could not load data for auth.")).not.toBeNull();
  });

  test("switching to JSON does not refetch the loaded page", () => {
    currentTableData = {
      columns: ["id"],
      rows: [{ id: 1 }],
      total: 1,
      page: 1,
      page_size: 100,
    };
    render(<TableDataTab profile={profile} table="auth" />);
    expect(screen.getByRole("group", { name: "Table data view" }).className).toContain("h-8");
    expect(screen.getByRole("button", { name: "Table" }).className).toContain("text-xs");
    fireEvent.click(screen.getByRole("button", { name: "JSON" }));
    expect(refetchTable).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Table data JSON").textContent).toContain('"id": 1');
  });

  test("copies the exact displayed payload and announces success", async () => {
    currentTableData = {
      columns: ["id"],
      rows: [{ id: 1 }],
      total: 1,
      page: 1,
      page_size: 100,
    };
    const writeText = mock(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    render(<TableDataTab profile={profile} table="auth" />);
    fireEvent.click(screen.getByRole("button", { name: "JSON" }));

    const expected = serializeJson(currentTableData.columns, currentTableData.rows, {
      page: currentTableData.page,
      pageSize: currentTableData.page_size,
    }).text;
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy table data JSON" }));
      await Promise.resolve();
    });

    expect(writeText).toHaveBeenCalledWith(expected);
    expect(screen.getByText("JSON copied to clipboard.")).not.toBeNull();
    expect(screen.getByLabelText("Table data JSON")).not.toBeNull();
  });

  test("announces clipboard failure and leaves the JSON view usable", async () => {
    currentTableData = {
      columns: ["id"],
      rows: [{ id: 1 }],
      total: 1,
      page: 1,
      page_size: 100,
    };
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: mock(() => Promise.reject(new Error("denied"))) },
    });
    render(<TableDataTab profile={profile} table="auth" />);
    fireEvent.click(screen.getByRole("button", { name: "JSON" }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy table data JSON" }));
      await Promise.resolve();
    });

    expect(screen.getByText("Could not copy JSON.")).not.toBeNull();
    expect(screen.getByLabelText("Table data JSON")).not.toBeNull();
  });

  test("exports the exact displayed payload and announces success", async () => {
    currentTableData = {
      columns: ["id"],
      rows: [{ id: 1 }],
      total: 1,
      page: 1,
      page_size: 100,
    };
    const createObjectURL = mock((value: Blob) => {
      void value;
      return "blob:table-data";
    });
    const revokeObjectURL = mock(() => undefined);
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });
    const click = mock(() => undefined);
    const originalCreateElement = document.createElement.bind(document);
    document.createElement = ((tagName: string) => {
      const element = originalCreateElement(tagName);
      if (tagName === "a") element.click = click;
      return element;
    }) as typeof document.createElement;
    render(<TableDataTab profile={profile} table="auth" />);
    fireEvent.click(screen.getByRole("button", { name: "JSON" }));
    const expected = serializeJson(currentTableData.columns, currentTableData.rows, {
      page: currentTableData.page,
      pageSize: currentTableData.page_size,
    }).text;

    fireEvent.click(screen.getByRole("button", { name: "Export table data JSON" }));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0]?.[0];
    expect(blob).toBeInstanceOf(Blob);
    if (!(blob instanceof Blob)) throw new Error("Expected an exported JSON Blob");
    expect(await blob.text()).toBe(expected);
    expect(screen.getByText("JSON export started.")).not.toBeNull();
    expect(screen.getByLabelText("Table data JSON")).not.toBeNull();
  });

  test("announces export failure and leaves the JSON view usable", () => {
    currentTableData = {
      columns: ["id"],
      rows: [{ id: 1 }],
      total: 1,
      page: 1,
      page_size: 100,
    };
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: mock(() => {
        throw new Error("blocked");
      }),
    });
    render(<TableDataTab profile={profile} table="auth" />);
    fireEvent.click(screen.getByRole("button", { name: "JSON" }));
    fireEvent.click(screen.getByRole("button", { name: "Export table data JSON" }));

    expect(screen.getByText("Could not export JSON.")).not.toBeNull();
    expect(screen.getByLabelText("Table data JSON")).not.toBeNull();
  });

  test("announces export cancellation and leaves the JSON view usable", () => {
    currentTableData = {
      columns: ["id"],
      rows: [{ id: 1 }],
      total: 1,
      page: 1,
      page_size: 100,
    };
    render(<TableDataTab profile={profile} table="auth" exportJson={() => "cancelled"} />);
    fireEvent.click(screen.getByRole("button", { name: "JSON" }));
    fireEvent.click(screen.getByRole("button", { name: "Export table data JSON" }));

    expect(screen.getByText("JSON export cancelled.")).not.toBeNull();
    expect(screen.getByLabelText("Table data JSON")).not.toBeNull();
  });

  test("shows an explicit loading state while the page is loading", () => {
    tableLoading = true;
    render(<TableDataTab profile={profile} table="auth" />);

    expect(screen.getByRole("status")).not.toBeNull();
    expect(screen.getByRole("status").textContent).toMatch(/loading/i);
    expect(screen.queryByRole("button", { name: "JSON" })).toBeNull();
  });

  test("uses Results typography for table JSON instead of Interface typography", () => {
    currentTableData = {
      columns: ["id"],
      rows: [{ id: 1 }],
      total: 1,
      page: 1,
      page_size: 100,
    };
    render(<TableDataTab profile={profile} table="auth" />);
    fireEvent.click(screen.getByRole("button", { name: "JSON" }));

    expect(screen.getByLabelText("Table data JSON").getAttribute("data-font-scope")).toBe(
      "results",
    );
  });

  test("exposes selected Table/JSON state and supports keyboard activation", () => {
    currentTableData = {
      columns: ["id"],
      rows: [{ id: 1 }],
      total: 1,
      page: 1,
      page_size: 100,
    };
    render(<TableDataTab profile={profile} table="auth" />);

    const tableButton = screen.getByRole("button", { name: "Table" });
    const jsonButton = screen.getByRole("button", { name: "JSON" });
    expect(tableButton.getAttribute("aria-pressed")).toBe("true");
    expect(jsonButton.getAttribute("aria-pressed")).toBe("false");
    jsonButton.focus();
    expect(document.activeElement).toBe(jsonButton);
    fireEvent.keyDown(jsonButton, { key: "Enter" });

    expect(jsonButton.getAttribute("aria-pressed")).toBe("true");
    expect(tableButton.getAttribute("aria-pressed")).toBe("false");
  });

  test("warns for a large loaded page without requesting another page", () => {
    const rows = Array.from({ length: 10_001 }, (_, id) => ({ id }));
    currentTableData = {
      columns: ["id"],
      rows,
      total: 20_000,
      page: 2,
      page_size: 10_001,
    };
    render(<TableDataTab profile={profile} table="auth" />);
    fireEvent.click(screen.getByRole("button", { name: "JSON" }));

    expect(screen.getByText("Large page: only loaded rows are shown.")).not.toBeNull();
    expect(refetchTable).not.toHaveBeenCalled();
  }, 15_000);

  test("keeps Data JSON mode isolated from Structure and preserves it when returning", () => {
    currentTableData = {
      columns: ["id"],
      rows: [{ id: 1 }],
      total: 1,
      page: 1,
      page_size: 100,
    };
    render(<TableDataTab profile={profile} table="auth" />);
    fireEvent.click(screen.getByRole("button", { name: "JSON" }));
    expect(screen.getByLabelText("Table data JSON")).not.toBeNull();

    fireEvent.mouseDown(screen.getByRole("tab", { name: "Structure" }));
    expect(screen.queryByLabelText("Table data JSON")).toBeNull();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Data" }));

    expect(screen.getByLabelText("Table data JSON").textContent).toContain('"id": 1');
  });

  for (const count of [1, 2]) {
    test(`shows only ${count} selected rows in JSON and copies/exports the same selection`, async () => {
      currentTableData = {
        columns: ["id", "name"],
        rows: [
          { id: 1, name: "first" },
          { id: 2, name: "second" },
          { id: 3, name: "third" },
          { id: 4, name: "fourth" },
        ],
        total: 4,
        page: 1,
        page_size: 100,
      };
      const originalRows = JSON.stringify(currentTableData.rows);
      const writeText = mock(async (_text: string) => undefined);
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText },
      });
      const exportJson = mock((_text: string, _filename: string) => "success" as const);
      render(<TableDataTab profile={profile} table="auth" exportJson={exportJson} />);
      fireEvent.pointerDown(screen.getByRole("button", { name: "Select row 2" }), {
        button: 0,
        buttons: 1,
        pointerId: 1,
        pointerType: "mouse",
      });
      if (count > 1) {
        fireEvent.pointerEnter(document.querySelector('[data-row-index="2"]')!, {
          buttons: 1,
          pointerId: 1,
          pointerType: "mouse",
        });
      }
      fireEvent.pointerUp(window, { pointerId: 1, pointerType: "mouse" });
      fireEvent.click(screen.getByRole("button", { name: "JSON" }));

      const expected = serializeJson(
        currentTableData.columns,
        currentTableData.rows.slice(1, 1 + count),
      ).text;
      expect(screen.getByLabelText("Table data JSON").querySelector("pre")?.textContent).toBe(
        expected,
      );
      expect(screen.getByText(`Page 1 · ${count} selected`)).not.toBeNull();
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Copy table data JSON" }));
      });
      expect(writeText).toHaveBeenCalledWith(expected);
      fireEvent.click(screen.getByRole("button", { name: "Export table data JSON" }));
      expect(exportJson.mock.calls[0]?.[0]).toBe(expected);
      expect(JSON.stringify(currentTableData.rows)).toBe(originalRows);
      expect(refetchTable).not.toHaveBeenCalled();
    });
  }

  test("clears the selection on JSON-to-Table so the next JSON view contains every loaded row", async () => {
    currentTableData = {
      columns: ["id"],
      rows: [{ id: 1 }, { id: 2 }, { id: 3 }],
      total: 3,
      page: 1,
      page_size: 100,
    };
    const writeText = mock(async (_text: string) => undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const exportJson = mock((_text: string, _filename: string) => "success" as const);
    render(<TableDataTab profile={profile} table="auth" exportJson={exportJson} />);
    fireEvent.click(screen.getByRole("button", { name: "Select row 2" }));
    fireEvent.click(screen.getByRole("button", { name: "Table" }));
    expect(screen.getByRole("button", { name: "Export 1 selected row as JSON" })).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "JSON" }));
    expect(screen.getByLabelText("Table data JSON").querySelector("pre")?.textContent).toBe(
      serializeJson(["id"], [{ id: 2 }]).text,
    );

    fireEvent.click(screen.getByRole("button", { name: "Table" }));
    expect(screen.getByRole("button", { name: "Select row 2" }).getAttribute("aria-pressed")).toBe(
      "false",
    );
    expect(screen.queryByRole("button", { name: "Export 1 selected row as JSON" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "JSON" }));
    const expected = serializeJson(["id"], currentTableData.rows).text;
    expect(screen.getByLabelText("Table data JSON").querySelector("pre")?.textContent).toBe(
      expected,
    );
    expect(screen.getByText("Page 1 · 3 loaded")).not.toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy table data JSON" }));
    });
    expect(writeText).toHaveBeenCalledWith(expected);
    fireEvent.click(screen.getByRole("button", { name: "Export table data JSON" }));
    expect(exportJson.mock.calls[0]?.[0]).toBe(expected);
    expect(refetchTable).not.toHaveBeenCalled();
  });

  test("clears the JSON selection when the loaded rows are replaced", () => {
    currentTableData = {
      columns: ["id"],
      rows: [{ id: 1 }, { id: 2 }],
      total: 2,
      page: 1,
      page_size: 100,
    };
    const view = render(<TableDataTab profile={profile} table="auth" />);
    fireEvent.click(screen.getByRole("button", { name: "Select row 2" }));
    fireEvent.click(screen.getByRole("button", { name: "JSON" }));
    expect(screen.getByLabelText("Table data JSON").querySelector("pre")?.textContent).toBe(
      serializeJson(["id"], [{ id: 2 }]).text,
    );
    currentTableData = { ...currentTableData, rows: [{ id: 3 }, { id: 4 }] };
    view.rerender(<TableDataTab profile={profile} table="auth" />);
    expect(screen.getByLabelText("Table data JSON").querySelector("pre")?.textContent).toBe(
      serializeJson(["id"], currentTableData.rows).text,
    );
    expect(screen.getByText("Page 1 · 2 loaded")).not.toBeNull();
  });

  test("shows JSON for the loaded page and excludes a local draft row", () => {
    currentTableData = {
      columns: ["name", "active", "status"],
      rows: [{ name: "first", active: true, status: "draft" }],
      total: 4,
      page: 2,
      page_size: 1,
    };
    render(<TableDataTab profile={profile} table="auth" />);

    fireEvent.click(screen.getByRole("button", { name: "Add row" }));
    fireEvent.click(screen.getByRole("button", { name: "JSON" }));

    expect(screen.getByLabelText("Table data JSON").textContent).toContain('"first"');
    expect(screen.getByLabelText("Table data JSON").textContent).not.toContain("Draft row");
    expect(screen.getByText("Page 2 · 1 loaded")).not.toBeNull();
  });

  test("resets JSON mode when the selected table changes", () => {
    currentTableData = {
      columns: ["id"],
      rows: [{ id: 1 }],
      total: 1,
      page: 1,
      page_size: 100,
    };
    const view = render(<TableDataTab profile={profile} table="auth" />);
    fireEvent.click(screen.getByRole("button", { name: "JSON" }));
    expect(screen.getByLabelText("Table data JSON")).not.toBeNull();

    currentTableData = {
      columns: ["id"],
      rows: [{ id: 2 }],
      total: 1,
      page: 1,
      page_size: 100,
    };
    view.rerender(<TableDataTab profile={profile} table="users" />);

    expect(screen.queryByLabelText("Table data JSON")).toBeNull();
    expect(screen.getByRole("button", { name: "JSON" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Table" }).getAttribute("aria-pressed")).toBe("true");
  });
});
