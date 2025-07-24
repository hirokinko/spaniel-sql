/**
 * SQL generation utilities for converting conditions to SQL strings
 */

import type { Condition, ConditionGroup, ConditionNode } from "./conditions.js";
import { isCondition, isConditionGroup } from "./conditions.js";
import type { ParameterValue } from "./core-types.js";
import { createQueryBuilderError } from "./errors.js";

/**
 * Generates SQL string for a basic comparison condition
 * Handles null value special cases (IS NULL, IS NOT NULL)
 * @param condition - The comparison condition to convert to SQL
 * @returns SQL string representation of the condition
 */
export const generateComparisonSql = (condition: Condition): string => {
  if (condition.type !== "comparison") {
    const error = createQueryBuilderError(
      `Expected comparison condition, got ${condition.type}`,
      "INVALID_CONDITION_TYPE",
      { expectedType: "comparison", actualType: condition.type }
    );
    throw new Error(error.message);
  }

  const { column, operator, value, parameterName } = condition;

  // Handle null value special cases
  if (value === null) {
    if (operator === "=") {
      return `${column} IS NULL`;
    } else if (operator === "!=") {
      return `${column} IS NOT NULL`;
    } else {
      // For other operators with null, use standard parameterized form
      // This allows Cloud Spanner to handle null comparisons according to SQL semantics
      return `${column} ${operator} ${parameterName}`;
    }
  }

  // Standard parameterized comparison
  if (!parameterName) {
    const error = createQueryBuilderError(
      "Parameter name is required for non-null comparison conditions",
      "MISSING_PARAMETER_NAME",
      { condition, value }
    );
    throw new Error(error.message);
  }

  return `${column} ${operator} ${parameterName}`;
};

/**
 * Generates SQL string for IN and NOT IN operations
 * Handles both individual parameter and UNNEST forms, and empty array edge cases
 * @param condition - The IN condition to convert to SQL
 * @returns SQL string representation of the IN condition
 */
export const generateInSql = (condition: Condition): string => {
  if (condition.type !== "in") {
    const error = createQueryBuilderError(
      `Expected in condition, got ${condition.type}`,
      "INVALID_CONDITION_TYPE",
      { expectedType: "in", actualType: condition.type }
    );
    throw new Error(error.message);
  }

  const { column, operator, values, parameterNames, parameterName } = condition;

  // Handle empty array edge case
  if (!values || values.length === 0) {
    // For empty IN/IN UNNEST: always false (no rows match)
    // For empty NOT IN/NOT IN UNNEST: always true (all rows match)
    if (operator === "IN" || operator === "IN UNNEST") {
      return "FALSE"; // No rows will match an empty IN clause
    } else if (operator === "NOT IN" || operator === "NOT IN UNNEST") {
      return "TRUE"; // All rows match an empty NOT IN clause
    }
  }

  // Handle UNNEST form (single array parameter)
  if (operator === "IN UNNEST" || operator === "NOT IN UNNEST") {
    if (!parameterName) {
      const error = createQueryBuilderError(
        "Parameter name is required for UNNEST conditions",
        "MISSING_PARAMETER_NAME",
        { condition, operator }
      );
      throw new Error(error.message);
    }
    return `${column} ${operator}(${parameterName})`;
  }

  // Handle individual parameter form (multiple parameters)
  if (operator === "IN" || operator === "NOT IN") {
    // Validate parameter names array
    if (!parameterNames || parameterNames.length !== (values?.length ?? 0)) {
      const error = createQueryBuilderError(
        "Parameter names array must match values array length",
        "PARAMETER_NAMES_MISMATCH",
        {
          condition,
          valuesLength: values?.length ?? 0,
          parameterNamesLength: parameterNames?.length ?? 0,
        }
      );
      throw new Error(error.message);
    }

    // Generate parameter list: (@param1, @param2, @param3)
    const parameterList = parameterNames.join(", ");
    return `${column} ${operator} (${parameterList})`;
  }

  const error = createQueryBuilderError(
    `Unsupported IN operator: ${operator}`,
    "UNSUPPORTED_OPERATOR",
    { operator, supportedOperators: ["IN", "NOT IN", "IN UNNEST", "NOT IN UNNEST"] }
  );
  throw new Error(error.message);
};

/**
 * Generates SQL string for LIKE and NOT LIKE operations
 * @param condition - The LIKE condition to convert to SQL
 * @returns SQL string representation of the LIKE condition
 */
export const generateLikeSql = (condition: Condition): string => {
  if (condition.type !== "like") {
    const error = createQueryBuilderError(
      `Expected like condition, got ${condition.type}`,
      "INVALID_CONDITION_TYPE",
      { expectedType: "like", actualType: condition.type }
    );
    throw new Error(error.message);
  }

  const { column, operator, parameterName } = condition;

  if (!parameterName) {
    const error = createQueryBuilderError(
      "Parameter name is required for LIKE conditions",
      "MISSING_PARAMETER_NAME",
      { condition, operator }
    );
    throw new Error(error.message);
  }

  return `${column} ${operator} ${parameterName}`;
};

/**
 * Generates SQL string for Cloud Spanner string functions (STARTS_WITH, ENDS_WITH)
 * @param condition - The function condition to convert to SQL
 * @returns SQL string representation of the function condition
 */
export const generateFunctionSql = (condition: Condition): string => {
  if (condition.type !== "function") {
    const error = createQueryBuilderError(
      `Expected function condition, got ${condition.type}`,
      "INVALID_CONDITION_TYPE",
      { expectedType: "function", actualType: condition.type }
    );
    throw new Error(error.message);
  }

  const { column, operator, parameterName } = condition;

  if (!parameterName) {
    const error = createQueryBuilderError(
      "Parameter name is required for function conditions",
      "MISSING_PARAMETER_NAME",
      { condition, operator }
    );
    throw new Error(error.message);
  }

  // Generate function call: STARTS_WITH(column, @param) or ENDS_WITH(column, @param)
  return `${operator}(${column}, ${parameterName})`;
};

/**
 * Generates SQL string for NULL check operations
 * @param condition - The null condition to convert to SQL
 * @returns SQL string representation of the null condition
 */
export const generateNullSql = (condition: Condition): string => {
  if (condition.type !== "null") {
    const error = createQueryBuilderError(
      `Expected null condition, got ${condition.type}`,
      "INVALID_CONDITION_TYPE",
      { expectedType: "null", actualType: condition.type }
    );
    throw new Error(error.message);
  }

  const { column, operator } = condition;

  return `${column} ${operator}`;
};

/**
 * Generates SQL string for logical operator condition groups (AND/OR)
 * Handles proper parentheses for operator precedence and nested groups
 * @param group - The condition group to convert to SQL
 * @returns SQL string representation of the condition group
 */
export const generateLogicalSql = (group: ConditionGroup): string => {
  if (!isConditionGroup(group)) {
    const error = createQueryBuilderError("Expected condition group", "INVALID_CONDITION_NODE", {
      providedNode: group,
    });
    throw new Error(error.message);
  }

  const { type, conditions } = group;

  // Handle empty condition groups
  if (conditions.length === 0) {
    // Return neutral conditions for empty groups
    return type === "and" ? "TRUE" : "FALSE";
  }

  // Handle single condition - no parentheses needed
  if (conditions.length === 1) {
    const condition = conditions[0];
    if (!condition) {
      const error = createQueryBuilderError(
        "Invalid condition: condition is undefined",
        "UNDEFINED_CONDITION",
        { conditionGroup: group, conditionIndex: 0 }
      );
      throw new Error(error.message);
    }
    return generateConditionSql(condition);
  }

  // Generate SQL for each condition
  const conditionSqls = conditions.map((condition, index) => {
    if (!condition) {
      const error = createQueryBuilderError(
        `Invalid condition at index ${index}: condition is undefined`,
        "UNDEFINED_CONDITION",
        { conditionGroup: group, conditionIndex: index }
      );
      throw new Error(error.message);
    }
    return generateConditionSql(condition);
  });

  // Join with appropriate logical operator
  const operator = type.toUpperCase(); // "AND" or "OR"
  const joinedSql = conditionSqls.join(` ${operator} `);

  // Wrap in parentheses for proper grouping
  return `(${joinedSql})`;
};

/**
 * Generates SQL string for any condition node (individual condition or condition group)
 * This is a unified entry point for SQL generation that handles both conditions and groups
 * @param node - The condition node to convert to SQL
 * @returns SQL string representation of the condition node
 */
export const generateConditionSql = (node: ConditionNode): string => {
  if (isCondition(node)) {
    // Handle individual conditions based on their type
    switch (node.type) {
      case "comparison":
        return generateComparisonSql(node);
      case "in":
        return generateInSql(node);
      case "like":
        return generateLikeSql(node);
      case "function":
        return generateFunctionSql(node);
      case "null":
        return generateNullSql(node);
      default: {
        const error = createQueryBuilderError(
          `Unsupported condition type: ${(node as Condition).type}`,
          "UNSUPPORTED_OPERATOR",
          {
            conditionType: (node as Condition).type,
            supportedTypes: ["comparison", "in", "like", "function", "null"],
          }
        );
        throw new Error(error.message);
      }
    }
  } else if (isConditionGroup(node)) {
    // Handle condition groups recursively
    return generateLogicalSql(node);
  } else {
    const error = createQueryBuilderError(
      "Invalid condition node: must be either Condition or ConditionGroup",
      "INVALID_CONDITION_NODE",
      { providedNode: node }
    );
    throw new Error(error.message);
  }
};

/**
 * Filters out null parameters that are converted to IS NULL/IS NOT NULL from the parameters object
 * @param conditionTree - The condition tree to analyze
 * @param parameters - The original parameters object
 * @returns Filtered parameters object without null parameters that become IS NULL/IS NOT NULL
 */
export const filterNullParameters = (
  conditionTree: ConditionGroup,
  parameters: Record<string, ParameterValue>
): Record<string, ParameterValue> => {
  const usedParameterNames = new Set<string>();

  const collectUsedParameters = (node: ConditionNode): void => {
    if (isCondition(node)) {
      // For comparison conditions with null values that become IS NULL/IS NOT NULL,
      // we don't include their parameters
      if (
        node.type === "comparison" &&
        node.value === null &&
        (node.operator === "=" || node.operator === "!=")
      ) {
        // Don't add this parameter to the used set
        return;
      }

      // For all other conditions, collect their parameter names
      if (node.parameterName) {
        const paramName = node.parameterName.replace("@", "");
        usedParameterNames.add(paramName);
      }
      if (node.parameterNames) {
        for (const paramName of node.parameterNames) {
          const cleanParamName = paramName.replace("@", "");
          usedParameterNames.add(cleanParamName);
        }
      }
    } else if (isConditionGroup(node)) {
      // Recursively process condition groups
      for (const condition of node.conditions) {
        collectUsedParameters(condition);
      }
    }
  };

  collectUsedParameters(conditionTree);

  // Filter parameters to only include those that are actually used
  const filteredParameters: Record<string, ParameterValue> = {};
  for (const [paramName, value] of Object.entries(parameters)) {
    if (usedParameterNames.has(paramName)) {
      filteredParameters[paramName] = value;
    }
  }

  return filteredParameters;
};
