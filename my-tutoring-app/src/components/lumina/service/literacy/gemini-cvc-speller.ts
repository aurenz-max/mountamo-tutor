import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import { CvcSpellerData } from "../../primitives/visual-primitives/literacy/CvcSpeller";
import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from '../evalMode';
import { buildRemediationPrompt } from '../generation/remediationPrompt';
import {
  cumulativeLetters,
  cvcUsableLetters,
  groupVowels,
  normalizeLetterGroup,
  smallestGroupContaining,
  type LetterGroup,
} from './letterGroups';

// ---------------------------------------------------------------------------
// Challenge type documentation registry
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  'fill-vowel': {
    promptDoc:
      `"fill-vowel": The live tutor SAYS a CVC word; the student sees the consonant frame (e.g., "c_t") and `
      + `SAYS THE MIDDLE SOUND ALOUD. There are no vowel options to pick from — the answer is spoken, and the `
      + `vowel letter only appears in the blank once the tutor has affirmed it. One vowel focus for the set.`,
    schemaDescription: "'fill-vowel' (hear word, say its middle sound aloud in a C_C frame)",
  },
  'spell-word': {
    promptDoc:
      `"spell-word": The live tutor SAYS a CVC word and the student places 3 letters into Elkonin-box slots. `
      + `Letter bank has target letters + distractors. The third letter landing IS the answer (there is no Check `
      + `button); the tutor judges the build and its verdict advances the lesson.`,
    schemaDescription: "'spell-word' (hear word, spell all 3 letters in Elkonin boxes)",
  },
  'word-sort': {
    promptDoc:
      `"word-sort": The live tutor SAYS a CVC word and the student SAYS ITS MIDDLE SOUND ALOUD, exactly as in `
      + `"fill-vowel" — but the word pool MIXES two confusable short vowels, so the answer changes from word to `
      + `word instead of repeating. Affirmed words collect into two on-screen vowel groups; there are no buckets `
      + `to tap. Include words with BOTH vowels or the mode collapses into "fill-vowel".`,
    schemaDescription: "'word-sort' (hear words with two mixed vowels, say each middle sound aloud)",
  },
};

// ---------------------------------------------------------------------------
// Within-mode support tier (config.difficulty) — scaffolding level, NOT numbers
// ---------------------------------------------------------------------------

type SupportTier = 'easy' | 'medium' | 'hard';
const SUPPORT_TIERS: readonly SupportTier[] = ['easy', 'medium', 'hard'];

/** STRICT lookup — the manifest enum-constrains config.difficulty to these.
 *  Unknown/absent → null (no tier applied; grade-band defaults stand). */
function normalizeSupportTier(difficulty?: string): SupportTier | null {
  const d = difficulty?.toLowerCase().trim() ?? '';
  return (SUPPORT_TIERS as readonly string[]).includes(d) ? (d as SupportTier) : null;
}

// ---------------------------------------------------------------------------
// Support-tier scaffold — which on-screen / instructional helps are withdrawn.
// INVARIANT: a tier ONLY removes scaffolding. It never changes the target word,
// the heard audio, the correct vowel, or any answer — only how much the
// workspace helps the student self-check.
//
// Levers (per task type):
//   spell-word  → showPictureCue (emoji + image identify the word, so the
//                 student can self-check what they're spelling) AND
//                 distractorLevel (how cluttered the letter bank is — trims
//                 distractorLetters only, NEVER the 3 target letters).
//   word-sort   → showPictureCue (the emoji reveals the word; withdrawing it
//                 forces a pure listen-and-say).
//   fill-vowel  → no display lever (the consonant frame IS the task, and the
//                 vowel options it used to offer are deleted — they printed the
//                 answer). Its tier rides on the SPOKEN channel instead: at
//                 `easy` the tutor repeats the word with its vowel held
//                 ("caaat") before handing over, at medium/hard it does not.
//                 That lever lives in `cvcSpellerScript.askLine`, driven by the
//                 `supportTier` this generator stamps on the result.
// ---------------------------------------------------------------------------

type CvcTaskType = 'fill-vowel' | 'spell-word' | 'word-sort';
type CvcRemediationMove = 'contrast_vowel' | 'phoneme_slots' | 'minimal_pair_sort';

export function cvcRemediationMoveFor(
  taskType: CvcTaskType,
  remediationFocus?: string,
): CvcRemediationMove | undefined {
  if (!remediationFocus?.trim()) return undefined;
  if (taskType === 'fill-vowel') return 'contrast_vowel';
  if (taskType === 'spell-word') return 'phoneme_slots';
  return 'minimal_pair_sort';
}

interface CvcSupportScaffold {
  /** spell-word / word-sort: show the emoji + image that identifies the word (self-check aid). */
  showPictureCue?: boolean;
  /** spell-word: how many distractor letters clutter the bank (0-1 easy → up to 5 hard). */
  distractorLevel?: 'clean' | 'some' | 'full';
  promptLines: string[];
}

function resolveSupportStructure(
  taskType: CvcTaskType,
  tier: SupportTier,
): CvcSupportScaffold {
  const lead =
    'This tier changes only how much on-screen / spoken help the student gets. It NEVER '
    + 'changes the target word, the audio, the correct letters, or the answer.';
  const neutral =
    'Keep the title and description neutral — never state the support level or reveal the answer.';

  if (taskType === 'spell-word') {
    const showPictureCue = tier !== 'hard';
    const distractorLevel: CvcSupportScaffold['distractorLevel'] =
      tier === 'easy' ? 'clean' : tier === 'medium' ? 'some' : 'full';
    return {
      showPictureCue,
      distractorLevel,
      promptLines: [
        lead,
        `The picture cue (emoji + image of the word) is ${showPictureCue ? 'shown so the student can self-check what they are spelling' : 'withdrawn — the student spells purely from the sounds they hear'}.`,
        `The letter bank is ${distractorLevel === 'clean' ? 'kept clean (few extra letters), so sounding-out is the only step' : distractorLevel === 'some' ? 'lightly populated with a few distractor letters' : 'fully populated with distractor letters, so the student must hold each phoneme while searching'}.`,
        neutral,
      ],
    };
  }

  if (taskType === 'word-sort') {
    const showPictureCue = tier !== 'hard';
    return {
      showPictureCue,
      promptLines: [
        lead,
        `The picture cue (emoji of the word) is ${showPictureCue ? 'shown to anchor the word being asked about' : 'withdrawn — the student answers purely from the vowel sound they hear'}.`,
        neutral,
      ],
    };
  }

  // fill-vowel: the consonant frame IS the task and there is nothing visual to
  // withdraw. The tier rides on the SPOKEN channel — at `easy` the tutor
  // repeats the word with its vowel held before handing over.
  return {
    promptLines: [
      lead,
      'No on-screen scaffolding is withdrawn for this mode (the consonant frame is the task itself); the spoken support is tuned by tier instead — at the easy tier the tutor repeats the word with its middle sound held before asking.',
      neutral,
    ],
  };
}

// ---------------------------------------------------------------------------
// Confusable vowel pairs for fill-vowel and word-sort distractors
// ---------------------------------------------------------------------------

const CONFUSABLE_VOWELS: Record<string, string> = {
  a: 'e',   // short-a ↔ short-e is the classic kindergarten confusion
  e: 'i',   // short-e ↔ short-i
  i: 'e',   // short-i ↔ short-e
  o: 'u',   // short-o ↔ short-u
  u: 'o',   // short-u ↔ short-o
};

const VOWEL_KEYWORDS: Record<string, string> = {
  a: 'apple', e: 'egg', i: 'itch', o: 'octopus', u: 'up',
};

// ---------------------------------------------------------------------------
// Structural difficulty (config.difficulty) — second axis: problem SHAPE, not
// scaffolding. For a phoneme-discrimination card the lever is the SIMILARITY of
// the wrong choices (the recognition-card "distractor similarity" lever): a
// FAR decoy is easy to reject, a NEAR (confusable) decoy is hard. This never
// changes the target word, the vowel focus, the heard audio, or the answer —
// only how confusable the foils are.
//
// TIER_GUARDRAIL — the truthful dual-axis invariant for config.difficulty.
// Axis 1 (support tiers) withdraws on-screen help (picture cue, distractor
// COUNT); axis 2 (this) changes the distractor SIMILARITY. Neither changes the
// target word, the correct letters, or the answer. Harder ≠ longer/bigger words.
// ---------------------------------------------------------------------------

const TIER_GUARDRAIL =
  'Tier changes scaffolding + distractor similarity; never the target word, vowel focus, or answer.';

/** Short-vowel confusability, ranked MOST-confusable → LEAST (near → far). */
const VOWEL_CONFUSION_RANK: Record<string, string[]> = {
  a: ['e', 'o', 'i', 'u'],
  e: ['i', 'a', 'u', 'o'],
  i: ['e', 'u', 'a', 'o'],
  o: ['u', 'a', 'e', 'i'],
  u: ['o', 'i', 'a', 'e'],
};

/** Visually / aurally confusable consonants (plus vowels via CONFUSABLE_VOWELS),
 *  used to pick NEAR-miss distractor letters for spell-word at higher tiers. */
const CONFUSABLE_LETTERS: Record<string, string[]> = {
  b: ['d', 'p', 'q'], d: ['b', 'p', 'q'], p: ['q', 'b', 'd'], q: ['p', 'b', 'd'],
  m: ['n', 'w'], n: ['m', 'r', 'h'], w: ['m', 'v'], v: ['w', 'f'], f: ['v', 't'],
  g: ['j', 'q'], j: ['g'], c: ['k', 's'], k: ['c', 'x'], s: ['c', 'z'], z: ['s', 'x'],
  t: ['f', 'l'], l: ['t'], r: ['n'], h: ['n'], x: ['k', 'z'], y: ['v'],
};

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('');

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Pick from a near→far ranked list by tier: hard = nearest, easy = farthest. */
function pickByTier<T>(rankedNearToFar: T[], tier: SupportTier): T | undefined {
  if (rankedNearToFar.length === 0) return undefined;
  if (tier === 'hard') return rankedNearToFar[0];
  if (tier === 'easy') return rankedNearToFar[rankedNearToFar.length - 1];
  return rankedNearToFar[Math.min(1, rankedNearToFar.length - 1)];
}

/** Choose `cap` distractor letters by similarity to the target letters. NEAR
 *  fills from the visually/aurally confusable pool first; FAR fills from the
 *  rest of the alphabet first; MID interleaves. Never returns a target letter,
 *  so the word stays spellable (answer-safe). */
function selectDistractorLetters(
  targetLetters: string[],
  cap: number,
  similarity: 'far' | 'mid' | 'near',
): string[] {
  const targets = new Set(targetLetters.map((l) => l.toLowerCase()));
  const nearSet = new Set<string>();
  for (const tl of targetLetters.map((l) => l.toLowerCase())) {
    for (const c of CONFUSABLE_LETTERS[tl] ?? []) if (!targets.has(c)) nearSet.add(c);
    const cv = CONFUSABLE_VOWELS[tl];
    if (cv && !targets.has(cv)) nearSet.add(cv);
  }
  const near = shuffleInPlace(Array.from(nearSet));
  const far = shuffleInPlace(ALPHABET.filter((c) => !targets.has(c) && !nearSet.has(c)));
  let ordered: string[];
  if (similarity === 'near') ordered = [...near, ...far];
  else if (similarity === 'far') ordered = [...far, ...near];
  else {
    ordered = [];
    const a = [...near], b = [...far];
    while (a.length || b.length) {
      if (b.length) ordered.push(b.shift()!);
      if (a.length) ordered.push(a.shift()!);
    }
  }
  return ordered.slice(0, Math.max(0, cap));
}

interface CvcProblemShape {
  /** word-sort: the contrast vowel the word pool is mixed against, chosen by
   *  confusability distance. */
  contrastVowel?: string;
  /** spell-word: how similar the distractor letters are to the target letters. */
  letterSimilarity: 'far' | 'mid' | 'near';
  promptLines: string[];
}

/**
 * One in-mode structural lever per task type.
 *
 * ⚠️ `fill-vowel` HAS NO AXIS-2 LEVER ANY MORE, and that is a consequence of
 * the DI port rather than a gap left unfilled. Its lever was the DECOY VOWEL —
 * near at hard, far at easy — and a decoy only exists where the child chooses
 * between printed options. Those options were deleted because one of the two
 * printed the answer, so the answer is now spoken and open-set: there is
 * nothing to make more confusable. This is the same outcome sound-swap
 * recorded when `nameTargetSound` died. `fill-vowel`'s within-mode difficulty
 * is carried entirely by axis 1 (the held-vowel repeat at `easy`) plus the
 * word pool; `word-sort` is the mode where vowel confusability still lives,
 * and there it now governs the POOL rather than a bucket label.
 */
function resolveProblemShape(
  taskType: CvcTaskType,
  tier: SupportTier,
  ctx: { targetVowel: string },
): CvcProblemShape {
  const lead =
    'STRUCTURAL DIFFICULTY (second axis): this changes how CONFUSABLE the material is — '
    + 'NOT the target word, the vowel focus, or the answer.';
  const rank = VOWEL_CONFUSION_RANK[ctx.targetVowel] ?? [];
  const distLabel = tier === 'hard' ? 'a NEAR, highly confusable' : tier === 'easy' ? 'a FAR, easily distinguished' : 'a moderately confusable';

  if (taskType === 'fill-vowel') {
    return {
      letterSimilarity: 'far',
      promptLines: [
        'STRUCTURAL DIFFICULTY: this mode has no second-axis lever — the answer is spoken and open-set, so there are no wrong choices to make more confusable. Keep every word on the focus vowel.',
      ],
    };
  }
  if (taskType === 'word-sort') {
    const contrastVowel = pickByTier(rank, tier);
    return {
      contrastVowel,
      letterSimilarity: 'far',
      promptLines: [
        lead,
        `Mix the word pool against the contrast vowel "${contrastVowel ?? '?'}" — ${distLabel} vowel vs the focus "${ctx.targetVowel}". Include words with BOTH vowels.`,
      ],
    };
  }
  // spell-word
  const letterSimilarity = tier === 'hard' ? 'near' : tier === 'easy' ? 'far' : 'mid';
  return {
    letterSimilarity,
    promptLines: [
      lead,
      `Distractor letters in the bank should be ${letterSimilarity === 'near' ? 'NEAR misses — visually/aurally confusable with the target letters (b/d/p, m/n, the confusable vowel)' : letterSimilarity === 'far' ? 'FAR — clearly different from the target letters' : 'a mix of near and far'} (the exact letters are enforced in code).`,
    ],
  };
}

/**
 * Schema definition for CVC Speller Data
 *
 * Three task modes with progressive difficulty:
 * - fill-vowel: Hear word, pick missing vowel (binary discrimination)
 * - spell-word: Hear word, spell all 3 letters (Elkonin boxes)
 * - word-sort: Hear words, categorize by vowel sound (2 buckets)
 *
 * Audio-first design: all words delivered via AI tutor voice.
 * AI scaffolding provides progressive phoneme segmentation.
 */
const cvcSpellerSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Engaging child-facing title for the CVC spelling activity (e.g., 'Spell Short-A Words!'). Plain playful words a teacher would SAY only — never phoneme slash-notation like /æ/ and never dev codes like 'short-a'."
    },
    vowelFocus: {
      type: Type.STRING,
      enum: ["short-a", "short-e", "short-i", "short-o", "short-u"],
      description: "Which short vowel sound to focus on"
    },
    letterGroup: {
      type: Type.NUMBER,
      description: "Letter group difficulty (1 = easiest consonants, 4 = all letters). Must be 1, 2, 3, or 4."
    },
    availableLetters: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "All single lowercase letters available in the letter bank for this activity"
    },
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "Unique challenge identifier (e.g., 'c1', 'c2')"
          },
          taskType: {
            type: Type.STRING,
            enum: ["fill-vowel", "spell-word", "word-sort"],
            description: "The task type for this challenge"
          },
          remediationMove: {
            type: Type.STRING,
            enum: ["contrast_vowel", "phoneme_slots", "minimal_pair_sort"],
            description: "Private remediation trace; set only when remediation is active."
          },
          targetWord: {
            type: Type.STRING,
            description: "The 3-letter CVC word (e.g., 'cat', 'hen', 'pig')"
          },
          targetLetters: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "The 3 individual letters in order (e.g., ['c', 'a', 't'])"
          },
          targetPhonemes: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "The 3 phonemes in slash notation (e.g., ['/k/', '/æ/', '/t/'])"
          },
          emoji: {
            type: Type.STRING,
            description: "A single emoji representing the word (e.g., '🐱' for cat)"
          },
          imageDescription: {
            type: Type.STRING,
            description: "Brief visual description of the word"
          },
          distractorLetters: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "3-5 extra letters NOT in the target word, used as distractors in the letter bank (spell-word mode)"
          }
          // DELETED WITH THE DI PORT, and asserted dead rather than ignored:
          //  - `vowelOptions` (fill-vowel's two printed vowel choices) — one of
          //    the two WAS the answer, printed and captioned. The answer is now
          //    spoken, so there is nothing to offer.
          //  - `sortBucketLabel` — the sort columns are derived from the word's
          //    own middle letter at affirmation time, so a generator-authored
          //    label could only ever disagree with the word it labels.
          //  - `commonErrors` — the correction wording is hand-authored in
          //    `cvcSpellerScript.ts` (DISTAR discipline); a generated feedback
          //    sentence has no line to be spoken in.
        },
        required: ["id", "taskType", "targetWord", "targetLetters", "targetPhonemes", "emoji", "imageDescription"]
      },
      description: "Array of 4-6 CVC word challenges"
    }
  },
  required: ["title", "vowelFocus", "letterGroup", "availableLetters", "challenges"]
};

// ============================================================================
// Scope: the CUMULATIVE LETTER GROUP is the ceiling; vowel focus is a narrowing
// ============================================================================
//
// ⚠️ THIS REPLACED A PRIVATE, VOWEL-STRIPPED FORK OF THE SHARED PROGRESSION,
// and the fork is what starved the word pool (see `letterGroups.ts` for the
// full diagnosis). The model now is:
//
//   letterGroup (1-4, cumulative, CARRIES ITS OWN VOWELS)  = the scope ceiling
//   vowelFocus  (optional)                                  = a narrowing, and
//                                                             ONLY when the
//                                                             objective names a
//                                                             vowel
//
// The curriculum is what settles this. `LA001-03-B` names all five short vowels
// outright ("Match short vowel sounds (a, e, i, o, u)…"), and "Spell simple CVC
// words" carries no vowel scoping at all — so a DEFAULT single-vowel cap is a
// cap below stated lesson intent, which is a bug rather than a safety margin.
// When nothing names a vowel, the answer space is whatever the group carries,
// and a "which sound is in the middle?" task starts measuring again because the
// answer changes from word to word.

const VOWEL_MAP: Record<string, string> = {
  'short-a': 'a', 'short-e': 'e', 'short-i': 'i', 'short-o': 'o', 'short-u': 'u',
};

/**
 * A vowel focus ONLY when something actually names one — config, then the
 * objective/intent, then the topic. Returns null otherwise.
 *
 * ⚠️ IT USED TO DEFAULT TO 'short-a'. Any topic that did not literally match
 * /short[ -]?[aeiou]/ — "Spell simple CVC words", "Kindergarten phonics",
 * "CVC words" — was silently pinned to short-a, on no evidence, for the whole
 * activity. `intent` is read as well as `topic` because the per-component
 * objective is where a real narrowing ("short o words") actually arrives.
 */
export function resolveCvcVowelFocus(
  topic: string,
  configured?: string,
  intent?: string,
): keyof typeof VOWEL_MAP | null {
  const explicit = configured?.toLowerCase().trim();
  if (explicit && explicit in VOWEL_MAP) return explicit as keyof typeof VOWEL_MAP;
  for (const source of [intent, topic]) {
    const match = source?.toLowerCase().match(/short[\s-]*([aeiou])\b/);
    if (match) return `short-${match[1]}` as keyof typeof VOWEL_MAP;
  }
  return null;
}

/**
 * The letter group in effect. The manifest wins; otherwise the default covers
 * all five short vowels, because that is what the K curriculum's own
 * letter-sound objective names. A named vowel focus can only RAISE the group,
 * never lower it: an objective asking for "short o" against a group that has no
 * `o` is a cap below intent, so the group comes up to meet it.
 */
const DEFAULT_LETTER_GROUP: LetterGroup = 3;

export function resolveCvcLetterGroup(
  configured: unknown,
  vowelFocus: string | null,
): LetterGroup {
  const explicit = normalizeLetterGroup(configured);
  let group = explicit ?? DEFAULT_LETTER_GROUP;
  const vowel = vowelFocus ? VOWEL_MAP[vowelFocus] : null;
  if (vowel) {
    const needed = smallestGroupContaining(vowel);
    if (needed && needed > group) group = needed;
  }
  return group;
}

/** Fewest challenges worth shipping — below this, a repeated rime is the lesser
 *  failure and the offenders are kept with a loud warning instead. */
const MIN_CHALLENGES = 3;

/**
 * Enforce SCOPE and VARIETY in code rather than trusting the prompt. Both rules
 * are in the prompt too, and both are ones the model drifts on — a live probe
 * caught `jam` (j is outside group 3), `fox` (x likewise) and, most tellingly,
 * `pat` sitting next to `sat` in a set the prompt had explicitly told it to
 * vary.
 *
 * The two rules:
 *  1. **Every letter inside the cumulative group.** Otherwise the letter bank
 *     literally cannot spell the word the tutor just said aloud.
 *  2. **No repeated rime, no repeated word.** `sat, pat, mat, map` is one word
 *     family wearing three hats. That set is what started this whole thread,
 *     and it teaches almost nothing about the middle sound.
 *
 * It can only ever REMOVE, so it can never invent a word outside scope. It
 * refuses to shrink a set below `MIN_CHALLENGES`, because a one-item lesson is
 * a worse failure than a repeated rime — and it reports that refusal rather
 * than truncating silently.
 */
export function enforceCvcScopeAndVariety<
  T extends { targetWord: string; targetLetters?: string[] },
>(challenges: T[], groupLetters: string[]): {
  challenges: T[];
  dropped: string[];
  /** True when the rules WOULD have cut below the floor, so nothing was cut. */
  truncated: boolean;
} {
  const allowed = new Set(groupLetters.map((l) => l.toLowerCase()));
  const seenWords = new Set<string>();
  const seenRimes = new Set<string>();
  const kept: T[] = [];
  const dropped: string[] = [];

  for (const ch of challenges) {
    const letters = (ch.targetLetters ?? ch.targetWord?.split('') ?? [])
      .map((l) => (l ?? '').toLowerCase());
    const word = letters.join('');
    const rime = letters.slice(1).join('');
    const outside = letters.filter((l) => !allowed.has(l));
    const reason = letters.length !== 3 ? 'not-3-letters'
      : outside.length ? `out-of-group(${outside.join('')})`
      : seenWords.has(word) ? 'duplicate-word'
      : seenRimes.has(rime) ? `duplicate-rime(-${rime})`
      : null;
    if (reason) { dropped.push(`${ch.targetWord}:${reason}`); continue; }
    seenWords.add(word);
    seenRimes.add(rime);
    kept.push(ch);
  }

  if (!dropped.length) return { challenges, dropped, truncated: false };
  if (kept.length < MIN_CHALLENGES) return { challenges, dropped, truncated: true };
  return { challenges: kept, dropped, truncated: false };
}

/**
 * Generate CVC Speller data using Gemini AI
 *
 * Three task modes with progressive difficulty:
 * - fill-vowel (β 1.5): Hear word, pick missing vowel from 2 confusable options
 * - spell-word (β 2.5): Hear word, spell all 3 letters in Elkonin boxes
 * - word-sort (β 3.5): Hear words, categorize into 2 vowel-sound buckets
 *
 * Audio-first: words are delivered via AI tutor voice, not shown as text.
 * AI scaffolding provides progressive phoneme segmentation at each level.
 */
type CvcSpellerConfig = Partial<CvcSpellerData & {
  targetEvalMode?: string;
  /** Per-component support tier from the manifest ('easy'|'medium'|'hard'). Second axis:
   *  difficulty = how much scaffolding within the mode. NEVER changes numbers/words. */
  difficulty?: string;
}>;

export const generateCvcSpeller = async (
  ctx: GenerationContext,
): Promise<CvcSpellerData> => {
  const { topic } = ctx;
  const intent = ctx.intent;
  const gradeLevel = ctx.gradeContext;
  const config = ctx.raw as CvcSpellerConfig;

  // -------------------------------------------------------------------------
  // Eval mode resolution
  // -------------------------------------------------------------------------
  const evalConstraint = resolveEvalModeConstraint(
    'cvc-speller',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('CvcSpeller', config?.targetEvalMode, evalConstraint);

  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(cvcSpellerSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS, {
        fieldName: 'taskType',
      })
    : cvcSpellerSchema;

  // -------------------------------------------------------------------------
  // Setup
  // -------------------------------------------------------------------------
  const vowelFocus = resolveCvcVowelFocus(topic, config?.vowelFocus, intent);
  const letterGroup = resolveCvcLetterGroup(config?.letterGroup, vowelFocus);
  const groupLetters = cvcUsableLetters(letterGroup);
  const availableVowels = groupVowels(letterGroup);
  // With a focus the answer space is that one vowel (massed practice, and the
  // objective asked for it). Without one it is every vowel the GROUP carries —
  // which is what stops a spoken "which sound?" task from having the same
  // answer four times running.
  const answerVowels = vowelFocus ? [VOWEL_MAP[vowelFocus]] : availableVowels;
  const targetVowel = answerVowels[0] ?? 'a';
  const confusableVowel = CONFUSABLE_VOWELS[targetVowel] || (targetVowel === 'a' ? 'e' : 'a');
  const consonants = groupLetters.filter((l) => !availableVowels.includes(l));

  // -------------------------------------------------------------------------
  // Build prompt
  // -------------------------------------------------------------------------
  const challengeTypeSection = buildChallengeTypePromptSection(
    evalConstraint,
    CHALLENGE_TYPE_DOCS,
  );

  // ── Within-mode support tier (config.difficulty): scaffolding level, NOT word
  //    size. pinnedType (the single pinned mode, if any) drives prompt TONE only;
  //    the withdrawal is applied deterministically per challenge at the end. ──
  const supportTier = normalizeSupportTier(config?.difficulty);
  const pinnedType: CvcTaskType | undefined =
    evalConstraint && evalConstraint.allowedTypes.length === 1
      ? (evalConstraint.allowedTypes[0] as CvcTaskType)
      : undefined;
  const tierScaffold = pinnedType && supportTier
    ? resolveSupportStructure(pinnedType, supportTier)
    : null;
  // Axis 2 (structural): the contrast vowel is tuned by tier (near at hard, far
  // at easy) — but it is now drawn from the vowels the GROUP actually carries.
  // Ranking globally could name a contrast whose letter is not in scope, so a
  // group-1 lesson would be told to contrast against `e` and then forbidden the
  // letter that spells it. Group 1 contrasts a/i, which is exactly what the
  // canonical progression introduces it for.
  const contrastPool = (VOWEL_CONFUSION_RANK[targetVowel] ?? [])
    .filter((v) => availableVowels.includes(v) && v !== targetVowel);
  const structuralContrast = (supportTier
    ? pickByTier(contrastPool, supportTier)
    : contrastPool[0])
    ?? (availableVowels.find((v) => v !== targetVowel) ?? confusableVowel);
  const tierShape = pinnedType && supportTier
    ? resolveProblemShape(pinnedType, supportTier, { targetVowel })
    : null;
  const tierPromptLines: string[] = [
    ...(tierScaffold ? tierScaffold.promptLines : []),
    ...(tierShape ? tierShape.promptLines : []),
  ];
  const tierSection = tierPromptLines.length
    ? `\n## WITHIN-MODE DIFFICULTY (config.difficulty — scaffolding + discrimination shape, NOT word size)\n${tierPromptLines.map((l) => `- ${l}`).join('\n')}\n`
    : '';
  const remediationSection = buildRemediationPrompt(ctx.remediationFocus);

  const generationPrompt = `Create a CVC word spelling activity for the topic: "${topic}".
${intent ? `\nSPECIFIC FOCUS: Beyond the topic "${topic}", lean word/letter choices toward "${intent}" when possible — but ALWAYS prioritize the phonics/decoding accuracy rules below over this focus.\n` : ''}
TARGET GRADE LEVEL: ${gradeLevel}

LETTER SCOPE — cumulative letter group ${letterGroup}. EVERY letter of EVERY word must come from this list, with no exceptions:
${groupLetters.join(', ')}
  available consonants: ${consonants.join(', ')}
  available vowels: ${availableVowels.join(', ')}
${vowelFocus
  ? `VOWEL FOCUS: ${vowelFocus} — the objective names this vowel, so EVERY word uses "${targetVowel}" in the middle.`
  : `VOWEL SPREAD: the objective names no single vowel, so SPREAD the words across the available vowels (${availableVowels.join(', ')}) — do NOT put the same vowel in every word. A set whose middle sound never changes stops testing anything after the second word.`}
CONFUSABLE VOWEL PAIR (for word-sort): "${targetVowel}" vs "${structuralContrast}" (${VOWEL_KEYWORDS[targetVowel]} vs ${VOWEL_KEYWORDS[structuralContrast]})

WORD VARIETY (all modes): no two words may share the same rime (the vowel+ending, e.g. "-at"). "sat, pat, mat" is ONE word family wearing three hats and it teaches almost nothing about the middle sound; "sat, pin, tip, nap" is a real set.

AUDIO-FIRST, TUTOR-DRIVEN DESIGN:
A live Direct Instruction tutor SAYS each word aloud, waits, and judges the answer — students LISTEN, they don't read.
On "fill-vowel" and "word-sort" the student SAYS THE MIDDLE SOUND ALOUD; nothing on screen offers it to them.
On "spell-word" the student places 3 letters in Elkonin boxes and the third letter landing is the answer.
NOTHING you author may name the answer: no option lists, no bucket labels, no feedback sentences.

${challengeTypeSection}
${tierSection}
${remediationSection}
TASK-SPECIFIC FORMATS:

For "fill-vowel" challenges:
- The tutor says the word; the student sees the consonant frame (e.g., "c_t") and SAYS the middle sound
- distractorLetters: not needed (omit or empty)
${ctx.remediationFocus ? '- Set remediationMove to "contrast_vowel" and choose words that isolate the diagnosed vowel confusion.' : ''}
${vowelFocus
  ? `- EVERY word must use vowel "${targetVowel}" — the objective named it, so this mode is massed practice on one sound`
  : `- Spread the middle vowel across ${availableVowels.join(', ')} — no vowel may be the answer in more than half the words`}

For "spell-word" challenges:
- The tutor says the word and the student places all 3 letters in Elkonin boxes
- distractorLetters: 3-5 letters NOT in the target word
${ctx.remediationFocus ? '- Set remediationMove to "phoneme_slots" and choose words that surface the diagnosed confusion.' : ''}

For "word-sort" challenges:
- The tutor says a word and the student SAYS its middle sound — same action as "fill-vowel", different pool
- Include a MIX of both vowels — some words use "${targetVowel}", some use "${structuralContrast}"
- IMPORTANT: word-sort challenges MUST include words with BOTH vowels (not just "${targetVowel}"). Mixing them is
  the ENTIRE difference between this mode and "fill-vowel": if every word carries the same vowel, the answer stops
  changing and the mode collapses into the easier one.
${ctx.remediationFocus ? '- Set remediationMove to "minimal_pair_sort" and choose contrast words that isolate the diagnosed sound distinction.' : ''}

REQUIREMENTS:
- 4-6 challenges total
- ALL words must be real English CVC words (3 letters)
- EVERY letter of every word must come from letter group ${letterGroup}: ${groupLetters.join(', ')} — a word using any other letter is rejected
- targetLetters: exactly 3 letters spelling the word
- targetPhonemes: exactly 3 phonemes in slash notation
- Choose concrete, picturable words appropriate for K-2
- No two words share a rime, and no word appears twice
${!evalConstraint ? '- Mix task types to create variety (e.g., 2 fill-vowel, 2 spell-word, 2 word-sort)' : ''}

PHONEME NOTATION:
- Short vowels: /æ/ (a), /ɛ/ (e), /ɪ/ (i), /ɒ/ (o), /ʌ/ (u)
- Consonants: /b/, /k/ (for c), /d/, /f/, /g/, /h/, /j/, /k/, /l/, /m/, /n/, /p/, /r/, /s/, /t/, /v/, /w/, /y/, /z/`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: generationPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: activeSchema,
        systemInstruction: `You are an expert K-2 reading and spelling specialist. You create engaging, developmentally appropriate CVC word spelling activities that build phonemic awareness and letter-sound correspondence. You understand which CVC words are real, common English words appropriate for young learners. You ensure all phoneme notations are linguistically accurate and that every word strictly follows the CVC pattern with the specified vowel. You choose concrete, picturable words that motivate young spellers. For word-sort challenges, you include words with BOTH the target vowel and the confusable vowel.`,
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No data returned from Gemini API");
    }

    const result = JSON.parse(text) as CvcSpellerData;

    // ========================================================================
    // Post-generation validation & defaults
    // ========================================================================

    // Scope is CODE-owned: the LLM authored words inside a window, and the
    // structure around them is stamped here (LLM emits the window, code builds
    // the structure). `vowelFocus` is deliberately absent when nothing named a
    // vowel — a session with no focus is not "short-a by default", and the
    // component reads its absence as "the group's vowels are all in play".
    if (vowelFocus) result.vowelFocus = vowelFocus as CvcSpellerData['vowelFocus'];
    else delete (result as Partial<CvcSpellerData>).vowelFocus;
    result.letterGroup = letterGroup as CvcSpellerData['letterGroup'];
    result.availableLetters = groupLetters;

    // Child-facing title: strip phoneme slash-notation (/æ/) and dev slugs
    // ('short-a') the model sometimes emits despite the schema description
    // (reader-fit RF-4 — a K draw shipped "Sort the Short Sounds: /æ/ or /ɛ/?").
    if (result.title && (/\/[^/\s]{1,4}\//.test(result.title) || /short-[aeiou]/i.test(result.title))) {
      result.title = vowelFocus
        ? `Short ${VOWEL_MAP[vowelFocus].toUpperCase()} Word Fun!`
        : 'Sounds and Letters!';
    }

    if (result.challenges) {
      result.challenges = result.challenges.map((ch, idx) => {
        ch.id = ch.id || `c${idx + 1}`;
        ch.taskType = ch.taskType || (evalConstraint?.allowedTypes[0] as 'fill-vowel' | 'spell-word' | 'word-sort') || 'spell-word';
        ch.targetLetters = ch.targetLetters || ch.targetWord.split('');
        ch.emoji = ch.emoji || '';
        ch.imageDescription = ch.imageDescription || '';
        ch.distractorLetters = ch.distractorLetters || [];
        const remediationMove = cvcRemediationMoveFor(ch.taskType as CvcTaskType, ctx.remediationFocus);
        if (remediationMove) {
          ch.remediationMove = remediationMove;
        } else {
          delete ch.remediationMove;
        }

        // The vowel-option pair and the sort-bucket label used to be repaired
        // here. Both are gone with the DI port: the answer is spoken, so there
        // is nothing to offer, and the sort column is read off the word's own
        // middle letter at affirmation time so it cannot disagree with it.

        return ch;
      });

      const { challenges: scoped, dropped, truncated } =
        enforceCvcScopeAndVariety(result.challenges, groupLetters);
      result.challenges = scoped;
      if (dropped.length && !truncated) {
        console.log(`[cvc-speller] dropped ${dropped.length} challenge(s): ${dropped.join(', ')}`);
      } else if (dropped.length) {
        console.warn(
          `[cvc-speller] ${dropped.length} challenge(s) violate scope/variety but too few would `
          + `remain; KEEPING ALL. ${dropped.join(', ')}`,
        );
      }
    }

    // ========================================================================
    // Within-mode support tier: withdraw on-screen scaffolding (never the word).
    // Gated ONLY on supportTier — a blended/auto session gets difficulty too,
    // each challenge resolving its scaffold from its OWN taskType. Runs LAST,
    // after all structural fixups, so a tier can only REMOVE help.
    // ========================================================================
    if (supportTier && result.challenges) {
      for (const ch of result.challenges) {
        const sc = resolveSupportStructure(ch.taskType as CvcTaskType, supportTier);

        // Picture cue (spell-word + word-sort): emoji/image self-check aid.
        // fill-vowel renders no picture, so leave it untouched (no-op there).
        if (ch.taskType === 'spell-word' || ch.taskType === 'word-sort') {
          ch.showPictureCue = sc.showPictureCue ?? true;
        }

        // ── Axis 1 (support: distractor COUNT) × Axis 2 (structural: distractor
        //    SIMILARITY) for spell-word. Support tier sets the cap; structural
        //    tier picks WHICH letters fill it. selectDistractorLetters excludes
        //    target letters, so the word stays spellable (answer-safe). ──
        if (ch.taskType === 'spell-word' && sc.distractorLevel) {
          const cap = sc.distractorLevel === 'clean' ? 1 : sc.distractorLevel === 'some' ? 3 : 5;
          const shape = resolveProblemShape('spell-word', supportTier, { targetVowel });
          ch.distractorLetters = selectDistractorLetters(
            ch.targetLetters || ch.targetWord.split(''),
            cap,
            shape.letterSimilarity,
          );
        }

        // fill-vowel's decoy-vowel re-selection and word-sort's bucket-label
        // pinning both lived here and are DELETED — see `resolveProblemShape`
        // for why a spoken, open-set answer has no decoy, and the schema
        // comment for why a generated bucket label could only desync from the
        // word it labels. word-sort keeps its axis-2 lever in the PROMPT (the
        // tier-tuned contrast vowel governs which words are drawn), which is
        // where it was always doing the real work.
      }
      // Tell the live tutor the support level (blended sessions included) so its
      // reveal policy is tier-aware per challenge.
      result.supportTier = supportTier;
      console.log(
        `[cvc-speller] tier "${supportTier}" applied per-challenge — contrast="${structuralContrast}" `
        + `(${pinnedType ? 'single-mode ' + pinnedType : 'blended'}). ${TIER_GUARDRAIL}`,
      );
    }

    console.log('CVC Speller Generated:', {
      title: result.title,
      vowelFocus: result.vowelFocus,
      letterGroup: result.letterGroup,
      challengeCount: result.challenges?.length || 0,
      taskTypes: result.challenges?.map(c => c.taskType) || [],
      words: result.challenges?.map(c => c.targetWord) || [],
    });

    return result;

  } catch (error) {
    console.error("Error generating CVC speller:", error);
    throw error;
  }
};
