import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import { LetterSpotterData } from "../../primitives/visual-primitives/literacy/LetterSpotter";
import {
  isSayableSentence,
  isSayableWord,
  opensWithSentinel,
  SPOTTER_EMOJI,
} from "../../primitives/visual-primitives/literacy/letterSpotterScript";
import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from '../evalMode';

// ---------------------------------------------------------------------------
// Challenge type documentation registry
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  'name-it': {
    promptDoc:
      `"name-it" (Sentence Spotter): Student hears a short sentence where one letter in a key word is hidden behind an emoji. `
      + `The tutor reads the full sentence aloud and the student SAYS the letter the emoji replaced — out loud, `
      + `not from a list. There are no answer choices on screen for this mode. `
      + `REQUIRED fields for name-it: sentence, targetWord. `
      + `Write the sentence PLAINLY with the whole word spelled out — code hides the letter behind the emoji afterwards. `
      + `Example: targetLetter "s", targetWord "sun", sentence "The sun is bright.". `
      + `Sentences are simple, 4-7 words, age-appropriate for K-2, and MUST contain targetWord exactly once. `
      + `targetLetter MUST be the FIRST letter of targetWord (e.g., "sun" for "s", never "bus"). `
      + `Pick a targetWord a five-year-old can hear the start of clearly — the answer is spoken, so the WORD has to `
      + `carry the sound unambiguously. Do NOT include letterGrid or options for this mode.`,
    schemaDescription: "'name-it' (sentence spotter — say the missing letter)",
  },
  'find-it': {
    promptDoc:
      `"find-it": Student hears a letter name and finds all instances in a 4x4 grid of 16 uppercase letters. `
      + `Grid contains 2-3 instances of the target mixed with distractors. `
      + `targetCase must be "uppercase". Do NOT include options, sentence or targetWord for this mode.`,
    schemaDescription: "'find-it' (locate letter in grid)",
  },
  'match-it': {
    promptDoc:
      `"match-it": Student sees an uppercase letter and matches it to the correct lowercase form from 4 options. `
      + `Distractors are visually similar lowercase letters (e.g., b/d, p/q, m/n). `
      + `targetCase must be "uppercase". Do NOT include letterGrid, sentence or targetWord for this mode.`,
    schemaDescription: "'match-it' (match uppercase to lowercase)",
  },
};

/**
 * ONE marker for every sentence-spotter item, imported from the pack so the
 * screen and the spoken line can never disagree about it.
 *
 * This replaced a ten-emoji pool rotated by challenge index. The pool was a
 * VISUAL variety idea with an AUDIO cost nobody priced: the tutor names the
 * marker in its ask, so a live session (42edfc52e539) asked one child in turn
 * about "the ⭐", "the 🌟", "the crystal ball", "the diamond" and "the target"
 * inside two minutes. A five-year-old is learning the game, not a vocabulary of
 * mystery objects.
 */
const SENTENCE_EMOJI = SPOTTER_EMOJI;

/**
 * Hide the target letter behind the marker. The model emits the PLAIN sentence
 * ("The sun is bright."); this builds the PRINTED shape ("The ⭐un is bright.")
 * by replacing only the FIRST character of targetWord — the rest of the word
 * stays visible on purpose, because it is the only decodable cue the item has.
 * Returns null when targetWord isn't present exactly once, so the caller drops
 * the item rather than asking a question with two answers.
 */
function spliceEmoji(sentence: string, targetWord: string, emoji: string): string | null {
  const escaped = targetWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`\\b${escaped}\\b`, 'gi');
  const match = re.exec(sentence);
  // ANSWER-LEAK GUARD: must occur EXACTLY once. A second occurrence would leave the
  // target letter spelled out elsewhere in the sentence, giving the answer away.
  if (!match || re.exec(sentence)) return null;
  const word = match[0];
  return sentence.slice(0, match.index) + emoji + word.slice(1) + sentence.slice(match.index + word.length);
}

/**
 * Repair a/an agreement before the sentence is ever spoken aloud.
 *
 * The live drive had the tutor read "I see a ant walk away" and "I see a inky
 * paw print" to a five-year-old — in a LITERACY primitive. The generator
 * constrains targetWord to START with the target letter, which pushes the model
 * toward vowel-initial words in exactly the articles' blind spot, and no gate
 * looked at the prose. Deterministic and applied to the SPOKEN form before the
 * splice, because after the splice the deciding letter is gone.
 *
 * Orthographic, not phonetic: "an hour"/"a unicorn" are wrong here. Neither is
 * reachable from the K-2 CVC vocabulary this primitive draws on, and a wrong
 * article on a rare word is a smaller harm than the raw defect it replaces.
 */
const VOWEL_LETTERS = new Set(['a', 'e', 'i', 'o', 'u']);
function fixArticleAgreement(sentence: string): string {
  return sentence.replace(/\b(an?)(\s+)([A-Za-z])/gi, (_m, article: string, gap: string, first: string) => {
    const target = VOWEL_LETTERS.has(first.toLowerCase()) ? 'an' : 'a';
    const cased = /^[A-Z]/.test(article) ? target.charAt(0).toUpperCase() + target.slice(1) : target;
    return `${cased}${gap}${first}`;
  });
}

// Shape + sentinel gates are IMPORTED from letterSpotterScript (top of file):
// both sides of the wire must agree on what is sayable, and the hand-synced
// copies that used to live here had already drifted (90 vs 100 sentence chars).
// The 400-char `targetWord` runaway story — why a field that cannot be
// enum-locked needs a SHAPE gate, not only a meaning gate — lives with the
// gates in the script module.

// ---------------------------------------------------------------------------
// Within-mode support tier (config.difficulty) — scaffolding level, NOT letters
// ---------------------------------------------------------------------------
// Two-field contract: config.targetEvalMode = WHICH recognition task (task
// identity, matched to the objective by the manifest); config.difficulty drives
// TWO axes within that task: (1) how much on-card SUPPORT the student gets
// (withdraw a strategy cue / reference letter / option scaffolding), and (2) the
// problem's STRUCTURE — how visually confusable the DISTRACTORS are (far → near
// letterforms; b/d/p/q at hard). Neither axis ever changes the target letter,
// the letter scope/group, or which answer is correct — only the wrong choices
// (and which letters fill the grid's non-target cells) shift. The answer is
// always recomputed from the rewritten data. See memory: structural-difficulty-not-numeric.

type SupportTier = 'easy' | 'medium' | 'hard';
const SUPPORT_TIERS: readonly SupportTier[] = ['easy', 'medium', 'hard'];

/** STRICT lookup — the manifest enum-constrains config.difficulty to these.
 *  Unknown/absent → null (no tier applied; grade-band defaults stand). */
function normalizeSupportTier(difficulty?: string): SupportTier | null {
  const d = difficulty?.toLowerCase().trim() ?? '';
  return (SUPPORT_TIERS as readonly string[]).includes(d) ? (d as SupportTier) : null;
}

type LetterMode = 'name-it' | 'find-it' | 'match-it';

// ---------------------------------------------------------------------------
// Bespoke support scaffold — ONE field per discovered lever. Each lever only
// WITHDRAWS on-card help; none touches targetLetter / options-correctness / grid.
// ---------------------------------------------------------------------------

interface LetterSpotterSupportScaffold {
  /** #2 instruction-as-scaffold: a one-line strategy cue shown on the card.
   *  null = withdrawn (hard) — the student picks an approach unaided. */
  strategyHint: string | null;
  /** #1 perception (find-it only): show the target letter on-card as a self-check
   *  reference. Never reveals which cells. false at hard (audio only). */
  showTargetReference: boolean;
  /** #5 answer-form (match-it ONLY): how many letter options to present.
   *  Fewer distractors = more support. The correct answer is ALWAYS retained
   *  (answer-bearing guard); only distractors are trimmed/kept.
   *  name-it dropped out of this lever with its option tiles — its support now
   *  withdraws through the tutor's spoken lead-in instead. */
  optionCount: number;
  promptLines: string[];
}

/** Per-mode strategy cue text, authored per tier. Never names the target letter. */
function strategyText(mode: LetterMode): string {
  switch (mode) {
    case 'name-it':
      return 'Say the whole sentence out loud and listen for the sound the emoji is hiding.';
    case 'find-it':
      return 'Scan the grid row by row, left to right, so you do not skip any.';
    case 'match-it':
      return 'Picture how the big letter looks small — does its shape stay the same or flip?';
  }
}

/** TRUTHFUL guardrail shared by BOTH axes. Tier changes problem STRUCTURE
 *  (distractor letterform similarity — how confusable the wrong choices are)
 *  and on-card help — NEVER the letter scope, the target letter, or which
 *  answer is correct. Magnitude (the letter group + grade band) is owned by
 *  the eval mode; the tier never reaches past it. */
const TIER_GUARDRAIL =
  'This tier changes problem STRUCTURE (how visually confusable the wrong choices are — '
  + 'far vs. near letterforms) and on-screen help — NOT the letter scope or which answer is correct. '
  + 'Every letter still comes from the cumulative group; never add letters outside it, and never '
  + 'just "use harder letters". The target letter and the correct answer are unchanged.';

/**
 * Resolve the on-card support structure for a tier on a pinned (or per-challenge)
 * mode. Support is withdrawn as the tier hardens; the lines reframe the SAME task
 * with less help — never a different task, never different letters.
 */
function resolveSupportStructure(mode: LetterMode, tier: SupportTier): LetterSpotterSupportScaffold {
  const strategyHint = tier === 'hard' ? null : strategyText(mode);
  const showTargetReference = mode === 'find-it' && tier !== 'hard';
  // Option count is the answer-form lever for the option modes. find-it has no
  // options, so it ignores this. easy = fewest distractors, hard = most.
  const optionCount = tier === 'easy' ? 3 : tier === 'medium' ? 4 : 4;

  const lead =
    `Support tier "${tier}" sets on-card SCAFFOLDING only — it NEVER changes the target letter, `
    + `the grid, the sentence, or which answer is correct. A harder tier just gives less help.`;

  const lines: string[] = [lead];
  switch (mode) {
    case 'name-it':
      // The answer-form lever is GONE here: name-it has no options to trim
      // since the child says the letter (2026-08-13 ruling). What withdraws
      // instead is the tutor's spoken DISTAR lead-in, which the pack owns
      // (`leadInFor`: easy = model + guide, medium = model, hard = nothing) —
      // a real withdrawal of instruction rather than a shorter menu.
      lines.push(
        tier === 'easy'
          ? 'The tutor models the strategy ("listen for the sound at the very start of the word") AND promises to say the word on its own after the sentence.'
          : tier === 'hard'
            ? 'No lead-in at all: the tutor reads the sentence and asks, and the student finds the missing letter unaided.'
            : 'The tutor models the strategy once before asking, but does not repeat the word on its own.',
      );
      break;
    case 'find-it':
      lines.push(
        tier === 'easy'
          ? 'The target letter is shown on-card as a reference to self-check against, plus a "scan row by row" cue — but the student still must locate every instance.'
          : tier === 'hard'
            ? 'No on-card target reference and no scan cue: the student holds the letter from the audio alone and explains how they searched the grid.'
            : 'The on-card target reference is shown, but no scan cue — the student organizes their own search.',
      );
      break;
    case 'match-it':
      lines.push(
        tier === 'easy'
          ? 'A shape-strategy cue is shown and only a few options appear so the match is focused.'
          : tier === 'hard'
            ? 'No strategy cue; the student reasons about the letter shape unaided across the full set of options.'
            : 'A light shape cue is shown; the student compares the options themselves.',
      );
      break;
  }
  lines.push('Keep the title and challenge text neutral — never state the support level or name the answer.');
  return { strategyHint, showTargetReference, optionCount, promptLines: lines };
}

// ---------------------------------------------------------------------------
// SECOND AXIS — Structural problem difficulty (config.difficulty, same dial).
//
// Recognition-card lever: DISTRACTOR LETTERFORM SIMILARITY (far → near).
// easy = wrong choices look nothing like the target (low discrimination load);
// hard = wrong choices are near-confusable letterforms (b/d/p/q, m/n/u, …) so
// the student must truly DISCRIMINATE the shape. This changes problem SHAPE,
// never magnitude: the target letter, the letter group, and the correct answer
// are unchanged — only WHICH cumulative-group letters fill the distractor slots
// shifts along the similarity axis. It never turns one eval mode into another.
//
// Floor (per mode): the distractors are always REAL letters from the cumulative
// group and the answer is always present — easy is still a genuine discrimination
// task, just an easy one. find-it always keeps its ≥1 target instances (the mode
// identity). Band cap: distractors are drawn ONLY from the cumulative group, so
// the lever can never inflate scope; when the group offers few near-confusables
// of the target (e.g. Group 1) the hard tier SATURATES at the nearest available.
// ---------------------------------------------------------------------------

/** How structurally confusable distractors should be at this tier. */
type SimilarityTarget = 'far' | 'mixed' | 'near';

/** Confusability clusters — letterforms students routinely mix up. Membership is
 *  by visual shape (case-insensitive on the lowercase letter). A distractor inside
 *  the target's cluster is "near"; one outside is "far". Mirror/rotation pairs
 *  (b/d/p/q) are the densest cluster — the hardest discrimination. */
const CONFUSABLE_CLUSTERS: string[][] = [
  ['b', 'd', 'p', 'q', 'g'], // mirror / rotation family (densest)
  ['m', 'n', 'h', 'r', 'u'], // hump / stem family
  ['i', 'l', 't', 'j', 'f'], // tall-thin / dotted family
  ['c', 'e', 'o', 'a', 's'], // round / open family
  ['v', 'w', 'y', 'x', 'z', 'k'], // angular family
];

/** Map each letter to the set of its cluster-mates (excluding itself). */
const CLUSTER_MATES: Record<string, Set<string>> = (() => {
  const m: Record<string, Set<string>> = {};
  for (const cluster of CONFUSABLE_CLUSTERS) {
    for (const ch of cluster) {
      m[ch] = m[ch] ?? new Set<string>();
      for (const other of cluster) if (other !== ch) m[ch].add(other);
    }
  }
  return m;
})();

/** Similarity distance: 0 = same cluster (near/confusable), 1 = different cluster (far). */
function similarityDistance(target: string, candidate: string): 0 | 1 {
  const t = target.toLowerCase();
  const c = candidate.toLowerCase();
  return CLUSTER_MATES[t]?.has(c) ? 0 : 1;
}

interface LetterSpotterProblemShape {
  similarity: SimilarityTarget;
  promptLines: string[];
}

/** Map a tier to the structural intent (similarity target) for a mode, plus the
 *  prompt lines that DESCRIBE that shape to the LLM. All three modes share the
 *  same recognition lever (distractor similarity), so the table is mode-uniform;
 *  the prompt wording is tailored to each mode's surface (options vs. grid). */
function resolveProblemShape(mode: LetterMode, tier: SupportTier): LetterSpotterProblemShape {
  // Clamp lives in the consumer: distractors are picked ONLY from the cumulative
  // group, so "near" saturates to the nearest-available when no true cluster-mate
  // of the target is in scope. The intent itself is just easy/medium/hard → target.
  const similarity: SimilarityTarget = tier === 'easy' ? 'far' : tier === 'medium' ? 'mixed' : 'near';

  const surface =
    mode === 'find-it'
      ? 'the non-target cells in the grid'
      : 'the wrong-answer option letters';

  const lines: string[] = [TIER_GUARDRAIL];
  switch (similarity) {
    case 'far':
      lines.push(
        `EASY structure: make ${surface} look NOTHING like the target letter — pick distractors `
        + `from a different shape family (no b/d/p/q-style mirrors, no same-hump or same-round confusions). `
        + `Discrimination is easy; the student just has to spot the obvious match.`,
      );
      break;
    case 'mixed':
      lines.push(
        `MEDIUM structure: mix ${surface} — some clearly different, some moderately similar in shape. `
        + `A couple of distractors should share a feature with the target so the student looks twice.`,
      );
      break;
    case 'near':
      lines.push(
        `HARD structure: make ${surface} NEAR-CONFUSABLE with the target — same shape family `
        + `(mirror/rotation like b/d/p/q, same-hump like m/n/u, same-round like c/e/o) wherever the `
        + `cumulative group allows. The student must truly DISCRIMINATE the letterform, not just glance.`,
      );
      break;
  }
  return { similarity, promptLines: lines };
}

/**
 * Constructive distractor selector — the CODE-ENFORCED half of the structural
 * axis. Given the target, the in-scope pool, how many distractors are needed,
 * and the tier's similarity target, deterministically pick distractors that hit
 * the target similarity AS CLOSELY AS THE POOL ALLOWS.
 *
 * - 'near' → prefer cluster-mates (distance 0); saturates to far ones only if
 *   the group has too few mates (HONEST band saturation — never invents letters).
 * - 'far'  → prefer non-mates (distance 1); falls back to mates if forced.
 * - 'mixed'→ aim for a roughly even split of near and far.
 *
 * Never returns the target itself; never exceeds the pool; never duplicates.
 * `rng` is injectable for deterministic stress-testing.
 */
function selectDistractorsBySimilarity(
  target: string,
  pool: string[],
  count: number,
  similarity: SimilarityTarget,
  rng: () => number = Math.random,
): string[] {
  const t = target.toLowerCase();
  const candidates = Array.from(new Set(pool.map(l => l.toLowerCase()))).filter(l => l !== t);
  const near = candidates.filter(c => similarityDistance(t, c) === 0);
  const far = candidates.filter(c => similarityDistance(t, c) === 1);

  const shuffle = (arr: string[]) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const sNear = shuffle(near);
  const sFar = shuffle(far);

  let ordered: string[];
  if (similarity === 'near') {
    ordered = [...sNear, ...sFar]; // mates first; saturate to far if too few mates
  } else if (similarity === 'far') {
    ordered = [...sFar, ...sNear]; // non-mates first; saturate to near if forced
  } else {
    // mixed: interleave near/far so we get an even-ish split
    ordered = [];
    const a = sNear, b = sFar;
    const maxLen = Math.max(a.length, b.length);
    for (let i = 0; i < maxLen; i++) {
      if (i < a.length) ordered.push(a[i]);
      if (i < b.length) ordered.push(b[i]);
    }
  }

  return ordered.slice(0, Math.min(count, candidates.length));
}

/**
 * A 16-cell find-it grid holding EXACTLY ONE instance of the target.
 *
 * The single instance is the mode's identity under the judged loop: the tutor
 * asks once, the child taps once, and the tap's verdict is the advance. Two
 * targets would make one question have two right answers; zero would make it
 * unanswerable. `targetCount` is therefore always 1 and no longer a lever.
 *
 * Distractors come from `ranked` when the tier has an opinion about letterform
 * similarity, else from the model's own non-target cells, else from the pool —
 * always cycling so all fifteen slots fill even when the letter group is small.
 * Nothing outside the cumulative group can enter (the band cap), and the target
 * is never used as a distractor.
 */
function buildSingleTargetGrid(
  targetLetter: string,
  pool: string[],
  existing?: string[],
  ranked?: string[],
): string[] {
  const target = targetLetter.trim().toLowerCase();
  const inPool = (letter: string) => pool.includes(letter) && letter !== target;

  const fromExisting = (existing ?? [])
    .map((l) => l.trim().toLowerCase())
    .filter(inPool);
  const source = (ranked ?? []).filter(inPool);
  const chosen = source.length > 0
    ? source
    : fromExisting.length > 0
      ? fromExisting
      : pool.filter((l) => l !== target);
  // A one-letter group would leave nothing to hide the target among; the letter
  // groups all carry six or more, so this only guards a future edit.
  const bag = chosen.length > 0 ? chosen : [target === 'x' ? 'o' : 'x'];

  const grid: string[] = [target.toUpperCase()];
  for (let i = 0; grid.length < 16; i++) grid.push(bag[i % bag.length].toUpperCase());
  for (let i = grid.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [grid[i], grid[j]] = [grid[j], grid[i]];
  }
  return grid;
}

/**
 * Build the response schema for ONE request, enum-locked to the letters actually
 * in scope for this letter group.
 *
 * Why per-request rather than a module constant: targetLetter, every `options`
 * entry and every `letterGrid` cell is semantically a SINGLE letter drawn from
 * `cumulativeLetters`, which is known before the call. Declared as free
 * `Type.STRING` they were an unbounded generation surface — flash-lite looped
 * inside one option and emitted a ~130KB string that truncated at the token
 * ceiling, so JSON.parse threw `Unterminated string in JSON` and (running under
 * Promise.all in buildCompleteExhibitFromManifest) took the whole exhibit down.
 * An enum makes that runaway UNREPRESENTABLE rather than merely discouraged, and
 * enforces the cumulative-group band cap the post-generation pass had to repair.
 *
 * Fields the code owns are not asked for at all: letterGroup, cumulativeLetters,
 * newLetters and targetCount were each overwritten after generation — pure wasted
 * tokens, and three more arrays to loop inside. `emoji` is code-attached too.
 */
function buildLetterSpotterSchema(cumulativeLetters: string[]): Schema {
  const lower = cumulativeLetters.map(l => l.toLowerCase());
  const upper = lower.map(l => l.toUpperCase());

  return {
    type: Type.OBJECT,
    properties: {
      title: {
        type: Type.STRING,
        maxLength: "60",
        description: "Engaging title for the letter recognition activity (e.g., 'Spot the Letters - Group 1!')",
      },
      challenges: {
        type: Type.ARRAY,
        // Bounded: the top bound is the runaway backstop; the bottom bound keeps a
        // pinned single-mode session a real practice set, not a demo of one item.
        minItems: "6",
        maxItems: "8",
        items: {
          type: Type.OBJECT,
          properties: {
            id: {
              type: Type.STRING,
              maxLength: "8",
              description: "Unique challenge identifier (e.g., 'ch1', 'ch2')",
            },
            mode: {
              type: Type.STRING,
              enum: ["name-it", "find-it", "match-it"],
              description: "Challenge mode: name-it, find-it, or match-it",
            },
            targetLetter: {
              type: Type.STRING,
              enum: lower,
              description: "The letter to identify (lowercase)",
            },
            targetCase: {
              type: Type.STRING,
              enum: ["uppercase", "lowercase", "both"],
              description: "How to display the target letter",
            },
            options: {
              type: Type.ARRAY,
              items: { type: Type.STRING, enum: lower },
              minItems: "3",
              maxItems: "4",
              description: "For name-it / match-it: 4 lowercase letter options, INCLUDING the correct answer (targetLetter)",
            },
            letterGrid: {
              type: Type.ARRAY,
              items: { type: Type.STRING, enum: upper },
              minItems: "16",
              maxItems: "16",
              description: "For find-it: exactly 16 uppercase letters in a 4x4 grid, containing the target EXACTLY ONCE mixed with distractors",
            },
            sentence: {
              type: Type.STRING,
              maxLength: "80",
              description: "For name-it: a short PLAIN sentence containing targetWord spelled out in full (e.g., 'The sun is bright.')",
            },
            targetWord: {
              type: Type.STRING,
              maxLength: "16",
              description: "For name-it: the word whose FIRST letter is targetLetter (e.g., 'sun')",
            },
          },
          required: ["id", "mode", "targetLetter", "targetCase"],
        },
        description: "Array of 6-8 challenges",
      },
    },
    required: ["title", "challenges"],
  };
}

// ============================================================================
// Letter Group Definitions
// ============================================================================

const LETTER_GROUPS: Record<number, string[]> = {
  1: ['s', 'a', 't', 'i', 'p', 'n'],
  2: ['s', 'a', 't', 'i', 'p', 'n', 'c', 'k', 'e', 'h', 'r', 'm', 'd'],
  3: ['s', 'a', 't', 'i', 'p', 'n', 'c', 'k', 'e', 'h', 'r', 'm', 'd', 'g', 'o', 'u', 'l', 'f', 'b'],
  4: ['s', 'a', 't', 'i', 'p', 'n', 'c', 'k', 'e', 'h', 'r', 'm', 'd', 'g', 'o', 'u', 'l', 'f', 'b', 'j', 'z', 'w', 'v', 'y', 'x', 'q'],
};

const NEW_LETTERS: Record<number, string[]> = {
  1: ['s', 'a', 't', 'i', 'p', 'n'],
  2: ['c', 'k', 'e', 'h', 'r', 'm', 'd'],
  3: ['g', 'o', 'u', 'l', 'f', 'b'],
  4: ['j', 'z', 'w', 'v', 'y', 'x', 'q'],
};

/**
 * Generate Letter Spotter data using Gemini AI
 *
 * Creates interactive letter recognition activities with three modes:
 * - Name It: See a letter displayed visually, pick its name from options
 * - Find It: Hear a letter name, find all instances in a 4x4 grid
 * - Match It: See an uppercase letter, match it to the correct lowercase
 *
 * Follows cumulative group progression:
 * - Group 1: s, a, t, i, p, n (6 letters)
 * - Group 2: Group 1 + c, k, e, h, r, m, d (13 letters)
 * - Group 3: Group 2 + g, o, u, l, f, b (19 letters)
 * - Group 4: Group 3 + j, z, w, v, y, x, q (full 26)
 *
 * @param topic - Theme or context for the activity
 * @param gradeLevel - Grade level ('K', '1', or '2')
 * @param config - Optional config with letterGroup override and targetEvalMode
 * @returns LetterSpotterData with challenges across all three modes
 */
type LetterSpotterConfig = Partial<{
  letterGroup: number;
  /** Target eval mode from the IRT calibration system. */
  targetEvalMode: string;
  /** Per-component support tier from the manifest ('easy'|'medium'|'hard'). Second
   *  axis: difficulty = how much scaffolding within the mode. NEVER changes letters. */
  difficulty: string;
}>;

export const generateLetterSpotter = async (
  ctx: GenerationContext,
): Promise<LetterSpotterData> => {
  const { topic } = ctx;
  const intent = ctx.intent;
  const gradeLevel = ctx.gradeContext;
  const config = ctx.raw as LetterSpotterConfig;

  // -------------------------------------------------------------------------
  // Eval mode resolution
  // -------------------------------------------------------------------------
  const evalConstraint = resolveEvalModeConstraint(
    'letter-spotter',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('LetterSpotter', config?.targetEvalMode, evalConstraint);

  // -------------------------------------------------------------------------
  // Letter group setup — resolved BEFORE the schema, which enum-locks every
  // letter field to this group's alphabet.
  // -------------------------------------------------------------------------
  const letterGroup = (config?.letterGroup && config.letterGroup >= 1 && config.letterGroup <= 4)
    ? config.letterGroup
    : 1;

  const cumulativeLetters = LETTER_GROUPS[letterGroup];
  const newLetters = NEW_LETTERS[letterGroup];

  const baseSchema = buildLetterSpotterSchema(cumulativeLetters);
  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(baseSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS, {
        fieldName: 'mode',
      })
    : baseSchema;

  // -------------------------------------------------------------------------
  // Build prompt with eval-mode-scoped challenge type docs
  // -------------------------------------------------------------------------
  const challengeTypeSection = buildChallengeTypePromptSection(
    evalConstraint,
    CHALLENGE_TYPE_DOCS,
  );

  // ── Within-mode support tier (config.difficulty): scaffolding level, NOT letters.
  //    pinnedType drives prompt TONE only when the manifest pinned exactly one mode;
  //    the actual withdrawal is applied per-challenge (from each challenge's OWN mode)
  //    after generation, so blended/auto sessions get difficulty too. ──
  const supportTier = normalizeSupportTier(config?.difficulty);
  const pinnedType: LetterMode | undefined =
    evalConstraint && evalConstraint.allowedTypes.length === 1
      ? (evalConstraint.allowedTypes[0] as LetterMode)
      : undefined;
  const tierScaffold = pinnedType && supportTier
    ? resolveSupportStructure(pinnedType, supportTier)
    : null;
  // Second axis (structural): fold the problem-shape lines (distractor similarity)
  // into the SAME tier block so the LLM sees ONE coherent "what this tier means" —
  // axis 1 = how much help, axis 2 = how confusable the distractors are.
  const tierShape = pinnedType && supportTier
    ? resolveProblemShape(pinnedType, supportTier)
    : null;
  const tierSection = (tierScaffold || tierShape)
    ? `\n## WITHIN-MODE DIFFICULTY TIER (scaffolding + distractor similarity — NOT the letter scope)\n${[
        ...(tierShape?.promptLines ?? []),
        ...(tierScaffold?.promptLines ?? []),
      ].map((l) => `- ${l}`).join('\n')}\n`
    : '';

  const generationPrompt = `Create an interactive letter recognition activity for the topic: "${topic}".
${intent ? `\nSPECIFIC FOCUS: Beyond the topic "${topic}", lean word/letter choices toward "${intent}" when possible — but ALWAYS prioritize the phonics/decoding accuracy rules below over this focus.\n` : ''}
TARGET GRADE LEVEL: ${gradeLevel}
LETTER GROUP: ${letterGroup}
CUMULATIVE LETTERS (all available): ${cumulativeLetters.join(', ')}
NEW LETTERS (just introduced): ${newLetters.join(', ')}

Generate 6-8 challenges. Prioritize new letters but include some review letters too.

${challengeTypeSection}
${tierSection}
MODE-SPECIFIC FIELD RULES:
- name-it (SENTENCE SPOTTER): set sentence, targetWord, and options (4 letters). Do NOT set letterGrid.
  * sentence: a short (4-7 word) PLAIN sentence containing targetWord spelled out in full
  * targetWord: a word whose FIRST letter is the targetLetter (e.g., "sun" for "s")
  * options: 4 lowercase letters including the correct one
  * Example: targetLetter "s", targetWord "sun", sentence "The sun is bright."
  * Do NOT write any emoji — the app hides the letter behind one afterwards.
- find-it: set letterGrid (16 uppercase letters), do NOT set options, sentence, or targetWord
- match-it: set options (4 lowercase letters), do NOT set letterGrid, sentence, or targetWord

SENTENCE QUALITY (name-it) — a live tutor READS these aloud to a five-year-old,
so a sentence that is not English is not a smaller problem here, it is the product:
- Write ordinary, natural English a five-year-old would hear at home or at school.
- targetWord must be a COMMON, CONCRETE word a five-year-old already knows — an
  everyday object, animal, or action. Never a name, never a rare word, and never
  a word used as the wrong part of speech ("I see a pat write a note" is not English).
- Get a/an right: "an ant", "an inky paw print", "a sun", "a top".
- Vary how sentences begin. Do NOT start every sentence with "I see a".
- No sentence may begin with the word "Yes".

RULES:
- Use IDs: ch1, ch2, ch3, etc.
- At least half the challenges should target NEW letters.
- Every letter you emit — target, option, or grid cell — is a SINGLE character from the cumulative list.
- For find-it grids: exactly 16 cells, each a single UPPERCASE letter, containing the
  target EXACTLY ONCE. The child taps the one cell holding it, so a second instance
  would give one question two right answers.
- For name-it and match-it: exactly 4 options, each a single lowercase letter.
- targetCase: use "uppercase" for find-it and match-it (both print capitals as the
  stimulus). name-it is always lowercase and the app sets it.
${!evalConstraint ? '- Order challenges so modes alternate (don\'t cluster all the same mode together).' : ''}

CUMULATIVE LETTERS (the ONLY letters allowed): [${cumulativeLetters.map(l => `"${l}"`).join(', ')}]`;

  try {
    // ── Bounded retry + degrade. Even with the schema locked down, the free-text
    //    fields can run long; a bare JSON.parse threw a raw SyntaxError which,
    //    because generators run under Promise.all in buildCompleteExhibitFromManifest,
    //    failed the WHOLE exhibit rather than one block. Retry once, then degrade
    //    to a skeleton the validation pass below fills in — never throw. ──
    const MAX_ATTEMPTS = 2;
    let result: LetterSpotterData | null = null;

    // `sentence` is the one field that can't be enum-locked, so it stays the
    // residual runaway surface (Gemini treats STRING maxLength as advisory). Vary
    // the retry prompt — re-sending the identical prompt can re-trigger the same
    // loop deterministically.
    const RETRY_NUDGE =
      `\n\nIMPORTANT: keep the output SMALL. Every sentence is at most 8 words and ends `
      + `with a period. Emit exactly 6 challenges. Do not repeat yourself.`;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const response = await ai.models.generateContent({
        model: 'gemini-flash-lite-latest',
        contents: attempt === 1 ? generationPrompt : generationPrompt + RETRY_NUDGE,
        config: {
          responseMimeType: "application/json",
          responseSchema: activeSchema,
          // Hard backstop against a runaway. A full 8-challenge payload lands far
          // below this; the truncated failure was ~33k tokens.
          maxOutputTokens: 8192,
          systemInstruction: `You are an expert K-2 literacy specialist designing letter recognition activities. You create engaging, developmentally appropriate challenges that help young students learn to identify letters by name, find them visually, and match uppercase to lowercase forms. You understand common letter confusions (b/d, p/q, m/n, u/n) and use them as strategic distractors to strengthen discrimination skills. You always use letters only from the specified cumulative group.`,
        },
      });

      const text = response.text;
      if (!text) {
        console.warn(`[LetterSpotter] Empty response on attempt ${attempt}/${MAX_ATTEMPTS}.`);
        continue;
      }
      try {
        result = JSON.parse(text) as LetterSpotterData;
        break;
      } catch (err) {
        console.warn(
          `[LetterSpotter] JSON parse failed on attempt ${attempt}/${MAX_ATTEMPTS} `
          + `(${text.length} chars; finishReason=${response.candidates?.[0]?.finishReason ?? 'unknown'}). `
          + `${err instanceof Error ? err.message : err}`,
        );
      }
    }

    if (!result || typeof result !== 'object') {
      // Degrade, don't throw: emit the challenge SPINE only (id/mode/target) and let
      // the validation pass below build every letter, grid, option and sentence.
      console.warn(`[LetterSpotter] Degrading to a code-built lesson after ${MAX_ATTEMPTS} attempts.`);
      const skeletonMode = (pinnedType ?? 'name-it') as LetterMode;
      result = {
        title: `Spot the Letters — Group ${letterGroup}`,
        challenges: Array.from({ length: 6 }, (_, i) => ({
          id: `ch${i + 1}`,
          mode: skeletonMode,
          targetLetter: newLetters[i % newLetters.length],
          targetCase: 'uppercase' as const,
        })),
      } as unknown as LetterSpotterData;
    }

    // ========================================================================
    // Post-generation validation & defaults
    // ========================================================================

    // Ensure letterGroup is correct
    result.letterGroup = letterGroup as 1 | 2 | 3 | 4;

    // Enforce correct cumulative and new letter sets
    result.cumulativeLetters = cumulativeLetters;
    result.newLetters = newLetters;

    // Validate challenges
    if (result.challenges) {
      result.challenges = result.challenges.map((ch, i) => {
        // IDs are stamped POSITIONALLY, never trusted. The model repeats them:
        // the live probe drew a find-it set with two "ch1"s, which the pack's
        // own validator refuses (duplicate item id) and which would otherwise
        // collide in every per-item outcome lookup. Filling only MISSING ids —
        // what this line used to do — cannot see a duplicate.
        ch.id = `ch${i + 1}`;

        // Ensure targetLetter is lowercase
        ch.targetLetter = (ch.targetLetter || 's').toLowerCase();

        // Ensure targetLetter is within the cumulative group
        if (!cumulativeLetters.includes(ch.targetLetter)) {
          ch.targetLetter = newLetters[i % newLetters.length];
        }

        // name-it: the model emits a PLAIN sentence; CODE owns the marker, the
        // article repair and the splice.
        if (ch.mode === 'name-it') {
          ch.emoji = SENTENCE_EMOJI;
          // The printed sentence is lowercase running text and the tappable
          // options are its letters, so the answer tiles are lowercase too. The
          // click-era render printed every option `.toUpperCase()` regardless of
          // this field while the tutor described a lowercase form — the buttons
          // said "I" and the tutor said "a straight line with a little dot on
          // top". One case, chosen here, ends that.
          ch.targetCase = 'lowercase';

          // The emoji hides the word's FIRST character, so targetWord MUST lead with
          // the target letter. A word that doesn't isn't merely imperfect — it hides
          // the wrong letter while the answer key still says targetLetter, i.e. an
          // unsolvable item. (Live probe caught exactly this: 'fox' offered for 'x'.)
          if (
            !ch.targetWord
            || !isSayableWord(ch.targetWord)
            || ch.targetWord[0]?.toLowerCase() !== ch.targetLetter
          ) {
            const fallbackWords: Record<string, string> = {
              s: 'sun', a: 'ant', t: 'top', i: 'ink', p: 'pan', n: 'net',
              c: 'cat', k: 'kit', e: 'egg', h: 'hat', r: 'run', m: 'map', d: 'dog',
              g: 'gum', o: 'owl', u: 'up', l: 'log', f: 'fan', b: 'bat',
              // 'x-ray' not 'fox': x-initial words are rare, but this mode needs one.
              j: 'jam', z: 'zip', w: 'wet', v: 'van', y: 'yam', x: 'x-ray', q: 'quilt',
            };
            const candidate = fallbackWords[ch.targetLetter];
            // Re-check the table's own entry so a future edit can't reintroduce the leak.
            ch.targetWord = candidate?.[0]?.toLowerCase() === ch.targetLetter
              ? candidate
              : ch.targetLetter + 'at';
          }

          // The SPOKEN form is the tutor's line, so it is repaired before it is
          // ever said and refused outright if it would open a cue sentence with
          // a verdict sentinel. The code-built fallback uses "the" rather than
          // "a", so it is grammatical for every word in the pool by
          // construction — that is where "I see a ant walk away" came from.
          const modelSentence = ch.sentence ? fixArticleAgreement(ch.sentence) : '';
          const usable =
            isSayableSentence(modelSentence)
            && !opensWithSentinel(modelSentence)
            && !opensWithSentinel(ch.targetWord)
            && spliceEmoji(modelSentence, ch.targetWord, ch.emoji) !== null;

          // Rotated by index so two rejected sentences in one lesson do not
          // both degrade to the SAME line (the probe drew exactly that: "I can
          // see the sun." twice in eight items). Every frame uses "the", which
          // is article-safe for every word in the pool by construction.
          const FALLBACK_FRAMES = [
            (w: string) => `I can see the ${w}.`,
            (w: string) => `Look at the ${w}.`,
            (w: string) => `Here is the ${w}.`,
            (w: string) => `We found the ${w}.`,
          ];
          const spokenSentence = usable
            ? modelSentence
            : FALLBACK_FRAMES[i % FALLBACK_FRAMES.length](ch.targetWord);
          // Splice the marker over targetWord's FIRST character only — the rest
          // of the word stays printed, because it is the item's one decodable
          // cue. (The click-era render then blanked the whole word anyway,
          // which is what left the sentence as decoration.)
          const printed = spliceEmoji(spokenSentence, ch.targetWord, ch.emoji);
          ch.spokenSentence = spokenSentence;
          ch.sentence = printed
            ?? spokenSentence.replace(ch.targetWord, `${ch.emoji}${ch.targetWord.slice(1)}`);

          // Clean up fields that shouldn't exist for name-it
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          delete (ch as any).letterGrid;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          delete (ch as any).targetCount;
        }

        // Validate mode-specific fields
        if (ch.mode === 'find-it') {
          // EXACTLY ONE target, always. Under the judged loop one tap is one
          // commit and the tutor's verdict is the advance, so a grid with two
          // targets is a question asked once with two right answers, and a grid
          // with none cannot be answered at all. (Pre-DI this mode was
          // "select all, then press Check" — the Check button is what the
          // modality deletes, and the batch commit went with it.)
          ch.letterGrid = buildSingleTargetGrid(
            ch.targetLetter,
            cumulativeLetters,
            ch.letterGrid,
          );
          ch.targetCount = 1;

          // Clean up fields that shouldn't exist for find-it
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          delete (ch as any).options;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          delete (ch as any).sentence;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          delete (ch as any).emoji;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          delete (ch as any).targetWord;
        } else {
          // name-it or match-it: ensure 4 options including correct answer
          if (!ch.options || ch.options.length < 4) {
            const correct = ch.targetLetter;
            const distractors = cumulativeLetters
              .filter(l => l !== correct)
              .sort(() => Math.random() - 0.5)
              .slice(0, 3);
            ch.options = [correct, ...distractors].sort(() => Math.random() - 0.5);
          } else {
            // Ensure correct answer is in options
            ch.options = ch.options.map(o => o.toLowerCase());
            if (!ch.options.includes(ch.targetLetter)) {
              ch.options[Math.floor(Math.random() * ch.options.length)] = ch.targetLetter;
            }
          }

          // Clean up fields that shouldn't exist for name-it / match-it
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          delete (ch as any).letterGrid;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          delete (ch as any).targetCount;

          // sentence/emoji/targetWord only belong to name-it — remove for match-it
          if (ch.mode === 'match-it') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            delete (ch as any).sentence;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            delete (ch as any).emoji;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            delete (ch as any).targetWord;
          }
        }

        return ch;
      });

      // Fallback: ensure at least one challenge exists
      if (result.challenges.length === 0) {
        const fallbackMode = evalConstraint?.allowedTypes[0] ?? 'name-it';
        const targetLetter = newLetters[0];
        const distractors = cumulativeLetters
          .filter(l => l !== targetLetter)
          .sort(() => Math.random() - 0.5)
          .slice(0, 3);
        result.challenges = [{
          id: 'ch1',
          mode: fallbackMode as 'name-it' | 'find-it' | 'match-it',
          targetLetter,
          targetCase: 'uppercase' as const,
          options: [targetLetter, ...distractors].sort(() => Math.random() - 0.5),
        }];
      }
    }

    // ========================================================================
    // Within-mode support tier — withdraw on-card scaffolding (never the letters).
    // Applied PER CHALLENGE from each challenge's OWN mode, so a blended/auto
    // session gets difficulty too (the tier is a STUDENT property, not single-mode).
    // Gated ONLY on supportTier; runs AFTER all structural fixups so it can only
    // remove help. Code owns the SUPPORT structure; the LLM only chose the letters.
    // ========================================================================
    if (supportTier && result.challenges) {
      for (const ch of result.challenges) {
        const sc = resolveSupportStructure(ch.mode as LetterMode, supportTier);
        // Second axis: structural similarity target for this challenge's OWN mode.
        const shape = resolveProblemShape(ch.mode as LetterMode, supportTier);

        // #2 strategy cue — NO LONGER STAMPED. It was on-card prose at a band
        // that cannot read, so under the judged loop it withdrew nothing from
        // the child who needed it. The lever survives as the SPOKEN DISTAR
        // lead-in (letterSpotterScript: easy = model + guide, medium = model,
        // hard = nothing). `resolveSupportStructure` still resolves it because
        // it is the readable record of what each tier means.
        void sc.strategyHint;

        // #1 perception reference — find-it only (UI contract: other modes ignore it).
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (ch as any).showTargetReference = ch.mode === 'find-it' ? sc.showTargetReference : undefined;

        const correct = ch.targetLetter.toLowerCase();
        const pool = cumulativeLetters.map(l => l.toLowerCase());

        // #5 answer-form (option count, support axis) × distractor similarity
        // (structural axis) — name-it / match-it only. ANSWER-BEARING GUARD: the
        // component checks the picked option against targetLetter, so the correct
        // letter MUST always remain. We keep the correct answer, then build the
        // distractor set deterministically to the tier's similarity target.
        //
        // COUNT → HONOR-IF-VALID → RECONSTRUCT: if the LLM's own distractors
        // already match the target similarity AND hit the option count, keep them
        // (don't churn a coherent question); otherwise reconstruct from the pool.
        if ((ch.mode === 'name-it' || ch.mode === 'match-it') && Array.isArray(ch.options)) {
          const needed = Math.max(1, sc.optionCount - 1); // minus the correct answer
          const llmDistractors = Array.from(
            new Set(ch.options.map(o => o.toLowerCase()).filter(o => o !== correct)),
          ).filter(o => pool.includes(o)); // band cap: in-group only

          // What similarity would we IDEALLY achieve from this pool? (saturation-aware)
          const idealNear = selectDistractorsBySimilarity(correct, pool, needed, 'near');
          const idealNearCount = idealNear.filter(d => similarityDistance(correct, d) === 0).length;

          const countNear = (arr: string[]) =>
            arr.filter(d => similarityDistance(correct, d) === 0).length;

          // The LLM's set is "valid" if it has the right size AND its near-count
          // already matches what the tier would build (so we don't fight a good set).
          const targetNear =
            shape.similarity === 'near'
              ? idealNearCount
              : shape.similarity === 'far'
                ? 0
                : Math.min(idealNearCount, Math.ceil(needed / 2));
          const llmValid =
            llmDistractors.length === needed && countNear(llmDistractors) === targetNear;

          const finalDistractors = llmValid
            ? llmDistractors
            : selectDistractorsBySimilarity(correct, pool, needed, shape.similarity);

          ch.options = [correct, ...finalDistractors].sort(() => Math.random() - 0.5);
        }

        // find-it: re-fill the NON-target cells along the tier's similarity axis.
        // ANSWER-BEARING GUARD: the single target cell survives by construction —
        // buildSingleTargetGrid places it and only the other fifteen shift. This
        // is the structural axis (how confusable the search field is), never the
        // letter scope and never how many targets there are.
        if (ch.mode === 'find-it' && Array.isArray(ch.letterGrid)) {
          const ranked = selectDistractorsBySimilarity(
            correct, pool, pool.length - 1, shape.similarity,
          );
          ch.letterGrid = buildSingleTargetGrid(correct, pool, ch.letterGrid, ranked);
          ch.targetCount = 1;
        }
      }
      console.log(`[letter-spotter] Tier "${supportTier}" applied per-challenge (support + distractor-similarity; ${pinnedType ? 'single-mode ' + pinnedType : 'blended'})`);
    }

    // Surface the tier to the live tutor (reveal policy is mode-aware per challenge).
    if (supportTier) {
      result.supportTier = supportTier;
    }

    console.log('Letter Spotter Generated:', {
      title: result.title,
      letterGroup: result.letterGroup,
      cumulativeLetters: result.cumulativeLetters.join(', '),
      newLetters: result.newLetters.join(', '),
      challengeCount: result.challenges?.length || 0,
      modes: result.challenges?.map(ch => ch.mode) || [],
    });

    return result;

  } catch (error) {
    console.error("Error generating letter spotter:", error);
    throw error;
  }
};
