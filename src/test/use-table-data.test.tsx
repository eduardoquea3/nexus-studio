import "./setup";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, mock, test } from "bun:test";

import type { ConnectionProfile, DataPage } from "@/shared/types/models";

const tableData: DataPage = {
  columns: ["id"],
  rows: [{ id: 1 }],
  total: 1,
  page: 1,
  page_size: 100,
};
const getTableData = mock(async () => tableData);

mock.module("@/shared/lib/tauriApi", () => ({ getTableData }));

const { tableDataQueryKey, useInvalidateTableData, useTableData } =
  await import("@/app/connection/hooks/use-table-data");
const { act, cleanup, fireEvent, render, screen, waitFor } = await import("@testing-library/react");

const profileFor = (database: string) =>
  ({
    id: "connection-1",
    name: "Test connection",
    db_type: "postgres",
    connect_mode: {
      type: "fields",
      host: "localhost",
      port: 5432,
      database,
      username: "test",
    },
    ssh_tunnel: null,
  }) as ConnectionProfile;

function TableDataProbe({
  profile,
  enabled = true,
}: {
  profile: ConnectionProfile;
  enabled?: boolean;
}) {
  const { data } = useTableData(profile, "users", undefined, 1, enabled);
  return <output>{data?.rows.length ?? 0}</output>;
}

function renderProbe(queryClient: QueryClient, profile: ConnectionProfile, enabled = true) {
  return render(
    <QueryClientProvider client={queryClient}>
      <TableDataProbe profile={profile} enabled={enabled} />
    </QueryClientProvider>,
  );
}

function InvalidateProbe({ profile }: { profile: ConnectionProfile }) {
  const invalidateTableData = useInvalidateTableData(profile, "users");
  return (
    <button type="button" aria-label="Invalidate table data" onClick={invalidateTableData}>
      Invalidate
    </button>
  );
}

describe("useTableData cache behavior", () => {
  afterEach(() => {
    cleanup();
    getTableData.mockClear();
  });

  test("reuses table data on tab re-entry and fetches when the database changes", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = renderProbe(queryClient, profileFor("development"));

    await waitFor(() => expect(getTableData).toHaveBeenCalledTimes(1));
    view.unmount();
    renderProbe(queryClient, profileFor("development"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(getTableData).toHaveBeenCalledTimes(1);

    cleanup();
    renderProbe(queryClient, profileFor("analytics"));
    await waitFor(() => expect(getTableData).toHaveBeenCalledTimes(2));
    queryClient.clear();
  });

  test("does not fetch inactive table data and fetches when activated", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const profile = profileFor("development");
    const view = renderProbe(queryClient, profile, false);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(getTableData).not.toHaveBeenCalled();

    act(() => {
      view.rerender(
        <QueryClientProvider client={queryClient}>
          <TableDataProbe profile={profile} enabled />
        </QueryClientProvider>,
      );
    });
    await waitFor(() => expect(getTableData).toHaveBeenCalledTimes(1));

    view.unmount();
    renderProbe(queryClient, profile, true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(getTableData).toHaveBeenCalledTimes(1);
    queryClient.clear();
  });

  test("invalidates every cached page for the table without touching other tables", async () => {
    const queryClient = new QueryClient();
    const profile = profileFor("development");
    const firstPageKey = tableDataQueryKey(profile.id, "development", undefined, "users", 1);
    const secondPageKey = tableDataQueryKey(profile.id, "development", undefined, "users", 2);
    const otherTableKey = tableDataQueryKey(profile.id, "development", undefined, "orders", 1);
    queryClient.setQueryData(firstPageKey, tableData);
    queryClient.setQueryData(secondPageKey, { ...tableData, page: 2 });
    queryClient.setQueryData(otherTableKey, tableData);

    render(
      <QueryClientProvider client={queryClient}>
        <InvalidateProbe profile={profile} />
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Invalidate table data" }));

    await waitFor(() => {
      expect(queryClient.getQueryState(firstPageKey)?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(secondPageKey)?.isInvalidated).toBe(true);
    });
    expect(queryClient.getQueryState(otherTableKey)?.isInvalidated).toBe(false);
    queryClient.clear();
  });
});
