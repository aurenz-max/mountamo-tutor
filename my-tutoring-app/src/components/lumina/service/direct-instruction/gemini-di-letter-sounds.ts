/**
 * gemini-di-letter-sounds — menu-scoped generator for the di-letter-sounds
 * primitive. Fork A (pool service): the item CONTENT is a curated, picturable
 * letter-sound menu owned in code; Gemini's only job is to SELECT which target
 * letters the objective is about (from the menu) and write a kid title. The
 * spoken sound, keyword, emoji, elicitation, and ASR aliases are attached
 * deterministically from the menu — the rhyme-studio K pattern (entropy in the
 * prompt, pictures/attachments in code), because flash-lite is unreliable at
 * emitting nested per-item content and structured output is convergent on values.
 *
 * SCOPE (the benched class): continuous, stretchable letter SOUNDS + short
 * vowels via keyword elicitation. Deliberately EXCLUDED: letter NAMES (blocked —
 * homophone ruling), digraphs/blends, and stop consonants (b/t/p/d/k/g can't be
 * held; a later benched item). No DEFAULT_ITEMS-style content ships from the
 * component; all items originate here, scoped to the objective.
 *
 * EVAL MODES (L1) — task identities, resolved from intent or pinned by the
 * tester/curator, then built HERE (Fork A: Gemini never emits the challenge
 * type — code stamps it, so there is no schema enum to constrain):
 *   - letter_sound        — isolated grapheme→phoneme (the focused base cluster).
 *   - letter_sound_review — mixed-set cumulative/spaced review (WIDE cross-menu
 *                           spread, not the objective's narrow cluster).
 *   - first_sound_in_word — onset isolation from a spoken WORD (phonemic
 *                           awareness); continuant keywords only.
 * The unconstrained ("mixed", resolution === null) path builds a spread across
 * ALL THREE modes — never one Gemini-picked type (SP-21 Fork-A discipline).
 */

import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import { resolveEvalModes, type ChallengeTypeDoc } from "../evalMode";
import type {
  DiLetterSoundsData,
  DiLetterSoundChallenge,
} from "../../primitives/visual-primitives/direct-instruction/DiLetterSounds";
import type {
  DiLetterSoundChallengeType,
  DiLetterSoundsSupportTier,
} from "../../primitives/visual-primitives/direct-instruction/diLetterSoundsScript";

// ── Support tier harness (L3) ───────────────────────────────────────

type SupportTier = DiLetterSoundsSupportTier;
const SUPPORT_TIERS: readonly SupportTier[] = ['easy', 'medium', 'hard'];

/** STRICT lookup — the manifest enum-constrains config.difficulty to these.
 *  Unknown/absent → null (no tier applied; the L0 easy shape stands). */
function normalizeSupportTier(difficulty?: string): SupportTier | null {
  const d = difficulty?.toLowerCase().trim() ?? '';
  return (SUPPORT_TIERS as readonly string[]).includes(d) ? (d as SupportTier) : null;
}

/**
 * How much of the DISTAR sequence precedes the child's attempt.
 *
 * The withdrawal is IDENTICAL across all three eval modes, and that is correct
 * rather than lazy: every mode is the same act (meet the stimulus, produce the
 * held sound), so the same three sub-steps precede it. What a MODE changes is
 * which items are drawn and how the cue is phrased (the script owns that); what
 * a TIER changes is how much of the sequence is handed over. Kept
 * per-type-capable so a future mode can diverge. Which letters are selected is
 * the tier's OTHER dial — resolveProblemShape (L4 structural difficulty)
 * controls the item-set composition. Two named resolvers share one tier enum:
 * a hard item set is both confusable-by-composition and produced cold.
 */
const resolveSupportStructure = (
  _type: DiLetterSoundChallengeType,
  tier: SupportTier,
): { tier: SupportTier; describe: string } => ({
  tier,
  describe:
    tier === 'hard'
      ? 'cold production — no model, no choral practice; the child retrieves the sound unaided'
      : tier === 'medium'
        ? 'modeled once, then produced alone — the choral "Together" step is withdrawn'
        : 'modeled and practiced together first — the full DISTAR sequence',
});

/** One curated menu entry: everything the tutor and the picture need. */
interface MenuEntry {
  letter: string;
  spoken: string;
  keyword: string;
  emoji: string;
  elicitation: 'isolated' | 'keyword';
  asrAliases: string[];
}

/**
 * The curated letter-sound menu. Continuants elicit the isolated sound; short
 * vowels elicit through the keyword (they distort in isolation for a K child).
 * Every keyword is concrete and picturable, and its FIRST sound is the target.
 */
const LETTER_SOUND_MENU: Record<string, MenuEntry> = {
  // ── Continuous consonants (held ~2s) ─────────────────────────────
  m: { letter: 'm', spoken: 'mmm', keyword: 'moon', emoji: '🌙', elicitation: 'isolated', asrAliases: ['m', 'mm', 'mmm', 'hm', 'hmm', 'mhm', 'um'] },
  s: { letter: 's', spoken: 'sss', keyword: 'sun', emoji: '☀️', elicitation: 'isolated', asrAliases: ['s', 'ss', 'sss', 'ess', 'sh', 'shh', 'hiss'] },
  f: { letter: 'f', spoken: 'fff', keyword: 'fish', emoji: '🐟', elicitation: 'isolated', asrAliases: ['f', 'ff', 'fff', 'ef', 'huff'] },
  r: { letter: 'r', spoken: 'rrr', keyword: 'ring', emoji: '💍', elicitation: 'isolated', asrAliases: ['r', 'rr', 'rrr', 'ar', 'are', 'er'] },
  n: { letter: 'n', spoken: 'nnn', keyword: 'nest', emoji: '🪺', elicitation: 'isolated', asrAliases: ['n', 'nn', 'nnn', 'en', 'un'] },
  l: { letter: 'l', spoken: 'lll', keyword: 'leaf', emoji: '🍃', elicitation: 'isolated', asrAliases: ['l', 'll', 'lll', 'el', 'ull'] },
  v: { letter: 'v', spoken: 'vvv', keyword: 'van', emoji: '🚐', elicitation: 'isolated', asrAliases: ['v', 'vv', 'vvv', 'vee'] },
  z: { letter: 'z', spoken: 'zzz', keyword: 'zebra', emoji: '🦓', elicitation: 'isolated', asrAliases: ['z', 'zz', 'zzz', 'zee', 'buzz'] },
  // ── Short vowels (keyword elicitation) ───────────────────────────
  a: { letter: 'a', spoken: 'aaa', keyword: 'apple', emoji: '🍎', elicitation: 'keyword', asrAliases: ['apple', 'a'] },
  e: { letter: 'e', spoken: 'eee', keyword: 'egg', emoji: '🥚', elicitation: 'keyword', asrAliases: ['egg', 'e'] },
  i: { letter: 'i', spoken: 'iii', keyword: 'igloo', emoji: '🧊', elicitation: 'keyword', asrAliases: ['igloo', 'i'] },
  o: { letter: 'o', spoken: 'ooo', keyword: 'octopus', emoji: '🐙', elicitation: 'keyword', asrAliases: ['octopus', 'o'] },
  u: { letter: 'u', spoken: 'uuu', keyword: 'umbrella', emoji: '☂️', elicitation: 'keyword', asrAliases: ['umbrella', 'u'] },
};

const MENU_LETTERS = Object.keys(LETTER_SOUND_MENU);
/** Continuants only — onset isolation and confusable-free review lean on these. */
const CONTINUANT_LETTERS = MENU_LETTERS.filter((l) => LETTER_SOUND_MENU[l].elicitation === 'isolated');
const DEFAULT_INSTANCE_COUNT = 4;
const MAX_INSTANCE_COUNT = 6;
/** Sensible starter set when the objective names no menu letters. */
const DEFAULT_LETTERS = ['m', 's', 'a', 'f'];
/** Cumulative-review walk: continuants and vowels interleaved, widest-first, so
 *  a review session spreads across the menu instead of hugging the focus cluster. */
const REVIEW_SPREAD_ORDER = ['m', 's', 'a', 'f', 'r', 'i', 'n', 'l', 'o', 'v', 'z', 'u', 'e'];

// ── Structural difficulty (L4) ───────────────────────────────────────────────

const SHORT_VOWELS = MENU_LETTERS.filter((l) => LETTER_SOUND_MENU[l].elicitation === 'keyword');
const CONFUSABLE_PAIRS = [['m', 'n'], ['f', 'v']] as const;

type ShapeMode = DiLetterSoundChallengeType | 'mixed';

export interface DiLetterSoundsProblemShape {
  /** Minimum number of short vowels required in the whole item set. */
  minimumShortVowels: number;
  /** Hard cap: onset mode must stay continuant-only. */
  maximumShortVowels: number;
  /** Exact number of complete m/n or f/v pairs required in the set. */
  confusablePairTarget: number;
  promptLine: string;
  saturated: boolean;
}

/**
 * The tier's second dial: item-set composition, clamped to the session size and
 * the eval mode's identity. The count never changes — difficulty changes the
 * relationships among the items, not the amount of work or the benched menu.
 *
 * first_sound_in_word cannot admit short vowels (its keyword-onset contract is
 * continuant-only), so medium honestly saturates at easy there. Hard remains a
 * genuine step because confusable continuant pairs are legal in that mode.
 */
export const resolveProblemShape = (
  type: ShapeMode,
  tier: SupportTier,
  count: number,
): DiLetterSoundsProblemShape => {
  const size = Math.max(0, Math.min(Math.floor(count), MAX_INSTANCE_COUNT));
  const onsetOnly = type === 'first_sound_in_word';
  const vowelCap = onsetOnly ? 0 : size;
  const pairTarget = tier === 'hard'
    ? Math.min(CONFUSABLE_PAIRS.length, Math.floor(size / 2))
    : 0;

  if (tier === 'hard') {
    return {
      minimumShortVowels: 0,
      maximumShortVowels: vowelCap,
      confusablePairTarget: pairTarget,
      promptLine:
        `DIFFICULTY TIER (hard): prefer a ${size}-item set that puts the confusable contrasts m/n and f/v together when the set size permits.`,
      saturated: pairTarget < CONFUSABLE_PAIRS.length,
    };
  }

  if (tier === 'medium' && !onsetOnly) {
    return {
      minimumShortVowels: Math.min(1, vowelCap),
      maximumShortVowels: vowelCap,
      confusablePairTarget: 0,
      promptLine:
        'DIFFICULTY TIER (medium): prefer a mixed set of continuants plus at least one short vowel; do not put m/n or f/v together yet.',
      saturated: vowelCap === 0,
    };
  }

  return {
    minimumShortVowels: 0,
    maximumShortVowels: 0,
    confusablePairTarget: 0,
    promptLine: onsetOnly && tier === 'medium'
      ? 'DIFFICULTY TIER (medium): onset mode stays continuant-only; prefer a varied set and do not put m/n or f/v together yet.'
      : 'DIFFICULTY TIER (easy): prefer continuants only; do not put m/n or f/v together in the same set.',
    saturated: onsetOnly && tier === 'medium',
  };
};

const countConfusablePairs = (letters: readonly string[]): number => {
  const set = new Set(letters);
  return CONFUSABLE_PAIRS.filter(([a, b]) => set.has(a) && set.has(b)).length;
};

const meetsProblemShape = (
  letters: readonly string[],
  shape: DiLetterSoundsProblemShape,
): boolean => {
  const vowelCount = letters.filter((l) => SHORT_VOWELS.includes(l)).length;
  return new Set(letters).size === letters.length
    && vowelCount >= shape.minimumShortVowels
    && vowelCount <= shape.maximumShortVowels
    && countConfusablePairs(letters) === shape.confusablePairTarget;
};

const completesPair = (letter: string, used: ReadonlySet<string>): boolean =>
  CONFUSABLE_PAIRS.some(([a, b]) =>
    (letter === a && used.has(b)) || (letter === b && used.has(a)));

/**
 * Deterministic count → honor-if-valid → reconstruct enforcement. The incoming
 * challenges already contain the old objective preference, review breadth, and
 * mixed-mode staggering. That variance work happens FIRST; this function then
 * trims/rebuilds the final composition window, so rotation can never pull an
 * out-of-tier letter back into the set (the sentence-reading L4 trap).
 */
const enforceProblemShape = (
  challenges: DiLetterSoundChallenge[],
  focusLetters: string[],
  shape: DiLetterSoundsProblemShape,
): DiLetterSoundChallenge[] => {
  const incoming = challenges.map((ch) => ch.letter);
  if (meetsProblemShape(incoming, shape)) return challenges;

  const preferred = takeUnique([
    ...incoming,
    ...focusLetters,
    ...DEFAULT_LETTERS,
    ...REVIEW_SPREAD_ORDER,
    ...MENU_LETTERS,
  ], MENU_LETTERS.length);
  const result: Array<string | null> = Array(challenges.length).fill(null);
  const used = new Set<string>();

  const placeRequired = (letter: string, requireNonOnset = false): void => {
    const matching = challenges.findIndex((ch, i) =>
      result[i] === null
      && ch.letter === letter
      && (!requireNonOnset || ch.challengeType !== 'first_sound_in_word'));
    const fallback = challenges.findIndex((ch, i) =>
      result[i] === null
      && (!requireNonOnset || ch.challengeType !== 'first_sound_in_word'));
    const index = matching >= 0 ? matching : fallback;
    if (index >= 0) {
      result[index] = letter;
      used.add(letter);
    }
  };

  if (shape.confusablePairTarget > 0) {
    const preferredIndex = (letter: string) => {
      const index = preferred.indexOf(letter);
      return index < 0 ? Number.MAX_SAFE_INTEGER : index;
    };
    const selectedPairs = [...CONFUSABLE_PAIRS]
      .sort((left, right) => {
        const leftHits = left.filter((l) => incoming.includes(l)).length;
        const rightHits = right.filter((l) => incoming.includes(l)).length;
        return rightHits - leftHits
          || Math.min(...left.map(preferredIndex)) - Math.min(...right.map(preferredIndex));
      })
      .slice(0, shape.confusablePairTarget);
    const required = selectedPairs.flatMap((pair) => [...pair]);
    required
      .sort((a, b) => preferredIndex(a) - preferredIndex(b))
      .forEach((letter) => placeRequired(letter));
  } else if (shape.minimumShortVowels > 0) {
    const vowel = preferred.find((l) => SHORT_VOWELS.includes(l)) ?? SHORT_VOWELS[0];
    placeRequired(vowel, true);
  }

  for (let i = 0; i < result.length; i++) {
    if (result[i] !== null) continue;
    const onsetOnly = challenges[i].challengeType === 'first_sound_in_word';
    const vowelCount = () => Array.from(used).filter((l) => SHORT_VOWELS.includes(l)).length;
    const candidate = preferred.find((letter) => {
      if (used.has(letter)) return false;
      if (onsetOnly && SHORT_VOWELS.includes(letter)) return false;
      if (SHORT_VOWELS.includes(letter) && vowelCount() >= shape.maximumShortVowels) return false;
      if (shape.confusablePairTarget === 0 && completesPair(letter, used)) return false;
      if (shape.confusablePairTarget > 0
        && completesPair(letter, used)
        && countConfusablePairs(Array.from(used).concat(letter)) > shape.confusablePairTarget) return false;
      return true;
    });
    // The curated menu has enough legal unique letters for every supported
    // 3–6 item set. This fallback is defensive and preserves runnability.
    const letter = candidate ?? CONTINUANT_LETTERS.find((l) => !used.has(l)) ?? DEFAULT_LETTERS[0];
    result[i] = letter;
    used.add(letter);
  }

  return result.map((letter, i) =>
    buildChallenge(letter ?? DEFAULT_LETTERS[0], i, challenges[i].challengeType));
};

/** Skill docs for the intent→mode router (there is no schema to constrain — Fork A). */
const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  letter_sound: {
    promptDoc:
      `"letter_sound": the child sees a letter and says its continuous SOUND (grapheme→phoneme). The base skill.`,
    schemaDescription: "'letter_sound' (say the letter's sound)",
  },
  letter_sound_review: {
    promptDoc:
      `"letter_sound_review": cumulative / spaced review — the child re-produces sounds already taught, drawn as a WIDE mix across many letters rather than one focused set.`,
    schemaDescription: "'letter_sound_review' (mixed spaced review)",
  },
  first_sound_in_word: {
    promptDoc:
      `"first_sound_in_word": phonemic awareness — the child hears a whole WORD (e.g. "moon") and says its FIRST sound. Continuant onsets only.`,
    schemaDescription: "'first_sound_in_word' (onset isolation)",
  },
};

/** Gemini emits ONLY the wrapper — never the per-item content (Fork A). */
const wrapperSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Short, warm kindergarten activity title (e.g. 'Sound Time!'). Do NOT name the answer sounds.",
    },
    description: {
      type: Type.STRING,
      description: "One friendly sentence telling the child they will say some sounds out loud.",
    },
    targetLetters: {
      type: Type.ARRAY,
      items: { type: Type.STRING, enum: MENU_LETTERS },
      description:
        "The 4-5 lowercase letters (from the allowed set only) whose SOUNDS this objective is about, " +
        "in a sensible teaching order. Choose the ones the objective/topic names; if it is generic, " +
        "pick a spread of easy continuous sounds.",
    },
  },
  required: ["title", "targetLetters"],
};

/** Scan free text for menu letters named as targets (fallback + safety net). */
const scanLettersFromText = (text: string): string[] => {
  const lower = ` ${text.toLowerCase()} `;
  const found: string[] = [];
  for (const letter of MENU_LETTERS) {
    // Match the letter as a standalone token or in "letter m" / "m sound" phrasings.
    const re = new RegExp(`(^|[^a-z])${letter}([^a-z]|$)`, 'i');
    if (re.test(lower)) found.push(letter);
  }
  return found;
};

/** Dedupe (order-preserving) and cap. */
const takeUnique = (source: string[], n: number): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const l of source) {
    if (!(l in LETTER_SOUND_MENU) || seen.has(l)) continue;
    seen.add(l);
    out.push(l);
    if (out.length >= n) break;
  }
  return out;
};

/**
 * The letters to drill for ONE mode, backfilled so a session always has enough:
 * - letter_sound        → the focused objective cluster, then starter/menu.
 * - letter_sound_review → cumulative review: anchor on the 1-2 most-recently-
 *                         taught (focus) sounds, then BROADEN to letters OUTSIDE
 *                         the focus so the set is a genuine mix across the menu,
 *                         not a copy of the focused base cluster. (True spaced
 *                         review is bounded by the taught-set from student
 *                         history — unavailable at generation; this menu-wide
 *                         spread is the L1 approximation. See L2 contextKeys.)
 * - first_sound_in_word → continuant onsets only (the focus's continuants, then
 *                         the rest of the continuant menu).
 */
const lettersForType = (
  type: DiLetterSoundChallengeType,
  focusLetters: string[],
  n: number,
): string[] => {
  switch (type) {
    case 'letter_sound_review': {
      const anchors = focusLetters.slice(0, 2); // recently-taught, kept in the mix
      const broaden = REVIEW_SPREAD_ORDER.filter((l) => !focusLetters.includes(l));
      return takeUnique([...anchors, ...broaden, ...REVIEW_SPREAD_ORDER, ...MENU_LETTERS], n);
    }
    case 'first_sound_in_word': {
      const focusContinuants = focusLetters.filter((l) => CONTINUANT_LETTERS.includes(l));
      return takeUnique([...focusContinuants, ...CONTINUANT_LETTERS], n);
    }
    case 'letter_sound':
    default:
      return takeUnique([...focusLetters, ...DEFAULT_LETTERS, ...MENU_LETTERS], n);
  }
};

/** Rotate an array left by `n` (used to stagger each mode's pool in a blend so
 *  the interleave doesn't stack the same letter across modes). */
const rotate = <T,>(arr: T[], n: number): T[] =>
  arr.length ? arr.map((_, i) => arr[(i + n) % arr.length]) : arr;

const buildChallenge = (
  letter: string,
  index: number,
  type: DiLetterSoundChallengeType,
): DiLetterSoundChallenge => {
  const entry = LETTER_SOUND_MENU[letter];
  return {
    id: `dils-${index + 1}-${letter}`,
    challengeType: type,
    letter: entry.letter,
    spoken: entry.spoken,
    keyword: entry.keyword,
    emoji: entry.emoji,
    elicitation: entry.elicitation,
    asrAliases: entry.asrAliases,
  };
};

/** Split `count` across `k` modes as evenly as possible, each mode ≥1. */
const distribute = (count: number, k: number): number[] => {
  const base = Math.floor(count / k);
  const rem = count % k;
  return Array.from({ length: k }, (_, i) => base + (i < rem ? 1 : 0));
};

export const generateDiLetterSounds = async (
  topic: string,
  gradeLevel: string,
  config?: {
    intent?: string;
    objectiveText?: string;
    challengeCount?: number;
    /** Eval mode pinned by the tester/curator. Wins over intent, no LLM call. */
    targetEvalMode?: string;
    /**
     * Per-component support tier from the manifest ('easy' | 'medium' | 'hard').
     * Second field of the two-field contract: targetEvalMode = which sound
     * skill; difficulty = ONE tier enum driving BOTH within-mode dials — how
     * much of the DISTAR sequence precedes the attempt (L3) and the item-set
     * composition (L4). It never changes the item count, menu, or mode identity.
     */
    difficulty?: string;
    [key: string]: unknown;
  },
): Promise<DiLetterSoundsData> => {
  const intent = config?.intent;
  const count = Math.min(
    MAX_INSTANCE_COUNT,
    Math.max(3, config?.challengeCount ?? DEFAULT_INSTANCE_COUNT),
  );

  // Resolve which eval-mode SKILL(s) this objective calls for. Fork A: the
  // resolution drives which challenge types we BUILD (no schema enum exists).
  const resolution = await resolveEvalModes(
    'di-letter-sounds',
    { targetEvalMode: config?.targetEvalMode, intent, objectiveText: config?.objectiveText },
    CHALLENGE_TYPE_DOCS,
  );
  const modeTypes: DiLetterSoundChallengeType[] = (resolution?.allowedTypes as DiLetterSoundChallengeType[] | undefined)
    ?? ['letter_sound', 'letter_sound_review', 'first_sound_in_word']; // mixed = all three
  const supportTier = normalizeSupportTier(config?.difficulty);
  const shapeMode: ShapeMode = modeTypes.length === 1 ? modeTypes[0] : 'mixed';
  const sessionShape = supportTier ? resolveProblemShape(shapeMode, supportTier, count) : null;

  const prompt = `Pick the target letter SOUNDS for a brisk kindergarten Direct Instruction practice.

TOPIC: "${topic}"${intent ? `\nOBJECTIVE FOCUS: "${intent}"` : ''}

You may ONLY choose from these letters (each has a continuous, stretchable sound a child can hold, or a short vowel):
${MENU_LETTERS.join(', ')}

RULES:
- Choose the ${count} letters whose SOUNDS best match the topic/objective. If the objective names specific letters, use those (only if they are in the allowed set). If it is generic ("letter sounds", "phonics"), pick a spread of the easiest continuous sounds (m, s, f, and a short vowel like a).${sessionShape ? `\n- ${sessionShape.promptLine}` : ''}
- These are letter SOUNDS, never letter NAMES. Never choose a letter outside the allowed set.
- Write a warm, short kid title and a one-sentence description. Never reveal or spell out the sounds in the title or description.

Return the wrapper JSON only.`;

  let selected: string[] = [];
  let title = 'Letter Sounds';
  let description = 'Let’s say some sounds out loud together!';

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: wrapperSchema,
        systemInstruction:
          "You are a kindergarten reading specialist scoping a Direct Instruction letter-sounds drill. " +
          "You select target letters from an allowed menu only, in a sensible teaching order, and you " +
          "never reveal answers in the title or description.",
      },
    });
    const text = response.text;
    if (text) {
      const parsed = JSON.parse(text) as {
        title?: string;
        description?: string;
        targetLetters?: unknown;
      };
      if (typeof parsed.title === 'string' && parsed.title.trim()) title = parsed.title.trim();
      if (typeof parsed.description === 'string' && parsed.description.trim()) {
        description = parsed.description.trim();
      }
      if (Array.isArray(parsed.targetLetters)) {
        selected = parsed.targetLetters
          .map((l) => String(l).toLowerCase().trim())
          .filter((l) => l in LETTER_SOUND_MENU);
      }
    }
  } catch (error) {
    console.error("Error generating di-letter-sounds wrapper:", error);
  }

  // Fallback ladder: model selection → scan the objective/topic → starter set.
  if (selected.length === 0) {
    selected = scanLettersFromText(`${intent ?? ''} ${topic}`);
  }
  if (selected.length === 0) {
    selected = [...DEFAULT_LETTERS];
  }
  // The focused objective cluster (deduped, order preserved).
  const focusLetters = takeUnique(selected, MENU_LETTERS.length);

  // Build the challenge set from the resolved mode(s). Single mode → all one
  // type; blend/mixed → an interleaved spread so every mode appears (SP-21).
  let challenges: DiLetterSoundChallenge[];
  if (modeTypes.length === 1) {
    challenges = lettersForType(modeTypes[0], focusLetters, count)
      .map((letter, i) => buildChallenge(letter, i, modeTypes[0]));
  } else {
    const shares = distribute(count, modeTypes.length);
    // Stagger each mode's pool by its index so the interleave alternates letters
    // (otherwise every mode starts at focus[0] and round 0 stacks one keyword).
    const perModeLetters = modeTypes.map((t, i) => lettersForType(t, rotate(focusLetters, i), shares[i]));
    // Round-robin interleave so the session alternates skills.
    const interleaved: Array<{ letter: string; type: DiLetterSoundChallengeType }> = [];
    const maxLen = Math.max(...perModeLetters.map((ls) => ls.length));
    for (let round = 0; round < maxLen; round++) {
      for (let m = 0; m < modeTypes.length; m++) {
        const letter = perModeLetters[m][round];
        if (letter) interleaved.push({ letter, type: modeTypes[m] });
      }
    }
    challenges = interleaved
      .slice(0, count)
      .map(({ letter, type }, i) => buildChallenge(letter, i, type));
  }

  // Guarantee a runnable session even if every backfill emptied out.
  if (challenges.length === 0) {
    challenges = lettersForType('letter_sound', DEFAULT_LETTERS, count)
      .map((letter, i) => buildChallenge(letter, i, 'letter_sound'));
  }

  // ── Tier axes, applied deterministically at the END ────────────────
  // Gated ONLY on a tier being present, and resolved from each challenge's OWN
  // mode — difficulty is a STUDENT property, so a blended/mixed session must get
  // it too (gating on a single pinned mode is the silent no-op this layer exists
  // to kill). L4 now deliberately sends that same tier to TWO places: the
  // prompt describes the composition preference, then enforceProblemShape is
  // authoritative after objective selection + mixed-mode rotation. The tier
  // may change composition, but never count, menu, or eval-mode slot.
  if (supportTier) {
    challenges = enforceProblemShape(challenges, focusLetters, sessionShape!);
    for (const ch of challenges) {
      ch.supportTier = resolveSupportStructure(ch.challengeType, supportTier).tier;
    }
    const letters = challenges.map((ch) => ch.letter);
    console.log(
      `[DiLetterSounds] Support tier "${supportTier}" applied per-challenge (${modeTypes.length === 1 ? `single-mode ${modeTypes[0]}` : 'blended'}) — ${resolveSupportStructure(challenges[0]?.challengeType ?? 'letter_sound', supportTier).describe}; composition vowels ${letters.filter((l) => SHORT_VOWELS.includes(l)).length} (min ${sessionShape!.minimumShortVowels}, max ${sessionShape!.maximumShortVowels}), confusable pairs ${countConfusablePairs(letters)}/${sessionShape!.confusablePairTarget}${sessionShape!.saturated ? ' (honest saturation)' : ''}`,
    );
  }

  // Session identity = the first item's skill (a pinned mode → that mode).
  const primaryType: DiLetterSoundChallengeType = challenges[0]?.challengeType ?? 'letter_sound';

  const data: DiLetterSoundsData = {
    title,
    description,
    challengeType: primaryType,
    gradeLevel: gradeLevel || 'kindergarten',
    challenges,
    // Flat item-set summary for the tutoring scaffold's RUNTIME STATE
    // (catalog contextKey `letters`) — present from the first auth-time
    // prompt, before the component's live context sync takes over.
    letters: challenges.map((c) => c.letter).join(', '),
  };

  console.log("DI Letter Sounds Generated:", {
    title: data.title,
    modes: resolution ? `${resolution.modes.map((m) => m.evalMode).join('+')} (${resolution.source})` : 'mixed',
    types: challenges.map((c) => c.challengeType),
    letters: challenges.map((c) => c.letter),
    count: challenges.length,
  });

  return data;
};
