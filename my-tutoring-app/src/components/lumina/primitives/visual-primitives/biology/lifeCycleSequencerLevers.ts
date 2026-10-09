/**
 * life-cycle-sequencer's in-item levers (/add-support-tiers; report qa/eval-reports/life-cycle-sequencer-levers-2026-10-09.md).
 * No real-learner evidence: the misses are what `cycleMiss` observes; the catalog's commonStruggles name "orders by
 * size", "follows the order the cards are shown in", "stuck on two middle stages" and "thinks a circle has an end".
 * The order of the stages IS the answer, so no lever places, numbers, ranks or names a stage the learner has not
 * already had marked right.
 *
 * Help (the screen does more; the item is unchanged):
 * - `time_arrow` an arrow over the slots from slot 1 (a flag: the start) to the last slot (later); on a circle a
 *   second arrow curves from the last slot back to slot 1. No stage is on it. Answers `reversed`, `mixed_order`.
 * - `keep_right` after a checked miss, the stages the check already marked right stay locked in their slots and the
 *   rest go back to the cards, so the learner re-orders only what was wrong. It shows nothing the check's marks did
 *   not (`keptLeaks`: only slots marked right, never all of them). Refused before a check, or with none right.
 *
 * Simplify (`fewer_stages`): an ungraded practice sequence of the same shape (line or circle) with three stages, from
 * a code pool of familiar cycles. Never one that shares a word with the item's stages or names its organism, so it
 * never orders part of the item (`practiceLeaks`).
 *
 * `cycle_rotated` (a circle in the right order started from another stage) has no lever: which stage the item starts
 * from is the item's own choice, and a lever that shows it places a stage.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { TeachingAssignment } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { LifeCycleSequencerData, LifeCycleStage } from './LifeCycleSequencer';
import { CYCLE_ITEM_ID, lifeCycleItem, type CycleMiss, type LifeCycleItem } from './lifeCycleSequencerWorkspace';

export const ARROW_LEVER = 'time_arrow';
export const KEEP_LEVER = 'keep_right';
export const FEWER_LEVER = 'fewer_stages';
export const PRACTICE_SUFFIX = '~simpler';
export const PRACTICE_NOTE = 'An easier practice sequence, ungraded; the full sequence comes back after it.';

export const isPracticeCycle = (c: Pick<LifeCycleItem, 'id'>) => c.id.endsWith(PRACTICE_SUFFIX);
export const practiceParentId = (id: string | null | undefined) =>
  id?.endsWith(PRACTICE_SUFFIX) ? id.slice(0, -PRACTICE_SUFFIX.length) : null;

// ── keep_right ─────────────────────────────────────────────────────────────

/**
 * The slots to lock: those the last check marked right, each with the stage in it. Null when nothing can be kept
 * (no check yet, none right, or all right).
 */
export function keptSlots(item: LifeCycleItem, slots: readonly (string | null)[],
  marked: { right: readonly number[]; wrong: readonly number[] } | null): Record<number, string> | null {
  if (!marked || !marked.right.length || !marked.wrong.length) return null;
  const kept: Record<number, string> = {};
  for (const i of marked.right) if (slots[i]) kept[i] = slots[i]!;
  return keptLeaks(item, kept) || !Object.keys(kept).length ? null : kept;
}

/** Leak rule: a kept stage is one the check put in its right slot, and never every stage (that is the whole order). */
export function keptLeaks(item: LifeCycleItem, kept: Readonly<Record<number, string>>): boolean {
  const entries = Object.entries(kept);
  return entries.length >= item.stages.length
    || entries.some(([slot, id]) => item.stages.find(s => s.id === id)?.correctPosition !== Number(slot));
}

// ── fewer_stages (simplify) ────────────────────────────────────────────────

type PoolEntry = { topic: readonly string[]; title: string; labels: [string, string, string]; descriptions: [string, string, string] };

/** Familiar sequences of three, kid words; `topic` words keep a practice off the item's own organism or process. */
const POOL: Record<LifeCycleItem['cycleType'], PoolEntry[]> = {
  linear: [
    { topic: ['plant', 'sunflower', 'seed', 'flower', 'bean', 'germinat'], title: 'How a sunflower grows',
      labels: ['Seed in the Dirt', 'Little Green Sprout', 'Tall Sunflower'],
      descriptions: ['A small seed sits in the dirt.', 'A tiny green shoot pokes up.', 'A tall plant with a big yellow flower.'] },
    { topic: ['chicken', 'hen', 'chick', 'bird', 'duck'], title: 'How a chicken grows',
      labels: ['Speckled Egg', 'Fluffy Chick', 'Grown Hen'],
      descriptions: ['An egg sits in a warm nest.', 'A small fluffy bird peeps.', 'A big bird pecks at corn.'] },
    { topic: ['human', 'person', 'people', 'baby', 'child'], title: 'How a person grows',
      labels: ['Tiny Baby', 'Young Kid', 'Grown-up'],
      descriptions: ['A baby sleeps in a crib.', 'A kid runs and plays.', 'A grown-up drives a car.'] },
    { topic: ['dog', 'puppy', 'mammal'], title: 'How a puppy grows',
      labels: ['Newborn Puppy', 'Playful Pup', 'Big Dog'],
      descriptions: ['A puppy with closed eyes drinks milk.', 'A young dog chases a ball.', 'A big dog guards the yard.'] },
  ],
  circular: [
    { topic: ['water', 'rain', 'cloud', 'evapor', 'condens', 'precip'], title: 'Where rain goes',
      labels: ['Rain Falls', 'Puddle Dries Up', 'Cloud Gets Heavy'],
      descriptions: ['Rain drops land on the ground.', 'The sun warms a puddle until it is gone.', 'A dark cloud fills with water.'] },
    { topic: ['day', 'sun', 'night', 'moon', 'earth'], title: 'One day, again and again',
      labels: ['Sunrise', 'Noon', 'Nighttime'],
      descriptions: ['The sun peeks up in the morning.', 'The sun is high in the sky.', 'The sky is dark and full of stars.'] },
    { topic: ['tree', 'season', 'leaf', 'leaves', 'apple'], title: 'A tree through the year',
      labels: ['Bare Branches', 'Blossoms Open', 'Green Leaves'],
      descriptions: ['The tree has no leaves in the cold.', 'Pink flowers open on the branches.', 'The tree is full of green leaves.'] },
    { topic: ['plant', 'seed', 'flower', 'bean'], title: 'A bean plant, again and again',
      labels: ['Bean Planted', 'Bean Plant Grows', 'Pods Drop Beans'],
      descriptions: ['A bean goes into the soil.', 'A vine climbs up a stick.', 'Dry pods split and beans fall out.'] },
  ],
};

const STOP = new Set(['the', 'a', 'an', 'and', 'of', 'in', 'on', 'up', 'to', 'its', 'is', 'stage']);
/** Content words, plural folded ("Eggs" and "Egg" are one word). */
const words = (s: string) => s.toLowerCase().split(/[^a-z]+/).filter(w => w.length > 2 && !STOP.has(w))
  .map(w => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w));
const stageWords = (c: LifeCycleItem) => new Set(c.stages.flatMap(s => words(s.label)));
const itemText = (c: LifeCycleItem) => `${c.title} ${c.instructions} ${c.stages.map(s => s.label).join(' ')}`.toLowerCase();

/**
 * Leak rule for a practice sequence: never the item's id, never the other shape, fewer stages (2+), and no word of a
 * practice stage among the item's stage words (ordering part of the item would be part of its answer).
 */
export function practiceLeaks(p: LifeCycleItem, c: LifeCycleItem): boolean {
  const used = stageWords(c);
  return p.id === c.id || p.cycleType !== c.cycleType || p.stages.length >= c.stages.length || p.stages.length < 2
    || p.stages.some(s => words(s.label).some(w => used.has(w)));
}

/**
 * The practice sequence for a full item: the same shape, three stages, from the pool entry the item picks, skipping an
 * entry about the item's own organism or process and any that shares a stage word. Null on a 3-stage item and on a
 * practice item.
 */
export function practiceCycle(c: LifeCycleItem | null | undefined): LifeCycleItem | null {
  if (!c || isPracticeCycle(c) || c.stages.length < 4) return null;
  const pool = POOL[c.cycleType] ?? [];
  let start = 0;
  for (const ch of c.stages.map(s => s.label).join('|')) start = (start * 31 + ch.charCodeAt(0)) >>> 0;
  const text = itemText(c);
  for (let k = 0; k < pool.length; k++) {
    const entry = pool[(start + k) % pool.length];
    if (entry.topic.some(t => text.includes(t))) continue;
    const stages: LifeCycleStage[] = entry.labels.map((label, i) => ({ id: `p-${i}`, label, imagePrompt: '',
      description: entry.descriptions[i], correctPosition: i, transitionToNext: '', duration: null }));
    const p: LifeCycleItem = { id: `${c.id}${PRACTICE_SUFFIX}`, title: entry.title, cycleType: c.cycleType,
      gradeBand: c.gradeBand, stages, instructions: 'Put these 3 pictures in the order they really happen.' };
    if (!practiceLeaks(p, c)) return p;
  }
  return null;
}

export function practiceAssignment(p: LifeCycleItem): TeachingAssignment {
  return { id: p.id, task: p.instructions, response: 'gesture' };
}

/** The item the runtime reports, rebuilt from the mounted payload with the same builder (the journey row). */
export function lifeCycleJourneyItem(data: LifeCycleSequencerData, itemId: string | null): LifeCycleItem | null {
  if (!Array.isArray(data?.stages)) return null;
  const item = lifeCycleItem(data);
  if (itemId === CYCLE_ITEM_ID) return item;
  return practiceParentId(itemId) === CYCLE_ITEM_ID ? practiceCycle(item) : null;
}

// ── declarations ───────────────────────────────────────────────────────────

const ORDER_MISSES: readonly CycleMiss[] = ['reversed', 'adjacent_swap', 'two_swapped', 'one_moved', 'mixed_order'];

/** The levers on a full item. A practice sequence carries none. */
export function cycleLevers(c: LifeCycleItem | null | undefined, pulled: readonly string[]): WorkspaceLever[] {
  if (!c || isPracticeCycle(c)) return [];
  const lever = (id: string, kind: WorkspaceLever['kind'], answers: readonly CycleMiss[], when: string, does: string): WorkspaceLever =>
    ({ id, kind, carrier: 'shown', pulled: pulled.includes(id), answers, when, does });
  const circle = c.cycleType === 'circular';
  return [
    lever(ARROW_LEVER, 'help', ['reversed', 'mixed_order'],
      'The learner puts the stages backwards, or seems not to know which slot is the start.',
      'Draws an arrow over the slots from slot 1 (a flag: the start) to the last slot (later)'
        + `${circle ? ', and a second arrow from the last slot back to slot 1 (the cycle starts again)' : ''}. No stage is on it.`),
    lever(KEEP_LEVER, 'help', ['adjacent_swap', 'two_swapped', 'one_moved', 'mixed_order'],
      'After a check with some slots right, the learner has a few stages in the wrong place.',
      'Locks the stages the check marked right in their slots; the others go back to the cards, so the learner '
        + 'orders only those. Only after a check with some right and some wrong.'),
    ...(practiceCycle(c) ? [lever(FEWER_LEVER, 'simplify', ORDER_MISSES,
      'The learner cannot order this many stages yet.',
      `Opens an easier practice ${circle ? 'cycle' : 'sequence'} of three familiar stages first, about another living `
        + 'thing or process. It is not graded; the full sequence comes back after it.')] : []),
  ];
}

/** What the pulled help levers put on screen, for the tutor. Names only kept stages, which the check marked right. */
export function cycleLeverFacts(c: LifeCycleItem, pulled: readonly string[], kept: Readonly<Record<number, string>>): string {
  const n = c.stages.length;
  const keptList = Object.entries(kept).sort(([a], [b]) => Number(a) - Number(b))
    .map(([slot, id]) => `slot ${Number(slot) + 1} "${c.stages.find(s => s.id === id)?.label}"`);
  return [
    pulled.includes(ARROW_LEVER) && `An arrow runs over the slots from slot 1 (flagged: the start) to slot ${n} (later)`
      + `${c.cycleType === 'circular' ? `, and another from slot ${n} back to slot 1 (the cycle starts again)` : ''}. No stage is on it.`,
    pulled.includes(KEEP_LEVER) && keptList.length
      && `Locked in place, because the check marked them right: ${keptList.join(', ')}. The other stages are back with the cards.`,
  ].filter((s): s is string => !!s).join(' ');
}
