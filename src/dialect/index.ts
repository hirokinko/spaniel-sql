import type { Dialect } from '../core/sqlPrinter.js';
export const spannerDialect: Dialect = { paramName: (i) => `@p${i}` };
