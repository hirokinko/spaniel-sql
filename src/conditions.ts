/**
 * Condition types and creation utilities
 */

import type { ComparisonOperator, ParameterValue } from "./core-types.js";

/**
 * Types of conditions supported by the query builder
 */
export type ConditionType = "comparison" | "in" | "like" | "null" | "function";

/**
 * Logical operators for combining conditions
 */
export type LogicalOperator = "and" | "or";

/**
 * Individual condition representation
 */
export interface Condition {
  /** Type of condition */
  type: ConditionType;
  /** Column name being filtered */
  column: string;
  /** SQL operator or function name */
  operator: string;
  /** Single value for comparison conditions */
  value?: ParameterValue;
  /** Array of values for IN operations */
  values?: ParameterValue[];
  /** Parameter name used in SQL (with @ prefix) */
  parameterName?: string;
  /** Array of parameter names for IN operations */
  parameterNames?: string[];
}

/**
 * Group of conditions combined with logical operators
 */
export interface ConditionGroup {
  /** Logical operator combining the conditions */
  type: LogicalOperator;
  /** Array of conditions or nested condition groups */
  conditions: (Condition | ConditionGroup)[];
}

/**
 * Union type representing any condition tree node
 */
export type ConditionNode = Condition | ConditionGroup;

/**
 * Type guard to check if a node is a Condition
 */
export const isCondition = (node: ConditionNode): node is Condition => {
  return "column" in node;
};

/**
 * Type guard to check if a node is a ConditionGroup
 */
export const isConditionGroup = (node: ConditionNode): node is ConditionGroup => {
  return "conditions" in node;
};

// Comparison condition creators
/**
 * Creates a comparison condition (=, !=, <, >, <=, >=)
 */
export const createComparisonCondition = (
  column: string,
  operator: ComparisonOperator,
  value: ParameterValue,
  parameterName: string
): Condition => ({
  type: "comparison",
  column,
  operator,
  value,
  parameterName,
});

/**
 * Creates an equality condition (=)
 */
export const createEqCondition = (
  column: string,
  value: ParameterValue,
  parameterName: string
): Condition => createComparisonCondition(column, "=", value, parameterName);

/**
 * Creates a not-equal condition (!=)
 */
export const createNeCondition = (
  column: string,
  value: ParameterValue,
  parameterName: string
): Condition => createComparisonCondition(column, "!=", value, parameterName);

/**
 * Creates a greater-than condition (>)
 */
export const createGtCondition = (
  column: string,
  value: ParameterValue,
  parameterName: string
): Condition => createComparisonCondition(column, ">", value, parameterName);

/**
 * Creates a less-than condition (<)
 */
export const createLtCondition = (
  column: string,
  value: ParameterValue,
  parameterName: string
): Condition => createComparisonCondition(column, "<", value, parameterName);

/**
 * Creates a greater-than-or-equal condition (>=)
 */
export const createGeCondition = (
  column: string,
  value: ParameterValue,
  parameterName: string
): Condition => createComparisonCondition(column, ">=", value, parameterName);

/**
 * Creates a less-than-or-equal condition (<=)
 */
export const createLeCondition = (
  column: string,
  value: ParameterValue,
  parameterName: string
): Condition => createComparisonCondition(column, "<=", value, parameterName);

// Array condition creators
/**
 * Creates an IN condition
 */
export const createInCondition = (
  column: string,
  values: ParameterValue[],
  parameterNames: string[]
): Condition => ({
  type: "in",
  column,
  operator: "IN",
  values,
  parameterNames,
});

/**
 * Creates a NOT IN condition
 */
export const createNotInCondition = (
  column: string,
  values: ParameterValue[],
  parameterNames: string[]
): Condition => ({
  type: "in",
  column,
  operator: "NOT IN",
  values,
  parameterNames,
});

/**
 * Creates an IN UNNEST condition (array parameter form)
 */
export const createInUnnestCondition = (
  column: string,
  values: ParameterValue[],
  parameterName: string
): Condition => ({
  type: "in",
  column,
  operator: "IN UNNEST",
  values,
  parameterName,
});

/**
 * Creates a NOT IN UNNEST condition (array parameter form)
 */
export const createNotInUnnestCondition = (
  column: string,
  values: ParameterValue[],
  parameterName: string
): Condition => ({
  type: "in",
  column,
  operator: "NOT IN UNNEST",
  values,
  parameterName,
});

// String pattern condition creators
/**
 * Creates a LIKE condition
 */
export const createLikeCondition = (
  column: string,
  pattern: string,
  parameterName: string
): Condition => ({
  type: "like",
  column,
  operator: "LIKE",
  value: pattern,
  parameterName,
});

/**
 * Creates a NOT LIKE condition
 */
export const createNotLikeCondition = (
  column: string,
  pattern: string,
  parameterName: string
): Condition => ({
  type: "like",
  column,
  operator: "NOT LIKE",
  value: pattern,
  parameterName,
});

/**
 * Creates a STARTS_WITH function condition
 */
export const createStartsWithCondition = (
  column: string,
  prefix: string,
  parameterName: string
): Condition => ({
  type: "function",
  column,
  operator: "STARTS_WITH",
  value: prefix,
  parameterName,
});

/**
 * Creates an ENDS_WITH function condition
 */
export const createEndsWithCondition = (
  column: string,
  suffix: string,
  parameterName: string
): Condition => ({
  type: "function",
  column,
  operator: "ENDS_WITH",
  value: suffix,
  parameterName,
});

// Null condition creators
/**
 * Creates an IS NULL condition
 */
export const createIsNullCondition = (column: string): Condition => ({
  type: "null",
  column,
  operator: "IS NULL",
});

/**
 * Creates an IS NOT NULL condition
 */
export const createIsNotNullCondition = (column: string): Condition => ({
  type: "null",
  column,
  operator: "IS NOT NULL",
});

// Condition group creators
/**
 * Creates a condition group with AND logic
 */
export const createAndGroup = (conditions: ConditionNode[]): ConditionGroup => ({
  type: "and",
  conditions,
});

/**
 * Creates a condition group with OR logic
 */
export const createOrGroup = (conditions: ConditionNode[]): ConditionGroup => ({
  type: "or",
  conditions,
});
