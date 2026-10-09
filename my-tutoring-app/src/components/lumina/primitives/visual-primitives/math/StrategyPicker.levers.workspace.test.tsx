// @vitest-environment jsdom
/**
 * strategy-picker levers (`strategyPickerLevers.ts`), the rules and the picker mounted the way a lesson mounts it.
 * guided / try_another / choose: `two_parts` marks the picture's parts in the same commit as its scene fact and writes
 * only the equation's own numbers; `smaller_numbers` opens an ungraded smaller problem and the full one comes back blank.
 * match: `option_pictures` draws every choice on its own example; `two_choices` opens an ungraded two-choice item.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import type { StrategyId, StrategyPickerChallenge, StrategyPickerData } from './StrategyPicker';
import { PICTURE_KIND, strategyPickerHarnessInputs, strategyPickerMatches, strategyPickerMiss } from './strategyPickerWorkspace';
import {
  PARTS_LEVER, PICTURES_LEVER, SMALLER_LEVER, TWO_CHOICES_LEVER, fits, makeProblem, optionPictures, partsFact, partsLeak,
  partsMarks, picturesLeak, practiceItem, practiceLeaks, practiceParent, simplerProblem, strategyPickerLevers,
} from './strategyPickerLevers';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const STRATEGIES: StrategyId[] = ['counting-on', 'counting-back', 'make-ten', 'doubles', 'near-doubles', 'tally-marks', 'draw-objects'];
const p34 = makeProblem(3, 4, 'addition');
const guided = (id: string, s: StrategyId, p = p34, supportTier?: 'easy' | 'medium' | 'hard'): StrategyPickerChallenge => ({
  id, type: 'guided-strategy', instruction: 'Solve it!', problem: p, assignedStrategy: s, strategySteps: ['Look.', 'Count.'], supportTier });
const match: StrategyPickerChallenge = { id: 'm1', type: 'match-strategy', instruction: 'Which strategy did they use?', problem: p34,
  workedSolution: 'I started at 3 and hopped 4 times on the number line.',
  strategyOptions: ['doubles', 'counting-on', 'counting-back'], correctStrategy: 'counting-on' };
const choose: StrategyPickerChallenge = { id: 'ch1', type: 'choose-your-strategy', instruction: 'Pick any strategy you like!',
  problem: p34, availableStrategies: ['counting-on', 'tally-marks', 'near-doubles'] };
const lesson = (challenges: StrategyPickerChallenge[], supportTier?: 'easy'): StrategyPickerData => ({ title: 'Strategies', challenges,
  maxNumber: 10, operations: ['addition', 'subtraction'], strategiesIntroduced: STRATEGIES, gradeBand: '1', supportTier });

/** Every problem each strategy can draw within ten. */
function allProblems(): { s: StrategyId; p: ReturnType<typeof makeProblem> }[] {
  const out: { s: StrategyId; p: ReturnType<typeof makeProblem> }[] = [];
  for (const s of STRATEGIES) for (let a = 1; a <= 10; a++) for (let b = 1; b <= 10; b++) {
    const p = makeProblem(a, b, s === 'counting-back' ? 'subtraction' : 'addition');
    if (p.result >= 0 && Math.max(a, b, p.result) <= 10 && fits(s, p)) out.push({ s, p });
  }
  return out;
}

describe('the lever rules', () => {
  it('two_parts: over every drawable problem, it writes only the equation\'s numbers and its fact never the total', () => {
    for (const { s, p } of allProblems()) {
      expect(partsLeak(partsMarks(s, p), p)).toBe(false);
      const fact = partsFact(s, p);
      if (p.result !== p.operand1 && p.result !== p.operand2) expect(fact).not.toMatch(new RegExp(`\\b${p.result}\\b`));
    }
    expect(partsLeak({ labels: [7], hops: 0, extraOne: false }, p34)).toBe(true);
  });

  it('option_pictures: every choice once, none on the item\'s problem', () => {
    for (const { p } of allProblems()) {
      const c = { ...match, problem: p, strategyOptions: STRATEGIES };
      expect(picturesLeak(optionPictures(c), c)).toBe(false);
    }
  });

  it('smaller problems: over every drawable problem, the same strategy, smaller, a new answer, never a lesson item', () => {
    let built = 0;
    for (const { s, p } of allProblems()) {
      const q = simplerProblem(s, p, 10, [makeProblem(2, 2, 'addition')]);
      if (!q) continue;
      built++;
      expect(fits(s, q)).toBe(true);
      expect(q.result).not.toBe(p.result);
      expect(q.equation).not.toBe('2 + 2');
      const c = guided('g', s, p), data = lesson([c]);
      const practice = practiceItem(c, data);
      expect(practice).not.toBeNull();
      expect(practiceLeaks(practice!, c, data)).toBe(false);
      expect(practiceParent(practice!.id, data.challenges)).toBe(c);
    }
    expect(built).toBeGreaterThan(80);
  });

  it.each([
    ['counting-on', makeProblem(6, 1, 'addition')], ['counting-back', makeProblem(5, 1, 'subtraction')],
    ['doubles', makeProblem(1, 1, 'addition')], ['near-doubles', makeProblem(1, 2, 'addition')],
    ['make-ten', makeProblem(9, 1, 'addition')], ['tally-marks', makeProblem(1, 1, 'addition')],
  ] as const)('no smaller problem on an item already the smallest picture: %s %s', (s, p) => {
    const c = guided('g', s, p);
    expect(practiceItem(c, lesson([c]))).toBeNull();
    expect(strategyPickerLevers(c, lesson([c]), []).map(l => l.id)).toEqual([PARTS_LEVER]);
  });

  it('choose: a smaller problem whose menu keeps the item\'s strategies that still fit it', () => {
    const p = practiceItem(choose, lesson([choose]))!;
    expect(p).toMatchObject({ id: 'ch1~simpler', type: 'choose-your-strategy' });
    expect(practiceLeaks(p, choose, lesson([choose]))).toBe(false);
    expect(p.availableStrategies!.length).toBeGreaterThan(1);
    expect(p.availableStrategies!.every(s => choose.availableStrategies!.includes(s))).toBe(true);
  });

  it('match: another strategy\'s worked solution, two choices with different pictures; none on a plain two-choice item', () => {
    for (const correct of STRATEGIES) {
      const c = { ...match, correctStrategy: correct, strategyOptions: STRATEGIES };
      const p = practiceItem(c, lesson([c]))!;
      expect(practiceLeaks(p, c, lesson([c]))).toBe(false);
      expect(p.workedSolution).not.toMatch(/count(ing)? on|count(ing)? back|make ten|doubles|tally|draw objects/i);
      expect(strategyPickerMatches(p, { answer: '', chosen: null, match: p.correctStrategy!, compare: null })).toBe(true);
    }
    const plain = { ...match, strategyOptions: ['counting-on', 'tally-marks'] };
    expect(PICTURE_KIND['counting-on']).not.toBe(PICTURE_KIND['tally-marks']);
    expect(practiceItem(plain, lesson([plain]))).toBeNull();
    expect(strategyPickerLevers(plain, lesson([plain]), []).map(l => l.id)).toEqual([PICTURES_LEVER]);
  });

  it.each([
    ['other_operation', [], PARTS_LEVER], ['printed_number', [], PARTS_LEVER], ['one_over', [], PARTS_LEVER],
    ['one_short', [PARTS_LEVER], SMALLER_LEVER], ['short_by_more', [PARTS_LEVER], SMALLER_LEVER],
  ])('a number item: after %s with %j pulled, the next lever is %s', (miss, pulled, want) => {
    const c = guided('g', 'tally-marks');
    expect(nextLever(strategyPickerLevers(c, lesson([c]), pulled as string[]), miss)).toBe(want);
  });

  it.each([['similar_strategy', [], PICTURES_LEVER], ['different_strategy', [PICTURES_LEVER], TWO_CHOICES_LEVER]])(
    'match: after %s with %j pulled, the next lever is %s', (miss, pulled, want) => {
      expect(nextLever(strategyPickerLevers(match, lesson([match]), pulled as string[]), miss)).toBe(want);
    });

  it('the misses the journey\'s wrong answers make are each answered by a lever on that item', () => {
    const wrongMatch = strategyPickerMiss(match, { answer: '', chosen: null, match: 'counting-back', compare: null })!;
    expect(wrongMatch).toBe('similar_strategy');
    expect(strategyPickerLevers(match, lesson([match]), []).some(l => l.answers?.includes(wrongMatch))).toBe(true);
    const compare: StrategyPickerChallenge = { id: 'c1', type: 'compare', instruction: 'Two ways', problem: p34,
      strategies: ['counting-on', 'tally-marks'], comparisonQuestion: 'Which felt easier?' };
    expect(strategyPickerLevers(compare, lesson([compare]), [])).toEqual([]);
  });

  it('easy starts the help on, released on other tiers', () => {
    expect(strategyPickerLevers(guided('g', 'doubles', makeProblem(4, 4, 'addition'), 'easy'), lesson([]), [])
      .map(l => [l.id, l.pulled])).toEqual([[PARTS_LEVER, true], [SMALLER_LEVER, false]]);
    expect(strategyPickerLevers({ ...match, showStrategyExemplars: true }, lesson([]), [])[0].pulled).toBe(true);
    expect(strategyPickerLevers(guided('g', 'doubles', makeProblem(4, 4, 'addition'), 'hard'), lesson([]), [])[0].pulled).toBe(false);
  });
});

// ── mounted ─────────────────────────────────────────────────────────────────────

const q = (h: WorkspaceHarness, sel: string) => h.view.container.querySelectorAll(sel);
const levers = (h: WorkspaceHarness) => h.state().task!.workspace!.levers ?? [];
const last = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts.at(-1);
const frozen = (h: WorkspaceHarness) => {
  const t = h.state().task!;
  return JSON.stringify({ demand: t.demand, levers: t.workspace!.levers, attempts: t.workspace!.attempts, html: h.view.container.innerHTML });
};
/** The journey's inputs for the item on screen (a practice item is rebuilt from its parent, as the journey does). */
function perform(h: WorkspaceHarness, data: StrategyPickerData, wrong: boolean) {
  const id = h.state().task!.itemId;
  const parent = practiceParent(id, data.challenges);
  const c = parent ? practiceItem(parent, data)! : data.challenges.find(x => x.id === id)!;
  const picked = typeof h.state().task!.demand.chosen === 'string' && h.state().task!.demand.chosen !== 'none yet';
  for (const input of strategyPickerHarnessInputs(c, wrong, picked)) h.press(input.label);
}

const MOUNTS = [
  ['guided', guided('g1', 'tally-marks'), PARTS_LEVER, SMALLER_LEVER, '[data-part-label]', 2,
    /first 3 tally marks blue and the next 4 yellow/],
  ['try_another', { ...guided('g1', 'near-doubles'), type: 'try-another' as const }, PARTS_LEVER, SMALLER_LEVER, '[data-part-label]', 3,
    /two equal groups labelled 3 each, and the extra dot labelled \+1/],
  ['choose', { ...choose, id: 'g1' }, PARTS_LEVER, SMALLER_LEVER, '[data-part-label]', 2,
    /first 3 tally marks blue and the next 4 yellow/],
  ['match', { ...match, id: 'g1' }, PICTURES_LEVER, TWO_CHOICES_LEVER, '[data-option-picture]', 3,
    /every choice, each on its own example problem: Doubles on 3 \+ 3; Counting On on 5 \+ 2; Counting Back on 7 - 2/],
] as const;

describe.each(MOUNTS)('%s, mounted', (mode, item, help, simplify, drawn, count, fact) => {
  /** Choose: the learner picks Tally Marks first, so the picture is drawn. */
  const pick = (h: WorkspaceHarness) => { if (item.type === 'choose-your-strategy') h.press('Use Tally Marks'); };

  it('a wrong answer, then help: the picture and its fact in one commit; a refused pull changes nothing; the next try records it', () => {
    const data = lesson([item]);
    const h = mountWorkspace({ primitiveId: 'strategy-picker', evalMode: mode, data: data as never });
    expect(levers(h).map(l => [l.id, l.kind, l.pulled])).toEqual([[help, 'help', false], [simplify, 'simplify', false]]);
    expect(q(h, '[data-lever]')).toHaveLength(0);
    pick(h);
    perform(h, data, true);
    expect(last(h)).toMatchObject({ itemId: 'g1', correct: false });
    expect(last(h)!.miss).toBeTruthy();
    expect(levers(h).some(l => l.answers?.includes(last(h)!.miss!))).toBe(true);
    const receipt = h.dispatch('pull_lever', { lever: help });
    expect(receipt.status).toBe('committed');
    expect(q(h, drawn)).toHaveLength(count);
    expect(String(receipt.state.task!.demand.onScreen)).toMatch(fact);
    if (item.type !== 'match-strategy') expect(String(receipt.state.task!.demand.onScreen)).not.toMatch(/\b7\b/);
    const before = frozen(h);
    expect(h.dispatch('pull_lever', { lever: help }).status).toBe('blocked');
    expect(frozen(h)).toBe(before);
    h.dispatch('retry');
    perform(h, data, false);
    expect(last(h)).toMatchObject({ itemId: 'g1', correct: true, assisted: true, levers: [help] });
    h.close();
  });

  it('the simpler item: ungraded, its own id, the full item back blank after it and credited', () => {
    const data = lesson([item]);
    const h = mountWorkspace({ primitiveId: 'strategy-picker', evalMode: mode, data: data as never });
    pick(h);
    perform(h, data, true);
    h.dispatch('pull_lever', { lever: help });
    const receipt = h.dispatch('pull_lever', { lever: simplify });
    expect(receipt.status).toBe('committed');
    expect(h.state().task).toMatchObject({ itemId: 'g1~simpler' });
    expect(h.state().task!.demand.practice).toBeTruthy();
    expect(h.state().task!.demand.problem).not.toBe('3 + 4');
    expect(q(h, '[data-practice]')).toHaveLength(1);
    expect(q(h, '[data-lever]')).toHaveLength(0);
    expect(levers(h)).toEqual([]);
    perform(h, data, true);
    expect(last(h)).toMatchObject({ itemId: 'g1~simpler', correct: false });
    h.dispatch('retry');
    expect(h.state().task).toMatchObject({ itemId: 'g1~simpler' });
    perform(h, data, false);
    expect(last(h)).toMatchObject({ itemId: 'g1~simpler', correct: true });
    h.dispatch('advance');
    expect(h.state().task).toMatchObject({ itemId: 'g1' });
    expect(h.state().task!.demand.problem).toBe('3 + 4');
    expect(q(h, '[data-practice]')).toHaveLength(0);
    // Blank: no number set, no strategy tapped, no menu pick.
    if (item.type === 'match-strategy') expect(q(h, 'button.bg-cyan-500\\/20')).toHaveLength(0);
    else if (item.type === 'choose-your-strategy') expect(h.state().task!.demand.chosen).toBe('none yet');
    else expect(h.view.container.textContent).toContain('Answer:−?+');
    pick(h);
    expect(q(h, drawn)).toHaveLength(count);
    perform(h, data, false);
    const attempts = h.state().task!.workspace!.attempts;
    expect(attempts.map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
      ['g1', false, false], ['g1~simpler', false, true], ['g1~simpler', true, true], ['g1', true, false]]);
    expect(attempts.at(-1)).toMatchObject({ assisted: true, levers: [help, simplify] });
    h.close();
  });
});

it('guided on a number line: a ring on the start and each hop numbered, never the landing', () => {
  const data = lesson([guided('g1', 'counting-on')]);
  const h = mountWorkspace({ primitiveId: 'strategy-picker', evalMode: 'guided', data: data as never });
  h.dispatch('pull_lever', { lever: PARTS_LEVER });
  h.settle(3000);
  expect(Array.from(q(h, '[data-hop-number]')).map(el => el.textContent)).toEqual(['1', '2', '3', '4']);
  expect(String(h.state().task!.demand.onScreen)).toBe('On the number line: a ring on the start, 3, and each hop numbered in order above its arc, up to 4 hops.');
  h.close();
});

it('choose: before a strategy is picked there is nothing to mark, and the pull is refused', () => {
  const data = lesson([choose]);
  const h = mountWorkspace({ primitiveId: 'strategy-picker', evalMode: 'choose', data: data as never });
  const before = frozen(h);
  expect(h.dispatch('pull_lever', { lever: PARTS_LEVER }).status).toBe('blocked');
  expect(frozen(h)).toBe(before);
  h.close();
});

it('easy starts the parts marked, and that is not a pull', () => {
  const data = lesson([guided('g1', 'tally-marks', p34, 'easy')]);
  const h = mountWorkspace({ primitiveId: 'strategy-picker', evalMode: 'guided', data: data as never });
  expect(levers(h).find(l => l.id === PARTS_LEVER)!.pulled).toBe(true);
  expect(q(h, '[data-part-label]')).toHaveLength(2);
  perform(h, data, false);
  expect(last(h)).toMatchObject({ correct: true });
  expect(last(h)!.levers).toBeUndefined();
  h.close();
});
