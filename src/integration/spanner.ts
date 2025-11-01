// src/spanner-types.ts
type Base =
  | 'STRING'
  | 'BYTES'
  | 'BOOL'
  | 'INT64'
  | 'FLOAT64'
  | 'NUMERIC'
  | 'JSON'
  | 'DATE'
  | 'TIMESTAMP';
type TypeStr = Base | `ARRAY<${Base}>`;

export function toSpannerTypes(paramTypes: Record<string, TypeStr>) {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(paramTypes)) {
    const m = /^ARRAY<(.+)>$/.exec(v);
    if (m) {
      out[k] = { type: 'array', child: { type: baseToSpanner(m[1] as Base) } };
    } else {
      out[k] = { type: baseToSpanner(v as Base) };
    }
  }
  return out;
}

function baseToSpanner(t: Base) {
  switch (t) {
    case 'STRING':
      return 'string';
    case 'BYTES':
      return 'bytes';
    case 'BOOL':
      return 'bool';
    case 'INT64':
      return 'int64';
    case 'FLOAT64':
      return 'float64';
    case 'NUMERIC':
      return 'numeric';
    case 'JSON':
      return 'json';
    case 'DATE':
      return 'date';
    case 'TIMESTAMP':
      return 'timestamp';
  }
}

// （任意）値の整形：INT64/NUMERICは string に寄せると安全
export function normalizeParams(params: Record<string, unknown>, types: Record<string, TypeStr>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    const t = types[k];
    if (!t) {
      out[k] = v;
      continue;
    }
    const base = t.startsWith('ARRAY<') ? (t.slice(6, -1) as Base) : (t as Base);
    if (t.startsWith('ARRAY<')) {
      out[k] = Array.isArray(v) ? v.map((x) => coerce(x, base)) : v;
    } else {
      out[k] = coerce(v, base);
    }
  }
  return out;
}

function coerce(v: unknown, base: Base) {
  if (v == null) {
    return v;
  }
  switch (base) {
    case 'INT64': // SpannerはINT64をJS numberで扱うと精度落ちうる
    case 'NUMERIC': // どちらも string にしておくのが無難
      return typeof v === 'bigint' ? v.toString() : typeof v === 'number' ? String(v) : v;
    // case 'DATE': // 'YYYY-MM-DD' 文字列でOK
    // case 'TIMESTAMP': // ISO文字列 or Date
    // case 'JSON': // JSオブジェクトでもOK（SDKが処理）
    default:
      return v;
  }
}
