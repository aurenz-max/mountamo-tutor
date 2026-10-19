/**
 * push-pull-arena's domain (pure): the build gate drops what cannot be asked, every answer is computed from the sim's
 * physics, the key is a menu the ask says in full, and the known misses never accept a right answer.
 */
import { describe, expect, it } from 'vitest';
import { askLeaks } from '../../../components/live-activity/spokenKey';
import {
  DESIGN_SETUPS, FRICTION_MU, askFor, designPushSize, headNoun, itemsFromChallenges, predictMoves, pushPullArenaKey,
  pushPullSpokenMisses, type ArenaChallengeLike, type ArenaItem,
} from './pushPullArenaDomain';

const CHALLENGES: ArenaChallengeLike[] = [
  { id: 'observe-1', type: 'observe', objectName: 'Tennis Ball', objectWeight: 2, surface: 'wood', pushStrength: 5, pushDirection: 'push' },
  { id: 'observe-2', type: 'observe', objectName: 'Tennis Ball', objectWeight: 2, surface: 'wood', pushStrength: 5, pushDirection: 'pull' },
  // 4 × 8N = 32N against ice friction 0.03 × 2 × 9.8 ≈ 0.6N: decisively moves.
  { id: 'p1', type: 'predict', objectName: 'Tennis Ball', objectWeight: 2, surface: 'ice', pushStrength: 4 },
  // 2 × 8N = 16N against carpet friction 0.5 × 9 × 9.8 ≈ 44N: decisively stays.
  { id: 'p2', type: 'predict', objectName: 'Rock', objectWeight: 9, surface: 'carpet', pushStrength: 2 },
  { id: 'c1', type: 'compare', objectName: 'Tennis Ball', objectWeight: 2, surface: 'wood', object2Name: 'Rock', object2Weight: 9 },
  // Carpet friction 0.5 × 8 × 9.8 ≈ 39N: clear of the 16-32N murky band.
  { id: 'd1', type: 'design', objectName: 'Barrel', objectWeight: 8, surface: 'carpet' },
];
const ITEMS = itemsFromChallenges(CHALLENGES);

describe('items and keys', () => {
  it('every fixture survives the build gate with its code-computed answer', () => {
    expect(ITEMS.map(i => i.spokenAnswer)).toEqual(['push', 'pull', 'moves', 'stays', 'tennis ball', 'big']);
  });

  it.each(ITEMS.map(i => [i.id, i] as const))('%s: the ask says the whole menu and the key accepts the answer', (_id, item) => {
    const key = pushPullArenaKey(item);
    expect(askLeaks(askFor(item), key)).toEqual([]);
    expect(key.menu).toContain(item.spokenAnswer);
    expect(askFor(item)).not.toMatch(/Your turn|yes, or no/i);
  });

  it('carries the lesson tier on every item', () => {
    expect(itemsFromChallenges(CHALLENGES, 'easy').every(i => i.supportTier === 'easy')).toBe(true);
  });
});

describe('the build gate drops what cannot be asked', () => {
  const drop = (ch: ArenaChallengeLike) => itemsFromChallenges([ch]);
  it('a predict on the static-friction boundary', () => {
    expect(drop({ id: 'x', type: 'predict', objectName: 'Crate', objectWeight: 20.4, surface: 'wood', pushStrength: 5 })).toEqual([]);
  });
  it('a design inside the murky band', () => {
    expect(drop({ id: 'x', type: 'design', objectName: 'Crate', objectWeight: 10, surface: 'wood' })).toEqual([]);
  });
  it('a compare whose objects cannot be told apart', () => {
    const same = { id: 'x', type: 'compare' as const, objectName: 'Rock', objectWeight: 5, surface: 'wood' as const };
    expect(drop({ ...same, object2Name: 'Ball', object2Weight: 5 })).toEqual([]);
    expect(drop({ ...same, object2Name: 'Rock', object2Weight: 9 })).toEqual([]);
    expect(drop({ ...same })).toEqual([]);
  });
  it('no object or an unknown surface', () => {
    expect(drop({ id: 'x', type: 'observe', objectName: '   ', objectWeight: 2, surface: 'wood' })).toEqual([]);
    expect(drop({ id: 'x', type: 'observe', objectName: 'Ball', objectWeight: 2, surface: 'lava' as never })).toEqual([]);
  });
});

describe('code-computed answers', () => {
  it('predictMoves is the sim’s static-friction check', () => {
    expect(predictMoves(4, 2, 'ice')).toBe(true);
    expect(predictMoves(2, 9, 'carpet')).toBe(false);
  });

  it('every design setup is decisive, and consecutive setups alternate the answer', () => {
    const WEIGHTS: Record<string, number> = { 'Tennis Ball': 1, 'Toy Car': 2, 'Book': 3, 'Barrel': 8, 'Rock': 9, 'Refrigerator': 10 };
    const answers = DESIGN_SETUPS.map(setup => {
      const weight = WEIGHTS[setup.objectName];
      const frictionN = FRICTION_MU[setup.surface] * weight * 9.8;
      expect(frictionN < 16 || frictionN > 32, `${setup.objectName} on ${setup.surface}`).toBe(true);
      return designPushSize(weight, setup.surface);
    });
    expect(answers).toEqual(['little', 'big', 'little', 'big', 'little', 'big']);
    expect(new Set(DESIGN_SETUPS.map(s => `${s.objectName}|${s.surface}`)).size).toBe(DESIGN_SETUPS.length);
  });

  it('headNoun accepts the short form of a two-word object name', () => {
    expect(headNoun('Tennis Ball')).toBe('ball');
    expect(headNoun('Refrigerator')).toBe('refrigerator');
  });
});

describe('known misses (handoff 20 Part B): the other word of the pair; no example is accepted', () => {
  const arena = (kind: ArenaItem['kind'], spokenAnswer: string, alternates: string[], extra: Partial<ArenaItem> = {}) =>
    ({ id: 'a', kind, spokenAnswer, alternates, objectName: 'Rock', surfaceSpoken: 'the grass', ...extra }) as ArenaItem;
  it.each([
    [arena('observe', 'push', ['a push', 'pushing']), ['opposite_force', 'described_motion']],
    [arena('predict', 'stays', ['stay', 'stay still', 'it stays', 'no']), ['opposite_outcome']],
    [arena('compare', 'ball', ['the ball'], { objectName: 'Ball', object2Name: 'Box' }), ['other_object']],
    [arena('design', 'big', ['a big push']), ['opposite_size']],
  ] as const)('row %#', (item, ids) => {
    const misses = pushPullSpokenMisses(item);
    expect(misses.map(m => m.id)).toEqual(ids);
    const ok = [item.spokenAnswer, ...item.alternates].map(a => a.toLowerCase());
    for (const m of misses) for (const e of m.examples ?? []) expect(ok).not.toContain(e.toLowerCase());
  });
});
