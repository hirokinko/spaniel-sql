import type { Expr, OrderItem } from '../ast.js';
import type { ColumnProxy } from '../schema.js';
import type { AggExpr, GroupKeyExpr, ScalarExpr } from './brand.js';

export type FinalQuery<S> = {
  _shape?: S;
  toSql: () => {
    sql: string;
    params: Record<string, unknown>;
    paramTypes: Record<string, string>;
  };
};

export type Phase =
  | 'start'
  | 'filtered'
  | 'unnested'
  | 'grouped'
  | 'ordered'
  | 'limited'
  | 'offseted';

type OrderPickAllowed<P extends Phase> = P extends 'grouped'
  ?
      | { expr: GroupKeyExpr | AggExpr; dir: 'ASC' | 'DESC' }[]
      | { expr: GroupKeyExpr | AggExpr; dir: 'ASC' | 'DESC' }
  : OrderItem[] | OrderItem;

export type FromStep<
  TSources,
  C extends Record<string, any>,
  P extends Phase = 'start',
> = P extends 'start' // ---------- start ----------
  ? {
      where(pred: (c: ColumnProxy<C>) => Expr): FromStep<TSources, C, 'filtered'>;
      groupBy(
        pick: (c: ColumnProxy<C>) => ScalarExpr[] | ScalarExpr,
      ): FromStep<TSources, C, 'grouped'>;
      orderBy(
        pick: (c: ColumnProxy<C>) => OrderItem[] | OrderItem,
      ): FromStep<TSources, C, 'ordered'>;
      limit(n: number): FromStep<TSources, C, 'limited'>;
      offset(n: number): FromStep<TSources, C, 'offseted'>;
      select<S>(project: (c: ColumnProxy<C>, _fn: Record<string, never>) => S): FinalQuery<S>;
      selectDistinct<S>(
        project: (c: ColumnProxy<C>, _fn: Record<string, never>) => S,
      ): FinalQuery<S>;
      crossJoinUnnest(
        pick: (c: ColumnProxy<C>) => Expr,
        alias: string,
      ): FromStep<TSources, C, 'unnested'>;
    }
  : P extends 'filtered' // ---------- filtered（where済） ----------
    ? {
        // where なし
        groupBy(
          pick: (c: ColumnProxy<C>) => ScalarExpr[] | ScalarExpr,
        ): FromStep<TSources, C, 'grouped'>;
        orderBy(
          pick: (c: ColumnProxy<C>) => OrderItem[] | OrderItem,
        ): FromStep<TSources, C, 'ordered'>;
        limit(n: number): FromStep<TSources, C, 'limited'>;
        offset(n: number): FromStep<TSources, C, 'offseted'>;
        select<S>(project: (c: ColumnProxy<C>, _fn: Record<string, never>) => S): FinalQuery<S>;
        selectDistinct<S>(
          project: (c: ColumnProxy<C>, _fn: Record<string, never>) => S,
        ): FinalQuery<S>;
      }
    : P extends 'unnested' // ---------- unnest後 ----------
      ? {
          where(pred: (c: ColumnProxy<C>) => Expr): FromStep<TSources, C, 'filtered'>;
          groupBy(
            pick: (c: ColumnProxy<C>) => ScalarExpr[] | ScalarExpr,
          ): FromStep<TSources, C, 'grouped'>;
          orderBy(
            pick: (c: ColumnProxy<C>) => OrderItem[] | OrderItem,
          ): FromStep<TSources, C, 'ordered'>;
          limit(n: number): FromStep<TSources, C, 'limited'>;
          offset(n: number): FromStep<TSources, C, 'offseted'>;
          select<S>(project: (c: ColumnProxy<C>, _fn: Record<string, never>) => S): FinalQuery<S>;
          selectDistinct<S>(
            project: (c: ColumnProxy<C>, _fn: Record<string, never>) => S,
          ): FinalQuery<S>;
        }
      : P extends 'grouped' // ---------- grouped（groupBy後） ----------
        ? {
            // where なし（HAVINGを使う）
            having(
              pred: (c: ColumnProxy<C>) => GroupKeyExpr | AggExpr,
            ): FromStep<TSources, C, 'grouped'>; // HAVINGは何度でも可（上書きよりANDで束ねたいなら実装側で）
            orderBy(
              pick: (c: ColumnProxy<C>) => OrderPickAllowed<'grouped'>,
            ): FromStep<TSources, C, 'ordered'>;
            limit(n: number): FromStep<TSources, C, 'limited'>;
            offset(n: number): FromStep<TSources, C, 'offseted'>;
            select<S extends Record<string, GroupKeyExpr | AggExpr>>(
              project: (c: ColumnProxy<C>, _fn: Record<string, never>) => S,
            ): FinalQuery<S>;
          }
        : P extends 'ordered' // ---------- ordered（orderBy後） ----------
          ? {
              // where / groupBy / orderBy なし
              limit(n: number): FromStep<TSources, C, 'limited'>;
              offset(n: number): FromStep<TSources, C, 'offseted'>;
              select<S>(
                project: (c: ColumnProxy<C>, _fn: Record<string, never>) => S,
              ): FinalQuery<S>;
            }
          : P extends 'limited' // ---------- limited（limit後） ----------
            ? {
                // where / groupBy / orderBy / limit なし
                offset(n: number): FromStep<TSources, C, 'offseted'>;
                select<S>(
                  project: (c: ColumnProxy<C>, _fn: Record<string, never>) => S,
                ): FinalQuery<S>;
              }
            : P extends 'offseted' // ---------- offseted（offset後） ----------
              ? {
                  // where / groupBy / orderBy / limit / offset なし
                  select<S>(
                    project: (c: ColumnProxy<C>, _fn: Record<string, never>) => S,
                  ): FinalQuery<S>;
                }
              : never;
