import "./setup";
import { afterEach, expect, mock, test } from "bun:test";

import { ConnectionDatabaseSelectorPortal } from "@/app/connection/components/connection-database-selector";

const onDatabaseChange = mock(() => undefined);
const databases = [
  { value: "master", label: "master" },
  { value: "analytics", label: "analytics" },
  { value: "analytics-long", label: "analytics-production-warehouse-2025-readonly" },
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
  expect(databaseBadge.querySelector("span.truncate")?.textContent).toBe("master");
  expect(databaseBadge.className).toContain("max-w-56");
  fireEvent.click(databaseBadge);
  const analyticsOption = await screen.findByRole("option", { name: "analytics" });
  const optionList = analyticsOption.closest('[data-slot="select-content"]');
  expect(optionList?.className).toContain("w-max");
  expect(optionList?.className).toContain("min-w-(--anchor-width)");
  expect(optionList?.className).toContain("max-w-72");
  expect(analyticsOption.className).toContain("pr-8");
  expect(analyticsOption.firstElementChild?.className).toContain("min-w-0");

  const longNameOption = await screen.findByRole("option", {
    name: "analytics-production-warehouse-2025-readonly",
  });
  expect(longNameOption.querySelector("span.truncate")?.textContent).toBe(
    "analytics-production-warehouse-2025-readonly",
  );
  expect(longNameOption.querySelector("span.truncate")?.className).not.toContain("hidden");

  const selectedOption = await screen.findByRole("option", { name: "master" });
  expect(selectedOption.querySelector("span.absolute.right-2 svg")).not.toBeNull();
});
