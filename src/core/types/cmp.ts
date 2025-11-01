import type { Expr } from '../ast';
import { isStrict, QueryBuildError } from '../safety';
import type { SpType } from '../schema';
import { FALSE } from './bool';
import { toParam } from './param';

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
