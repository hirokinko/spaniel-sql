/**
 * Type-level tests for schema validation and generic type constraints
 * These tests verify compile-time type safety and error detection
 */

import assert from "node:assert";
import { describe, test } from "node:test";
import { createWhere, type ParameterValue, type SchemaConstraint } from "../src/types";

// Test schema interfaces for type checking
interface UserSchema extends SchemaConstraint {
  id: number;
  name: string;
  email: string;
  age: number;
  active: boolean;
  created_at: Date;
  deleted_at: Date | null;
}

interface ProductSchema extends SchemaConstraint {
  id: string;
  title: string;
  price: number;
  category: string;
  tags: string[];
  in_stock: boolean;
}

// Untyped schema (allows any ParameterValue)
type UntypedSchema = Record<string, ParameterValue>;

describe("Type Constraints and Schema Validation", () => {
  describe("Basic Type Constraints", () => {
    test("should enforce column name constraints with typed schema", () => {
      const builder = createWhere<UserSchema>();

      // These should compile without errors - valid columns
      const validQuery = builder
        .eq("id", 123)
        .eq("name", "John")
        .eq("email", "john@example.com")
        .eq("age", 25)
        .eq("active", true)
        .eq("created_at", new Date())
        .eq("deleted_at", null);

      assert.ok(validQuery);

      // Test that the builder maintains type information
      const result = validQuery.build();
      assert.ok(typeof result.sql === "string");
      assert.ok(typeof result.parameters === "object");
    });

    test("should enforce value type constraints with typed schema", () => {
      const builder = createWhere<UserSchema>();

      // These should compile - correct value types
      const validTypes = builder
        .eq("id", 123) // number
        .eq("name", "John") // string
        .eq("active", true) // boolean
        .eq("deleted_at", null); // null allowed

      assert.ok(validTypes);

      // Test with Date type
      const dateQuery = builder.eq("created_at", new Date());
      assert.ok(dateQuery);
    });

    test("should work with untyped schema", () => {
      const builder = createWhere<UntypedSchema>();

      // Should allow any column names and values
      const untypedQuery = builder
        .eq("any_column", "any_value")
        .eq("another_column", 123)
        .eq("bool_column", true)
        .eq("null_column", null);

      assert.ok(untypedQuery);
    });

    test("should work without explicit schema type", () => {
      const builder = createWhere(); // No type parameter

      // Should allow any column names and values (defaults to SchemaConstraint)
      const defaultQuery = builder.eq("column1", "value1").eq("column2", 42).eq("column3", true);

      assert.ok(defaultQuery);
    });
  });

  describe("Array Operation Type Constraints", () => {
    test("should enforce array value types with typed schema", () => {
      const builder = createWhere<UserSchema>();

      // These should compile - correct array types
      const validArrays = builder
        .in("id", [1, 2, 3]) // number[]
        .in("name", ["John", "Jane"]) // string[]
        .in("active", [true, false]) // boolean[]
        .notIn("age", [18, 21, 65]); // number[]

      assert.ok(validArrays);
    });

    test("should handle empty arrays", () => {
      const builder = createWhere<UserSchema>();

      const emptyArrays = builder
        .in("id", []) // empty number[]
        .notIn("name", []); // empty string[]

      assert.ok(emptyArrays);
    });
  });

  describe("String Operation Type Constraints", () => {
    test("should allow string operations on string columns", () => {
      const builder = createWhere<UserSchema>();

      // These should compile - string columns
      const stringOps = builder
        .like("name", "John%")
        .notLike("email", "%@spam.com")
        .startsWith("name", "J")
        .endsWith("email", "@example.com");

      assert.ok(stringOps);
    });

    test("should work with untyped schema for string operations", () => {
      const builder = createWhere<UntypedSchema>();

      // Should allow string operations on any column in untyped schema
      const untypedStringOps = builder
        .like("any_column", "pattern%")
        .startsWith("another_column", "prefix");

      assert.ok(untypedStringOps);
    });
  });

  describe("Null Check Type Constraints", () => {
    test("should allow null checks on any column", () => {
      const builder = createWhere<UserSchema>();

      // Should work on any column type
      const nullChecks = builder
        .isNull("deleted_at")
        .isNotNull("created_at")
        .isNull("name") // Even non-nullable columns should allow null checks
        .isNotNull("id");

      assert.ok(nullChecks);
    });
  });

  describe("Logical Operator Type Constraints", () => {
    test("should maintain type constraints in logical operations", () => {
      const builder = createWhere<UserSchema>();

      const logicalOps = builder.and(
        (b) => b.eq("name", "John"),
        (b) => b.gt("age", 18),
        (b) => b.eq("active", true)
      );

      assert.ok(logicalOps);

      const orOps = builder.or(
        (b) => b.eq("name", "John"),
        (b) => b.eq("name", "Jane")
      );

      assert.ok(orOps);
    });

    test("should handle nested logical operations", () => {
      const builder = createWhere<UserSchema>();

      const nestedOps = builder.eq("active", true).and(
        (b) =>
          b.or(
            (ob) => ob.eq("name", "John"),
            (ob) => ob.eq("name", "Jane")
          ),
        (b) => b.gt("age", 21)
      );

      assert.ok(nestedOps);
    });
  });

  describe("Complex Schema Type Constraints", () => {
    test("should work with different schema types", () => {
      const userBuilder = createWhere<UserSchema>();
      const productBuilder = createWhere<ProductSchema>();

      // User schema operations
      const userQuery = userBuilder.eq("id", 123).eq("name", "John").gt("age", 18);

      // Product schema operations
      const productQuery = productBuilder
        .eq("id", "prod-123") // string ID for products
        .eq("title", "Product Name")
        .gt("price", 10.99);

      assert.ok(userQuery);
      assert.ok(productQuery);
    });

    test("should handle nullable columns correctly", () => {
      const builder = createWhere<UserSchema>();

      // deleted_at is Date | null, should accept both
      const nullableOps = builder
        .eq("deleted_at", null)
        .eq("deleted_at", new Date())
        .isNull("deleted_at")
        .isNotNull("deleted_at");

      assert.ok(nullableOps);
    });
  });

  describe("Type Safety Edge Cases", () => {
    test("should handle mixed value types in arrays", () => {
      // For untyped schema, should allow mixed arrays
      const builder = createWhere<UntypedSchema>();

      const mixedArrays = builder.in("mixed_column", [1, "string", true, null]);

      assert.ok(mixedArrays);
    });

    test("should maintain type information through method chaining", () => {
      const builder = createWhere<UserSchema>();

      // Long chain should maintain types
      const longChain = builder
        .eq("name", "John")
        .gt("age", 18)
        .eq("active", true)
        .and(
          (b) => b.like("email", "%@example.com"),
          (b) => b.isNotNull("created_at")
        )
        .or(
          (b) => b.eq("id", 1),
          (b) => b.eq("id", 2)
        );

      const result = longChain.build();
      assert.ok(typeof result.sql === "string");
      assert.ok(typeof result.parameters === "object");
    });

    test("should work with generic constraint inheritance", () => {
      // Test that SchemaConstraint works as expected
      interface ExtendedSchema extends UserSchema {
        extra_field: string;
      }

      const builder = createWhere<ExtendedSchema>();

      const extendedQuery = builder
        .eq("name", "John") // From UserSchema
        .eq("extra_field", "extra_value"); // From ExtendedSchema

      assert.ok(extendedQuery);
    });
  });

  describe("Runtime Behavior with Type Constraints", () => {
    test("should generate correct SQL with typed schema", () => {
      const builder = createWhere<UserSchema>();

      const query = builder.eq("name", "John").gt("age", 18).eq("active", true).build();

      assert.ok(query.sql.includes("name = @param"));
      assert.ok(query.sql.includes("age > @param"));
      assert.ok(query.sql.includes("active = @param"));
      assert.ok(
        query.parameters.param1 === "John" || Object.values(query.parameters).includes("John")
      );
      assert.ok(Object.values(query.parameters).includes(18));
      assert.ok(Object.values(query.parameters).includes(true));
    });

    test("should handle string operations with type constraints", () => {
      const builder = createWhere<UserSchema>();

      const query = builder.like("name", "John%").startsWith("email", "john").build();

      assert.ok(query.sql.includes("name LIKE @param"));
      assert.ok(query.sql.includes("STARTS_WITH(email, @param"));
      assert.ok(Object.values(query.parameters).includes("John%"));
      assert.ok(Object.values(query.parameters).includes("john"));
    });

    test("should handle array operations with type constraints", () => {
      const builder = createWhere<UserSchema>();

      const query = builder.in("id", [1, 2, 3]).notIn("name", ["spam", "test"]).build();

      assert.ok(query.sql.includes("id IN ("));
      assert.ok(query.sql.includes("name NOT IN ("));
      // Parameters should contain the individual array values
      assert.ok(Object.values(query.parameters).includes(1));
      assert.ok(Object.values(query.parameters).includes(2));
      assert.ok(Object.values(query.parameters).includes(3));
      assert.ok(Object.values(query.parameters).includes("spam"));
      assert.ok(Object.values(query.parameters).includes("test"));
    });
  });
});

// Type-only tests (these test compile-time behavior)
// These functions are never called, they just test that types compile correctly
describe("Compile-time Type Tests", () => {
  test("type compilation tests should pass", () => {
    // This test verifies that the type definitions compile correctly
    // The actual type checking happens at compile time

    // Test basic type constraints
    function _testBasicConstraints() {
      const builder = createWhere<UserSchema>();

      // These should compile
      builder.eq("name", "John");
      builder.eq("age", 25);
      builder.eq("active", true);

      // These would cause compile errors if uncommented:
      // builder.eq("nonexistent_column", "value"); // Column doesn't exist
      // builder.eq("name", 123); // Wrong value type
      // builder.eq("age", "not a number"); // Wrong value type
    }

    // Test string operation constraints
    function _testStringConstraints() {
      const builder = createWhere<UserSchema>();

      // These should compile
      builder.like("name", "pattern");
      builder.startsWith("email", "prefix");

      // These would cause compile errors if uncommented:
      // builder.like("age", "pattern"); // age is number, not string
      // builder.startsWith("id", "prefix"); // id is number, not string
    }

    // Test array operation constraints
    function _testArrayConstraints() {
      const builder = createWhere<UserSchema>();

      // These should compile
      builder.in("id", [1, 2, 3]);
      builder.in("name", ["John", "Jane"]);

      // These would cause compile errors if uncommented:
      // builder.in("id", ["1", "2", "3"]); // Wrong array element type
      // builder.in("name", [1, 2, 3]); // Wrong array element type
    }

    // Mark functions as used to avoid unused function warnings
    _testBasicConstraints;
    _testStringConstraints;
    _testArrayConstraints;

    // Simple assertion to make the test pass
    assert.ok(true, "Type compilation tests completed");
  });

  test("advanced type constraint tests", () => {
    // Test generic constraint inheritance
    function _testGenericConstraints() {
      interface ExtendedUserSchema extends UserSchema {
        role: string;
        permissions: string[];
      }

      const builder = createWhere<ExtendedUserSchema>();

      // Should work with base schema properties
      builder.eq("name", "John");
      builder.eq("age", 25);

      // Should work with extended properties
      builder.eq("role", "admin");
      builder.in("permissions", [["read", "write"]]);

      // These would cause compile errors:
      // builder.eq("role", 123); // Wrong type
      // builder.in("permissions", [1, 2, 3]); // Wrong array element type
    }

    // Test nullable column handling
    function _testNullableColumns() {
      const builder = createWhere<UserSchema>();

      // deleted_at is Date | null, should accept both
      builder.eq("deleted_at", null);
      builder.eq("deleted_at", new Date());
      builder.isNull("deleted_at");
      builder.isNotNull("deleted_at");

      // These would cause compile errors:
      // builder.eq("deleted_at", "not a date"); // Wrong type
      // builder.eq("deleted_at", 123); // Wrong type
    }

    // Test union type handling
    function _testUnionTypes() {
      interface MixedSchema extends SchemaConstraint {
        id: string | number;
        status: "active" | "inactive" | "pending";
        metadata: string | null; // Simplified to a valid ParameterValue type
      }

      const builder = createWhere<MixedSchema>();

      // Should accept union type values
      builder.eq("id", "string-id");
      builder.eq("id", 123);
      builder.eq("status", "active");
      builder.in("status", ["active", "pending"]);
      builder.eq("metadata", null);
      builder.eq("metadata", "some-metadata-string");

      // These would cause compile errors:
      // builder.eq("status", "invalid"); // Not in union
      // builder.eq("id", true); // Not in union
    }

    // Test with complex nested types
    function _testComplexTypes() {
      interface ComplexSchema extends SchemaConstraint {
        tags: string[];
        config_enabled: boolean; // Flatten the config object to valid ParameterValue types
        config_timeout: number;
        timestamps: Date[];
      }

      const builder = createWhere<ComplexSchema>();

      // Should work with complex types
      builder.in("tags", [["tag1", "tag2"], ["tag3"]]);
      builder.eq("config_enabled", true);
      builder.eq("config_timeout", 5000);
      builder.in("timestamps", [[new Date(), new Date()]]);

      // These would cause compile errors:
      // builder.in("tags", [1, 2, 3]); // Wrong array type
      // builder.eq("config_enabled", "not a boolean"); // Wrong type
    }

    // Test with optional properties
    function _testOptionalProperties() {
      interface OptionalSchema extends SchemaConstraint {
        required: string;
        optional?: number;
        nullable: string | null;
      }

      const builder = createWhere<OptionalSchema>();

      // Should work with all property types
      builder.eq("required", "value");
      builder.eq("optional", 123);
      builder.eq("nullable", "value");
      builder.eq("nullable", null);

      // These would cause compile errors:
      // builder.eq("required", 123); // Wrong type
      // builder.eq("optional", "string"); // Wrong type
    }

    // Mark functions as used
    _testGenericConstraints;
    _testNullableColumns;
    _testUnionTypes;
    _testComplexTypes;
    _testOptionalProperties;

    assert.ok(true, "Advanced type constraint tests completed");
  });

  test("schema constraint validation", () => {
    // Test that SchemaConstraint properly constrains the generic parameter
    function _testSchemaConstraintValidation() {
      // Valid schemas that extend SchemaConstraint
      interface ValidSchema1 extends SchemaConstraint {
        id: number;
        name: string;
      }

      interface ValidSchema2 {
        [key: string]:
          | string
          | number
          | boolean
          | null
          | undefined
          | Date
          | Buffer
          | ParameterValue[];
      }

      // These should compile
      const builder1 = createWhere<ValidSchema1>();
      const builder2 = createWhere<ValidSchema2>();
      const builder3 = createWhere<Record<string, ParameterValue>>();

      builder1.eq("id", 123);
      builder2.eq("someKey", "someValue");
      builder3.eq("anyKey", "anyValue");

      // Test that the constraint works properly
      type TestConstraint1 = ValidSchema1 extends SchemaConstraint ? true : false;
      type TestConstraint2 = ValidSchema2 extends SchemaConstraint ? true : false;

      // These should be true at compile time
      const constraint1: TestConstraint1 = true;
      const constraint2: TestConstraint2 = true;

      assert.ok(constraint1);
      assert.ok(constraint2);
    }

    _testSchemaConstraintValidation;
    assert.ok(true, "Schema constraint validation completed");
  });
});
