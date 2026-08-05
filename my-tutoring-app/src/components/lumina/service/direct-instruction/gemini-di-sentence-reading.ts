/**
 * gemini-di-sentence-reading — menu-scoped generator for the
 * di-sentence-reading primitive. Fork A (pool service): the item CONTENT is a
 * curated SENTENCE menu owned in code — decodable short-vowel sentences built
 * from the di-word-reading vocabulary plus the earliest sight words. Gemini's
 * only job is to SELECT which sentences the objective is about (from the menu)
 * and write a kid title. Word counts, vowel tags, reward emoji, and ASR
 * aliases are attached deterministically — the rhyme-studio K pattern (entropy
 * in the prompt, attachments in code), because flash-lite is unreliable at
 * emitting nested per-item content and structured output is convergent on
 * values.
 *
 * WHY THE SENTENCES ARE CODE-OWNED, not model-written: a decodable sentence is
 * a controlled-vocabulary artifact. A model asked to "write a short sentence
 * for a first grader" produces "The elephant jumped joyfully" — readable text
 * that this pack's learner cannot decode, which would make every miss a
 * content bug rather than a reading signal. The menu is the pedagogy; the
 * model only scopes it.
 *
 * SCOPE (code-enforced, per the census lesson — the prompt asks, the code
 * guarantees):
 * - Phonics pattern: a "short a" objective binds every sentence to /a/
 *   (resolveScopedVowels, mirroring gemini-di-word-reading's family).
 * - Sight words: a sight-word objective draws the sight-heavy sentences.
 * - LENGTH: 3-8 words, hard-capped at MAX_SENTENCE_WORDS. Eight is the BENCHED
 *   ceiling (the sitting laddered 3→8 and found no reliability break, so it is
 *   a proven ceiling, not an observed failure) — longer connected text is
 *   unbenched and must never ship without a new sitting. The ceiling only
 *   NARROWS when the objective or a lower grade asks for it; it never sits
 *   below what the lesson intends. Within the ceiling, a support tier draws
 *   from a word-count BAND (L4 structural difficulty, resolveProblemShape) —
 *   the band narrows the draw toward shorter or longer sentences; it never
 *   widens the ceiling.
 * - Session order ramps SHORT → LONG: the teaching order the bench ran.
 *
 * EVAL MODES (L1, 2026-07-25) — task identities, resolved from intent or pinned
 * by the tester/curator, then built HERE (Fork A: Gemini never emits the
 * challenge type — code stamps it, so there is no schema enum to constrain):
 *   - decodable_sentence    — every content word CVC-decodable: blending
 *                             transferred to connected text. Opens the K band.
 *   - read_sentence         — the base: accuracy over mixed vocabulary.
 *   - sentence_review       — cumulative mix drawn WIDE across the whole menu,
 *                             anchored on the objective's focus.
 *   - sight_phrase_sentence — irregular high-frequency density: whole-word
 *                             recall inside connected text.
 * Every mode is the SAME response class (a printed 3-8 word sentence read
 * aloud) — the class benched in the standing-gate sitting — so the ladder
 * needed no new bench sitting, and every mode reads through the identical
 * bench-proven cue lines. What a mode changes is the POOL, i.e. which reading
 * skill the item exercises. The unconstrained ("mixed", resolution === null)
 * path builds a spread across ALL FOUR modes — never one pool (SP-21 Fork-A
 * discipline).
 */

import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import { resolveEvalModes, type ChallengeTypeDoc } from "../evalMode";
import type {
  DiSentenceReadingData,
  DiSentenceReadingChallenge,
} from "../../primitives/visual-primitives/direct-instruction/DiSentenceReading";
import {
  MAX_SENTENCE_WORDS,
  MIN_SENTENCE_WORDS,
  type DiSentenceReadingChallengeType,
  type DiSentenceReadingSupportTier,
} from "../../primitives/visual-primitives/direct-instruction/diSentenceReadingScript";

// ── Support tier harness (L3) ───────────────────────────────────────

type SupportTier = DiSentenceReadingSupportTier;
const SUPPORT_TIERS: readonly SupportTier[] = ['easy', 'medium', 'hard'];

/** STRICT lookup — the manifest enum-constrains config.difficulty to these.
 *  Unknown/absent → null (no tier applied; the L0 easy shape stands). */
function normalizeSupportTier(difficulty?: string): SupportTier | null {
  const d = difficulty?.toLowerCase().trim() ?? '';
  return (SUPPORT_TIERS as readonly string[]).includes(d) ? (d as SupportTier) : null;
}

/**
 * How much of the DISTAR sequence precedes the child's read.
 *
 * The withdrawal is IDENTICAL across all four eval modes, and that is correct
 * rather than lazy: every mode is the same act (read this printed sentence
 * aloud), so the same three sub-steps precede it. What a MODE changes is which
 * sentences are drawn; what a TIER changes is how much of the sequence is
 * handed over. Kept per-type-capable so a future mode can diverge.
 *
 * This dial changes only what is SPOKEN before the read. Which sentences are
 * drawn is the tier's OTHER dial — resolveProblemShape (L4 structural
 * difficulty) re-ranks the selection toward the tier's word-count band. Two
 * named resolvers on one tier enum, so neither axis hides inside the other:
 * a hard item is both a LONGER sentence and a COLD read.
 */
const resolveSupportStructure = (
  _type: DiSentenceReadingChallengeType,
  tier: SupportTier,
): { tier: SupportTier; describe: string } => ({
  tier,
  describe:
    tier === 'hard'
      ? 'cold read — no model, no choral reading; the child decodes the print unaided'
      : tier === 'medium'
        ? 'modeled once, then read alone — the choral "Together" step is withdrawn'
        : 'modeled and read together first — the full DISTAR sequence',
});

// ── Structural difficulty (L4) ──────────────────────────────────────

/**
 * The tier's SECOND dial (axis 2, /add-structural-difficulty): how much
 * connected text one read coordinates, expressed as a word-count BAND inside
 * the session ceiling. Length is this pack's structural lever — more words
 * mean more chances to drop, swap, or add one, which is the exact error class
 * the judge exists to catch — and it is already measured (`wordCount` per
 * challenge, `meanSentenceWords` per session), so the tier moves a dial the
 * telemetry can see.
 *
 * THE GUARDRAIL (this pack's magnitude analog): the band NEVER exceeds the
 * session ceiling — grade- and objective-narrowed, capped by the BENCHED
 * 8-word limit — and never drops below the 3-word floor. A narrowed ceiling
 * saturates the ladder honestly: at ceiling 5 the hard band is [4,5], the top
 * of what is allowed, never a push past it. Raising the 8-word ceiling is a
 * bench sitting, not a difficulty decision.
 *
 * Identical across all four eval modes (same act — read the printed
 * sentence), per-type-capable so a future mode can diverge. A mode's IDENTITY
 * lives in its POOL (poolForType), which the band never overrides: sight
 * stays sight and decodable stays decodable, whatever the length target — a
 * pool whose long end is short simply saturates below the nominal band.
 *
 * Exported for the structural test suite.
 */
export const resolveProblemShape = (
  _type: DiSentenceReadingChallengeType,
  tier: SupportTier,
  ceiling: number,
): { band: readonly [number, number]; promptLine: string } => {
  const lo = MIN_SENTENCE_WORDS;
  const hi = Math.max(lo, Math.min(ceiling, MAX_SENTENCE_WORDS));
  const band: readonly [number, number] =
    tier === 'easy'
      ? [lo, Math.min(lo + 1, hi)]
      : tier === 'hard'
        ? [Math.max(lo, hi - 1), hi]
        : (() => {
            const mid = Math.max(lo, Math.min(Math.floor((lo + hi) / 2), hi - 1));
            return [mid, Math.min(mid + 1, hi)] as const;
          })();
  return {
    band,
    promptLine:
      `- DIFFICULTY TIER (${tier}): prefer sentences of ${band[0]}-${band[1]} words when the topic allows. ` +
      `The application re-ranks every pick toward that band, so choosing inside it keeps your topical steering.`,
  };
};

type ShortVowel = 'a' | 'e' | 'i' | 'o' | 'u';

/** One curated menu entry: everything the tutor and the reward need. */
interface MenuEntry {
  /** The printed sentence WITH its terminal punctuation — read exactly. */
  text: string;
  /** Short vowels the decodable content words drill (the scoping key). */
  vowels: ShortVowel[];
  /** Sentences carrying a high proportion of IRREGULAR high-frequency words —
   *  the `sight_phrase_sentence` pool. These cannot be sounded out, so they
   *  exercise whole-word recall rather than blending. */
  sightHeavy?: boolean;
  /** Every CONTENT word is short-vowel CVC decodable — the
   *  `decodable_sentence` pool. Function words from the earliest taught set
   *  (the, a, I, is, in, on, can, has, had, and, to, up) are permitted and
   *  expected: that is exactly how a decodable reader is built, and no English
   *  sentence exists without them. What disqualifies an entry is a CONTENT word
   *  that cannot be blended — "see", "ball", "look", "go". Tagged explicitly
   *  rather than inferred, because it is a pedagogical judgement per sentence. */
  decodable?: boolean;
  /** Proven in the standing-gate-1 bench sitting (2026-07-25). These ten were
   *  judged live — including the two deliberate one-word omissions the pack's
   *  viability rests on — so they lead every fallback ladder. */
  benched?: boolean;
  /** POST-affirmation reward picture only (answer-leak rule: the answer IS the
   *  printed sentence, so nothing pictures it before the read). */
  emoji?: string;
  /** Passive whole-utterance ASR cross-check aliases (near-neighbour reads). */
  extraAliases?: string[];
}

/** Normalized whole-utterance form for the passive ASR cross-check. */
const spokenForm = (text: string) =>
  text.toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();

/**
 * The curated sentence menu. Every content word is short-vowel decodable with
 * single-letter graphemes, or one of the earliest high-frequency sight words
 * (the, a, I, is, in, on, to, see, go, can, we, and, has, had, my, up, down,
 * get, look, at). Vocabulary is deliberately carried from the di-word-reading
 * menu so a miss is attributable to CONNECTED TEXT rather than to a new word —
 * the same control the bench probe used.
 *
 * The ten `benched: true` entries are the exact sentences from the sitting.
 *
 * L4 additions (2026-08-03): seven 7-8 word entries — one per pure short
 * vowel plus two sight-heavy — so the hard tier's [7,8] band has pool support
 * in every eval mode. Before them the menu held only three entries above six
 * words and the hard tier would have saturated at 6 for most scopes. Every
 * added word already appears elsewhere in this menu (the attribution control:
 * a miss traces to CONNECTED TEXT, never to a new word), every entry is
 * inside the benched 3-8 class, and each was checked sentinel-safe like the
 * rest (isSentinelSafe rejects at module load regardless).
 */
const SENTENCE_MENU: Record<string, MenuEntry> = {
  // ── benched ten (proven live 2026-07-25) ─────────────────────────
  'cat-sat': { text: 'The cat sat.', vowels: ['a'], benched: true, decodable: true, emoji: '🐱' },
  'see-pig': { text: 'I see a pig.', vowels: ['i'], benched: true, emoji: '🐷', extraAliases: ['i sea a pig'] },
  'red-cup': { text: 'Sam has a red cup.', vowels: ['a', 'e', 'u'], benched: true, decodable: true, emoji: '🥤' },
  'sat-mat': { text: 'Sam sat on the mat.', vowels: ['a'], benched: true, decodable: true, extraAliases: ['sam sat on the matt'] },
  'dog-sun': { text: 'The dog is in the sun.', vowels: ['o', 'u'], benched: true, decodable: true, emoji: '🐶', extraAliases: ['the dog is in the son'] },
  'big-pig': { text: 'I can see the big pig.', vowels: ['i'], benched: true, emoji: '🐷' },
  'hen-pen': { text: 'The red hen ran to the pen.', vowels: ['e', 'a'], benched: true, decodable: true, emoji: '🐔' },
  'get-ball': { text: 'Can the dog get the ball?', vowels: ['o', 'e'], benched: true, emoji: '⚽' },
  'up-down': { text: 'We go up and we go down.', vowels: ['u'], benched: true, sightHeavy: true },
  'red-hat': { text: 'The big pig had a red hat on.', vowels: ['i', 'a', 'e'], benched: true, decodable: true, emoji: '🎩' },

  // ── short a ──────────────────────────────────────────────────────
  'sam-hat': { text: 'Sam has a hat.', vowels: ['a'], decodable: true, emoji: '🎩' },
  'cat-mat': { text: 'The cat sat on a mat.', vowels: ['a'], decodable: true, emoji: '🐱' },
  'rat-ran': { text: 'The rat ran.', vowels: ['a'], decodable: true, emoji: '🐀' },
  'pat-cat': { text: 'Sam can pat the cat.', vowels: ['a'], decodable: true, emoji: '🐱' },
  'man-map': { text: 'The man had a map.', vowels: ['a'], decodable: true, emoji: '🗺️' },
  'cat-nap': { text: 'Can the cat nap?', vowels: ['a'], decodable: true, emoji: '😴' },
  'sam-cat-mat': { text: 'Sam and the cat sat on the mat.', vowels: ['a'], decodable: true, emoji: '🐱' },

  // ── short e ──────────────────────────────────────────────────────
  'red-hen': { text: 'The red hen ran.', vowels: ['e', 'a'], decodable: true, emoji: '🐔' },
  'ben-pen': { text: 'Ben has a red pen.', vowels: ['e'], decodable: true, emoji: '🖊️' },
  'hen-in-pen': { text: 'The hen is in the pen.', vowels: ['e'], decodable: true, emoji: '🐔' },
  'ten-men': { text: 'Ten men sat on the bed.', vowels: ['e', 'a'], decodable: true, emoji: '🛏️' },
  'get-net': { text: 'Get the net.', vowels: ['e'], decodable: true, emoji: '🥅' },
  'ten-red-bed': { text: 'Ten men get in the red bed.', vowels: ['e'], decodable: true, emoji: '🛏️' },

  // ── short i ──────────────────────────────────────────────────────
  'pig-dig': { text: 'The pig can dig.', vowels: ['i'], decodable: true, emoji: '🐷' },
  'sit-big': { text: 'Sit on the big rug.', vowels: ['i', 'u'], decodable: true },
  'dig-pit': { text: 'Did the pig dig a pit?', vowels: ['i'], decodable: true, emoji: '🐷' },
  'pin-big': { text: 'The pin is big.', vowels: ['i'], decodable: true, emoji: '📌' },
  'big-pig-pit': { text: 'The big pig can sit in the pit.', vowels: ['i'], decodable: true, emoji: '🐷' },

  // ── short o ──────────────────────────────────────────────────────
  'dog-hot': { text: 'The dog is hot.', vowels: ['o'], decodable: true, emoji: '🐶' },
  'dog-log': { text: 'The dog sat on a log.', vowels: ['o'], decodable: true, emoji: '🪵' },
  'mom-pot': { text: 'Mom got a pot.', vowels: ['o'], decodable: true, emoji: '🍲' },
  'dog-hop': { text: 'The dog can hop.', vowels: ['o'], decodable: true, emoji: '🐶' },
  'hot-dog-log': { text: 'The hot dog can hop on the log.', vowels: ['o'], decodable: true, emoji: '🪵' },

  // ── short u ──────────────────────────────────────────────────────
  'sun-up': { text: 'The sun is up.', vowels: ['u'], decodable: true, emoji: '☀️' },
  'bug-cup': { text: 'A bug is in the cup.', vowels: ['u'], decodable: true, emoji: '🐛' },
  'pup-run': { text: 'The pup can run.', vowels: ['u'], decodable: true, emoji: '🐕' },
  'gus-cup': { text: 'Gus has a red cup.', vowels: ['u', 'e'], decodable: true, emoji: '🥤' },
  'pup-sun-run': { text: 'The pup can run in the sun.', vowels: ['u'], decodable: true, emoji: '🐕' },

  // ── sight-word heavy: IRREGULAR high-frequency density ────────────
  // The `sight_phrase_sentence` pool. Each carries 2+ words that cannot be
  // sounded out (see, go, you, look, my, like, to, here, me), so the sentence
  // exercises whole-word recall rather than blending. None is `decodable`.
  'see-it': { text: 'I can see it.', vowels: ['i'], sightHeavy: true },
  'we-go': { text: 'We can go up.', vowels: ['u'], sightHeavy: true },
  'look-dog': { text: 'Look at the big dog.', vowels: ['i', 'o'], sightHeavy: true, emoji: '🐶' },
  'you-and-i': { text: 'You and I can go.', vowels: [], sightHeavy: true },
  'my-ball': { text: 'My ball is red.', vowels: ['e'], sightHeavy: true, emoji: '⚽' },
  'look-at-me': { text: 'Look at me!', vowels: [], sightHeavy: true },
  'you-see': { text: 'You can see my dog.', vowels: ['o'], sightHeavy: true, emoji: '🐶' },
  'we-like': { text: 'We like to go up.', vowels: ['u'], sightHeavy: true },
  'go-see': { text: 'We go to see the pig.', vowels: ['i'], sightHeavy: true, emoji: '🐷' },
  'here-it-is': { text: 'Here it is.', vowels: ['i'], sightHeavy: true },
  'you-up-down': { text: 'You and I can go up and down.', vowels: [], sightHeavy: true },
  'like-look-dog': { text: 'We like to look at my big dog.', vowels: ['i', 'o'], sightHeavy: true, emoji: '🐶' },
};

/** Words a reader actually produces — the pack's difficulty axis. */
const countWords = (text: string) =>
  text.trim().split(/\s+/).filter(Boolean).length;

/** Distance from a word count to the tier band — 0 inside it (L4 rank key). */
const bandDistance = (words: number, [lo, hi]: readonly [number, number]): number =>
  words < lo ? lo - words : words > hi ? words - hi : 0;

/**
 * Stable re-rank toward a tier band: in-band entries first, then nearest, the
 * incoming order breaking ties. This is L4's ENFORCEMENT half — the prompt's
 * tier line merely describes the band; selection order is what actually
 * decides, and it is code-owned. Stability is load-bearing: inside equal band
 * distance the existing preference order (topical picks first, benched lead,
 * review shuffle) survives untouched.
 */
const rankByBand = (ids: string[], band: readonly [number, number]): string[] =>
  ids
    .map((id, i) => ({ id, i, d: bandDistance(countWords(SENTENCE_MENU[id].text), band) }))
    .sort((a, b) => a.d - b.d || a.i - b.i)
    .map((x) => x.id);

/**
 * STANDING GATE 2 (sentinel collision), enforced in code rather than trusted.
 * Every spoken line interpolates the sentence: the model line ("Listen: X"),
 * the guide ("Together: X"), the affirm ("Yes, that says X") and the correction
 * ("My turn: X Your turn. Read it again."). The engine splits tutor output on
 * [.!?] and classifies each sentence by its OPENER, so a menu sentence that
 * itself begins with "Yes" — or that contains "my turn" — could manufacture a
 * phantom verdict inside an otherwise innocent line. Such an entry can never
 * ship, so it is rejected here at the source instead of being caught live.
 */
const isSentinelSafe = (text: string): boolean => {
  const lower = text.toLowerCase().trim();
  if (/^yes\b/.test(lower)) return false;
  if (/\bmy turn\b/.test(lower)) return false;
  return true;
};

/** The menu, validated once at module load: in-scope length + sentinel-safe. */
const MENU_IDS = Object.keys(SENTENCE_MENU).filter((id) => {
  const entry = SENTENCE_MENU[id];
  const words = countWords(entry.text);
  const ok =
    words >= MIN_SENTENCE_WORDS &&
    words <= MAX_SENTENCE_WORDS &&
    isSentinelSafe(entry.text);
  if (!ok) {
    console.error(
      `di-sentence-reading: menu entry "${id}" rejected (${words} words, sentinel-safe=${isSentinelSafe(entry.text)}) — it will never be served.`,
    );
  }
  return ok;
});

const BENCHED_IDS = MENU_IDS.filter((id) => SENTENCE_MENU[id].benched);
const SIGHT_IDS = MENU_IDS.filter((id) => SENTENCE_MENU[id].sightHeavy);
const DECODABLE_IDS = MENU_IDS.filter((id) => SENTENCE_MENU[id].decodable);

/** Every identity this pack can build, easiest → hardest (the mixed spread). */
const ALL_TYPES: DiSentenceReadingChallengeType[] = [
  'decodable_sentence', 'read_sentence', 'sentence_review', 'sight_phrase_sentence',
];

// Misconception remediation: deterministic sentence-menu emphasis.
export type DiSentenceReadingRemediationMove =
  | 'drops_function_word'
  | 'near_neighbor_word'
  | 'word_order_or_addition';

export const resolveDiRemediationMove = (
  _challengeType: DiSentenceReadingChallengeType,
  remediationFocus?: string,
): DiSentenceReadingRemediationMove | null => {
  const focus = remediationFocus?.trim().toLowerCase();
  if (!focus || !/\bsentence(?:s)?\b/.test(focus)) return null;
  if (/\b(?:drop(?:s|ped|ping)?|skip(?:s|ped|ping)?|omit(?:s|ted|ting)?)\b/.test(focus)
    && (/\bfunction[ -]?word\b/.test(focus) || /\b(?:the|a|is|in|on|and|to)\b/.test(focus))) {
    return 'drops_function_word';
  }
  if (/\bnear[ -]?neighbou?r\b|\bclose[ -]?sound(?:ing)?\b|\b(?:vowel|consonant)\s+substitut(?:e[sd]?|ion)\b/.test(focus)) {
    return 'near_neighbor_word';
  }
  if (/\b(?:swap(?:s|ped|ping)?|reorder(?:s|ed|ing)?|word order|adds? (?:a )?word|extra word)\b/.test(focus)) {
    return 'word_order_or_addition';
  }
  return null;
};

const FUNCTION_WORDS = ['the', 'a', 'is', 'in', 'on', 'and', 'to', 'can', 'has', 'had', 'up'];
const CVC_CONTRASTS = [
  ['cat', 'mat'], ['hen', 'pen'], ['pig', 'dig'], ['dog', 'log'], ['sun', 'run'],
] as const;

const sentenceTokens = (id: string): string[] =>
  spokenForm(SENTENCE_MENU[id].text).split(' ').filter(Boolean);

const diagnosedFunctionWord = (focus: string): string | null => {
  const normalized = focus.toLowerCase();
  const quoted = /["'](the|a|is|in|on|and|to|can|has|had|up)["']/.exec(normalized)?.[1];
  return quoted ?? FUNCTION_WORDS.find((word) =>
    new RegExp(`\\b${word}\\b`).test(normalized)) ?? null;
};

const isSentenceRemediationTarget = (
  id: string,
  move: DiSentenceReadingRemediationMove,
  focus: string,
): boolean => {
  const tokens = sentenceTokens(id);
  if (move === 'drops_function_word') {
    const named = diagnosedFunctionWord(focus);
    return named
      ? tokens.slice(0, -1).includes(named)
      : tokens.slice(0, -1).some((token) => FUNCTION_WORDS.includes(token));
  }
  if (move === 'near_neighbor_word') {
    const allTargets = CVC_CONTRASTS.flat();
    const namedTargets = allTargets.filter((word) =>
      new RegExp(`\\b${word}\\b`).test(focus.toLowerCase()));
    const targets: readonly string[] = namedTargets.length > 0 ? namedTargets : allTargets;
    return tokens.some((token) => targets.includes(token));
  }
  const counts = new Map<string, number>();
  for (const token of tokens) {
    if (FUNCTION_WORDS.includes(token)) counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  const noAdjacentRepeat = tokens.every((token, index) => index === 0 || token !== tokens[index - 1]);
  return noAdjacentRepeat && Array.from(counts.values()).some((count) => count >= 2);
};

const rankSentencesForRemediation = (
  ids: string[],
  move: DiSentenceReadingRemediationMove,
  focus: string,
  requested: number,
): string[] => {
  const targets = ids.filter((id) => isSentenceRemediationTarget(id, move, focus)).slice(0, requested);
  const targetSet = new Set(targets);
  return [...targets, ...ids.filter((id) => !targetSet.has(id))];
};

const ensureRemediationTargets = (
  selected: string[],
  candidates: string[],
  move: DiSentenceReadingRemediationMove,
  focus: string,
  requested: number,
  protectedAnchors: string[],
): string[] => {
  const desired = candidates
    .filter((id) => isSentenceRemediationTarget(id, move, focus))
    .slice(0, requested);
  const next = [...selected];
  for (const target of desired) {
    if (next.includes(target)) continue;
    let replacement = -1;
    for (let index = next.length - 1; index >= 0; index--) {
      if (!protectedAnchors.includes(next[index])
        && !isSentenceRemediationTarget(next[index], move, focus)) {
        replacement = index;
        break;
      }
    }
    if (replacement < 0) break;
    next[replacement] = target;
  }
  return Array.from(new Set(next))
    .sort((left, right) => countWords(SENTENCE_MENU[left].text) - countWords(SENTENCE_MENU[right].text));
};

/** Fisher-Yates. App code, not a workflow script — Math.random is fine. */
const shuffle = <T,>(items: T[]): T[] => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

/** Split `count` across `k` skills as evenly as possible, each skill ≥1. */
const distribute = (count: number, k: number): number[] => {
  const base = Math.floor(count / k);
  const rem = count % k;
  return Array.from({ length: k }, (_, i) => base + (i < rem ? 1 : 0));
};

/**
 * Sentences matching a phonics scope. `pure` means every decodable content
 * word sits in the scoped vowel — the hard reading of "this lesson is about
 * short a", and the same rule gemini-di-word-reading enforces on single words.
 * Overlap (merely CONTAINING the vowel) is the fallback, because connected
 * text cannot always be monovocalic: a sentence needs function words, and
 * "Sam has a red cup." drills /e/ and /u/ alongside /a/. Preferring pure and
 * widening only when the pure pool cannot fill the session keeps the objective
 * honoured wherever the menu can honour it.
 */
const idsForVowels = (vowels: ShortVowel[] | null, pure = false): string[] =>
  MENU_IDS.filter((id) => {
    if (!vowels) return true;
    const entryVowels = SENTENCE_MENU[id].vowels;
    if (entryVowels.length === 0) return false;
    return pure
      ? entryVowels.every((v) => vowels.includes(v))
      : entryVowels.some((v) => vowels.includes(v));
  });

const DEFAULT_INSTANCE_COUNT = 4;
const MAX_INSTANCE_COUNT = 6;

/** Skill docs for the intent→mode router (Fork A — no schema to constrain). */
const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  decodable_sentence: {
    promptDoc:
      `"decodable_sentence": the child reads a printed short sentence in which EVERY content word is a sound-it-out CVC word ("The pig can dig."). The skill is blending carried from single words into connected text — phonics transfer, not sight recall.`,
    schemaDescription: "'decodable_sentence' (read a fully sound-it-out sentence)",
  },
  read_sentence: {
    promptDoc:
      `"read_sentence": the child sees ONE printed short sentence (3-8 words) and reads it aloud, every word in order. The tutor judges reading ACCURACY from the audio. The base connected-text skill, one rung above single-word reading.`,
    schemaDescription: "'read_sentence' (read the printed sentence aloud)",
  },
  sentence_review: {
    promptDoc:
      `"sentence_review": cumulative / spaced review — the child re-reads sentences of the kind already taught, drawn as a WIDE mix across every vowel pattern and word type rather than one focused set. The skill is retention and flexible retrieval, not first-time decoding.`,
    schemaDescription: "'sentence_review' (mixed cumulative review)",
  },
  sight_phrase_sentence: {
    promptDoc:
      `"sight_phrase_sentence": the child reads a printed short sentence carrying several IRREGULAR high-frequency words ("You can see my dog.") — words that cannot be sounded out and must be recognised whole. The skill is instant sight-word recall inside connected text.`,
    schemaDescription: "'sight_phrase_sentence' (read a sight-word-dense sentence)",
  },
};

/**
 * The pool ONE skill draws from, given the objective's resolved scope.
 *
 * `sentence_review` is the deliberate departure: its POOL is the WHOLE menu,
 * not the narrow focus, because a review that re-drills only the freshly-taught
 * set is not a review. Its thread back to the lesson comes from `seedForType`,
 * which anchors up to 2 items from the focused pool — the fix di-math-facts
 * needed live, where a doubles objective's review drew zero doubles.
 *
 * `sight_phrase_sentence` deliberately IGNORES the vowel scope: its scope IS
 * the irregular-word set, and intersecting that with "short a" would empty it.
 * Both departures mirror di-math-facts' `fact_review` handling.
 */
const poolForType = (
  type: DiSentenceReadingChallengeType,
  focusPool: string[],
  inCeiling: (id: string) => boolean,
  count: number,
): string[] => {
  switch (type) {
    case 'decodable_sentence': {
      // The focused pool, narrowed to fully sound-it-out sentences. If the
      // objective's vowel scope leaves too few, widen within decodable only —
      // never into sight-heavy text, which would defeat the mode's identity.
      const scoped = focusPool.filter((id) => SENTENCE_MENU[id].decodable);
      if (scoped.length >= count) return scoped;
      return [...scoped, ...DECODABLE_IDS.filter(inCeiling).filter((id) => !scoped.includes(id))];
    }
    case 'sight_phrase_sentence':
      return SIGHT_IDS.filter(inCeiling);
    case 'sentence_review':
      return MENU_IDS.filter(inCeiling);
    case 'read_sentence':
    default:
      return focusPool;
  }
};

/**
 * The items that ALWAYS ship for a skill, ahead of its pool. Only
 * `sentence_review` has any: it broadens across the whole menu, so without an
 * anchor a review of a short-a lesson can contain no short-a sentence at all
 * and has lost its thread to what was just taught. Up to 2 focused items keep
 * it. Every other mode's pool is already scoped, so none needs a seed.
 *
 * Under an L4 band the anchors are drawn nearest-band-first from the focus
 * pool (still shuffled inside equal distance), so a hard review anchors on the
 * LONG focus sentences where the focus pool has any — the anchor rule and the
 * band compose instead of fighting.
 */
const seedForType = (
  type: DiSentenceReadingChallengeType,
  focusPool: string[],
  band?: readonly [number, number],
): string[] => {
  if (type !== 'sentence_review') return [];
  const anchors = shuffle(focusPool);
  return (band ? rankByBand(anchors, band) : anchors).slice(0, 2);
};

/** Gemini emits ONLY the wrapper — never the sentences themselves (Fork A). */
const wrapperSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description:
        "Short, warm activity title for a beginning reader (e.g. 'Reading Time!'). Do NOT put any of the target sentences or their words in it.",
    },
    description: {
      type: Type.STRING,
      description:
        "One friendly sentence telling the child they will read some sentences out loud. Do NOT quote or paraphrase any target sentence.",
    },
    targetSentences: {
      type: Type.ARRAY,
      items: { type: Type.STRING, enum: MENU_IDS },
      description:
        "The 4-5 sentence IDs (from the allowed list only) this objective is about, ordered SHORTEST to LONGEST. " +
        "A phonics pattern (like short a) means sentences built on that vowel; a sight-word objective means the " +
        "sight-heavy sentences; a generic objective means an easy spread across different vowels and lengths.",
    },
  },
  required: ["title", "targetSentences"],
};

/**
 * Short vowel(s) the objective names, or null if it is vowel-generic.
 * Mirrors gemini-di-word-reading's resolveScopedVowels: a "short a" lesson
 * binds every sentence to /a/. Code-enforced after selection (the LLM window
 * is advisory; code builds the structure).
 */
const resolveScopedVowels = (text: string): ShortVowel[] | null => {
  const found = new Set<ShortVowel>();
  const re = /short[\s-]*['’]?\s*([aeiou])\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text.toLowerCase())) !== null) found.add(m[1] as ShortVowel);
  return found.size > 0 ? Array.from(found) : null;
};

/** Does the objective ask for sight / high-frequency words? */
const resolveSightScope = (text: string): boolean =>
  /sight[\s-]*words?|high[\s-]*frequency/i.test(text);

/**
 * The word ceiling for this session. Starts at the BENCHED maximum and only
 * narrows — a cap below what the lesson intends is a bug, so nothing here may
 * raise it and nothing may drop it below the 3-word floor. Grade acts as a
 * ceiling (scope-context contract), and an explicit "short/simple sentence"
 * ask narrows further.
 */
const resolveWordCeiling = (gradeLevel: string, scopeText: string): number => {
  let ceiling = MAX_SENTENCE_WORDS;
  const grade = `${gradeLevel}`.toLowerCase();
  // The pack is curriculum-scoped to G1-2. A kindergarten reader reaching it
  // through a topic-driven lesson gets the short end of the same ladder.
  if (/kinder|^k$|\bk\b|pre-?k/.test(grade)) ceiling = Math.min(ceiling, 6);
  if (/short sentence|simple sentence|shorter sentence/i.test(scopeText)) {
    ceiling = Math.min(ceiling, 5);
  }
  return Math.max(MIN_SENTENCE_WORDS, ceiling);
};

/** Scan free text for menu sentences named verbatim (rare, but an objective
 *  that quotes a sentence should get exactly that sentence). */
const scanIdsFromText = (text: string): string[] => {
  const normalized = spokenForm(text);
  if (!normalized) return [];
  return MENU_IDS.filter((id) => normalized.includes(spokenForm(SENTENCE_MENU[id].text)));
};

/**
 * Structural-variance selection (PRD §5 rule 3): rotate one-per-category
 * before back-filling, so a session never turns into five near-identical
 * sentences. The category is the VOWEL family normally, and the LENGTH band
 * when the objective has already pinned the vowel (inside "short a", variety
 * means variety of length). Order is then ramped SHORT → LONG — the teaching
 * order the bench sitting ran.
 */
const selectSentences = (
  preferred: string[],
  pool: string[],
  count: number,
  vowelPinned: boolean,
): string[] => {
  const familyOf = (id: string): string => {
    const entry = SENTENCE_MENU[id];
    if (vowelPinned) {
      const words = countWords(entry.text);
      return words <= 4 ? 'short' : words <= 6 ? 'mid' : 'long';
    }
    return entry.vowels[0] ?? 'sight';
  };

  const ordered = [...preferred, ...pool];
  const seen = new Set<string>();
  const families = new Set<string>();
  const selected: string[] = [];

  // Pass 1 — one per structural family.
  for (const id of ordered) {
    if (selected.length >= count) break;
    if (seen.has(id)) continue;
    const family = familyOf(id);
    if (families.has(family)) continue;
    seen.add(id);
    families.add(family);
    selected.push(id);
  }
  // Pass 2 — back-fill remaining slots in preference order.
  for (const id of ordered) {
    if (selected.length >= count) break;
    if (seen.has(id)) continue;
    seen.add(id);
    selected.push(id);
  }

  // Teaching order: shortest first. Stable within equal lengths.
  return selected.sort((a, b) => countWords(SENTENCE_MENU[a].text) - countWords(SENTENCE_MENU[b].text));
};

const buildChallenge = (
  id: string,
  index: number,
  type: DiSentenceReadingChallengeType,
): DiSentenceReadingChallenge => {
  const entry = SENTENCE_MENU[id];
  const spoken = spokenForm(entry.text);
  return {
    id: `disr-${index + 1}-${id}`,
    challengeType: type,
    text: entry.text,
    // Computed here, never taken from the model: it drives the print size and
    // the meanSentenceWords metric, and it is the axis L4 modulates
    // (resolveProblemShape → rankByBand).
    wordCount: countWords(entry.text),
    ...(entry.vowels.length ? { vowels: [...entry.vowels] } : {}),
    ...(entry.emoji ? { emoji: entry.emoji } : {}),
    asrAliases: [spoken, ...(entry.extraAliases ?? [])],
  };
};

/**
 * ANSWER-LEAK GUARD on the wrapper: the child must READ the sentences, not
 * hear them first. flash-lite likes to be helpful ("Let's read about the big
 * pig!"), so any title/description containing a 3-word run from a selected
 * sentence is dropped for the neutral default rather than shipped.
 */
const leaksSentence = (wrapperText: string, sentences: string[]): boolean => {
  const hay = spokenForm(wrapperText);
  if (!hay) return false;
  for (const sentence of sentences) {
    const words = spokenForm(sentence).split(' ').filter(Boolean);
    for (let i = 0; i + 3 <= words.length; i++) {
      if (hay.includes(words.slice(i, i + 3).join(' '))) return true;
    }
  }
  return false;
};

export const generateDiSentenceReading = async (
  topic: string,
  gradeLevel: string,
  config?: {
    intent?: string;
    objectiveText?: string;
    challengeCount?: number;
    /** Eval mode pinned by the tester/curator. Wins over intent, no LLM call. */
    targetEvalMode?: string;
    /** Private student-model input; consumed only by code-owned menu ranking. */
    remediationFocus?: string;
    /**
     * Per-component support tier from the manifest ('easy' | 'medium' | 'hard').
     * Second field of the two-field contract: targetEvalMode = which reading
     * skill, difficulty = ONE tier enum driving BOTH within-mode dials — how
     * much of the DISTAR sequence precedes the read (L3,
     * resolveSupportStructure) and which word-count band the sentences are
     * drawn from (L4, resolveProblemShape). It never raises the session word
     * ceiling and never overrides an eval mode's pool.
     */
    difficulty?: string;
    [key: string]: unknown;
  },
): Promise<DiSentenceReadingData> => {
  const intent = config?.intent;
  const count = Math.min(
    MAX_INSTANCE_COUNT,
    Math.max(3, config?.challengeCount ?? DEFAULT_INSTANCE_COUNT),
  );

  // The objective's scope, resolved from ALL the text we have and code-enforced
  // below (topic/objective beats whatever the model picks).
  const scopeText = `${intent ?? ''} ${config?.objectiveText ?? ''} ${topic}`;
  const scopedVowels = resolveScopedVowels(scopeText);
  const sightScoped = resolveSightScope(scopeText);
  const wordCeiling = resolveWordCeiling(gradeLevel, scopeText);

  // Resolved BEFORE the prompt: L4 needs the tier in two places — one advisory
  // line the model sees, one enforcement pass the code owns (one key, two
  // places; the shape is mode-agnostic today, so the session line uses the
  // base mode's — buildFor re-resolves per challenge type regardless).
  const supportTier = normalizeSupportTier(config?.difficulty);
  const remediationFocus = config?.remediationFocus;
  const sessionShape = supportTier
    ? resolveProblemShape('read_sentence', supportTier, wordCeiling)
    : null;

  // The FOCUS pool — what the objective itself scopes to, after the hard length
  // ceiling. Each eval mode derives its own pool from this (poolForType).
  const inCeiling = (id: string) => countWords(SENTENCE_MENU[id].text) <= wordCeiling;
  let focusPool: string[];
  if (sightScoped) {
    focusPool = SIGHT_IDS.filter(inCeiling);
  } else if (scopedVowels) {
    // Pure short-vowel sentences first; widen to overlap only if the pure pool
    // cannot fill the session (the objective's scope beats set size, but an
    // empty session beats neither).
    const pure = idsForVowels(scopedVowels, true).filter(inCeiling);
    focusPool = pure.length >= count
      ? pure
      : [...pure, ...idsForVowels(scopedVowels).filter(inCeiling).filter((id) => !pure.includes(id))];
  } else {
    focusPool = MENU_IDS.filter(inCeiling);
  }
  // Never hand back an empty session because a filter over-narrowed: relax the
  // vowel/sight scope before relaxing the benched length ceiling, which is a
  // safety property rather than a preference.
  if (focusPool.length === 0) focusPool = MENU_IDS.filter(inCeiling);
  if (focusPool.length === 0) focusPool = [...MENU_IDS];

  const promptMenu = focusPool
    .map((id) => `- ${id}: "${SENTENCE_MENU[id].text}" (${countWords(SENTENCE_MENU[id].text)} words)`)
    .join('\n');

  const prompt = `Pick the target SENTENCES for a brisk Direct Instruction sentence-reading practice (beginning reader, grade 1-2).

TOPIC: "${topic}"${intent ? `\nOBJECTIVE FOCUS: "${intent}"` : ''}

You may ONLY choose from these sentence IDs:
${promptMenu}

RULES:
- Choose the ${count} sentences that best match the topic/objective, ordered SHORTEST to LONGEST so the practice ramps up.
- If the objective names a phonics pattern (like "short a"), choose sentences built on that vowel.${scopedVowels ? `\n- HARD VOWEL SCOPE: this objective is about short ${scopedVowels.join(', ')} — every sentence you pick MUST use that vowel.` : ''}${sessionShape ? `\n${sessionShape.promptLine}` : ''}
- If the objective is about sight words / high-frequency words, choose the sight-heavy sentences.
- If it is generic ("sentence reading", "reading simple sentences"), pick a spread across different vowels and different lengths.
- Write a warm, short kid title and a one-sentence description. NEVER quote, paraphrase, or hint at any target sentence — the child must read the sentences, not hear them first.

Return the wrapper JSON only.`;

  // Resolve which eval-mode SKILL(s) this objective calls for. Fork A: the
  // resolution drives which challenge types we BUILD (no schema enum exists).
  const resolution = await resolveEvalModes(
    'di-sentence-reading',
    { targetEvalMode: config?.targetEvalMode, intent, objectiveText: config?.objectiveText },
    CHALLENGE_TYPE_DOCS,
  );
  const modeTypes: DiSentenceReadingChallengeType[] =
    (resolution?.allowedTypes as DiSentenceReadingChallengeType[] | undefined) ?? ALL_TYPES; // mixed = all four

  let picked: string[] = [];
  let title = 'Sentence Reading';
  let description = 'Let’s read some sentences out loud together!';

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: wrapperSchema,
        systemInstruction:
          "You are an early-reading specialist scoping a Direct Instruction sentence-reading drill. " +
          "You select target sentences from an allowed menu only, ordered shortest to longest, and you " +
          "never reveal any target sentence in the title or description.",
      },
    });
    const text = response.text;
    if (text) {
      const parsed = JSON.parse(text) as {
        title?: string;
        description?: string;
        targetSentences?: unknown;
      };
      if (typeof parsed.title === 'string' && parsed.title.trim()) title = parsed.title.trim();
      if (typeof parsed.description === 'string' && parsed.description.trim()) {
        description = parsed.description.trim();
      }
      if (Array.isArray(parsed.targetSentences)) {
        picked = parsed.targetSentences
          .map((id) => String(id).trim())
          .filter((id) => MENU_IDS.includes(id));
      }
    }
  } catch (error) {
    console.error("Error generating di-sentence-reading wrapper:", error);
  }

  // What the objective/model asked for, in preference order. Filtered PER MODE
  // below against that mode's own pool — the model steers topically, the code
  // guarantees the skill (the census lesson: the prompt asks, the code
  // guarantees).
  const wanted = [...scanIdsFromText(scopeText), ...picked];

  /** One skill's share of the session — its own pool, own variance, own order. */
  const buildFor = (type: DiSentenceReadingChallengeType, n: number): string[] => {
    const modePool = poolForType(type, focusPool, inCeiling, n);
    if (modePool.length === 0) return [];
    // L4: this mode's length band. Identical across modes today (same act);
    // resolved per type so a future mode can diverge, mirroring the L3 shape.
    const shape = supportTier ? resolveProblemShape(type, supportTier, wordCeiling) : null;
    const seed = seedForType(type, focusPool, shape?.band).filter((id) => modePool.includes(id));
    const isReview = type === 'sentence_review';
    const remediationMove = resolveDiRemediationMove(type, remediationFocus);
    const namedAnchors = scanIdsFromText(scopeText).filter((id) => modePool.includes(id));
    const protectedAnchors = isReview ? seed : namedAnchors;
    const remediationRequested = Math.min(2, Math.max(0, n - protectedAnchors.length));

    const finishRemediation = (ids: string[]): string[] => {
      if (remediationFocus?.trim()) {
        const actual = remediationMove
          ? ids.filter((id) => isSentenceRemediationTarget(id, remediationMove, remediationFocus)).slice(0, 2).length
          : 0;
        console.log('[DiRemediation]', {
          primitive: 'di-sentence-reading',
          type,
          move: remediationMove,
          requested: remediationMove ? Math.min(2, n) : 0,
          actual,
          skippedReason: remediationMove && actual < Math.min(2, n)
            ? 'insufficient_eligible_targets'
            : remediationMove ? null : 'unsupported_focus',
        });
      }
      return ids;
    };

    // `sentence_review` deliberately STOPS at its ≤2 anchors and takes none of
    // the model's topical picks. Those picks are chosen from the prompt menu,
    // which shows only the FOCUSED pool — so letting them through floods the
    // session with the focus and a "review" of a short-a lesson comes back 4/4
    // short-a, i.e. the base mode wearing a different label. (Caught in L1 QA;
    // it is di-math-facts' fact_review bug in mirror image — theirs drew ZERO
    // focus items, this drew nothing else.) The rest is drawn SHUFFLED from the
    // whole menu, which is what makes a review a review.
    const preferred = isReview
      ? seed
      : [...seed, ...wanted.filter((id) => modePool.includes(id))];
    // Benched sentences lead the back-fill: they are the ten proven judgeable
    // live, so a session that falls back still runs on evidence. Review skips
    // that ordering too — a fixed lead makes every review session identical.
    const backfill = isReview
      ? shuffle(modePool)
      : [...BENCHED_IDS.filter((id) => modePool.includes(id)), ...modePool];
    // L4 enforcement: ONE stable re-rank of the whole candidate list — in-band
    // first, nearest next, the prior preference order breaking ties — so an
    // out-of-band topical pick loses to an in-band back-fill (the prompt line
    // is advisory; this ordering is authoritative). Review's ≤2 anchors stay
    // in front regardless: the lesson thread is part of that mode's IDENTITY,
    // and seedForType already drew the nearest-band anchors available.
    if (shape) {
      const anchored = isReview ? seed : [];
      const ranked = rankByBand(
        Array.from(new Set([...preferred, ...backfill])).filter((id) => !anchored.includes(id)),
        shape.band,
      );
      // Trim to the in-band set (or the nearest n when the pool's band support
      // is thin) BEFORE the variance rotation. Rotation exists to stop five
      // near-identical sentences, but its family-novelty pull must never
      // outrank the band — first caught by the structural suite, where pass 1
      // reached past three in-band sight sentences to grab a 4-word one for
      // vowel variety. Inside the window it diversifies; outside it, nothing.
      const inBand = ranked.filter(
        (id) => bandDistance(countWords(SENTENCE_MENU[id].text), shape.band) === 0,
      ).length;
      const window = ranked.slice(0, Math.max(n, inBand));
      const remediationWindow = remediationMove
        ? rankSentencesForRemediation(
            window.filter((id) => !protectedAnchors.includes(id)),
            remediationMove,
            remediationFocus ?? '',
            remediationRequested,
          )
        : window;
      // Length-family rotation is disabled under a band (variety of length is
      // the opposite of a pinned length target) — rotation falls back to the
      // vowel family, which is what review always used.
      const selected = selectSentences([...anchored, ...remediationWindow], [], n, false);
      return finishRemediation(remediationMove
        ? ensureRemediationTargets(
            selected,
            remediationWindow,
            remediationMove,
            remediationFocus ?? '',
            remediationRequested,
            protectedAnchors,
          )
        : selected);
    }
    // Review rotates by VOWEL even when the objective pinned one (breadth across
    // patterns IS the skill); every other mode rotates by length inside a pinned
    // vowel, since there the vowel is already fixed.
    if (remediationMove) {
      const candidates = Array.from(new Set([...preferred, ...backfill]));
      const remainder = candidates.filter((id) => !protectedAnchors.includes(id));
      const ranked = rankSentencesForRemediation(
        remainder,
        remediationMove,
        remediationFocus ?? '',
        remediationRequested,
      );
      const selected = selectSentences(
        [...protectedAnchors, ...ranked],
        [],
        n,
        isReview ? false : scopedVowels !== null,
      );
      return finishRemediation(ensureRemediationTargets(
        selected,
        ranked,
        remediationMove,
        remediationFocus ?? '',
        remediationRequested,
        protectedAnchors,
      ));
    }
    return finishRemediation(selectSentences(preferred, backfill, n, isReview ? false : scopedVowels !== null));
  };

  // Build from the resolved mode(s). Single mode → all one skill; blend/mixed →
  // an interleaved spread so every mode actually appears in the session (SP-21:
  // a Fork-A "mixed" that builds from one pool is a mislabelled single mode,
  // and per-mode eval-test cannot catch it).
  let challenges: DiSentenceReadingChallenge[];
  if (modeTypes.length === 1) {
    challenges = buildFor(modeTypes[0], count).map((id, i) => buildChallenge(id, i, modeTypes[0]));
  } else {
    const shares = distribute(count, modeTypes.length);
    // Ask each mode for SPARES. The pools deliberately overlap (a decodable
    // sentence is also review-eligible), and the same sentence twice in one
    // session is not a mix — so cross-mode dedupe below would otherwise starve a
    // round and silently return fewer than `count` items.
    const perMode = modeTypes.map((t, i) => buildFor(t, shares[i] + modeTypes.length));
    // Round-robin interleave so the session alternates skills; each mode's own
    // slice keeps its shortest-first teaching order. Per-mode cursors skip ids
    // another mode already claimed.
    const interleaved: Array<{ id: string; type: DiSentenceReadingChallengeType }> = [];
    const seenIds = new Set<string>();
    const cursor = modeTypes.map(() => 0);
    let progressed = true;
    while (interleaved.length < count && progressed) {
      progressed = false;
      for (let m = 0; m < modeTypes.length && interleaved.length < count; m++) {
        while (cursor[m] < perMode[m].length && seenIds.has(perMode[m][cursor[m]])) cursor[m] += 1;
        if (cursor[m] >= perMode[m].length) continue;
        const id = perMode[m][cursor[m]];
        cursor[m] += 1;
        seenIds.add(id);
        interleaved.push({ id, type: modeTypes[m] });
        progressed = true;
      }
    }
    challenges = interleaved.map(({ id, type }, i) => buildChallenge(id, i, type));
  }

  // Guarantee a runnable session even if every filter emptied out.
  if (challenges.length === 0) {
    challenges = BENCHED_IDS.slice(0, count).map((id, i) => buildChallenge(id, i, 'read_sentence'));
  }

  // Last line of defence on the benched ceiling: nothing over MAX_SENTENCE_WORDS
  // may reach a learner, whatever any upstream filter did.
  challenges = challenges.filter((ch) => ch.wordCount <= MAX_SENTENCE_WORDS);

  // ── Support tier, applied deterministically at the END ─────────────
  // Gated ONLY on a tier being present, and resolved from each challenge's OWN
  // mode — difficulty is a STUDENT property, so a blended/mixed session must get
  // it too (gating on a single pinned mode is the silent no-op this layer exists
  // to kill). Code owns the support structure; the LLM only steered topically.
  //
  // L4 note (2026-08-03): the L3 ruling here used to be "never inject the tier
  // into the prompt — it could only nudge sentence choice". Structural
  // difficulty is EXACTLY that nudge, now designed: the prompt DESCRIBES the
  // band (one advisory line) and rankByBand ENFORCES it at selection time —
  // one key (the tier enum), two places, code authoritative. What remains
  // forbidden is the tier touching the vowel/sight SCOPE, a mode's POOL, or
  // the session word CEILING.
  if (supportTier) {
    for (const ch of challenges) {
      ch.supportTier = resolveSupportStructure(ch.challengeType, supportTier).tier;
    }
    const inBand = sessionShape
      ? challenges.filter((ch) => bandDistance(ch.wordCount, sessionShape.band) === 0).length
      : 0;
    console.log(
      `[DiSentenceReading] Support tier "${supportTier}" applied per-challenge (${modeTypes.length === 1 ? `single-mode ${modeTypes[0]}` : 'blended'}) — ${resolveSupportStructure(challenges[0]?.challengeType ?? 'read_sentence', supportTier).describe}; length band ${sessionShape?.band[0]}-${sessionShape?.band[1]} (ceiling ${wordCeiling}), in-band ${inBand}/${challenges.length}`,
    );
  }

  const sentences = challenges.map((ch) => ch.text);
  if (leaksSentence(title, sentences)) title = 'Sentence Reading';
  if (leaksSentence(description, sentences)) {
    description = 'Let’s read some sentences out loud together!';
  }

  const data: DiSentenceReadingData = {
    title,
    description,
    // Session identity = the first item's skill (a pinned mode → that mode; on
    // the mixed path this is representative metadata only, and the component
    // renders per-challenge).
    challengeType: challenges[0]?.challengeType ?? 'read_sentence',
    gradeLevel: gradeLevel || 'first grade',
    challenges,
    // Flat item-set summary for the tutoring scaffold's RUNTIME STATE (catalog
    // contextKey `sentences`) — present from the first auth-time prompt, before
    // the component's live context sync takes over. No answer-leak concern here
    // (unlike di-math-facts' `facts`): the printed sentence IS the target and is
    // already on screen, so there is no answer side to withhold.
    sentences: challenges.map((c) => c.text).join(' | '),
  };

  console.log("DI Sentence Reading Generated:", {
    title: data.title,
    modes: resolution ? `${resolution.modes.map((m) => m.evalMode).join('+')} (${resolution.source})` : 'mixed',
    types: challenges.map((c) => c.challengeType),
    scope: scopedVowels ? `short ${scopedVowels.join(',')}` : sightScoped ? 'sight words' : 'generic',
    wordCeiling,
    sentences: challenges.map((c) => `${c.text} (${c.wordCount}w)`),
    count: challenges.length,
  });

  return data;
};
