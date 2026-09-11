import "./setup";

import { beforeEach, describe, expect, mock, test } from "bun:test";

import { copyJsonToClipboard, exportJsonFile } from "@/shared/lib/json-actions";

describe("JSON actions", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: mock(() => Promise.resolve()) },
    });
  });

  test("copies the exact displayed payload", async () => {
    const result = await copyJsonToClipboard('{"name":"Ada"}');

    expect(result).toBe("success");
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('{"name":"Ada"}');
  });

  test("reports clipboard errors without throwing", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: mock(() => Promise.reject(new Error("denied"))) },
    });

    await expect(copyJsonToClipboard("[]")).resolves.toBe("error");
  });

  test("exports the exact payload and reports an explicit cancelled download", () => {
    const downloaded: string[] = [];
    const success = exportJsonFile("[\n  1\n]", "result.json", (text) => {
      downloaded.push(text);
    });
    const cancelled = exportJsonFile("[]", "result.json", () => "cancelled");

    expect(success).toBe("success");
    expect(downloaded).toEqual(["[\n  1\n]"]);
    expect(cancelled).toBe("cancelled");
  });

  test("reports actual download failures as errors", () => {
    const failed = exportJsonFile("[]", "result.json", () => {
      throw new Error("permission denied");
    });

    expect(failed).toBe("error");
  });
});
