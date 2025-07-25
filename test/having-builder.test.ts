import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { isConditionGroup } from "../src/conditions.js";
import { createHaving } from "../src/having-builder.js";

/** Basic tests for HavingBuilder factory */

describe("HavingBuilder Factory", () => {
  it("createHaving should return HavingBuilder instance", () => {
    const builder = createHaving();
    assert.ok(builder);
    assert.ok(typeof builder.eq === "function");
    assert.ok(typeof builder.build === "function");
  });

  it("createHaving should initialize empty state", () => {
    const builder = createHaving();
    assert.ok(isConditionGroup(builder._conditions));
    assert.strictEqual(builder._conditions.conditions.length, 0);
    assert.deepStrictEqual(builder._parameters.parameters, {});
    assert.strictEqual(builder._parameters.counter, 0);
  });

  it("createHaving should support generic type parameter", () => {
    interface TSchema {
      id: number;
      name: string;
    }
    const builder = createHaving<TSchema>();
    assert.ok(builder);
  });
});
