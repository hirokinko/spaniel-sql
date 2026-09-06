import { PreciseDate } from '@google-cloud/precise-date';
import { type Database, protos, Spanner } from '@google-cloud/spanner';
import { Temporal } from '@js-temporal/polyfill';
import Big from 'big.js';
import { type SpannerExecutor, SqlAnalysisError, type SqlField, type SqlType } from '../runtime.js';

type RpcType = protos.google.spanner.v1.IType;
type RpcField = protos.google.spanner.v1.StructType.IField;
export type AnalysisDatabase = Pick<Database, 'run'>;

export function normalizeFields(
  fields: readonly RpcField[] | null | undefined,
  path: string,
): SqlField[] {
  if (!fields) {
    throw new Error(`${path}: missing fields`);
  }
  const names = new Set<string>();
  return fields.map((field) => {
    if (!field.name || names.has(field.name)) {
      throw new Error(`${path}: use unique AS aliases`);
    }
    names.add(field.name);
    return { name: field.name, type: normalizeType(field.type, `${path}.${field.name}`) };
  });
}

function normalizeType(type: RpcType | null | undefined, path: string): SqlType {
  if (!type) {
    throw new Error(`${path}: missing type`);
  }
  if (type.typeAnnotation && type.typeAnnotation !== 'TYPE_ANNOTATION_CODE_UNSPECIFIED') {
    throw new Error(`${path}: unsupported type annotation`);
  }
  const code =
    typeof type.code === 'number' ? protos.google.spanner.v1.TypeCode[type.code] : type.code;
  switch (code) {
    case 'STRING':
    case 'BOOL':
    case 'FLOAT64':
    case 'INT64':
    case 'NUMERIC':
    case 'DATE':
    case 'TIMESTAMP':
    case 'BYTES':
    case 'JSON':
      return { code };
    case 'ARRAY': {
      const element = normalizeType(type.arrayElementType, `${path}[]`);
      if (element.code === 'ARRAY') {
        throw new Error(`${path}: nested ARRAY is unsupported`);
      }
      return { code, element };
    }
    case 'STRUCT':
      return { code, fields: normalizeFields(type.structType?.fields, path) };
    default:
      throw new Error(`${path}: unsupported SQL type`);
  }
}

export async function analyzeSql(
  database: AnalysisDatabase,
  sql: string,
): Promise<{ params: SqlField[]; result: SqlField[] }> {
  try {
    const [, , metadata] = await database.run({
      sql,
      queryMode: protos.google.spanner.v1.ExecuteSqlRequest.QueryMode.PLAN,
    });
    if (!metadata) {
      throw new Error('Missing PLAN metadata');
    }
    return {
      params: normalizeFields(metadata.undeclaredParameters?.fields ?? [], 'params'),
      result: normalizeFields(metadata.rowType?.fields, 'result'),
    };
  } catch (cause) {
    throw new SqlAnalysisError('SQL analysis failed', { cause });
  }
}

export interface SdkType {
  type: string;
  child?: SdkType;
  fields?: (SdkType & { name: string })[];
}
export function sdkType(type: SqlType): SdkType {
  if (type.code === 'ARRAY') {
    return { type: 'array', child: sdkType(type.element) };
  }
  if (type.code === 'STRUCT') {
    return {
      type: 'struct',
      fields: type.fields.map((f) => ({ name: f.name, ...sdkType(f.type) })),
    };
  }
  return { type: type.code.toLowerCase() };
}

function record(value: unknown, path: string): asserts value is Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
  ) {
    throw new Error(`${path}: expected object`);
  }
}

function checkFields(
  fields: readonly SqlField[],
  value: unknown,
  path: string,
): asserts value is Record<string, unknown> {
  record(value, path);
  if (
    Reflect.ownKeys(value).length !== fields.length ||
    fields.some((f) => !Object.hasOwn(value, f.name))
  ) {
    throw new Error(`${path}: missing or extra fields`);
  }
}

function json(value: unknown, path: string, active = new Set<object>()): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return;
  }
  if (!value || typeof value !== 'object' || active.has(value)) {
    throw new Error(`${path}: invalid JSON`);
  }
  active.add(value);
  if (Array.isArray(value)) {
    if (
      Object.keys(value).length !== value.length ||
      Reflect.ownKeys(value).length !== value.length + 1
    ) {
      throw new Error(`${path}: invalid JSON array`);
    }
    for (let i = 0; i < value.length; i++) {
      json(value[i], path, active);
    }
  } else {
    record(value, path);
    if (Reflect.ownKeys(value).length !== Object.keys(value).length) {
      throw new Error(`${path}: invalid JSON properties`);
    }
    for (const child of Object.values(value)) {
      json(child, path, active);
    }
  }
  active.delete(value);
}

function numeric(value: Big, path: string): void {
  // Coefficient/exponent checks do not depend on Big's shared rounding settings.
  if (value.e > 28 || value.c.length - value.e - 1 > 9) {
    throw new Error(`${path}: NUMERIC out of range or scale`);
  }
}

function preciseText(value: unknown, path: string): string {
  if (value && typeof value === 'object' && 'value' in value && typeof value.value === 'string') {
    return value.value;
  }
  throw new Error(`${path}: expected precise SDK value`);
}

export function encodeValue(type: SqlType, value: unknown, path = 'value'): unknown {
  if (value === null) {
    return null;
  }
  switch (type.code) {
    case 'STRING':
      if (typeof value === 'string') {
        return value;
      }
      break;
    case 'BOOL':
      if (typeof value === 'boolean') {
        return value;
      }
      break;
    case 'FLOAT64':
      if (typeof value === 'number') {
        return Spanner.float(value);
      }
      break;
    case 'BYTES':
      if (Buffer.isBuffer(value)) {
        return value;
      }
      break;
    case 'INT64':
      if (typeof value === 'bigint' && value >= -(1n << 63n) && value < 1n << 63n) {
        return Spanner.int(value.toString());
      }
      break;
    case 'NUMERIC': {
      if (
        type.representation === 'Big'
          ? !(value instanceof Big)
          : typeof value !== 'number' || !Number.isFinite(value)
      ) {
        break;
      }
      const big = new Big(value instanceof Big ? value.toString() : String(value));
      numeric(big, path);
      return Spanner.numeric(big.toFixed());
    }
    case 'DATE':
      if (
        value instanceof Temporal.PlainDate &&
        value.calendarId === 'iso8601' &&
        value.year >= 1 &&
        value.year <= 9999
      ) {
        return Spanner.date(value.toString());
      }
      break;
    case 'TIMESTAMP':
      if (
        value instanceof Date &&
        Number.isFinite(value.getTime()) &&
        value.getUTCFullYear() >= 1 &&
        value.getUTCFullYear() <= 9999
      ) {
        return value;
      }
      break;
    case 'JSON':
      json(value, path);
      return JSON.stringify(value);
    case 'ARRAY':
      if (Array.isArray(value)) {
        return Array.from({ length: value.length }, (_, i) =>
          encodeValue(type.element, value[i], `${path}[${i}]`),
        );
      }
      break;
    case 'STRUCT': {
      checkFields(type.fields, value, path);
      const struct = Spanner.struct();
      for (const field of type.fields) {
        struct.push({
          name: field.name,
          value: encodeValue(field.type, value[field.name], `${path}.${field.name}`),
        });
      }
      return struct;
    }
  }
  throw new Error(`${path}: invalid ${type.code} value`);
}

export function decodeValue(type: SqlType, value: unknown, path = 'value'): unknown {
  if (value === null) {
    return null;
  }
  switch (type.code) {
    case 'INT64': {
      const result = BigInt(preciseText(value, path));
      encodeValue(type, result, path);
      return result;
    }
    case 'NUMERIC': {
      const big = new Big(preciseText(value, path));
      numeric(big, path);
      if (type.representation === 'Big') {
        return big;
      }
      const result = Number(big.toString());
      if (!Number.isFinite(result) || !big.eq(String(result))) {
        throw new Error(`${path}: precision loss; specify type=Big`);
      }
      return result;
    }
    case 'FLOAT64': {
      const result =
        typeof value === 'number'
          ? value
          : value && typeof value === 'object' && 'value' in value
            ? value.value
            : undefined;
      if (typeof result !== 'number') {
        throw new Error(`${path}: invalid FLOAT64 result`);
      }
      return result;
    }
    case 'DATE': {
      if (!(value instanceof Date)) {
        throw new Error(`${path}: invalid DATE result`);
      }
      const result = Temporal.PlainDate.from(value.toJSON());
      encodeValue(type, result, path);
      return result;
    }
    case 'TIMESTAMP':
      if (!(value instanceof PreciseDate)) {
        throw new Error(`${path}: expected PreciseDate`);
      }
      encodeValue(type, value, path);
      return value;
    case 'ARRAY':
      if (!Array.isArray(value)) {
        throw new Error(`${path}: invalid ARRAY result`);
      }
      return Array.from({ length: value.length }, (_, i) =>
        decodeValue(type.element, value[i], `${path}[${i}]`),
      );
    case 'STRUCT':
      return decodeFields(type.fields, value, path);
    case 'JSON':
      json(value, path);
      return value;
    default:
      encodeValue(type, value, path);
      return value;
  }
}

function decodeFields(
  fields: readonly SqlField[],
  value: unknown,
  path: string,
): Record<string, unknown> {
  if (!Array.isArray(value) || value.length !== fields.length) {
    throw new Error(`${path}: result shape mismatch`);
  }
  return Object.fromEntries(
    fields.map((field, i) => {
      const entry: unknown = value[i];
      if (
        !entry ||
        typeof entry !== 'object' ||
        !('name' in entry) ||
        entry.name !== field.name ||
        !('value' in entry)
      ) {
        throw new Error(`${path}: result field mismatch`);
      }
      return [field.name, decodeValue(field.type, entry.value, `${path}.${field.name}`)];
    }),
  );
}

function sqlShape(fields: readonly SqlField[]): unknown {
  return fields.map((f) => ({ name: f.name, type: sdkType(f.type) }));
}

export function createSpannerExecutor(database: AnalysisDatabase): SpannerExecutor {
  return {
    async execute(request) {
      const [rows, , metadata] = await database.run({ ...request, json: false });
      return { rows, metadata };
    },
  };
}

export function encodeParams(
  fields: readonly SqlField[],
  params: Record<string, unknown>,
): { params: Record<string, unknown>; types: Record<string, SdkType> } {
  checkFields(fields, params, 'params');
  return {
    params: Object.fromEntries(
      fields.map((f) => [f.name, encodeValue(f.type, params[f.name], `params.${f.name}`)]),
    ),
    types: Object.fromEntries(fields.map((f) => [f.name, sdkType(f.type)])),
  };
}

export function decodeResult(
  fields: readonly SqlField[],
  rows: unknown[],
  metadata: protos.google.spanner.v1.IResultSetMetadata,
): Record<string, unknown>[] {
  const result = normalizeFields(metadata?.rowType?.fields, 'result');
  if (JSON.stringify(sqlShape(result)) !== JSON.stringify(sqlShape(fields))) {
    throw new Error('Result metadata mismatch');
  }
  if (!Array.isArray(rows)) {
    throw new Error('Missing result rows');
  }
  return rows.map((row) => decodeFields(fields, row, 'result'));
}
