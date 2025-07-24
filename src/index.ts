/**
 * spaniel-sql: Type-safe TypeScript query builder for Cloud Spanner
 *
 * This library provides a fluent, type-safe API for building WHERE clauses
 * for Cloud Spanner SQL queries. It supports parameterized queries, type
 * constraints, and generates SQL that is compatible with Cloud Spanner syntax.
 *
 * @example Basic Usage
 * ```typescript
 * import { createWhere } from 'spaniel-sql';
 *
 * const query = createWhere()
 *   .eq('name', 'John')
 *   .gt('age', 18)
 *   .build();
 *
 * console.log(query.sql); // "name = @param1 AND age > @param2"
 * console.log(query.parameters); // { param1: 'John', param2: 18 }
 * ```
 *
 * @example With Type Safety
 * ```typescript
 * interface User {
 *   id: number;
 *   name: string;
 *   email: string;
 *   age: number;
 * }
 *
 * const query = createWhere<User>()
 *   .eq('name', 'John')  // ✓ Type-safe column and value
 *   .gt('age', 18)       // ✓ Correct types
 *   .build();
 * ```
 *
 * @example Complex Queries
 * ```typescript
 * const query = createWhere<User>()
 *   .eq('active', true)
 *   .and(
 *     (b) => b.or(
 *       (ob) => ob.eq('role', 'admin'),
 *       (ob) => ob.eq('role', 'moderator')
 *     ),
 *     (b) => b.gt('experience', 5)
 *   )
 *   .build();
 * ```
 *
 * @packageDocumentation
 */

export * from "./types";
