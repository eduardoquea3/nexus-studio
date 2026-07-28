import "./setup";

import { afterEach, describe, expect, mock, test } from "bun:test";

mock.module("@/app/connection/hooks/use-table-data", () => ({
  useTableData: () => ({
    data: {
      columns: [],
      rows: [],
      total: 0,
      page: 1,
      page_size: 100,
    },
    error: null,
    isLoading: false,
    refetch: mock(() => Promise.resolve()),
  }),
}));

mock.module("@/app/connection/hooks/use-table-schema", () => ({
  useTableSchema: () => ({
    data: {
      columns: [
        { name: "name", data_type: "varchar", nullable: false, default: null, is_pk: false, is_fk: false, is_unique: false },
        { name: "type", data_type: "varchar", nullable: false, default: null, is_pk: false, is_fk: false, is_unique: false },
      ],
      indexes: [],
    },
    error: null,
    isLoading: false,
    refetch: mock(() => Promise.resolve()),
  }),
}));

const { TableDataTab } = await import("../app/connection/components/table-data-tab");
const { cleanup, render, screen } = await import("@testing-library/react");

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
  });

  test("shows table headers even when there are no rows", () => {
    render(<TableDataTab profile={profile} table="auth" />);

    expect(screen.getByRole("tab", { name: "Data" })).not.toBeNull();
    expect(screen.getByRole("tab", { name: "Structure" })).not.toBeNull();
    expect(screen.getByRole("columnheader", { name: "name" })).not.toBeNull();
    expect(screen.getByRole("columnheader", { name: "type" })).not.toBeNull();
    expect(screen.getByText("0 rows")).not.toBeNull();
    expect(screen.getByText("Showing 0")).not.toBeNull();
    expect(screen.queryByText(/is empty/i)).toBeNull();
  });
});
