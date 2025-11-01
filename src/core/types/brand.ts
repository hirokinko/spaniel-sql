import type { Expr } from '../ast.js';

export type Brand<T, B extends string> = T & { readonly __brand?: B };

export type ScalarExpr = Brand<Expr, 'scalar'>;
export type AggExpr = Brand<Expr, 'agg'>;
export type GroupKeyExpr = Brand<Expr, 'group'>;

// ヘルパ: 実体はただの Expr。型だけ乗せる
export const asScalar = (e: Expr): ScalarExpr => e as ScalarExpr;
export const asAgg = (e: Expr): AggExpr => e as AggExpr;
export const asGroupKey = (e: Expr): GroupKeyExpr => e as GroupKeyExpr;

// asGroupKey のショートハンド
export const g = asGroupKey;
