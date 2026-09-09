/**
 * L0 Fork B orchestrator for Oral Sentence Studio.
 *
 * Scene and sentence content is authored one challenge at a time by Gemini.
 * The response schema stays flat, then this module reconstructs the two-word
 * and three-sentence tuples and admits them only through the component's
 * challengeAskable seam. Invalid or repeated scenes get two retries; an explicit
 * familiar-scene bank fills any remaining slots so every session has exactly
 * three askable challenges.
 */

import { Type, type Schema } from '@google/genai';
import type {
  OralSentenceStudioChallenge,
  OralSentenceStudioData,
} from '../../primitives/visual-primitives/literacy/OralSentenceStudio';
import { challengeAskable } from '../../primitives/visual-primitives/literacy/oralSentenceStudioScript';
import { ai } from '../geminiClient';
import type { GenerationContext } from '../generation/generationContext';
import { buildScopePromptSection } from '../scopeContext';

const MODEL = 'gemini-flash-lite-latest';
const CHALLENGE_COUNT = 3;
const MAX_GENERATION_ATTEMPTS = 3;

const FLAT_FIELDS = [
  'type',
  'sceneTitle',
  'settingEmoji',
  'settingLabel',
  'actorEmoji',
  'actorLabel',
  'actionEmoji',
  'actionLabel',
  'objectEmoji',
  'objectLabel',
  'targetWord0',
  'targetWord1',
  'meaning0',
  'meaning1',
  'sceneMeaning',
  'acceptedSentence0',
  'acceptedSentence1',
  'acceptedSentence2',
] as const;

type FlatField = typeof FLAT_FIELDS[number];

const fieldDescription = (field: FlatField): string => {
  if (field === 'type') return 'Always describe_scene.';
  if (field === 'sceneTitle') return 'Warm title for the visible scene, 2-5 words, no ending punctuation.';
  if (field.endsWith('Emoji')) return 'Exactly one familiar emoji that literally pictures the matching label.';
  if (field.endsWith('Label')) return 'Concrete visible scene label, 1-5 simple words, no sentence punctuation.';
  if (field.startsWith('targetWord')) return 'One lowercase vocabulary word, letters or one hyphen only, at most 18 characters.';
  if (field.startsWith('meaning')) return 'Child-friendly meaning phrase, 2-6 words, no sentence punctuation.';
  if (field === 'sceneMeaning') return 'One private complete sentence stating what the scene means and using both target words exactly.';
  return 'One distinct, complete child sentence about this exact scene that uses both target words exactly and meaningfully.';
};

const schema: Schema = {
  type: Type.OBJECT,
  properties: Object.fromEntries(FLAT_FIELDS.map((field) => [field, {
    type: Type.STRING,
    ...(field === 'type' ? { enum: ['describe_scene'] } : {}),
    description: fieldDescription(field),
  }])),
  required: [...FLAT_FIELDS],
};

const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const wordTokens = (value: string): string[] => value.toLowerCase().match(/[a-z]+(?:-[a-z]+)?/g) ?? [];
const emojiPattern = new RegExp(
  '^(?:\\p{Extended_Pictographic}|\\p{Emoji_Presentation})(?:\\uFE0F|\\p{Emoji_Modifier})?'
    + '(?:\\u200D(?:\\p{Extended_Pictographic}|\\p{Emoji_Presentation})(?:\\uFE0F|\\p{Emoji_Modifier})?)*$',
  'u',
);

const sentencesGenuinelyDiffer = (sentences: readonly string[]): boolean => {
  const tokenSets = sentences.map((sentence) => new Set(wordTokens(sentence)));
  for (let left = 0; left < tokenSets.length; left++) {
    for (let right = left + 1; right < tokenSets.length; right++) {
      const union = new Set(Array.from(tokenSets[left]).concat(Array.from(tokenSets[right])));
      const shared = Array.from(tokenSets[left]).filter((token) => tokenSets[right].has(token)).length;
      if (union.size > 0 && shared / union.size >= 0.8) return false;
    }
  }
  return true;
};

/** Reconstruct the flat Gemini payload, then validate it at the exact seam used
 * by the component/script. No required scene or language field is fabricated. */
export function validateOralSentenceStudioPayload(
  raw: unknown,
  index: number,
): OralSentenceStudioChallenge | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const values = {} as Record<FlatField, string>;
  for (const field of FLAT_FIELDS) {
    const value = text(record[field]);
    if (!value) return null;
    values[field] = value;
  }
  if (values.type !== 'describe_scene') return null;
  if (![values.settingEmoji, values.actorEmoji, values.actionEmoji, values.objectEmoji]
    .every((emoji) => emojiPattern.test(emoji))) return null;

  const targetWords: [string, string] = [
    values.targetWord0.toLowerCase(),
    values.targetWord1.toLowerCase(),
  ];
  const wordMeanings: [string, string] = [values.meaning0, values.meaning1];
  const acceptedSentences: [string, string, string] = [
    values.acceptedSentence0,
    values.acceptedSentence1,
    values.acceptedSentence2,
  ];
  // Requiring both vocabulary words in the private semantic anchor makes their
  // intended scene meanings inspectable instead of trusting surface inclusion
  // in the three examples alone.
  const meaningTokens = new Set(wordTokens(values.sceneMeaning));
  if (!targetWords.every((word) => meaningTokens.has(word))) return null;
  if (!sentencesGenuinelyDiffer(acceptedSentences)) return null;

  const challenge: OralSentenceStudioChallenge = {
    id: `oral-sentence-studio-${index + 1}`,
    type: 'describe_scene',
    sceneTitle: values.sceneTitle,
    settingEmoji: values.settingEmoji,
    settingLabel: values.settingLabel,
    actorEmoji: values.actorEmoji,
    actorLabel: values.actorLabel,
    actionEmoji: values.actionEmoji,
    actionLabel: values.actionLabel,
    objectEmoji: values.objectEmoji,
    objectLabel: values.objectLabel,
    targetWords,
    wordMeanings,
    sceneMeaning: values.sceneMeaning,
    acceptedSentences,
  };
  return challengeAskable(challenge) ? challenge : null;
}

/** Explicit Kindergarten-safe familiar scenes. Used only after a generated
 * slot and its single retry both fail validation or scene deduplication. */
export const ORAL_SENTENCE_STUDIO_FALLBACKS: OralSentenceStudioChallenge[] = [
  {
    id: 'oral-sentence-studio-fallback-1',
    type: 'describe_scene',
    sceneTitle: 'A Garden Drink',
    settingEmoji: '🌻',
    settingLabel: 'community garden',
    actorEmoji: '🧒',
    actorLabel: 'child',
    actionEmoji: '💧',
    actionLabel: 'watering gently',
    objectEmoji: '🌱',
    objectLabel: 'seedling',
    targetWords: ['gentle', 'thirsty'],
    wordMeanings: ['soft and careful', 'needing a drink'],
    sceneMeaning: 'A child gives gentle water to a thirsty seedling.',
    acceptedSentences: [
      'The child gives gentle water to the thirsty seedling.',
      'A thirsty seedling gets a gentle drink from the child.',
      'In the garden, the child is gentle with the thirsty seedling.',
    ],
  },
  {
    id: 'oral-sentence-studio-fallback-2',
    type: 'describe_scene',
    sceneTitle: 'Ready to Read',
    settingEmoji: '🏛️',
    settingLabel: 'library',
    actorEmoji: '🧒',
    actorLabel: 'reader',
    actionEmoji: '🗣️',
    actionLabel: 'sharing a story',
    objectEmoji: '📖',
    objectLabel: 'book',
    targetWords: ['eager', 'quiet'],
    wordMeanings: ['excited and ready', 'making very little sound'],
    sceneMeaning: 'An eager reader shares a book in the quiet library.',
    acceptedSentences: [
      'The eager reader shares the book in a quiet library.',
      'Inside the quiet library, an eager reader shares a book.',
      'An eager reader reads the book with a quiet voice.',
    ],
  },
  {
    id: 'oral-sentence-studio-fallback-3',
    type: 'describe_scene',
    sceneTitle: 'Colors on the Path',
    settingEmoji: '🌳',
    settingLabel: 'park path',
    actorEmoji: '🧒',
    actorLabel: 'friends',
    actionEmoji: '🧺',
    actionLabel: 'collecting leaves',
    objectEmoji: '🍂',
    objectLabel: 'leaves',
    targetWords: ['bright', 'gather'],
    wordMeanings: ['full of clear color', 'bring things together'],
    sceneMeaning: 'Friends gather bright leaves along the park path.',
    acceptedSentences: [
      'The friends gather bright leaves beside the park path.',
      'At the park, bright leaves are what the friends gather.',
      'Bright leaves fill the bag as friends gather them.',
    ],
  },
  {
    id: 'oral-sentence-studio-fallback-4',
    type: 'describe_scene',
    sceneTitle: 'Batter in the Bowl',
    settingEmoji: '🏠',
    settingLabel: 'kitchen',
    actorEmoji: '🧑‍🍳',
    actorLabel: 'baker',
    actionEmoji: '🥄',
    actionLabel: 'mixing batter',
    objectEmoji: '🥣',
    objectLabel: 'bowl',
    targetWords: ['smooth', 'stir'],
    wordMeanings: ['even with no lumps', 'mix by moving around'],
    sceneMeaning: 'The baker will stir the smooth batter in the bowl.',
    acceptedSentences: [
      'The baker will stir the smooth batter in the bowl.',
      'To make smooth batter, the baker uses a spoon to stir.',
      'In the kitchen, stir the batter until it looks smooth.',
    ],
  },
  {
    id: 'oral-sentence-studio-fallback-5',
    type: 'describe_scene',
    sceneTitle: 'Kite Helper',
    settingEmoji: '🛝',
    settingLabel: 'playground',
    actorEmoji: '🧒',
    actorLabel: 'child',
    actionEmoji: '🛟',
    actionLabel: 'helping the kite',
    objectEmoji: '🪁',
    objectLabel: 'kite',
    targetWords: ['tangled', 'rescue'],
    wordMeanings: ['twisted together tightly', 'help out of trouble'],
    sceneMeaning: 'A child works to rescue the tangled kite at the playground.',
    acceptedSentences: [
      'The child helps rescue the tangled kite at the playground.',
      'At the playground, a tangled kite needs the child to rescue it.',
      'To rescue the kite, the child loosens its tangled string.',
    ],
  },
  {
    id: 'oral-sentence-studio-fallback-6',
    type: 'describe_scene',
    sceneTitle: 'Looking at a Shell',
    settingEmoji: '🏫',
    settingLabel: 'science table',
    actorEmoji: '🧒',
    actorLabel: 'student',
    actionEmoji: '🔍',
    actionLabel: 'observing closely',
    objectEmoji: '🐚',
    objectLabel: 'shell',
    targetWords: ['notice', 'rough'],
    wordMeanings: ['see or pay attention', 'bumpy instead of smooth'],
    sceneMeaning: 'The student can notice the rough shell on the science table.',
    acceptedSentences: [
      'The student can notice the rough shell on the science table.',
      'On the science table, a rough shell is easy to notice.',
      'I notice the rough shell while the student observes it.',
    ],
  },
];

const normalize = (value: string): string => wordTokens(value).join(' ');
const sceneKey = (challenge: OralSentenceStudioChallenge): string => [
  challenge.settingLabel,
  challenge.actorLabel,
  challenge.actionLabel,
  challenge.objectLabel,
].map(normalize).join('|');

const rekeyChallenge = (
  challenge: OralSentenceStudioChallenge,
  index: number,
): OralSentenceStudioChallenge => ({
  ...challenge,
  id: `oral-sentence-studio-${index + 1}`,
  targetWords: [...challenge.targetWords] as [string, string],
  wordMeanings: [...challenge.wordMeanings] as [string, string],
  acceptedSentences: [...challenge.acceptedSentences] as [string, string, string],
});

const VARIETY_INSPIRATIONS = [
  'a garden or nature observation',
  'a library, classroom, or reading moment',
  'a park or outdoor discovery',
  'a kitchen, art table, or building activity',
  'a helpful everyday action',
  'a simple science observation',
];

const promptFor = (
  ctx: GenerationContext,
  index: number,
  attempt: number,
  usedScenes: readonly string[],
): string => `Create ONE scene-description challenge for Oral Sentence Studio.

Topic: ${ctx.topic}
Grade ceiling: ${ctx.gradeContext} (${ctx.grade ?? ctx.gradeLevel})
Specific intent: ${ctx.intent ?? ctx.title ?? 'Use new vocabulary in one complete original sentence.'}
Objective: ${ctx.objective.text ?? 'Describe a visible scene in a complete sentence using two vocabulary words.'}
${buildScopePromptSection(ctx.scope)}

Challenge ${index + 1}, attempt ${attempt + 1}. Variety inspiration: ${VARIETY_INSPIRATIONS[(index + attempt * CHALLENGE_COUNT) % VARIETY_INSPIRATIONS.length]}.
The assigned topic, intent, objective, and scope take precedence over the variety inspiration. Keep every word concrete and understandable for Kindergarten. Use a familiar, culturally neutral scene. Avoid brands, holidays, religion, stereotypes, weapons, danger, romance, private information, and assumptions about a child's home or family.

Return exactly the flat schema fields. Set type to describe_scene.
- The visible scene must show one actor, one action, one object, and one setting. Each emoji must literally match its label. Labels are short noun or action phrases, never sentences.
- targetWord0 and targetWord1 are two DISTINCT lowercase single vocabulary words. Both must fit the topic and be naturally usable together to describe this exact scene. Do not choose proper names.
- meaning0 and meaning1 are aligned, child-friendly meaning phrases, not full sentences.
- sceneMeaning is PRIVATE. Write one complete sentence that states the scene's semantic meaning and uses BOTH exact target words meaningfully.
- acceptedSentence0, acceptedSentence1, and acceptedSentence2 are PRIVATE examples, never directions. Each is one complete child sentence of 3-20 words with ending punctuation. Every example must describe this exact scene and use BOTH exact target words with their intended meanings.
- Every accepted sentence must explicitly name at least one word from the actor, action, or object label. Mentioning only the setting is not enough to describe the pictured event.
- The three accepted sentences must genuinely differ in syntax and detail, not merely swap one small word or punctuation. Begin them differently and demonstrate that multiple original answers can pass.
- Never output a fragment, word list, definition, unrelated memorized sentence, quotation, dialogue, blank marker, bracket tag, instruction, judging label, or answer verdict in any content field.
- Do not use double quotes, underscores, braces, or line breaks inside a field.

Avoid repeating these already accepted scene signatures: ${JSON.stringify(usedScenes)}.
Generate fresh lesson content rather than copying a fixed example.`;

/** Exactly three independent initial calls. Any rejected or duplicate slot is
 * retried twice, then filled from the validated fallback bank. */
export async function generateOralSentenceStudio(
  ctx: GenerationContext,
): Promise<OralSentenceStudioData> {
  let rejectionCount = 0;

  const requestChallenge = async (
    index: number,
    attempt: number,
    usedScenes: readonly string[],
  ): Promise<OralSentenceStudioChallenge | null> => {
    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: promptFor(ctx, index, attempt, usedScenes),
        config: {
          responseMimeType: 'application/json',
          responseSchema: schema,
          systemInstruction: 'Author concrete Kindergarten vocabulary scene data. Every field is child-safe lesson content, never an instruction to a tutor or a grading verdict.',
        },
      });
      const decoded: unknown = JSON.parse(response.text ?? 'null');
      const challenge = validateOralSentenceStudioPayload(decoded, index);
      if (!challenge) rejectionCount++;
      return challenge;
    } catch {
      rejectionCount++;
      return null;
    }
  };

  const initial = await Promise.all(Array.from(
    { length: CHALLENGE_COUNT },
    (_, index) => requestChallenge(index, 0, []),
  ));

  const slots: Array<OralSentenceStudioChallenge | null> = Array(CHALLENGE_COUNT).fill(null);
  const seen = new Set<string>();
  for (let index = 0; index < initial.length; index++) {
    const challenge = initial[index];
    if (!challenge) continue;
    const key = sceneKey(challenge);
    if (seen.has(key)) {
      rejectionCount++;
      continue;
    }
    seen.add(key);
    slots[index] = challenge;
  }

  for (let attempt = 1; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
    const retryIndexes = slots
      .map((challenge, index) => challenge ? -1 : index)
      .filter((index) => index >= 0);
    if (retryIndexes.length === 0) break;

    const acceptedSceneKeys = Array.from(seen);
    const retries = await Promise.all(retryIndexes.map((index) =>
      requestChallenge(index, attempt, acceptedSceneKeys)));
    retries.forEach((challenge, retryIndex) => {
      const slotIndex = retryIndexes[retryIndex];
      if (!challenge) return;
      const key = sceneKey(challenge);
      if (seen.has(key)) {
        rejectionCount++;
        return;
      }
      seen.add(key);
      slots[slotIndex] = challenge;
    });
  }

  let fallbackCount = 0;
  const fallbackOffset = Math.floor(Math.random() * ORAL_SENTENCE_STUDIO_FALLBACKS.length);
  for (let index = 0; index < slots.length; index++) {
    if (slots[index]) continue;
    const fallback = Array.from(
      { length: ORAL_SENTENCE_STUDIO_FALLBACKS.length },
      (_, step) => ORAL_SENTENCE_STUDIO_FALLBACKS[(fallbackOffset + step) % ORAL_SENTENCE_STUDIO_FALLBACKS.length],
    ).find((candidate) => challengeAskable(candidate) && !seen.has(sceneKey(candidate)));
    if (!fallback) {
      throw new Error('[oral-sentence-studio] No valid unique fallback scene remained.');
    }
    seen.add(sceneKey(fallback));
    slots[index] = fallback;
    fallbackCount++;
  }

  const challenges = slots.map((challenge, index) => rekeyChallenge(challenge!, index));
  if (challenges.length !== CHALLENGE_COUNT || !challenges.every(challengeAskable)) {
    throw new Error('[oral-sentence-studio] Final challenge set failed the component contract.');
  }
  if (new Set(challenges.map(sceneKey)).size !== CHALLENGE_COUNT) {
    throw new Error('[oral-sentence-studio] Final challenge set contains duplicate scenes.');
  }
  if (rejectionCount || fallbackCount) {
    console.warn(`[oral-sentence-studio] Rejected ${rejectionCount} invalid or duplicate payload(s); used ${fallbackCount} explicit fallback scene(s).`);
  }
  console.info(`[OralSentenceStudio] Generated ${challenges.length} describe_scene challenges.`);

  return {
    title: 'Oral Sentence Studio',
    description: 'Look at each scene and use both new words in one complete sentence of your own.',
    gradeLevel: ctx.gradeLevel,
    challengeType: 'describe_scene',
    challenges,
  };
}
