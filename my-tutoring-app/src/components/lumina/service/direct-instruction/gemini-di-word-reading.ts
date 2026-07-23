/**
 * gemini-di-word-reading — menu-scoped generator for the di-word-reading
 * primitive. Fork A (pool service): the item CONTENT is a curated word menu
 * owned in code — decodable CVC words grouped by short vowel plus a
 * high-frequency sight-word set. Gemini's only job is to SELECT which words
 * the objective is about (from the menu) and write a kid title. Graphemes,
 * reward emoji, word type, and ASR aliases are attached deterministically
 * from the menu — the rhyme-studio K pattern (entropy in the prompt,
 * attachments in code), because flash-lite is unreliable at emitting nested
 * per-item content and structured output is convergent on values.
 *
 * SCOPE: short-vowel CVC words + a starter sight-word set. The objective's
 * phonics pattern is code-enforced: a "short a" objective binds every CVC
 * word to /a/ (resolveScopedVowels mirror of word-workout's family); a
 * sight-word objective draws from the sight set. No DEFAULT_ITEMS-style
 * content ships from the component; all items originate here.
 *
 * EVAL MODES (L0) — ONE task identity at birth: `read_word`. Ladder
 * candidates (cvc_reading / sight_word / word_reading_review) are queued on
 * the birth certificate for /add-eval-modes — not built now. The
 * resolveEvalModes call is wired so the eventual ladder drops in without
 * reshaping this generator; today every resolution lands on read_word.
 */

import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import { resolveEvalModes, type ChallengeTypeDoc } from "../evalMode";
import type {
  DiWordReadingData,
  DiWordReadingChallenge,
} from "../../primitives/visual-primitives/direct-instruction/DiWordReading";
import type { DiWordReadingChallengeType } from "../../primitives/visual-primitives/direct-instruction/diWordReadingScript";

type ShortVowel = 'a' | 'e' | 'i' | 'o' | 'u';

/** One curated menu entry: everything the tutor and the reward need. */
interface MenuEntry {
  word: string;
  wordType: 'cvc' | 'sight';
  /** The short vowel a CVC word drills — the phonics-pattern scoping key. */
  vowel?: ShortVowel;
  /** Graphemes for the sound-out model (CVC only). */
  graphemes?: string[];
  /** POST-affirmation reward picture only (answer-leak rule: the answer IS
   *  the printed word, so nothing pictures it before the read). Sight words
   *  carry none — they just affirm. */
  emoji?: string;
  /** Passive ASR cross-check aliases incl. near-neighbour homophones. */
  asrAliases: string[];
}

const cvc = (
  word: string,
  vowel: ShortVowel,
  emoji?: string,
  extraAliases: string[] = [],
): MenuEntry => ({
  word,
  wordType: 'cvc',
  vowel,
  graphemes: word.split(''),
  ...(emoji ? { emoji } : {}),
  asrAliases: [word, ...extraAliases],
});

const sight = (word: string, extraAliases: string[] = []): MenuEntry => ({
  word,
  wordType: 'sight',
  asrAliases: [word, ...extraAliases],
});

/**
 * The curated word menu. Every CVC word is short-vowel decodable with
 * single-letter graphemes (no digraphs/blends — unbenched); sight words are
 * the earliest high-frequency set. Near-neighbour homophones (sun/son,
 * red/read, see/sea) stay in the aliases so runs can report them.
 */
const WORD_MENU: Record<string, MenuEntry> = {
  // ── short a ──────────────────────────────────────────────────────
  sam: cvc('sam', 'a'),
  mat: cvc('mat', 'a', undefined, ['matt']),
  cat: cvc('cat', 'a', '🐱'),
  hat: cvc('hat', 'a', '🎩'),
  pan: cvc('pan', 'a', '🍳'),
  map: cvc('map', 'a', '🗺️'),
  // ── short e ──────────────────────────────────────────────────────
  red: cvc('red', 'e', '🔴', ['read']),
  hen: cvc('hen', 'e', '🐔'),
  net: cvc('net', 'e', '🥅'),
  pen: cvc('pen', 'e', '🖊️'),
  bed: cvc('bed', 'e', '🛏️'),
  leg: cvc('leg', 'e', '🦵'),
  // ── short i ──────────────────────────────────────────────────────
  pig: cvc('pig', 'i', '🐷'),
  sit: cvc('sit', 'i'),
  pin: cvc('pin', 'i', '📌'),
  lip: cvc('lip', 'i', '👄'),
  dig: cvc('dig', 'i'),
  big: cvc('big', 'i'),
  // ── short o ──────────────────────────────────────────────────────
  dog: cvc('dog', 'o', '🐶', ['dawg']),
  pot: cvc('pot', 'o', '🍲'),
  hot: cvc('hot', 'o', '🔥'),
  log: cvc('log', 'o', '🪵'),
  mop: cvc('mop', 'o'),
  top: cvc('top', 'o'),
  // ── short u ──────────────────────────────────────────────────────
  sun: cvc('sun', 'u', '☀️', ['son']),
  cup: cvc('cup', 'u', '🥤'),
  bug: cvc('bug', 'u', '🐛'),
  run: cvc('run', 'u', '🏃'),
  tub: cvc('tub', 'u', '🛁'),
  mud: cvc('mud', 'u'),
  // ── sight words (whole-word recall — no picture, no sound-out) ──
  the: sight('the', ['thee', 'duh']),
  see: sight('see', ['sea', 'c']),
  go: sight('go'),
  to: sight('to', ['two', 'too']),
  is: sight('is'),
  we: sight('we', ['wee']),
  my: sight('my'),
  and: sight('and'),
};

const MENU_WORDS = Object.keys(WORD_MENU);
const SIGHT_WORDS = MENU_WORDS.filter((w) => WORD_MENU[w].wordType === 'sight');
const cvcWordsForVowels = (vowels: ShortVowel[] | null): string[] =>
  MENU_WORDS.filter((w) => {
    const e = WORD_MENU[w];
    return e.wordType === 'cvc' && (!vowels || (e.vowel && vowels.includes(e.vowel)));
  });

const DEFAULT_INSTANCE_COUNT = 4;
const MAX_INSTANCE_COUNT = 6;
/** Sensible starter set when the objective names no menu words: an easy CVC
 *  spread across vowels plus one sight word (mirrors the bench probe mix). */
const DEFAULT_WORDS = ['sam', 'pig', 'sun', 'the'];

/** Skill docs for the intent→mode router (Fork A — no schema to constrain).
 *  One identity at birth; /add-eval-modes widens this record later. */
const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  read_word: {
    promptDoc:
      `"read_word": the child sees ONE printed word and reads it aloud — blend-and-read for a decodable CVC word, whole-word recall for a sight word. The base skill.`,
    schemaDescription: "'read_word' (read the printed word aloud)",
  },
};

/** Gemini emits ONLY the wrapper — never the per-item content (Fork A). */
const wrapperSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description:
        "Short, warm activity title for a beginning reader (e.g. 'Word Time!'). Do NOT put any of the target words in it.",
    },
    description: {
      type: Type.STRING,
      description:
        "One friendly sentence telling the child they will read some words out loud. Do NOT name the target words.",
    },
    targetWords: {
      type: Type.ARRAY,
      items: { type: Type.STRING, enum: MENU_WORDS },
      description:
        "The 4-5 words (from the allowed set only) this objective is about, in a sensible teaching order. " +
        "Named words win; a phonics pattern (like short a) means CVC words with that vowel; a sight-word " +
        "objective means words from the sight set; a generic objective means an easy CVC spread across " +
        "vowels plus one sight word.",
    },
  },
  required: ["title", "targetWords"],
};

/**
 * Short vowel(s) the objective names, or null if it is vowel-generic.
 * Mirrors word-workout's resolveScopedVowels: a "short a" lesson binds every
 * CVC word to /a/. Code-enforced after selection (the LLM window is advisory;
 * code builds the structure).
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

/** Scan free text for menu words named as targets (fallback + safety net). */
const scanWordsFromText = (text: string): string[] => {
  const lower = text.toLowerCase();
  const found: string[] = [];
  for (const word of MENU_WORDS) {
    const re = new RegExp(`(^|[^a-z])${word}([^a-z]|$)`);
    if (re.test(lower)) found.push(word);
  }
  return found;
};

/** Dedupe (order-preserving), keep menu words only, and cap. */
const takeUnique = (source: string[], n: number): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of source) {
    if (!(w in WORD_MENU) || seen.has(w)) continue;
    seen.add(w);
    out.push(w);
    if (out.length >= n) break;
  }
  return out;
};

const buildChallenge = (
  word: string,
  index: number,
  type: DiWordReadingChallengeType,
): DiWordReadingChallenge => {
  const entry = WORD_MENU[word];
  return {
    id: `diwr-${index + 1}-${word}`,
    challengeType: type,
    word: entry.word,
    wordType: entry.wordType,
    ...(entry.graphemes ? { graphemes: entry.graphemes } : {}),
    ...(entry.emoji ? { emoji: entry.emoji } : {}),
    asrAliases: entry.asrAliases,
  };
};

export const generateDiWordReading = async (
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
): Promise<DiWordReadingData> => {
  const intent = config?.intent;
  const count = Math.min(
    MAX_INSTANCE_COUNT,
    Math.max(3, config?.challengeCount ?? DEFAULT_INSTANCE_COUNT),
  );

  // The objective's phonics scope, resolved from ALL the text we have and
  // code-enforced below (topic/objective beats whatever the model picks).
  const scopeText = `${intent ?? ''} ${config?.objectiveText ?? ''} ${topic}`;
  const scopedVowels = resolveScopedVowels(scopeText);
  const sightScoped = resolveSightScope(scopeText);

  const prompt = `Pick the target WORDS for a brisk Direct Instruction word-reading practice (beginning reader).

TOPIC: "${topic}"${intent ? `\nOBJECTIVE FOCUS: "${intent}"` : ''}

You may ONLY choose from these words:
- Decodable CVC: ${cvcWordsForVowels(null).join(', ')}
- Sight words: ${SIGHT_WORDS.join(', ')}

RULES:
- Choose the ${count} words that best match the topic/objective. If the objective names specific words, use those (only if they are in the allowed set).
- If the objective names a phonics pattern (like "short a"), choose ONLY CVC words with that vowel.${scopedVowels ? `\n- HARD VOWEL SCOPE: this objective is about short ${scopedVowels.join(', ')} — every CVC word you pick MUST use only that vowel.` : ''}
- If the objective is about sight words / high-frequency words, choose ONLY from the sight list.
- If it is generic ("word reading", "decoding"), pick an easy CVC spread across different vowels plus one sight word.
- Write a warm, short kid title and a one-sentence description. Never put any target word in the title or description — the child must read the words, not hear them first.

Return the wrapper JSON only.`;

  // Resolve which eval-mode SKILL this objective calls for. One identity at
  // birth — every resolution lands on read_word; the call is wired so the
  // /add-eval-modes ladder drops in without reshaping this generator.
  const resolution = await resolveEvalModes(
    'di-word-reading',
    { targetEvalMode: config?.targetEvalMode, intent, objectiveText: config?.objectiveText },
    CHALLENGE_TYPE_DOCS,
  );
  const modeType: DiWordReadingChallengeType =
    (resolution?.allowedTypes?.[0] as DiWordReadingChallengeType | undefined) ?? 'read_word';

  let selected: string[] = [];
  let title = 'Word Reading';
  let description = 'Let’s read some words out loud together!';

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: wrapperSchema,
        systemInstruction:
          "You are an early-reading specialist scoping a Direct Instruction word-reading drill. " +
          "You select target words from an allowed menu only, in a sensible teaching order, and you " +
          "never reveal the target words in the title or description.",
      },
    });
    const text = response.text;
    if (text) {
      const parsed = JSON.parse(text) as {
        title?: string;
        description?: string;
        targetWords?: unknown;
      };
      if (typeof parsed.title === 'string' && parsed.title.trim()) title = parsed.title.trim();
      if (typeof parsed.description === 'string' && parsed.description.trim()) {
        description = parsed.description.trim();
      }
      if (Array.isArray(parsed.targetWords)) {
        selected = parsed.targetWords
          .map((w) => String(w).toLowerCase().trim())
          .filter((w) => w in WORD_MENU);
      }
    }
  } catch (error) {
    console.error("Error generating di-word-reading wrapper:", error);
  }

  // Fallback ladder: model selection → scan the objective/topic → scoped pool
  // → starter set.
  if (selected.length === 0) {
    selected = scanWordsFromText(scopeText);
  }

  // Code-enforce the objective's scope over whatever was selected (the census
  // lesson: the prompt asks, the code guarantees).
  if (scopedVowels) {
    const scopedPool = cvcWordsForVowels(scopedVowels);
    selected = selected.filter((w) => scopedPool.includes(w));
    selected = takeUnique([...selected, ...scopedPool], count);
  } else if (sightScoped) {
    selected = selected.filter((w) => SIGHT_WORDS.includes(w));
    selected = takeUnique([...selected, ...SIGHT_WORDS], count);
  } else {
    if (selected.length === 0) selected = [...DEFAULT_WORDS];
    selected = takeUnique([...selected, ...DEFAULT_WORDS, ...MENU_WORDS], count);
  }

  let challenges = selected.map((word, i) => buildChallenge(word, i, modeType));

  // Guarantee a runnable session even if every scope filter emptied out.
  if (challenges.length === 0) {
    challenges = DEFAULT_WORDS.map((word, i) => buildChallenge(word, i, 'read_word'));
  }

  const data: DiWordReadingData = {
    title,
    description,
    challengeType: challenges[0]?.challengeType ?? 'read_word',
    gradeLevel: gradeLevel || 'kindergarten',
    challenges,
  };

  console.log("DI Word Reading Generated:", {
    title: data.title,
    mode: resolution ? `${resolution.modes.map((m) => m.evalMode).join('+')} (${resolution.source})` : 'read_word',
    scope: scopedVowels ? `short ${scopedVowels.join(',')}` : sightScoped ? 'sight words' : 'generic',
    words: challenges.map((c) => `${c.word}(${c.wordType})`),
    count: challenges.length,
  });

  return data;
};
