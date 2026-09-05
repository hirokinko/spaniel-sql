# Spaniel Roadmap

Spaniel is being redesigned from a fluent query-builder DSL into a **Spanner-native Typed SQL toolchain**.

The core principle is simple:

> Keep SQL as SQL. Add structure only where dynamic SQL cannot be expressed safely with parameters alone.

This avoids re-implementing GoogleSQL in TypeScript while still providing strong typing, schema validation, migration verification, and reusable dynamic fragments.

## Design principles

1. **SQL-first**
   - Static queries remain ordinary `.sql` files.
   - GoogleSQL syntax and semantics are validated by Spanner itself wherever possible.

2. **Minimal DSL surface**
   - Spaniel must not reproduce `SELECT`, `FROM`, `JOIN`, `LIKE`, comparison operators, CTEs, window functions, or other ordinary SQL syntax as fluent APIs.
   - Typed helpers are reserved for dynamic SQL structure that cannot safely be represented by SQL parameters alone.

3. **Spanner as the type checker**
   - Use Spanner query analysis / PLAN metadata to infer and validate parameter and result types where possible.
   - TypeScript types are generated from Spanner metadata rather than from a parallel schema model.

4. **Typed dynamic fragments**
   - Dynamic SQL is composed from typed fragments rather than raw string concatenation.
   - Fragment helpers should remain small and structural: parameter binding, optional fragments, predicate composition, safe identifiers, dynamic ordering, and similar cases.

5. **No duplicate schema model unless unavoidable**
   - Avoid maintaining a second ORM-style schema in TypeScript.
   - Prefer Spanner schema introspection and generated metadata.

6. **Migration and query validation are one toolchain**
   - A schema produced by migrations must be the same schema against which Typed SQL is validated.

## Target architecture

```text
                          Spaniel
                            |
              +-------------+-------------+
              |                           |
        Static Typed SQL             Dynamic SQL
          *.sql files              typed templates
              |                           |
              +-------------+-------------+
                            |
                      rendered SQL
                            |
                    Spanner validation
                            |
             parameter/result type metadata
                            |
                    generated TypeScript
```

Runtime responsibilities remain deliberately small:

- execute typed queries and commands
- bind and normalize Spanner parameters
- handle Spanner-specific value codecs
- expose transaction primitives where needed
- optionally validate schema compatibility at startup

## Phase 1 — Typed SQL core

Replace the fluent statement builder as the primary API.

### Goals

- Load `.sql` files.
- Analyze SQL against a real Spanner-compatible schema.
- Infer input parameter types.
- Infer result row types.
- Generate TypeScript query functions and types.
- Preserve Spanner-native SQL instead of translating through an internal statement DSL.

### Initial scope

Focus on fixed SQL first.

```sql
-- sql/find-user.sql
SELECT
  UserId,
  Name,
  CreatedAt
FROM Users
WHERE UserId = @userId
```

Expected generated surface:

```ts
export type FindUserParams = {
  userId: string;
};

export type FindUserRow = {
  UserId: string;
  Name: string;
  CreatedAt: Date;
};

export function findUser(
  db: SpannerExecutor,
  params: FindUserParams,
): Promise<FindUserRow[]>;
```

Exact runtime mappings for Spanner values such as `INT64`, `NUMERIC`, `DATE`, `TIMESTAMP`, `JSON`, `ARRAY`, and `STRUCT` must be explicit and documented.

## Phase 2 — Minimal typed templates for dynamic SQL

Dynamic SQL should not require the old fluent query-builder model.

The target is a **structured SQL template API**, not a second SQL language.

Example direction:

```ts
query((ctx, input) => sql`
  SELECT
    u.UserId,
    u.Name
  FROM Users AS u
  ${where([
    when(input.name, sql`
      u.Name LIKE ${ctx.param(input.name)}
    `),
    when(input.statuses?.length, sql`
      u.Status IN UNNEST(${ctx.param(input.statuses)})
    `),
  ])}
`);
```

### DSL boundary

Prefer plain SQL for:

- `LIKE`
- comparisons
- `BETWEEN`
- `IS NULL`
- fixed `AND` / `OR`
- fixed `IN UNNEST(...)`
- joins
- CTEs
- grouping
- window functions
- Spanner-specific SQL syntax

Provide helpers only when structure itself is dynamic, for example:

- `sql```
- `param(...)`
- `when(...)`
- `where(...)`
- dynamic predicate joining (`AND` / `OR`) when the number of predicates is dynamic
- safe dynamic identifiers
- safe dynamic ordering

Fragments should carry enough type information to prevent invalid composition without recreating the entire Spanner expression type system in TypeScript.

## Phase 3 — Schema and migration management

Spaniel should treat schema migrations as part of the Typed SQL contract.

### Goals

- Manage ordered SQL migration files.
- Maintain a schema version / migration metadata table.
- Support schema compatibility checks from clients.
- Allow a package to declare the schema versions it supports.
- Keep migration execution separate from ordinary application startup.

Example compatibility model:

```ts
export const schemaContract = {
  minVersion: 42,
  maxVersion: 45,
  preferredVersion: 45,
};
```

Exact-version matching is intentionally avoided so that rolling deployments can support expand/contract migrations.

## Phase 4 — Spanner Omni verification

Use **Spanner Omni** as the preferred integration environment for schema and migration verification when practical.

### Verification flow

```text
start Omni once
    |
create disposable database
    |
replay migrations
    |
verify resulting schema
    |
validate all Typed SQL
    |
drop disposable database
```

Do not restart or recreate Omni for each test. A single Omni process can host disposable databases for isolated test runs.

### CI modes

Fast validation:

```text
latest schema snapshot
    -> temporary database
    -> Typed SQL validation
```

Full migration validation:

```text
empty database
    -> migration 0001
    -> migration 0002
    -> ...
    -> latest
    -> schema comparison
    -> Typed SQL validation
```

The full replay can run only when migration files change, on the main branch, or in scheduled CI if it becomes expensive.

Spanner Omni remains an adapter boundary because its availability and client support may evolve independently from Spaniel.

## Phase 5 — Configuration profiles

Use TOML for user configuration with a published schema for validation and editor completion.

Suggested shape:

```toml
default_profile = "local"

dialect = "google-sql"

[generator]
sql = "sql/**/*.sql"
output = "src/generated"

[migrations]
directory = "migrations"

[profiles.local]
backend = "omni"

[profiles.ci]
backend = "omni"

[profiles.staging]
backend = "cloud"

[profiles.staging.spanner]
project = "my-staging-project"
instance = "app"
database = "app"
```

Profiles are named configuration overlays, not a scripting language.

Resolution order should be deterministic:

```text
CLI arguments
> environment variables
> selected profile
> root configuration
> defaults
```

Provide a command such as:

```bash
spaniel config resolve --profile ci
```

that prints the final resolved configuration and, where useful, the source of each value.

### Configuration schema

Prefer:

- TOML as the user-facing format
- JSON Schema for editor / Taplo integration
- optionally generate that JSON Schema from a more maintainable source such as CUE if this becomes useful

Do not introduce a custom configuration DSL.

## Phase 6 — Shared package usage

The intended deployment model includes multiple execution forms of the same application:

- API
- worker
- batch
- CLI

These processes may share a generated Spaniel database package containing:

- query / command contracts
- generated parameter and row types
- runtime codecs
- transaction primitives
- schema compatibility metadata

This package is effectively an internal typed database SDK.

It is **not** intended as a shared database abstraction across independently owned microservice bounded contexts. Independent services should own their own data stores and communicate through APIs or events rather than a common database package.

## Non-goals

Spaniel should not become:

- a full ORM
- an Active Record implementation
- a general-purpose fluent SQL query builder
- a duplicate implementation of GoogleSQL type semantics
- a database portability layer hiding Spanner-specific features
- a configuration programming language

## Existing code migration

The current fluent builder and AST implementation should be treated as experimental code rather than a compatibility constraint.

Likely removal or de-emphasis:

- statement-level fluent builder APIs
- query statement AST used only to reproduce GoogleSQL syntax
- SQL printer code tied to the old builder
- column proxy machinery whose only purpose is to support the fluent DSL

Likely reusable concepts:

- Spanner parameter normalization
- Spanner-to-TypeScript type mapping
- runtime integration boundaries
- tests around Spanner value handling

## Near-term milestone

The first meaningful release should prove the smallest useful loop:

```text
.sql file
   -> Spanner-backed validation
   -> generated parameter/result TypeScript
   -> execution through @google-cloud/spanner
```

Only after this works should Spaniel add dynamic templates, migration orchestration, Omni-backed verification, and higher-level tooling.
