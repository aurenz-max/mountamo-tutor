/**
 * spatial-path's route geometry, pure: the generator builds the session from it, and the simplify lever
 * (`spatialPathLevers.ts`) builds its practice challenge from it, so both draw the same shapes.
 */
import type { SpatialPathChallenge, SpatialPathRelation, SpatialRoute } from './SpatialPath';

export const RELATIONS: readonly SpatialPathRelation[] = ['over', 'under', 'through', 'around', 'across'];

const START = { x: 60, y: 160 } as const;
const END = { x: 540, y: 160 } as const;

export const ROUTE_GEOMETRY: Record<SpatialPathRelation, { d: string; signature: string }> = {
  over: { d: 'M60 160 Q300 12 540 160', signature: 'arc-above-landmark' },
  under: { d: 'M60 160 Q300 308 540 160', signature: 'arc-below-landmark' },
  through: { d: 'M60 160 L540 160', signature: 'centerline-through-opening' },
  around: {
    d: 'M60 160 C90 55 180 48 215 120 C245 182 255 270 300 270 C345 270 355 182 385 120 C420 48 510 55 540 160',
    signature: 'perimeter-loop-around-landmark',
  },
  across: { d: 'M60 160 L190 82 L410 82 L540 160', signature: 'straight-crossing-on-bridge' },
};

export const routeFor = (relation: SpatialPathRelation): SpatialRoute => ({
  id: `route-${relation}`,
  relation,
  d: ROUTE_GEOMETRY[relation].d,
  geometrySignature: ROUTE_GEOMETRY[relation].signature,
  start: { ...START },
  end: { ...END },
});

export function buildSpatialRoutes(rotation = 0): SpatialRoute[] {
  return RELATIONS.map((_, index) => routeFor(RELATIONS[(index + rotation) % RELATIONS.length]));
}

export const SCENES = [
  { traveler: { name: 'fox', emoji: '🦊' }, landmark: { name: 'rocky tunnel', emoji: '⛰️' } },
  { traveler: { name: 'rabbit', emoji: '🐇' }, landmark: { name: 'garden wall', emoji: '🧱' } },
  { traveler: { name: 'train', emoji: '🚂' }, landmark: { name: 'bridge deck', emoji: '🌉' } },
  { traveler: { name: 'bee', emoji: '🐝' }, landmark: { name: 'hedge', emoji: '🌳' } },
  { traveler: { name: 'boat', emoji: '⛵' }, landmark: { name: 'low bridge', emoji: '🌉' } },
] as const;

export function validateSpatialPathChallenge(challenge: SpatialPathChallenge): string[] {
  const issues: string[] = [];
  if (challenge.routes.length < 3) issues.push('fewer than three routes');
  const starts = new Set(challenge.routes.map((route) => `${route.start.x},${route.start.y}`));
  const ends = new Set(challenge.routes.map((route) => `${route.end.x},${route.end.y}`));
  if (starts.size !== 1 || ends.size !== 1) issues.push('routes do not share endpoints');
  if (new Set(challenge.routes.map((route) => route.geometrySignature)).size !== challenge.routes.length) {
    issues.push('route geometry is duplicated');
  }
  const correct = challenge.routes.find((route) => route.id === challenge.correctRouteId);
  if (!correct) issues.push('correct route is missing');
  else if (correct.relation !== challenge.requestedRelation) issues.push('correct route relation mismatches request');
  return issues;
}

export const routeInstruction = (traveler: string, relation: SpatialPathRelation, landmark: string) =>
  `Choose the route that takes the ${traveler} ${relation} the ${landmark}, then animate it.`;

export const routeContrast = (relation: SpatialPathRelation, landmark: string) =>
  `A route goes ${relation} by what its path does at the ${landmark}, not by its final stop.`;
