import "./setup";
import { describe, expect, test } from "bun:test";

import {
  buildRowIdentity,
  serializeRowIdentity,
} from "@/app/connection/services/table-data-row-identity";

describe("buildRowIdentity", () => {
  test("keeps only primary-key columns", () => {
    expect(
      buildRowIdentity({ tenant_id: 1, user_id: "first", name: "Ada" }, [
        { name: "tenant_id" },
        { name: "user_id" },
      ]),
    ).toEqual({ tenant_id: 1, user_id: "first" });
  });

  test("returns null when the table has no primary key", () => {
    expect(buildRowIdentity({ id: 1 }, [])).toBeNull();
  });

  test("returns null when any primary-key value is missing", () => {
    expect(buildRowIdentity({ tenant_id: 1, user_id: null }, [{ name: "user_id" }])).toBeNull();
    expect(
      buildRowIdentity({ tenant_id: 1 }, [{ name: "tenant_id" }, { name: "user_id" }]),
    ).toBeNull();
  });
});

describe("serializeRowIdentity", () => {
  test("is stable regardless of key order", () => {
    const first = serializeRowIdentity({ tenant_id: 1, user_id: "first" });
    const second = serializeRowIdentity({ user_id: "first", tenant_id: 1 });

    expect(first).toBe(second);
  });

  test("distinguishes numeric and string values", () => {
    expect(serializeRowIdentity({ id: 1 })).not.toBe(serializeRowIdentity({ id: "1" }));
  });
});
