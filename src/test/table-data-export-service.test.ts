import "./setup";

import { beforeEach, describe, expect, mock, test } from "bun:test";

let selectedPath: string | null = "/home/user/Downloads/selected-rows.json";
let writeError: Error | null = null;
const saveDialog = mock(async (_options: unknown) => selectedPath);
const writeJsonFile = mock(async (_path: string, _contents: string) => {
  if (writeError) throw writeError;
  return "~/Downloads/selected-rows.json";
});

mock.module("@tauri-apps/plugin-dialog", () => ({ save: saveDialog }));
mock.module("@/shared/lib/tauriApi", () => ({ writeJsonFile }));

const { exportTableDataJson } = await import(
  "../app/connection/services/table-data-export-service"
);

describe("table data export service", () => {
  beforeEach(() => {
    selectedPath = "/home/user/Downloads/selected-rows.json";
    writeError = null;
    saveDialog.mockClear();
    writeJsonFile.mockClear();
  });

  test("writes the selected JSON path and returns its display path", async () => {
    const result = await exportTableDataJson('[{"id":1}]', "selected-rows.json");

    expect(saveDialog).toHaveBeenCalledWith({
      defaultPath: "selected-rows.json",
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    expect(writeJsonFile).toHaveBeenCalledWith(
      "/home/user/Downloads/selected-rows.json",
      '[{"id":1}]',
    );
    expect(result).toEqual({ status: "success", path: "~/Downloads/selected-rows.json" });
  });

  test("does not write a file when the save dialog is cancelled", async () => {
    selectedPath = null;

    await expect(exportTableDataJson("[]", "selected-rows.json")).resolves.toEqual({
      status: "cancelled",
    });
    expect(writeJsonFile).not.toHaveBeenCalled();
  });

  test("reports file write errors", async () => {
    writeError = new Error("permission denied");

    await expect(exportTableDataJson("[]", "selected-rows.json")).resolves.toEqual({
      status: "error",
      message: "permission denied",
    });
  });
});
