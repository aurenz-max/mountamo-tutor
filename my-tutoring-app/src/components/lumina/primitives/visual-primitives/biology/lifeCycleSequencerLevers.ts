/**
 * life-cycle-sequencer's in-item levers (/add-support-tiers; report qa/eval-reports/life-cycle-sequencer-levers-2026-10-09.md).
 * No real-learner evidence: the misses are what `cycleMiss` observes; the catalog's commonStruggles name "orders by
 * size", "follows the order the cards are shown in", "stuck on two middle stages" and "thinks a circle has an end".
 * The order of the stages IS the answer, so no lever places, numbers, ranks or names a stage the learner has not
 * already had marked right.
 *
 * Declared once as a lever set (`LIFE_CYCLE_LEVERS`, `bossLevers.ts`), whose context is the board's state
 * (`CycleLeverContext`).
 *
 * Help (the screen does more; the item is unchanged):
 * - `time_arrow` (marks) an arrow over the slots from slot 1 (a flag: the start) to the last slot (later); on a circle a
 *   second arrow curves from the last slot back to slot 1. No stage is on it. Answers `reversed`, `mixed_order`.
 * - `keep_right` (custom: it acts on the learner's checked work) after a checked miss, the stages the check already
 *   marked right stay locked in their slots and the rest go back to the cards, so the learner re-orders only what was wrong. It shows nothing the check's marks did
 *   not (`keptLeaks`: only slots marked right, never all of them). Offered only after a check with some right and some
 *   wrong.
 *
 * Simplify (`fewer_stages`, easier): an ungraded practice sequence of the same shape (line or circle) with three
 * stages, from a code pool of familiar cycles. Never one that shares a word with the item's stages or names its organism, so it
 * never orders part of the item (`practiceLeaks`).
 *
 * `cycle_rotated` (a circle in the right order started from another stage) has no lever: which stage the item starts
 * from is the item's own choice, and a lever that shows it places a stage.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import type { LifeCycleSequencerData, LifeCycleStage } from './LifeCycleSequencer';
import { CYCLE_ITEM_ID, lifeCycleItem, type CycleMiss, type LifeCycleItem } from './lifeCycleSequencerWorkspace';
import { lifeCycleSequencerCard } from './lifeCycleSequencer.card';

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

/** The item the runtime reports, rebuilt from the mounted payload with the same builder (the journey row). */
export function lifeCycleJourneyItem(data: LifeCycleSequencerData, itemId: string | null): LifeCycleItem | null {
  if (!Array.isArray(data?.stages)) return null;
  const item = lifeCycleItem(data);
  if (itemId === CYCLE_ITEM_ID) return item;
  return practiceParentId(itemId) === CYCLE_ITEM_ID ? practiceCycle(item) : null;
}

// ── the lever set ──────────────────────────────────────────────────────────

/** What the levers read beside the item: the board as it stands, and the stages `keep_right` has locked. */
export interface CycleLeverContext {
  /** Slot index → placed stage id, or null while empty. */
  slots: readonly (string | null)[];
  /** After a check, until Try again: the slots the screen marks right and wrong. */
  marked: { right: readonly number[]; wrong: readonly number[] } | null;
  /** Slot index → stage id `keep_right` locked; empty until it is pulled. */
  kept: Readonly<Record<number, string>>;
}

const ORDER_MISSES: readonly CycleMiss[] = ['reversed', 'adjacent_swap', 'two_swapped', 'one_moved', 'mixed_order'];

/** The stages locked in place: those already kept, or (before the pull) those the last check would let it keep. */
export const lockedStages = (c: LifeCycleItem, ctx: CycleLeverContext): Readonly<Record<number, string>> | null =>
  (Object.keys(ctx.kept).length ? ctx.kept : keptSlots(c, ctx.slots, ctx.marked));

/** The levers, declared once. None is offered on a practice sequence (the component also declares none there). */
export const LIFE_CYCLE_LEVERS = leverSet<LifeCycleItem, CycleLeverContext>({
  missesOf: () => lifeCycleSequencerCard.modes.sequence.misses,
  specs: [
    { id: ARROW_LEVER, type: 'marks', answers: ['reversed', 'mixed_order'],
      when: 'The learner puts the stages backwards, or seems not to know which slot is the start.',
      does: c => 'Draws an arrow over the slots from slot 1 (a flag: the start) to the last slot (later)'
        + `${c.cycleType === 'circular' ? ', and a second arrow from the last slot back to slot 1 (the cycle starts again)' : ''}. `
        + 'No stage is on it.',
      offer: c => !isPracticeCycle(c),
      fact: (_on: unknown, c) => `An arrow runs over the slots from slot 1 (flagged: the start) to slot ${c.stages.length} (later)`
        + `${c.cycleType === 'circular' ? `, and another from slot ${c.stages.length} back to slot 1 (the cycle starts again)` : ''}. `
        + 'No stage is on it.' },
    { id: KEEP_LEVER, type: 'custom', carrier: 'shown', answers: ['adjacent_swap', 'two_swapped', 'one_moved', 'mixed_order'],
      why: 'It acts on the learner\'s own checked work: the stages the check already marked right stay, the rest go back. '
        + 'No stock type locks part of an answer the activity has already credited.',
      when: 'After a check with some slots right, the learner has a few stages in the wrong place.',
      does: 'Locks the stages the check marked right in their slots; the others go back to the cards, so the learner '
        + 'orders only those.',
      offer: c => !isPracticeCycle(c),
      content: lockedStages,
      fact: (kept: Readonly<Record<number, string>>, c) => {
        const list = Object.entries(kept).sort(([a], [b]) => Number(a) - Number(b))
          .map(([slot, id]) => `slot ${Number(slot) + 1} "${c.stages.find(s => s.id === id)?.label}"`);
        return list.length ? `Locked in place, because the check marked them right: ${list.join(', ')}. `
          + 'The other stages are back with the cards.' : '';
      } },
    { id: FEWER_LEVER, type: 'easier', answers: ORDER_MISSES,
      when: 'The learner cannot order this many stages yet.',
      does: c => `Opens an easier practice ${c.cycleType === 'circular' ? 'cycle' : 'sequence'} of three familiar stages `
        + 'first, about another living thing or process. It is not graded; the full sequence comes back after it.',
      content: c => practiceCycle(c) },
  ],
});
