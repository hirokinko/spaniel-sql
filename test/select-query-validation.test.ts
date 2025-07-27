import assert from "node:assert";
import { describe, it } from "node:test";
import {
  createColumnSelection,
  createSelect,
  createSelectClause,
  createWhere,
  type SchemaConstraint,
  validateSelectQuery,
} from "../src/index.js";

interface User extends SchemaConstraint {
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

      assert.deepStrictEqual(result, {
        success: false,
        error: {
          type: "QueryBuilderError",
          message: "Validation failed for SELECT query.",
          code: "INVALID_SELECT_QUERY",
          details: {
            combinedMessage: "Invalid HAVING clause: HAVING clause requires GROUP BY",
            errors: [
              {
                code: "INVALID_HAVING_CLAUSE",
                details: {
                  errors: ["HAVING clause requires GROUP BY"],
                },
                message: "Invalid HAVING clause: HAVING clause requires GROUP BY",
                type: "QueryBuilderError",
              },
            ],
          },
        },
      });
    }
  });

  it("should detect duplicate aliases on build", () => {
    const builder = createSelect<User>()
      .selectAs("id", "dup")
      .selectAs("name", "dup")
      .from("users");

    assert.throws(() => builder.build(), /Error: Validation failed for SELECT query./i);
  });
});
