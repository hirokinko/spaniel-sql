# Design Document

## Overview

SELECT Query Builderは、既存のWHERE句ビルダーを拡張し、完全なSELECTクエリを構築できる型安全なTypeScriptライブラリです。関数型プログラミングの原則に従い、イミュータブルなビルダーパターンを採用します。

## Architecture

### Core Components

```
SelectQueryBuilder (Main Entry Point)
├── SelectClause (Column selection and expressions)
├── FromClause (Table specification and aliases)
├── JoinClause (Table joins with conditions)
├── WhereClause (Existing WHERE builder integration)
├── GroupByClause (Grouping specification)
├── HavingClause (Aggregate filtering)
├── OrderByClause (Result sorting)
└── LimitOffsetClause (Pagination)
```

### Design Principles

1. **Immutability**: 各操作で新しいインスタンスを返す
2. **Type Safety**: TypeScriptの型システムを最大限活用
3. **Composability**: 既存のWHERE句ビルダーとの統合
4. **Fluent Interface**: メソッドチェーンによる直感的なAPI
5. **Cloud Spanner Compliance**: Cloud Spanner固有の機能をサポート

## Components and Interfaces

### 1. Core Query Builder Types

```typescript
// Main query builder interface
interface SelectQueryBuilder<T extends SchemaConstraint = SchemaConstraint> {
  // Column selection
  select<K extends keyof T>(...columns: K[]): SelectQueryBuilder<Pick<T, K>>;
  selectAll(): SelectQueryBuilder<T>;
  selectAs<K extends keyof T, A extends string>(
    column: K,
    alias: A
  ): SelectQueryBuilder<Omit<T, K> & Record<A, T[K]>>;

  // Aggregate functions
  count(column?: keyof T): SelectQueryBuilder<{ count: number }>;
  sum<K extends keyof T>(column: K): SelectQueryBuilder<{ sum: T[K] }>;
  avg<K extends keyof T>(column: K): SelectQueryBuilder<{ avg: number }>;
  min<K extends keyof T>(column: K): SelectQueryBuilder<{ min: T[K] }>;
  max<K extends keyof T>(column: K): SelectQueryBuilder<{ max: T[K] }>;

  // Table specification
  from<U extends SchemaConstraint>(
    table: string,
    schema?: U
  ): SelectQueryBuilder<U>;

  // Joins
  innerJoin<U extends SchemaConstraint>(
    table: string,
    condition: JoinCondition<T, U>,
    schema?: U
  ): SelectQueryBuilder<T & U>;

  leftJoin<U extends SchemaConstraint>(
    table: string,
    condition: JoinCondition<T, U>,
    schema?: U
  ): SelectQueryBuilder<T & Partial<U>>;

  // WHERE integration
  where(
    condition: (builder: WhereBuilder<T>) => WhereBuilder<T>
  ): SelectQueryBuilder<T>;

  // Grouping
  groupBy<K extends keyof T>(...columns: K[]): SelectQueryBuilder<T>;
  having(
    condition: (builder: HavingBuilder<T>) => HavingBuilder<T>
  ): SelectQueryBuilder<T>;

  // Ordering
  orderBy<K extends keyof T>(
    column: K,
    direction?: 'ASC' | 'DESC'
  ): SelectQueryBuilder<T>;

  // Pagination
  limit(count: number): SelectQueryBuilder<T>;
  offset(count: number): SelectQueryBuilder<T>;

  // Build final query
  build(): QueryResult;
}
```

### 2. Column Selection Types

```typescript
// Column selection representation
interface SelectColumn {
  type: 'column' | 'expression' | 'aggregate';
  column?: string;
  expression?: string;
  alias?: string;
  aggregateFunction?: AggregateFunction;
}

type AggregateFunction =
  | 'COUNT'
  | 'SUM'
  | 'AVG'
  | 'MIN'
  | 'MAX'
  | 'ARRAY_AGG'
  | 'STRING_AGG';

interface SelectClause {
  columns: SelectColumn[];
  distinct?: boolean;
}
```

### 3. Table and Join Types

```typescript
// Table reference
interface TableReference {
  name: string;
  alias?: string;
  schema?: SchemaConstraint;
}

// Join types
type JoinType = 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';

interface JoinClause {
  type: JoinType;
  table: TableReference;
  condition: JoinCondition;
}

type JoinCondition<T, U> = (
  left: T,
  right: U
) => WhereBuilder<T & U>;
```

### 4. Grouping and Ordering Types

```typescript
// GROUP BY clause
interface GroupByClause {
  columns: string[];
  expressions: string[];
}

// ORDER BY clause
interface OrderByColumn {
  column: string;
  direction: 'ASC' | 'DESC';
  nullsFirst?: boolean;
}

interface OrderByClause {
  columns: OrderByColumn[];
}

// HAVING clause (reuses WHERE builder logic)
type HavingBuilder<T> = WhereBuilder<T>;
```

### 5. Complete Query Structure

```typescript
interface SelectQuery {
  select: SelectClause;
  from?: TableReference;
  joins: JoinClause[];
  where?: ConditionGroup;
  groupBy?: GroupByClause;
  having?: ConditionGroup;
  orderBy?: OrderByClause;
  limit?: number;
  offset?: number;
}
```

## Data Models

### Query Building Flow

```typescript
// Example usage flow
const query = createSelect<User>()
  .select('id', 'name', 'email')
  .from('users')
  .where(w => w.eq('active', true))
  .orderBy('name', 'ASC')
  .limit(10)
  .build();

// Generated SQL:
// SELECT id, name, email FROM users WHERE active = @param1 ORDER BY name ASC LIMIT 10
// Parameters: { param1: true }
```

### Type Evolution Example

```typescript
interface User {
  id: number;
  name: string;
  email: string;
  active: boolean;
}

interface Order {
  id: number;
  userId: number;
  amount: number;
  createdAt: Date;
}

// Type evolution through query building
const query = createSelect<User>()           // SelectQueryBuilder<User>
  .select('id', 'name')                      // SelectQueryBuilder<Pick<User, 'id' | 'name'>>
  .selectAs('email', 'userEmail')            // SelectQueryBuilder<Pick<User, 'id' | 'name'> & { userEmail: string }>
  .from('users')                             // SelectQueryBuilder<User>
  .innerJoin('orders', (u, o) =>
    createWhere().eq(u.id, o.userId))        // SelectQueryBuilder<User & Order>
  .where(w => w.eq('active', true))          // SelectQueryBuilder<User & Order>
  .groupBy('id', 'name')                     // SelectQueryBuilder<User & Order>
  .having(h => h.gt('COUNT(*)', 5))          // SelectQueryBuilder<User & Order>
  .orderBy('name')                           // SelectQueryBuilder<User & Order>
  .limit(10);                                // SelectQueryBuilder<User & Order>
```

## SQL Generation Strategy

### 1. Clause Generation Order

```typescript
const generateSelectSQL = (query: SelectQuery): string => {
  const parts: string[] = [];

  // SELECT clause
  parts.push(generateSelectClause(query.select));

  // FROM clause
  if (query.from) {
    parts.push(`FROM ${generateTableReference(query.from)}`);
  }

  // JOIN clauses
  query.joins.forEach(join => {
    parts.push(generateJoinClause(join));
  });

  // WHERE clause
  if (query.where) {
    parts.push(`WHERE ${generateConditionSql(query.where)}`);
  }

  // GROUP BY clause
  if (query.groupBy) {
    parts.push(generateGroupByClause(query.groupBy));
  }

  // HAVING clause
  if (query.having) {
    parts.push(`HAVING ${generateConditionSql(query.having)}`);
  }

  // ORDER BY clause
  if (query.orderBy) {
    parts.push(generateOrderByClause(query.orderBy));
  }

  // LIMIT/OFFSET clauses
  if (query.limit !== undefined) {
    parts.push(`LIMIT ${query.limit}`);
  }

  if (query.offset !== undefined) {
    parts.push(`OFFSET ${query.offset}`);
  }

  return parts.join(' ');
};
```

### 2. Cloud Spanner Specific Features

```typescript
// Array aggregation
const query = createSelect<User>()
  .select('department')
  .selectExpression('ARRAY_AGG(name)', 'names')
  .from('users')
  .groupBy('department')
  .build();

// Window functions
const query = createSelect<Order>()
  .select('id', 'amount')
  .selectExpression('ROW_NUMBER() OVER (ORDER BY amount DESC)', 'rank')
  .from('orders')
  .build();

// UNNEST operations
const query = createSelect()
  .selectExpression('tag')
  .from('users')
  .crossJoinUnnest('tags', 'tag')
  .build();
```

## Error Handling

### Compile-time Validation

```typescript
interface User {
  id: number;
  name: string;
}

const query = createSelect<User>()
  .select('id', 'invalidColumn')  // TypeScript error: 'invalidColumn' does not exist
  .from('users')
  .where(w => w.eq('name', 123))  // TypeScript error: number not assignable to string
  .groupBy('name')
  .having(h => h.eq('id', 1))     // TypeScript error: non-aggregate column in HAVING
  .build();
```

### Runtime Validation

```typescript
// Validation errors
type SelectQueryError = QueryBuilderError & {
  code:
    | "MISSING_FROM_CLAUSE"
    | "INVALID_GROUP_BY"
    | "INVALID_HAVING_WITHOUT_GROUP_BY"
    | "INVALID_LIMIT_VALUE"
    | "INVALID_JOIN_CONDITION";
};

// Validation functions
const validateSelectQuery = (query: SelectQuery): Result<SelectQuery> => {
  // Validate FROM clause exists
  if (!query.from && query.joins.length === 0) {
    return createFailure(createSelectQueryError(
      "SELECT query must have FROM clause or JOIN",
      "MISSING_FROM_CLAUSE"
    ));
  }

  // Validate GROUP BY requirements
  if (query.groupBy && hasAggregateInSelect(query.select)) {
    return validateGroupByColumns(query);
  }

  // Validate HAVING clause
  if (query.having && !query.groupBy) {
    return createFailure(createSelectQueryError(
      "HAVING clause requires GROUP BY",
      "INVALID_HAVING_WITHOUT_GROUP_BY"
    ));
  }

  return createSuccess(query);
};
```

## Testing Strategy

### Unit Testing

```typescript
describe('SelectQueryBuilder', () => {
  describe('Column Selection', () => {
    it('should select specific columns', () => {
      const query = createSelect<User>()
        .select('id', 'name')
        .from('users')
        .build();

      expect(query.sql).toBe('SELECT id, name FROM users');
    });

    it('should handle column aliases', () => {
      const query = createSelect<User>()
        .selectAs('name', 'userName')
        .from('users')
        .build();

      expect(query.sql).toBe('SELECT name AS userName FROM users');
    });
  });

  describe('Aggregate Functions', () => {
    it('should generate COUNT queries', () => {
      const query = createSelect<User>()
        .count()
        .from('users')
        .build();

      expect(query.sql).toBe('SELECT COUNT(*) FROM users');
    });
  });
});
```

### Integration Testing

```typescript
describe('Complex Query Integration', () => {
  it('should build complex multi-table queries', () => {
    const query = createSelect<User>()
      .select('u.name', 'o.amount')
      .from('users', 'u')
      .innerJoin('orders', 'o', (u, o) =>
        createWhere().eq(u.id, o.userId))
      .where(w => w.eq('u.active', true))
      .groupBy('u.name')
      .having(h => h.gt('SUM(o.amount)', 1000))
      .orderBy('u.name')
      .limit(10)
      .build();

    expect(query.sql).toBe(
      'SELECT u.name, o.amount FROM users u ' +
      'INNER JOIN orders o ON u.id = o.userId ' +
      'WHERE u.active = @param1 ' +
      'GROUP BY u.name ' +
      'HAVING SUM(o.amount) > @param2 ' +
      'ORDER BY u.name ASC ' +
      'LIMIT 10'
    );
  });
});
```

## Implementation Phases

### Phase 1: Basic SELECT/FROM
- Column selection (select, selectAll, selectAs)
- Table specification (from)
- Integration with existing WHERE builder

### Phase 2: Aggregate Functions
- Basic aggregates (COUNT, SUM, AVG, MIN, MAX)
- Cloud Spanner specific aggregates (ARRAY_AGG, STRING_AGG)
- GROUP BY clause implementation

### Phase 3: HAVING and Advanced Grouping
- HAVING clause with aggregate conditions
- Complex grouping scenarios
- Validation of GROUP BY requirements

### Phase 4: Ordering and Pagination
- ORDER BY clause with multiple columns
- ASC/DESC direction support
- LIMIT/OFFSET implementation

### Phase 5: JOIN Operations
- INNER JOIN implementation
- LEFT/RIGHT/FULL OUTER JOIN
- Multiple table joins
- Table aliases and references

### Phase 6: Advanced Features
- Window functions
- UNNEST operations
- Subqueries
- Common Table Expressions (CTEs)

## Integration with Existing Code

### WhereBuilder Integration

```typescript
// Reuse existing WHERE builder
const selectBuilder = createSelect<User>()
  .select('id', 'name')
  .from('users')
  .where(whereBuilder =>
    whereBuilder
      .eq('active', true)
      .gt('age', 18)
  );
```

### Parameter Management Integration

```typescript
// Extend existing parameter manager
interface SelectParameterManager extends ParameterManager {
  // Additional methods for SELECT-specific parameters
  addTableAlias(table: string, alias: string): SelectParameterManager;
  addColumnAlias(column: string, alias: string): SelectParameterManager;
}
```

### Type System Integration

```typescript
// Extend existing schema constraint system
type SelectSchemaConstraint<T> = T extends SchemaConstraint
  ? T
  : SchemaConstraint;

// Type-safe column selection
type SelectableColumns<T> = {
  [K in keyof T]: T[K] extends ParameterValue ? K : never;
}[keyof T];
```
