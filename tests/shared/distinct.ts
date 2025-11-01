import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDb, defineTable, ct } from 'spaniel-sql';

export function register_distinct_tests() {
  const db = createDb();
  const T = defineTable('T', { a: ct.string(), b: ct.int64() });

  test('SELECT DISTINCT', () => {
    const { sql } = db
      .from(T)
      .selectDistinct((c) => ({ a: c.a }))
      .toSql();
    assert.match(sql, /^SELECT DISTINCT\s+a\s+AS\s+a\s+FROM\s+T\b/i);
  });
}
