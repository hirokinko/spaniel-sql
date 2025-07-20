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
