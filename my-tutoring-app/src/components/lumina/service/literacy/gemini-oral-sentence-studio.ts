/**
 * Fork B orchestrator for Oral Sentence Studio.
 *
 * Three task identities (eval modes): describe_scene, guided_writing_rehearsal,
 * use_story_words. The eval mode is resolved once per session; code schedules
 * one type per slot (mixed = one of each, easiest first) and each slot's
 * schema enum is narrowed to that type.
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
  OralSentenceStudioChallengeType,
  OralSentenceStudioData,
} from '../../primitives/visual-primitives/literacy/OralSentenceStudio';
import {
  challengeAskable,
  ORAL_SENTENCE_STUDIO_CHALLENGE_TYPES,
  REHEARSAL_ORDER_WORDS,
} from '../../primitives/visual-primitives/literacy/oralSentenceStudioScript';
import {
  constrainChallengeTypeEnum,
  resolveEvalModes,
  type ChallengeTypeDoc,
  type EvalModeResolution,
} from '../evalMode';
import { ai } from '../geminiClient';
import type { GenerationContext } from '../generation/generationContext';
import { buildScopePromptSection } from '../scopeContext';

const MODEL = 'gemini-flash-lite-latest';
const CHALLENGE_COUNT = 3;
const MAX_GENERATION_ATTEMPTS = 3;

const CHALLENGE_TYPE_DOCS: Record<OralSentenceStudioChallengeType, ChallengeTypeDoc> = {
  describe_scene: {
    promptDoc:
      '"describe_scene": The child looks at one pictured scene (actor, action, object, setting) and two word cards '
      + 'with meanings, then says one original complete sentence that describes the scene and uses both words.',
    schemaDescription: "'describe_scene' (describe a picture with two words)",
  },
  guided_writing_rehearsal: {
    promptDoc:
      '"guided_writing_rehearsal": Oral rehearsal before shared writing. The class is writing a short how-to or class '
      + 'story (sceneTitle names it). One step is already written (priorStepLabel); the picture shows the step that comes '
      + 'now. The child says the sentence the class will write for THIS step, using an order word (targetWord0: next, '
      + 'then, last, or finally) and one vocabulary word (targetWord1).',
    schemaDescription: "'guided_writing_rehearsal' (say the next step's sentence before writing it)",
  },
  use_story_words: {
    promptDoc:
      '"use_story_words": The tutor reads a 2-3 sentence story (storyText) that uses two new words in context; the story '
      + 'picture stays visible. The child makes a NEW sentence of their own with both story words, about the story or '
      + 'anything else. A story sentence said back does not count.',
    schemaDescription: "'use_story_words' (reuse two story words in a new sentence)",
  },
};

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

type FlatField = typeof FLAT_FIELDS[number] | 'storyText' | 'priorStepLabel';

/** Extra flat fields a type carries beyond the shared scene/word/sentence set. */
const EXTRA_FIELDS: Record<OralSentenceStudioChallengeType, FlatField[]> = {
  describe_scene: [],
  guided_writing_rehearsal: ['priorStepLabel'],
  use_story_words: ['storyText'],
};

const fieldsFor = (type: OralSentenceStudioChallengeType): FlatField[] =>
  [...FLAT_FIELDS, ...EXTRA_FIELDS[type]];

/**
 * Meaning pictures for the two target words (the `word_pictures` lever, handoff 22 L4). Required in the schema: as
 * optional fields Gemini omitted them on 5 of 18 items (09-29 probe); required returned 16/18 with the same fallback
 * rate. Validated softly: a bad or scene-repeating picture drops the pictures, never the challenge.
 */
const SUPPORT_FIELDS = ['meaningEmoji0', 'meaningEmoji1'] as const;
const SUPPORT_DESCRIPTION = 'Exactly one familiar emoji that pictures the MEANING of the matching target word on its own '
  + '(gentle → 🪶, thirsty → 💧). Never one of the scene\'s own emojis, and never a picture of the whole sentence.';

const fieldDescription = (field: FlatField): string => {
  if (field === 'type') return 'The assigned challenge type.';
  if (field === 'storyText') return 'Two or three short complete story sentences about the pictured scene that use both target words with clear meanings.';
  if (field === 'priorStepLabel') return 'Short label for the step the class already wrote, 2-5 words, no sentence punctuation.';
  if (field === 'sceneTitle') return 'Warm title for the visible scene, 2-5 words, no ending punctuation.';
  if (field.endsWith('Emoji')) return 'Exactly one familiar emoji that literally pictures the matching label.';
  if (field.endsWith('Label')) return 'Concrete visible scene label, 1-5 simple words, no sentence punctuation.';
  if (field.startsWith('targetWord')) return 'One lowercase vocabulary word, letters or one hyphen only, at most 18 characters.';
  if (field.startsWith('meaning')) return 'Child-friendly meaning phrase, 2-6 words, no sentence punctuation.';
  if (field === 'sceneMeaning') return 'One private complete sentence stating what the scene means and using both target words exactly.';
  return 'One distinct, complete child sentence about this exact scene that uses both target words exactly and meaningfully.';
};

const schemaFor = (type: OralSentenceStudioChallengeType): Schema => constrainChallengeTypeEnum(
  {
    type: Type.OBJECT,
    properties: Object.fromEntries([
      ...fieldsFor(type).map((field) => [field, {
        type: Type.STRING,
        ...(field === 'type' ? { enum: [...ORAL_SENTENCE_STUDIO_CHALLENGE_TYPES] } : {}),
        description: fieldDescription(field),
      }]),
      ...SUPPORT_FIELDS.map((field) => [field, { type: Type.STRING, description: SUPPORT_DESCRIPTION }]),
    ]),
    required: [...fieldsFor(type), ...SUPPORT_FIELDS],
  },
  [type],
  CHALLENGE_TYPE_DOCS,
  { fieldName: 'type', rootLevel: true },
);

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
  expectedType: OralSentenceStudioChallengeType = 'describe_scene',
): OralSentenceStudioChallenge | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const values = {} as Record<FlatField, string>;
  for (const field of fieldsFor(expectedType)) {
    const value = text(record[field]);
    if (!value) return null;
    values[field] = value;
  }
  if (values.type !== expectedType) return null;
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

  const wordEmojis = SUPPORT_FIELDS.map((field) => text(record[field]));
  const sceneEmojis = [values.settingEmoji, values.actorEmoji, values.actionEmoji, values.objectEmoji];
  const picturesUsable = wordEmojis.every((emoji) => emojiPattern.test(emoji) && !sceneEmojis.includes(emoji))
    && wordEmojis[0] !== wordEmojis[1];

  const challenge: OralSentenceStudioChallenge = {
    ...(picturesUsable ? { wordEmojis: wordEmojis as [string, string] } : {}),
    id: `oral-sentence-studio-${index + 1}`,
    type: expectedType,
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
    ...(expectedType === 'use_story_words' ? { storyText: values.storyText } : {}),
    ...(expectedType === 'guided_writing_rehearsal' ? { priorStepLabel: values.priorStepLabel } : {}),
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
  {
    id: 'oral-sentence-studio-fallback-7',
    type: 'guided_writing_rehearsal',
    sceneTitle: 'Our Fruit Salad Recipe',
    settingEmoji: '🏫',
    settingLabel: 'classroom kitchen',
    actorEmoji: '🧒',
    actorLabel: 'class',
    actionEmoji: '🥄',
    actionLabel: 'mixing the fruit',
    objectEmoji: '🥣',
    objectLabel: 'bowl of fruit',
    targetWords: ['next', 'mix'],
    wordMeanings: ['right after that', 'stir things together'],
    priorStepLabel: 'washing the grapes',
    sceneMeaning: 'Next, the class will mix the fruit in a big bowl.',
    acceptedSentences: [
      'Next, we mix the fruit in the big bowl.',
      'Next, the class will mix all the fruit together.',
      'We mix the fruit next so every bite is sweet.',
    ],
  },
  {
    id: 'oral-sentence-studio-fallback-8',
    type: 'guided_writing_rehearsal',
    sceneTitle: 'Our Seed Planting Story',
    settingEmoji: '🪟',
    settingLabel: 'classroom window',
    actorEmoji: '🧒',
    actorLabel: 'children',
    actionEmoji: '💧',
    actionLabel: 'watering the seeds',
    objectEmoji: '🪴',
    objectLabel: 'flower pot',
    targetWords: ['then', 'sprinkle'],
    wordMeanings: ['after that step', 'drop water softly'],
    priorStepLabel: 'filling the pot with soil',
    sceneMeaning: 'Then the children sprinkle water on the seeds in the pot.',
    acceptedSentences: [
      'Then the children sprinkle water on the seeds.',
      'We sprinkle the pot with water, and then we wait.',
      'Then we sprinkle a little water so the seeds can grow.',
    ],
  },
  {
    id: 'oral-sentence-studio-fallback-9',
    type: 'guided_writing_rehearsal',
    sceneTitle: 'Our Thank You Card',
    settingEmoji: '🎨',
    settingLabel: 'art table',
    actorEmoji: '🧒',
    actorLabel: 'students',
    actionEmoji: '✍️',
    actionLabel: 'signing their names',
    objectEmoji: '✉️',
    objectLabel: 'thank you card',
    targetWords: ['last', 'sign'],
    wordMeanings: ['at the very end', 'write your name'],
    priorStepLabel: 'coloring a big sun',
    sceneMeaning: 'Last, the students sign their names on the thank you card.',
    acceptedSentences: [
      'Last, the students sign their names on the card.',
      'We sign the thank you card last.',
      'Last of all, each student will sign the card with a pencil.',
    ],
  },
  {
    id: 'oral-sentence-studio-fallback-10',
    type: 'use_story_words',
    sceneTitle: 'The Brave Duckling',
    settingEmoji: '🏞️',
    settingLabel: 'pond',
    actorEmoji: '🦆',
    actorLabel: 'duckling',
    actionEmoji: '🌊',
    actionLabel: 'swimming across',
    objectEmoji: '🌸',
    objectLabel: 'water flower',
    targetWords: ['brave', 'wobbly'],
    wordMeanings: ['not afraid to try', 'shaky and not steady'],
    storyText: 'The little duckling felt wobbly at the edge of the pond. She was brave and swam all the way to the flower.',
    sceneMeaning: 'A brave duckling swims to a flower even though she feels wobbly.',
    acceptedSentences: [
      'I was brave when my legs felt wobbly on my new bike.',
      'The wobbly table did not scare the brave cat.',
      'My brave friend stood on the wobbly bridge.',
    ],
  },
  {
    id: 'oral-sentence-studio-fallback-11',
    type: 'use_story_words',
    sceneTitle: 'The Hungry Squirrel',
    settingEmoji: '🌳',
    settingLabel: 'oak tree',
    actorEmoji: '🐿️',
    actorLabel: 'squirrel',
    actionEmoji: '🔍',
    actionLabel: 'searching the ground',
    objectEmoji: '🌰',
    objectLabel: 'acorn',
    targetWords: ['hungry', 'search'],
    wordMeanings: ['wanting to eat', 'look carefully for'],
    storyText: 'The squirrel was very hungry after the long night. He had to search under the leaves for an acorn. At last he found one!',
    sceneMeaning: 'A hungry squirrel will search the ground for an acorn.',
    acceptedSentences: [
      'When I am hungry, I search the kitchen for a snack.',
      'We search the yard for the hungry puppy.',
      'The hungry bird will search the grass for a worm.',
    ],
  },
  {
    id: 'oral-sentence-studio-fallback-12',
    type: 'use_story_words',
    sceneTitle: 'The Sleepy Bear',
    settingEmoji: '🌲',
    settingLabel: 'forest',
    actorEmoji: '🐻',
    actorLabel: 'bear',
    actionEmoji: '🥱',
    actionLabel: 'yawning slowly',
    objectEmoji: '🍯',
    objectLabel: 'honey pot',
    targetWords: ['sleepy', 'cozy'],
    wordMeanings: ['ready to go to sleep', 'warm and comfy'],
    storyText: 'The bear ate some honey and gave a big yawn. He felt sleepy, so he curled up in his cozy den.',
    sceneMeaning: 'A sleepy bear yawns by the honey pot before a cozy nap.',
    acceptedSentences: [
      'My cozy sweater keeps me warm when I feel sleepy.',
      'The sleepy kitten found a cozy spot in the sun.',
      'I feel sleepy when I read in a cozy chair.',
    ],
  },
];

const scheduleTypes = (resolution: EvalModeResolution | null): OralSentenceStudioChallengeType[] => {
  // Mixed (no resolution) covers every task identity once, easiest first.
  const source = (resolution?.allowedTypes ?? ORAL_SENTENCE_STUDIO_CHALLENGE_TYPES)
    .filter((type): type is OralSentenceStudioChallengeType =>
      (ORAL_SENTENCE_STUDIO_CHALLENGE_TYPES as readonly string[]).includes(type));
  const types = source.length ? source : ['describe_scene' as const];
  return Array.from({ length: CHALLENGE_COUNT }, (_, index) => types[index % types.length]);
};

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

const TYPE_RULES: Record<OralSentenceStudioChallengeType, string> = {
  describe_scene: `- The visible scene must show one actor, one action, one object, and one setting. Each emoji must literally match its label. Labels are short noun or action phrases, never sentences.
- targetWord0 and targetWord1 are two DISTINCT lowercase single vocabulary words. Both must fit the topic and be naturally usable together to describe this exact scene. Do not choose proper names.
- Every accepted sentence must explicitly name at least one word from the actor, action, or object label. Mentioning only the setting is not enough to describe the pictured event.`,
  guided_writing_rehearsal: `- sceneTitle names the class writing piece, such as a simple recipe, how-to, or class story ("Our Fruit Salad Recipe"). It is not a sentence.
- priorStepLabel is the step the class ALREADY wrote (2-5 words). The actor/action/object/setting picture shows the DIFFERENT step that comes right after it. Each emoji must literally match its label.
- targetWord0 MUST be exactly the assigned order word given below. meaning0 explains that order word for a child. targetWord1 is one lowercase vocabulary word that names or describes this step. Do not choose proper names.
- Every accepted sentence is a sentence the class could write for THIS step. It names at least one word from the actor, action, or object label, uses both target words, and never tells the earlier step.
- Keep the steps safe: no knives, stoves, heat, or sharp tools.`,
  use_story_words: `- storyText is a tiny story of 2 or 3 short complete sentences (at most 40 words) about the pictured actor, action, object, and setting. It uses BOTH target words with clear meanings. Each emoji must literally match its label.
- targetWord0 and targetWord1 are two DISTINCT lowercase single vocabulary words that a Kindergartner could reuse in everyday life. Do not choose proper names.
- The three accepted sentences are NEW sentences a child might make with both story words. At least two must be about something OTHER than the story (an animal, a place, the weather, school), and NONE may repeat or lightly reword a story sentence. Do not mention family members.
- sceneMeaning states the story's gist, names the pictured actor or object, and uses both target words.`,
};

const VARIETY_INSPIRATIONS = [
  'a garden or nature observation',
  'a library, classroom, or reading moment',
  'a park or outdoor discovery',
  'a kitchen, art table, or building activity',
  'a helpful everyday action',
  'a simple science observation',
];

/** Code, not the model, picks the order word: slots run next, then, last
 * (a retry shifts one along) instead of the model collapsing to "then". */
const orderWordFor = (index: number, attempt: number): string =>
  REHEARSAL_ORDER_WORDS[(index + attempt) % REHEARSAL_ORDER_WORDS.length];

const promptFor = (
  ctx: GenerationContext,
  type: OralSentenceStudioChallengeType,
  index: number,
  attempt: number,
  usedScenes: readonly string[],
): string => `Create ONE ${type} challenge for Oral Sentence Studio.

Topic: ${ctx.topic}
Grade ceiling: ${ctx.gradeContext} (${ctx.grade ?? ctx.gradeLevel})
Specific intent: ${ctx.intent ?? ctx.title ?? 'Use new vocabulary in one complete original sentence.'}
Objective: ${ctx.objective.text ?? 'Describe a visible scene in a complete sentence using two vocabulary words.'}
${buildScopePromptSection(ctx.scope)}

Challenge ${index + 1}, attempt ${attempt + 1}. Variety inspiration: ${VARIETY_INSPIRATIONS[(index + attempt * CHALLENGE_COUNT) % VARIETY_INSPIRATIONS.length]}.
The assigned topic, intent, objective, and scope take precedence over the variety inspiration. Keep every word concrete and understandable for Kindergarten. Use a familiar, culturally neutral scene. Avoid brands, holidays, religion, stereotypes, weapons, danger, romance, private information, and assumptions about a child's home or family.

CHALLENGE TYPE for this slot:
${CHALLENGE_TYPE_DOCS[type].promptDoc}

Return exactly the flat schema fields. Set type to ${type}.
${TYPE_RULES[type]}
- meaning0 and meaning1 are aligned, child-friendly meaning phrases, not full sentences.
- sceneMeaning is PRIVATE. Write one complete sentence that states the scene's semantic meaning and uses BOTH exact target words meaningfully.
- acceptedSentence0, acceptedSentence1, and acceptedSentence2 are PRIVATE examples, never directions. Each is one complete child sentence of 3-20 words with ending punctuation that uses BOTH exact target words with their intended meanings.
- acceptedSentence0 is shown to the child AFTER the attempt as one sentence that works, so make it the clearest, most natural example.
${type === 'guided_writing_rehearsal' ? `- Assigned order word for this step: ${orderWordFor(index, attempt)}.\n` : ''}- The three accepted sentences must genuinely differ in syntax and detail, not merely swap one small word or punctuation. Begin them differently and demonstrate that multiple original answers can pass.
- Never output a fragment, word list, definition, unrelated memorized sentence, quotation, dialogue, blank marker, bracket tag, instruction, judging label, or answer verdict in any content field.
- Do not use double quotes, underscores, braces, or line breaks inside a field.

Avoid repeating these already accepted scene signatures: ${JSON.stringify(usedScenes)}.
Generate fresh lesson content rather than copying a fixed example.`;

/** Exactly three independent initial calls. Any rejected or duplicate slot is
 * retried twice, then filled from the validated fallback bank. */
export async function generateOralSentenceStudio(
  ctx: GenerationContext,
): Promise<OralSentenceStudioData> {
  const resolution = await resolveEvalModes(
    'oral-sentence-studio',
    { targetEvalMode: ctx.targetEvalMode, intent: ctx.intent, objectiveText: ctx.objective.text },
    CHALLENGE_TYPE_DOCS,
  );
  const slotTypes = scheduleTypes(resolution);
  console.log(
    `[OralSentenceStudio] modes: ${resolution ? `${resolution.modes.map((mode) => mode.evalMode).join('+')} (${resolution.source})` : 'mixed'} -> types [${slotTypes.join(', ')}]`,
  );
  let rejectionCount = 0;

  const requestChallenge = async (
    index: number,
    attempt: number,
    usedScenes: readonly string[],
  ): Promise<OralSentenceStudioChallenge | null> => {
    const type = slotTypes[index];
    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: promptFor(ctx, type, index, attempt, usedScenes),
        config: {
          responseMimeType: 'application/json',
          responseSchema: schemaFor(type),
          systemInstruction: 'Author concrete Kindergarten vocabulary scene data. Every field is child-safe lesson content, never an instruction to a tutor or a grading verdict.',
        },
      });
      const decoded: unknown = JSON.parse(response.text ?? 'null');
      const challenge = validateOralSentenceStudioPayload(decoded, index, type);
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
    ).find((candidate) => candidate.type === slotTypes[index]
      && challengeAskable(candidate)
      && !seen.has(sceneKey(candidate)));
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
  const sessionTypes = Array.from(new Set(challenges.map((challenge) => challenge.type)));
  console.info(`[OralSentenceStudio] Generated ${challenges.length} challenges: ${challenges.map((challenge) => challenge.type).join(', ')}.`);

  return {
    title: 'Oral Sentence Studio',
    description: 'Use both new words in one complete sentence of your own.',
    gradeLevel: ctx.gradeLevel,
    challengeType: sessionTypes.length === 1 ? sessionTypes[0] : 'mixed',
    challenges,
  };
}
