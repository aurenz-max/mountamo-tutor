import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import {
  EASIER_LEVER, FORCE_MODEL_LEVER, HAND_LEVER, SAME_PUSH_MODEL_LEVER, SETUP_LEVER,
  arenaLevers, arenaLeversOnScreen, arenaPracticeItem, arenaSessionNames, leverTextLeaks, practiceLeak,
} from './pushPullArenaLevers';
import { FORCE_SCALE_N, FRICTION_MU, itemFromChallenge, type ArenaSurfaceId } from './pushPullArenaScript';
import type { PushPullChallenge } from './PushPullArena';
import observe from '../../../components/live-activity/runtime/testing/w1-payloads/push-pull-arena.observe.json';
import predict from '../../../components/live-activity/runtime/testing/w1-payloads/push-pull-arena.predict.json';
import compare from '../../../components/live-activity/runtime/testing/w1-payloads/push-pull-arena.compare.json';
import design from '../../../components/live-activity/runtime/testing/w1-payloads/push-pull-arena.design.json';

const PAYLOADS = { observe, predict, compare, design } as unknown as Record<string, { data: { challenges: PushPullChallenge[] } }>;
const ALL_IDS = [HAND_LEVER, FORCE_MODEL_LEVER, SETUP_LEVER, SAME_PUSH_MODEL_LEVER, EASIER_LEVER];

describe('saved payloads: every item has a lever for its miss, and no lever text leaks', () => {
  it.each(Object.keys(PAYLOADS))('%s', mode => {
    const session = PAYLOADS[mode].data.challenges;
    for (const c of session) {
      const item = itemFromChallenge(c)!;
      expect(item, c.id).toBeTruthy();
      const levers = arenaLevers(c, [], session);
      expect(levers.some(l => l.kind === 'help'), c.id).toBe(true);
      for (const l of levers) expect(leverTextLeaks(`${l.when} ${l.does}`, item), `${c.id} ${l.id}`).toBe(false);
      const fact = arenaLeversOnScreen(c, ALL_IDS, session);
      expect(fact).toBeTruthy();
      expect(leverTextLeaks(fact!, item), `${c.id} fact: ${fact}`).toBe(false);
    }
  });

  it('the easier item is offered on the saved payloads (never on observe)', () => {
    const offered = (mode: string) => PAYLOADS[mode].data.challenges.filter(c => arenaLevers(c, [], PAYLOADS[mode].data.challenges)
      .some(l => l.id === EASIER_LEVER)).length;
    expect(offered('observe')).toBe(0);
    expect(offered('predict')).toBe(PAYLOADS.predict.data.challenges.length);
    expect(offered('design')).toBe(PAYLOADS.design.data.challenges.length);
    expect(offered('compare')).toBeGreaterThan(0);
  });
});

describe('leverTextLeaks', () => {
  const item = (c: Partial<PushPullChallenge>) => itemFromChallenge({ id: 'x', type: 'observe', objectName: 'Rock', objectWeight: 9, surface: 'grass',
    pushStrength: 5, pushDirection: 'push', ...c } as PushPullChallenge)!;
  it.each([
    ['the rock was pushed away', item({}), true],
    ['push, or pull', item({}), false],
    ['it will move', item({ type: 'predict', objectWeight: 1, surface: 'ice', pushStrength: 8 }), true],
    ['the Rock is heavy', item({ type: 'design', surface: 'carpet' }), true],
    ['it needs a big push', item({ type: 'design', surface: 'carpet' }), true],
    ['under the Rock, 9 weight blocks', item({ type: 'compare', object2Name: 'Book', object2Weight: 3 }), true],
    ['under the Rock, 9 weight blocks; under the Book, 3 weight blocks', item({ type: 'compare', object2Name: 'Book', object2Weight: 3 }), false],
    ['the Book is lighter than the Rock', item({ type: 'compare', object2Name: 'Book', object2Weight: 3 }), true],
  ] as const)('%s', (text, it_, leaks) => expect(leverTextLeaks(text, it_)).toBe(leaks));
});

describe('the easier practice item', () => {
  const OBJECTS = [['Tennis Ball', 1], ['Soccer Ball', 2], ['Toy Car', 2], ['Book', 3], ['Brick', 4], ['Backpack', 5], ['Watermelon', 6],
    ['Dog', 7], ['Barrel', 8], ['Rock', 9], ['Refrigerator', 10]] as const;
  const SURFACES = Object.keys(FRICTION_MU) as ArenaSurfaceId[];
  let seed = 7;
  const rnd = (n: number) => { seed = (seed * 9301 + 49297) % 233280; return Math.floor((seed / 233280) * n); };
  const random = (type: PushPullChallenge['type'], i: number): PushPullChallenge => {
    const [a, b] = [OBJECTS[rnd(OBJECTS.length)], OBJECTS[rnd(OBJECTS.length)]];
    return { id: `c${i}`, type, instruction: '', objectName: a[0], objectWeight: a[1], objectEmoji: '', surface: SURFACES[rnd(4)],
      pushStrength: 1 + rnd(10), pushDirection: rnd(2) ? 'push' : 'pull',
      ...(type === 'compare' ? { object2Name: b[0], object2Weight: b[1], object2Emoji: '' } : {}) };
  };

  it.each(['predict', 'compare', 'design'] as const)('%s: same mode, decisive, off the session, never the parent', type => {
    let built = 0;
    for (let i = 0; i < 300; i++) {
      const session = [random(type, i), random(type, i + 1000)];
      const parent = session[0];
      if (!itemFromChallenge(parent)) continue;
      const p = arenaPracticeItem(parent, session);
      if (type === 'compare' && Math.abs((parent.object2Weight ?? 0) - parent.objectWeight) >= 7) { expect(p).toBeNull(); continue; }
      expect(p, JSON.stringify(parent)).not.toBeNull();
      built++;
      const { challenge, item } = p!;
      expect(challenge.id).toBe(`${parent.id}~simpler`);
      expect(item.kind).toBe(type);
      expect(practiceLeak(challenge, parent, session)).toBe(false);
      const used = arenaSessionNames(session);
      expect(used.has(challenge.objectName.toLowerCase())).toBe(false);
      if (type === 'compare') {
        expect(Math.abs(challenge.objectWeight - (challenge.object2Weight ?? 0))).toBe(9);
        expect(item.spokenAnswer).toBe(challenge.object2Name!.toLowerCase());
      } else {
        expect(challenge.surface).not.toBe(parent.surface);
        const friction = FRICTION_MU[challenge.surface] * challenge.objectWeight * 9.8;
        if (type === 'predict') expect(item.spokenAnswer).toBe((challenge.pushStrength ?? 5) * FORCE_SCALE_N > friction ? 'moves' : 'stays');
        else expect(item.spokenAnswer).toBe(friction > 24 ? 'big' : 'little');
      }
    }
    expect(built).toBeGreaterThan(50);
  });

  it('observe has no easier item: one object and one force is its plainest shape', () => {
    expect(arenaPracticeItem(random('observe', 1), [])).toBeNull();
  });

  it('practiceLeak catches a session object and the parent surface', () => {
    const parent = { ...random('predict', 1), surface: 'wood' as const };
    const p = arenaPracticeItem(parent, [parent])!.challenge;
    expect(practiceLeak({ ...p, objectName: parent.objectName }, parent, [parent])).toBe(true);
    expect(practiceLeak({ ...p, surface: 'wood' }, parent, [parent])).toBe(true);
    expect(practiceLeak({ ...p, type: 'design' }, parent, [parent])).toBe(true);
  });
});

describe('this miss, then this lever', () => {
  const s = (c: Partial<PushPullChallenge>) => ({ id: 'c1', instruction: '', objectEmoji: '', objectName: 'Book', objectWeight: 3, surface: 'wood',
    pushStrength: 5, pushDirection: 'push', ...c }) as PushPullChallenge;
  const C = {
    observe: s({ type: 'observe' }),
    predict: s({ type: 'predict', pushStrength: 8 }),
    compare: s({ type: 'compare', object2Name: 'Rock', object2Weight: 9 }),
    design: s({ type: 'design' }),
  };
  it.each([
    ['observe', 'opposite_force', [], HAND_LEVER],
    ['observe', 'described_motion', [HAND_LEVER], FORCE_MODEL_LEVER],
    ['observe', 'opposite_force', [HAND_LEVER, FORCE_MODEL_LEVER], null],
    ['predict', 'opposite_outcome', [], SETUP_LEVER],
    ['predict', 'opposite_outcome', [SETUP_LEVER], EASIER_LEVER],
    ['compare', 'other_object', [], SETUP_LEVER],
    ['compare', 'other_object', [SETUP_LEVER], SAME_PUSH_MODEL_LEVER],
    ['compare', 'other_object', [SETUP_LEVER, SAME_PUSH_MODEL_LEVER], EASIER_LEVER],
    ['design', 'opposite_size', [], SETUP_LEVER],
    ['design', 'opposite_size', [SETUP_LEVER], EASIER_LEVER],
  ] as const)('%s %s with %j pulled -> %s', (mode, miss, pulled, lever) => {
    const c = C[mode];
    expect(nextLever(arenaLevers(c, pulled, [c]), miss)).toBe(lever);
  });
});
