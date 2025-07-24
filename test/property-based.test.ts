/**
 * Property-based tests for query generation
 * These tests use fast-check to generate random inputs and verify properties
 */

import assert from "node:assert";
import { describe, test } from "node:test";
import * as fc from "fast-check";
import { createWhere, type SchemaConstraint } from "../src/types";

// Test schema for property-based testing
interface TestSchema extends SchemaConstraint {
  id: number;
  name: string;
  email: string;
  age: number;
  is_active: boolean;
  created_at: Date;
  tags: string[][];
  score: number;
  category: string;
  description: string | null;
}

describe("Property-Based Tests for Query Generation", () => {
  describe("SQL Syntax Validity", () => {
    test("should always generate valid parameter syntax", () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.record({
              column: fc.constant("name" as const),
              value: fc.string(),
            }),
            fc.record({
              column: fc.constant("email" as const),
              value: fc.string(),
            }),
            fc.record({
              column: fc.constant("id" as const),
              value: fc.integer(),
            }),
            fc.record({
              column: fc.constant("age" as const),
              value: fc.integer(),
            }),
            fc.record({
              column: fc.constant("is_active" as const),
              value: fc.boolean(),
            })
          ),
          (input) => {
            const query = createWhere<TestSchema>().eq(input.column, input.value).build();

            // Property: All parameters should follow @paramN format
            const parameterNames = Object.keys(query.parameters);
            parameterNames.forEach((name) => {
              assert.ok(/^param\d+$/.test(name), `Invalid parameter name: ${name}`);
            });

            // Property: SQL should contain valid parameter references
            const sqlParamRefs = query.sql.match(/@param\d+/g) || [];
            sqlParamRefs.forEach((ref) => {
              const paramName = ref.substring(1); // Remove @
              assert.ok(
                Object.hasOwn(query.parameters, paramName),
                `Parameter ${paramName} referenced in SQL but not in parameters object`
              );
            });

            // Property: SQL should be well-formed for basic equality
            assert.ok(
              /^\(.+ = @param\d+\)$/.test(query.sql) || /^.+ = @param\d+$/.test(query.sql),
              `Invalid SQL format: ${query.sql}`
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    test("should generate consistent parameter names for same values", () => {
      fc.assert(
        fc.property(
          fc.record({
            stringValue: fc.string(),
            numberValue: fc.integer(),
            booleanValue: fc.boolean(),
            reuseSameValue: fc.boolean(),
          }),
          (input) => {
            const query = input.reuseSameValue
              ? // Test parameter reuse with same value
                createWhere<TestSchema>()
                  .eq("name", input.stringValue)
                  .eq("email", input.stringValue) // Same value, should reuse parameter
                  .build()
              : // Test different values get different parameters
                createWhere<TestSchema>()
                  .eq("name", input.stringValue)
                  .eq("age", input.numberValue)
                  .eq("is_active", input.booleanValue)
                  .build();

            // Property: Same values should reuse parameters
            if (input.reuseSameValue) {
              // If reusing same value, should only have 1 parameter
              assert.strictEqual(Object.keys(query.parameters).length, 1);
            } else {
              // If values are different, should have 3 parameters
              assert.strictEqual(Object.keys(query.parameters).length, 3);
            }

            // Property: All referenced parameters should exist
            const sqlParamRefs = query.sql.match(/@param\d+/g) || [];
            sqlParamRefs.forEach((ref) => {
              const paramName = ref.substring(1);
              assert.ok(Object.hasOwn(query.parameters, paramName));
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    test("should handle null values correctly in SQL generation", () => {
      fc.assert(
        fc.property(fc.constantFrom("description", "created_at", "tags"), (column) => {
          const query = createWhere<TestSchema>()
            .eq(column as keyof TestSchema, null)
            .build();

          // Property: null equality should become IS NULL
          assert.ok(
            query.sql.includes("IS NULL"),
            `Null comparison should use IS NULL, got: ${query.sql}`
          );

          // Property: Should not have null parameters
          const hasNullParams = Object.values(query.parameters).some((v) => v === null);
          assert.strictEqual(
            hasNullParams,
            false,
            "Should not have null parameters for IS NULL operations"
          );
        }),
        { numRuns: 50 }
      );
    });
  });

  describe("Parameter Generation Consistency", () => {
    test("should maintain parameter consistency across multiple operations", () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              column: fc.constantFrom("id", "name", "email", "age", "score"),
              value: fc.oneof(fc.string(), fc.integer({ min: 0, max: 1000 }), fc.boolean()),
              operator: fc.constantFrom("eq", "ne", "gt", "lt", "ge", "le"),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          (operations) => {
            let builder = createWhere<TestSchema>();

            // Apply all operations with proper type handling
            operations.forEach((op) => {
              // Handle type-safe operations based on column and value types
              if (op.column === "name" || op.column === "email") {
                // String columns
                if (typeof op.value === "string") {
                  switch (op.operator) {
                    case "eq":
                      builder = builder.eq(op.column, op.value);
                      break;
                    case "ne":
                      builder = builder.ne(op.column, op.value);
                      break;
                    default:
                      builder = builder.eq(op.column, op.value);
                  }
                }
              } else if (op.column === "id" || op.column === "age" || op.column === "score") {
                // Numeric columns
                if (typeof op.value === "number") {
                  switch (op.operator) {
                    case "eq":
                      builder = builder.eq(op.column, op.value);
                      break;
                    case "ne":
                      builder = builder.ne(op.column, op.value);
                      break;
                    case "gt":
                      builder = builder.gt(op.column, op.value);
                      break;
                    case "lt":
                      builder = builder.lt(op.column, op.value);
                      break;
                    case "ge":
                      builder = builder.ge(op.column, op.value);
                      break;
                    case "le":
                      builder = builder.le(op.column, op.value);
                      break;
                  }
                }
              }
            });

            const query = builder.build();

            // Property: All unique values should have corresponding parameters (only for processed operations)
            const processedValues = operations
              .filter((op) => {
                // Only include values from operations that were actually processed
                return (
                  ((op.column === "name" || op.column === "email") &&
                    typeof op.value === "string") ||
                  ((op.column === "id" || op.column === "age" || op.column === "score") &&
                    typeof op.value === "number")
                );
              })
              .map((op) => op.value);

            const uniqueProcessedValues = [...new Set(processedValues)];
            uniqueProcessedValues.forEach((value) => {
              if (value !== null && value !== "") {
                assert.ok(
                  Object.values(query.parameters).includes(value),
                  `Value ${value} should be in parameters`
                );
              }
            });

            // Property: Parameter count should not exceed unique value count
            const nonNullProcessedValues = uniqueProcessedValues.filter((v) => v !== null);
            assert.ok(
              Object.keys(query.parameters).length <= nonNullProcessedValues.length,
              "Parameter count should not exceed unique non-null processed values"
            );

            // Property: SQL should contain column references for processed operations
            operations.forEach((op) => {
              // Only check if the operation was actually processed (type-compatible)
              const wasProcessed =
                ((op.column === "name" || op.column === "email") && typeof op.value === "string") ||
                ((op.column === "id" || op.column === "age" || op.column === "score") &&
                  typeof op.value === "number");

              if (wasProcessed) {
                assert.ok(query.sql.includes(op.column), `SQL should contain column ${op.column}`);
              }
            });
          }
        ),
        { numRuns: 50 }
      );
    });

    test("should generate unique parameter names", () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 1, max: 1000 }), { minLength: 2, maxLength: 10 }),
          (values) => {
            let builder = createWhere<TestSchema>();

            // Add each value as a separate condition
            values.forEach((value) => {
              builder = builder.eq("id", value);
            });

            const query = builder.build();

            // Property: All parameter names should be unique
            const paramNames = Object.keys(query.parameters);
            const uniqueParamNames = [...new Set(paramNames)];
            assert.strictEqual(
              paramNames.length,
              uniqueParamNames.length,
              "All parameter names should be unique"
            );

            // Property: Parameter names should follow sequential numbering for unique values
            const uniqueValues = [...new Set(values)];
            assert.strictEqual(
              Object.keys(query.parameters).length,
              uniqueValues.length,
              "Should have one parameter per unique value"
            );
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe("Array Operations Properties", () => {
    test("should handle IN operations with various array sizes", () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.array(fc.array(fc.string(), { minLength: 1, maxLength: 2 }), {
              minLength: 1,
              maxLength: 2,
            }),
            { minLength: 0, maxLength: 20 }
          ),
          (values) => {
            const query = createWhere<TestSchema>().in("tags", values).build();

            if (values.length === 0) {
              // Property: Empty arrays should generate FALSE
              assert.ok(query.sql.includes("FALSE"), "Empty IN array should generate FALSE");
            } else {
              // Property: Non-empty arrays should generate IN clause
              assert.ok(query.sql.includes("IN ("), "Non-empty IN array should generate IN clause");

              // Property: All array values should be in parameters (excluding empty arrays)
              values.forEach((value) => {
                // Only check non-empty arrays
                if (value.length > 0) {
                  assert.ok(
                    Object.values(query.parameters).includes(value),
                    `Array value ${value} should be in parameters`
                  );
                }
              });

              // Property: Parameter count should match unique values
              const uniqueValues = [...new Set(values)];
              assert.strictEqual(
                Object.keys(query.parameters).length,
                uniqueValues.length,
                "Parameter count should match unique array values"
              );
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    test("should handle NOT IN operations consistently", () => {
      fc.assert(
        fc.property(fc.array(fc.string(), { minLength: 1, maxLength: 10 }), (values) => {
          const query = createWhere<TestSchema>().notIn("category", values).build();

          // Property: Should generate NOT IN clause
          assert.ok(query.sql.includes("NOT IN ("), "Should generate NOT IN clause");

          // Property: All values should be parameterized
          values.forEach((value) => {
            assert.ok(
              Object.values(query.parameters).includes(value),
              `Value ${value} should be parameterized`
            );
          });

          // Property: Should have correct number of parameter references in SQL
          const paramRefs = query.sql.match(/@param\d+/g) || [];
          const uniqueValues = [...new Set(values)];
          // For NOT IN, we expect one parameter reference per unique value
          assert.ok(
            paramRefs.length >= uniqueValues.length,
            "Parameter references should be at least as many as unique values"
          );
        }),
        { numRuns: 30 }
      );
    });
  });

  describe("String Pattern Operations Properties", () => {
    test("should handle LIKE patterns correctly", () => {
      fc.assert(
        fc.property(
          fc.record({
            column: fc.constantFrom("name", "email", "description"),
            pattern: fc.string({ minLength: 1, maxLength: 20 }),
          }),
          (input) => {
            const query = createWhere<TestSchema>()
              .like(input.column as keyof TestSchema, input.pattern)
              .build();

            // Property: Should generate LIKE clause
            assert.ok(
              query.sql.includes("LIKE @param"),
              "Should generate LIKE clause with parameter"
            );

            // Property: Pattern should be in parameters
            assert.ok(
              Object.values(query.parameters).includes(input.pattern),
              "Pattern should be in parameters"
            );

            // Property: Column should be referenced in SQL
            assert.ok(query.sql.includes(input.column), `Column ${input.column} should be in SQL`);
          }
        ),
        { numRuns: 50 }
      );
    });

    test("should handle STARTS_WITH and ENDS_WITH functions", () => {
      fc.assert(
        fc.property(
          fc.record({
            prefix: fc.string({ minLength: 1, maxLength: 10 }),
            suffix: fc.string({ minLength: 1, maxLength: 10 }),
          }),
          (input) => {
            const query = createWhere<TestSchema>()
              .startsWith("name", input.prefix)
              .endsWith("email", input.suffix)
              .build();

            // Property: Should generate STARTS_WITH function
            assert.ok(
              query.sql.includes("STARTS_WITH(name, @param"),
              "Should generate STARTS_WITH function"
            );

            // Property: Should generate ENDS_WITH function
            assert.ok(
              query.sql.includes("ENDS_WITH(email, @param"),
              "Should generate ENDS_WITH function"
            );

            // Property: Both values should be in parameters
            assert.ok(
              Object.values(query.parameters).includes(input.prefix),
              "Prefix should be in parameters"
            );
            assert.ok(
              Object.values(query.parameters).includes(input.suffix),
              "Suffix should be in parameters"
            );
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe("Logical Operations Properties", () => {
    test("should maintain proper parentheses balance in complex queries", () => {
      fc.assert(
        fc.property(
          fc.record({
            conditions: fc.array(
              fc.oneof(
                fc.record({
                  column: fc.constant("name" as const),
                  value: fc.string(),
                }),
                fc.record({
                  column: fc.constant("id" as const),
                  value: fc.integer(),
                }),
                fc.record({
                  column: fc.constant("age" as const),
                  value: fc.integer(),
                }),
                fc.record({
                  column: fc.constant("is_active" as const),
                  value: fc.boolean(),
                })
              ),
              { minLength: 2, maxLength: 5 }
            ),
            useOr: fc.boolean(),
          }),
          (input) => {
            let builder = createWhere<TestSchema>();

            if (input.useOr) {
              builder = builder.or(
                ...input.conditions.map((cond) => (b) => b.eq(cond.column, cond.value))
              );
            } else {
              builder = builder.and(
                ...input.conditions.map((cond) => (b) => b.eq(cond.column, cond.value))
              );
            }

            const query = builder.build();

            // Property: Parentheses should be balanced
            const openParens = (query.sql.match(/\(/g) || []).length;
            const closeParens = (query.sql.match(/\)/g) || []).length;
            assert.strictEqual(openParens, closeParens, `Unbalanced parentheses in: ${query.sql}`);

            // Property: Should contain appropriate logical operator
            if (input.conditions.length > 1) {
              if (input.useOr) {
                assert.ok(query.sql.includes("OR"), "Should contain OR operator");
              } else {
                assert.ok(query.sql.includes("AND"), "Should contain AND operator");
              }
            }

            // Property: All condition values should be parameterized
            input.conditions.forEach((cond) => {
              assert.ok(
                Object.values(query.parameters).includes(cond.value),
                `Value ${cond.value} should be parameterized`
              );
            });
          }
        ),
        { numRuns: 30 }
      );
    });

    test("should handle nested logical operations correctly", () => {
      fc.assert(
        fc.property(
          fc.record({
            outerConditions: fc.array(
              fc.record({
                column: fc.constantFrom("name", "email"),
                value: fc.string({ minLength: 1, maxLength: 10 }),
              }),
              { minLength: 1, maxLength: 3 }
            ),
            innerConditions: fc.array(
              fc.record({
                column: fc.constantFrom("age", "score"),
                value: fc.integer({ min: 1, max: 100 }),
              }),
              { minLength: 1, maxLength: 3 }
            ),
          }),
          (input) => {
            const query = createWhere<TestSchema>()
              .and(
                (b) =>
                  b.or(
                    ...input.outerConditions.map((cond) => (ob) => ob.eq(cond.column, cond.value))
                  ),
                (b) =>
                  b.and(
                    ...input.innerConditions.map((cond) => (ab) => ab.eq(cond.column, cond.value))
                  )
              )
              .build();

            // Property: Should have nested structure with multiple parentheses levels
            const openParens = (query.sql.match(/\(/g) || []).length;
            assert.ok(openParens >= 1, "Should have parentheses structure");

            // Property: Should contain both AND and OR if conditions warrant it
            if (input.outerConditions.length > 1) {
              assert.ok(query.sql.includes("OR"), "Should contain OR for outer conditions");
            }
            if (input.innerConditions.length > 1) {
              assert.ok(query.sql.includes("AND"), "Should contain AND for inner conditions");
            }

            // Property: All values should be parameterized
            const allValues = [
              ...input.outerConditions.map((c) => c.value),
              ...input.innerConditions.map((c) => c.value),
            ];
            allValues.forEach((value) => {
              assert.ok(
                Object.values(query.parameters).includes(value),
                `Value ${value} should be parameterized`
              );
            });
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe("Edge Case Properties", () => {
    test("should handle extreme parameter counts", () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 1, max: 10000 }), { minLength: 50, maxLength: 100 }),
          (values) => {
            const query = createWhere<TestSchema>().in("id", values).build();

            // Property: Should handle large parameter sets
            const uniqueValues = [...new Set(values)];
            assert.strictEqual(
              Object.keys(query.parameters).length,
              uniqueValues.length,
              "Should have correct parameter count for large arrays"
            );

            // Property: SQL should be well-formed even with many parameters
            if (values.length > 0) {
              assert.ok(query.sql.includes("IN ("), "Should generate IN clause");
              const paramRefs = query.sql.match(/@param\d+/g) || [];
              // For IN operations with duplicate values, we expect parameter reuse
              assert.ok(
                paramRefs.length <= values.length,
                "Parameter references should not exceed total values"
              );
            }
          }
        ),
        { numRuns: 10 } // Fewer runs for performance
      );
    });

    test("should handle mixed data types consistently", () => {
      fc.assert(
        fc.property(
          fc.record({
            stringVal: fc.string(),
            intVal: fc.integer(),
            boolVal: fc.boolean(),
            dateVal: fc.date(),
          }),
          (input) => {
            const query = createWhere<TestSchema>()
              .eq("name", input.stringVal)
              .eq("age", input.intVal)
              .eq("is_active", input.boolVal)
              .eq("created_at", input.dateVal)
              .build();

            // Property: All different types should be parameterized
            assert.ok(
              Object.values(query.parameters).includes(input.stringVal),
              "String value should be parameterized"
            );
            assert.ok(
              Object.values(query.parameters).includes(input.intVal),
              "Integer value should be parameterized"
            );
            assert.ok(
              Object.values(query.parameters).includes(input.boolVal),
              "Boolean value should be parameterized"
            );
            assert.ok(
              Object.values(query.parameters).includes(input.dateVal),
              "Date value should be parameterized"
            );

            // Property: Should have 4 parameters for 4 different values
            assert.strictEqual(
              Object.keys(query.parameters).length,
              4,
              "Should have 4 parameters for 4 different typed values"
            );

            // Property: SQL should reference all columns
            assert.ok(query.sql.includes("name"), "Should reference name column");
            assert.ok(query.sql.includes("age"), "Should reference age column");
            assert.ok(query.sql.includes("is_active"), "Should reference is_active column");
            assert.ok(query.sql.includes("created_at"), "Should reference created_at column");
          }
        ),
        { numRuns: 50 }
      );
    });

    test("should maintain immutability properties", () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.oneof(
              fc.record({
                column: fc.constant("name" as const),
                value: fc.string(),
              }),
              fc.record({
                column: fc.constant("age" as const),
                value: fc.integer(),
              }),
              fc.record({
                column: fc.constant("is_active" as const),
                value: fc.boolean(),
              })
            ),
            { minLength: 2, maxLength: 5 }
          ),
          (operations) => {
            const initialBuilder = createWhere<TestSchema>();
            let currentBuilder = initialBuilder;

            // Apply operations and collect intermediate builders
            const builders = [currentBuilder];
            operations.forEach((op) => {
              currentBuilder = currentBuilder.eq(op.column, op.value);
              builders.push(currentBuilder);
            });

            // Property: Each builder should be different object (immutability)
            for (let i = 0; i < builders.length - 1; i++) {
              assert.notStrictEqual(
                builders[i],
                builders[i + 1],
                "Each operation should return a new builder instance"
              );
            }

            // Property: Final builder should contain all operations
            const finalQuery = currentBuilder.build();
            operations.forEach((op) => {
              assert.ok(
                finalQuery.sql.includes(op.column),
                `Final query should contain column ${op.column}`
              );
              assert.ok(
                Object.values(finalQuery.parameters).includes(op.value),
                `Final query should contain value ${op.value}`
              );
            });
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  describe("Cloud Spanner Compliance Properties", () => {
    test("should generate Cloud Spanner compatible SQL syntax", () => {
      fc.assert(
        fc.property(
          fc.record({
            eqValue: fc.string(),
            likePattern: fc.string(),
            inValues: fc.array(
              fc.array(fc.array(fc.string(), { minLength: 1, maxLength: 2 }), {
                minLength: 1,
                maxLength: 2,
              }),
              { minLength: 1, maxLength: 5 }
            ),
            gtValue: fc.integer(),
          }),
          (input) => {
            const query = createWhere<TestSchema>()
              .eq("name", input.eqValue)
              .like("email", input.likePattern)
              .in("tags", input.inValues)
              .gt("age", input.gtValue)
              .isNull("description")
              .build();

            // Property: Should use Cloud Spanner parameter syntax (@param)
            const paramRefs = query.sql.match(/@param\d+/g) || [];
            assert.ok(paramRefs.length > 0, "Should use @param syntax");

            // Property: Should use proper Cloud Spanner operators
            assert.ok(query.sql.includes(" = @param"), "Should use = operator");
            assert.ok(query.sql.includes(" LIKE @param"), "Should use LIKE operator");
            assert.ok(query.sql.includes(" IN ("), "Should use IN operator");
            assert.ok(query.sql.includes(" > @param"), "Should use > operator");
            assert.ok(query.sql.includes(" IS NULL"), "Should use IS NULL");

            // Property: Should use AND for combining conditions
            assert.ok(query.sql.includes(" AND "), "Should use AND to combine conditions");

            // Property: Should wrap in parentheses for grouping
            assert.ok(query.sql.startsWith("("), "Should start with opening parenthesis");
            assert.ok(query.sql.endsWith(")"), "Should end with closing parenthesis");
          }
        ),
        { numRuns: 50 }
      );
    });

    test("should handle Cloud Spanner string functions correctly", () => {
      fc.assert(
        fc.property(
          fc.record({
            prefix: fc.string({ minLength: 1, maxLength: 10 }),
            suffix: fc.string({ minLength: 1, maxLength: 10 }),
          }),
          (input) => {
            const query = createWhere<TestSchema>()
              .startsWith("name", input.prefix)
              .endsWith("email", input.suffix)
              .build();

            // Property: Should use Cloud Spanner STARTS_WITH function
            assert.ok(
              query.sql.includes("STARTS_WITH(name, @param"),
              "Should use STARTS_WITH function syntax"
            );

            // Property: Should use Cloud Spanner ENDS_WITH function
            assert.ok(
              query.sql.includes("ENDS_WITH(email, @param"),
              "Should use ENDS_WITH function syntax"
            );

            // Property: Function calls should be properly formatted
            const startsWithMatch = query.sql.match(/STARTS_WITH\(name, @param\d+\)/);
            const endsWithMatch = query.sql.match(/ENDS_WITH\(email, @param\d+\)/);
            assert.ok(startsWithMatch, "STARTS_WITH should be properly formatted");
            assert.ok(endsWithMatch, "ENDS_WITH should be properly formatted");
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
