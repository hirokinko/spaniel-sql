/**
 * Parameter management for query building
 */

import type { ParameterValue } from "./core-types.js";

/**
 * Immutable parameter manager for handling query parameters
 */
export type ParameterManager = {
  readonly parameters: Record<string, ParameterValue>;
  readonly counter: number;
};

/**
 * Creates a new empty parameter manager
 */
export const createParameterManager = (): ParameterManager => ({
  parameters: {},
  counter: 0,
});

/**
 * Adds a parameter to the manager, reusing existing parameters with the same value
 * @param manager - The current parameter manager
 * @param value - The value to add as a parameter
 * @returns A tuple containing the new manager and the parameter name (with @ prefix)
 */
export const addParameter = (
  manager: ParameterManager,
  value: ParameterValue
): [ParameterManager, string] => {
  // Check if value already exists to reuse parameter
  const existingParam = Object.entries(manager.parameters).find(([_, v]) => {
    // Use strict equality for primitive values and null/undefined
    if (value === null || value === undefined || typeof value !== "object") {
      return v === value;
    }
    // For arrays, compare by JSON serialization (simple approach for now)
    if (Array.isArray(value) && Array.isArray(v)) {
      return JSON.stringify(value) === JSON.stringify(v);
    }
    // For other objects, use strict equality (reference comparison)
    return v === value;
  })?.[0];

  if (existingParam) {
    return [manager, `@${existingParam}`];
  }

  // Create new parameter
  const newCounter = manager.counter + 1;
  const paramName = `param${newCounter}`;

  return [
    {
      parameters: { ...manager.parameters, [paramName]: value },
      counter: newCounter,
    },
    `@${paramName}`,
  ];
};
