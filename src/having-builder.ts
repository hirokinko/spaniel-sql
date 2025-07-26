/**
 * HavingBuilder implementation built on top of WhereBuilder
 */

import type { ConditionGroup } from "./conditions.js";
import type { SchemaConstraint } from "./core-types.js";
import type { ParameterManager } from "./parameter-manager.js";
import { createWhere, createWhereWithParameters, type WhereBuilder } from "./where-builder.js";

/**
 * HavingBuilder type alias - identical to WhereBuilder
 */
// Allow arbitrary expressions in HAVING by intersecting the provided schema
// with a generic record so that any string key is permitted
export type HavingBuilder<T extends SchemaConstraint = SchemaConstraint> = WhereBuilder<T>;

/**
 * Creates a HavingBuilder with empty state
 */
export const createHaving = <T extends SchemaConstraint = SchemaConstraint>(): HavingBuilder<T> =>
  createWhere<T>();

/**
 * Creates a HavingBuilder with specific state
 * @param conditions - existing condition group
 * @param parameters - existing parameter manager
 */
export const createHavingWithParameters = <T extends SchemaConstraint = SchemaConstraint>(
  conditions: ConditionGroup,
  parameters: ParameterManager
): HavingBuilder<T> => {
  return createWhereWithParameters<T>(conditions, parameters);
};
