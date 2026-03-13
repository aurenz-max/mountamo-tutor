/**
 * Eval Mode Schema Constraints
 *
 * Shared utilities for constraining Gemini schemas and prompts based on
 * target eval modes from the IRT calibration system.
 *
 * Instead of asking Gemini via prompt to only generate certain challenge types
 * (which it ignores ~30% of the time), these utilities:
 * 1. Narrow the schema `enum` so Gemini *cannot* output disallowed types
 * 2. Strip irrelevant challenge-type docs from the prompt (fewer tokens, less confusion)
 * 3. Read challenge type lists from the catalog's EvalModeDefinition (single source of truth)
 */

import { Schema } from '@google/genai';
import { getComponentById } from '../manifest/catalog';
import type { EvalModeDefinition } from '../../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EvalModeConstraint {
  /** The resolved catalog definition for this eval mode */
  definition: EvalModeDefinition;
  /** Challenge types allowed by this mode (from catalog) */
  allowedTypes: string[];
  /** Prompt fragment: only the docs for allowed challenge types */
  promptDocs: string;
}

/**
 * Per-challenge-type documentation fragment.
 * Each generator defines these for its own domain.
 *
 * `promptDoc` is the text injected into the Gemini prompt for that type.
 * `schemaDescription` is a concise label used in the schema's type field.
 */
export interface ChallengeTypeDoc {
  promptDoc: string;
  schemaDescription: string;
}

// ---------------------------------------------------------------------------
// Resolve eval mode from catalog (single source of truth)
// ---------------------------------------------------------------------------

/**
 * Look up the EvalModeDefinition for a given component + eval mode key.
 * Returns null if no targetEvalMode provided or if the mode isn't found in the catalog.
 */
export function resolveEvalMode(
  componentId: string,
  targetEvalMode: string | undefined,
): EvalModeDefinition | null {
  if (!targetEvalMode) return null;

  const entry = getComponentById(componentId);
  if (!entry?.evalModes) return null;

  return entry.evalModes.find(m => m.evalMode === targetEvalMode) ?? null;
}

/**
 * Resolve eval mode AND build the prompt docs / allowed types in one call.
 *
 * @param componentId - The primitive's catalog ID (e.g. 'ten-frame')
 * @param targetEvalMode - The eval mode key from config (e.g. 'build')
 * @param challengeTypeDocs - Generator-defined docs per challenge type
 * @returns Constraint object, or null if no eval mode targeting
 */
export function resolveEvalModeConstraint(
  componentId: string,
  targetEvalMode: string | undefined,
  challengeTypeDocs: Record<string, ChallengeTypeDoc>,
): EvalModeConstraint | null {
  const definition = resolveEvalMode(componentId, targetEvalMode);
  if (!definition) return null;

  const allowedTypes = definition.challengeTypes;

  // Build prompt fragment with only the relevant challenge type docs
  const promptDocs = allowedTypes
    .filter(t => challengeTypeDocs[t])
    .map(t => `- ${challengeTypeDocs[t].promptDoc}`)
    .join('\n');

  return { definition, allowedTypes, promptDocs };
}

// ---------------------------------------------------------------------------
// Schema constraint: narrow challenge.type enum
// ---------------------------------------------------------------------------

/**
 * Optional config for generators whose challenge-type field doesn't live at
 * the default path `schema.properties.challenges.items.properties.type`.
 *
 * Literacy generators use varied field names (`mode`, `operation`, `clueType`,
 * `patternType`) and array names (`challenges`, `words`, `instances`, `questions`),
 * or place the type field at the schema root instead of inside an array.
 */
export interface SchemaConstraintConfig {
  /** Array name containing challenge items (default: `'challenges'`). Ignored when `rootLevel` is true. */
  arrayName?: string;
  /** Field name for the challenge type within each item, or at root level (default: `'type'`). */
  fieldName?: string;
  /** If true, the type field is at the schema root, not inside an array of items. */
  rootLevel?: boolean;
}

/**
 * Deep-clone a schema and narrow a challenge-type enum to only allowed values.
 *
 * Default path: `schema.properties.challenges.items.properties.type`
 * With config: navigates to the field specified by `SchemaConstraintConfig`.
 *
 * Sets `enum` to `allowedTypes` and updates the description to list only those types.
 *
 * @param baseSchema - The full generator schema (not mutated)
 * @param allowedTypes - Challenge types to allow (e.g. ['build'])
 * @param challengeTypeDocs - For building a constrained description string
 * @param config - Optional path config for non-standard field locations
 * @returns A new schema with the type field enum-constrained
 */
export function constrainChallengeTypeEnum(
  baseSchema: Schema,
  allowedTypes: string[],
  challengeTypeDocs: Record<string, ChallengeTypeDoc>,
  config?: SchemaConstraintConfig,
): Schema {
  // Deep clone to avoid mutating the module-level schema
  const schema: Schema = JSON.parse(JSON.stringify(baseSchema));

  const props = (schema as Record<string, unknown>).properties as Record<string, unknown>;
  const fieldName = config?.fieldName ?? 'type';

  let typeField: Record<string, unknown> | undefined;

  if (config?.rootLevel) {
    // Field is at schema root (e.g., patternType, sentenceType)
    typeField = props?.[fieldName] as Record<string, unknown> | undefined;
  } else {
    // Field is inside an array of items
    const arrayName = config?.arrayName ?? 'challenges';
    const array = props?.[arrayName] as Record<string, unknown> | undefined;
    const items = array?.items as Record<string, unknown> | undefined;
    const itemProps = items?.properties as Record<string, unknown> | undefined;
    typeField = itemProps?.[fieldName] as Record<string, unknown> | undefined;
  }

  if (typeField) {
    typeField.enum = allowedTypes;
    // Update description to only mention allowed types
    const descriptions = allowedTypes
      .map(t => challengeTypeDocs[t]?.schemaDescription ?? t)
      .join(', ');
    typeField.description = `Challenge type: ${descriptions}`;
  }

  return schema;
}

// ---------------------------------------------------------------------------
// Prompt builder helper
// ---------------------------------------------------------------------------

/**
 * Build the challenge types section of a prompt.
 *
 * When an eval mode is active, includes ONLY the allowed types' docs plus
 * a difficulty constraint header. When no eval mode, includes all types.
 *
 * @param constraint - Resolved eval mode constraint (null = all types)
 * @param allDocs - Full challenge type docs from the generator
 * @returns Prompt section string
 */
export function buildChallengeTypePromptSection(
  constraint: EvalModeConstraint | null,
  allDocs: Record<string, ChallengeTypeDoc>,
): string {
  if (constraint) {
    return `## ADAPTIVE DIFFICULTY CONSTRAINT (IRT calibration β=${constraint.definition.beta})
Mode: ${constraint.definition.label} — ${constraint.definition.description}
Generate ONLY the following challenge type(s):

CHALLENGE TYPES (allowed for this mode):
${constraint.promptDocs}`;
  }

  // No eval mode — include all challenge type docs
  const allPromptDocs = Object.entries(allDocs)
    .map(([, doc]) => `- ${doc.promptDoc}`)
    .join('\n');

  return `CHALLENGE TYPES:\n${allPromptDocs}`;
}

// ---------------------------------------------------------------------------
// Logging helper (shared across generators)
// ---------------------------------------------------------------------------

/**
 * Log the resolved eval mode constraint for observability.
 * Call after resolveEvalModeConstraint() in each generator.
 */
export function logEvalModeResolution(
  label: string,
  targetEvalMode: string | undefined,
  constraint: EvalModeConstraint | null,
): void {
  if (constraint) {
    console.log(`[${label}] evalMode: "${targetEvalMode}" → schema enum: [${constraint.allowedTypes.join(', ')}] (β=${constraint.definition.beta})`);
  } else {
    console.log(`[${label}] No targetEvalMode — full schema, mixed difficulty`);
  }
}
