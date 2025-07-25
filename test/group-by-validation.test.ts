import assert from "node:assert";
import { describe, it } from "node:test";
import type { SchemaConstraint } from "../src/core-types.js";
import type { SelectQuery } from "../src/select-types.js";
import {
  createAggregateSelection,
  createColumnSelection,
  createGroupByClause,
  createSelectClause,
  validateGroupByClause,
  validateGroupByColumns,
} from "../src/select-utils.js";

interface User extends SchemaConstraint {
  id: number;
  name: string;
  age: number;
}

describe("GROUP BY Validation", () => {
  const userSchema: User = { id: 0, name: "", age: 0 };

  it("should validate GROUP BY clause columns", () => {
    const clause = createGroupByClause(["name", "age"]);
    const result = validateGroupByClause(clause, userSchema);
    assert.ok(result.valid);
  });

  it("should invalidate unknown columns in GROUP BY", () => {
    const clause = createGroupByClause(["invalid"]);
    const result = validateGroupByClause(clause, userSchema);
    assert.ok(!result.valid);
  });

  it("should invalidate empty GROUP BY clause", () => {
    const clause = createGroupByClause([]);
    const result = validateGroupByClause(clause);
    assert.ok(!result.valid);
  });

  it("should require non-aggregate columns in GROUP BY", () => {
    const select = createSelectClause([
      createColumnSelection("name"),
      createAggregateSelection("COUNT", "id"),
    ]);
    const query: SelectQuery = {
      select,
      joins: [],
      groupBy: createGroupByClause(["name"]),
    };
    const result = validateGroupByColumns(query);
    assert.ok(result.valid);

    const badQuery: SelectQuery = {
      select,
      joins: [],
      groupBy: createGroupByClause([]),
    };
    const badResult = validateGroupByColumns(badQuery);
    assert.ok(!badResult.valid);
  });
});
