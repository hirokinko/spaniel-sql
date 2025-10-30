import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDb, defineTable, ct, cmp, fn, lit } from 'spaniel-sql';

export function register_lit_nullif_tests() {
  const db = createDb();
  const T = defineTable('T', { a: ct.string(), b: ct.string(), n: ct.int64() });

  test('lit: 型ヒント明示で paramTypes を埋める', () => {
    const { sql, params, paramTypes } = db
      .from(T)
      .where((c) => cmp.eq(c.a, lit('X', ct.string()))) // 右辺は STRING と分かる
      .select((c) => ({ A: c.a }))
      .toSql();

    assert.match(sql, /\bWHERE\s+a\s=\s@p1\b/i);
    assert.deepEqual(params, { p1: 'X' });
    assert.deepEqual(paramTypes, { p1: 'STRING' });
  });

  test('NULLIF と COALESCE の組み合わせ', () => {
    const { sql, params, paramTypes } = db
      .from(T)
      .where((c) =>
        // COALESCE(NULLIF(a, ''), 'N/A') = 'N/A'
        cmp.eq(
          fn.coalesce(fn.nullIf(c.a, lit('', ct.string())), lit('N/A', ct.string())),
          lit('N/A', ct.string()),
        ),
      )
      .select((c) => ({ A: c.a }))
      .toSql();

    // WHERE COALESCE(NULLIF(a, @p1), @p2) = @p3
    assert.match(sql, /WHERE\s+COALESCE\(NULLIF\(a,\s*@p1\),\s*@p2\)\s*=\s*@p3/i);
    assert.deepEqual(params, { p1: '', p2: 'N/A', p3: 'N/A' });
    assert.deepEqual(paramTypes, { p1: 'STRING', p2: 'STRING', p3: 'STRING' });
  });

  test('ORDER BY で関数を使う（COALESCE DESC）', () => {
    const { sql, params } = db
      .from(T)
      .orderBy((c) => [
        // ORDER BY COALESCE(a, @p1) DESC, n ASC
        { expr: fn.coalesce(c.a, lit('z', ct.string())), dir: 'DESC' },
        { expr: c.n as any, dir: 'ASC' },
      ])
      .limit(5)
      .select((c) => ({ A: c.a, N: c.n }))
      .toSql();

    assert.match(sql, /ORDER BY\s+COALESCE\(a,\s*@p1\)\s+DESC,\s+n\s+ASC\s+LIMIT\s+@p2/i);
    assert.deepEqual(params, { p1: 'z', p2: 5 });
  });
}
