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
 */

import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type {
  DiLetterSoundsData,
  DiLetterSoundChallenge,
} from "../../primitives/visual-primitives/direct-instruction/DiLetterSounds";

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
const DEFAULT_INSTANCE_COUNT = 4;
const MAX_INSTANCE_COUNT = 6;
/** Sensible starter set when the objective names no menu letters. */
const DEFAULT_LETTERS = ['m', 's', 'a', 'f'];

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

const buildChallenge = (letter: string, index: number): DiLetterSoundChallenge => {
  const entry = LETTER_SOUND_MENU[letter];
  return {
    id: `dils-${index + 1}-${letter}`,
    challengeType: 'letter_sound',
    letter: entry.letter,
    spoken: entry.spoken,
    keyword: entry.keyword,
    emoji: entry.emoji,
    elicitation: entry.elicitation,
    asrAliases: entry.asrAliases,
  };
};

export const generateDiLetterSounds = async (
  topic: string,
  gradeLevel: string,
  config?: { intent?: string; challengeCount?: number; [key: string]: unknown },
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

  // Dedupe (preserve order) and cap to the instance count.
  const seen = new Set<string>();
  const letters: string[] = [];
  for (const l of selected) {
    if (seen.has(l)) continue;
    seen.add(l);
    letters.push(l);
    if (letters.length >= count) break;
  }
  // Back-fill from the starter/menu if the objective was narrow (< 3 items),
  // so a session always has enough to demonstrate mastery.
  for (const l of [...DEFAULT_LETTERS, ...MENU_LETTERS]) {
    if (letters.length >= Math.min(count, DEFAULT_INSTANCE_COUNT)) break;
    if (!seen.has(l)) {
      seen.add(l);
      letters.push(l);
    }
  }

  const challenges = letters.map((letter, i) => buildChallenge(letter, i));

  const data: DiLetterSoundsData = {
    title,
    description,
    challengeType: 'letter_sound',
    gradeLevel: gradeLevel || 'kindergarten',
    challenges,
  };

  console.log("DI Letter Sounds Generated:", {
    title: data.title,
    letters: challenges.map((c) => c.letter),
    count: challenges.length,
  });

  return data;
};
