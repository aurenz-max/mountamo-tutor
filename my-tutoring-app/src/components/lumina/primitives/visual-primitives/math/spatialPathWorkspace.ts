/**
 * spatial-path on the shared tutor/JEV teaching workspace. Its wiring is `spatialPath.card.ts` + `spatialPath.boss.ts`
 * (tap preset: one route tapped, then Animate this route).
 *
 * Pure: the component and any probe read the same scene. `choose_route` is answered on the map and checked by the map
 * itself (`routeMatches`: the chosen route's id against `correctRouteId`). The tutor is never handed the correct route,
 * its number, or which number goes which way: the scene names a route's movement only for the route the learner
 * already checked.
 */
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import type { SpatialPathChallenge, SpatialPathRelation } from './SpatialPath';

export interface RouteView {
  selectedRouteId: string | null;
  /** The selected route was checked (Animate this route) and is being replayed. */
  checked: boolean;
}

export const routeNumberOf = (challenge: SpatialPathChallenge, routeId: string | null) =>
  challenge.routes.findIndex(route => route.id === routeId) + 1;

/** The map's check: the chosen route is the one whose path goes the asked way. The endpoint is never read. */
export const routeMatches = (challenge: SpatialPathChallenge, routeId: string | null) =>
  !!routeId && routeId === challenge.correctRouteId;

/**
 * What a wrong route shows (`TeachingAttempt.miss`, handoff 20): the movement the chosen route makes instead of the
 * asked one, `went_over` / `went_under` / `went_through` / `went_around` / `went_across`. A K learner who picks the
 * other vertical arc (over for under) or the straight line (through, the shortest path to the finish) is caught by
 * the word, not by where the route ends. The list is the card's (`ROUTE_MISSES`).
 */
export type RouteMiss = `went_${SpatialPathRelation}`;

export function routeMiss(challenge: SpatialPathChallenge | null, routeId: string | null): RouteMiss | undefined {
  if (!challenge || !routeId || routeMatches(challenge, routeId)) return undefined;
  const route = challenge.routes.find(r => r.id === routeId);
  return route ? `went_${route.relation}` : undefined;
}

/** The learner's work in their own terms: the route number, and its movement only once it was checked. */
export function describeRouteWork(challenge: SpatialPathChallenge, view: RouteView): string {
  const n = routeNumberOf(challenge, view.selectedRouteId);
  if (!n) return 'No route chosen yet';
  if (!view.checked) return `Chose route ${n}, not animated yet`;
  const route = challenge.routes[n - 1];
  return `Animated route ${n}; its path goes ${route.relation} the ${challenge.landmark.name}`;
}

/** What is drawn and asked. The route numbers are listed; which way any unchecked route goes is not. */
export function workspaceScene(challenge: SpatialPathChallenge, view: RouteView): SceneOf {
  return {
    objects: [],
    facts: {
      kind: challenge.type,
      traveler: challenge.traveler.name,
      landmark: challenge.landmark.name,
      askedWord: challenge.requestedRelation,
      routes: `${challenge.routes.length} numbered dashed routes, all from the same START to the same FINISH`,
      learnerWork: describeRouteWork(challenge, view),
      constraints: 'Where a route ends is never the answer, since every route ends at the same FINISH; what its path does '
        + 'at the landmark is. Saying what the right path looks like on this map (straight, curved, high, low, into an '
        + 'opening) gives it away; an everyday example away from the map (crawling under a table, walking through a '
        + 'door) is teaching.',
    },
  };
}
