import type { Expr } from '../ast';
import type { ColumnProxy } from '../schema';

export type FinalQuery<S> = {
  _shape?: S;
  toSql: () => {
    sql: string;
    params: Record<string, unknown>;
    paramTypes: Record<string, string>;
  };
};

export type FromStep<TSources, C extends Record<string, any>> = {
  where: (predicate: (c: ColumnProxy<C>) => Expr) => FromStep<TSources, C>;
  orderBy: (
    pick: (
      c: ColumnProxy<C>,
    ) => { expr: Expr; dir: 'ASC' | 'DESC' }[] | { expr: Expr; dir: 'ASC' | 'DESC' },
  ) => FromStep<TSources, C>;
  limit: (n: number) => FromStep<TSources, C>;
  offset: (n: number) => FromStep<TSources, C>;
  select: <S>(project: (c: ColumnProxy<C>, fn: Record<string, never>) => S) => FinalQuery<S>;
};
