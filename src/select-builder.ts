/**
 * SelectQueryBuilder implementation for fluent SELECT query building
 */

import type { QueryResult, SchemaConstraint } from "./core-types.js";
import type { ParameterManager } from "./parameter-manager.js";
import { createParameterManager } from "./parameter-manager.js";
import type {
  AggregateResult,
  AliasedColumn,
  GroupByClause,
  JoinClause,
  JoinedTables,
  LeftJoinedTables,
  OrderByColumn,
  SelectColumn,
  SelectedColumns,
  SelectQuery,
  ValidSelectColumn,
} from "./select-types.js";
import { generateSelectSQL } from "./sql-generation.js";
import { createTableReference } from "./table-utils.js";
import type { WhereBuilder } from "./where-builder.js";
import { createWhere, createWhereWithParameters } from "./where-builder.js";

/**
 * Join condition builder function type
 */
export type JoinCondition<T extends SchemaConstraint, U extends SchemaConstraint> = (
  left: T,
  right: U
) => WhereBuilder<T & U>;

/**
 * SelectQueryBuilder type - immutable object with fluent interface methods
 * Generic parameter T represents the current result schema for type safety
 */
export type SelectQueryBuilder<T extends SchemaConstraint = SchemaConstraint> = {
  readonly _query: SelectQuery;
  readonly _parameters: ParameterManager;
  readonly _schema: T;

  // Column selection methods
  select<K extends keyof T>(
    ...columns: ValidSelectColumn<T, K>[]
  ): SelectQueryBuilder<SelectedColumns<T, K>>;
  selectAll(): SelectQueryBuilder<T>;
  selectAs<K extends keyof T, A extends string>(
    column: ValidSelectColumn<T, K>,
    alias: A
  ): SelectQueryBuilder<AliasedColumn<T, K, A>>;

  // Aggregate function methods
  count(column?: keyof T): SelectQueryBuilder<AggregateResult<number>>;
  sum<K extends keyof T>(
    column: ValidSelectColumn<T, K>
  ): SelectQueryBuilder<AggregateResult<T[K]>>;
  avg<K extends keyof T>(
    column: ValidSelectColumn<T, K>
  ): SelectQueryBuilder<AggregateResult<number>>;
  min<K extends keyof T>(
    column: ValidSelectColumn<T, K>
  ): SelectQueryBuilder<AggregateResult<T[K]>>;
  max<K extends keyof T>(
    column: ValidSelectColumn<T, K>
  ): SelectQueryBuilder<AggregateResult<T[K]>>;

  // Table specification methods
  from<U extends SchemaConstraint>(table: string, schema?: U): SelectQueryBuilder<U>;

  // JOIN methods
  innerJoin<U extends SchemaConstraint>(
    table: string,
    condition: JoinCondition<T, U>,
    schema?: U
  ): SelectQueryBuilder<JoinedTables<T, U>>;

  leftJoin<U extends SchemaConstraint>(
    table: string,
    condition: JoinCondition<T, U>,
    schema?: U
  ): SelectQueryBuilder<LeftJoinedTables<T, U>>;

  rightJoin<U extends SchemaConstraint>(
    table: string,
    condition: JoinCondition<T, U>,
    schema?: U
  ): SelectQueryBuilder<LeftJoinedTables<U, T>>;

  fullJoin<U extends SchemaConstraint>(
    table: string,
    condition: JoinCondition<T, U>,
    schema?: U
  ): SelectQueryBuilder<Partial<T> & Partial<U>>;

  // WHERE integration
  where(condition: (builder: WhereBuilder<T>) => WhereBuilder<T>): SelectQueryBuilder<T>;

  // Grouping methods
  groupBy<K extends keyof T>(...columns: ValidSelectColumn<T, K>[]): SelectQueryBuilder<T>;
  having(condition: (builder: WhereBuilder<T>) => WhereBuilder<T>): SelectQueryBuilder<T>;

  // Ordering methods
  orderBy<K extends keyof T>(
    column: ValidSelectColumn<T, K>,
    direction?: "ASC" | "DESC"
  ): SelectQueryBuilder<T>;

  // Pagination methods
  limit(count: number): SelectQueryBuilder<T>;
  offset(count: number): SelectQueryBuilder<T>;

  // Build final query
  build(): QueryResult;
};

/**
 * Internal helper to create a SelectQueryBuilder with specific state
 */
const createSelectWithState = <T extends SchemaConstraint = SchemaConstraint>(
  query: SelectQuery,
  parameters: ParameterManager,
  schema: T
): SelectQueryBuilder<T> => {
  const builder: SelectQueryBuilder<T> = {
    _query: query,
    _parameters: parameters,
    _schema: schema,

    select<K extends keyof T>(
      ...columns: ValidSelectColumn<T, K>[]
    ): SelectQueryBuilder<SelectedColumns<T, K>> {
      const selectColumns: SelectColumn[] = columns.map((col) => ({
        type: "column",
        column: String(col),
      }));

      const newQuery: SelectQuery = {
        ...builder._query,
        select: {
          ...builder._query.select,
          columns: selectColumns,
        },
      };

      // Create new schema with only selected columns
      const newSchema = {} as SelectedColumns<T, K>;
      for (const col of columns) {
        (newSchema as any)[col] = builder._schema[col];
      }

      return createSelectWithState(newQuery, builder._parameters, newSchema);
    },

    selectAll(): SelectQueryBuilder<T> {
      const selectColumns: SelectColumn[] = [
        {
          type: "expression",
          expression: "*",
        },
      ];

      const newQuery: SelectQuery = {
        ...builder._query,
        select: {
          ...builder._query.select,
          columns: selectColumns,
        },
      };

      return createSelectWithState(newQuery, builder._parameters, builder._schema);
    },

    selectAs<K extends keyof T, A extends string>(
      column: ValidSelectColumn<T, K>,
      alias: A
    ): SelectQueryBuilder<AliasedColumn<T, K, A>> {
      const selectColumn: SelectColumn = {
        type: "column",
        column: String(column),
        alias,
      };

      const newQuery: SelectQuery = {
        ...builder._query,
        select: {
          ...builder._query.select,
          columns: [...builder._query.select.columns, selectColumn],
        },
      };

      // Create new schema with aliased column
      const newSchema = { ...builder._schema } as any;
      delete newSchema[column];
      newSchema[alias] = builder._schema[column];

      return createSelectWithState(
        newQuery,
        builder._parameters,
        newSchema as AliasedColumn<T, K, A>
      );
    },

    count(column?: keyof T): SelectQueryBuilder<AggregateResult<number>> {
      const selectColumn: SelectColumn = column
        ? {
            type: "aggregate",
            aggregateFunction: "COUNT",
            column: String(column),
          }
        : {
            type: "aggregate",
            aggregateFunction: "COUNT",
            expression: "*",
          };

      const newQuery: SelectQuery = {
        ...builder._query,
        select: {
          ...builder._query.select,
          columns: [...builder._query.select.columns, selectColumn],
        },
      };

      const newSchema = { count: 0 } as AggregateResult<number>;
      return createSelectWithState(newQuery, builder._parameters, newSchema);
    },

    sum<K extends keyof T>(
      column: ValidSelectColumn<T, K>
    ): SelectQueryBuilder<AggregateResult<T[K]>> {
      const selectColumn: SelectColumn = {
        type: "aggregate",
        aggregateFunction: "SUM",
        column: String(column),
      };

      const newQuery: SelectQuery = {
        ...builder._query,
        select: {
          ...builder._query.select,
          columns: [...builder._query.select.columns, selectColumn],
        },
      };

      const newSchema = { sum: builder._schema[column] } as AggregateResult<T[K]>;
      return createSelectWithState(newQuery, builder._parameters, newSchema);
    },

    avg<K extends keyof T>(
      column: ValidSelectColumn<T, K>
    ): SelectQueryBuilder<AggregateResult<number>> {
      const selectColumn: SelectColumn = {
        type: "aggregate",
        aggregateFunction: "AVG",
        column: String(column),
      };

      const newQuery: SelectQuery = {
        ...builder._query,
        select: {
          ...builder._query.select,
          columns: [...builder._query.select.columns, selectColumn],
        },
      };

      const newSchema = { avg: 0 } as AggregateResult<number>;
      return createSelectWithState(newQuery, builder._parameters, newSchema);
    },

    min<K extends keyof T>(
      column: ValidSelectColumn<T, K>
    ): SelectQueryBuilder<AggregateResult<T[K]>> {
      const selectColumn: SelectColumn = {
        type: "aggregate",
        aggregateFunction: "MIN",
        column: String(column),
      };

      const newQuery: SelectQuery = {
        ...builder._query,
        select: {
          ...builder._query.select,
          columns: [...builder._query.select.columns, selectColumn],
        },
      };

      const newSchema = { min: builder._schema[column] } as AggregateResult<T[K]>;
      return createSelectWithState(newQuery, builder._parameters, newSchema);
    },

    max<K extends keyof T>(
      column: ValidSelectColumn<T, K>
    ): SelectQueryBuilder<AggregateResult<T[K]>> {
      const selectColumn: SelectColumn = {
        type: "aggregate",
        aggregateFunction: "MAX",
        column: String(column),
      };

      const newQuery: SelectQuery = {
        ...builder._query,
        select: {
          ...builder._query.select,
          columns: [...builder._query.select.columns, selectColumn],
        },
      };

      const newSchema = { max: builder._schema[column] } as AggregateResult<T[K]>;
      return createSelectWithState(newQuery, builder._parameters, newSchema);
    },

    from<U extends SchemaConstraint>(table: string, schema?: U): SelectQueryBuilder<U> {
      // Use table validation utilities from task 3.1
      const tableRefResult = createTableReference(table, undefined, schema);

      if (!tableRefResult.success) {
        // For now, throw the error - in a real implementation this might be handled differently
        throw new Error(tableRefResult.error.message);
      }

      const newQuery: SelectQuery = {
        ...builder._query,
        from: tableRefResult.data,
      };

      const newSchema = (schema || builder._schema) as U;
      return createSelectWithState(newQuery, builder._parameters, newSchema);
    },

    innerJoin<U extends SchemaConstraint>(
      table: string,
      condition: JoinCondition<T, U>,
      schema?: U
    ): SelectQueryBuilder<JoinedTables<T, U>> {
      // Create a temporary WHERE builder to get the condition
      const leftSchema = builder._schema;
      const rightSchema = schema || ({} as U);
      const joinedSchema = { ...leftSchema, ...rightSchema } as T & U;

      const conditionBuilder = condition(leftSchema, rightSchema);

      const joinClause: JoinClause = {
        type: "INNER",
        table: {
          name: table,
          schema: rightSchema,
        },
        condition: conditionBuilder._conditions,
      };

      const newQuery: SelectQuery = {
        ...builder._query,
        joins: [...builder._query.joins, joinClause],
      };

      // Merge parameters from the join condition
      const newParameters = {
        ...builder._parameters,
        parameters: {
          ...builder._parameters.parameters,
          ...conditionBuilder._parameters.parameters,
        },
        counter: Math.max(builder._parameters.counter, conditionBuilder._parameters.counter),
      };

      return createSelectWithState(newQuery, newParameters, joinedSchema);
    },

    leftJoin<U extends SchemaConstraint>(
      table: string,
      condition: JoinCondition<T, U>,
      schema?: U
    ): SelectQueryBuilder<LeftJoinedTables<T, U>> {
      // Create a temporary WHERE builder to get the condition
      const leftSchema = builder._schema;
      const rightSchema = schema || ({} as U);
      const joinedSchema = { ...leftSchema, ...rightSchema } as T & Partial<U>;

      const conditionBuilder = condition(leftSchema, rightSchema);

      const joinClause: JoinClause = {
        type: "LEFT",
        table: {
          name: table,
          schema: rightSchema,
        },
        condition: conditionBuilder._conditions,
      };

      const newQuery: SelectQuery = {
        ...builder._query,
        joins: [...builder._query.joins, joinClause],
      };

      // Merge parameters from the join condition
      const newParameters = {
        ...builder._parameters,
        parameters: {
          ...builder._parameters.parameters,
          ...conditionBuilder._parameters.parameters,
        },
        counter: Math.max(builder._parameters.counter, conditionBuilder._parameters.counter),
      };

      return createSelectWithState(newQuery, newParameters, joinedSchema);
    },

    rightJoin<U extends SchemaConstraint>(
      table: string,
      condition: JoinCondition<T, U>,
      schema?: U
    ): SelectQueryBuilder<LeftJoinedTables<U, T>> {
      // Create a temporary WHERE builder to get the condition
      const leftSchema = builder._schema;
      const rightSchema = schema || ({} as U);
      const joinedSchema = { ...rightSchema, ...leftSchema } as Partial<T> & U;

      const conditionBuilder = condition(leftSchema, rightSchema);

      const joinClause: JoinClause = {
        type: "RIGHT",
        table: {
          name: table,
          schema: rightSchema,
        },
        condition: conditionBuilder._conditions,
      };

      const newQuery: SelectQuery = {
        ...builder._query,
        joins: [...builder._query.joins, joinClause],
      };

      // Merge parameters from the join condition
      const newParameters = {
        ...builder._parameters,
        parameters: {
          ...builder._parameters.parameters,
          ...conditionBuilder._parameters.parameters,
        },
        counter: Math.max(builder._parameters.counter, conditionBuilder._parameters.counter),
      };

      return createSelectWithState(newQuery, newParameters, joinedSchema);
    },

    fullJoin<U extends SchemaConstraint>(
      table: string,
      condition: JoinCondition<T, U>,
      schema?: U
    ): SelectQueryBuilder<Partial<T> & Partial<U>> {
      // Create a temporary WHERE builder to get the condition
      const leftSchema = builder._schema;
      const rightSchema = schema || ({} as U);
      const joinedSchema = { ...leftSchema, ...rightSchema } as Partial<T> & Partial<U>;

      const conditionBuilder = condition(leftSchema, rightSchema);

      const joinClause: JoinClause = {
        type: "FULL",
        table: {
          name: table,
          schema: rightSchema,
        },
        condition: conditionBuilder._conditions,
      };

      const newQuery: SelectQuery = {
        ...builder._query,
        joins: [...builder._query.joins, joinClause],
      };

      // Merge parameters from the join condition
      const newParameters = {
        ...builder._parameters,
        parameters: {
          ...builder._parameters.parameters,
          ...conditionBuilder._parameters.parameters,
        },
        counter: Math.max(builder._parameters.counter, conditionBuilder._parameters.counter),
      };

      return createSelectWithState(newQuery, newParameters, joinedSchema);
    },

    where(condition: (builder: WhereBuilder<T>) => WhereBuilder<T>): SelectQueryBuilder<T> {
      // Create WHERE builder with current parameter state to maintain parameter counter
      const whereBuilder = createWhereWithParameters<T>(
        { type: "and", conditions: [] },
        builder._parameters
      );
      const conditionBuilder = condition(whereBuilder);

      // If no conditions were added, return unchanged builder
      if (conditionBuilder._conditions.conditions.length === 0) {
        return builder;
      }

      // Combine with existing WHERE conditions if they exist
      const newQuery: SelectQuery = builder._query.where
        ? {
            ...builder._query,
            where: {
              type: "and",
              conditions: [
                ...builder._query.where.conditions,
                ...conditionBuilder._conditions.conditions,
              ],
            },
          }
        : {
            ...builder._query,
            where: conditionBuilder._conditions,
          };

      // Merge parameters from the WHERE condition
      const newParameters = {
        ...builder._parameters,
        parameters: {
          ...builder._parameters.parameters,
          ...conditionBuilder._parameters.parameters,
        },
        counter: Math.max(builder._parameters.counter, conditionBuilder._parameters.counter),
      };

      return createSelectWithState(newQuery, newParameters, builder._schema);
    },

    groupBy<K extends keyof T>(...columns: ValidSelectColumn<T, K>[]): SelectQueryBuilder<T> {
      const groupByClause: GroupByClause = {
        columns: columns.map((col) => String(col)),
        expressions: [],
      };

      const newQuery: SelectQuery = {
        ...builder._query,
        groupBy: groupByClause,
      };

      return createSelectWithState(newQuery, builder._parameters, builder._schema);
    },

    having(condition: (builder: WhereBuilder<T>) => WhereBuilder<T>): SelectQueryBuilder<T> {
      const whereBuilder = createWhere<T>();
      const conditionBuilder = condition(whereBuilder);

      const newQuery: SelectQuery = {
        ...builder._query,
        having: conditionBuilder._conditions,
      };

      // Merge parameters from the HAVING condition
      const newParameters = {
        ...builder._parameters,
        parameters: {
          ...builder._parameters.parameters,
          ...conditionBuilder._parameters.parameters,
        },
        counter: Math.max(builder._parameters.counter, conditionBuilder._parameters.counter),
      };

      return createSelectWithState(newQuery, newParameters, builder._schema);
    },

    orderBy<K extends keyof T>(
      column: ValidSelectColumn<T, K>,
      direction: "ASC" | "DESC" = "ASC"
    ): SelectQueryBuilder<T> {
      const orderByColumn: OrderByColumn = {
        column: String(column),
        direction,
      };

      const newQuery: SelectQuery = {
        ...builder._query,
        orderBy: {
          columns: [...(builder._query.orderBy?.columns || []), orderByColumn],
        },
      };

      return createSelectWithState(newQuery, builder._parameters, builder._schema);
    },

    limit(count: number): SelectQueryBuilder<T> {
      const newQuery: SelectQuery = {
        ...builder._query,
        limit: count,
      };

      return createSelectWithState(newQuery, builder._parameters, builder._schema);
    },

    offset(count: number): SelectQueryBuilder<T> {
      const newQuery: SelectQuery = {
        ...builder._query,
        offset: count,
      };

      return createSelectWithState(newQuery, builder._parameters, builder._schema);
    },

    build(): QueryResult {
      const sql = generateSelectSQL(builder._query);
      return {
        sql,
        parameters: builder._parameters.parameters,
      };
    },
  };

  return builder;
};

/**
 * Creates a new SelectQueryBuilder instance with empty query structure
 */
export const createSelect = <T extends SchemaConstraint = SchemaConstraint>(
  schema?: T
): SelectQueryBuilder<T> => {
  const emptyQuery: SelectQuery = {
    select: {
      columns: [],
    },
    joins: [],
  };

  const emptyParameters = createParameterManager();
  const querySchema = schema || ({} as T);

  return createSelectWithState(emptyQuery, emptyParameters, querySchema);
};
