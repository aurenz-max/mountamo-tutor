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

// ---------------------------------------------------------------------------
// Grade → audience band (shared by the core text generators)
// ---------------------------------------------------------------------------

/**
 * Map the canonical curriculum grade (`ctx.grade`: 'K'|'1'..'12') to the audience
 * BAND KEY a generator's `getGradeLevelContext` map is keyed by
 * ('Kindergarten'|'Elementary'|'Middle School'|'High School'). Returns '' when the
 * grade is absent or unrecognized, so the caller falls back to its prose-derived
 * band (`inferGradeLevelFromContext(ctx.gradeContext)`).
 *
 * This is the ONE home for the numeric-grade→band mapping that the core text
 * generators (fact-file, fast-fact, how-it-works, timeline-explorer,
 * vocabulary-explorer) previously copy-pasted. `ctx.grade` is authoritative when
 * present; the prose band is the fallback only.
 */
export const gradeToBand = (grade?: string): string => {
  if (!grade) return '';
  if (grade === 'K') return 'Kindergarten';
  const n = parseInt(grade, 10);
  if (isNaN(n)) return '';
  return n <= 5 ? 'Elementary' : n <= 8 ? 'Middle School' : 'High School';
};

/**
 * Build the EXACT-grade prompt line that makes grade-2 ≠ grade-4 WITHIN a band
 * (the band alone collapses grades 1–5, so a numeric grade is otherwise
 * unrecoverable). Returns '' when there is no numeric grade, so the band default
 * stands untouched — that is the no-regression control the grade probes rely on.
 *
 * @param grade     Canonical grade ('K'|'1'..'12'), or undefined for free-form lessons.
 * @param tuneItems What to tune to the grade (default reading level / sentence length / vocabulary).
 * @param extra     Optional generator-specific instruction appended verbatim (e.g. "Set gradeBand …").
 */
export const buildGradeLine = (
  grade?: string,
  tuneItems = 'reading level, sentence length, and vocabulary',
  extra = '',
): string =>
  grade
    ? `EXACT TARGET GRADE: ${grade}. Tune ${tuneItems} precisely to grade ${grade} `
      + `(within the audience band above).${extra ? ' ' + extra : ''}`
    : '';

/**
 * Clamp the canonical curriculum grade (`ctx.grade`) to a K–2 primitive's rung
 * ('K'|'1'|'2'). The K-2 phonics primitives ladder WITHIN K/1/2 (e.g. cvc → blend
 * → r-controlled); a grade above 2 clamps to '2' (the primitive tops out by
 * design — grade-above is WRONG-PRIMITIVE, not a taller rung). Returns `fallback`
 * when there is no canonical grade, so the caller's band default stands.
 *
 * Reads `ctx.grade`, NOT `ctx.gradeContext`: the prose band ("kindergarten
 * students …") never matched ['K','1','2'], so a `ctx.gradeContext` read pinned
 * every objective to the floor and silently served grades 1-2 kindergarten content.
 */
export const clampGradeToK2 = (
  grade?: string,
  fallback: 'K' | '1' | '2' = 'K',
): 'K' | '1' | '2' => {
  const g = (grade ?? '').toString().toUpperCase();
  if (g === 'K' || g === '1' || g === '2') return g as 'K' | '1' | '2';
  const n = parseInt(g, 10);
  if (!isNaN(n)) return n <= 0 ? 'K' : n >= 2 ? '2' : '1';
  return fallback;
};
