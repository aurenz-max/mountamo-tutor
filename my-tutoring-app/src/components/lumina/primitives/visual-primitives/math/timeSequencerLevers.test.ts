/**
 * time-sequencer levers, every mode: the word-family leak rule, each simpler-item builder over every saved payload
 * item and a hand-built set (same mode, solvable, never the learner's activities), scene facts that name no key,
 * the miss → lever table, and every catalog miss answered by a lever on every saved payload item (J12 per item).
 */
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { getComponentById } from '../../../service/manifest/catalog';
import type { TimeSequencerChallenge } from './TimeSequencer';
import {
  DAY_ANCHORS_LEVER, DURATION_MODEL_LEVER, FACE_NUMBERS_LEVER, FAR_APART_LEVER, FAR_PAIR_LEVER, OPTION_PICTURES_LEVER,
  RELATION_MODEL_LEVER, SHORT_SCHEDULE_LEVER, SKY_STRIP_LEVER, TWO_CARDS_LEVER, TWO_CHOICES_LEVER, clashes, itemLabels,
  leverFacts, practiceItem, practiceLeaks, practiceParent, timeSequencerLevers,
} from './timeSequencerLevers';
import { EMPTY_TIME_VIEW, PERIODS, timeSequencerMiss, workspaceScene } from './timeSequencerWorkspace';

const MODES = ['sequence-3', 'time-of-day', 'sequence-5', 'before-after', 'duration-compare', 'clock-sequence', 'read-schedule'];
const load = async (mode: string): Promise<{ data: { challenges: TimeSequencerChallenge[] } }> => {
  const p = await import(`../../../components/live-activity/runtime/testing/w1-payloads/time-sequencer.${mode}.json`);
  return p.default ?? p;
};
const ITEMS = async () => (await Promise.all(MODES.map(async m => (await load(m)).data.challenges.map(c => [m, c] as const)))).flat();

/** The item's own key, as text, for the leak checks. */
function keyTexts(c: TimeSequencerChallenge): string[] {
  switch (c.type) {
    case 'match-time-of-day': return [c.correctPeriod!];
    case 'before-after': return [c.options!.find(o => o.id === c.correctEvent)!.label];
    case 'duration-compare': return [c.eventA!.label, c.eventB!.label];
    case 'read-schedule': return [c.correctActivity!];
    default: return (c.events ?? []).map(e => e.label);
  }
}

/** The practice item is solvable: its key is one of its own choices. */
function solvable(c: TimeSequencerChallenge): boolean {
  switch (c.type) {
    case 'sequence-events': case 'clock-sequence':
      return JSON.stringify([...c.correctOrder!].sort()) === JSON.stringify(c.events!.map(e => e.id).sort())
        && c.events!.every((e, i, all) => i === 0 || (e.dayFraction! > all[i - 1].dayFraction!))
        && (c.type !== 'clock-sequence' || c.events!.every((e, i, all) => Number.isInteger(e.clockHour) && (i === 0 || e.clockHour! > all[i - 1].clockHour!)));
    case 'match-time-of-day': return !!c.periodChoices?.includes(c.correctPeriod!) && c.periodChoices.length === 2;
    case 'before-after': return c.options!.some(o => o.id === c.correctEvent) && c.options!.length === 2;
    case 'duration-compare': return c.correctAnswer === 'A' || c.correctAnswer === 'B';
    case 'read-schedule': return c.schedule!.find(r => r.time === c.targetTime)?.activity === c.correctActivity
      && c.activityOptions!.includes(c.correctActivity!) && new Set(c.schedule!.map(r => r.time)).size === c.schedule!.length;
  }
  return false;
}

describe('the word-family leak rule', () => {
  it.each([
    ['Go to sleep', ['Sleep and dream'], true], ['Put on pajamas', ['Get cozy for bed'], true], ['Eat lunch', ['Have a picnic'], true],
    ['Wake up', ['Wake Up'], true], ['Play at the park', ['Play indoor games'], true], ['Eat dinner', ['Eat breakfast'], false],
    ['Ride a bike', ['Brush teeth', 'Eat lunch'], false], ['Blink your eyes', ['Eat a cookie'], false],
  ] as const)('%s against %o: clash %s', (label, item, want) => expect(clashes(label, item)).toBe(want));
});

describe('simpler items', () => {
  it('every saved payload item gets one: same mode, solvable, no shared activity, never a practice of a practice', async () => {
    for (const [mode, c] of await ITEMS()) {
      const s = practiceItem(c);
      expect(s, `${mode} ${c.id}`).not.toBeNull();
      expect(s!.id).toBe(`${c.id}~smaller`);
      expect(s!.type).toBe(c.type);
      expect(practiceLeaks(c, s!), `${mode} ${c.id}`).toBe(false);
      expect(solvable(s!), `${mode} ${c.id}`).toBe(true);
      expect(practiceItem(s!)).toBeNull();
      expect(practiceParent(s!.id, [c])).toBe(c);
      if (c.events) expect(s!.events!.length).toBe(c.events.length);
      if (c.type === 'match-time-of-day') expect(s!.correctPeriod).not.toBe(c.correctPeriod);
      if (c.type === 'read-schedule') expect(s!.schedule!.map(r => r.time)).not.toContain(c.targetTime);
    }
  });
  it('ordering cards are hours apart; the clock cards are whole hours in one half of the day', async () => {
    for (const [, c] of await ITEMS()) {
      if (c.type !== 'sequence-events' && c.type !== 'clock-sequence') continue;
      const s = practiceItem(c)!, f = s.events!.map(e => e.dayFraction!);
      for (let i = 1; i < f.length; i++) expect(f[i] - f[i - 1]).toBeGreaterThanOrEqual(1.5 / 24 - 1e-9);
      if (c.type === 'clock-sequence') expect(s.events!.every(e => /PM$/.test(e.typicalTime!))).toBe(true);
    }
  });
  it('the leak check refuses the learner\'s own activity, the same id, and the same time of day', () => {
    const c: TimeSequencerChallenge = { id: 't', type: 'match-time-of-day', instruction: '', correctPeriod: 'night',
      event: { id: 'e', label: 'Go to sleep', emoji: '' } };
    expect(practiceLeaks(c, { ...c, id: 't~smaller' })).toBe(true);
    expect(practiceLeaks(c, { ...c, id: 't~smaller', event: { id: 'p', label: 'Wake up', emoji: '' } })).toBe(true);
    expect(practiceLeaks(c, { ...c, id: 't~smaller', event: { id: 'p', label: 'Wake up', emoji: '' }, correctPeriod: 'morning' })).toBe(false);
  });
});

describe('levers and their facts', () => {
  it('no lever text or pulled-lever fact names the item\'s key or its activities', async () => {
    for (const [mode, c] of await ITEMS()) {
      const levers = timeSequencerLevers(c, []);
      const facts = leverFacts(c, levers.map(l => l.id));
      for (const k of [...keyTexts(c), ...itemLabels(c)]) {
        for (const l of levers) expect(`${l.when} ${l.does}`.toLowerCase(), `${mode} ${c.id} ${l.id}`).not.toContain(k.toLowerCase());
        expect(facts.toLowerCase(), `${mode} ${c.id}`).not.toContain(k.toLowerCase());
      }
      if (c.type === 'match-time-of-day') for (const p of PERIODS) expect(facts.toLowerCase()).not.toContain(p);
      // The scene with every lever pulled still names no clock hour or order.
      expect(JSON.stringify(workspaceScene(c, EMPTY_TIME_VIEW))).not.toMatch(/correct|clockHour/);
    }
  });
  it('declares a help and a simplify lever per mode; the sky strip never on clock-sequence, and pulled when the tier shows it', async () => {
    const want: Record<string, string[]> = {
      'sequence-3': [SKY_STRIP_LEVER, FAR_APART_LEVER], 'sequence-5': [SKY_STRIP_LEVER, FAR_APART_LEVER],
      'clock-sequence': [FACE_NUMBERS_LEVER, FAR_APART_LEVER], 'time-of-day': [DAY_ANCHORS_LEVER, TWO_CHOICES_LEVER],
      'before-after': [RELATION_MODEL_LEVER, TWO_CARDS_LEVER], 'duration-compare': [DURATION_MODEL_LEVER, FAR_PAIR_LEVER],
      'read-schedule': [OPTION_PICTURES_LEVER, SHORT_SCHEDULE_LEVER],
    };
    for (const [mode, c] of await ITEMS()) {
      expect(timeSequencerLevers(c, []).map(l => [l.id, l.kind]), `${mode} ${c.id}`)
        .toEqual(want[mode].map((id, i) => [id, i ? 'simplify' : 'help']));
      if (c.type === 'sequence-events') expect(timeSequencerLevers({ ...c, showSkyCue: true }, [])[0]).toMatchObject({ pulled: true });
    }
    expect(timeSequencerLevers(practiceItem((await load('sequence-3')).data.challenges[0]), [])).toEqual([]);
  });
});

describe('this wrong answer, then this lever', () => {
  const seq: TimeSequencerChallenge = { id: 's', type: 'sequence-events', instruction: '', correctOrder: ['a', 'b', 'c', 'd'],
    events: ['Wake up', 'Eat breakfast', 'Brush teeth', 'Catch the bus'].map((label, i) => ({ id: 'abcd'[i], label, emoji: '', dayFraction: 0.29 + i / 100 })) };
  it.each([
    [['d', 'c', 'b', 'a'], 'reversed'], [['b', 'a', 'c', 'd'], 'swapped_pair'], [['c', 'a', 'd', 'b'], 'wrong_first'], [['a', 'c', 'd', 'b'], 'out_of_order'],
  ] as const)('ordering %o → %s → sky strip, then far-apart cards', (order, miss) => {
    expect(timeSequencerMiss(seq, { ...EMPTY_TIME_VIEW, order })).toBe(miss);
    expect(nextLever(timeSequencerLevers(seq, []), miss)).toBe(SKY_STRIP_LEVER);
    expect(nextLever(timeSequencerLevers(seq, [SKY_STRIP_LEVER]), miss)).toBe(FAR_APART_LEVER);
  });
  it('the other modes: help first, then simplify; missed_same is declared by the bar model only', async () => {
    for (const [mode, c] of await ITEMS()) {
      const tw = getComponentById('time-sequencer')!.teachingWorkspace!;
      const levers = timeSequencerLevers(c, []);
      for (const m of tw.misses![mode]) {
        expect(nextLever(levers, m), `${mode} ${c.id} ${m}`).toBe(levers[0].id);
        const second = nextLever(timeSequencerLevers(c, [levers[0].id]), m);
        expect(second, `${mode} ${m}`).toBe(levers[1].id);
        // missed_same is answered by the bar model only; after it, the far pair comes as the next open lever.
        if (m === 'missed_same') expect(levers[1].answers).not.toContain(m);
      }
    }
  });
  it('every miss the catalog lists for a mode is answered by a lever on every saved payload item (J12)', async () => {
    const tw = getComponentById('time-sequencer')!.teachingWorkspace!;
    expect(tw.levers).toBe(true);
    for (const [mode, c] of await ITEMS()) {
      const levers = timeSequencerLevers(c, []);
      for (const m of tw.misses![mode]) expect(levers.some(l => l.answers?.includes(m)), `${mode} ${c.id} ${m}`).toBe(true);
    }
    expect(tw.unanswered ?? {}).toEqual({});
  });
});
