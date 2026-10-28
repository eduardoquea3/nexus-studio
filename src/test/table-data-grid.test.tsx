import "./setup";
import { afterEach, expect, mock, test } from "bun:test";
import type { Table } from "@tanstack/react-table";
import type { DataPage } from "@/shared/types/models";

const renderGrid = mock(({ table }: { table: Table<Record<string, unknown>> }) => (
  <div>{table.options.data.map((row) => String(row.id)).join(",")}</div>
));
mock.module("@/shared/components/data-table", () => ({ DataTable: renderGrid }));
const { TableDataGrid } = await import("../app/connection/components/table-data-grid");
const { cleanup, render, screen } = await import("@testing-library/react");
afterEach(() => {
  cleanup();
  renderGrid.mockClear();
});

test("skips unchanged grid renders without freezing data or draft updates", () => {
  const data: DataPage = { columns: ["id"], rows: [{ id: 1 }], total: 1, page: 1, page_size: 100 };
  const { rerender } = render(<TableDataGrid data={data} />);
  rerender(<TableDataGrid data={data} />);
  expect(renderGrid).toHaveBeenCalledTimes(1);
  rerender(<TableDataGrid data={{ ...data, rows: [{ id: 2 }] }} />);
  expect(screen.getByText("2")).not.toBeNull();
  expect(renderGrid).toHaveBeenCalledTimes(2);
  const draftRow = { id: 3 };
  rerender(<TableDataGrid data={data} draftRow={draftRow} />);
  expect(renderGrid.mock.calls[renderGrid.mock.calls.length - 1]?.[0]).toMatchObject({ draftRow });
});
