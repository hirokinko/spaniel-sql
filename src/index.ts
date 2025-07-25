/**
 * spaniel-sql - Cloud Spanner TypeScript Query Builder
 *
 * Main entry point that exports all public APIs
 */

// Condition types and utilities
export type {
  Condition,
  ConditionGroup,
  ConditionNode,
  ConditionType,
  LogicalOperator,
} from "./conditions.js";
export {
  createAndGroup,
  createComparisonCondition,
  createEndsWithCondition,
  createEqCondition,
  createGeCondition,
  createGtCondition,
  createInCondition,
  createInUnnestCondition,
  createIsNotNullCondition,
  createIsNullCondition,
  createLeCondition,
  createLikeCondition,
  createLtCondition,
  createNeCondition,
  createNotInCondition,
  createNotInUnnestCondition,
  createNotLikeCondition,
  createOrGroup,
  createStartsWithCondition,
  isCondition,
  isConditionGroup,
} from "./conditions.js";
// Core types
export type {
  ComparisonOperator,
  ParameterValue,
  QueryResult,
  SchemaConstraint,
  SpannerDataType,
  SpannerTypeHint,
  TableSchema,
} from "./core-types.js";
// Error handling
export type {
  QueryBuilderError,
  QueryBuilderErrorCode,
  Result,
} from "./errors.js";
export {
  createFailure,
  createQueryBuilderError,
  createSuccess,
} from "./errors.js";
// HavingBuilder - built on WhereBuilder
export type { HavingBuilder } from "./having-builder.js";
export { createHaving } from "./having-builder.js";
// Parameter management
export type { ParameterManager } from "./parameter-manager.js";
export { addParameter, createParameterManager } from "./parameter-manager.js";
export type {
  JoinCondition,
  SelectQueryBuilder,
} from "./select-builder.js";
export { createSelect } from "./select-builder.js";
// SelectQueryBuilder - SELECT query API
export type {
  AggregateFunction,
  AggregateResult,
  AliasedColumn,
  GroupByClause,
  JoinClause,
  JoinedTables,
  JoinType,
  LeftJoinedTables,
  OrderByClause,
  OrderByColumn,
  SelectClause,
  SelectColumn,
  SelectedColumns,
  SelectQuery,
  TableReference,
  ValidSelectColumn,
} from "./select-types.js";
// SELECT column utilities
export {
  addColumnToSelect,
  createAggregateSelection,
  createColumnSelection,
  createExpressionSelection,
  createGroupByClause,
  createSelectAllClause,
  createSelectClause,
  getReferencedColumns,
  getSelectAliases,
  hasAggregateColumns,
  hasDuplicateAliases,
  isAggregateColumn,
  removeColumnFromSelect,
  setSelectDistinct,
  validateGroupByClause,
  validateGroupByColumns,
  validateSelectClause,
  validateSelectColumn,
  validateSelectColumns,
} from "./select-utils.js";
// SQL generation
export {
  filterNullParameters,
  generateComparisonSql,
  generateConditionSql,
  generateFunctionSql,
  generateGroupByClause,
  generateInSql,
  generateLikeSql,
  generateLogicalSql,
  generateNullSql,
  generateSelectClause,
  generateSelectColumnSql,
  generateSelectSQL,
} from "./sql-generation.js";
// Table reference utilities
export {
  createTableReference,
  formatTableReference,
  getEffectiveTableName,
  hasTableAlias,
  isSameTable,
  mergeTableSchemas,
  qualifyColumnName,
  validateTableAlias,
  validateTableName,
} from "./table-utils.js";
// Validation utilities
export {
  assertParameterValue,
  isParameterValue,
  validateColumnName,
  validateCondition,
  validateParameterValue,
} from "./validation.js";
// WhereBuilder - main API
export type {
  ValidArrayValue,
  ValidColumn,
  ValidStringColumn,
  ValidValue,
  WhereBuilder,
} from "./where-builder.js";
export { createWhere } from "./where-builder.js";
