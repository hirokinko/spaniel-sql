import type { Expr, FromSourceTable, OrderItem, Projection, SelectStmt } from './ast.js';
import { createSqlContext } from './sqlContext.js';

export type SqlOut = {
  sql: string;
  params: Record<string, unknown>;
  paramTypes: Record<string, string>; // Spanner型文字列（例: STRING, TIMESTAMP, ARRAY<STRING>）
};
export type Dialect = { paramName: (index1based: number) => string };

export function toSql(stmt: SelectStmt, dialect: Dialect): SqlOut {
  const context = createSqlContext(dialect);
  const { printExpr } = context;
  const header = stmt.distinct ? 'SELECT DISTINCT' : 'SELECT';
  const sql = [
    header,
    printProjections(stmt.projections, printExpr),
    'FROM',
    printFrom(stmt.from, printExpr),
    stmt.where ? `WHERE ${printExpr(stmt.where)}` : '',
    stmt.groupBy && stmt.groupBy.length > 0
      ? `GROUP BY ${stmt.groupBy.map(printExpr).join(', ')}`
      : '',
    stmt.having ? `HAVING ${printExpr(stmt.having)}` : '',
    printOrderBy(stmt.orderBy, printExpr),
    stmt.limit ? `LIMIT ${printExpr(stmt.limit)}` : '',
    stmt.offset ? `OFFSET ${printExpr(stmt.offset)}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  return context.finalize(sql);
}

function printFrom(from: FromSourceTable, printExpr: (e: Expr) => string): string {
  if (from.kind === 'table') {
    return from.name;
  }
  return `${from.base.name} CROSS JOIN UNNEST(${printExpr(from.unnest.expr)}) AS ${from.unnest.alias}`;
}

function printOrderBy(items: OrderItem[] | undefined, printExpr: (e: Expr) => string): string {
  return !items || items.length === 0
    ? ''
    : `ORDER BY ${items.map((i) => `${printExpr(i.expr)} ${i.dir}`).join(', ')}`;
}

function printProjections(projections: Projection[], printExpr: (e: Expr) => string): string {
  return projections
    .map((p) => {
      const body = printExpr(p.expr);
      return p.alias ? `${body} AS ${p.alias}` : body;
    })
    .join(', ');
}
