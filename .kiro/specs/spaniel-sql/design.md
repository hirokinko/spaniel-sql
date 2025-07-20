# Design Document

## Overview

spaniel-sql は、Cloud Spanner 用の型安全な TypeScript クエリビルダーライブラリです。Builder パターンを採用し、メソッドチェーンによる流暢な API を提供します。最初のフェーズでは、WHERE 句の構築に特化した DSL を実装します。

## Architecture

### Core Components

```
QueryBuilder (Main Entry Point)
├── WhereBuilder (WHERE clause construction)
├── ConditionBuilder (Individual conditions)
├── ParameterManager (Parameter handling)
└── SqlGenerator (SQL string generation)
```

### Design Principles

1. **Type Safety First**: TypeScript の型システムを最大限活用
2. **Fluent Interface**: メソッドチェーンによる直感的な API
3. **Immutability**: 各操作で新しいインスタンスを返す
4. **Parameterized Queries**: SQL Injection を防ぐパラメータ化クエリ
5. **Cloud Spanner Compliance**: Cloud Spanner 固有の構文とセマンティクスに準拠

## Components and Interfaces

### 1. Core Types

```typescript
// Schema definition (optional)
interface TableSchema {
  [columnName: string]: SpannerDataType;
}

type SpannerDataType =
  | "INT64"
  | "FLOAT64"
  | "STRING"
  | "BYTES"
  | "BOOL"
  | "DATE"
  | "TIMESTAMP"
  | "ARRAY";

// Query result structure
interface QueryResult {
  sql: string;
  parameters: Record<string, any>;
}

// Comparison operators
type ComparisonOperator = "=" | "!=" | "<" | ">" | "<=" | ">=";
```

### 2. Functional WhereBuilder Types

```typescript
// Core builder type - immutable object with methods
type WhereBuilder<T = any> = {
  readonly _conditions: ConditionGroup;
  readonly _parameters: ParameterManager;

  // Basic comparisons
  eq<K extends keyof T>(column: K, value: T[K]): WhereBuilder<T>;
  ne<K extends keyof T>(column: K, value: T[K]): WhereBuilder<T>;
  lt<K extends keyof T>(column: K, value: T[K]): WhereBuilder<T>;
  gt<K extends keyof T>(column: K, value: T[K]): WhereBuilder<T>;
  le<K extends keyof T>(column: K, value: T[K]): WhereBuilder<T>;
  ge<K extends keyof T>(column: K, value: T[K]): WhereBuilder<T>;

  // Array operations
  in<K extends keyof T>(column: K, values: T[K][]): WhereBuilder<T>;
  notIn<K extends keyof T>(column: K, values: T[K][]): WhereBuilder<T>;

  // String operations
  like<K extends keyof T>(column: K, pattern: string): WhereBuilder<T>;
  notLike<K extends keyof T>(column: K, pattern: string): WhereBuilder<T>;
  startsWith<K extends keyof T>(column: K, prefix: string): WhereBuilder<T>;
  endsWith<K extends keyof T>(column: K, suffix: string): WhereBuilder<T>;

  // Null checks
  isNull<K extends keyof T>(column: K): WhereBuilder<T>;
  isNotNull<K extends keyof T>(column: K): WhereBuilder<T>;

  // Logical operators
  and(
    ...conditions: ((builder: WhereBuilder<T>) => WhereBuilder<T>)[]
  ): WhereBuilder<T>;
  or(
    ...conditions: ((builder: WhereBuilder<T>) => WhereBuilder<T>)[]
  ): WhereBuilder<T>;

  // Build final query
  build(): QueryResult;
};

// Factory function instead of constructor
type CreateWhereBuilder = <T = any>() => WhereBuilder<T>;
```

### 3. Internal Condition Representation

```typescript
interface Condition {
  type: "comparison" | "in" | "like" | "null" | "function";
  column: string;
  operator: string;
  value?: any;
  values?: any[];
  parameterName?: string;
}

interface ConditionGroup {
  type: "and" | "or";
  conditions: (Condition | ConditionGroup)[];
}
```

### 4. Functional Parameter Manager

```typescript
// Immutable parameter manager type
type ParameterManager = {
  readonly parameters: Record<string, any>;
  readonly counter: number;
};

// Parameter manager operations
const createParameterManager = (): ParameterManager => ({
  parameters: {},
  counter: 0,
});

const addParameter = (
  manager: ParameterManager,
  value: any
): [ParameterManager, string] => {
  // Check if value already exists to reuse parameter
  const existingParam = Object.entries(manager.parameters).find(
    ([_, v]) => v === value
  )?.[0];

  if (existingParam) {
    return [manager, `@${existingParam}`];
  }

  // Create new parameter
  const newCounter = manager.counter + 1;
  const paramName = `param${newCounter}`;

  return [
    {
      parameters: { ...manager.parameters, [paramName]: value },
      counter: newCounter,
    },
    `@${paramName}`,
  ];
};
```

## Data Models

### Condition Tree Structure

WHERE 句は条件の木構造として表現されます：

```
AND (root)
├── condition1: age > 18
├── OR
│   ├── condition2: status = 'active'
│   └── condition3: priority IN ['high', 'urgent']
└── condition4: name LIKE 'John%'
```

### Parameter Mapping

パラメータは一意の名前で管理され、同じ値は再利用されます：

```typescript
// Input: .equals('age', 25).equals('status', 'active').equals('age', 25)
// Parameters: { param1: 25, param2: 'active' }
// SQL: age = @param1 AND status = @param2 AND age = @param1
```

### Usage Examples with Functional API

```typescript
// Factory function usage
const createWhere = <T>(): WhereBuilder<T> => {
  /* implementation */
};

// Multiple AND conditions
const query1 = createWhere<User>()
  .and(
    (builder) => builder.eq("status", "active"),
    (builder) => builder.gt("age", 18),
    (builder) => builder.like("name", "John%")
  )
  .build();
// SQL: (status = @param1 AND age > @param2 AND name LIKE @param3)

// Multiple OR conditions
const query2 = createWhere<User>()
  .or(
    (builder) => builder.eq("priority", "high"),
    (builder) => builder.eq("priority", "urgent"),
    (builder) => builder.isNull("deadline")
  )
  .build();
// SQL: (priority = @param1 OR priority = @param2 OR deadline IS NULL)

// Mixed AND/OR with proper grouping
const query3 = createWhere<User>()
  .eq("department", "engineering")
  .and(
    (builder) =>
      builder.or(
        (b) => b.eq("level", "senior"),
        (b) => b.eq("level", "lead")
      ),
    (builder) => builder.gt("experience", 5)
  )
  .build();
// SQL: department = @param1 AND ((level = @param2 OR level = @param3) AND experience > @param4)
```

## Error Handling

### Type-Level Errors

```typescript
// Compile-time error for non-existent columns
interface User {
  id: number;
  name: string;
}
const builder = createWhere<User>();
builder.eq("invalidColumn", "value"); // TypeScript error
```

### Runtime Errors

```typescript
// Functional error handling with Result type
type QueryBuilderError = {
  readonly type: "QueryBuilderError";
  readonly message: string;
  readonly code: string;
};

type Result<T, E = QueryBuilderError> =
  | { success: true; data: T }
  | { success: false; error: E };

// Error creation functions
const createError = (message: string, code: string): QueryBuilderError => ({
  type: "QueryBuilderError",
  message,
  code,
});

// Error scenarios:
// - Empty IN clause arrays
// - Invalid parameter values
// - Malformed conditions
```

### Validation Strategy

1. **Compile-time**: TypeScript 型チェック
2. **Build-time**: 条件の妥当性検証
3. **Runtime**: パラメータ値の検証

## Testing Strategy

### Unit Testing

```typescript
describe("WhereBuilder", () => {
  describe("Basic Comparisons", () => {
    it("should generate equals condition", () => {
      const result = createWhere().eq("age", 25).build();

      expect(result.sql).toBe("age = @param1");
      expect(result.parameters).toEqual({ param1: 25 });
    });
  });

  describe("Logical Operators", () => {
    it("should combine conditions with AND", () => {
      // Test AND logic with functional approach
    });

    it("should handle OR with proper parentheses", () => {
      // Test OR logic and grouping
    });
  });

  describe("Type Safety", () => {
    it("should enforce column types at compile time", () => {
      // Type-level tests with functional API
    });
  });
});
```

### Integration Testing

```typescript
describe("Cloud Spanner Integration", () => {
  it("should execute generated queries successfully", async () => {
    const query = createWhere<User>()
      .eq("status", "active")
      .gt("age", 18)
      .build();

    // Execute against real Cloud Spanner instance
    const results = await spannerClient.run({
      sql: `SELECT * FROM users WHERE ${query.sql}`,
      params: query.parameters,
    });

    expect(results).toBeDefined();
  });
});
```

### Property-Based Testing

```typescript
// Use libraries like fast-check for property-based testing
describe("Property Tests", () => {
  it("should always generate valid SQL", () => {
    fc.assert(
      fc.property(
        fc.record({
          column: fc.string(),
          value: fc.oneof(fc.string(), fc.integer(), fc.boolean()),
        }),
        (input) => {
          const result = createWhere().eq(input.column, input.value).build();

          // Verify SQL is well-formed
          expect(result.sql).toMatch(/^\w+ = @\w+$/);
        }
      )
    );
  });
});
```

## Implementation Phases

### Phase 1: Core Infrastructure

- Basic WhereBuilder class
- Parameter management
- Simple comparison operators

### Phase 2: Advanced Operators

- IN/NOT IN operations
- LIKE/pattern matching
- NULL checks

### Phase 3: Logical Operators

- AND/OR combination
- Proper parentheses handling
- Nested conditions

### Phase 4: Type Safety

- Generic type constraints
- Schema-based validation
- Enhanced TypeScript support

### Phase 5: Optimization & Polish

- Performance optimization
- Error handling improvements
- Documentation and examples
