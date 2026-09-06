import type { PreciseDate } from '@google-cloud/precise-date';
import type { protos } from '@google-cloud/spanner';
import type { Temporal } from '@js-temporal/polyfill';
import type { Big } from 'big.js';
import { decodeResult, encodeParams, type SdkType } from './integration/spanner.js';

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export type SqlType =
  | {
      readonly code:
        | 'STRING'
        | 'BOOL'
        | 'FLOAT64'
        | 'INT64'
        | 'DATE'
        | 'TIMESTAMP'
        | 'BYTES'
        | 'JSON';
    }
  | { readonly code: 'NUMERIC'; readonly representation?: 'Big' }
  | { readonly code: 'ARRAY'; readonly element: SqlType }
  | { readonly code: 'STRUCT'; readonly fields: readonly SqlField[] };

export interface SqlField {
  readonly name: string;
  readonly type: SqlType;
}

type NonNullValue<T extends SqlType, Direction extends 'input' | 'output'> = T extends {
  code: 'STRING';
}
  ? string
  : T extends { code: 'BOOL' }
    ? boolean
    : T extends { code: 'FLOAT64' }
      ? number
      : T extends { code: 'INT64' }
        ? bigint
        : T extends { code: 'NUMERIC'; representation: 'Big' }
          ? Big
          : T extends { code: 'NUMERIC' }
            ? number
            : T extends { code: 'DATE' }
              ? Temporal.PlainDate
              : T extends { code: 'TIMESTAMP' }
                ? Direction extends 'input'
                  ? Date
                  : PreciseDate
                : T extends { code: 'BYTES' }
                  ? Buffer
                  : T extends { code: 'JSON' }
                    ? JsonValue
                    : T extends { code: 'ARRAY'; element: infer E extends SqlType }
                      ? SqlValue<E, Direction>[]
                      : T extends { code: 'STRUCT'; fields: infer F extends readonly SqlField[] }
                        ? FieldValues<F, Direction>
                        : never;

export type SqlValue<T extends SqlType, Direction extends 'input' | 'output'> = NonNullValue<
  T,
  Direction
> | null;
export type FieldValues<F extends readonly SqlField[], Direction extends 'input' | 'output'> = {
  [Field in F[number] as Field['name']]: SqlValue<Field['type'], Direction>;
};

export interface QueryDefinition {
  readonly name: string;
  readonly sql: string;
  readonly params: readonly SqlField[];
  readonly result: readonly SqlField[];
}

/** A borrowed native execution target. No connection lifecycle is owned here. */
export interface SpannerExecutor {
  execute(request: {
    sql: string;
    params: Record<string, unknown>;
    types: Record<string, SdkType>;
  }): Promise<{
    rows: unknown[];
    metadata: protos.google.spanner.v1.IResultSetMetadata;
  }>;
}

export class SqlAnalysisError extends Error {
  override name = 'SqlAnalysisError';
}
export class SqlGenerationError extends Error {
  override name = 'SqlGenerationError';
}
export class SqlExecutionError extends Error {
  override name = 'SqlExecutionError';
}

/** Only generated definitions should be used here; the adapter validates the runtime contract. */
export async function executeQuery<const D extends QueryDefinition>(
  executor: SpannerExecutor,
  definition: D,
  params: FieldValues<D['params'], 'input'>,
): Promise<FieldValues<D['result'], 'output'>[]> {
  try {
    const encoded = encodeParams(definition.params, params);
    const result = await executor.execute({ sql: definition.sql, ...encoded });
    return decodeResult(definition.result, result.rows, result.metadata) as FieldValues<
      D['result'],
      'output'
    >[];
  } catch (cause) {
    throw new SqlExecutionError(`Query ${definition.name} failed`, { cause });
  }
}
