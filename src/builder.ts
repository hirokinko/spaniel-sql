import type { Expr, OrderItem, SelectStmt } from './core/ast.js';
import { toSql as coreToSql } from './core/sqlPrinter.js';
import type { ColumnType, TableDef } from './core/schema.js';
import type { ColumnProxy } from './core/schema.js';
import {
  createColumnProxy,
  objectToProjections,
  toParam,
  type FinalQuery,
  type FromStep,
} from './core/types/index.js';

export type Db = {
  from: <N extends string, C extends Record<string, ColumnType<any>>>(
    table: TableDef<N, C>,
  ) => FromStep<{ [K in N]: true }, C>;
  fromNamed: <N extends string, C extends Record<string, ColumnType<any>>>(
    name: N,
    columns: C,
  ) => FromStep<{ [K in N]: true }, C>;
  selectExpr: <S>(expr: () => S) => FinalQuery<{ row: S }>;
};

type BuildContext<C extends Record<string, ColumnType<any>>> = {
  table: string;
  columns: C;
  stmt: SelectStmt;
};

export function createDb(): Db {
  const from = <N extends string, C extends Record<string, ColumnType<any>>>(
    table: TableDef<N, C>,
  ): FromStep<{ [K in N]: true }, C> => {
    const ctx: BuildContext<C> = {
      table: table.name,
      columns: table.columns,
      stmt: { kind: 'select', from: { kind: 'table', name: table.name }, projections: [] },
    };
    return makeFromStep<{ [K in N]: true }, C>(ctx);
  };

  const fromNamed = <N extends string, C extends Record<string, ColumnType<any>>>(
    name: N,
    columns: C,
  ): FromStep<{ [K in N]: true }, C> => {
    const ctx: BuildContext<C> = {
      table: name,
      columns,
      stmt: { kind: 'select', from: { kind: 'table', name }, projections: [] },
    };
    return makeFromStep<{ [K in N]: true }, C>(ctx);
  };

  const selectExpr = <S>(expr: () => S): FinalQuery<{ row: S }> => {
    const value = expr();
    const stmt: SelectStmt = {
      kind: 'select',
      from: { kind: 'table', name: '(SELECT 1)' as any },
      projections: [{ expr: { kind: 'param', value }, alias: 'row' }],
    };
    return makeFinalQuery(stmt);
  };

  return { from, fromNamed, selectExpr };
}

function makeFromStep<TSources, C extends Record<string, ColumnType<any>>>(
  ctx: BuildContext<C>,
): FromStep<TSources, C> {
  const where = (pred: (c: ColumnProxy<C>) => Expr): FromStep<TSources, C> => {
    ctx.stmt.where = pred(createColumnProxy<C>(ctx.table, ctx.columns)) as any;
    return makeFromStep<TSources, C>(ctx);
  };
  const orderBy = (pick: (c: ColumnProxy<C>) => OrderItem[] | OrderItem): FromStep<TSources, C> => {
    const res = pick(createColumnProxy<C>(ctx.table, ctx.columns));
    ctx.stmt.orderBy = Array.isArray(res) ? res : [res];
    return makeFromStep<TSources, C>(ctx);
  };
  const limit = (n: number): FromStep<TSources, C> => {
    ctx.stmt.limit = toParam(n);
    return makeFromStep<TSources, C>(ctx);
  };
  const offset = (n: number): FromStep<TSources, C> => {
    ctx.stmt.offset = toParam(n);
    return makeFromStep<TSources, C>(ctx);
  };
  const select = <S>(project: (c: ColumnProxy<C>, fn: Record<string, never>) => S) => {
    const c = createColumnProxy<C>(ctx.table, ctx.columns);
    ctx.stmt.projections = objectToProjections(project(c, {}) as any, ctx.table);
    return makeFinalQuery<S>(ctx.stmt);
  };
  return { where, orderBy, limit, offset, select } as unknown as FromStep<TSources, C>;
}

function makeFinalQuery<S>(stmt: SelectStmt): FinalQuery<S> {
  return { toSql: () => coreToSql(stmt, { paramName: (i) => `@p${i}` }) };
}
