/**
 * MeasureLab generator — Fork A (pool service).
 *
 * Gemini emits the VOCABULARY and nothing else: a pool of everyday objects with
 * an emoji each, a pool of container names, what the child pours with, and the
 * child-facing wording. Every weight, every capacity, every count and every
 * answer key is built here in code, AFTER the model call returns.
 *
 * That split is not tidiness — it is the pedagogy. A model asked for "an apple
 * that weighs more than a feather" writes the answer into the object list, and a
 * model asked for counts converges (structured output is convergent on values,
 * NUMBER_POOL_SERVICE.md), so four challenges come back as one. Here the model
 * cannot leak a quantity because it is never told one, and the four challenges
 * differ because code drew them.
 *
 * The one thing code must get right, and the reason each builder validates it:
 * a K child has to be able to be WRONG. Two objects the same weight, or two
 * containers where the taller one always holds more, are not tests — they are
 * decorations. Each builder below states the property that keeps its challenge
 * honest.
 */

import { Type, Schema } from '@google/genai';
import { ai } from '../geminiClient';
import type { GenerationContext } from '../generation/generationContext';
import type {
  ContainerShape,
  MeasureContainer,
  MeasureLabChallenge,
  MeasureLabChallengeType,
  MeasureLabData,
  MeasureObject,
} from '../../primitives/visual-primitives/math/MeasureLab';

const MODEL = 'gemini-flash-lite-latest';

const COUNT_BY_TYPE: Record<MeasureLabChallengeType, number> = {
  balance_predict: 5,
  capacity_predict: 4,
  pour_count: 4,
  order_capacity: 4,
};
const MAX_INSTANCE_COUNT = 6;

const VALID_TYPES: MeasureLabChallengeType[] = [
  'balance_predict', 'capacity_predict', 'pour_count', 'order_capacity',
];

// ---------------------------------------------------------------------------
// Code-owned randomness
// ---------------------------------------------------------------------------

const randInt = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Keep an emoji, drop a word — models sometimes answer "an apple" for an emoji slot. */
function sanitizeEmoji(raw: unknown, fallback: string): string {
  const s = String(raw ?? '').trim();
  if (!s || /[A-Za-z0-9]/.test(s)) return fallback;
  const cps = Array.from(s);
  return cps.length <= 3 ? s : cps[0];
}

const FALLBACK_OBJECT_EMOJI = ['🍎', '🪶', '🧱', '🧸', '🥄', '📚', '🪨', '🧦'];
const FALLBACK_OBJECT_NAMES = ['apple', 'feather', 'brick', 'teddy', 'spoon', 'book', 'rock', 'sock'];
const FALLBACK_CONTAINERS = ['tall jug', 'wide bowl', 'round pot', 'little cup', 'big jar', 'water bottle'];

/** Four distinct numbers containing `expected`, all 1-12 — K-sized options. */
function countOptions(expected: number, count = 4): number[] {
  const opts = new Set<number>([expected]);
  for (const d of [1, -1, 2, -2, 3, -3]) {
    if (opts.size >= count) break;
    const v = expected + d;
    if (v >= 1 && v <= 12) opts.add(v);
  }
  for (let fill = 1; opts.size < count && fill <= 12; fill++) opts.add(fill);
  return Array.from(opts).sort((a, b) => a - b);
}

// ---------------------------------------------------------------------------
// The vocabulary call — words only
// ---------------------------------------------------------------------------

interface Vocabulary {
  title: string;
  description: string;
  objects: Array<{ name: string; emoji: string }>;
  containers: string[];
  unitName: string;
  unitEmoji: string;
}

function vocabularySchema(): Schema {
  const props: Record<string, Schema> = {
    title: { type: Type.STRING, description: "Warm K title for the measuring bench (e.g. 'The Weighing Table')" },
    description: { type: Type.STRING, description: 'One short line tying the bench to the topic' },
    unitName: { type: Type.STRING, description: "What the child pours with, plural (e.g. 'cups', 'scoops')" },
    unitEmoji: { type: Type.STRING, description: 'ONE emoji for that unit. Emoji only, no words.' },
  };
  const required = ['title', 'description', 'unitName', 'unitEmoji'];
  // Flat slots rather than arrays: flash-lite drops nested arrays under an emoji
  // ask (see [[feedback_flash-lite-drops-nested-array-under-emoji-ask]]).
  for (let i = 0; i < 8; i++) {
    props[`object${i}Name`] = { type: Type.STRING, description: `Everyday object ${i} a five-year-old can name and pick up. One or two words.` };
    props[`object${i}Emoji`] = { type: Type.STRING, description: `ONE emoji picturing object ${i}. Emoji only.` };
    required.push(`object${i}Name`, `object${i}Emoji`);
  }
  for (let i = 0; i < 6; i++) {
    props[`container${i}Name`] = { type: Type.STRING, description: `Container ${i} a child would find at home or school (jug, bowl, pot). One or two words.` };
    required.push(`container${i}Name`);
  }
  return { type: Type.OBJECT, properties: props, required };
}

async function fetchVocabulary(topic: string, gradeContext: string, intent: string): Promise<Vocabulary> {
  const prompt = `Write the WORDS for a Kindergarten measuring bench (K.MD.A.1, K.MD.A.2).
The child weighs objects on a pan balance and fills containers by pouring.

TOPIC: ${topic}
AUDIENCE: ${gradeContext}
INTENT: ${intent}

YOU CHOOSE NO NUMBERS AT ALL — not weights, not capacities, not how many cups.
The app decides every quantity AFTER your answer, so a number here would be
both wrong and unfair to the child.

RULES:
- The child is five and cannot read fluently: every line is read ALOUD, so keep it short.
- EIGHT everyday objects a child could actually pick up, each with one matching emoji, all eight different.
  Pick things that genuinely differ in weight (a feather, a brick, a sock, a book) — never eight of the same kind.
- SIX container names a child would recognise. Do NOT say how big any of them is.
- Never state or hint which thing is heavier, which holds more, or how many of anything.`;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: { responseMimeType: 'application/json', responseSchema: vocabularySchema() },
  });
  if (!response.text) throw new Error('No content generated (measure-lab vocabulary)');
  const raw = JSON.parse(response.text) as Record<string, unknown>;

  const objects: Array<{ name: string; emoji: string }> = [];
  const seenName = new Set<string>();
  const seenEmoji = new Set<string>();
  for (let i = 0; i < 8; i++) {
    let name = String(raw[`object${i}Name`] ?? '').trim() || FALLBACK_OBJECT_NAMES[i];
    if (seenName.has(name.toLowerCase())) name = `${name} ${i + 1}`;
    seenName.add(name.toLowerCase());
    let emoji = sanitizeEmoji(raw[`object${i}Emoji`], FALLBACK_OBJECT_EMOJI[i]);
    if (seenEmoji.has(emoji)) emoji = FALLBACK_OBJECT_EMOJI.find((e) => !seenEmoji.has(e)) ?? FALLBACK_OBJECT_EMOJI[i];
    seenEmoji.add(emoji);
    objects.push({ name, emoji });
  }

  const containers: string[] = [];
  const seenContainer = new Set<string>();
  for (let i = 0; i < 6; i++) {
    let name = String(raw[`container${i}Name`] ?? '').trim() || FALLBACK_CONTAINERS[i];
    if (seenContainer.has(name.toLowerCase())) name = FALLBACK_CONTAINERS[i];
    seenContainer.add(name.toLowerCase());
    containers.push(name);
  }

  return {
    title: String(raw.title ?? 'The Measuring Bench'),
    description: String(raw.description ?? 'Try it and see.'),
    objects,
    containers,
    unitName: String(raw.unitName ?? 'cups').trim() || 'cups',
    unitEmoji: sanitizeEmoji(raw.unitEmoji, '🥤'),
  };
}

// ---------------------------------------------------------------------------
// Challenge builders — code owns every quantity and every key
// ---------------------------------------------------------------------------

const SHAPES: ContainerShape[] = ['tall', 'wide', 'round'];

/** balance_predict — the two objects must differ in weight, or the pan sits
 *  level and the question has no answer. */
function buildBalance(v: Vocabulary, i: number): MeasureLabChallenge {
  const pair = shuffle(v.objects).slice(0, 2);
  // Weights are ordinal, not grams: all the child ever sees is which way it tips.
  const heavy = randInt(6, 10);
  const light = randInt(1, heavy - 2);
  // WHICH SIDE the heavy object lands on alternates by index rather than being
  // drawn: left to chance, a five-item session lands all five on one side about
  // one run in sixteen, and a child who taps the right-hand object every time
  // scores full marks without weighing anything.
  const heavyFirst = i % 2 === 0;
  const left: MeasureObject = {
    id: `obj-${i}-l`,
    name: pair[0].name,
    emoji: pair[0].emoji,
    weight: heavyFirst ? heavy : light,
  };
  const right: MeasureObject = {
    id: `obj-${i}-r`,
    name: pair[1].name,
    emoji: pair[1].emoji,
    weight: heavyFirst ? light : heavy,
  };
  return {
    id: `ml-${i + 1}`,
    type: 'balance_predict',
    prompt: `Which is heavier — the ${left.name} or the ${right.name}?`,
    hint: 'Put them both on. The side that goes DOWN is heavier.',
    left,
    right,
    expectedChoice: left.weight > right.weight ? left.id : right.id,
  };
}

/** capacity_predict — the shapes differ AND the taller one is deliberately not
 *  always the bigger one. A child who learns "tall means more" has learned the
 *  wrong thing, so half the draws punish it. */
function buildCapacityPredict(v: Vocabulary, i: number): MeasureLabChallenge {
  const names = shuffle(v.containers).slice(0, 2);
  const shapes = shuffle(SHAPES).slice(0, 2) as ContainerShape[];
  const big = randInt(5, 8);
  const small = randInt(2, big - 2);
  // Two tells to defeat, so two alternations on different periods: which SIDE
  // wins flips every challenge, and whether the TALLER one wins flips every two.
  // "Always tap the left one" and "taller means more" both fail here.
  const firstWins = i % 2 === 0;
  const tallShouldWin = Math.floor(i / 2) % 2 === 0;
  const capacities = [0, 0];
  const tallIdx = shapes.indexOf('tall');
  if (tallIdx >= 0) {
    capacities[tallIdx] = tallShouldWin ? big : small;
    capacities[1 - tallIdx] = tallShouldWin ? small : big;
  } else {
    capacities[0] = firstWins ? big : small;
    capacities[1] = firstWins ? small : big;
  }

  // The side alternation is applied by ORDERING: whichever container ended up
  // bigger is placed first on even challenges and second on odd ones.
  const bigFirst = capacities[0] >= capacities[1];
  const swap = firstWins !== bigFirst;
  const idx = swap ? [1, 0] : [0, 1];
  const a: MeasureContainer = { id: `cnt-${i}-a`, name: names[idx[0]], shape: shapes[idx[0]], capacity: capacities[idx[0]] };
  const b: MeasureContainer = { id: `cnt-${i}-b`, name: names[idx[1]], shape: shapes[idx[1]], capacity: capacities[idx[1]] };
  return {
    id: `ml-${i + 1}`,
    type: 'capacity_predict',
    prompt: `Which holds more — the ${a.name} or the ${b.name}?`,
    hint: 'Fill them both and watch. The one that takes more holds more.',
    containerA: a,
    containerB: b,
    unitName: v.unitName,
    unitEmoji: v.unitEmoji,
    expectedChoice: a.capacity > b.capacity ? a.id : b.id,
  };
}

/** pour_count — the container takes a countable number of cups, and the answer
 *  is what the child poured, so it can never be read off the picture. */
function buildPourCount(v: Vocabulary, i: number): MeasureLabChallenge {
  const name = shuffle(v.containers)[0];
  const shape = SHAPES[i % SHAPES.length];
  const capacity = randInt(3, 8);
  const container: MeasureContainer = { id: `cnt-${i}`, name, shape, capacity };
  return {
    id: `ml-${i + 1}`,
    type: 'pour_count',
    prompt: `Fill the ${name} with ${v.unitName}. How many does it take?`,
    hint: `Count each ${v.unitName.replace(/s$/, '')} out loud as you pour it in.`,
    container,
    unitName: v.unitName,
    unitEmoji: v.unitEmoji,
    expectedCount: capacity,
    options: countOptions(capacity),
  };
}

/** order_capacity — three IDENTICAL jars, different amounts inside. Identical
 *  is the point: with different shapes the level is not the amount, and the K
 *  row this serves says identical containers. */
function buildOrderCapacity(v: Vocabulary, i: number): MeasureLabChallenge {
  const name = shuffle(v.containers)[0];
  const shape = SHAPES[i % SHAPES.length];
  const capacity = 8;
  // Amounts differ by at least two so the levels are visibly apart, and the
  // TRIPLE is drawn from the eight distinct combinations by index — drawing each
  // level independently repeated a triple within a four-challenge session about
  // half the time (the birth probe caught "1,5,7" twice).
  const low = [1, 2][i % 2];
  const mid = [4, 5][Math.floor(i / 2) % 2];
  const high = [7, 8][Math.floor(i / 4) % 2];
  const amounts = shuffle([low, mid, high]);
  const containers: MeasureContainer[] = amounts.map((filled, k) => ({
    id: `jar-${i}-${k}`,
    name: `${name} ${k + 1}`,
    shape,
    capacity,
    filled,
  }));
  const expectedOrder = [...containers]
    .sort((x, y) => (x.filled ?? 0) - (y.filled ?? 0))
    .map((c) => c.id);
  return {
    id: `ml-${i + 1}`,
    type: 'order_capacity',
    prompt: `Put the ${name}s in order. Start with the one that has the least.`,
    hint: 'Look at how high the water comes up in each one.',
    containers,
    unitName: v.unitName,
    unitEmoji: v.unitEmoji,
    expectedOrder,
  };
}

const BUILDER: Record<MeasureLabChallengeType, (v: Vocabulary, i: number) => MeasureLabChallenge> = {
  balance_predict: buildBalance,
  capacity_predict: buildCapacityPredict,
  pour_count: buildPourCount,
  order_capacity: buildOrderCapacity,
};

/** What makes two challenges the same problem, for dedup. */
function canonKey(ch: MeasureLabChallenge): string {
  switch (ch.type) {
    case 'balance_predict':
      return `b|${ch.left?.name}|${ch.right?.name}|${ch.expectedChoice === ch.left?.id ? 'L' : 'R'}`;
    case 'capacity_predict':
      return `c|${ch.containerA?.name}|${ch.containerB?.name}|${ch.containerA?.capacity}|${ch.containerB?.capacity}`;
    case 'pour_count':
      return `p|${ch.container?.name}|${ch.expectedCount}`;
    case 'order_capacity':
    default:
      return `o|${(ch.containers ?? []).map((c) => c.filled).join(',')}`;
  }
}

// ---------------------------------------------------------------------------
// Post-validation — a challenge the component cannot render is REJECTED
// ---------------------------------------------------------------------------

function isRenderable(ch: MeasureLabChallenge): boolean {
  switch (ch.type) {
    case 'balance_predict':
      return !!ch.left && !!ch.right
        && ch.left.weight !== ch.right.weight
        && ch.expectedChoice === (ch.left.weight > ch.right.weight ? ch.left.id : ch.right.id);
    case 'capacity_predict':
      return !!ch.containerA && !!ch.containerB
        && ch.containerA.capacity !== ch.containerB.capacity
        && ch.expectedChoice === (ch.containerA.capacity > ch.containerB.capacity ? ch.containerA.id : ch.containerB.id);
    case 'pour_count':
      return !!ch.container
        && ch.container.capacity >= 1
        && ch.expectedCount === ch.container.capacity
        && Array.isArray(ch.options)
        && ch.options.includes(ch.expectedCount);
    case 'order_capacity': {
      const cs = ch.containers ?? [];
      if (cs.length < 3) return false;
      const levels = cs.map((c) => c.filled ?? 0);
      if (new Set(levels).size !== levels.length) return false; // a tie has no order
      const sorted = [...cs].sort((a, b) => (a.filled ?? 0) - (b.filled ?? 0)).map((c) => c.id);
      return JSON.stringify(sorted) === JSON.stringify(ch.expectedOrder ?? []);
    }
    default:
      return false;
  }
}

type MeasureLabConfig = {
  intent?: string;
  instanceCount?: number;
  targetEvalMode?: string;
  objectiveText?: string;
  difficulty?: string;
};

export const generateMeasureLab = async (ctx: GenerationContext): Promise<MeasureLabData> => {
  const { topic } = ctx;
  const gradeContext = ctx.gradeContext;
  const config: MeasureLabConfig = { ...(ctx.raw as MeasureLabConfig), intent: ctx.intent };

  const pinned = config.targetEvalMode as MeasureLabChallengeType | undefined;
  const challengeType: MeasureLabChallengeType =
    pinned && VALID_TYPES.includes(pinned) ? pinned : 'balance_predict';

  const instanceCount = Math.max(
    3,
    Math.min(MAX_INSTANCE_COUNT, config.instanceCount ?? COUNT_BY_TYPE[challengeType]),
  );

  const intent = config.intent || topic;
  const vocabulary = await fetchVocabulary(topic, gradeContext, intent);

  // Build with dedup: the model's vocabulary is small, so two draws can collide.
  const build = BUILDER[challengeType];
  const challenges: MeasureLabChallenge[] = [];
  const seen = new Set<string>();
  let rejected = 0;
  for (let attempt = 0; challenges.length < instanceCount && attempt < instanceCount * 20; attempt++) {
    const ch = build(vocabulary, challenges.length);
    if (!isRenderable(ch)) { rejected++; continue; }
    const key = canonKey(ch);
    if (seen.has(key)) continue;
    seen.add(key);
    challenges.push(ch);
  }
  // A narrow candidate space is a real possibility (three containers, one shape
  // rotation); accept a repeat rather than ship a two-challenge session.
  for (let i = challenges.length; i < instanceCount; i++) {
    const ch = build(vocabulary, i);
    if (isRenderable(ch)) challenges.push(ch);
  }

  // Index-derived ids AFTER selection — parallel-safe and stable as React keys.
  const finalChallenges = challenges.map((ch, i) => ({ ...ch, id: `ml-${i + 1}` }));

  console.log(
    `[MeasureLab] ${challengeType}: ${finalChallenges.length} challenge(s)`
    + (rejected ? `, ${rejected} rejected by the render contract` : ''),
  );

  return {
    title: vocabulary.title,
    description: vocabulary.description,
    challengeType,
    challenges: finalChallenges,
  };
};
