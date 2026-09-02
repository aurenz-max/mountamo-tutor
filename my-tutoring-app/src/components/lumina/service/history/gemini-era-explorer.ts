/**
 * Era Explorer Generator — one historical era explored through 3 lenses
 * (daily life, technology, school & work), then a bank of historian's-move
 * challenges over that era card.
 *
 * Fork B, single-call era-coherent variant: ONE Gemini call emits the era card
 * AND the bounded challenges array. N parallel calls would each invent a
 * different era and break coherence, so everything ships in one response.
 *
 * ## Eval-mode ladder (L1)
 *
 * Four task identities, each a different historian's move over the SAME era
 * card, each removing an anchor the rung below could lean on:
 *
 *   lens_id          which lens did this detail come from   (locate in source)
 *   era_sort         only then / only now / both            (continuity vs change)
 *   era_compare      this era / the era before / both       (contrast, no present-day anchor)
 *   cause_of_change  why life changed                       (causation, not description)
 *
 * The type field lives PER CHALLENGE (`challenges[].type`), not at the session
 * root. A root-level enum would let Gemini pick one tier for the whole session
 * and silently make the unconstrained "mixed" path a lie (EVAL_TRACKER SP-21);
 * per-challenge, mixed genuinely mixes and pinned modes still constrain hard.
 *
 * ## Answer ownership
 *
 * Gemini emits the answer as TEXT in the mode's own vocabulary; CODE builds the
 * three on-screen options and derives `correctIndex`. Gemini never numbers an
 * option, and the fixed-bin modes (lens_id / era_sort / era_compare) get their
 * bins from session data, so a bin can't drift or leak.
 *
 * ## Answer-leak audit (per mode)
 *
 * The judgment IS the task, so post-validation REJECTS any statement that
 * answers itself: era names / dates / time words for the time-placement modes,
 * lens titles for lens_id, causal connectives and answer-word echoes for
 * cause_of_change, and verbatim source sentences for everything (a copied
 * sentence degrades the task into a string match). One retry on a failed
 * generation, then a curated Pioneer Times fallback — never per-field silent
 * defaults for anything the component renders.
 */

import { Type, type Schema } from '@google/genai';
import { ai } from '../geminiClient';
import {
  resolveEvalModes,
  constrainChallengeTypeEnum,
  buildModeConstraintSection,
  type ChallengeTypeDoc,
} from '../evalMode';
import type {
  EraChallengeType,
  EraExplorerChallenge,
  EraExplorerData,
  EraLens,
  EraPriorEra,
} from '../../primitives/visual-primitives/history/EraExplorer';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MODEL = 'gemini-flash-lite-latest';
const LENS_COUNT = 3;
const MIN_CHALLENGES = 4;
const MAX_CHALLENGES = 6;
const OPTION_COUNT = 3;

const CHALLENGE_TYPES: readonly EraChallengeType[] = [
  'lens_id', 'era_sort', 'era_compare', 'cause_of_change',
];

/** Answer vocabulary for the two time-placement modes (code owns the bins). */
const SORT_SLOTS = ['era', 'today', 'both'] as const;
const COMPARE_SLOTS = ['earlier', 'era', 'both'] as const;

/**
 * Words that place a statement in time and therefore answer the sort for the
 * student. Any hit rejects the statement (years like "1850" included; the
 * unanchored \d{4} also catches "1800s"). Applies to era_sort / era_compare.
 */
const TIME_LEAK =
  /\b(today|now|nowadays|long ago|back then|these days|modern)\b|\d{4}/i;

/**
 * A cause_of_change statement must state the CHANGE only. A causal connective
 * means the reason is already in the stem, so the three options are decoration.
 */
const CAUSAL_CONNECTIVE =
  /\b(because|since|due to|thanks to|owing to|as a result|which led to|so that)\b/i;

/** Generic era-name words that are safe inside statements ("times", "age"…). */
const GENERIC_ERA_WORDS = new Set([
  'times', 'time', 'days', 'day', 'era', 'age', 'ages', 'the', 'old', 'early', 'life', 'years',
]);

// ---------------------------------------------------------------------------
// Grade normalization
// ---------------------------------------------------------------------------

/**
 * Mirror of the canonical `normalizeObjectiveGrade` parser at the registry
 * boundary (K/TK/kindergarten → 'K', "Grade 4"/"4th" → '4'). Kept local:
 * importing it would pull the generation-context module's name into this file,
 * and scripts/audit-intent-consumption.mjs classifies any gemini-* file that
 * mentions that type as context-native — a contract this generator's
 * (topic, gradeLevel, config) signature does not enter. The registry adapter
 * threads the resolved intent into `config.intent` instead (formula-lab
 * precedent). Band words like "elementary" pass through unchanged.
 */
const normalizeGradeKey = (raw: string): string => {
  const g = (raw ?? '').trim();
  if (!g) return 'Elementary';
  if (/^(k|tk|kinder(garten)?)$/i.test(g)) return 'K';
  const m = g.match(/^(?:grade\s*)?(\d{1,2})(?:st|nd|rd|th)?(?:\s*grade)?$/i);
  if (m) {
    const n = parseInt(m[1], 10);
    if (n === 0) return 'K';
    if (n >= 1 && n <= 12) return String(n);
  }
  return g;
};

const gradeGuidance = (gradeKey: string): string => {
  if (['K', '1', '2'].includes(gradeKey)) {
    return 'ages 5-8: very short simple sentences, everyday concrete details a young child can picture '
      + '(food, homes, chores, toys, school). Lens bodies 2-3 short sentences. Statements under 12 words.';
  }
  if (['3', '4'].includes(gradeKey)) {
    return 'ages 8-10: clear sentences with some era-specific vocabulary explained in context. '
      + 'Lens bodies 3-4 sentences. Statements may need one small inference from the lens content.';
  }
  if (['5', '6'].includes(gradeKey)) {
    return 'ages 10-12: richer vocabulary and cause-and-effect detail. Lens bodies 3-4 substantial '
      + 'sentences. Statements should demand genuine inference, including subtle "both" cases.';
  }
  return 'elementary students: age-appropriate vocabulary, concrete everyday details, short clear sentences.';
};

/**
 * Which historian's moves suit the band, for the MIXED path only. A pinned or
 * blended session already had its types chosen by the resolver, and a curator
 * who pins `cause_of_change` at grade 1 is making a deliberate call — this
 * steer must never override one.
 */
const mixedTypeSteer = (gradeKey: string): string => {
  if (['K', '1', '2'].includes(gradeKey)) {
    return 'At this grade lean on "lens_id" and "era_sort"; include at most one "era_compare" and no "cause_of_change".';
  }
  if (['3', '4'].includes(gradeKey)) {
    return 'At this grade lean on "era_sort" and "era_compare", with one "cause_of_change" and at most one "lens_id".';
  }
  if (['5', '6'].includes(gradeKey)) {
    return 'At this grade lean on "era_compare" and "cause_of_change", with one or two "era_sort"; skip "lens_id".';
  }
  return 'Spread the challenges across the types rather than repeating one.';
};

// ---------------------------------------------------------------------------
// Challenge type docs (prompt + schema copy, one entry per type)
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  lens_id: {
    promptDoc:
      `"lens_id" — LOCATE THE DETAIL. "statement" is one life detail from the era, PARAPHRASED in your own `
      + `words from exactly ONE lens body (never a copied sentence). "answer" is the EXACT title of that lens. `
      + `The statement must NEVER contain any lens title, and the detail must be findable in only ONE lens. `
      + `Across the session, use a different lens for each lens_id challenge. Leave "distractors" out.`,
    schemaDescription: "'lens_id' (which lens does this detail come from)",
  },
  era_sort: {
    promptDoc:
      `"era_sort" — PLACE IT IN TIME. "statement" is a life detail in plain present tense, e.g. `
      + `"Families get water from a well and carry it home." "answer" is exactly one of: "era" (true only `
      + `back then), "today" (true only in our time), "both" (genuinely true in both times, e.g. children `
      + `play with friends, families share meals). Mix all three answers across the era_sort challenges. `
      + `The statement must NEVER contain the era name, a date or year, or the words "today", "now", `
      + `"nowadays", "long ago", "back then", or "modern". Leave "distractors" out.`,
    schemaDescription: "'era_sort' (only then / only now / both)",
  },
  era_compare: {
    promptDoc:
      `"era_compare" — CONTRAST TWO PAST ERAS. Uses the "priorEra" card, not our own time. "statement" is `
      + `a life detail in plain present tense. "answer" is exactly one of: "earlier" (true only in the `
      + `earlier era), "era" (true only in the main era), "both" (true across both past eras). Mix all `
      + `three answers. Every detail must be decidable from the lens bodies plus the priorEra body. The `
      + `statement must NEVER contain either era's name, a date or year, or time words. Leave "distractors" out.`,
    schemaDescription: "'era_compare' (this era / the era before / both)",
  },
  cause_of_change: {
    promptDoc:
      `"cause_of_change" — EXPLAIN THE CHANGE. "statement" names ONE way life changed between the era and `
      + `our time, stated as the change ALONE with no reason given, e.g. "Families stopped carrying water `
      + `home from a well." NEVER use "because", "since", "due to", "thanks to", or "as a result". `
      + `"answer" is the real cause in 3-10 words — a technology, an economic shift, or a law/political `
      + `change (e.g. "water pipes were built into ordinary houses"). "distractors" is EXACTLY 2 other `
      + `causes that are real for this period but did NOT cause THIS change. No word from "answer" may `
      + `appear in "statement", and all three causes must be the same kind of thing and a similar length.`,
    schemaDescription: "'cause_of_change' (why life changed)",
  },
};

// ---------------------------------------------------------------------------
// Within-mode support tier (config.difficulty) — scaffolding level ONLY
// ---------------------------------------------------------------------------

type SupportTier = 'easy' | 'medium' | 'hard';
const SUPPORT_TIERS: readonly SupportTier[] = ['easy', 'medium', 'hard'];

/** STRICT lookup — the manifest enum-constrains config.difficulty to these.
 *  Unknown/absent → null (no tier applied; the component's own defaults stand,
 *  which reproduce the pre-tier rendering exactly). */
function normalizeSupportTier(difficulty?: string): SupportTier | null {
  const d = difficulty?.toLowerCase().trim() ?? '';
  return (SUPPORT_TIERS as readonly string[]).includes(d) ? (d as SupportTier) : null;
}

/**
 * The one hard rule, restated for the model — now covering BOTH axes of
 * `config.difficulty`. The tier withdraws HELP (axis 1, `/add-support-tiers`)
 * and reshapes WHAT IS JUDGED (axis 2, `/add-structural-difficulty`): which
 * subject class a statement is built on, how many lenses read as plausible for
 * it, how often the answer is the subtle continuity bin, how near the wrong
 * causes sit to the real one.
 *
 * What it still may NEVER touch is MAGNITUDE: the era, the challenge types, the
 * reading level, the sentence length. Harder here means a subtler JUDGMENT at
 * the same reading level — never longer words or denser prose, which would be
 * the retired numeric-difficulty path wearing a history costume.
 */
const TIER_GUARDRAIL =
  'This tier sets how much on-screen help the student gets AND how subtle the judgments are. It does '
  + 'NOT change the reading level: do NOT change which era you choose, which challenge types you emit, '
  + 'or how long and hard the sentences are — every statement stays at the vocabulary and sentence '
  + 'length set by the TARGET GRADE above. A harder tier is a harder DECISION, not harder READING.';

/**
 * Per-challenge scaffold. Every field is rendered by the component; none is read
 * by an answer checker, so no lever here can invalidate a correct answer
 * (`options` and `correctIndex` are untouched at every tier).
 */
interface SupportScaffold {
  /** Name the historian's move on screen, under the question. */
  showStrategy: boolean;
  /** On-screen hint disclosure: point at the lens / point at the lenses / nothing. */
  hintLevel: 'named_lens' | 'generic' | 'none';
  /** Plain-language captions under the time bins ("Long ago" / "Our time" / …). */
  showBinCaptions: boolean;
}

/** Session-scoped scaffolds — the explore gate happens once, before any challenge. */
interface SessionSupport {
  /** Must every lens be opened before the questions unlock? */
  requireAllLenses: boolean;
  /** Is the source card open beside the question, or one tap away? */
  lensAccess: 'open' | 'collapsible';
}

/**
 * Mode-independent, so it resolves from the tier alone. `hard` hands the student
 * the study-planning decision the workspace makes for them at easy: they choose
 * what to read, and judge with the source folded away — still reachable, because
 * era analysis is open-book by design (the birth gate calls the lens card a
 * legitimate stimulus). Withdrawn from the eye, never from the student.
 */
const resolveSessionSupport = (tier: SupportTier): SessionSupport =>
  tier === 'hard'
    ? { requireAllLenses: false, lensAccess: 'collapsible' }
    : { requireAllLenses: true, lensAccess: 'open' };

/**
 * The per-mode withdrawal ladder. `lens_id` can NEVER take a named-lens hint —
 * naming the lens would BE its answer — so it starts one rung down and still
 * loses its hint entirely at hard.
 */
const resolveSupportStructure = (
  type: EraChallengeType,
  tier: SupportTier,
): { scaffold: SupportScaffold; promptLines: string[] } => {
  const binned = type === 'era_sort' || type === 'era_compare';

  const scaffold: SupportScaffold = {
    showStrategy: tier === 'easy',
    hintLevel:
      tier === 'hard' ? 'none'
        : type === 'lens_id' ? 'generic'
          : tier === 'easy' ? 'named_lens'
            : 'generic',
    // Only the two fixed-bin modes render captions at all.
    showBinCaptions: binned && tier !== 'hard',
  };

  const promptLines: string[] = [TIER_GUARDRAIL];

  switch (tier) {
    case 'easy':
      promptLines.push(
        'SUPPORT TIER easy: the student sees the historian move named on screen, keeps both source cards '
        + 'open beside the question, and can open a hint that NAMES the lens to re-read. Make every '
        + '"lensHint" point at the lens that genuinely settles that question — it is shown to the student.',
      );
      break;
    case 'medium':
      promptLines.push(
        'SUPPORT TIER medium: the source cards stay open, but the on-screen hint no longer names a lens — '
        + 'it only sends the student hunting through them. Keep each "explanation" self-contained enough to '
        + 'teach the point once they have answered.',
      );
      break;
    case 'hard':
      promptLines.push(
        'SUPPORT TIER hard: the student gets NO on-screen hint, no plain-language captions under the '
        + 'choices, and judges with the source cards folded away (they may re-open them). The "explanation" '
        + 'is their only feedback, so make every one teach the full reasoning — what about life in this era '
        + 'made it true, not just which choice was right.',
      );
      break;
  }

  if (type === 'lens_id') {
    promptLines.push(
      'For "lens_id" the hint never names a lens at any tier (that would hand over the answer), so its '
      + 'ladder runs from a generic "look across the tabs" nudge down to no hint at all.',
    );
  }

  return { scaffold, promptLines };
};

// ---------------------------------------------------------------------------
// Within-mode PROBLEM SHAPE (config.difficulty, axis 2) — what is judged
// ---------------------------------------------------------------------------
//
// Axis 1 above withdraws help. This axis makes the JUDGMENT itself subtler, so
// a student who has stopped needing scaffolding can still climb. One in-mode
// lever per historian move, each STRUCTURAL (what kind of thing is being
// decided) and never magnitude (reading level belongs to the grade):
//
//   lens_id          cross-lens reach     one lens plainly owns the wording
//                                         -> two lenses read as plausible and
//                                            only MEANING settles it
//   era_sort         subtle-bin share     one "both then and now" -> half of
//                                         them, and the subject climbs
//                                         artifact -> practice -> institution
//   era_compare      same, over "both eras" across the two PAST periods
//   cause_of_change  distractor distance  wrong causes from a different part of
//                                         life -> from the same part and period
//
// PROSE CANNOT BE RECONSTRUCTED IN CODE. Where a math generator re-selects
// operands to hit an exact carry count, this one cannot rewrite an English
// sentence — so the enforcement mechanism is OVER-GENERATE -> MEASURE -> SELECT:
// under a tier the schema asks for a deeper candidate pool, code measures each
// candidate's shape (lensReachOf / isSubtleBin / causeOverlap) and ships the set
// that hits the target. Deterministic, and it saturates honestly when the pool
// holds nothing on target rather than inventing something.
//
// FLOORS (crossing one changes the eval MODE, which is forbidden):
//   - era_sort / era_compare keep at least one subtle AND one plain answer
//     whenever both exist — the three-way judgment IS the mode's identity.
//   - lens_id stays a paraphrase (VERBATIM_RUN) and never names a lens; exactly
//     one lens must genuinely contain the detail, however plausible the rest read.
//   - cause_of_change keeps exactly ONE right answer — a "distractor" that is a
//     reworded copy of the real cause is excluded at every tier.

/** Which end of the lens-reach range a tier wants. */
type ReachDirection = 'at_most' | 'at_least';

export interface ProblemShape {
  promptLines: string[];
  /** lens_id — how many lens bodies the statement may read as plausible for. */
  lensReach?: { target: number; direction: ReachDirection };
  /** era_sort / era_compare — target share of answers on the subtle "both" bin. */
  subtleShare?: number;
  /** cause_of_change — which end of the answer/distractor distance range ships. */
  distractorDistance?: 'far' | 'mid' | 'near';
}

/**
 * The subtle-bin gradient. Deliberately not 0 at easy: the mode's identity is a
 * THREE-way judgment, so even the easy tier must make the student weigh
 * continuity at least once (`pickWithinType` clamps the derived count into
 * [1, slots-1] whenever both kinds of candidate exist).
 */
export const SUBTLE_SHARE: Record<SupportTier, number> = { easy: 0.15, medium: 0.35, hard: 0.55 };

export const resolveProblemShape = (type: EraChallengeType, tier: SupportTier): ProblemShape => {
  switch (type) {
    case 'lens_id':
      return {
        lensReach:
          tier === 'hard' ? { target: 2, direction: 'at_least' }
            : tier === 'medium' ? { target: 2, direction: 'at_most' }
              : { target: 1, direction: 'at_most' },
        promptLines: [
          tier === 'easy'
            ? 'PROBLEM SHAPE easy for "lens_id": build each detail out of the subject matter only ONE lens '
              + 'talks about — an object, a machine, a school routine that plainly belongs to its lens. A student '
              + 'who skims all three can tell which lens owns it.'
            : tier === 'medium'
              ? 'PROBLEM SHAPE medium for "lens_id": each detail may brush a second lens in passing, but one lens '
                + 'still plainly owns it.'
              : 'PROBLEM SHAPE hard for "lens_id": write details that SOUND plausible for two lenses and are settled '
                + 'only by what the lenses actually SAY — a detail about children working touches both the school lens '
                + 'and the daily-life lens, and only one of them actually mentions it. Exactly ONE lens must genuinely '
                + 'contain the detail: plausible elsewhere, never ambiguous.',
        ],
      };
    case 'era_sort':
      return {
        subtleShare: SUBTLE_SHARE[tier],
        promptLines: [
          tier === 'easy'
            ? 'PROBLEM SHAPE easy for "era_sort": build the statements around concrete OBJECTS a child can picture — '
              + 'a candle, a water bucket, a slate board, a wood stove. Most are plainly gone or plainly still here. '
              + 'Include ONE genuine "both".'
            : tier === 'medium'
              ? 'PROBLEM SHAPE medium for "era_sort": build the statements around everyday PRACTICES rather than objects — '
                + 'fetching water, sewing clothes, walking to school, cooking a meal. About a THIRD should be genuine '
                + '"both" cases, where the practice survived in a changed form.'
              : 'PROBLEM SHAPE hard for "era_sort": build the statements around INSTITUTIONS and social continuities — '
                + 'schooling, chores and family duty, shared meals, who does which work, how neighbours help each other. '
                + 'At least HALF should be genuine "both" cases: things that really did continue, so a student who '
                + 'assumes everything old is extinct gets them wrong.',
        ],
      };
    case 'era_compare':
      return {
        subtleShare: SUBTLE_SHARE[tier],
        promptLines: [
          tier === 'easy'
            ? 'PROBLEM SHAPE easy for "era_compare": contrast the two past periods on concrete OBJECTS and ways of '
              + 'travelling or building that visibly separate them. Include ONE genuine "both eras".'
            : tier === 'medium'
              ? 'PROBLEM SHAPE medium for "era_compare": contrast the two past periods on everyday PRACTICES — how food '
                + 'was got, how people moved, how work was shared. About a THIRD should be genuine "both eras".'
              : 'PROBLEM SHAPE hard for "era_compare": contrast the two past periods on INSTITUTIONS and social '
                + 'continuities — schooling, family duty, who owned the land, how a village decided things. At least '
                + 'HALF should be genuine "both eras": things that carried across both periods even as the objects changed.',
        ],
      };
    case 'cause_of_change':
      return {
        distractorDistance: tier === 'easy' ? 'far' : tier === 'medium' ? 'mid' : 'near',
        promptLines: [
          tier === 'easy'
            ? 'PROBLEM SHAPE easy for "cause_of_change": among the causes you write, include ones from a DIFFERENT part '
              + 'of life than the real cause — if the real cause is a machine, offer some about school or law.'
            : tier === 'medium'
              ? 'PROBLEM SHAPE medium for "cause_of_change": the wrong causes are real for the period and adjacent to the '
                + 'change, but touch a different part of daily life than the one that actually changed.'
              : 'PROBLEM SHAPE hard for "cause_of_change": write wrong causes from the SAME part of life as the real '
                + 'one — each a genuinely plausible reason life could have changed that way, so the student must know '
                + 'which one actually drove THIS change rather than which one merely sounds like it belongs. Never '
                + 'reword the real cause as a wrong one. The "statement" still names a CHANGE between that era and our '
                + 'time, never a description of how life simply WAS back then — nearer wrong causes must not pull the '
                + 'question back into the era.',
        ],
      };
  }
};

/**
 * The single tier block the model sees: scaffolding withdrawal (axis 1) and
 * problem shape (axis 2) merged, deduped, and unioned over every type this
 * session may emit. One section, so the tier reads as one coherent idea of what
 * "hard" means here rather than two knobs pulling against each other.
 */
const buildTierPromptSection = (
  types: readonly EraChallengeType[],
  tier: SupportTier,
): string => {
  const lines = Array.from(new Set(
    types.flatMap((t) => [
      ...resolveSupportStructure(t, tier).promptLines,
      ...resolveProblemShape(t, tier).promptLines,
    ]),
  ));
  lines.push(
    `Write MORE candidates than will be shown (${TIERED_MIN_CHALLENGES}-${TIERED_MAX_CHALLENGES}); the app `
    + `measures each one against this tier and ships the ${MAX_CHALLENGES} that fit best. Every candidate must `
    + 'obey every rule in full — a candidate written as filler is a candidate the app may pick.',
  );
  return `\n## SUPPORT TIER "${tier}" (on-screen help + problem shape — NOT the reading level)\n`
    + `${lines.map((l) => `- ${l}`).join('\n')}\n`;
};

// ---------------------------------------------------------------------------
// Gemini schema (shallow: object -> two flat-object arrays, both bounded)
// ---------------------------------------------------------------------------

const lensSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: 'Short lens name, 1-3 words (e.g. "Daily Life")' },
    body: {
      type: Type.STRING,
      description: 'Era description for this lens, 2-4 sentences at the target reading level',
    },
    icon: { type: Type.STRING, description: 'Exactly ONE emoji depicting the lens' },
  },
  required: ['title', 'body', 'icon'],
};

const priorEraSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    name: {
      type: Type.STRING,
      description: 'Short kid-readable name for the era that came JUST BEFORE the main era (2-4 words)',
    },
    body: {
      type: Type.STRING,
      description:
        'How everyday life differed in that earlier era, 2-3 sentences at the target reading level. '
        + 'Must give enough detail to decide which of the two past eras a life detail belongs to.',
    },
  },
  required: ['name', 'body'],
};

const challengeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    type: {
      type: Type.STRING,
      enum: [...CHALLENGE_TYPES],
      description: `Challenge type: ${Object.values(CHALLENGE_TYPE_DOCS).map(d => d.schemaDescription).join(', ')}`,
    },
    statement: {
      type: Type.STRING,
      description:
        'The stimulus the student judges. Never answers itself — see the rules for this challenge type.',
    },
    answer: {
      type: Type.STRING,
      description:
        "The correct choice, written in THIS challenge type's vocabulary: a lens title (lens_id); "
        + '"era"/"today"/"both" (era_sort); "earlier"/"era"/"both" (era_compare); the cause text (cause_of_change).',
    },
    distractors: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      maxItems: '2',
      description:
        'cause_of_change ONLY: exactly 2 wrong causes, same kind and length as "answer". Omit for every other type.',
    },
    explanation: {
      type: Type.STRING,
      description: '1-2 sentences shown AFTER answering that teach WHY the answer is right',
    },
    lensHint: {
      type: Type.STRING,
      description: 'EXACT copy of one of the 3 lens titles — the lens to re-read. Never names the correct answer.',
    },
  },
  required: ['type', 'statement', 'answer', 'explanation', 'lensHint'],
};

const eraExplorerSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: 'Student-facing activity title (3-6 words)' },
    description: { type: Type.STRING, description: 'One sentence describing what students will explore and decide' },
    eraName: {
      type: Type.STRING,
      description: 'Short kid-readable era name (2-4 words, e.g. "Pioneer Times", "Ancient Egypt") — also an answer-choice label',
    },
    eraPeriod: {
      type: Type.STRING,
      description: 'Kid-readable period tag, e.g. "about 150 years ago"',
    },
    priorEra: priorEraSchema,
    lenses: {
      type: Type.ARRAY,
      items: lensSchema,
      minItems: '3',
      maxItems: '3',
      description: 'EXACTLY 3 lenses on life in the main era',
    },
    challenges: {
      type: Type.ARRAY,
      items: challengeSchema,
      minItems: '4',
      maxItems: '6',
      description: '4-6 challenges over the era card',
    },
  },
  required: ['title', 'description', 'eraName', 'eraPeriod', 'priorEra', 'lenses', 'challenges'],
};

/**
 * Candidate-pool sizes used ONLY when a tier is present. The structural axis
 * ships by SELECTION — measure each candidate's shape, keep the set that hits
 * the tier's target — so it needs more candidates than it shows. Without a tier
 * the schema and therefore the whole generation are byte-identical to the
 * pre-skill ask (4-6 challenges, 2 distractors).
 */
const TIERED_MIN_CHALLENGES = 6;
const TIERED_MAX_CHALLENGES = 9;
const TIERED_DISTRACTOR_POOL = 4;

/**
 * Deep-clone the schema and deepen the two candidate pools the selector draws
 * from. Deep-clone (not mutate) for the same reason `constrainChallengeTypeEnum`
 * does: `eraExplorerSchema` is module-level and shared across every call.
 */
export const widenSchemaForTier = (base: Schema): Schema => {
  const schema: Schema = JSON.parse(JSON.stringify(base));
  const props = (schema as Record<string, unknown>).properties as Record<string, unknown> | undefined;
  const challenges = props?.challenges as Record<string, unknown> | undefined;
  if (!challenges) return schema;

  challenges.minItems = String(TIERED_MIN_CHALLENGES);
  challenges.maxItems = String(TIERED_MAX_CHALLENGES);
  challenges.description =
    `${TIERED_MIN_CHALLENGES}-${TIERED_MAX_CHALLENGES} CANDIDATE challenges over the era card — `
    + `the app measures each one and ships the ${MAX_CHALLENGES} that best fit the tier`;

  const items = challenges.items as Record<string, unknown> | undefined;
  const itemProps = items?.properties as Record<string, unknown> | undefined;
  const distractors = itemProps?.distractors as Record<string, unknown> | undefined;
  if (distractors) {
    distractors.maxItems = String(TIERED_DISTRACTOR_POOL);
    distractors.description =
      `cause_of_change ONLY: EXACTLY ${TIERED_DISTRACTOR_POOL} wrong causes, same kind and length as `
      + `"answer" — the app picks the two it shows. Omit for every other type.`;
  }
  return schema;
};

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const nonempty = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

const isChallengeType = (value: unknown): value is EraChallengeType =>
  typeof value === 'string' && (CHALLENGE_TYPES as readonly string[]).includes(value);

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const containsPhrase = (haystack: string, phrase: string): boolean =>
  new RegExp(`\\b${escapeRegExp(phrase)}\\b`, 'i').test(haystack);

/**
 * Verbatim tripwire: a statement sharing this many CONSECUTIVE words with a
 * source body is a copied sentence, not a paraphrase — the judgment degrades
 * into a string-match lookup. Anchor phrases ("single-room schoolhouse",
 * "wagons pulled by oxen") stay well under this bar, so paraphrases survive.
 */
const VERBATIM_RUN = 7;

/** Shorter run for cause echoes: the cause is only a few words to begin with. */
const CAUSE_ECHO_RUN = 4;

const toWords = (s: string): string[] =>
  s.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(Boolean);

const sharesRun = (statement: string, sources: string[], run: number): boolean => {
  const words = toWords(statement);
  if (words.length < run) return false;
  for (const source of sources) {
    const haystack = ` ${toWords(source).join(' ')} `;
    for (let i = 0; i + run <= words.length; i++) {
      if (haystack.includes(` ${words.slice(i, i + run).join(' ')} `)) return true;
    }
  }
  return false;
};

/** Distinctive words of an era name — "Pioneer" counts, "Times" doesn't. */
const eraKeywords = (eraName: string): string[] =>
  eraName
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length >= 4 && !GENERIC_ERA_WORDS.has(word));

const namesEra = (statement: string, eraNames: string[]): boolean =>
  eraNames
    .flatMap(eraKeywords)
    .some((word) => new RegExp(`\\b${escapeRegExp(word)}`, 'i').test(statement));

// ---------------------------------------------------------------------------
// Shape measurement (structural axis) — how subtle is THIS candidate?
// ---------------------------------------------------------------------------

/**
 * Function words carry no subject matter, so they would make every lens look
 * equally close to every statement. Stripped before any lexical measurement.
 */
const SHAPE_STOPWORDS = new Set([
  'the', 'and', 'or', 'but', 'for', 'with', 'from', 'into', 'over', 'onto', 'about',
  'are', 'was', 'were', 'been', 'being', 'its', 'they', 'them', 'their', 'his', 'her',
  'this', 'that', 'these', 'those', 'there', 'then', 'than', 'not', 'out', 'off',
  'have', 'has', 'had', 'does', 'did', 'get', 'gets', 'got', 'make', 'makes', 'made',
  'use', 'uses', 'used', 'one', 'two', 'many', 'most', 'some', 'all', 'each', 'every',
  'other', 'more', 'much', 'very', 'can', 'will', 'must', 'also', 'just', 'still',
  'when', 'where', 'which', 'what', 'who', 'how', 'because', 'while', 'after', 'before',
]);

/**
 * A statement's distinctive vocabulary: deduped, stopword-free, crudely
 * singularised so "wagons"/"wagon" and "cabins"/"cabin" measure as the same
 * subject. Crude on purpose — the metrics below compare lenses against EACH
 * OTHER, so a shared stemming error cancels out.
 */
const shapeWords = (text: string): string[] =>
  Array.from(new Set(
    toWords(text)
      .map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w))
      .filter((w) => w.length >= 3 && !SHAPE_STOPWORDS.has(w)),
  ));

const sharedWordCount = (a: string[], b: string[]): number => {
  const set = new Set(b);
  return a.filter((w) => set.has(w)).length;
};

/**
 * A lens is only ANCHORED to a statement once it shares this many subject words
 * with it. One word in common is noise — "small", "together", "family" turn up
 * in every lens of every era — and treating that as a hit made a single stray
 * adjective flip a statement's measured shape.
 */
const LENS_ANCHOR_WORDS = 2;

/** A lens still COMPETES with the best one while it holds this share of its
 *  overlap. Relative, so the band widens with the evidence instead of staying a
 *  fixed ±1 that is loose at 2 words and tight at 8. */
const LENS_COMPETITIVE_SHARE = 0.6;

/**
 * CROSS-LENS REACH — the lens_id lever. How many lens bodies are COMPETITIVE
 * for this statement: those anchored to it AND holding most of the best lens's
 * overlap.
 *
 *   1  one lens plainly owns the wording — skimming for matching words settles it
 *   2+ several lenses read as plausible — only MEANING settles it
 *
 * Scale-free by construction: it asks which lens WINS and by how much
 * PROPORTIONALLY, not how many words are shared, so a 9-word statement and a
 * 20-word one are measured the same way. A statement no lens is anchored to
 * scores maximum reach, which is right — word-matching cannot help at all there,
 * so every lens reads as equally plausible.
 */
export const lensReachOf = (statement: string, lensBodies: string[]): number => {
  if (!lensBodies.length) return 1;
  const words = shapeWords(statement);
  const overlaps = lensBodies.map((body) => sharedWordCount(words, shapeWords(body)));
  const best = Math.max(...overlaps);
  if (best < LENS_ANCHOR_WORDS) return lensBodies.length;
  const floor = Math.max(LENS_ANCHOR_WORDS, Math.ceil(best * LENS_COMPETITIVE_SHARE));
  return overlaps.filter((o) => o >= floor).length;
};

/**
 * SUBTLE BIN — the era_sort / era_compare lever. The continuity choice ("both
 * then and now" / "both eras") is the one presentism defeats, so how many of a
 * session's answers land there IS the structural difficulty. Derived from the
 * slot vocabulary rather than hardcoded, so reordering a bin can't silently
 * invert the metric.
 */
const SORT_SUBTLE_INDEX = SORT_SLOTS.indexOf('both');
const COMPARE_SUBTLE_INDEX = COMPARE_SLOTS.indexOf('both');

export const isSubtleBin = (type: EraChallengeType, correctIndex: number): boolean =>
  (type === 'era_sort' && correctIndex === SORT_SUBTLE_INDEX)
  || (type === 'era_compare' && correctIndex === COMPARE_SUBTLE_INDEX);

/**
 * DISTRACTOR DISTANCE — the cause_of_change lever. Share of the SHORTER cause's
 * distinctive words the two causes hold in common: 0 means a wrong cause from a
 * different part of life (far, easy to rule out), high means the same domain and
 * period (near, genuinely plausible).
 */
export const causeOverlap = (answer: string, distractor: string): number => {
  const a = shapeWords(answer);
  const d = shapeWords(distractor);
  if (!a.length || !d.length) return 0;
  return sharedWordCount(a, d) / Math.min(a.length, d.length);
};

/**
 * At or above this a "distractor" is a reworded copy of the real cause — a
 * SECOND correct choice, not a wrong one. Excluded at every tier, and the reason
 * the near end of the ladder can be pushed hard without making items unfair.
 */
const NEAR_DUPLICATE_OVERLAP = 0.8;

/**
 * Pick the two wrong causes the student will see out of the deeper pool the
 * tiered schema asks for. Sorting is stable and the pool arrives in the model's
 * own order, so ties resolve deterministically — no Math.random anywhere.
 * A pool that only holds two saturates honestly: both ship, whatever the tier.
 */
export const selectDistractorsByDistance = (
  answer: string,
  pool: string[],
  distance: 'far' | 'mid' | 'near',
): string[] => {
  const scored = pool
    .map((text) => ({ text, overlap: causeOverlap(answer, text) }))
    .filter((c) => c.overlap < NEAR_DUPLICATE_OVERLAP);
  const need = OPTION_COUNT - 1;
  if (scored.length <= need) return scored.map((c) => c.text);

  const byOverlap = [...scored].sort((x, y) => x.overlap - y.overlap);
  if (distance === 'far') return byOverlap.slice(0, need).map((c) => c.text);
  if (distance === 'near') return byOverlap.slice(-need).map((c) => c.text);
  const median = byOverlap[Math.floor(byOverlap.length / 2)].overlap;
  return [...scored]
    .sort((x, y) => Math.abs(x.overlap - median) - Math.abs(y.overlap - median))
    .slice(0, need)
    .map((c) => c.text);
};

// ---------------------------------------------------------------------------
// Per-mode answer resolution: Gemini's answer TEXT → code-owned options + index
// ---------------------------------------------------------------------------

interface ResolvedAnswer {
  options: string[];
  correctIndex: number;
}

interface EraContext {
  lensTitles: string[];
  lensBodies: string[];
  eraName: string;
  priorEraName: string;
}

/** Snap a free-text lens reference onto one of the real lens titles. */
const snapLensTitle = (raw: string, lensTitles: string[]): string | null => {
  const lower = raw.toLowerCase();
  return (
    lensTitles.find((t) => t === raw)
    ?? lensTitles.find((t) => t.toLowerCase() === lower)
    ?? lensTitles.find((t) => t.toLowerCase().includes(lower) || lower.includes(t.toLowerCase()))
    ?? null
  );
};

const snapSlot = <T extends string>(raw: string, slots: readonly T[]): T | null => {
  const lower = raw.trim().toLowerCase();
  return slots.find((s) => s === lower) ?? null;
};

/**
 * Build the three on-screen options and the correct index for one challenge.
 * Returns null when Gemini's answer doesn't land in the mode's vocabulary —
 * the challenge is dropped rather than silently defaulted to option 0.
 *
 * `index` rotates the correct slot for cause_of_change so the real cause is
 * never pinned to one position (deterministic — never Math.random).
 */
const resolveAnswer = (
  type: EraChallengeType,
  answer: string,
  distractors: string[],
  ctx: EraContext,
  index: number,
): ResolvedAnswer | null => {
  switch (type) {
    case 'lens_id': {
      const title = snapLensTitle(answer, ctx.lensTitles);
      if (!title) return null;
      return { options: [...ctx.lensTitles], correctIndex: ctx.lensTitles.indexOf(title) };
    }
    case 'era_sort': {
      const slot = snapSlot(answer, SORT_SLOTS);
      if (!slot) return null;
      return {
        options: [ctx.eraName, 'Today', 'Both then and now'],
        correctIndex: SORT_SLOTS.indexOf(slot),
      };
    }
    case 'era_compare': {
      const slot = snapSlot(answer, COMPARE_SLOTS);
      if (!slot) return null;
      return {
        options: [ctx.priorEraName, ctx.eraName, 'Both eras'],
        correctIndex: COMPARE_SLOTS.indexOf(slot),
      };
    }
    case 'cause_of_change': {
      const wrong = distractors
        .map(nonempty)
        .filter((d): d is string => Boolean(d) && d!.toLowerCase() !== answer.toLowerCase());
      if (wrong.length < OPTION_COUNT - 1) return null;
      const correctIndex = index % OPTION_COUNT;
      const options = wrong.slice(0, OPTION_COUNT - 1);
      options.splice(correctIndex, 0, answer);
      return { options, correctIndex };
    }
  }
};

/**
 * The reason a statement answers its own question, or null when it doesn't.
 * Each mode leaks a different way, so each gets its own audit rather than one
 * blanket regex.
 */
const statementLeaks = (
  type: EraChallengeType,
  statement: string,
  answer: string,
  ctx: EraContext,
): string | null => {
  // Every mode: a copied source sentence turns the judgment into a string match.
  if (sharesRun(statement, ctx.lensBodies, VERBATIM_RUN)) return 'verbatim lens copy';

  switch (type) {
    case 'lens_id':
      // Naming a lens hands over the only thing being asked.
      if (ctx.lensTitles.some((t) => containsPhrase(statement, t))) return 'names a lens';
      return null;
    case 'era_sort':
      if (TIME_LEAK.test(statement)) return 'time word or year';
      if (namesEra(statement, [ctx.eraName])) return 'names the era';
      return null;
    case 'era_compare':
      if (TIME_LEAK.test(statement)) return 'time word or year';
      if (namesEra(statement, [ctx.eraName, ctx.priorEraName])) return 'names an era';
      return null;
    case 'cause_of_change':
      if (CAUSAL_CONNECTIVE.test(statement)) return 'states its own cause';
      if (sharesRun(statement, [answer], CAUSE_ECHO_RUN)) return 'echoes the cause';
      return null;
  }
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const validateLenses = (raw: unknown): EraLens[] | null => {
  if (!Array.isArray(raw)) {
    console.warn('[EraExplorer] Rejecting generation: lenses is not an array');
    return null;
  }
  const valid: EraLens[] = [];
  for (const entry of raw) {
    const lens = entry as Record<string, unknown>;
    const title = nonempty(lens?.title);
    const body = nonempty(lens?.body);
    const icon = nonempty(lens?.icon);
    if (title && body && icon) valid.push({ title, body, icon });
  }
  if (valid.length < LENS_COUNT) {
    console.warn(`[EraExplorer] Rejecting generation: only ${valid.length}/${LENS_COUNT} valid lenses`);
    return null;
  }
  if (valid.length > LENS_COUNT) {
    console.warn(`[EraExplorer] Trimming ${valid.length} lenses to ${LENS_COUNT}`);
  }
  return valid.slice(0, LENS_COUNT);
};

const validatePriorEra = (raw: unknown): EraPriorEra | null => {
  const entry = raw as Record<string, unknown> | undefined;
  const name = nonempty(entry?.name);
  const body = nonempty(entry?.body);
  return name && body ? { name, body } : null;
};

/**
 * One validated challenge plus the two shape measurements the structural axis
 * selects on. Both are transient — they steer WHICH challenges ship and are
 * dropped before the data reaches the component, which needs neither.
 */
export interface ShapeCandidate {
  challenge: Omit<EraExplorerChallenge, 'id'>;
  /** lens_id lever: how many lens bodies read as plausible for this statement. */
  lensReach: number;
  /** era_sort / era_compare lever: is the answer the continuity bin? */
  subtle: boolean;
}

/**
 * Cap the surviving set while preserving VARIETY, in two passes: first keep one
 * challenge of every type present (so a blend never collapses to one type under
 * the cap), then one of every distinct answer within each type (so era_sort
 * doesn't ship six "era" answers), then fill. This is the NO-TIER path and is
 * unchanged from before the structural axis existed.
 */
export const capWithVariety = (list: ShapeCandidate[], max: number): ShapeCandidate[] => {
  if (list.length <= max) return list;
  const keep = new Set<ShapeCandidate>();

  const takeFirstPerKey = (key: (c: ShapeCandidate) => string) => {
    const seen = new Set<string>();
    for (const c of list) {
      if (keep.size >= max) return;
      const k = key(c);
      if (seen.has(k) || keep.has(c)) continue;
      seen.add(k);
      keep.add(c);
    }
  };

  takeFirstPerKey((c) => c.challenge.type);
  takeFirstPerKey((c) => `${c.challenge.type}:${c.challenge.correctIndex}`);
  for (const c of list) {
    if (keep.size >= max) break;
    keep.add(c);
  }
  return list.filter((c) => keep.has(c));
};

/**
 * Take `n` candidates, spending the first picks on DISTINCT answers so a
 * shape-driven selection can never accidentally ship six items that all sit in
 * the same bin. The variety guarantee `capWithVariety` gives the no-tier path,
 * reused inside every tiered pick.
 */
const takeWithAnswerVariety = (list: ShapeCandidate[], n: number): ShapeCandidate[] => {
  if (n <= 0) return [];
  if (list.length <= n) return [...list];
  const keep: ShapeCandidate[] = [];
  const seen = new Set<number>();
  for (const c of list) {
    if (keep.length >= n) break;
    if (seen.has(c.challenge.correctIndex)) continue;
    seen.add(c.challenge.correctIndex);
    keep.push(c);
  }
  for (const c of list) {
    if (keep.length >= n) break;
    if (!keep.includes(c)) keep.push(c);
  }
  return keep;
};

/**
 * Split the shipped slots across the types present, one each first so a blended
 * session never collapses to a single type under selection, then the remainder
 * to the deepest candidate pools. A type is never given more slots than it has
 * candidates.
 */
const allocateSlots = (
  types: EraChallengeType[],
  counts: Map<EraChallengeType, number>,
  max: number,
): Map<EraChallengeType, number> => {
  const slots = new Map<EraChallengeType, number>(types.map((t) => [t, 1]));
  let remaining = Math.max(0, max - types.length);
  const byDepth = [...types].sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0));

  let i = 0;
  while (remaining > 0 && byDepth.some((t) => (slots.get(t) ?? 0) < (counts.get(t) ?? 0))) {
    const t = byDepth[i % byDepth.length];
    if ((slots.get(t) ?? 0) < (counts.get(t) ?? 0)) {
      slots.set(t, (slots.get(t) ?? 0) + 1);
      remaining--;
    }
    i++;
  }
  return slots;
};

/**
 * Choose one type's shipped set from its candidate pool, by that type's own
 * structural lever. Returns the log note too — the target-vs-result line the
 * verification pass reads to see whether the tier actually landed or saturated.
 */
const pickWithinType = (
  type: EraChallengeType,
  pool: ShapeCandidate[],
  slots: number,
  tier: SupportTier,
): { picked: ShapeCandidate[]; note: string } => {
  const shape = resolveProblemShape(type, tier);

  // lens_id — order by cross-lens reach, then keep answer variety within it.
  if (shape.lensReach) {
    const { target, direction } = shape.lensReach;
    const ordered = [...pool].sort((a, b) => (
      direction === 'at_least' ? b.lensReach - a.lensReach : a.lensReach - b.lensReach
    ));
    const picked = takeWithAnswerVariety(ordered, slots);
    const onTarget = picked.filter((c) => (
      direction === 'at_least' ? c.lensReach >= target : c.lensReach <= target
    )).length;
    return {
      picked,
      note: `reach ${direction.replace('_', ' ')} ${target}: ${onTarget}/${picked.length} on target `
        + `(reaches ${picked.map((c) => c.lensReach).join(',')})`,
    };
  }

  // era_sort / era_compare — hit the subtle-bin count, floored at one of each.
  if (shape.subtleShare !== undefined) {
    const subtle = pool.filter((c) => c.subtle);
    const plain = pool.filter((c) => !c.subtle);
    const raw = Math.round(slots * shape.subtleShare);
    // FLOOR: the three-way judgment is the mode's identity, so ship at least one
    // subtle AND one plain whenever the pool holds both. When it holds only one
    // kind the target saturates there rather than inventing the other.
    const target = subtle.length && plain.length
      ? Math.min(Math.max(raw, 1), slots - 1, subtle.length)
      : Math.min(raw, subtle.length);

    const picked = [...subtle.slice(0, target)];
    picked.push(...takeWithAnswerVariety(plain, slots - picked.length));
    if (picked.length < slots) picked.push(...subtle.slice(target, target + (slots - picked.length)));

    const shipped = picked.filter((c) => c.subtle).length;
    return {
      picked,
      note: `subtle bin ${shipped}/${picked.length} (target ${target}/${slots}, `
        + `pool ${subtle.length} subtle + ${plain.length} plain)`,
    };
  }

  // cause_of_change — its lever already fired per challenge, on the distractors.
  return {
    picked: takeWithAnswerVariety(pool, slots),
    note: 'distractor distance already applied per challenge; picked for answer-position variety',
  };
};

/**
 * The structural axis's selector: measure, allocate, pick per type, then ship in
 * the order the model wrote them so the session still reads coherently.
 */
export const selectForShape = (
  candidates: ShapeCandidate[],
  max: number,
  tier: SupportTier,
): ShapeCandidate[] => {
  const types = Array.from(new Set(candidates.map((c) => c.challenge.type)));
  const counts = new Map<EraChallengeType, number>(
    types.map((t) => [t, candidates.filter((c) => c.challenge.type === t).length]),
  );
  const slots = allocateSlots(types, counts, max);

  const chosen = new Set<ShapeCandidate>();
  for (const type of types) {
    const pool = candidates.filter((c) => c.challenge.type === type);
    const { picked, note } = pickWithinType(type, pool, slots.get(type) ?? 0, tier);
    console.log(
      `[EraExplorer] shape "${tier}" ${type}: shipped ${picked.length} of ${pool.length} candidates — ${note}`,
    );
    for (const c of picked) chosen.add(c);
  }
  return candidates.filter((c) => chosen.has(c));
};

const validateChallenges = (
  raw: unknown,
  ctx: EraContext,
  tier: SupportTier | null,
): EraExplorerChallenge[] | null => {
  if (!Array.isArray(raw)) {
    console.warn('[EraExplorer] Rejecting generation: challenges is not an array');
    return null;
  }

  const seen = new Set<string>();
  const survivors: ShapeCandidate[] = [];
  let rejectedFields = 0;
  let rejectedLeaks = 0;
  let rejectedAnswers = 0;
  let duplicates = 0;
  let snappedHints = 0;
  let narrowedCauses = 0;

  for (const entry of raw) {
    const challenge = entry as Record<string, unknown>;
    const type = challenge?.type;
    const statement = nonempty(challenge?.statement);
    const answer = nonempty(challenge?.answer);
    const explanation = nonempty(challenge?.explanation);
    const rawHint = nonempty(challenge?.lensHint);
    const distractors = Array.isArray(challenge?.distractors)
      ? (challenge.distractors as unknown[]).map((d) => String(d))
      : [];

    if (!isChallengeType(type) || !statement || !answer || !explanation) {
      rejectedFields++;
      continue;
    }

    const leak = statementLeaks(type, statement, answer, ctx);
    if (leak) {
      rejectedLeaks++;
      console.warn(`[EraExplorer] ${type} statement leaks (${leak}), dropped: "${statement}"`);
      continue;
    }

    // STRUCTURAL AXIS, cause_of_change: the tiered schema asked for a deeper
    // pool of wrong causes; pick the two the student sees by distance from the
    // real one. Answer-bearing — `resolveAnswer` still splices the real cause in
    // and derives `correctIndex` from it, so the key follows the new options.
    const shape = tier ? resolveProblemShape(type, tier) : null;
    let causePool = distractors;
    if (shape?.distractorDistance && distractors.length > OPTION_COUNT - 1) {
      causePool = selectDistractorsByDistance(answer, distractors, shape.distractorDistance);
      narrowedCauses++;
    }

    const resolved = resolveAnswer(type, answer, causePool, ctx, survivors.length);
    if (!resolved) {
      rejectedAnswers++;
      console.warn(`[EraExplorer] ${type} answer "${answer}" is not resolvable, dropped: "${statement}"`);
      continue;
    }

    const key = `${type}|${statement.toLowerCase()}`;
    if (seen.has(key)) {
      duplicates++;
      continue;
    }
    seen.add(key);

    // lensHint snap: a hint pointing at the wrong lens is degraded, not broken.
    // lens_id gets NO hint — its hint would BE its answer (the component renders
    // a generic "open every lens" nudge instead).
    let lensHint: string | undefined;
    if (type !== 'lens_id') {
      lensHint = (rawHint ? snapLensTitle(rawHint, ctx.lensTitles) : null) ?? ctx.lensTitles[0];
      if (lensHint !== rawHint) snappedHints++;
    }

    survivors.push({
      challenge: {
        type,
        statement,
        options: resolved.options,
        correctIndex: resolved.correctIndex,
        explanation,
        lensHint,
      },
      // Measured once, here, on the statement as it will actually ship.
      lensReach: lensReachOf(statement, ctx.lensBodies),
      subtle: isSubtleBin(type, resolved.correctIndex),
    });
  }

  if (rejectedFields + rejectedLeaks + rejectedAnswers + duplicates + snappedHints > 0) {
    console.warn(
      `[EraExplorer] Challenge validation: ${survivors.length} kept, `
      + `${rejectedFields} rejected (missing/invalid fields), ${rejectedLeaks} rejected (answer leak), `
      + `${rejectedAnswers} rejected (unresolvable answer), `
      + `${duplicates} duplicates dropped, ${snappedHints} lens hints snapped`,
    );
  }

  if (narrowedCauses > 0 && tier) {
    console.log(
      `[EraExplorer] shape "${tier}" cause_of_change: narrowed the wrong-cause pool to `
      + `${OPTION_COUNT - 1} on ${narrowedCauses} challenge(s), `
      + `${resolveProblemShape('cause_of_change', tier).distractorDistance} end`,
    );
  }

  if (survivors.length < MIN_CHALLENGES) {
    console.warn(
      `[EraExplorer] Rejecting generation: only ${survivors.length}/${MIN_CHALLENGES} challenges survived validation`,
    );
    return null;
  }

  // The tier ships by SELECTION over the deeper pool it asked for; without a
  // tier this is byte-for-byte the pre-skill variety cap.
  const capped = tier
    ? selectForShape(survivors, MAX_CHALLENGES, tier)
    : capWithVariety(survivors, MAX_CHALLENGES);

  // Variety telemetry — degraded, not fatal: a session that collapsed to one
  // answer still teaches, but the log is where an eval-test run sees it.
  for (const type of Array.from(new Set(capped.map((c) => c.challenge.type)))) {
    const ofType = capped.filter((c) => c.challenge.type === type);
    if (ofType.length > 1 && new Set(ofType.map((c) => c.challenge.correctIndex)).size === 1) {
      console.warn(`[EraExplorer] Degraded mix: every '${type}' challenge has the same answer position`);
    }
  }

  // ids AFTER validation/filtering — index-derived, never Date.now().
  return capped.map((c, index) => ({ id: `era-${c.challenge.type}-${index + 1}`, ...c.challenge }));
};

/**
 * Session-level challengeType: the one type when the session is single-mode,
 * 'mixed' otherwise. Representative metadata for evaluation and the tutor —
 * the component ALWAYS renders from the per-challenge `type`.
 */
const sessionChallengeType = (challenges: EraExplorerChallenge[]): EraChallengeType | 'mixed' => {
  const types = Array.from(new Set(challenges.map((c) => c.type)));
  return types.length === 1 ? types[0] : 'mixed';
};

const validateResponse = (
  parsed: unknown,
  gradeKey: string,
  tier: SupportTier | null,
): EraExplorerData | null => {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    console.warn('[EraExplorer] Rejecting generation: response is not an object');
    return null;
  }
  const raw = parsed as Record<string, unknown>;

  const title = nonempty(raw.title);
  const description = nonempty(raw.description);
  const eraName = nonempty(raw.eraName);
  const eraPeriod = nonempty(raw.eraPeriod);
  if (!title || !description || !eraName || !eraPeriod) {
    console.warn('[EraExplorer] Rejecting generation: missing session-level fields');
    return null;
  }

  const lenses = validateLenses(raw.lenses);
  if (!lenses) return null;

  const priorEra = validatePriorEra(raw.priorEra);
  if (!priorEra) {
    console.warn('[EraExplorer] Rejecting generation: priorEra missing name or body');
    return null;
  }

  const challenges = validateChallenges(raw.challenges, {
    lensTitles: lenses.map((l) => l.title),
    lensBodies: lenses.map((l) => l.body),
    eraName,
    priorEraName: priorEra.name,
  }, tier);
  if (!challenges) return null;

  return {
    title,
    description,
    eraName,
    eraPeriod,
    priorEra,
    lenses,
    challenges,
    challengeType: sessionChallengeType(challenges),
    gradeLevel: gradeKey,
  };
};

// ---------------------------------------------------------------------------
// Curated fallback (last resort — logged loudly when used)
// ---------------------------------------------------------------------------

const FALLBACK_LENS_TITLES = ['Daily Life', 'Technology', 'School & Work'];
const FALLBACK_SORT_BINS = ['Pioneer Times', 'Today', 'Both then and now'];
const FALLBACK_COMPARE_BINS = ['Colonial Farm Days', 'Pioneer Times', 'Both eras'];

/** Hoisted out of the session literal so the shape metrics can measure against
 *  these bodies when a tier selects inside the curated pool. */
const FALLBACK_LENSES: EraLens[] = [
    {
      title: 'Daily Life',
      icon: '🏠',
      body:
        'Pioneer families lived in small log cabins that they often built themselves. Water came from a well '
        + 'or a stream and was carried home in buckets. After dark, the house was lit with candles and oil lamps, '
        + 'and everyone in the family had daily chores.',
    },
    {
      title: 'Technology',
      icon: '⚙️',
      body:
        'There were no cars, phones, or electricity. People traveled on foot, on horseback, or in wagons pulled '
        + 'by horses or oxen. Food was cooked over a fire or on a wood-burning stove and kept cool in a cellar '
        + 'dug into the ground.',
    },
    {
      title: 'School & Work',
      icon: '🏫',
      body:
        'Children of many ages learned together in a one-room schoolhouse with a single teacher. They practiced '
        + 'writing on small slate boards instead of paper. Many children also helped with farm work, so some went '
        + 'to school for only part of the year.',
    },
  ];

/**
 * The curated pool covers every mode, so a pinned session that fell all the way
 * through still gets its own skill rather than a bank of era_sort items with
 * the wrong eval mode stamped on them.
 */
const FALLBACK_POOL: Array<Omit<EraExplorerChallenge, 'id'>> = [
  {
    type: 'lens_id',
    statement: 'Children of many different ages share one teacher and one room.',
    options: FALLBACK_LENS_TITLES,
    correctIndex: 2,
    explanation: 'That detail comes from the lens about school and work, where all ages learned together.',
  },
  {
    type: 'lens_id',
    statement: 'Food is kept cool in a space dug down into the ground.',
    options: FALLBACK_LENS_TITLES,
    correctIndex: 1,
    explanation: 'That detail comes from the lens about tools and machines, which covers how food was cooked and stored.',
  },
  {
    type: 'lens_id',
    statement: 'Every member of the family has jobs to finish before the sun goes down.',
    options: FALLBACK_LENS_TITLES,
    correctIndex: 0,
    explanation: 'Chores at home belong to the lens about everyday life in the cabin.',
  },
  {
    type: 'era_sort',
    statement: 'Families get their water from a well and carry it home in buckets.',
    options: FALLBACK_SORT_BINS,
    correctIndex: 0,
    explanation:
      'Pioneer homes had no indoor pipes, so water had to be fetched by hand. Homes in our time have faucets that bring water inside.',
    lensHint: 'Daily Life',
  },
  {
    type: 'era_sort',
    statement: "A refrigerator keeps the family's food cold using electricity.",
    options: FALLBACK_SORT_BINS,
    correctIndex: 1,
    explanation:
      'Refrigerators need electricity, which pioneer homes did not have — pioneer families kept food cool in cellars instead.',
    lensHint: 'Technology',
  },
  {
    type: 'era_sort',
    statement: 'Children help their families by doing chores at home.',
    options: FALLBACK_SORT_BINS,
    correctIndex: 2,
    explanation:
      'Pioneer children hauled water and fed animals, and children still help at home — the chores have changed, but helping has not.',
    lensHint: 'Daily Life',
  },
  {
    type: 'era_sort',
    statement: 'A family lights its home after dark with small flames.',
    options: FALLBACK_SORT_BINS,
    correctIndex: 0,
    explanation:
      'Candles and oil lamps were the only light once the sun set. Electric bulbs replaced those flames in our homes.',
    lensHint: 'Technology',
  },
  {
    type: 'era_compare',
    statement: 'Families load a covered wagon and travel west to claim new farmland.',
    options: FALLBACK_COMPARE_BINS,
    correctIndex: 1,
    explanation:
      'The push west by wagon belongs to the pioneer period. Farm families of the earlier period stayed near the coast and the towns they had already built.',
    lensHint: 'Technology',
  },
  {
    type: 'era_compare',
    statement: 'A family grows most of its own food and sews its own clothes.',
    options: FALLBACK_COMPARE_BINS,
    correctIndex: 2,
    explanation:
      'Making what you needed at home was true for the earlier farm families and for pioneer families alike — that part of life did not change between the two periods.',
    lensHint: 'Daily Life',
  },
  {
    type: 'era_compare',
    statement: 'Children walk to a school their village has kept running for generations.',
    options: FALLBACK_COMPARE_BINS,
    correctIndex: 0,
    explanation:
      'Settled coastal villages had schools that had stood for a long time. Pioneer families arriving on new land had to build a schoolhouse from nothing first.',
    lensHint: 'School & Work',
  },
  {
    type: 'cause_of_change',
    statement: 'Families stopped carrying water home from a well in buckets.',
    options: [
      'railroads reached more towns',
      'pipes were built into ordinary houses',
      'children stayed in school for more years',
    ],
    correctIndex: 1,
    explanation:
      'Once pipes carried water directly into houses, nobody had to fetch it. The well disappeared from daily life because the water came to the family instead.',
    lensHint: 'Daily Life',
  },
  {
    type: 'cause_of_change',
    statement: 'Children of every age no longer share a single classroom and teacher.',
    options: [
      'towns grew big enough to fund schools with many classrooms',
      'candles were replaced by electric lamps',
      'families began storing food in cellars',
    ],
    correctIndex: 0,
    explanation:
      'One room with one teacher was what a small settlement could afford. As towns grew and paid for bigger schools, children could be taught in separate grades.',
    lensHint: 'School & Work',
  },
];

const buildFallbackEra = (
  gradeKey: string,
  allowedTypes: string[] | undefined,
  tier: SupportTier | null,
): EraExplorerData => {
  const wanted = allowedTypes?.length
    ? FALLBACK_POOL.filter((c) => allowedTypes.includes(c.type))
    : FALLBACK_POOL;
  const source = wanted.length >= MIN_CHALLENGES ? wanted : FALLBACK_POOL;

  // The curated pool is fixed prose, so a tier can only SELECT within it: the
  // subtle-bin and cross-lens levers still bite, the distractor-distance one
  // cannot (these items ship finished `options`). It saturates honestly rather
  // than handing a hard-tier student the easy-tier bank unchanged.
  const bodies = FALLBACK_LENSES.map((l) => l.body);
  const candidates: ShapeCandidate[] = source.map((challenge) => ({
    challenge,
    lensReach: lensReachOf(challenge.statement, bodies),
    subtle: isSubtleBin(challenge.type, challenge.correctIndex),
  }));
  const selected = tier
    ? selectForShape(candidates, MAX_CHALLENGES, tier)
    : candidates.slice(0, MAX_CHALLENGES);
  const challenges = selected.map((c, i) => ({ id: `era-${c.challenge.type}-${i + 1}`, ...c.challenge }));

  return {
    title: 'Life in Pioneer Times',
    description:
      'Explore how pioneer families lived, worked, and learned — then decide what their life was like and why it changed.',
    eraName: 'Pioneer Times',
    eraPeriod: 'about 150 years ago',
    priorEra: {
      name: 'Colonial Farm Days',
      body:
        'Before the pioneer years, most families farmed near the older towns along the coast. They grew their own '
        + 'food and made their own clothes, and they traveled on roads and rivers their villages had used for '
        + 'generations rather than heading west into unfamiliar land.',
    },
    lenses: FALLBACK_LENSES,
    challenges,
    challengeType: sessionChallengeType(challenges),
    gradeLevel: gradeKey,
  };
};

// ---------------------------------------------------------------------------
// Support-tier application (code owns the scaffolding; the LLM only wrote content)
// ---------------------------------------------------------------------------

/**
 * Stamp the SCAFFOLDING half of the tier onto a finished session — the LIVE path
 * and the curated fallback alike, so a student who fell all the way through to
 * Pioneer Times still gets the tier the manifest asked for.
 *
 * The structural half already fired upstream, inside `validateChallenges` /
 * `buildFallbackEra`: by the time a session reaches here its statements have
 * been measured and selected, so this pass only decides how much help is drawn
 * around them. Nothing here is answer-bearing — `options` and `correctIndex` are
 * byte-identical across tiers for a given challenge.
 *
 * Resolved PER CHALLENGE from that challenge's OWN `type`, because difficulty is
 * a property of the STUDENT: a blended session must be tiered too, and its modes
 * withdraw differently (lens_id can never take a named-lens hint). Gating on a
 * single pinned mode instead would silently drop the tier for every mixed
 * session — the exact no-op this wiring exists to close.
 */
const applySupportTier = (data: EraExplorerData, tier: SupportTier): EraExplorerData => {
  const session = resolveSessionSupport(tier);
  const challenges = data.challenges.map((challenge) => ({
    ...challenge,
    ...resolveSupportStructure(challenge.type, tier).scaffold,
  }));

  console.log(
    `[EraExplorer] Support tier "${tier}" applied per-challenge to ${challenges.length} challenge(s) `
    + `[${data.challengeType === 'mixed' ? 'blended' : `single-mode ${data.challengeType}`}]: `
    + `lenses ${session.requireAllLenses ? 'gated' : 'optional'}, source ${session.lensAccess}, `
    + `hints [${challenges.map((c) => c.hintLevel).join(', ')}]`,
  );

  return { ...data, ...session, challenges, supportTier: tier };
};

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

export const generateEraExplorer = async (
  topic: string,
  gradeLevel: string,
  config?: {
    /** Eval mode pinned by the tester/curator. Wins over intent resolution, no LLM call. */
    targetEvalMode?: string;
    /** Component intent — the routing signal when no mode is pinned. */
    intent?: string;
    /** Parent objective text (stamped by flattenManifestToLayout) — secondary routing signal. */
    objectiveText?: string;
    /**
     * Per-component tier from the manifest ('easy' | 'medium' | 'hard'). Second
     * field of the two-field contract: targetEvalMode = WHICH historian move,
     * difficulty = how hard that move is INSIDE the mode, on two axes — how much
     * on-screen scaffolding the student keeps, and how subtle the judgments
     * themselves are. Never changes the era, the challenge types, or the reading
     * level, all of which belong to the topic and the target grade.
     */
    difficulty?: string;
    [key: string]: unknown;
  },
): Promise<EraExplorerData> => {
  const gradeKey = normalizeGradeKey(gradeLevel);
  const intent = nonempty(config?.intent);

  const resolution = await resolveEvalModes(
    'era-explorer',
    {
      targetEvalMode: config?.targetEvalMode,
      intent: config?.intent,
      objectiveText: typeof config?.objectiveText === 'string' ? config.objectiveText : undefined,
    },
    CHALLENGE_TYPE_DOCS,
  );

  /**
   * The STUDENT's tier — applied to single-mode AND blended sessions alike (see
   * `applySupportTier`). Resolved BEFORE the schema, because the structural axis
   * ships by selection and therefore needs a deeper candidate pool asked for in
   * the schema itself.
   */
  const supportTier = normalizeSupportTier(
    typeof config?.difficulty === 'string' ? config.difficulty : undefined,
  );
  const tierTypes = (resolution?.allowedTypes ?? CHALLENGE_TYPES) as readonly EraChallengeType[];

  const baseSchema = supportTier ? widenSchemaForTier(eraExplorerSchema) : eraExplorerSchema;
  const activeSchema = resolution
    ? constrainChallengeTypeEnum(baseSchema, resolution.allowedTypes, CHALLENGE_TYPE_DOCS)
    : baseSchema;

  const challengeTypeSection = buildModeConstraintSection(resolution, CHALLENGE_TYPE_DOCS);

  // ONE key, two places: the tier enum reaches the prompt (which DESCRIBES the
  // harder shape to the model) and the post-process (which ENFORCES it by
  // measuring and selecting). A pre-baked string could only do the first.
  const tierSection = supportTier ? buildTierPromptSection(tierTypes, supportTier) : '';
  const challengeAsk = supportTier
    ? `${TIERED_MIN_CHALLENGES}-${TIERED_MAX_CHALLENGES}`
    : `${MIN_CHALLENGES}-${MAX_CHALLENGES}`;

  console.log(
    `[EraExplorer] modes: ${
      resolution ? `${resolution.modes.map((m) => m.evalMode).join('+')} (${resolution.source})` : 'mixed'
    } → types [${(resolution?.allowedTypes ?? ['all']).join(', ')}], support tier: ${supportTier ?? 'none'}`,
  );

  const needsPriorEra = !resolution || resolution.allowedTypes.includes('era_compare');

  const prompt = `You are a history curriculum expert creating an "Era Explorer" activity about life in one historical era.

TOPIC: ${topic}
${intent ? `ASSIGNED LEARNING INTENT: "${intent}" — honor this specific objective within the topic.\n` : ''}TARGET GRADE: ${gradeKey} — ${gradeGuidance(gradeKey)}

## The Activity
Students explore ONE historical era through 3 lenses, then answer ${challengeAsk} questions about it. Every question shows the student THREE choices; you supply the correct answer as text and the app builds the choices.

## Choose the Era
- If the topic or intent names a specific era, period, civilization, or event, build THAT era.
- Otherwise choose the single era that best serves the topic. Never blend two eras.
- eraName: short and kid-readable, 2-4 words (e.g. "Pioneer Times", "Colonial America", "Ancient Egypt"). It becomes an answer-choice label.
- eraPeriod: a kid-readable period tag (e.g. "about 150 years ago").

## Lenses (EXACTLY 3)
- Default titles: "Daily Life", "Technology", "School & Work" — adapt a title only when the era demands it.
- body: 2-4 sentences at the target reading level. Concrete, sensory, specific to THIS era.
- icon: exactly ONE emoji (for example 🏠 🕯️ ⚙️ 🏫 📚 🚂 🧺 🌾 🏺 🐎).
- The lenses are the study material: every question must be decidable after reading them.

## The Earlier Era (priorEra)
Name the period that came JUST BEFORE the main era and describe how everyday life differed then, in 2-3 sentences.${needsPriorEra ? ' This card is the study material for the "era_compare" questions, so give enough concrete detail to tell the two past periods apart.' : ' This session may not display it, so keep it brief.'}

${challengeTypeSection}
${tierSection}
## Rules for EVERY challenge (${challengeAsk} total)
1. "statement" must NEVER answer its own question — follow the rule for its challenge type above.
2. Write statements as plain present-tense life details, e.g. "Families get water from a well and carry it home."
3. Statements are inferences or paraphrases of the source material — NEVER a verbatim sentence copied from a lens body.
4. "explanation": 1-2 sentences shown AFTER the student answers that TEACH why the answer is right — reference how life worked, don't just restate the answer.
5. "lensHint": copy EXACTLY one of your 3 lens titles — the lens whose content helps decide. It must never name or hint the correct answer. (For "lens_id" questions the app hides this, so any lens title is fine there.)
6. Every statement must be a different life detail — no rewordings of the same fact.
7. "distractors" is used ONLY by "cause_of_change". Omit it for every other type.
${!resolution ? `8. VARY THE CHALLENGE TYPE across the session — do not make every challenge the same type. ${mixedTypeSteer(gradeKey)}\n` : ''}
Now generate the Era Explorer.`;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: activeSchema,
        },
      });

      if (!response.text) throw new Error('No content generated for era-explorer');

      const data = validateResponse(JSON.parse(response.text), gradeKey, supportTier);
      if (data) {
        console.log('[EraExplorer] Generated:', {
          topic,
          gradeLevel: gradeKey,
          eraName: data.eraName,
          eraPeriod: data.eraPeriod,
          priorEra: data.priorEra.name,
          lenses: data.lenses.map((l) => l.title),
          challenges: data.challenges.length,
          types: data.challenges.map((c) => c.type),
          supportTier: supportTier ?? 'none',
          attempt,
        });
        return supportTier ? applySupportTier(data, supportTier) : data;
      }
      console.warn(`[EraExplorer] Attempt ${attempt} failed validation${attempt === 1 ? '; retrying once' : ''}`);
    } catch (error) {
      console.warn(`[EraExplorer] Attempt ${attempt} errored${attempt === 1 ? '; retrying once' : ''}:`, error);
    }
  }

  console.error(
    `[EraExplorer] BOTH generation attempts failed for topic "${topic}" — using the curated "Pioneer Times" fallback era`,
  );
  const fallback = buildFallbackEra(gradeKey, resolution?.allowedTypes, supportTier);
  return supportTier ? applySupportTier(fallback, supportTier) : fallback;
};
