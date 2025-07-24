/**
 * Integration tests with typed schemas
 * These tests verify the complete functionality with real-world schema examples
 */

import assert from "node:assert";
import { describe, test } from "node:test";
import { createWhere, type SchemaConstraint } from "../src/types";

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
        .in("tags", [
          ["gaming", "laptop"],
          ["portable", "computer"],
        ])
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
        .in("preferences_v2", [["dark_mode", "notifications"], ["compact_view"]])
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
      const _pageSize = 20;

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
});
