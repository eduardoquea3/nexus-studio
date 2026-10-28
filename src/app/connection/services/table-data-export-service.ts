import { save } from "@tauri-apps/plugin-dialog";

import { writeJsonFile } from "@/shared/lib/tauriApi";

export type TableDataExportResult =
  | { status: "success"; path: string }
  | { status: "cancelled" }
  | { status: "error"; message: string };

export async function exportTableDataJson(
  text: string,
  filename: string,
): Promise<TableDataExportResult> {
  try {
    const path = await save({
      defaultPath: filename,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (!path) return { status: "cancelled" };

    return { status: "success", path: await writeJsonFile(path, text) };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
