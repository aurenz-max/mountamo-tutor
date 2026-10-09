/**
 * length-lab levers: leak rules per mode, the simplify builders over every item shape the generator draws, and
 * "this wrong answer, then this lever" as code.
 */
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { getComponentById } from '../../../service/manifest/catalog';
import type { LengthLabChallenge } from './LengthLab';
import {
  CHAIN_MODEL_LEVER, END_LINES_LEVER, FAR_PAIR_LEVER, FAR_THREE_LEVER, ORDER_STEPS_LEVER, OUTLINE_LEVER, SHORTER_LEVER,
  UNIT_MARKS_LEVER, UNIT_MODEL_LEVER, WORD_MODEL_LEVER, farPair, farThree, lengthLabLevers, leverFacts, leverTextLeaks,
  shorterObject, simplerLength, simplerLeaks,
} from './lengthLabLevers';
import { lengthLabMatches, lengthMiss, type LengthView } from './lengthLabWorkspace';

type Mode = LengthLabChallenge['type'];
const MODES: Mode[] = ['compare', 'estimate_then_tile', 'two_unit_compare', 'tile_and_count', 'order', 'indirect'];
const NAMES = ['crayon', 'pencil', 'straw', 'toothbrush', 'fork', 'paintbrush', 'ribbon', 'stick'];
const base = { hint: '', narration: '', objectColor0: '#f00', objectColor1: '#0f0', instruction: 'Do it.' };

/** Every item shape the generator draws, per mode (objects 1-12 units). */
function items(mode: Mode): LengthLabChallenge[] {
  const out: LengthLabChallenge[] = [];
  let k = 0;
  const name = (i: number) => NAMES[i % NAMES.length];
  if (mode === 'compare') for (let a = 1; a <= 12; a++) for (let b = 1; b <= 12; b++) out.push({ ...base, id: `c${k++}`, type: mode,
    objectName0: name(a), objectLength0: a, objectName1: name(a + 1), objectLength1: b,
    correctAnswer: a > b ? 'longer' : a < b ? 'shorter' : 'same' });
  if (mode === 'tile_and_count' || mode === 'estimate_then_tile') for (let n = 1; n <= 12; n++) out.push({ ...base, id: `t${k++}`,
    type: mode, objectName0: name(n), objectLength0: n, objectName1: 'placeholder', objectLength1: 1, correctAnswer: String(n),
    correctUnitCount: n, unitType: n % 2 ? 'feet' : 'cubes', estimateOptions: [Math.max(1, n - 1), n, n + 1, n + 2] });
  if (mode === 'two_unit_compare') for (const [l, b] of [[4, 2], [6, 2], [6, 3], [8, 4], [8, 2], [10, 5], [12, 4], [12, 6]]) for (const units of
    [['cubes', 'bears'], ['paper_clips', 'erasers'], ['fingers', 'hands']]) out.push({ ...base, id: `u${k++}`, type: mode,
    objectName0: name(l), objectLength0: l, objectName1: 'placeholder', objectLength1: 1, correctAnswer: units[0],
    unitType: units[0], correctUnitCount: l, unitTypeB: units[1], correctUnitCountB: b });
  if (mode === 'order') for (let a = 1; a <= 10; a++) for (let b = a + 1; b <= 11; b++) for (let c = b + 1; c <= 12; c++) {
    const objs = [{ n: 'crayon', l: b }, { n: 'pencil', l: c }, { n: 'straw', l: a }];
    const csv = [...objs].sort((x, y) => x.l - y.l).map(o => o.n).join(',');
    out.push({ ...base, id: `o${k++}`, type: mode, objectName0: 'crayon', objectLength0: b, objectName1: 'pencil', objectLength1: c,
      objectName2: 'straw', objectLength2: a, objectColor2: '#00f', correctAnswer: csv, correctOrderCsv: csv });
  }
  if (mode === 'indirect') for (const ans of ['straw', 'fork', 'same']) out.push({ ...base, id: `i${k++}`, type: mode,
    objectName0: 'fork', objectLength0: 4, objectName1: 'straw', objectLength1: 7, correctAnswer: ans,
    clue0: 'The fork is shorter than the paintbrush.', clue1: 'The paintbrush is shorter than the straw.',
    referenceObjectName: 'paintbrush', referenceObjectLength: 6 });
  return out;
}

const view = (c: LengthLabChallenge, over: Partial<LengthView>): LengthView => ({ answer: null, tiles: 0, estimate: null,
  countA: null, countB: null, unitA: c.unitType || 'cubes', unitB: c.unitTypeB || 'cubes', order: [], ticksShown: false,
  fitShown: true, ...over });

describe('simplify builders', () => {
  it.each(MODES)('%s: same mode, its own id, solvable by its own check, never the learner\'s item', mode => {
    let built = 0;
    for (const c of items(mode)) {
      const s = simplerLength(c, 'cubes');
      if (!s) continue;
      built++;
      expect(s.type).toBe(mode);
      expect(s.id).toBe(`${c.id}~simpler`);
      expect(simplerLeaks(c, s, 'cubes'), c.id).toBe(false);
      expect(simplerLength(s)).toBeNull();
      // The practice item's own key passes its own check.
      const key = mode === 'compare' ? view(s, { answer: s.correctAnswer })
        : mode === 'order' ? view(s, { order: s.correctOrderCsv!.split(',') })
        : mode === 'two_unit_compare' ? view(s, { answer: s.unitType })
        : view(s, { tiles: s.correctUnitCount! });
      expect(lengthLabMatches(s, key), s.id).toBe(true);
      if (mode === 'estimate_then_tile') expect(s.estimateOptions).toContain(s.correctUnitCount);
    }
    if (mode === 'indirect') expect(built).toBe(0); else expect(built).toBeGreaterThan(0);
  });
  it('offered only where the item is hard in shape: a close pair, a close order, a long object', () => {
    const c = (a: number, b: number, ans: string) => ({ ...base, id: 'x', type: 'compare' as const, objectName0: 'pencil',
      objectLength0: a, objectName1: 'crayon', objectLength1: b, correctAnswer: ans });
    expect(farPair(c(3, 7, 'shorter'))).toBeNull();
    expect(farPair(c(5, 5, 'same'))).toBeNull();
    expect(farPair(c(6, 5, 'longer'))).toMatchObject({ correctAnswer: 'shorter', objectLength0: 3, objectLength1: 9 });
    const o = items('order');
    expect(farThree(o.find(x => x.objectLength2 === 1 && x.objectLength0 === 5 && x.objectLength1 === 9)!)).toBeNull();
    expect(farThree(o.find(x => x.objectLength2 === 3 && x.objectLength0 === 6 && x.objectLength1 === 7)!)).not.toBeNull();
    const t = items('tile_and_count');
    expect(shorterObject(t[2])).toBeNull();
    expect(shorterObject(t[9])).toMatchObject({ correctUnitCount: 5 });
  });
  it('the leak rule refuses the learner\'s object, its count, a longer object and its units', () => {
    const t = items('tile_and_count')[6];
    expect(simplerLeaks(t, { ...t, id: `${t.id}~simpler` })).toBe(true);
    expect(simplerLeaks(t, { ...shorterObject(t)!, objectName0: t.objectName0 })).toBe(true);
    const u = items('two_unit_compare').find(x => x.objectLength0 === 8)!;
    expect(simplerLeaks(u, { ...shorterObject(u)!, unitType: u.unitType })).toBe(true);
  });
});

describe('leak rules on the help levers', () => {
  it.each(MODES)('%s: no lever text or scene fact carries a digit or an item object\'s name', mode => {
    for (const c of items(mode)) for (const ticksShown of [true, false]) {
      const levers = lengthLabLevers(c, [], { ticksShown });
      expect(levers.length, c.id).toBeGreaterThan(0);
      for (const l of levers) expect(leverTextLeaks(c, `${l.when} ${l.does}`), `${c.id} ${l.id}`).toBe(false);
      const facts = leverFacts(c, levers.map(l => l.id));
      expect(facts.length).toBeGreaterThan(0);
      expect(leverTextLeaks(c, facts), c.id).toBe(false);
    }
  });
  it('unit marks only where the session hides them; models are declared on their modes only', () => {
    const c = items('compare').find(x => x.objectLength0 === 5 && x.objectLength1 === 6)!;
    const ids = (ticksShown: boolean, x = c) => lengthLabLevers(x, [], { ticksShown }).map(l => l.id);
    expect(ids(false)).toEqual([WORD_MODEL_LEVER, END_LINES_LEVER, UNIT_MARKS_LEVER, FAR_PAIR_LEVER]);
    expect(ids(true)).toEqual([WORD_MODEL_LEVER, END_LINES_LEVER, FAR_PAIR_LEVER]);
    expect(ids(false, items('indirect')[0])).toEqual([CHAIN_MODEL_LEVER]);
    expect(ids(false, items('two_unit_compare').find(x => x.objectLength0 === 8)!)).toEqual([UNIT_MODEL_LEVER, SHORTER_LEVER]);
    expect(ids(true, items('tile_and_count')[2])).toEqual([OUTLINE_LEVER]);
  });
});

describe('this wrong answer, then this lever', () => {
  const pick = (mode: Mode, f: (c: LengthLabChallenge) => boolean) => items(mode).find(f)!;
  const close = pick('compare', c => c.objectLength0 === 6 && c.objectLength1 === 5);
  const same = pick('compare', c => c.objectLength0 === 5 && c.objectLength1 === 5);
  const tile = pick('tile_and_count', c => c.objectLength0 === 8);
  const est = pick('estimate_then_tile', c => c.objectLength0 === 8);
  const order = pick('order', c => c.objectLength2 === 3 && c.objectLength0 === 6 && c.objectLength1 === 7);
  it.each([
    ['compare reversed', close, { answer: 'shorter' }, 'reversed', WORD_MODEL_LEVER, UNIT_MARKS_LEVER],
    ['compare said same', close, { answer: 'same' }, 'said_same', WORD_MODEL_LEVER, END_LINES_LEVER],
    ['compare missed same', same, { answer: 'longer' }, 'missed_same', WORD_MODEL_LEVER, END_LINES_LEVER],
    ['tile one over', tile, { tiles: 9 }, 'one_over', OUTLINE_LEVER, null],
    ['tile short', tile, { tiles: 3 }, 'short', OUTLINE_LEVER, SHORTER_LEVER],
    ['estimate to guess', est, { tiles: 6, estimate: 6 }, 'tiled_to_guess', OUTLINE_LEVER, SHORTER_LEVER],
    ['order reversed', order, { order: ['pencil', 'crayon', 'straw'] }, 'reversed_order', ORDER_STEPS_LEVER, null],
    ['order swapped', order, { order: ['straw', 'pencil', 'crayon'] }, 'swapped_pair', END_LINES_LEVER, UNIT_MARKS_LEVER],
  ] as const)('%s → %s, then %s', (_n, c, over, miss, first, second) => {
    expect(lengthMiss(c, view(c, over))).toBe(miss);
    expect(nextLever(lengthLabLevers(c, [], { ticksShown: false }), miss)).toBe(first);
    const after = nextLever(lengthLabLevers(c, [first], { ticksShown: false }), miss);
    if (second) expect(after).toBe(second);
  });
  it('two units and indirect', () => {
    const u = pick('two_unit_compare', c => c.objectLength0 === 8);
    expect(lengthMiss(u, view(u, { answer: u.unitTypeB }))).toBe('chose_bigger_unit');
    expect(nextLever(lengthLabLevers(u, [], { ticksShown: false }), 'chose_bigger_unit')).toBe(UNIT_MODEL_LEVER);
    expect(nextLever(lengthLabLevers(u, [UNIT_MODEL_LEVER], { ticksShown: false }), 'chose_bigger_unit')).toBe(SHORTER_LEVER);
    const i = items('indirect')[0];
    expect(lengthMiss(i, view(i, { answer: 'fork' }))).toBe('chose_shorter');
    expect(nextLever(lengthLabLevers(i, [], { ticksShown: false }), 'chose_shorter')).toBe(CHAIN_MODEL_LEVER);
  });
  it('every catalog miss is answered by a lever on every item, ticks shown or not (J9/J12)', () => {
    const tw = getComponentById('length-lab')!.teachingWorkspace!;
    expect(tw.levers).toBe(true);
    for (const mode of MODES) for (const c of items(mode)) for (const ticksShown of [true, false]) {
      const levers = lengthLabLevers(c, [], { ticksShown });
      for (const m of tw.misses![mode]) expect(levers.some(l => l.answers?.includes(m)), `${mode} ${c.id} ${m}`).toBe(true);
    }
    expect(tw.unanswered).toBeUndefined();
  });
});
