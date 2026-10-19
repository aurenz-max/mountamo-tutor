/**
 * Shapes' boss, on the spoken preset (`components/live-activity/boss.ts`): five modes are spoken and build_shape is a
 * build the board checks, so build items have no key and play through `show`. The card is `diShapes.card.ts`; this
 * file holds the content check, the key and misses, the levers and the harness play.
 */
import type { DiShapesData } from './DiShapes';
import type { DiShapesChallenge } from './diShapesScript';
import type { DriverInput } from '../../../components/live-activity/liveJourneySpec';
import { spokenBoss } from '../../../components/live-activity/boss';
import { diShapesCard, type ShapeBuildMiss } from './diShapes.card';
import type { SpokenShapeMiss } from '../math/shapeSorterDomain';
import { diShapesHarnessAnswers, shapesAskFor, shapesChallengeValid, shapesKey, shapesSpokenMisses } from './diShapesWorkspace';
import { BUILD_WITNESSES, WRONG_BUILD } from './diShapesBuild';
import { SHAPE_LEVERS } from './diShapesLevers';

/** Reject a pool whose items cannot be asked: a drawable shape with its answer word (and an object on real-object items). */
export function validateDiShapesData(value: unknown): DiShapesData {
  const d = value as DiShapesData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length)
    throw new Error('Generated shapes have invalid lesson content.');
  if (!d.challenges.every(shapesChallengeValid)) throw new Error('A shape item cannot run in the teaching workspace.');
  return d;
}

export const diShapesBoss = spokenBoss<DiShapesData, DiShapesChallenge, SpokenShapeMiss | ShapeBuildMiss>({
  card: diShapesCard,
  validate: validateDiShapesData,
  items: (data: DiShapesData) => data.challenges,
  levers: SHAPE_LEVERS,
  speech: {
    ask: shapesAskFor,
    // build_shape has no key: the board checks the made shape, and its misses come from that check, not from words.
    key: shapesKey,
    misses: shapesSpokenMisses,
    // The shape name or count, or a plainly different one.
    say: diShapesHarnessAnswers,
    // build_shape through the real dot taps: a witness of the named shape (or a three-or-four-sided miss), closed on
    // its first corner, then "I'm done!". Try again keeps the shape, so a right try clears it first; a second wrong
    // presses done on the kept one.
    show: (right, item, ctx) => {
      const done: DriverInput = { type: 'choose', label: "I'm done!" };
      if (!right && ctx.demand?.shapeClosed === 'yes') return [done];
      const shape = !right ? (item.shape === 'triangle' ? WRONG_BUILD.triangle : WRONG_BUILD.other) : BUILD_WITNESSES[item.shape]?.[0];
      if (!shape) throw new Error(`di-shapes build_shape: no witness for ${item.shape}`);
      const tap = (p: { x: number; y: number }): DriverInput => ({ type: 'touch', target: `dot-${p.x}-${p.y}` });
      const kept = Number(ctx.demand?.cornersPlaced ?? 0) > 0;
      return [...(kept ? [{ type: 'choose' as const, label: 'Clear Shape' }] : []), ...shape.map(tap), tap(shape[0]), done];
    },
  },
  drive: {
    component: 'primitives/visual-primitives/direct-instruction/DiShapes.tsx',
    instanceId: 'shapes',
    defaults: { grade: 'Kindergarten', mode: 'name_shape', topic: 'Naming flat shapes: circle, square, triangle, rectangle' },
    mounted: '[data-shape-object="shape"]',
    probes: { reward: { selector: '[data-shape-credited]', kind: 'count' } },
  },
});
