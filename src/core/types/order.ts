import type { Expr, OrderItem } from '../ast';

// 並び順ヘルパ
export const asc = (e: Expr): OrderItem => ({ expr: e, dir: 'ASC' });
export const desc = (e: Expr): OrderItem => ({ expr: e, dir: 'DESC' });

// NULLS FIRST / LAST のエミュレーション
export function nullsFirst(e: Expr, dir: 'ASC' | 'DESC' = 'ASC'): OrderItem[] {
  return [
    { expr: { kind: 'is_null', expr: e }, dir: 'DESC' }, // NULL=TRUE(1) → 先頭
    { expr: e, dir },
  ];
}
export function nullsLast(e: Expr, dir: 'ASC' | 'DESC' = 'ASC'): OrderItem[] {
  return [
    { expr: { kind: 'is_null', expr: e }, dir: 'ASC' }, // NULL=TRUE(1) → 末尾
    { expr: e, dir },
  ];
}
