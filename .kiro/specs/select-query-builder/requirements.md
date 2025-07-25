# Requirements Document

## Introduction

spaniel-sql SELECT Query Builder: 既存のWHERE句ビルダーを拡張し、完全なSELECTクエリを構築できる型安全なTypeScriptライブラリを開発します。Cloud Spanner固有の機能をサポートし、複雑なクエリを直感的に構築できるDSLを提供します。

## Requirements

### Requirement 1

**User Story:** As a TypeScript developer, I want to build complete SELECT queries using a fluent API, so that I can retrieve data from Cloud Spanner with type-safe column selection and table specification.

#### Acceptance Criteria

1. WHEN I create a new query builder instance THEN the system SHALL provide a fluent interface for building SELECT queries
2. WHEN I specify columns to select THEN the system SHALL generate valid SELECT clause syntax
3. WHEN I specify a table name THEN the system SHALL generate valid FROM clause syntax
4. WHEN I combine SELECT, FROM, and WHERE clauses THEN the system SHALL generate a complete valid SQL query

### Requirement 2

**User Story:** As a developer, I want to select specific columns with type safety, so that I can ensure column names exist and return values have correct types.

#### Acceptance Criteria

1. WHEN I select columns by name THEN the system SHALL validate column existence at compile time if schema is provided
2. WHEN I select all columns THEN the system SHALL generate "SELECT *" syntax
3. WHEN I select columns with aliases THEN the system SHALL generate "column AS alias" syntax
4. WHEN I select expressions THEN the system SHALL support SQL expressions and functions

### Requirement 3

**User Story:** As a developer, I want to use aggregate functions (COUNT, SUM, AVG, MIN, MAX), so that I can perform data aggregation in my queries.

#### Acceptance Criteria

1. WHEN I use COUNT function THEN the system SHALL generate "COUNT(column)" or "COUNT(*)" syntax
2. WHEN I use SUM, AVG, MIN, MAX functions THEN the system SHALL generate appropriate aggregate function syntax
3. WHEN I use Cloud Spanner specific aggregates THEN the system SHALL support ARRAY_AGG, STRING_AGG functions
4. WHEN I use aggregate functions THEN the system SHALL enforce proper GROUP BY requirements

### Requirement 4

**User Story:** As a developer, I want to group results using GROUP BY clause, so that I can aggregate data by specific columns.

#### Acceptance Criteria

1. WHEN I specify GROUP BY columns THEN the system SHALL generate valid GROUP BY clause syntax
2. WHEN I use aggregate functions THEN the system SHALL require appropriate GROUP BY columns
3. WHEN I group by multiple columns THEN the system SHALL handle multiple column grouping
4. WHEN I use expressions in GROUP BY THEN the system SHALL support grouping by expressions

### Requirement 5

**User Story:** As a developer, I want to filter grouped results using HAVING clause, so that I can apply conditions to aggregated data.

#### Acceptance Criteria

1. WHEN I specify HAVING conditions THEN the system SHALL generate valid HAVING clause syntax
2. WHEN I use aggregate functions in HAVING THEN the system SHALL support conditions on aggregated values
3. WHEN I combine multiple HAVING conditions THEN the system SHALL use AND/OR operators appropriately
4. WHEN I use HAVING without GROUP BY THEN the system SHALL handle this edge case appropriately

### Requirement 6

**User Story:** As a developer, I want to sort results using ORDER BY clause, so that I can control the order of returned data.

#### Acceptance Criteria

1. WHEN I specify ORDER BY columns THEN the system SHALL generate valid ORDER BY clause syntax
2. WHEN I specify sort direction THEN the system SHALL support ASC and DESC keywords
3. WHEN I sort by multiple columns THEN the system SHALL handle multiple column sorting with precedence
4. WHEN I sort by expressions THEN the system SHALL support ordering by SQL expressions

### Requirement 7

**User Story:** As a developer, I want to limit and paginate results using LIMIT and OFFSET, so that I can implement efficient data pagination.

#### Acceptance Criteria

1. WHEN I specify LIMIT THEN the system SHALL generate valid LIMIT clause syntax
2. WHEN I specify OFFSET THEN the system SHALL generate valid OFFSET clause syntax
3. WHEN I combine LIMIT and OFFSET THEN the system SHALL generate proper pagination syntax
4. WHEN I use invalid limit/offset values THEN the system SHALL validate and provide appropriate errors

### Requirement 8

**User Story:** As a developer, I want to join tables using various JOIN types, so that I can query related data across multiple tables.

#### Acceptance Criteria

1. WHEN I specify INNER JOIN THEN the system SHALL generate valid INNER JOIN syntax with ON conditions
2. WHEN I specify LEFT/RIGHT/FULL OUTER JOIN THEN the system SHALL generate appropriate JOIN syntax
3. WHEN I specify multiple JOINs THEN the system SHALL handle complex multi-table joins
4. WHEN I use table aliases in JOINs THEN the system SHALL support aliased table references

### Requirement 9

**User Story:** As a TypeScript developer, I want compile-time type safety for the entire query, so that I can catch errors early and get proper IntelliSense support.

#### Acceptance Criteria

1. WHEN I build a query with typed schema THEN the system SHALL enforce column types throughout the query
2. WHEN I use aggregate functions THEN the system SHALL infer correct return types
3. WHEN I use JOINs THEN the system SHALL merge column types from joined tables
4. WHEN I use aliases THEN the system SHALL update type information to reflect aliases

### Requirement 10

**User Story:** As a developer, I want to support Cloud Spanner specific features, so that I can leverage the full power of Cloud Spanner SQL.

#### Acceptance Criteria

1. WHEN I use ARRAY functions THEN the system SHALL support UNNEST, ARRAY_AGG, and array operations
2. WHEN I use window functions THEN the system SHALL support ROW_NUMBER, RANK, DENSE_RANK with OVER clause
3. WHEN I use Cloud Spanner date/time functions THEN the system SHALL support EXTRACT, DATE_TRUNC functions
4. WHEN I use parameterized queries THEN the system SHALL integrate with existing parameter management
