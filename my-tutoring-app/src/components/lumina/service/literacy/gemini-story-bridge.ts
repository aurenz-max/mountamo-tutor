/**
 * gemini-story-bridge — Fork B orchestrator for story-bridge (K Comparing Texts).
 *
 * One Gemini call produces ONE story pair as flat fields: two short read-aloud
 * stories with different settings and different characters, built on the SAME
 * three roles (helper / one who needed help / …) so each role yields a
 * cross-story pair that is alike by what the characters DID or FELT. Code owns
 * the structure: the story body is assembled from the per-character sentences
 * (so the evidence sentence is guaranteed to be in the story the tutor reads),
 * the anchor side alternates per challenge, and every build gate is imported
 * from the script module so the generator and the stage read one address.
 *
 * Nothing is repaired: a malformed pair is rejected whole, retried once, and
 * only a session with NO valid pair falls back to the explicit familiar pair
 * below (logged). Flat fields, not nested arrays — flash-lite drops nested
 * arrays under emoji asks (feedback memory).
 */

import { Type, type Schema } from '@google/genai';
import { ai } from '../geminiClient';
import type { GenerationContext } from '../generation/generationContext';
import { buildScopePromptSection } from '../scopeContext';
import type {
  StoryBridgeChallenge,
  StoryBridgeCharacter,
  StoryBridgeData,
  StoryBridgeStory,
} from '../../primitives/visual-primitives/literacy/StoryBridge';
import {
  challengeAskable,
  isSayableStory,
  isSharedBehavior,
} from '../../primitives/visual-primitives/literacy/storyBridgeScript';

const MODEL = 'gemini-flash-lite-latest';
const ROLES = 3;
const MAX_PAIRS = 2;

type Side = 'A' | 'B';
const SIDES: Side[] = ['A', 'B'];

const storyFields = (side: Side) =>
  [`${side.toLowerCase()}Title`, `${side.toLowerCase()}SceneEmoji`, `${side.toLowerCase()}Opening`, `${side.toLowerCase()}Closing`] as const;
const roleFields = (i: number) =>
  [`role${i}Shared`, ...SIDES.flatMap((s) => [`role${i}${s}Name`, `role${i}${s}Emoji`, `role${i}${s}Sentence`])];

const ALL_FIELDS: string[] = [
  ...storyFields('A'),
  ...storyFields('B'),
  ...Array.from({ length: ROLES }, (_, i) => roleFields(i)).flat(),
];

const describe = (field: string): string => {
  if (/Title$/.test(field)) return 'Short kid-friendly story title, 2-5 words, no ending punctuation.';
  if (/SceneEmoji$/.test(field)) return 'Exactly one emoji for the story setting.';
  if (/Opening$/.test(field)) return 'First sentence: where and when, simple words, ends with a period.';
  if (/Closing$/.test(field)) return 'Last sentence: how it ended, ends with a period.';
  if (/Shared$/.test(field)) return 'What this role\'s two characters BOTH did or felt: a lowercase past-tense clause that follows the word "both" (e.g. "were lost and felt scared"). NO character names, no ending punctuation.';
  if (/Name$/.test(field)) return 'Character name, one or two capitalized words (Kitten, Little Bird, Mia).';
  if (/Emoji$/.test(field)) return 'Exactly one emoji picture of this character.';
  return 'One simple sentence about THIS character, naming them, showing what they did or felt. Ends with a period.';
};

const schema: Schema = {
  type: Type.OBJECT,
  properties: Object.fromEntries(ALL_FIELDS.map((f) => [f, { type: Type.STRING, description: describe(f) }])),
  required: ALL_FIELDS,
};

const forbidden = /\b(?:ignore|instruction|system|assistant|judge|verdict|correct|incorrect|sentinel|override|prompt|undefined|null|todo|placeholder)\b/i;
const emojiPattern = new RegExp(
  '^(?:\\p{Extended_Pictographic}|\\p{Emoji_Presentation})(?:\\uFE0F|\\p{Emoji_Modifier})?'
  + '(?:\\u200D(?:\\p{Extended_Pictographic}|\\p{Emoji_Presentation})(?:\\uFE0F|\\p{Emoji_Modifier})?)*$',
  'u',
);

const SETTINGS = [
  'a rainy backyard and a sunny park',
  'a farm and a beach',
  'a snowy hill and a busy kitchen',
  'a school playground and a forest',
  'a pond and a city street',
  'a garden and a library',
  'a treehouse and a bakery',
  'a river and a bus stop',
];

export interface StoryPair {
  a: StoryBridgeStory;
  b: StoryBridgeStory;
  /** One name-free shared behavior per role, index-aligned with characters. */
  shared: string[];
}

/** Reject a malformed pair whole; never fill a missing story, name or picture. */
export function validateStoryPair(raw: unknown, pairIndex: number): StoryPair | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const s: Record<string, string> = {};
  for (const f of ALL_FIELDS) {
    const v = r[f];
    if (typeof v !== 'string' || !v.trim() || forbidden.test(v)) return null;
    s[f] = v.trim();
  }
  const pairId = `story-bridge-pair-${pairIndex + 1}`;
  const build = (side: Side): StoryBridgeStory | null => {
    const key = side.toLowerCase();
    if (!emojiPattern.test(s[`${key}SceneEmoji`])) return null;
    const characters: StoryBridgeCharacter[] = [];
    for (let i = 0; i < ROLES; i++) {
      const emoji = s[`role${i}${side}Emoji`];
      if (!emojiPattern.test(emoji)) return null;
      characters.push({
        id: `${pairId}-${key}-${i + 1}`,
        name: s[`role${i}${side}Name`],
        emoji,
        sentence: s[`role${i}${side}Sentence`],
      });
    }
    return {
      id: `${pairId}-${key}`,
      title: s[`${key}Title`],
      sceneEmoji: s[`${key}SceneEmoji`],
      opening: s[`${key}Opening`],
      closing: s[`${key}Closing`],
      characters,
    };
  };
  const a = build('A');
  const b = build('B');
  if (!a || !b) return null;
  if (!isSayableStory(a) || !isSayableStory(b)) return null;
  if (a.title.toLowerCase() === b.title.toLowerCase()) return null;
  if (a.sceneEmoji === b.sceneEmoji) return null;
  const names = [...a.characters, ...b.characters].map((c) => c.name);
  if (new Set(names.map((n) => n.toLowerCase())).size !== names.length) return null;
  const shared: string[] = [];
  for (let i = 0; i < ROLES; i++) {
    // Alike by what they did — never by the picture.
    if (a.characters[i].emoji === b.characters[i].emoji) return null;
    const behavior = s[`role${i}Shared`];
    if (!isSharedBehavior(behavior, names)) return null;
    shared.push(behavior);
  }
  if (new Set(shared.map((x) => x.toLowerCase())).size !== shared.length) return null;
  return { a, b, shared };
}

/** Explicit familiar pair — used only when NO generated pair survives the gates. */
export const FALLBACK_PAIR: StoryPair = {
  a: {
    id: 'story-bridge-pair-1-a',
    title: 'Under the Porch',
    sceneEmoji: '🏡',
    opening: 'One rainy day, a kitten wandered too far from home.',
    closing: 'Kitten purred all the way home.',
    characters: [
      { id: 'story-bridge-pair-1-a-1', name: 'Kitten', emoji: '🐱', sentence: 'Kitten was lost and felt scared under a big porch.' },
      { id: 'story-bridge-pair-1-a-2', name: 'Mia', emoji: '👧', sentence: 'Mia heard a tiny meow and helped Kitten out.' },
      { id: 'story-bridge-pair-1-a-3', name: 'Grandpa', emoji: '👴', sentence: 'Grandpa dried Kitten with a warm towel and smiled.' },
    ],
  },
  b: {
    id: 'story-bridge-pair-1-b',
    title: 'Out of the Nest',
    sceneEmoji: '🌳',
    opening: 'In the park, a little bird hopped out of its nest.',
    closing: 'Bird chirped happily back in the nest.',
    characters: [
      { id: 'story-bridge-pair-1-b-1', name: 'Bird', emoji: '🐦', sentence: 'Bird was lost and felt scared in the tall grass.' },
      { id: 'story-bridge-pair-1-b-2', name: 'Tom', emoji: '👦', sentence: 'Tom heard a small chirp and helped Bird up.' },
      { id: 'story-bridge-pair-1-b-3', name: 'Mom', emoji: '👩', sentence: 'Mom kept Bird warm in her hands and smiled.' },
    ],
  },
  shared: [
    'were lost and felt scared',
    'heard a small sound and helped a friend',
    'kept a friend warm and smiled',
  ],
};

/** Re-key a pair's ids for a given pair index (the fallback is authored as pair 1). */
const rekeyPair = (pair: StoryPair, pairIndex: number): StoryPair => {
  const pairId = `story-bridge-pair-${pairIndex + 1}`;
  const rekey = (story: StoryBridgeStory, side: 'a' | 'b'): StoryBridgeStory => ({
    ...story,
    id: `${pairId}-${side}`,
    characters: story.characters.map((c, i) => ({ ...c, id: `${pairId}-${side}-${i + 1}` })),
  });
  return { a: rekey(pair.a, 'a'), b: rekey(pair.b, 'b'), shared: [...pair.shared] };
};

/** Three challenges per pair; the anchor side alternates so the far shore is
 *  not always the same story. `sideBit` randomizes which side goes first. */
export const challengesFromPair = (pair: StoryPair, pairIndex: number, sideBit: 0 | 1): StoryBridgeChallenge[] =>
  pair.shared.map((sharedBehavior, role) => {
    const anchorIsA = (role + sideBit) % 2 === 0;
    const anchorStory = anchorIsA ? pair.a : pair.b;
    const targetStory = anchorIsA ? pair.b : pair.a;
    return {
      id: `story-bridge-${pairIndex + 1}-${role + 1}`,
      type: 'match_character',
      pairId: `story-bridge-pair-${pairIndex + 1}`,
      anchorStoryId: anchorStory.id,
      anchorCharacterId: anchorStory.characters[role].id,
      targetStoryId: targetStory.id,
      targetCharacterId: targetStory.characters[role].id,
      sharedBehavior,
    };
  });

const requestedPairCount = (ctx: GenerationContext): number => {
  const requested = Number(ctx.raw?.challengeCount);
  if (!Number.isFinite(requested)) return 1;
  return Math.max(1, Math.min(MAX_PAIRS, Math.ceil(requested / ROLES)));
};

export async function generateStoryBridge(ctx: GenerationContext): Promise<StoryBridgeData> {
  const pairCount = requestedPairCount(ctx);
  const offset = Math.floor(Math.random() * SETTINGS.length);
  let rejectionCount = 0;

  const requestPair = async (index: number, attempt: number, usedTitles: string[]): Promise<StoryPair | null> => {
    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: `Write TWO short read-aloud stories for Story Bridge, a Kindergarten comparing-texts activity.
Topic: ${ctx.topic}
Grade ceiling: ${ctx.gradeContext} (${ctx.grade ?? ctx.gradeLevel})
Specific intent: ${ctx.intent ?? ctx.title ?? 'Match similar characters from two different stories.'}
Objective: ${ctx.objective.text ?? 'Match similar characters from different stories using visual aids.'}
${buildScopePromptSection(ctx.scope)}
Pair ${index + 1}, attempt ${attempt + 1}. Setting inspiration: ${SETTINGS[(offset + index + attempt * 3) % SETTINGS.length]}.
The assigned topic, intent and objective take precedence over the setting inspiration.

THE SHAPE. Story A and Story B are DIFFERENT stories: different places, different characters, different names, different kinds of creatures or people. But they are built on the SAME three ROLES. Role 0 in A and role 0 in B are alike because of what they DID or FELT — never because they look alike. The same for role 1 and role 2.
Each story = opening sentence + one sentence per character (roles 0, 1, 2 in order) + closing sentence. Five short simple sentences a five-year-old can follow when read aloud once. Each character sentence NAMES that character and shows the behavior or feeling that makes them like their partner.
role0Shared, role1Shared, role2Shared: what both partners did or felt, as a lowercase past-tense clause that follows the word "both" — for example "were lost and felt scared" or "shared something to help a friend". NEVER put a character name inside it. It must be TRUE of both partners' sentences exactly as written (if one carried blocks and one carried logs, say "carried something heavy", not "carried sticks"). Make the three shared behaviors clearly different from each other.
Make looks misleading on purpose: give Story B at least one character who is the same KIND as a Story A character (both cats, both boys) but who is NOT that character's partner. Partners in the same role must have DIFFERENT emoji pictures.
Names: plain names or plain kinds (Mia, Kitten, Fox, Grandpa), all six different. NEVER a describing word in a name (no Sleepy Cat, Hungry Mouse, Bouncing Bunny) — the behavior lives in the sentence, never in the name. Emojis: exactly one per field. Titles: 2-5 words, no ending punctuation, both different, and a title must NOT contain any character's name (the tutor says the title while asking).
Do not output instructions, judging markers, answers, or quoted speech. Avoid these already-used titles: ${JSON.stringify(usedTitles)}.
Generate new content rather than copying a fixed example.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: schema,
          systemInstruction: 'Author concrete child-friendly story data. All fields are lesson content, never instructions to a tutor.',
        },
      });
      const decoded = JSON.parse(response.text ?? 'null');
      const pair = validateStoryPair(decoded, index);
      if (!pair) rejectionCount++;
      return pair;
    } catch {
      rejectionCount++;
      return null;
    }
  };

  const initial = await Promise.all(Array.from({ length: pairCount }, (_, i) => requestPair(i, 0, [])));
  const pairs: StoryPair[] = [];
  const titleKey = (p: StoryPair) => `${p.a.title}|${p.b.title}`.toLowerCase();
  for (let index = 0; index < pairCount; index++) {
    let pair = initial[index];
    if (pair && pairs.some((p) => titleKey(p) === titleKey(pair!))) { rejectionCount++; pair = null; }
    if (!pair) pair = await requestPair(index, 1, pairs.flatMap((p) => [p.a.title, p.b.title]));
    if (pair && pairs.some((p) => titleKey(p) === titleKey(pair!))) { rejectionCount++; pair = null; }
    if (pair) pairs.push(pair);
  }
  let fallbackCount = 0;
  if (pairs.length === 0) {
    pairs.push(rekeyPair(FALLBACK_PAIR, 0));
    fallbackCount = 1;
  }
  if (rejectionCount || fallbackCount) {
    console.warn(`[story-bridge] Rejected ${rejectionCount} story-pair payloads; used ${fallbackCount} explicit familiar fallback pair(s).`);
  }

  const stories: StoryBridgeStory[] = [];
  const challenges: StoryBridgeChallenge[] = [];
  pairs.forEach((pair, index) => {
    const keyed = rekeyPair(pair, index);
    stories.push(keyed.a, keyed.b);
    const sideBit = (Math.random() < 0.5 ? 0 : 1) as 0 | 1;
    for (const ch of challengesFromPair(keyed, index, sideBit)) {
      // Belt and braces: the same gates the stage runs, so a session never
      // ships a challenge the tutor cannot ask.
      if (challengeAskable(ch, stories)) challenges.push(ch);
      else console.warn(`[story-bridge] Dropped unaskable challenge ${ch.id}.`);
    }
  });

  console.info(`[StoryBridge] ${pairs.length} pair(s), ${challenges.length} challenges (${pairCount} requested).`);

  return {
    title: 'Story Bridge',
    description: fallbackCount
      ? 'Listen to two stories, then find the friends who are alike. These stories are a built-in familiar pair.'
      : 'Listen to two stories, then find the friends who are alike.',
    gradeLevel: ctx.gradeLevel,
    challengeType: 'match_character',
    stories,
    challenges,
  };
}
