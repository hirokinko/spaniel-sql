import assert from "node:assert";
import { describe, it } from "node:test";
import { createParameterManager } from "../src/parameter-manager.js";
import {
  addLimitParameter,
  addOffsetParameter,
  validateLimitValue,
  validateOffsetValue,
} from "../src/select-utils.js";

describe("Pagination Validation", () => {
  it("should validate limit values", () => {
    assert.ok(validateLimitValue(1).success);
    assert.ok(!validateLimitValue(0).success);
    assert.ok(!validateLimitValue(-1).success);
    assert.ok(!validateLimitValue(1.5).success);
  });

  it("should validate offset values", () => {
    assert.ok(validateOffsetValue(0).success);
    assert.ok(validateOffsetValue(5).success);
    assert.ok(!validateOffsetValue(-2).success);
    assert.ok(!validateOffsetValue(2.5).success);
  });

  it("should add pagination parameters", () => {
    const manager = createParameterManager();
    const [m1, limitParam] = addLimitParameter(manager, 10);
    const [m2, offsetParam] = addOffsetParameter(m1, 5);

    assert.strictEqual(limitParam, "@param1");
    assert.strictEqual(offsetParam, "@param2");
    assert.strictEqual(m2.parameters.param1, 10);
    assert.strictEqual(m2.parameters.param2, 5);
  });
});
