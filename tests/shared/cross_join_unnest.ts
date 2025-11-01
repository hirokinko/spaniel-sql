import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDb, defineTable, ct } from 'spaniel-sql';

export function register_unnest_tests() {
  const db = createDb();
  const T = defineTable('T', { id: ct.string(), tags: ct.array(ct.string()) });

  test('CROSS JOIN UNNEST(array column)', () => {
    const { sql } = db
      .from(T)
      .crossJoinUnnest((c) => c.tags as any, 'tag')
      .select((c) => ({ id: c.id }))
      .toSql();

    assert.match(sql, /\bFROM\s+T\s+CROSS JOIN\s+UNNEST\(tags\)\s+AS\s+tag\b/i);
  });
}
