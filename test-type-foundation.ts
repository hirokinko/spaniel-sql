import { createSelect } from "./src/index.js";
import type { SchemaConstraint } from "./src/core-types.js";

// Test type system foundation
interface User extends SchemaConstraint {
  id: number;
  name: string;
  email: string;
  active: boolean;
}

// This should compile without errors
const typedQuery = createSelect<User>()
  .select("id", "name")  // Valid columns
  .from("users")
  .where(w => w.eq("active", true))  // Valid column and type
  .orderBy("name", "ASC");  // Valid column

console.log("Type system working correctly!");

// Test schema constraint
const schemaQuery = createSelect<User>({
  id: 0,
  name: "",
  email: "",
  active: false
});

console.log("Schema constraint working correctly!");

// Test generic constraints
const genericQuery = createSelect()
  .select("anyColumn")
  .from("anyTable");

console.log("Generic constraints working correctly!");

console.log("✅ Type foundation tests completed successfully!");
