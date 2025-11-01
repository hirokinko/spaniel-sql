import type { ColumnProxy, ColumnType, SpType } from '../schema';

export type ColumnExpr = {
  kind: 'column';
  table: string;
  name: string;
  spType?: SpType;
};
export function createColumnProxy<C extends Record<string, ColumnType<any>>>(
  table: string,
  columns: C,
): ColumnProxy<C> {
  return new Proxy(
    {},
    {
      get(_t, prop) {
        if (typeof prop !== 'string') {
          return undefined as any;
        }
        const def = (columns as any)[prop];
        const spType: SpType | undefined = def && (def as ColumnType<any>).__sp;
        return { kind: 'column', table, name: prop, spType } as any;
      },
      has() {
        return true;
      },
    },
  ) as ColumnProxy<C>;
}
