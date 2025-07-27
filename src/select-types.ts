/**
 * Core type definitions for SELECT query builder
 */

import type { ConditionGroup } from "./conditions.js";
import type { SchemaConstraint } from "./core-types.js";

/**
 * Column selection representation
 */
export interface SelectColumn {
  type: "column" | "expression" | "aggregate";
  column?: string;
  expression?: string;
  alias?: string;
  aggregateFunction?: AggregateFunction;
}

/**
 * List of supported aggregate functions
 */
export const AGGREGATE_FUNCTIONS = [
  "COUNT",
  "SUM",
  "AVG",
  "MIN",
  "MAX",
  "ARRAY_AGG",
  "STRING_AGG",
] as const;

/**
 * Aggregate function types supported by Cloud Spanner
 */
export type AggregateFunction = (typeof AGGREGATE_FUNCTIONS)[number];

/**
 * SELECT clause representation
 */
export interface SelectClause {
  columns: SelectColumn[];
  distinct?: boolean;
}

/**
 * Table reference for FROM and JOIN clauses
 */
export interface TableReference {
  name: string;
  alias?: string;
  schema?: SchemaConstraint;
}

/**
 * UNNEST reference for JOIN clauses
 */
export interface UnnestReference {
  unnest: string;
  alias: string;
  schema?: SchemaConstraint;
}

/**
 * JOIN types supported by Cloud Spanner
 */
export type JoinType = "INNER" | "LEFT" | "RIGHT" | "FULL" | "CROSS" | "NATURAL";

/**
 * JOIN clause representation
 */
export interface JoinClause {
  type: JoinType;
  table: TableReference | UnnestReference;
  condition: ConditionGroup;
}

/**
 * GROUP BY clause representation
 */
export interface GroupByClause {
  columns: string[];
  expressions: string[];
}

/**
 * ORDER BY column specification
 */
export interface OrderByColumn {
  column?: string;
  expression?: string;
  direction: "ASC" | "DESC";
  nullsFirst?: boolean;
}

/**
 * ORDER BY clause representation
 */
export interface OrderByClause {
  columns: OrderByColumn[];
}

/**
 * Complete SELECT query structure
 */
export interface SelectQuery {
  select: SelectClause;
  from?: TableReference;
  joins: JoinClause[];
  where?: ConditionGroup;
  groupBy?: GroupByClause;
  having?: ConditionGroup;
  orderBy?: OrderByClause;
  limit?: number;
  offset?: number;
}

/**
 * Type constraint for column names - ensures K is a valid key of T
 */
export type ValidSelectColumn<T extends SchemaConstraint, K> = K extends keyof T ? K : never;

/**
 * Type constraint for selected columns - creates a new type with only selected columns
 */
export type SelectedColumns<T extends SchemaConstraint, K extends keyof T> = Pick<T, K>;

/**
 * Type constraint for column aliases - creates a new type with aliased column
 */
export type AliasedColumn<T extends SchemaConstraint, K extends keyof T, A extends string> = Omit<
  T,
  K
> &
  Record<A, T[K]>;

/**
 * Type constraint for aggregate result - creates a type for aggregate function results
 */
export type AggregateResult<T> = { [key: string]: T };

/**
 * Type constraint for joined tables - merges column types from joined tables
 */
export type JoinedTables<T extends SchemaConstraint, U extends SchemaConstraint> = T & U;

/**
 * Type constraint for left joined tables - makes right table columns nullable
 */
export type LeftJoinedTables<T extends SchemaConstraint, U extends SchemaConstraint> = T &
  Partial<U>;
