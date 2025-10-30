import type { Expr, Projection, SelectStmt } from './ast.js';
import type { ColumnProxy, ColumnType } from './schema.js';
import type { SpType } from './schema.js';

export type BoolExpr = Expr;
export const TRUE: BoolExpr = { kind: 'bool', value: true };
export const FALSE: BoolExpr = { kind: 'bool', value: false };
const isExpr = (x: unknown): x is BoolExpr => !!x && typeof x === 'object' && 'kind' in (x as any);
export type BoolOps = {
  and: (items: Array<BoolExpr | null | undefined | false>) => BoolExpr;
  or: (items: Array<BoolExpr | null | undefined | false>) => BoolExpr;
};
export const bool: BoolOps = {
  and(items) {
    const xs = items.filter(isExpr);
    if (xs.length === 0) return TRUE;
    if (xs.length === 1) return xs[0]!;
    return { kind: 'bool_nary', op: 'AND', items: xs };
  },
  or(items) {
    const xs = items.filter(isExpr);
    if (xs.length === 0) return FALSE;
    if (xs.length === 1) return xs[0]!;
    return { kind: 'bool_nary', op: 'OR', items: xs };
  },
}

// 比較演算：左が列ならその列型を右パラメータの hint に埋め込む
export type CmpOps = {
  eq: (left: Expr, right: unknown) => BoolExpr;
  ne: (left: Expr, right: unknown) => BoolExpr;
  gt: (left: Expr, right: unknown) => BoolExpr;
  ge: (left: Expr, right: unknown) => BoolExpr;
  lt: (left: Expr, right: unknown) => BoolExpr;
  le: (left: Expr, right: unknown) => BoolExpr;
};

export const cmp: CmpOps = {
  eq: (l, r) => ({ kind: 'binary', op: '=',  left: l, right: toParam(r,  (l as any).spType) } as const),
  ne: (l, r) => ({ kind: 'binary', op: '!=', left: l, right: toParam(r,  (l as any).spType) } as const),
  gt: (l, r) => ({ kind: 'binary', op: '>',  left: l, right: toParam(r,  (l as any).spType) } as const),
  ge: (l, r) => ({ kind: 'binary', op: '>=', left: l, right: toParam(r,  (l as any).spType) } as const),
  lt: (l, r) => ({ kind: 'binary', op: '<',  left: l, right: toParam(r,  (l as any).spType) } as const),
  le: (l, r) => ({ kind: 'binary', op: '<=', left: l, right: toParam(r,  (l as any).spType) } as const),
};

export type ColumnExpr = { kind: 'column'; table: string; name: string; spType?: SpType };
export function createColumnProxy<C extends Record<string, ColumnType<any>>>(
  table: string,
  columns: C,
): ColumnProxy<C> {
  return new Proxy(
    {},
    {
      get(_t, prop) {
        if (typeof prop !== 'string') return undefined as any;
        const def = (columns as any)[prop];
        const spType: SpType | undefined = def && (def as ColumnType<any>).__sp;
        return { kind: 'column', table, name: prop, spType } as any;
      },
      has() {
        return true;
      },
    },
  ) as ColumnProxy<C>;
}

export function toParam(value: unknown, hint?: SpType): Expr {
  if (hint === undefined) return { kind: 'param', value };
  return { kind: 'param', value, hint };
}

export type FinalQuery<S> = {
  _shape?: S;
  toSql: () => { sql: string; params: Record<string, unknown>; paramTypes: Record<string, string> };
};

export type FromStep<TSources, C extends Record<string, any>> = {
  where: (
    predicate: (c: ColumnProxy<C>) => BoolExpr,
  ) => FromStep<TSources, C>;
  select: <S>(project: (c: ColumnProxy<C>, fn: Record<string, never>) => S) => FinalQuery<S>;
};

export type BuildContext<C extends Record<string, ColumnType<any>>> = {
  table: string;
  columns: C;
  stmt: SelectStmt;
};

export function objectToProjections(obj: Record<string, any>, table: string): Projection[] {
  const out: Projection[] = [];
  for (const [alias, v] of Object.entries(obj)) {
    if (v && typeof v === 'object' && (v as any).kind === 'column') {
      out.push({ expr: v as ColumnExpr, alias });
    } else if (v === null || ['string', 'number', 'boolean'].includes(typeof v)) {
      out.push({ expr: { kind: 'literal', value: v as any }, alias });
    } else {
      throw new Error(`Unsupported projection value for "${alias}" in table "${table}"`);
    }
  }
  return out;
}
