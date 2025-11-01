import type { Expr } from '../ast';

export const isExpr = (x: unknown): x is Expr =>
  !!x && typeof x === 'object' && 'kind' in (x as any);
