import type { Expr } from '../ast';
import { isStrict, QueryBuildError } from '../safety';
import type { ColumnType, SpType } from '../schema';
import { isExpr } from './shared.js';

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
