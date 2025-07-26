import assert from "node:assert";
import { describe, it } from "node:test";
import type { SchemaConstraint } from "../src/core-types.js";
import { createSelect } from "../src/select-builder.js";

interface User extends SchemaConstraint {
  id: number;
  age: number;
}

describe("HAVING Clause", () => {
  it("should generate GROUP BY with HAVING using aggregate", () => {
    const result = createSelect<User>()
      .select("age")
      .count("id")
      .from("users")
      .groupBy("age")
      .having((h) => h.gt("COUNT(id)", 1))
      .build();

    assert.strictEqual(
      result.sql,
      "SELECT age, COUNT(id) FROM users GROUP BY age HAVING COUNT(id) > @param1"
    );
    assert.deepStrictEqual(result.parameters, { param1: 1 });
  });

  it("should reject HAVING without GROUP BY", () => {
    assert.throws(() => {
      createSelect<User>()
        .select("id")
        .from("users")
        .having((h) => h.gt("COUNT(id)", 1));
    }, /HAVING clause requires GROUP BY/);
  });

  it("should support complex HAVING conditions", () => {
    const result = createSelect<User>()
      .select("age")
      .count("id")
      .from("users")
      .groupBy("age")
      .having((h) =>
        h.and(
          (b) => b.gt("COUNT(id)", 1),
          (b) => b.lt("COUNT(id)", 10)
        )
      )
      .build();

    assert.strictEqual(
      result.sql,
      "SELECT age, COUNT(id) FROM users GROUP BY age HAVING (COUNT(id) > @param1 AND COUNT(id) < @param2)"
    );
    assert.deepStrictEqual(result.parameters, { param1: 1, param2: 10 });
  });
});
