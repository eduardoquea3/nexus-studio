import "./setup";
import { afterEach, expect, mock, test } from "bun:test";

import { ConnectionDatabaseSelectorPortal } from "@/app/connection/components/connection-database-selector";

const onDatabaseChange = mock(() => undefined);
const databases = [
  { value: "master", label: "master" },
  { value: "analytics", label: "analytics" },
];

const { cleanup, fireEvent, render, screen } = await import("@testing-library/react");

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  onDatabaseChange.mockClear();
});

test("portals the database badge into the title bar and lists databases", async () => {
  const titleBarSlot = document.createElement("div");
  titleBarSlot.dataset.slot = "title-bar-database-switcher";
  document.body.append(titleBarSlot);

  render(
    <ConnectionDatabaseSelectorPortal
      databases={databases}
      selectedDatabase="master"
      onDatabaseChange={onDatabaseChange}
      isLoading={false}
      hasError={false}
    />,
  );

  const databaseBadge = await screen.findByRole("combobox");
  expect(titleBarSlot.contains(databaseBadge)).toBe(true);
  fireEvent.click(databaseBadge);
  const analyticsOption = await screen.findByRole("option", { name: "analytics" });
  expect(analyticsOption.className).toContain("pr-8");
});
