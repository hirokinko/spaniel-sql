import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDb, defineTable, ct, cmp, bool } from 'spaniel-sql';

export function register_unnest_tests() {
  const db = createDb();
  const T = defineTable('T', { id: ct.string(), n: ct.int64() });

  test('cmp.inUnnest: STRING 配列', () => {
    const ids = ['a', 'b'];
    const { sql, params, paramTypes } = db
      .from(T)
      .where((c) => bool.and([cmp.inUnnest(c.id, ids)]))
      .select((c) => ({ id: c.id }))
      .toSql();

    assert.match(sql, /WHERE\s+id\s+IN\s+UNNEST\(@p1\)/i);
    assert.deepEqual(params, { p1: ids });
    assert.deepEqual(paramTypes, { p1: 'ARRAY<STRING>' });
  });

  test('cmp.inUnnest: 空配列→WHERE FALSE', () => {
    const { sql, params, paramTypes } = db
      .from(T)
      .where((c) => cmp.inUnnest(c.id, []))
      .select((c) => ({ id: c.id }))
      .toSql();

    assert.match(sql, /WHERE\s+FALSE/i);
    assert.deepEqual(params, {});
    assert.deepEqual(paramTypes, {});
  });

  test('cmp.inUnnest: INT64 配列', () => {
    const nums = [1, 2, 3];
    const { sql, params, paramTypes } = db
      .from(T)
      .where((c) => cmp.inUnnest(c.n, nums))
      .select((c) => ({ n: c.n }))
      .toSql();

    assert.match(sql, /WHERE\s+n\s+IN\s+UNNEST\(@p1\)/i);
    assert.deepEqual(params, { p1: nums });
    assert.deepEqual(paramTypes, { p1: 'ARRAY<INT64>' });
  });
}
