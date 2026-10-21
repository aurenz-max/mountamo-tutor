/**
 * slope-triangle's boss (`components/live-activity/boss.ts`), bespoke because every mode is a gesture the activity
 * checks (typed legs, a typed slope, a built triangle): the card is `slopeTriangle.card.ts`; this file validates a
 * lesson, lists its triangles, asks one, carries the lever set and plays the harness.
 */
import type { SlopeTriangleData } from './SlopeTriangle';
import { bossAssignment, defineBoss } from '../../../components/live-activity/boss';
import { askOf, builtTriangle, ratioText, slopeHarnessSteps } from './slopeTriangleWorkspace';
import { SLOPE_LEVERS, practiceParent, simplerItem } from './slopeTriangleLevers';
import { slopeTriangleCard, type SlopeTriangleMiss } from './slopeTriangle.card';

type Item = SlopeTriangleData['challenges'][number];

const TYPES = ['identify_slope', 'calculate', 'draw_triangle'];
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const near = (a: number, b: number) => Math.abs(a - b) < 0.01;

/** Reject a slope-triangle lesson whose challenges cannot be attempted. */
export function validateSlopeTriangleData(value: unknown): SlopeTriangleData {
  const d = value as SlopeTriangleData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || !Array.isArray(d.xRange) || !Array.isArray(d.yRange)
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || !TYPES.includes(c.type)
        || typeof c.instruction !== 'string' || !c.instruction.trim() || !c.attachedLine || !c.triangle))
    throw new Error('Generated slope triangle has invalid lesson content.');
  // Each item's key must be the triangle the canvas draws: the slope is the line's (not flat), the rise is slope x run in
  // whole grid steps, the run is a whole number the corners can reach, and a read item's drawn triangle is that run. A
  // read item never prints the rise and run it asks for.
  for (const c of d.challenges) {
    const { slope } = c.attachedLine;
    const { size, position } = c.triangle;
    let ok = [slope, c.attachedLine.yIntercept, c.expectedRise, c.expectedRun, c.expectedSlope, size, position?.x].every(finite)
      && near(c.expectedSlope, slope) && slope !== 0 && near(c.expectedRise, slope * c.expectedRun) && Number.isInteger(c.expectedRise)
      && Number.isInteger(c.expectedRun) && c.expectedRun >= 1 && c.expectedRun <= 8;
    if (ok && c.type !== 'draw_triangle') ok = size === c.expectedRun;
    if (ok && c.type === 'identify_slope') ok = !(c.triangle.showRiseRunLabels ?? c.triangle.showMeasurements);
    // A build starts flat (its top corner on the right angle) and is credited for any run whose rise fits the line;
    // `expectedRun`/`expectedRise` are one such triangle.
    if (ok && c.type === 'draw_triangle') ok = Number.isInteger(size) && size >= 1;
    if (!ok) throw new Error(`A slope-triangle ${c.type} challenge cannot be answered as generated.`);
  }
  return d;
}

/** The session item, or the easier practice item a simplify lever opened (`~simpler`), rebuilt from its parent. */
function currentItem(data: SlopeTriangleData, itemId: string): Item | undefined {
  const parentId = practiceParent(itemId);
  const parent = (data.challenges ?? []).find(c => c.id === parentId);
  return parent && parentId !== itemId ? simplerItem(parent) ?? undefined : parent;
}

export const slopeTriangleBoss = defineBoss<SlopeTriangleData, Item, SlopeTriangleMiss>({
  card: slopeTriangleCard,
  validate: validateSlopeTriangleData,
  items: d => d.challenges,
  ask: c => askOf(c),
  // Typed legs, a typed slope or a built triangle the activity checks: no key reaches the tutor.
  assignment: c => bossAssignment(c.id, askOf(c), null),
  levers: SLOPE_LEVERS,
  drive: {
    component: 'primitives/visual-primitives/math/SlopeTriangle.tsx',
    instanceId: 'slope',
    defaults: { grade: 'Grade 8', mode: 'identify_slope', topic: 'Slope as rise over run' },
    mounted: '[data-pip-object="workspace"]',
    current: ctx => currentItem(ctx.data as SlopeTriangleData, String(ctx.itemId ?? '')),
    // Every mode through its real controls (`slopeHarnessSteps`): identify types the rise and the run, calculate types
    // the slope, draw presses the run and rise buttons from the run and rise the scene prints to the generated example
    // triangle; then Check. A wrong answer is the item's signature miss: the legs swapped (or the rise's sign lost), the
    // slope turned over, the built rise the wrong way.
    play: (right, c, ctx) => slopeHarnessSteps(c, right ? 'correct' : 'wrong', builtTriangle(c, ctx.demand?.learnerWork))
      .map(s => (s.kind === 'check' ? { type: 'check' as const } : s.kind === 'write'
        ? { type: 'write' as const, label: s.label, text: s.text } : { type: 'choose' as const, label: s.label })),
    // The key: the rise and the run (identify), the slope in lowest terms (calculate). A build has no single key: any
    // run with its rise fits.
    replayKeys: ctx => {
      const c = currentItem(ctx.data as SlopeTriangleData, String(ctx.itemId ?? ''));
      if (!c || c.type === 'draw_triangle') return [];
      return c.type === 'identify_slope' ? [String(c.expectedRise), String(c.expectedRun)] : [ratioText(c.expectedRise, c.expectedRun)];
    },
  },
});
