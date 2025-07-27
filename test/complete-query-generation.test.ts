import assert from "node:assert";
import { describe, it } from "node:test";
import type { SchemaConstraint } from "../src/core-types.js";
import { createSelect } from "../src/select-builder.js";
import { createWhere } from "../src/where-builder.js";

interface User extends SchemaConstraint {
  id: number;
  name: string;
  active: boolean;
}

interface Order extends SchemaConstraint {
  id: number;
  user_id: number;
  amount: number;
}

describe("Complete SELECT SQL Generation", () => {
  it("should generate query with join, ordering and pagination", () => {
    const result = createSelect<User>()
      .select("id", "name")
      .from("users")
      .innerJoin({
        table: "orders",
        condition: () => createWhere<User & Order>().eq("user_id", 1),
      })
      .where((w) => w.eq("active", true))
      .orderBy("name", "ASC")
      .limit(5)
      .offset(10)
      .build();

    assert.strictEqual(
      result.sql,
      "SELECT id, name FROM users INNER JOIN orders ON user_id = @param1 WHERE active = @param2 ORDER BY name ASC LIMIT 5 OFFSET 10"
    );
    assert.deepStrictEqual(result.parameters, {
      param1: 1,
      param2: true,
      param3: 5,
      param4: 10,
    });
  });
});
