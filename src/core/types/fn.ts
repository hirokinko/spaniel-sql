import type { Expr } from '../ast';

export const fn = {
  coalesce: (...items: Expr[]): Expr => {
    const xs = items.filter(Boolean);
    if (xs.length === 0) {
      return { kind: 'literal', value: null };
    }
    if (xs.length === 1 && xs[0] !== undefined) {
      return xs[0];
    }
    return { kind: 'coalesce', items: xs };
  },
  isNull: (e: Expr): Expr => ({ kind: 'is_null', expr: e }),
  notNull: (e: Expr): Expr => ({ kind: 'is_not_null', expr: e }),
  nullIf: (a: Expr, b: Expr): Expr => ({ kind: 'nullif', a, b }),
};
