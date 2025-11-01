import type { Projection } from '../ast';

const projectibleKind = ['column', 'coalesce', 'call'] as const;

export function objectToProjections(obj: Record<string, any>, table: string): Projection[] {
  const out: Projection[] = [];
  for (const [alias, v] of Object.entries(obj)) {
    if (v && typeof v === 'object' && projectibleKind.includes((v as any).kind)) {
      out.push({ expr: v, alias });
    } else if (v === null || ['string', 'number', 'boolean'].includes(typeof v)) {
      out.push({ expr: { kind: 'literal', value: v as any }, alias });
    } else {
      throw new Error(`Unsupported projection value for "${alias}" in table "${table}"`);
    }
  }
  return out;
}
