/**
 * Tests for table reference types and utilities
 */

import assert from "node:assert";
import { describe, it } from "node:test";
import type { SchemaConstraint } from "../src/core-types.js";
import type { TableReference } from "../src/select-types.js";
import {
  createTableReference,
  formatTableReference,
  getEffectiveTableName,
  hasTableAlias,
  isSameTable,
  mergeTableSchemas,
  qualifyColumnName,
  validateTableAlias,
  validateTableName,
} from "../src/table-utils.js";

// Test schemas
interface User extends SchemaConstraint {
  id: number;
  name: string;
  email: string;
  active: boolean;
}

interface Order extends SchemaConstraint {
  id: number;
  userId: number;
  amount: number;
  createdAt: Date;
}

describe("Table Reference Types and Utilities", () => {
  describe("validateTableName", () => {
    it("should accept valid table names", () => {
      const validNames = [
        "users",
        "user_profiles",
        "UserProfiles",
        "_internal_table",
        "table123",
        "a",
        "A_Very_Long_Table_Name_That_Is_Still_Valid_123",
      ];

      for (const name of validNames) {
        const result = validateTableName(name);
        assert.ok(result.success, `Expected ${name} to be valid`);
        assert.strictEqual(result.data, name);
      }
    });

    it("should reject invalid table names", () => {
      const invalidCases = [
        { input: "", expectedError: "empty" },
        { input: "   ", expectedError: "empty" },
        { input: "123table", expectedError: "must start with letter or underscore" },
        {
          input: "table-name",
          expectedError: "can only contain letters, numbers, and underscores",
        },
        {
          input: "table.name",
          expectedError: "can only contain letters, numbers, and underscores",
        },
        {
          input: "table name",
          expectedError: "can only contain letters, numbers, and underscores",
        },
        {
          input: "table@name",
          expectedError: "can only contain letters, numbers, and underscores",
        },
      ];

      for (const testCase of invalidCases) {
        const result = validateTableName(testCase.input);
        assert.ok(!result.success, `Expected ${testCase.input} to be invalid`);
        assert.strictEqual(result.error.code, "INVALID_TABLE_NAME");
      }
    });

    it("should reject reserved keywords", () => {
      const reservedKeywords = [
        "SELECT",
        "FROM",
        "WHERE",
        "TABLE",
        "INDEX",
        "CREATE",
        "DROP",
        "select",
        "from",
        "where",
        "table", // case insensitive
      ];

      for (const keyword of reservedKeywords) {
        const result = validateTableName(keyword);
        assert.ok(!result.success, `Expected ${keyword} to be rejected as reserved`);
        assert.strictEqual(result.error.code, "INVALID_TABLE_NAME");
      }
    });

    it("should reject table names that are too long", () => {
      const longName = "a".repeat(129); // 129 characters, exceeds 128 limit
      const result = validateTableName(longName);

      assert.ok(!result.success);
      assert.strictEqual(result.error.code, "INVALID_TABLE_NAME");
      assert.ok(result.error.message.includes("too long"));
    });

    it("should reject non-string inputs", () => {
      const invalidInputs = [null, undefined, 123, {}, [], true];

      for (const input of invalidInputs) {
        const result = validateTableName(input);
        assert.ok(!result.success, `Expected ${input} to be rejected`);
        assert.strictEqual(result.error.code, "INVALID_TABLE_NAME");
      }
    });

    it("should trim whitespace from valid names", () => {
      const result = validateTableName("  users  ");
      assert.ok(result.success);
      assert.strictEqual(result.data, "users");
    });
  });

  describe("validateTableAlias", () => {
    it("should accept valid table aliases", () => {
      const validAliases = ["u", "usr", "user_alias", "UserAlias", "_alias", "alias123", "a"];

      for (const alias of validAliases) {
        const result = validateTableAlias(alias);
        assert.ok(result.success, `Expected ${alias} to be valid`);
        assert.strictEqual(result.data, alias);
      }
    });

    it("should reject invalid table aliases", () => {
      const invalidCases = [
        { input: "", expectedError: "empty" },
        { input: "   ", expectedError: "empty" },
        { input: "123alias", expectedError: "must start with letter or underscore" },
        {
          input: "alias-name",
          expectedError: "can only contain letters, numbers, and underscores",
        },
        {
          input: "alias.name",
          expectedError: "can only contain letters, numbers, and underscores",
        },
        {
          input: "alias name",
          expectedError: "can only contain letters, numbers, and underscores",
        },
      ];

      for (const testCase of invalidCases) {
        const result = validateTableAlias(testCase.input);
        assert.ok(!result.success, `Expected ${testCase.input} to be invalid`);
        assert.strictEqual(result.error.code, "INVALID_TABLE_ALIAS");
      }
    });

    it("should reject aliases that are too long", () => {
      const longAlias = "a".repeat(65); // 65 characters, exceeds 64 limit
      const result = validateTableAlias(longAlias);

      assert.ok(!result.success);
      assert.strictEqual(result.error.code, "INVALID_TABLE_ALIAS");
      assert.ok(result.error.message.includes("too long"));
    });

    it("should reject non-string inputs", () => {
      const invalidInputs = [null, undefined, 123, {}, [], true];

      for (const input of invalidInputs) {
        const result = validateTableAlias(input);
        assert.ok(!result.success, `Expected ${input} to be rejected`);
        assert.strictEqual(result.error.code, "INVALID_TABLE_ALIAS");
      }
    });

    it("should trim whitespace from valid aliases", () => {
      const result = validateTableAlias("  u  ");
      assert.ok(result.success);
      assert.strictEqual(result.data, "u");
    });
  });

  describe("createTableReference", () => {
    it("should create a basic table reference", () => {
      const result = createTableReference("users");

      assert.ok(result.success);
      assert.strictEqual(result.data.name, "users");
      assert.strictEqual(result.data.alias, undefined);
      assert.strictEqual(result.data.schema, undefined);
    });

    it("should create a table reference with alias", () => {
      const result = createTableReference("users", "u");

      assert.ok(result.success);
      assert.strictEqual(result.data.name, "users");
      assert.strictEqual(result.data.alias, "u");
      assert.strictEqual(result.data.schema, undefined);
    });

    it("should create a table reference with schema", () => {
      const userSchema: User = {
        id: 0,
        name: "",
        email: "",
        active: false,
      };

      const result = createTableReference("users", undefined, userSchema);

      assert.ok(result.success);
      assert.strictEqual(result.data.name, "users");
      assert.strictEqual(result.data.alias, undefined);
      assert.strictEqual(result.data.schema, userSchema);
    });

    it("should create a table reference with alias and schema", () => {
      const userSchema: User = {
        id: 0,
        name: "",
        email: "",
        active: false,
      };

      const result = createTableReference("users", "u", userSchema);

      assert.ok(result.success);
      assert.strictEqual(result.data.name, "users");
      assert.strictEqual(result.data.alias, "u");
      assert.strictEqual(result.data.schema, userSchema);
    });

    it("should fail with invalid table name", () => {
      const result = createTableReference("123invalid");

      assert.ok(!result.success);
      assert.strictEqual(result.error.code, "INVALID_TABLE_NAME");
    });

    it("should fail with invalid alias", () => {
      const result = createTableReference("users", "123invalid");

      assert.ok(!result.success);
      assert.strictEqual(result.error.code, "INVALID_TABLE_ALIAS");
    });
  });

  describe("hasTableAlias", () => {
    it("should return true for table reference with alias", () => {
      const tableRef: TableReference = {
        name: "users",
        alias: "u",
      };

      assert.ok(hasTableAlias(tableRef));
    });

    it("should return false for table reference without alias", () => {
      const tableRef: TableReference = {
        name: "users",
      };

      assert.ok(!hasTableAlias(tableRef));
    });

    it("should return false for table reference with empty alias", () => {
      const tableRef: TableReference = {
        name: "users",
        alias: "",
      };

      assert.ok(!hasTableAlias(tableRef));
    });

    it("should return false for table reference with whitespace-only alias", () => {
      const tableRef: TableReference = {
        name: "users",
        alias: "   ",
      };

      assert.ok(!hasTableAlias(tableRef));
    });
  });

  describe("getEffectiveTableName", () => {
    it("should return alias when present", () => {
      const tableRef: TableReference = {
        name: "users",
        alias: "u",
      };

      const effectiveName = getEffectiveTableName(tableRef);
      assert.strictEqual(effectiveName, "u");
    });

    it("should return table name when no alias", () => {
      const tableRef: TableReference = {
        name: "users",
      };

      const effectiveName = getEffectiveTableName(tableRef);
      assert.strictEqual(effectiveName, "users");
    });

    it("should return table name when alias is empty", () => {
      const tableRef: TableReference = {
        name: "users",
        alias: "",
      };

      const effectiveName = getEffectiveTableName(tableRef);
      assert.strictEqual(effectiveName, "users");
    });
  });

  describe("formatTableReference", () => {
    it("should format table reference without alias", () => {
      const tableRef: TableReference = {
        name: "users",
      };

      const formatted = formatTableReference(tableRef);
      assert.strictEqual(formatted, "users");
    });

    it("should format table reference with alias", () => {
      const tableRef: TableReference = {
        name: "users",
        alias: "u",
      };

      const formatted = formatTableReference(tableRef);
      assert.strictEqual(formatted, "users AS u");
    });

    it("should format table reference with empty alias as no alias", () => {
      const tableRef: TableReference = {
        name: "users",
        alias: "",
      };

      const formatted = formatTableReference(tableRef);
      assert.strictEqual(formatted, "users");
    });
  });

  describe("isSameTable", () => {
    it("should return true for same table names", () => {
      const tableRef1: TableReference = { name: "users" };
      const tableRef2: TableReference = { name: "users", alias: "u" };

      assert.ok(isSameTable(tableRef1, tableRef2));
    });

    it("should return false for different table names", () => {
      const tableRef1: TableReference = { name: "users" };
      const tableRef2: TableReference = { name: "orders" };

      assert.ok(!isSameTable(tableRef1, tableRef2));
    });

    it("should ignore aliases when comparing", () => {
      const tableRef1: TableReference = { name: "users", alias: "u1" };
      const tableRef2: TableReference = { name: "users", alias: "u2" };

      assert.ok(isSameTable(tableRef1, tableRef2));
    });

    it("should ignore schemas when comparing", () => {
      const userSchema: User = { id: 0, name: "", email: "", active: false };
      const orderSchema: Order = { id: 0, userId: 0, amount: 0, createdAt: new Date() };

      const tableRef1: TableReference = { name: "users", schema: userSchema };
      const tableRef2: TableReference = { name: "users", schema: orderSchema };

      assert.ok(isSameTable(tableRef1, tableRef2));
    });
  });

  describe("mergeTableSchemas", () => {
    it("should merge schemas from two table references", () => {
      const userSchema: User = {
        id: 0,
        name: "",
        email: "",
        active: false,
      };

      const orderSchema: Order = {
        id: 0,
        userId: 0,
        amount: 0,
        createdAt: new Date(),
      };

      const leftTable: TableReference & { schema: User } = {
        name: "users",
        alias: "u",
        schema: userSchema,
      };

      const rightTable: TableReference & { schema: Order } = {
        name: "orders",
        alias: "o",
        schema: orderSchema,
      };

      const merged = mergeTableSchemas(leftTable, rightTable);

      // Should have all properties from both schemas
      assert.ok("id" in merged);
      assert.ok("name" in merged);
      assert.ok("email" in merged);
      assert.ok("active" in merged);
      assert.ok("userId" in merged);
      assert.ok("amount" in merged);
      assert.ok("createdAt" in merged);
    });

    it("should handle overlapping column names (right takes precedence)", () => {
      const leftSchema = { id: 1, name: "left" };
      const rightSchema = { id: 2, value: "right" };

      const leftTable: TableReference & { schema: typeof leftSchema } = {
        name: "left_table",
        schema: leftSchema,
      };

      const rightTable: TableReference & { schema: typeof rightSchema } = {
        name: "right_table",
        schema: rightSchema,
      };

      const merged = mergeTableSchemas(leftTable, rightTable);

      // Right schema should take precedence for overlapping keys
      assert.strictEqual(merged.id, 2);
      assert.strictEqual(merged.name, "left");
      assert.strictEqual(merged.value, "right");
    });
  });

  describe("qualifyColumnName", () => {
    it("should qualify column with table name", () => {
      const tableRef: TableReference = {
        name: "users",
      };

      const qualified = qualifyColumnName(tableRef, "name");
      assert.strictEqual(qualified, "users.name");
    });

    it("should qualify column with table alias when present", () => {
      const tableRef: TableReference = {
        name: "users",
        alias: "u",
      };

      const qualified = qualifyColumnName(tableRef, "name");
      assert.strictEqual(qualified, "u.name");
    });

    it("should handle complex column names", () => {
      const tableRef: TableReference = {
        name: "user_profiles",
        alias: "up",
      };

      const qualified = qualifyColumnName(tableRef, "created_at");
      assert.strictEqual(qualified, "up.created_at");
    });
  });

  describe("Type Integration", () => {
    it("should work with typed schemas", () => {
      const userSchema: User = {
        id: 0,
        name: "",
        email: "",
        active: false,
      };

      const result = createTableReference("users", "u", userSchema);

      assert.ok(result.success);

      if (result.success) {
        // TypeScript should infer the correct schema type
        const tableRef = result.data;
        assert.strictEqual(tableRef.schema, userSchema);

        // Should be able to access schema properties with type safety
        if (tableRef.schema) {
          assert.ok("id" in tableRef.schema);
          assert.ok("name" in tableRef.schema);
          assert.ok("email" in tableRef.schema);
          assert.ok("active" in tableRef.schema);
        }
      }
    });

    it("should support schema constraint types", () => {
      // Test with generic SchemaConstraint
      const genericSchema: SchemaConstraint = {
        someColumn: "value",
        anotherColumn: 123,
      };

      const result = createTableReference("generic_table", undefined, genericSchema);

      assert.ok(result.success);
      assert.strictEqual(result.data.schema, genericSchema);
    });
  });
});
