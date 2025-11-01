import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDb, defineTable, bool, cmp, ct } from 'spaniel-sql';

export function register_basic_tests() {
  test('from→where(bool.and)→select: SQL / params(record) / paramTypes', () => {
    const Project = defineTable('Project', {
      tenantId: ct.string(),
      projectId: ct.string(),
      createdAt: ct.timestamp(),
      createdAtUnixMillis: ct.int64(),
    });

    const db = createDb();
    const q = db
      .from(Project)
      .where((c) => bool.and([cmp.eq(c.tenantId, 't1'), cmp.eq(c.projectId, 'p1')]))
      .select((c) => ({
        id: c.projectId,
        createdAtMs: c.createdAtUnixMillis,
      }));

    const { sql, params, paramTypes } = q.toSql();

    assert.match(
      sql,
      /^SELECT\s+projectId\s+AS\s+id,\s+createdAtUnixMillis\s+AS\s+createdAtMs\s+FROM\s+Project\s+WHERE\s+\(tenantId\s=\s@p1\sAND\sprojectId\s=\s@p2\)\s*$/i,
    );
    assert.deepEqual(params, { p1: 't1', p2: 'p1' });
    assert.deepEqual(paramTypes, { p1: 'STRING', p2: 'STRING' });
  });
}
