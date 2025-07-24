/**
 * WhereBuilder implementation for fluent query building
 */

import type { Condition, ConditionGroup, ConditionNode } from "./conditions.js";
import {
  createAndGroup,
  createEndsWithCondition,
  createEqCondition,
  createGeCondition,
  createGtCondition,
  createInCondition,
  createIsNotNullCondition,
  createIsNullCondition,
  createLeCondition,
  createLikeCondition,
  createLtCondition,
  createNeCondition,
  createNotInCondition,
  createNotLikeCondition,
  createOrGroup,
  createStartsWithCondition,
} from "./conditions.js";
import type { QueryResult, SchemaConstraint } from "./core-types.js";
import type { ParameterManager } from "./parameter-manager.js";
import { addParameter, createParameterManager } from "./parameter-manager.js";
import { filterNullParameters, generateConditionSql } from "./sql-generation.js";
import { assertParameterValue } from "./validation.js";

/**
 * Type constraint for column names - ensures K is a valid key of T
 */
export type ValidColumn<T extends SchemaConstraint, K> = K extends keyof T ? K : never;

/**
 * Type constraint for values - ensures value type matches the schema column type
 * If T[K] is ParameterValue (untyped), allows any ParameterValue
 * If T[K] is a specific type, enforces that type
 */
export type ValidValue<T extends SchemaConstraint, K extends keyof T> = T[K];

/**
 * Type constraint for array values - ensures array element type matches schema
 */
export type ValidArrayValue<T extends SchemaConstraint, K extends keyof T> = T[K][];

/**
 * Type constraint for string operations - ensures column type is compatible with string operations
 * String operations (like, startsWith, endsWith) should only work on string columns
 */
export type ValidStringColumn<T extends SchemaConstraint, K extends keyof T> = T[K] extends
  | string
  | null
  | undefined
  ? K
  : K; // Allow for untyped schemas

/**
 * WhereBuilder type - immutable object with fluent interface methods
 * Generic parameter T represents the table schema for type safety
 */
export type WhereBuilder<T extends SchemaConstraint = SchemaConstraint> = {
  readonly _conditions: ConditionGroup;
  readonly _parameters: ParameterManager;

  // Basic comparisons with type constraints
  eq<K extends keyof T>(column: ValidColumn<T, K>, value: ValidValue<T, K>): WhereBuilder<T>;
  ne<K extends keyof T>(column: ValidColumn<T, K>, value: ValidValue<T, K>): WhereBuilder<T>;
  lt<K extends keyof T>(column: ValidColumn<T, K>, value: ValidValue<T, K>): WhereBuilder<T>;
  gt<K extends keyof T>(column: ValidColumn<T, K>, value: ValidValue<T, K>): WhereBuilder<T>;
  le<K extends keyof T>(column: ValidColumn<T, K>, value: ValidValue<T, K>): WhereBuilder<T>;
  ge<K extends keyof T>(column: ValidColumn<T, K>, value: ValidValue<T, K>): WhereBuilder<T>;

  // Array operations with type constraints
  in<K extends keyof T>(column: ValidColumn<T, K>, values: ValidArrayValue<T, K>): WhereBuilder<T>;
  notIn<K extends keyof T>(
    column: ValidColumn<T, K>,
    values: ValidArrayValue<T, K>
  ): WhereBuilder<T>;

  // String operations with string column constraints
  like<K extends keyof T>(column: ValidStringColumn<T, K>, pattern: string): WhereBuilder<T>;
  notLike<K extends keyof T>(column: ValidStringColumn<T, K>, pattern: string): WhereBuilder<T>;
  startsWith<K extends keyof T>(column: ValidStringColumn<T, K>, prefix: string): WhereBuilder<T>;
  endsWith<K extends keyof T>(column: ValidStringColumn<T, K>, suffix: string): WhereBuilder<T>;

  // Null checks - work on any column
  isNull<K extends keyof T>(column: ValidColumn<T, K>): WhereBuilder<T>;
  isNotNull<K extends keyof T>(column: ValidColumn<T, K>): WhereBuilder<T>;

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
const createWhereWithState = <T extends SchemaConstraint = SchemaConstraint>(
  conditions: ConditionGroup,
  parameters: ParameterManager
): WhereBuilder<T> => {
  const builder: WhereBuilder<T> = {
    _conditions: conditions,
    _parameters: parameters,

    eq<K extends keyof T>(column: ValidColumn<T, K>, value: ValidValue<T, K>): WhereBuilder<T> {
      assertParameterValue(value);
      const [newParameters, parameterName] = addParameter(builder._parameters, value);
      const condition = createEqCondition(String(column), value, parameterName);
      const newConditions = createAndGroup([...builder._conditions.conditions, condition]);

      return createWhereWithState<T>(newConditions, newParameters);
    },

    ne<K extends keyof T>(column: ValidColumn<T, K>, value: ValidValue<T, K>): WhereBuilder<T> {
      assertParameterValue(value);
      const [newParameters, parameterName] = addParameter(builder._parameters, value);
      const condition = createNeCondition(String(column), value, parameterName);
      const newConditions = createAndGroup([...builder._conditions.conditions, condition]);

      return createWhereWithState<T>(newConditions, newParameters);
    },

    lt<K extends keyof T>(column: ValidColumn<T, K>, value: ValidValue<T, K>): WhereBuilder<T> {
      assertParameterValue(value);
      const [newParameters, parameterName] = addParameter(builder._parameters, value);
      const condition = createLtCondition(String(column), value, parameterName);
      const newConditions = createAndGroup([...builder._conditions.conditions, condition]);

      return createWhereWithState<T>(newConditions, newParameters);
    },

    gt<K extends keyof T>(column: ValidColumn<T, K>, value: ValidValue<T, K>): WhereBuilder<T> {
      assertParameterValue(value);
      const [newParameters, parameterName] = addParameter(builder._parameters, value);
      const condition = createGtCondition(String(column), value, parameterName);
      const newConditions = createAndGroup([...builder._conditions.conditions, condition]);

      return createWhereWithState<T>(newConditions, newParameters);
    },

    le<K extends keyof T>(column: ValidColumn<T, K>, value: ValidValue<T, K>): WhereBuilder<T> {
      assertParameterValue(value);
      const [newParameters, parameterName] = addParameter(builder._parameters, value);
      const condition = createLeCondition(String(column), value, parameterName);
      const newConditions = createAndGroup([...builder._conditions.conditions, condition]);

      return createWhereWithState<T>(newConditions, newParameters);
    },

    ge<K extends keyof T>(column: ValidColumn<T, K>, value: ValidValue<T, K>): WhereBuilder<T> {
      assertParameterValue(value);
      const [newParameters, parameterName] = addParameter(builder._parameters, value);
      const condition = createGeCondition(String(column), value, parameterName);
      const newConditions = createAndGroup([...builder._conditions.conditions, condition]);

      return createWhereWithState<T>(newConditions, newParameters);
    },

    in<K extends keyof T>(
      column: ValidColumn<T, K>,
      values: ValidArrayValue<T, K>
    ): WhereBuilder<T> {
      // Handle empty array edge case
      if (values.length === 0) {
        // For empty IN: always false (no rows match)
        // We'll create a special condition that generates "FALSE"
        const condition: Condition = {
          type: "in",
          column: String(column),
          operator: "IN",
          values: [],
          parameterNames: [],
        };
        const newConditions = createAndGroup([...builder._conditions.conditions, condition]);
        return createWhereWithState<T>(newConditions, builder._parameters);
      }

      // Add parameters for each value in the array
      let currentParameters = builder._parameters;
      const parameterNames: string[] = [];

      for (const value of values) {
        assertParameterValue(value);
        const [newParameters, paramName] = addParameter(currentParameters, value);
        currentParameters = newParameters;
        parameterNames.push(paramName);
      }

      // Type assertion for the entire array after individual validation
      const validatedValues = values as T[K][];
      const condition = createInCondition(String(column), validatedValues, parameterNames);
      const newConditions = createAndGroup([...builder._conditions.conditions, condition]);

      return createWhereWithState<T>(newConditions, currentParameters);
    },

    notIn<K extends keyof T>(
      column: ValidColumn<T, K>,
      values: ValidArrayValue<T, K>
    ): WhereBuilder<T> {
      // Handle empty array edge case
      if (values.length === 0) {
        // For empty NOT IN: always true (all rows match)
        // We'll create a special condition that generates "TRUE"
        const condition: Condition = {
          type: "in",
          column: String(column),
          operator: "NOT IN",
          values: [],
          parameterNames: [],
        };
        const newConditions = createAndGroup([...builder._conditions.conditions, condition]);
        return createWhereWithState<T>(newConditions, builder._parameters);
      }

      // Add parameters for each value in the array
      let currentParameters = builder._parameters;
      const parameterNames: string[] = [];

      for (const value of values) {
        assertParameterValue(value);
        const [newParameters, paramName] = addParameter(currentParameters, value);
        currentParameters = newParameters;
        parameterNames.push(paramName);
      }

      // Type assertion for the entire array after individual validation
      const validatedValues = values as T[K][];
      const condition = createNotInCondition(String(column), validatedValues, parameterNames);
      const newConditions = createAndGroup([...builder._conditions.conditions, condition]);

      return createWhereWithState<T>(newConditions, currentParameters);
    },

    like<K extends keyof T>(column: ValidStringColumn<T, K>, pattern: string): WhereBuilder<T> {
      const [newParameters, parameterName] = addParameter(builder._parameters, pattern);
      const condition = createLikeCondition(String(column), pattern, parameterName);
      const newConditions = createAndGroup([...builder._conditions.conditions, condition]);

      return createWhereWithState<T>(newConditions, newParameters);
    },

    notLike<K extends keyof T>(column: ValidStringColumn<T, K>, pattern: string): WhereBuilder<T> {
      const [newParameters, parameterName] = addParameter(builder._parameters, pattern);
      const condition = createNotLikeCondition(String(column), pattern, parameterName);
      const newConditions = createAndGroup([...builder._conditions.conditions, condition]);

      return createWhereWithState<T>(newConditions, newParameters);
    },

    startsWith<K extends keyof T>(
      column: ValidStringColumn<T, K>,
      prefix: string
    ): WhereBuilder<T> {
      const [newParameters, parameterName] = addParameter(builder._parameters, prefix);
      const condition = createStartsWithCondition(String(column), prefix, parameterName);
      const newConditions = createAndGroup([...builder._conditions.conditions, condition]);

      return createWhereWithState<T>(newConditions, newParameters);
    },

    endsWith<K extends keyof T>(column: ValidStringColumn<T, K>, suffix: string): WhereBuilder<T> {
      const [newParameters, parameterName] = addParameter(builder._parameters, suffix);
      const condition = createEndsWithCondition(String(column), suffix, parameterName);
      const newConditions = createAndGroup([...builder._conditions.conditions, condition]);

      return createWhereWithState<T>(newConditions, newParameters);
    },

    isNull<K extends keyof T>(column: ValidColumn<T, K>): WhereBuilder<T> {
      const condition = createIsNullCondition(String(column));
      const newConditions = createAndGroup([...builder._conditions.conditions, condition]);

      return createWhereWithState<T>(newConditions, builder._parameters);
    },

    isNotNull<K extends keyof T>(column: ValidColumn<T, K>): WhereBuilder<T> {
      const condition = createIsNotNullCondition(String(column));
      const newConditions = createAndGroup([...builder._conditions.conditions, condition]);

      return createWhereWithState<T>(newConditions, builder._parameters);
    },

    and(...conditions: ((builder: WhereBuilder<T>) => WhereBuilder<T>)[]): WhereBuilder<T> {
      if (conditions.length === 0) {
        // No conditions provided, return current builder unchanged
        return builder;
      }

      // Apply each condition function to get the resulting conditions
      const conditionNodes: ConditionNode[] = [];
      let currentParameters = builder._parameters;

      for (const conditionFn of conditions) {
        // Create a fresh builder with the current parameter state for each condition function
        const emptyBuilder = createWhereWithState<T>(createAndGroup([]), currentParameters);
        const resultBuilder = conditionFn(emptyBuilder);

        // Extract the conditions from the result builder
        // Since we start with an empty AND group, the conditions will be in the root group
        conditionNodes.push(...resultBuilder._conditions.conditions);

        // Update current parameters to include new parameters from this condition
        currentParameters = resultBuilder._parameters;
      }

      // Create an AND group with the collected conditions
      const andGroup = createAndGroup(conditionNodes);

      // Combine with existing conditions
      const newConditions = createAndGroup([...builder._conditions.conditions, andGroup]);

      return createWhereWithState<T>(newConditions, currentParameters);
    },

    or(...conditions: ((builder: WhereBuilder<T>) => WhereBuilder<T>)[]): WhereBuilder<T> {
      if (conditions.length === 0) {
        // No conditions provided, return current builder unchanged
        return builder;
      }

      // Apply each condition function to get the resulting conditions
      const conditionNodes: ConditionNode[] = [];
      let currentParameters = builder._parameters;

      for (const conditionFn of conditions) {
        // Create a fresh builder with the current parameter state for each condition function
        const emptyBuilder = createWhereWithState<T>(createAndGroup([]), currentParameters);
        const resultBuilder = conditionFn(emptyBuilder);

        // Extract the conditions from the result builder
        // Since we start with an empty AND group, the conditions will be in the root group
        conditionNodes.push(...resultBuilder._conditions.conditions);

        // Update current parameters to include new parameters from this condition
        currentParameters = resultBuilder._parameters;
      }

      // Create an OR group with the collected conditions
      const orGroup = createOrGroup(conditionNodes);

      // Combine with existing conditions
      const newConditions = createAndGroup([...builder._conditions.conditions, orGroup]);

      return createWhereWithState<T>(newConditions, currentParameters);
    },

    build(): QueryResult {
      // Handle empty condition tree
      if (builder._conditions.conditions.length === 0) {
        return {
          sql: "",
          parameters: builder._parameters.parameters,
        };
      }

      // Generate SQL from condition tree
      const sql = generateConditionSql(builder._conditions);

      // Filter out null parameters that are converted to IS NULL/IS NOT NULL
      const filteredParameters = filterNullParameters(
        builder._conditions,
        builder._parameters.parameters
      );

      return {
        sql,
        parameters: filteredParameters,
      };
    },
  };

  return builder;
};

/**
 * Creates a new WhereBuilder instance with empty condition tree and parameter manager
 * @returns A new WhereBuilder instance
 */
export const createWhere = <T extends SchemaConstraint = SchemaConstraint>(): WhereBuilder<T> => {
  const emptyConditions = createAndGroup([]);
  const emptyParameters = createParameterManager();

  return createWhereWithState<T>(emptyConditions, emptyParameters);
};
