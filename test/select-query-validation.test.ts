import assert from "node:assert";
import { describe, it } from "node:test";
import {
  createColumnSelection,
  createSelect,
  createSelectClause,
  createWhere,
  validateSelectQuery,
} from "../src/index.js";

interface User {
  id: number;
  name: string;
}

describe("Select Query Runtime Validation", () => {
  it("should validate a correct query", () => {
    const builder = createSelect<User>().select("id").from("users");
    const result = validateSelectQuery(builder._query);
    assert.ok(result.success);
  });

  it("should detect HAVING without GROUP BY", () => {
    const having = createWhere<User>().eq("id", 1);
    const query = {
      select: createSelectClause([createColumnSelection("id")]),
      from: { name: "users" },
      joins: [],
      having: having._conditions,
    };
    const result = validateSelectQuery(query);
    assert.ok(!result.success);
    if (!result.success) {
      assert.strictEqual(result.error.code, "INVALID_SELECT_QUERY");
      assert.ok(result.error.message.includes("HAVING clause requires GROUP BY"));
    }
  });

  it("should detect duplicate aliases on build", () => {
    const builder = createSelect<User>()
      .selectAs("id", "dup")
      .selectAs("name", "dup")
      .from("users");

    assert.throws(() => builder.build(), /duplicate column aliases/i);
  });
});
