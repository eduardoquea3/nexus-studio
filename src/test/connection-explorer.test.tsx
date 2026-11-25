import "./setup";
import { afterEach, expect, mock, test } from "bun:test";
import type { ReactNode } from "react";
import type { ColumnInfo, ObjectMeta } from "@/shared/types/models";

const MockFileItem = ({ children }: { children: ReactNode }) => <div>{children}</div>;
const MockFiles = ({ children }: { children: ReactNode }) => <div>{children}</div>;
const MockFolderContent = ({ children }: { children: ReactNode }) => <div>{children}</div>;
const MockFolderItem = ({ children }: { children: ReactNode }) => <div>{children}</div>;
const MockFolderTrigger = ({ children }: { children: ReactNode }) => (
  <button type="button">{children}</button>
);

mock.module("@/components/animate-ui/components/radix/files", () => ({
  FileItem: MockFileItem,
  Files: MockFiles,
  FolderContent: MockFolderContent,
  FolderItem: MockFolderItem,
  FolderTrigger: MockFolderTrigger,
}));

const { cleanup, fireEvent, render, screen } = await import("@testing-library/react");
const { ConnectionExplorer } = await import("../app/connection/components/connection-explorer");

afterEach(() => cleanup());

test("shows an expandable database-object tree with grouped metadata and counts", () => {
  const resourceKey = "connection-1:public:account";
  const columns = [
    { name: "left_id", data_type: "integer" },
    { name: "right_id", data_type: "integer" },
  ] as ColumnInfo[];
  const toggleTable = mock(() => undefined);
  render(
    <ConnectionExplorer
      dbType="postgres"
      schemaObjects={[{ name: "account", schema: "public", object_type: "table" } as ObjectMeta]}
      isLoading={false}
      error={null}
      isFetching={false}
      refetch={() => undefined}
      filterText=""
      setFilterText={() => undefined}
      normalizedFilter=""
      openGroups={["tables"]}
      setOpenGroups={() => undefined}
      expandedTables={[resourceKey]}
      tableColumns={{ [resourceKey]: columns }}
      loadingTables={{}}
      tableSchemaErrors={{}}
      tableMetadata={{
        [resourceKey]: {
          columns,
          foreignKeys: [
            {
              name: "fk_pair",
              column: "left_id",
              referencedTable: "target",
              referencedColumn: "a",
            },
            {
              name: "fk_pair",
              column: "right_id",
              referencedTable: "target",
              referencedColumn: "b",
            },
          ],
          indexes: [
            { name: "pk_pair", column: "left_id", isPrimary: true, isUnique: true },
            { name: "idx_pair", column: "left_id", isPrimary: false, isUnique: true },
            { name: "idx_pair", column: "right_id", isPrimary: false, isUnique: true },
          ],
        },
      }}
      tableResourceKey={(schema, table) => `connection-1:${schema ?? ""}:${table}`}
      toggleTable={toggleTable}
      onTableSelect={() => undefined}
      onRoutineSelect={() => undefined}
    />,
  );

  const columnsGroup = screen.getByRole("button", { name: "Columns" });
  const keysGroup = screen.getByRole("button", { name: "Keys" });
  const foreignKeysGroup = screen.getByRole("button", { name: "Foreign keys" });
  const indexesGroup = screen.getByRole("button", { name: "Indexes" });
  expect(columnsGroup.textContent).toContain("2");
  expect(keysGroup.textContent).toContain("2");
  expect(foreignKeysGroup.textContent).toContain("1");
  expect(indexesGroup.textContent).toContain("2");
  expect(screen.queryByText("left_id")).toBeNull();

  fireEvent.click(columnsGroup);
  expect(screen.getByText("left_id")).not.toBeNull();
  fireEvent.click(keysGroup);
  expect(screen.getByText("pk_pair: left_id · primary · unique")).not.toBeNull();
  expect(screen.getByText("idx_pair: left_id, right_id · unique")).not.toBeNull();
  fireEvent.click(keysGroup);
  fireEvent.click(foreignKeysGroup);
  expect(screen.getByText("fk_pair: left_id → target.a, right_id → target.b")).not.toBeNull();
  fireEvent.click(indexesGroup);
  expect(screen.getByText("idx_pair: left_id, right_id · unique")).not.toBeNull();
  expect(toggleTable).not.toHaveBeenCalled();
});

test("uses distinct theme colors for common SQL column type groups", () => {
  const resourceKey = "connection-1:public:account";
  const columns = [
    { name: "id", data_type: "integer" },
    { name: "name", data_type: "character varying" },
    { name: "created_at", data_type: "timestamp with time zone" },
    { name: "enabled", data_type: "boolean" },
    { name: "metadata", data_type: "USER-DEFINED" },
    { name: "legacy_id", data_type: "mediumint" },
    { name: "short_name", data_type: "varchar(255)" },
    { name: "changed_at", data_type: "datetime" },
  ] as ColumnInfo[];

  render(
    <ConnectionExplorer
      dbType="postgres"
      schemaObjects={[{ name: "account", schema: "public", object_type: "table" } as ObjectMeta]}
      isLoading={false}
      error={null}
      isFetching={false}
      refetch={() => undefined}
      filterText=""
      setFilterText={() => undefined}
      normalizedFilter=""
      openGroups={["tables"]}
      setOpenGroups={() => undefined}
      expandedTables={[resourceKey]}
      tableColumns={{ [resourceKey]: columns }}
      loadingTables={{}}
      tableSchemaErrors={{}}
      tableResourceKey={(schema, table) => `connection-1:${schema ?? ""}:${table}`}
      toggleTable={() => undefined}
      onTableSelect={() => undefined}
      onRoutineSelect={() => undefined}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "Columns" }));
  expect(screen.getByText("INT").className).toContain("bg-primary/15");
  for (const typeBadge of screen.getAllByText("VCHAR")) {
    expect(typeBadge.className).toContain("bg-success/15");
  }
  expect(screen.getByText("TSTZ").className).toContain("bg-warning/15");
  expect(screen.getByText("DTIME").className).toContain("bg-warning/15");
  expect(screen.getByText("BOOL").className).toContain("bg-accent");
  expect(screen.getByText("OTHER").className).toContain("bg-secondary");
  expect(screen.getByText("MINT").className).toContain("bg-primary/15");
  expect(
    [...screen.getAllByText(/^(INT|VCHAR|TSTZ|BOOL|OTHER|MINT|DTIME)$/)].every(
      (badge) => (badge.textContent ?? "").length <= 6,
    ),
  ).toBe(true);
  expect(screen.getByTitle("name: character varying")).not.toBeNull();
  expect(screen.getByTitle("short_name: varchar(255)")).not.toBeNull();
});
