/**
 * time-sequencer's code-owned keys (no model call): time of day is refused, never keyed as morning, when its period is
 * not one of the four or disagrees with its time, and every part of the day (evening too) is planned before a repeat;
 * duration-order keys the order from the minutes and refuses close or contradictory ones; missing-middle builds the
 * item from a five-step routine.
 */
import { describe, expect, it } from 'vitest';
import { keyDurationOrder, keyMissingMiddle, keyTimeOfDay, periodOfTime, periodPlan } from './gemini-time-sequencer';
import { validateTimeSequencerData } from '../../primitives/visual-primitives/math/timeSequencer.boss';
import type { TimeSequencerChallenge } from '../../primitives/visual-primitives/math/TimeSequencer';

const ok = (r: TimeSequencerChallenge | string) => { if (typeof r === 'string') throw new Error(r); return r; };
const valid = (c: TimeSequencerChallenge) => validateTimeSequencerData({ title: 'T', challenges: [c] });

describe('time of day (TIME001-01-A)', () => {
  it('reads a time into its part of the day', () => {
    expect(['7:00 AM', '12:00 PM', '4:30 PM', '5:00 PM', '6:30 PM', '8:00 PM', '2:00 AM'].map(periodOfTime))
      .toEqual(['morning', 'afternoon', 'afternoon', 'evening', 'evening', 'night', 'night']);
  });
  it('plans every part of the day, evening included, before any repeats', () => {
    for (let i = 0; i < 50; i++) {
      const plan = periodPlan(5);
      expect(new Set(plan.slice(0, 4))).toEqual(new Set(['morning', 'afternoon', 'evening', 'night']));
    }
  });
  const flat = (o: Record<string, unknown>) => ({ instruction: 'When do you do this?', hint: 'Think!', eventLabel: 'Eat dinner',
    eventEmoji: '🍝', eventTime: '6:00 PM', correctPeriod: 'evening', ...o });
  it('keys an evening activity as evening', () => {
    expect(ok(keyTimeOfDay(flat({}), 0))).toMatchObject({ correctPeriod: 'evening', event: { label: 'Eat dinner' } });
    expect(() => valid(ok(keyTimeOfDay(flat({}), 0)))).not.toThrow();
  });
  it('refuses an invalid period, a period its time contradicts, or a label naming the part of the day', () => {
    expect(keyTimeOfDay(flat({ correctPeriod: 'dusk' }), 0)).toMatch(/not a part of the day/);
    expect(keyTimeOfDay(flat({ correctPeriod: '' }), 0)).toMatch(/not a part of the day/);
    expect(keyTimeOfDay(flat({ correctPeriod: 'morning' }), 0)).toMatch(/disagrees/);
    expect(keyTimeOfDay(flat({ eventTime: '' }), 0)).toMatch(/disagrees/);
    expect(keyTimeOfDay(flat({ eventLabel: 'Evening walk' }), 0)).toMatch(/names a part of the day/);
  });
  it('replaces an instruction or hint that names the answer', () => {
    const c = ok(keyTimeOfDay(flat({ instruction: 'Do you eat dinner in the evening?', hint: 'It is at night.' }), 0));
    expect(c.instruction).toBe('When does this happen?');
    expect(c.hint).not.toMatch(/evening|night/i);
  });
});

describe('duration-order (MEAS001-07-C)', () => {
  const flat = (o: Record<string, unknown> = {}) => ({ activity0Label: 'Play at the park', activity0Emoji: '🛝', activity0Minutes: 60,
    activity1Label: 'Wash your hands', activity1Emoji: '🧼', activity1Minutes: 1, activity2Label: 'Eat a snack', activity2Emoji: '🍎',
    activity2Minutes: 10, shortestToLongest: '1,2,0', ...o });
  it('keys the order from the minutes, shortest first, and passes the boss', () => {
    const c = ok(keyDurationOrder(flat(), 0));
    expect(c.correctOrder!.map(id => c.events!.find(e => e.id === id)!.label)).toEqual(['Wash your hands', 'Eat a snack', 'Play at the park']);
    expect(() => valid(c)).not.toThrow();
  });
  it('refuses minutes that are close, missing, or disagree with the stated order', () => {
    expect(keyDurationOrder(flat({ activity2Minutes: 30 }), 0)).toMatch(/too close/);
    expect(keyDurationOrder(flat({ activity1Minutes: 0 }), 0)).toMatch(/no usable minutes/);
    expect(keyDurationOrder(flat({ activity1Minutes: 'soon' }), 0)).toMatch(/no usable minutes/);
    expect(keyDurationOrder(flat({ shortestToLongest: '0,1,2' }), 0)).toMatch(/disagrees/);
    expect(keyDurationOrder(flat({ shortestToLongest: '' }), 0)).toMatch(/disagrees/);
  });
  it('refuses a label that prints how long it takes', () => {
    expect(keyDurationOrder(flat({ activity0Label: 'A long walk' }), 0)).toMatch(/says how long/);
    expect(keyDurationOrder(flat({ activity0Label: 'Play 60 minutes' }), 0)).toMatch(/says how long/);
  });
  it('the boss refuses an order that does not follow the minutes', () => {
    const c = ok(keyDurationOrder(flat(), 0));
    expect(() => valid({ ...c, correctOrder: [...c.correctOrder!].reverse() })).toThrow();
  });
});

describe('missing-middle (PTRN001-03-E)', () => {
  const flat = { step0Label: 'Plant a seed', step0Emoji: '🌱', step1Label: 'Water it', step1Emoji: '💧', step2Label: 'It sprouts',
    step2Emoji: '🌿', step3Label: 'It grows tall', step3Emoji: '🌻', step4Label: 'Pick the flower', step4Emoji: '💐' };
  it('shows steps 2 and 4, keys step 3, and names the other choices before the first and after the last', () => {
    for (let i = 0; i < 20; i++) {
      const c = ok(keyMissingMiddle(flat, 0));
      expect([c.firstEvent!.label, c.lastEvent!.label]).toEqual(['Water it', 'It grows tall']);
      expect(c.options!.find(o => o.id === c.correctEvent)!.label).toBe('It sprouts');
      const place = (label: string) => c.optionPlaces![c.options!.find(o => o.label === label)!.id];
      expect([place('Plant a seed'), place('Pick the flower')]).toEqual(['before', 'after']);
      expect(c.instruction).not.toMatch(/sprout/i);
      expect(() => valid(c)).not.toThrow();
    }
  });
  it('refuses a routine with a blank or repeated step', () => {
    expect(keyMissingMiddle({ ...flat, step2Label: '' }, 0)).toMatch(/no label/);
    expect(keyMissingMiddle({ ...flat, step4Label: 'water it' }, 0)).toMatch(/share a label/);
  });
});
