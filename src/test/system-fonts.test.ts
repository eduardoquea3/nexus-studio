import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";

const invoke = mock<(...args: unknown[]) => Promise<string[]>>(async () => []);
const isTauri = mock(() => true);
const queryLocalFonts = mock(async () => [{ family: "Inter" }]);
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
let moduleId = 0;
let listSystemFonts: typeof import("../shared/lib/tauriApi").listSystemFonts;
let preloadSystemFonts: () => void;

mock.module("@tauri-apps/api/core", () => ({ invoke, isTauri }));
mock.module("@tauri-apps/plugin-store", () => ({ load: async () => undefined }));

beforeEach(async () => {
  invoke.mockReset();
  isTauri.mockReturnValue(true);
  queryLocalFonts.mockReset();
  Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
  // Each module instance represents a fresh application session.
  const api = await import(`../shared/lib/tauriApi.ts?font-session=${moduleId++}`);
  listSystemFonts = api.listSystemFonts;
  preloadSystemFonts = api.preloadSystemFonts;
});

afterAll(() => {
  if (originalWindow) {
    Object.defineProperty(globalThis, "window", originalWindow);
  } else {
    Reflect.deleteProperty(globalThis, "window");
  }
});

describe("system font discovery", () => {
  test("reuses the installed font list across Settings visits", async () => {
    invoke.mockResolvedValue(["Inter", "JetBrains Mono"]);

    expect(await listSystemFonts()).toEqual(["Inter", "JetBrains Mono"]);
    expect(await listSystemFonts()).toEqual(["Inter", "JetBrains Mono"]);
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith("list_system_fonts");
  });

  test("shares an unfinished startup preload with simultaneous Settings requests", async () => {
    let finish!: (fonts: string[]) => void;
    invoke.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));

    expect(preloadSystemFonts()).toBeUndefined();
    const firstVisit = listSystemFonts();
    const repeatedMount = listSystemFonts();
    expect(invoke).toHaveBeenCalledTimes(1);

    finish(["Inter"]);
    expect(await Promise.all([firstVisit, repeatedMount])).toEqual([
      ["Inter"], ["Inter"],
    ]);
  });

  test("retries after a failed preload instead of caching the rejection", async () => {
    const error = new Error("Font discovery unavailable");
    invoke.mockRejectedValueOnce(error);

    preloadSystemFonts();
    await new Promise((resolve) => setTimeout(resolve, 0));
    invoke.mockResolvedValue(["Inter"]);
    expect(await listSystemFonts()).toEqual(["Inter"]);
    expect(await listSystemFonts()).toEqual(["Inter"]);
    expect(invoke).toHaveBeenCalledTimes(2);
  });

  test("does not request local font permissions during browser startup", () => {
    isTauri.mockReturnValue(false);
    Object.assign(window, { queryLocalFonts });

    expect(preloadSystemFonts()).toBeUndefined();
    expect(invoke).not.toHaveBeenCalled();
    expect(queryLocalFonts).not.toHaveBeenCalled();
  });

  test("preserves and caches the sorted, deduplicated browser fallback", async () => {
    invoke.mockRejectedValue(new Error("Native fonts unavailable"));
    queryLocalFonts.mockResolvedValue([
      { family: "Roboto" }, { family: "Inter" }, { family: "Roboto" },
    ]);
    Object.assign(window, { queryLocalFonts });

    expect(await listSystemFonts()).toEqual(["Inter", "Roboto"]);
    expect(await listSystemFonts()).toEqual(["Inter", "Roboto"]);
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(queryLocalFonts).toHaveBeenCalledTimes(1);
  });

  test("retries after the browser fallback fails", async () => {
    invoke.mockRejectedValue(new Error("Native fonts unavailable"));
    const error = new Error("Font permission denied");
    queryLocalFonts.mockRejectedValueOnce(error);
    Object.assign(window, { queryLocalFonts });

    await expect(listSystemFonts()).rejects.toBe(error);
    queryLocalFonts.mockResolvedValue([{ family: "Inter" }]);
    expect(await listSystemFonts()).toEqual(["Inter"]);
    expect(await listSystemFonts()).toEqual(["Inter"]);
    expect(queryLocalFonts).toHaveBeenCalledTimes(2);
  });
});
