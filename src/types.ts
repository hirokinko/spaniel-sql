/**
 * Core type definitions for spaniel-sql
 */

/**
 * Cloud Spanner data types
 */
export type SpannerDataType =
  | "INT64"
  | "FLOAT64"
  | "STRING"
  | "BYTES"
  | "BOOL"
  | "DATE"
  | "TIMESTAMP"
  | "ARRAY";

/**
 * SQL comparison operators supported by Cloud Spanner
 */
export type ComparisonOperator = "=" | "!=" | "<" | ">" | "<=" | ">=";

/**
 * Type hint information for Spanner API parameters
 * Compatible with @google-cloud/spanner paramTypes format
 */
export type SpannerTypeHint =
  | Lowercase<Exclude<SpannerDataType, "ARRAY">> // Simple types: 'int64', 'string', etc.
  | {
      /** The Spanner data type */
      type: Lowercase<SpannerDataType>;
      /** For ARRAY types, the child element type */
      child?: Lowercase<SpannerDataType>;
    };

/**
 * Result structure returned by the query builder
 */
export interface QueryResult {
  /** Generated SQL string with parameter placeholders */
  sql: string;
  /** Parameter values mapped by parameter names */
  parameters: Record<string, any>;
  /** Type hints for parameters to send to Spanner API */
  types?: Record<string, SpannerTypeHint>;
}

/**
 * Optional schema definition for type safety
 */
export interface TableSchema {
  [columnName: string]: SpannerDataType;
}

/**
 * Immutable parameter manager for handling query parameters
 */
export type ParameterManager = {
  readonly parameters: Record<string, any>;
  readonly counter: number;
};

/**
 * Creates a new empty parameter manager
 */
export const createParameterManager = (): ParameterManager => ({
  parameters: {},
  counter: 0,
});

/**
 * Adds a parameter to the manager, reusing existing parameters with the same value
 * @param manager - The current parameter manager
 * @param value - The value to add as a parameter
 * @returns A tuple containing the new manager and the parameter name (with @ prefix)
 */
export const addParameter = (manager: ParameterManager, value: any): [ParameterManager, string] => {
  // Check if value already exists to reuse parameter
  const existingParam = Object.entries(manager.parameters).find(([_, v]) => {
    // Use strict equality for primitive values and null/undefined
    if (value === null || value === undefined || typeof value !== "object") {
      return v === value;
    }
    // For arrays, compare by JSON serialization (simple approach for now)
    if (Array.isArray(value) && Array.isArray(v)) {
      return JSON.stringify(value) === JSON.stringify(v);
    }
    // For other objects, use strict equality (reference comparison)
    return v === value;
  })?.[0];

  if (existingParam) {
    return [manager, `@${existingParam}`];
  }

  // Create new parameter
  const newCounter = manager.counter + 1;
  const paramName = `param${newCounter}`;

  return [
    {
      parameters: { ...manager.parameters, [paramName]: value },
      counter: newCounter,
    },
    `@${paramName}`,
  ];
};

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
  value?: any;
  /** Array of values for IN operations */
  values?: any[];
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

/**
 * Creates a comparison condition (=, !=, <, >, <=, >=)
 */
export const createComparisonCondition = (
  column: string,
  operator: ComparisonOperator,
  value: any,
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
export const createEqCondition = (column: string, value: any, parameterName: string): Condition =>
  createComparisonCondition(column, "=", value, parameterName);

/**
 * Creates a not-equal condition (!=)
 */
export const createNeCondition = (column: string, value: any, parameterName: string): Condition =>
  createComparisonCondition(column, "!=", value, parameterName);

/**
 * Creates a greater-than condition (>)
 */
export const createGtCondition = (column: string, value: any, parameterName: string): Condition =>
  createComparisonCondition(column, ">", value, parameterName);

/**
 * Creates a less-than condition (<)
 */
export const createLtCondition = (column: string, value: any, parameterName: string): Condition =>
  createComparisonCondition(column, "<", value, parameterName);

/**
 * Creates a greater-than-or-equal condition (>=)
 */
export const createGeCondition = (column: string, value: any, parameterName: string): Condition =>
  createComparisonCondition(column, ">=", value, parameterName);

/**
 * Creates a less-than-or-equal condition (<=)
 */
export const createLeCondition = (column: string, value: any, parameterName: string): Condition =>
  createComparisonCondition(column, "<=", value, parameterName);

/**
 * Creates an IN condition
 */
export const createInCondition = (
  column: string,
  values: any[],
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
  values: any[],
  parameterNames: string[]
): Condition => ({
  type: "in",
  column,
  operator: "NOT IN",
  values,
  parameterNames,
});

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

/**
 * Generates SQL string for a basic comparison condition
 * Handles null value special cases (IS NULL, IS NOT NULL)
 * @param condition - The comparison condition to convert to SQL
 * @returns SQL string representation of the condition
 */
export const generateComparisonSql = (condition: Condition): string => {
  if (condition.type !== "comparison") {
    throw new Error(`Expected comparison condition, got ${condition.type}`);
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
    throw new Error("Parameter name is required for non-null comparison conditions");
  }

  return `${column} ${operator} ${parameterName}`;
};
