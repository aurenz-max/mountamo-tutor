import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import type {
  WordFlipData,
  WordFlipChallenge,
} from "../../primitives/visual-primitives/literacy/WordFlip";

// ---------------------------------------------------------------------------
// WORD FLIP generator (L0 birth: plural_s only).
//
// K-1 spoken grammar transformations. The child sees a counted-picture frame
// ("One dog 🐕 · Three ___?") and SAYS the regular -s plural ("dogs"); tap
// chips are the receptive fallback.
//
// DESIGN SPLIT (the load-bearing decision): Gemini authors ONLY the noun pool
// — { word, emoji } pairs themed to the topic. Code derives EVERYTHING else
// deterministically: answer = word + 's', the 3 chips (answer / bare singular /
// over-regularized "-ses"), and the many-side count. The transformation rule
// IS the answer key, so stimulus and answer can never desync. This mirrors the
// "LLM emits scope-bound content, code builds structure + answer" doctrine.
//
// L0 NOTE: no resolveEvalModes / constrainChallengeTypeEnum here — the single
// mode is 'plural_s'. /add-eval-modes widens the ladder (plural_es,
// article_choice, verb_past, irregulars) later.
// ---------------------------------------------------------------------------

const MODEL = 'gemini-flash-lite-latest';

// ---------------------------------------------------------------------------
// Seed nouns — the entropy injection. Structured-output Gemini is convergent
// on values (same nouns every call otherwise), so we shuffle ~8 of these into
// every prompt as suggestions (the skip-counting entropy pattern: entropy
// belongs in the prompt). EVERY seed must pass validateNounPool's own guards
// — no s/x/z/ch/sh/o endings, no f/fe endings, no consonant+y, no irregulars.
// ---------------------------------------------------------------------------

const SEED_NOUNS: ReadonlyArray<{ word: string; emoji: string }> = [
  { word: 'dog', emoji: '🐕' },
  { word: 'cat', emoji: '🐈' },
  { word: 'bird', emoji: '🐦' },
  { word: 'tree', emoji: '🌳' },
  { word: 'star', emoji: '⭐' },
  { word: 'book', emoji: '📖' },
  { word: 'hat', emoji: '🎩' },
  { word: 'car', emoji: '🚗' },
  { word: 'boat', emoji: '⛵' },
  { word: 'bear', emoji: '🐻' },
  { word: 'duck', emoji: '🦆' },
  { word: 'frog', emoji: '🐸' },
  { word: 'crab', emoji: '🦀' },
  { word: 'cloud', emoji: '☁️' },
  { word: 'flower', emoji: '🌸' },
  { word: 'apple', emoji: '🍎' },
  { word: 'shell', emoji: '🐚' },
  { word: 'sock', emoji: '🧦' },
  { word: 'shoe', emoji: '👟' },
  { word: 'ball', emoji: '⚽' },
  { word: 'kite', emoji: '🪁' },
  { word: 'drum', emoji: '🥁' },
  { word: 'bell', emoji: '🔔' },
  { word: 'crayon', emoji: '🖍️' },
  { word: 'spoon', emoji: '🥄' },
  { word: 'chair', emoji: '🪑' },
  { word: 'door', emoji: '🚪' },
  { word: 'truck', emoji: '🚚' },
  { word: 'plane', emoji: '✈️' },
  { word: 'snail', emoji: '🐌' },
  { word: 'turtle', emoji: '🐢' },
  { word: 'rock', emoji: '🪨' },
  { word: 'moon', emoji: '🌙' },
  { word: 'cup', emoji: '🥤' },
  { word: 'pig', emoji: '🐷' },
  { word: 'cow', emoji: '🐮' },
];

// Irregular plurals a K child might meet — reject even if the ending regexes
// wouldn't catch them (some, like leaf/wolf/knife, are also caught by f/fe).
const IRREGULARS = new Set([
  'man', 'woman', 'child', 'foot', 'tooth', 'goose', 'mouse', 'person',
  'sheep', 'fish', 'deer', 'ox', 'die', 'leaf', 'wolf', 'knife', 'life',
]);

// ---------------------------------------------------------------------------
// Schema — tiny, flat, bounded: { title, description, nouns: [{word, emoji}] }.
// No answers, no distractors, no counts — code derives all of those.
// ---------------------------------------------------------------------------

const buildNounPoolSchema = (): Schema => ({
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Engaging, kid-friendly session title including the topic (e.g., 'One and Many at the Farm!').",
    },
    description: {
      type: Type.STRING,
      description: "One friendly sentence telling a Kindergartner what they'll do (see one thing, then more — say the new word). NO answer words.",
    },
    nouns: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          word: {
            type: Type.STRING,
            description: "One lowercase concrete noun a 5-year-old knows (letters only, 2-12 chars) whose plural is formed by JUST ADDING -s (dog → dogs).",
          },
          emoji: {
            type: Type.STRING,
            description: "Exactly one emoji that clearly IS this noun (dog → 🐕).",
          },
        },
        required: ["word", "emoji"],
      },
      description: "12-16 distinct concrete, picturable Kindergarten nouns whose plural is formed by JUST ADDING -s.",
    },
  },
  required: ["title", "description", "nouns"],
});

// ---------------------------------------------------------------------------
// Raw shapes (everything optional — Gemini may drop or malform any field).
// ---------------------------------------------------------------------------

interface RawNoun {
  word?: string;
  emoji?: string;
}

interface RawNounPool {
  title?: string;
  description?: string;
  nouns?: RawNoun[];
}

/** A noun that survived validation — safe to build a challenge from. */
interface ValidNoun {
  word: string;
  emoji: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const shuffle = <T,>(arr: readonly T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// ---------------------------------------------------------------------------
// Validation — REJECT, never fabricate. The regular-plural guard is the
// load-bearing check: it is what makes `word + 's'` a TRUE answer key.
// ---------------------------------------------------------------------------

const validateNounPool = (raw: RawNounPool): ValidNoun[] => {
  const survivors: ValidNoun[] = [];
  const seenWords = new Set<string>();
  let rejected = 0;

  for (const n of raw.nouns ?? []) {
    const word = n.word?.trim().toLowerCase() ?? '';
    const emoji = n.emoji?.trim() ?? '';

    // 1. Word shape: lowercase letters only, 2-12 chars.
    if (!/^[a-z]{2,12}$/.test(word)) { rejected += 1; continue; }

    // 2. REGULAR-PLURAL GUARD (code-enforced): the plural must be formed by
    //    adding ONLY -s. Reject -es takers (s/x/z/ch/sh/o endings), f/fe → -ves
    //    words, consonant+y → -ies words, and known irregulars.
    if (
      /(s|x|z|ch|sh|o)$/.test(word)
      || /(f|fe)$/.test(word)
      || /[^aeiou]y$/.test(word)
      || IRREGULARS.has(word)
    ) { rejected += 1; continue; }

    // 3. Emoji: non-empty and actually an emoji (contains non-ASCII).
    if (!emoji || /^[a-z0-9\s]*$/i.test(emoji)) { rejected += 1; continue; }

    // 4. Dedupe words across the pool.
    if (seenWords.has(word)) { rejected += 1; continue; }
    seenWords.add(word);

    survivors.push({ word, emoji });
  }

  if (rejected > 0) {
    console.warn(`[WordFlip] rejected ${rejected} malformed noun${rejected === 1 ? '' : 's'} (${survivors.length} survived)`);
  }
  return survivors;
};

// ---------------------------------------------------------------------------
// Gemini call — throws on empty/unparseable output (never fabricates).
// ---------------------------------------------------------------------------

const SYSTEM_INSTRUCTION =
  `You are an expert early-childhood language specialist. You supply pools of concrete, picturable `
  + `nouns for a Kindergarten "one → many" plural game. Every noun you give MUST form its plural by `
  + `JUST ADDING -s (dog → dogs). NEVER give: words ending in s, x, z, ch, or sh (they take -es); `
  + `words ending in o (potato); words ending in f or fe (leaf → leaves); words ending in a consonant + y `
  + `(puppy → puppies); or ANY irregular plural (man, child, foot, tooth, mouse, goose, person, sheep, `
  + `fish, deer). Every noun is a real common word a 5-year-old knows, lowercase, letters only, and comes `
  + `with EXACTLY ONE emoji that clearly depicts it. All nouns in a pool are distinct.`;

const callGemini = async (schema: Schema, prompt: string, corrective?: string): Promise<RawNounPool> => {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: corrective ? `${prompt}\n\n${corrective}` : prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: schema,
      systemInstruction: SYSTEM_INSTRUCTION,
    },
  });
  const text = response.text;
  if (!text) throw new Error('No data returned from Gemini API');
  return JSON.parse(text) as RawNounPool;
};

const buildPrompt = (
  topic: string,
  intent: string | undefined,
  grade: string,
  seedHint: string,
): string =>
  `Give a pool of concrete Kindergarten nouns for a "one → many" plural game. The child sees ONE of a
thing ("one dog 🐕"), then several of it, and says the new word ("dogs"). Theme the nouns to the topic
where it fits naturally; a plain everyday noun is always better than a forced on-topic one.
Topic: "${topic}".${intent ? `\nSPECIFIC FOCUS: lean noun choices toward "${intent}" when possible — but ALWAYS prioritize simple, picturable, Kindergarten-known nouns over this focus.` : ''}
TARGET GRADE LEVEL: ${grade}

Produce 12-16 distinct nouns, each with exactly one emoji.

HARD RULES for every word (any violation makes the word unusable):
- lowercase, letters only, 2-12 characters, a real common noun a 5-year-old knows.
- the plural MUST be formed by adding ONLY -s (dog → dogs).
- FORBIDDEN: words ending in s, x, z, ch, or sh (they take -es); words ending in o (potato);
  words ending in f or fe (leaf → leaves); words ending in a consonant + y (puppy → puppies);
  ALL irregular plurals (man, child, foot, tooth, mouse, goose, person, sheep, fish, deer).
- each noun gets EXACTLY ONE emoji that clearly depicts it.
- all nouns distinct.

Good candidates if they fit the topic (feel free to use others that fit better): ${seedHint}.

Also provide:
- title: a fun, kid-friendly session title including the topic.
- description: one friendly sentence telling the child what they'll do (see one thing, then more — say the new word).`;

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export const generateWordFlip = async (ctx: GenerationContext): Promise<WordFlipData> => {
  const { topic } = ctx;
  const intent = ctx.intent;
  const grade = ctx.gradeContext;

  const schema = buildNounPoolSchema();
  const seedHint = shuffle(SEED_NOUNS)
    .slice(0, 8)
    .map(s => `${s.word} ${s.emoji}`)
    .join(', ');

  try {
    const prompt = buildPrompt(topic, intent, grade, seedHint);

    // First pass.
    let raw = await callGemini(schema, prompt);
    let pool = validateNounPool(raw);

    // One corrective retry if the pool can't fill a 5-challenge session (never fabricate).
    if (pool.length < 5) {
      console.warn(`[WordFlip] only ${pool.length}/5 usable nouns — retrying once`);
      raw = await callGemini(schema, prompt,
        `PREVIOUS ATTEMPT REJECTED: too few usable nouns. Regenerate 16 nouns. For EACH noun: `
        + `(1) lowercase letters only, 2-12 chars, a real noun a 5-year-old knows; `
        + `(2) the plural MUST be formed by adding ONLY -s — NO words ending in s, x, z, ch, sh, or o, `
        + `NO words ending in f or fe, NO words ending in a consonant + y, NO irregular plurals `
        + `(man, child, foot, tooth, mouse, goose, person, sheep, fish, deer); `
        + `(3) exactly one emoji that clearly depicts the noun; `
        + `(4) all nouns distinct.`);
      const retryPool = validateNounPool(raw);
      // Keep whichever attempt yielded more usable nouns.
      if (retryPool.length > pool.length) pool = retryPool;
    }

    const title = raw.title?.trim() || '';
    const description = raw.description?.trim() || '';

    if (pool.length < 5) {
      throw new Error(`[WordFlip] Noun pool too small after retry: ${pool.length}/5 usable nouns`);
    }
    if (!title || !description) {
      throw new Error('[WordFlip] Gemini pool missing title/description');
    }

    // Counts 2-5 with guaranteed variety: one of each, plus one random repeat,
    // shuffled — the 5 challenges can never share a single count monoculture.
    const COUNT_CHOICES = [2, 3, 4, 5];
    const counts = shuffle([
      ...COUNT_CHOICES,
      COUNT_CHOICES[Math.floor(Math.random() * COUNT_CHOICES.length)],
    ]);

    // Assemble 5 challenges — code derives answer + chips from the rule.
    // Chips: the answer, the bare singular (no plural marking), and the
    // over-regularized "-ses" form — the two authentic K error shapes.
    const selected = shuffle(pool).slice(0, 5);
    const challenges: WordFlipChallenge[] = selected.map((n, i) => ({
      id: `word-flip-${i + 1}`,
      type: 'plural_s',
      singular: n.word,
      answer: `${n.word}s`,
      emoji: n.emoji,
      count: counts[i],
      options: shuffle([`${n.word}s`, n.word, `${n.word}ses`]),
    }));

    const data: WordFlipData = {
      title,
      description,
      challengeType: 'plural_s',
      challenges,
      gradeLevel: ctx.gradeContext,
    };

    console.log('Word Flip Generated:', {
      title: data.title,
      poolSize: pool.length,
      challengeCount: challenges.length,
      words: challenges.map(c => c.singular),
      counts: challenges.map(c => c.count),
    });

    return data;
  } catch (error) {
    console.error('Error generating word flip:', error);
    throw error;
  }
};
