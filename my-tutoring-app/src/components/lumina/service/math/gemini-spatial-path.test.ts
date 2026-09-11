import { describe, expect, it } from 'vitest';
import {
  buildSpatialRoutes,
  selectSpatialPathChallenges,
  validateSpatialPathChallenge,
} from './gemini-spatial-path';

describe('spatial-path route contract', () => {
  it('gives every relation distinct geometry with one shared start and finish', () => {
    const routes = buildSpatialRoutes();

    expect(routes.map((route) => route.relation)).toEqual([
      'over', 'under', 'through', 'around', 'across',
    ]);
    expect(new Set(routes.map((route) => route.geometrySignature)).size).toBe(routes.length);
    expect(new Set(routes.map((route) => `${route.start.x},${route.start.y}`)).size).toBe(1);
    expect(new Set(routes.map((route) => `${route.end.x},${route.end.y}`)).size).toBe(1);
  });

  it('keys correctness to route identity and relation rather than the final cell', () => {
    const challenges = selectSpatialPathChallenges(5);

    expect(challenges.map((challenge) => challenge.requestedRelation)).toEqual([
      'through', 'around', 'across', 'over', 'under',
    ]);
    expect(challenges.map((challenge) => (
      challenge.routes.findIndex((route) => route.id === challenge.correctRouteId)
    )).sort()).toEqual([0, 1, 2, 3, 4]);
    for (const challenge of challenges) {
      expect(validateSpatialPathChallenge(challenge)).toEqual([]);
      const correct = challenge.routes.find((route) => route.id === challenge.correctRouteId);
      expect(correct?.relation).toBe(challenge.requestedRelation);
      expect(new Set(challenge.routes.map((route) => `${route.end.x},${route.end.y}`)).size).toBe(1);
      expect(new Set(challenge.routes.map((route) => route.id)).size).toBeGreaterThan(1);
    }
  });

  it('clamps sessions to the supported three-to-six challenge density', () => {
    expect(selectSpatialPathChallenges(1)).toHaveLength(3);
    expect(selectSpatialPathChallenges(20)).toHaveLength(6);
  });
});
