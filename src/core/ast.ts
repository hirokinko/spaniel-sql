import type { SpType } from './schema.js';

export type Identifier = string;

export type Expr =
  | { kind: 'column'; table: Identifier; name: Identifier; spType?: SpType }
  | { kind: 'param'; value: unknown; hint?: import('./schema.js').SpType }
  | { kind: 'literal'; value: string | number | boolean | null }
  | { kind: 'bool'; value: boolean }
  | { kind: 'binary'; op: '=' | '!=' | '<' | '<=' | '>' | '>=' | 'LIKE'; left: Expr; right: Expr }
  | { kind: 'in_list'; left: Expr; items: Expr[] }
  | { kind: 'bool_nary'; op: 'AND' | 'OR'; items: Expr[] };

export type Projection = { expr: Expr; alias?: Identifier };
export type FromSourceTable = { kind: 'table'; name: Identifier };
export type OrderItem = { expr: Expr; dir: 'ASC' | 'DESC' };

export type SelectStmt = {
  kind: 'select';
  from: FromSourceTable;
  projections: Projection[];
  where?: Expr;
  orderBy?: OrderItem[];
  limit?: Expr;
  offset?: Expr;
};