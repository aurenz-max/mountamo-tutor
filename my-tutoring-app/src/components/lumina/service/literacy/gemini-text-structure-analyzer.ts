import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import { TextStructureAnalyzerData, StructureType } from "../../primitives/visual-primitives/literacy/TextStructureAnalyzer";
import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from '../evalMode';
/**
 * ⚠️ THE BUILD GATES ARE IMPORTED, NEVER COPIED (DI port, 2026-08-16).
 *
 * This generator and `textStructureAnalyzerScript.ts` are the two sides of one
 * wire, and both have to agree on what is sayable, which spans exist in the
 * passage, and what the structure labels ARE. letter-spotter's two sides drifted
 * to 90 vs 100 characters on exactly this question and disagreed live about what
 * a sayable sentence was; one address is the fix.
 *
 * `STRUCTURE_LABEL` in particular is now the pack's, not the model's: the child
 * SAYS the label out loud and the judge is handed it as a target, so it cannot
 * be authored per generation.
 */
import {
  isSayableLabel,
  locateSignalWords,
  MIN_STRUCTURE_OPTIONS_EASY,
  opensWithSentinel,
  optionsEarSeparable,
  STRUCTURE_GLOSS,
  STRUCTURE_LABEL,
} from '../../primitives/visual-primitives/literacy/textStructureAnalyzerScript';

// ---------------------------------------------------------------------------
// Challenge type documentation registry
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  'cause-effect': {
    promptDoc:
      `"cause-effect": Identify cause and effect relationships in text. `
      + `The passage should use signal words like "because", "so", "as a result", "therefore". `
      + `Template regions: Cause / Effect. Key ideas map to cause or effect regions.`,
    schemaDescription: "'cause-effect' (identify cause and effect relationships, β 2.5)",
  },
  'compare-contrast': {
    promptDoc:
      `"compare-contrast": Analyze similarities and differences in text. `
      + `The passage should use signal words like "however", "similarly", "in contrast", "on the other hand", "both". `
      // ⚠️ NOT "Item A / Item B" — the child SAYS the region name, and said out
      // loud those two are indistinguishable (the ear-separability gate drops
      // them, which would silently delete the placement step on every
      // compare-contrast passage). Name the things being compared.
      + `Template regions: name the TWO THINGS being compared ("Frogs" / "Toads" / "Both"), or Similarities / Differences. Key ideas map to comparison regions.`,
    schemaDescription: "'compare-contrast' (analyze similarities and differences, β 3.0)",
  },
  'problem-solution': {
    promptDoc:
      `"problem-solution": Identify the problem and proposed solutions in text. `
      + `The passage should use signal words like "the problem is", "one solution", "as a result", "to fix this". `
      + `Template regions: Problem / Solution(s). Key ideas map to problem or solution regions.`,
    schemaDescription: "'problem-solution' (identify problem and proposed solutions, β 3.5)",
  },
  'chronological': {
    promptDoc:
      `"chronological": Sequence events in time order from the text. `
      + `The passage should use signal words like "first", "then", "next", "finally", "after", "before". `
      + `Template regions: ordered steps or time periods. Key ideas map to sequential regions.`,
    schemaDescription: "'chronological' (sequence events in time order, β 2.0)",
  },
  'description': {
    promptDoc:
      `"description": Identify descriptive text structure. `
      + `The passage should use signal words like "for example", "such as", "includes", "characteristics". `
      + `Template regions: Main Topic / Details or Features. Key ideas map to descriptive categories.`,
    schemaDescription: "'description' (identify descriptive text structure, β 2.0)",
  },
};

// ---------------------------------------------------------------------------
// Within-mode support tier (config.difficulty) — scaffolding level, NOT content
// ---------------------------------------------------------------------------

const TIER_GUARDRAIL =
  'TIER GUARDRAIL: config.difficulty drives TWO axes on top of the SAME eval mode '
  + '(the passage is always the pinned structure type). Axis 1 (scaffolding) withdraws '
  + 'on-screen help. Axis 2 (structure) changes the problem SHAPE — at the Identify step, '
  + 'how CONFUSABLE the wrong answer choices are with the correct structure (far, distinct '
  + 'structures at easy → near, easily-mistaken structures at hard). What NEVER changes: the '
  + 'correct structure type (= the eval mode / task identity), the passage being that structure, '
  + 'the correct option always staying in the option set, and every keyIdea.correctRegionId. '
  + 'The lever is distractor SIMILARITY, never magnitude (passage length / idea count stay '
  + 'grade-scoped).';

type SupportTier = 'easy' | 'medium' | 'hard';
const SUPPORT_TIERS: readonly SupportTier[] = ['easy', 'medium', 'hard'];

/** STRICT lookup — the manifest enum-constrains config.difficulty to these.
 *  Unknown/absent → null (no tier applied; full-help defaults stand). */
function normalizeSupportTier(difficulty?: string): SupportTier | null {
  const d = difficulty?.toLowerCase().trim() ?? '';
  return (SUPPORT_TIERS as readonly string[]).includes(d) ? (d as SupportTier) : null;
}

// ---------------------------------------------------------------------------
// Support-tier scaffold — which on-screen helps are withdrawn within the SAME
// structure-analysis task. INVARIANT: a tier never changes the passage, the
// signal-word set, the correct structureType, or any correctRegionId. It only
// withdraws on-screen helps (instruction-as-scaffold #2, perception cue #1,
// worked anchor #4, answer-form distractor count #5) so a strong student works
// the same task more unaided and a struggling one can self-check.
//
// This is a 4-phase solver (find signal words → identify structure → map ideas
// → review). All four levers below ride that pipeline; none touches the answer
// key. maxStructureOptions / anchorIdeaId are answer-ADJACENT (they seed the
// option set / start state) but the generator always retains the correct option
// and only pre-places a verified-correct anchor — the stored answers are byte-
// identical at every tier.
// ---------------------------------------------------------------------------

interface TextStructureSupportScaffold {
  /**
   * ⚠️ #1 perception, REBUILT ANSWER-FREE (DI port, 2026-08-16). This used to be
   * `prehighlightSignalWords`, which seeded phase 1's ANSWERS on screen before
   * the tutor asked for them — fine while a click graded them, an answer leak
   * the moment the child has to produce one. The lever survives on the same axis
   * with the answer taken out of it: easy/medium highlight the FOCUS SENTENCE
   * (which one to read), hard highlights nothing. The component derives that
   * from `supportTier` directly, so nothing is stamped on the payload.
   */
  /** #2 instruction: easy/medium name the strategy (signal-word families, structure name). */
  nameStrategy: boolean;
  /** #5 answer-form: number of structure options shown in Phase 2 (correct always kept). */
  maxStructureOptions?: number;
  /** #4 worked-example: easy pre-places ONE key idea in its correct region (component picks which). */
  showAnchorIdea: boolean;
  promptLines: string[];
}

function resolveSupportStructure(
  pinnedType: string,
  tier: SupportTier,
): TextStructureSupportScaffold {
  const lead =
    'This tier changes ONLY how much on-screen help the student gets while analyzing the '
    + 'passage. It NEVER changes the passage, the signal words, the correct structure, or where '
    + 'the key ideas belong — only the scaffolding around the same analysis is withdrawn.';

  if (tier === 'easy') {
    return {
      // ⚠️ NO LONGER TRUE UNDER THE JUDGED LOOP, and the field is kept only so a
      // cached payload still typechecks: pre-highlighting the signal words
      // printed phase 1's ANSWERS before the tutor asked for them. The perception
      // lever moved to the same axis without the answer in it — easy/medium
      // highlight the focus SENTENCE, hard highlights nothing (the component
      // derives that from `supportTier`).
      nameStrategy: true,
      /**
       * ⭐ THREE, NOT TWO (DI port, item 22 §5).
       *
       * Under a tap, `correct + 1 distractor` was scaffolding: the child picked
       * from a short menu and a wrong pick was corrected instantly. Under the
       * judged loop it is a 1-IN-2 GUESS FLOOR on the single Identify ask of the
       * entire run — the payload carries one passage and one structureType, so
       * there is exactly one such ask — and a coin flip then decides the whole
       * measurement of the skill. The guess floor is precisely what a judged loop
       * exists to delete.
       *
       * It CLAMPS to the band rather than inflating: grade 2 has only two
       * structures in the curriculum (`structuresByGrade`), so it saturates at 2
       * there, which is a real ceiling and not a softening (word-sorter's
       * binary_sort shape). Axis 2 is untouched — the near-distractor ladder
       * still runs 0 → 1 → all.
       */
      maxStructureOptions: MIN_STRUCTURE_OPTIONS_EASY,
      showAnchorIdea: true,
      promptLines: [
        lead,
        'EASY: the instructions name the reading strategy (look for the linking words, then match the structure), the Identify step shows the correct structure plus two clearly-different distractors, and one key idea is shown already placed in its region as a worked example.',
        'Keep the title and description neutral — never state the support level or name the answer (the structure type or where ideas go).',
      ],
    };
  }

  if (tier === 'medium') {
    return {
      nameStrategy: true,
      maxStructureOptions: 3,
      showAnchorIdea: false,
      promptLines: [
        lead,
        'MEDIUM: the student finds the linking words unaided, the instructions still name the reading strategy, the Identify step shows three structure options, and no key idea is shown pre-placed.',
        'Keep the title and description neutral — never state the support level or name the answer.',
      ],
    };
  }

  // hard — all scaffolds withdrawn; the student works and justifies unaided.
  return {
    nameStrategy: false,
    maxStructureOptions: undefined, // full option set
    showAnchorIdea: false,
    promptLines: [
      lead,
      'HARD: nothing on the page is highlighted, the instructions do NOT name the strategy or the structure (the student must justify the structure from the text), the Identify step shows the full option set, and no key idea is shown pre-placed.',
      'Keep the title and description neutral — never state the support level or name the answer.',
    ],
  };
}

// ---------------------------------------------------------------------------
// STRUCTURAL DIFFICULTY (2nd axis) — distractor confusability at the Identify step
// ---------------------------------------------------------------------------
// The eval mode IS the correct structure type (the task identity); the tier may
// NEVER change which structure the passage is. What it CAN change is the SHAPE of
// the Identify decision: how near the wrong structure options are to the correct
// one. Far distractors (sequence vs cause) make the structure obvious; near
// distractors (cause-effect vs problem-solution — both "this leads to that")
// force genuine discrimination from the signal words. This is the recognition-card
// archetype lever (distractor similarity far→near), code-enforced by SELECTING
// distractor structure types by confusability distance and ordering them so the
// component's maxStructureOptions trim keeps the near ones at hard.
//
// MAGNITUDE is NOT touched: passage length, signal-word count, and key-idea count
// stay grade-scoped (the eval mode's band). Only the option SET reshapes.
// ---------------------------------------------------------------------------

const ALL_STRUCTURES: StructureType[] = [
  'cause-effect', 'compare-contrast', 'problem-solution', 'chronological', 'description',
];

/**
 * Confusability distance between two structure types (lower = more confusable).
 * Relational structures (cause-effect, problem-solution, compare-contrast) all
 * share "this connects to that" reasoning and are the near pairs the user flagged.
 * Sequential (chronological) and categorical (description) are the distinct anchors.
 * Distance 1 = near (easily mistaken), 2 = moderate, 3 = far (obviously different).
 */
const STRUCTURE_DISTANCE: Record<StructureType, Partial<Record<StructureType, number>>> = {
  'cause-effect':      { 'problem-solution': 1, 'compare-contrast': 2, 'chronological': 3, 'description': 3 },
  'problem-solution':  { 'cause-effect': 1, 'compare-contrast': 2, 'chronological': 3, 'description': 3 },
  'compare-contrast':  { 'cause-effect': 2, 'problem-solution': 2, 'description': 2, 'chronological': 3 },
  'chronological':     { 'description': 2, 'cause-effect': 3, 'problem-solution': 3, 'compare-contrast': 3 },
  'description':       { 'compare-contrast': 2, 'chronological': 2, 'cause-effect': 3, 'problem-solution': 3 },
};

function distance(a: StructureType, b: StructureType): number {
  if (a === b) return 0;
  return STRUCTURE_DISTANCE[a]?.[b] ?? 2;
}

/**
 * The option labels are CANONICAL and owned by the script module — the child
 * says one out loud and the judge is handed it as a target, so it may not be
 * authored per generation. The gloss stays generated wherever the model wrote
 * one; `STRUCTURE_GLOSS` only fills in for a distractor type the model did not
 * describe (which happens whenever axis 2 reconstructs the option set).
 */
const STRUCTURE_FALLBACK_LABEL = STRUCTURE_LABEL;
const STRUCTURE_FALLBACK_DESC = STRUCTURE_GLOSS;

interface TextStructureProblemShape {
  /** # of NEAR (distance ≤ 2) distractors the trimmed option set must lead with.
   *  easy=0 (far distractors first), hard=as many near as the band allows. */
  nearDistractorTarget: number;
  /** Total distractor count the option set should carry (correct + this = full set). */
  distractorCount: number;
  promptLines: string[];
}

/**
 * Axis-2 intent for one (correct structure, tier). CLAMPED to [floor, cap] using
 * the grade-available structures as the band:
 *  - floor: ≥1 distractor (the Identify step is never a single-choice no-decision).
 *  - cap: distractors are drawn ONLY from `available` minus the correct type, and
 *    nearDistractorTarget can never exceed how many near structures actually exist
 *    in band — a grade with only far siblings (G2: chronological+description)
 *    SATURATES at its real ceiling rather than inflating.
 */
function resolveProblemShape(
  correct: StructureType,
  tier: SupportTier,
  available: StructureType[],
): TextStructureProblemShape {
  const others = available.filter((s) => s !== correct);
  // How many in-band siblings are NEAR (distance ≤ 2 — confusable)?
  const nearAvailable = others.filter((s) => distance(correct, s) <= 2).length;

  // Distractor count: keep a real decision (≥1) up to a 4-option ceiling (correct+3).
  const distractorCount = Math.max(1, Math.min(3, others.length));

  let nearWanted: number;
  if (tier === 'easy') nearWanted = 0;       // far distractors only — structure is obvious
  else if (tier === 'medium') nearWanted = 1; // one confusable sibling slips in
  else nearWanted = distractorCount;          // hard: fill with the most confusable siblings

  // Clamp to the band: can't ask for more near distractors than exist, nor more
  // than the total distractor slots. This is where a far-only grade saturates.
  const nearDistractorTarget = Math.max(0, Math.min(nearWanted, nearAvailable, distractorCount));

  const promptLines: string[] =
    tier === 'easy'
      ? [
          'STRUCTURE DIFFICULTY (easy): make the structure easy to TELL APART. The wrong answer '
          + 'choices should be clearly DIFFERENT kinds of structure from the correct one (e.g. a '
          + 'sequence vs a description), and the signal words should be obvious and frequent.',
        ]
      : tier === 'medium'
        ? [
            'STRUCTURE DIFFICULTY (medium): include at least one wrong answer choice that is '
            + 'somewhat similar to the correct structure, so the student must lean on the signal '
            + 'words rather than a quick guess. Keep the signal words present but less hand-held.',
          ]
        : [
            'STRUCTURE DIFFICULTY (hard): the wrong answer choices should be the structures most '
            + 'easily MISTAKEN for the correct one (e.g. cause-effect vs problem-solution — both '
            + '"this leads to that"; compare-contrast vs cause-effect). The signal words should be '
            + 'subtle and sparse so the student must justify the structure from how the ideas '
            + 'actually relate, not from an obvious cue word.',
          ];

  return { nearDistractorTarget, distractorCount, promptLines };
}

/**
 * Build the distractor structure-type set for the trimmed option list, ordered so
 * that the FIRST (distractorCount) slots carry exactly `nearDistractorTarget` near
 * structures (hard) or push them to the back (easy). The component keeps
 * correct + the first (maxStructureOptions-1) distractors, so leading order = tier.
 * Returns the ordered distractor TYPES; the option set is rebuilt to match.
 */
function buildDistractorOrder(
  correct: StructureType,
  shape: TextStructureProblemShape,
  available: StructureType[],
): StructureType[] {
  const others = available.filter((s) => s !== correct);
  const near = others.filter((s) => distance(correct, s) <= 2)
    .sort((a, b) => distance(correct, a) - distance(correct, b)); // nearest first
  const far = others.filter((s) => distance(correct, s) > 2)
    .sort((a, b) => distance(correct, b) - distance(correct, a)); // farthest first

  // Take exactly nearDistractorTarget near ones to lead, then fill the rest with far,
  // then any leftover near (so the count is preserved even when far runs out).
  const leadNear = near.slice(0, shape.nearDistractorTarget);
  const restNear = near.slice(shape.nearDistractorTarget);
  const ordered = [...leadNear, ...far, ...restNear];

  return ordered.slice(0, shape.distractorCount);
}

const textStructureAnalyzerSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Engaging title for the text structure analysis activity" },
    gradeLevel: { type: Type.STRING, description: "Target grade level ('2' through '6')" },
    passage: { type: Type.STRING, description: "Informational passage (4-10 sentences, appropriate reading level)" },
    structureType: { type: Type.STRING, enum: ["cause-effect", "compare-contrast", "problem-solution", "chronological", "description"], description: "The organizational structure of the passage" },
    // ⚠️ EVERY ARRAY IS BOUNDED (flash-lite truncation template). All four used
    // to be unbounded against a wide schema on `gemini-flash-lite-latest` with
    // no ceiling at all — the exact shape that returns a payload truncated
    // mid-string. The caps are the grade ladder's own ceilings (see gradeNotes),
    // so nothing a grade actually asks for is refused.
    signalWords: {
      type: Type.ARRAY,
      maxItems: '8',
      items: {
        type: Type.OBJECT,
        properties: {
          word: { type: Type.STRING, description: "The signal word/phrase as it appears in the passage" },
          startIndex: { type: Type.NUMBER, description: "Character offset where the signal word starts in the passage" },
          endIndex: { type: Type.NUMBER, description: "Character offset where the signal word ends in the passage" },
        },
        required: ["word", "startIndex", "endIndex"]
      }
    },
    structureOptions: {
      type: Type.ARRAY,
      maxItems: '5',
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, enum: ["cause-effect", "compare-contrast", "problem-solution", "chronological", "description"] },
          label: { type: Type.STRING },
          description: { type: Type.STRING, description: "Brief kid-friendly description of this structure" },
        },
        required: ["type", "label", "description"]
      }
    },
    templateRegions: {
      type: Type.ARRAY,
      maxItems: '4',
      items: {
        type: Type.OBJECT,
        properties: {
          regionId: { type: Type.STRING },
          label: { type: Type.STRING, description: "Label for this region of the template" },
        },
        required: ["regionId", "label"]
      }
    },
    keyIdeas: {
      type: Type.ARRAY,
      maxItems: '8',
      items: {
        type: Type.OBJECT,
        properties: {
          ideaId: { type: Type.STRING },
          text: { type: Type.STRING, description: "Short excerpt or paraphrase from the passage" },
          correctRegionId: { type: Type.STRING, description: "The template region this idea belongs in" },
        },
        required: ["ideaId", "text", "correctRegionId"]
      }
    },
    authorPurposeExplanation: { type: Type.STRING, description: "Brief explanation of why the author chose this structure" },
  },
  required: ["title", "gradeLevel", "passage", "structureType", "signalWords", "structureOptions", "templateRegions", "keyIdeas"]
};

/**
 * SP-8: recompute startIndex/endIndex from the passage text — LLMs cannot count
 * characters, so the model is told not to try.
 *
 * ⚠️ THE IMPLEMENTATION MOVED TO `textStructureAnalyzerScript.locateSignalWords`
 * AND GAINED A WORD BOUNDARY (DI port, 2026-08-16). The version that lived here
 * used a bare `indexOf` on the lowercased passage, so the signal word "so"
 * matched inside "also" and "before" inside "beforehand" — the highlight landed
 * on the wrong span. That was cosmetic while a highlight was decoration; it is
 * load-bearing now, because the SENTENCE a match falls in decides which item the
 * child is asked to read. It also de-duplicates: a word listed twice can only
 * ever produce one askable item.
 */
function recomputeSignalWordOffsets(
  passage: string,
  signalWords: { word: string; startIndex: number; endIndex: number }[],
): { word: string; startIndex: number; endIndex: number }[] {
  const located = locateSignalWords(passage, signalWords);
  const kept = new Set(located.map((sw) => sw.word.toLowerCase()));
  for (const sw of signalWords) {
    if (!kept.has(sw.word.toLowerCase())) {
      console.warn(`[TextStructureAnalyzer] Signal word "${sw.word}" not found in passage — dropping`);
    }
  }
  return located.map((sw) => ({
    word: sw.word,
    startIndex: sw.startIndex,
    endIndex: sw.endIndex,
  }));
}

/**
 * Generator-side build gates — the same calls the script module runs on its
 * side of the wire, so a question that would be dropped on screen is re-drawn
 * or reported here instead of silently vanishing. KEEP-OR-DROP, never backfill:
 * a placeholder in a judged loop becomes a spoken ask the tutor must stand
 * behind.
 */
function applyJudgedBuildGates(result: TextStructureAnalyzerData): void {
  // 1. Mats must be sayable, distinct, and separable BY EAR. "Item A" / "Item B"
  //    carry a unique token each and are indistinguishable the moment a child
  //    says one out loud, which is why the ear gate has a minimum word length.
  const regions = (result.templateRegions ?? []).filter(
    (r) => !!r?.regionId && isSayableLabel(r.label ?? ''),
  );
  const labels = regions.map((r) => r.label);
  const distinct = new Set(labels.map((l) => l.toLowerCase())).size === regions.length;
  if (regions.length < 2 || !distinct || !optionsEarSeparable(labels)) {
    console.warn(
      `[text-structure-analyzer] template regions [${labels.join(', ')}] are not an askable spoken set `
      + '— the idea-placement step will build no items.',
    );
  }
  result.templateRegions = regions;

  // 2. An excerpt may not NAME its own mat ("The problem was the flooding" under
  //    a mat labelled "Problem" is answerable by hearing one word), may not open
  //    with a verdict sentinel, and must belong to a surviving region.
  const labelTokens = new Set(
    labels.flatMap((l) => l.toLowerCase().replace(/[^a-z0-9\s]+/g, ' ').split(/\s+/).filter(Boolean)),
  );
  const regionIds = new Set(regions.map((r) => r.regionId));
  const before = (result.keyIdeas ?? []).length;
  result.keyIdeas = (result.keyIdeas ?? []).filter((idea) => {
    if (!idea?.ideaId || !idea.text || !regionIds.has(idea.correctRegionId)) return false;
    if (opensWithSentinel(idea.text)) return false;
    const words = idea.text.toLowerCase().replace(/[^a-z0-9\s]+/g, ' ').split(/\s+/).filter(Boolean);
    return !words.some((w) => labelTokens.has(w));
  });
  if (result.keyIdeas.length !== before) {
    console.log(
      `[text-structure-analyzer] dropped ${before - result.keyIdeas.length} key idea(s) that named `
      + 'their own region, opened with a verdict sentinel, or had no region.',
    );
  }

  // 3. The anchor must still exist after the drop — it is shown pre-placed as a
  //    worked example and excluded from the asked items.
  if (result.anchorIdeaId && !result.keyIdeas.some((i) => i.ideaId === result.anchorIdeaId)) {
    result.anchorIdeaId = result.keyIdeas.length > 1 ? result.keyIdeas[0].ideaId : undefined;
  }
}

type TextStructureAnalyzerConfig = Partial<TextStructureAnalyzerData> & {
  targetEvalMode?: string;
  /** Per-component support tier from the manifest ('easy'|'medium'|'hard'). Second axis:
   *  difficulty = how much scaffolding within the mode. NEVER changes numbers/content. */
  difficulty?: string;
};

export const generateTextStructureAnalyzer = async (
  ctx: GenerationContext,
): Promise<TextStructureAnalyzerData> => {
  const { topic } = ctx;
  const intent = ctx.intent;
  const config = ctx.raw as TextStructureAnalyzerConfig;

  // Grade ladder (2-6). ctx.grade is the ONLY reliable numeric grade (the canonical
  // objective grade parsed by normalizeObjectiveGrade). ctx.gradeLevel is a BAND key
  // ('elementary' collapses 1-5) and ctx.gradeContext is prose — neither is parseable
  // back to a numeric rung, so reading them here pins the output at a constant fallback.
  const LADDER = ['2', '3', '4', '5', '6'] as const;
  let gradeLevelKey: string;
  if (ctx.grade && (LADDER as readonly string[]).includes(ctx.grade)) {
    gradeLevelKey = ctx.grade;
  } else if (ctx.grade && parseInt(ctx.grade, 10) > 6) {
    gradeLevelKey = '6'; // above-ceiling numeric grade clamps to top rung
  } else {
    // Below-floor (K/1) or band-only: kindergarten/preschool clamp to the floor rung,
    // everything else falls to the mid rung.
    gradeLevelKey = ctx.gradeLevel === 'kindergarten' || ctx.gradeLevel === 'preschool' ? '2' : '4';
  }

  // -------------------------------------------------------------------------
  // Eval mode resolution
  // -------------------------------------------------------------------------
  const evalConstraint = resolveEvalModeConstraint(
    'text-structure-analyzer',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('TextStructureAnalyzer', config?.targetEvalMode, evalConstraint);

  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(textStructureAnalyzerSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS, {
        fieldName: 'structureType',
        rootLevel: true,
      })
    : textStructureAnalyzerSchema;

  const gradeNotes: Record<string, string> = {
    '2': 'Grade 2: Focus on CHRONOLOGICAL or DESCRIPTION only. Use "first, then, finally" or descriptive signal words. 4-5 simple sentences. 3-4 signal words. 3-4 key ideas. 2 template regions.',
    '3': 'Grade 3: Add CAUSE-EFFECT. Signal words: because, so, as a result. 5-6 sentences. 4-5 signal words. 4-5 key ideas. 2-3 template regions.',
    '4': 'Grade 4: Add COMPARE-CONTRAST and PROBLEM-SOLUTION. Signal words: however, similarly, in contrast, one solution. 6-7 sentences. 5-6 signal words. 5-6 key ideas. 2-3 template regions.',
    '5': 'Grade 5: All 5 structures. Mixed structures allowed. Include author\'s purpose explanation. 7-8 sentences. 5-7 signal words. 5-7 key ideas. 3-4 template regions.',
    '6': 'Grade 6: Complex multi-paragraph. Evaluate whether structure serves author\'s purpose. 8-10 sentences. 6-8 signal words. 6-8 key ideas. 3-4 template regions.',
  };

  // Determine which structures are available at this grade
  const structuresByGrade: Record<string, StructureType[]> = {
    '2': ['chronological', 'description'],
    '3': ['chronological', 'description', 'cause-effect'],
    '4': ['chronological', 'description', 'cause-effect', 'compare-contrast', 'problem-solution'],
    '5': ['chronological', 'description', 'cause-effect', 'compare-contrast', 'problem-solution'],
    '6': ['chronological', 'description', 'cause-effect', 'compare-contrast', 'problem-solution'],
  };

  const availableStructures = structuresByGrade[gradeLevelKey] || structuresByGrade['4'];

  // -------------------------------------------------------------------------
  // Build prompt with eval-mode-scoped challenge type docs
  // -------------------------------------------------------------------------
  const challengeTypeSection = buildChallengeTypePromptSection(
    evalConstraint,
    CHALLENGE_TYPE_DOCS,
  );

  const structureTypeOverride = evalConstraint
    ? `\nSTRUCTURE TYPE CONSTRAINT: You MUST use one of these structure types: ${evalConstraint.allowedTypes.join(', ')}. Do NOT use any other structure type.`
    : '';

  // ── Within-mode support tier (config.difficulty): scaffolding level, NOT content.
  //    pinnedType drives prompt TONE only (single pinned mode if the manifest
  //    constrained to one); the actual scaffold is structure-agnostic and applied
  //    deterministically to the data after generation. ──
  const supportTier = normalizeSupportTier(config?.difficulty);
  const pinnedType: string | undefined =
    evalConstraint && evalConstraint.allowedTypes.length === 1
      ? evalConstraint.allowedTypes[0]
      : undefined;
  // For the prompt section we may not have a single pinned mode (auto/blended);
  // the scaffold copy is identical across structures, so use the pinned mode if
  // present else any available structure purely to source the (mode-agnostic) lines.
  const tierScaffold = supportTier
    ? resolveSupportStructure(pinnedType ?? availableStructures[0], supportTier)
    : null;
  // Axis 2 (structure shape) shares the SAME tier key. For the prompt we source
  // the (correct) structure from the pinned mode if present, else the first
  // available — the post-process re-derives from the actual structureType.
  const tierShape = supportTier
    ? resolveProblemShape(
        (pinnedType as StructureType) ?? availableStructures[0],
        supportTier,
        availableStructures,
      )
    : null;
  const tierSection = tierScaffold
    ? `\n## WITHIN-MODE DIFFICULTY (config.difficulty — two axes on the SAME eval mode)\n`
      + `${TIER_GUARDRAIL}\n`
      + `${[...tierScaffold.promptLines, ...(tierShape?.promptLines ?? [])].map((l) => `- ${l}`).join('\n')}\n`
    : '';

  const prompt = `Create a text structure analysis activity about: "${topic}".
${intent ? `\nSPECIFIC FOCUS: The broad lesson is "${topic}", but THIS activity must specifically target: "${intent}". Shape the content (passages, target words, sentences, evidence, questions) to serve that focus. Never name or reveal the answer in this focus text.\n` : ''}
GRADE: ${gradeLevelKey}.
${gradeNotes[gradeLevelKey] || gradeNotes['4']}

AVAILABLE STRUCTURES for this grade: ${availableStructures.join(', ')}

${challengeTypeSection}
${structureTypeOverride}
${tierSection}
## THIS IS A SPOKEN, LIVE-JUDGED ACTIVITY — WHAT THAT CHANGES
The student never taps anything. A tutor points them at ONE sentence and they SAY the linking
word; then they SAY how the passage is organised; then, for each key idea read aloud to them,
they SAY which part of the chart it belongs in. Every string below is therefore either printed
for them to read or said out loud by a tutor, and four rules follow from that:

A. ⭐ **ONE LINKING WORD PER SENTENCE.** A sentence containing two connecting words ("Then it
   makes a chrysalis, and after two weeks a butterfly comes out") has TWO right answers to
   "which word links the ideas?", so the activity DROPS it and the student loses that round.
   Put at most ONE connecting word in any single sentence, and spread the signal words across
   different sentences.
B. **Region labels must be sayable and tellable-apart BY EAR.** One or two plain words a child
   can say back ("Cause", "Effect", "Problem", "Solution", "Before", "After", "Main Topic",
   "Details"). NEVER label regions with letters or numbers ("Item A" / "Item B", "Group 1") —
   said out loud those are indistinguishable. For compare-contrast, NAME THE TWO THINGS being
   compared ("Frogs", "Toads", "Both").
C. ⭐ **A key idea may NEVER contain the name of the region it belongs to.** "The problem was the
   flooding" filed under "Problem" is answerable by hearing one word rather than by thinking.
   Rewrite the excerpt so it states the content without naming its own region.
D. **Never begin any excerpt, label, title or description with "Yes" or with "My turn"** — those
   two openers are reserved verdict signals in the spoken session.

Rules:
1. Write an informational passage using ONE primary structure from the available list
2. Embed signal words naturally — include the word field with the exact text as it appears in the passage. Do NOT worry about startIndex/endIndex accuracy — they will be recomputed automatically. Every signal word must appear in a DIFFERENT sentence (rule A).
3. structureOptions: always provide 3-4 options including the correct one plus plausible distractors from the available structures list. Write the kid-friendly description for each; the LABEL is set by the application, so do not worry about its exact wording.
4. templateRegions: create regions matching the chosen structure (e.g. Cause/Effect for cause-effect, Before/After for chronological), under rule B
5. keyIdeas: short excerpts from the passage (14 words or fewer) that the tutor reads aloud, under rule C
6. CRITICAL — Signal words must ONLY be words that belong to the chosen structure type. Do NOT include signal words from other structure types:
   - cause-effect ONLY: "because", "so", "as a result", "therefore", "since", "due to", "consequently", "leads to"
   - compare-contrast ONLY: "however", "similarly", "in contrast", "on the other hand", "both", "alike", "different", "whereas", "unlike"
   - problem-solution ONLY: "the problem is", "one solution", "to fix this", "as a result", "solved by", "the challenge"
   - chronological ONLY: "first", "then", "next", "finally", "after", "before", "later", "meanwhile", "during"
   - description ONLY: "for example", "such as", "includes", "characteristics", "features", "specifically"
7. Include authorPurposeExplanation for grades 5-6`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: activeSchema,
        /**
         * 8192 IS THE RIGHT NUMBER *HERE* — checked against the model actually
         * configured rather than pasted. The truncation template's ceiling is
         * calibrated on `gemini-flash-lite-latest`, where the whole budget is
         * payload; word-builder needed 25000 only because it moved to a THINKING
         * model that spends the same ceiling on reasoning first. This call is
         * flash-lite, and every array above is now bounded, so the ceiling is a
         * runaway backstop rather than a limit the content can reach.
         */
        maxOutputTokens: 8192,
        systemInstruction: 'You are an expert K-6 reading comprehension instructor specializing in informational text structure analysis. You create grade-appropriate passages with clear organizational patterns and embedded signal words. This activity is SPOKEN and live-judged: the student reads the passage and says every answer out loud, so each sentence carries at most one connecting word, region labels are plain words a child can say and tell apart by ear, and a key idea never contains the name of the region it belongs to.',
      }
    });
    const text = response.text;
    if (!text) throw new Error("No data returned from Gemini API");
    const result = JSON.parse(text) as TextStructureAnalyzerData;

    // SP-8: Recompute signal word offsets — LLMs cannot count characters reliably
    if (result.passage && result.signalWords) {
      result.signalWords = recomputeSignalWordOffsets(result.passage, result.signalWords);
    }

    // The judged-loop build gates, run on THIS side of the wire too (the script
    // module runs the same calls on the other). Applied before the anchor is
    // chosen, so a worked example is never picked from an idea that then drops.
    applyJudgedBuildGates(result);

    // ── Within-mode support tier: withdraw on-screen scaffolding (never the content).
    //    Applied AFTER the signal-word offset recompute so the tier can only remove
    //    help. Gated ONLY on supportTier being present (a blended/auto session is a
    //    student property too) — pinnedType drove prompt tone only. The scaffold is
    //    structure-agnostic, so resolve once from the resolved structureType. ──
    if (supportTier) {
      const sc = resolveSupportStructure(result.structureType ?? (pinnedType ?? 'description'), supportTier);
      result.nameStrategy = sc.nameStrategy;
      result.maxStructureOptions = sc.maxStructureOptions;
      result.supportTier = supportTier;
      /**
       * Worked anchor (easy): show exactly ONE key idea already placed in its
       * correct region. Decoupled into `anchorIdeaId` so the answer key
       * (correctRegionId) is untouched — this only seeds what is printed.
       *
       * ⚠️ IT IS DRAWN FROM THE MOST-REPRESENTED REGION, not simply the first
       * idea (DI port, 2026-08-16). The anchor is EXCLUDED from the asked items —
       * an exemplar is not a question — so taking it off a region that has only
       * one idea strands that region, and a placement step whose remaining ideas
       * all land on one mat is answerable by saying that mat's name every round.
       * The script module's coverage gate then drops the whole step, which is
       * correct and also means `easy` silently loses its third phase. Picking
       * from the biggest region keeps both mats reachable.
       */
      if (sc.showAnchorIdea && result.keyIdeas && result.keyIdeas.length > 2) {
        const perRegion = new Map<string, number>();
        for (const idea of result.keyIdeas) {
          perRegion.set(idea.correctRegionId, (perRegion.get(idea.correctRegionId) ?? 0) + 1);
        }
        const fullest = Array.from(perRegion.entries()).sort((a, b) => b[1] - a[1])[0];
        result.anchorIdeaId = fullest && fullest[1] > 1
          ? result.keyIdeas.find((i) => i.correctRegionId === fullest[0])?.ideaId
          : undefined;
      } else {
        result.anchorIdeaId = undefined;
      }

      // ── AXIS 2 (structure shape): enforce distractor confusability. ──────────
      // count → honor-if-valid → reconstruct. The component keeps correct + the
      // first (maxStructureOptions-1) distractors in ORDER, so we re-order/rebuild
      // structureOptions so the leading distractors match the tier's near-count.
      // ANSWER-BEARING SAFETY: structureType (the answer) is NEVER changed; the
      // correct option is always present and unchanged; keyIdeas/correctRegionId
      // are untouched. We only reshape the distractor SET.
      const correctType = result.structureType as StructureType;
      if (correctType && ALL_STRUCTURES.includes(correctType)) {
        const shape = resolveProblemShape(correctType, supportTier, availableStructures);
        const desiredDistractors = buildDistractorOrder(correctType, shape, availableStructures);

        // Preserve the LLM's authored option metadata where it exists; synthesize
        // for any distractor type we add that the LLM didn't write.
        const byType = new Map<StructureType, { type: StructureType; label: string; description: string }>();
        for (const opt of result.structureOptions ?? []) {
          if (opt && ALL_STRUCTURES.includes(opt.type as StructureType)) {
            byType.set(opt.type as StructureType, opt as { type: StructureType; label: string; description: string });
          }
        }
        const synth = (t: StructureType) =>
          byType.get(t) ?? { type: t, label: STRUCTURE_FALLBACK_LABEL[t], description: STRUCTURE_FALLBACK_DESC[t] };

        const correctOpt = synth(correctType);
        const orderedDistractors = desiredDistractors.map(synth);

        // COUNT what the LLM produced (leading distractors among its first slots):
        // honor only if the leading distractors already match the desired order.
        const llmDistractors = (result.structureOptions ?? [])
          .filter((o) => (o?.type as StructureType) !== correctType)
          .map((o) => o.type as StructureType)
          .slice(0, shape.distractorCount);
        const matchesTarget =
          llmDistractors.length === orderedDistractors.length &&
          llmDistractors.every((t, i) => t === desiredDistractors[i]);

        if (!matchesTarget) {
          // RECONSTRUCT: correct first, then distractors in tier order.
          result.structureOptions = [correctOpt, ...orderedDistractors];
        }
        // (If it matched we leave the LLM's richer copy intact.)
        // Floor: correct option present (guaranteed above) + ≥1 distractor.
        if (!result.structureOptions.some((o) => (o.type as StructureType) === correctType)) {
          result.structureOptions = [correctOpt, ...orderedDistractors];
        }
        console.log(
          `[text-structure-analyzer] Axis-2 distractors for "${correctType}" @${supportTier}: `
          + `near-target=${shape.nearDistractorTarget}/${shape.distractorCount} → [${desiredDistractors.join(', ')}]`
          + `${matchesTarget ? ' (LLM honored)' : ' (reconstructed)'}.`,
        );
      }

      console.log(`[text-structure-analyzer] Support tier "${supportTier}" applied (${pinnedType ? 'single-mode ' + pinnedType : 'blended'}; structure=${result.structureType}).`);
    }

    /**
     * ⭐ CANONICALISE THE OPTION LABELS — always, tier or no tier.
     *
     * The child SAYS one of these out loud and the judge is handed it as the
     * target string, so it cannot be authored per generation: one
     * "Cause/Effect Relationship" and the ask is unsayable, one "Sequence of
     * Events" beside "Order of Events" and no utterance has an honest home. The
     * five labels are owned by `textStructureAnalyzerScript` and derived from
     * the `type` enum, which makes ear-separability true by construction over a
     * set of five we control.
     *
     * The model's GLOSS is kept wherever it wrote one — it is printed beside the
     * label, is never the answer, and is the half worth generating.
     */
    result.structureOptions = (result.structureOptions ?? [])
      .filter((opt) => !!opt && ALL_STRUCTURES.includes(opt.type as StructureType))
      .map((opt) => ({
        type: opt.type,
        label: STRUCTURE_LABEL[opt.type as StructureType],
        description: opt.description?.trim() || STRUCTURE_GLOSS[opt.type as StructureType],
      }));

    // Exclude targetEvalMode + difficulty from the raw config spread (difficulty is
    // consumed above into structured scaffold fields; don't leak the raw string).
    const { targetEvalMode: _targetEvalMode, difficulty: _difficulty, ...restConfig } = config || {};
    return { ...result, ...restConfig };
  } catch (error) {
    console.error("Error generating text structure analyzer:", error);
    throw error;
  }
};
