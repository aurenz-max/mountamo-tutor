/**
 * area-model's boss (`components/live-activity/boss.ts`), bespoke because every mode is typed and checked by the
 * activity: the card is `areaModel.card.ts`; this file validates a lesson, lists its items (each with the session's
 * mode), asks one, carries the lever set and plays the harness.
 */
import type { AreaModelData } from './AreaModel';
import { bossAssignment, defineBoss } from '../../../components/live-activity/boss';
import type { DriverInput, JourneyContext } from '../../../components/live-activity/liveJourneySpec';
import { areaItems, cellProducts, partsFit, workspaceTask, type AreaItem } from './areaModelWorkspace';
import { AREA_LEVERS, practiceItem, practiceParent } from './areaModelLevers';
import { areaModelCard, type AreaModelMiss } from './areaModel.card';

const MODES = ['build_model', 'find_area', 'perimeter', 'multiply', 'factor'];
const partsOk = (parts: unknown) => Array.isArray(parts) && parts.length > 0 && parts.length <= 4
  && parts.every(p => Number.isInteger(p) && (p as number) > 0);

/** Reject an area-model lesson whose challenges cannot be attempted. */
export function validateAreaModelData(value: unknown): AreaModelData {
  const d = value as AreaModelData;
  if (!d || typeof d.title !== 'string' || !MODES.includes(d.challengeType) || !Array.isArray(d.challenges)
      || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || !partsOk(c.factor1Parts) || !partsOk(c.factor2Parts)))
    throw new Error('Generated area model has invalid lesson content.');
  return d;
}

/** The session item, or the easier practice item a simplify lever opened (`~easier`), rebuilt from its parent. */
function currentItem(ctx: JourneyContext): AreaItem | undefined {
  const items = areaItems(ctx.data as AreaModelData);
  const parent = practiceParent(ctx.itemId, items);
  return parent ? practiceItem(parent, parent.mode) ?? undefined : items.find(c => c.id === ctx.itemId);
}

const total = (p: readonly number[]) => p.reduce((s, v) => s + v, 0);
const write = (label: string, text: number | string): DriverInput => ({ type: 'write', label, text: String(text) });

/**
 * Every mode through its real controls. A forward item: tap each cell not yet right (the scene's `learnerWork` lists
 * the right ones; Try again keeps them), type its product and Check, then type the sum and Submit Final Answer. A wrong
 * answer is the mode's signature error from `areaMiss`: the first open cell with its zeros dropped (or its parts
 * added), the sum less one cell once every cell is right, the two sides added for a perimeter, the parts swapped.
 */
function play(right: boolean, c: AreaItem, ctx: JourneyContext): DriverInput[] {
  const f1 = c.factor1Parts, f2 = c.factor2Parts, wrong = !right;
  if (c.mode === 'perimeter') {
    const w = total(f1), h = total(f2);
    return [write('Perimeter', wrong ? w + h : 2 * (w + h)), { type: 'choose', label: 'Submit' }];
  }
  if (c.mode === 'factor') {
    const swapFits = partsFit(c, f2.map(String), f1.map(String));
    const [top, left] = !wrong ? [f1, f2] : f1.length === f2.length && !swapFits ? [f2, f1] : [[f1[0] + 1, ...f1.slice(1)], f2];
    return [...top.map((v, i) => write(`Column part ${i + 1}`, v)), ...left.map((v, i) => write(`Row part ${i + 1}`, v)),
      { type: 'check' }];
  }
  const done = new Set(Array.from(String(ctx.demand?.learnerWork ?? '').matchAll(/in row (\d+), column (\d+)/g), m => `${+m[1] - 1},${+m[2] - 1}`));
  const open = f2.flatMap((_, r) => f1.map((_, k) => [r, k] as const)).filter(([r, k]) => !done.has(`${r},${k}`));
  const cell = (r: number, k: number, value: number): DriverInput[] => [{ type: 'choose', label: `Cell row ${r + 1} column ${k + 1}` },
    write('Cell product', value), { type: 'check' }];
  const products = cellProducts(c);
  if (wrong && open.length) {
    const [r, k] = open[0], a = f1[k], b = f2[r], p = a * b;
    return cell(r, k, p % 10 === 0 && p >= 10 && p / 10 !== a + b ? p / 10 : a + b !== p ? a + b : p + a);
  }
  const sum = total(f1) * total(f2);
  return [...open.flatMap(([r, k]) => cell(r, k, products[r][k])),
    write('Sum of the cell products', wrong ? sum - products[0][0] : sum), { type: 'choose', label: 'Submit Final Answer' }];
}

export const areaModelBoss = defineBoss<AreaModelData, AreaItem, AreaModelMiss>({
  card: areaModelCard,
  validate: validateAreaModelData,
  items: areaItems,
  ask: c => workspaceTask(c, c.mode),
  // Typed entries the activity checks: no key reaches the tutor.
  assignment: c => bossAssignment(c.id, workspaceTask(c, c.mode), null),
  levers: AREA_LEVERS,
  drive: {
    component: 'primitives/visual-primitives/math/AreaModel.tsx',
    instanceId: 'area',
    defaults: { grade: 'Grade 4', mode: 'find_area', topic: 'Multiplying with the area model' },
    mounted: '[data-pip-object="workspace"]',
    current: currentItem,
    play,
  },
});
