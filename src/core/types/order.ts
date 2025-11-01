import type { Expr, OrderItem } from '../ast';

// 並び順ヘルパ
export const asc = (e: Expr): OrderItem => ({ expr: e, dir: 'ASC' });
export const desc = (e: Expr): OrderItem => ({ expr: e, dir: 'DESC' });
