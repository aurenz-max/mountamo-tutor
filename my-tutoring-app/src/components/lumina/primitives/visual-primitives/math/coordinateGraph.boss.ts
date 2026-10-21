/**
 * coordinate-graph's boss (`components/live-activity/boss.ts`), bespoke because its modes mix a point placed on the
 * plane and a choice tapped, every one checked by the activity: the card is `coordinateGraph.card.ts`; this file
 * validates a lesson, lists its challenges, asks one, carries the lever set and plays the harness.
 */
import type { CoordinateGraphChallenge, CoordinateGraphData } from './CoordinateGraph';
import { bossAssignment, defineBoss } from '../../../components/live-activity/boss';
import type { DriverInput, JourneyContext } from '../../../components/live-activity/liveJourneySpec';
import { coordinateHarnessInput, keyText, optionIsKey, optionsOf, planePixel } from './coordinateGraphWorkspace';
import { COORDINATE_LEVERS, practiceParent, simplerItem } from './coordinateGraphLevers';
import { coordinateGraphCard, type CoordinateMiss } from './coordinateGraph.card';

const TYPES = ['plot_point', 'read_point', 'find_slope', 'find_intercept'];
const int = (n: unknown) => typeof n === 'number' && Number.isInteger(n);

/** Reject a coordinate-graph lesson whose challenges cannot be attempted. */
export function validateCoordinateGraphData(value: unknown): CoordinateGraphData {
  const d = value as CoordinateGraphData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || !int(d.gridMin) || !int(d.gridMax) || d.gridMax - d.gridMin < 2
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || !TYPES.includes(c.type)
        || typeof c.instruction !== 'string' || !c.instruction.trim()))
    throw new Error('Generated coordinate graph has invalid lesson content.');
  // Each item needs what its own check reads: a point on the grid to plot or read, two points that make a line that is
  // not vertical, and four different choices of which exactly one, the one `correctOptionIndex` names, is the key.
  const inGrid = (n: number) => n >= d.gridMin && n <= d.gridMax;
  for (const c of d.challenges) {
    let ok = [c.x1, c.y1, c.x2, c.y2].every(int) && inGrid(c.x1) && inGrid(c.y1);
    if (ok && c.type !== 'plot_point') {
      const opts = optionsOf(c);
      const keys = opts.filter(o => optionIsKey(c, o));
      ok = opts.length === 4 && new Set(opts.map(o => o.replace(/\s/g, ''))).size === 4 && keys.length === 1
        && opts[c.correctOptionIndex ?? -1] === keys[0];
    }
    if (ok && (c.type === 'find_slope' || c.type === 'find_intercept')) ok = c.x1 !== c.x2 && inGrid(c.x2) && inGrid(c.y2);
    if (!ok) throw new Error(`A coordinate-graph ${c.type} challenge cannot be answered as generated.`);
  }
  return d;
}

const gridOf = (ctx: JourneyContext) => ({ gridMin: ctx.data.gridMin as number, gridMax: ctx.data.gridMax as number });

/** The session challenge, or the easier practice item a simplify lever opened (`~simpler`), rebuilt from its parent. */
function currentItem(ctx: JourneyContext): CoordinateGraphChallenge | undefined {
  const all = (ctx.data as CoordinateGraphData).challenges ?? [];
  const parentId = practiceParent(String(ctx.itemId ?? ''));
  const parent = all.find(c => c.id === parentId);
  return parent && parentId !== ctx.itemId ? simplerItem(parent, gridOf(ctx)) ?? undefined : parent;
}

export const coordinateGraphBoss = defineBoss<CoordinateGraphData, CoordinateGraphChallenge, CoordinateMiss>({
  card: coordinateGraphCard,
  validate: validateCoordinateGraphData,
  items: d => d.challenges,
  ask: c => c.instruction,
  // A point or a choice the activity checks: no key reaches the tutor.
  assignment: c => bossAssignment(c.id, c.instruction, null),
  levers: COORDINATE_LEVERS,
  drive: {
    component: 'primitives/visual-primitives/math/CoordinateGraph.tsx',
    instanceId: 'coord',
    defaults: { grade: 'Grade 6', mode: 'plot_point', topic: 'Ordered pairs on the coordinate plane' },
    mounted: '[data-pip-object="workspace"]',
    current: currentItem,
    // Every mode through its real controls: plot_point taps the grid crossing on the plane (a one-point pointer stroke
    // in its viewBox), the other modes tap a choice; the tap is the check. A wrong answer is the item's signature miss
    // (`coordinateHarnessInput`): x and y swapped or a sign flipped, or the first wrong choice with a named miss.
    play: (right, c, ctx): DriverInput[] => {
      const grid = gridOf(ctx);
      const input = coordinateHarnessInput(c, right ? 'correct' : 'wrong', grid);
      if (input.kind === 'choose') return [{ type: 'choose', label: input.label }];
      return [{ type: 'draw', target: 'plane', strokes: [[planePixel(grid.gridMin, grid.gridMax, input.point)]] }];
    },
    // The key as the screen prints it: the pair, the slope or the intercept choice. plot_point's pair is its own ask.
    replayKeys: ctx => {
      const c = currentItem(ctx);
      return c && c.type !== 'plot_point' ? [keyText(c)] : [];
    },
  },
});
