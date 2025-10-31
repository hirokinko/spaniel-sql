import type { Expr, OrderItem, Projection, SelectStmt } from "./ast.js";
import { spTypeToString } from "./schema.js";

export type SqlOut = {
  sql: string;
  params: Record<string, unknown>;
  paramTypes: Record<string, string>; // Spanner型文字列（例: STRING, TIMESTAMP, ARRAY<STRING>）
};
export type Dialect = { paramName: (index1based: number) => string };

export function toSql(stmt: SelectStmt, dialect: Dialect): SqlOut {
  const params: Record<string, unknown> = {};
  const types: Record<string, string> = {};
  let p = 0;

  const nameParam = (value: unknown, hint?: any): string => {
    const key = dialect.paramName(++p).slice(1); // '@p1' -> 'p1'
    params[key] = value;
    if (hint) {
      types[key] = spTypeToString(hint);
    }
    return `@${key}`;
  };

  const printExpr = (expr: Expr): string => {
    switch (expr.kind) {
      case "column":
        return expr.name;
      case "param":
        return nameParam(expr.value, expr.hint);
      case "literal":
        return nameParam(expr.value);
      case "bool":
        return expr.value ? "TRUE" : "FALSE";
      case "binary":
        return `${printExpr(expr.left)} ${expr.op} ${printExpr(expr.right)}`;
      case "in_list": {
        const items = expr.items.map(printExpr).join(", ");
        return `${printExpr(expr.left)} IN (${items || ""})`;
      }
      case "in_unnest": {
        return `${printExpr(expr.left)} IN UNNEST(${printExpr(expr.param)})`;
      }
      case "bool_nary": {
        const parts = expr.items.map(printExpr);
        return parts.length <= 1
          ? parts[0] ?? (expr.op === "AND" ? "TRUE" : "FALSE")
          : `(${parts.join(` ${expr.op} `)})`;
      }
      case "coalesce": {
        const parts = expr.items.map(printExpr).join(", ");
        return `COALESCE(${parts})`;
      }
      case "is_null":
        return `${printExpr(expr.expr)} IS NULL`;
      case "is_not_null":
        return `${printExpr(expr.expr)} IS NOT NULL`;
      case "nullif":
        return `NULLIF(${printExpr(expr.a)}, ${printExpr(expr.b)})`;
      default:
        throw new Error(`Unsupported expression ${(expr as any).kind}`);
    }
  };

  const printOrderBy = (items?: OrderItem[]) =>
    !items || items.length === 0
      ? ""
      : `ORDER BY ${items
          .map((i) => `${printExpr(i.expr)} ${i.dir}`)
          .join(", ")}`;

  const sql = [
    "SELECT",
    printProjections(stmt.projections, printExpr),
    "FROM",
    stmt.from.name,
    stmt.where ? `WHERE ${printExpr(stmt.where)}` : "",
    printOrderBy(stmt.orderBy),
    stmt.limit ? `LIMIT ${printExpr(stmt.limit)}` : "",
    stmt.offset ? `OFFSET ${printExpr(stmt.offset)}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return { sql, params, paramTypes: types };
}

function printProjections(
  projections: Projection[],
  printExpr: (e: Expr) => string
): string {
  return projections
    .map((p) => {
      const body = printExpr(p.expr);
      return p.alias ? `${body} AS ${p.alias}` : body;
    })
    .join(", ");
}
