import assert from "node:assert";
import { describe, test } from "node:test";
import type { SchemaConstraint } from "../src/core-types.js";
import { createSelect } from "../src/select-builder.js";
import { createWhere } from "../src/where-builder.js";

interface UserSchema extends SchemaConstraint {
  id: number;
  name: string;
  email: string;
  active: boolean;
}

interface OrderSchema extends SchemaConstraint {
  id: number;
  user_id: number;
  total: number;
}

describe("SelectQueryBuilder Type Constraints", () => {
  test("should enforce column names and type evolution", () => {
    // FIXME: Review and improve type constraints for select and selectAs methods to ensure proper column name validation and type inference.
    const builder = createSelect<UserSchema>().select("id", "name").selectAs("email", "user_email");

    // Build to ensure runtime behavior
    const result = builder.build();
    assert.deepStrictEqual(result, {
      sql: "SELECT id, name, email AS user_email",
      parameters: {},
    });
  });

  test("should merge schemas when joining tables", () => {
    // FIXME: The JOIN condition logic needs to be refined or implemented properly.
    const builder = createSelect<UserSchema>()
      .from("users")
      .innerJoin<OrderSchema>({
        table: "orders",
        schema: { id: 0, user_id: 0, total: 0 },
        condition: (_u, _o) => createWhere<UserSchema & OrderSchema>().equals("users.id", "orders.user_id"),
      });

    const result = builder.build();
    assert.deepStrictEqual(result, {
      sql: "SELECT * FROM users INNER JOIN orders ON users.id = orders.user_id",
      parameters: {},
    });
  });

  test("should infer aggregate result types", () => {
    // FIXME: This example is not ideal because it does not demonstrate a realistic use case for aggregate functions.
    const builder = createSelect<UserSchema>().count().sum("id").from("users");

    const result = builder.build();
    assert.deepStrictEqual(result, {
      sql: "SELECT COUNT(*), SUM(id) FROM users",
      parameters: {},
    });
  });
});
