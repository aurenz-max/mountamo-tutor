/**
 * Cause & Effect Chain Generator — one historical setting, several chains of
 * events the student has to put back into causal order.
 *
 * Fork B, single-call topic-coherent variant: ONE Gemini call emits the shared
 * background AND the bounded challenges array. N parallel calls would each
 * reach for the most obvious causal story in the topic and ship three copies of
 * the same chain, so the whole session comes back in one response where the
 * model can see (and differentiate) every chain at once.
 *
 * ## Answer ownership — the model never states the answer
 *
 * Gemini emits each chain's causes IN CAUSAL ORDER and nothing else; CODE
 * assigns the ids, derives `correctOrder` from that order, and then SHUFFLES
 * the bank the student sees. So the answer exists only as an array permutation
 * the model was never asked to encode, and the on-screen order is provably not
 * it (`shuffleAwayFrom` re-draws, then force-swaps, until the bank differs).
 *
 * Icons are code-owned per category, never asked for. Flash-lite drops nested
 * arrays when the same object also asks for an emoji, and this schema already
 * carries the riskier structure — so the emoji ask is simply removed.
 *
 * ## Answer-leak audit (the reason most rejections happen)
 *
 * Ordering IS the task, so any card that carries its own position is fatal.
 * Post-validation REJECTS a challenge whose cards contain ordinal or sequence
 * words ("first", "then", "finally"), causal connectives ("because", "led to",
 * "as a result"), or a year — each of which sorts the chain without a single
 * causal thought. It also rejects near-duplicate cards, a cause that restates
 * the outcome, and a chain shorter than two links. Hints are audited more
 * softly: a hint that names a position is dropped, not fatal.
 *
 * One retry on a failed generation, then a curated fallback — never per-field
 * silent defaults for anything the component renders.
 */

import { Type, type Schema } from '@google/genai';
import { ai } from '../geminiClient';
import {
  resolveEvalModes,
  buildModeConstraintSection,
  type ChallengeTypeDoc,
  type EvalModeResolution,
} from '../evalMode';
import type {
  CauseCategory,
  CauseEffectChainChallenge,
  CauseEffectChainData,
  CauseEffectChallengeType,
  CauseEffectNode,
  CauseEffectSupportTier,
} from '../../primitives/visual-primitives/history/CauseEffectChain';
/**
 * The judged loop's gates, IMPORTED so both sides of the wire run one copy
 * (letter-spotter's two hand-synced copies disagreed live). `cardSpeakable`:
 * every card is READ ALOUD now, so a double quote (closes the cue's own span)
 * or a sentinel opener (read as a verdict) kills the challenge.
 * `chainEarSeparable`: the spoken pick rung needs every card to own a word no
 * other card has, or the verdict is a coin toss — a chain that fails it is
 * never STAMPED with that rung.
 */
import {
  cardSpeakable,
  chainEarSeparable,
} from '../../primitives/visual-primitives/history/causeEffectChainScript';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MODEL = 'gemini-flash-lite-latest';
const MIN_CHALLENGES = 3;
const MAX_CHALLENGES = 5;
/**
 * Bank size bounds. THREE is the floor, not two, and the reason is measurement
 * rather than taste: a two-card bank has exactly two arrangements, so a student
 * who guesses is right half the time and — with two tries allowed — is right
 * eventually every time. The score would stop meaning anything. Three cards give
 * six arrangements; the grade band is honoured by how the sentences READ, not by
 * shrinking the task below the point where it measures.
 */
const MIN_CAUSES = 3;
const MAX_CAUSES = 4;

const CATEGORIES: readonly CauseCategory[] = ['political', 'economic', 'social', 'technological'];

/**
 * The eval-mode ladder, model-facing.
 *
 * Read these as three QUESTIONS over one emission, not three payloads: the
 * chain Gemini writes is identical whichever rung the round serves, and CODE
 * stamps the move afterwards (see `assignModes`). So only ONE rung asks the
 * model for anything extra — `identify_cause` needs cards that are not causes —
 * and the other two are pure re-asks of content already on the page. That is
 * the whole reason the ladder cost no second schema shape, which matters on
 * flash-lite: this schema already carries the flat-field workaround, and a
 * second nested structure is exactly what makes it ship malformed JSON.
 */
const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  identify_cause: {
    promptDoc:
      '"identify_cause": the student sees the ending and a pile of events, and picks out only the ones that '
      + 'helped cause it. This is the ONLY round that needs the two extra cards, and BOTH are required when it '
      + 'is in play. "distractor0Text" must be a CONSEQUENCE of the ending — something that only became '
      + 'possible once the ending had already happened. "distractor1Text" must be BACKGROUND — something true '
      + 'of the setting that did not make the ending happen. Both must read exactly like the cause cards: same '
      + 'length, same voice, same kind of concrete detail. A distractor that is vaguer, shorter or odder than '
      + 'the causes is picked out by its shape, and the round measures nothing.',
    schemaDescription: "'identify_cause' (sort the causes from the non-causes)",
  },
  build_chain: {
    promptDoc:
      '"build_chain": the student puts every cause in the order it happened, so each one made the next '
      + 'possible. Needs nothing beyond the ordered chain itself — the app shuffles the cards.',
    schemaDescription: "'build_chain' (order the causes)",
  },
  root_vs_proximate: {
    promptDoc:
      '"root_vs_proximate": the student picks ONE card — on some rounds the root cause, on others the event '
      + 'right before the ending. Needs nothing extra, but it only works when the chain is a real dependency: '
      + 'the earliest cause must be the one WITHOUT WHICH none of the rest could have happened, not merely the '
      + 'one that reads as oldest. If any two of your causes could swap places and the story still stands, that '
      + 'chain cannot ask this question.',
    schemaDescription: "'root_vs_proximate' (name the root, or the last cause)",
  },
};

/** Rotation base for `assignModes`. Ladder order, easiest first. */
const MODE_ORDER: readonly CauseEffectChallengeType[] = [
  'identify_cause',
  'build_chain',
  'root_vs_proximate',
];

/**
 * Icons are derived, not generated — same kind of cause, same glyph, across
 * every chain and every primitive in the suite.
 */
const CATEGORY_ICON: Record<CauseCategory, string> = {
  political: '🏛️',
  economic: '💰',
  social: '👥',
  technological: '⚙️',
};

/**
 * Sequence words. A card that says "then" or "finally" announces its own slot,
 * so the student can order the chain without reasoning about causation at all.
 */
const ORDINAL_LEAK =
  /\b(first|firstly|second(ly)?|third(ly)?|then|next|later|afterwards?|finally|lastly|eventually|earlier|beforehand|subsequently|meanwhile|at last|in the end|to begin with|to start with|once this happened|after (that|this)|before (that|this))\b/i;

/**
 * Causal connectives. These state the link the student is supposed to infer —
 * a card containing one has already drawn its own arrow.
 */
const CAUSAL_CONNECTIVE =
  /\b(because|since|due to|thanks to|owing to|as a result|resulting in|resulted in|led to|leading to|caused|causing|brought about|so that|which meant|therefore|thus|hence|consequently|made it possible)\b/i;

/**
 * Years and era tags. A date on a card turns causal ordering into number
 * sorting. Deliberately narrow (four-digit years, BC/AD) so ordinary quantities
 * like "300 wagons" survive.
 */
const DATE_LEAK = /\b(1[0-9]{3}|20[0-9]{2})s?\b|\b(b\.?c\.?e?|a\.?d\.?)\b/i;

/** Position words in a HINT. Softer audit: the hint is dropped, not the challenge. */
const HINT_POSITION_LEAK =
  /\b(first|last|second|third|top|bottom|start(s|ing)?|begin(s|ning)?|end(s|ing)?|order|step \d|number \d|card \d)\b/i;

// ---------------------------------------------------------------------------
// Grade normalization
// ---------------------------------------------------------------------------

/**
 * Mirror of the canonical `normalizeObjectiveGrade` parser at the registry
 * boundary (K/TK/kindergarten → 'K', "Grade 4"/"4th" → '4'). Kept local for the
 * same reason era-explorer keeps its copy: importing the canonical one would
 * pull the generation-context module's name into this file, and
 * scripts/audit-intent-consumption.mjs classifies any gemini-* file that
 * mentions that type as context-native — a contract this generator's
 * (topic, gradeLevel, config) signature does not enter. Band words like
 * "elementary" pass through unchanged.
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

/**
 * Chain length by band. This is GRADE FIDELITY, not difficulty: an older student
 * holds a fourth link in mind, a younger one holds three. It never drops below
 * `MIN_CAUSES` — see that constant for why the floor is a measurement property,
 * not a preference. Grade-appropriateness below the floor is carried by the
 * READING LEVEL of the cards (see `gradeGuidance`), which is where it belongs.
 * The structural difficulty axis (`/add-structural-difficulty`) moves other
 * things — how near the links are to each other — inside the length the grade sets.
 */
export const chainLengthFor = (gradeKey: string): number => {
  if (['5', '6', '7', '8'].includes(gradeKey)) return 4;
  return MIN_CAUSES;
};

const gradeGuidance = (gradeKey: string): string => {
  if (['K', '1', '2'].includes(gradeKey)) {
    return 'ages 5-8: very short simple sentences about concrete things a young child can picture '
      + '(food, homes, animals, tools, travel, school). Every card under 12 words. No abstractions '
      + 'like "policy", "economy", or "movement".';
  }
  if (['3', '4'].includes(gradeKey)) {
    return 'ages 8-10: clear sentences with some history vocabulary explained in context. '
      + 'Cards under 16 words. Concrete actors — families, workers, leaders, inventors.';
  }
  if (['5', '6'].includes(gradeKey)) {
    return 'ages 10-12: real historical specificity, named groups and institutions, cards under 20 words. '
      + 'Causes may be indirect, but each link must still be something a 6th grader can justify.';
  }
  return 'upper elementary: clear, concrete sentences under 18 words, real historical detail.';
};

// ---------------------------------------------------------------------------
// Within-mode support tier (config.difficulty) — axis 1, scaffolding
// ---------------------------------------------------------------------------

type SupportTier = CauseEffectSupportTier;
const SUPPORT_TIERS: readonly SupportTier[] = ['easy', 'medium', 'hard'];

/** STRICT lookup — the manifest enum-constrains config.difficulty to these.
 *  Unknown/absent → null (no tier applied; the component's own defaults stand,
 *  which reproduce the pre-tier rendering exactly). */
function normalizeSupportTier(difficulty?: string): SupportTier | null {
  const d = difficulty?.toLowerCase().trim() ?? '';
  return (SUPPORT_TIERS as readonly string[]).includes(d) ? (d as SupportTier) : null;
}

/**
 * The candidate POOL the model is asked for, at every tier and with none.
 *
 * Under a tier it feeds the structural axis (below): prose cannot be rewritten
 * in code, so that axis works by OVER-GENERATE → MEASURE → SELECT, keeping the
 * `MAX_CHALLENGES` that best fit the tier. Without a tier the first
 * `MAX_CHALLENGES` survivors ship in the model's order.
 *
 * Why the pool is unconditional (2026-09-03, L3/L4 live sweep): with the
 * original 3-5 ask, the untiered path on the tester's own topic ("Why towns grew
 * along the railroad") fell back to the curated chains 2/2 — every chain opens
 * with the railroad being built, the first-cause distinctness guard cuts the
 * repeats, and a 3-5 pool has nothing left. The same topic under a tier (5-8
 * pool) went live 8/9. The pool is the spare capacity the guards need.
 */
export const POOL_MIN_CHALLENGES = 5;
export const POOL_MAX_CHALLENGES = 8;

/**
 * The one hard rule, restated for the model, covering BOTH axes of
 * `config.difficulty`. The tier withdraws HELP (axis 1) and reshapes the
 * INFERENCE (axis 2): how visibly each link is anchored in the next card, how
 * near the non-cause cards sit to the chain. What it may NEVER touch is
 * magnitude — here that is chain LENGTH (grade fidelity, `chainLengthFor`) and
 * reading level. A harder tier is a harder inference at the same reading level.
 */
const TIER_GUARDRAIL =
  'This tier sets how much on-screen help the student gets AND how near the links and the non-cause '
  + 'cards sit. It does NOT change the reading level, the setting, or how many cause cards a chain has: '
  + 'chain length is set by the TARGET GRADE above, and every card stays at that grade\'s vocabulary and '
  + 'sentence length. A harder tier is a harder INFERENCE, not harder reading.';

/**
 * Per-challenge scaffold. Every field is rendered by the component; none is read
 * by the checker (`correctOrder` and the bank are untouched at every tier), so no
 * lever here can invalidate a correct answer.
 */
export interface SupportScaffold {
  /** Name the historian's test on screen, under the question (`MODE_META.strategy`). */
  showStrategy: boolean;
  /** The category chip on each card. The ICON stays at every tier — it is the emerging reader's channel. */
  showCategoryLabels: boolean;
  /** The 1/2/3 badge on each chain slot. `build_chain` only renders slots; harmless elsewhere. */
  showSlotNumbers: boolean;
  /** Whether the hint disclosure is offered at all. */
  showHint: boolean;
}

/**
 * The withdrawal ladder. Identical across modes on purpose: each lever is a
 * reading aid on the CARDS, and the cards are the same object whichever
 * question is being asked of them.
 *
 *   easy    strategy named · labels · slot numbers · hint
 *   medium  labels · slot numbers · hint            (the method is theirs to recall)
 *   hard    icon + text only, no hint               (they read, track and justify unaided)
 */
export const resolveSupportStructure = (
  _type: CauseEffectChallengeType,
  tier: SupportTier,
): { scaffold: SupportScaffold; promptLines: string[] } => {
  const scaffold: SupportScaffold = {
    showStrategy: tier === 'easy',
    showCategoryLabels: tier !== 'hard',
    showSlotNumbers: tier !== 'hard',
    showHint: tier !== 'hard',
  };

  const promptLines: string[] = [TIER_GUARDRAIL];
  switch (tier) {
    case 'easy':
      promptLines.push(
        'SUPPORT TIER easy: the student sees the historian\'s test named on screen under the question, every '
        + 'card carries its category label, and the hint is offered. Write "hint" as a genuinely useful question '
        + '— it is shown.',
      );
      break;
    case 'medium':
      promptLines.push(
        'SUPPORT TIER medium: the on-screen strategy line is gone; the category labels and the hint stay. Keep '
        + 'each "explanation" self-contained enough to teach the point once they have answered.',
      );
      break;
    case 'hard':
      promptLines.push(
        'SUPPORT TIER hard: NO strategy line, NO hint, and the cards show only their icon and text — no '
        + 'category label, no slot numbers. The "explanation" is the student\'s only feedback, so make each one '
        + 'teach the full reasoning: why each event could not have happened until the one before it had.',
      );
      break;
  }
  return { scaffold, promptLines };
};

// ---------------------------------------------------------------------------
// Within-mode PROBLEM SHAPE (config.difficulty, axis 2) — the inference
// ---------------------------------------------------------------------------
//
// Axis 1 withdraws help. This axis makes the INFERENCE itself harder so a
// student who no longer needs scaffolding can keep climbing. One in-mode lever
// per rung, STRUCTURAL and never magnitude — chain length belongs to the grade:
//
//   build_chain        link distance         every link is anchored (the thing
//   root_vs_proximate                        one card builds is named in the
//                                            card that uses it) → at least one
//                                            link the student has to SUPPLY
//   identify_cause     distractor nearness   non-causes about other people and
//                                            things → about the SAME people and
//                                            things as the causes
//
// Enforcement is OVER-GENERATE → MEASURE → SELECT (`selectForShape`): under a
// tier the schema asks for a deeper pool, code measures each candidate
// (`inferredLinks` / `distractorNearness`) and ships the set nearest the
// target. It saturates honestly — a pool with nothing on target ships its best
// and says so in the log — rather than inventing a card.
//
// FLOORS (crossing one changes the eval MODE, which is forbidden):
//   - the chain stays a real dependency at every tier — the prompt owns this;
//     the leak audits (ordinal / connective / date) run unchanged.
//   - `identify_cause` keeps exactly ONE right set: a non-cause that is a
//     reworded cause (overlap ≥ NEAR_DUPLICATE_OVERLAP) never scores as "near".
//   - chain length is `chainLengthFor(grade)` at every tier, never the knob.

type ReachDirection = 'at_most' | 'at_least';

export interface ProblemShape {
  promptLines: string[];
  /** build_chain / root_vs_proximate — which end of the inferred-link range ships. */
  inferredLinks?: { target: number; direction: ReachDirection };
  /** identify_cause — which end of the non-cause distance range ships. */
  distractorNearness?: 'far' | 'near';
}

export const resolveProblemShape = (type: CauseEffectChallengeType, tier: SupportTier): ProblemShape => {
  if (type === 'identify_cause') {
    return {
      distractorNearness: tier === 'easy' ? 'far' : tier === 'hard' ? 'near' : undefined,
      promptLines: [
        tier === 'easy'
          ? 'PROBLEM SHAPE easy for the NON-CAUSE cards: the BACKGROUND card ("distractor1Text") comes from a '
            + 'corner of life none of the causes touch — different people, different things, no key words shared '
            + 'with the cause cards. The CONSEQUENCE card ("distractor0Text") is plainly AFTER the ending: something '
            + 'a reader can see could only happen once the ending had already come.'
          : tier === 'medium'
            ? 'PROBLEM SHAPE medium for the NON-CAUSE cards: the background card may share its people or things '
              + 'with the chain or not; the consequence is a clear after-effect.'
            : 'PROBLEM SHAPE hard for the NON-CAUSE cards: the BACKGROUND card ("distractor1Text") is about the '
              + 'SAME people and things as the causes and shares key words with them, yet is inert — true of the '
              + 'setting, pushing nothing along. The CONSEQUENCE card ("distractor0Text") is written so a hasty '
              + 'reader could take it for a cause, and only "did this come BEFORE the ending?" rules it out. Both '
              + 'stay wrong answers: near, never a second right answer, and never a reworded cause.',
      ],
    };
  }
  return {
    inferredLinks:
      tier === 'easy' ? { target: 0, direction: 'at_most' }
        : tier === 'hard' ? { target: 1, direction: 'at_least' }
          : undefined,
    promptLines: [
      tier === 'easy'
        ? 'PROBLEM SHAPE easy for the chain: make every link VISIBLE on the page — the thing one card builds, '
          + 'finds or starts is named again, with the SAME NOUN and not a synonym, in the card that uses it '
          + '("Engineers build a railroad line" → "Trains carry crops along the railroad line" → "Shops open '
          + 'beside the railroad station"; NOT "iron tracks" in one card and "rails" in the next). The outcome '
          + 'names the thing the last card produced, too. A careful reader can see where each link is; deciding '
          + 'which way it runs is still their job.'
        : tier === 'medium'
          ? 'PROBLEM SHAPE medium for the chain: mix the links — some name the thing the previous card produced, '
            + 'some rely on the student seeing the connection.'
          : 'PROBLEM SHAPE hard for the chain: at least ONE link in every chain must be INDIRECT — the next card '
            + 'does not mention the thing the previous one produced, so the student has to supply the connection '
            + 'themselves ("Families need fewer hands for the harvest" → "Lawmakers require every child to attend '
            + 'school" holds only if you see that the children WERE the hands). Fully defensible, never a leap, and '
            + 'still no sequence words, connectives or dates.',
    ],
  };
};

/**
 * The single tier block the model sees: scaffolding withdrawal (axis 1) and
 * problem shape (axis 2) merged, deduped and unioned over every rung this
 * session may ask. One section, so "hard" reads as one coherent idea rather
 * than two knobs pulling against each other.
 */
const buildTierPromptSection = (
  types: readonly CauseEffectChallengeType[],
  tier: SupportTier,
): string => {
  const lines = Array.from(new Set(
    types.flatMap((t) => [
      ...resolveSupportStructure(t, tier).promptLines,
      ...resolveProblemShape(t, tier).promptLines,
    ]),
  ));
  lines.push(
    `The app measures every chain you write against this tier and ships the ${MAX_CHALLENGES} that fit best. `
    + 'Every chain must obey every rule in full — a chain written as filler is a chain the app may pick.',
  );
  return `\n## SUPPORT TIER "${tier}" (on-screen help + problem shape — NOT the reading level)\n`
    + `${lines.map((l) => `- ${l}`).join('\n')}\n`;
};

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const categoryEnum = {
  type: Type.STRING,
  enum: [...CATEGORIES],
  description: 'Which corner of life this event belongs to',
};

/**
 * The causes are FLAT indexed fields, not a nested array. Flash-lite ships
 * malformed JSON when an object inside an array carries another array; the flat
 * shape is the documented workaround, reconstructed in code below.
 * `cause2*`/`cause3*` are nullable so a short chain is a valid response rather
 * than a padded one.
 */
const challengeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    chainTheme: {
      type: Type.STRING,
      description:
        'Two to four words naming what THIS chain is about, e.g. "town founding", "mail delivery", "school attendance". Every chain in the session must have a different theme.',
    },
    outcome: {
      type: Type.STRING,
      description:
        'The end result the chain explains, as a plain statement of what happened. No dates, no "because", no "led to".',
    },
    outcomeCategory: categoryEnum,
    cause0Text: {
      type: Type.STRING,
      description: 'The EARLIEST cause — the event that had to happen before any of the others could.',
    },
    cause0Category: categoryEnum,
    cause1Text: { type: Type.STRING, description: 'The event the earliest cause made possible.' },
    cause1Category: categoryEnum,
    cause2Text: {
      type: Type.STRING,
      nullable: true,
      description: 'The next link, if the chain has one. Omit for a two-link chain.',
    },
    cause2Category: { ...categoryEnum, nullable: true },
    cause3Text: {
      type: Type.STRING,
      nullable: true,
      description: 'The final link before the outcome, if the chain has one.',
    },
    cause3Category: { ...categoryEnum, nullable: true },
    /**
     * The two non-causes. Only the `identify_cause` rung uses them, but they are
     * asked for on every challenge: which rung a challenge serves is decided in
     * CODE after validation, over the challenges that actually survived, so a
     * challenge that arrives without them simply is not given that rung.
     */
    distractor0Text: {
      type: Type.STRING,
      nullable: true,
      description:
        'A CONSEQUENCE of the outcome: something that only became possible once the outcome had already happened. It is NOT a cause. Same length and voice as the cause cards.',
    },
    distractor0Category: { ...categoryEnum, nullable: true },
    distractor1Text: {
      type: Type.STRING,
      nullable: true,
      description:
        'BACKGROUND: something true of this setting that did NOT make the outcome happen, and is not a consequence of it either. Same length and voice as the cause cards.',
    },
    distractor1Category: { ...categoryEnum, nullable: true },
    explanation: {
      type: Type.STRING,
      description:
        '1-2 sentences shown AFTER the student answers, teaching why each event had to come before the next.',
    },
    hint: {
      type: Type.STRING,
      description:
        'One question that sends the student back to the cards by their own words. Never names a position, a slot, or the order.',
    },
  },
  required: [
    'chainTheme',
    'outcome', 'outcomeCategory',
    'cause0Text', 'cause0Category',
    'cause1Text', 'cause1Category',
    'explanation', 'hint',
  ],
};

const causeEffectChainSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: 'Student-facing activity title (3-6 words)' },
    description: { type: Type.STRING, description: 'One sentence describing what students will figure out' },
    context: {
      type: Type.STRING,
      description:
        '2-3 sentences of background on the setting: where and when, and what life was like. Never states what caused what.',
    },
    periodLabel: {
      type: Type.STRING,
      description: 'Short kid-readable period or place tag for the header, e.g. "the 1800s West" or "Ancient Rome"',
    },
    challenges: {
      type: Type.ARRAY,
      items: challengeSchema,
      minItems: String(POOL_MIN_CHALLENGES),
      maxItems: String(POOL_MAX_CHALLENGES),
      description:
        `${POOL_MIN_CHALLENGES}-${POOL_MAX_CHALLENGES} DIFFERENT causal chains in the same setting — `
        + `the app shows up to ${MAX_CHALLENGES} of them`,
    },
  },
  required: ['title', 'description', 'context', 'periodLabel', 'challenges'],
};

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const nonempty = (v: unknown): string | undefined => {
  const s = typeof v === 'string' ? v.trim() : '';
  return s.length > 0 ? s : undefined;
};

const asCategory = (v: unknown): CauseCategory | undefined =>
  (CATEGORIES as readonly string[]).includes(String(v)) ? (v as CauseCategory) : undefined;

/** Loose text identity — catches "Families moved west." vs "families moved West". */
const canon = (s: string): string => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

/** Function words carry no topic, so they must not count toward "these are the same event". */
const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'of', 'to', 'in', 'on', 'at', 'for', 'from', 'with', 'by',
  'is', 'are', 'was', 'were', 'be', 'been', 'their', 'they', 'them', 'it', 'its', 'this',
  'that', 'these', 'those', 'new', 'across', 'into', 'onto', 'over', 'up', 'out', 'more',
]);

const contentWords = (text: string): Set<string> =>
  new Set(canon(text).split(' ').filter((w) => w.length > 2 && !STOPWORDS.has(w)));

/**
 * Share of the smaller card's content words the two cards have in common. The
 * floor guard against a session that asks the same chain four times: the model
 * reaches for the topic's most obvious first cause every time unless something
 * stops it. Semantic sameness is beyond a regex — `chainTheme` is the schema
 * lever for that — so this only has to catch the literal repeats.
 */
export const wordOverlap = (a: string, b: string): number => {
  const wa = contentWords(a);
  const wb = contentWords(b);
  if (wa.size === 0 || wb.size === 0) return 0;
  let shared = 0;
  wa.forEach((w) => { if (wb.has(w)) shared += 1; });
  return shared / Math.min(wa.size, wb.size);
};

/** Two first causes this alike are the same event in different words. */
const FIRST_CAUSE_OVERLAP_LIMIT = 0.6;

export const leaks = (text: string): string | null => {
  if (ORDINAL_LEAK.test(text)) return 'ordinal';
  if (CAUSAL_CONNECTIVE.test(text)) return 'connective';
  if (DATE_LEAK.test(text)) return 'date';
  return null;
};

/**
 * Shuffle until the result is NOT the answer order. With two cards there is
 * only one other permutation, so a plain re-draw can spin — the forced swap is
 * the exit, and it is also correct for longer chains.
 */
export const shuffleAwayFrom = <T,>(items: T[], answer: readonly T[]): T[] => {
  const isAnswer = (arr: readonly T[]) => arr.every((x, i) => x === answer[i]);
  const out = [...items];
  for (let attempt = 0; attempt < 12; attempt++) {
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    if (!isAnswer(out)) return out;
  }
  [out[0], out[1]] = [out[1], out[0]];
  return out;
};

/**
 * Shuffle an `identify_cause` bank so the causes are not sitting at the front of
 * it in their own order. Nothing GRADES on bank position on that rung — the
 * answer is a set — but a bank that opens with the answer is solvable by
 * position, which is the same defect `shuffleAwayFrom` exists to prevent on the
 * ordering rung. Same forced exit for the same reason: with five cards the
 * re-draw practically always succeeds, and the swap covers the case it does not.
 */
export const shuffleBankAwayFromPrefix = (
  bank: CauseEffectNode[],
  answerIds: readonly string[],
): CauseEffectNode[] => {
  const opensWithAnswer = (arr: readonly CauseEffectNode[]) =>
    answerIds.every((id, i) => arr[i]?.id === id);
  const out = [...bank];
  for (let attempt = 0; attempt < 12; attempt++) {
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    if (!opensWithAnswer(out)) return out;
  }
  [out[0], out[out.length - 1]] = [out[out.length - 1], out[0]];
  return out;
};

// ---------------------------------------------------------------------------
// Mode assignment — the ladder, stamped by code
// ---------------------------------------------------------------------------

/**
 * One validated chain plus the cards that are NOT part of it. `challenge` is
 * always built in its `build_chain` shape (bank = causes, `correctOrder` = the
 * causal order); `assignModes` is what turns it into another rung.
 */
export interface BuiltChallenge {
  challenge: CauseEffectChainChallenge;
  distractors: CauseEffectNode[];
}

/**
 * Stamp each surviving challenge with the move it asks.
 *
 * THE MODEL NEVER CHOOSES THIS. The usual eval-mode contract narrows a schema
 * enum so Gemini cannot emit a disallowed type; here there is no type field to
 * narrow, because all three rungs are questions over identical content. Code
 * assigning the move is strictly stronger than an enum the model could still
 * ignore — a mode can never come back wrong, and the SP-21 failure (a session
 * labelled "mixed" that is really one type end to end) is unreachable.
 *
 * Two rules:
 *   - COVERAGE. Types rotate over a shuffled order, so a blend or a mixed
 *     session shows every rung it claims once there are that many challenges.
 *   - ELIGIBILITY. `identify_cause` needs the two non-cause cards; a challenge
 *     that arrived without them falls through to another rung rather than
 *     shipping a bank with nothing wrong in it to find. `root_vs_proximate` is
 *     SPOKEN since the port, so it needs a chain whose cards are separable by
 *     ear (`chainEarSeparable`) — a chain that is not falls through the same
 *     way. `build_chain` is always eligible.
 */
export const assignModes = (
  built: BuiltChallenge[],
  allowedTypes: readonly CauseEffectChallengeType[],
): CauseEffectChainChallenge[] => {
  const order = [...(allowedTypes.length ? allowedTypes : MODE_ORDER)];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  // The root/proximate ask alternates over the rounds that actually use it, not
  // over the session index: a rotation could otherwise hand every one of them
  // the same end of the chain, and "pick the earliest-sounding card" would score.
  let askCount = 0;

  return built.map((b, i) => {
    const causeTexts = b.challenge.correctOrder.map(
      (id) => b.challenge.nodes.find((n) => n.id === id)?.text ?? '',
    );
    const eligible = (t: CauseEffectChallengeType): boolean => (
      t === 'identify_cause' ? b.distractors.length > 0
        : t === 'root_vs_proximate' ? chainEarSeparable(causeTexts)
          : true
    );
    let chosen = order[i % order.length];
    if (!eligible(chosen)) chosen = order.find(eligible) ?? 'build_chain';

    if (chosen === 'identify_cause') {
      return {
        ...b.challenge,
        type: chosen,
        nodes: shuffleBankAwayFromPrefix(
          [...b.challenge.nodes, ...b.distractors],
          b.challenge.correctOrder,
        ),
      };
    }
    if (chosen === 'root_vs_proximate') {
      const ask = askCount++ % 2 === 0 ? ('root' as const) : ('proximate' as const);
      return { ...b.challenge, type: chosen, ask };
    }
    return { ...b.challenge, type: 'build_chain' as const };
  });
};

/** Representative session metadata: the one mode, or 'mixed'. Never a render input. */
export const sessionChallengeType = (
  challenges: readonly CauseEffectChainChallenge[],
): CauseEffectChallengeType | 'mixed' => {
  const kinds = Array.from(new Set(challenges.map((c) => c.type)));
  return kinds.length === 1 ? kinds[0] : 'mixed';
};

// ---------------------------------------------------------------------------
// Structural axis — measure, then select
// ---------------------------------------------------------------------------

/**
 * Words that would anchor any two cards in the same setting without carrying a
 * link ("people", "many", "things"). Excluded from the anchor measure so a chain
 * cannot read as fully anchored just by saying "people" on every card.
 */
const GENERIC_ANCHORS = new Set([
  // quantifiers / pronouns / adverbs
  'people', 'person', 'many', 'some', 'other', 'own', 'each', 'every', 'all', 'also', 'still',
  'very', 'much', 'thing', 'things', 'way', 'ways', 'time', 'life', 'day', 'days', 'long',
  'now', 'soon', 'can', 'could', 'would', 'right', 'straight', 'together', 'instead', 'single',
  'hundreds', 'thousands', 'several', 'few', 'fewer', 'more', 'most', 'less', 'whole', 'main',
  // descriptive adjectives — the first live sweep anchored "heavy", "warm" and
  // "wooden" across unrelated cards; a describing word carries no referent.
  'heavy', 'warm', 'wooden', 'large', 'small', 'big', 'wide', 'open', 'dusty', 'fresh', 'high',
  'deep', 'tall', 'busy', 'growing', 'distant', 'local', 'remote', 'thick', 'strong', 'hard',
  'hot', 'cold', 'dark', 'old', 'young', 'early', 'late', 'fast', 'slow', 'quick', 'near',
  'far', 'huge', 'tiny', 'rich', 'poor', 'empty', 'full', 'new', 'good', 'better', 'best',
  'active', 'secure', 'sturdy', 'simple', 'grand', 'nearby', 'remote', 'steady', 'steadily',
  // generic verbs — the action is not the referent; the NOUN it acts on is.
  'begin', 'start', 'make', 'made', 'get', 'take', 'build', 'built', 'use', 'carry', 'load',
  'travel', 'move', 'work', 'live', 'come', 'go', 'bring', 'buy', 'sell', 'pay', 'need',
  'want', 'help', 'keep', 'put', 'run', 'step', 'pull', 'grow', 'stop', 'spend', 'set',
]);

/** The irregular plurals history prose actually uses. */
const IRREGULAR_STEM: Record<string, string> = { children: 'child', men: 'man', women: 'woman' };

/** Light suffix stripping so "railroads"/"railroad" and "trains"/"train" anchor each other. */
const stem = (w: string): string => {
  if (IRREGULAR_STEM[w]) return IRREGULAR_STEM[w];
  if (w.length > 5 && w.endsWith('ies')) return `${w.slice(0, -3)}y`;
  if (w.length > 5 && w.endsWith('ing')) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith('ed')) return w.slice(0, -2);
  if (w.length > 4 && w.endsWith('es')) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s')) return w.slice(0, -1);
  return w;
};

const anchorStems = (text: string): Set<string> => {
  const out = new Set<string>();
  contentWords(text).forEach((w) => {
    if (GENERIC_ANCHORS.has(w)) return;
    const s = stem(w);
    if (s.length >= 3) out.add(s);
  });
  return out;
};

/** How many anchor words two cards have in common. 0 = the link between them is not on the page. */
export const sharedStems = (a: string, b: string): number => {
  const sa = anchorStems(a);
  const sb = anchorStems(b);
  let n = 0;
  sa.forEach((s) => { if (sb.has(s)) n += 1; });
  return n;
};

/**
 * The chain rungs' lever: how many adjacent links (cause → cause, and the last
 * cause → outcome) share NO anchor word, so the student has to supply the
 * connection rather than read it. 0 = every link is visible on the page;
 * chainLength = nothing is.
 *
 * A lexical proxy, honest at the easy end (a chain whose every link is named in
 * the next card IS traceable) and noisier at the hard end (a good paraphrase can
 * hide an obvious link). The prompt does the pedagogical work; this orders the pool.
 */
export const inferredLinks = (challenge: CauseEffectChainChallenge): number => {
  const text = (id: string) => challenge.nodes.find((n) => n.id === id)?.text ?? '';
  const seq = [...challenge.correctOrder.map(text), challenge.outcome.text];
  let n = 0;
  for (let i = 0; i + 1 < seq.length; i++) {
    if (sharedStems(seq[i], seq[i + 1]) === 0) n += 1;
  }
  return n;
};

/** Two cards this alike are the same event reworded — never "near", a defect. */
export const NEAR_DUPLICATE_OVERLAP = 0.8;

/** The two non-cause roles, by the id `buildChallenge` stamps. */
const isBackgroundCard = (n: CauseEffectNode): boolean => n.id.endsWith('-d2');

/**
 * The `identify_cause` lever: how near the BACKGROUND card sits to the chain,
 * as the most anchor words it shares with a cause or the outcome. 0 = far
 * (about other people and things in the setting); ≥1 = near (about the same
 * ones, and inert — so only "did this push the ending along?" separates it).
 *
 * Only the background card is measured. The CONSEQUENCE card is about the same
 * people and things by definition — it is what the ending made possible — so a
 * lexical "far" target on it is unreachable and would leave the easy tier
 * permanently saturated (the first live sweep: nearness 2,1,1,0 at easy, all
 * from consequence cards). Its difficulty — does it read like it could have
 * helped? — is temporal, not lexical: prompt-shaped, not code-enforced.
 *
 * A reworded cause is excluded so it can never win "near" — two right answers.
 */
export const distractorNearness = (built: BuiltChallenge): number => {
  const chain = [...built.challenge.nodes.map((n) => n.text), built.challenge.outcome.text];
  let best = 0;
  for (const d of built.distractors.filter(isBackgroundCard)) {
    // A reworded cause is a defect, not a near non-cause: it contributes
    // nothing, however many stems it shares with the REST of the chain.
    if (chain.some((c) => wordOverlap(d.text, c) >= NEAR_DUPLICATE_OVERLAP)) continue;
    for (const c of chain) best = Math.max(best, sharedStems(d.text, c));
  }
  return best;
};

/** One laddered challenge with its measured shape, ready for selection. */
export interface ShapeCandidate {
  challenge: CauseEffectChainChallenge;
  inferredLinks: number;
  nearness: number;
  /** Non-cause cards that survived — a one-card `identify_cause` round is the weaker round at any tier. */
  distractorCount: number;
}

export const measureCandidates = (
  built: readonly BuiltChallenge[],
  laddered: readonly CauseEffectChainChallenge[],
): ShapeCandidate[] =>
  laddered.map((challenge, i) => ({
    challenge,
    inferredLinks: inferredLinks(challenge),
    nearness: distractorNearness(built[i]),
    distractorCount: built[i].distractors.length,
  }));

/**
 * How many of `max` slots each rung gets: one each, then the rest spread over
 * the deeper pools. Coverage first — a blend must still show every rung.
 */
const allocateSlots = (
  types: CauseEffectChallengeType[],
  counts: Map<CauseEffectChallengeType, number>,
  max: number,
): Map<CauseEffectChallengeType, number> => {
  const slots = new Map<CauseEffectChallengeType, number>(types.map((t) => [t, 1]));
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
 * Choose one rung's shipped set from its pool by that rung's own lever. Stable
 * sort, so ties keep the model's order. Returns the target-vs-result note the
 * verification pass reads to see whether the tier landed or saturated.
 */
const pickWithinType = (
  type: CauseEffectChallengeType,
  pool: ShapeCandidate[],
  slots: number,
  tier: SupportTier,
): { picked: ShapeCandidate[]; note: string } => {
  const shape = resolveProblemShape(type, tier);

  if (shape.inferredLinks) {
    const { target, direction } = shape.inferredLinks;
    const ordered = [...pool].sort((a, b) => (
      direction === 'at_least' ? b.inferredLinks - a.inferredLinks : a.inferredLinks - b.inferredLinks
    ));
    const picked = ordered.slice(0, slots);
    const onTarget = picked.filter((c) => (
      direction === 'at_least' ? c.inferredLinks >= target : c.inferredLinks <= target
    )).length;
    return {
      picked,
      note: `inferred links ${direction.replace('_', ' ')} ${target}: ${onTarget}/${picked.length} on target `
        + `(links ${picked.map((c) => c.inferredLinks).join(',')}; pool ${pool.map((c) => c.inferredLinks).join(',')})`,
    };
  }

  if (shape.distractorNearness) {
    const near = shape.distractorNearness === 'near';
    // Both non-causes present first; then the lever. A round missing its
    // background card measures 0 and would otherwise win "far" by absence.
    const ordered = [...pool].sort((a, b) => (
      (b.distractorCount - a.distractorCount)
      || (near ? b.nearness - a.nearness : a.nearness - b.nearness)
    ));
    const picked = ordered.slice(0, slots);
    const onTarget = picked.filter((c) => (near ? c.nearness >= 1 : c.nearness === 0)).length;
    return {
      picked,
      note: `non-causes ${shape.distractorNearness}: ${onTarget}/${picked.length} on target `
        + `(nearness ${picked.map((c) => c.nearness).join(',')}; pool ${pool.map((c) => c.nearness).join(',')})`,
    };
  }

  // medium — no enforced end; ship the model's order and report the mix.
  const picked = pool.slice(0, slots);
  return {
    picked,
    note: `medium, model order (links ${picked.map((c) => c.inferredLinks).join(',')}; `
      + `nearness ${picked.map((c) => c.nearness).join(',')})`,
  };
};

/**
 * The structural axis's selector: allocate, pick per rung by its own lever,
 * then ship in the order the model wrote them so the session still reads as
 * one setting.
 */
export const selectForShape = (
  candidates: ShapeCandidate[],
  max: number,
  tier: SupportTier,
): CauseEffectChainChallenge[] => {
  const types = Array.from(new Set(candidates.map((c) => c.challenge.type)));
  const counts = new Map<CauseEffectChallengeType, number>(
    types.map((t) => [t, candidates.filter((c) => c.challenge.type === t).length]),
  );
  const slots = allocateSlots(types, counts, max);

  const chosen = new Set<ShapeCandidate>();
  for (const type of types) {
    const pool = candidates.filter((c) => c.challenge.type === type);
    const { picked, note } = pickWithinType(type, pool, slots.get(type) ?? 0, tier);
    console.log(
      `[CauseEffectChain] shape "${tier}" ${type}: shipped ${picked.length} of ${pool.length} candidates — ${note}`,
    );
    for (const c of picked) chosen.add(c);
  }
  return alternateAsks(candidates.filter((c) => chosen.has(c)).map((c) => c.challenge));
};

/**
 * Re-alternate the root/proximate ask over whatever survived selection.
 * `assignModes` alternated over the whole pool; dropping candidates could leave
 * the shipped set asking for the same end every round, which is the habit the
 * rung exists to defeat. Idempotent on an already-alternated set.
 */
export const alternateAsks = (
  challenges: readonly CauseEffectChainChallenge[],
): CauseEffectChainChallenge[] => {
  let askCount = 0;
  return challenges.map((c) => (
    c.type === 'root_vs_proximate'
      ? { ...c, ask: askCount++ % 2 === 0 ? ('root' as const) : ('proximate' as const) }
      : c
  ));
};

// ---------------------------------------------------------------------------
// Post-validation
// ---------------------------------------------------------------------------

export interface RawChallenge {
  outcome?: unknown;
  outcomeCategory?: unknown;
  explanation?: unknown;
  hint?: unknown;
  [key: string]: unknown;
}

/**
 * Rebuild ONE challenge from the flat response, or return null with a reason.
 * Nothing is defaulted: a missing or leaking field kills the challenge so the
 * failure is visible in the rejection log rather than silently rendered.
 */
export const buildChallenge = (
  raw: RawChallenge,
  index: number,
  /**
   * The chain length this pass insists on. Attempt 1 passes the GRADE's target
   * so the band contract is real; attempt 2 degrades to `MIN_CAUSES` so a model
   * that will not produce four links still ships a measurable three rather than
   * dropping the whole session onto the fallback.
   */
  minCauses: number = MIN_CAUSES,
): { challenge: CauseEffectChainChallenge; distractors: CauseEffectNode[] } | { reject: string } => {
  const outcomeText = nonempty(raw.outcome);
  const outcomeCategory = asCategory(raw.outcomeCategory);
  const explanation = nonempty(raw.explanation);
  if (!outcomeText) return { reject: 'missing outcome' };
  if (!outcomeCategory) return { reject: 'missing/unknown outcomeCategory' };
  if (!explanation) return { reject: 'missing explanation' };

  const outcomeLeak = leaks(outcomeText);
  if (outcomeLeak) return { reject: `outcome ${outcomeLeak} leak: "${outcomeText}"` };
  if (!cardSpeakable(outcomeText)) return { reject: `outcome not speakable (quote or sentinel opener): "${outcomeText}"` };

  // Causes, in the order Gemini emitted them — this IS the answer.
  const ordered: CauseEffectNode[] = [];
  for (let i = 0; i < MAX_CAUSES; i++) {
    const text = nonempty(raw[`cause${i}Text`]);
    const category = asCategory(raw[`cause${i}Category`]);
    if (!text) break;               // chains are contiguous; a gap ends the chain
    if (!category) return { reject: `cause${i} missing category` };
    const leak = leaks(text);
    if (leak) return { reject: `cause${i} ${leak} leak: "${text}"` };
    if (!cardSpeakable(text)) return { reject: `cause${i} not speakable (quote or sentinel opener): "${text}"` };
    ordered.push({
      id: `cec-${index + 1}-${i + 1}`,
      text,
      category,
      icon: CATEGORY_ICON[category],
    });
  }

  if (ordered.length < minCauses) {
    return { reject: `only ${ordered.length} usable cause(s), needed ${minCauses}` };
  }

  // No card may restate another card or the outcome — a duplicate makes two
  // slots interchangeable and the "correct" order arbitrary.
  const seen = new Set<string>([canon(outcomeText)]);
  for (const node of ordered) {
    const key = canon(node.text);
    if (seen.has(key)) return { reject: `duplicate card: "${node.text}"` };
    seen.add(key);
  }

  const correctOrder = ordered.map((n) => n.id);
  const nodes = shuffleAwayFrom(ordered, ordered);

  /**
   * The non-causes, for the `identify_cause` rung. Held SOFTLY on purpose: a
   * distractor that leaks, restates a card, or simply never arrived costs the
   * rung, not the challenge — the other two rungs never needed it, and killing
   * a sound chain over an optional card would trade three good rounds for one.
   * They face every audit the causes face, because a distractor with a date or
   * a connective on it is sortable out of the bank without any reasoning.
   */
  const distractors: CauseEffectNode[] = [];
  for (let i = 0; i < 2; i++) {
    const text = nonempty(raw[`distractor${i}Text`]);
    const category = asCategory(raw[`distractor${i}Category`]);
    if (!text || !category) continue;
    if (leaks(text)) continue;
    if (!cardSpeakable(text)) continue;
    const key = canon(text);
    if (seen.has(key)) continue;   // a "non-cause" that restates a cause is a wrong key
    seen.add(key);
    distractors.push({
      id: `cec-${index + 1}-d${i + 1}`,
      text,
      category,
      icon: CATEGORY_ICON[category],
    });
  }

  // Softer audit: a hint that names a position is dropped, not fatal — the
  // component renders the disclosure only when a hint survives.
  const rawHint = nonempty(raw.hint);
  const hint = rawHint && !HINT_POSITION_LEAK.test(rawHint) && !leaks(rawHint) ? rawHint : undefined;

  return {
    challenge: {
      id: `cec-${index + 1}`,
      // The build_chain SHAPE, not necessarily the build_chain rung: `assignModes`
      // restamps this once the surviving set is known.
      type: 'build_chain',
      chainTheme: nonempty(raw.chainTheme) ?? outcomeText,
      outcome: {
        id: `cec-${index + 1}-outcome`,
        text: outcomeText,
        category: outcomeCategory,
        icon: CATEGORY_ICON[outcomeCategory],
      },
      nodes,
      correctOrder,
      explanation,
      hint,
    },
    distractors,
  };
};

export const validateResponse = (
  parsed: unknown,
  gradeKey: string,
  minCauses: number = MIN_CAUSES,
  /**
   * Which rungs this session may ask. Omitted (or empty) means the mixed path:
   * all three rotate. Note the rungs are stamped over the SURVIVORS, after every
   * distinctness guard has run — assigning before validation would leave a
   * blend's coverage at the mercy of which challenges happened to be rejected.
   */
  allowedTypes: readonly CauseEffectChallengeType[] = MODE_ORDER,
  /**
   * The structural axis. The response is always a candidate POOL; with a tier
   * every survivor is laddered, measured against its own rung's lever, and the
   * `MAX_CHALLENGES` nearest the tier ship. Without one (`null`) the first
   * `MAX_CHALLENGES` survivors ship in the model's order — no measuring.
   */
  tier: SupportTier | null = null,
): CauseEffectChainData | null => {
  if (!parsed || typeof parsed !== 'object') return null;
  const root = parsed as Record<string, unknown>;

  const title = nonempty(root.title);
  const description = nonempty(root.description);
  const context = nonempty(root.context);
  const periodLabel = nonempty(root.periodLabel);
  if (!title || !description || !context || !periodLabel) {
    console.warn('[CauseEffectChain] Rejected: missing session-level field', {
      title: !!title, description: !!description, context: !!context, periodLabel: !!periodLabel,
    });
    return null;
  }

  const rawChallenges = Array.isArray(root.challenges) ? root.challenges : [];
  const surviving: BuiltChallenge[] = [];
  const challenges: CauseEffectChainChallenge[] = [];
  const rejections: string[] = [];
  const outcomesSeen = new Set<string>();
  const themesSeen = new Set<string>();

  /**
   * Cross-challenge distinctness — three separate ways one chain can arrive
   * several times over. A session that asks the same chain four times is one
   * problem asked four ways, which is the rule this project fixed once already.
   */
  rawChallenges.forEach((raw, i) => {
    const built = buildChallenge((raw ?? {}) as RawChallenge, challenges.length, minCauses);
    if ('reject' in built) {
      rejections.push(`#${i + 1}: ${built.reject}`);
      return;
    }
    const { challenge } = built;

    const outcomeKey = canon(challenge.outcome.text);
    if (outcomesSeen.has(outcomeKey)) {
      rejections.push(`#${i + 1}: duplicate outcome "${challenge.outcome.text}"`);
      return;
    }
    const themeKey = canon(challenge.chainTheme);
    if (themesSeen.has(themeKey)) {
      rejections.push(`#${i + 1}: duplicate theme "${challenge.chainTheme}"`);
      return;
    }
    // The literal-repeat floor: the model reaches for a topic's most obvious
    // first cause on every chain unless something stops it.
    const firstCause = challenge.nodes.find((n) => n.id === challenge.correctOrder[0]);
    const clash = challenges.find((prior) => {
      const priorFirst = prior.nodes.find((n) => n.id === prior.correctOrder[0]);
      return !!firstCause && !!priorFirst
        && wordOverlap(firstCause.text, priorFirst.text) >= FIRST_CAUSE_OVERLAP_LIMIT;
    });
    if (clash) {
      rejections.push(`#${i + 1}: first cause repeats "${clash.chainTheme}"`);
      return;
    }

    outcomesSeen.add(outcomeKey);
    themesSeen.add(themeKey);
    challenges.push(challenge);
    surviving.push(built);
  });

  if (rejections.length > 0) {
    console.warn(`[CauseEffectChain] Rejected ${rejections.length} challenge(s):`, rejections);
  }

  if (challenges.length < MIN_CHALLENGES) {
    console.warn(
      `[CauseEffectChain] Only ${challenges.length} challenge(s) survived validation (need ${MIN_CHALLENGES})`,
    );
    return null;
  }

  const laddered = assignModes(surviving, allowedTypes);

  /**
   * A session pinned to `identify_cause` that produced no distractors anywhere
   * would come back as build_chain rounds under an identify_cause label — the
   * eval-mode equivalent of a silent fallback, and it would poison the IRT
   * evidence with a β that never applied. Fail instead, so the retry (and then
   * the curated fallback, which carries its own distractors) can serve the pin.
   */
  if (allowedTypes.length === 1 && laddered.some((c) => c.type !== allowedTypes[0])) {
    console.warn(
      `[CauseEffectChain] Pinned to "${allowedTypes[0]}" but the response could not serve it `
      + '(identify_cause needs the two non-cause cards; root_vs_proximate needs cards separable by ear) '
      + '— rejecting rather than silently substituting a rung',
    );
    return null;
  }

  // `assignModes` rotated the rungs and alternated the asks in encounter order,
  // so the untiered prefix still covers every rung a blend claims.
  const shipped = tier
    ? selectForShape(measureCandidates(surviving, laddered), MAX_CHALLENGES, tier)
    : laddered.slice(0, MAX_CHALLENGES);

  return {
    title,
    description,
    context,
    periodLabel,
    challenges: shipped,
    challengeType: sessionChallengeType(shipped),
    gradeLevel: gradeKey,
  };
};

// ---------------------------------------------------------------------------
// Curated fallback
// ---------------------------------------------------------------------------

/**
 * Used only when BOTH generation attempts fail. Hand-checked against the same
 * audits the generated content must pass: no ordinal words, no connectives, no
 * years on any card. Chains are trimmed to the grade's length so the fallback
 * is band-appropriate rather than merely present.
 */
export const buildFallbackChains = (
  gradeKey: string,
  /**
   * The rungs the fallback must be able to serve. It carries its own
   * distractors precisely so a session PINNED to `identify_cause` still gets
   * that rung when both generation attempts have failed — a fallback that
   * silently downgraded the mode would hand the IRT model evidence under a β
   * that never applied.
   */
  allowedTypes: readonly CauseEffectChallengeType[] = MODE_ORDER,
): CauseEffectChainData => {
  const chainLength = chainLengthFor(gradeKey);

  const raw: Array<{
    theme: string;
    outcome: [string, CauseCategory];
    causes: Array<[string, CauseCategory]>;
    /** [a consequence of the outcome, a piece of inert background] — the non-causes. */
    distractors: Array<[string, CauseCategory]>;
    explanation: string;
    hint: string;
  }> = [
    {
      theme: 'town founding',
      outcome: ['A busy town grows up where the tracks cross the river', 'social'],
      causes: [
        ['Engineers build a railroad line across the open plains', 'technological'],
        ['Trains carry crops and cattle to city markets in a few days', 'economic'],
        ['Storekeepers and blacksmiths open shops beside the station', 'economic'],
      ],
      distractors: [
        ['The town council hires a teacher for the new schoolhouse', 'political'],
        ['Tall grass covers the plains for miles in every direction', 'social'],
      ],
      explanation:
        'The tracks came before the trade, and the trade came before the shops. Each step only made sense once the one before it existed.',
      hint: 'Which of these could not happen at all until the tracks were already there?',
    },
    {
      theme: 'school attendance',
      outcome: ['Children spend their days in a schoolhouse instead of the fields', 'social'],
      causes: [
        ['New machines do the heaviest work on the farm', 'technological'],
        ['Families need fewer hands to bring in the harvest', 'economic'],
        ['Lawmakers require every child to attend school', 'political'],
      ],
      distractors: [
        ['Children learn to read and write their own letters home', 'social'],
        ['Winters on the northern farms are long and very cold', 'social'],
      ],
      explanation:
        'Machines freed the children from farm work, and only then could a school law be something families could actually follow.',
      hint: 'Think about what had to change on the farm before a family could spare a child all day.',
    },
    {
      theme: 'fast news',
      outcome: ['Letters reach the far side of the country in a single day', 'social'],
      causes: [
        ['Workers string wire along poles from town to town', 'technological'],
        ['Messages travel the wire as clicks an operator can read', 'technological'],
        ['Post offices hire operators to pass on urgent news', 'economic'],
      ],
      distractors: [
        ['Newspapers print the same story in cities a thousand miles apart', 'social'],
        ['Most families keep a horse and a wagon in the barn', 'economic'],
      ],
      explanation:
        'The wire had to exist before a message could run along it, and the message had to work before anyone was paid to send it.',
      hint: 'One of these is a thing people built. What can only happen after it is built?',
    },
    {
      theme: 'moving west',
      outcome: ['Families pack wagons and move west together', 'social'],
      causes: [
        ['Explorers map a route through the mountain passes', 'technological'],
        ['Newspapers print stories of good farmland out west', 'social'],
        ['Neighbors gather into wagon trains for the journey', 'social'],
      ],
      distractors: [
        ['Empty farmhouses stand along the roads the families left', 'economic'],
        ['The mountains hold snow on their peaks all summer long', 'social'],
      ],
      explanation:
        'A route had to be found before anyone could describe the land, and people had to hear about it before they would gather to go.',
      hint: 'Which of these gave people the idea in the first place, and which one needed that idea already?',
    },
  ];

  const built: BuiltChallenge[] = raw
    .slice(0, MAX_CHALLENGES)
    .map((entry, index) => {
      // Never below MIN_CAUSES: the curated chains carry exactly three, so a
      // grade asking for four simply ships the three it has.
      const ordered: CauseEffectNode[] = entry.causes
        .slice(0, Math.max(chainLength, MIN_CAUSES))
        .map(([text, category], i) => ({
          id: `cec-fb-${index + 1}-${i + 1}`,
          text,
          category,
          icon: CATEGORY_ICON[category],
        }));
      return {
        challenge: {
          id: `cec-fb-${index + 1}`,
          type: 'build_chain' as const,
          chainTheme: entry.theme,
          outcome: {
            id: `cec-fb-${index + 1}-outcome`,
            text: entry.outcome[0],
            category: entry.outcome[1],
            icon: CATEGORY_ICON[entry.outcome[1]],
          },
          nodes: shuffleAwayFrom(ordered, ordered),
          correctOrder: ordered.map((n) => n.id),
          explanation: entry.explanation,
          hint: entry.hint,
        },
        distractors: entry.distractors.map(([text, category], i) => ({
          id: `cec-fb-${index + 1}-d${i + 1}`,
          text,
          category,
          icon: CATEGORY_ICON[category],
        })),
      };
    });

  const challenges = assignModes(built, allowedTypes);

  return {
    title: 'What Led to What?',
    description: 'Work out what had to happen before what.',
    context:
      'In the years when the railroads spread across America, whole towns appeared where there had been open grass. '
      + 'New machines changed farms, new wires carried news, and families moved to places their parents had never seen.',
    periodLabel: 'A changing America',
    challenges,
    challengeType: sessionChallengeType(challenges),
    gradeLevel: gradeKey,
  };
};

// ---------------------------------------------------------------------------
// Support tier application (axis 1, on a finished session)
// ---------------------------------------------------------------------------

/**
 * Stamp the SCAFFOLDING half of the tier onto a finished session — the live
 * path and the curated fallback alike, so a student who fell through to the
 * fallback still gets the tier the manifest asked for. (The structural half
 * cannot apply to the fallback: its chains are curated, so it saturates there
 * honestly.) Resolved PER CHALLENGE from that challenge's own `type`, because
 * difficulty is a property of the STUDENT — a blended session is tiered too.
 * Nothing here is answer-bearing.
 */
export const applySupportTier = (data: CauseEffectChainData, tier: SupportTier): CauseEffectChainData => {
  const challenges = data.challenges.map((challenge) => ({
    ...challenge,
    ...resolveSupportStructure(challenge.type, tier).scaffold,
  }));
  console.log(
    `[CauseEffectChain] Support tier "${tier}" applied per-challenge to ${challenges.length} challenge(s) `
    + `[${data.challengeType === 'mixed' ? 'blended' : `single-mode ${data.challengeType}`}]: `
    + `strategy ${challenges[0]?.showStrategy ? 'shown' : 'withdrawn'}, `
    + `labels ${challenges[0]?.showCategoryLabels ? 'shown' : 'withdrawn'}, `
    + `hint ${challenges[0]?.showHint ? 'offered' : 'withdrawn'}`,
  );
  return { ...data, challenges, supportTier: tier };
};

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

export const generateCauseEffectChain = async (
  topic: string,
  gradeLevel: string,
  config?: {
    /** Eval mode pinned by the tester/curator. Wins over intent resolution, no LLM call. */
    targetEvalMode?: string;
    /** Component intent — the routing and topic-fidelity signal. */
    intent?: string;
    /** Parent objective text (stamped by flattenManifestToLayout) — secondary signal. */
    objectiveText?: string;
    /**
     * Per-component support tier from the manifest ('easy' | 'medium' | 'hard').
     * Second field of the two-field contract: targetEvalMode = which rung,
     * difficulty = how much on-screen help AND how indirect the inference within
     * it. NEVER changes chain length or reading level.
     */
    difficulty?: string;
    [key: string]: unknown;
  },
): Promise<CauseEffectChainData> => {
  const gradeKey = normalizeGradeKey(gradeLevel);
  const intent = nonempty(config?.intent);
  const chainLength = chainLengthFor(gradeKey);

  /**
   * Both axes of the tier hang off this one key. `null` leaves the prompt and
   * the post-process as they were: the pool is asked for either way (see
   * `POOL_MIN_CHALLENGES`), and only the SELECTION is tier-gated.
   */
  const supportTier = normalizeSupportTier(
    typeof config?.difficulty === 'string' ? config.difficulty : undefined,
  );

  /**
   * Which rungs this session asks. A pin short-circuits with no LLM call; an
   * unpinned session resolves from intent; `null` is the genuine mixed case and
   * lets all three rotate. Note what the resolution does NOT do here: it never
   * touches the schema. The rungs are three questions over one emission, so the
   * shape Gemini returns is the same either way, and what changes is (a) which
   * extra cards the prompt insists on and (b) what `assignModes` stamps.
   */
  const resolution: EvalModeResolution | null = await resolveEvalModes(
    'cause-effect-chain',
    {
      targetEvalMode: config?.targetEvalMode,
      intent: config?.intent,
      objectiveText: config?.objectiveText,
    },
    CHALLENGE_TYPE_DOCS,
  );
  const allowedTypes = (resolution?.allowedTypes ?? MODE_ORDER) as readonly CauseEffectChallengeType[];
  const wantsDistractors = allowedTypes.includes('identify_cause');
  const tierSection = supportTier ? buildTierPromptSection(allowedTypes, supportTier) : '';

  console.log(
    `[CauseEffectChain] modes: ${resolution ? `${resolution.modes.map((m) => m.evalMode).join('+')} (${resolution.source})` : 'mixed'} `
    + `→ rungs [${allowedTypes.join(', ')}]${wantsDistractors ? ' (+ non-cause cards)' : ''}, `
    + `support tier: ${supportTier ?? 'none'}`,
  );

  const prompt = `You are a history curriculum expert creating a "Cause and Effect Chain" activity.

TOPIC: ${topic}
${intent ? `ASSIGNED LEARNING INTENT: "${intent}" — honor this specific objective within the topic.\n` : ''}TARGET GRADE: ${gradeKey} — ${gradeGuidance(gradeKey)}

## The Activity
Students see one shared background, then work through ${MIN_CHALLENGES}-${MAX_CHALLENGES} separate chains of events in that setting. You write the chains; the app decides which QUESTION each one is asked as, and shuffles the cards itself.

${buildModeConstraintSection(resolution, CHALLENGE_TYPE_DOCS)}
${tierSection}
Write every chain the same way regardless — an ordered chain of causes, plus${wantsDistractors ? ' the two non-cause cards' : ' nothing extra'}. You are never asked to say which round is which.

## The Setting
- Pick ONE historical setting that serves the topic: a period, a place, a movement, or an event.
- "context": 2-3 sentences of background at the target reading level. Describe the world — where, when, what life was like. NEVER say what caused what; the causes are the questions.
- "periodLabel": a short kid-readable tag for the header, e.g. "the 1800s West", "Ancient Rome", "our growing town".

## Each Chain (${POOL_MIN_CHALLENGES}-${POOL_MAX_CHALLENGES} of them, all in the SAME setting — the app shows up to ${MAX_CHALLENGES}; the rest are spares, so every one must be usable)
- "outcome": the end result — one plain statement of something that happened.
- "chainTheme": two to four words naming what this chain is about ("town founding", "mail delivery", "school attendance"). EVERY chain in the session must have a DIFFERENT theme.
- Then EXACTLY ${chainLength} CAUSE CARDS (the outcome is not one of them), in the order they happened, earliest first:
  - cause0Text is the event that had to happen before any of the others could.
  - cause1Text is what that first event made possible.
${chainLength >= 3 ? '  - cause2Text is the next link.\n' : ''}${chainLength >= 4 ? '  - cause3Text is the last link before the outcome.\n' : ''}${chainLength < 4 ? `  - Leave cause${chainLength}Text and cause3Text empty. This grade gets ${chainLength} cause cards, no more.
` : ''}
- The order must be DEFENSIBLE: a student should be able to say why the second event could not have happened until the first one had.
- Give every event a category — political, economic, social, or technological. Across the session, use several different categories: the point of the activity is that big changes have causes from different corners of life.
${wantsDistractors ? `
## The two NON-CAUSE cards (REQUIRED on every chain)
These are what the student has to leave out, so they carry the whole difficulty of that round.
- "distractor0Text": a CONSEQUENCE of the outcome — something that only became possible once the outcome had already happened. It is genuinely connected to the story, and it is genuinely not a cause. This is the card that catches the student who thinks "related to" means "caused".
  It must be a DEAD END: an effect nothing else runs on. Ask yourself whether a thoughtful student could argue this event also helped bring the outcome about — if they could, the round has two defensible answers and you must write a different card. ("Shops open to serve the travellers" fails that test for a growing town: shops help a town grow. "Children run down to the platform to wave at the passengers" passes: nothing depends on it.)
- "distractor1Text": BACKGROUND — something true of this setting that did not make the outcome happen: the land, the weather, what people already owned or already did.
- Both must read EXACTLY like the cause cards: same length, same voice, same kind of concrete detail, and a category of their own. A distractor that is vaguer, shorter, or odder than the causes gets picked out by its shape and the round measures nothing.
- The same rules 1-5 below apply to them: no sequence words, no connectives, no dates, no restating another card.
` : ''}
## Rules that decide whether a chain is usable
1. NEVER write a sequence word on a card: no "first", "then", "next", "later", "finally", "eventually", "after that", "meanwhile". The card must not announce its own place in the chain.
2. NEVER write a causal connective on a card: no "because", "since", "so", "as a result", "led to", "caused", "which meant", "therefore". The link is what the student is working out.
3. NEVER put a year or a date on a card — not "1869", not "the 1800s". Dates would let a student sort the chain without thinking about causes.
4. Write each card as a plain statement of an event: "Engineers build a railroad line across the open plains."
5. No two cards in a chain may say the same thing in different words, and no card may restate the outcome.
6. Every chain must end in a DIFFERENT outcome AND begin from a DIFFERENT first cause. Do not start more than one chain with the same event: if three of your chains begin with the railroad being built, you have written one chain three times, and only the first will be used.
   Reach across the setting for genuinely different stories - how a place was settled, how people got news, how children spent their days, what work paid, what rules changed.
7. "explanation": 1-2 sentences shown AFTER the student answers, teaching why each event had to come before the next. Reference the events, don't just say "this is the right order".
8. "hint": one question that sends the student back to the cards in their own words — for example "which of these could not happen until something was built?". NEVER mention a position, a slot, a number, or the words "first" or "last".
9. Every card and the outcome are READ ALOUD by a tutor: never put quotation marks on a card, and never begin a card with the word "Yes". Give each cause card at least one concrete noun the other cards in its chain do not use, so a child can name a card by its own words.

Now generate the Cause and Effect Chain activity.`;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: causeEffectChainSchema,
        },
      });

      if (!response.text) throw new Error('No content generated for cause-effect-chain');

      // Attempt 1 insists on the grade's chain length; attempt 2 degrades to the
      // measurement floor rather than dropping the whole session to the fallback.
      const minCauses = attempt === 1 ? chainLength : MIN_CAUSES;
      const data = validateResponse(JSON.parse(response.text), gradeKey, minCauses, allowedTypes, supportTier);
      if (data) {
        console.log('[CauseEffectChain] Generated:', {
          topic,
          gradeLevel: gradeKey,
          periodLabel: data.periodLabel,
          challenges: data.challenges.length,
          rungs: data.challenges.map((c) => (c.ask ? `${c.type}:${c.ask}` : c.type)),
          sessionType: data.challengeType,
          chainLengths: data.challenges.map((c) => c.correctOrder.length),
          targetChainLength: chainLength,
          themes: data.challenges.map((c) => c.chainTheme),
          categories: Array.from(
            new Set(data.challenges.flatMap((c) => c.nodes.map((n) => n.category))),
          ),
          supportTier: supportTier ?? 'none',
          inferredLinks: data.challenges.map((c) => inferredLinks(c)),
          attempt,
        });
        return supportTier ? applySupportTier(data, supportTier) : data;
      }
      console.warn(`[CauseEffectChain] Attempt ${attempt} failed validation${attempt === 1 ? '; retrying once' : ''}`);
    } catch (error) {
      console.warn(`[CauseEffectChain] Attempt ${attempt} errored${attempt === 1 ? '; retrying once' : ''}:`, error);
    }
  }

  console.error(
    `[CauseEffectChain] BOTH generation attempts failed for topic "${topic}" — using the curated fallback chains`
    + (supportTier ? ` (tier "${supportTier}": scaffolds applied; the shape lever cannot reselect curated chains)` : ''),
  );
  const fallback = buildFallbackChains(gradeKey, allowedTypes);
  return supportTier ? applySupportTier(fallback, supportTier) : fallback;
};
