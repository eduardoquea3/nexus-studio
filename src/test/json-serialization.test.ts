import { describe, expect, test } from "bun:test";

import { exceedsJsonRenderThreshold, serializeJson } from "@/shared/lib/json-serialization";

describe("serializeJson", () => {
  test("projects rows in ordered columns and preserves an empty result", () => {
    expect(serializeJson(["second", "first"], [{ first: 1, second: "two" }]).text).toBe(
      '[\n  {\n    "second": "two",\n    "first": 1\n  }\n]',
    );
    expect(serializeJson(["id", "name"], []).text).toBe("[]");
  });

  test("keeps supported values native and reports loss-aware special values", () => {
    const payload = serializeJson(["nullish", "active", "amount", "date", "bytes", "nan", "nested"], [
      {
        nullish: null,
        active: true,
        amount: 12.5,
        date: new Date("2024-01-02T03:04:05.000Z"),
        bytes: new Uint8Array([1, 2, 255]),
        nan: Number.NaN,
        nested: { value: undefined },
      },
    ]);

    expect(JSON.parse(payload.text)).toEqual([
      {
        nullish: null,
        active: true,
        amount: 12.5,
        date: "2024-01-02T03:04:05.000Z",
        bytes: "base64:AQL/",
        nan: "[non-finite: NaN]",
        nested: { value: null },
      },
    ]);
    expect(payload.issues).toEqual([
      { path: "$[0].bytes", message: "Bytes were encoded as base64.", representation: "string" },
      { path: "$[0].nan", message: "Non-finite number was represented as text.", representation: "string" },
      { path: "$[0].nested.value", message: "Unsupported value was represented as null.", representation: "null" },
    ]);
  });

  test("includes page scope metadata without changing displayed text", () => {
    expect(serializeJson(["id"], [{ id: 7 }], { page: 2, pageSize: 10 }).scope).toEqual({
      page: 2,
      pageSize: 10,
      loadedCount: 1,
    });
  });

  test("recovers unsupported, invalid, and circular nested values", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const payload = serializeJson(["bigint", "function", "symbol", "invalidDate", "circular"], [{
      bigint: BigInt(42),
      function: () => undefined,
      symbol: Symbol("secret"),
      invalidDate: new Date("invalid"),
      circular,
    }]);

    expect(JSON.parse(payload.text)).toEqual([{
      bigint: "42n",
      function: null,
      symbol: null,
      invalidDate: "[non-finite: NaN]",
      circular: { self: null },
    }]);
    expect(payload.issues.map((issue) => issue.path)).toEqual([
      "$[0].bigint",
      "$[0].function",
      "$[0].symbol",
      "$[0].invalidDate",
      "$[0].circular.self",
    ]);
  });

  test("reports the loaded-row rendering boundary", () => {
    expect(exceedsJsonRenderThreshold(10_000)).toBe(false);
    expect(exceedsJsonRenderThreshold(10_001)).toBe(true);
  });
});
