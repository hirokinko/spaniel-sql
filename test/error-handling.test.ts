import assert from "node:assert";
import { describe, test } from "node:test";
import {
  type Condition,
  type ConditionGroup,
  createAndGroup,
  createEqCondition,
  createFailure,
  createInCondition,
  createOrGroup,
  createQueryBuilderError,
  createSuccess,
  generateComparisonSql,
  generateConditionSql,
  generateFunctionSql,
  generateInSql,
  generateLikeSql,
  generateLogicalSql,
  generateNullSql,
  type QueryBuilderErrorCode,
  type Result,
  validateColumnName,
  validateCondition,
  validateParameterValue,
} from "../src/types";

describe("Error Handling Types and Functions", () => {
  describe("QueryBuilderError Creation", () => {
    test("createQueryBuilderError should create error with all fields", () => {
      const error = createQueryBuilderError("Test error message", "INVALID_PARAMETER_VALUE", {
        testDetail: "test value",
      });

      assert.strictEqual(error.type, "QueryBuilderError");
      assert.strictEqual(error.message, "Test error message");
      assert.strictEqual(error.code, "INVALID_PARAMETER_VALUE");
      assert.deepStrictEqual(error.details, { testDetail: "test value" });
    });

    test("createQueryBuilderError should work without details", () => {
      const error = createQueryBuilderError("Simple error", "INVALID_CONDITION_TYPE");

      assert.strictEqual(error.type, "QueryBuilderError");
      assert.strictEqual(error.message, "Simple error");
      assert.strictEqual(error.code, "INVALID_CONDITION_TYPE");
      assert.strictEqual(error.details, undefined);
    });

    test("createQueryBuilderError should handle all error codes", () => {
      const errorCodes: QueryBuilderErrorCode[] = [
        "INVALID_PARAMETER_VALUE",
        "INVALID_CONDITION_TYPE",
        "MISSING_PARAMETER_NAME",
        "PARAMETER_NAMES_MISMATCH",
        "UNSUPPORTED_OPERATOR",
        "INVALID_CONDITION_NODE",
        "UNDEFINED_CONDITION",
        "INVALID_COLUMN_NAME",
        "EMPTY_CONDITIONS_ARRAY",
        "MALFORMED_CONDITION",
      ];

      errorCodes.forEach((code) => {
        const error = createQueryBuilderError("Test message", code);
        assert.strictEqual(error.code, code);
      });
    });
  });

  describe("Result Type Functions", () => {
    test("createSuccess should create successful result", () => {
      const result = createSuccess("test data");

      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.data, "test data");
      }
    });

    test("createFailure should create failed result", () => {
      const error = createQueryBuilderError("Test error", "INVALID_PARAMETER_VALUE");
      const result = createFailure(error);

      assert.strictEqual(result.success, false);
      if (!result.success) {
        assert.strictEqual(result.error, error);
      }
    });

    test("Result type should be discriminated union", () => {
      const successResult: Result<string> = createSuccess("data");
      const failureResult: Result<string> = createFailure(
        createQueryBuilderError("Error", "INVALID_PARAMETER_VALUE")
      );

      // Type narrowing should work
      if (successResult.success) {
        assert.strictEqual(successResult.data, "data");
      } else {
        assert.fail("Should be success result");
      }

      if (!failureResult.success) {
        assert.strictEqual(failureResult.error.type, "QueryBuilderError");
      } else {
        assert.fail("Should be failure result");
      }
    });
  });
});

describe("Validation Functions", () => {
  describe("validateParameterValue", () => {
    test("should validate valid parameter values", () => {
      const validValues = [
        "string",
        42,
        3.14,
        true,
        false,
        null,
        undefined,
        new Date(),
        Buffer.from("test"),
        [1, 2, 3],
        ["a", "b", "c"],
        [true, false],
      ];

      validValues.forEach((value) => {
        const result = validateParameterValue(value);
        assert.strictEqual(result.success, true);
        if (result.success) {
          assert.strictEqual(result.data, value);
        }
      });
    });

    test("should reject invalid parameter values", () => {
      const invalidValues = [
        { key: "value" }, // Plain object
        Symbol("test"), // Symbol
        () => {}, // Function
        new Set([1, 2, 3]), // Set
        new Map([["key", "value"]]), // Map
      ];

      invalidValues.forEach((value) => {
        const result = validateParameterValue(value);
        assert.strictEqual(result.success, false);
        if (!result.success) {
          assert.strictEqual(result.error.code, "INVALID_PARAMETER_VALUE");
          assert.ok(result.error.message.includes("Invalid parameter value"));
        }
      });
    });

    test("should validate nested arrays", () => {
      const validNestedArray = [1, [2, 3], "string", null];
      const result = validateParameterValue(validNestedArray);
      assert.strictEqual(result.success, true);
    });

    test("should reject arrays with invalid elements", () => {
      const invalidNestedArray = [1, 2, { invalid: "object" }];
      const result = validateParameterValue(invalidNestedArray);
      assert.strictEqual(result.success, false);
      if (!result.success) {
        assert.strictEqual(result.error.code, "INVALID_PARAMETER_VALUE");
      }
    });
  });

  describe("validateColumnName", () => {
    test("should validate valid column names", () => {
      const validColumns = ["name", "user_id", "created_at", "column123", "Column_Name", "a"];

      validColumns.forEach((column) => {
        const result = validateColumnName(column);
        assert.strictEqual(result.success, true);
        if (result.success) {
          assert.strictEqual(result.data, column);
        }
      });
    });

    test("should reject non-string column names", () => {
      const invalidColumns = [123, null, undefined, {}, [], true];

      invalidColumns.forEach((column) => {
        const result = validateColumnName(column);
        assert.strictEqual(result.success, false);
        if (!result.success) {
          assert.strictEqual(result.error.code, "INVALID_COLUMN_NAME");
          assert.ok(result.error.message.includes("expected string"));
        }
      });
    });

    test("should reject empty column names", () => {
      const emptyColumns = ["", "   ", "\t", "\n"];

      emptyColumns.forEach((column) => {
        const result = validateColumnName(column);
        assert.strictEqual(result.success, false);
        if (!result.success) {
          assert.strictEqual(result.error.code, "INVALID_COLUMN_NAME");
          assert.ok(result.error.message.includes("cannot be empty"));
        }
      });
    });
  });

  describe("validateCondition", () => {
    test("should validate valid condition objects", () => {
      const validCondition = {
        type: "comparison",
        column: "age",
        operator: "=",
        value: 25,
        parameterName: "@param1",
      };

      const result = validateCondition(validCondition);
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.deepStrictEqual(result.data, validCondition);
      }
    });

    test("should reject non-object conditions", () => {
      const invalidConditions = [null, undefined, "string", 123, true, []];

      invalidConditions.forEach((condition) => {
        const result = validateCondition(condition);
        assert.strictEqual(result.success, false);
        if (!result.success) {
          assert.strictEqual(result.error.code, "MALFORMED_CONDITION");
          // For arrays, the error message is different since they pass the object check but fail type validation
          if (Array.isArray(condition)) {
            assert.ok(result.error.message.includes("valid type field"));
          } else {
            assert.ok(result.error.message.includes("non-null object"));
          }
        }
      });
    });

    test("should reject conditions with missing required fields", () => {
      const incompleteConditions = [
        { column: "age", operator: "=" }, // Missing type
        { type: "comparison", operator: "=" }, // Missing column
        { type: "comparison", column: "age" }, // Missing operator
      ];

      incompleteConditions.forEach((condition) => {
        const result = validateCondition(condition);
        assert.strictEqual(result.success, false);
        if (!result.success) {
          assert.strictEqual(result.error.code, "MALFORMED_CONDITION");
        }
      });
    });

    test("should reject conditions with invalid field types", () => {
      const invalidFieldConditions = [
        { type: 123, column: "age", operator: "=" }, // Invalid type field
        { type: "comparison", column: 123, operator: "=" }, // Invalid column field
        { type: "comparison", column: "age", operator: 123 }, // Invalid operator field
      ];

      invalidFieldConditions.forEach((condition) => {
        const result = validateCondition(condition);
        assert.strictEqual(result.success, false);
        if (!result.success) {
          assert.strictEqual(result.error.code, "MALFORMED_CONDITION");
        }
      });
    });

    test("should reject conditions with invalid condition types", () => {
      const invalidTypeCondition = {
        type: "invalid_type",
        column: "age",
        operator: "=",
      };

      const result = validateCondition(invalidTypeCondition);
      assert.strictEqual(result.success, false);
      if (!result.success) {
        assert.strictEqual(result.error.code, "INVALID_CONDITION_TYPE");
        assert.ok(result.error.message.includes("Invalid condition type"));
      }
    });
  });
});

describe("SQL Generation Error Handling", () => {
  describe("generateComparisonSql error handling", () => {
    test("should throw error for non-comparison condition", () => {
      const invalidCondition: Condition = {
        type: "in",
        column: "status",
        operator: "IN",
        values: ["active"],
        parameterNames: ["@param1"],
      };

      assert.throws(
        () => generateComparisonSql(invalidCondition),
        (error: Error) => {
          assert.ok(error.message.includes("Expected comparison condition"));
          return true;
        }
      );
    });

    test("should throw error for missing parameter name", () => {
      const invalidCondition: Condition = {
        type: "comparison",
        column: "age",
        operator: "=",
        value: 25,
        // Missing parameterName
      };

      assert.throws(
        () => generateComparisonSql(invalidCondition),
        (error: Error) => {
          assert.ok(error.message.includes("Parameter name is required"));
          return true;
        }
      );
    });
  });

  describe("generateInSql error handling", () => {
    test("should throw error for non-in condition", () => {
      const invalidCondition: Condition = {
        type: "comparison",
        column: "age",
        operator: "=",
        value: 25,
        parameterName: "@param1",
      };

      assert.throws(
        () => generateInSql(invalidCondition),
        (error: Error) => {
          assert.ok(error.message.includes("Expected in condition"));
          return true;
        }
      );
    });

    test("should throw error for missing parameter name in UNNEST conditions", () => {
      const invalidCondition: Condition = {
        type: "in",
        column: "status",
        operator: "IN UNNEST",
        values: ["active", "pending"],
        // Missing parameterName for UNNEST
      };

      assert.throws(
        () => generateInSql(invalidCondition),
        (error: Error) => {
          assert.ok(error.message.includes("Parameter name is required for UNNEST"));
          return true;
        }
      );
    });

    test("should throw error for parameter names mismatch", () => {
      const invalidCondition: Condition = {
        type: "in",
        column: "status",
        operator: "IN",
        values: ["active", "pending", "completed"],
        parameterNames: ["@param1", "@param2"], // Mismatch: 3 values, 2 parameter names
      };

      assert.throws(
        () => generateInSql(invalidCondition),
        (error: Error) => {
          assert.ok(error.message.includes("Parameter names array must match values array length"));
          return true;
        }
      );
    });

    test("should throw error for unsupported IN operator", () => {
      const invalidCondition: Condition = {
        type: "in",
        column: "status",
        operator: "INVALID_IN_OPERATOR",
        values: ["active"],
        parameterNames: ["@param1"],
      };

      assert.throws(
        () => generateInSql(invalidCondition),
        (error: Error) => {
          assert.ok(error.message.includes("Unsupported IN operator"));
          return true;
        }
      );
    });
  });

  describe("generateLikeSql error handling", () => {
    test("should throw error for non-like condition", () => {
      const invalidCondition: Condition = {
        type: "comparison",
        column: "name",
        operator: "=",
        value: "John",
        parameterName: "@param1",
      };

      assert.throws(
        () => generateLikeSql(invalidCondition),
        (error: Error) => {
          assert.ok(error.message.includes("Expected like condition"));
          return true;
        }
      );
    });

    test("should throw error for missing parameter name", () => {
      const invalidCondition: Condition = {
        type: "like",
        column: "name",
        operator: "LIKE",
        value: "John%",
        // Missing parameterName
      };

      assert.throws(
        () => generateLikeSql(invalidCondition),
        (error: Error) => {
          assert.ok(error.message.includes("Parameter name is required for LIKE"));
          return true;
        }
      );
    });
  });

  describe("generateFunctionSql error handling", () => {
    test("should throw error for non-function condition", () => {
      const invalidCondition: Condition = {
        type: "comparison",
        column: "name",
        operator: "=",
        value: "John",
        parameterName: "@param1",
      };

      assert.throws(
        () => generateFunctionSql(invalidCondition),
        (error: Error) => {
          assert.ok(error.message.includes("Expected function condition"));
          return true;
        }
      );
    });

    test("should throw error for missing parameter name", () => {
      const invalidCondition: Condition = {
        type: "function",
        column: "name",
        operator: "STARTS_WITH",
        value: "John",
        // Missing parameterName
      };

      assert.throws(
        () => generateFunctionSql(invalidCondition),
        (error: Error) => {
          assert.ok(error.message.includes("Parameter name is required for function"));
          return true;
        }
      );
    });
  });

  describe("generateNullSql error handling", () => {
    test("should throw error for non-null condition", () => {
      const invalidCondition: Condition = {
        type: "comparison",
        column: "deleted_at",
        operator: "=",
        value: null,
        parameterName: "@param1",
      };

      assert.throws(
        () => generateNullSql(invalidCondition),
        (error: Error) => {
          assert.ok(error.message.includes("Expected null condition"));
          return true;
        }
      );
    });
  });

  describe("generateConditionSql error handling", () => {
    test("should throw error for unsupported condition type", () => {
      const invalidCondition = {
        type: "unsupported_type",
        column: "test",
        operator: "TEST",
      } as unknown as Condition;

      assert.throws(
        () => generateConditionSql(invalidCondition),
        (error: Error) => {
          assert.ok(error.message.includes("Unsupported condition type"));
          return true;
        }
      );
    });

    test("should throw error for invalid condition node", () => {
      const invalidNode = {
        invalid: "node",
      } as unknown as Condition;

      assert.throws(
        () => generateConditionSql(invalidNode),
        (error: Error) => {
          assert.ok(error.message.includes("Invalid condition node"));
          return true;
        }
      );
    });
  });

  describe("generateLogicalSql error handling", () => {
    test("should throw error for non-condition-group", () => {
      const invalidGroup = {
        type: "comparison",
        column: "age",
        operator: "=",
        value: 25,
      } as unknown as ConditionGroup;

      assert.throws(
        () => generateLogicalSql(invalidGroup),
        (error: Error) => {
          assert.ok(error.message.includes("Expected condition group"));
          return true;
        }
      );
    });

    test("should throw error for undefined condition in single condition group", () => {
      const invalidGroup: ConditionGroup = {
        type: "and",
        conditions: [undefined as unknown as Condition],
      };

      assert.throws(
        () => generateLogicalSql(invalidGroup),
        (error: Error) => {
          assert.ok(error.message.includes("condition is undefined"));
          return true;
        }
      );
    });

    test("should throw error for undefined condition in multiple condition group", () => {
      const validCondition = createEqCondition("age", 25, "@param1");
      const invalidGroup: ConditionGroup = {
        type: "and",
        conditions: [validCondition, undefined as unknown as Condition],
      };

      assert.throws(
        () => generateLogicalSql(invalidGroup),
        (error: Error) => {
          assert.ok(error.message.includes("condition at index 1: condition is undefined"));
          return true;
        }
      );
    });
  });
});

describe("Edge Cases and Error Scenarios", () => {
  test("should handle empty condition groups gracefully", () => {
    const emptyAndGroup = createAndGroup([]);
    const emptyOrGroup = createOrGroup([]);

    const andSql = generateLogicalSql(emptyAndGroup);
    const orSql = generateLogicalSql(emptyOrGroup);

    assert.strictEqual(andSql, "TRUE");
    assert.strictEqual(orSql, "FALSE");
  });

  test("should handle empty IN arrays correctly", () => {
    const emptyInCondition = createInCondition("status", [], []);
    const sql = generateInSql(emptyInCondition);
    assert.strictEqual(sql, "FALSE");

    const emptyNotInCondition: Condition = {
      type: "in",
      column: "status",
      operator: "NOT IN",
      values: [],
      parameterNames: [],
    };
    const notInSql = generateInSql(emptyNotInCondition);
    assert.strictEqual(notInSql, "TRUE");
  });

  test("should provide detailed error information", () => {
    const error = createQueryBuilderError("Test error with details", "PARAMETER_NAMES_MISMATCH", {
      valuesLength: 3,
      parameterNamesLength: 2,
      condition: { type: "in", column: "test" },
    });

    assert.strictEqual(error.message, "Test error with details");
    assert.strictEqual(error.code, "PARAMETER_NAMES_MISMATCH");
    assert.ok(error.details);
    assert.strictEqual(error.details.valuesLength, 3);
    assert.strictEqual(error.details.parameterNamesLength, 2);
  });
});
