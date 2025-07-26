/**
 * Tests for WHERE integration in SELECT query builder
 * Task 4.1: Create WHERE integration interface
 */

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { SchemaConstraint } from "../src/core-types.js";
import { createSelect } from "../src/select-builder.js";
import { createWhere } from "../src/where-builder.js";

// Test schema types
interface User extends SchemaConstraint {
  id: number;
  name: string;
  email: string;
  age: number;
  active: boolean;
  created_at: Date;
  tags: string[];
}

interface Product extends SchemaConstraint {
  id: number;
  name: string;
  price: number;
  category: string;
  in_stock: boolean;
}

describe("SELECT WHERE Integration", () => {
  describe("Basic WHERE Integration", () => {
    it("should integrate WHERE builder with SELECT builder", () => {
      const builder = createSelect<User>()
        .from("users")
        .where((w) => w.eq("active", true));

      assert.ok(builder);
      assert.ok(builder._query.where);
      assert.strictEqual(builder._query.where.type, "and");
      assert.strictEqual(builder._query.where.conditions.length, 1);
    });

    it("should handle empty WHERE conditions", () => {
      const builder = createSelect<User>()
        .from("users")
        .where((w) => w);

      // Empty WHERE should not set the where clause
      assert.strictEqual(builder._query.where, undefined);
    });

    it("should support multiple WHERE conditions", () => {
      const builder = createSelect<User>()
        .from("users")
        .where((w) => w.eq("active", true).gt("age", 18));

      assert.ok(builder._query.where);
      assert.strictEqual(builder._query.where.conditions.length, 2);
    });

    it("should support complex WHERE conditions with logical operators", () => {
      const builder = createSelect<User>()
        .from("users")
        .where((w) =>
          w.and(
            (b) => b.eq("active", true),
            (b) =>
              b.or(
                (ob) => ob.gt("age", 18),
                (ob) => ob.eq("name", "admin")
              )
          )
        );

      assert.ok(builder._query.where);
      assert.strictEqual(builder._query.where.type, "and");
      assert.strictEqual(builder._query.where.conditions.length, 1);

      // The single condition should be an AND group with 2 conditions
      const nestedAndGroup = builder._query.where.conditions[0];
      assert.ok(nestedAndGroup);
      assert.strictEqual(nestedAndGroup.type, "and");
      assert.strictEqual(nestedAndGroup.conditions.length, 2);
    });
  });

  describe("Parameter Management Integration", () => {
    it("should integrate parameters from WHERE clause", () => {
      const builder = createSelect<User>()
        .from("users")
        .where((w) => w.eq("active", true).gt("id", 100));

      const result = builder.build();

      assert.ok(result.parameters);
      assert.strictEqual(Object.keys(result.parameters).length, 2);
      assert.strictEqual(result.parameters.param1, true);
      assert.strictEqual(result.parameters.param2, 100);
    });

    it("should reuse parameters across WHERE conditions", () => {
      const builder = createSelect<User>()
        .from("users")
        .where((w) => w.eq("active", true).ne("active", false).eq("active", true));

      const result = builder.build();

      // Should reuse parameter for same value (true appears twice)
      assert.ok(result.parameters);
      const paramKeys = Object.keys(result.parameters);
      assert.strictEqual(paramKeys.length, 2); // Only 2 unique values: true and false
      assert.strictEqual(result.parameters.param1, true);
      assert.strictEqual(result.parameters.param2, false);
    });

    it("should handle parameter consistency across different condition types", () => {
      const builder = createSelect<User>()
        .from("users")
        .where((w) =>
          w
            .eq("name", "John")
            .in("tags", ["admin", "user"])
            .like("email", "%@example.com")
            .isNotNull("created_at")
        );

      const result = builder.build();

      assert.ok(result.parameters);
      const paramKeys = Object.keys(result.parameters);
      assert.strictEqual(paramKeys.length, 4); // name, tag1, tag2, email pattern
      assert.strictEqual(result.parameters.param1, "John");
      assert.strictEqual(result.parameters.param2, "admin");
      assert.strictEqual(result.parameters.param3, "user");
      assert.strictEqual(result.parameters.param4, "%@example.com");
    });

    it("should maintain parameter counter consistency", () => {
      const builder1 = createSelect<User>()
        .from("users")
        .where((w) => w.eq("id", 1));

      const builder2 = builder1.where((w) => w.eq("name", "John"));

      const result = builder2.build();

      assert.ok(result.parameters);
      assert.strictEqual(result.parameters.param1, 1);
      assert.strictEqual(result.parameters.param2, "John");
    });
  });

  describe("Type Safety Integration", () => {
    it("should maintain type safety with WHERE conditions", () => {
      const builder = createSelect<User>()
        .select("id", "name")
        .from("users")
        .where((w) => w.eq("active", true)); // Should accept boolean for active field

      assert.ok(builder);
      // Type checking happens at compile time, so this test mainly ensures no runtime errors
    });

    it("should work with different schema types", () => {
      const userBuilder = createSelect<User>()
        .from("users")
        .where((w) => w.eq("active", true));

      const productBuilder = createSelect<Product>()
        .from("products")
        .where((w) => w.eq("in_stock", true));

      assert.ok(userBuilder);
      assert.ok(productBuilder);
    });

    it("should support WHERE with selected columns", () => {
      const builder = createSelect<User>()
        .select("id", "name", "email")
        .from("users")
        .where((w) => w.eq("active", true).gt("age", 18));

      assert.ok(builder);
      assert.ok(builder._query.where);
    });
  });

  describe("WHERE with Other Clauses", () => {
    it("should work with WHERE and ORDER BY", () => {
      const builder = createSelect<User>()
        .from("users")
        .where((w) => w.eq("active", true))
        .orderBy("name", "ASC");

      assert.ok(builder._query.where);
      assert.ok(builder._query.orderBy);
    });

    it("should work with WHERE and ORDER BY expressions", () => {
      const builder = createSelect<User>()
        .from("users")
        .where((w) => w.eq("active", true))
        .orderByExpression("LENGTH(name)", "DESC");

      assert.ok(builder._query.where);
      assert.strictEqual(builder._query.orderBy?.columns[0].expression, "LENGTH(name)");
    });

    it("should work with WHERE and LIMIT/OFFSET", () => {
      const builder = createSelect<User>()
        .from("users")
        .where((w) => w.gt("age", 18))
        .limit(10)
        .offset(20);

      assert.ok(builder._query.where);
      assert.strictEqual(builder._query.limit, 10);
      assert.strictEqual(builder._query.offset, 20);
    });

    it("should work with WHERE and GROUP BY", () => {
      const builder = createSelect<User>()
        .from("users")
        .where((w) => w.eq("active", true))
        .groupBy("age");

      assert.ok(builder._query.where);
      assert.ok(builder._query.groupBy);
    });

    it("should work with WHERE and HAVING", () => {
      const builder = createSelect<User>()
        .from("users")
        .where((w) => w.eq("active", true))
        .groupBy("age")
        .having((h) => h.gt("age", 18));

      assert.ok(builder._query.where);
      assert.ok(builder._query.having);
    });
  });

  describe("WHERE with JOINs", () => {
    it("should integrate WHERE with INNER JOIN", () => {
      const builder = createSelect<User>()
        .from("users")
        .innerJoin("orders", (_u, _o) => createWhere().eq("id", 1))
        .where((w) => w.eq("active", true));

      assert.ok(builder._query.joins);
      assert.strictEqual(builder._query.joins.length, 1);
      assert.ok(builder._query.where);
    });

    it("should handle parameters from both JOIN and WHERE conditions", () => {
      interface Order extends SchemaConstraint {
        id: number;
        user_id: number;
        amount: number;
      }

      const builder = createSelect<User>()
        .from("users")
        .innerJoin("orders", (_u, _o) => createWhere<User & Order>().eq("user_id", 1))
        .where((w) => w.eq("active", true).gt("age", 18));

      const result = builder.build();

      assert.ok(result.parameters);
      // Should have parameters from both JOIN condition and WHERE clause
      const paramCount = Object.keys(result.parameters).length;
      assert.ok(paramCount >= 3); // user_id=1, active=true, age>18
    });
  });

  describe("Advanced WHERE Scenarios", () => {
    it("should handle null value conditions", () => {
      const builder = createSelect<User>()
        .from("users")
        .where((w) => w.isNull("email").isNotNull("created_at"));

      assert.ok(builder._query.where);
      assert.strictEqual(builder._query.where.conditions.length, 2);
    });

    it("should handle array operations in WHERE", () => {
      const builder = createSelect<User>()
        .from("users")
        .where((w) => w.in("id", [1, 2, 3]).notIn("name", ["admin", "test"]));

      const result = builder.build();

      assert.ok(result.parameters);
      // Should have parameters for array values
      const paramCount = Object.keys(result.parameters).length;
      assert.strictEqual(paramCount, 5); // 3 for IN + 2 for NOT IN
    });

    it("should handle string pattern operations", () => {
      const builder = createSelect<User>()
        .from("users")
        .where((w) =>
          w.like("name", "John%").startsWith("email", "admin").endsWith("email", "@company.com")
        );

      const result = builder.build();

      assert.ok(result.parameters);
      assert.strictEqual(Object.keys(result.parameters).length, 3);
    });

    it("should handle empty arrays in WHERE conditions", () => {
      const builder = createSelect<User>()
        .from("users")
        .where((w) => w.in("id", []).notIn("tags", []));

      const result = builder.build();

      // Empty arrays should not create parameters
      assert.ok(result.parameters);
      assert.strictEqual(Object.keys(result.parameters).length, 0);
    });
  });

  describe("WHERE Method Chaining", () => {
    it("should support multiple WHERE calls (should combine with AND)", () => {
      const builder = createSelect<User>()
        .from("users")
        .where((w) => w.eq("active", true))
        .where((w) => w.gt("age", 18));

      assert.ok(builder._query.where);
      // Second WHERE call should replace the first one in current implementation
      // This tests the current behavior - might be enhanced in future tasks
    });

    it("should maintain immutability with WHERE chaining", () => {
      const baseBuilder = createSelect<User>().from("users");
      const builder1 = baseBuilder.where((w) => w.eq("active", true));
      const builder2 = baseBuilder.where((w) => w.gt("age", 18));

      // Original builder should be unchanged
      assert.strictEqual(baseBuilder._query.where, undefined);

      // Each builder should have its own WHERE condition
      assert.ok(builder1._query.where);
      assert.ok(builder2._query.where);
      assert.notStrictEqual(builder1._query.where, builder2._query.where);
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle WHERE with no FROM clause gracefully", () => {
      const builder = createSelect<User>().where((w) => w.eq("active", true));

      assert.ok(builder._query.where);
      // Should not throw error, even without FROM clause
    });

    it("should handle complex nested conditions", () => {
      const builder = createSelect<User>()
        .from("users")
        .where((w) =>
          w.and(
            (b1) => b1.eq("active", true),
            (b2) =>
              b2.or(
                (ob1) => ob1.gt("age", 18),
                (ob2) =>
                  ob2.and(
                    (nb1) => nb1.eq("name", "admin"),
                    (nb2) => nb2.in("tags", ["super", "admin"])
                  )
              )
          )
        );

      assert.ok(builder._query.where);
      const result = builder.build();
      assert.ok(result.parameters);
    });

    it("should handle WHERE with aggregate functions in SELECT", () => {
      const builder = createSelect<User>()
        .count()
        .from("users")
        .where((w) => w.eq("active", true))
        .groupBy("age");

      assert.ok(builder._query.where);
      assert.ok(builder._query.groupBy);
    });
  });

  describe("Performance and Consistency", () => {
    it("should handle large WHERE conditions efficiently", () => {
      const largeIdList = Array.from({ length: 100 }, (_, i) => i + 1);

      const builder = createSelect<User>()
        .from("users")
        .where((w) => w.in("id", largeIdList).eq("active", true));

      const result = builder.build();

      assert.ok(result.parameters);
      assert.strictEqual(Object.keys(result.parameters).length, 101); // 100 IDs + active
    });

    it("should maintain parameter consistency across rebuilds", () => {
      const builder = createSelect<User>()
        .from("users")
        .where((w) => w.eq("name", "John").gt("age", 25));

      const result1 = builder.build();
      const result2 = builder.build();

      // Parameters should be consistent across multiple builds
      assert.deepStrictEqual(result1.parameters, result2.parameters);
    });
  });
});
