/**
 * shape-composer's boss (`components/live-activity/boss.ts`), bespoke because its modes mix pieces dragged on the
 * board, a run of tapped parts and a typed number, every one checked by the activity: the card is
 * `shapeComposer.card.ts`; this file validates a lesson, lists its challenges, asks one, carries the lever set and
 * plays the harness.
 */
import type { ShapeComposerChallenge, ShapeComposerData } from './ShapeComposer';
import { bossAssignment, defineBoss } from '../../../components/live-activity/boss';
import type { DriverInput, JourneyContext } from '../../../components/live-activity/liveJourneySpec';
import { SHAPE_COMPOSER_LEVERS, simplerShape } from './shapeComposerLevers';
import { shapeComposerCard, type ShapeComposerMiss } from './shapeComposer.card';

const CHALLENGE_TYPES = ['compose-match', 'compose-picture', 'decompose', 'free-create', 'how-many-ways'];

/** Reject a shape composer lesson whose challenges cannot be attempted. */
export function validateShapeComposerData(value: unknown): ShapeComposerData {
  const d = value as ShapeComposerData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || !CHALLENGE_TYPES.includes(c.type)
        || typeof c.instruction !== 'string' || !c.instruction.trim()))
    throw new Error('Generated shape composer has invalid lesson content.');
  // Each type needs the material its own check reads, or it mounts unanswerable.
  for (const c of d.challenges) {
    const ok = c.type === 'compose-match'
      ? !!c.pieces?.length && c.pieces.every(p => p.shape && Number.isFinite(p.targetX) && Number.isFinite(p.targetY))
      : c.type === 'compose-picture'
        ? !!c.pictureSlots?.length && !!c.availableShapes?.length
          // The palette must hold every shape the picture's spots need.
          && c.pictureSlots.every(slot => (c.availableShapes ?? []).some(s => s.shape === slot.shape
            && s.count >= c.pictureSlots!.filter(x => x.shape === slot.shape).length))
      : c.type === 'decompose'
        ? !!c.compositeShapePath && !!c.expectedComponents?.length && c.expectedComponents.every(p => p.shape && p.count > 0)
      : c.type === 'how-many-ways'
        ? Number.isInteger(c.minimumPiecesNeeded) && (c.minimumPiecesNeeded ?? 0) > 0 && !!c.targetForComposition
      : !c.recipe || c.recipe.every(r => r.shape && r.count > 0);
    if (!ok) throw new Error(`A shape-composer ${c.type} challenge cannot be answered as generated.`);
  }
  return d;
}

const SIMPLER = '~simpler';

/** The session challenge, or the easier practice item a simplify lever opened (`~simpler`), rebuilt from its parent. */
function currentItem(ctx: JourneyContext): ShapeComposerChallenge | undefined {
  const all = (ctx.data as ShapeComposerData).challenges ?? [];
  const id = String(ctx.itemId ?? '');
  const parentId = id.endsWith(SIMPLER) ? id.slice(0, -SIMPLER.length) : id;
  const parent = all.find(c => c.id === parentId);
  return parent && parentId !== id ? simplerShape(parent) ?? undefined : parent;
}

export const shapeComposerBoss = defineBoss<ShapeComposerData, ShapeComposerChallenge, ShapeComposerMiss>({
  card: shapeComposerCard,
  validate: validateShapeComposerData,
  items: d => d.challenges,
  ask: c => c.instruction,
  // Pieces, taps or a number the activity checks: no key reaches the tutor.
  assignment: c => bossAssignment(c.id, c.instruction, null),
  levers: SHAPE_COMPOSER_LEVERS,
  drive: {
    component: 'primitives/visual-primitives/math/ShapeComposer.tsx',
    instanceId: 'shape-composer',
    defaults: { grade: 'Kindergarten', mode: 'decompose', topic: 'Composing and decomposing shapes' },
    mounted: '[data-pip-object="workspace"]',
    current: currentItem,
    // decompose taps each part's shape (wrong: one part left out, `missed_part`); how-many-ways types the number (wrong:
    // one more than the fewest, `too_many`). The other modes are answered by dragging pieces on the board, which the
    // driver has no input for: ShapeComposer.workspace.test.tsx drives them with pointer events.
    play: (right, c) => {
      const check: DriverInput = { type: 'check' };
      if (c.type === 'decompose') {
        const taps = (c.expectedComponents ?? []).flatMap(p => Array.from({ length: p.count }, () => p.shape));
        return [...(right ? taps : taps.slice(0, -1)).map((label): DriverInput => ({ type: 'choose', label })), check];
      }
      if (c.type === 'how-many-ways') {
        return [{ type: 'write', label: 'How many pieces', text: String((c.minimumPiecesNeeded ?? 0) + (right ? 0 : 1)) }, check];
      }
      throw new Error(`shape-composer ${c.type}: pieces are dragged on the board; the driver has no drag input`);
    },
  },
});
