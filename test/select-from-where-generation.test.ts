import assert from "node:assert";
import { describe, it } from "node:test";
import type { SchemaConstraint } from "../src/core-types.js";
import { createSelect } from "../src/select-builder.js";

interface User extends SchemaConstraint {
  id: number;
  name: string;
  age: number;
  active: boolean;
}

describe("SELECT-FROM-WHERE SQL Generation", () => {
  it("should generate basic SELECT-FROM-WHERE query", () => {
    const result = createSelect<User>()
      .select("id", "name")
      .from("users")
      .where((w) => w.eq("active", true))
      .build();

    assert.strictEqual(result.sql, "SELECT id, name FROM users WHERE active = @param1");
    assert.deepStrictEqual(result.parameters, { param1: true });
  });

  it("should handle multiple conditions with parameter reuse", () => {
    const result = createSelect<User>()
      .from("users")
      .where((w) => w.eq("active", true))
      .where((w) => w.eq("active", true).gt("age", 18))
      .build();

    assert.strictEqual(
      result.sql,
      "SELECT * FROM users WHERE (active = @param1 AND active = @param1 AND age > @param2)"
    );
    assert.deepStrictEqual(result.parameters, { param1: true, param2: 18 });
  });

  it("should handle column aliases", () => {
    const result = createSelect<User>()
      .selectAs("name", "username")
      .from("users")
      .where((w) => w.eq("active", true))
      .build();

    assert.strictEqual(result.sql, "SELECT name AS username FROM users WHERE active = @param1");
  });
});
