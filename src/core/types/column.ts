import type { ColumnProxy, ColumnType, SpType } from '../schema';
import { asScalar } from './brand';

export function createColumnProxy<C extends Record<string, ColumnType<any>>>(
  table: string,
  columns: C,
): ColumnProxy<C> {
  return new Proxy(
    {},
    {
      get(_t, prop) {
        if (typeof prop !== 'string') {
          return undefined;
        }
        const def = columns[prop];
        if (def === undefined) {
          throw new Error(`Column "${prop}" does not exist in table "${table}"`);
        }
        const spType: SpType | undefined = def.__sp;
        return asScalar({ kind: 'column', table, name: prop, spType });
      },
      has() {
        return true;
      },
    },
  ) as ColumnProxy<C>;
}
