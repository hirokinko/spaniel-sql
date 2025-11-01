export type SpType =
  | { kind: 'base'; name: 'STRING' | 'INT64' | 'BOOL' | 'FLOAT64' | 'DATE' | 'TIMESTAMP' | 'JSON' }
  | { kind: 'array'; of: SpType };

export const spTypeToString = (t: SpType): string =>
  t.kind === 'base' ? t.name : `ARRAY<${spTypeToString(t.of)}>`;

export type ColumnType<T> = { __type?: T; __sp?: SpType };

const b = (name: Extract<SpType, { kind: 'base' }>['name']): SpType => ({ kind: 'base', name });
const arr = (of: SpType): SpType => ({ kind: 'array', of });

export const ct = {
  string: (): ColumnType<string> => ({ __sp: b('STRING') }),
  int64: (): ColumnType<bigint | number> => ({ __sp: b('INT64') }),
  bool: (): ColumnType<boolean> => ({ __sp: b('BOOL') }),
  float64: (): ColumnType<number> => ({ __sp: b('FLOAT64') }),
  date: (): ColumnType<string> => ({ __sp: b('DATE') }),
  timestamp: (): ColumnType<Date | string> => ({ __sp: b('TIMESTAMP') }),
  json: <T = unknown>(): ColumnType<T> => ({ __sp: b('JSON') }),
  array: <T>(inner: ColumnType<T>): ColumnType<T[]> =>
    inner.__sp ? { __sp: arr(inner.__sp) } : {},
};

export type TableDef<Name extends string, C extends Record<string, ColumnType<any>>> = {
  name: Name;
  columns: C;
};
export function defineTable<Name extends string, C extends Record<string, ColumnType<any>>>(
  name: Name,
  columns: C,
): TableDef<Name, C> {
  return { name, columns };
}

// スキーマ C に基づく列プロキシ
export type ColumnProxy<C extends Record<string, ColumnType<any>>> = {
  [K in keyof C]: {
    kind: 'column';
    table: string;
    name: Extract<K, string>;
    spType: SpType | undefined;
  };
};
