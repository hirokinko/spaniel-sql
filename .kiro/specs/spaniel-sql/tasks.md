# Implementation Plan

- [x] 1. Set up project structure and core type definitions

  - Create TypeScript project structure with src/, test/, and configuration files
  - Define core types: SpannerDataType, QueryResult, ComparisonOperator
  - Set up TypeScript configuration for strict type checking
  - _Requirements: 1.1, 6.1, 6.2_

- [x] 2. Implement functional parameter manager

  - [x] 2.1 Create ParameterManager type and factory function

    - Write ParameterManager type definition with immutable structure
    - Implement createParameterManager factory function
    - Write unit tests for parameter manager creation
    - _Requirements: 7.1, 7.3_

  - [x] 2.2 Implement addParameter function with value reuse
    - Code addParameter function that returns new manager and parameter name
    - Implement parameter value reuse logic to avoid duplicates
    - Write unit tests for parameter addition and reuse scenarios
    - _Requirements: 7.2, 7.3_

- [x] 3. Create condition representation types and utilities

  - [x] 3.1 Define Condition and ConditionGroup types

    - Write Condition interface for individual conditions
    - Write ConditionGroup interface for logical groupings
    - Create utility types for condition tree structure
    - _Requirements: 1.2, 5.3, 5.4_

  - [x] 3.2 Implement condition creation helper functions
    - Write functions to create comparison conditions (eq, ne, gt, lt, ge, le)
    - Write functions to create array conditions (in, notIn)
    - Write functions to create string pattern conditions (like, notLike)
    - Write unit tests for condition creation functions
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 4.1, 4.2_

- [x] 4. Implement SQL generation from condition tree

  - [x] 4.1 Create SQL generator for basic comparison conditions

    - Write function to convert comparison conditions to SQL strings
    - Handle null value special cases (IS NULL, IS NOT NULL)
    - Write unit tests for basic SQL generation
    - _Requirements: 2.1, 2.2, 2.4_

  - [x] 4.2 Implement SQL generation for array and pattern operations

    - Write SQL generation for IN/NOT IN operations with parameter expansion
    - Write SQL generation for LIKE/NOT LIKE operations
    - Write SQL generation for STARTS_WITH/ENDS_WITH functions
    - Handle empty array edge cases for IN operations
    - Write unit tests for array and pattern SQL generation
    - _Requirements: 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 4.4_

  - [x] 4.3 Implement logical operator SQL generation with proper parentheses
    - Write function to generate SQL for AND/OR condition groups
    - Implement proper parentheses handling for operator precedence
    - Handle nested condition groups recursively
    - Write unit tests for logical operator SQL generation
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ] 5. Create WhereBuilder factory and core methods

  - [x] 5.1 Implement createWhere factory function

    - Write createWhere factory function that returns WhereBuilder instance
    - Initialize empty condition tree and parameter manager
    - Write unit tests for factory function
    - _Requirements: 1.1, 6.4_

  - [x] 5.2 Implement basic comparison methods (eq, ne, gt, lt, ge, le)

    - Write eq method that adds equality condition and returns new builder
    - Write ne, gt, lt, ge, le methods for other comparison operators
    - Ensure immutability by returning new builder instances
    - Write unit tests for each comparison method
    - _Requirements: 2.1, 2.2, 6.1, 6.2_

  - [ ] 5.3 Implement array operation methods (in, notIn)
    - Write in method that handles array values and creates IN conditions
    - Write notIn method for NOT IN operations
    - Handle empty array edge cases appropriately
    - Write unit tests for array operation methods
    - _Requirements: 3.1, 3.2, 3.3_

- [ ] 6. Implement string pattern and null check methods

  - [ ] 6.1 Create string pattern methods (like, notLike, startsWith, endsWith)

    - Write like and notLike methods for pattern matching
    - Write startsWith method that generates STARTS_WITH function calls
    - Write endsWith method that generates ENDS_WITH function calls
    - Write unit tests for string pattern methods
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [ ] 6.2 Implement null check methods (isNull, isNotNull)
    - Write isNull method that generates IS NULL conditions
    - Write isNotNull method that generates IS NOT NULL conditions
    - Write unit tests for null check methods
    - _Requirements: 2.4_

- [ ] 7. Implement logical operator methods with array support

  - [ ] 7.1 Create and method with multiple condition support

    - Write and method that accepts array of condition builder functions
    - Implement proper condition grouping and chaining
    - Ensure immutability and return new builder instance
    - Write unit tests for and method with multiple conditions
    - _Requirements: 5.1, 5.2, 5.3_

  - [ ] 7.2 Create or method with multiple condition support
    - Write or method that accepts array of condition builder functions
    - Implement proper OR grouping with parentheses
    - Handle mixed AND/OR scenarios correctly
    - Write unit tests for or method and mixed logical operations
    - _Requirements: 5.2, 5.3, 5.4_

- [ ] 8. Implement build method and query result generation

  - [ ] 8.1 Create build method that generates final QueryResult

    - Write build method that converts condition tree to SQL string
    - Integrate parameter manager to generate parameter object
    - Return QueryResult with sql and parameters properties
    - Write unit tests for build method with various condition combinations
    - _Requirements: 1.4, 7.1, 7.4_

  - [ ] 8.2 Add comprehensive error handling and validation
    - Implement runtime validation for condition values
    - Add error handling for malformed conditions
    - Create QueryBuilderError type and error creation functions
    - Write unit tests for error scenarios and edge cases
    - _Requirements: 3.3, 3.4_

- [ ] 9. Add TypeScript type safety and generic constraints

  - [ ] 9.1 Implement generic type constraints for schema validation

    - Add generic type parameter T to WhereBuilder for schema typing
    - Implement keyof T constraints for column name validation
    - Add type constraints for value types based on schema
    - Write type-level tests to verify compile-time error detection
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ] 9.2 Create comprehensive type definitions and exports
    - Export all public types and interfaces
    - Create index file with proper type exports
    - Add JSDoc documentation for all public APIs
    - Write integration tests with typed schemas
    - _Requirements: 6.1, 6.3, 6.4_

- [ ] 10. Create comprehensive test suite

  - [ ] 10.1 Write integration tests with complex query scenarios

    - Create tests that combine multiple operators and conditions
    - Test nested logical operations with proper parentheses
    - Test parameter reuse across complex queries
    - Verify generated SQL matches expected Cloud Spanner syntax
    - _Requirements: 1.2, 1.3, 1.4, 5.3, 5.4, 7.2_

  - [ ] 10.2 Add property-based tests for query generation
    - Set up fast-check or similar property-based testing library
    - Create property tests for SQL syntax validity
    - Test parameter generation consistency
    - Add edge case testing for various input combinations
    - _Requirements: 1.4, 7.1, 7.3_
