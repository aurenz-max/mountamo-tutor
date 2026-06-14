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

import { Schema, Type } from '@google/genai';
import { getComponentById } from '../manifest/catalog';
import { ai } from '../geminiClient';
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
// Schema constraint: numeric range on a quantity field
// ---------------------------------------------------------------------------

/**
 * Deep-clone a schema and constrain a numeric field's range with
 * `minimum`/`maximum` (Gemini structured output honors both). The schema-level
 * twin of constrainChallengeTypeEnum: out-of-range values become
 * unrepresentable instead of merely discouraged in the prompt.
 *
 * Only safe when the field's semantics are uniform across generated items —
 * i.e. when a single eval mode is pinned. Mixed-mode schemas must not use this
 * (e.g. counting-board 'compare' uses `count` as the total of both groups).
 *
 * Default path: `schema.properties.challenges.items.properties.<fieldName>`.
 */
export function constrainNumericRange(
  baseSchema: Schema,
  fieldName: string,
  range: { minimum?: number; maximum?: number },
  config?: Omit<SchemaConstraintConfig, 'fieldName'>,
): Schema {
  const schema: Schema = JSON.parse(JSON.stringify(baseSchema));
  const props = (schema as Record<string, unknown>).properties as Record<string, unknown>;

  let field: Record<string, unknown> | undefined;
  if (config?.rootLevel) {
    field = props?.[fieldName] as Record<string, unknown> | undefined;
  } else {
    const arrayName = config?.arrayName ?? 'challenges';
    const array = props?.[arrayName] as Record<string, unknown> | undefined;
    const items = array?.items as Record<string, unknown> | undefined;
    const itemProps = items?.properties as Record<string, unknown> | undefined;
    field = itemProps?.[fieldName] as Record<string, unknown> | undefined;
  }

  if (field) {
    if (range.minimum !== undefined) field.minimum = range.minimum;
    if (range.maximum !== undefined) field.maximum = range.maximum;
    const bounds = [
      range.minimum !== undefined ? `min ${range.minimum}` : null,
      range.maximum !== undefined ? `max ${range.maximum}` : null,
    ].filter(Boolean).join(', ');
    field.description = `${field.description ?? ''} (REQUIRED RANGE: ${bounds})`.trim();
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
// Generator-driven mode resolution (intent → single | subset | mixed)
// ---------------------------------------------------------------------------
//
// When the manifest did NOT pin a mode (config.targetEvalMode empty — the common
// case), the generator resolves its OWN mode set from the component intent. The
// enum is scoped to THIS primitive's modes — the only place that scoping is
// expressible, since the valid set is a function of componentId, which the
// manifest schema can't conditionally constrain. The micro-call returns:
//   - one mode  → single-skill session
//   - several   → curated blend
//   - all/none  → genuine mixed (returns null; caller leaves the schema open)
// An explicit targetEvalMode (tester or curator) short-circuits with NO LLM call.

export interface EvalModeResolution {
  /** Selected mode definitions. length 1 = single skill, 2+ = curated blend. */
  modes: EvalModeDefinition[];
  /** Union of challenge types across the selected modes (schema-enum source). */
  allowedTypes: string[];
  /** Prompt fragment: docs for the allowed challenge types only. */
  promptDocs: string;
  /** How the selection was made — observability only. */
  source: 'explicit' | 'resolved';
}

function buildResolution(
  modes: EvalModeDefinition[],
  challengeTypeDocs: Record<string, ChallengeTypeDoc>,
  source: 'explicit' | 'resolved',
): EvalModeResolution {
  // Union the modes' challenge types, de-duped, order preserved (handles modes
  // like ten-frame's 'operate' that own more than one challenge type).
  const allowedTypes = Array.from(new Set(modes.flatMap(m => m.challengeTypes)));
  const promptDocs = allowedTypes
    .filter(t => challengeTypeDocs[t])
    .map(t => `- ${challengeTypeDocs[t].promptDoc}`)
    .join('\n');
  return { modes, allowedTypes, promptDocs, source };
}

/**
 * Resolve which eval mode(s) a component should generate, from its intent.
 *
 * @param componentId       Catalog ID (e.g. 'ten-frame').
 * @param opts.targetEvalMode  Explicit pin (tester/curator). When set, wins with NO LLM call.
 * @param opts.intent          Component intent — the routing signal.
 * @param opts.objectiveText   Parent objective — secondary signal.
 * @param challengeTypeDocs    Generator-defined docs per challenge type.
 * @returns Resolution, or null for the MIXED case (caller leaves schema unconstrained).
 */
export async function resolveEvalModes(
  componentId: string,
  opts: { targetEvalMode?: string; intent?: string; objectiveText?: string },
  challengeTypeDocs: Record<string, ChallengeTypeDoc>,
): Promise<EvalModeResolution | null> {
  const entry = getComponentById(componentId);
  const modes = entry?.evalModes ?? [];

  // 1. Explicit pin (tester / curator / lesson resolver) wins — no LLM call.
  //    The pin channel carries single | blend | mixed (see resolveLessonEvalModes):
  //      - 'mixed' (or any unknown key) → genuine mixed; leave the schema open.
  //      - 'a|b'                        → curated blend; constrain to those modes.
  //      - '<key>'                      → single skill.
  if (opts.targetEvalMode) {
    const raw = opts.targetEvalMode.trim();
    if (raw === 'mixed') return null; // explicit broad/mixed practice
    const keys = raw.split('|').map(k => k.trim()).filter(Boolean);
    const defs = keys
      .map(k => modes.find(m => m.evalMode === k))
      .filter((m): m is EvalModeDefinition => Boolean(m));
    // Known key(s) → single (1) or curated blend (2+). Unknown/empty → mixed.
    return defs.length ? buildResolution(defs, challengeTypeDocs, 'explicit') : null;
  }

  // 2. Nothing to resolve: primitive has <2 modes, or no intent signal at all.
  const intentSignal = [opts.intent, opts.objectiveText].filter(Boolean).join(' — ').trim();
  if (modes.length < 2 || !intentSignal) return null;

  // 3. Resolve the subset from intent via a single-purpose enum micro-call.
  const modeKeys = modes.map(m => m.evalMode);
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      modes: {
        type: Type.ARRAY,
        items: { type: Type.STRING, enum: modeKeys },
        description:
          'The eval mode key(s) whose SKILL the intent asks the student to do. ' +
          'Return ONE for a single-skill task, SEVERAL for a genuine blend, or ALL of them ' +
          'when broad mixed practice is right. Match by skill/content only — never by difficulty or lesson position.',
      },
    },
    required: ['modes'],
  };

  const prompt = `You are routing one learning component to the right skill(s) for the primitive "${componentId}".

COMPONENT INTENT: "${opts.intent ?? ''}"
${opts.objectiveText ? `LEARNING OBJECTIVE: "${opts.objectiveText}"` : ''}

This primitive can teach these DISTINCT skills (eval modes). Each is a different thing to learn, NOT a difficulty level:
${modes.map(m => `- ${m.evalMode}: ${m.label} — ${m.description}`).join('\n')}

Return the subset of mode keys whose skill the intent calls for:
- One key if the intent is a single skill.
- Several keys if the intent genuinely spans more than one of these skills.
- All keys if the intent is broad / mixed practice with no single skill emphasized.`;

  try {
    const result = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: prompt,
      config: { responseMimeType: 'application/json', responseSchema: schema },
    });
    const parsed = result.text ? (JSON.parse(result.text) as { modes?: string[] }) : null;
    const unique = Array.from(new Set((parsed?.modes ?? []).filter(k => modeKeys.includes(k))));

    // Empty selection or "all modes" → genuine mixed; don't constrain.
    if (unique.length === 0 || unique.length === modeKeys.length) {
      console.log(`[resolveEvalModes] ${componentId}: intent → mixed (${unique.length}/${modeKeys.length} selected)`);
      return null;
    }

    const selected = modes.filter(m => unique.includes(m.evalMode));
    console.log(`[resolveEvalModes] ${componentId}: intent → [${unique.join(', ')}]`);
    return buildResolution(selected, challengeTypeDocs, 'resolved');
  } catch (err) {
    console.warn(`[resolveEvalModes] ${componentId}: resolution failed, falling back to mixed —`, err);
    return null;
  }
}

/**
 * Build the challenge-types prompt section from an EvalModeResolution.
 * Generalizes buildChallengeTypePromptSection to the single | blend | mixed cases.
 */
export function buildModeConstraintSection(
  resolution: EvalModeResolution | null,
  allDocs: Record<string, ChallengeTypeDoc>,
): string {
  // Mixed — all challenge types in play.
  if (!resolution) {
    const all = Object.values(allDocs).map(d => `- ${d.promptDoc}`).join('\n');
    return `CHALLENGE TYPES (mixed session — vary across all of these):\n${all}`;
  }

  if (resolution.modes.length === 1) {
    const m = resolution.modes[0];
    return `## EVAL MODE: ${m.label} (β=${m.beta})
${m.description}
Generate ONLY the following challenge type(s):

${resolution.promptDocs}`;
  }

  const labels = resolution.modes.map(m => m.label).join(' + ');
  return `## EVAL MODES — CURATED BLEND: ${labels}
Generate a MIX of ONLY the challenge types below, distributed across the session (do not collapse to just one):

${resolution.promptDocs}`;
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
