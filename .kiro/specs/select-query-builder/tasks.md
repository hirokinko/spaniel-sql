# Implementation Plan

- [x] 1. Set up SELECT query builder foundation

  - Extend existing project structure for SELECT query functionality
  - Define core SELECT query types and interfaces
  - Create SelectQueryBuilder base type with generic constraints
  - Set up integration points with existing WHERE builder
  - _Requirements: 1.1, 9.1_

- [x] 2. Implement basic column selection

  - [x] 2.1 Create column selection types and utilities

    - Define SelectColumn interface for different column types
    - Implement SelectClause type for managing selected columns
    - Create utility functions for column validation and processing
    - Write unit tests for column selection types
    - _Requirements: 2.1, 2.2, 9.1_

  - [x] 2.2 Implement select methods (select, selectAll, selectAs)
    - Write select method for specific column selection with type constraints
    - Implement selectAll method for wildcard selection
    - Create selectAs method for column aliasing with type updates
    - Write unit tests for all selection methods
    - _Requirements: 2.1, 2.2, 2.3, 9.2_

- [x] 3. Implement FROM clause and table specification

  - [x] 3.1 Create table reference types and utilities

    - Define TableReference interface for table specification
    - Implement table alias support with type integration
    - Create utility functions for table name validation
    - Write unit tests for table reference functionality
    - _Requirements: 1.3, 9.1_

  - [x] 3.2 Implement from method with schema integration
    - Write from method that accepts table name and optional schema
    - Implement type transformation to use table schema
    - Integrate with existing parameter management system
    - Write unit tests for FROM clause generation
    - _Requirements: 1.3, 1.4, 9.1, 9.2_

- [x] 4. Integrate with existing WHERE builder

  - [x] 4.1 Create WHERE integration interface

    - Design integration point between SELECT and WHERE builders
    - Implement where method that accepts WHERE builder function
    - Ensure parameter management consistency across builders
    - Write unit tests for WHERE integration
    - _Requirements: 1.4, 10.4_

  - [x] 4.2 Implement complete SELECT-FROM-WHERE queries
    - Combine SELECT, FROM, and WHERE clause generation
    - Implement proper SQL clause ordering and syntax
    - Test complex queries with multiple conditions
    - Verify parameter reuse across different clause types
    - _Requirements: 1.1, 1.4, 10.4_

- [x] 5. Implement aggregate functions

  - [x] 5.1 Create aggregate function types and utilities

    - Define AggregateFunction enum and related types
    - Implement aggregate column representation in SelectColumn
    - Create utility functions for aggregate validation
    - Write unit tests for aggregate function types
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 5.2 Implement basic aggregate methods (count, sum, avg, min, max)
    - Write count method with optional column parameter
    - Implement sum, avg, min, max methods with type constraints
    - Ensure proper return type inference for aggregates
    - Write unit tests for all aggregate functions
    - _Requirements: 3.1, 3.2, 9.2_

  - [x] 5.3 Implement Cloud Spanner specific aggregates
    - Add ARRAY_AGG function with proper array type handling
    - Implement STRING_AGG function for string concatenation
    - Support aggregate function parameters and options
    - Write unit tests for Cloud Spanner specific aggregates
    - _Requirements: 3.3, 10.1_

- [x] 6. Implement GROUP BY clause

- [x] 6.1 Create GROUP BY types and validation

    - Define GroupByClause interface for grouping specification
    - Implement validation logic for GROUP BY requirements
    - Create utility functions for grouping column validation
    - Write unit tests for GROUP BY validation logic
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 6.2 Implement groupBy method with aggregate validation
    - Write groupBy method that accepts multiple columns
    - Implement validation that ensures proper aggregate/GROUP BY usage
    - Generate proper GROUP BY SQL clause syntax
    - Write unit tests for GROUP BY functionality and validation
    - _Requirements: 4.1, 4.2, 4.4_

- [x] 7. Implement HAVING clause

  - [x] 7.1 Create HAVING clause integration with WHERE builder

    - Design HAVING clause to reuse WHERE builder logic
    - Implement HavingBuilder type as extension of WhereBuilder
    - Create having method that accepts builder function
    - Write unit tests for HAVING clause basic functionality
    - _Requirements: 5.1, 5.2_

  - [x] 7.2 Implement HAVING with aggregate function support
    - Enable aggregate functions in HAVING conditions
    - Implement proper validation for HAVING without GROUP BY
    - Support complex HAVING conditions with logical operators
    - Write unit tests for aggregate conditions in HAVING
    - _Requirements: 5.2, 5.3, 5.4_

- [x] 8. Implement ORDER BY clause

  - [x] 8.1 Create ORDER BY types and utilities

    - Define OrderByColumn interface for sort specification
    - Implement OrderByClause type for multiple column sorting
    - Create utility functions for sort direction and null handling
    - Write unit tests for ORDER BY types and utilities
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 8.2 Implement orderBy method with multiple column support
    - Write orderBy method that accepts column and direction
    - Support multiple column sorting with proper precedence
    - Implement expression-based ordering support
    - Write unit tests for ORDER BY functionality
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 9. Implement LIMIT and OFFSET clauses

  - [x] 9.1 Create pagination types and validation

    - Define limit and offset value validation logic
    - Implement error handling for invalid pagination values
    - Create utility functions for pagination parameter management
    - Write unit tests for pagination validation
    - _Requirements: 7.1, 7.2, 7.4_

  - [x] 9.2 Implement limit and offset methods
    - Write limit method with value validation
    - Implement offset method with proper parameter handling
    - Support combined LIMIT/OFFSET for pagination
    - Write unit tests for pagination functionality
    - _Requirements: 7.1, 7.2, 7.3_

- [x] 10. Implement JOIN operations

  - [x] 10.1 Create JOIN types and condition handling

    - Define JoinType enum and JoinClause interface
    - Implement JoinCondition type for join condition specification
    - Create utility functions for join validation and processing
    - Write unit tests for JOIN types and utilities
    - _Requirements: 8.1, 8.2, 8.4_

  - [x] 10.2 Implement basic JOIN methods (innerJoin, leftJoin)
    - Write innerJoin method with condition builder integration
    - Implement leftJoin method with proper type handling for nullable columns
    - Support table aliases in JOIN operations
    - Write unit tests for basic JOIN functionality
    - _Requirements: 8.1, 8.2, 8.4, 9.3_

  - [x] 10.3 Implement advanced JOIN operations
    - Add rightJoin and fullJoin methods
    - Support multiple table joins with proper type merging
    - Implement cross join and natural join variants
    - Write unit tests for complex multi-table join scenarios
    - _Requirements: 8.2, 8.3, 9.3_

- [x] 11. Implement SQL generation for complete SELECT queries

- [x] 11.1 Create SELECT clause SQL generation

    - Implement generateSelectClause function for column lists
    - Support aggregate function SQL generation
    - Handle column aliases and expressions in SQL output
    - Write unit tests for SELECT clause SQL generation
    - _Requirements: 1.1, 2.1, 2.3, 3.1_

  - [x] 11.2 Implement complete query SQL generation
    - Create generateSelectSQL function that combines all clauses
    - Implement proper clause ordering (SELECT, FROM, JOIN, WHERE, GROUP BY, HAVING, ORDER BY, LIMIT)
    - Integrate with existing parameter management system
    - Write unit tests for complete query SQL generation
    - _Requirements: 1.4, 10.4_

- [x] 12. Add comprehensive type safety and validation

  - [x] 12.1 Implement compile-time type constraints

    - Add generic type constraints for column selection validation
    - Implement type evolution through query building process
    - Create type-safe aggregate function constraints
    - Write type-level tests for compile-time validation
    - _Requirements: 9.1, 9.2, 9.3_

  - [x] 12.2 Add runtime validation and error handling
    - Implement comprehensive query validation before SQL generation
    - Add specific error types for SELECT query validation failures
    - Create detailed error messages for common validation issues
    - Write unit tests for runtime validation and error scenarios
    - _Requirements: 7.4, 9.1_

- [ ] 13. Implement Cloud Spanner specific features

  - [ ] 13.1 Add ARRAY and UNNEST operations

    - Implement ARRAY_AGG and array manipulation functions
    - Add UNNEST operation support for array expansion
    - Create cross join UNNEST functionality
    - Write unit tests for array operations
    - _Requirements: 10.1_

  - [ ] 13.2 Implement window functions and advanced features
    - Add ROW_NUMBER, RANK, DENSE_RANK window functions
    - Implement OVER clause with PARTITION BY and ORDER BY
    - Support Cloud Spanner date/time functions
    - Write unit tests for window functions and advanced features
    - _Requirements: 10.2, 10.3_

- [ ] 14. Create comprehensive test suite

  - [ ] 14.1 Write integration tests for complex query scenarios

    - Create tests that combine multiple clauses and operations
    - Test complex multi-table joins with aggregation
    - Verify generated SQL matches expected Cloud Spanner syntax
    - Test parameter management across complex queries
    - _Requirements: 1.4, 8.3, 9.3, 10.4_

  - [ ] 14.2 Add property-based tests for query generation
    - Set up property-based testing for SELECT query generation
    - Create property tests for SQL syntax validity
    - Test type safety properties across query transformations
    - Add edge case testing for various query combinations
    - _Requirements: 9.1, 9.2_

- [ ] 15. Integration and documentation

  - [ ] 15.1 Integrate with existing spaniel-sql library

    - Update main index.ts to export SELECT query builder
    - Ensure compatibility with existing WHERE builder
    - Update package.json and build configuration
    - Write migration guide for existing users
    - _Requirements: 10.4_

  - [ ] 15.2 Create comprehensive documentation and examples
    - Write detailed API documentation for all SELECT builder methods
    - Create usage examples for common query patterns
    - Document Cloud Spanner specific features and best practices
    - Add TypeScript usage examples with type annotations
    - _Requirements: 9.1, 10.1, 10.2, 10.3_
