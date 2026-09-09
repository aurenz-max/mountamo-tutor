/**
 * Fork B orchestrator for Story Ribbon.
 *
 * Each challenge needs content-bearing picture labels and a coherent three-step
 * story, so the generator makes one independent flat-schema Gemini call per
 * challenge. Arrays are reconstructed and validated locally. Invalid payloads
 * are rejected; an explicit, logged familiar-story bank fills any remaining
 * slots so the required multi-instance contract never collapses.
 */

import { Type, type Schema } from '@google/genai';
import { ai } from '../geminiClient';
import type { GenerationContext } from '../generation/generationContext';
import { buildScopePromptSection } from '../scopeContext';
import {
  buildModeConstraintSection,
  constrainChallengeTypeEnum,
  resolveEvalModes,
  type ChallengeTypeDoc,
  type EvalModeResolution,
} from '../evalMode';
import type {
  StoryRibbonChallenge,
  StoryRibbonChallengeType,
  StoryRibbonData,
  StoryRibbonEvent,
  StoryRibbonTimeCue,
} from '../../primitives/visual-primitives/literacy/StoryRibbon';
import {
  challengeAskable,
  isModelSentence,
  isPictureLabel,
} from '../../primitives/visual-primitives/literacy/storyRibbonScript';
import {
  normalizeSupportTier,
  resolveProblemShape,
  resolveSupportStructure,
  type StoryRibbonProblemShape,
  type StoryRibbonProblemShapeSpec,
  type SupportTier,
} from '../../primitives/visual-primitives/literacy/storyRibbonSupport';

const MODEL = 'gemini-flash-lite-latest';
const DEFAULT_CHALLENGE_COUNT = 3;
const MAX_CHALLENGE_COUNT = 5;

const TIER_GUARDRAIL =
  'Difficulty may change the three-event narrative arc, but never the event count, task identity, time condition, response contract, Kindergarten vocabulary ceiling, or privacy boundary.';

export const STORY_RIBBON_CHALLENGE_TYPES: StoryRibbonChallengeType[] = [
  'tell_connected_account',
  'tell_present_account',
  'tell_future_account',
  'tell_past_account',
  'story_to_experience',
];

export const STORY_RIBBON_TYPE_DOCS: Record<StoryRibbonChallengeType, ChallengeTypeDoc> = {
  tell_connected_account: {
    promptDoc: '"tell_connected_account": Arrange three pictures and tell all three event meanings in chronological order. Any consistent verb tense is accepted.',
    schemaDescription: "'tell_connected_account' (connected chronological account, tense open)",
  },
  tell_present_account: {
    promptDoc: '"tell_present_account": Arrange and tell all three events consistently in present time, as if they are happening today. Hidden model sentences use present tense.',
    schemaDescription: "'tell_present_account' (present-time account)",
  },
  tell_future_account: {
    promptDoc: '"tell_future_account": Arrange and tell all three events consistently in future time, as if they will happen tomorrow. Hidden model sentences use will + base verb.',
    schemaDescription: "'tell_future_account' (future-time account)",
  },
  tell_past_account: {
    promptDoc: '"tell_past_account": Arrange and tell all three events consistently in past time, as if they happened yesterday. Hidden model sentences use natural past-tense verbs.',
    schemaDescription: "'tell_past_account' (past-time account)",
  },
  story_to_experience: {
    promptDoc: '"story_to_experience": Choose one pictured story event, name a personal, familiar, observed, heard-about, or imagined experience, and explain the connection. Never require private disclosure or judge truth/emotion.',
    schemaDescription: "'story_to_experience' (explain story-to-world connection)",
  },
};

const PICTURE_CUES = {
  seeds: { emoji: '🌰', anchors: ['seed'] },
  watering: { emoji: '💧', anchors: ['water'] },
  flower: { emoji: '🌻', anchors: ['flower'] },
  plant: { emoji: '🌱', anchors: ['plant', 'sprout'] },
  kite: { emoji: '🪁', anchors: ['kite'] },
  tree: { emoji: '🌳', anchors: ['tree'] },
  ladder: { emoji: '🪜', anchors: ['ladder'] },
  berries: { emoji: '🫐', anchors: ['berr'] },
  basket: { emoji: '🧺', anchors: ['basket'] },
  rain: { emoji: '🌧️', anchors: ['rain'] },
  boots: { emoji: '🥾', anchors: ['boot'] },
  puddle: { emoji: '💦', anchors: ['puddle'] },
  bowl: { emoji: '🥣', anchors: ['bowl'] },
  bread: { emoji: '🍞', anchors: ['bread', 'loaf', 'dough'] },
  oven: { emoji: '♨️', anchors: ['oven'] },
  pan: { emoji: '🍳', anchors: ['pan'] },
  pancakes: { emoji: '🥞', anchors: ['pancake'] },
  bird: { emoji: '🐦', anchors: ['bird'] },
  box: { emoji: '📦', anchors: ['box'] },
  blocks: { emoji: '🧱', anchors: ['block'] },
  tower: { emoji: '🗼', anchors: ['tower'] },
  gift: { emoji: '🎁', anchors: ['gift'] },
  scissors: { emoji: '✂️', anchors: ['scissor'] },
  ribbon: { emoji: '🎀', anchors: ['ribbon'] },
  ball: { emoji: '⚽', anchors: ['ball'] },
  bandage: { emoji: '🩹', anchors: ['bandage'] },
  feather: { emoji: '🪶', anchors: ['feather'] },
  puppy: { emoji: '🐶', anchors: ['puppy', 'dog'] },
  bear: { emoji: '🐻', anchors: ['bear'] },
  cookie: { emoji: '🍪', anchors: ['cookie'] },
  backpack: { emoji: '🎒', anchors: ['backpack'] },
  book: { emoji: '📕', anchors: ['book'] },
  paint: { emoji: '🎨', anchors: ['paint'] },
  paper: { emoji: '📄', anchors: ['paper'] },
} as const;

type PictureCueKey = keyof typeof PICTURE_CUES;
const pictureCueKeys = Object.keys(PICTURE_CUES) as PictureCueKey[];

const FIELDS = [
  'challengeType', 'timeCue', 'storyTitle', 'characterName', 'characterEmoji', 'setting',
  'event0PictureKey', 'event0PictureLabel', 'event0ModelSentence',
  'event1PictureKey', 'event1PictureLabel', 'event1ModelSentence',
  'event2PictureKey', 'event2PictureLabel', 'event2ModelSentence',
] as const;

const schema: Schema = {
  type: Type.OBJECT,
  properties: Object.fromEntries(FIELDS.map((field) => {
    if (field === 'challengeType') return [field, { type: Type.STRING, enum: STORY_RIBBON_CHALLENGE_TYPES, description: 'The task identity for this challenge.' }];
    if (field === 'timeCue') return [field, { type: Type.STRING, enum: ['none', 'Today', 'Yesterday', 'Tomorrow'], description: 'Must match challengeType: present=Today, future=Tomorrow, past=Yesterday, otherwise none.' }];
    if (field.endsWith('PictureKey')) return [field, { type: Type.STRING, enum: pictureCueKeys, description: 'Choose the controlled picture that literally appears in both the label and hidden event sentence.' }];
    if (field === 'characterEmoji') return [field, { type: Type.STRING, description: 'Exactly one familiar emoji picture.' }];
    if (field.endsWith('PictureLabel')) return [field, { type: Type.STRING, description: 'Time-neutral noun phrase, 1-5 words, no sentence punctuation and no first/next/last word.' }];
    if (field.endsWith('ModelSentence')) return [field, { type: Type.STRING, description: 'One simple sentence, 3-16 words, ending punctuation, in the tense required by challengeType. This is hidden answer meaning, not a label.' }];
    if (field === 'storyTitle') return [field, { type: Type.STRING, description: 'Warm child-friendly title, 2-5 words.' }];
    if (field === 'characterName') return [field, { type: Type.STRING, description: 'One plain child, person, or animal name.' }];
    if (field === 'setting') return [field, { type: Type.STRING, description: 'Short familiar place phrase, 1-5 words.' }];
    return [field, { type: Type.STRING }];
  })),
  required: [...FIELDS],
};

const forbidden = /[_\[\]{}]|\b(?:system|assistant|judge|verdict|correct|incorrect|prompt|placeholder|todo|null|undefined)\b/i;
const emojiPattern = new RegExp(
  '^(?:\\p{Extended_Pictographic}|\\p{Emoji_Presentation})(?:\\uFE0F|\\p{Emoji_Modifier})?'
  + '(?:\\u200D(?:\\p{Extended_Pictographic}|\\p{Emoji_Presentation})(?:\\uFE0F|\\p{Emoji_Modifier})?)*$',
  'u',
);

const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const words = (value: string): number => value.split(/\s+/).filter(Boolean).length;

const cueMatchesBothTexts = (key: PictureCueKey, pictureLabel: string, modelSentence: string): boolean => {
  const label = pictureLabel.toLowerCase();
  const sentence = modelSentence.toLowerCase();
  return PICTURE_CUES[key].anchors.some((anchor) => label.includes(anchor) && sentence.includes(anchor));
};

const TIME_CUE_BY_TYPE: Record<StoryRibbonChallengeType, StoryRibbonTimeCue | 'none'> = {
  tell_connected_account: 'none',
  tell_present_account: 'Today',
  tell_future_account: 'Tomorrow',
  tell_past_account: 'Yesterday',
  story_to_experience: 'none',
};

const modelTenseMatches = (type: StoryRibbonChallengeType, sentences: string[]): boolean => {
  const joined = sentences.join(' ');
  if (type === 'tell_future_account') return sentences.every((sentence) => /\bwill\b/i.test(sentence));
  if (type === 'tell_present_account') return !/\b(?:will|yesterday|tomorrow)\b/i.test(joined);
  if (type === 'tell_past_account') return !/\b(?:will|tomorrow)\b/i.test(joined);
  return true;
};

export function validateStoryRibbonPayload(
  raw: unknown,
  index: number,
  expectedType?: StoryRibbonChallengeType,
): StoryRibbonChallenge | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const values: Record<string, string> = {};
  for (const field of FIELDS) {
    const value = text(record[field]);
    const machineField = field === 'challengeType' || field === 'timeCue' || field.endsWith('PictureKey');
    if (!value || (!machineField && forbidden.test(value))) return null;
    values[field] = value;
  }
  if (!emojiPattern.test(values.characterEmoji)) return null;
  const challengeType = values.challengeType as StoryRibbonChallengeType;
  if (!STORY_RIBBON_CHALLENGE_TYPES.includes(challengeType)) return null;
  if (expectedType && challengeType !== expectedType) return null;
  if (values.timeCue !== TIME_CUE_BY_TYPE[challengeType]) return null;
  const title = values.storyTitle;
  const characterName = values.characterName;
  const setting = values.setting;
  if (title.length > 48 || words(title) > 6 || characterName.length > 28 || words(characterName) > 3 || setting.length > 48 || words(setting) > 6) return null;

  const events: StoryRibbonEvent[] = [];
  const usedPictureKeys = new Set<PictureCueKey>();
  for (let order = 0; order < 3; order++) {
    const pictureKey = values[`event${order}PictureKey`] as PictureCueKey;
    const pictureLabel = values[`event${order}PictureLabel`];
    const modelSentence = values[`event${order}ModelSentence`];
    if (!pictureCueKeys.includes(pictureKey) || usedPictureKeys.has(pictureKey)) return null;
    if (!isPictureLabel(pictureLabel) || !isModelSentence(modelSentence)) return null;
    if (/\b(?:first|next|then|last|finally|yesterday|tomorrow)\b/i.test(pictureLabel)) return null;
    if (!cueMatchesBothTexts(pictureKey, pictureLabel, modelSentence)) return null;
    usedPictureKeys.add(pictureKey);
    events.push({
      id: `story-ribbon-${index + 1}-event-${order + 1}`,
      order,
      emoji: PICTURE_CUES[pictureKey].emoji,
      pictureLabel,
      modelSentence,
    });
  }
  if (new Set(events.map((event) => event.pictureLabel.toLowerCase())).size !== 3) return null;
  if (new Set(events.map((event) => event.modelSentence.toLowerCase())).size !== 3) return null;
  if (!modelTenseMatches(challengeType, events.map((event) => event.modelSentence))) return null;

  const challenge: StoryRibbonChallenge = {
    id: `story-ribbon-${index + 1}`,
    type: challengeType,
    title,
    characterName,
    characterEmoji: values.characterEmoji,
    setting,
    ...(values.timeCue === 'none' ? {} : { timeCue: values.timeCue as StoryRibbonTimeCue }),
    events,
  };
  return challengeAskable(challenge) ? challenge : null;
}

export const STORY_RIBBON_FALLBACKS: StoryRibbonChallenge[] = [
  {
    id: 'story-ribbon-fallback-1', type: 'tell_connected_account', title: 'A Tiny Garden',
    characterName: 'Mina', characterEmoji: '👧', setting: 'the garden',
    events: [
      { id: 'story-ribbon-fallback-1-event-1', order: 0, emoji: '🌰', pictureLabel: 'Seeds and soil', modelSentence: 'Mina planted three seeds in soft soil.' },
      { id: 'story-ribbon-fallback-1-event-2', order: 1, emoji: '💧', pictureLabel: 'Watering can', modelSentence: 'Mina watered the seeds every morning.' },
      { id: 'story-ribbon-fallback-1-event-3', order: 2, emoji: '🌱', pictureLabel: 'Green sprout', modelSentence: 'A green sprout finally pushed through the soil.' },
    ],
  },
  {
    id: 'story-ribbon-fallback-2', type: 'tell_connected_account', title: 'The Missing Kite',
    characterName: 'Omar', characterEmoji: '👦', setting: 'the park',
    events: [
      { id: 'story-ribbon-fallback-2-event-1', order: 0, emoji: '🪁', pictureLabel: 'Kite in wind', modelSentence: 'Omar flew his kite high above the park.' },
      { id: 'story-ribbon-fallback-2-event-2', order: 1, emoji: '🌳', pictureLabel: 'Tall tree', modelSentence: 'The kite got caught in a tall tree.' },
      { id: 'story-ribbon-fallback-2-event-3', order: 2, emoji: '🪜', pictureLabel: 'Ladder and kite', modelSentence: 'A park helper used a ladder to get it down.' },
    ],
  },
  {
    id: 'story-ribbon-fallback-3', type: 'tell_connected_account', title: 'Berry Picnic',
    characterName: 'Fox', characterEmoji: '🦊', setting: 'the meadow',
    events: [
      { id: 'story-ribbon-fallback-3-event-1', order: 0, emoji: '🫐', pictureLabel: 'Basket of berries', modelSentence: 'Fox filled a small basket with berries.' },
      { id: 'story-ribbon-fallback-3-event-2', order: 1, emoji: '🧺', pictureLabel: 'Picnic basket', modelSentence: 'Fox carried the basket across the meadow.' },
      { id: 'story-ribbon-fallback-3-event-3', order: 2, emoji: '🐰', pictureLabel: 'Friends together', modelSentence: 'Fox shared the berries with Rabbit at lunch.' },
    ],
  },
  {
    id: 'story-ribbon-fallback-4', type: 'tell_connected_account', title: 'Puddle Boots',
    characterName: 'Lena', characterEmoji: '👧', setting: 'the backyard',
    events: [
      { id: 'story-ribbon-fallback-4-event-1', order: 0, emoji: '🌧️', pictureLabel: 'Rainy window', modelSentence: 'Lena watched rain splash against the window.' },
      { id: 'story-ribbon-fallback-4-event-2', order: 1, emoji: '🥾', pictureLabel: 'Yellow boots', modelSentence: 'Lena pulled on her bright yellow boots.' },
      { id: 'story-ribbon-fallback-4-event-3', order: 2, emoji: '💦', pictureLabel: 'Big puddle', modelSentence: 'Lena jumped into a big puddle outside.' },
    ],
  },
];

const FALLBACK_PRESENT_SENTENCES: Record<string, [string, string, string]> = {
  'story-ribbon-fallback-1': [
    'Mina plants three seeds in soft soil.',
    'Mina waters the seeds every morning.',
    'A green sprout pushes through the soil.',
  ],
  'story-ribbon-fallback-2': [
    'Omar flies his kite high above the park.',
    'The kite gets caught in a tall tree.',
    'A park helper uses a ladder to get it down.',
  ],
  'story-ribbon-fallback-3': [
    'Fox fills a small basket with berries.',
    'Fox carries the basket across the meadow.',
    'Fox shares the berries with Rabbit at lunch.',
  ],
  'story-ribbon-fallback-4': [
    'Lena watches rain splash against the window.',
    'Lena pulls on her bright yellow boots.',
    'Lena jumps into a big puddle outside.',
  ],
};

const FALLBACK_FUTURE_SENTENCES: Record<string, [string, string, string]> = {
  'story-ribbon-fallback-1': [
    'Mina will plant three seeds in soft soil.',
    'Mina will water the seeds every morning.',
    'A green sprout will push through the soil.',
  ],
  'story-ribbon-fallback-2': [
    'Omar will fly his kite high above the park.',
    'The kite will get caught in a tall tree.',
    'A park helper will use a ladder to get it down.',
  ],
  'story-ribbon-fallback-3': [
    'Fox will fill a small basket with berries.',
    'Fox will carry the basket across the meadow.',
    'Fox will share the berries with Rabbit at lunch.',
  ],
  'story-ribbon-fallback-4': [
    'Lena will watch rain splash against the window.',
    'Lena will pull on her bright yellow boots.',
    'Lena will jump into a big puddle outside.',
  ],
};

const retargetFallback = (
  challenge: StoryRibbonChallenge,
  type: StoryRibbonChallengeType,
): StoryRibbonChallenge => {
  const sentences = type === 'tell_present_account'
    ? FALLBACK_PRESENT_SENTENCES[challenge.id]
    : type === 'tell_future_account'
      ? FALLBACK_FUTURE_SENTENCES[challenge.id]
      : challenge.events.map((event) => event.modelSentence) as [string, string, string];
  const timeCue = TIME_CUE_BY_TYPE[type];
  return {
    ...challenge,
    type,
    ...(timeCue === 'none' ? {} : { timeCue }),
    events: challenge.events.map((event, index) => ({ ...event, modelSentence: sentences[index] })),
  };
};

export interface StoryRibbonShapeCounts {
  problemCount: 0 | 1;
  setbackCount: 0 | 1;
  adaptationCount: 0 | 1;
}

const PROBLEM_MARKER = /\b(?:need(?:ed|s)?|problem|stuck|lost|dry|empty|missing|blocked)\b/i;
const SETBACK_MARKER = /\bbut\b[^.?!]*\b(?:not|never|stuck|fell|fall|falls|landed|land|lands|spilled|spill|spills|tore|tear|tears|broke|break|breaks|too)\b/i;
const ADAPTATION_MARKER = /\b(?:instead|again|another way|different|safer|more gently|wider)\b/i;
const RESULT_MARKER = /\b(?:so|solv(?:e|ed|es)|finish(?:ed|es)?|free|grew|grows|grow|ready|worked|works|work)\b/i;

/** Count only explicit, locally testable arc signals; generated prose never gets
 * credit for a harder shape merely because it labels itself as difficult. */
export const countStoryRibbonShape = (challenge: StoryRibbonChallenge): StoryRibbonShapeCounts => {
  const [first = '', second = '', third = ''] = challenge.events.map((event) => event.modelSentence);
  const setbackCount = SETBACK_MARKER.test(second) ? 1 : 0;
  const adaptationCount = ADAPTATION_MARKER.test(third) ? 1 : 0;
  const problemCount = !setbackCount && PROBLEM_MARKER.test(first) && RESULT_MARKER.test(third) ? 1 : 0;
  return { problemCount, setbackCount, adaptationCount };
};

export const storyRibbonShapeMatches = (
  challenge: StoryRibbonChallenge,
  spec: StoryRibbonProblemShapeSpec,
): boolean => {
  if (spec.structurallySaturated) return true;
  const actual = countStoryRibbonShape(challenge);
  return actual.problemCount === spec.problemTarget
    && actual.setbackCount === spec.setbackTarget
    && actual.adaptationCount === spec.adaptationTarget;
};

const tenseVerb = (
  type: StoryRibbonChallengeType,
  forms: { base: string; present: string; past: string },
): string => type === 'tell_future_account'
  ? `will ${forms.base}`
  : type === 'tell_present_account'
    ? forms.present
    : forms.past;

const negativeVerb = (
  type: StoryRibbonChallengeType,
  forms: { base: string; presentSubject: 'one' | 'many'; past?: string },
): string => type === 'tell_future_account'
  ? `will not ${forms.base}`
  : type === 'tell_present_account'
    ? `${forms.presentSubject === 'one' ? 'does' : 'do'} not ${forms.base}`
    : `did not ${forms.past ?? forms.base}`;

const beVerb = (type: StoryRibbonChallengeType, subject: 'one' | 'many' = 'one'): string => type === 'tell_future_account'
  ? 'will be'
  : type === 'tell_present_account'
    ? subject === 'one' ? 'is' : 'are'
    : subject === 'one' ? 'was' : 'were';

const structuralSentencesFor = (
  base: StoryRibbonChallenge,
  shape: StoryRibbonProblemShape,
  type: StoryRibbonChallengeType,
): [string, string, string] => {
  const name = base.characterName;
  const v = (baseForm: string, present: string, past: string) => tenseVerb(
    type,
    { base: baseForm, present, past },
  );
  const not = (baseForm: string, subject: 'one' | 'many' = 'one') => negativeVerb(
    type,
    { base: baseForm, presentSubject: subject },
  );

  if (shape === 'routine_sequence') {
    return retargetFallback(base, type).events.map((event) => event.modelSentence) as [string, string, string];
  }

  if (shape === 'problem_solution') {
    switch (base.id) {
      case 'story-ribbon-fallback-1': return [
        `${name} ${v('notice', 'notices', 'noticed')} that the seeds ${beVerb(type, 'many')} dry.`,
        `${name} ${v('use', 'uses', 'used')} water to help the seeds.`,
        `A green plant ${v('grow', 'grows', 'grew')}, so the problem ${beVerb(type)} solved.`,
      ];
      case 'story-ribbon-fallback-2': return [
        `${name}'s kite ${v('get', 'gets', 'got')} stuck in a tree.`,
        `A helper ${v('check', 'checks', 'checked')} the tree and ${v('bring', 'brings', 'brought')} a ladder.`,
        `The ladder ${v('help', 'helps', 'helped')} free the kite, so the problem ${beVerb(type)} solved.`,
      ];
      case 'story-ribbon-fallback-3': return [
        `${name} ${v('need', 'needs', 'needed')} a basket to carry the berries.`,
        `${name} ${v('fill', 'fills', 'filled')} the basket with berries.`,
        `${name} ${v('share', 'shares', 'shared')} the berries, so the picnic ${beVerb(type)} ready.`,
      ];
      default: return [
        `${name} ${v('need', 'needs', 'needed')} boots because the yard ${beVerb(type)} wet.`,
        `${name} ${v('pull', 'pulls', 'pulled')} on the boots near the rain.`,
        `${name} ${v('jump', 'jumps', 'jumped')} in a puddle, so the plan ${beVerb(type)} finished.`,
      ];
    }
  }

  switch (base.id) {
    case 'story-ribbon-fallback-1': return [
      `${name} ${v('plant', 'plants', 'planted')} three seeds in soft soil.`,
      `${name} ${v('add', 'adds', 'added')} water, but the seeds ${not('stay', 'many')} in place.`,
      `${name} ${v('plant', 'plants', 'planted')} the seeds again in a safer spot.`,
    ];
    case 'story-ribbon-fallback-2': return [
      `${name} ${v('fly', 'flies', 'flew')} a kite over the park.`,
      `The kite ${v('hit', 'hits', 'hit')} a tree, but it ${not('come')} free.`,
      `A helper ${v('use', 'uses', 'used')} a ladder instead to reach the kite.`,
    ];
    case 'story-ribbon-fallback-3': return [
      `${name} ${v('fill', 'fills', 'filled')} a basket with berries.`,
      `${name} ${v('lift', 'lifts', 'lifted')} the basket, but one handle ${not('hold')}.`,
      `${name} ${v('ask', 'asks', 'asked')} Rabbit instead to help carry the berries.`,
    ];
    default: return [
      `${name} ${v('watch', 'watches', 'watched')} the rain and ${v('choose', 'chooses', 'chose')} the boots.`,
      `${name} ${v('try', 'tries', 'tried')} the boots, but one ${not('keep')} water out.`,
      `${name} ${v('choose', 'chooses', 'chose')} another way and ${v('step', 'steps', 'stepped')} around the puddle instead.`,
    ];
  }
};

export const buildStoryRibbonShapeFallback = (
  index: number,
  mode: StoryRibbonChallengeType,
  shape: StoryRibbonProblemShape,
): StoryRibbonChallenge => {
  const base = STORY_RIBBON_FALLBACKS[index % STORY_RIBBON_FALLBACKS.length];
  const retargeted = retargetFallback(base, mode);
  const sentences = structuralSentencesFor(base, shape, mode);
  return {
    ...retargeted,
    id: `story-ribbon-${index + 1}`,
    title: index < STORY_RIBBON_FALLBACKS.length
      ? retargeted.title
      : `${retargeted.title} Again`,
    problemShape: shape,
    problemShapeSource: 'fallback',
    events: retargeted.events.map((event, order) => ({
      ...event,
      id: `story-ribbon-${index + 1}-event-${order + 1}`,
      order,
      modelSentence: sentences[order],
    })),
  };
};

/** Code-authoritative structural pass: honor an exact generated shape; otherwise
 * replace it with an explicit, deterministic, tense-correct familiar story. */
export const applyStoryRibbonDifficulty = (
  challenges: StoryRibbonChallenge[],
  tier: SupportTier | null,
): StoryRibbonChallenge[] => {
  if (!tier) return challenges;
  return challenges.map((challenge, index) => {
    const spec = resolveProblemShape(challenge.type, tier);
    if (spec.structurallySaturated) {
      return { ...challenge, problemShape: spec.storyShape, problemShapeSource: 'saturated' };
    }
    if (storyRibbonShapeMatches(challenge, spec)) {
      return { ...challenge, problemShape: spec.storyShape, problemShapeSource: 'generated' };
    }
    const rebuilt = buildStoryRibbonShapeFallback(index, challenge.type, spec.storyShape);
    const actual = countStoryRibbonShape(rebuilt);
    console.log(
      `[StoryRibbon] Rebuilt ${challenge.id} for ${spec.storyShape}: `
      + `problem ${spec.problemTarget}/${actual.problemCount}, setback ${spec.setbackTarget}/${actual.setbackCount}, `
      + `adaptation ${spec.adaptationTarget}/${actual.adaptationCount}.`,
    );
    return rebuilt;
  });
};

const SCENE_INSPIRATIONS = [
  'planting and caring for something',
  'solving a small playground problem',
  'preparing and sharing food',
  'getting ready for weather',
  'helping an animal',
  'building something simple',
  'finding and returning a lost object',
  'making a small gift',
];

export const scheduleStoryRibbonTypes = (
  resolution: EvalModeResolution | null,
  count: number,
): StoryRibbonChallengeType[] => {
  const available = (resolution?.allowedTypes ?? STORY_RIBBON_CHALLENGE_TYPES)
    .filter((type): type is StoryRibbonChallengeType =>
      STORY_RIBBON_CHALLENGE_TYPES.includes(type as StoryRibbonChallengeType));
  const source = available.length ? available : STORY_RIBBON_CHALLENGE_TYPES;
  return Array.from({ length: count }, (_, index) => source[index % source.length]);
};

/** Apply support to every challenge from its own task identity. Story content,
 * answer-bearing fields, event count/order, and time requirements are untouched. */
export const applyStoryRibbonSupport = (
  challenges: StoryRibbonChallenge[],
  tier: SupportTier | null,
): StoryRibbonChallenge[] => {
  if (!tier) return challenges;
  return challenges.map((challenge) => {
    const { promptLines: _promptLines, ...support } = resolveSupportStructure(challenge.type, tier);
    return { ...challenge, supportTier: tier, support };
  });
};

export const buildStoryRibbonTierPromptSection = (
  mode: StoryRibbonChallengeType,
  tier: SupportTier | null,
): string => {
  if (!tier) return '';
  const support = resolveSupportStructure(mode, tier);
  const shape = resolveProblemShape(mode, tier);
  return `\n## WITHIN-MODE DIFFICULTY (${tier})\n`
    + `- ${TIER_GUARDRAIL}\n`
    + [...support.promptLines, ...shape.promptLines].map((line) => `- ${line}`).join('\n')
    + '\n';
};

export const buildStoryRibbonShapeValidationReminder = (
  mode: StoryRibbonChallengeType,
  tier: SupportTier | null,
): string => {
  if (!tier || mode === 'story_to_experience') return '';
  if (tier === 'easy') {
    return 'LOCAL SHAPE CHECK: Write a routine. Do not use problem/need, "but ... did not/could not", setback, instead, again, different, or safer language.';
  }
  if (tier === 'medium') {
    return 'LOCAL SHAPE CHECK: event0ModelSentence MUST literally use one of "needed", "stuck", "dry", "missing", or "problem"; event2ModelSentence MUST literally use "so", "solved", "ready", "free", "grew", "worked", or "finished". Event 2 is a successful direct response, never a failed attempt.';
  }
  return 'LOCAL SHAPE CHECK: event1ModelSentence MUST contain "but" plus a clear setback such as "did not", "could not", "landed", "fell", "broke", "spilled", "stuck", or "too"; event2ModelSentence MUST contain "instead", "again", "another way", "different", or "safer".';
};

const requestedCount = (ctx: GenerationContext, resolution: EvalModeResolution | null): number => {
  const requested = Number(ctx.raw?.challengeCount);
  if (!Number.isFinite(requested)) return resolution ? DEFAULT_CHALLENGE_COUNT : MAX_CHALLENGE_COUNT;
  return Math.max(3, Math.min(MAX_CHALLENGE_COUNT, Math.round(requested)));
};

const rekeyFallback = (challenge: StoryRibbonChallenge, index: number): StoryRibbonChallenge => ({
  ...challenge,
  id: `story-ribbon-${index + 1}`,
  events: challenge.events.map((event, order) => ({
    ...event,
    id: `story-ribbon-${index + 1}-event-${order + 1}`,
    order,
  })),
});

export const fillWithStoryRibbonFallbacks = (
  generated: StoryRibbonChallenge[],
  count: number,
  scheduledTypes: StoryRibbonChallengeType[] = Array.from(
    { length: count },
    () => 'tell_connected_account' as const,
  ),
): { challenges: StoryRibbonChallenge[]; fallbackCount: number } => {
  const challenges = [...generated];
  let fallbackCount = 0;
  while (challenges.length < count) {
    const occupiedIds = new Set(challenges.map((challenge) => challenge.id));
    const index = Array.from({ length: count }, (_, candidate) => candidate)
      .find((candidate) => !occupiedIds.has(`story-ribbon-${candidate + 1}`));
    const fallback = STORY_RIBBON_FALLBACKS.find((candidate) =>
      !challenges.some((existing) => existing.title.toLowerCase() === candidate.title.toLowerCase()));
    if (index === undefined || !fallback) break;
    challenges.push(rekeyFallback(retargetFallback(fallback, scheduledTypes[index]), index));
    fallbackCount++;
  }
  return { challenges, fallbackCount };
};

export async function generateStoryRibbon(ctx: GenerationContext): Promise<StoryRibbonData> {
  const resolution = await resolveEvalModes(
    'story-ribbon',
    {
      targetEvalMode: ctx.targetEvalMode,
      intent: ctx.intent,
      objectiveText: ctx.objective.text,
    },
    STORY_RIBBON_TYPE_DOCS,
  );
  const count = requestedCount(ctx, resolution);
  const scheduledTypes = scheduleStoryRibbonTypes(resolution, count);
  const supportTier = ctx.supportTier ?? normalizeSupportTier(ctx.raw.difficulty);
  const pinnedType: StoryRibbonChallengeType | undefined =
    resolution && resolution.allowedTypes.length === 1
      ? resolution.allowedTypes[0] as StoryRibbonChallengeType
      : undefined;
  const activeSchema = resolution
    ? constrainChallengeTypeEnum(schema, resolution.allowedTypes, STORY_RIBBON_TYPE_DOCS, {
        fieldName: 'challengeType',
        rootLevel: true,
      })
    : schema;
  const challengeTypeSection = buildModeConstraintSection(resolution, STORY_RIBBON_TYPE_DOCS);
  console.log(
    `[StoryRibbon] modes: ${resolution ? `${resolution.modes.map((mode) => mode.evalMode).join('+')} (${resolution.source})` : 'mixed'} â†’ types [${scheduledTypes.join(', ')}]`,
  );
  const offset = Math.floor(Math.random() * SCENE_INSPIRATIONS.length);
  let rejectionCount = 0;

  const generateOne = async (
    index: number,
    attempt: number,
    usedTitles: string[],
    scheduledType: StoryRibbonChallengeType,
  ): Promise<StoryRibbonChallenge | null> => {
    try {
      // Fork B generates one story per call. Narrowing each slot to its scheduled
      // type makes curated blends and the five-type mixed path genuinely diverse.
      const slotSchema = constrainChallengeTypeEnum(
        activeSchema,
        [scheduledType],
        STORY_RIBBON_TYPE_DOCS,
        { fieldName: 'challengeType', rootLevel: true },
      );
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: `Create ONE three-picture oral story for Story Ribbon, a Kindergarten Language Arts activity.
Topic: ${ctx.topic}
Grade ceiling: ${ctx.gradeContext} (${ctx.grade ?? ctx.gradeLevel})
Specific intent: ${ctx.intent ?? ctx.title ?? 'Tell a connected account of three pictured events.'}
Objective: ${ctx.objective.text ?? 'Tell a connected account of three pictured events in chronological order.'}
${buildScopePromptSection(ctx.scope)}
Challenge ${index + 1}, attempt ${attempt + 1}. Story inspiration: ${SCENE_INSPIRATIONS[(offset + index + attempt * 3) % SCENE_INSPIRATIONS.length]}.
The assigned topic, intent, objective, and curriculum scope take precedence over the inspiration.

${challengeTypeSection}
${buildStoryRibbonTierPromptSection(scheduledType, supportTier)}
This Fork B session assigns this story slot to exactly: ${scheduledType}.

Write a concrete, coherent mini-story with exactly THREE events. The events must have one unambiguous chronological order and form a cause-to-action-to-result arc a five-year-old can retell from pictures. Use one recurring main character and one familiar setting.

TIME CONTRACT:
- tell_connected_account: timeCue = none; hidden model sentences may use natural past tense, but the child's tense is not graded.
- tell_present_account: timeCue = Today; every hidden model sentence uses present tense.
- tell_future_account: timeCue = Tomorrow; every hidden model sentence includes "will" plus a base verb.
- tell_past_account: timeCue = Yesterday; every hidden model sentence uses natural past tense.
- story_to_experience: timeCue = none; hidden model sentences describe the story events only. Never generate a personal memory for the child.

For each event:
- PictureKey: choose one value from the allowed controlled picture list. Use three different keys.
- PictureLabel: 1-5 words, a TIME-NEUTRAL NOUN PHRASE visible to the child ("Seeds and soil", "Watering can", "Green sprout"). Do not use a full sentence, a time word, or a conjugated story script.
- ModelSentence: one simple sentence, 3-16 words, in the tense required by the assigned challenge type and expressing the event meaning. The first sentence names the character. Later sentences may use the name or a clear pronoun. These sentences are hidden answer material.
- CUE ALIGNMENT IS REQUIRED: repeat at least one literal anchor word from the chosen PictureKey in BOTH PictureLabel and ModelSentence (for example, the bird key requires "bird" in both). The picture, label, and sentence must describe the same object and event.

${buildStoryRibbonShapeValidationReminder(scheduledType, supportTier)}

The child may tell the story in different words, so make each event meaning concrete and distinct. Do not write dialogue, instructions, questions, judging markers, morals, personal disclosures, or emotionally risky situations. Do not use first/next/then/last/finally inside PictureLabel. Avoid these already-used titles: ${JSON.stringify(usedTitles)}. Generate fresh content rather than copying the examples.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: slotSchema,
          systemInstruction: 'Author safe, concrete picture-story data. Every field is child-facing content or hidden story meaning, never tutor instructions.',
        },
      });
      const decoded = JSON.parse(response.text ?? 'null');
      const challenge = validateStoryRibbonPayload(decoded, index, scheduledType);
      if (!challenge) {
        rejectionCount++;
        return null;
      }
      if (supportTier) {
        const shape = resolveProblemShape(scheduledType, supportTier);
        if (!storyRibbonShapeMatches(challenge, shape)) {
          rejectionCount++;
          return null;
        }
      }
      return challenge;
    } catch {
      rejectionCount++;
      return null;
    }
  };

  const initial = await Promise.all(Array.from(
    { length: count },
    (_, index) => generateOne(index, 0, [], scheduledTypes[index]),
  ));
  const generatedChallenges: StoryRibbonChallenge[] = [];
  for (let index = 0; index < count; index++) {
    let challenge = initial[index];
    const duplicate = challenge && generatedChallenges.some((existing) => existing.title.toLowerCase() === challenge!.title.toLowerCase());
    if (duplicate) {
      rejectionCount++;
      challenge = null;
    }
    if (!challenge) {
      challenge = await generateOne(
        index,
        1,
        generatedChallenges.map((existing) => existing.title),
        scheduledTypes[index],
      );
    }
    const duplicateRetry = challenge && generatedChallenges.some((existing) => existing.title.toLowerCase() === challenge!.title.toLowerCase());
    if (duplicateRetry) {
      rejectionCount++;
      challenge = null;
    }
    if (challenge) generatedChallenges.push(challenge);
  }

  const { challenges: filledChallenges, fallbackCount } = fillWithStoryRibbonFallbacks(
    generatedChallenges,
    count,
    scheduledTypes,
  );
  const shapedChallenges = applyStoryRibbonDifficulty(filledChallenges, supportTier);
  const structuralFallbackCount = shapedChallenges.filter(
    (challenge) => challenge.problemShapeSource === 'fallback',
  ).length;
  const challenges = applyStoryRibbonSupport(shapedChallenges, supportTier);
  if (supportTier) {
    console.log(
      `[StoryRibbon] Difficulty "${supportTier}" applied per challenge (${pinnedType ? `single-mode ${pinnedType}` : 'blended'}): support withdrawn and retell story shape enforced within mode; story_to_experience saturated.`,
    );
  }
  if (rejectionCount || fallbackCount) {
    console.warn(`[story-ribbon] Rejected ${rejectionCount} generated payload(s); used ${fallbackCount} explicit familiar fallback(s).`);
  }
  if (structuralFallbackCount) {
    console.warn(`[story-ribbon] Rebuilt ${structuralFallbackCount} challenge(s) from the explicit structural fallback bank.`);
  }

  return {
    title: 'Story Ribbon',
    description: fallbackCount || structuralFallbackCount
      ? 'Use picture moments to tell connected stories, control story time, or explain a connection. Some familiar built-in stories were used.'
      : 'Use picture moments to tell connected stories, control story time, or explain a connection.',
    gradeLevel: ctx.gradeLevel,
    challengeType: new Set(challenges.map((challenge) => challenge.type)).size === 1
      ? challenges[0]?.type ?? 'mixed'
      : 'mixed',
    challenges,
  };
}
