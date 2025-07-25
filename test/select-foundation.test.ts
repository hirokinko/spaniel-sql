/**
 * Tests for SELECT query builder foundation
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

interface Order extends SchemaConstraint {
  id: number;
  userId: number;
  amount: number;
  createdAt: Date;
}

describe("SELECT Query Builder Foundation", () => {
  describe("Basic Builder Creation", () => {
    it("should create a SELECT query builder", () => {
      const builder = createSelect<User>();

      assert.ok(builder);
      assert.ok(typeof builder.select === "function");
      assert.ok(typeof builder.from === "function");
      assert.ok(typeof builder.where === "function");
      assert.ok(typeof builder.build === "function");
    });

    it("should create a SELECT query builder with schema", () => {
      const schema: User = {
        id: 0,
        name: "",
        email: "",
        active: false,
      };

      const builder = createSelect(schema);

      assert.ok(builder);
      assert.strictEqual(builder._schema, schema);
    });
  });

  describe("Column Selection", () => {
    it("should support select method with typed columns", () => {
      const builder = createSelect<User>().select("id", "name");

      assert.ok(builder);
      assert.strictEqual(builder._query.select.columns.length, 2);
      assert.strictEqual(builder._query.select.columns[0].type, "column");
      assert.strictEqual(builder._query.select.columns[0].column, "id");
      assert.strictEqual(builder._query.select.columns[1].column, "name");
    });

    it("should support selectAll method", () => {
      const builder = createSelect<User>().selectAll();

      assert.ok(builder);
      assert.strictEqual(builder._query.select.columns.length, 1);
      assert.strictEqual(builder._query.select.columns[0].type, "expression");
      assert.strictEqual(builder._query.select.columns[0].expression, "*");
    });

    it("should support selectAs method with aliases", () => {
      const builder = createSelect<User>().selectAs("name", "userName");

      assert.ok(builder);
      assert.strictEqual(builder._query.select.columns.length, 1);
      assert.strictEqual(builder._query.select.columns[0].type, "column");
      assert.strictEqual(builder._query.select.columns[0].column, "name");
      assert.strictEqual(builder._query.select.columns[0].alias, "userName");
    });
  });

  describe("Aggregate Functions", () => {
    it("should support count method", () => {
      const builder = createSelect<User>().count();

      assert.ok(builder);
      assert.strictEqual(builder._query.select.columns.length, 1);
      assert.strictEqual(builder._query.select.columns[0].type, "aggregate");
      assert.strictEqual(builder._query.select.columns[0].aggregateFunction, "COUNT");
      assert.strictEqual(builder._query.select.columns[0].expression, "*");
    });

    it("should support count method with column", () => {
      const builder = createSelect<User>().count("id");

      assert.ok(builder);
      assert.strictEqual(builder._query.select.columns.length, 1);
      assert.strictEqual(builder._query.select.columns[0].type, "aggregate");
      assert.strictEqual(builder._query.select.columns[0].aggregateFunction, "COUNT");
      assert.strictEqual(builder._query.select.columns[0].column, "id");
    });

    it("should support sum method", () => {
      const builder = createSelect<Order>().sum("amount");

      assert.ok(builder);
      assert.strictEqual(builder._query.select.columns.length, 1);
      assert.strictEqual(builder._query.select.columns[0].type, "aggregate");
      assert.strictEqual(builder._query.select.columns[0].aggregateFunction, "SUM");
      assert.strictEqual(builder._query.select.columns[0].column, "amount");
    });

    it("should support avg, min, max methods", () => {
      const avgBuilder = createSelect<Order>().avg("amount");
      const minBuilder = createSelect<Order>().min("amount");
      const maxBuilder = createSelect<Order>().max("amount");

      assert.strictEqual(avgBuilder._query.select.columns[0].aggregateFunction, "AVG");
      assert.strictEqual(minBuilder._query.select.columns[0].aggregateFunction, "MIN");
      assert.strictEqual(maxBuilder._query.select.columns[0].aggregateFunction, "MAX");
    });
  });

  describe("FROM Clause", () => {
    it("should support from method", () => {
      const builder = createSelect<User>().from("users");

      assert.ok(builder);
      assert.ok(builder._query.from);
      assert.strictEqual(builder._query.from.name, "users");
    });

    it("should support from method with schema", () => {
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

  describe("WHERE Integration", () => {
    it("should support where method with WHERE builder", () => {
      const builder = createSelect<User>()
        .from("users")
        .where((w) => w.eq("active", true));

      assert.ok(builder);
      assert.ok(builder._query.where);
      assert.strictEqual(builder._query.where.type, "and");
      assert.strictEqual(builder._query.where.conditions.length, 1);
    });

    it("should integrate parameters from WHERE clause", () => {
      const builder = createSelect<User>()
        .from("users")
        .where((w) => w.eq("active", true).gt("id", 100));

      const result = builder.build();

      assert.ok(result.parameters);
      assert.strictEqual(Object.keys(result.parameters).length, 2);
    });
  });

  describe("JOIN Operations", () => {
    it("should support innerJoin method", () => {
      const builder = createSelect<User>()
        .from("users")
        .innerJoin(
          "orders",
          (_u, _o) =>
            // This is a placeholder - actual join condition building will be implemented later
            ({
              _conditions: { operator: "AND", conditions: [] },
              _parameters: { parameters: {}, counter: 0 },
            }) as any
        );

      assert.ok(builder);
      assert.strictEqual(builder._query.joins.length, 1);
      assert.strictEqual(builder._query.joins[0].type, "INNER");
      assert.strictEqual(builder._query.joins[0].table.name, "orders");
    });

    it("should support leftJoin method", () => {
      const builder = createSelect<User>()
        .from("users")
        .leftJoin(
          "orders",
          (_u, _o) =>
            ({
              _conditions: { operator: "AND", conditions: [] },
              _parameters: { parameters: {}, counter: 0 },
            }) as any
        );

      assert.ok(builder);
      assert.strictEqual(builder._query.joins.length, 1);
      assert.strictEqual(builder._query.joins[0].type, "LEFT");
    });
  });

  describe("GROUP BY and HAVING", () => {
    it("should support groupBy method", () => {
      const builder = createSelect<User>().from("users").groupBy("name", "email");

      assert.ok(builder);
      assert.ok(builder._query.groupBy);
      assert.deepStrictEqual(builder._query.groupBy.columns, ["name", "email"]);
    });

    it("should support having method", () => {
      const builder = createSelect<User>()
        .from("users")
        .groupBy("name")
        .having((h) => h.gt("COUNT(*)", 1));

      assert.ok(builder);
      assert.ok(builder._query.having);
    });
  });

  describe("ORDER BY and Pagination", () => {
    it("should support orderBy method", () => {
      const builder = createSelect<User>().from("users").orderBy("name", "ASC");

      assert.ok(builder);
      assert.ok(builder._query.orderBy);
      assert.strictEqual(builder._query.orderBy.columns.length, 1);
      assert.strictEqual(builder._query.orderBy.columns[0].column, "name");
      assert.strictEqual(builder._query.orderBy.columns[0].direction, "ASC");
    });

    it("should support limit and offset methods", () => {
      const builder = createSelect<User>().from("users").limit(10).offset(20);

      assert.ok(builder);
      assert.strictEqual(builder._query.limit, 10);
      assert.strictEqual(builder._query.offset, 20);
    });
  });

  describe("Query Building", () => {
    it("should build a basic query result", () => {
      const builder = createSelect<User>().select("id", "name").from("users");

      const result = builder.build();

      assert.ok(result);
      assert.ok(typeof result.sql === "string");
      assert.ok(typeof result.parameters === "object");
    });

    it("should maintain immutability", () => {
      const builder1 = createSelect<User>();
      const builder2 = builder1.select("id");
      const builder3 = builder2.from("users");

      // Each operation should return a new instance
      assert.notStrictEqual(builder1, builder2);
      assert.notStrictEqual(builder2, builder3);

      // Original builders should remain unchanged
      assert.strictEqual(builder1._query.select.columns.length, 0);
      assert.strictEqual(builder2._query.select.columns.length, 1);
      assert.strictEqual(builder3._query.select.columns.length, 1);
      assert.ok(builder3._query.from);
      assert.ok(!builder2._query.from);
    });
  });
});
