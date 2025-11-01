import type { Expr } from '../ast.js';
import { isExpr } from './shared.js';

export type BoolOps = {
  and: (items: Array<Expr | null | undefined | false>) => Expr;
  or: (items: Array<Expr | null | undefined | false>) => Expr;
};

export const TRUE: Expr = { kind: 'bool', value: true };
export const FALSE: Expr = { kind: 'bool', value: false };
export const bool: BoolOps = {
  and(items) {
    const xs = items.filter(isExpr);
    if (xs.length === 0) {
      return TRUE;
    }
    if (xs.length === 1 && xs[0] !== undefined) {
      return xs[0];
    }
    return { kind: 'bool_nary', op: 'AND', items: xs };
  },
  or(items) {
    const xs = items.filter(isExpr);
    if (xs.length === 0) {
      return FALSE;
    }
    if (xs.length === 1 && xs[0] !== undefined) {
      return xs[0];
    }
    return { kind: 'bool_nary', op: 'OR', items: xs };
  },
};
