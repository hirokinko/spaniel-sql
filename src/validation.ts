/**
 * Validation utilities for query builder
 */

import type { Condition, ConditionType } from "./conditions.js";
import type { ParameterValue } from "./core-types.js";
import { createFailure, createQueryBuilderError, createSuccess, type Result } from "./errors.js";

/**
 * Type guard to check if a value is a valid ParameterValue
 */
export const isParameterValue = (value: unknown): value is ParameterValue => {
  if (value === null || value === undefined) {
    return true;
  }

  const type = typeof value;
  if (type === "string" || type === "number" || type === "boolean") {
    return true;
  }

  if (value instanceof Date || value instanceof Buffer) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every((item) => isParameterValue(item));
  }

  return false;
};

/**
 * Type assertion function that throws if value is not a ParameterValue
 */
export function assertParameterValue(value: unknown): asserts value is ParameterValue {
  if (!isParameterValue(value)) {
    const error = createQueryBuilderError(
      `Invalid parameter value: ${typeof value}. Expected ParameterValue.`,
      "INVALID_PARAMETER_VALUE",
      { providedType: typeof value, providedValue: value }
    );
    throw new Error(error.message);
  }
}

/**
 * Validates a parameter value and returns a Result
 */
export const validateParameterValue = (value: unknown): Result<ParameterValue> => {
  if (!isParameterValue(value)) {
    return createFailure(
      createQueryBuilderError(
        `Invalid parameter value: ${typeof value}. Expected ParameterValue.`,
        "INVALID_PARAMETER_VALUE",
        { providedType: typeof value, providedValue: value }
      )
    );
  }
  return createSuccess(value);
};

/**
 * Validates a column name (basic validation for non-empty strings)
 */
export const validateColumnName = (column: unknown): Result<string> => {
  if (typeof column !== "string") {
    return createFailure(
      createQueryBuilderError(
        `Invalid column name: expected string, got ${typeof column}`,
        "INVALID_COLUMN_NAME",
        { providedType: typeof column, providedValue: column }
      )
    );
  }

  if (column.trim() === "") {
    return createFailure(
      createQueryBuilderError("Column name cannot be empty", "INVALID_COLUMN_NAME", {
        providedValue: column,
      })
    );
  }

  return createSuccess(column);
};

/**
 * Validates a condition object structure
 */
export const validateCondition = (condition: unknown): Result<Condition> => {
  if (!condition || typeof condition !== "object") {
    return createFailure(
      createQueryBuilderError("Condition must be a non-null object", "MALFORMED_CONDITION", {
        providedType: typeof condition,
        providedValue: condition,
      })
    );
  }

  const cond = condition as { type?: unknown; column?: unknown; operator?: unknown };

  // Validate required fields
  if (!cond.type || typeof cond.type !== "string") {
    return createFailure(
      createQueryBuilderError("Condition must have a valid type field", "MALFORMED_CONDITION", {
        condition,
      })
    );
  }

  if (!cond.column || typeof cond.column !== "string") {
    return createFailure(
      createQueryBuilderError("Condition must have a valid column field", "MALFORMED_CONDITION", {
        condition,
      })
    );
  }

  if (!cond.operator || typeof cond.operator !== "string") {
    return createFailure(
      createQueryBuilderError("Condition must have a valid operator field", "MALFORMED_CONDITION", {
        condition,
      })
    );
  }

  // Type-specific validation
  const validTypes: ConditionType[] = ["comparison", "in", "like", "null", "function"];
  if (!validTypes.includes(cond.type as ConditionType)) {
    return createFailure(
      createQueryBuilderError(
        `Invalid condition type: ${cond.type}. Must be one of: ${validTypes.join(", ")}`,
        "INVALID_CONDITION_TYPE",
        { providedType: cond.type, validTypes }
      )
    );
  }

  return createSuccess(condition as Condition);
};
