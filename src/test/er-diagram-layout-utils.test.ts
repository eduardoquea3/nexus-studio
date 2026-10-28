import { describe, expect, test } from "bun:test";

import {
  ELK_COLUMN_LIMIT,
  ELK_RELATIONSHIP_LIMIT,
  ELK_TABLE_LIMIT,
  getGridPosition,
  shouldUseElkLayout,
} from "@/app/connection/components/er-diagram-layout-utils";

describe("ER diagram layout limits", () => {
  test("uses ELK for schemas below all graph limits", () => {
    expect(shouldUseElkLayout(ELK_TABLE_LIMIT, ELK_RELATIONSHIP_LIMIT, ELK_COLUMN_LIMIT)).toBe(
      true,
    );
  });

  test("switches to the lower-memory grid when any graph dimension exceeds its limit", () => {
    expect(shouldUseElkLayout(ELK_TABLE_LIMIT + 1, 0, 0)).toBe(false);
    expect(shouldUseElkLayout(0, ELK_RELATIONSHIP_LIMIT + 1, 0)).toBe(false);
    expect(shouldUseElkLayout(0, 0, ELK_COLUMN_LIMIT + 1)).toBe(false);
  });

  test("places grid nodes in six spaced columns", () => {
    expect(getGridPosition(0)).toEqual({ x: 24, y: 24 });
    expect(getGridPosition(6)).toEqual({ x: 24, y: 524 });
  });
});
