import type { Expr } from './ast.js';
import { spTypeToString } from './schema.js';
import type { Dialect, SqlOut } from './sqlPrinter.js';

export type SqlContext = {
  printExpr: (e: Expr) => string;
  nameParam: (value: unknown, hint?: any) => string;
  finalize: (sql: string) => SqlOut;
};

export function createSqlContext(dialect: Dialect): SqlContext {
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
      case 'column':
        return expr.name;
      case 'param':
        return nameParam(expr.value, expr.hint);
      case 'literal':
        return nameParam(expr.value);
      case 'bool':
        return expr.value ? 'TRUE' : 'FALSE';
      case 'binary':
        return `${printExpr(expr.left)} ${expr.op} ${printExpr(expr.right)}`;
      case 'in_list': {
        const items = expr.items.map(printExpr).join(', ');
        return `${printExpr(expr.left)} IN (${items || ''})`;
      }
      case 'in_unnest':
        return `${printExpr(expr.left)} IN UNNEST(${printExpr(expr.param)})`;
      case 'bool_nary': {
        const parts = expr.items.map(printExpr);
        return parts.length <= 1
          ? (parts[0] ?? (expr.op === 'AND' ? 'TRUE' : 'FALSE'))
          : `(${parts.join(` ${expr.op} `)})`;
      }
      case 'coalesce':
        return `COALESCE(${expr.items.map(printExpr).join(', ')})`;
      case 'is_null':
        return `${printExpr(expr.expr)} IS NULL`;
      case 'is_not_null':
        return `${printExpr(expr.expr)} IS NOT NULL`;
      case 'nullif':
        return `NULLIF(${printExpr(expr.a)}, ${printExpr(expr.b)})`;
      case 'call': {
        const args = expr.args.map(printExpr).join(', ');
        const distinct = expr.distinct ? 'DISTINCT ' : '';
        return `${expr.name}(${distinct}${args})`;
      }
      default:
        throw new Error(`Unsupported expression ${(expr as any).kind}`);
    }
  };

  const finalize = (sql: string): SqlOut => ({ sql, params, paramTypes: types });

  return { printExpr, nameParam, finalize };
}
