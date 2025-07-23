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
 * Creates an IN UNNEST condition (array parameter form)
 */
export const createInUnnestCondition = (
  column: string,
  values: any[],
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
  values: any[],
  parameterName: string
): Condition => ({
  type: "in",
  column,
  operator: "NOT IN UNNEST",
  values,
  parameterName,
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

/**
 * Generates SQL string for IN and NOT IN operations
 * Handles both individual parameter and UNNEST forms, and empty array edge cases
 * @param condition - The IN condition to convert to SQL
 * @returns SQL string representation of the IN condition
 */
export const generateInSql = (condition: Condition): string => {
  if (condition.type !== "in") {
    throw new Error(`Expected in condition, got ${condition.type}`);
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
      throw new Error("Parameter name is required for UNNEST conditions");
    }
    return `${column} ${operator}(${parameterName})`;
  }

  // Handle individual parameter form (multiple parameters)
  if (operator === "IN" || operator === "NOT IN") {
    // Validate parameter names array
    if (!parameterNames || parameterNames.length !== (values?.length ?? 0)) {
      throw new Error("Parameter names array must match values array length");
    }

    // Generate parameter list: (@param1, @param2, @param3)
    const parameterList = parameterNames.join(", ");
    return `${column} ${operator} (${parameterList})`;
  }

  throw new Error(`Unsupported IN operator: ${operator}`);
};

/**
 * Generates SQL string for LIKE and NOT LIKE operations
 * @param condition - The LIKE condition to convert to SQL
 * @returns SQL string representation of the LIKE condition
 */
export const generateLikeSql = (condition: Condition): string => {
  if (condition.type !== "like") {
    throw new Error(`Expected like condition, got ${condition.type}`);
  }

  const { column, operator, parameterName } = condition;

  if (!parameterName) {
    throw new Error("Parameter name is required for LIKE conditions");
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
    throw new Error(`Expected function condition, got ${condition.type}`);
  }

  const { column, operator, parameterName } = condition;

  if (!parameterName) {
    throw new Error("Parameter name is required for function conditions");
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
    throw new Error(`Expected null condition, got ${condition.type}`);
  }

  const { column, operator } = condition;

  return `${column} ${operator}`;
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
      default:
        throw new Error(`Unsupported condition type: ${(node as any).type}`);
    }
  } else if (isConditionGroup(node)) {
    // Handle condition groups recursively
    return generateLogicalSql(node);
  } else {
    throw new Error("Invalid condition node: must be either Condition or ConditionGroup");
  }
};

/**
 * Generates SQL string for logical operator condition groups (AND/OR)
 * Handles proper parentheses for operator precedence and nested groups
 * @param group - The condition group to convert to SQL
 * @returns SQL string representation of the condition group
 */
export const generateLogicalSql = (group: ConditionGroup): string => {
  if (!isConditionGroup(group)) {
    throw new Error("Expected condition group");
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
      throw new Error("Invalid condition: condition is undefined");
    }
    return generateConditionSql(condition);
  }

  // Generate SQL for each condition
  const conditionSqls = conditions.map((condition) => generateConditionSql(condition));

  // Join with appropriate logical operator
  const operator = type.toUpperCase(); // "AND" or "OR"
  const joinedSql = conditionSqls.join(` ${operator} `);

  // Wrap in parentheses for proper grouping
  return `(${joinedSql})`;
};

/**
 * WhereBuilder type - immutable object with fluent interface methods
 */
export type WhereBuilder<T = any> = {
  readonly _conditions: ConditionGroup;
  readonly _parameters: ParameterManager;

  // Basic comparisons
  eq<K extends keyof T>(column: K, value: T[K]): WhereBuilder<T>;
  ne<K extends keyof T>(column: K, value: T[K]): WhereBuilder<T>;
  lt<K extends keyof T>(column: K, value: T[K]): WhereBuilder<T>;
  gt<K extends keyof T>(column: K, value: T[K]): WhereBuilder<T>;
  le<K extends keyof T>(column: K, value: T[K]): WhereBuilder<T>;
  ge<K extends keyof T>(column: K, value: T[K]): WhereBuilder<T>;

  // Array operations
  in<K extends keyof T>(column: K, values: T[K][]): WhereBuilder<T>;
  notIn<K extends keyof T>(column: K, values: T[K][]): WhereBuilder<T>;

  // String operations
  like<K extends keyof T>(column: K, pattern: string): WhereBuilder<T>;
  notLike<K extends keyof T>(column: K, pattern: string): WhereBuilder<T>;
  startsWith<K extends keyof T>(column: K, prefix: string): WhereBuilder<T>;
  endsWith<K extends keyof T>(column: K, suffix: string): WhereBuilder<T>;

  // Null checks
  isNull<K extends keyof T>(column: K): WhereBuilder<T>;
  isNotNull<K extends keyof T>(column: K): WhereBuilder<T>;

  // Logical operators
  and(...conditions: ((builder: WhereBuilder<T>) => WhereBuilder<T>)[]): WhereBuilder<T>;
  or(...conditions: ((builder: WhereBuilder<T>) => WhereBuilder<T>)[]): WhereBuilder<T>;

  // Build final query
  build(): QueryResult;
};

/**
 * Internal helper to create a WhereBuilder with specific state
 * @param conditions - The condition group to use
 * @param parameters - The parameter manager to use
 * @returns A new WhereBuilder instance with the specified state
 */
const createWhereWithState = <T = any>(
  conditions: ConditionGroup,
  parameters: ParameterManager
): WhereBuilder<T> => {
  const builder: WhereBuilder<T> = {
    _conditions: conditions,
    _parameters: parameters,

    eq<K extends keyof T>(column: K, value: T[K]): WhereBuilder<T> {
      const [newParameters, parameterName] = addParameter(builder._parameters, value);
      const condition = createEqCondition(String(column), value, parameterName);
      const newConditions = createAndGroup([...builder._conditions.conditions, condition]);

      return createWhereWithState<T>(newConditions, newParameters);
    },

    ne<K extends keyof T>(column: K, value: T[K]): WhereBuilder<T> {
      const [newParameters, parameterName] = addParameter(builder._parameters, value);
      const condition = createNeCondition(String(column), value, parameterName);
      const newConditions = createAndGroup([...builder._conditions.conditions, condition]);

      return createWhereWithState<T>(newConditions, newParameters);
    },

    lt<K extends keyof T>(column: K, value: T[K]): WhereBuilder<T> {
      const [newParameters, parameterName] = addParameter(builder._parameters, value);
      const condition = createLtCondition(String(column), value, parameterName);
      const newConditions = createAndGroup([...builder._conditions.conditions, condition]);

      return createWhereWithState<T>(newConditions, newParameters);
    },

    gt<K extends keyof T>(column: K, value: T[K]): WhereBuilder<T> {
      const [newParameters, parameterName] = addParameter(builder._parameters, value);
      const condition = createGtCondition(String(column), value, parameterName);
      const newConditions = createAndGroup([...builder._conditions.conditions, condition]);

      return createWhereWithState<T>(newConditions, newParameters);
    },

    le<K extends keyof T>(column: K, value: T[K]): WhereBuilder<T> {
      const [newParameters, parameterName] = addParameter(builder._parameters, value);
      const condition = createLeCondition(String(column), value, parameterName);
      const newConditions = createAndGroup([...builder._conditions.conditions, condition]);

      return createWhereWithState<T>(newConditions, newParameters);
    },

    ge<K extends keyof T>(column: K, value: T[K]): WhereBuilder<T> {
      const [newParameters, parameterName] = addParameter(builder._parameters, value);
      const condition = createGeCondition(String(column), value, parameterName);
      const newConditions = createAndGroup([...builder._conditions.conditions, condition]);

      return createWhereWithState<T>(newConditions, newParameters);
    },

    in<K extends keyof T>(_column: K, _values: T[K][]): WhereBuilder<T> {
      // Implementation will be added in subsequent tasks
      throw new Error("Not implemented yet");
    },

    notIn<K extends keyof T>(_column: K, _values: T[K][]): WhereBuilder<T> {
      // Implementation will be added in subsequent tasks
      throw new Error("Not implemented yet");
    },

    like<K extends keyof T>(_column: K, _pattern: string): WhereBuilder<T> {
      // Implementation will be added in subsequent tasks
      throw new Error("Not implemented yet");
    },

    notLike<K extends keyof T>(_column: K, _pattern: string): WhereBuilder<T> {
      // Implementation will be added in subsequent tasks
      throw new Error("Not implemented yet");
    },

    startsWith<K extends keyof T>(_column: K, _prefix: string): WhereBuilder<T> {
      // Implementation will be added in subsequent tasks
      throw new Error("Not implemented yet");
    },

    endsWith<K extends keyof T>(_column: K, _suffix: string): WhereBuilder<T> {
      // Implementation will be added in subsequent tasks
      throw new Error("Not implemented yet");
    },

    isNull<K extends keyof T>(_column: K): WhereBuilder<T> {
      // Implementation will be added in subsequent tasks
      throw new Error("Not implemented yet");
    },

    isNotNull<K extends keyof T>(_column: K): WhereBuilder<T> {
      // Implementation will be added in subsequent tasks
      throw new Error("Not implemented yet");
    },

    and(..._conditions: ((builder: WhereBuilder<T>) => WhereBuilder<T>)[]): WhereBuilder<T> {
      // Implementation will be added in subsequent tasks
      throw new Error("Not implemented yet");
    },

    or(..._conditions: ((builder: WhereBuilder<T>) => WhereBuilder<T>)[]): WhereBuilder<T> {
      // Implementation will be added in subsequent tasks
      throw new Error("Not implemented yet");
    },

    build(): QueryResult {
      // Implementation will be added in subsequent tasks
      throw new Error("Not implemented yet");
    },
  };

  return builder;
};

/**
 * Creates a new WhereBuilder instance with empty condition tree and parameter manager
 * @returns A new WhereBuilder instance
 */
export const createWhere = <T = any>(): WhereBuilder<T> => {
  const emptyConditions = createAndGroup([]);
  const emptyParameters = createParameterManager();

  return createWhereWithState<T>(emptyConditions, emptyParameters);
};
