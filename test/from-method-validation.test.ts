/**
 * Tests for FROM method validation integration
 */

import assert from "node:assert";
import { describe, it } from "node:test";
import type { SchemaConstraint } from "../src/core-types.js";
import { createSelect } from "../src/select-builder.js";

// Test schema
interface User extends SchemaConstraint {
  id: number;
  name: string;
  email: string;
  active: boolean;
}

describe("FROM Method Validation Integration", () => {
  describe("Valid table names", () => {
    it("should accept valid table names", () => {
      const validNames = [
        "users",
        "user_profiles",
        "UserProfiles",
        "_internal_table",
        "table123"
      ];

      for (const name of validNames) {
        const builder = createSelect<User>().from(name);
        assert.ok(builder);
        assert.ok(builder._query.from);
        assert.strictEqual(builder._query.from.name, name);
      }
    });

    it("should accept valid table names with schema", () => {
      const userSchema: User = {
        id: 0,
        name: "",
        email: "",
        active: false,
      };

      const builder = createSelect().from("users", userSchema);
      assert.ok(builder);
      assert.ok(builder._query.from);
      assert.strictEqual(builder._query.from.name, "users");
      assert.strictEqual(builder._query.from.schema, userSchema);
    });
  });

  describe("Invalid table names", () => {
    it("should throw error for empty table name", () => {
      assert.throws(() => {
        createSelect<User>().from("");
      }, /Table name cannot be empty/);
    });

    it("should throw error for table name starting with number", () => {
      assert.throws(() => {
        createSelect<User>().from("123table");
      }, /Table name must start with a letter or underscore/);
    });

    it("should throw error for table name with invalid characters", () => {
      assert.throws(() => {
        createSelect<User>().from("table-name");
      }, /Table name can only contain letters, numbers, and underscores/);

      assert.throws(() => {
        createSelect<User>().from("table.name");
      }, /Table name can only contain letters, numbers, and underscores/);

      assert.throws(() => {
        createSelect<User>().from("table name");
      }, /Table name can only contain letters, numbers, and underscores/);
    });

    it("should throw error for reserved keywords", () => {
      const reservedKeywords = ["SELECT", "FROM", "WHERE", "TABLE", "select", "from"];

      for (const keyword of reservedKeywords) {
        assert.throws(() => {
          createSelect<User>().from(keyword);
        }, /Table name cannot be a reserved keyword/);
      }
    });

    it("should throw error for table name that is too long", () => {
      const longName = "a".repeat(129); // 129 characters, exceeds 128 limit

      assert.throws(() => {
        createSelect<User>().from(longName);
      }, /Table name too long/);
    });
  });

  describe("Type transformation", () => {
    it("should transform schema type correctly", () => {
      const userSchema: User = {
        id: 0,
        name: "",
        email: "",
        active: false,
      };

      // Start with no schema, then add schema via from method
      const builder = createSelect().from("users", userSchema);

      // The builder should now have the User schema type
      assert.ok(builder._schema);
      assert.strictEqual(builder._schema, userSchema);
    });

    it("should maintain existing schema when no new schema provided", () => {
      const userSchema: User = {
        id: 0,
        name: "",
        email: "",
        active: false,
      };

      // Start with schema, then call from without new schema
      const builder = createSelect(userSchema).from("users");

      // The builder should maintain the original schema
      assert.ok(builder._schema);
      assert.strictEqual(builder._schema, userSchema);
    });

    it("should override schema when new schema provided", () => {
      interface Order extends SchemaConstraint {
        id: number;
        userId: number;
        amount: number;
      }

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
      };

      // Start with user schema, then override with order schema
      const builder = createSelect(userSchema).from("orders", orderSchema);

      // The builder should now have the Order schema type
      assert.ok(builder._schema);
      assert.strictEqual(builder._schema, orderSchema);
    });
  });

  describe("Parameter management integration", () => {
    it("should maintain parameter manager state", () => {
      const builder = createSelect<User>().from("users");

      // Parameter manager should be maintained
      assert.ok(builder._parameters);
      assert.strictEqual(typeof builder._parameters.counter, "number");
      assert.ok(typeof builder._parameters.parameters === "object");
    });

    it("should work with chained operations", () => {
      const builder = createSelect<User>()
        .from("users")
        .where(w => w.eq("active", true));

      // Should have parameters from WHERE clause
      assert.ok(builder._parameters);
      assert.ok(Object.keys(builder._parameters.parameters).length > 0);
    });
  });
});
