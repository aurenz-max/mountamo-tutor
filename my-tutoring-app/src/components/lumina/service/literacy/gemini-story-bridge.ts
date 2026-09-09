/** Fork B story-pair orchestrator for Story Bridge. */

import { Type, type Schema } from '@google/genai';
import { ai } from '../geminiClient';
import type { GenerationContext } from '../generation/generationContext';
import { buildScopePromptSection } from '../scopeContext';
import {
  buildModeConstraintSection, constrainChallengeTypeEnum, resolveEvalModes,
  type ChallengeTypeDoc, type EvalModeResolution,
} from '../evalMode';
import type {
  StoryBridgeChallenge, StoryBridgeChallengeType, StoryBridgeCharacter,
  StoryBridgeData, StoryBridgeRelation, StoryBridgeStory,
} from '../../primitives/visual-primitives/literacy/StoryBridge';
import {
  challengeAskable, isComparisonSummary, isSayableStory, isSharedBehavior,
} from '../../primitives/visual-primitives/literacy/storyBridgeScript';

const MODEL = 'gemini-flash-lite-latest';
const ROLES = 3;
type Side = 'A' | 'B';
const SIDES: Side[] = ['A', 'B'];

export const STORY_BRIDGE_CHALLENGE_TYPES: StoryBridgeChallengeType[] = [
  'match_character', 'match_setting', 'say_alike', 'say_different',
  'venn_place', 'sequence_two', 'main_idea_compare',
];

export const STORY_BRIDGE_TYPE_DOCS: Record<StoryBridgeChallengeType, ChallengeTypeDoc> = {
  match_character: {
    promptDoc: '"match_character": Hear both stories, then tap the far-story character who acted or felt alike. Partners must look different.',
    schemaDescription: "'match_character' (picture-supported character match)",
  },
  match_setting: {
    promptDoc: '"match_setting": Compare the two illustrated settings and choose same kind or different kinds. The openings are the evidence.',
    schemaDescription: "'match_setting' (pictured same/different setting choice)",
  },
  say_alike: {
    promptDoc: '"say_alike": Name one way two paired characters are alike using evidence from both read-alouds. Multiple defensible paraphrases must work.',
    schemaDescription: "'say_alike' (spoken character similarity)",
  },
  say_different: {
    promptDoc: '"say_different": Name one way two paired characters are different using evidence from both read-alouds. Multiple defensible contrasts must work.',
    schemaDescription: "'say_different' (spoken character contrast)",
  },
  venn_place: {
    promptDoc: '"venn_place": Put a character detail in story-one only, both, or story-two only on a three-region picture Venn diagram.',
    schemaDescription: "'venn_place' (guided picture Venn placement)",
  },
  sequence_two: {
    promptDoc: '"sequence_two": Match beginning, middle, and ending event pictures across both story sequences.',
    schemaDescription: "'sequence_two' (paired event-sequence cards)",
  },
  main_idea_compare: {
    promptDoc: '"main_idea_compare": Say a defensible similarity or difference between the two simple story main ideas, grounded in both texts.',
    schemaDescription: "'main_idea_compare' (spoken main-idea comparison)",
  },
};

const storyFields = (side: Side) => {
  const key = side.toLowerCase();
  return [`${key}Title`, `${key}SceneEmoji`, `${key}Setting`, `${key}Opening`, `${key}Closing`, `${key}MainIdea`] as const;
};
const roleFields = (index: number) => [
  `role${index}Shared`,
  ...SIDES.flatMap((side) => [
    `role${index}${side}Name`, `role${index}${side}Emoji`, `role${index}${side}EventEmoji`,
    `role${index}${side}Sentence`, `role${index}${side}Unique`,
  ]),
];

const CONTENT_FIELDS: string[] = [
  ...storyFields('A'), ...storyFields('B'),
  'settingRelation', 'settingComparison', 'mainIdeaRelation', 'mainIdeaComparison',
  ...Array.from({ length: ROLES }, (_, index) => roleFields(index)).flat(),
];

const describe = (field: string): string => {
  if (/Title$/.test(field)) return 'Short child-friendly story title, 2-5 words, no ending punctuation and no character name.';
  if (/SceneEmoji$/.test(field)) return 'Exactly one emoji illustrating the story setting.';
  if (/Setting$/.test(field)) return 'Short familiar setting phrase, 2-7 words.';
  if (/Opening$/.test(field)) return 'First sentence naming where or when the story happens; simple words and ending punctuation.';
  if (/Closing$/.test(field)) return 'Last sentence showing how the story ended; simple words and ending punctuation.';
  if (/MainIdea$/.test(field)) return 'One simple complete sentence stating the story main idea without using a character name.';
  if (/Relation$/.test(field)) return 'Whether the two referenced ideas are meaningfully the same kind or different.';
  if (/Comparison$/.test(field)) return 'One simple complete sentence comparing BOTH stories; true of the authored text.';
  if (/Shared$/.test(field)) return 'Name-free lowercase past-tense clause true of BOTH paired characters, following the word both; no ending punctuation.';
  if (/Name$/.test(field)) return 'Plain character name, one or two capitalized words, no describing-word answer clues.';
  if (/EventEmoji$/.test(field)) return 'Exactly one emoji illustrating this character event, different from the other two event pictures in its story.';
  if (/Emoji$/.test(field)) return 'Exactly one emoji picture of this character; paired characters use different pictures.';
  if (/Unique$/.test(field)) return 'Name-free lowercase past-tense clause true of THIS character and false of the paired character; no ending punctuation.';
  return 'One simple sentence naming this character and showing their chronological event; ending punctuation.';
};

const schema: Schema = {
  type: Type.OBJECT,
  properties: {
    challengeType: { type: Type.STRING, enum: STORY_BRIDGE_CHALLENGE_TYPES, description: 'The comparison task identity emphasized by this story pair.' },
    ...Object.fromEntries(CONTENT_FIELDS.map((field) => {
      if (field === 'settingRelation' || field === 'mainIdeaRelation') {
        return [field, { type: Type.STRING, enum: ['same', 'different'], description: describe(field) }];
      }
      return [field, { type: Type.STRING, description: describe(field) }];
    })),
  },
  required: ['challengeType', ...CONTENT_FIELDS],
};

const forbidden = /\b(?:ignore|instruction|system|assistant|judge|verdict|correct|incorrect|sentinel|override|prompt|undefined|null|todo|placeholder)\b/i;
const emojiPattern = new RegExp(
  '^(?:\\p{Extended_Pictographic}|\\p{Emoji_Presentation})(?:\\uFE0F|\\p{Emoji_Modifier})?'
  + '(?:\\u200D(?:\\p{Extended_Pictographic}|\\p{Emoji_Presentation})(?:\\uFE0F|\\p{Emoji_Modifier})?)*$',
  'u',
);

const SETTINGS = [
  'two outdoor places', 'an indoor place and an outdoor place', 'two places where people work',
  'a farm and a garden', 'a library and a classroom', 'a park and a beach',
];

export interface StoryPair {
  a: StoryBridgeStory;
  b: StoryBridgeStory;
  shared: string[];
  settingRelation: StoryBridgeRelation;
  settingComparison: string;
  mainIdeaRelation: StoryBridgeRelation;
  mainIdeaComparison: string;
}

const text = (record: Record<string, unknown>, field: string): string =>
  typeof record[field] === 'string' ? record[field].trim() : '';

/** Reject a malformed pair whole; never repair answer-bearing story material. */
export function validateStoryPair(
  raw: unknown,
  pairIndex: number,
  allowedTypes: readonly StoryBridgeChallengeType[] = STORY_BRIDGE_CHALLENGE_TYPES,
): StoryPair | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const rawType = (text(record, 'challengeType') || 'match_character') as StoryBridgeChallengeType;
  if (!STORY_BRIDGE_CHALLENGE_TYPES.includes(rawType) || !allowedTypes.includes(rawType)) return null;
  const values: Record<string, string> = {};
  for (const field of CONTENT_FIELDS) {
    const value = text(record, field);
    const machine = field === 'settingRelation' || field === 'mainIdeaRelation';
    if (!value || (!machine && forbidden.test(value))) return null;
    values[field] = value;
  }
  const pairId = `story-bridge-pair-${pairIndex + 1}`;
  const build = (side: Side): StoryBridgeStory | null => {
    const key = side.toLowerCase();
    if (!emojiPattern.test(values[`${key}SceneEmoji`])) return null;
    const characters: StoryBridgeCharacter[] = [];
    for (let index = 0; index < ROLES; index++) {
      const emoji = values[`role${index}${side}Emoji`];
      const eventEmoji = values[`role${index}${side}EventEmoji`];
      if (!emojiPattern.test(emoji) || !emojiPattern.test(eventEmoji)) return null;
      characters.push({
        id: `${pairId}-${key}-${index + 1}`,
        name: values[`role${index}${side}Name`],
        emoji,
        eventEmoji,
        sentence: values[`role${index}${side}Sentence`],
        uniqueDetail: values[`role${index}${side}Unique`],
      });
    }
    return {
      id: `${pairId}-${key}`,
      title: values[`${key}Title`],
      sceneEmoji: values[`${key}SceneEmoji`],
      setting: values[`${key}Setting`],
      opening: values[`${key}Opening`],
      closing: values[`${key}Closing`],
      mainIdea: values[`${key}MainIdea`],
      characters,
    };
  };
  const a = build('A');
  const b = build('B');
  if (!a || !b || !isSayableStory(a) || !isSayableStory(b)) return null;
  if (a.title.toLowerCase() === b.title.toLowerCase() || a.sceneEmoji === b.sceneEmoji) return null;
  const names = [...a.characters, ...b.characters].map((character) => character.name);
  if (new Set(names.map((name) => name.toLowerCase())).size !== names.length) return null;
  const shared: string[] = [];
  for (let index = 0; index < ROLES; index++) {
    if (a.characters[index].emoji === b.characters[index].emoji) return null;
    const behavior = values[`role${index}Shared`];
    if (!isSharedBehavior(behavior, names)) return null;
    if (!isSharedBehavior(a.characters[index].uniqueDetail, names)) return null;
    if (!isSharedBehavior(b.characters[index].uniqueDetail, names)) return null;
    if (a.characters[index].uniqueDetail.toLowerCase() === b.characters[index].uniqueDetail.toLowerCase()) return null;
    shared.push(behavior);
  }
  if (new Set(shared.map((behavior) => behavior.toLowerCase())).size !== shared.length) return null;
  const settingRelation = values.settingRelation as StoryBridgeRelation;
  const mainIdeaRelation = values.mainIdeaRelation as StoryBridgeRelation;
  if (!['same', 'different'].includes(settingRelation) || !['same', 'different'].includes(mainIdeaRelation)) return null;
  if (!isComparisonSummary(values.settingComparison) || !isComparisonSummary(values.mainIdeaComparison)) return null;
  return {
    a, b, shared, settingRelation, settingComparison: values.settingComparison,
    mainIdeaRelation, mainIdeaComparison: values.mainIdeaComparison,
  };
}

export const FALLBACK_PAIR: StoryPair = {
  a: {
    id: 'story-bridge-pair-1-a', title: 'Under the Porch', sceneEmoji: '🏡', setting: 'a rainy porch',
    opening: 'One rainy day, a kitten wandered too far from home.',
    closing: 'Kitten purred all the way home.',
    mainIdea: 'Helping a lost friend can make them feel safe.',
    characters: [
      { id: 'story-bridge-pair-1-a-1', name: 'Kitten', emoji: '🐱', eventEmoji: '🏠', sentence: 'Kitten was lost and felt scared under a big porch.', uniqueDetail: 'hid under a porch' },
      { id: 'story-bridge-pair-1-a-2', name: 'Mia', emoji: '👧', eventEmoji: '👂', sentence: 'Mia heard a tiny meow and helped Kitten out.', uniqueDetail: 'followed a tiny meow' },
      { id: 'story-bridge-pair-1-a-3', name: 'Grandpa', emoji: '👴', eventEmoji: '🧺', sentence: 'Grandpa dried Kitten with a warm towel and smiled.', uniqueDetail: 'used a warm towel' },
    ],
  },
  b: {
    id: 'story-bridge-pair-1-b', title: 'Out of the Nest', sceneEmoji: '🌳', setting: 'a grassy park',
    opening: 'In the park, a little bird hopped out of its nest.',
    closing: 'Bird chirped happily back in the nest.',
    mainIdea: 'Helping a lost friend can make them feel safe.',
    characters: [
      { id: 'story-bridge-pair-1-b-1', name: 'Bird', emoji: '🐦', eventEmoji: '🌿', sentence: 'Bird was lost and felt scared in the tall grass.', uniqueDetail: 'waited in tall grass' },
      { id: 'story-bridge-pair-1-b-2', name: 'Tom', emoji: '👦', eventEmoji: '🙋', sentence: 'Tom heard a small chirp and helped Bird up.', uniqueDetail: 'followed a small chirp' },
      { id: 'story-bridge-pair-1-b-3', name: 'Mom', emoji: '👩', eventEmoji: '🤲', sentence: 'Mom kept Bird warm in her hands and smiled.', uniqueDetail: 'used her warm hands' },
    ],
  },
  shared: ['were lost and felt scared', 'heard a small sound and helped a friend', 'kept a friend warm and smiled'],
  settingRelation: 'same',
  settingComparison: 'Both stories happened in outdoor places.',
  mainIdeaRelation: 'same',
  mainIdeaComparison: 'Both stories show friends helping a lost animal feel safe.',
};

const rekeyPair = (pair: StoryPair, pairIndex: number): StoryPair => {
  const pairId = `story-bridge-pair-${pairIndex + 1}`;
  const rekey = (story: StoryBridgeStory, side: 'a' | 'b'): StoryBridgeStory => ({
    ...story, id: `${pairId}-${side}`,
    characters: story.characters.map((character, index) => ({ ...character, id: `${pairId}-${side}-${index + 1}` })),
  });
  return { ...pair, a: rekey(pair.a, 'a'), b: rekey(pair.b, 'b'), shared: [...pair.shared] };
};

const MAX_ITEMS_BY_TYPE: Record<StoryBridgeChallengeType, number> = {
  match_character: 3, match_setting: 1, say_alike: 3, say_different: 3,
  venn_place: 3, sequence_two: 3, main_idea_compare: 1,
};

export const scheduleStoryBridgeTypes = (
  resolution: EvalModeResolution | null,
  requested?: number,
): StoryBridgeChallengeType[] => {
  const available = (resolution?.allowedTypes ?? STORY_BRIDGE_CHALLENGE_TYPES)
    .filter((type): type is StoryBridgeChallengeType => STORY_BRIDGE_CHALLENGE_TYPES.includes(type as StoryBridgeChallengeType));
  const source = available.length ? available : STORY_BRIDGE_CHALLENGE_TYPES;
  const naturalDefault = source.length === 1 ? MAX_ITEMS_BY_TYPE[source[0]]
    : resolution ? Math.max(3, source.length) : STORY_BRIDGE_CHALLENGE_TYPES.length;
  const wanted = Number.isFinite(requested) ? Math.max(1, Math.min(12, Math.floor(requested!))) : naturalDefault;
  const counts = new Map<StoryBridgeChallengeType, number>();
  const scheduled: StoryBridgeChallengeType[] = [];
  while (scheduled.length < wanted) {
    let added = false;
    for (const type of source) {
      const used = counts.get(type) ?? 0;
      if (used >= MAX_ITEMS_BY_TYPE[type] || scheduled.length >= wanted) continue;
      scheduled.push(type);
      counts.set(type, used + 1);
      added = true;
    }
    if (!added) break;
  }
  return scheduled;
};

/** Default remains the three birth-mode character challenges for old callers. */
export const challengesFromPair = (
  pair: StoryPair,
  pairIndex: number,
  sideBit: 0 | 1,
  scheduledTypes: readonly StoryBridgeChallengeType[] = ['match_character', 'match_character', 'match_character'],
): StoryBridgeChallenge[] => {
  const pairId = `story-bridge-pair-${pairIndex + 1}`;
  const storyAId = pair.a.id;
  const storyBId = pair.b.id;
  const occurrences = new Map<StoryBridgeChallengeType, number>();
  const challenges: StoryBridgeChallenge[] = [];
  for (const type of scheduledTypes) {
    const occurrence = occurrences.get(type) ?? 0;
    occurrences.set(type, occurrence + 1);
    let challenge: Omit<StoryBridgeChallenge, 'id'> | null = null;
    const role = Math.min(occurrence, ROLES - 1);
    const anchorIsA = (role + sideBit) % 2 === 0;
    const anchorStory = anchorIsA ? pair.a : pair.b;
    const targetStory = anchorIsA ? pair.b : pair.a;
    const anchor = anchorStory.characters[role];
    const target = targetStory.characters[role];
    const pairFields = { pairId, storyAId, storyBId };
    switch (type) {
      case 'match_character':
        challenge = { ...pairFields, type, anchorStoryId: anchorStory.id, anchorCharacterId: anchor.id, targetStoryId: targetStory.id, targetCharacterId: target.id, sharedBehavior: pair.shared[role], comparisonSummary: `${anchor.name} and ${target.name} both ${pair.shared[role]}.` };
        break;
      case 'match_setting':
        if (occurrence === 0) challenge = { ...pairFields, type, relation: pair.settingRelation, settingFocus: 'place', comparisonSummary: pair.settingComparison };
        break;
      case 'say_alike':
        challenge = { ...pairFields, type, anchorStoryId: anchorStory.id, anchorCharacterId: anchor.id, targetStoryId: targetStory.id, targetCharacterId: target.id, sharedBehavior: pair.shared[role], comparisonSummary: `${anchor.name} and ${target.name} both ${pair.shared[role]}.` };
        break;
      case 'say_different':
        challenge = { ...pairFields, type, anchorStoryId: anchorStory.id, anchorCharacterId: anchor.id, targetStoryId: targetStory.id, targetCharacterId: target.id, comparisonSummary: `${anchor.name} ${anchor.uniqueDetail}, but ${target.name} ${target.uniqueDetail}.` };
        break;
      case 'venn_place': {
        if (occurrence > 2) break;
        const vennAnchor = pair.a.characters[0];
        const vennTarget = pair.b.characters[0];
        const region = (['story_a', 'both', 'story_b'] as const)[occurrence];
        const detail = region === 'story_a' ? vennAnchor.uniqueDetail : region === 'story_b' ? vennTarget.uniqueDetail : pair.shared[0];
        const summary = region === 'both'
          ? `${vennAnchor.name} and ${vennTarget.name} both ${detail}.`
          : region === 'story_a'
            ? `${vennAnchor.name} ${detail}, but ${vennTarget.name} did not.`
            : `${vennTarget.name} ${detail}, but ${vennAnchor.name} did not.`;
        challenge = { ...pairFields, type, anchorStoryId: pair.a.id, anchorCharacterId: vennAnchor.id, targetStoryId: pair.b.id, targetCharacterId: vennTarget.id, vennDetail: detail, vennRegion: region, comparisonSummary: summary };
        break;
      }
      case 'sequence_two':
        challenge = { ...pairFields, type, anchorEventIndex: role, targetEventIndex: role, comparisonSummary: `Both events happen in the ${['beginning', 'middle', 'ending'][role]} of their stories.` };
        break;
      case 'main_idea_compare':
        if (occurrence === 0) challenge = { ...pairFields, type, relation: pair.mainIdeaRelation, comparisonSummary: pair.mainIdeaComparison };
        break;
    }
    if (challenge) challenges.push({ ...challenge, id: `story-bridge-${pairIndex + 1}-${challenges.length + 1}` });
  }
  return challenges;
};

export async function generateStoryBridge(ctx: GenerationContext): Promise<StoryBridgeData> {
  const resolution = await resolveEvalModes(
    'story-bridge',
    { targetEvalMode: ctx.targetEvalMode, intent: ctx.intent, objectiveText: ctx.objective.text },
    STORY_BRIDGE_TYPE_DOCS,
  );
  const requested = Number(ctx.raw?.challengeCount);
  const scheduledTypes = scheduleStoryBridgeTypes(resolution, Number.isFinite(requested) ? requested : undefined);
  const activeSchema = resolution
    ? constrainChallengeTypeEnum(schema, resolution.allowedTypes, STORY_BRIDGE_TYPE_DOCS, { fieldName: 'challengeType', rootLevel: true })
    : schema;
  const challengeTypeSection = buildModeConstraintSection(resolution, STORY_BRIDGE_TYPE_DOCS);
  console.info(`[StoryBridge] modes: ${resolution ? `${resolution.modes.map((mode) => mode.evalMode).join('+')} (${resolution.source})` : 'mixed'} → types [${scheduledTypes.join(', ')}]`);
  const offset = Math.floor(Math.random() * SETTINGS.length);
  let rejectionCount = 0;

  const requestPair = async (attempt: number): Promise<StoryPair | null> => {
    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: `Write TWO short read-aloud stories for Story Bridge, a Kindergarten comparing-texts activity.
Topic: ${ctx.topic}
Grade ceiling: ${ctx.gradeContext} (${ctx.grade ?? ctx.gradeLevel})
Specific intent: ${ctx.intent ?? ctx.title ?? 'Compare characters, settings, events, and ideas across two stories.'}
Objective: ${ctx.objective.text ?? 'Compare two illustrated stories using evidence from both.'}
${buildScopePromptSection(ctx.scope)}
Attempt ${attempt + 1}. Setting inspiration: ${SETTINGS[(offset + attempt * 3) % SETTINGS.length]}.
The assigned topic, intent, objective, and curriculum scope take precedence over the inspiration.

${challengeTypeSection}

ONE SHARED CONTEXT. Author exactly two DIFFERENT five-sentence stories that support EVERY comparison field below. The app keeps these same two read-alouds available for the whole session; do not invent a third story.
Each story is assembled as opening + role 0 sentence + role 1 sentence + role 2 sentence + closing. The three role sentences are chronological beginning, middle, and ending events and each gets a literal event emoji.
Role 0 in A and role 0 in B are alike by what they did or felt, and likewise for roles 1 and 2. Partners must have different character pictures. Make looks misleading: at least one non-partner across stories may be the same kind of person or animal.
Every role also has one unique clause for each partner. A unique clause must be true of that character's written sentence and false of the partner's sentence. Keep it concrete enough for a five-year-old.

SETTING. The two story places must be visibly distinct pictures, even when settingRelation is same. Use same when both are the same broad kind (two outdoor places, two homes); use different for a meaningful K-level contrast (inside versus outside). settingComparison is a complete sentence that cites both.
MAIN IDEA. Give each story one simple main-idea sentence. mainIdeaComparison must compare both ideas accurately. Multiple other defensible comparisons should remain possible from the stories.
EVIDENCE. Every comparison must be grounded in the exact two stories. A character sentence names that character. shared and unique clauses never contain names. Titles contain no character names.
ACCESS. Five short simple sentences per story, familiar vocabulary, no reading required to answer because the tutor reads all text and the screen uses pictures. No quoted speech.
Do not output tutor instructions, judging words, answer labels, blank markers, or placeholders. Generate new content rather than copying a fixed example.`,
        config: {
          responseMimeType: 'application/json', responseSchema: activeSchema,
          systemInstruction: 'Author concrete child-friendly story data. Every field is lesson content, never an instruction to a tutor.',
        },
      });
      const decoded = JSON.parse(response.text ?? 'null');
      const pair = validateStoryPair(decoded, 0, (resolution?.allowedTypes ?? STORY_BRIDGE_CHALLENGE_TYPES) as StoryBridgeChallengeType[]);
      if (!pair) rejectionCount++;
      return pair;
    } catch {
      rejectionCount++;
      return null;
    }
  };

  let pair = await requestPair(0);
  if (!pair) pair = await requestPair(1);
  let fallbackCount = 0;
  if (!pair) {
    pair = rekeyPair(FALLBACK_PAIR, 0);
    fallbackCount = 1;
  }
  const keyed = rekeyPair(pair, 0);
  const stories = [keyed.a, keyed.b];
  const sideBit = (Math.random() < 0.5 ? 0 : 1) as 0 | 1;
  const challenges = challengesFromPair(keyed, 0, sideBit, scheduledTypes)
    .filter((challenge) => challengeAskable(challenge, stories));
  if (rejectionCount || fallbackCount) {
    console.warn(`[story-bridge] Rejected ${rejectionCount} story-pair payload(s); used ${fallbackCount} explicit familiar fallback pair(s).`);
  }
  console.info(`[StoryBridge] one story pair, ${challenges.length} challenge(s) → [${challenges.map((challenge) => challenge.type).join(', ')}]`);
  const modeSet = new Set(challenges.map((challenge) => challenge.type));
  return {
    title: 'Story Bridge',
    description: fallbackCount
      ? 'Compare characters, settings, events, and big ideas across two familiar illustrated stories.'
      : 'Compare characters, settings, events, and big ideas across two illustrated stories.',
    gradeLevel: ctx.gradeLevel,
    challengeType: modeSet.size === 1 ? challenges[0]?.type ?? 'mixed' : 'mixed',
    stories,
    challenges,
  };
}
