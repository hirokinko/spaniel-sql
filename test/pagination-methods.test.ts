import assert from "node:assert";
import { describe, it } from "node:test";
import { createSelect } from "../src/select-builder.js";

interface User {
  id: number;
  name: string;
}

describe("Pagination Methods", () => {
  it("should set limit and offset with parameters", () => {
    const builder = createSelect<User>().from("users").limit(10).offset(5);

    assert.strictEqual(builder._query.limit, 10);
    assert.strictEqual(builder._query.offset, 5);
    assert.strictEqual(builder._parameters.counter, 2);
    assert.strictEqual(builder._parameters.parameters.param1, 10);
    assert.strictEqual(builder._parameters.parameters.param2, 5);
  });

  it("should validate limit values", () => {
    assert.throws(() => {
      createSelect<User>().limit(0);
    }, /Invalid LIMIT value/);
  });

  it("should validate offset values", () => {
    assert.throws(() => {
      createSelect<User>().offset(-1);
    }, /Invalid OFFSET value/);
  });
});
