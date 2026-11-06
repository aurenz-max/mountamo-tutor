import { describe, expect, it } from 'vitest';
import {
  ALL_LEVERS, ATTACHMENT_NAME, ATTACHMENTS, attachmentItemHolds, attachmentMiss, buildSetLevers, goFeedback, JOB_TOOL,
  jobFeedback, JOBS, leverMiss, matchAttachmentInstruction, moveOf, NEAR_MISS, pickMatchAttachment, pickSetLevers,
  poseAt, roomHolds, runMove, solutions, START, type Room, type Side,
} from './skidSteerModel';

const near = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThan(1e-9);

describe('skid steer kinematics', () => {
  it('names every lever setting the way a real skid steer moves', () => {
    expect(moveOf({ left: 'fwd', right: 'fwd' })).toEqual({ kind: 'straight', dir: 1 });
    expect(moveOf({ left: 'stop', right: 'stop' }).kind).toBe('none');
    expect(moveOf({ left: 'fwd', right: 'stop' })).toEqual({ kind: 'pivot', dir: -1, around: 'right' }); // turns right
    expect(moveOf({ left: 'stop', right: 'fwd' })).toEqual({ kind: 'pivot', dir: 1, around: 'left' });
    expect(moveOf({ left: 'back', right: 'fwd' })).toEqual({ kind: 'spin', dir: 1 });
  });

  it('a spin stays on its spot; a pivot swings the centre around the stopped side', () => {
    const spin = poseAt(START, { left: 'fwd', right: 'back' }, 1);
    near(spin.x, 0); near(spin.y, 0); near(spin.th, -Math.PI / 2);
    const pivot = poseAt(START, { left: 'fwd', right: 'stop' }, 1); // around the right wheels
    near(pivot.x, 0.75); near(pivot.y, 0.75);
  });
});

describe('the room holds', () => {
  const rooms: Room[] = ['open', 'wall_front', 'wall_back', 'boxed'];
  for (const room of rooms) for (const side of ['left', 'right'] as Side[]) {
    it(`${room} on the ${side}`, () => {
      const c = buildSetLevers('hay bale', side, room, 'x');
      expect(roomHolds(c), JSON.stringify(solutions(c))).toBe(true);
    });
  }

  it('boxed: only the spin toward the goal fits; the pivots bump', () => {
    const c = buildSetLevers('dirt pile', 'left', 'boxed', 'x');
    expect(solutions(c)).toEqual([{ left: 'back', right: 'fwd' }]);
    expect(leverMiss(c, { left: 'stop', right: 'fwd' })).toBe('bumped');
    expect(leverMiss(c, { left: 'fwd', right: 'stop' })).toBe('wrong_way');
    expect(leverMiss(c, { left: 'fwd', right: 'fwd' })).toBe('drove_straight');
    expect(runMove(c.barriers, { left: 'fwd', right: 'fwd' }).bumpedWith).toBe('front');
  });

  it('feedback says what the machine did, never which levers work', () => {
    const c = buildSetLevers('log pile', 'right', 'wall_front', 'x');
    for (const l of ALL_LEVERS) {
      if (moveOf(l).kind === 'none') continue;
      expect(goFeedback(c, l)).not.toMatch(/should|try (the|setting)|set the (left|right)/i);
    }
  });
});

describe('pickSetLevers', () => {
  it('every session holds its rooms, mixes sides and never repeats a thing', () => {
    for (const d of ['easy', 'medium', 'hard'] as const) for (let k = 0; k < 40; k++) {
      const items = pickSetLevers(d);
      expect(items).toHaveLength(5);
      expect(items.every(roomHolds)).toBe(true);
      expect(new Set(items.map(c => c.goal)).size).toBe(5);
      expect(new Set(items.map(c => c.side)).size).toBe(2);
      for (let i = 1; i < 5; i++) expect(items[i].room === items[i - 1].room && items[i].side === items[i - 1].side).toBe(false);
    }
  });

  it('hard has more tight rooms than easy', () => {
    const tight = (d: 'easy' | 'hard') => pickSetLevers(d).filter(c => c.room !== 'open').length;
    expect(tight('hard')).toBeGreaterThan(tight('easy'));
    expect(pickSetLevers('hard').filter(c => c.room === 'boxed').length).toBe(3);
  });
});

describe('match_attachment', () => {
  it('every tier is fair: the right tool once, the near miss only past easy, four tools only on hard', () => {
    for (const d of ['easy', 'medium', 'hard'] as const) for (let k = 0; k < 40; k++) {
      const items = pickMatchAttachment(d);
      expect(items).toHaveLength(5);
      expect(new Set(items.map(c => c.job)).size).toBe(5);
      for (const c of items) {
        expect(attachmentItemHolds(c)).toBe(true);
        expect(c.options).toHaveLength(d === 'hard' ? 4 : 3);
        expect(c.options.includes(NEAR_MISS[c.job])).toBe(d !== 'easy');
      }
    }
  });

  it('the right tool is not always in the same slot', () => {
    const slots = new Set<number>();
    for (let k = 0; k < 40; k++) for (const c of pickMatchAttachment('hard')) slots.add(c.options.indexOf(JOB_TOOL[c.job]));
    expect(slots.size).toBe(4);
  });

  it('names the near miss apart from other wrong tools; feedback never names the right tool on a miss', () => {
    for (const job of JOBS) {
      const c = { id: 'x', type: 'match_attachment' as const, job, options: [...ATTACHMENTS], instruction: '' };
      expect(attachmentMiss(c, JOB_TOOL[job])).toBeUndefined();
      expect(attachmentMiss(c, NEAR_MISS[job])).toBe('near_tool');
      for (const a of ATTACHMENTS) {
        if (a === JOB_TOOL[job]) continue;
        expect(jobFeedback(c, a)).not.toContain(ATTACHMENT_NAME[JOB_TOOL[job]]);
        if (a !== NEAR_MISS[job]) expect(attachmentMiss(c, a)).toBe('wrong_tool');
      }
      expect(matchAttachmentInstruction(job)).not.toMatch(new RegExp(ATTACHMENT_NAME[JOB_TOOL[job]], 'i'));
    }
  });
});
