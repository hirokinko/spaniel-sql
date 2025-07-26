/**
 * Utility functions for SELECT query column selection and processing
 */

import type { SchemaConstraint } from "./core-types.js";
import { createFailure, createQueryBuilderError, createSuccess, type Result } from "./errors.js";
import { addParameter, type ParameterManager } from "./parameter-manager.js";
import {
  AGGREGATE_FUNCTIONS,
  type AggregateFunction,
  type GroupByClause,
  type OrderByClause,
  type OrderByColumn,
  type SelectClause,
  type SelectColumn,
  type SelectQuery,
} from "./select-types.js";

/**
 * Creates a column selection for a specific column name
 */
export function createColumnSelection(column: string, alias?: string): SelectColumn {
  const result: SelectColumn = {
    type: "column",
    column,
  };
  if (alias !== undefined) {
    result.alias = alias;
  }
  return result;
}

/**
 * Creates an expression selection (for SQL expressions)
 */
export function createExpressionSelection(expression: string, alias?: string): SelectColumn {
  const result: SelectColumn = {
    type: "expression",
    expression,
  };
  if (alias !== undefined) {
    result.alias = alias;
  }
  return result;
}

/**
 * Creates an aggregate function selection
 */
export function createAggregateSelection(
  aggregateFunction: AggregateFunction,
  column?: string,
  alias?: string
): SelectColumn {
  const result: SelectColumn = {
    type: "aggregate",
    aggregateFunction,
  };
  if (column !== undefined) {
    result.column = column;
  }
  if (alias !== undefined) {
    result.alias = alias;
  }
  return result;
}

/**
 * Creates a SELECT clause with the specified columns
 */
export function createSelectClause(columns: SelectColumn[], distinct?: boolean): SelectClause {
  const result: SelectClause = {
    columns: [...columns], // Create a copy to maintain immutability
  };
  if (distinct !== undefined) {
    result.distinct = distinct;
  }
  return result;
}

/**
 * Validates that a column name is valid for the given schema
 */
export function validateColumnName<T extends SchemaConstraint>(
  column: string,
  schema?: T
): boolean {
  if (!schema) {
    // If no schema provided, assume column is valid
    return true;
  }
  return column in schema;
}

/**
 * Validates that all columns in a SelectColumn array are valid for the schema
 */
export function validateSelectColumns<T extends SchemaConstraint>(
  columns: SelectColumn[],
  schema?: T
): boolean {
  if (!schema) {
    return true;
  }

  return columns.every((col) => {
    if (col.type === "column" && col.column) {
      return validateColumnName(col.column, schema);
    }
    if (col.type === "aggregate" && col.column) {
      return validateColumnName(col.column, schema);
    }
    // Expression types don't need column validation
    return true;
  });
}

/**
 * Checks if a SelectColumn represents an aggregate function
 */
export function isAggregateColumn(column: SelectColumn): boolean {
  return column.type === "aggregate";
}

/**
 * Checks if a SelectClause contains any aggregate functions
 */
export function hasAggregateColumns(selectClause: SelectClause): boolean {
  return selectClause.columns.some(isAggregateColumn);
}

/**
 * Checks if a value is a supported aggregate function
 */
export function isValidAggregateFunction(func: string): func is AggregateFunction {
  return (AGGREGATE_FUNCTIONS as readonly string[]).includes(func);
}

/**
 * Gets all column names referenced in a SelectClause (excluding expressions)
 */
export function getReferencedColumns(selectClause: SelectClause): string[] {
  const columns: string[] = [];

  for (const col of selectClause.columns) {
    if (col.type === "column" && col.column) {
      columns.push(col.column);
    } else if (col.type === "aggregate" && col.column) {
      columns.push(col.column);
    }
  }

  return columns;
}

/**
 * Gets all aliases defined in a SelectClause
 */
export function getSelectAliases(selectClause: SelectClause): string[] {
  return selectClause.columns
    .map((col) => col.alias)
    .filter((alias): alias is string => alias !== undefined);
}

/**
 * Checks if a SelectClause has duplicate aliases
 */
export function hasDuplicateAliases(selectClause: SelectClause): boolean {
  const aliases = getSelectAliases(selectClause);
  const uniqueAliases = new Set(aliases);
  return aliases.length !== uniqueAliases.size;
}

/**
 * Validates a complete SelectClause
 */
export function validateSelectClause<T extends SchemaConstraint>(
  selectClause: SelectClause,
  schema?: T
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check for empty columns
  if (selectClause.columns.length === 0) {
    errors.push("SELECT clause must have at least one column");
  }

  // Validate column names against schema
  if (!validateSelectColumns(selectClause.columns, schema)) {
    errors.push("One or more columns are not valid for the provided schema");
  }

  // Check for duplicate aliases
  if (hasDuplicateAliases(selectClause)) {
    errors.push("SELECT clause contains duplicate column aliases");
  }

  // Validate individual columns
  for (const [index, column] of selectClause.columns.entries()) {
    const columnErrors = validateSelectColumn(column);
    if (columnErrors.length > 0) {
      errors.push(`Column ${index + 1}: ${columnErrors.join(", ")}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates an individual SelectColumn
 */
export function validateSelectColumn(column: SelectColumn): string[] {
  const errors: string[] = [];

  switch (column.type) {
    case "column":
      if (!column.column) {
        errors.push("Column selection must specify a column name");
      }
      break;
    case "expression":
      if (!column.expression) {
        errors.push("Expression selection must specify an expression");
      }
      break;
    case "aggregate":
      if (!column.aggregateFunction) {
        errors.push("Aggregate selection must specify an aggregate function");
      } else if (!isValidAggregateFunction(column.aggregateFunction)) {
        errors.push(`Invalid aggregate function: ${column.aggregateFunction}`);
      }
      // COUNT can work without a column (COUNT(*))
      if (column.aggregateFunction !== "COUNT" && !column.column) {
        errors.push(`${column.aggregateFunction} aggregate must specify a column`);
      }
      break;
    default:
      errors.push(`Unknown column type: ${(column as any).type}`);
  }

  return errors;
}

/**
 * Creates a SELECT * clause (selects all columns)
 */
export function createSelectAllClause(): SelectClause {
  return createSelectClause([createExpressionSelection("*")]);
}

/**
 * Adds a column to an existing SelectClause (returns new instance)
 */
export function addColumnToSelect(selectClause: SelectClause, column: SelectColumn): SelectClause {
  return createSelectClause([...selectClause.columns, column], selectClause.distinct);
}

/**
 * Removes a column from an existing SelectClause by index (returns new instance)
 */
export function removeColumnFromSelect(selectClause: SelectClause, index: number): SelectClause {
  if (index < 0 || index >= selectClause.columns.length) {
    return selectClause; // Return unchanged if index is invalid
  }

  const newColumns = [...selectClause.columns];
  newColumns.splice(index, 1);
  return createSelectClause(newColumns, selectClause.distinct);
}

/**
 * Sets the DISTINCT flag on a SelectClause (returns new instance)
 */
export function setSelectDistinct(selectClause: SelectClause, distinct: boolean): SelectClause {
  return createSelectClause(selectClause.columns, distinct);
}

/**
 * Creates a GROUP BY clause
 */
export function createGroupByClause(columns: string[], expressions: string[] = []): GroupByClause {
  return {
    columns: [...columns],
    expressions: [...expressions],
  };
}

/**
 * Validates a GROUP BY clause against the provided schema
 */
export function validateGroupByClause<T extends SchemaConstraint>(
  clause: GroupByClause,
  schema?: T
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (clause.columns.length === 0 && clause.expressions.length === 0) {
    errors.push("GROUP BY clause must specify at least one column or expression");
  }

  for (const col of clause.columns) {
    if (!validateColumnName(col, schema)) {
      errors.push(`Invalid column in GROUP BY: ${col}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates that non-aggregate select columns are included in GROUP BY
 */
export function validateGroupByColumns(query: Pick<SelectQuery, "select" | "groupBy">): {
  valid: boolean;
  errors: string[];
} {
  if (!query.groupBy) {
    return { valid: true, errors: [] };
  }

  const errors: string[] = [];
  const { select, groupBy } = query;

  // Only enforce rule when aggregates are present
  if (hasAggregateColumns(select)) {
    for (const col of select.columns) {
      if (col.type === "aggregate") {
        continue;
      }
      if (col.type === "column" && col.column) {
        if (!groupBy.columns.includes(col.column)) {
          errors.push(`Column ${col.column} must appear in GROUP BY`);
        }
      } else if (col.type === "expression" && col.expression) {
        if (!groupBy.expressions.includes(col.expression)) {
          errors.push(`Expression ${col.expression} must appear in GROUP BY`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates HAVING clause usage
 * Ensures HAVING is only used when GROUP BY is present
 */
export function validateHavingClause(query: Pick<SelectQuery, "groupBy" | "having">): {
  valid: boolean;
  errors: string[];
} {
  if (!query.having) {
    return { valid: true, errors: [] };
  }

  if (!query.groupBy) {
    return { valid: false, errors: ["HAVING clause requires GROUP BY"] };
  }

  return { valid: true, errors: [] };
}

/**
 * Checks if a sort direction value is valid
 */
export function isValidSortDirection(direction: string): direction is "ASC" | "DESC" {
  return direction === "ASC" || direction === "DESC";
}

/**
 * Creates an ORDER BY column specification
 */
export function createOrderByColumn(
  column: string,
  direction: "ASC" | "DESC" = "ASC",
  nullsFirst?: boolean
): OrderByColumn {
  const result: OrderByColumn = { column, direction };
  if (nullsFirst !== undefined) {
    result.nullsFirst = nullsFirst;
  }
  return result;
}

/**
 * Creates an ORDER BY expression specification
 */
export function createOrderByExpression(
  expression: string,
  direction: "ASC" | "DESC" = "ASC",
  nullsFirst?: boolean
): OrderByColumn {
  const result: OrderByColumn = { expression, direction };
  if (nullsFirst !== undefined) {
    result.nullsFirst = nullsFirst;
  }
  return result;
}

/**
 * Creates an ORDER BY clause from an array of columns
 */
export function createOrderByClause(columns: OrderByColumn[]): OrderByClause {
  return { columns };
}

/**
 * Validates an ORDER BY column specification
 */
export function validateOrderByColumn(column: OrderByColumn): string[] {
  const errors: string[] = [];
  if (!column.column && !column.expression) {
    errors.push("ORDER BY column must specify a column name or expression");
  }
  if (!isValidSortDirection(column.direction)) {
    errors.push(`Invalid sort direction: ${column.direction}`);
  }
  return errors;
}

/**
 * Validates an ORDER BY clause
 */
export function validateOrderByClause(clause: OrderByClause): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (clause.columns.length === 0) {
    errors.push("ORDER BY clause must specify at least one column");
  }

  for (const [index, col] of clause.columns.entries()) {
    const colErrors = validateOrderByColumn(col);
    if (colErrors.length > 0) {
      errors.push(`Column ${index + 1}: ${colErrors.join(", ")}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates a LIMIT value. Must be a positive integer.
 */
export const validateLimitValue = (value: unknown): Result<number> => {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    return createFailure(
      createQueryBuilderError(`Invalid LIMIT value: ${String(value)}`, "INVALID_LIMIT_VALUE", {
        providedValue: value,
      })
    );
  }
  return createSuccess(value);
};

/**
 * Validates an OFFSET value. Must be a non-negative integer.
 */
export const validateOffsetValue = (value: unknown): Result<number> => {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    return createFailure(
      createQueryBuilderError(`Invalid OFFSET value: ${String(value)}`, "INVALID_OFFSET_VALUE", {
        providedValue: value,
      })
    );
  }
  return createSuccess(value);
};

/**
 * Adds a LIMIT value as a parameter and returns the updated manager.
 */
export const addLimitParameter = (
  manager: ParameterManager,
  value: number
): [ParameterManager, string] => addParameter(manager, value);

/**
 * Adds an OFFSET value as a parameter and returns the updated manager.
 */
export const addOffsetParameter = (
  manager: ParameterManager,
  value: number
): [ParameterManager, string] => addParameter(manager, value);
