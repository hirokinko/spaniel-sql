import assert from "node:assert";
import { describe, it } from "node:test";

import {
  createOrderByClause,
  createOrderByColumn,
  isValidSortDirection,
  validateOrderByClause,
} from "../src/select-utils.js";

describe("ORDER BY Utilities", () => {
  it("should create order by column", () => {
    const col = createOrderByColumn("name", "DESC", true);
    assert.deepStrictEqual(col, { column: "name", direction: "DESC", nullsFirst: true });
  });

  it("should check valid sort direction", () => {
    assert.ok(isValidSortDirection("ASC"));
    assert.ok(isValidSortDirection("DESC"));
    assert.ok(!isValidSortDirection("INVALID"));
  });

  it("should create order by clause", () => {
    const col = createOrderByColumn("name");
    const clause = createOrderByClause([col]);
    assert.deepStrictEqual(clause, { columns: [col] });
  });

  it("should validate order by clause", () => {
    const col = createOrderByColumn("name", "ASC");
    const valid = validateOrderByClause(createOrderByClause([col]));
    assert.ok(valid.valid);

    const badCol = { column: "name", direction: "INVALID" } as any;
    const invalid = validateOrderByClause(createOrderByClause([badCol]));
    assert.ok(!invalid.valid);
  });
});
