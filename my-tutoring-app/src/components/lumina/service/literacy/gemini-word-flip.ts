import { Type, Schema } from '@google/genai';
import { ai } from '../geminiClient';
import type { GenerationContext } from '../generation/generationContext';
import type {
  WordFlipChallenge,
  WordFlipChallengeType,
  WordFlipData,
} from '../../primitives/visual-primitives/literacy/WordFlip';
import {
  buildModeConstraintSection,
  constrainChallengeTypeEnum,
  resolveEvalModes,
  type ChallengeTypeDoc,
} from '../evalMode';

// ---------------------------------------------------------------------------
// WORD FLIP generator (K-2: spoken morphology transformations).
//
// Gemini authors only typed, picturable noun/action candidates. Code validates
// each word against its declared transformation and derives every answer. The model
// never authors an answer key, so the counted-picture stimulus and spoken
// target cannot desynchronize.
//
// The DI port removed answer chips. The child sees either one -> many or
// today -> yesterday and says the transformed word into the same live judged
// loop. Every mode below has its own validated word pool and response contract.
// ---------------------------------------------------------------------------

const MODEL = 'gemini-flash-lite-latest';

const ALL_CHALLENGE_TYPES: WordFlipChallengeType[] = [
  'plural_s',
  'plural_es',
  'past_ed',
  'plural_y',
  'irregulars',
  'past_irregular',
];

const CHALLENGE_TYPE_DOCS: Record<WordFlipChallengeType, ChallengeTypeDoc> = {
  plural_s: {
    promptDoc:
      `"plural_s": regular one-to-many nouns formed by adding only -s (dog -> dogs). `
      + `Use common concrete K-1 nouns; exclude -es, y->ies, f/fe->ves, and irregular forms.`,
    schemaDescription: "'plural_s' (add -s)",
  },
  plural_es: {
    promptDoc:
      `"plural_es": regular one-to-many nouns ending in s, x, ch, or sh and formed by adding -es `
      + `(bus -> buses, fox -> foxes, dish -> dishes). Exclude z and o endings because their spelling is not uniform.`,
    schemaDescription: "'plural_es' (add -es)",
  },
  plural_y: {
    promptDoc:
      `"plural_y": regular one-to-many nouns ending in consonant+y and formed by changing y to -ies `
      + `(baby -> babies, puppy -> puppies). Exclude vowel+y nouns such as toy and key.`,
    schemaDescription: "'plural_y' (change consonant+y to -ies)",
  },
  irregulars: {
    promptDoc:
      `"irregulars": common one-to-many nouns whose plural is code-owned and recalled rather than built `
      + `(mouse -> mice, child -> children, foot -> feet). Use only the supplied irregular candidates.`,
    schemaDescription: "'irregulars' (recall an irregular plural)",
  },
  past_ed: {
    promptDoc:
      `"past_ed": familiar action verbs whose past form is made by adding only -ed `
      + `(jump -> jumped, walk -> walked). Use only the supplied regular-verb candidates.`,
    schemaDescription: "'past_ed' (add -ed to an action word)",
  },
  past_irregular: {
    promptDoc:
      `"past_irregular": familiar action verbs with a code-owned irregular past form `
      + `(run -> ran, go -> went). Use only the supplied irregular-verb candidates.`,
    schemaDescription: "'past_irregular' (recall an irregular past form)",
  },
};

type SeedNoun = { word: string; emoji: string };

const PLURAL_S_SEEDS: readonly SeedNoun[] = [
  { word: 'dog', emoji: '🐕' }, { word: 'cat', emoji: '🐈' },
  { word: 'bird', emoji: '🐦' }, { word: 'tree', emoji: '🌳' },
  { word: 'star', emoji: '⭐' }, { word: 'book', emoji: '📖' },
  { word: 'hat', emoji: '🎩' }, { word: 'car', emoji: '🚗' },
  { word: 'boat', emoji: '⛵' }, { word: 'bear', emoji: '🐻' },
  { word: 'duck', emoji: '🦆' }, { word: 'frog', emoji: '🐸' },
  { word: 'crab', emoji: '🦀' }, { word: 'cloud', emoji: '☁️' },
  { word: 'flower', emoji: '🌸' }, { word: 'apple', emoji: '🍎' },
  { word: 'shell', emoji: '🐚' }, { word: 'sock', emoji: '🧦' },
  { word: 'shoe', emoji: '👟' }, { word: 'ball', emoji: '⚽' },
  { word: 'kite', emoji: '🪁' }, { word: 'drum', emoji: '🥁' },
  { word: 'bell', emoji: '🔔' }, { word: 'spoon', emoji: '🥄' },
  { word: 'chair', emoji: '🪑' }, { word: 'door', emoji: '🚪' },
  { word: 'truck', emoji: '🚚' }, { word: 'plane', emoji: '✈️' },
  { word: 'snail', emoji: '🐌' }, { word: 'turtle', emoji: '🐢' },
  { word: 'rock', emoji: '🪨' }, { word: 'moon', emoji: '🌙' },
  { word: 'cup', emoji: '🥤' }, { word: 'pig', emoji: '🐷' },
  { word: 'cow', emoji: '🐮' },
];

const PLURAL_ES_SEEDS: readonly SeedNoun[] = [
  { word: 'bus', emoji: '🚌' }, { word: 'box', emoji: '📦' },
  { word: 'fox', emoji: '🦊' }, { word: 'dish', emoji: '🍽️' },
  { word: 'brush', emoji: '🪥' }, { word: 'watch', emoji: '⌚' },
  { word: 'bench', emoji: '🪑' }, { word: 'peach', emoji: '🍑' },
  { word: 'dress', emoji: '👗' }, { word: 'glass', emoji: '🥛' },
  { word: 'sandwich', emoji: '🥪' }, { word: 'church', emoji: '⛪' },
];

const PLURAL_Y_SEEDS: readonly SeedNoun[] = [
  { word: 'baby', emoji: '👶' }, { word: 'puppy', emoji: '🐶' },
  { word: 'bunny', emoji: '🐰' }, { word: 'pony', emoji: '🐴' },
  { word: 'cherry', emoji: '🍒' }, { word: 'fly', emoji: '🪰' },
  { word: 'butterfly', emoji: '🦋' }, { word: 'lady', emoji: '👩' },
  { word: 'city', emoji: '🏙️' }, { word: 'berry', emoji: '🫐' },
  { word: 'family', emoji: '👪' }, { word: 'candy', emoji: '🍬' },
];

/** Code-owned irregular answer key. Gemini may select these nouns, but it
 * cannot invent an irregular transformation. */
const IRREGULAR_PLURALS: Readonly<Record<string, string>> = {
  man: 'men', woman: 'women', child: 'children', foot: 'feet',
  tooth: 'teeth', goose: 'geese', mouse: 'mice', person: 'people',
  ox: 'oxen',
};

const IRREGULAR_SEEDS: readonly SeedNoun[] = [
  { word: 'man', emoji: '👨' }, { word: 'woman', emoji: '👩' },
  { word: 'child', emoji: '🧒' }, { word: 'foot', emoji: '🦶' },
  { word: 'tooth', emoji: '🦷' }, { word: 'goose', emoji: '🪿' },
  { word: 'mouse', emoji: '🐁' }, { word: 'person', emoji: '🧍' },
  { word: 'ox', emoji: '🐂' },
];

const PAST_ED_SEEDS: readonly SeedNoun[] = [
  { word: 'jump', emoji: '🤾' }, { word: 'walk', emoji: '🚶' },
  { word: 'play', emoji: '🤸' }, { word: 'help', emoji: '🤝' },
  { word: 'look', emoji: '👀' }, { word: 'wash', emoji: '🧼' },
  { word: 'kick', emoji: '🦵' }, { word: 'cook', emoji: '🧑‍🍳' },
  { word: 'paint', emoji: '🎨' }, { word: 'clean', emoji: '🧹' },
  { word: 'open', emoji: '🚪' }, { word: 'laugh', emoji: '😂' },
];

const IRREGULAR_PAST: Readonly<Record<string, string>> = {
  go: 'went', run: 'ran', eat: 'ate', see: 'saw', come: 'came',
  sit: 'sat', get: 'got', make: 'made', take: 'took', give: 'gave',
  have: 'had', do: 'did', say: 'said', sleep: 'slept',
};

const PAST_IRREGULAR_SEEDS: readonly SeedNoun[] = [
  { word: 'go', emoji: '🚶' }, { word: 'run', emoji: '🏃' },
  { word: 'eat', emoji: '🍽️' }, { word: 'see', emoji: '👀' },
  { word: 'come', emoji: '👋' }, { word: 'sit', emoji: '🪑' },
  { word: 'get', emoji: '🎁' }, { word: 'make', emoji: '🛠️' },
  { word: 'take', emoji: '🤲' }, { word: 'give', emoji: '🎁' },
  { word: 'have', emoji: '🤲' }, { word: 'do', emoji: '✅' },
  { word: 'say', emoji: '💬' }, { word: 'sleep', emoji: '😴' },
];

const SEEDS_BY_TYPE: Record<WordFlipChallengeType, readonly SeedNoun[]> = {
  plural_s: PLURAL_S_SEEDS,
  plural_es: PLURAL_ES_SEEDS,
  plural_y: PLURAL_Y_SEEDS,
  irregulars: IRREGULAR_SEEDS,
  past_ed: PAST_ED_SEEDS,
  past_irregular: PAST_IRREGULAR_SEEDS,
};

// Includes invariant plurals that this production task deliberately excludes:
// "one sheep -> two sheep" has no audible transformation to judge.
const IRREGULAR_WORDS = new Set([
  ...Object.keys(IRREGULAR_PLURALS),
  'sheep', 'fish', 'deer',
]);

const buildNounPoolSchema = (): Schema => ({
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Engaging, kid-friendly session title including the topic (for example, 'One and Many at the Farm!').",
    },
    nouns: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: {
            type: Type.STRING,
            enum: ALL_CHALLENGE_TYPES,
            description: 'Word transformation type: plural or past-tense production.',
          },
          word: {
            type: Type.STRING,
            description: 'One lowercase concrete noun or action word a young child knows, letters only, 2-12 characters.',
          },
          emoji: {
            type: Type.STRING,
            description: 'Exactly one emoji that clearly depicts the noun or action.',
          },
        },
        required: ['type', 'word', 'emoji'],
      },
      description: '12-18 distinct, concrete, picturable nouns or action words obeying their declared transformation.',
    },
  },
  required: ['title', 'nouns'],
});

interface RawNoun { type?: string; word?: string; emoji?: string }
interface RawNounPool { title?: string; nouns?: RawNoun[] }
interface ValidNoun {
  type: WordFlipChallengeType;
  word: string;
  emoji: string;
  answer: string;
}

const shuffle = <T,>(arr: readonly T[]): T[] => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const isChallengeType = (value: string): value is WordFlipChallengeType =>
  ALL_CHALLENGE_TYPES.includes(value as WordFlipChallengeType);

/** Deterministic transformation oracle. null means the noun does not belong to
 * the declared mode and must be rejected rather than repaired. */
export const deriveWordFlipAnswer = (
  type: WordFlipChallengeType,
  word: string,
): string | null => {
  if (type === 'plural_s') {
    if (
      /(s|x|z|ch|sh|o)$/.test(word)
      || /(f|fe)$/.test(word)
      || /[^aeiou]y$/.test(word)
      || IRREGULAR_WORDS.has(word)
    ) return null;
    return `${word}s`;
  }
  if (type === 'plural_es') {
    return /(s|x|ch|sh)$/.test(word) ? `${word}es` : null;
  }
  if (type === 'plural_y') {
    return /[^aeiou]y$/.test(word) ? `${word.slice(0, -1)}ies` : null;
  }
  if (type === 'irregulars') return IRREGULAR_PLURALS[word] ?? null;
  if (type === 'past_ed') {
    return PAST_ED_SEEDS.some(seed => seed.word === word) ? `${word}ed` : null;
  }
  return IRREGULAR_PAST[word] ?? null;
};

const validateNounPool = (raw: RawNounPool): ValidNoun[] => {
  const survivors: ValidNoun[] = [];
  const seenWords = new Set<string>();
  let rejected = 0;

  for (const candidate of raw.nouns ?? []) {
    const type = candidate.type?.trim() ?? '';
    const word = candidate.word?.trim().toLowerCase() ?? '';
    const emoji = candidate.emoji?.trim() ?? '';
    if (!isChallengeType(type) || !/^[a-z]{2,12}$/.test(word)) { rejected += 1; continue; }
    const answer = deriveWordFlipAnswer(type, word);
    if (!answer) { rejected += 1; continue; }
    if (!emoji || /^[a-z0-9\s]*$/i.test(emoji)) { rejected += 1; continue; }
    if (seenWords.has(word)) { rejected += 1; continue; }
    seenWords.add(word);
    survivors.push({ type, word, emoji, answer });
  }

  if (rejected > 0) {
    console.warn(`[WordFlip] rejected ${rejected} malformed noun${rejected === 1 ? '' : 's'} (${survivors.length} survived)`);
  }
  return survivors;
};

const SYSTEM_INSTRUCTION =
  `You are an expert early-childhood language specialist. Supply typed pools of concrete, picturable nouns or `
  + `action words for a K-2 spoken grammar-transformation game. Follow each requested challenge-type rule exactly. `
  + `Every word is familiar, lowercase, letters only, and has exactly one clear emoji. All words are distinct. `
  + `Never author transformed answers.`;

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
  if (!response.text) throw new Error('No data returned from Gemini API');
  return JSON.parse(response.text) as RawNounPool;
};

const buildPrompt = (
  topic: string,
  intent: string | undefined,
  grade: string,
  seedHint: string,
  modeSection: string,
): string => `Give a typed pool of concrete K-2 words for a spoken grammar-transformation game. Plural items show
one thing and then several; past-tense items show an action today and ask how to say it when it happened yesterday.
Theme words to the topic where natural; a familiar everyday word is better than a forced topical one.
Topic: "${topic}".${intent ? `\nSPECIFIC FOCUS: "${intent}". Keep the grammar skill and picturability primary.` : ''}
TARGET GRADE LEVEL: ${grade}

${modeSection}

Produce 12-18 distinct typed words. For a blended or mixed session, use every listed type at least twice.

HARD RULES:
- Every word is lowercase letters only, 2-12 characters, concrete, familiar, and has exactly one clear emoji.
- plural_s: add only -s. No s/x/z/ch/sh/o, f/fe, consonant+y, or irregular nouns.
- plural_es: the noun ends in s, x, ch, or sh and adds only -es. No z or o endings.
- plural_y: the noun ends in consonant+y and changes y to -ies. No vowel+y nouns such as toy or key.
- irregulars: use only man, woman, child, foot, tooth, goose, mouse, person, ox. Every answer must sound different from its singular.
- past_ed: use only jump, walk, play, help, look, wash, kick, cook, paint, clean, open, laugh; add only -ed.
- past_irregular: use only go, run, eat, see, come, sit, get, make, take, give, have, do, say, sleep.
- Never provide a transformed answer; code owns it.
- All words are distinct.

Good candidates if they fit: ${seedHint}.

Also provide a fun session title including the topic.`;

const coverageScore = (pool: ValidNoun[], types: WordFlipChallengeType[]): number =>
  types.filter(type => pool.some(noun => noun.type === type)).length * 100 + pool.length;

const selectSessionNouns = (
  pool: ValidNoun[],
  activeTypes: WordFlipChallengeType[],
  sessionSize: number,
): ValidNoun[] => {
  const selected: ValidNoun[] = [];
  for (const type of activeTypes) {
    const candidate = shuffle(pool.filter(noun => noun.type === type))[0];
    if (candidate) selected.push(candidate);
  }
  const used = new Set(selected.map(noun => noun.word));
  selected.push(...shuffle(pool.filter(noun => !used.has(noun.word))).slice(0, sessionSize - selected.length));
  return selected.sort(
    (a, b) => ALL_CHALLENGE_TYPES.indexOf(a.type) - ALL_CHALLENGE_TYPES.indexOf(b.type),
  );
};

export const generateWordFlip = async (ctx: GenerationContext): Promise<WordFlipData> => {
  const resolution = await resolveEvalModes(
    'word-flip',
    {
      targetEvalMode: ctx.targetEvalMode,
      intent: ctx.intent,
      objectiveText: ctx.objective?.text,
    },
    CHALLENGE_TYPE_DOCS,
  );
  const activeTypes = (resolution?.allowedTypes ?? ALL_CHALLENGE_TYPES) as WordFlipChallengeType[];
  const sessionSize = Math.max(5, activeTypes.length);
  const baseSchema = buildNounPoolSchema();
  const activeSchema = resolution
    ? constrainChallengeTypeEnum(baseSchema, activeTypes, CHALLENGE_TYPE_DOCS, { arrayName: 'nouns' })
    : baseSchema;
  const modeSection = buildModeConstraintSection(resolution, CHALLENGE_TYPE_DOCS);
  const seedHint = shuffle(activeTypes.flatMap(type => SEEDS_BY_TYPE[type]))
    .slice(0, 12)
    .map(seed => `${seed.word} ${seed.emoji}`)
    .join(', ');

  console.log(
    `[WordFlip] modes: ${resolution ? `${resolution.modes.map(mode => mode.evalMode).join('+')} (${resolution.source})` : 'mixed'} -> types [${activeTypes.join(', ')}]`,
  );

  try {
    const prompt = buildPrompt(ctx.topic, ctx.intent, ctx.gradeContext, seedHint, modeSection);
    let raw = await callGemini(activeSchema, prompt);
    let pool = validateNounPool(raw);
    const missingTypes = () => activeTypes.filter(type => !pool.some(noun => noun.type === type));

    if (pool.length < sessionSize || missingTypes().length > 0) {
      console.warn(`[WordFlip] usable pool ${pool.length}/${sessionSize}; missing [${missingTypes().join(', ')}] - retrying once`);
      const retryRaw = await callGemini(
        activeSchema,
        prompt,
        `PREVIOUS ATTEMPT REJECTED: regenerate 16 nouns and use every allowed type at least twice. `
        + `plural_s adds only -s; plural_es ends in s/x/ch/sh and adds only -es; plural_y changes consonant+y `
        + `to -ies; irregulars uses only the `
        + `supplied irregular list. Every entry needs lowercase letters, exactly one clear emoji, and a distinct word.`,
      );
      const retryPool = validateNounPool(retryRaw);
      if (coverageScore(retryPool, activeTypes) > coverageScore(pool, activeTypes)) {
        raw = retryRaw;
        pool = retryPool;
      }
    }

    const missing = activeTypes.filter(type => !pool.some(noun => noun.type === type));
    if (pool.length < sessionSize || missing.length > 0) {
      throw new Error(`[WordFlip] pool unusable after retry: ${pool.length}/${sessionSize} words; missing [${missing.join(', ')}]`);
    }
    const title = raw.title?.trim() ?? '';
    if (!title) throw new Error('[WordFlip] Gemini pool missing title');

    const countChoices = [2, 3, 4, 5];
    const counts = shuffle(Array.from(
      { length: sessionSize },
      (_, index) => countChoices[index % countChoices.length],
    ));
    const challenges: WordFlipChallenge[] = selectSessionNouns(pool, activeTypes, sessionSize).map((noun, index) => ({
      id: `word-flip-${index + 1}`,
      type: noun.type,
      sourceWord: noun.word,
      answer: noun.answer,
      emoji: noun.emoji,
      count: noun.type.startsWith('plural_') || noun.type === 'irregulars' ? counts[index] : undefined,
    }));

    const data: WordFlipData = {
      title,
      challengeType: activeTypes.length === 1 ? activeTypes[0] : 'mixed',
      challenges,
      gradeLevel: ctx.gradeContext,
    };

    console.log('Word Flip Generated:', {
      title: data.title,
      poolSize: pool.length,
      challengeCount: challenges.length,
      words: challenges.map(challenge => challenge.sourceWord),
      types: challenges.map(challenge => challenge.type),
      counts: challenges.map(challenge => challenge.count),
    });
    return data;
  } catch (error) {
    console.error('Error generating word flip:', error);
    throw error;
  }
};
