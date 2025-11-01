import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDb, defineTable, ct, nullsFirst, nullsLast } from 'spaniel-sql';

export function register_order_nulls_tests() {
  const db = createDb();
  const T = defineTable('T', { v: ct.int64() });

  test('ORDER BY NULLS FIRST emulation', () => {
    const { sql } = db
      .from(T)
      .orderBy((c) => [...nullsFirst(c.v, 'ASC')])
      .select((c) => ({ v: c.v }))
      .toSql();
    assert.match(sql, /\bORDER BY\s+v\s+IS\s+NULL\s+DESC,\s+v\s+ASC\b/i);
  });

  test('ORDER BY NULLS LAST emulation', () => {
    const { sql } = db
      .from(T)
      .orderBy((c) => [...nullsLast(c.v, 'DESC')])
      .select((c) => ({ v: c.v }))
      .toSql();
    assert.match(sql, /\bORDER BY\s+v\s+IS\s+NULL\s+ASC,\s+v\s+DESC\b/i);
  });
}
