import type { Expr, OrderItem, Projection, SelectStmt } from './ast.js';
import { isStrict, QueryBuildError } from './safety.js';
import type { ColumnProxy, ColumnType } from './schema.js';
import type { SpType } from './schema.js';

const isExpr = (x: unknown): x is BoolExpr => !!x && typeof x === 'object' && 'kind' in (x as any);
export type BoolExpr = Expr;
export const TRUE: BoolExpr = { kind: 'bool', value: true };
export const FALSE: BoolExpr = { kind: 'bool', value: false };
export type BoolOps = {
  and: (items: Array<BoolExpr | null | undefined | false>) => BoolExpr;
  or: (items: Array<BoolExpr | null | undefined | false>) => BoolExpr;
};
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

function forbidNull(label: string, v: unknown, advice?: string) {
  if (isStrict() && (v === null || v === undefined)) {
    throw new QueryBuildError(`${label}: null/undefined is not allowed. ${advice ?? ''}`.trim());
  }
}

function ensureArray(label: string, arr: unknown[]) {
  if (isStrict()) {
    if (!Array.isArray(arr)) {
      throw new QueryBuildError(`${label}: requires an array.`);
    }
    if (arr.length === 0) {
      return 'empty'; // 呼び出し側で FALSE へ
    }
    if (arr.some((x) => x === null || x === undefined)) {
      throw new QueryBuildError(`${label}: array contains null/undefined. Clean the list first.`);
    }
  }
  return 'ok';
}

// 比較演算：左が列ならその列型を右パラメータの hint に埋め込む
export type CmpOps = {
  eq: (l: Expr, r: unknown) => Expr;
  ne: (l: Expr, r: unknown) => Expr;
  gt: (l: Expr, r: unknown) => Expr;
  ge: (l: Expr, r: unknown) => Expr;
  lt: (l: Expr, r: unknown) => Expr;
  le: (l: Expr, r: unknown) => Expr;
  like: (l: Expr, pattern: unknown) => Expr;
  between: (l: Expr, from: unknown, to: unknown) => Expr;
  in: (l: Expr, values: unknown[]) => Expr;
  inUnnest: (l: Expr, values: unknown[]) => Expr;
};
export const cmp: CmpOps = {
  eq: (l, r) => {
    forbidNull('cmp.eq', r, 'Use fn.isNull(col) or fn.notNull(col) instead.');
    return {
      kind: 'binary',
      op: '=',
      left: l,
      right: toParam(r, (l as any).spType),
    } as const;
  },
  ne: (l, r) => {
    forbidNull('cmp.ne', r, 'Use fn.isNull(col) or fn.notNull(col) instead.');
    return {
      kind: 'binary',
      op: '!=',
      left: l,
      right: toParam(r, (l as any).spType),
    } as const;
  },
  gt: (l, r) => {
    forbidNull('cmp.gt', r);
    return {
      kind: 'binary',
      op: '>',
      left: l,
      right: toParam(r, (l as any).spType),
    } as const;
  },
  ge: (l, r) => {
    forbidNull('cmp.ge', r);
    return {
      kind: 'binary',
      op: '>=',
      left: l,
      right: toParam(r, (l as any).spType),
    } as const;
  },
  lt: (l, r) => {
    forbidNull('cmp.lt', r);
    return {
      kind: 'binary',
      op: '<',
      left: l,
      right: toParam(r, (l as any).spType),
    } as const;
  },
  le: (l, r) => {
    forbidNull('cmp.le', r);
    return {
      kind: 'binary',
      op: '<=',
      left: l,
      right: toParam(r, (l as any).spType),
    } as const;
  },
  like: (l, pattern) => {
    forbidNull('cmp.like', pattern);
    return {
      kind: 'binary',
      op: 'LIKE',
      left: l,
      right: toParam(pattern, (l as any).spType),
    } as const;
  },
  between: (l, from, to) => {
    forbidNull('cmp.between(from)', from);
    forbidNull('cmp.between(to)', to);
    return {
      kind: 'bool_nary',
      op: 'AND',
      items: [
        {
          kind: 'binary',
          op: '>=',
          left: l,
          right: toParam(from, (l as any).spType),
        },
        {
          kind: 'binary',
          op: '<=',
          left: l,
          right: toParam(to, (l as any).spType),
        },
      ],
    } as const;
  },
  in: (l, values) => {
    const state = ensureArray('cmp.in', values);
    if (state === 'empty') {
      return FALSE;
    }
    const t = (l as any).spType as SpType | undefined;
    if (!values || values.length === 0) {
      return FALSE;
    }
    const items = values.map((v) => toParam(v, t));
    return { kind: 'in_list', left: l, items };
  },
  inUnnest: (l, values) => {
    const state = ensureArray('cmp.inUnnest', values);
    if (state === 'empty') {
      return FALSE;
    }
    const t = (l as any).spType as SpType | undefined;
    const param = toParam(values, t ? { kind: 'array', of: t } : undefined);
    return { kind: 'in_unnest', left: l, param };
  },
};
export type ColumnExpr = {
  kind: 'column';
  table: string;
  name: string;
  spType?: SpType;
};
export function createColumnProxy<C extends Record<string, ColumnType<any>>>(
  table: string,
  columns: C,
): ColumnProxy<C> {
  return new Proxy(
    {},
    {
      get(_t, prop) {
        if (typeof prop !== 'string') {
          return undefined as any;
        }
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
  // strictモードのときは明示ガードする
  if (isStrict()) {
    if (value === undefined) {
      throw new QueryBuildError(
        `toParam(): received undefined. Use NULL explicitly (lit(null, hint)) or fix the caller.`,
      );
    }
    // NaN/Infinity は危険。FLOAT64でも事故が多いので既定で禁止
    if (typeof value === 'number' && !Number.isFinite(value)) {
      throw new QueryBuildError(`toParam(): NaN/Infinity is not allowed; provide a finite number.`);
    }
  }

  if (isExpr(value)) {
    if (value.kind === 'param') {
      return hint ? { ...value, hint: hint ?? value.hint } : value;
    }
    if (value.kind === 'literal') {
      const h = hint ?? (value as any).hint;
      return h === undefined
        ? { kind: 'param', value: value.value }
        : { kind: 'param', value: value.value, hint: h };
    }
    // それ以外（column など）は param 化の対象ではないので、そのまま返すのはNG。
    // toParam は「右辺値専用」なので、ここに来るのは設計ミスとみなしてエラーにしておくと安全。
    throw new QueryBuildError(
      'toParam(): unsupported Expr on right-hand side. Pass a JS value or a param/literal.',
    );
  }
  return hint === undefined ? { kind: 'param', value } : { kind: 'param', value, hint };
}

type LitHint = SpType | ColumnType<any> | undefined;
const toSpType = (h: LitHint): SpType | undefined => {
  if (!h) {
    return undefined;
  }
  // ColumnType のときは __sp を拾う
  // ColumnType なら __sp を返し、そうでなければそのまま SpType として返す
  if ((h as ColumnType<any>).__sp !== undefined) {
    return (h as ColumnType<any>).__sp;
  }
  return h as SpType;
};

export function lit(value: unknown, hint?: LitHint): Expr {
  if (isStrict()) {
    if (value === undefined) {
      throw new QueryBuildError(`lit(): received undefined. Use lit(null, hint) if you want NULL.`);
    }
    if (typeof value === 'number' && !Number.isFinite(value)) {
      throw new QueryBuildError(`lit(): NaN/Infinity is not allowed; provide a finite number.`);
    }
  }
  // Expr を渡されても param に「中身の値」を入れる
  if (isExpr(value)) {
    if (value.kind === 'param') {
      // 明示ヒントが来たら上書き、なければそのまま流用
      const h = toSpType(hint);
      return h === undefined ? value : { ...value, hint: h };
    }
    if (value.kind === 'literal') {
      const h = toSpType(hint) ?? (value as any).hint;
      return h === undefined
        ? { kind: 'param', value: (value as any).value }
        : { kind: 'param', value: (value as any).value, hint: h };
    }
    throw new Error('lit(): value must be a JS literal/param, not an expression node.');
  }
  const h = toSpType(hint);
  return h === undefined ? { kind: 'param', value } : { kind: 'param', value, hint: h };
}

export type FinalQuery<S> = {
  _shape?: S;
  toSql: () => {
    sql: string;
    params: Record<string, unknown>;
    paramTypes: Record<string, string>;
  };
};

export type FromStep<TSources, C extends Record<string, any>> = {
  where: (predicate: (c: ColumnProxy<C>) => BoolExpr) => FromStep<TSources, C>;
  orderBy: (
    pick: (
      c: ColumnProxy<C>,
    ) => { expr: Expr; dir: 'ASC' | 'DESC' }[] | { expr: Expr; dir: 'ASC' | 'DESC' },
  ) => FromStep<TSources, C>;
  limit: (n: number) => FromStep<TSources, C>;
  offset: (n: number) => FromStep<TSources, C>;
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
    if (
      v &&
      typeof v === 'object' &&
      ((v as any).kind === 'column' || (v as any).kind === 'coalesce')
    ) {
      out.push({ expr: v as ColumnExpr, alias });
    } else if (v === null || ['string', 'number', 'boolean'].includes(typeof v)) {
      out.push({ expr: { kind: 'literal', value: v as any }, alias });
    } else {
      throw new Error(`Unsupported projection value for "${alias}" in table "${table}"`);
    }
  }
  return out;
}

// 並び順ヘルパ
export const asc = (e: Expr): OrderItem => ({ expr: e, dir: 'ASC' });
export const desc = (e: Expr): OrderItem => ({ expr: e, dir: 'DESC' });

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
