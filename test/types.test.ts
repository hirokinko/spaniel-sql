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
  Condition,
  ConditionGroup,
  ConditionNode,
  ConditionType,
  LogicalOperator,
  isCondition,
  isConditionGroup,
  createComparisonCondition,
  createEqCondition,
  createNeCondition,
  createGtCondition,
  createLtCondition,
  createGeCondition,
  createLeCondition,
  createInCondition,
  createNotInCondition,
  createLikeCondition,
  createNotLikeCondition,
  createStartsWithCondition,
  createEndsWithCondition,
  createIsNullCondition,
  createIsNotNullCondition,
  createAndGroup,
  createOrGroup,
  generateComparisonSql,
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
describe("Condition Types", () => {
  test("ConditionType should include all supported types", () => {
    const validTypes: ConditionType[] = [
      "comparison",
      "in",
      "like",
      "null",
      "function",
    ];

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
    const condition = createEndsWithCondition(
      "email",
      "@example.com",
      "@param1"
    );

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
    const testCases = [
      "@param1",
      "@param123",
      "@userParam",
      "@param_with_underscore",
    ];

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
      {
        name: "Error",
        message: "Expected comparison condition, got in",
      }
    );
  });

  test("generateComparisonSql should throw error when parameter name is missing for non-null values", () => {
    const condition: Condition = {
      type: "comparison",
      column: "age",
      operator: "=",
      value: 25,
      // parameterName is undefined
    };

    assert.throws(
      () => generateComparisonSql(condition),
      {
        name: "Error",
        message: "Parameter name is required for non-null comparison conditions",
      }
    );
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
});