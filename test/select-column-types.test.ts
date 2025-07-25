import assert from "node:assert";
import { describe, test } from "node:test";
import type { AggregateFunction, SelectClause, SelectColumn } from "../src/select-types.js";
import {
  addColumnToSelect,
  createAggregateSelection,
  createColumnSelection,
  createExpressionSelection,
  createSelectAllClause,
  createSelectClause,
  getReferencedColumns,
  getSelectAliases,
  hasAggregateColumns,
  hasDuplicateAliases,
  isAggregateColumn,
  isValidAggregateFunction,
  removeColumnFromSelect,
  setSelectDistinct,
  validateAggregateFunction,
  validateColumnName,
  validateSelectClause,
  validateSelectColumn,
  validateSelectColumns,
} from "../src/select-utils.js";

describe("SelectColumn Types", () => {
  test("SelectColumn should support column type", () => {
    const column: SelectColumn = {
      type: "column",
      column: "name",
      alias: "user_name",
    };

    assert.strictEqual(column.type, "column");
    assert.strictEqual(column.column, "name");
    assert.strictEqual(column.alias, "user_name");
  });

  test("SelectColumn should support expression type", () => {
    const column: SelectColumn = {
      type: "expression",
      expression: "UPPER(name)",
      alias: "upper_name",
    };

    assert.strictEqual(column.type, "expression");
    assert.strictEqual(column.expression, "UPPER(name)");
    assert.strictEqual(column.alias, "upper_name");
  });

  test("SelectColumn should support aggregate type", () => {
    const column: SelectColumn = {
      type: "aggregate",
      aggregateFunction: "COUNT",
      column: "id",
      alias: "total_count",
    };

    assert.strictEqual(column.type, "aggregate");
    assert.strictEqual(column.aggregateFunction, "COUNT");
    assert.strictEqual(column.column, "id");
    assert.strictEqual(column.alias, "total_count");
  });

  test("AggregateFunction should include all supported functions", () => {
    const validFunctions: AggregateFunction[] = [
      "COUNT",
      "SUM",
      "AVG",
      "MIN",
      "MAX",
      "ARRAY_AGG",
      "STRING_AGG",
    ];

    validFunctions.forEach((func) => {
      assert.ok(typeof func === "string");
    });
  });
});

describe("SelectClause Types", () => {
  test("SelectClause should have correct structure", () => {
    const column1: SelectColumn = {
      type: "column",
      column: "id",
    };

    const column2: SelectColumn = {
      type: "column",
      column: "name",
      alias: "user_name",
    };

    const selectClause: SelectClause = {
      columns: [column1, column2],
      distinct: true,
    };

    assert.ok(Array.isArray(selectClause.columns));
    assert.strictEqual(selectClause.columns.length, 2);
    assert.strictEqual(selectClause.columns[0], column1);
    assert.strictEqual(selectClause.columns[1], column2);
    assert.strictEqual(selectClause.distinct, true);
  });

  test("SelectClause should support optional distinct flag", () => {
    const selectClause: SelectClause = {
      columns: [{ type: "column", column: "id" }],
    };

    assert.ok(Array.isArray(selectClause.columns));
    assert.strictEqual(selectClause.distinct, undefined);
  });
});

describe("Column Selection Creation", () => {
  test("createColumnSelection should create column selection", () => {
    const column = createColumnSelection("name");

    assert.strictEqual(column.type, "column");
    assert.strictEqual(column.column, "name");
    assert.strictEqual(column.alias, undefined);
  });

  test("createColumnSelection should create column selection with alias", () => {
    const column = createColumnSelection("name", "user_name");

    assert.strictEqual(column.type, "column");
    assert.strictEqual(column.column, "name");
    assert.strictEqual(column.alias, "user_name");
  });

  test("createExpressionSelection should create expression selection", () => {
    const column = createExpressionSelection("UPPER(name)");

    assert.strictEqual(column.type, "expression");
    assert.strictEqual(column.expression, "UPPER(name)");
    assert.strictEqual(column.alias, undefined);
  });

  test("createExpressionSelection should create expression selection with alias", () => {
    const column = createExpressionSelection("COUNT(*)", "total");

    assert.strictEqual(column.type, "expression");
    assert.strictEqual(column.expression, "COUNT(*)");
    assert.strictEqual(column.alias, "total");
  });

  test("createAggregateSelection should create aggregate selection", () => {
    const column = createAggregateSelection("COUNT");

    assert.strictEqual(column.type, "aggregate");
    assert.strictEqual(column.aggregateFunction, "COUNT");
    assert.strictEqual(column.column, undefined);
    assert.strictEqual(column.alias, undefined);
  });

  test("createAggregateSelection should create aggregate selection with column", () => {
    const column = createAggregateSelection("SUM", "amount");

    assert.strictEqual(column.type, "aggregate");
    assert.strictEqual(column.aggregateFunction, "SUM");
    assert.strictEqual(column.column, "amount");
    assert.strictEqual(column.alias, undefined);
  });

  test("createAggregateSelection should create aggregate selection with column and alias", () => {
    const column = createAggregateSelection("AVG", "rating", "avg_rating");

    assert.strictEqual(column.type, "aggregate");
    assert.strictEqual(column.aggregateFunction, "AVG");
    assert.strictEqual(column.column, "rating");
    assert.strictEqual(column.alias, "avg_rating");
  });
});

describe("SelectClause Creation", () => {
  test("createSelectClause should create select clause", () => {
    const columns = [createColumnSelection("id"), createColumnSelection("name", "user_name")];
    const selectClause = createSelectClause(columns);

    assert.ok(Array.isArray(selectClause.columns));
    assert.strictEqual(selectClause.columns.length, 2);
    assert.notStrictEqual(selectClause.columns, columns); // Should be a copy
    assert.deepStrictEqual(selectClause.columns, columns);
    assert.strictEqual(selectClause.distinct, undefined);
  });

  test("createSelectClause should create select clause with distinct", () => {
    const columns = [createColumnSelection("category")];
    const selectClause = createSelectClause(columns, true);

    assert.strictEqual(selectClause.distinct, true);
    assert.strictEqual(selectClause.columns.length, 1);
  });

  test("createSelectAllClause should create SELECT * clause", () => {
    const selectClause = createSelectAllClause();

    assert.strictEqual(selectClause.columns.length, 1);
    assert.strictEqual(selectClause.columns[0].type, "expression");
    assert.strictEqual(selectClause.columns[0].expression, "*");
  });
});

describe("Column Validation", () => {
  interface TestSchema extends Record<string, any> {
    id: number;
    name: string;
    email: string;
    active: boolean;
  }

  test("validateColumnName should validate column exists in schema", () => {
    const schema: TestSchema = { id: 1, name: "test", email: "test@example.com", active: true };

    assert.ok(validateColumnName("id", schema));
    assert.ok(validateColumnName("name", schema));
    assert.ok(validateColumnName("email", schema));
    assert.ok(validateColumnName("active", schema));
    assert.ok(!validateColumnName("invalid", schema));
  });

  test("validateColumnName should return true when no schema provided", () => {
    assert.ok(validateColumnName("any_column"));
    assert.ok(validateColumnName("invalid_column"));
  });

  test("validateSelectColumns should validate all columns in array", () => {
    const schema: TestSchema = { id: 1, name: "test", email: "test@example.com", active: true };

    const validColumns = [
      createColumnSelection("id"),
      createColumnSelection("name"),
      createAggregateSelection("COUNT", "id"),
    ];

    const invalidColumns = [createColumnSelection("id"), createColumnSelection("invalid_column")];

    assert.ok(validateSelectColumns(validColumns, schema));
    assert.ok(!validateSelectColumns(invalidColumns, schema));
  });

  test("validateSelectColumns should return true when no schema provided", () => {
    const columns = [
      createColumnSelection("any_column"),
      createExpressionSelection("ANY_FUNCTION()"),
    ];

    assert.ok(validateSelectColumns(columns));
  });

  test("validateSelectColumns should handle expression columns correctly", () => {
    const schema: TestSchema = { id: 1, name: "test", email: "test@example.com", active: true };

    const columns = [
      createColumnSelection("id"),
      createExpressionSelection("UPPER(name)"), // Expression doesn't need validation
      createColumnSelection("invalid"), // This should fail
    ];

    assert.ok(!validateSelectColumns(columns, schema));
  });
});

describe("Column Analysis", () => {
  test("isAggregateColumn should identify aggregate columns", () => {
    const aggregateColumn = createAggregateSelection("COUNT", "id");
    const regularColumn = createColumnSelection("name");
    const expressionColumn = createExpressionSelection("UPPER(name)");

    assert.ok(isAggregateColumn(aggregateColumn));
    assert.ok(!isAggregateColumn(regularColumn));
    assert.ok(!isAggregateColumn(expressionColumn));
  });

  test("hasAggregateColumns should detect aggregate functions in clause", () => {
    const withAggregates = createSelectClause([
      createColumnSelection("name"),
      createAggregateSelection("COUNT", "id"),
    ]);

    const withoutAggregates = createSelectClause([
      createColumnSelection("name"),
      createExpressionSelection("UPPER(email)"),
    ]);

    assert.ok(hasAggregateColumns(withAggregates));
    assert.ok(!hasAggregateColumns(withoutAggregates));
  });

  test("isValidAggregateFunction should validate supported functions", () => {
    const funcs = ["COUNT", "SUM", "AVG", "MIN", "MAX", "ARRAY_AGG", "STRING_AGG"];

    funcs.forEach((f) => {
      assert.ok(isValidAggregateFunction(f));
      assert.ok(validateAggregateFunction(f));
    });

    assert.ok(!isValidAggregateFunction("INVALID"));
    assert.ok(!validateAggregateFunction("INVALID"));
  });

  test("getReferencedColumns should extract column names", () => {
    const selectClause = createSelectClause([
      createColumnSelection("id"),
      createColumnSelection("name"),
      createExpressionSelection("UPPER(email)"), // Should be ignored
      createAggregateSelection("COUNT", "active"),
    ]);

    const columns = getReferencedColumns(selectClause);

    assert.deepStrictEqual(columns.sort(), ["active", "id", "name"]);
  });

  test("getSelectAliases should extract all aliases", () => {
    const selectClause = createSelectClause([
      createColumnSelection("id"), // No alias
      createColumnSelection("name", "user_name"),
      createExpressionSelection("COUNT(*)", "total"),
    ]);

    const aliases = getSelectAliases(selectClause);

    assert.deepStrictEqual(aliases.sort(), ["total", "user_name"]);
  });

  test("hasDuplicateAliases should detect duplicate aliases", () => {
    const withDuplicates = createSelectClause([
      createColumnSelection("id", "identifier"),
      createColumnSelection("name", "identifier"), // Duplicate alias
    ]);

    const withoutDuplicates = createSelectClause([
      createColumnSelection("id", "user_id"),
      createColumnSelection("name", "user_name"),
    ]);

    assert.ok(hasDuplicateAliases(withDuplicates));
    assert.ok(!hasDuplicateAliases(withoutDuplicates));
  });
});

describe("SelectColumn Validation", () => {
  test("validateSelectColumn should validate column type", () => {
    const validColumn = createColumnSelection("name");
    const invalidColumn: SelectColumn = { type: "column" }; // Missing column name

    const validResult = validateSelectColumn(validColumn);
    const invalidResult = validateSelectColumn(invalidColumn);

    assert.strictEqual(validResult.length, 0);
    assert.ok(invalidResult.length > 0);
    assert.ok(invalidResult[0].includes("must specify a column name"));
  });

  test("validateSelectColumn should validate expression type", () => {
    const validExpression = createExpressionSelection("UPPER(name)");
    const invalidExpression: SelectColumn = { type: "expression" }; // Missing expression

    const validResult = validateSelectColumn(validExpression);
    const invalidResult = validateSelectColumn(invalidExpression);

    assert.strictEqual(validResult.length, 0);
    assert.ok(invalidResult.length > 0);
    assert.ok(invalidResult[0].includes("must specify an expression"));
  });

  test("validateSelectColumn should validate aggregate type", () => {
    const validAggregate = createAggregateSelection("COUNT");
    const validAggregateWithColumn = createAggregateSelection("SUM", "amount");
    const invalidAggregate: SelectColumn = { type: "aggregate" }; // Missing function
    const invalidSumAggregate: SelectColumn = {
      type: "aggregate",
      aggregateFunction: "SUM",
    }; // SUM without column

    assert.strictEqual(validateSelectColumn(validAggregate).length, 0);
    assert.strictEqual(validateSelectColumn(validAggregateWithColumn).length, 0);

    const invalidResult1 = validateSelectColumn(invalidAggregate);
    assert.ok(invalidResult1.length > 0);
    assert.ok(invalidResult1[0].includes("must specify an aggregate function"));

    const invalidResult2 = validateSelectColumn(invalidSumAggregate);
    assert.ok(invalidResult2.length > 0);
    assert.ok(invalidResult2[0].includes("SUM aggregate must specify a column"));
  });

  test("validateSelectColumn should allow COUNT without column", () => {
    const countWithoutColumn = createAggregateSelection("COUNT");
    const result = validateSelectColumn(countWithoutColumn);

    assert.strictEqual(result.length, 0);
  });

  test("validateSelectColumn should reject invalid aggregate function", () => {
    const invalidAgg = {
      type: "aggregate",
      aggregateFunction: "INVALID",
    } as unknown as SelectColumn;
    const result = validateSelectColumn(invalidAgg);

    assert.ok(result.some((e) => e.includes("Invalid aggregate function")));
  });
});

describe("SelectClause Validation", () => {
  interface TestSchema extends Record<string, any> {
    id: number;
    name: string;
    email: string;
  }

  test("validateSelectClause should validate complete clause", () => {
    const schema: TestSchema = { id: 1, name: "test", email: "test@example.com" };

    const validClause = createSelectClause([
      createColumnSelection("id"),
      createColumnSelection("name", "user_name"),
    ]);

    const result = validateSelectClause(validClause, schema);

    assert.ok(result.valid);
    assert.strictEqual(result.errors.length, 0);
  });

  test("validateSelectClause should detect empty columns", () => {
    const emptyClause = createSelectClause([]);
    const result = validateSelectClause(emptyClause);

    assert.ok(!result.valid);
    assert.ok(result.errors.some((error) => error.includes("at least one column")));
  });

  test("validateSelectClause should detect duplicate aliases", () => {
    const clauseWithDuplicates = createSelectClause([
      createColumnSelection("id", "identifier"),
      createColumnSelection("name", "identifier"),
    ]);

    const result = validateSelectClause(clauseWithDuplicates);

    assert.ok(!result.valid);
    assert.ok(result.errors.some((error) => error.includes("duplicate column aliases")));
  });

  test("validateSelectClause should detect invalid columns", () => {
    const schema: TestSchema = { id: 1, name: "test", email: "test@example.com" };

    const clauseWithInvalidColumn = createSelectClause([
      createColumnSelection("id"),
      createColumnSelection("invalid_column"),
    ]);

    const result = validateSelectClause(clauseWithInvalidColumn, schema);

    assert.ok(!result.valid);
    assert.ok(result.errors.some((error) => error.includes("not valid for the provided schema")));
  });
});

describe("SelectClause Manipulation", () => {
  test("addColumnToSelect should add column and return new instance", () => {
    const originalClause = createSelectClause([createColumnSelection("id")]);
    const newColumn = createColumnSelection("name");
    const newClause = addColumnToSelect(originalClause, newColumn);

    // Should return new instance
    assert.notStrictEqual(newClause, originalClause);

    // Original should be unchanged
    assert.strictEqual(originalClause.columns.length, 1);

    // New clause should have additional column
    assert.strictEqual(newClause.columns.length, 2);
    assert.strictEqual(newClause.columns[1], newColumn);
  });

  test("removeColumnFromSelect should remove column by index", () => {
    const originalClause = createSelectClause([
      createColumnSelection("id"),
      createColumnSelection("name"),
      createColumnSelection("email"),
    ]);

    const newClause = removeColumnFromSelect(originalClause, 1); // Remove "name"

    assert.notStrictEqual(newClause, originalClause);
    assert.strictEqual(originalClause.columns.length, 3);
    assert.strictEqual(newClause.columns.length, 2);
    assert.strictEqual(newClause.columns[0].column, "id");
    assert.strictEqual(newClause.columns[1].column, "email");
  });

  test("removeColumnFromSelect should handle invalid index", () => {
    const originalClause = createSelectClause([createColumnSelection("id")]);

    const newClause1 = removeColumnFromSelect(originalClause, -1);
    const newClause2 = removeColumnFromSelect(originalClause, 5);

    // Should return original clause unchanged for invalid indices
    assert.strictEqual(newClause1, originalClause);
    assert.strictEqual(newClause2, originalClause);
  });

  test("setSelectDistinct should set distinct flag", () => {
    const originalClause = createSelectClause([createColumnSelection("id")]);
    const distinctClause = setSelectDistinct(originalClause, true);
    const nonDistinctClause = setSelectDistinct(distinctClause, false);

    assert.notStrictEqual(distinctClause, originalClause);
    assert.notStrictEqual(nonDistinctClause, distinctClause);

    assert.strictEqual(originalClause.distinct, undefined);
    assert.strictEqual(distinctClause.distinct, true);
    assert.strictEqual(nonDistinctClause.distinct, false);
  });
});
