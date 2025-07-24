import assert from "node:assert";
import { describe, test } from "node:test";
import {
  addParameter,
  type ComparisonOperator,
  type Condition,
  type ConditionGroup,
  type ConditionNode,
  type ConditionType,
  createAndGroup,
  createComparisonCondition,
  createEndsWithCondition,
  createEqCondition,
  createGeCondition,
  createGtCondition,
  createInCondition,
  createInUnnestCondition,
  createIsNotNullCondition,
  createIsNullCondition,
  createLeCondition,
  createLikeCondition,
  createLtCondition,
  createNeCondition,
  createNotInCondition,
  createNotInUnnestCondition,
  createNotLikeCondition,
  createOrGroup,
  createParameterManager,
  createStartsWithCondition,
  createWhere,
  generateComparisonSql,
  generateConditionSql,
  generateFunctionSql,
  generateInSql,
  generateLikeSql,
  generateLogicalSql,
  generateNullSql,
  isCondition,
  isConditionGroup,
  type LogicalOperator,
  type ParameterManager,
  type ParameterValue,
  type QueryResult,
  type SpannerDataType,
  type SpannerTypeHint,
  type TableSchema,
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
    const validOperators: ComparisonOperator[] = ["=", "!=", "<", ">", "<=", ">="];

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
    assert.ok(Object.hasOwn(manager, "parameters"));
    assert.ok(Object.hasOwn(manager, "counter"));
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

  test("should handle array references correctly", () => {
    const manager = createParameterManager();
    const arr1 = [1, 2, 3];
    const arr2 = [1, 2, 3]; // Same content, different reference

    const [manager1, param1] = addParameter(manager, arr1);
    const [manager2, param2] = addParameter(manager1, arr1); // Same reference
    const [manager3, param3] = addParameter(manager2, arr2); // Different reference

    // Should reuse for same reference
    assert.strictEqual(param1, "@param1");
    assert.strictEqual(param2, "@param1");

    // Should create new parameter for different reference (arrays are compared by content)
    assert.strictEqual(param3, "@param1"); // Arrays with same content reuse parameters

    assert.strictEqual(manager3.counter, 1);
    assert.deepStrictEqual(manager3.parameters.param1, arr1);
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
describe("Condition Types", () => {
  test("ConditionType should include all supported types", () => {
    const validTypes: ConditionType[] = ["comparison", "in", "like", "null", "function"];

    validTypes.forEach((type) => {
      assert.ok(typeof type === "string");
    });
  });

  test("LogicalOperator should include all supported operators", () => {
    const validOperators: LogicalOperator[] = ["and", "or"];

    validOperators.forEach((op) => {
      assert.ok(typeof op === "string");
    });
  });

  test("Condition should have correct structure", () => {
    const condition: Condition = {
      type: "comparison",
      column: "age",
      operator: "=",
      value: 25,
      parameterName: "@param1",
    };

    assert.strictEqual(condition.type, "comparison");
    assert.strictEqual(condition.column, "age");
    assert.strictEqual(condition.operator, "=");
    assert.strictEqual(condition.value, 25);
    assert.strictEqual(condition.parameterName, "@param1");
  });

  test("ConditionGroup should have correct structure", () => {
    const condition1: Condition = {
      type: "comparison",
      column: "age",
      operator: "=",
      value: 25,
      parameterName: "@param1",
    };

    const condition2: Condition = {
      type: "comparison",
      column: "name",
      operator: "=",
      value: "John",
      parameterName: "@param2",
    };

    const group: ConditionGroup = {
      type: "and",
      conditions: [condition1, condition2],
    };

    assert.strictEqual(group.type, "and");
    assert.ok(Array.isArray(group.conditions));
    assert.strictEqual(group.conditions.length, 2);
    assert.strictEqual(group.conditions[0], condition1);
    assert.strictEqual(group.conditions[1], condition2);
  });
});

describe("Type Guards", () => {
  test("isCondition should correctly identify Condition objects", () => {
    const condition: Condition = {
      type: "comparison",
      column: "age",
      operator: "=",
      value: 25,
      parameterName: "@param1",
    };

    const group: ConditionGroup = {
      type: "and",
      conditions: [condition],
    };

    assert.ok(isCondition(condition));
    assert.ok(!isCondition(group));
  });

  test("isConditionGroup should correctly identify ConditionGroup objects", () => {
    const condition: Condition = {
      type: "comparison",
      column: "age",
      operator: "=",
      value: 25,
      parameterName: "@param1",
    };

    const group: ConditionGroup = {
      type: "and",
      conditions: [condition],
    };

    assert.ok(isConditionGroup(group));
    assert.ok(!isConditionGroup(condition));
  });
});

describe("Comparison Condition Creation", () => {
  test("createComparisonCondition should create correct condition", () => {
    const condition = createComparisonCondition("age", "=", 25, "@param1");

    assert.strictEqual(condition.type, "comparison");
    assert.strictEqual(condition.column, "age");
    assert.strictEqual(condition.operator, "=");
    assert.strictEqual(condition.value, 25);
    assert.strictEqual(condition.parameterName, "@param1");
  });

  test("createEqCondition should create equality condition", () => {
    const condition = createEqCondition("name", "John", "@param1");

    assert.strictEqual(condition.type, "comparison");
    assert.strictEqual(condition.column, "name");
    assert.strictEqual(condition.operator, "=");
    assert.strictEqual(condition.value, "John");
    assert.strictEqual(condition.parameterName, "@param1");
  });

  test("createNeCondition should create not-equal condition", () => {
    const condition = createNeCondition("status", "inactive", "@param1");

    assert.strictEqual(condition.type, "comparison");
    assert.strictEqual(condition.column, "status");
    assert.strictEqual(condition.operator, "!=");
    assert.strictEqual(condition.value, "inactive");
    assert.strictEqual(condition.parameterName, "@param1");
  });

  test("createGtCondition should create greater-than condition", () => {
    const condition = createGtCondition("age", 18, "@param1");

    assert.strictEqual(condition.type, "comparison");
    assert.strictEqual(condition.column, "age");
    assert.strictEqual(condition.operator, ">");
    assert.strictEqual(condition.value, 18);
    assert.strictEqual(condition.parameterName, "@param1");
  });

  test("createLtCondition should create less-than condition", () => {
    const condition = createLtCondition("score", 100, "@param1");

    assert.strictEqual(condition.type, "comparison");
    assert.strictEqual(condition.column, "score");
    assert.strictEqual(condition.operator, "<");
    assert.strictEqual(condition.value, 100);
    assert.strictEqual(condition.parameterName, "@param1");
  });

  test("createGeCondition should create greater-than-or-equal condition", () => {
    const condition = createGeCondition("rating", 4.5, "@param1");

    assert.strictEqual(condition.type, "comparison");
    assert.strictEqual(condition.column, "rating");
    assert.strictEqual(condition.operator, ">=");
    assert.strictEqual(condition.value, 4.5);
    assert.strictEqual(condition.parameterName, "@param1");
  });

  test("createLeCondition should create less-than-or-equal condition", () => {
    const condition = createLeCondition("price", 99.99, "@param1");

    assert.strictEqual(condition.type, "comparison");
    assert.strictEqual(condition.column, "price");
    assert.strictEqual(condition.operator, "<=");
    assert.strictEqual(condition.value, 99.99);
    assert.strictEqual(condition.parameterName, "@param1");
  });
});

describe("Array Condition Creation", () => {
  test("createInCondition should create IN condition", () => {
    const values = ["active", "pending", "completed"];
    const parameterNames = ["@param1", "@param2", "@param3"];
    const condition = createInCondition("status", values, parameterNames);

    assert.strictEqual(condition.type, "in");
    assert.strictEqual(condition.column, "status");
    assert.strictEqual(condition.operator, "IN");
    assert.deepStrictEqual(condition.values, values);
    assert.deepStrictEqual(condition.parameterNames, parameterNames);
  });

  test("createNotInCondition should create NOT IN condition", () => {
    const values = [1, 2, 3];
    const parameterNames = ["@param1", "@param2", "@param3"];
    const condition = createNotInCondition("id", values, parameterNames);

    assert.strictEqual(condition.type, "in");
    assert.strictEqual(condition.column, "id");
    assert.strictEqual(condition.operator, "NOT IN");
    assert.deepStrictEqual(condition.values, values);
    assert.deepStrictEqual(condition.parameterNames, parameterNames);
  });

  test("createInCondition should handle empty arrays", () => {
    const condition = createInCondition("status", [], []);

    assert.strictEqual(condition.type, "in");
    assert.strictEqual(condition.column, "status");
    assert.strictEqual(condition.operator, "IN");
    assert.deepStrictEqual(condition.values, []);
    assert.deepStrictEqual(condition.parameterNames, []);
  });

  test("createInUnnestCondition should create IN UNNEST condition", () => {
    const values = ["active", "pending", "completed"];
    const condition = createInUnnestCondition("status", values, "@param1");

    assert.strictEqual(condition.type, "in");
    assert.strictEqual(condition.column, "status");
    assert.strictEqual(condition.operator, "IN UNNEST");
    assert.deepStrictEqual(condition.values, values);
    assert.strictEqual(condition.parameterName, "@param1");
  });

  test("createNotInUnnestCondition should create NOT IN UNNEST condition", () => {
    const values = [1, 2, 3];
    const condition = createNotInUnnestCondition("id", values, "@param1");

    assert.strictEqual(condition.type, "in");
    assert.strictEqual(condition.column, "id");
    assert.strictEqual(condition.operator, "NOT IN UNNEST");
    assert.deepStrictEqual(condition.values, values);
    assert.strictEqual(condition.parameterName, "@param1");
  });

  test("createInUnnestCondition should handle empty arrays", () => {
    const condition = createInUnnestCondition("status", [], "@param1");

    assert.strictEqual(condition.type, "in");
    assert.strictEqual(condition.column, "status");
    assert.strictEqual(condition.operator, "IN UNNEST");
    assert.deepStrictEqual(condition.values, []);
    assert.strictEqual(condition.parameterName, "@param1");
  });

  test("createNotInUnnestCondition should handle empty arrays", () => {
    const condition = createNotInUnnestCondition("priority", [], "@param1");

    assert.strictEqual(condition.type, "in");
    assert.strictEqual(condition.column, "priority");
    assert.strictEqual(condition.operator, "NOT IN UNNEST");
    assert.deepStrictEqual(condition.values, []);
    assert.strictEqual(condition.parameterName, "@param1");
  });
});

describe("String Pattern Condition Creation", () => {
  test("createLikeCondition should create LIKE condition", () => {
    const condition = createLikeCondition("name", "John%", "@param1");

    assert.strictEqual(condition.type, "like");
    assert.strictEqual(condition.column, "name");
    assert.strictEqual(condition.operator, "LIKE");
    assert.strictEqual(condition.value, "John%");
    assert.strictEqual(condition.parameterName, "@param1");
  });

  test("createNotLikeCondition should create NOT LIKE condition", () => {
    const condition = createNotLikeCondition("email", "%@spam.com", "@param1");

    assert.strictEqual(condition.type, "like");
    assert.strictEqual(condition.column, "email");
    assert.strictEqual(condition.operator, "NOT LIKE");
    assert.strictEqual(condition.value, "%@spam.com");
    assert.strictEqual(condition.parameterName, "@param1");
  });

  test("createStartsWithCondition should create STARTS_WITH function condition", () => {
    const condition = createStartsWithCondition("name", "John", "@param1");

    assert.strictEqual(condition.type, "function");
    assert.strictEqual(condition.column, "name");
    assert.strictEqual(condition.operator, "STARTS_WITH");
    assert.strictEqual(condition.value, "John");
    assert.strictEqual(condition.parameterName, "@param1");
  });

  test("createEndsWithCondition should create ENDS_WITH function condition", () => {
    const condition = createEndsWithCondition("email", "@example.com", "@param1");

    assert.strictEqual(condition.type, "function");
    assert.strictEqual(condition.column, "email");
    assert.strictEqual(condition.operator, "ENDS_WITH");
    assert.strictEqual(condition.value, "@example.com");
    assert.strictEqual(condition.parameterName, "@param1");
  });
});

describe("Null Check Condition Creation", () => {
  test("createIsNullCondition should create IS NULL condition", () => {
    const condition = createIsNullCondition("deleted_at");

    assert.strictEqual(condition.type, "null");
    assert.strictEqual(condition.column, "deleted_at");
    assert.strictEqual(condition.operator, "IS NULL");
    assert.strictEqual(condition.value, undefined);
    assert.strictEqual(condition.parameterName, undefined);
  });

  test("createIsNotNullCondition should create IS NOT NULL condition", () => {
    const condition = createIsNotNullCondition("created_at");

    assert.strictEqual(condition.type, "null");
    assert.strictEqual(condition.column, "created_at");
    assert.strictEqual(condition.operator, "IS NOT NULL");
    assert.strictEqual(condition.value, undefined);
    assert.strictEqual(condition.parameterName, undefined);
  });
});

describe("Condition Group Creation", () => {
  test("createAndGroup should create AND condition group", () => {
    const condition1 = createEqCondition("age", 25, "@param1");
    const condition2 = createEqCondition("status", "active", "@param2");
    const group = createAndGroup([condition1, condition2]);

    assert.strictEqual(group.type, "and");
    assert.ok(Array.isArray(group.conditions));
    assert.strictEqual(group.conditions.length, 2);
    assert.strictEqual(group.conditions[0], condition1);
    assert.strictEqual(group.conditions[1], condition2);
  });

  test("createOrGroup should create OR condition group", () => {
    const condition1 = createEqCondition("priority", "high", "@param1");
    const condition2 = createEqCondition("priority", "urgent", "@param2");
    const group = createOrGroup([condition1, condition2]);

    assert.strictEqual(group.type, "or");
    assert.ok(Array.isArray(group.conditions));
    assert.strictEqual(group.conditions.length, 2);
    assert.strictEqual(group.conditions[0], condition1);
    assert.strictEqual(group.conditions[1], condition2);
  });

  test("createAndGroup should handle nested groups", () => {
    const condition1 = createEqCondition("age", 25, "@param1");
    const condition2 = createEqCondition("status", "active", "@param2");
    const innerGroup = createOrGroup([condition1, condition2]);
    const condition3 = createGtCondition("score", 80, "@param3");
    const outerGroup = createAndGroup([innerGroup, condition3]);

    assert.strictEqual(outerGroup.type, "and");
    assert.strictEqual(outerGroup.conditions.length, 2);
    assert.strictEqual(outerGroup.conditions[0], innerGroup);
    assert.strictEqual(outerGroup.conditions[1], condition3);
  });

  test("createOrGroup should handle empty conditions array", () => {
    const group = createOrGroup([]);

    assert.strictEqual(group.type, "or");
    assert.ok(Array.isArray(group.conditions));
    assert.strictEqual(group.conditions.length, 0);
  });

  test("createAndGroup should handle single condition", () => {
    const condition = createEqCondition("name", "John", "@param1");
    const group = createAndGroup([condition]);

    assert.strictEqual(group.type, "and");
    assert.strictEqual(group.conditions.length, 1);
    assert.strictEqual(group.conditions[0], condition);
  });
});
describe("SQL Generation for Basic Comparison Conditions", () => {
  test("generateComparisonSql should generate standard parameterized SQL for non-null values", () => {
    const condition = createEqCondition("age", 25, "@param1");
    const sql = generateComparisonSql(condition);

    assert.strictEqual(sql, "age = @param1");
  });

  test("generateComparisonSql should handle all comparison operators", () => {
    const operators: ComparisonOperator[] = ["=", "!=", "<", ">", "<=", ">="];

    operators.forEach((operator) => {
      const condition = createComparisonCondition("score", operator, 100, "@param1");
      const sql = generateComparisonSql(condition);

      assert.strictEqual(sql, `score ${operator} @param1`);
    });
  });

  test("generateComparisonSql should handle null values with equality operator", () => {
    const condition = createEqCondition("deleted_at", null, "@param1");
    const sql = generateComparisonSql(condition);

    assert.strictEqual(sql, "deleted_at IS NULL");
  });

  test("generateComparisonSql should handle null values with inequality operator", () => {
    const condition = createNeCondition("deleted_at", null, "@param1");
    const sql = generateComparisonSql(condition);

    assert.strictEqual(sql, "deleted_at IS NOT NULL");
  });

  test("generateComparisonSql should use parameterized form for null with other operators", () => {
    const operators: ComparisonOperator[] = ["<", ">", "<=", ">="];

    operators.forEach((operator) => {
      const condition = createComparisonCondition("value", operator, null, "@param1");
      const sql = generateComparisonSql(condition);

      // For other operators with null, use standard parameterized form
      // This allows Cloud Spanner to handle null comparisons according to SQL semantics
      assert.strictEqual(sql, `value ${operator} @param1`);
    });
  });

  test("generateComparisonSql should handle different data types", () => {
    const testCases = [
      { value: "string-value", expected: "name = @param1" },
      { value: 42, expected: "age = @param1" },
      { value: 3.14, expected: "price = @param1" },
      { value: true, expected: "active = @param1" },
      { value: false, expected: "deleted = @param1" },
    ];

    testCases.forEach(({ value, expected }) => {
      const condition = createEqCondition("name", value, "@param1");
      // Update column name for each test case
      condition.column = expected.split(" ")[0];
      const sql = generateComparisonSql(condition);

      assert.strictEqual(sql, expected);
    });
  });

  test("generateComparisonSql should handle column names with special characters", () => {
    const condition = createEqCondition("user_name", "John", "@param1");
    const sql = generateComparisonSql(condition);

    assert.strictEqual(sql, "user_name = @param1");
  });

  test("generateComparisonSql should handle parameter names with different formats", () => {
    const testCases = ["@param1", "@param123", "@userParam", "@param_with_underscore"];

    testCases.forEach((paramName) => {
      const condition = createEqCondition("column", "value", paramName);
      const sql = generateComparisonSql(condition);

      assert.strictEqual(sql, `column = ${paramName}`);
    });
  });

  test("generateComparisonSql should throw error for non-comparison condition types", () => {
    const nonComparisonCondition: Condition = {
      type: "in",
      column: "status",
      operator: "IN",
      values: ["active", "pending"],
      parameterNames: ["@param1", "@param2"],
    };

    assert.throws(
      () => generateComparisonSql(nonComparisonCondition),
      /Expected comparison condition, got in/
    );
  });

  test("generateComparisonSql should throw error when parameter name is missing for non-null values", () => {
    const condition: Condition = {
      type: "comparison",
      column: "age",
      operator: "=",
      value: 25,
      // parameterName is missing
    };

    assert.throws(
      () => generateComparisonSql(condition),
      /Parameter name is required for non-null comparison conditions/
    );
  });
});

describe("WhereBuilder Null Check Methods", () => {
  test("isNull should create IS NULL condition", () => {
    const builder = createWhere<{ deleted_at: Date | null }>();
    const result = builder.isNull("deleted_at");

    // Should return a new builder instance
    assert.notStrictEqual(result, builder);

    // Should add IS NULL condition to the condition tree
    assert.strictEqual(result._conditions.type, "and");
    assert.strictEqual(result._conditions.conditions.length, 1);

    const condition = result._conditions.conditions[0] as Condition;
    assert.ok(isCondition(condition));
    assert.strictEqual(condition.type, "null");
    assert.strictEqual(condition.column, "deleted_at");
    assert.strictEqual(condition.operator, "IS NULL");
    assert.strictEqual(condition.value, undefined);
    assert.strictEqual(condition.parameterName, undefined);

    // Parameters should remain unchanged (no parameters needed for null checks)
    assert.strictEqual(result._parameters.counter, 0);
    assert.deepStrictEqual(result._parameters.parameters, {});
  });

  test("isNotNull should create IS NOT NULL condition", () => {
    const builder = createWhere<{ created_at: Date | null }>();
    const result = builder.isNotNull("created_at");

    // Should return a new builder instance
    assert.notStrictEqual(result, builder);

    // Should add IS NOT NULL condition to the condition tree
    assert.strictEqual(result._conditions.type, "and");
    assert.strictEqual(result._conditions.conditions.length, 1);

    const condition = result._conditions.conditions[0] as Condition;
    assert.ok(isCondition(condition));
    assert.strictEqual(condition.type, "null");
    assert.strictEqual(condition.column, "created_at");
    assert.strictEqual(condition.operator, "IS NOT NULL");
    assert.strictEqual(condition.value, undefined);
    assert.strictEqual(condition.parameterName, undefined);

    // Parameters should remain unchanged (no parameters needed for null checks)
    assert.strictEqual(result._parameters.counter, 0);
    assert.deepStrictEqual(result._parameters.parameters, {});
  });

  test("isNull should work with string column names", () => {
    const builder = createWhere();
    const result = builder.isNull("any_column");

    const condition = result._conditions.conditions[0] as Condition;
    assert.strictEqual(condition.column, "any_column");
    assert.strictEqual(condition.operator, "IS NULL");
  });

  test("isNotNull should work with string column names", () => {
    const builder = createWhere();
    const result = builder.isNotNull("any_column");

    const condition = result._conditions.conditions[0] as Condition;
    assert.strictEqual(condition.column, "any_column");
    assert.strictEqual(condition.operator, "IS NOT NULL");
  });

  test("isNull should chain with other conditions", () => {
    const builder = createWhere<{ name: string; deleted_at: Date | null }>();
    const result = builder.eq("name", "John").isNull("deleted_at");

    // Should have two conditions
    assert.strictEqual(result._conditions.conditions.length, 2);

    // First condition should be equality
    const firstCondition = result._conditions.conditions[0] as Condition;
    assert.strictEqual(firstCondition.type, "comparison");
    assert.strictEqual(firstCondition.column, "name");
    assert.strictEqual(firstCondition.operator, "=");

    // Second condition should be null check
    const secondCondition = result._conditions.conditions[1] as Condition;
    assert.strictEqual(secondCondition.type, "null");
    assert.strictEqual(secondCondition.column, "deleted_at");
    assert.strictEqual(secondCondition.operator, "IS NULL");

    // Should have one parameter for the equality condition
    assert.strictEqual(result._parameters.counter, 1);
    assert.strictEqual(result._parameters.parameters.param1, "John");
  });

  test("isNotNull should chain with other conditions", () => {
    const builder = createWhere<{ status: string; created_at: Date | null }>();
    const result = builder.eq("status", "active").isNotNull("created_at");

    // Should have two conditions
    assert.strictEqual(result._conditions.conditions.length, 2);

    // First condition should be equality
    const firstCondition = result._conditions.conditions[0] as Condition;
    assert.strictEqual(firstCondition.type, "comparison");
    assert.strictEqual(firstCondition.column, "status");
    assert.strictEqual(firstCondition.operator, "=");

    // Second condition should be not null check
    const secondCondition = result._conditions.conditions[1] as Condition;
    assert.strictEqual(secondCondition.type, "null");
    assert.strictEqual(secondCondition.column, "created_at");
    assert.strictEqual(secondCondition.operator, "IS NOT NULL");

    // Should have one parameter for the equality condition
    assert.strictEqual(result._parameters.counter, 1);
    assert.strictEqual(result._parameters.parameters.param1, "active");
  });

  test("multiple null checks should work together", () => {
    const builder = createWhere<{ deleted_at: Date | null; archived_at: Date | null }>();
    const result = builder.isNull("deleted_at").isNotNull("archived_at");

    // Should have two conditions
    assert.strictEqual(result._conditions.conditions.length, 2);

    // First condition should be IS NULL
    const firstCondition = result._conditions.conditions[0] as Condition;
    assert.strictEqual(firstCondition.type, "null");
    assert.strictEqual(firstCondition.column, "deleted_at");
    assert.strictEqual(firstCondition.operator, "IS NULL");

    // Second condition should be IS NOT NULL
    const secondCondition = result._conditions.conditions[1] as Condition;
    assert.strictEqual(secondCondition.type, "null");
    assert.strictEqual(secondCondition.column, "archived_at");
    assert.strictEqual(secondCondition.operator, "IS NOT NULL");

    // Should have no parameters (null checks don't need parameters)
    assert.strictEqual(result._parameters.counter, 0);
    assert.deepStrictEqual(result._parameters.parameters, {});
  });

  test("null check methods should maintain immutability", () => {
    const builder = createWhere<{ deleted_at: Date | null }>();
    const result1 = builder.isNull("deleted_at");
    const result2 = result1.isNotNull("deleted_at");

    // All instances should be different
    assert.notStrictEqual(builder, result1);
    assert.notStrictEqual(result1, result2);
    assert.notStrictEqual(builder, result2);

    // Original builder should remain unchanged
    assert.strictEqual(builder._conditions.conditions.length, 0);

    // First result should have one condition
    assert.strictEqual(result1._conditions.conditions.length, 1);

    // Second result should have two conditions
    assert.strictEqual(result2._conditions.conditions.length, 2);
  });
});

describe("SQL Generation for Null Check Conditions", () => {
  test("generateNullSql should generate IS NULL SQL", () => {
    const condition = createIsNullCondition("deleted_at");
    const sql = generateNullSql(condition);

    assert.strictEqual(sql, "deleted_at IS NULL");
  });

  test("generateNullSql should generate IS NOT NULL SQL", () => {
    const condition = createIsNotNullCondition("created_at");
    const sql = generateNullSql(condition);

    assert.strictEqual(sql, "created_at IS NOT NULL");
  });

  test("generateNullSql should handle column names with underscores", () => {
    const condition = createIsNullCondition("user_deleted_at");
    const sql = generateNullSql(condition);

    assert.strictEqual(sql, "user_deleted_at IS NULL");
  });

  test("generateNullSql should handle various column name formats", () => {
    const testCases = [
      { column: "id", operator: "IS NULL", expected: "id IS NULL" },
      { column: "user_name", operator: "IS NOT NULL", expected: "user_name IS NOT NULL" },
      { column: "createdAt", operator: "IS NULL", expected: "createdAt IS NULL" },
      {
        column: "last_login_time",
        operator: "IS NOT NULL",
        expected: "last_login_time IS NOT NULL",
      },
    ];

    testCases.forEach(({ column, operator, expected }) => {
      const condition: Condition = {
        type: "null",
        column,
        operator,
      };
      const sql = generateNullSql(condition);
      assert.strictEqual(sql, expected);
    });
  });

  test("generateNullSql should throw error for non-null condition types", () => {
    const nonNullCondition: Condition = {
      type: "comparison",
      column: "age",
      operator: "=",
      value: 25,
      parameterName: "@param1",
    };

    assert.throws(
      () => generateNullSql(nonNullCondition),
      /Expected null condition, got comparison/
    );
  });

  test("generateConditionSql should handle null conditions", () => {
    const isNullCondition = createIsNullCondition("deleted_at");
    const isNotNullCondition = createIsNotNullCondition("created_at");

    const sql1 = generateConditionSql(isNullCondition);
    const sql2 = generateConditionSql(isNotNullCondition);

    assert.strictEqual(sql1, "deleted_at IS NULL");
    assert.strictEqual(sql2, "created_at IS NOT NULL");
  });
});

test("generateComparisonSql should handle edge cases with empty strings", () => {
  const condition = createEqCondition("description", "", "@param1");
  const sql = generateComparisonSql(condition);

  assert.strictEqual(sql, "description = @param1");
});

test("generateComparisonSql should handle zero values correctly", () => {
  const condition = createEqCondition("count", 0, "@param1");
  const sql = generateComparisonSql(condition);

  assert.strictEqual(sql, "count = @param1");
});

test("generateComparisonSql should handle undefined values as non-null", () => {
  const condition = createEqCondition("optional_field", undefined, "@param1");
  const sql = generateComparisonSql(condition);

  // undefined should be treated as a regular value, not as null
  assert.strictEqual(sql, "optional_field = @param1");
});

test("generateComparisonSql should work with all comparison condition creation helpers", () => {
  const testCases = [
    { creator: createEqCondition, operator: "=" },
    { creator: createNeCondition, operator: "!=" },
    { creator: createGtCondition, operator: ">" },
    { creator: createLtCondition, operator: "<" },
    { creator: createGeCondition, operator: ">=" },
    { creator: createLeCondition, operator: "<=" },
  ];

  testCases.forEach(({ creator, operator }) => {
    const condition = creator("score", 100, "@param1");
    const sql = generateComparisonSql(condition);

    assert.strictEqual(sql, `score ${operator} @param1`);
  });
});

test("generateComparisonSql should handle complex column names", () => {
  const testCases = [
    "simple_column",
    "CamelCaseColumn",
    "column123",
    "column_with_multiple_underscores",
    "a",
    "very_long_column_name_that_might_be_used_in_practice",
  ];

  testCases.forEach((columnName) => {
    const condition = createEqCondition(columnName, "value", "@param1");
    const sql = generateComparisonSql(condition);

    assert.strictEqual(sql, `${columnName} = @param1`);
  });
});

test("generateComparisonSql should maintain consistency with null handling across operators", () => {
  // Test that = with null becomes IS NULL
  const eqNullCondition = createEqCondition("field", null, "@param1");
  assert.strictEqual(generateComparisonSql(eqNullCondition), "field IS NULL");

  // Test that != with null becomes IS NOT NULL
  const neNullCondition = createNeCondition("field", null, "@param1");
  assert.strictEqual(generateComparisonSql(neNullCondition), "field IS NOT NULL");

  // Test that other operators with null use parameterized form
  const gtNullCondition = createGtCondition("field", null, "@param1");
  assert.strictEqual(generateComparisonSql(gtNullCondition), "field > @param1");

  const ltNullCondition = createLtCondition("field", null, "@param1");
  assert.strictEqual(generateComparisonSql(ltNullCondition), "field < @param1");

  const geNullCondition = createGeCondition("field", null, "@param1");
  assert.strictEqual(generateComparisonSql(geNullCondition), "field >= @param1");

  const leNullCondition = createLeCondition("field", null, "@param1");
  assert.strictEqual(generateComparisonSql(leNullCondition), "field <= @param1");
});

describe("SQL Generation for Array Operations (IN/NOT IN)", () => {
  test("generateInSql should generate IN clause with multiple parameters", () => {
    const condition = createInCondition(
      "status",
      ["active", "pending", "completed"],
      ["@param1", "@param2", "@param3"]
    );
    const sql = generateInSql(condition);

    assert.strictEqual(sql, "status IN (@param1, @param2, @param3)");
  });

  test("generateInSql should generate NOT IN clause with multiple parameters", () => {
    const condition = createNotInCondition("priority", ["low", "medium"], ["@param1", "@param2"]);
    const sql = generateInSql(condition);

    assert.strictEqual(sql, "priority NOT IN (@param1, @param2)");
  });

  test("generateInSql should handle single value IN clause", () => {
    const condition = createInCondition("category", ["electronics"], ["@param1"]);
    const sql = generateInSql(condition);

    assert.strictEqual(sql, "category IN (@param1)");
  });

  test("generateInSql should handle empty array for IN operation", () => {
    const condition = createInCondition("status", [], []);
    const sql = generateInSql(condition);

    // Empty IN should always be FALSE (no rows match)
    assert.strictEqual(sql, "FALSE");
  });

  test("generateInSql should handle empty array for NOT IN operation", () => {
    const condition = createNotInCondition("status", [], []);
    const sql = generateInSql(condition);

    // Empty NOT IN should always be TRUE (all rows match)
    assert.strictEqual(sql, "TRUE");
  });

  test("generateInSql should handle undefined values array", () => {
    const condition: Condition = {
      type: "in",
      column: "status",
      operator: "IN",
      // values is undefined
      parameterNames: [],
    };

    const sql = generateInSql(condition);
    assert.strictEqual(sql, "FALSE");
  });

  test("generateInSql should handle undefined parameterNames array", () => {
    const condition: Condition = {
      type: "in",
      column: "status",
      operator: "IN",
      values: ["active"],
      // parameterNames is undefined
    };

    assert.throws(() => generateInSql(condition), {
      name: "Error",
      message: "Parameter names array must match values array length",
    });
  });

  test("generateInSql should validate parameter names array length matches values", () => {
    const condition = createInCondition("status", ["active", "pending"], ["@param1"]); // Mismatched lengths

    assert.throws(() => generateInSql(condition), {
      name: "Error",
      message: "Parameter names array must match values array length",
    });
  });

  test("generateInSql should handle numeric values", () => {
    const condition = createInCondition("age", [18, 25, 30], ["@param1", "@param2", "@param3"]);
    const sql = generateInSql(condition);

    assert.strictEqual(sql, "age IN (@param1, @param2, @param3)");
  });

  test("generateInSql should throw error for non-in condition types", () => {
    const nonInCondition = createEqCondition("name", "John", "@param1");

    assert.throws(() => generateInSql(nonInCondition), {
      name: "Error",
      message: "Expected in condition, got comparison",
    });
  });

  test("generateInSql should generate IN UNNEST clause with array parameter", () => {
    const condition = createInUnnestCondition(
      "status",
      ["active", "pending", "completed"],
      "@param1"
    );
    const sql = generateInSql(condition);

    assert.strictEqual(sql, "status IN UNNEST(@param1)");
  });

  test("generateInSql should generate NOT IN UNNEST clause with array parameter", () => {
    const condition = createNotInUnnestCondition("priority", ["low", "medium"], "@param1");
    const sql = generateInSql(condition);

    assert.strictEqual(sql, "priority NOT IN UNNEST(@param1)");
  });

  test("generateInSql should handle empty array for IN UNNEST operation", () => {
    const condition = createInUnnestCondition("status", [], "@param1");
    const sql = generateInSql(condition);

    // Empty IN UNNEST should always be FALSE (no rows match)
    assert.strictEqual(sql, "FALSE");
  });

  test("generateInSql should handle empty array for NOT IN UNNEST operation", () => {
    const condition = createNotInUnnestCondition("status", [], "@param1");
    const sql = generateInSql(condition);

    // Empty NOT IN UNNEST should always be TRUE (all rows match)
    assert.strictEqual(sql, "TRUE");
  });

  test("generateInSql should throw error when parameter name is missing for UNNEST conditions", () => {
    const condition: Condition = {
      type: "in",
      column: "status",
      operator: "IN UNNEST",
      values: ["active"],
      // parameterName is undefined
    };

    assert.throws(() => generateInSql(condition), {
      name: "Error",
      message: "Parameter name is required for UNNEST conditions",
    });
  });

  test("generateInSql should handle single value IN UNNEST clause", () => {
    const condition = createInUnnestCondition("category", ["electronics"], "@param1");
    const sql = generateInSql(condition);

    assert.strictEqual(sql, "category IN UNNEST(@param1)");
  });

  test("generateInSql should handle numeric values in UNNEST form", () => {
    const condition = createInUnnestCondition("age", [18, 25, 30], "@param1");
    const sql = generateInSql(condition);

    assert.strictEqual(sql, "age IN UNNEST(@param1)");
  });

  test("generateInSql should throw error for unsupported IN operators", () => {
    const condition: Condition = {
      type: "in",
      column: "status",
      operator: "INVALID_OPERATOR" as string,
      values: ["active"],
      parameterName: "@param1",
    };

    assert.throws(() => generateInSql(condition), {
      name: "Error",
      message: "Unsupported IN operator: INVALID_OPERATOR",
    });
  });
});

describe("SQL Generation for Pattern Operations (LIKE/NOT LIKE)", () => {
  test("generateLikeSql should generate LIKE clause", () => {
    const condition = createLikeCondition("name", "John%", "@param1");
    const sql = generateLikeSql(condition);

    assert.strictEqual(sql, "name LIKE @param1");
  });

  test("generateLikeSql should generate NOT LIKE clause", () => {
    const condition = createNotLikeCondition("email", "%@spam.com", "@param1");
    const sql = generateLikeSql(condition);

    assert.strictEqual(sql, "email NOT LIKE @param1");
  });

  test("generateLikeSql should handle different pattern types", () => {
    const testCases = [
      { pattern: "prefix%", description: "prefix pattern" },
      { pattern: "%suffix", description: "suffix pattern" },
      { pattern: "%middle%", description: "contains pattern" },
      { pattern: "exact", description: "exact match pattern" },
      { pattern: "_single", description: "single character wildcard" },
      { pattern: "a_b%c", description: "mixed wildcards" },
    ];

    testCases.forEach(({ pattern, description }) => {
      const condition = createLikeCondition("text_field", pattern, "@param1");
      const sql = generateLikeSql(condition);

      assert.strictEqual(sql, "text_field LIKE @param1", `Failed for ${description}`);
    });
  });

  test("generateLikeSql should throw error when parameter name is missing", () => {
    const condition: Condition = {
      type: "like",
      column: "name",
      operator: "LIKE",
      value: "pattern",
      // parameterName is undefined
    };

    assert.throws(() => generateLikeSql(condition), {
      name: "Error",
      message: "Parameter name is required for LIKE conditions",
    });
  });

  test("generateLikeSql should throw error for non-like condition types", () => {
    const nonLikeCondition = createEqCondition("name", "John", "@param1");

    assert.throws(() => generateLikeSql(nonLikeCondition), {
      name: "Error",
      message: "Expected like condition, got comparison",
    });
  });
});

describe("SQL Generation for String Functions (STARTS_WITH/ENDS_WITH)", () => {
  test("generateFunctionSql should generate STARTS_WITH function call", () => {
    const condition = createStartsWithCondition("name", "John", "@param1");
    const sql = generateFunctionSql(condition);

    assert.strictEqual(sql, "STARTS_WITH(name, @param1)");
  });

  test("generateFunctionSql should generate ENDS_WITH function call", () => {
    const condition = createEndsWithCondition("email", "@example.com", "@param1");
    const sql = generateFunctionSql(condition);

    assert.strictEqual(sql, "ENDS_WITH(email, @param1)");
  });

  test("generateFunctionSql should handle empty string values", () => {
    const condition = createStartsWithCondition("text", "", "@param1");
    const sql = generateFunctionSql(condition);

    assert.strictEqual(sql, "STARTS_WITH(text, @param1)");
  });

  test("generateFunctionSql should throw error when parameter name is missing", () => {
    const condition: Condition = {
      type: "function",
      column: "name",
      operator: "STARTS_WITH",
      value: "prefix",
      // parameterName is undefined
    };

    assert.throws(() => generateFunctionSql(condition), {
      name: "Error",
      message: "Parameter name is required for function conditions",
    });
  });

  test("generateFunctionSql should throw error for non-function condition types", () => {
    const nonFunctionCondition = createEqCondition("name", "John", "@param1");

    assert.throws(() => generateFunctionSql(nonFunctionCondition), {
      name: "Error",
      message: "Expected function condition, got comparison",
    });
  });
});

describe("SQL Generation for NULL Operations", () => {
  test("generateNullSql should generate IS NULL clause", () => {
    const condition = createIsNullCondition("deleted_at");
    const sql = generateNullSql(condition);

    assert.strictEqual(sql, "deleted_at IS NULL");
  });

  test("generateNullSql should generate IS NOT NULL clause", () => {
    const condition = createIsNotNullCondition("created_at");
    const sql = generateNullSql(condition);

    assert.strictEqual(sql, "created_at IS NOT NULL");
  });

  test("generateNullSql should throw error for non-null condition types", () => {
    const nonNullCondition = createEqCondition("name", "John", "@param1");

    assert.throws(() => generateNullSql(nonNullCondition), {
      name: "Error",
      message: "Expected null condition, got comparison",
    });
  });
});

describe("Integration Tests for Array and Pattern SQL Generation", () => {
  test("should handle complex IN condition with parameter manager integration", () => {
    const manager = createParameterManager();
    const values = ["active", "pending", "completed"];

    // Simulate adding parameters for each value
    const [manager1, param1] = addParameter(manager, values[0]);
    const [manager2, param2] = addParameter(manager1, values[1]);
    const [manager3, param3] = addParameter(manager2, values[2]);

    const parameterNames = [param1, param2, param3];
    const condition = createInCondition("status", values, parameterNames);
    const sql = generateInSql(condition);

    assert.strictEqual(sql, "status IN (@param1, @param2, @param3)");
    assert.deepStrictEqual(manager3.parameters, {
      param1: "active",
      param2: "pending",
      param3: "completed",
    });
  });

  test("should handle LIKE condition with parameter manager integration", () => {
    const manager = createParameterManager();
    const pattern = "John%";

    const [newManager, paramName] = addParameter(manager, pattern);
    const condition = createLikeCondition("name", pattern, paramName);
    const sql = generateLikeSql(condition);

    assert.strictEqual(sql, "name LIKE @param1");
    assert.strictEqual(newManager.parameters.param1, pattern);
  });

  test("should handle function condition with parameter manager integration", () => {
    const manager = createParameterManager();
    const prefix = "John";

    const [newManager, paramName] = addParameter(manager, prefix);
    const condition = createStartsWithCondition("name", prefix, paramName);
    const sql = generateFunctionSql(condition);

    assert.strictEqual(sql, "STARTS_WITH(name, @param1)");
    assert.strictEqual(newManager.parameters.param1, prefix);
  });

  test("should handle parameter reuse across different condition types", () => {
    const manager = createParameterManager();
    const value = "test";

    // Add same value for different condition types
    const [manager1, param1] = addParameter(manager, value);
    const [manager2, param2] = addParameter(manager1, value); // Should reuse

    const eqCondition = createEqCondition("column1", value, param1);
    const likeCondition = createLikeCondition("column2", value, param2);

    const eqSql = generateComparisonSql(eqCondition);
    const likeSql = generateLikeSql(likeCondition);

    assert.strictEqual(eqSql, "column1 = @param1");
    assert.strictEqual(likeSql, "column2 LIKE @param1"); // Should use same parameter
    assert.strictEqual(param1, param2); // Parameters should be the same
    assert.strictEqual(manager2.counter, 1); // Only one parameter created
  });

  test("should handle empty arrays correctly in different scenarios", () => {
    const emptyInCondition = createInCondition("status", [], []);
    const emptyNotInCondition = createNotInCondition("priority", [], []);

    const inSql = generateInSql(emptyInCondition);
    const notInSql = generateInSql(emptyNotInCondition);

    assert.strictEqual(inSql, "FALSE");
    assert.strictEqual(notInSql, "TRUE");
  });

  test("should handle UNNEST conditions with parameter manager integration", () => {
    const manager = createParameterManager();
    const values = ["active", "pending", "completed"];

    // Add array as single parameter for UNNEST form
    const [newManager, paramName] = addParameter(manager, values);
    const condition = createInUnnestCondition("status", values, paramName);
    const sql = generateInSql(condition);

    assert.strictEqual(sql, "status IN UNNEST(@param1)");
    assert.deepStrictEqual(newManager.parameters.param1, values);
  });

  test("should handle mixed IN and IN UNNEST conditions", () => {
    // Individual parameter form
    const individualCondition = createInCondition(
      "status1",
      ["active", "pending"],
      ["@param1", "@param2"]
    );
    const individualSql = generateInSql(individualCondition);

    // UNNEST form
    const unnestCondition = createInUnnestCondition("status2", ["active", "pending"], "@param3");
    const unnestSql = generateInSql(unnestCondition);

    assert.strictEqual(individualSql, "status1 IN (@param1, @param2)");
    assert.strictEqual(unnestSql, "status2 IN UNNEST(@param3)");
  });
});

describe("SQL Generation for Logical Operators", () => {
  test("generateLogicalSql should generate AND condition group with proper parentheses", () => {
    const condition1 = createEqCondition("age", 25, "@param1");
    const condition2 = createEqCondition("status", "active", "@param2");
    const group = createAndGroup([condition1, condition2]);

    const sql = generateLogicalSql(group);

    assert.strictEqual(sql, "(age = @param1 AND status = @param2)");
  });

  test("generateLogicalSql should generate OR condition group with proper parentheses", () => {
    const condition1 = createEqCondition("priority", "high", "@param1");
    const condition2 = createEqCondition("priority", "urgent", "@param2");
    const group = createOrGroup([condition1, condition2]);

    const sql = generateLogicalSql(group);

    assert.strictEqual(sql, "(priority = @param1 OR priority = @param2)");
  });

  test("generateLogicalSql should handle empty AND group", () => {
    const group = createAndGroup([]);
    const sql = generateLogicalSql(group);

    // Empty AND group should be TRUE (all conditions match)
    assert.strictEqual(sql, "TRUE");
  });

  test("generateLogicalSql should handle empty OR group", () => {
    const group = createOrGroup([]);
    const sql = generateLogicalSql(group);

    // Empty OR group should be FALSE (no conditions match)
    assert.strictEqual(sql, "FALSE");
  });

  test("generateLogicalSql should handle single condition without parentheses", () => {
    const condition = createEqCondition("name", "John", "@param1");
    const group = createAndGroup([condition]);

    const sql = generateLogicalSql(group);

    // Single condition should not have parentheses
    assert.strictEqual(sql, "name = @param1");
  });

  test("generateLogicalSql should handle nested condition groups", () => {
    const condition1 = createEqCondition("age", 25, "@param1");
    const condition2 = createEqCondition("status", "active", "@param2");
    const innerGroup = createOrGroup([condition1, condition2]);

    const condition3 = createGtCondition("score", 80, "@param3");
    const outerGroup = createAndGroup([innerGroup, condition3]);

    const sql = generateLogicalSql(outerGroup);

    assert.strictEqual(sql, "((age = @param1 OR status = @param2) AND score > @param3)");
  });

  test("generateLogicalSql should handle multiple levels of nesting", () => {
    // Create: ((age = 25 OR age = 30) AND status = 'active') OR priority = 'high'
    const ageCondition1 = createEqCondition("age", 25, "@param1");
    const ageCondition2 = createEqCondition("age", 30, "@param2");
    const ageGroup = createOrGroup([ageCondition1, ageCondition2]);

    const statusCondition = createEqCondition("status", "active", "@param3");
    const innerAndGroup = createAndGroup([ageGroup, statusCondition]);

    const priorityCondition = createEqCondition("priority", "high", "@param4");
    const outerOrGroup = createOrGroup([innerAndGroup, priorityCondition]);

    const sql = generateLogicalSql(outerOrGroup);

    assert.strictEqual(
      sql,
      "(((age = @param1 OR age = @param2) AND status = @param3) OR priority = @param4)"
    );
  });

  test("generateLogicalSql should handle mixed condition types in groups", () => {
    const comparisonCondition = createEqCondition("age", 25, "@param1");
    const inCondition = createInCondition("status", ["active", "pending"], ["@param2", "@param3"]);
    const likeCondition = createLikeCondition("name", "John%", "@param4");
    const nullCondition = createIsNullCondition("deleted_at");

    const group = createAndGroup([comparisonCondition, inCondition, likeCondition, nullCondition]);

    const sql = generateLogicalSql(group);

    assert.strictEqual(
      sql,
      "(age = @param1 AND status IN (@param2, @param3) AND name LIKE @param4 AND deleted_at IS NULL)"
    );
  });

  test("generateLogicalSql should handle UNNEST conditions in groups", () => {
    const comparisonCondition = createEqCondition("age", 25, "@param1");
    const inUnnestCondition = createInUnnestCondition("status", ["active", "pending"], "@param2");
    const notInUnnestCondition = createNotInUnnestCondition("priority", ["low"], "@param3");

    const group = createAndGroup([comparisonCondition, inUnnestCondition, notInUnnestCondition]);

    const sql = generateLogicalSql(group);

    assert.strictEqual(
      sql,
      "(age = @param1 AND status IN UNNEST(@param2) AND priority NOT IN UNNEST(@param3))"
    );
  });

  test("generateLogicalSql should handle function conditions in groups", () => {
    const startsWithCondition = createStartsWithCondition("name", "John", "@param1");
    const endsWithCondition = createEndsWithCondition("email", "@example.com", "@param2");

    const group = createOrGroup([startsWithCondition, endsWithCondition]);

    const sql = generateLogicalSql(group);

    assert.strictEqual(sql, "(STARTS_WITH(name, @param1) OR ENDS_WITH(email, @param2))");
  });

  test("generateLogicalSql should throw error for non-condition-group input", () => {
    const condition = createEqCondition("age", 25, "@param1");

    assert.throws(() => generateLogicalSql(condition as unknown as ConditionGroup), {
      name: "Error",
      message: "Expected condition group",
    });
  });

  test("generateLogicalSql should handle large groups with many conditions", () => {
    const conditions: Condition[] = [];
    for (let i = 1; i <= 5; i++) {
      conditions.push(createEqCondition(`col${i}`, `value${i}`, `@param${i}`));
    }

    const group = createAndGroup(conditions);
    const sql = generateLogicalSql(group);

    const expected =
      "(col1 = @param1 AND col2 = @param2 AND col3 = @param3 AND col4 = @param4 AND col5 = @param5)";
    assert.strictEqual(sql, expected);
  });
});

describe("Unified SQL Generation", () => {
  test("generateConditionSql should handle individual comparison conditions", () => {
    const condition = createEqCondition("age", 25, "@param1");
    const sql = generateConditionSql(condition);

    assert.strictEqual(sql, "age = @param1");
  });

  test("generateConditionSql should handle individual IN conditions", () => {
    const condition = createInCondition("status", ["active", "pending"], ["@param1", "@param2"]);
    const sql = generateConditionSql(condition);

    assert.strictEqual(sql, "status IN (@param1, @param2)");
  });

  test("generateConditionSql should handle individual LIKE conditions", () => {
    const condition = createLikeCondition("name", "John%", "@param1");
    const sql = generateConditionSql(condition);

    assert.strictEqual(sql, "name LIKE @param1");
  });

  test("generateConditionSql should handle individual function conditions", () => {
    const condition = createStartsWithCondition("name", "John", "@param1");
    const sql = generateConditionSql(condition);

    assert.strictEqual(sql, "STARTS_WITH(name, @param1)");
  });

  test("generateConditionSql should handle individual null conditions", () => {
    const condition = createIsNullCondition("deleted_at");
    const sql = generateConditionSql(condition);

    assert.strictEqual(sql, "deleted_at IS NULL");
  });

  test("generateConditionSql should handle condition groups", () => {
    const condition1 = createEqCondition("age", 25, "@param1");
    const condition2 = createEqCondition("status", "active", "@param2");
    const group = createAndGroup([condition1, condition2]);

    const sql = generateConditionSql(group);

    assert.strictEqual(sql, "(age = @param1 AND status = @param2)");
  });

  test("generateConditionSql should handle nested groups recursively", () => {
    const condition1 = createEqCondition("age", 25, "@param1");
    const condition2 = createEqCondition("status", "active", "@param2");
    const innerGroup = createOrGroup([condition1, condition2]);

    const condition3 = createGtCondition("score", 80, "@param3");
    const outerGroup = createAndGroup([innerGroup, condition3]);

    const sql = generateConditionSql(outerGroup);

    assert.strictEqual(sql, "((age = @param1 OR status = @param2) AND score > @param3)");
  });

  test("generateConditionSql should throw error for unsupported condition types", () => {
    const invalidCondition: Condition = {
      type: "invalid" as ConditionType,
      column: "test",
      operator: "INVALID",
    };

    assert.throws(() => generateConditionSql(invalidCondition), {
      name: "Error",
      message: "Unsupported condition type: invalid",
    });
  });

  test("generateConditionSql should throw error for invalid condition nodes", () => {
    const invalidNode = { invalid: "node" } as unknown as ConditionNode;

    assert.throws(() => generateConditionSql(invalidNode), {
      name: "Error",
      message: "Invalid condition node: must be either Condition or ConditionGroup",
    });
  });

  test("generateConditionSql should handle complex mixed scenarios", () => {
    // Create a complex condition tree:
    // (age > 18 AND (status = 'active' OR status = 'pending')) OR (priority = 'high' AND name LIKE 'John%')

    const ageCondition = createGtCondition("age", 18, "@param1");
    const statusCondition1 = createEqCondition("status", "active", "@param2");
    const statusCondition2 = createEqCondition("status", "pending", "@param3");
    const statusGroup = createOrGroup([statusCondition1, statusCondition2]);
    const leftGroup = createAndGroup([ageCondition, statusGroup]);

    const priorityCondition = createEqCondition("priority", "high", "@param4");
    const nameCondition = createLikeCondition("name", "John%", "@param5");
    const rightGroup = createAndGroup([priorityCondition, nameCondition]);

    const rootGroup = createOrGroup([leftGroup, rightGroup]);

    const sql = generateConditionSql(rootGroup);

    const expected =
      "((age > @param1 AND (status = @param2 OR status = @param3)) OR (priority = @param4 AND name LIKE @param5))";
    assert.strictEqual(sql, expected);
  });

  test("generateConditionSql should handle operator precedence correctly", () => {
    // Test that AND has higher precedence than OR when mixed
    // Create: condition1 OR condition2 AND condition3
    // Should be grouped as: condition1 OR (condition2 AND condition3)

    const condition1 = createEqCondition("a", 1, "@param1");
    const condition2 = createEqCondition("b", 2, "@param2");
    const condition3 = createEqCondition("c", 3, "@param3");

    const andGroup = createAndGroup([condition2, condition3]);
    const orGroup = createOrGroup([condition1, andGroup]);

    const sql = generateConditionSql(orGroup);

    assert.strictEqual(sql, "(a = @param1 OR (b = @param2 AND c = @param3))");
  });

  test("generateConditionSql should handle edge cases with empty arrays in IN conditions", () => {
    const emptyInCondition = createInCondition("status", [], []);
    const normalCondition = createEqCondition("age", 25, "@param1");
    const group = createAndGroup([emptyInCondition, normalCondition]);

    const sql = generateConditionSql(group);

    // Empty IN should generate FALSE, so the AND group should be (FALSE AND age = @param1)
    assert.strictEqual(sql, "(FALSE AND age = @param1)");
  });

  test("generateConditionSql should handle null value special cases in groups", () => {
    const nullEqCondition = createEqCondition("deleted_at", null, "@param1");
    const nullNeCondition = createNeCondition("created_at", null, "@param2");
    const group = createOrGroup([nullEqCondition, nullNeCondition]);

    const sql = generateConditionSql(group);

    assert.strictEqual(sql, "(deleted_at IS NULL OR created_at IS NOT NULL)");
  });
});

describe("WhereBuilder Factory", () => {
  test("createWhere should return WhereBuilder instance", () => {
    const builder = createWhere();

    assert.ok(typeof builder === "object");
    assert.ok(builder !== null);

    // Should have all required methods
    assert.ok(typeof builder.eq === "function");
    assert.ok(typeof builder.ne === "function");
    assert.ok(typeof builder.lt === "function");
    assert.ok(typeof builder.gt === "function");
    assert.ok(typeof builder.le === "function");
    assert.ok(typeof builder.ge === "function");
    assert.ok(typeof builder.in === "function");
    assert.ok(typeof builder.notIn === "function");
    assert.ok(typeof builder.like === "function");
    assert.ok(typeof builder.notLike === "function");
    assert.ok(typeof builder.startsWith === "function");
    assert.ok(typeof builder.endsWith === "function");
    assert.ok(typeof builder.isNull === "function");
    assert.ok(typeof builder.isNotNull === "function");
    assert.ok(typeof builder.and === "function");
    assert.ok(typeof builder.or === "function");
    assert.ok(typeof builder.build === "function");
  });

  test("createWhere should initialize empty condition tree", () => {
    const builder = createWhere();

    // Should have empty AND condition group
    assert.ok(isConditionGroup(builder._conditions));
    assert.strictEqual(builder._conditions.type, "and");
    assert.ok(Array.isArray(builder._conditions.conditions));
    assert.strictEqual(builder._conditions.conditions.length, 0);
  });

  test("createWhere should initialize empty parameter manager", () => {
    const builder = createWhere();

    // Should have empty parameter manager
    assert.ok(typeof builder._parameters === "object");
    assert.ok(builder._parameters !== null);
    assert.deepStrictEqual(builder._parameters.parameters, {});
    assert.strictEqual(builder._parameters.counter, 0);
  });

  test("createWhere should return new instance each time", () => {
    const builder1 = createWhere();
    const builder2 = createWhere();

    // Should be different instances
    assert.notStrictEqual(builder1, builder2);

    // But should have equivalent initial state
    assert.deepStrictEqual(builder1._conditions, builder2._conditions);
    assert.deepStrictEqual(builder1._parameters, builder2._parameters);
  });

  test("createWhere should support generic type parameter", () => {
    interface User extends Record<string, ParameterValue> {
      id: number;
      name: string;
      active: boolean;
    }

    const builder = createWhere<User>();

    // TypeScript should enforce column types at compile time
    // This test verifies the builder can be created with type parameter
    assert.ok(typeof builder === "object");
    assert.ok(builder !== null);
  });

  test("createWhere should work without type parameter", () => {
    const builder = createWhere();

    // Should work with any column names when no type parameter is provided
    assert.ok(typeof builder === "object");
    assert.ok(builder !== null);
  });

  test("unimplemented createWhere methods should throw 'Not implemented yet' errors", () => {
    const builder = createWhere();

    // String pattern methods are now implemented, so they should not throw errors
    // Only unimplemented methods should throw "Not implemented yet" errors
    assert.doesNotThrow(() => builder.like("column", "pattern"));
    assert.doesNotThrow(() => builder.notLike("column", "pattern"));
    assert.doesNotThrow(() => builder.startsWith("column", "prefix"));
    assert.doesNotThrow(() => builder.endsWith("column", "suffix"));

    // These methods are now implemented
    assert.doesNotThrow(() => builder.isNull("column"));
    assert.doesNotThrow(() => builder.isNotNull("column"));

    // The or method is now implemented
    assert.doesNotThrow(() => builder.or(() => builder));

    // The build method is now implemented
    assert.doesNotThrow(() => builder.build());

    // The and method is now implemented
    assert.doesNotThrow(() => builder.and(() => builder));
  });

  test("WhereBuilder should have readonly properties", () => {
    const builder = createWhere();

    // Properties should exist and be accessible
    assert.ok(Object.hasOwn(builder, "_conditions"));
    assert.ok(Object.hasOwn(builder, "_parameters"));

    // TypeScript should enforce readonly at compile time
    // Runtime verification that properties exist
    assert.ok(builder._conditions !== undefined);
    assert.ok(builder._parameters !== undefined);
  });

  test("createWhere should maintain immutability principle", () => {
    const builder1 = createWhere();
    const builder2 = createWhere();

    // Each instance should have its own condition tree and parameter manager
    assert.notStrictEqual(builder1._conditions, builder2._conditions);
    assert.notStrictEqual(builder1._parameters, builder2._parameters);

    // But they should have equivalent content
    assert.deepStrictEqual(builder1._conditions, builder2._conditions);
    assert.deepStrictEqual(builder1._parameters, builder2._parameters);
  });
});

describe("createWhere", () => {
  test("createWhere should create WhereBuilder with empty conditions and parameters", () => {
    const builder = createWhere();

    assert.ok(typeof builder === "object");
    assert.ok(typeof builder._conditions === "object");
    assert.ok(typeof builder._parameters === "object");

    // Should have empty AND group
    assert.strictEqual(builder._conditions.type, "and");
    assert.ok(Array.isArray(builder._conditions.conditions));
    assert.strictEqual(builder._conditions.conditions.length, 0);

    // Should have empty parameter manager
    assert.deepStrictEqual(builder._parameters.parameters, {});
    assert.strictEqual(builder._parameters.counter, 0);
  });

  test("createWhere should return new instance each time", () => {
    const builder1 = createWhere();
    const builder2 = createWhere();

    assert.notStrictEqual(builder1, builder2);
    assert.notStrictEqual(builder1._conditions, builder2._conditions);
    assert.notStrictEqual(builder1._parameters, builder2._parameters);
  });

  test("createWhere should support generic type parameter", () => {
    interface User extends Record<string, ParameterValue> {
      id: number;
      name: string;
      active: boolean;
    }

    const builder = createWhere<User>();

    // Type check - this should compile without errors
    assert.ok(typeof builder === "object");
    assert.ok(typeof builder.eq === "function");
    assert.ok(typeof builder.ne === "function");
    assert.ok(typeof builder.gt === "function");
    assert.ok(typeof builder.lt === "function");
    assert.ok(typeof builder.ge === "function");
    assert.ok(typeof builder.le === "function");
  });

  test("WhereBuilder methods should exist and be functions", () => {
    const builder = createWhere();

    // Basic comparison methods
    assert.ok(typeof builder.eq === "function");
    assert.ok(typeof builder.ne === "function");
    assert.ok(typeof builder.gt === "function");
    assert.ok(typeof builder.lt === "function");
    assert.ok(typeof builder.ge === "function");
    assert.ok(typeof builder.le === "function");

    // Array operations
    assert.ok(typeof builder.in === "function");
    assert.ok(typeof builder.notIn === "function");

    // String operations
    assert.ok(typeof builder.like === "function");
    assert.ok(typeof builder.notLike === "function");
    assert.ok(typeof builder.startsWith === "function");
    assert.ok(typeof builder.endsWith === "function");

    // Null checks
    assert.ok(typeof builder.isNull === "function");
    assert.ok(typeof builder.isNotNull === "function");

    // Logical operators
    assert.ok(typeof builder.and === "function");
    assert.ok(typeof builder.or === "function");

    // Build method
    assert.ok(typeof builder.build === "function");
  });
});

describe("WhereBuilder Basic Comparison Methods", () => {
  describe("eq method", () => {
    test("should add equality condition and return new builder", () => {
      const builder = createWhere();
      const newBuilder = builder.eq("age", 25);

      // Should return new builder instance
      assert.notStrictEqual(newBuilder, builder);

      // Should add condition to new builder
      assert.strictEqual(newBuilder._conditions.conditions.length, 1);
      const condition = newBuilder._conditions.conditions[0] as Condition;
      assert.strictEqual(condition.type, "comparison");
      assert.strictEqual(condition.column, "age");
      assert.strictEqual(condition.operator, "=");
      assert.strictEqual(condition.value, 25);
      assert.strictEqual(condition.parameterName, "@param1");

      // Should add parameter to new builder
      assert.strictEqual(newBuilder._parameters.counter, 1);
      assert.strictEqual(newBuilder._parameters.parameters.param1, 25);

      // Original builder should be unchanged
      assert.strictEqual(builder._conditions.conditions.length, 0);
      assert.strictEqual(builder._parameters.counter, 0);
    });

    test("should handle null values correctly", () => {
      const builder = createWhere();
      const newBuilder = builder.eq("deleted_at", null);

      const condition = newBuilder._conditions.conditions[0] as Condition;
      assert.strictEqual(condition.value, null);
      assert.strictEqual(condition.parameterName, "@param1");
      assert.strictEqual(newBuilder._parameters.parameters.param1, null);
    });

    test("should handle different data types", () => {
      const builder = createWhere();

      const stringBuilder = builder.eq("name", "John");
      const numberBuilder = stringBuilder.eq("age", 30);
      const boolBuilder = numberBuilder.eq("active", true);

      // Check string condition
      const stringCondition = stringBuilder._conditions.conditions[0] as Condition;
      assert.strictEqual(stringCondition.value, "John");
      assert.strictEqual(stringCondition.parameterName, "@param1");

      // Check number condition
      const numberCondition = numberBuilder._conditions.conditions[1] as Condition;
      assert.strictEqual(numberCondition.value, 30);
      assert.strictEqual(numberCondition.parameterName, "@param2");

      // Check boolean condition
      const boolCondition = boolBuilder._conditions.conditions[2] as Condition;
      assert.strictEqual(boolCondition.value, true);
      assert.strictEqual(boolCondition.parameterName, "@param3");
    });
  });

  describe("ne method", () => {
    test("should add not-equal condition and return new builder", () => {
      const builder = createWhere();
      const newBuilder = builder.ne("status", "inactive");

      // Should return new builder instance
      assert.notStrictEqual(newBuilder, builder);

      // Should add condition to new builder
      assert.strictEqual(newBuilder._conditions.conditions.length, 1);
      const condition = newBuilder._conditions.conditions[0] as Condition;
      assert.strictEqual(condition.type, "comparison");
      assert.strictEqual(condition.column, "status");
      assert.strictEqual(condition.operator, "!=");
      assert.strictEqual(condition.value, "inactive");
      assert.strictEqual(condition.parameterName, "@param1");

      // Should add parameter to new builder
      assert.strictEqual(newBuilder._parameters.counter, 1);
      assert.strictEqual(newBuilder._parameters.parameters.param1, "inactive");
    });

    test("should handle null values correctly", () => {
      const builder = createWhere();
      const newBuilder = builder.ne("deleted_at", null);

      const condition = newBuilder._conditions.conditions[0] as Condition;
      assert.strictEqual(condition.value, null);
      assert.strictEqual(condition.operator, "!=");
    });
  });

  describe("gt method", () => {
    test("should add greater-than condition and return new builder", () => {
      const builder = createWhere();
      const newBuilder = builder.gt("age", 18);

      // Should return new builder instance
      assert.notStrictEqual(newBuilder, builder);

      // Should add condition to new builder
      assert.strictEqual(newBuilder._conditions.conditions.length, 1);
      const condition = newBuilder._conditions.conditions[0] as Condition;
      assert.strictEqual(condition.type, "comparison");
      assert.strictEqual(condition.column, "age");
      assert.strictEqual(condition.operator, ">");
      assert.strictEqual(condition.value, 18);
      assert.strictEqual(condition.parameterName, "@param1");

      // Should add parameter to new builder
      assert.strictEqual(newBuilder._parameters.counter, 1);
      assert.strictEqual(newBuilder._parameters.parameters.param1, 18);
    });
  });

  describe("lt method", () => {
    test("should add less-than condition and return new builder", () => {
      const builder = createWhere();
      const newBuilder = builder.lt("score", 100);

      // Should return new builder instance
      assert.notStrictEqual(newBuilder, builder);

      // Should add condition to new builder
      assert.strictEqual(newBuilder._conditions.conditions.length, 1);
      const condition = newBuilder._conditions.conditions[0] as Condition;
      assert.strictEqual(condition.type, "comparison");
      assert.strictEqual(condition.column, "score");
      assert.strictEqual(condition.operator, "<");
      assert.strictEqual(condition.value, 100);
      assert.strictEqual(condition.parameterName, "@param1");

      // Should add parameter to new builder
      assert.strictEqual(newBuilder._parameters.counter, 1);
      assert.strictEqual(newBuilder._parameters.parameters.param1, 100);
    });
  });

  describe("ge method", () => {
    test("should add greater-than-or-equal condition and return new builder", () => {
      const builder = createWhere();
      const newBuilder = builder.ge("rating", 4.5);

      // Should return new builder instance
      assert.notStrictEqual(newBuilder, builder);

      // Should add condition to new builder
      assert.strictEqual(newBuilder._conditions.conditions.length, 1);
      const condition = newBuilder._conditions.conditions[0] as Condition;
      assert.strictEqual(condition.type, "comparison");
      assert.strictEqual(condition.column, "rating");
      assert.strictEqual(condition.operator, ">=");
      assert.strictEqual(condition.value, 4.5);
      assert.strictEqual(condition.parameterName, "@param1");

      // Should add parameter to new builder
      assert.strictEqual(newBuilder._parameters.counter, 1);
      assert.strictEqual(newBuilder._parameters.parameters.param1, 4.5);
    });
  });

  describe("le method", () => {
    test("should add less-than-or-equal condition and return new builder", () => {
      const builder = createWhere();
      const newBuilder = builder.le("price", 99.99);

      // Should return new builder instance
      assert.notStrictEqual(newBuilder, builder);

      // Should add condition to new builder
      assert.strictEqual(newBuilder._conditions.conditions.length, 1);
      const condition = newBuilder._conditions.conditions[0] as Condition;
      assert.strictEqual(condition.type, "comparison");
      assert.strictEqual(condition.column, "price");
      assert.strictEqual(condition.operator, "<=");
      assert.strictEqual(condition.value, 99.99);
      assert.strictEqual(condition.parameterName, "@param1");

      // Should add parameter to new builder
      assert.strictEqual(newBuilder._parameters.counter, 1);
      assert.strictEqual(newBuilder._parameters.parameters.param1, 99.99);
    });
  });

  describe("method chaining", () => {
    test("should support chaining multiple comparison methods", () => {
      const builder = createWhere();
      const result = builder.eq("status", "active").gt("age", 18).le("score", 100);

      // Should have 3 conditions
      assert.strictEqual(result._conditions.conditions.length, 3);

      // Check first condition
      const condition1 = result._conditions.conditions[0] as Condition;
      assert.strictEqual(condition1.column, "status");
      assert.strictEqual(condition1.operator, "=");
      assert.strictEqual(condition1.value, "active");

      // Check second condition
      const condition2 = result._conditions.conditions[1] as Condition;
      assert.strictEqual(condition2.column, "age");
      assert.strictEqual(condition2.operator, ">");
      assert.strictEqual(condition2.value, 18);

      // Check third condition
      const condition3 = result._conditions.conditions[2] as Condition;
      assert.strictEqual(condition3.column, "score");
      assert.strictEqual(condition3.operator, "<=");
      assert.strictEqual(condition3.value, 100);

      // Should have 3 parameters
      assert.strictEqual(result._parameters.counter, 3);
      assert.strictEqual(result._parameters.parameters.param1, "active");
      assert.strictEqual(result._parameters.parameters.param2, 18);
      assert.strictEqual(result._parameters.parameters.param3, 100);
    });

    test("should reuse parameters for same values", () => {
      const builder = createWhere();
      const result = builder.eq("status", "active").ne("type", "inactive").eq("category", "active"); // Same value as first condition

      // Should have 3 conditions
      assert.strictEqual(result._conditions.conditions.length, 3);

      // Should reuse parameter for same value
      const condition1 = result._conditions.conditions[0] as Condition;
      const condition3 = result._conditions.conditions[2] as Condition;
      assert.strictEqual(condition1.parameterName, "@param1");
      assert.strictEqual(condition3.parameterName, "@param1"); // Reused

      // Should have only 2 unique parameters
      assert.strictEqual(result._parameters.counter, 2);
      assert.strictEqual(result._parameters.parameters.param1, "active");
      assert.strictEqual(result._parameters.parameters.param2, "inactive");
    });
  });

  describe("immutability", () => {
    test("should maintain immutability across method calls", () => {
      const builder = createWhere();
      const builder1 = builder.eq("name", "John");
      const builder2 = builder1.gt("age", 25);

      // Each builder should be a different instance
      assert.notStrictEqual(builder, builder1);
      assert.notStrictEqual(builder1, builder2);
      assert.notStrictEqual(builder, builder2);

      // Original builder should remain unchanged
      assert.strictEqual(builder._conditions.conditions.length, 0);
      assert.strictEqual(builder._parameters.counter, 0);

      // First builder should have only first condition
      assert.strictEqual(builder1._conditions.conditions.length, 1);
      assert.strictEqual(builder1._parameters.counter, 1);

      // Second builder should have both conditions
      assert.strictEqual(builder2._conditions.conditions.length, 2);
      assert.strictEqual(builder2._parameters.counter, 2);
    });
  });
});
describe("WhereBuilder Array Operations", () => {
  describe("in method", () => {
    test("should create IN condition with multiple values", () => {
      const builder = createWhere<{ status: string }>();
      const result = builder.in("status", ["active", "pending", "completed"]);

      // Should return new builder instance
      assert.notStrictEqual(result, builder);

      // Should have one condition
      assert.strictEqual(result._conditions.conditions.length, 1);
      const condition = result._conditions.conditions[0] as Condition;

      // Should be IN condition
      assert.strictEqual(condition.type, "in");
      assert.strictEqual(condition.column, "status");
      assert.strictEqual(condition.operator, "IN");
      assert.deepStrictEqual(condition.values, ["active", "pending", "completed"]);
      assert.deepStrictEqual(condition.parameterNames, ["@param1", "@param2", "@param3"]);

      // Should have parameters for each value
      assert.strictEqual(result._parameters.counter, 3);
      assert.deepStrictEqual(result._parameters.parameters, {
        param1: "active",
        param2: "pending",
        param3: "completed",
      });
    });

    test("should handle empty array by creating empty IN condition", () => {
      const builder = createWhere<{ status: string }>();
      const result = builder.in("status", []);

      // Should have one condition
      assert.strictEqual(result._conditions.conditions.length, 1);
      const condition = result._conditions.conditions[0] as Condition;

      // Should be empty IN condition
      assert.strictEqual(condition.type, "in");
      assert.strictEqual(condition.column, "status");
      assert.strictEqual(condition.operator, "IN");
      assert.deepStrictEqual(condition.values, []);
      assert.deepStrictEqual(condition.parameterNames, []);

      // Should not add any parameters
      assert.strictEqual(result._parameters.counter, 0);
      assert.deepStrictEqual(result._parameters.parameters, {});
    });

    test("should handle single value array", () => {
      const builder = createWhere<{ id: number }>();
      const result = builder.in("id", [42]);

      const condition = result._conditions.conditions[0] as Condition;
      assert.strictEqual(condition.type, "in");
      assert.strictEqual(condition.column, "id");
      assert.strictEqual(condition.operator, "IN");
      assert.deepStrictEqual(condition.values, [42]);
      assert.deepStrictEqual(condition.parameterNames, ["@param1"]);

      assert.strictEqual(result._parameters.counter, 1);
      assert.deepStrictEqual(result._parameters.parameters, { param1: 42 });
    });

    test("should reuse parameters for duplicate values", () => {
      const builder = createWhere<{ priority: string }>();
      const result = builder.in("priority", ["high", "medium", "high", "low"]);

      const condition = result._conditions.conditions[0] as Condition;
      assert.deepStrictEqual(condition.values, ["high", "medium", "high", "low"]);
      assert.deepStrictEqual(condition.parameterNames, [
        "@param1",
        "@param2",
        "@param1",
        "@param3",
      ]);

      // Should only have 3 unique parameters
      assert.strictEqual(result._parameters.counter, 3);
      assert.deepStrictEqual(result._parameters.parameters, {
        param1: "high",
        param2: "medium",
        param3: "low",
      });
    });

    test("should handle different data types", () => {
      const builder = createWhere<{ values: number | string | boolean | null }>();
      const result = builder.in("values", [1, "string", true, null]);

      const condition = result._conditions.conditions[0] as Condition;
      assert.deepStrictEqual(condition.values, [1, "string", true, null]);
      assert.deepStrictEqual(condition.parameterNames, [
        "@param1",
        "@param2",
        "@param3",
        "@param4",
      ]);

      assert.strictEqual(result._parameters.counter, 4);
      assert.deepStrictEqual(result._parameters.parameters, {
        param1: 1,
        param2: "string",
        param3: true,
        param4: null,
      });
    });

    test("should chain with other conditions", () => {
      const builder = createWhere<{ status: string; age: number }>();
      const result = builder.eq("age", 25).in("status", ["active", "pending"]);

      // Should have two conditions
      assert.strictEqual(result._conditions.conditions.length, 2);

      const eqCondition = result._conditions.conditions[0] as Condition;
      assert.strictEqual(eqCondition.type, "comparison");
      assert.strictEqual(eqCondition.column, "age");

      const inCondition = result._conditions.conditions[1] as Condition;
      assert.strictEqual(inCondition.type, "in");
      assert.strictEqual(inCondition.column, "status");

      // Should have parameters from both conditions
      assert.strictEqual(result._parameters.counter, 3);
      assert.deepStrictEqual(result._parameters.parameters, {
        param1: 25,
        param2: "active",
        param3: "pending",
      });
    });
  });

  describe("notIn method", () => {
    test("should create NOT IN condition with multiple values", () => {
      const builder = createWhere<{ status: string }>();
      const result = builder.notIn("status", ["inactive", "deleted", "banned"]);

      // Should return new builder instance
      assert.notStrictEqual(result, builder);

      // Should have one condition
      assert.strictEqual(result._conditions.conditions.length, 1);
      const condition = result._conditions.conditions[0] as Condition;

      // Should be NOT IN condition
      assert.strictEqual(condition.type, "in");
      assert.strictEqual(condition.column, "status");
      assert.strictEqual(condition.operator, "NOT IN");
      assert.deepStrictEqual(condition.values, ["inactive", "deleted", "banned"]);
      assert.deepStrictEqual(condition.parameterNames, ["@param1", "@param2", "@param3"]);

      // Should have parameters for each value
      assert.strictEqual(result._parameters.counter, 3);
      assert.deepStrictEqual(result._parameters.parameters, {
        param1: "inactive",
        param2: "deleted",
        param3: "banned",
      });
    });

    test("should handle empty array by creating empty NOT IN condition", () => {
      const builder = createWhere<{ status: string }>();
      const result = builder.notIn("status", []);

      // Should have one condition
      assert.strictEqual(result._conditions.conditions.length, 1);
      const condition = result._conditions.conditions[0] as Condition;

      // Should be empty NOT IN condition
      assert.strictEqual(condition.type, "in");
      assert.strictEqual(condition.column, "status");
      assert.strictEqual(condition.operator, "NOT IN");
      assert.deepStrictEqual(condition.values, []);
      assert.deepStrictEqual(condition.parameterNames, []);

      // Should not add any parameters
      assert.strictEqual(result._parameters.counter, 0);
      assert.deepStrictEqual(result._parameters.parameters, {});
    });

    test("should handle single value array", () => {
      const builder = createWhere<{ id: number }>();
      const result = builder.notIn("id", [999]);

      const condition = result._conditions.conditions[0] as Condition;
      assert.strictEqual(condition.type, "in");
      assert.strictEqual(condition.column, "id");
      assert.strictEqual(condition.operator, "NOT IN");
      assert.deepStrictEqual(condition.values, [999]);
      assert.deepStrictEqual(condition.parameterNames, ["@param1"]);

      assert.strictEqual(result._parameters.counter, 1);
      assert.deepStrictEqual(result._parameters.parameters, { param1: 999 });
    });

    test("should reuse parameters for duplicate values", () => {
      const builder = createWhere<{ category: string }>();
      const result = builder.notIn("category", ["spam", "test", "spam", "draft"]);

      const condition = result._conditions.conditions[0] as Condition;
      assert.deepStrictEqual(condition.values, ["spam", "test", "spam", "draft"]);
      assert.deepStrictEqual(condition.parameterNames, [
        "@param1",
        "@param2",
        "@param1",
        "@param3",
      ]);

      // Should only have 3 unique parameters
      assert.strictEqual(result._parameters.counter, 3);
      assert.deepStrictEqual(result._parameters.parameters, {
        param1: "spam",
        param2: "test",
        param3: "draft",
      });
    });

    test("should handle mixed data types", () => {
      const builder = createWhere<{ excluded: number | string | boolean | null }>();
      const result = builder.notIn("excluded", [0, "", false, null]);

      const condition = result._conditions.conditions[0] as Condition;
      assert.deepStrictEqual(condition.values, [0, "", false, null]);
      assert.deepStrictEqual(condition.parameterNames, [
        "@param1",
        "@param2",
        "@param3",
        "@param4",
      ]);

      assert.strictEqual(result._parameters.counter, 4);
      assert.deepStrictEqual(result._parameters.parameters, {
        param1: 0,
        param2: "",
        param3: false,
        param4: null,
      });
    });

    test("should chain with other conditions", () => {
      const builder = createWhere<{ status: string; priority: string }>();
      const result = builder.notIn("status", ["deleted"]).eq("priority", "high");

      // Should have two conditions
      assert.strictEqual(result._conditions.conditions.length, 2);

      const notInCondition = result._conditions.conditions[0] as Condition;
      assert.strictEqual(notInCondition.type, "in");
      assert.strictEqual(notInCondition.operator, "NOT IN");
      assert.strictEqual(notInCondition.column, "status");

      const eqCondition = result._conditions.conditions[1] as Condition;
      assert.strictEqual(eqCondition.type, "comparison");
      assert.strictEqual(eqCondition.column, "priority");

      // Should have parameters from both conditions
      assert.strictEqual(result._parameters.counter, 2);
      assert.deepStrictEqual(result._parameters.parameters, {
        param1: "deleted",
        param2: "high",
      });
    });
  });

  describe("in and notIn combination", () => {
    test("should work together in same query", () => {
      const builder = createWhere<{ status: string; category: string }>();
      const result = builder
        .in("status", ["active", "pending"])
        .notIn("category", ["spam", "test"]);

      // Should have two conditions
      assert.strictEqual(result._conditions.conditions.length, 2);

      const inCondition = result._conditions.conditions[0] as Condition;
      assert.strictEqual(inCondition.operator, "IN");
      assert.deepStrictEqual(inCondition.values, ["active", "pending"]);

      const notInCondition = result._conditions.conditions[1] as Condition;
      assert.strictEqual(notInCondition.operator, "NOT IN");
      assert.deepStrictEqual(notInCondition.values, ["spam", "test"]);

      // Should have all parameters
      assert.strictEqual(result._parameters.counter, 4);
      assert.deepStrictEqual(result._parameters.parameters, {
        param1: "active",
        param2: "pending",
        param3: "spam",
        param4: "test",
      });
    });

    test("should maintain immutability", () => {
      const builder = createWhere<{ values: number }>();
      const builder1 = builder.in("values", [1, 2, 3]);
      const builder2 = builder1.notIn("values", [4, 5]);

      // All builders should be different instances
      assert.notStrictEqual(builder, builder1);
      assert.notStrictEqual(builder1, builder2);
      assert.notStrictEqual(builder, builder2);

      // Original builder should be unchanged
      assert.strictEqual(builder._conditions.conditions.length, 0);
      assert.strictEqual(builder._parameters.counter, 0);

      // First builder should have only IN condition
      assert.strictEqual(builder1._conditions.conditions.length, 1);
      assert.strictEqual(builder1._parameters.counter, 3);

      // Second builder should have both conditions
      assert.strictEqual(builder2._conditions.conditions.length, 2);
      assert.strictEqual(builder2._parameters.counter, 5);
    });
  });
});

describe("WhereBuilder String Pattern Methods", () => {
  describe("like method", () => {
    test("should create LIKE condition and return new builder", () => {
      const builder = createWhere();
      const newBuilder = builder.like("name", "John%");

      // Should return new builder instance
      assert.notStrictEqual(newBuilder, builder);

      // Should have one condition in the new builder
      assert.strictEqual(newBuilder._conditions.conditions.length, 1);

      const condition = newBuilder._conditions.conditions[0] as Condition;
      assert.strictEqual(condition.type, "like");
      assert.strictEqual(condition.column, "name");
      assert.strictEqual(condition.operator, "LIKE");
      assert.strictEqual(condition.value, "John%");
      assert.strictEqual(condition.parameterName, "@param1");

      // Should have parameter in manager
      assert.strictEqual(newBuilder._parameters.counter, 1);
      assert.strictEqual(newBuilder._parameters.parameters.param1, "John%");

      // Original builder should be unchanged
      assert.strictEqual(builder._conditions.conditions.length, 0);
      assert.strictEqual(builder._parameters.counter, 0);
    });

    test("should handle different pattern types", () => {
      const patterns = [
        "John%", // starts with
        "%Smith", // ends with
        "%John%", // contains
        "J_hn", // single character wildcard
        "John", // exact match
        "", // empty pattern
      ];

      patterns.forEach((pattern, _index) => {
        const freshBuilder = createWhere();
        const newBuilder = freshBuilder.like("name", pattern);
        const condition = newBuilder._conditions.conditions[0] as Condition;

        assert.strictEqual(condition.type, "like");
        assert.strictEqual(condition.operator, "LIKE");
        assert.strictEqual(condition.value, pattern);
        assert.strictEqual(condition.parameterName, "@param1"); // Always @param1 since each test uses a fresh builder
      });
    });

    test("should reuse parameters for same pattern", () => {
      const builder = createWhere();

      const builder1 = builder.like("name", "John%");
      const builder2 = builder1.like("title", "John%"); // Same pattern

      // Should reuse the same parameter
      const condition1 = builder2._conditions.conditions[0] as Condition;
      const condition2 = builder2._conditions.conditions[1] as Condition;

      assert.strictEqual(condition1.parameterName, "@param1");
      assert.strictEqual(condition2.parameterName, "@param1");
      assert.strictEqual(builder2._parameters.counter, 1);
    });
  });

  describe("notLike method", () => {
    test("should create NOT LIKE condition and return new builder", () => {
      const builder = createWhere();
      const newBuilder = builder.notLike("email", "%@spam.com");

      // Should return new builder instance
      assert.notStrictEqual(newBuilder, builder);

      // Should have one condition in the new builder
      assert.strictEqual(newBuilder._conditions.conditions.length, 1);

      const condition = newBuilder._conditions.conditions[0] as Condition;
      assert.strictEqual(condition.type, "like");
      assert.strictEqual(condition.column, "email");
      assert.strictEqual(condition.operator, "NOT LIKE");
      assert.strictEqual(condition.value, "%@spam.com");
      assert.strictEqual(condition.parameterName, "@param1");

      // Should have parameter in manager
      assert.strictEqual(newBuilder._parameters.counter, 1);
      assert.strictEqual(newBuilder._parameters.parameters.param1, "%@spam.com");
    });

    test("should handle different exclusion patterns", () => {
      const patterns = [
        "%@spam.com", // ends with exclusion
        "test%", // starts with exclusion
        "%blocked%", // contains exclusion
      ];

      patterns.forEach((pattern, _index) => {
        const freshBuilder = createWhere();
        const newBuilder = freshBuilder.notLike("email", pattern);
        const condition = newBuilder._conditions.conditions[0] as Condition;

        assert.strictEqual(condition.type, "like");
        assert.strictEqual(condition.operator, "NOT LIKE");
        assert.strictEqual(condition.value, pattern);
        assert.strictEqual(condition.parameterName, "@param1"); // Each fresh builder starts with param1
      });
    });
  });

  describe("startsWith method", () => {
    test("should create STARTS_WITH function condition and return new builder", () => {
      const builder = createWhere();
      const newBuilder = builder.startsWith("name", "John");

      // Should return new builder instance
      assert.notStrictEqual(newBuilder, builder);

      // Should have one condition in the new builder
      assert.strictEqual(newBuilder._conditions.conditions.length, 1);

      const condition = newBuilder._conditions.conditions[0] as Condition;
      assert.strictEqual(condition.type, "function");
      assert.strictEqual(condition.column, "name");
      assert.strictEqual(condition.operator, "STARTS_WITH");
      assert.strictEqual(condition.value, "John");
      assert.strictEqual(condition.parameterName, "@param1");

      // Should have parameter in manager
      assert.strictEqual(newBuilder._parameters.counter, 1);
      assert.strictEqual(newBuilder._parameters.parameters.param1, "John");
    });

    test("should handle different prefix types", () => {
      const prefixes = [
        "John", // normal prefix
        "J", // single character
        "", // empty prefix
        "John Doe", // prefix with space
      ];

      prefixes.forEach((prefix, _index) => {
        const freshBuilder = createWhere();
        const newBuilder = freshBuilder.startsWith("name", prefix);
        const condition = newBuilder._conditions.conditions[0] as Condition;

        assert.strictEqual(condition.type, "function");
        assert.strictEqual(condition.operator, "STARTS_WITH");
        assert.strictEqual(condition.value, prefix);
        assert.strictEqual(condition.parameterName, "@param1"); // Each fresh builder starts with param1
      });
    });
  });

  describe("endsWith method", () => {
    test("should create ENDS_WITH function condition and return new builder", () => {
      const builder = createWhere();
      const newBuilder = builder.endsWith("email", "@example.com");

      // Should return new builder instance
      assert.notStrictEqual(newBuilder, builder);

      // Should have one condition in the new builder
      assert.strictEqual(newBuilder._conditions.conditions.length, 1);

      const condition = newBuilder._conditions.conditions[0] as Condition;
      assert.strictEqual(condition.type, "function");
      assert.strictEqual(condition.column, "email");
      assert.strictEqual(condition.operator, "ENDS_WITH");
      assert.strictEqual(condition.value, "@example.com");
      assert.strictEqual(condition.parameterName, "@param1");

      // Should have parameter in manager
      assert.strictEqual(newBuilder._parameters.counter, 1);
      assert.strictEqual(newBuilder._parameters.parameters.param1, "@example.com");
    });

    test("should handle different suffix types", () => {
      const suffixes = [
        "@example.com", // email domain
        ".txt", // file extension
        "son", // name ending
        "", // empty suffix
      ];

      suffixes.forEach((suffix, _index) => {
        const freshBuilder = createWhere();
        const newBuilder = freshBuilder.endsWith("field", suffix);
        const condition = newBuilder._conditions.conditions[0] as Condition;

        assert.strictEqual(condition.type, "function");
        assert.strictEqual(condition.operator, "ENDS_WITH");
        assert.strictEqual(condition.value, suffix);
        assert.strictEqual(condition.parameterName, "@param1"); // Each fresh builder starts with param1
      });
    });
  });

  describe("string pattern method chaining", () => {
    test("should support chaining multiple string pattern methods", () => {
      const builder = createWhere();

      const newBuilder = builder
        .like("name", "John%")
        .notLike("email", "%@spam.com")
        .startsWith("title", "Mr.")
        .endsWith("phone", "1234");

      // Should have 4 conditions
      assert.strictEqual(newBuilder._conditions.conditions.length, 4);

      const conditions = newBuilder._conditions.conditions as Condition[];

      // Check LIKE condition
      assert.strictEqual(conditions[0].type, "like");
      assert.strictEqual(conditions[0].operator, "LIKE");
      assert.strictEqual(conditions[0].value, "John%");

      // Check NOT LIKE condition
      assert.strictEqual(conditions[1].type, "like");
      assert.strictEqual(conditions[1].operator, "NOT LIKE");
      assert.strictEqual(conditions[1].value, "%@spam.com");

      // Check STARTS_WITH condition
      assert.strictEqual(conditions[2].type, "function");
      assert.strictEqual(conditions[2].operator, "STARTS_WITH");
      assert.strictEqual(conditions[2].value, "Mr.");

      // Check ENDS_WITH condition
      assert.strictEqual(conditions[3].type, "function");
      assert.strictEqual(conditions[3].operator, "ENDS_WITH");
      assert.strictEqual(conditions[3].value, "1234");

      // Should have 4 parameters
      assert.strictEqual(newBuilder._parameters.counter, 4);
    });

    test("should chain with comparison and array methods", () => {
      const builder = createWhere();

      const newBuilder = builder
        .eq("age", 25)
        .like("name", "John%")
        .in("status", ["active", "pending"])
        .startsWith("email", "john");

      // Should have 4 conditions
      assert.strictEqual(newBuilder._conditions.conditions.length, 4);

      const conditions = newBuilder._conditions.conditions as Condition[];

      // Check types are correct
      assert.strictEqual(conditions[0].type, "comparison");
      assert.strictEqual(conditions[1].type, "like");
      assert.strictEqual(conditions[2].type, "in");
      assert.strictEqual(conditions[3].type, "function");
    });

    test("should reuse parameters across different string pattern methods", () => {
      const builder = createWhere();

      const newBuilder = builder
        .like("name", "John")
        .startsWith("title", "John") // Same value, should reuse parameter
        .endsWith("suffix", "unique");

      // Should have 3 conditions but only 2 unique parameters
      assert.strictEqual(newBuilder._conditions.conditions.length, 3);
      assert.strictEqual(newBuilder._parameters.counter, 2);

      const conditions = newBuilder._conditions.conditions as Condition[];

      // First two conditions should use same parameter
      assert.strictEqual(conditions[0].parameterName, "@param1");
      assert.strictEqual(conditions[1].parameterName, "@param1");
      assert.strictEqual(conditions[2].parameterName, "@param2");
    });
  });

  describe("string pattern method immutability", () => {
    test("should maintain immutability across string pattern method calls", () => {
      const builder = createWhere();

      const builder1 = builder.like("name", "John%");
      const builder2 = builder1.notLike("email", "%spam%");
      const builder3 = builder2.startsWith("title", "Mr.");
      const builder4 = builder3.endsWith("phone", "1234");

      // Each builder should be a different instance
      assert.notStrictEqual(builder, builder1);
      assert.notStrictEqual(builder1, builder2);
      assert.notStrictEqual(builder2, builder3);
      assert.notStrictEqual(builder3, builder4);

      // Original builder should remain unchanged
      assert.strictEqual(builder._conditions.conditions.length, 0);
      assert.strictEqual(builder._parameters.counter, 0);

      // Each builder should have cumulative conditions
      assert.strictEqual(builder1._conditions.conditions.length, 1);
      assert.strictEqual(builder2._conditions.conditions.length, 2);
      assert.strictEqual(builder3._conditions.conditions.length, 3);
      assert.strictEqual(builder4._conditions.conditions.length, 4);
    });
  });

  describe("string pattern method type safety", () => {
    test("should work with typed schema", () => {
      interface User extends Record<string, ParameterValue> {
        name: string;
        email: string;
        title: string;
      }

      const builder = createWhere<User>();

      // These should compile without errors
      const newBuilder = builder
        .like("name", "John%")
        .notLike("email", "%@spam.com")
        .startsWith("title", "Mr.")
        .endsWith("email", "@example.com");

      assert.strictEqual(newBuilder._conditions.conditions.length, 4);
    });
  });
});
describe("WhereBuilder and method", () => {
  test("and method should accept multiple condition builder functions", () => {
    const builder = createWhere<{ age: number; status: string; name: string }>();

    const result = builder.and(
      (b) => b.eq("age", 25),
      (b) => b.eq("status", "active"),
      (b) => b.eq("name", "John")
    );

    // Should return a new builder instance
    assert.notStrictEqual(result, builder);

    // Should have the correct structure
    assert.ok(result._conditions);
    assert.ok(result._parameters);

    // Should have combined conditions in an AND group
    assert.strictEqual(result._conditions.type, "and");
    assert.strictEqual(result._conditions.conditions.length, 1); // One AND group added

    // The added group should contain all three conditions
    const addedGroup = result._conditions.conditions[0] as ConditionGroup;
    assert.ok(isConditionGroup(addedGroup));
    assert.strictEqual(addedGroup.type, "and");
    assert.strictEqual(addedGroup.conditions.length, 3);

    // Check individual conditions
    const conditions = addedGroup.conditions as Condition[];
    assert.strictEqual(conditions[0].column, "age");
    assert.strictEqual(conditions[0].value, 25);
    assert.strictEqual(conditions[1].column, "status");
    assert.strictEqual(conditions[1].value, "active");
    assert.strictEqual(conditions[2].column, "name");
    assert.strictEqual(conditions[2].value, "John");
  });

  test("and method should handle empty conditions array", () => {
    const builder = createWhere();
    const result = builder.and();

    // Should return the same builder instance when no conditions provided
    assert.strictEqual(result, builder);
  });

  test("and method should handle single condition", () => {
    const builder = createWhere<{ age: number }>();

    const result = builder.and((b) => b.eq("age", 25));

    // Should add the condition properly
    assert.strictEqual(result._conditions.conditions.length, 1);

    const addedGroup = result._conditions.conditions[0] as ConditionGroup;
    assert.ok(isConditionGroup(addedGroup));
    assert.strictEqual(addedGroup.conditions.length, 1);

    const condition = addedGroup.conditions[0] as Condition;
    assert.strictEqual(condition.column, "age");
    assert.strictEqual(condition.value, 25);
  });

  test("and method should combine with existing conditions", () => {
    const builder = createWhere<{ age: number; status: string; name: string }>();

    // Start with an existing condition
    const builderWithCondition = builder.eq("age", 30);

    // Add more conditions with and method
    const result = builderWithCondition.and(
      (b) => b.eq("status", "active"),
      (b) => b.eq("name", "Jane")
    );

    // Should have two items in the root AND group: the original condition and the new AND group
    assert.strictEqual(result._conditions.conditions.length, 2);

    // First condition should be the original
    const firstCondition = result._conditions.conditions[0] as Condition;
    assert.ok(isCondition(firstCondition));
    assert.strictEqual(firstCondition.column, "age");
    assert.strictEqual(firstCondition.value, 30);

    // Second should be the new AND group
    const secondGroup = result._conditions.conditions[1] as ConditionGroup;
    assert.ok(isConditionGroup(secondGroup));
    assert.strictEqual(secondGroup.type, "and");
    assert.strictEqual(secondGroup.conditions.length, 2);

    const newConditions = secondGroup.conditions as Condition[];
    assert.strictEqual(newConditions[0].column, "status");
    assert.strictEqual(newConditions[0].value, "active");
    assert.strictEqual(newConditions[1].column, "name");
    assert.strictEqual(newConditions[1].value, "Jane");
  });

  test("and method should properly manage parameters", () => {
    const builder = createWhere<{ age: number; status: string; name: string }>();

    const result = builder.and(
      (b) => b.eq("age", 25),
      (b) => b.eq("status", "active"),
      (b) => b.eq("name", "John")
    );

    // Should have three parameters
    assert.strictEqual(Object.keys(result._parameters.parameters).length, 3);
    assert.strictEqual(result._parameters.counter, 3);

    // Check parameter values
    assert.strictEqual(result._parameters.parameters.param1, 25);
    assert.strictEqual(result._parameters.parameters.param2, "active");
    assert.strictEqual(result._parameters.parameters.param3, "John");
  });

  test("and method should reuse parameters for same values", () => {
    const builder = createWhere<{ age: number; status: string }>();

    const result = builder.and(
      (b) => b.eq("age", 25),
      (b) => b.eq("status", "active"),
      (b) => b.eq("age", 25) // Same value as first condition
    );

    // Should have only two unique parameters
    assert.strictEqual(Object.keys(result._parameters.parameters).length, 2);
    assert.strictEqual(result._parameters.counter, 2);

    // Check parameter values
    assert.strictEqual(result._parameters.parameters.param1, 25);
    assert.strictEqual(result._parameters.parameters.param2, "active");

    // Check that conditions reference correct parameters
    const addedGroup = result._conditions.conditions[0] as ConditionGroup;
    const conditions = addedGroup.conditions as Condition[];

    assert.strictEqual(conditions[0].parameterName, "@param1"); // age = 25
    assert.strictEqual(conditions[1].parameterName, "@param2"); // status = "active"
    assert.strictEqual(conditions[2].parameterName, "@param1"); // age = 25 (reused)
  });

  test("and method should handle different condition types", () => {
    const builder = createWhere<{ age: number; status: string; name: string; tags: string[] }>();

    const result = builder.and(
      (b) => b.gt("age", 18),
      (b) => b.like("name", "John%"),
      (b) => b.in("status", ["active", "pending"]),
      (b) => b.isNotNull("tags")
    );

    const addedGroup = result._conditions.conditions[0] as ConditionGroup;
    const conditions = addedGroup.conditions as Condition[];

    // Check different condition types
    assert.strictEqual(conditions[0].type, "comparison");
    assert.strictEqual(conditions[0].operator, ">");

    assert.strictEqual(conditions[1].type, "like");
    assert.strictEqual(conditions[1].operator, "LIKE");

    assert.strictEqual(conditions[2].type, "in");
    assert.strictEqual(conditions[2].operator, "IN");

    assert.strictEqual(conditions[3].type, "null");
    assert.strictEqual(conditions[3].operator, "IS NOT NULL");
  });

  test("and method should maintain immutability", () => {
    const builder = createWhere<{ age: number; status: string }>();

    const result1 = builder.and((b) => b.eq("age", 25));
    const result2 = builder.and((b) => b.eq("status", "active"));

    // Each call should return a different instance
    assert.notStrictEqual(result1, result2);
    assert.notStrictEqual(result1, builder);
    assert.notStrictEqual(result2, builder);

    // Original builder should remain unchanged
    assert.strictEqual(builder._conditions.conditions.length, 0);
    assert.strictEqual(builder._parameters.counter, 0);

    // Each result should have its own conditions
    assert.strictEqual(result1._conditions.conditions.length, 1);
    assert.strictEqual(result2._conditions.conditions.length, 1);

    // But they should be different conditions
    const group1 = result1._conditions.conditions[0] as ConditionGroup;
    const group2 = result2._conditions.conditions[0] as ConditionGroup;
    const condition1 = group1.conditions[0] as Condition;
    const condition2 = group2.conditions[0] as Condition;

    assert.strictEqual(condition1.column, "age");
    assert.strictEqual(condition2.column, "status");
  });

  test("and method should handle nested condition building", () => {
    const builder = createWhere<{ age: number; status: string; priority: string }>();

    const result = builder
      .eq("age", 30)
      .and(
        (b) => b.eq("status", "active"),
        (b) => b.eq("priority", "high")
      )
      .and((b) => b.gt("age", 18));

    // Should have three items in root AND group
    assert.strictEqual(result._conditions.conditions.length, 3);

    // First: original condition
    const firstCondition = result._conditions.conditions[0] as Condition;
    assert.strictEqual(firstCondition.column, "age");
    assert.strictEqual(firstCondition.value, 30);

    // Second: first and group
    const secondGroup = result._conditions.conditions[1] as ConditionGroup;
    assert.strictEqual(secondGroup.conditions.length, 2);

    // Third: second and group
    const thirdGroup = result._conditions.conditions[2] as ConditionGroup;
    assert.strictEqual(thirdGroup.conditions.length, 1);
  });

  test("and method should work with type safety", () => {
    interface User extends Record<string, ParameterValue> {
      id: number;
      name: string;
      email: string;
      active: boolean;
    }

    const builder = createWhere<User>();

    // This should compile without errors
    const result = builder.and(
      (b) => b.eq("id", 123),
      (b) => b.like("name", "John%"),
      (b) => b.eq("active", true)
    );

    // Verify the conditions were created correctly
    const addedGroup = result._conditions.conditions[0] as ConditionGroup;
    const conditions = addedGroup.conditions as Condition[];

    assert.strictEqual(conditions[0].column, "id");
    assert.strictEqual(conditions[0].value, 123);
    assert.strictEqual(conditions[1].column, "name");
    assert.strictEqual(conditions[1].value, "John%");
    assert.strictEqual(conditions[2].column, "active");
    assert.strictEqual(conditions[2].value, true);
  });
});
describe("WhereBuilder or method", () => {
  test("or method should accept multiple condition builder functions", () => {
    const builder = createWhere<{ age: number; status: string; name: string }>();

    const result = builder.or(
      (b) => b.eq("age", 25),
      (b) => b.eq("status", "active"),
      (b) => b.like("name", "John%")
    );

    // Should return new builder instance
    assert.notStrictEqual(result, builder);

    // Should have one OR group in the root AND group
    assert.strictEqual(result._conditions.type, "and");
    assert.strictEqual(result._conditions.conditions.length, 1);

    const orGroup = result._conditions.conditions[0] as ConditionGroup;
    assert.strictEqual(orGroup.type, "or");
    assert.strictEqual(orGroup.conditions.length, 3);

    // Check individual conditions
    const conditions = orGroup.conditions as Condition[];
    assert.strictEqual(conditions[0].column, "age");
    assert.strictEqual(conditions[0].value, 25);
    assert.strictEqual(conditions[1].column, "status");
    assert.strictEqual(conditions[1].value, "active");
    assert.strictEqual(conditions[2].column, "name");
    assert.strictEqual(conditions[2].value, "John%");
  });

  test("or method should handle empty conditions array", () => {
    const builder = createWhere<{ age: number }>();

    const result = builder.or();

    // Should return the same builder when no conditions provided
    assert.strictEqual(result, builder);
    assert.strictEqual(result._conditions.conditions.length, 0);
  });

  test("or method should handle single condition", () => {
    const builder = createWhere<{ age: number }>();

    const result = builder.or((b) => b.eq("age", 25));

    // Should have one OR group with one condition
    assert.strictEqual(result._conditions.conditions.length, 1);

    const orGroup = result._conditions.conditions[0] as ConditionGroup;
    assert.strictEqual(orGroup.type, "or");
    assert.strictEqual(orGroup.conditions.length, 1);

    const condition = orGroup.conditions[0] as Condition;
    assert.strictEqual(condition.column, "age");
    assert.strictEqual(condition.value, 25);
  });

  test("or method should manage parameters correctly", () => {
    const builder = createWhere<{ age: number; status: string; priority: string }>();

    const result = builder.or(
      (b) => b.eq("age", 25),
      (b) => b.eq("status", "active"),
      (b) => b.eq("priority", "high")
    );

    // Should have 3 parameters
    assert.strictEqual(Object.keys(result._parameters.parameters).length, 3);
    assert.strictEqual(result._parameters.parameters.param1, 25);
    assert.strictEqual(result._parameters.parameters.param2, "active");
    assert.strictEqual(result._parameters.parameters.param3, "high");
  });

  test("or method should reuse parameters for same values", () => {
    const builder = createWhere<{ status: string; priority: string }>();

    const result = builder.or(
      (b) => b.eq("status", "active"),
      (b) => b.eq("priority", "active") // Same value as status
    );

    // Should reuse parameter for same value
    assert.strictEqual(Object.keys(result._parameters.parameters).length, 1);
    assert.strictEqual(result._parameters.parameters.param1, "active");

    const orGroup = result._conditions.conditions[0] as ConditionGroup;
    const conditions = orGroup.conditions as Condition[];
    assert.strictEqual(conditions[0].parameterName, "@param1");
    assert.strictEqual(conditions[1].parameterName, "@param1");
  });

  test("or method should work with complex condition functions", () => {
    const builder = createWhere<{ age: number; status: string; tags: string }>();

    const result = builder.or(
      (b) => b.gt("age", 18).lt("age", 65), // Multiple conditions in one function
      (b) => b.eq("status", "premium"),
      (b) => b.in("tags", ["vip", "gold"])
    );

    // Should have one OR group
    const orGroup = result._conditions.conditions[0] as ConditionGroup;
    assert.strictEqual(orGroup.type, "or");
    assert.strictEqual(orGroup.conditions.length, 4); // 2 from first function + 1 + 1

    // Check that parameters were managed correctly
    assert.ok(Object.keys(result._parameters.parameters).length >= 4);
  });

  test("or method should combine with existing conditions using AND", () => {
    const builder = createWhere<{ department: string; level: string; experience: number }>();

    const result = builder.eq("department", "engineering").or(
      (b) => b.eq("level", "senior"),
      (b) => b.eq("level", "lead")
    );

    // Should have 2 conditions in root AND group: original condition + OR group
    assert.strictEqual(result._conditions.type, "and");
    assert.strictEqual(result._conditions.conditions.length, 2);

    // First condition: department = engineering
    const firstCondition = result._conditions.conditions[0] as Condition;
    assert.strictEqual(firstCondition.column, "department");
    assert.strictEqual(firstCondition.value, "engineering");

    // Second condition: OR group
    const orGroup = result._conditions.conditions[1] as ConditionGroup;
    assert.strictEqual(orGroup.type, "or");
    assert.strictEqual(orGroup.conditions.length, 2);
  });

  test("or method should handle nested condition builders", () => {
    const builder = createWhere<{ age: number; status: string; priority: string }>();

    const result = builder.or(
      (b) => b.eq("age", 25).eq("status", "active"), // AND within OR
      (b) => b.eq("priority", "high")
    );

    const orGroup = result._conditions.conditions[0] as ConditionGroup;
    assert.strictEqual(orGroup.type, "or");
    assert.strictEqual(orGroup.conditions.length, 3); // 2 from first function + 1 from second
  });

  test("or method should be chainable with multiple calls", () => {
    const builder = createWhere<{ age: number; status: string; priority: string }>();

    const result = builder
      .or(
        (b) => b.eq("age", 25),
        (b) => b.eq("status", "active")
      )
      .or((b) => b.eq("priority", "high"));

    // Should have 2 OR groups in the root AND group
    assert.strictEqual(result._conditions.conditions.length, 2);

    const firstOrGroup = result._conditions.conditions[0] as ConditionGroup;
    const secondOrGroup = result._conditions.conditions[1] as ConditionGroup;

    assert.strictEqual(firstOrGroup.type, "or");
    assert.strictEqual(firstOrGroup.conditions.length, 2);
    assert.strictEqual(secondOrGroup.type, "or");
    assert.strictEqual(secondOrGroup.conditions.length, 1);
  });

  test("or method should work with type safety", () => {
    interface User extends Record<string, ParameterValue> {
      id: number;
      name: string;
      email: string;
      active: boolean;
    }

    const builder = createWhere<User>();

    // This should compile without errors
    const result = builder.or(
      (b) => b.eq("id", 123),
      (b) => b.like("name", "John%"),
      (b) => b.eq("active", true)
    );

    // Verify the conditions were created correctly
    const orGroup = result._conditions.conditions[0] as ConditionGroup;
    const conditions = orGroup.conditions as Condition[];

    assert.strictEqual(conditions[0].column, "id");
    assert.strictEqual(conditions[0].value, 123);
    assert.strictEqual(conditions[1].column, "name");
    assert.strictEqual(conditions[1].value, "John%");
    assert.strictEqual(conditions[2].column, "active");
    assert.strictEqual(conditions[2].value, true);
  });
});

describe("WhereBuilder mixed AND/OR operations", () => {
  test("should handle mixed AND and OR operations correctly", () => {
    const builder = createWhere<{ department: string; level: string; experience: number }>();

    const result = builder.eq("department", "engineering").and(
      (b) =>
        b.or(
          (inner) => inner.eq("level", "senior"),
          (inner) => inner.eq("level", "lead")
        ),
      (b) => b.gt("experience", 5)
    );

    // Root should be AND with 2 conditions: department + AND group
    assert.strictEqual(result._conditions.type, "and");
    assert.strictEqual(result._conditions.conditions.length, 2);

    // First condition: department
    const departmentCondition = result._conditions.conditions[0] as Condition;
    assert.strictEqual(departmentCondition.column, "department");

    // Second condition: AND group containing OR group + experience condition
    const andGroup = result._conditions.conditions[1] as ConditionGroup;
    assert.strictEqual(andGroup.type, "and");
    assert.strictEqual(andGroup.conditions.length, 2);

    // First item in AND group should be OR group
    const orGroup = andGroup.conditions[0] as ConditionGroup;
    assert.strictEqual(orGroup.type, "or");
    assert.strictEqual(orGroup.conditions.length, 2);

    // Second item in AND group should be experience condition
    const experienceCondition = andGroup.conditions[1] as Condition;
    assert.strictEqual(experienceCondition.column, "experience");
  });

  test("should handle OR containing AND operations", () => {
    const builder = createWhere<{
      age: number;
      status: string;
      priority: string;
      department: string;
    }>();

    const result = builder.or(
      (b) => b.eq("age", 25).eq("status", "active"), // AND within OR
      (b) => b.eq("priority", "high").eq("department", "sales") // AND within OR
    );

    const orGroup = result._conditions.conditions[0] as ConditionGroup;
    assert.strictEqual(orGroup.type, "or");
    assert.strictEqual(orGroup.conditions.length, 4); // 2 + 2 conditions flattened

    // All conditions should be at the same level in the OR group
    const conditions = orGroup.conditions as Condition[];
    assert.strictEqual(conditions[0].column, "age");
    assert.strictEqual(conditions[1].column, "status");
    assert.strictEqual(conditions[2].column, "priority");
    assert.strictEqual(conditions[3].column, "department");
  });

  test("should handle complex nested logical operations", () => {
    const builder = createWhere<{
      department: string;
      level: string;
      experience: number;
      active: boolean;
      location: string;
    }>();

    const result = builder
      .eq("active", true)
      .and(
        (b) =>
          b.or(
            (inner) => inner.eq("department", "engineering").ge("experience", 5),
            (inner) => inner.eq("department", "sales").ge("experience", 3)
          ),
        (b) =>
          b.or(
            (inner) => inner.eq("level", "senior"),
            (inner) => inner.eq("level", "lead"),
            (inner) => inner.eq("level", "manager")
          )
      )
      .eq("location", "US");

    // Should have 3 conditions in root AND: active + AND group + location
    assert.strictEqual(result._conditions.conditions.length, 3);

    // Check the nested AND group structure
    const nestedAndGroup = result._conditions.conditions[1] as ConditionGroup;
    assert.strictEqual(nestedAndGroup.type, "and");
    assert.strictEqual(nestedAndGroup.conditions.length, 2);

    // Both items in nested AND should be OR groups
    const firstOrGroup = nestedAndGroup.conditions[0] as ConditionGroup;
    const secondOrGroup = nestedAndGroup.conditions[1] as ConditionGroup;
    assert.strictEqual(firstOrGroup.type, "or");
    assert.strictEqual(secondOrGroup.type, "or");
  });

  test("should maintain parameter consistency across mixed operations", () => {
    const builder = createWhere<{ status: string; priority: string; age: number }>();

    const result = builder
      .and(
        (b) => b.eq("status", "active"),
        (b) =>
          b.or(
            (inner) => inner.eq("priority", "high"),
            (inner) => inner.eq("priority", "urgent")
          )
      )
      .or(
        (b) => b.eq("status", "active"), // Should reuse parameter
        (b) => b.gt("age", 65)
      );

    // Should reuse parameter for repeated "active" value
    const parameters = result._parameters.parameters;
    const activeParams = Object.entries(parameters).filter(([_, value]) => value === "active");
    assert.strictEqual(activeParams.length, 1); // Only one parameter for "active"

    // Should have parameters for: active, high, urgent, 65
    assert.strictEqual(Object.keys(parameters).length, 4);
  });

  test("should handle empty condition functions in mixed operations", () => {
    const builder = createWhere<{ age: number; status: string }>();

    const result = builder
      .eq("age", 25)
      .and() // Empty AND
      .or() // Empty OR
      .eq("status", "active");

    // Empty operations should not affect the result
    assert.strictEqual(result._conditions.conditions.length, 2);

    const firstCondition = result._conditions.conditions[0] as Condition;
    const secondCondition = result._conditions.conditions[1] as Condition;

    assert.strictEqual(firstCondition.column, "age");
    assert.strictEqual(secondCondition.column, "status");
  });
});
describe("WhereBuilder build method", () => {
  test("should return empty SQL for empty condition tree", () => {
    const builder = createWhere();
    const result = builder.build();

    assert.strictEqual(result.sql, "");
    assert.deepStrictEqual(result.parameters, {});
  });

  test("should generate SQL for single equality condition", () => {
    const builder = createWhere();
    const result = builder.eq("age", 25).build();

    assert.strictEqual(result.sql, "age = @param1");
    assert.deepStrictEqual(result.parameters, { param1: 25 });
  });

  test("should generate SQL for multiple AND conditions", () => {
    const builder = createWhere();
    const result = builder.eq("age", 25).eq("status", "active").gt("score", 80).build();

    assert.strictEqual(result.sql, "(age = @param1 AND status = @param2 AND score > @param3)");
    assert.deepStrictEqual(result.parameters, {
      param1: 25,
      param2: "active",
      param3: 80,
    });
  });

  test("should generate SQL for OR conditions", () => {
    const builder = createWhere();
    const result = builder
      .or(
        (b) => b.eq("priority", "high"),
        (b) => b.eq("priority", "urgent"),
        (b) => b.isNull("deadline")
      )
      .build();

    assert.strictEqual(
      result.sql,
      "(priority = @param1 OR priority = @param2 OR deadline IS NULL)"
    );
    assert.deepStrictEqual(result.parameters, {
      param1: "high",
      param2: "urgent",
    });
  });

  test("should generate SQL for mixed AND/OR conditions", () => {
    const builder = createWhere();
    const result = builder
      .eq("department", "engineering")
      .and(
        (b) =>
          b.or(
            (bb) => bb.eq("level", "senior"),
            (bb) => bb.eq("level", "lead")
          ),
        (b) => b.gt("experience", 5)
      )
      .build();

    assert.strictEqual(
      result.sql,
      "(department = @param1 AND ((level = @param2 OR level = @param3) AND experience > @param4))"
    );
    assert.deepStrictEqual(result.parameters, {
      param1: "engineering",
      param2: "senior",
      param3: "lead",
      param4: 5,
    });
  });

  test("should generate SQL for IN conditions", () => {
    const builder = createWhere();
    const result = builder.in("status", ["active", "pending", "completed"]).build();

    assert.strictEqual(result.sql, "status IN (@param1, @param2, @param3)");
    assert.deepStrictEqual(result.parameters, {
      param1: "active",
      param2: "pending",
      param3: "completed",
    });
  });

  test("should generate SQL for empty IN conditions", () => {
    const builder = createWhere();
    const result = builder.in("status", []).build();

    assert.strictEqual(result.sql, "FALSE");
    assert.deepStrictEqual(result.parameters, {});
  });

  test("should generate SQL for empty NOT IN conditions", () => {
    const builder = createWhere();
    const result = builder.notIn("status", []).build();

    assert.strictEqual(result.sql, "TRUE");
    assert.deepStrictEqual(result.parameters, {});
  });

  test("should generate SQL for LIKE conditions", () => {
    const builder = createWhere();
    const result = builder.like("name", "John%").notLike("email", "%@spam.com").build();

    assert.strictEqual(result.sql, "(name LIKE @param1 AND email NOT LIKE @param2)");
    assert.deepStrictEqual(result.parameters, {
      param1: "John%",
      param2: "%@spam.com",
    });
  });

  test("should generate SQL for string function conditions", () => {
    const builder = createWhere();
    const result = builder.startsWith("name", "John").endsWith("email", "@example.com").build();

    assert.strictEqual(result.sql, "(STARTS_WITH(name, @param1) AND ENDS_WITH(email, @param2))");
    assert.deepStrictEqual(result.parameters, {
      param1: "John",
      param2: "@example.com",
    });
  });

  test("should generate SQL for null check conditions", () => {
    const builder = createWhere();
    const result = builder.isNull("deleted_at").isNotNull("created_at").build();

    assert.strictEqual(result.sql, "(deleted_at IS NULL AND created_at IS NOT NULL)");
    assert.deepStrictEqual(result.parameters, {});
  });

  test("should generate SQL for null value comparisons", () => {
    const builder = createWhere();
    const result = builder.eq("deleted_at", null).ne("updated_at", null).build();

    assert.strictEqual(result.sql, "(deleted_at IS NULL AND updated_at IS NOT NULL)");
    assert.deepStrictEqual(result.parameters, {});
  });

  test("should reuse parameters for same values", () => {
    const builder = createWhere();
    const result = builder
      .eq("status", "active")
      .ne("old_status", "active") // Same value, should reuse parameter
      .gt("age", 25)
      .lt("max_age", 25) // Same value, should reuse parameter
      .build();

    assert.strictEqual(
      result.sql,
      "(status = @param1 AND old_status != @param1 AND age > @param2 AND max_age < @param2)"
    );
    assert.deepStrictEqual(result.parameters, {
      param1: "active",
      param2: 25,
    });
  });

  test("should handle complex nested conditions", () => {
    const builder = createWhere();
    const result = builder
      .and(
        (b) => b.eq("department", "engineering"),
        (b) =>
          b.or(
            (bb) =>
              bb.and(
                (bbb) => bbb.eq("level", "senior"),
                (bbb) => bbb.gt("experience", 5)
              ),
            (bb) => bb.eq("level", "lead")
          )
      )
      .isNotNull("active")
      .build();

    assert.strictEqual(
      result.sql,
      "((department = @param1 AND ((level = @param2 AND experience > @param3) OR level = @param4)) AND active IS NOT NULL)"
    );
    assert.deepStrictEqual(result.parameters, {
      param1: "engineering",
      param2: "senior",
      param3: 5,
      param4: "lead",
    });
  });

  test("should handle all comparison operators", () => {
    const builder = createWhere();
    const result = builder
      .eq("a", 1)
      .ne("b", 2)
      .lt("c", 3)
      .le("d", 4)
      .gt("e", 5)
      .ge("f", 6)
      .build();

    assert.strictEqual(
      result.sql,
      "(a = @param1 AND b != @param2 AND c < @param3 AND d <= @param4 AND e > @param5 AND f >= @param6)"
    );
    assert.deepStrictEqual(result.parameters, {
      param1: 1,
      param2: 2,
      param3: 3,
      param4: 4,
      param5: 5,
      param6: 6,
    });
  });

  test("should handle array values in IN conditions", () => {
    const builder = createWhere();
    const result = builder
      .in("tags", ["javascript", "typescript", "node"])
      .notIn("blocked_tags", ["spam", "inappropriate"])
      .build();

    assert.strictEqual(
      result.sql,
      "(tags IN (@param1, @param2, @param3) AND blocked_tags NOT IN (@param4, @param5))"
    );
    assert.deepStrictEqual(result.parameters, {
      param1: "javascript",
      param2: "typescript",
      param3: "node",
      param4: "spam",
      param5: "inappropriate",
    });
  });

  test("should handle mixed data types", () => {
    const builder = createWhere();
    const result = builder
      .eq("name", "John")
      .eq("age", 30)
      .eq("active", true)
      .eq("score", 95.5)
      .isNull("deleted_at")
      .build();

    assert.strictEqual(
      result.sql,
      "(name = @param1 AND age = @param2 AND active = @param3 AND score = @param4 AND deleted_at IS NULL)"
    );
    assert.deepStrictEqual(result.parameters, {
      param1: "John",
      param2: 30,
      param3: true,
      param4: 95.5,
    });
  });

  test("should maintain immutability during build", () => {
    const builder1 = createWhere().eq("age", 25);
    const builder2 = builder1.eq("status", "active");

    const result1 = builder1.build();
    const result2 = builder2.build();

    // First builder should only have age condition
    assert.strictEqual(result1.sql, "age = @param1");
    assert.deepStrictEqual(result1.parameters, { param1: 25 });

    // Second builder should have both conditions
    assert.strictEqual(result2.sql, "(age = @param1 AND status = @param2)");
    assert.deepStrictEqual(result2.parameters, { param1: 25, param2: "active" });
  });
});
