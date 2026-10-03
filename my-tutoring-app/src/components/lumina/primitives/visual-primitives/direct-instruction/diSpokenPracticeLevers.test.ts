import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { DI_CATALOG } from '../../../service/manifest/catalog/di';
import { findChoiceMenuDefects, type SpokenPracticeItem } from './diSpokenPracticeScript';
import { spokenPracticeSpokenMisses } from './diSpokenPracticeWorkspace';
import { EASIER_ITEM, FAR_PAIR, FIVE_ROWS, MODEL_ANSWER, MODEL_COUNT, MODEL_EXPLAIN, MODEL_READ, SHORT_WORD, SMALLER_GROUP, SOUND_DOTS,
  TOUCH_MARKS, WORD_MODEL, WORD_UNDERLINE, answerModelFor, countModelFor, easierItemFor, farPairFor, readModelFor, shortWordFor,
  smallerGroupFor, spareLeaks, spokenLeverFacts, spokenLevers, startingLevers, wordModelFor } from './diSpokenPracticeLevers';
import countP from '../../../components/live-activity/runtime/testing/w1-payloads/di-spoken-practice.count_and_say.json';
import compareP from '../../../components/live-activity/runtime/testing/w1-payloads/di-spoken-practice.compare_choice.json';
import readP from '../../../components/live-activity/runtime/testing/w1-payloads/di-spoken-practice.read_aloud.json';
import sayP from '../../../components/live-activity/runtime/testing/w1-payloads/di-spoken-practice.say_answer.json';
import explainP from '../../../components/live-activity/runtime/testing/w1-payloads/di-spoken-practice.explain_concept.json';

type Payload = { data: { items: SpokenPracticeItem[]; spares?: SpokenPracticeItem[] } };
const SAVED = ([countP, compareP, readP, sayP, explainP] as unknown as Payload[]).map(p => ({ items: p.data.items, spares: p.data.spares ?? [] }));
const [COUNT, COMPARE, READ, SAY, EXPLAIN] = SAVED;
const CATALOG = DI_CATALOG.find(c => c.id === 'di-spoken-practice')!.teachingWorkspace!;
const withCount = (n: number, id = `c${n}`): SpokenPracticeItem => ({ ...COUNT.items[0], id, stimulusCount: n });
const printed = (text: string, id = text): SpokenPracticeItem => ({ ...READ.items[0], id, stimulusText: text, expectedAnswer: text });

describe('count_and_say', () => {
  it('model_count: a different picture, a count more than one away and no count still to come', () => {
    for (let n = 1; n <= 10; n++) {
      const it0 = withCount(n);
      const m = countModelFor(it0, [it0])!;
      expect(m, String(n)).not.toBeNull();
      expect(Math.abs(m.count - n)).toBeGreaterThan(1);
      expect(m.emoji).not.toBe(it0.stimulusEmoji);
    }
    const [a, b] = [withCount(4, 'a'), withCount(6, 'b')];
    expect(countModelFor(a, [a, b])!.count).not.toBe(6);
  });

  it('smaller_group: about half, at least 2, never the item\'s count; none below 4', () => {
    expect(smallerGroupFor(withCount(9), [withCount(9)])!.stimulusCount).toBe(4);
    expect(smallerGroupFor(withCount(3), [withCount(3)])).toBeNull();
    const easier = smallerGroupFor(withCount(6), [withCount(6)])!;
    expect([easier.id, easier.expectedAnswer]).toEqual(['c6~simpler', 'three']);
  });

  it('five_rows only above five', () => {
    expect(spokenLevers(withCount(5), [], [withCount(5)], []).map(l => l.id)).not.toContain(FIVE_ROWS);
    expect(spokenLevers(withCount(8), [], [withCount(8)], []).map(l => l.id)).toContain(FIVE_ROWS);
  });
});

describe('compare_choice (R1: one model pair per menu word)', () => {
  it('word_model has a pair for every menu word, in order, and uses no session thing', () => {
    for (const it0 of COMPARE.items) {
      const pairs = wordModelFor(it0, COMPARE.items)!;
      expect(pairs.map(p => p.word)).toEqual(it0.choices);
      const things = COMPARE.items.flatMap(i => [i.stimulusText, i.stimulusText2 ?? '']);
      for (const p of pairs) expect(things).not.toContain(p.a[0]);
    }
  });

  it('far_pair: the OTHER word, a valid menu item, never for "same"', () => {
    for (const it0 of COMPARE.items) {
      const easier = farPairFor(it0, COMPARE.items)!;
      expect(easier.expectedAnswer).not.toBe(it0.expectedAnswer);
      expect(findChoiceMenuDefects([easier])).toEqual([]);
    }
    expect(farPairFor({ ...COMPARE.items[0], expectedAnswer: 'same', choices: ['longer', 'shorter', 'same'] }, COMPARE.items)).toBeNull();
  });

  it.each([['longer', 'shorter'], ['taller', 'shorter'], ['bigger', 'smaller'], ['heavier', 'lighter'], ['faster', 'slower'], ['hotter', 'colder']])(
    'every %s/%s far pair passes the menu gate, for both answers', (w1, w2) => {
      for (const answer of [w1, w2]) {
        const it0 = { ...COMPARE.items[0], id: 'x', stimulusText: 'a box', stimulusText2: 'a cup', choices: [w1, w2], expectedAnswer: answer };
        const easier = farPairFor(it0, [it0])!;
        expect(easier.expectedAnswer).toBe(answer === w1 ? w2 : w1);
        expect(findChoiceMenuDefects([easier])).toEqual([]);
        expect(wordModelFor(it0, [it0])!.map(p => p.word)).toEqual([w1, w2]);
      }
    });
});

describe('read_aloud', () => {
  it('model_read: a word sharing no letter with the print, or a numeral sharing no digit; never a session word', () => {
    for (const it0 of READ.items) {
      const m = readModelFor(it0, READ.items)!;
      expect(m.split('').some(ch => it0.stimulusText.includes(ch))).toBe(false);
      expect(READ.items.map(i => i.stimulusText)).not.toContain(m);
    }
    expect(readModelFor(printed('12'), [printed('12')])!.split('').some(d => '12'.includes(d))).toBe(false);
  });

  it('short_word: refused on one CVC word or one digit; a shorter word otherwise', () => {
    expect(shortWordFor(printed('cat'), [printed('cat')])).toBeNull();
    expect(shortWordFor(printed('7'), [printed('7')])).toBeNull();
    expect(shortWordFor(printed('the big dog'), [printed('the big dog')])!.stimulusText).toHaveLength(3);
    expect(shortWordFor(printed('15'), [printed('15')])!.stimulusText).toHaveLength(1);
  });

  it('word_underline only on two or more words', () => {
    expect(spokenLevers(printed('cat'), [], [printed('cat')], []).map(l => l.id)).not.toContain(WORD_UNDERLINE);
    expect(spokenLevers(printed('a red hat'), [], [printed('a red hat')], []).map(l => l.id)).toEqual([MODEL_READ, SOUND_DOTS, WORD_UNDERLINE, SHORT_WORD]);
  });
});

describe('say_answer and explain_concept: the generator\'s spares (R3)', () => {
  it('the saved spares never leak: no session answer or stimulus, never the item\'s answer', () => {
    for (const { items, spares } of [SAY, EXPLAIN]) for (const it0 of items) {
      const model = answerModelFor(it0, items, spares);
      expect(model, it0.id).not.toBeNull();
      expect(spareLeaks(model!, it0, items)).toBe(false);
      expect(model!.easier).toBeFalsy();
      const easier = easierItemFor(it0, items, spares)!;
      expect(easier.id).toBe(`${it0.id}~simpler`);
    }
  });

  it('a spare with the item\'s answer, or (explain) its concept, is refused', () => {
    const it0 = SAY.items[0];
    expect(spareLeaks({ ...SAY.spares[0], expectedAnswer: it0.expectedAnswer }, it0, SAY.items)).toBe(true);
    const ex = EXPLAIN.items[0];
    expect(spareLeaks({ ...EXPLAIN.spares[0], conceptStatement: ex.conceptStatement }, ex, EXPLAIN.items)).toBe(true);
  });

  it('with no spares there is no model and no easier item', () => {
    expect(spokenLevers(SAY.items[0], [], SAY.items, []).map(l => l.id)).toEqual([]);
  });
});

describe('starting positions and which lever answers which miss', () => {
  it('easy (or no tier) starts with the mode\'s model; hard with nothing', () => {
    expect(startingLevers(withCount(6), [withCount(6)], [])).toEqual([MODEL_COUNT]);
    expect(startingLevers({ ...withCount(6), supportTier: 'hard' }, [withCount(6)], [])).toEqual([]);
    expect(startingLevers(COMPARE.items[0], COMPARE.items, [])).toEqual([WORD_MODEL]);
    expect(startingLevers(EXPLAIN.items[0], EXPLAIN.items, EXPLAIN.spares)).toEqual([MODEL_EXPLAIN]);
  });

  it.each([
    ['skipped_a_number', [MODEL_COUNT], TOUCH_MARKS],
    ['short_by_more', [MODEL_COUNT, TOUCH_MARKS], FIVE_ROWS],
    ['one_over', [MODEL_COUNT, TOUCH_MARKS, FIVE_ROWS], SMALLER_GROUP],
  ] as const)('count of 8: %s with %j → %s', (miss, pulled, expected) => {
    expect(nextLever(spokenLevers(withCount(8), pulled, [withCount(8)], []), miss)).toBe(expected);
  });

  it('compare: the model first, then far_pair; say: the model, then the easier item', () => {
    expect(nextLever(spokenLevers(COMPARE.items[0], [], COMPARE.items, []), 'other_menu_word')).toBe(WORD_MODEL);
    expect(nextLever(spokenLevers(COMPARE.items[0], [WORD_MODEL], COMPARE.items, []), 'other_menu_word')).toBe(FAR_PAIR);
    expect(nextLever(spokenLevers(SAY.items[0], [MODEL_ANSWER], SAY.items, SAY.spares), 'said_stimulus')).toBe(EASIER_ITEM);
  });

  it('every catalog miss is answered on every saved payload, every named miss is listed, and no fact says the answer', () => {
    for (const { items, spares } of SAVED) {
      const mode = items[0].mode;
      const answered = new Set(items.flatMap(i => spokenLevers(i, [], items, spares).flatMap(l => l.answers ?? [])));
      for (const miss of CATALOG.misses![mode]) expect(answered.has(miss), `${mode}: ${miss}`).toBe(true);
      for (const i of items) {
        for (const m of spokenPracticeSpokenMisses(i)) expect(CATALOG.misses![mode], `${i.id} ${m.id}`).toContain(m.id);
        const fact = spokenLeverFacts(i, spokenLevers(i, [], items, spares).map(l => l.id), items, spares);
        if (mode !== 'compare_choice') expect(fact.toLowerCase(), i.id).not.toContain(`"${i.expectedAnswer.toLowerCase()}"`);
      }
    }
  });
});
