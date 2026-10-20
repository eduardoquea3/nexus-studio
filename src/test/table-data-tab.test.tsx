import "./setup";
import type { ReactNode } from "react";

import { afterEach, describe, expect, mock, test } from "bun:test";

import type { DataPage } from "@/shared/types/models";

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
const refetchTable = mock(() => Promise.resolve());
const exportTableDataJson = mock(async () => ({
  status: "success" as const,
  path: "~/Downloads/selected-row.json",
}));
const addToast = mock((_options: unknown) => "toast-1");

mock.module("@/app/connection/services/table-data-export-service", () => ({
  exportTableDataJson,
}));

mock.module("@/components/ui/toast", () => ({ toast: { add: addToast } }));

mock.module("@/app/connection/hooks/use-table-data", () => ({
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
          is_pk: true,
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
  }: {
    ariaLabel: string;
    text: string;
    meta?: string;
    actions?: ReactNode;
    largeMessage?: string;
  }) => (
    <div aria-label={ariaLabel}>
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
    refetchTable.mockClear();
    exportTableDataJson.mockClear();
    exportTableDataJson.mockImplementation(async () => ({
      status: "success",
      path: "~/Downloads/selected-row.json",
    }));
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
    expect(refreshButton.className).toContain("h-8 w-8 bg-muted/90");
    expect(addRowButton.className).toContain("h-8 w-8 bg-muted/90");
    expect(refreshButton.querySelector("svg")?.getAttribute("class")).toContain("size-5");
    expect(addRowButton.querySelector("svg")?.getAttribute("class")).toContain("size-5");
    expect(screen.getByLabelText("Current page 1").textContent).toBe("1");
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
