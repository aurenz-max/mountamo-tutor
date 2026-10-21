/**
 * array-grid's boss (`components/live-activity/boss.ts`), bespoke because every mode is a build or a typed answer the
 * activity checks: the card is `arrayGrid.card.ts`; this file validates a lesson, lists its arrays (each with the
 * session's mode and icon), asks one, carries the lever set and plays the harness.
 */
import type { ArrayGridData } from './ArrayGrid';
import { bossAssignment, defineBoss } from '../../../components/live-activity/boss';
import type { DriverInput, JourneyContext } from '../../../components/live-activity/liveJourneySpec';
import { arrayAsk, arrayItems, arraysOf, gridFor, type ArrayItem } from './arrayGridWorkspace';
import { ARRAY_LEVERS, practiceParent, smallerArray } from './arrayGridLevers';
import { arrayGridCard, type ArrayMiss } from './arrayGrid.card';

const CHALLENGE_TYPES = ['build_array', 'count_array', 'multiply_array', 'make_array'];
const dim = (n: unknown) => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 12;

/** Reject an array lesson whose challenges cannot be attempted. */
export function validateArrayGridData(value: unknown): ArrayGridData {
  const d = value as ArrayGridData;
  if (!d || typeof d.title !== 'string' || !CHALLENGE_TYPES.includes(d.challengeType) || !Array.isArray(d.challenges)
      || !d.challenges.length || d.challenges.length > 12 || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id))
    throw new Error('Generated array grid has invalid lesson content.');
  // make_array needs a number the empty grid can hold as more than one array; the others need real dimensions.
  for (const c of d.challenges) {
    const ok = d.challengeType === 'make_array'
      ? Number.isInteger(c.total) && arraysOf(c.total!).length > 1
      : dim(c.targetRows) && dim(c.targetColumns);
    if (!ok) throw new Error(`An array-grid ${d.challengeType} challenge cannot be answered as generated.`);
  }
  return d;
}

/** The session item, or the easier array a simplify lever opened (`~smaller`), rebuilt from its parent. */
function currentItem(ctx: JourneyContext): ArrayItem | undefined {
  const items = arrayItems(ctx.data as ArrayGridData);
  const parent = practiceParent(ctx.itemId, items);
  return parent ? smallerArray(parent) ?? undefined : items.find(c => c.id === ctx.itemId);
}

/**
 * Every mode through its real controls. build, count and multiply type through the real inputs, build first pressing
 * its rows and columns; wrong types rows + columns as the total (`added_sides`). make_array clears the kept grid, fills
 * a rectangle from the top-left cell and presses I'm done; a two-ways item then clears and makes an array with other
 * rows. Wrong: the first array with one more square under it (`ragged`).
 */
function play(right: boolean, c: ArrayItem, ctx: JourneyContext): DriverInput[] {
  const check: DriverInput = { type: 'check' };
  if (c.mode === 'make_array') {
    const total = c.total ?? 0, arrays = arraysOf(total), grid = gridFor(total);
    const first = arrays.find(a => a.rows >= 2 && a.columns >= 2) ?? arrays[0];
    const second = arrays.find(a => a.rows !== first?.rows);
    if (!first) throw new Error(`array-grid make_array: ${total} squares make no array on the grid`);
    const fill = (a: { rows: number; columns: number }) => Array.from({ length: a.rows * a.columns },
      (_, i): DriverInput => ({ type: 'touch', target: `cell-${Math.floor(i / a.columns)}-${i % a.columns}` }));
    const clear: DriverInput = { type: 'choose', label: 'Clear the grid' }, done: DriverInput = { type: 'choose', label: "I'm done!" };
    const start = Number(ctx.demand?.squaresMade ?? 0) > 0 ? [clear] : [];
    if (!right) return [...start, ...fill(first),
      { type: 'touch', target: first.rows < grid.rows ? `cell-${first.rows}-0` : `cell-0-${first.columns}` }, done];
    if (c.ways !== 2) return [...start, ...fill(first), done];
    if (!second) throw new Error(`array-grid make_array: ${total} squares have no second array on the grid`);
    return [...start, ...fill(first), done, clear, ...fill(second), done];
  }
  const r = c.targetRows, cols = c.targetColumns;
  const total = String(right ? r * cols : r + cols !== r * cols ? r + cols : r * cols + 1);
  const write = (label: string, text: string): DriverInput => ({ type: 'write', label, text });
  if (c.mode === 'build_array') return [{ type: 'choose', label: `Rows: ${r}` },
    { type: 'choose', label: `Columns: ${cols}` }, write('Total', total), check];
  if (c.mode === 'count_array') return [write('Total', total), check];
  return [write('Rows', String(r)), write('Columns', String(cols)), write('Total', total), check];
}

export const arrayGridBoss = defineBoss<ArrayGridData, ArrayItem, ArrayMiss>({
  card: arrayGridCard,
  validate: validateArrayGridData,
  items: arrayItems,
  ask: arrayAsk,
  // A build or a typed answer the activity checks: no key reaches the tutor.
  assignment: c => bossAssignment(c.id, arrayAsk(c), null),
  levers: ARRAY_LEVERS,
  drive: {
    component: 'primitives/visual-primitives/math/ArrayGrid.tsx',
    instanceId: 'arrays',
    defaults: { grade: 'Grade 3', mode: 'count_array', topic: 'Arrays and multiplication' },
    mounted: '[data-pip-object="workspace"]',
    current: currentItem,
    play,
  },
});
