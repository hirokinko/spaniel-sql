# Spaniel Roadmap

Spaniel is being redesigned from a fluent query-builder DSL into a **Spanner-native Typed SQL toolchain**.

The core principle is:

> Keep queries executable as native GoogleSQL wherever possible. Use minimal 2-way annotations only for dynamic structure, and let Spanner remain the authority for SQL semantics and types.

Spaniel should not re-implement GoogleSQL in TypeScript. Its job is to preserve SQL transparency while adding type generation, template-context validation, schema compatibility, and migration verification around Spanner.

## Design principles

1. **SQL-first**
   - Query files remain ordinary `.sql` files.
   - Fixed queries are plain GoogleSQL.
   - Dynamic queries use minimal 2-way SQL annotations rather than a second TypeScript query language.

2. **Keep SQL directly inspectable and executable**
   - A query file should remain useful outside Spaniel.
   - Developers should be able to paste its example form into Spanner Studio or other Spanner tooling for debugging, plan inspection, and performance investigation.

3. **Minimal DSL surface**
   - Spaniel must not reproduce `SELECT`, `FROM`, `JOIN`, `LIKE`, comparison operators, CTEs, window functions, or other ordinary SQL syntax as fluent APIs.
   - Template syntax is reserved for control flow and bind examples needed to keep a dynamic query executable as ordinary SQL.

4. **Spanner as the type checker**
   - Use Spanner-backed analysis to infer and validate parameter and result types wherever possible.
   - Do not duplicate GoogleSQL operator/type rules in TypeScript.
   - Generate TypeScript contracts from Spanner metadata rather than from a parallel ORM-style schema model.

5. **Typed 2-way SQL context validation**
   - Spaniel parses template variables and control flow from 2-way SQL annotations.
   - It renders parameterized GoogleSQL for application execution.
   - It checks the template context against Spanner-inferred parameter types.
   - Representative template expansions are validated against Spanner.

6. **No duplicate schema model unless unavoidable**
   - Avoid maintaining a second TypeScript schema model solely to type queries.
   - Prefer Spanner schema introspection and generated metadata.

7. **Migration and query validation are one toolchain**
   - A schema produced by migrations must be the same schema against which plain and 2-way Typed SQL are validated.

## Target architecture

```text
                          Spaniel
                            |
                    Typed SQL files
                            |
              +-------------+-------------+
              |                           |
          Plain SQL                  2-way SQL
              |                           |
              |                    template parse
              |                    context analysis
              |                    branch expansion
              |                           |
              +-------------+-------------+
                            |
                    native GoogleSQL
                            |
                    Spanner validation
                            |
             parameter/result type metadata
                            |
                    generated TypeScript
```

Runtime responsibilities remain deliberately small:

- execute typed queries and commands;
- bind and normalize Spanner parameters;
- handle Spanner-specific value codecs;
- render 2-way SQL branches from a validated context;
- expose transaction primitives where needed;
- optionally validate schema compatibility at startup.

## Phase 1 — Typed SQL core

Replace the fluent statement builder as the primary API.

### Goals

- Load `.sql` files.
- Analyze SQL against a real Spanner-compatible schema.
- Infer input parameter types.
- Infer result row types.
- Generate TypeScript query functions and types.
- Preserve Spanner-native SQL instead of translating through an internal statement DSL.
- Keep the analysis/runtime boundary reusable by the later typed 2-way SQL layer.

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

## Phase 2 — Typed 2-way SQL

Add dynamic SQL without introducing a TypeScript statement-level DSL.

The target is **typed 2-way SQL**: SQL files remain directly executable in Spanner tooling, while comments/annotations carry only the information needed for template control flow and parameter binding.

Example direction:

```sql
SELECT
  UserId,
  Name,
  Status
FROM Users
WHERE TRUE
/*% if status != null */
  AND Status = /* status */ 'active'
/*% end */
/*% if ids != null */
  AND UserId IN UNNEST(/* ids */ [1, 2, 3])
/*% end */
```

When pasted directly into Spanner tooling, the comments disappear and the example literals leave valid GoogleSQL.

For application execution, Spaniel should render parameterized SQL and bind values through the Spanner client.

### Type-validation model

```text
2-way SQL template
      |
      +--> template variables / control flow
      |
      +--> parameterized GoogleSQL --> Spanner analysis
                                   --> inferred parameter/result types
      |
      +--> context <-> Spanner type validation
      |
      +--> generated TypeScript contract
```

Spaniel should validate the boundary, not reproduce SQL semantics.

For example, Spaniel should not implement its own rules for whether `LIKE`, `IN`, `BETWEEN`, comparisons, or Spanner-specific expressions are valid. It should render valid GoogleSQL and let Spanner analyze those expressions.

### Initial template scope

Start with optional predicates in positions that naturally remain valid SQL, for example:

```sql
WHERE TRUE
/*% if condition */
  AND ...
/*% end */
```

Initial support should include:

- template variables referenced by conditions;
- bind-parameter example literals;
- documented nullable/optional semantics;
- generation of typed parameter/result contracts;
- representative expansion validation against Spanner.

More structurally difficult features such as optional projections, joins, arbitrary clause insertion, or nested control flow should be added only when justified by real use cases.

### DSL boundary

Do not add fluent wrappers for ordinary fixed SQL syntax such as:

- `SELECT` / `FROM` / `JOIN`;
- `LIKE`;
- comparisons;
- `BETWEEN`;
- `IS NULL`;
- fixed `AND` / `OR`;
- fixed `IN UNNEST(...)`;
- CTEs;
- grouping;
- window functions;
- Spanner-specific SQL syntax.

The template language should remain much smaller than GoogleSQL itself.

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

Use **Spanner Omni** as the preferred integration environment for schema, migration, and Typed SQL verification when practical.

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
validate plain Typed SQL
    |
render representative 2-way SQL expansions
    |
validate context and result types
    |
drop disposable database
```

Do not restart or recreate Omni for each test. A single Omni process can host disposable databases for isolated test runs.

### 2-way SQL verification

The directly executable example form is useful but is not sufficient by itself.

At minimum, verification should cover:

- the directly executable example SQL;
- a baseline expansion where optional branches are disabled when valid;
- each optional branch enabled independently;
- representative combinations when branches interact structurally.

Avoid blindly evaluating all `2^N` combinations. Prefer template-structure-aware coverage and report the exact expansion/context that failed.

### CI modes

Fast validation:

```text
latest schema snapshot
    -> temporary database
    -> plain Typed SQL validation
    -> representative 2-way SQL validation
```

Full migration validation:

```text
empty database
    -> migration 0001
    -> migration 0002
    -> ...
    -> latest
    -> schema comparison
    -> plain Typed SQL validation
    -> representative 2-way SQL validation
```

The full replay can run only when migration files change, on the main branch, or in scheduled CI if it becomes expensive.

Spanner Omni remains behind an adapter boundary because its availability and client support may evolve independently from Spaniel.

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

- TOML as the user-facing format;
- JSON Schema for editor / Taplo integration;
- optionally generate that JSON Schema from a more maintainable source such as CUE if this becomes useful.

Do not introduce a custom configuration DSL.

## Phase 6 — Shared package usage

The intended deployment model includes multiple execution forms of the same application:

- API;
- worker;
- batch;
- CLI.

These processes may share a generated Spaniel database package containing:

- query / command contracts;
- generated parameter and row types;
- runtime codecs;
- transaction primitives;
- schema compatibility metadata.

This package is effectively an internal typed database SDK.

It is **not** intended as a shared database abstraction across independently owned microservice bounded contexts. Independent services should own their own data stores and communicate through APIs or events rather than a common database package.

## Non-goals

Spaniel should not become:

- a full ORM;
- an Active Record implementation;
- a general-purpose fluent SQL query builder;
- a TypeScript reimplementation of GoogleSQL type semantics;
- a database portability layer hiding Spanner-specific features;
- a TypeScript dynamic-SQL template DSL that replaces executable SQL files;
- a configuration programming language.

## Existing code migration

The current fluent builder and AST implementation should be treated as experimental code rather than a compatibility constraint.

Likely removal or de-emphasis:

- statement-level fluent builder APIs;
- query statement AST used only to reproduce GoogleSQL syntax;
- SQL printer code tied to the old builder;
- column proxy machinery whose only purpose is to support the fluent DSL.

Likely reusable concepts:

- Spanner parameter normalization;
- Spanner-to-TypeScript type mapping;
- runtime integration boundaries;
- tests around Spanner value handling.

## Near-term milestone

The first meaningful release should prove the smallest useful loop:

```text
.sql file
   -> Spanner-backed validation
   -> generated parameter/result TypeScript
   -> execution through @google-cloud/spanner
```

After that works, add typed 2-way SQL context validation before moving on to migration orchestration, Omni-backed verification, and higher-level tooling.
