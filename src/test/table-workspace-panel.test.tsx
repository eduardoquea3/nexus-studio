import "./setup";
import { afterEach, expect, mock, test } from "bun:test";
import type { ConnectionProfile } from "@/shared/types/models";

const renderTable = mock(
  (props: {
    profile: ConnectionProfile;
    table: string;
    isActive: boolean;
    refreshToken: number;
  }) => <div>{props.table}</div>,
);
mock.module("@/app/connection/components/table-data-tab", () => ({ TableDataTab: renderTable }));
const { TableWorkspacePanel } = await import("../app/connection/components/table-workspace-panel");
const { cleanup, render } = await import("@testing-library/react");
afterEach(() => {
  cleanup();
  renderTable.mockClear();
});

const profile = {
  id: "connection-1",
  name: "Test",
  db_type: "postgres",
  ssh_tunnel: null,
  connect_mode: {
    type: "fields",
    host: "localhost",
    port: 5432,
    database: "master",
    username: "postgres",
    password_ref: null,
  },
} satisfies ConnectionProfile;

test("skips unchanged inactive table renders and reuses its database profile on activation", () => {
  const props = {
    profile,
    database: "sales",
    table: "sale",
    schema: "public",
    isActive: false,
    refreshToken: 0,
  };
  const { rerender } = render(<TableWorkspacePanel {...props} />);
  const tableProfile = renderTable.mock.calls[0]?.[0]?.profile;
  expect(tableProfile?.connect_mode).toEqual({ ...profile.connect_mode, database: "sales" });
  rerender(<TableWorkspacePanel {...props} />);
  expect(renderTable).toHaveBeenCalledTimes(1);
  rerender(<TableWorkspacePanel {...props} isActive />);
  expect(renderTable).toHaveBeenCalledTimes(2);
  expect(renderTable.mock.calls[1]?.[0]?.profile).toBe(tableProfile);
  rerender(<TableWorkspacePanel {...props} isActive refreshToken={1} />);
  expect(renderTable.mock.calls[2]?.[0]?.refreshToken).toBe(1);
  rerender(<TableWorkspacePanel {...props} database="analytics" />);
  expect(renderTable.mock.calls[3]?.[0]?.profile.connect_mode).toEqual({
    ...profile.connect_mode,
    database: "analytics",
  });
});
