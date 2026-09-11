export type JsonActionResult = "success" | "error" | "cancelled";
type DownloadHandler = (text: string) => void | "cancelled";

export async function copyJsonToClipboard(text: string): Promise<JsonActionResult> {
  try {
    if (!navigator.clipboard?.writeText) {
      return "error";
    }
    await navigator.clipboard.writeText(text);
    return "success";
  } catch {
    return "error";
  }
}

export function exportJsonFile(
  text: string,
  filename: string,
  download: DownloadHandler = (value) => downloadJsonText(value, filename),
): JsonActionResult {
  try {
    return download(text) === "cancelled" ? "cancelled" : "success";
  } catch {
    return "error";
  }
}

function downloadJsonText(text: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
