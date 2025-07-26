import assert from "node:assert";
import { describe, it } from "node:test";
import { createJoinClause, validateJoinClause } from "../src/select-utils.js";
import { createWhere } from "../src/where-builder.js";

describe("JOIN Utilities", () => {
  it("should create join clause", () => {
    const cond = createWhere<{ id: number }>().eq("id", 1);
    const clause = createJoinClause("INNER", { name: "orders" }, cond._conditions);
    assert.deepStrictEqual(clause, {
      type: "INNER",
      table: { name: "orders" },
      condition: cond._conditions,
    });
  });

  it("should validate join clause", () => {
    const cond = createWhere<{ id: number }>().eq("id", 1);
    const clause = createJoinClause("INNER", { name: "orders" }, cond._conditions);
    const valid = validateJoinClause(clause);
    assert.ok(valid.valid);

    const bad = createJoinClause("INNER", { name: "orders" }, { type: "and", conditions: [] });
    const invalid = validateJoinClause(bad);
    assert.ok(!invalid.valid);
  });

  it("should allow cross join without condition", () => {
    const clause = createJoinClause("CROSS", { name: "orders" }, { type: "and", conditions: [] });
    const valid = validateJoinClause(clause);
    assert.ok(valid.valid);
  });

  it("should allow natural join without condition", () => {
    const clause = createJoinClause("NATURAL", { name: "orders" }, { type: "and", conditions: [] });
    const valid = validateJoinClause(clause);
    assert.ok(valid.valid);
  });
});
