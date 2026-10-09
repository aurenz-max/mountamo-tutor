import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { getComponentById } from '../../../service/manifest/catalog';
import type { PracticeProblemSolution } from './practice-problem-types';
import { PRACTICE_MISSES, type PracticeMiss } from './practiceProblemWorkspace';
import {
  MARK_LINES_LEVER, PRACTICE_UNANSWERED, START_HERE_LEVER, STEP_TITLES_LEVER, STRATEGY_LEVER,
  answerPhrases, practiceProblemLevers, scaffoldLeaks, scaffoldText, startingLevers, supportWith,
} from './practiceProblemLevers';

const P: PracticeProblemSolution = {
  title: 'Two-step equation', subject: 'Algebra', difficulty: 'easy', evalMode: 'derive_easy', gradeLevel: 'Grade 7',
  problem: { statement: 'Solve $3x - 7 = 14$ for $x$.' }, solutionStrategy: 'Undo the operations in reverse order.',
  canonicalAnswer: 'x = 7',
  steps: [
    { id: 0, title: 'Undo the subtraction', type: 'algebra', canonicalBody: '3x - 7 = 14 -> [add 7] -> 3x = 21',
      strategy: 'Inverse operations remove the constant.', misconceptions: '' },
    { id: 1, title: 'Undo the multiplication', type: 'algebra', canonicalBody: '3x = 21 -> [divide by 3] -> x = 7',
      strategy: 'Divide by the coefficient.', misconceptions: '' },
  ],
};
const MODES = ['derive_easy', 'derive_medium', 'derive_hard'];
const ALL_OFF = { showStepSkeleton: false, showFirstStepHint: false, showStrategyPreview: false };
const PAYLOADS = join(process.cwd(), 'src/components/lumina/components/live-activity/runtime/testing/w1-payloads');
const saved = readdirSync(PAYLOADS).filter(f => f.startsWith('practice-problem.'))
  .map(f => [f, JSON.parse(readFileSync(join(PAYLOADS, f), 'utf-8')).data as PracticeProblemSolution] as const);

describe('leak rule (every mode: the same task, so the same rule)', () => {
  it('names each step result, the answer, and a right-hand side not printed in the problem', () => {
    // "7" is printed in the problem (3x - 7), so the bare value is not a phrase; "21" is not, so it is.
    expect(answerPhrases(P).sort()).toEqual(['21', '3x=21', 'x=7'].sort());
  });
  it.each([
    ['Add 7 to both sides', false],
    ['Divide 21 by 3', true],
    ['Get x = 7', true],
    ['Divide by the coefficient of 3x', false],
    ['Subtract 210 from both sides', false],
  ])('"%s" leaks: %s', (text, leaks) => expect(scaffoldLeaks(text, P)).toBe(leaks));
  it('a scaffold that shows a result is not offered', () => {
    const leaky = { ...P, solutionStrategy: 'Get 3x = 21, then divide.' };
    expect(practiceProblemLevers(leaky, [], []).map(l => l.id)).toEqual([STEP_TITLES_LEVER, START_HERE_LEVER]);
  });
  it.each(saved)('%s: no offered scaffold shows a result', (_f, p) => {
    for (const l of practiceProblemLevers(p, [], [])) expect(scaffoldLeaks(scaffoldText(p, l.id), p), l.id).toBe(false);
  });
});

describe('levers', () => {
  it('mark_lines exists only while a check has flagged a line', () => {
    expect(practiceProblemLevers(P, [], []).map(l => l.id)).toEqual([STEP_TITLES_LEVER, START_HERE_LEVER, STRATEGY_LEVER]);
    expect(practiceProblemLevers(P, [], ['x = 63'])[0].id).toBe(MARK_LINES_LEVER);
  });
  it('the tier starts scaffolds as pulled; a pull adds to them', () => {
    const on = startingLevers({ showStepSkeleton: true, showFirstStepHint: false, showStrategyPreview: false });
    expect(on).toEqual([STEP_TITLES_LEVER]);
    expect(practiceProblemLevers(P, on, []).filter(l => l.pulled).map(l => l.id)).toEqual([STEP_TITLES_LEVER]);
    expect(supportWith(ALL_OFF, [START_HERE_LEVER])).toEqual({ ...ALL_OFF, showFirstStepHint: true });
  });
  it.each<[PracticeMiss, string[], string | null]>([
    ['step_error', ['x = 63'], MARK_LINES_LEVER],
    ['unfinished', [], STEP_TITLES_LEVER],
    ['answer_without_work', [], STEP_TITLES_LEVER],
    ['wrong_answer', [], STEP_TITLES_LEVER],
  ])('after %s the observer pulls %s first', (miss, flagged, lever) => {
    expect(nextLever(practiceProblemLevers(P, [], flagged), miss)).toBe(lever);
  });
  it('with the titles already on (medium tier), wrong_answer goes to start_here, then strategy', () => {
    expect(nextLever(practiceProblemLevers(P, [STEP_TITLES_LEVER], []), 'wrong_answer')).toBe(START_HERE_LEVER);
    expect(nextLever(practiceProblemLevers(P, [STEP_TITLES_LEVER, START_HERE_LEVER], []), 'wrong_answer')).toBe(STRATEGY_LEVER);
  });
  it.each(MODES)('%s: every catalog miss is answered by a lever or listed unanswered', mode => {
    const tw = getComponentById('practice-problem')!.teachingWorkspace!;
    expect(tw.levers).toBe(true);
    expect(tw.unanswered?.[mode]).toEqual(PRACTICE_UNANSWERED);
    const answered = new Set(practiceProblemLevers(P, [], ['x = 63']).flatMap(l => l.answers ?? []));
    for (const miss of PRACTICE_MISSES) expect(answered.has(miss) || PRACTICE_UNANSWERED.includes(miss), miss).toBe(true);
  });
  it.each(saved)('%s: every miss but nothing_read has a lever on the item at the hard tier', (_f, p) => {
    const answered = new Set(practiceProblemLevers(p, startingLevers(ALL_OFF), ['a line']).flatMap(l => l.answers ?? []));
    expect(PRACTICE_MISSES.filter(m => !answered.has(m) && !PRACTICE_UNANSWERED.includes(m))).toEqual([]);
  });
});
