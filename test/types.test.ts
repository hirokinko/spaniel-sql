import { test, describe } from "node:test";
import assert from "node:assert";
import {
  SpannerDataType,
  ComparisonOperator,
  QueryResult,
  TableSchema,
  SpannerTypeHint,
  ParameterManager,
  createParameterManager,
  addParameter,
} from "../src/types";

describe("Core Types", () => {
  test("SpannerDataType should include all supported types", () => {
    const validTypes: SpannerDataType[] = [
      "INT64",
      "FLOAT64",
      "STRING",
      "BYTES",
      "BOOL",
      "DATE",
      "TIMESTAMP",
      "ARRAY",
    ];

    // Type check - this will fail at compile time if types don't match
    validTypes.forEach((type) => {
      assert.ok(typeof type === "string");
    });
  });

  test("ComparisonOperator should include all supported operators", () => {
    const validOperators: ComparisonOperator[] = [
      "=",
      "!=",
      "<",
      ">",
      "<=",
      ">=",
    ];

    validOperators.forEach((op) => {
      assert.ok(typeof op === "string");
    });
  });

  test("QueryResult should have correct structure", () => {
    const result: QueryResult = {
      sql: "SELECT * FROM users WHERE age = @param1",
      parameters: { param1: 25 },
    };

    assert.ok(typeof result.sql === "string");
    assert.ok(typeof result.parameters === "object");
    assert.ok(result.parameters !== null);
  });

  test("QueryResult should support type hints for Spanner API", () => {
    const result: QueryResult = {
      sql: "SELECT * FROM users WHERE age = @param1 AND name = @param2",
      parameters: { param1: 25, param2: null },
      types: {
        param1: "int64", // Simple type hint
        param2: "string", // Simple type hint
      },
    };

    assert.ok(typeof result.sql === "string");
    assert.ok(typeof result.parameters === "object");
    assert.ok(typeof result.types === "object");
    assert.strictEqual(result.types.param1, "int64");
    assert.strictEqual(result.types.param2, "string");
  });

  test("SpannerTypeHint should support array types", () => {
    const typeHint: SpannerTypeHint = {
      type: "array",
      child: "string",
    };

    assert.strictEqual(typeHint.type, "array");
    assert.strictEqual(typeHint.child, "string");
  });

  test("SpannerTypeHint should support simple types", () => {
    const simpleTypes: SpannerTypeHint[] = [
      "int64",
      "float64",
      "string",
      "bytes",
      "bool",
      "date",
      "timestamp",
    ];

    simpleTypes.forEach((type) => {
      assert.ok(typeof type === "string");
    });
  });

  test("TableSchema should allow column definitions", () => {
    const schema: TableSchema = {
      id: "INT64",
      name: "STRING",
      active: "BOOL",
      created_at: "TIMESTAMP",
    };

    assert.ok(typeof schema === "object");
    assert.strictEqual(schema.id, "INT64");
    assert.strictEqual(schema.name, "STRING");
  });
});

describe("ParameterManager", () => {
  test("ParameterManager should have immutable structure", () => {
    const manager: ParameterManager = {
      parameters: { param1: "value1" },
      counter: 1,
    };

    assert.ok(typeof manager === "object");
    assert.ok(typeof manager.parameters === "object");
    assert.ok(typeof manager.counter === "number");
    assert.strictEqual(manager.parameters.param1, "value1");
    assert.strictEqual(manager.counter, 1);
  });

  test("createParameterManager should create empty manager", () => {
    const manager = createParameterManager();

    assert.ok(typeof manager === "object");
    assert.ok(typeof manager.parameters === "object");
    assert.ok(typeof manager.counter === "number");
    assert.deepStrictEqual(manager.parameters, {});
    assert.strictEqual(manager.counter, 0);
  });

  test("createParameterManager should return new instance each time", () => {
    const manager1 = createParameterManager();
    const manager2 = createParameterManager();

    assert.notStrictEqual(manager1, manager2);
    assert.deepStrictEqual(manager1.parameters, manager2.parameters);
    assert.strictEqual(manager1.counter, manager2.counter);
  });

  test("ParameterManager properties should be readonly at type level", () => {
    const manager = createParameterManager();

    // These should be readonly properties - TypeScript will catch attempts to modify
    assert.ok(Object.hasOwnProperty.call(manager, "parameters"));
    assert.ok(Object.hasOwnProperty.call(manager, "counter"));
  });
});

describe("addParameter", () => {
  test("should add new parameter and return new manager with parameter name", () => {
    const manager = createParameterManager();
    const [newManager, paramName] = addParameter(manager, "test-value");

    // Should return new manager instance
    assert.notStrictEqual(newManager, manager);

    // Should increment counter
    assert.strictEqual(newManager.counter, 1);

    // Should add parameter with correct name
    assert.strictEqual(newManager.parameters.param1, "test-value");

    // Should return parameter name with @ prefix
    assert.strictEqual(paramName, "@param1");

    // Original manager should be unchanged
    assert.strictEqual(manager.counter, 0);
    assert.deepStrictEqual(manager.parameters, {});
  });

  test("should reuse existing parameter for same value", () => {
    const manager = createParameterManager();

    // Add first parameter
    const [manager1, paramName1] = addParameter(manager, "same-value");

    // Add same value again
    const [manager2, paramName2] = addParameter(manager1, "same-value");

    // Should reuse the same parameter name
    assert.strictEqual(paramName1, "@param1");
    assert.strictEqual(paramName2, "@param1");

    // Counter should not increment for reused parameter
    assert.strictEqual(manager2.counter, 1);

    // Should have only one parameter entry
    assert.strictEqual(Object.keys(manager2.parameters).length, 1);
    assert.strictEqual(manager2.parameters.param1, "same-value");
  });

  test("should handle different primitive types correctly", () => {
    const manager = createParameterManager();

    // Add different types
    const [manager1, stringParam] = addParameter(manager, "string-value");
    const [manager2, numberParam] = addParameter(manager1, 42);
    const [manager3, boolParam] = addParameter(manager2, true);
    const [manager4, nullParam] = addParameter(manager3, null);
    const [manager5, undefinedParam] = addParameter(manager4, undefined);

    // Should create separate parameters for different values
    assert.strictEqual(stringParam, "@param1");
    assert.strictEqual(numberParam, "@param2");
    assert.strictEqual(boolParam, "@param3");
    assert.strictEqual(nullParam, "@param4");
    assert.strictEqual(undefinedParam, "@param5");

    // Final manager should have all parameters
    assert.strictEqual(manager5.counter, 5);
    assert.strictEqual(manager5.parameters.param1, "string-value");
    assert.strictEqual(manager5.parameters.param2, 42);
    assert.strictEqual(manager5.parameters.param3, true);
    assert.strictEqual(manager5.parameters.param4, null);
    assert.strictEqual(manager5.parameters.param5, undefined);
  });

  test("should reuse parameters for identical primitive values", () => {
    const manager = createParameterManager();

    // Add same string value multiple times
    const [manager1, param1] = addParameter(manager, "test");
    const [manager2, param2] = addParameter(manager1, "test");
    const [manager3, param3] = addParameter(manager2, "test");

    // Should all use the same parameter
    assert.strictEqual(param1, "@param1");
    assert.strictEqual(param2, "@param1");
    assert.strictEqual(param3, "@param1");

    // Counter should only increment once
    assert.strictEqual(manager3.counter, 1);
  });

  test("should handle array values with reuse", () => {
    const manager = createParameterManager();

    // Add array values
    const [manager1, param1] = addParameter(manager, [1, 2, 3]);
    const [manager2, param2] = addParameter(manager1, [1, 2, 3]); // Same array content
    const [manager3, param3] = addParameter(manager2, [4, 5, 6]); // Different array

    // Should reuse parameter for same array content
    assert.strictEqual(param1, "@param1");
    assert.strictEqual(param2, "@param1");
    assert.strictEqual(param3, "@param2");

    // Should have correct counter and parameters
    assert.strictEqual(manager3.counter, 2);
    assert.deepStrictEqual(manager3.parameters.param1, [1, 2, 3]);
    assert.deepStrictEqual(manager3.parameters.param2, [4, 5, 6]);
  });

  test("should handle empty arrays correctly", () => {
    const manager = createParameterManager();

    const [manager1, param1] = addParameter(manager, []);
    const [manager2, param2] = addParameter(manager1, []); // Same empty array

    // Should reuse parameter for empty arrays
    assert.strictEqual(param1, "@param1");
    assert.strictEqual(param2, "@param1");

    assert.strictEqual(manager2.counter, 1);
    assert.deepStrictEqual(manager2.parameters.param1, []);
  });

  test("should handle object references correctly", () => {
    const manager = createParameterManager();
    const obj1 = { key: "value" };
    const obj2 = { key: "value" }; // Same content, different reference

    const [manager1, param1] = addParameter(manager, obj1);
    const [manager2, param2] = addParameter(manager1, obj1); // Same reference
    const [manager3, param3] = addParameter(manager2, obj2); // Different reference

    // Should reuse for same reference
    assert.strictEqual(param1, "@param1");
    assert.strictEqual(param2, "@param1");

    // Should create new parameter for different reference
    assert.strictEqual(param3, "@param2");

    assert.strictEqual(manager3.counter, 2);
    assert.strictEqual(manager3.parameters.param1, obj1);
    assert.strictEqual(manager3.parameters.param2, obj2);
  });

  test("should handle mixed value types in sequence", () => {
    const manager = createParameterManager();

    // Add various types and reuse some
    const [manager1, param1] = addParameter(manager, "string");
    const [manager2, param2] = addParameter(manager1, 42);
    const [manager3, param3] = addParameter(manager2, "string"); // Reuse
    const [manager4, param4] = addParameter(manager3, [1, 2]);
    const [manager5, param5] = addParameter(manager4, 42); // Reuse
    const [manager6, param6] = addParameter(manager5, [1, 2]); // Reuse

    // Check parameter names
    assert.strictEqual(param1, "@param1");
    assert.strictEqual(param2, "@param2");
    assert.strictEqual(param3, "@param1"); // Reused
    assert.strictEqual(param4, "@param3");
    assert.strictEqual(param5, "@param2"); // Reused
    assert.strictEqual(param6, "@param3"); // Reused

    // Should have 3 unique parameters
    assert.strictEqual(manager6.counter, 3);
    assert.strictEqual(Object.keys(manager6.parameters).length, 3);
  });

  test("should maintain immutability throughout operations", () => {
    const manager = createParameterManager();
    const [manager1, _] = addParameter(manager, "test");
    const [manager2, __] = addParameter(manager1, "another");

    // Each manager should be a different instance
    assert.notStrictEqual(manager, manager1);
    assert.notStrictEqual(manager1, manager2);
    assert.notStrictEqual(manager, manager2);

    // Original manager should remain unchanged
    assert.strictEqual(manager.counter, 0);
    assert.deepStrictEqual(manager.parameters, {});

    // Intermediate manager should have only first parameter
    assert.strictEqual(manager1.counter, 1);
    assert.deepStrictEqual(manager1.parameters, { param1: "test" });

    // Final manager should have both parameters
    assert.strictEqual(manager2.counter, 2);
    assert.deepStrictEqual(manager2.parameters, {
      param1: "test",
      param2: "another",
    });
  });
});
