import { test, describe } from 'node:test';
import assert from 'node:assert';
import { SpannerDataType, ComparisonOperator, QueryResult, TableSchema, SpannerTypeHint, ParameterManager, createParameterManager } from '../src/types';

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

describe('ParameterManager', () => {
  test('ParameterManager should have immutable structure', () => {
    const manager: ParameterManager = {
      parameters: { param1: 'value1' },
      counter: 1
    };

    assert.ok(typeof manager === 'object');
    assert.ok(typeof manager.parameters === 'object');
    assert.ok(typeof manager.counter === 'number');
    assert.strictEqual(manager.parameters.param1, 'value1');
    assert.strictEqual(manager.counter, 1);
  });

  test('createParameterManager should create empty manager', () => {
    const manager = createParameterManager();

    assert.ok(typeof manager === 'object');
    assert.ok(typeof manager.parameters === 'object');
    assert.ok(typeof manager.counter === 'number');
    assert.deepStrictEqual(manager.parameters, {});
    assert.strictEqual(manager.counter, 0);
  });

  test('createParameterManager should return new instance each time', () => {
    const manager1 = createParameterManager();
    const manager2 = createParameterManager();

    assert.notStrictEqual(manager1, manager2);
    assert.deepStrictEqual(manager1.parameters, manager2.parameters);
    assert.strictEqual(manager1.counter, manager2.counter);
  });

  test('ParameterManager properties should be readonly at type level', () => {
    const manager = createParameterManager();
    
    // These should be readonly properties - TypeScript will catch attempts to modify
    assert.ok(Object.hasOwnProperty.call(manager, 'parameters'));
    assert.ok(Object.hasOwnProperty.call(manager, 'counter'));
  });
});