# Requirements Document

## Introduction

spaniel-sql: Cloud Spanner用のTypeScriptクエリビルダーライブラリを開発します。このライブラリは、SQL文を型安全かつ直感的に構築できるDSL（Domain Specific Language）を提供します。最初のフェーズとして、Where句の構築に焦点を当てます。

## Requirements

### Requirement 1

**User Story:** As a TypeScript developer, I want to build Cloud Spanner WHERE clauses using a fluent API, so that I can write type-safe queries without manually constructing SQL strings.

#### Acceptance Criteria

1. WHEN I create a new query builder instance THEN the system SHALL provide a fluent interface for building WHERE clauses
2. WHEN I chain multiple WHERE conditions THEN the system SHALL combine them with AND operators by default
3. WHEN I specify OR conditions THEN the system SHALL group them appropriately with parentheses
4. WHEN I build the final query THEN the system SHALL generate valid Cloud Spanner SQL syntax

### Requirement 2

**User Story:** As a developer, I want to use comparison operators (=, !=, <, >, <=, >=) in WHERE clauses, so that I can filter data based on various conditions.

#### Acceptance Criteria

1. WHEN I use equality comparison THEN the system SHALL generate "column = @param" syntax
2. WHEN I use inequality operators THEN the system SHALL generate appropriate SQL operators (<, >, <=, >=, !=)
3. WHEN I provide parameter values THEN the system SHALL use parameterized queries with @param syntax
4. IF the parameter value is null THEN the system SHALL generate "IS NULL" or "IS NOT NULL" syntax

### Requirement 3

**User Story:** As a developer, I want to use IN and NOT IN operators with arrays, so that I can filter records against multiple values efficiently.

#### Acceptance Criteria

1. WHEN I use the IN operator with an array THEN the system SHALL generate "column IN (@param1, @param2, ...)" syntax
2. WHEN I use NOT IN operator THEN the system SHALL generate "column NOT IN (...)" syntax
3. WHEN the array is empty THEN the system SHALL handle the edge case appropriately
4. WHEN array contains null values THEN the system SHALL handle them correctly according to Cloud Spanner semantics

### Requirement 4

**User Story:** As a developer, I want to use LIKE and pattern matching operators, so that I can perform text searches and pattern matching.

#### Acceptance Criteria

1. WHEN I use LIKE operator THEN the system SHALL generate "column LIKE @param" syntax
2. WHEN I use NOT LIKE operator THEN the system SHALL generate "column NOT LIKE @param" syntax
3. WHEN I use STARTS_WITH function THEN the system SHALL generate "STARTS_WITH(column, @param)" syntax
4. WHEN I use ENDS_WITH function THEN the system SHALL generate "ENDS_WITH(column, @param)" syntax

### Requirement 5

**User Story:** As a developer, I want to combine multiple WHERE conditions with logical operators (AND, OR), so that I can create complex filtering logic.

#### Acceptance Criteria

1. WHEN I chain conditions without specifying operators THEN the system SHALL use AND by default
2. WHEN I explicitly use OR operator THEN the system SHALL group conditions with OR
3. WHEN I mix AND and OR operators THEN the system SHALL handle operator precedence correctly with parentheses
4. WHEN I nest conditions THEN the system SHALL generate properly nested parentheses

### Requirement 6

**User Story:** As a TypeScript developer, I want compile-time type safety for column names and values, so that I can catch errors early in development.

#### Acceptance Criteria

1. WHEN I reference a column name THEN the system SHALL provide TypeScript autocompletion if schema types are provided
2. WHEN I provide a value of wrong type THEN the system SHALL show TypeScript compilation errors
3. WHEN I use the builder with a typed schema interface THEN the system SHALL enforce column existence and types
4. IF no schema types are provided THEN the system SHALL still work with string-based column names

### Requirement 7

**User Story:** As a developer, I want to generate parameterized queries with named parameters, so that I can safely execute queries without SQL injection risks.

#### Acceptance Criteria

1. WHEN I build a query THEN the system SHALL return both SQL string and parameter object
2. WHEN I use the same value multiple times THEN the system SHALL reuse the same parameter name
3. WHEN parameter names conflict THEN the system SHALL generate unique parameter names
4. WHEN I execute the query THEN the parameters SHALL be in the format expected by Cloud Spanner client libraries