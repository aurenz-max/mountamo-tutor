/**
 * spatial-path on the shared tutor/JEV teaching workspace, W1 minimal binding, plain shape
 * (qa/workspace-rollout/ROLLOUT.md).
 *
 * Pure: the component and any probe read the same assignment and scene. `choose_route` is answered on the map
 * (tap a numbered route, then Animate this route) and checked by the map itself (`routeMatches`: the chosen route's
 * id against `correctRouteId`). The tutor is never handed the correct route, its number, or which number goes which
 * way: the scene names a route's movement only for the route the learner already checked.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { SpatialPathChallenge, SpatialPathRelation } from './SpatialPath';

export function workspaceAssignment(challenge: SpatialPathChallenge): TeachingAssignment {
  return { id: challenge.id, task: challenge.instruction, response: 'gesture' };
}

export interface RouteView {
  selectedRouteId: string | null;
  /** The selected route was checked (Animate this route) and is being replayed. */
  checked: boolean;
}

const numberOf = (challenge: SpatialPathChallenge, routeId: string | null) =>
  challenge.routes.findIndex(route => route.id === routeId) + 1;

/** The map's check: the chosen route is the one whose path goes the asked way. The endpoint is never read. */
export const routeMatches = (challenge: SpatialPathChallenge, routeId: string | null) =>
  !!routeId && routeId === challenge.correctRouteId;

/**
 * What a wrong route shows (`TeachingAttempt.miss`, handoff 20): the movement the chosen route makes instead of the
 * asked one, `went_over` / `went_under` / `went_through` / `went_around` / `went_across`. A K learner who picks the
 * other vertical arc (over for under) or the straight line (through, the shortest path to the finish) is caught by
 * the word, not by where the route ends.
 */
export type RouteMiss = `went_${SpatialPathRelation}`;
export const ROUTE_MISSES: readonly RouteMiss[] = ['went_over', 'went_under', 'went_through', 'went_around', 'went_across'];

export function routeMiss(challenge: SpatialPathChallenge | null, routeId: string | null): RouteMiss | undefined {
  if (!challenge || !routeId || routeMatches(challenge, routeId)) return undefined;
  const route = challenge.routes.find(r => r.id === routeId);
  return route ? `went_${route.relation}` : undefined;
}

/** The learner's work in their own terms: the route number, and its movement only once it was checked. */
export function describeRouteWork(challenge: SpatialPathChallenge, view: RouteView): string {
  const n = numberOf(challenge, view.selectedRouteId);
  if (!n) return 'No route chosen yet';
  if (!view.checked) return `Chose route ${n}, not animated yet`;
  const route = challenge.routes[n - 1];
  return `Animated route ${n}; its path goes ${route.relation} the ${challenge.landmark.name}`;
}

/** What is drawn and asked. The route numbers are listed; which way any unchecked route goes is not. */
export function workspaceScene(challenge: SpatialPathChallenge, view: RouteView): WorkspaceScene {
  return {
    objects: [],
    facts: {
      kind: challenge.type,
      traveler: challenge.traveler.name,
      landmark: challenge.landmark.name,
      askedWord: challenge.requestedRelation,
      routes: `${challenge.routes.length} numbered dashed routes, all from the same START to the same FINISH`,
      learnerWork: describeRouteWork(challenge, view),
      constraints: 'The learner taps a numbered route, then presses Animate this route; the map checks the route by '
        + 'its shape at the landmark, never by where it ends. You cannot tap or animate a route.',
    },
  };
}

/** The journey's input on the real map: touch a route's numbered badge, then Animate this route. A wrong one takes the
 *  first route that is not the key. */
export function spatialPathHarnessInputs(challenge: SpatialPathChallenge, wrong: boolean) {
  const index = challenge.routes.findIndex(route => (wrong ? route.id !== challenge.correctRouteId : route.id === challenge.correctRouteId));
  return [{ type: 'touch' as const, target: `route-${index + 1}` }, { type: 'choose' as const, label: 'Animate this route' }];
}
