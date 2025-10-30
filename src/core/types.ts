import type { Expr, OrderItem, Projection, SelectStmt } from "./ast.js";
import type { ColumnProxy, ColumnType } from "./schema.js";
import type { SpType } from "./schema.js";

export type BoolExpr = Expr;
export const TRUE: BoolExpr = { kind: "bool", value: true };
export const FALSE: BoolExpr = { kind: "bool", value: false };
const isExpr = (x: unknown): x is BoolExpr =>
  !!x && typeof x === "object" && "kind" in (x as any);
export type BoolOps = {
  and: (items: Array<BoolExpr | null | undefined | false>) => BoolExpr;
  or: (items: Array<BoolExpr | null | undefined | false>) => BoolExpr;
};
export const bool: BoolOps = {
  and(items) {
    const xs = items.filter(isExpr);
    if (xs.length === 0) return TRUE;
    if (xs.length === 1) return xs[0]!;
    return { kind: "bool_nary", op: "AND", items: xs };
  },
  or(items) {
    const xs = items.filter(isExpr);
    if (xs.length === 0) return FALSE;
    if (xs.length === 1) return xs[0]!;
    return { kind: "bool_nary", op: "OR", items: xs };
  },
};

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
};
export const cmp: CmpOps = {
  eq: (l, r) =>
    ({
      kind: "binary",
      op: "=",
      left: l,
      right: toParam(r, (l as any).spType),
    } as const),
  ne: (l, r) =>
    ({
      kind: "binary",
      op: "!=",
      left: l,
      right: toParam(r, (l as any).spType),
    } as const),
  gt: (l, r) =>
    ({
      kind: "binary",
      op: ">",
      left: l,
      right: toParam(r, (l as any).spType),
    } as const),
  ge: (l, r) =>
    ({
      kind: "binary",
      op: ">=",
      left: l,
      right: toParam(r, (l as any).spType),
    } as const),
  lt: (l, r) =>
    ({
      kind: "binary",
      op: "<",
      left: l,
      right: toParam(r, (l as any).spType),
    } as const),
  le: (l, r) =>
    ({
      kind: "binary",
      op: "<=",
      left: l,
      right: toParam(r, (l as any).spType),
    } as const),
  like: (l, pattern) =>
    ({
      kind: "binary",
      op: "LIKE",
      left: l,
      right: toParam(pattern, (l as any).spType),
    } as const),
  between: (l, from, to) =>
    ({
      kind: "bool_nary",
      op: "AND",
      items: [
        {
          kind: "binary",
          op: ">=",
          left: l,
          right: toParam(from, (l as any).spType),
        },
        {
          kind: "binary",
          op: "<=",
          left: l,
          right: toParam(to, (l as any).spType),
        },
      ],
    } as const),
  in: (l, values) => {
    const t = (l as any).spType as SpType | undefined;
    if (!values || values.length === 0) return FALSE;
    const items = values.map((v) => toParam(v, t));
    return { kind: "in_list", left: l, items };
  },
};
export type ColumnExpr = {
  kind: "column";
  table: string;
  name: string;
  spType?: SpType;
};
export function createColumnProxy<C extends Record<string, ColumnType<any>>>(
  table: string,
  columns: C
): ColumnProxy<C> {
  return new Proxy(
    {},
    {
      get(_t, prop) {
        if (typeof prop !== "string") return undefined as any;
        const def = (columns as any)[prop];
        const spType: SpType | undefined = def && (def as ColumnType<any>).__sp;
        return { kind: "column", table, name: prop, spType } as any;
      },
      has() {
        return true;
      },
    }
  ) as ColumnProxy<C>;
}

export function toParam(value: unknown, hint?: SpType): Expr {
  if (hint === undefined) return { kind: "param", value };
  return { kind: "param", value, hint };
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
      c: ColumnProxy<C>
    ) =>
      | { expr: Expr; dir: "ASC" | "DESC" }[]
      | { expr: Expr; dir: "ASC" | "DESC" }
  ) => FromStep<TSources, C>;
  limit: (n: number) => FromStep<TSources, C>;
  offset: (n: number) => FromStep<TSources, C>;
  select: <S>(
    project: (c: ColumnProxy<C>, fn: Record<string, never>) => S
  ) => FinalQuery<S>;
};

export type BuildContext<C extends Record<string, ColumnType<any>>> = {
  table: string;
  columns: C;
  stmt: SelectStmt;
};

export function objectToProjections(
  obj: Record<string, any>,
  table: string
): Projection[] {
  const out: Projection[] = [];
  for (const [alias, v] of Object.entries(obj)) {
    if (v && typeof v === "object" && ((v as any).kind === "column" || (v as any).kind === "coalesce")) {
      out.push({ expr: v as ColumnExpr, alias });
    } else if (
      v === null ||
      ["string", "number", "boolean"].includes(typeof v)
    ) {
      out.push({ expr: { kind: "literal", value: v as any }, alias });
    } else {
      throw new Error(
        `Unsupported projection value for "${alias}" in table "${table}"`
      );
    }
  }
  return out;
}

// 並び順ヘルパ
export const asc = (e: Expr): OrderItem => ({ expr: e, dir: "ASC" });
export const desc = (e: Expr): OrderItem => ({ expr: e, dir: "DESC" });

export const fn = {
  coalesce: (...items: Expr[]): Expr => {
    const xs = items.filter(Boolean);
    if (xs.length === 0) return { kind: 'literal', value: null };
    if (xs.length === 1) return xs[0]!;
    return { kind: 'coalesce', items: xs };
  },
  isNull:  (e: Expr): Expr => ({ kind: 'is_null', expr: e }),
  notNull: (e: Expr): Expr => ({ kind: 'is_not_null', expr: e }),
};
