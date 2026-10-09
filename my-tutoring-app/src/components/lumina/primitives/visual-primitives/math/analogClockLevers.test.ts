/**
 * analog-clock levers (`analogClockLevers.ts`): each leak rule per mode, each easier-item builder over every item of
 * its mode, the miss → lever table, and that every miss the catalog lists for a mode is answered on every saved
 * payload item (J12 per item).
 */
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { getComponentById } from '../../../service/manifest/catalog';
import type { ClockChallenge } from './AnalogClock';
import { clockMiss, elapsedMinutes, type ClockView } from './analogClockWorkspace';
import {
  DIGITAL_ECHO_LEVER, HAND_LEGEND_LEVER, MINUTE_NUMBERS_LEVER, ROUND_ARROW_LEVER, RUNNING_MODEL_LEVER, SHORT_HANDS_LEVER,
  SIMPLER_LEVER, START_SWEEP_LEVER, analogClockLevers, dialHour, echoOffered, legendOffered, leverFacts, modelLeaks,
  onTheHour, practiceItem, practiceLeaks, practiceParent, runningModelHour, sweptMinutes, twoChoices, twoFaces, wholeHours,
} from './analogClockLevers';

const ids = (levers: { id: string }[]) => levers.map(l => l.id);
const hhmm = (h: number, m: number) => `${dialHour(h)}:${String(m).padStart(2, '0')}`;
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);

const choice = (type: 'read' | 'match' | 'hear_time', h: number, m: number): ClockChallenge => {
  const options = [hhmm(h, m), hhmm(h + 1, m), hhmm(h - 1, m), hhmm(h + 5, (m + 30) % 60)];
  return { id: `${type}-${h}-${m}`, type, instruction: 'What time is it?', targetHour: h, targetMinute: m,
    option0: options[0], option1: options[1], option2: options[2], option3: options[3], correctOptionIndex: 0, hint: '' };
};
const setTime = (h: number, m: number): ClockChallenge =>
  ({ id: `s-${h}-${m}`, type: 'set_time', instruction: `Set the clock to ${hhmm(h, m)}.`, targetHour: h, targetMinute: m, hint: '' });
const label = (min: number) => [Math.floor(min / 60) ? `${Math.floor(min / 60)} hour${min >= 120 ? 's' : ''}` : '', min % 60 ? `${min % 60} minutes` : '']
  .filter(Boolean).join(' ');
const elapsed = (sh: number, sm: number, d: number): ClockChallenge => {
  const end = sh * 60 + sm + d;
  return { id: `e-${sh}-${sm}-${d}`, type: 'elapsed', instruction: 'How long?', startHour: sh, startMinute: sm,
    targetHour: dialHour(Math.floor(end / 60)), targetMinute: end % 60,
    option0: label(d), option1: label(d + 60), option2: label(Math.max(15, d - 15)), option3: label(d + 30), correctOptionIndex: 0, hint: '' };
};
const handName = (h: number, hand: 'hour' | 'minute'): ClockChallenge =>
  ({ id: `h-${h}`, type: 'hand_name', instruction: 'Touch the hand.', targetHour: h, targetMinute: 0, targetHand: hand, hint: '' });
const countFace: ClockChallenge = { id: 'c', type: 'count_face', instruction: 'Count.', targetHour: 3, targetMinute: 0, hint: '' };

describe('leak rules', () => {
  it('running_model: the model hour and the next never come within an hour of the item hour', () => {
    for (const h of HOURS) {
      expect(modelLeaks(h, runningModelHour(h))).toBe(false);
      for (const bad of [h - 1, h, h + 1, h - 2]) expect(modelLeaks(h, dialHour(bad))).toBe(true);
    }
  });
  it('the hand legend never on hand_name, hear_time or count_face; the echo only on set_time', () => {
    expect(['hand_name', 'hear_time', 'count_face', 'elapsed'].map(m => legendOffered(m as ClockChallenge['type']))).toEqual([false, false, false, false]);
    expect(['read', 'match', 'set_time'].every(m => legendOffered(m as ClockChallenge['type']))).toBe(true);
    expect((['read', 'match', 'elapsed', 'hear_time', 'hand_name', 'count_face'] as const).some(echoOffered)).toBe(false);
    expect(ids(analogClockLevers(handName(4, 'hour'), []))).toEqual([RUNNING_MODEL_LEVER]);
    for (const m of [0, 15, 30]) expect(ids(analogClockLevers(choice('read', 3, m), []))).not.toContain(DIGITAL_ECHO_LEVER);
  });
  it('the sweep is the learner\'s own run: nothing before it, the minutes run forward after', () => {
    expect(sweptMinutes({ hour: 2, minute: 15 }, { hour: 2, minute: 15 })).toBe(0);
    expect(sweptMinutes({ hour: 2, minute: 15 }, { hour: 3, minute: 45 })).toBe(90);
    expect(sweptMinutes({ hour: 11, minute: 30 }, { hour: 1, minute: 0 })).toBe(90);
  });
  it('lever facts draw no digit and never the key, on every mode with every lever pulled', () => {
    const items = [handName(2, 'hour'), countFace, choice('hear_time', 2, 0), choice('read', 6, 30), choice('match', 10, 45),
      setTime(4, 5), elapsed(3, 15, 45)];
    for (const c of items) {
      const all = analogClockLevers(c, []).map(l => l.id);
      const facts = leverFacts(c, all);
      expect(facts, c.type).not.toMatch(/\d/);
      expect(facts).not.toMatch(/touch the (short|long)/i);
      for (const l of analogClockLevers(c, [])) expect(`${l.when} ${l.does}`, `${c.type} ${l.id}`).not.toMatch(/\d/);
    }
    // hand_name: no lever names which hand tells what.
    const hn = analogClockLevers(handName(2, 'hour'), []);
    expect(hn.map(l => `${l.when} ${l.does}`).join(' ')).not.toMatch(/hour hand|minute hand|short hand tells|long hand tells/i);
  });
});

describe('simpler items', () => {
  it('read / match: a whole hour, two choices six hours apart, never the item\'s time or right option, over every time', () => {
    for (const type of ['read', 'match'] as const) for (const h of HOURS) for (const m of MINUTES) {
      const c = choice(type, h, m), p = twoChoices(c);
      expect(p).toMatchObject({ id: `${c.id}~simpler`, type, targetMinute: 0 });
      expect([p.option0, p.option1].filter(Boolean)).toHaveLength(2);
      expect(practiceLeaks(c, p), `${type} ${h}:${m}`).toBe(false);
      expect(clockMiss(p, { selectedOption: p.correctOptionIndex! } as ClockView)).toBeUndefined();
    }
  });
  it('hear_time: two faces six hours apart, a different spoken hour', () => {
    for (const h of HOURS) {
      const c = choice('hear_time', h, 0), p = twoFaces(c);
      expect(p.type).toBe('hear_time');
      expect(practiceLeaks(c, p)).toBe(false);
      expect(p.instruction).toMatch(/^Which clock shows [a-z]+ o'clock\?$/);
    }
    expect(twoFaces(choice('hear_time', 8, 0)).instruction).toBe("Which clock shows twelve o'clock?");
  });
  it('set_time: a whole hour, none when the item is already on the hour', () => {
    for (const h of HOURS) for (const m of MINUTES) {
      const c = setTime(h, m), p = onTheHour(c);
      if (m === 0) { expect(p).toBeNull(); expect(ids(analogClockLevers(c, []))).not.toContain(SIMPLER_LEVER); continue; }
      expect(p).toMatchObject({ type: 'set_time', targetMinute: 0 });
      expect(practiceLeaks(c, p!)).toBe(false);
      expect(p!.instruction).toBe(`Set the clock to ${hhmm(p!.targetHour, 0)}.`);
    }
  });
  it('elapsed: whole hours from a whole-hour start; never the item\'s duration among the choices; none on whole hours', () => {
    for (const sh of HOURS) for (const sm of [0, 15, 30, 45]) for (const d of [15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 180]) {
      const c = elapsed(sh, sm, d), p = wholeHours(c);
      if (d % 60 === 0) { expect(p).toBeNull(); continue; }
      expect(p, `${sh}:${sm} +${d}`).not.toBeNull();
      expect(elapsedMinutes(p!) % 60).toBe(0);
      expect(p!.startMinute).toBe(0);
      expect(practiceLeaks(c, p!), `${sh}:${sm} +${d}`).toBe(false);
      expect(clockMiss(p!, { selectedOption: p!.correctOptionIndex! } as ClockView)).toBeUndefined();
    }
  });
  it('no simpler item on hand_name, count_face or a practice item; the parent is found from the practice id', () => {
    expect(practiceItem(handName(3, 'minute'))).toBeNull();
    expect(practiceItem(countFace)).toBeNull();
    const c = choice('read', 3, 30), p = practiceItem(c)!;
    expect(practiceItem(p)).toBeNull();
    expect(analogClockLevers(p, [])).toEqual([]);
    expect(practiceParent(p.id, [choice('read', 5, 0), c])).toBe(c);
    expect(practiceParent(c.id, [c])).toBeNull();
  });
});

describe('the miss → lever table', () => {
  const plain = { legendShown: false, minuteNumbersShown: false, echoShown: false };
  it.each([
    ['hand_name', handName(2, 'hour'), 'other_hand', RUNNING_MODEL_LEVER],
    ['hear_time', choice('hear_time', 2, 0), 'next_hour', SHORT_HANDS_LEVER],
    ['read', choice('read', 3, 30), 'hands_swapped', HAND_LEGEND_LEVER],
    ['read', choice('read', 3, 30), 'next_hour', RUNNING_MODEL_LEVER],
    ['read', choice('read', 3, 15), 'minute_as_number', MINUTE_NUMBERS_LEVER],
    ['match', choice('match', 7, 45), 'other_time', MINUTE_NUMBERS_LEVER],
    ['set_time', setTime(4, 5), 'wrong_minute', MINUTE_NUMBERS_LEVER],
    ['set_time', setTime(4, 5), 'previous_hour', RUNNING_MODEL_LEVER],
    ['elapsed', elapsed(3, 15, 45), 'hour_off', START_SWEEP_LEVER],
    ['elapsed', elapsed(3, 15, 45), 'too_short', MINUTE_NUMBERS_LEVER],
  ] as const)('%s: %s → %s', (_mode, c, miss, lever) => {
    expect(nextLever(analogClockLevers(c, [], plain), miss)).toBe(lever);
  });
  it('a tier aid already on screen is declared pulled, so the next one comes', () => {
    const c = choice('read', 3, 15), shown = { legendShown: true, minuteNumbersShown: true, echoShown: false };
    const levers = analogClockLevers(c, [], shown);
    expect(levers.filter(l => l.pulled).map(l => l.id)).toEqual([HAND_LEGEND_LEVER, MINUTE_NUMBERS_LEVER]);
    expect(nextLever(levers, 'minute_as_number')).toBe(SIMPLER_LEVER);
    expect(nextLever(levers, 'hands_swapped')).toBe(RUNNING_MODEL_LEVER);
    const s = analogClockLevers(setTime(4, 5), [], { legendShown: false, minuteNumbersShown: false, echoShown: true });
    expect(s.find(l => l.id === DIGITAL_ECHO_LEVER)?.pulled).toBe(true);
  });
  it('count_face has one help lever and no miss to answer', () => {
    expect(analogClockLevers(countFace, []).map(l => [l.id, l.kind, l.answers])).toEqual([[ROUND_ARROW_LEVER, 'help', []]]);
  });
});

it('every miss the catalog lists for a mode is answered by an open lever on every saved payload item (J12)', async () => {
  const entry = getComponentById('analog-clock')!;
  expect(entry.teachingWorkspace!.levers).toBe(true);
  const misses = entry.teachingWorkspace!.misses!;
  for (const mode of ['hand_name', 'count_face', 'hear_time', 'read', 'match', 'set_time', 'elapsed']) {
    const payload = await import(`../../../components/live-activity/runtime/testing/w1-payloads/analog-clock.${mode}.json`);
    const data = (payload.default ?? payload).data;
    for (const c of data.challenges as ClockChallenge[]) {
      const levers = analogClockLevers(c, [], { legendShown: !!c.showHandLegend, minuteNumbersShown: !!c.showMinuteNumbers,
        echoShown: !!c.showDigitalEcho && c.type === 'set_time' });
      expect(levers.length, `${mode} ${c.id}`).toBeGreaterThan(0);
      for (const m of misses[mode] ?? []) expect(levers.some(l => !l.pulled && l.answers?.includes(m)), `${mode} ${c.id} ${m}`).toBe(true);
      const p = practiceItem(c);
      if (p) expect(practiceLeaks(c, p), `${mode} ${c.id}`).toBe(false);
    }
  }
});
