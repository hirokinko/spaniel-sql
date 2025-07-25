import assert from "node:assert";
import { describe, it } from "node:test";
import type { SchemaConstraint } from "../src/core-types.js";
import { createSelect } from "../src/select-builder.js";

interface User extends SchemaConstraint {
  id: number;
  name: string;
  age: number;
}

describe("GROUP BY Query Generation", () => {
  it("should generate SELECT with GROUP BY clause", () => {
    const result = createSelect<User>()
      .select("name")
      .count("id") // FIXME: ts2345
      .from("users")
      .groupBy("name")
      .build();

    assert.strictEqual(result.sql, "SELECT name, COUNT(id) FROM users GROUP BY name");
  });

  it("should validate GROUP BY columns against schema", () => {
    const schema: User = { id: 0, name: "", age: 0 };
    assert.throws(() => {
      createSelect<User>()
        .select("name")
        .count("id") // FIXME: ts2345
        .from("users", schema)
        .groupBy("invalid" as keyof User, "name");
    }, /Invalid column in GROUP BY: invalid/);
  });

  it("should require grouping of non-aggregate columns", () => {
    // FIXME: ts2345
    assert.throws(() => {
      createSelect<User>().select("name").count("id").from("users").groupBy("id");
    }, /Column name must appear in GROUP BY/);
  });
});
