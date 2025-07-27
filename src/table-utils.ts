/**
 * Utility functions for table reference handling and validation
 */

import type { SchemaConstraint } from "./core-types.js";
import { createFailure, createQueryBuilderError, createSuccess, type Result } from "./errors.js";
import type { TableReference, UnnestReference } from "./select-types.js";

/**
 * Validates a table name according to Cloud Spanner naming rules
 *
 * Cloud Spanner table names must:
 * - Be 1-128 characters long
 * - Start with a letter or underscore
 * - Contain only letters, numbers, and underscores
 * - Not be a reserved keyword
 */
export const validateTableName = (tableName: unknown): Result<string> => {
  if (typeof tableName !== "string") {
    return createFailure(
      createQueryBuilderError(
        `Invalid table name: expected string, got ${typeof tableName}`,
        "INVALID_TABLE_NAME",
        { providedType: typeof tableName, providedValue: tableName }
      )
    );
  }

  if (tableName.trim() === "") {
    return createFailure(
      createQueryBuilderError("Table name cannot be empty", "INVALID_TABLE_NAME", {
        providedValue: tableName,
      })
    );
  }

  const trimmedName = tableName.trim();

  // Check length constraints (1-128 characters)
  if (trimmedName.length > 128) {
    return createFailure(
      createQueryBuilderError(
        `Table name too long: ${trimmedName.length} characters. Maximum is 128.`,
        "INVALID_TABLE_NAME",
        { providedValue: tableName, length: trimmedName.length, maxLength: 128 }
      )
    );
  }

  // Check if starts with letter or underscore
  if (!/^[a-zA-Z_]/.test(trimmedName)) {
    return createFailure(
      createQueryBuilderError(
        "Table name must start with a letter or underscore",
        "INVALID_TABLE_NAME",
        { providedValue: tableName }
      )
    );
  }

  // Check if contains only valid characters (letters, numbers, underscores)
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmedName)) {
    return createFailure(
      createQueryBuilderError(
        "Table name can only contain letters, numbers, and underscores",
        "INVALID_TABLE_NAME",
        { providedValue: tableName }
      )
    );
  }

  // Check against common reserved keywords (basic set)
  const reservedKeywords = new Set([
    "SELECT",
    "FROM",
    "WHERE",
    "INSERT",
    "UPDATE",
    "DELETE",
    "CREATE",
    "DROP",
    "ALTER",
    "TABLE",
    "INDEX",
    "VIEW",
    "DATABASE",
    "SCHEMA",
    "GRANT",
    "REVOKE",
    "COMMIT",
    "ROLLBACK",
    "TRANSACTION",
    "BEGIN",
    "END",
    "IF",
    "ELSE",
    "CASE",
    "WHEN",
    "THEN",
    "NULL",
    "TRUE",
    "FALSE",
    "AND",
    "OR",
    "NOT",
    "IN",
    "EXISTS",
    "BETWEEN",
    "LIKE",
    "IS",
    "AS",
    "ON",
    "JOIN",
    "INNER",
    "LEFT",
    "RIGHT",
    "FULL",
    "OUTER",
    "CROSS",
    "UNION",
    "INTERSECT",
    "EXCEPT",
    "ORDER",
    "BY",
    "GROUP",
    "HAVING",
    "LIMIT",
    "OFFSET",
    "DISTINCT",
    "ALL",
    "ANY",
    "SOME",
    "COUNT",
    "SUM",
    "AVG",
    "MIN",
    "MAX",
    "ARRAY",
    "STRUCT",
  ]);

  if (reservedKeywords.has(trimmedName.toUpperCase())) {
    return createFailure(
      createQueryBuilderError(
        `Table name cannot be a reserved keyword: ${trimmedName}`,
        "INVALID_TABLE_NAME",
        { providedValue: tableName, reservedKeyword: true }
      )
    );
  }

  return createSuccess(trimmedName);
};

/**
 * Validates a table alias according to Cloud Spanner naming rules
 * Same rules as table names but typically shorter
 */
export const validateTableAlias = (alias: unknown): Result<string> => {
  if (typeof alias !== "string") {
    return createFailure(
      createQueryBuilderError(
        `Invalid table alias: expected string, got ${typeof alias}`,
        "INVALID_TABLE_ALIAS",
        { providedType: typeof alias, providedValue: alias }
      )
    );
  }

  if (alias.trim() === "") {
    return createFailure(
      createQueryBuilderError("Table alias cannot be empty", "INVALID_TABLE_ALIAS", {
        providedValue: alias,
      })
    );
  }

  const trimmedAlias = alias.trim();

  // Check length constraints (1-64 characters for aliases)
  if (trimmedAlias.length > 64) {
    return createFailure(
      createQueryBuilderError(
        `Table alias too long: ${trimmedAlias.length} characters. Maximum is 64.`,
        "INVALID_TABLE_ALIAS",
        { providedValue: alias, length: trimmedAlias.length, maxLength: 64 }
      )
    );
  }

  // Check if starts with letter or underscore
  if (!/^[a-zA-Z_]/.test(trimmedAlias)) {
    return createFailure(
      createQueryBuilderError(
        "Table alias must start with a letter or underscore",
        "INVALID_TABLE_ALIAS",
        { providedValue: alias }
      )
    );
  }

  // Check if contains only valid characters
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmedAlias)) {
    return createFailure(
      createQueryBuilderError(
        "Table alias can only contain letters, numbers, and underscores",
        "INVALID_TABLE_ALIAS",
        { providedValue: alias }
      )
    );
  }

  return createSuccess(trimmedAlias);
};

/**
 * Creates a validated TableReference with optional alias and schema
 */
export const createTableReference = <T extends SchemaConstraint = SchemaConstraint>(
  tableName: string,
  alias?: string,
  schema?: T
): Result<TableReference> => {
  // Validate table name
  const tableNameResult = validateTableName(tableName);
  if (!tableNameResult.success) {
    return tableNameResult;
  }

  // Validate alias if provided
  if (alias !== undefined) {
    const aliasResult = validateTableAlias(alias);
    if (!aliasResult.success) {
      return aliasResult;
    }
  }

  const tableReference: TableReference = {
    name: tableNameResult.data,
    ...(alias && { alias }),
    ...(schema && { schema }),
  };

  return createSuccess(tableReference);
};

/**
 * Creates an UNNEST table reference with required alias
 */
export const createUnnestReference = <T extends SchemaConstraint = SchemaConstraint>(
  expression: string,
  alias: string,
  schema?: T
): Result<UnnestReference> => {
  if (typeof expression !== "string" || expression.trim() === "") {
    return createFailure(
      createQueryBuilderError(
        "UNNEST expression must be a non-empty string",
        "INVALID_UNNEST_EXPRESSION",
        { providedValue: expression }
      )
    );
  }

  const aliasResult = validateTableAlias(alias);
  if (!aliasResult.success) {
    return aliasResult as Result<UnnestReference>;
  }

  const ref: UnnestReference = {
    unnest: expression,
    alias: aliasResult.data,
    ...(schema && { schema }),
  };

  return createSuccess(ref);
};

/**
 * Checks if a TableReference has an alias
 */
export const hasTableAlias = (
  tableRef: TableReference | UnnestReference
): tableRef is (TableReference | UnnestReference) & { alias: string } => {
  return (
    (tableRef as any).alias !== undefined &&
    (tableRef as any).alias !== null &&
    String((tableRef as any).alias).trim() !== ""
  );
};

/**
 * Gets the effective name for a table reference (alias if present, otherwise table name)
 */
export const getEffectiveTableName = (tableRef: TableReference | UnnestReference): string => {
  if ("unnest" in tableRef) {
    return tableRef.alias;
  }
  return hasTableAlias(tableRef) ? tableRef.alias : tableRef.name;
};

/**
 * Formats a table reference for SQL generation
 * Returns "tableName" or "tableName AS alias" format
 */
export const formatTableReference = (tableRef: TableReference | UnnestReference): string => {
  if ("unnest" in tableRef) {
    const expr = `UNNEST(${tableRef.unnest})`;
    return `${expr} AS ${tableRef.alias}`;
  }
  if (hasTableAlias(tableRef)) {
    return `${tableRef.name} AS ${tableRef.alias}`;
  }
  return tableRef.name;
};

/**
 * Checks if two table references refer to the same table
 * (same name, ignoring alias and schema)
 */
export const isSameTable = (
  tableRef1: TableReference | UnnestReference,
  tableRef2: TableReference | UnnestReference
): boolean => {
  if ("unnest" in tableRef1 || "unnest" in tableRef2) {
    return false;
  }
  return tableRef1.name === tableRef2.name;
};

/**
 * Merges schema information from multiple table references
 * Used for JOIN operations to combine column types
 */
export const mergeTableSchemas = <T extends SchemaConstraint, U extends SchemaConstraint>(
  leftTable: (TableReference | UnnestReference) & { schema: T },
  rightTable: (TableReference | UnnestReference) & { schema: U }
): T & U => {
  return { ...leftTable.schema, ...rightTable.schema };
};

/**
 * Creates a qualified column name with table prefix
 * Returns "table.column" or "alias.column" format
 */
export const qualifyColumnName = (
  tableRef: TableReference | UnnestReference,
  columnName: string
): string => {
  const tableName = getEffectiveTableName(tableRef);
  return `${tableName}.${columnName}`;
};
