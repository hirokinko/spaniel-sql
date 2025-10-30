import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDb, defineTable, bool, cmp, ct } from 'spaniel-sql';

export function register_bool_nary_tests() {
  const T = defineTable('T', { a: ct.string(), b: ct.string(), c: ct.timestamp() });

  test('AND([]) → WHERE TRUE, params={}, paramTypes={}', () => {
    const db = createDb();
    const { sql, params, paramTypes } = db
      .from(T)
      .where((_c) => bool.and([]))
      .select((c) => ({ a: c.a }))
      .toSql();

    assert.match(sql, /\bWHERE\s+TRUE\b/);
    assert.deepEqual(params, {});
    assert.deepEqual(paramTypes, {});
  });

  test('AND([x]) は x 単体', () => {
    const db = createDb();
    const { sql, params, paramTypes } = db
      .from(T)
      .where((c) => bool.and([cmp.eq(c.a, 'X')]))
      .select((c) => ({ a: c.a }))
      .toSql();

    assert.match(sql, /\bWHERE\s+a\s=\s@p1\b/);
    assert.deepEqual(params, { p1: 'X' });
    assert.deepEqual(paramTypes, { p1: 'STRING' });
  });

  test('ネスト AND( a= , OR( b= , b= ) , c>= ) と型ヒント', () => {
    const db = createDb();
    const { sql, params, paramTypes } = db
      .from(T)
      .where((c) =>
        bool.and([
          cmp.eq(c.a, 'A'),
          bool.or([cmp.eq(c.b, 'B1'), cmp.eq(c.b, 'B2')]),
          cmp.ge(c.c, '2024-01-01T00:00:00Z'),
        ]),
      )
      .select((c) => ({ a: c.a }))
      .toSql();

    assert.match(sql, /\bFROM\s+T\s+WHERE\s+\(/);
    assert.deepEqual(params, {
      p1: 'A',
      p2: 'B1',
      p3: 'B2',
      p4: '2024-01-01T00:00:00Z',
    });
    assert.deepEqual(paramTypes, {
      p1: 'STRING',
      p2: 'STRING',
      p3: 'STRING',
      p4: 'TIMESTAMP',
    });
  });
}
