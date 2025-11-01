import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDb, defineTable, ct, cmp, ag, g, asc, desc } from 'spaniel-sql';

export function register_grouping_tests() {
  const db = createDb();
  const T = defineTable('T', {
    k: ct.string(),
    n: ct.int64(),
    v: ct.float64(),
  });

  test('GROUP BY + COUNT(1)', () => {
    const { sql } = db
      .from(T)
      .groupBy((c) => [c.k]) // group key の抽出（ここは生列でOK）
      .select((c) => ({
        k: g(c.k), // select で使うときは g() で group key 明示
        cnt: ag.countAll(),
      }))
      .toSql();

    assert.match(sql, /\bSELECT\s+k\s+AS\s+k,\s+COUNT\((1|@p\d+)\)\s+AS\s+cnt\s+FROM\s+T\b/i);
    assert.match(sql, /\bGROUP BY\s+k\b/i);
  });

  test('HAVING with SUM > 0', () => {
    const { sql, params } = db
      .from(T)
      .groupBy((c) => [c.k])
      .having((c) => cmp.gt(ag.sum(c.n as any), 0))
      .select((c) => ({
        k: g(c.k),
        s: ag.sum(c.n as any),
      }))
      .toSql();

    assert.match(sql, /\bGROUP BY\s+k\s+HAVING\s+SUM\(n\)\s*>\s*@p1\b/i);
    assert.deepEqual(params, { p1: 0 });
  });

  test('ORDER BY with group key & aggregate + LIMIT/OFFSET', () => {
    const { sql } = db
      .from(T)
      .groupBy((c) => [c.k])
      .orderBy((c) => [asc(g(c.k)), desc(ag.sum(c.n as any))])
      .limit(5)
      .offset(10)
      .select((c) => ({
        k: g(c.k),
        s: ag.sum(c.n as any),
      }))
      .toSql();

    assert.match(sql, /\bORDER BY\s+k\sASC,\s+SUM\(n\)\sDESC\b/i);
    assert.match(sql, /\bLIMIT\s+@p\d+\s+OFFSET\s+@p\d+\b/i);
  });

  test('PLAIN select (no groupBy)', () => {
    const { sql } = db
      .from(T)
      .where((c) => cmp.gt(c.n as any, 0))
      .orderBy((c) => asc(c.k))
      .limit(3)
      .select((c) => ({
        k: c.k,
        n: c.n,
      }))
      .toSql();

    assert.match(sql, /^SELECT\s+k\s+AS\s+k,\s+n\s+AS\s+n\s+FROM\s+T\b/i);
    assert.match(sql, /\bWHERE\s+n\s>\s@p1\b/i);
    assert.match(sql, /\bORDER BY\s+k\sASC\s+LIMIT\s+@p2\b/i);
  });
}
