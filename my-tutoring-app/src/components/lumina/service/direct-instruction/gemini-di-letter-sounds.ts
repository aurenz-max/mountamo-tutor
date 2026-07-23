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
import type { DiLetterSoundChallengeType } from "../../primitives/visual-primitives/direct-instruction/diLetterSoundsScript";

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
    [key: string]: unknown;
  },
): Promise<DiLetterSoundsData> => {
  const intent = config?.intent;
  const count = Math.min(
    MAX_INSTANCE_COUNT,
    Math.max(3, config?.challengeCount ?? DEFAULT_INSTANCE_COUNT),
  );

  const prompt = `Pick the target letter SOUNDS for a brisk kindergarten Direct Instruction practice.

TOPIC: "${topic}"${intent ? `\nOBJECTIVE FOCUS: "${intent}"` : ''}

You may ONLY choose from these letters (each has a continuous, stretchable sound a child can hold, or a short vowel):
${MENU_LETTERS.join(', ')}

RULES:
- Choose the ${count} letters whose SOUNDS best match the topic/objective. If the objective names specific letters, use those (only if they are in the allowed set). If it is generic ("letter sounds", "phonics"), pick a spread of the easiest continuous sounds (m, s, f, and a short vowel like a).
- These are letter SOUNDS, never letter NAMES. Never choose a letter outside the allowed set.
- Write a warm, short kid title and a one-sentence description. Never reveal or spell out the sounds in the title or description.

Return the wrapper JSON only.`;

  // Resolve which eval-mode SKILL(s) this objective calls for. Fork A: the
  // resolution drives which challenge types we BUILD (no schema enum exists).
  const resolution = await resolveEvalModes(
    'di-letter-sounds',
    { targetEvalMode: config?.targetEvalMode, intent, objectiveText: config?.objectiveText },
    CHALLENGE_TYPE_DOCS,
  );
  const modeTypes: DiLetterSoundChallengeType[] = (resolution?.allowedTypes as DiLetterSoundChallengeType[] | undefined)
    ?? ['letter_sound', 'letter_sound_review', 'first_sound_in_word']; // mixed = all three

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
