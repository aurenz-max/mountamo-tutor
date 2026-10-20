/**
 * spatial-path's boss, on the tap preset (`components/live-activity/boss.ts`): every item is one tapped route and an
 * Animate this route press, judged by the map. The card is `spatialPath.card.ts`; this file holds the content check,
 * the items, the ask, the levers and the harness's taps. The live adapter and the journey row are built from it.
 */
import type { SpatialPathChallenge, SpatialPathData } from './SpatialPath';
import { tapBoss } from '../../../components/live-activity/boss';
import { spatialPathCard } from './spatialPath.card';
import { ROUTE_LEVERS, practiceParent, threeRoutes } from './spatialPathLevers';
import { validateSpatialPathChallenge } from './spatialPathRoutes';
import { routeNumberOf, type RouteMiss } from './spatialPathWorkspace';

/** Reject a route lesson whose challenges cannot be attempted: each needs three or more routes and a checkable key. */
export function validateSpatialPathData(value: unknown): SpatialPathData {
  const d = value as SpatialPathData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || c.type !== 'choose_route'
        || typeof c.instruction !== 'string' || !c.instruction.trim() || !Array.isArray(c.routes)
        || validateSpatialPathChallenge(c).length > 0))
    throw new Error('Generated spatial path has invalid lesson content.');
  return d;
}

/** The harness's taps: the key route's numbered badge, and the first route that is not the key. */
function routeTargets(c: SpatialPathChallenge) {
  const wrong = c.routes.find(route => route.id !== c.correctRouteId);
  return { correct: `route-${routeNumberOf(c, c.correctRouteId)}`, wrong: wrong ? `route-${routeNumberOf(c, wrong.id)}` : null };
}

export const spatialPathBoss = tapBoss<SpatialPathData, SpatialPathChallenge, RouteMiss>({
  card: spatialPathCard,
  validate: validateSpatialPathData,
  items: data => data.challenges,
  levers: ROUTE_LEVERS,
  choice: { ask: c => c.instruction, targets: routeTargets, commit: 'Animate this route' },
  drive: {
    component: 'primitives/visual-primitives/math/SpatialPath.tsx',
    instanceId: 'routes',
    defaults: { grade: 'Kindergarten', mode: 'choose_route', topic: 'Directional prepositions through around and across' },
    mounted: '[data-pip-object^="route-"]',
    // The easier map (`~simpler`) is not a generated challenge: rebuild it from its parent with the same builder.
    current: ctx => {
      const challenges: SpatialPathChallenge[] = ctx.data.challenges ?? [];
      const parent = practiceParent(String(ctx.itemId ?? ''), challenges);
      return parent ? threeRoutes(parent) ?? undefined : challenges.find(c => c.id === ctx.itemId);
    },
    // The key is a route number on the map; the asked word is the task itself, so replies are read by hand.
    replayKeys: () => [],
  },
});
