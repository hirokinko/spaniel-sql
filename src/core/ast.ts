import type { SpType } from './schema.js';

export type Identifier = string;

export type Expr =
  | { kind: 'column'; table: Identifier; name: Identifier; spType: SpType | undefined }
  | { kind: 'param'; value: unknown; hint?: SpType }
  | { kind: 'literal'; value: string | number | boolean | null }
  | { kind: 'bool'; value: boolean }
  | { kind: 'binary'; op: '=' | '!=' | '<' | '<=' | '>' | '>=' | 'LIKE'; left: Expr; right: Expr }
  | { kind: 'in_list'; left: Expr; items: Expr[] }
  | { kind: 'in_unnest'; left: Expr; param: Expr }
  | { kind: 'bool_nary'; op: 'AND' | 'OR'; items: Expr[] }
  | { kind: 'coalesce'; items: Expr[] }
  | { kind: 'is_null'; expr: Expr }
  | { kind: 'is_not_null'; expr: Expr }
  | { kind: 'nullif'; a: Expr; b: Expr }
  | {
      kind: 'call';
      name: 'COUNT' | 'SUM' | 'MIN' | 'MAX' | 'AVG';
      args: Expr[];
      distinct: boolean | undefined;
    };

export type Projection = { expr: Expr; alias?: Identifier };
export type FromSourceTable = { kind: 'table'; name: Identifier };
export type OrderItem = { expr: Expr; dir: 'ASC' | 'DESC' };

export type SelectStmt = {
  kind: 'select';
  from: FromSourceTable;
  projections: Projection[];
  distinct?: boolean;
  where?: Expr;
  groupBy?: Expr[];
  having?: Expr;
  orderBy?: OrderItem[];
  limit?: Expr;
  offset?: Expr;
};
