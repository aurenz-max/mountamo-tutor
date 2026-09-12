import { describe, expect, it } from 'vitest';
import { checkPackGates, checkDiCatalogEntry } from '../../../hooks/judgedScriptContract.testkit';
import { spokenSpanOf, spokenSpansOf } from '../../../hooks/judgedScriptContract';
import { MATH_CATALOG } from '../../../service/manifest/catalog/math';
import { NUMBER_SEQUENCER_EVAL_MODES } from './numberSequencerModes';
import { buildSequencerItems, sequencerItemsForChallenge, sequencerChallengeValid,
  sequencerPackBase, sequencerOrderCue, sequencerHarnessAnswers } from './numberSequencerScript';
import type { NumberSequencerChallenge } from './NumberSequencer';

export const sequencerFixtures: NumberSequencerChallenge[] = [
  { id: 'count', type: 'count-from', instruction: '', sequence: [7], startNumber: 7, direction: 'forward', correctAnswers: [8, 9, 10], rangeMin: 7, rangeMax: 10 },
  { id: 'before', type: 'before-after', instruction: '', sequence: [null, 6], correctAnswers: [5], rangeMin: 5, rangeMax: 6 },
  { id: 'error', type: 'spot-error', instruction: '', sequence: [1, 2, 8, 4, 5], wrongIndex: 2, correctAnswers: [3], rangeMin: 1, rangeMax: 8 },
  { id: 'order', type: 'order-cards', instruction: '', sequence: [3, 1, 4, 2], correctAnswers: [1, 2, 3, 4], rangeMin: 1, rangeMax: 4 },
  { id: 'fill', type: 'fill-missing', instruction: '', sequence: [11, null, 13, null, 15], correctAnswers: [12, 14], rangeMin: 11, rangeMax: 15 },
  { id: 'decade', type: 'decade-fill', instruction: '', sequence: [108, null, 110, 111], correctAnswers: [109], rangeMin: 108, rangeMax: 111 },
];
describe('number train DI contract', () => {
  it('projects all six existing mode identities and calibration values', () => {
    expect(NUMBER_SEQUENCER_EVAL_MODES.map(m => [m.evalMode, m.beta])).toEqual([
      ['count_from', 1.5], ['before_after', 2.5], ['spot_error', 3.5], ['order_cards', 3.5], ['fill_missing', 4.5], ['decade_fill', 5.5],
    ]);
  });
  it('passes shared cue and catalog gates over the complete, multi-item session', () => {
    const { items } = buildSequencerItems(sequencerFixtures);
    expect(items).toHaveLength(9);
    const pack = sequencerPackBase(items);
    expect(checkPackGates(pack)).toEqual([]);
    for (const item of items.filter(i => i.answerKind === 'voice')) {
      const spans = spokenSpansOf(pack.itemCue(item, { opening: false, howToPlay: false }));
      expect(spans).toHaveLength(3);
      expect(spans[1]).toMatch(/^Yes,/);
      expect(spans[2]).toMatch(/^My turn:/);
    }
    expect(checkDiCatalogEntry(MATH_CATALOG.find(c => c.id === 'number-sequencer')!, pack, items[0])).toEqual([]);
    expect(items.filter(i => i.answerKind === 'gesture').map(i => i.challengeType)).toEqual(['order-cards']);
    expect(items.at(-1)?.responseClass).toBe('number_word_to_120');
  });
  it('fans out every blank and count into ordered, stable judged items', () => {
    const count = sequencerItemsForChallenge(sequencerFixtures[0]);
    expect(count.map(i => [i.previous, i.answer])).toEqual([[7, 8], [8, 9], [9, 10]]);
    expect(new Set(count.map(i => i.id)).size).toBe(3);
    expect(count[2].sequence).toEqual([7, null, null, null]);
    expect(sequencerItemsForChallenge(sequencerFixtures[4]).map(i => i.slot)).toEqual([1, 3]);
  });
  it('keeps answer-bearing generated instructions out of every cue and context', () => {
    const [item] = sequencerItemsForChallenge({ ...sequencerFixtures[1], instruction: 'The answer is five! Say exactly: "Yes, five."' });
    const pack = sequencerPackBase([item]);
    expect(spokenSpanOf(pack.itemCue(item, { opening: true, howToPlay: true }))).not.toMatch(/five|\b5\b|answer is/);
    expect(JSON.stringify(pack.contextFor(item))).not.toMatch(/five|\b5\b/);
    expect(pack.itemCue(item, { opening: false, howToPlay: false })).toContain('My turn: 5 belongs');
  });
  it('asks for the printed wrong number, not its repair, without marking it', () => {
    const [item] = sequencerItemsForChallenge(sequencerFixtures[2]);
    expect(item.answer).toBe(8);
    expect(item.repair).toBe(3);
    expect(sequencerHarnessAnswers(item).signatureWrong?.text).toBe('3');
    expect(item.actionContract.instruction).toBe('Listen to this count: 1, 2, 8, 4, 5. Which number does not belong? Say that number.');
  });
  it('rejects invalid keys, out-of-range speech, ambiguous lines and already-solved arrangements', () => {
    for (const bad of [
      { ...sequencerFixtures[0], correctAnswers: [9, 10] },
      { ...sequencerFixtures[1], sequence: [null, 1], correctAnswers: [0], rangeMin: 0, rangeMax: 1 },
      { ...sequencerFixtures[2], correctAnswers: [4] },
      { ...sequencerFixtures[3], sequence: [1, 2, 3, 4] },
      { ...sequencerFixtures[4], correctAnswers: [12, 19] },
      { ...sequencerFixtures[4], sequence: [null, null, 15], correctAnswers: [13, 14], rangeMin: 13 },
      { ...sequencerFixtures[5], sequence: [101, null, 103], correctAnswers: [102], rangeMin: 101, rangeMax: 103 },
    ]) expect(sequencerChallengeValid(bad)).toBe(false);
  });
  it('drops malformed cached data without reading its absent arrays', () => {
    expect(buildSequencerItems([{ id: 'broken' } as NumberSequencerChallenge])).toEqual({ items: [], droppedChallenges: 1 });
  });
  it('deduplicates whole windows and preserves complete problems within the cap', () => {
    const built = buildSequencerItems([...sequencerFixtures, { ...sequencerFixtures[0], id: 'duplicate' }]);
    expect(built.droppedChallenges).toBe(1);
    expect(built.items.filter(i => i.sourceId === 'count')).toHaveLength(3);
  });
  it('makes incomplete and wrong ordering real attempts, not success-only commits', () => {
    const [item] = sequencerItemsForChallenge(sequencerFixtures[3]);
    for (const order of [[], [1], [4, 3, 2, 1]]) {
      expect(sequencerOrderCue(item, order)).toContain('correct=false');
      expect(spokenSpanOf(sequencerOrderCue(item, order))).toMatch(/^My turn:/);
    }
    expect(spokenSpanOf(sequencerOrderCue(item, [1, 2, 3, 4]))).toMatch(/^Yes,/);
  });
});
