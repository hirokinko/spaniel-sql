import type { FinalQuery, FromStep, BuildContext, BoolExpr } from './core/types.js';
import { createColumnProxy, objectToProjections } from './core/types.js';
import type { SelectStmt } from './core/ast.js';
import { toSql as coreToSql } from './core/sqlPrinter.js';
import { spannerDialect } from './dialect/index.js';
import type { ColumnType, TableDef } from './core/schema.js';
import type { ColumnProxy } from './core/schema.js';

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
  const where = (
    predicate: (c: ColumnProxy<C>) => BoolExpr,
  ): FromStep<TSources, C> => {
    const c = createColumnProxy<C>(ctx.table, ctx.columns);
    ctx.stmt.where = predicate(c) as any;
    return makeFromStep<TSources, C>(ctx);
  };

  const select = <S>(project: (c: ColumnProxy<C>, fn: Record<string, never>) => S): FinalQuery<S> => {
    const c = createColumnProxy<C>(ctx.table, ctx.columns);
    const shaped = project(c, {});
    ctx.stmt.projections = objectToProjections(shaped as any, ctx.table);
    return makeFinalQuery<S>(ctx.stmt);
  };

  return { where, select };
}

function makeFinalQuery<S>(stmt: SelectStmt): FinalQuery<S> {
  return { toSql: () => coreToSql(stmt, spannerDialect) };
}
