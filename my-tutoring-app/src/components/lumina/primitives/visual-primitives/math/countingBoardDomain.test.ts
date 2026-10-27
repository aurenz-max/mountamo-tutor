import { describe, expect, it } from 'vitest';
import { askLeaks, spokenKeyText } from '../../../components/live-activity/spokenKey';
import { MATH_CATALOG } from '../../../service/manifest/catalog/math';
import {
  ACTION_FOR_KIND, askFor, countedNoun, countingBoardHarnessAnswers, countingBoardSpokenMisses, countingKey, countMiss, countWalk,
  evalModeForKind, howToPlayFor, itemFromChallenge, itemsFromChallenges, numberWordFor, objectSingularFor, objectWordFor,
  responseClassFor, stimulusFor, type CountingChallengeLike, type CountingItem, type CountingItemKind,
} from './countingBoardDomain';
import { countingBoardBoss } from './countingBoard.boss';

const item = (type: CountingItem['kind'], count: number, targetAnswer: number) =>
  itemFromChallenge({ id: `${type}${targetAnswer}`, type, count, targetAnswer }, { objectWord: 'bears' })!;
const give5 = item('give_me_n', 9, 5), hands2 = item('subitize_perceptual', 2, 2), hands1 = item('subitize_perceptual', 1, 1);

it.each([
  [give5, 4, 'one_short'], [give5, 6, 'one_over'], [give5, 2, 'short_by_more'], [give5, 7, 'over_by_more'],
  [give5, 9, 'gave_all'], [give5, 5, undefined], [item('give_me_n', 6, 5), 6, 'one_over'],
  [hands2, 1, 'one_short'], [hands2, 3, 'one_over'], [hands1, 3, 'over_by_more'], [hands2, 2, undefined],
  [item('count_all', 5, 5), 4, undefined],
] as const)('%#: %s committed %i -> %s', (it_, committed, miss) => {
  expect(countMiss(it_, committed)).toBe(miss);
});

const spoken = (type: CountingItem['kind'], count: number, targetAnswer: number, extra: Record<string, unknown> = {}) =>
  itemFromChallenge({ id: `${type}${targetAnswer}`, type, count, targetAnswer, ...extra }, { objectWord: 'bears' })!;

// The spoken items' known wrong answers (handoff 20 Part B): the board's own numbers first, then the off-by misses.
it.each([
  [spoken('count_all', 5, 5), ['skipped_a_number', 'one_short', 'one_over', 'short_by_more', 'over_by_more']],
  [spoken('count_all', 1, 1), ['skipped_a_number', 'one_over', 'over_by_more']],
  [spoken('take_away', 7, 4, { changeBy: 3 }), ['said_start', 'said_change', 'one_short', 'one_over', 'short_by_more', 'over_by_more']],
  [spoken('add_more', 4, 6, { changeBy: 2 }), ['said_start', 'said_change', 'one_short', 'one_over', 'short_by_more', 'over_by_more']],
  [spoken('compare', 9, 6, { compareGroups: [3, 6] }), ['smaller_group', 'said_total', 'one_short', 'one_over', 'short_by_more', 'over_by_more']],
  [spoken('give_me_n', 9, 5), []],
] as const)('%#: spoken misses of %s', (it_, ids) => {
  const misses = countingBoardSpokenMisses(it_);
  expect(misses.map(m => m.id)).toEqual(ids);
  // No listed miss is the key, in any form.
  for (const m of misses) expect(m.examples ?? []).not.toContain(String(it_.target));
  expect(countingBoardBoss.assignment(it_).misses?.map(m => m.id) ?? []).toEqual(ids);
});

// The spoken key (`spokenKeyText` writes it) and the assignment the boss builds from it.
it.each([
  [spoken('count_all', 5, 5), /^"five"\./],
  [spoken('count_on', 8, 8, { startFrom: 5 }), /Five, the number already in the group/],
  [spoken('compare', 9, 6, { compareGroups: [3, 6] }), /smaller group/],
  [spoken('take_away', 7, 4, { changeBy: 3 }), /how many are left/],
  [spoken('recount_moved', 6, 6), /Moving them did not change how many/],
] as const)('%#: a spoken key accepts the count walk and names its fluent miss', (item, pattern) => {
  const key = countingKey(item)!;
  expect([key.answer, key.alsoAccept]).toEqual([numberWordFor(item.target), []]);
  expect(spokenKeyText(key)).toMatch(pattern);
  expect(key.acceptRule).toMatch(/ending on/);
  expect(askLeaks(askFor(item), key)).toEqual([]);
  expect(countingBoardBoss.assignment(item)).toMatchObject({ id: item.id, task: askFor(item), response: 'speech', expectedAnswer: spokenKeyText(key) });
});

it.each([item('give_me_n', 9, 5), hands2, itemFromChallenge({ id: 'b', type: 'build_n', count: 4, targetAnswer: 4 }, { objectWord: 'bears' })!])(
  '%#: an item the board checks has no key, and its assignment carries none to the tutor', it_ => {
    expect(countingKey(it_)).toBeNull();
    expect(countingBoardBoss.assignment(it_)).toEqual({ id: it_.id, task: askFor(it_), response: 'gesture' });
  });

// ── Carried over from the retired scripted-cue test (boss queue 4): the domain half ──

const NUMBER_WORDS = /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|zero)\b/i;
const at = (kind: CountingItemKind, target: number, extra: Partial<CountingItem> = {}): CountingItem => ({
  id: extra.id ?? `${kind}-${target}`, kind, answerKind: kind === 'subitize_perceptual' || kind === 'give_me_n' ? 'gesture' : 'voice',
  responseClass: responseClassFor({ kind, target }), action: kind, objectWord: 'bears', count: extra.count ?? target, target, ...extra,
});
const chOf = (ch: Partial<CountingChallengeLike> & { id: string; type: CountingItemKind }) =>
  itemFromChallenge({ targetAnswer: ch.targetAnswer ?? 5, count: ch.count ?? 5, ...ch }, { objectWord: 'bears' });

describe('number words and response classes', () => {
  it('number words cover the primitive ceiling, and the walk is spelled out', () => {
    expect([1, 15, 20, 21, 30].map(numberWordFor)).toEqual(['one', 'fifteen', 'twenty', 'twenty-one', 'thirty']);
    expect(countWalk(3)).toBe('One, two, three');
  });
  it('response classes split at 20', () => {
    expect(responseClassFor({ kind: 'count_all', target: 20 })).toBe('number_word_to_20');
    expect(responseClassFor({ kind: 'count_all', target: 21 })).toBe('number_word_to_120');
    expect(responseClassFor({ kind: 'subitize_perceptual', target: 2 })).toBe('manipulation');
  });
});

describe('the asks', () => {
  it('count_all hands over without saying the count', () => {
    const ask = askFor(at('count_all', 5));
    expect(ask).toContain('Your turn. How many bears?');
    expect(ask).not.toMatch(/\bfive\b|\d/i);
  });
  it('the one-at-a-time line says the object in the singular', () => {
    expect(howToPlayFor({ ...at('count_all', 5), objectWord: 'butterflies' })).toContain('Touch each butterfly one time');
    expect(objectSingularFor('fish')).toBe('fish');
    expect(objectSingularFor('llamas')).toBe('llamas');
    expect([countedNoun(1, 'bears'), countedNoun(5, 'bears')]).toEqual(['one bear', 'five bears']);
  });
  it('compare asks for a count, never "which group"; count_on names the start, not the total', () => {
    expect(askFor(at('compare', 7, { count: 11 }))).toContain('How many in the group with more?');
    const on = askFor(at('count_on', 8, { startFrom: 5 }));
    expect(on).toContain('already has five');
    expect(on).toContain('How many bears altogether?');
    expect(on).not.toMatch(/\beight\b/i);
  });
  it('subitize_perceptual is number-free', () => {
    const pk = at('subitize_perceptual', 2, { count: 2 });
    expect(howToPlayFor(pk) + askFor(pk)).not.toMatch(/\d/);
    expect(howToPlayFor(pk) + askFor(pk)).not.toMatch(NUMBER_WORDS);
  });
  it('give_me_n says the number it asks for, so it has nothing to leak', () => {
    const give = at('give_me_n', 3, { count: 8 });
    expect(askFor(give)).toContain('three bears');
    expect(countingBoardHarnessAnswers(give).leakTokens).toEqual([]);
  });
  it('take_away says the change and not the total', () => {
    const away = at('take_away', 4, { count: 6, changeBy: 2 });
    expect(askFor(away)).toContain('two bears');
    expect(countingBoardHarnessAnswers(away).leakTokens).toEqual(['four']);
    expect(stimulusFor(away)).not.toContain('four');
  });
});

describe('the build gate drops items that cannot be asked, and never backfills', () => {
  it('drops an answer below one', () => {
    expect(chOf({ id: 'z1', type: 'count_all', targetAnswer: 0, count: 0 })).toBeNull();
    expect(chOf({ id: 'z2', type: 'compare', targetAnswer: -1, count: 4 })).toBeNull();
  });
  it('drops a count_on with no usable startFrom', () => {
    for (const startFrom of [undefined, 0, 8, 9]) expect(chOf({ id: 'c', type: 'count_on', targetAnswer: 8, count: 8, startFrom })).toBeNull();
    expect(chOf({ id: 'c5', type: 'count_on', targetAnswer: 8, count: 8, startFrom: 5 })).not.toBeNull();
  });
  it('keeps order and reports survivors only', () => {
    const built = itemsFromChallenges([
      { id: 'a', type: 'count_all', targetAnswer: 3, count: 3 },
      { id: 'b', type: 'count_on', targetAnswer: 8, count: 8 },
      { id: 'c', type: 'count_on', targetAnswer: 8, count: 8, startFrom: 5 },
    ], { objectWord: 'bears' });
    expect(built.map((i) => i.id)).toEqual(['a', 'c']);
  });
  it('the answer channel and the action map come from the builder', () => {
    expect(chOf({ id: 'g', type: 'subitize_perceptual', targetAnswer: 2, count: 2 })!.answerKind).toBe('gesture');
    expect(chOf({ id: 'v', type: 'count_all', targetAnswer: 5, count: 5 })!.answerKind).toBe('voice');
    expect(chOf({ id: 'n', type: 'give_me_n', targetAnswer: 3, count: 8 })!.answerKind).toBe('gesture');
    expect(chOf({ id: 'b', type: 'build_n', targetAnswer: 6, count: 6 })!.answerKind).toBe('gesture');
    expect(ACTION_FOR_KIND.count_all).toBe(ACTION_FOR_KIND.group_count);
    expect(new Set(Object.values(ACTION_FOR_KIND)).size).toBe(10);
  });
  it('drops give_me_n with no spare pile, a take_away whose change is the answer, and arithmetic that does not close', () => {
    expect(chOf({ id: 'p', type: 'give_me_n', targetAnswer: 5, count: 5 })).toBeNull();
    expect(chOf({ id: 'q', type: 'give_me_n', targetAnswer: 3, count: 8 })).not.toBeNull();
    expect(chOf({ id: 'r', type: 'take_away', targetAnswer: 3, count: 6, changeBy: 3 })).toBeNull();
    expect(chOf({ id: 's', type: 'take_away', targetAnswer: 4, count: 6, changeBy: 2 })).not.toBeNull();
    expect(chOf({ id: 't', type: 'take_away', targetAnswer: 4, count: 9, changeBy: 2 })).toBeNull();
    expect(chOf({ id: 'u', type: 'add_more', targetAnswer: 9, count: 5, changeBy: 2 })).toBeNull();
    expect(chOf({ id: 'v2', type: 'add_more', targetAnswer: 7, count: 5, changeBy: 2 })).not.toBeNull();
  });
  it('the object word falls back to "objects"', () => {
    expect([objectWordFor('bears'), objectWordFor('custom')]).toEqual(['bears', 'objects']);
  });
});

describe('stimulus and harness answers', () => {
  it('a stimulus names only the public numbers', () => {
    expect(stimulusFor(at('count_on', 8, { startFrom: 5 }))).toContain('five');
    expect(stimulusFor(at('group_count', 12, { groupSize: 4 }))).toContain('four');
    const cmp = at('compare', 7, { count: 11, groupSize: 7 });
    expect(stimulusFor(cmp)).not.toContain('seven');
    expect(stimulusFor(cmp)).not.toContain('four');
    expect(JSON.stringify(MATH_CATALOG.find((p) => p.id === 'counting-board'))).not.toContain('targetCount');
  });
  it('voice items: correct is the answer word, plainWrong never is', () => {
    for (const f of [at('count_all', 5), at('subitize', 4), at('count_on', 8, { startFrom: 5 }), at('count_all', 21)]) {
      const a = countingBoardHarnessAnswers(f);
      expect(a.correct).toBe(numberWordFor(f.target));
      expect(a.plainWrong).not.toBe(a.correct);
      expect(a.leakTokens).toEqual([numberWordFor(f.target)]);
    }
  });
  it('signature wrongs: a walk one past, the start said back, the smaller group, the number before the change', () => {
    for (const f of [at('count_all', 5), at('subitize', 4), at('group_count', 12, { groupSize: 4 })]) {
      expect(countingBoardHarnessAnswers(f).signatureWrong!.text).toBe(countWalk(f.target + 1));
    }
    expect(countingBoardHarnessAnswers(at('count_on', 8, { startFrom: 5 })).signatureWrong!.text).toBe('five');
    expect(countingBoardHarnessAnswers(at('compare', 7, { count: 11, groupSize: 7 })).signatureWrong!.text).toBe('four');
    for (const f of [at('take_away', 4, { count: 6, changeBy: 2 }), at('add_more', 7, { count: 5, changeBy: 2 })]) {
      expect(countingBoardHarnessAnswers(f).signatureWrong!.text).toBe(numberWordFor(f.count));
    }
  });
  it('the hand item commits a finger count inside the three offered hands', () => {
    expect(countingBoardHarnessAnswers(at('subitize_perceptual', 2, { count: 2 })).placed).toEqual({ correct: 2, wrong: 1 });
    expect(countingBoardHarnessAnswers(at('subitize_perceptual', 1, { count: 1 })).placed).toEqual({ correct: 1, wrong: 2 });
  });
  it('every catalog mode maps its challenge types back to that mode', () => {
    const modes = MATH_CATALOG.find((p) => p.id === 'counting-board')!.evalModes!;
    expect(modes.length).toBe(Object.keys(ACTION_FOR_KIND).length);
    for (const mode of modes) for (const type of mode.challengeTypes) expect(evalModeForKind(type as CountingItemKind)).toBe(mode.evalMode);
  });
});
