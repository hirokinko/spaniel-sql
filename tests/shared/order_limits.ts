import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDb, defineTable, ct, cmp, bool, asc, desc } from 'spaniel-sql';

export function register_order_limit_tests() {
  const T = defineTable('T', { a: ct.string(), b: ct.string(), n: ct.int64() });
  const db = createDb();

  test('ORDER BY / LIMIT / OFFSET', () => {
    const { sql, params, paramTypes } = db
      .from(T)
      .where((c) => bool.and([ cmp.like(c.a, 'x%'), cmp.in(c.b, ['B1','B2']) ]))
      .orderBy((c) => [asc(c.a), desc(c.n)])
      .limit(10)
      .offset(20)
      .select((c) => ({ A: c.a, N: c.n }))
      .toSql();

    assert.match(sql, /^SELECT\s+a\s+AS\s+A,\s+n\s+AS\s+N\s+FROM\s+T\s+WHERE\s+\(a\sLIKE\s@p1\sAND\s+b\sIN\s\(@p2,\s@p3\)\)\s+ORDER BY\s+a\sASC,\s+n\sDESC\s+LIMIT\s+@p4\s+OFFSET\s+@p5\s*$/i);
    assert.deepEqual(params, { p1: 'x%', p2: 'B1', p3: 'B2', p4: 10, p5: 20 });
    // a,b は STRING, n は INT64。LIMIT/OFFSET は型ヒントなし
    assert.deepEqual(paramTypes, { p1: 'STRING', p2: 'STRING', p3: 'STRING' });
  });

  test('cmp.in([]) は WHERE FALSE', () => {
    const { sql } = db
      .from(T)
      .where((c) => bool.and([ cmp.in(c.a, []) ]))
      .select((c) => ({ A: c.a }))
      .toSql();

    assert.match(sql, /\bWHERE\s+FALSE\b/);
  });

  test('cmp.between 展開', () => {
    const { sql, params } = db
      .from(T)
      .where((c) => cmp.between(c.n, 5, 9))
      .select((c) => ({ N: c.n }))
      .toSql();

    // (n >= @p1 AND n <= @p2)
    assert.match(sql, /WHERE\s+\(n\s*>=\s*@p1\s+AND\s+n\s*<=\s*@p2\)\s*$/i);
    assert.deepEqual(params, { p1: 5, p2: 9 });
  });
}
