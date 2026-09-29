/**
 * The compare-objects spoken-mode levers (handoff 23 step 2): which lever answers which miss, each lever's leak rule on
 * the saved payloads, and the easier items over many generated shapes.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { getComponentById } from '../../../service/manifest/catalog';
import type { CompareObjectsChallenge } from './CompareObjects';
import { ATTRIBUTE_CHILD_FORM, buildCompareItems, type CompareObjectsItem } from './compareObjectsScript';
import { compareObjectsSpokenMisses } from './compareObjectsWorkspace';
import { FAR_PAIR_LEVER, FEWER_CHOICES_LEVER, FIVE_MARKS_LEVER, MENU_LEVER, SHORTER_LEVER, TAP_BOXES_LEVER, WORD_MODEL_LEVER,
  compareObjectsSpokenLevers, droppedChoice, farPair, shorterMeasure, spokenLeverFacts, wordModel } from './compareObjectsSpokenLevers';

const MODES = ['compare_two', 'identify_attribute', 'non_standard'] as const;
const payload = (mode: string) => JSON.parse(readFileSync(join(__dirname,
  `../../../components/live-activity/runtime/testing/w1-payloads/compare-objects.${mode}.json`), 'utf8')).data;
const saved = (mode: string) => {
  const data = payload(mode);
  const items = buildCompareItems(data.challenges, { band: data.gradeBand ?? 'K' }).items;
  const byId = new Map<string, CompareObjectsChallenge>(data.challenges.map((c: CompareObjectsChallenge) => [c.id, c]));
  return items.map(item => ({ item, challenge: byId.get(item.id)!, session: items }));
};
const obj = (name: string, visualSize: number) => ({ name, visualSize, actualValue: visualSize });
const two = (word: CompareObjectsChallenge['comparisonWord'], attribute: CompareObjectsChallenge['attribute'], a: number, b: number,
  names = ['pencil', 'crayon']): { item: CompareObjectsItem; challenge: CompareObjectsChallenge } => {
  const objects = [obj(names[0], a), obj(names[1], b)];
  const greater = ['longer', 'taller', 'heavier', 'holds_more'].includes(word);
  const winner = (greater ? a > b : a < b) ? names[0] : names[1];
  const challenge = { id: `c-${word}-${a}-${b}`, type: 'compare_two', instruction: '', hint: '', attribute, comparisonWord: word,
    objects, correctAnswer: winner } as CompareObjectsChallenge;
  return { item: buildCompareItems([challenge], { band: '1' }).items[0], challenge };
};
const measure = (unitCount: number, id = `n${unitCount}`) => {
  const challenge = { id, type: 'non_standard', instruction: '', hint: '', attribute: 'length', comparisonWord: 'longer',
    objects: [obj('shoe', unitCount * 10)], unitName: 'cube', unitCount, correctAnswer: String(unitCount) } as CompareObjectsChallenge;
  return { item: buildCompareItems([challenge], { band: '1' }).items[0], challenge };
};
const ids = (levers: { id: string }[]) => levers.map(l => l.id);

describe('which lever answers which miss', () => {
  it.each([
    [two('longer', 'length', 60, 50), 'other_object', [], WORD_MODEL_LEVER],
    [two('longer', 'length', 60, 50), 'other_object', [WORD_MODEL_LEVER], FAR_PAIR_LEVER],
    [measure(8), 'one_over', [], TAP_BOXES_LEVER],
    [measure(8), 'short_by_more', [], FIVE_MARKS_LEVER],
    [measure(8), 'over_by_more', [FIVE_MARKS_LEVER], SHORTER_LEVER],
  ] as const)('%#: after %s', ({ item, challenge }, miss, pulled, lever) => {
    expect(nextLever(compareObjectsSpokenLevers(item, challenge, pulled, []), miss)).toBe(lever);
  });
  it('identify_attribute: pictures first, then one wrong choice greyed out', () => {
    const { item, challenge } = saved('identify_attribute')[0];
    expect(nextLever(compareObjectsSpokenLevers(item, challenge, [], []), 'other_attribute')).toBe(MENU_LEVER);
    expect(nextLever(compareObjectsSpokenLevers(item, challenge, [MENU_LEVER], []), 'other_attribute')).toBe(FEWER_CHOICES_LEVER);
  });
  it('far pairs get no simplify; five boxes or fewer get no five_marks; order_three gets no spoken levers', () => {
    expect(ids(compareObjectsSpokenLevers(two('longer', 'length', 90, 30).item, two('longer', 'length', 90, 30).challenge, [], [])))
      .toEqual([WORD_MODEL_LEVER]);
    expect(ids(compareObjectsSpokenLevers(measure(5).item, measure(5).challenge, [], []))).not.toContain(FIVE_MARKS_LEVER);
    const order = payload('order_three');
    const items = buildCompareItems(order.challenges, { band: '1' }).items;
    expect(compareObjectsSpokenLevers(items[0], order.challenges[0], [], items)).toEqual([]);
  });
  it("on every saved payload, the levers answer only the mode's catalog misses, and every miss is answered", () => {
    const entry = getComponentById('compare-objects')!.teachingWorkspace!;
    for (const mode of MODES) {
      const answered = new Set(saved(mode).flatMap(s => compareObjectsSpokenLevers(s.item, s.challenge, [], s.session))
        .flatMap(l => l.answers ?? []));
      answered.forEach(m => expect(entry.misses![mode], mode).toContain(m));
      expect(entry.misses![mode].filter(m => !answered.has(m)), mode).toEqual(entry.unanswered?.[mode] ?? []);
    }
  });
});

describe('leak rules', () => {
  it('word_model is fixed per word: the same model whichever object wins or wherever it is drawn', () => {
    const a = two('longer', 'length', 60, 50), b = two('longer', 'length', 50, 60);
    expect(a.item.answerNames[0]).toBe('pencil');
    expect(b.item.answerNames[0]).toBe('crayon');
    expect(wordModel(a.item.comparisonWord)).toEqual(wordModel(b.item.comparisonWord));
    expect(wordModel('longer').glow).not.toBe(wordModel('shorter').glow);
  });
  it('no scene fact names an object, a count or a digit; identify names every choice left, never one alone', () => {
    for (const mode of MODES) for (const { item, challenge, session } of saved(mode)) {
      const all = compareObjectsSpokenLevers(item, challenge, [], session).map(l => l.id);
      const fact = spokenLeverFacts(item, all);
      expect(fact, item.id).not.toMatch(/\d/);
      for (const name of item.objectNames) expect(fact, item.id).not.toContain(name);
      if (item.kind === 'identify_attribute') {
        const left = item.attributeOptions.filter(a => a !== droppedChoice(item));
        for (const a of left) expect(fact).toContain(ATTRIBUTE_CHILD_FORM[a]);
        expect(left).toContain(item.attribute);
      }
    }
  });
  it('fewer_choices never greys out the answer, and only on a menu of three or more', () => {
    for (const { item } of saved('identify_attribute')) {
      const dropped = droppedChoice(item);
      if (item.attributeOptions.length < 3) expect(dropped).toBeNull();
      else expect(dropped).not.toBe(item.attribute);
    }
  });
});

describe('the easier items', () => {
  it('far_pair: same kind, attribute and word, no name of the item, sizes far apart, answer recomputed', () => {
    let built = 0;
    for (const [word, attribute] of [['longer', 'length'], ['shorter', 'length'], ['taller', 'height'], ['shorter_height', 'height'],
      ['heavier', 'weight'], ['lighter', 'weight'], ['holds_more', 'capacity'], ['holds_less', 'capacity']] as const)
      for (let a = 20; a <= 90; a += 7) for (const d of [-20, -9, 5, 12, 24]) {
        const b = a + d;
        if (b < 10 || b > 100) continue;
        const source = two(word, attribute, a, b, ['blue ribbon', 'pink cup']);
        if (!source.item) continue;
        const easier = farPair(source.item, source.challenge);
        expect(easier, `${word} ${a}/${b}`).not.toBeNull();
        built++;
        const p = easier!.item;
        expect([p.kind, p.attribute, p.comparisonWord, p.id]).toEqual(['compare_two', attribute, word, `${source.item.id}~simpler`]);
        expect(p.objectNames.filter(n => source.item.objectNames.includes(n))).toEqual([]);
        const [x, y] = easier!.challenge.objects;
        expect(Math.abs(x.visualSize - y.visualSize)).toBeGreaterThanOrEqual(50);
        expect(compareObjectsSpokenMisses(p).map(m => m.id)).toEqual(['other_object']);
      }
    expect(built).toBeGreaterThan(100);
  });
  it('shorter_measure: same unit, at most half the boxes and two or more, a count no session item has when one is free', () => {
    let built = 0;
    for (let n = 2; n <= 20; n++) {
      const source = measure(n);
      const other = measure(Math.ceil(n / 2), 'other').item;
      const easier = shorterMeasure(source.item, source.challenge, [other]);
      if (n < 3) { expect(easier).toBeNull(); continue; }
      expect(easier, String(n)).not.toBeNull();
      built++;
      const p = easier!.item;
      expect([p.kind, p.unitName, p.id]).toEqual(['non_standard', 'cube', `${source.item.id}~simpler`]);
      expect(p.unitCount).toBeGreaterThanOrEqual(2);
      expect(p.unitCount).toBeLessThanOrEqual(Math.ceil(n / 2));
      expect(p.unitCount).not.toBe(n);
      expect(p.objectNames[0]).not.toBe(source.item.objectNames[0]);
      if (p.unitCount === other.unitCount) expect(shorterMeasure(source.item, source.challenge, [])!.item.unitCount).toBe(other.unitCount);
      if (n >= 6) expect(p.unitCount).not.toBe(other.unitCount);
    }
    expect(built).toBe(18);
  });
});
