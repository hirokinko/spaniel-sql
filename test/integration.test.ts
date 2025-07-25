/**
 * Integration tests with typed schemas
 * These tests verify the complete functionality with real-world schema examples
 */

import assert from "node:assert";
import { describe, test } from "node:test";
import { createWhere, type SchemaConstraint } from "../src/index.js";

// Real-world schema examples for integration testing
interface UserSchema extends SchemaConstraint {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  age: number;
  is_active: boolean;
  role: string;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  profile_picture: Buffer | null;
  preferences: string[]; // JSON array stored as array parameter
}

interface ProductSchema extends SchemaConstraint {
  product_id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  tags: string[];
  in_stock: boolean;
  stock_count: number;
  created_date: Date;
  last_updated: Date;
  discontinued_date: Date | null;
}

interface OrderSchema extends SchemaConstraint {
  order_id: string;
  user_id: number;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  status: string;
  order_date: Date;
  shipped_date: Date | null;
  tracking_number: string | null;
}

describe("Integration Tests with Typed Schemas", () => {
  describe("User Management Queries", () => {
    test("should build complex user search query", () => {
      const query = createWhere<UserSchema>()
        .eq("is_active", true)
        .and(
          (b) =>
            b.or(
              (ob) => ob.like("username", "admin%"),
              (ob) => ob.like("email", "%@company.com")
            ),
          (b) => b.gt("age", 18),
          (b) => b.in("role", ["admin", "moderator", "user"])
        )
        .isNull("deleted_at")
        .build();

      // Verify SQL structure
      assert.ok(query.sql.includes("is_active = @param"));
      assert.ok(query.sql.includes("username LIKE @param"));
      assert.ok(query.sql.includes("email LIKE @param"));
      assert.ok(query.sql.includes("age > @param"));
      assert.ok(query.sql.includes("role IN ("));
      assert.ok(query.sql.includes("deleted_at IS NULL"));
      assert.ok(query.sql.includes("AND"));
      assert.ok(query.sql.includes("OR"));

      // Verify parameters
      assert.ok(Object.values(query.parameters).includes(true));
      assert.ok(Object.values(query.parameters).includes("admin%"));
      assert.ok(Object.values(query.parameters).includes("%@company.com"));
      assert.ok(Object.values(query.parameters).includes(18));
      assert.ok(Object.values(query.parameters).includes("admin"));
      assert.ok(Object.values(query.parameters).includes("moderator"));
      assert.ok(Object.values(query.parameters).includes("user"));

      // Verify parameter count (should reuse parameters where possible)
      const paramCount = Object.keys(query.parameters).length;
      assert.ok(paramCount >= 6); // At least 6 unique parameters
    });

    test("should build user profile update conditions", () => {
      const query = createWhere<UserSchema>()
        .eq("id", 12345)
        .eq("is_active", true)
        .isNotNull("email")
        .build();

      assert.strictEqual(query.sql, "(id = @param1 AND is_active = @param2 AND email IS NOT NULL)");
      assert.deepStrictEqual(query.parameters, {
        param1: 12345,
        param2: true,
      });
    });

    test("should handle user search with date ranges", () => {
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-12-31");

      const query = createWhere<UserSchema>()
        .ge("created_at", startDate)
        .le("created_at", endDate)
        .eq("is_active", true)
        .build();

      assert.ok(query.sql.includes("created_at >= @param"));
      assert.ok(query.sql.includes("created_at <= @param"));
      assert.ok(query.sql.includes("is_active = @param"));
      assert.ok(Object.values(query.parameters).includes(startDate));
      assert.ok(Object.values(query.parameters).includes(endDate));
      assert.ok(Object.values(query.parameters).includes(true));
    });

    test("should build user deletion query with soft delete check", () => {
      const query = createWhere<UserSchema>()
        .eq("username", "user_to_delete")
        .isNull("deleted_at")
        .eq("is_active", true)
        .build();

      assert.ok(query.sql.includes("username = @param"));
      assert.ok(query.sql.includes("deleted_at IS NULL"));
      assert.ok(query.sql.includes("is_active = @param"));
      assert.ok(Object.values(query.parameters).includes("user_to_delete"));
      assert.ok(Object.values(query.parameters).includes(true));
    });
  });

  describe("Product Catalog Queries", () => {
    test("should build product search with filters", () => {
      const query = createWhere<ProductSchema>()
        .eq("in_stock", true)
        .gt("stock_count", 0)
        .and(
          (b) =>
            b.or(
              (ob) => ob.like("name", "%laptop%"),
              (ob) => ob.like("description", "%computer%")
            ),
          (b) => b.in("category", ["electronics", "computers", "accessories"]),
          (b) => b.le("price", 2000.0)
        )
        .isNull("discontinued_date")
        .build();

      // Verify complex query structure
      assert.ok(query.sql.includes("in_stock = @param"));
      assert.ok(query.sql.includes("stock_count > @param"));
      assert.ok(query.sql.includes("name LIKE @param"));
      assert.ok(query.sql.includes("description LIKE @param"));
      assert.ok(query.sql.includes("category IN ("));
      assert.ok(query.sql.includes("price <= @param"));
      assert.ok(query.sql.includes("discontinued_date IS NULL"));

      // Verify parameters
      assert.ok(Object.values(query.parameters).includes(true));
      assert.ok(Object.values(query.parameters).includes(0));
      assert.ok(Object.values(query.parameters).includes("%laptop%"));
      assert.ok(Object.values(query.parameters).includes("%computer%"));
      assert.ok(Object.values(query.parameters).includes("electronics"));
      assert.ok(Object.values(query.parameters).includes(2000.0));
    });

    test("should build product inventory query", () => {
      const query = createWhere<ProductSchema>()
        .eq("in_stock", false)
        .or(
          (b) => b.eq("stock_count", 0),
          (b) => b.lt("stock_count", 5)
        )
        .eq("category", "electronics")
        .build();

      assert.ok(query.sql.includes("in_stock = @param"));
      assert.ok(query.sql.includes("stock_count = @param"));
      assert.ok(query.sql.includes("stock_count < @param"));
      assert.ok(query.sql.includes("category = @param"));
      assert.ok(query.sql.includes("OR"));
    });

    test("should handle product tag search", () => {
      const query = createWhere<ProductSchema>()
        .in("tags", ["gaming", "laptop", "portable", "computer"])
        .eq("in_stock", true)
        .build();

      assert.ok(query.sql.includes("tags IN ("));
      assert.ok(query.sql.includes("in_stock = @param"));
      assert.ok(Object.values(query.parameters).includes(true));
    });
  });

  describe("Order Management Queries", () => {
    test("should build order status tracking query", () => {
      const query = createWhere<OrderSchema>()
        .eq("user_id", 12345)
        .in("status", ["pending", "processing", "shipped"])
        .ge("order_date", new Date("2024-01-01"))
        .isNotNull("tracking_number")
        .build();

      assert.ok(query.sql.includes("user_id = @param"));
      assert.ok(query.sql.includes("status IN ("));
      assert.ok(query.sql.includes("order_date >= @param"));
      assert.ok(query.sql.includes("tracking_number IS NOT NULL"));
      assert.ok(Object.values(query.parameters).includes(12345));
      assert.ok(Object.values(query.parameters).includes("pending"));
      assert.ok(Object.values(query.parameters).includes("processing"));
      assert.ok(Object.values(query.parameters).includes("shipped"));
    });

    test("should build order analytics query", () => {
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-03-31");

      const query = createWhere<OrderSchema>()
        .ge("order_date", startDate)
        .le("order_date", endDate)
        .gt("total_amount", 100.0)
        .eq("status", "completed")
        .and((b) =>
          b.or(
            (ob) => ob.in("product_id", ["PROD-001", "PROD-002", "PROD-003"]),
            (ob) => ob.gt("quantity", 5)
          )
        )
        .build();

      assert.ok(query.sql.includes("order_date >= @param"));
      assert.ok(query.sql.includes("order_date <= @param"));
      assert.ok(query.sql.includes("total_amount > @param"));
      assert.ok(query.sql.includes("status = @param"));
      assert.ok(query.sql.includes("product_id IN ("));
      assert.ok(query.sql.includes("quantity > @param"));
      assert.ok(Object.values(query.parameters).includes(startDate));
      assert.ok(Object.values(query.parameters).includes(endDate));
      assert.ok(Object.values(query.parameters).includes(100.0));
      assert.ok(Object.values(query.parameters).includes("completed"));
    });

    test("should build refund eligibility query", () => {
      const cutoffDate = new Date("2024-01-01");

      const query = createWhere<OrderSchema>()
        .eq("status", "completed")
        .ge("shipped_date", cutoffDate)
        .isNotNull("shipped_date")
        .gt("total_amount", 50.0)
        .build();

      assert.ok(query.sql.includes("status = @param"));
      assert.ok(query.sql.includes("shipped_date >= @param"));
      assert.ok(query.sql.includes("shipped_date IS NOT NULL"));
      assert.ok(query.sql.includes("total_amount > @param"));
      assert.ok(Object.values(query.parameters).includes("completed"));
      assert.ok(Object.values(query.parameters).includes(cutoffDate));
      assert.ok(Object.values(query.parameters).includes(50.0));
    });
  });

  describe("Cross-Schema Integration", () => {
    test("should handle multiple schema types in same application", () => {
      // User query
      const userQuery = createWhere<UserSchema>().eq("is_active", true).gt("age", 18).build();

      // Product query
      const productQuery = createWhere<ProductSchema>().eq("in_stock", true).gt("price", 0).build();

      // Order query
      const orderQuery = createWhere<OrderSchema>()
        .eq("status", "pending")
        .gt("total_amount", 0)
        .build();

      // All queries should be independent and type-safe
      assert.ok(userQuery.sql.includes("is_active"));
      assert.ok(userQuery.sql.includes("age"));
      assert.ok(productQuery.sql.includes("in_stock"));
      assert.ok(productQuery.sql.includes("price"));
      assert.ok(orderQuery.sql.includes("status"));
      assert.ok(orderQuery.sql.includes("total_amount"));

      // Parameters should be isolated
      assert.ok(Object.values(userQuery.parameters).includes(true));
      assert.ok(Object.values(userQuery.parameters).includes(18));
      assert.ok(Object.values(productQuery.parameters).includes(true));
      assert.ok(Object.values(orderQuery.parameters).includes("pending"));
    });

    test("should handle schema evolution scenarios", () => {
      // Extended user schema with additional fields
      interface ExtendedUserSchema extends UserSchema {
        subscription_tier: string;
        last_login: Date | null;
        preferences_v2: string[];
      }

      const query = createWhere<ExtendedUserSchema>()
        .eq("is_active", true)
        .eq("subscription_tier", "premium")
        .isNotNull("last_login")
        .in("preferences_v2", ["dark_mode", "notifications", "compact_view"])
        .build();

      assert.ok(query.sql.includes("is_active = @param"));
      assert.ok(query.sql.includes("subscription_tier = @param"));
      assert.ok(query.sql.includes("last_login IS NOT NULL"));
      assert.ok(query.sql.includes("preferences_v2 IN ("));
      assert.ok(Object.values(query.parameters).includes(true));
      assert.ok(Object.values(query.parameters).includes("premium"));
    });
  });

  describe("Performance and Edge Cases", () => {
    test("should handle large parameter sets efficiently", () => {
      const largeIdList = Array.from({ length: 100 }, (_, i) => i + 1);

      const query = createWhere<UserSchema>().in("id", largeIdList).eq("is_active", true).build();

      assert.ok(query.sql.includes("id IN ("));
      assert.ok(query.sql.includes("is_active = @param"));

      // Should have 100 ID parameters plus 1 for is_active
      const paramCount = Object.keys(query.parameters).length;
      assert.strictEqual(paramCount, 101);

      // Verify all IDs are in parameters
      largeIdList.forEach((id) => {
        assert.ok(Object.values(query.parameters).includes(id));
      });
    });

    test("should handle parameter reuse across complex queries", () => {
      const commonValue = "common_value";
      const commonDate = new Date("2024-01-01");

      const query = createWhere<UserSchema>()
        .eq("username", commonValue)
        .eq("email", commonValue) // Same value, should reuse parameter
        .eq("created_at", commonDate)
        .eq("updated_at", commonDate) // Same date, should reuse parameter
        .build();

      // Should reuse parameters for identical values
      const paramCount = Object.keys(query.parameters).length;
      assert.strictEqual(paramCount, 2); // Only 2 unique parameters

      assert.ok(Object.values(query.parameters).includes(commonValue));
      assert.ok(Object.values(query.parameters).includes(commonDate));
    });

    test("should handle empty arrays gracefully", () => {
      const query = createWhere<UserSchema>()
        .in("role", []) // Empty array
        .eq("is_active", true)
        .build();

      // Empty IN should generate FALSE
      assert.ok(query.sql.includes("FALSE"));
      assert.ok(query.sql.includes("is_active = @param"));
      assert.ok(Object.values(query.parameters).includes(true));
    });

    test("should handle null values in various contexts", () => {
      const query = createWhere<UserSchema>()
        .eq("deleted_at", null) // Should become IS NULL
        .ne("profile_picture", null) // Should become IS NOT NULL
        .isNull("updated_at") // Explicit null check
        .isNotNull("created_at") // Explicit not null check
        .build();

      assert.ok(query.sql.includes("deleted_at IS NULL"));
      assert.ok(query.sql.includes("profile_picture IS NOT NULL"));
      assert.ok(query.sql.includes("updated_at IS NULL"));
      assert.ok(query.sql.includes("created_at IS NOT NULL"));

      // Should not have parameters for null comparisons that become IS NULL/IS NOT NULL
      const hasNullParams = Object.values(query.parameters).some((v) => v === null);
      assert.ok(!hasNullParams);
    });
  });

  describe("Real-world Query Patterns", () => {
    test("should build pagination-ready queries", () => {
      const lastUserId = 1000;
      const pageSize = 20;

      const query = createWhere<UserSchema>()
        .gt("id", lastUserId)
        .eq("is_active", true)
        .isNull("deleted_at")
        .build();

      // This would typically be used with ORDER BY id LIMIT pageSize
      assert.ok(query.sql.includes("id > @param"));
      assert.ok(query.sql.includes("is_active = @param"));
      assert.ok(query.sql.includes("deleted_at IS NULL"));
      assert.ok(Object.values(query.parameters).includes(lastUserId));
      assert.ok(Object.values(query.parameters).includes(true));

      // Verify pageSize is available for use in LIMIT clause
      assert.strictEqual(pageSize, 20);
    });

    test("should build audit trail queries", () => {
      const auditStartDate = new Date("2024-01-01");
      const auditEndDate = new Date("2024-01-31");

      const query = createWhere<UserSchema>()
        .ge("updated_at", auditStartDate)
        .le("updated_at", auditEndDate)
        .or(
          (b) => b.isNotNull("deleted_at"),
          (b) => b.ne("is_active", true)
        )
        .build();

      assert.ok(query.sql.includes("updated_at >= @param"));
      assert.ok(query.sql.includes("updated_at <= @param"));
      assert.ok(query.sql.includes("deleted_at IS NOT NULL"));
      assert.ok(query.sql.includes("is_active != @param"));
      assert.ok(query.sql.includes("OR"));
      assert.ok(Object.values(query.parameters).includes(auditStartDate));
      assert.ok(Object.values(query.parameters).includes(auditEndDate));
    });

    test("should build search and filter combination", () => {
      const searchTerm = "john";
      const minAge = 21;
      const allowedRoles = ["user", "premium", "admin"];

      const query = createWhere<UserSchema>()
        .and(
          (b) =>
            b.or(
              (ob) => ob.like("username", `%${searchTerm}%`),
              (ob) => ob.like("first_name", `%${searchTerm}%`),
              (ob) => ob.like("last_name", `%${searchTerm}%`),
              (ob) => ob.like("email", `%${searchTerm}%`)
            ),
          (b) => b.ge("age", minAge),
          (b) => b.in("role", allowedRoles),
          (b) => b.eq("is_active", true)
        )
        .isNull("deleted_at")
        .build();

      // Verify search patterns
      assert.ok(query.sql.includes("username LIKE @param"));
      assert.ok(query.sql.includes("first_name LIKE @param"));
      assert.ok(query.sql.includes("last_name LIKE @param"));
      assert.ok(query.sql.includes("email LIKE @param"));
      assert.ok(query.sql.includes("age >= @param"));
      assert.ok(query.sql.includes("role IN ("));
      assert.ok(query.sql.includes("is_active = @param"));
      assert.ok(query.sql.includes("deleted_at IS NULL"));

      // Verify parameters
      assert.ok(Object.values(query.parameters).includes(`%${searchTerm}%`));
      assert.ok(Object.values(query.parameters).includes(minAge));
      assert.ok(Object.values(query.parameters).includes("user"));
      assert.ok(Object.values(query.parameters).includes("premium"));
      assert.ok(Object.values(query.parameters).includes("admin"));
      assert.ok(Object.values(query.parameters).includes(true));
    });
  });

  describe("Complex Query Scenarios - Task 10.1", () => {
    test("should handle deeply nested logical operations with proper parentheses", () => {
      // Complex nested query: ((A OR B) AND (C OR D)) OR ((E AND F) OR (G AND H))
      const query = createWhere<UserSchema>()
        .or(
          (b) =>
            b.and(
              (ab) =>
                ab.or(
                  (ob) => ob.eq("role", "admin"),
                  (ob) => ob.eq("role", "moderator")
                ),
              (ab) =>
                ab.or(
                  (ob) => ob.gt("age", 25),
                  (ob) => ob.like("email", "%@company.com")
                )
            ),
          (b) =>
            b.or(
              (ob) =>
                ob.and(
                  (ab) => ab.eq("is_active", true),
                  (ab) => ab.isNotNull("last_login")
                ),
              (ob) =>
                ob.and(
                  (ab) => ab.in("department", ["engineering", "product"]),
                  (ab) => ab.ge("created_at", new Date("2024-01-01"))
                )
            )
        )
        .build();

      // Verify proper parentheses nesting
      assert.ok(query.sql.includes("(("));
      assert.ok(query.sql.includes("))"));
      assert.ok(query.sql.includes("AND"));
      assert.ok(query.sql.includes("OR"));

      // Verify all conditions are present
      assert.ok(query.sql.includes("role = @param"));
      assert.ok(query.sql.includes("age > @param"));
      assert.ok(query.sql.includes("email LIKE @param"));
      assert.ok(query.sql.includes("is_active = @param"));
      assert.ok(query.sql.includes("last_login IS NOT NULL"));
      assert.ok(query.sql.includes("department IN ("));
      assert.ok(query.sql.includes("created_at >= @param"));

      // Verify parameters
      assert.ok(Object.values(query.parameters).includes("admin"));
      assert.ok(Object.values(query.parameters).includes("moderator"));
      assert.ok(Object.values(query.parameters).includes(25));
      assert.ok(Object.values(query.parameters).includes("%@company.com"));
      assert.ok(Object.values(query.parameters).includes(true));
      assert.ok(Object.values(query.parameters).includes("engineering"));
      assert.ok(Object.values(query.parameters).includes("product"));
    });

    test("should combine multiple operators with complex conditions", () => {
      // Test all operator types in a single complex query
      const query = createWhere<ProductSchema>()
        .and(
          // Basic comparisons
          (b) => b.gt("price", 100.0).le("price", 1000.0),
          // Array operations
          (b) => b.in("category", ["electronics", "computers", "accessories"]),
          // String patterns
          (b) =>
            b.or(
              (ob) => ob.like("name", "%laptop%"),
              (ob) => ob.startsWith("description", "Premium"),
              (ob) => ob.endsWith("name", "Pro")
            ),
          // Null checks
          (b) => b.isNull("discontinued_date").isNotNull("created_date"),
          // Nested logical operations
          (b) =>
            b.or(
              (ob) => ob.eq("in_stock", true).gt("stock_count", 5),
              (ob) => ob.eq("in_stock", false).eq("stock_count", 0)
            )
        )
        .build();

      // Verify all operator types are present
      assert.ok(query.sql.includes("price > @param"));
      assert.ok(query.sql.includes("price <= @param"));
      assert.ok(query.sql.includes("category IN ("));
      assert.ok(query.sql.includes("name LIKE @param"));
      assert.ok(query.sql.includes("STARTS_WITH(description, @param"));
      assert.ok(query.sql.includes("ENDS_WITH(name, @param"));
      assert.ok(query.sql.includes("discontinued_date IS NULL"));
      assert.ok(query.sql.includes("created_date IS NOT NULL"));
      assert.ok(query.sql.includes("in_stock = @param"));
      assert.ok(query.sql.includes("stock_count > @param"));
      assert.ok(query.sql.includes("stock_count = @param"));

      // Verify parameters
      assert.ok(Object.values(query.parameters).includes(100.0));
      assert.ok(Object.values(query.parameters).includes(1000.0));
      assert.ok(Object.values(query.parameters).includes("electronics"));
      assert.ok(Object.values(query.parameters).includes("%laptop%"));
      assert.ok(Object.values(query.parameters).includes("Premium"));
      assert.ok(Object.values(query.parameters).includes("Pro"));
      assert.ok(Object.values(query.parameters).includes(true));
      assert.ok(Object.values(query.parameters).includes(false));
      assert.ok(Object.values(query.parameters).includes(5));
      assert.ok(Object.values(query.parameters).includes(0));
    });

    test("should demonstrate extensive parameter reuse across complex queries", () => {
      const commonDate = new Date("2024-01-01");
      const commonStatus = "active";
      const commonId = 12345;

      const query = createWhere<OrderSchema>()
        .and(
          // Reuse commonDate multiple times
          (b) =>
            b
              .ge("order_date", commonDate)
              .ge("shipped_date", commonDate)
              .le("order_date", commonDate),
          // Reuse commonStatus multiple times
          (b) =>
            b.or(
              (ob) => ob.eq("status", commonStatus),
              (ob) => ob.ne("status", commonStatus)
            ),
          // Reuse commonId multiple times
          (b) => b.eq("user_id", commonId).ne("user_id", commonId).gt("user_id", commonId)
        )
        .build();

      // Count unique parameters - should be minimal due to reuse
      const paramCount = Object.keys(query.parameters).length;
      assert.strictEqual(paramCount, 3); // Only 3 unique values

      // Verify all values are present
      assert.ok(Object.values(query.parameters).includes(commonDate));
      assert.ok(Object.values(query.parameters).includes(commonStatus));
      assert.ok(Object.values(query.parameters).includes(commonId));

      // Verify SQL contains multiple references to same parameters
      const sqlParamMatches = query.sql.match(/@param\d+/g);
      assert.ok(sqlParamMatches && sqlParamMatches.length > 3); // More parameter references than unique parameters
    });

    test("should generate valid Cloud Spanner SQL syntax for complex scenarios", () => {
      const query = createWhere<UserSchema>()
        .and(
          // Test Cloud Spanner specific functions
          (b) => b.startsWith("username", "admin_").endsWith("email", "@company.com"),
          // Test proper NULL handling
          (b) =>
            b
              .eq("deleted_at", null) // Should become IS NULL
              .ne("profile_picture", null), // Should become IS NOT NULL
          // Test array operations with proper syntax
          (b) => b.in("role", ["admin", "user", "guest"]),
          // Test LIKE patterns
          (b) =>
            b.or(
              (ob) => ob.like("first_name", "John%"),
              (ob) => ob.notLike("last_name", "%test%")
            )
        )
        .build();

      // Verify Cloud Spanner specific syntax
      assert.ok(query.sql.includes("STARTS_WITH(username, @param"));
      assert.ok(query.sql.includes("ENDS_WITH(email, @param"));
      assert.ok(query.sql.includes("deleted_at IS NULL"));
      assert.ok(query.sql.includes("profile_picture IS NOT NULL"));
      assert.ok(query.sql.includes("role IN (@param"));
      assert.ok(query.sql.includes("first_name LIKE @param"));
      assert.ok(query.sql.includes("last_name NOT LIKE @param"));

      // Verify no null parameters for IS NULL/IS NOT NULL operations
      const hasNullParams = Object.values(query.parameters).some((v) => v === null);
      assert.strictEqual(hasNullParams, false);

      // Verify proper parameter naming convention
      const paramNames = Object.keys(query.parameters);
      paramNames.forEach((name) => {
        assert.ok(/^param\d+$/.test(name)); // Should match param1, param2, etc.
      });
    });

    test("should handle mixed data types with proper Cloud Spanner formatting", () => {
      const testDate = new Date("2024-06-15T10:30:00Z");
      const testBuffer = Buffer.from("test_image_data");

      const query = createWhere<UserSchema>()
        .and(
          // String operations
          (b) => b.eq("username", "test_user").like("email", "%@test.com"),
          // Numeric operations
          (b) => b.gt("age", 21).le("id", 99999),
          // Boolean operations
          (b) => b.eq("is_active", true),
          // Date operations
          (b) => b.ge("created_at", testDate).isNotNull("updated_at"),
          // Buffer/Bytes operations
          (b) => b.eq("profile_picture", testBuffer),
          // Array operations
          (b) => b.in("preferences", ["theme_dark", "notifications_on"])
        )
        .build();

      // Verify all data types are handled
      assert.ok(Object.values(query.parameters).includes("test_user"));
      assert.ok(Object.values(query.parameters).includes("%@test.com"));
      assert.ok(Object.values(query.parameters).includes(21));
      assert.ok(Object.values(query.parameters).includes(99999));
      assert.ok(Object.values(query.parameters).includes(true));
      assert.ok(Object.values(query.parameters).includes(testDate));
      assert.ok(Object.values(query.parameters).includes(testBuffer));

      // Verify SQL structure
      assert.ok(query.sql.includes("username = @param"));
      assert.ok(query.sql.includes("email LIKE @param"));
      assert.ok(query.sql.includes("age > @param"));
      assert.ok(query.sql.includes("id <= @param"));
      assert.ok(query.sql.includes("is_active = @param"));
      assert.ok(query.sql.includes("created_at >= @param"));
      assert.ok(query.sql.includes("updated_at IS NOT NULL"));
      assert.ok(query.sql.includes("profile_picture = @param"));
      assert.ok(query.sql.includes("preferences IN ("));
    });

    test("should handle extreme nesting levels with correct parentheses", () => {
      // Test deep nesting with proper AND/OR structure
      const query = createWhere<ProductSchema>()
        .and(
          // First complex branch: category AND (price OR stock)
          (b) =>
            b.eq("category", "electronics").and((ab) =>
              ab.or(
                (ob) => ob.lt("price", 500),
                (ob) => ob.gt("stock_count", 10)
              )
            ),
          // Second complex branch: name AND (date OR status)
          (b) =>
            b.like("name", "%premium%").and((ab) =>
              ab.or(
                (ob) => ob.ge("created_date", new Date("2024-01-01")),
                (ob) => ob.eq("in_stock", true)
              )
            ),
          // Third branch: simple condition
          (b) => b.isNull("discontinued_date")
        )
        .build();

      // Count parentheses to verify proper nesting
      const openParens = (query.sql.match(/\(/g) || []).length;
      const closeParens = (query.sql.match(/\)/g) || []).length;
      assert.strictEqual(openParens, closeParens); // Balanced parentheses

      // Verify deep nesting structure exists
      assert.ok(openParens >= 3); // Should have multiple levels of nesting

      // Verify all conditions are present
      assert.ok(query.sql.includes("category = @param"));
      assert.ok(query.sql.includes("price < @param"));
      assert.ok(query.sql.includes("stock_count > @param"));
      assert.ok(query.sql.includes("name LIKE @param"));
      assert.ok(query.sql.includes("created_date >= @param"));
      assert.ok(query.sql.includes("in_stock = @param"));
      assert.ok(query.sql.includes("discontinued_date IS NULL"));

      // Verify logical operators are properly placed
      assert.ok(query.sql.includes("OR"));
      assert.ok(query.sql.includes("AND"));

      // Verify parameters
      assert.ok(Object.values(query.parameters).includes("electronics"));
      assert.ok(Object.values(query.parameters).includes(500));
      assert.ok(Object.values(query.parameters).includes(10));
      assert.ok(Object.values(query.parameters).includes("%premium%"));
      assert.ok(Object.values(query.parameters).includes(true));
    });

    test("should handle edge cases in complex scenarios", () => {
      const query = createWhere<UserSchema>()
        .and(
          // Empty array handling
          (b) => b.notIn("role", []), // Should generate NOT FALSE = TRUE
          // Multiple null checks
          (b) => b.isNull("deleted_at").isNotNull("created_at").eq("profile_picture", null), // Should become IS NULL
          // String pattern edge cases
          (b) =>
            b.or(
              (ob) => ob.like("username", ""), // Empty pattern
              (ob) => ob.startsWith("email", "a"), // Single character
              (ob) => ob.endsWith("first_name", "z") // Single character
            ),
          // Numeric edge cases
          (b) => b.eq("age", 0).ne("id", -1)
        )
        .build();

      // Verify empty array handling
      assert.ok(query.sql.includes("NOT FALSE") || query.sql.includes("TRUE"));

      // Verify null handling
      assert.ok(query.sql.includes("deleted_at IS NULL"));
      assert.ok(query.sql.includes("created_at IS NOT NULL"));
      assert.ok(query.sql.includes("profile_picture IS NULL"));

      // Verify string patterns
      assert.ok(query.sql.includes("username LIKE @param"));
      assert.ok(query.sql.includes("STARTS_WITH(email, @param"));
      assert.ok(query.sql.includes("ENDS_WITH(first_name, @param"));

      // Verify numeric edge cases
      assert.ok(query.sql.includes("age = @param"));
      assert.ok(query.sql.includes("id != @param"));
      assert.ok(Object.values(query.parameters).includes(0));
      assert.ok(Object.values(query.parameters).includes(-1));
    });

    test("should maintain parameter consistency across query rebuilds", () => {
      // Build the same logical query multiple times to ensure consistency
      const buildQuery = () =>
        createWhere<UserSchema>()
          .eq("username", "test_user")
          .gt("age", 25)
          .in("role", ["admin", "user"])
          .isNull("deleted_at")
          .build();

      const query1 = buildQuery();
      const query2 = buildQuery();
      const query3 = buildQuery();

      // All queries should generate identical SQL and parameters
      assert.strictEqual(query1.sql, query2.sql);
      assert.strictEqual(query2.sql, query3.sql);
      assert.deepStrictEqual(query1.parameters, query2.parameters);
      assert.deepStrictEqual(query2.parameters, query3.parameters);

      // Verify parameter naming is consistent
      const paramNames1 = Object.keys(query1.parameters).sort();
      const paramNames2 = Object.keys(query2.parameters).sort();
      const paramNames3 = Object.keys(query3.parameters).sort();

      assert.deepStrictEqual(paramNames1, paramNames2);
      assert.deepStrictEqual(paramNames2, paramNames3);
    });
  });
});
