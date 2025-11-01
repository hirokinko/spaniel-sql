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

export type FromStep<
  TSources,
  C extends Record<string, any>,
  Phase extends 'plain' | 'grouped' = 'plain',
> = Phase extends 'plain'
  ? {
      where(pred: (c: ColumnProxy<C>) => Expr): FromStep<TSources, C, 'plain'>;
      orderBy(pick: (c: ColumnProxy<C>) => OrderItem[] | OrderItem): FromStep<TSources, C, 'plain'>;
      limit(n: number): FromStep<TSources, C, 'plain'>;
      offset(n: number): FromStep<TSources, C, 'plain'>;
      // groupBy したら grouped フェーズに遷移
      groupBy(
        pick: (c: ColumnProxy<C>) => ScalarExpr[] | ScalarExpr,
      ): FromStep<TSources, C, 'grouped'>;
      // plain の select は自由（Scalar/Agg混在許容）
      select<S>(project: (c: ColumnProxy<C>, _fn: Record<string, never>) => S): FinalQuery<S>;
      selectDistinct<S>(
        project: (c: ColumnProxy<C>, _fn: Record<string, never>) => S,
      ): FinalQuery<S>;
      crossJoinUnnest(
        pick: (c: ColumnProxy<C>) => Expr,
        alias: string,
      ): FromStep<TSources, C, 'plain'>;
    }
  : {
      // grouped では group key or aggregate しか受けない
      having(pred: (c: ColumnProxy<C>) => GroupKeyExpr | AggExpr): FromStep<TSources, C, 'grouped'>;
      orderBy(
        pick: (
          c: ColumnProxy<C>,
        ) =>
          | { expr: GroupKeyExpr | AggExpr; dir: 'ASC' | 'DESC' }[]
          | { expr: GroupKeyExpr | AggExpr; dir: 'ASC' | 'DESC' },
      ): FromStep<TSources, C, 'grouped'>;
      limit(n: number): FromStep<TSources, C, 'grouped'>;
      offset(n: number): FromStep<TSources, C, 'grouped'>;
      select<S extends Record<string, GroupKeyExpr | AggExpr>>(
        project: (c: ColumnProxy<C>, _fn: Record<string, never>) => S,
      ): FinalQuery<S>;
    };
