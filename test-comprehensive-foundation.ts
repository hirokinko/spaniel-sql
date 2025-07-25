import { createSelect, createWhere } from "./src/index.js";
import type { SchemaConstraint } from "./src/core-types.js";

// Test comprehensive foundation functionality
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

console.log("Testing SELECT query builder foundation...\n");

// Test 1: Basic column selection
console.log("1. Basic column selection:");
const basicQuery = createSelect<User>()
  .select("id", "name")
  .from("users");
console.log("Query structure:", JSON.stringify(basicQuery._query, null, 2));

// Test 2: WHERE integration
console.log("\n2. WHERE integration:");
const whereQuery = createSelect<User>()
  .select("id", "name")
  .from("users")
  .where(w => w.eq("active", true).gt("id", 100));
console.log("Has WHERE clause:", !!whereQuery._query.where);
console.log("Parameters:", whereQuery._parameters.parameters);

// Test 3: Aggregate functions
console.log("\n3. Aggregate functions:");
const aggregateQuery = createSelect<User>()
  .count("id")
  .from("users");
console.log("Aggregate column:", aggregateQuery._query.select.columns[0]);

// Test 4: JOIN operations (basic structure)
console.log("\n4. JOIN operations:");
const joinQuery = createSelect<User>()
  .from("users")
  .innerJoin("orders", (u, o) => createWhere<User & Order>().eq("id" as any, 1), {} as Order);
console.log("Has JOIN:", joinQuery._query.joins.length > 0);

// Test 5: Complex query building
console.log("\n5. Complex query building:");
const complexQuery = createSelect<User>()
  .select("id", "name")
  .from("users")
  .where(w => w.eq("active", true))
  .groupBy("name")
  .having(h => h.gt("COUNT(*)" as any, 1))
  .orderBy("name", "ASC")
  .limit(10)
  .offset(5);

console.log("Complex query structure:");
console.log("- SELECT columns:", complexQuery._query.select.columns.length);
console.log("- FROM table:", complexQuery._query.from?.name);
console.log("- WHERE clause:", !!complexQuery._query.where);
console.log("- GROUP BY:", !!complexQuery._query.groupBy);
console.log("- HAVING clause:", !!complexQuery._query.having);
console.log("- ORDER BY:", !!complexQuery._query.orderBy);
console.log("- LIMIT:", complexQuery._query.limit);
console.log("- OFFSET:", complexQuery._query.offset);

// Test 6: Type safety and immutability
console.log("\n6. Type safety and immutability:");
const builder1 = createSelect<User>();
const builder2 = builder1.select("id");
const builder3 = builder2.from("users");

console.log("Immutability check:");
console.log("- builder1 columns:", builder1._query.select.columns.length);
console.log("- builder2 columns:", builder2._query.select.columns.length);
console.log("- builder3 columns:", builder3._query.select.columns.length);
console.log("- builder3 has FROM:", !!builder3._query.from);
console.log("- builder2 has FROM:", !!builder2._query.from);

console.log("\n✅ Foundation tests completed successfully!");
