import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDb, defineTable, ct, cmp, bool, fn } from 'spaniel-sql';

export function register_coalesce_more_tests() {
  const db = createDb();
  const T = defineTable('T', { a: ct.string(), b: ct.string() });

  test('COALESCE 単項はそのまま', () => {
    const { sql } = db
      .from(T)
      .where((c) => cmp.eq(fn.coalesce(c.a), 'x'))
      .select((c) => ({ A: c.a }))
      .toSql();
    assert.match(sql, /WHERE\s+a\s=\s@p1/i);
  });

  test('COALESCE 空は NULL にフォールバック', () => {
    const { sql } = db
      .from(T)
      // 空 coalesce は NULL になる実装に合わせる（@p化 or 直接NULL）
      .where((_c) => cmp.eq(fn.coalesce() as any, 'x'))
      .select((c) => ({ A: c.a }))
      .toSql();
    assert.ok(/COALESCE\(/.test(sql) === false); // 実装どおりなら COALESCE は出ない
  });

  test('IS NOT NULL と LIKE の結合（括弧維持）', () => {
    const { sql } = db
      .from(T)
      .where((c) => bool.and([fn.notNull(c.a), cmp.like(c.b, 'x%')]))
      .select((c) => ({ A: c.a }))
      .toSql();
    assert.match(sql, /\bWHERE\s+\(a\s+IS\s+NOT\s+NULL\s+AND\s+b\s+LIKE\s+@p1\)/i);
  });
}
