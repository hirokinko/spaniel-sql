/**
 * Error handling types and utilities for spaniel-sql
 */

/**
 * Error codes for query builder errors
 */
export type QueryBuilderErrorCode =
  | "INVALID_PARAMETER_VALUE"
  | "INVALID_CONDITION_TYPE"
  | "MISSING_PARAMETER_NAME"
  | "PARAMETER_NAMES_MISMATCH"
  | "UNSUPPORTED_OPERATOR"
  | "INVALID_CONDITION_NODE"
  | "UNDEFINED_CONDITION"
  | "INVALID_COLUMN_NAME"
  | "EMPTY_CONDITIONS_ARRAY"
  | "MALFORMED_CONDITION"
  | "INVALID_TABLE_NAME"
  | "INVALID_TABLE_ALIAS"
  | "INVALID_LIMIT_VALUE"
  | "INVALID_OFFSET_VALUE"
  | "INVALID_SELECT_CLAUSE"
  | "INVALID_FROM_CLAUSE"
  | "INVALID_JOIN_CLAUSE"
  | "INVALID_GROUP_BY_CLAUSE"
  | "INVALID_HAVING_CLAUSE"
  | "INVALID_ORDER_BY_CLAUSE"
  | "INVALID_SELECT_QUERY";

/**
 * Query builder error type with structured error information
 */
export type QueryBuilderError = {
  readonly type: "QueryBuilderError";
  readonly message: string;
  readonly code: QueryBuilderErrorCode;
  readonly details?: Record<string, unknown>;
};

/**
 * Result type for operations that can fail
 */
export type Result<T, E = QueryBuilderError> =
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Creates a QueryBuilderError with the specified message and code
 */
export const createQueryBuilderError = (
  message: string,
  code: QueryBuilderErrorCode,
  details?: Record<string, unknown>
): QueryBuilderError => {
  if (details !== undefined) {
    return {
      type: "QueryBuilderError",
      message,
      code,
      details,
    };
  }

  return {
    type: "QueryBuilderError",
    message,
    code,
  };
};

/**
 * Creates a successful Result
 */
export const createSuccess = <T>(data: T): Result<T> => ({
  success: true,
  data,
});

/**
 * Creates a failed Result
 */
export const createFailure = <T>(error: QueryBuilderError): Result<T> => ({
  success: false,
  error,
});
