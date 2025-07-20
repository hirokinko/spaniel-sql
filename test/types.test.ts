import { test, describe } from 'node:test';
import assert from 'node:assert';
import { SpannerDataType, ComparisonOperator, QueryResult, TableSchema, SpannerTypeHint } from '../src/types';

describe('Core Types', () => {
  test('SpannerDataType should include all supported types', () => {
    const validTypes: SpannerDataType[] = [
      'INT64',
      'FLOAT64', 
      'STRING',
      'BYTES',
      'BOOL',
      'DATE',
      'TIMESTAMP',
      'ARRAY'
    ];
    
    // Type check - this will fail at compile time if types don't match
    validTypes.forEach(type => {
      assert.ok(typeof type === 'string');
    });
  });

  test('ComparisonOperator should include all supported operators', () => {
    const validOperators: ComparisonOperator[] = ['=', '!=', '<', '>', '<=', '>='];
    
    validOperators.forEach(op => {
      assert.ok(typeof op === 'string');
    });
  });

  test('QueryResult should have correct structure', () => {
    const result: QueryResult = {
      sql: 'SELECT * FROM users WHERE age = @param1',
      parameters: { param1: 25 }
    };

    assert.ok(typeof result.sql === 'string');
    assert.ok(typeof result.parameters === 'object');
    assert.ok(result.parameters !== null);
  });

  test('QueryResult should support type hints for Spanner API', () => {
    const result: QueryResult = {
      sql: 'SELECT * FROM users WHERE age = @param1 AND name = @param2',
      parameters: { param1: 25, param2: null },
      types: {
        param1: 'int64',  // Simple type hint
        param2: 'string'  // Simple type hint
      }
    };

    assert.ok(typeof result.sql === 'string');
    assert.ok(typeof result.parameters === 'object');
    assert.ok(typeof result.types === 'object');
    assert.strictEqual(result.types.param1, 'int64');
    assert.strictEqual(result.types.param2, 'string');
  });

  test('SpannerTypeHint should support array types', () => {
    const typeHint: SpannerTypeHint = {
      type: 'array',
      child: 'string'
    };

    assert.strictEqual(typeHint.type, 'array');
    assert.strictEqual(typeHint.child, 'string');
  });

  test('SpannerTypeHint should support simple types', () => {
    const simpleTypes: SpannerTypeHint[] = [
      'int64',
      'float64', 
      'string',
      'bytes',
      'bool',
      'date',
      'timestamp'
    ];

    simpleTypes.forEach(type => {
      assert.ok(typeof type === 'string');
    });
  });

  test('TableSchema should allow column definitions', () => {
    const schema: TableSchema = {
      id: 'INT64',
      name: 'STRING',
      active: 'BOOL',
      created_at: 'TIMESTAMP'
    };

    assert.ok(typeof schema === 'object');
    assert.strictEqual(schema.id, 'INT64');
    assert.strictEqual(schema.name, 'STRING');
  });
});