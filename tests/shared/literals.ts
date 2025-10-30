import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDb, defineTable, ct } from 'spaniel-sql';

export function register_literal_projection_tests() {
  test('投影リテラルは params のみ（paramTypesは空）', () => {
    const Any = defineTable('Any', { x: ct.string() });
    const db = createDb();
    const { sql, params, paramTypes } = db
      .from(Any)
      .select((_c) => ({ one: 1, truthy: true, text: 'hello', nil: null }))
      .toSql();

    assert.match(
      sql,
      /^SELECT\s+@p1\s+AS\s+one,\s+@p2\s+AS\s+truthy,\s+@p3\s+AS\s+text,\s+@p4\s+AS\s+nil\s+FROM\s+Any\s*$/,
    );
    assert.deepEqual(params, { p1: 1, p2: true, p3: 'hello', p4: null });
    assert.deepEqual(paramTypes, {});
  });
}
