import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDb, defineTable, ct, cmp, bool, fn } from 'spaniel-sql';

export function register_coalesce_nulls_tests() {
  const db = createDb();
  const T = defineTable('T', { a: ct.string(), n: ct.int64() });

  test('COALESCE を WHERE で使用', () => {
    const { sql, params, paramTypes } = db
      .from(T)
      .where((c) => bool.and([cmp.eq(fn.coalesce(c.a, { kind: 'literal', value: 'x' }), 'y')]))
      .select((c) => ({ A: c.a }))
      .toSql();

    // WHERE COALESCE(a, @p1) = @p2
    assert.match(sql, /WHERE\s+COALESCE\(a,\s*@p1\)\s*=\s*@p2/i);
    assert.deepEqual(params, { p1: 'x', p2: 'y' });
    // a は STRING だが、リテラル 'x' は P0 では型推測しないため paramTypes は空のままでOK
    assert.deepEqual(paramTypes, {});
  });

  test('IS NULL / IS NOT NULL', () => {
    const { sql } = db
      .from(T)
      .where((c) => bool.and([fn.isNull(c.a), fn.notNull(c.n)]))
      .select((c) => ({ N: c.n }))
      .toSql();

    // WHERE (a IS NULL AND n IS NOT NULL)
    assert.match(sql, /\bWHERE\s+\(a\s+IS\s+NULL\s+AND\s+n\s+IS\s+NOT\s+NULL\)/i);
  });

  test('COALESCE を SELECT 投影で使用', () => {
    const { sql, params } = db
      .from(T)
      .select((c) => ({
        a_or_default: fn.coalesce(c.a, { kind: 'literal', value: 'N/A' }),
      }))
      .toSql();

    // SELECT COALESCE(a, @p1) AS a_or_default FROM T
    assert.match(sql, /^SELECT\s+COALESCE\(a,\s*@p1\)\s+AS\s+a_or_default\s+FROM\s+T\s*$/i);
    assert.deepEqual(params, { p1: 'N/A' });
  });
}
