/**
 * scopeContext.ts — Shared pedagogical-scope contract for content generators
 *
 * THE PROBLEM THIS SOLVES
 * -----------------------
 * The manifest is objective-centric: every component knows the learning objective
 * it serves (e.g. "count and sequence numbers up to 10"). `flattenManifestToLayout`
 * forwards that objective into each component's `config` (objectiveText / objectiveVerb).
 * But historically each generator declared a narrow, bespoke `config` type, never read
 * the objective, and treated the lesson `topic` as flavor text. The only signal they
 * honored was grade — which arrives lesson-wide ("elementary") and resolves to each
 * primitive's WIDEST band. So a "Counting to 10" lesson produced sequences past 12 and
 * double ten-frames (capacity 20): the design space reached the door and was thrown away.
 *
 * THE CONTRACT
 * ------------
 * `PedagogicalScope` is the typed envelope every generator receives. `buildScopePromptSection`
 * renders it into one authoritative block that BINDS the model's output and reframes any
 * grade guidance as a CEILING rather than a target. This is generator-agnostic: it injects
 * NO hardcoded number ranges and does NOT regex-parse the topic. The objective/topic text
 * binds the model; primitive-specific guidance stays in the primitive.
 *
 * Used by all primitive generators. Pairs with evalMode.ts (which constrains *which*
 * challenge types may appear); this constrains *what scope* those challenges target.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * The pedagogical envelope a generator needs to scope its output correctly.
 * Everything except `topic` is optional — older callers and ad-hoc generations
 * may not carry full objective context, and the prompt section degrades gracefully.
 */
export interface PedagogicalScope {
  /** Lesson topic (e.g. "Counting to 10"). Always present. */
  topic: string;
  /** Full learning objective this component serves (e.g. "count and sequence numbers up to 10"). */
  objectiveText?: string;
  /** Bloom's verb for the objective (identify, explain, apply, …). */
  objectiveVerb?: string;
  /** Component-level intent from the manifest (more specific than the objective). */
  intent?: string;
}

/**
 * The subset of manifest config that carries scope context. `flattenManifestToLayout`
 * injects objectiveText/objectiveVerb AND intent into every component's config (intent
 * also rides at top-level item.intent). In the harmonized pathway, scope is built once
 * by `resolveGenerationContext` and handed to generators as `ctx.scope`; this type
 * remains for the resolver's input and any not-yet-migrated generator.
 */
export interface ScopeBearingConfig {
  objectiveText?: string;
  objectiveVerb?: string;
  intent?: string;
  // Generators pass their full config through; allow the rest.
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

/**
 * Gather the pedagogical envelope from the context a generator already has.
 *
 * @param topic          The lesson topic passed to every generator.
 * @param config         The manifest config (carries objectiveText/objectiveVerb/intent).
 * @param fallbackIntent Optional intent to use when config.intent is absent (e.g. item.title).
 */
export const resolvePedagogicalScope = (
  topic: string,
  config?: ScopeBearingConfig,
  fallbackIntent?: string,
): PedagogicalScope => ({
  topic,
  objectiveText: config?.objectiveText,
  objectiveVerb: config?.objectiveVerb,
  intent: config?.intent ?? fallbackIntent,
});

// ---------------------------------------------------------------------------
// Prompt building
// ---------------------------------------------------------------------------

/**
 * Render the authoritative SCOPE block. Drop this into a generator's prompt
 * (typically right after the opening "Create a … for teaching …" line and BEFORE
 * any grade-level guidance, so the rules below can reframe that guidance as a ceiling).
 *
 * Generic by design: no number ranges, no primitive-specific language. The objective
 * and topic text do the binding.
 */
export const buildScopePromptSection = (scope: PedagogicalScope): string => {
  const facts: string[] = [`LESSON TOPIC: "${scope.topic}"`];
  if (scope.objectiveText) facts.push(`LEARNING OBJECTIVE: "${scope.objectiveText}"`);
  if (scope.objectiveVerb) facts.push(`COGNITIVE LEVEL (Bloom): ${scope.objectiveVerb}`);
  if (scope.intent) facts.push(`THIS COMPONENT'S INTENT: "${scope.intent}"`);

  return `
PEDAGOGICAL SCOPE — AUTHORITATIVE. This binds everything you generate:
${facts.map(f => `- ${f}`).join('\n')}

SCOPE RULES:
- The numbers, quantities, difficulty, and representations you produce MUST fit the LESSON TOPIC and LEARNING OBJECTIVE above.
- If the topic or objective names or implies a numeric range (e.g. "to 10", "within 5", "up to 20", "numbers 1-100"), EVERY value you generate must stay inside that range. Never exceed it.
- Any grade-level guidance further down describes the WIDEST band this primitive supports. Treat it as a CEILING, not a target. When the topic/objective is narrower than the grade band, the TOPIC/OBJECTIVE WINS.
- Prefer the simplest representation that satisfies the scope. Do not introduce larger structures, wider ranges, or more advanced operations than the scope requires.
`;
};
