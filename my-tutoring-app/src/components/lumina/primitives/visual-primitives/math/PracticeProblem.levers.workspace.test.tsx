// @vitest-environment jsdom
/**
 * practice-problem levers on the teaching workspace: a pull changes the screen and the scene fact in the same commit,
 * a second pull is refused and changes nothing, the next attempt records the lever, and no lever shows the worked
 * solution. The judge's two routes are stubbed with the verdict each case needs.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import type { JudgeVerdict } from '../../../service/annotated-example/judge-types';
import type { PracticeProblemData } from './PracticeProblem';
import { MARK_LINES_LEVER, START_HERE_LEVER, STEP_TITLES_LEVER, STRATEGY_LEVER } from './practiceProblemLevers';

const routes = { lines: [] as string[], verdicts: [] as JudgeVerdict[] };
const verdict = (v: JudgeVerdict['verdict'], finalAnswer: string, errorLine?: string): JudgeVerdict => ({
  verdict: v, finalAnswer, canonicalAnswer: 'x = 7', summary: 'The worked solution gets x = 7.',
  stepAnalysis: [{ studentLine: '3x = 21', matchedCanonicalStep: 0, status: 'aligned' },
    ...(errorLine ? [{ studentLine: errorLine, matchedCanonicalStep: 1, status: 'error' as const, note: 'Should be x = 7' }] : [])],
});

beforeEach(() => {
  installRuntimeTimers();
  routes.lines = []; routes.verdicts = [];
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 600, height: 420,
    right: 600, bottom: 420, x: 0, y: 0, toJSON: () => ({}) });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,AAAA');
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    const { action } = JSON.parse(String(init?.body ?? '{}'));
    const body = action === 'transcribeWork' ? { lines: routes.lines.map(latex => ({ latex, confidence: 0.95 })) }
      : action === 'compareWork' ? routes.verdicts.shift() : null;
    return { ok: !!body, json: async () => body ?? {} };
  }));
});
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const HARD = { supportTier: 'hard' as const, support: { showStepSkeleton: false, showFirstStepHint: false, showStrategyPreview: false } };
const problem = (mode: string, extra: Partial<PracticeProblemData> = {}): PracticeProblemData => ({
  title: 'Two-step equation', subject: 'Algebra', evalMode: mode as PracticeProblemData['evalMode'],
  problem: { statement: 'Solve $3x - 7 = 14$ for $x$.' }, solutionStrategy: 'Undo the operations in reverse order.',
  canonicalAnswer: 'x = 7',
  steps: [
    { id: 0, title: 'Undo the subtraction', type: 'algebra', canonicalBody: '3x - 7 = 14 -> [add 7] -> 3x = 21',
      strategy: 'Inverse operations remove the constant.', misconceptions: '' },
    { id: 1, title: 'Undo the multiplication', type: 'algebra', canonicalBody: '3x = 21 -> [divide by 3] -> x = 7',
      strategy: 'Divide by the coefficient.', misconceptions: '' },
  ],
  ...extra,
});

const flush = () => act(async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); });
async function answer(h: WorkspaceHarness, lines: string[], v: JudgeVerdict) {
  routes.lines = lines; routes.verdicts = [v];
  const canvas = h.view.container.querySelector('canvas')!;
  act(() => { fireEvent.mouseDown(canvas, { clientX: 40, clientY: 40 }); });
  act(() => { fireEvent.mouseMove(canvas, { clientX: 120, clientY: 60 }); });
  act(() => { fireEvent.mouseUp(canvas); });
  h.settle(2000); await flush();
  h.press('Done');
  for (let i = 0; i < 4; i++) { await flush(); h.settle(10); }
}
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.pulled]);
const text = (h: WorkspaceHarness) => h.view.container.textContent ?? '';
const unchanged = (h: WorkspaceHarness) => JSON.stringify({ d: h.state().task!.demand, l: levers(h), html: h.view.container.innerHTML });

it.each(['derive_easy', 'derive_medium', 'derive_hard'])('%s, hard tier: every scaffold is a lever that starts off', mode => {
  const h = mountWorkspace({ primitiveId: 'practice-problem', evalMode: mode, data: problem(mode, HARD) as never });
  expect(levers(h)).toEqual([[STEP_TITLES_LEVER, false], [START_HERE_LEVER, false], [STRATEGY_LEVER, false]]);
  h.close();
});

it('the default (no tier) starts every scaffold on screen, as pulled', () => {
  const h = mountWorkspace({ primitiveId: 'practice-problem', evalMode: 'derive_medium', data: problem('derive_medium') as never });
  expect(levers(h)).toEqual([[STEP_TITLES_LEVER, true], [START_HERE_LEVER, true], [STRATEGY_LEVER, true]]);
  h.close();
});

it('after a wrong answer: step_titles titles the slots, start_here and strategy show, each in one commit; the next attempt records them', async () => {
  const h = mountWorkspace({ primitiveId: 'practice-problem', evalMode: 'derive_hard', data: problem('derive_hard', HARD) as never });
  await answer(h, ['3x = 21', 'x = 8'], verdict('incorrect', 'x = 8'));
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, miss: 'wrong_answer' });
  expect(nextLever(h.state().task!.workspace!.levers!, 'wrong_answer')).toBe(STEP_TITLES_LEVER);
  expect(text(h)).not.toMatch(/Undo the subtraction/);
  const titles = h.dispatch('pull_lever', { lever: STEP_TITLES_LEVER });
  expect(titles.status).toBe('committed');
  expect(text(h)).toMatch(/Undo the subtraction.*Undo the multiplication/);
  expect(titles.state.task!.demand).toMatchObject({ stepSlots: expect.stringContaining('1. Undo the subtraction') });
  // A second pull is refused and changes nothing.
  const before = unchanged(h);
  expect(h.dispatch('pull_lever', { lever: STEP_TITLES_LEVER }).status).toBe('blocked');
  expect(h.dispatch('pull_lever', { lever: MARK_LINES_LEVER }).status).toBe('blocked');
  expect(unchanged(h)).toBe(before);
  h.dispatch('pull_lever', { lever: START_HERE_LEVER });
  expect(text(h)).toMatch(/Start here/);
  expect(h.state().task!.demand).toMatchObject({ startHint: expect.stringContaining('Inverse operations') });
  h.dispatch('pull_lever', { lever: STRATEGY_LEVER });
  expect(text(h)).toMatch(/reverse order/);
  // No lever shows the worked solution or the answer ("3x = 21" is the learner's own line).
  expect(text(h) + JSON.stringify(h.state().task!.demand)).not.toMatch(/(?<!3)x = 7|\[add 7\]|divide by 3/);
  h.dispatch('retry'); h.confirmVisible();
  await answer(h, ['3x = 21', 'x = 7'], verdict('correct', 'x = 7'));
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: true, assisted: true,
    levers: [STEP_TITLES_LEVER, START_HERE_LEVER, STRATEGY_LEVER] });
  h.close();
});

it('mark_lines exists after a check that flagged a line, and marks only the learner\'s own line', async () => {
  const h = mountWorkspace({ primitiveId: 'practice-problem', evalMode: 'derive_easy', data: problem('derive_easy') as never });
  expect(levers(h).map(([id]) => id)).not.toContain(MARK_LINES_LEVER);
  await answer(h, ['3x - 7 = 14', '3x = 21', 'x = 63'], verdict('partial', 'x = 63', 'x = 63'));
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ miss: 'step_error' });
  expect(nextLever(h.state().task!.workspace!.levers!, 'step_error')).toBe(MARK_LINES_LEVER);
  expect(h.view.container.querySelectorAll('[data-marked]')).toHaveLength(0);
  h.dispatch('pull_lever', { lever: MARK_LINES_LEVER });
  const marked = h.view.container.querySelectorAll('[data-marked]');
  expect(marked).toHaveLength(1);
  expect(marked[0].textContent).toMatch(/check this line/i);
  expect(h.state().task!.demand).toMatchObject({ markedLines: expect.stringContaining('"x = 63"') });
  expect(text(h) + JSON.stringify(h.state().task!.demand)).not.toMatch(/x = 7|Should be/);
  // Try again keeps the work and the mark: the learner fixes that line.
  h.dispatch('retry'); h.confirmVisible();
  expect(h.view.container.querySelectorAll('[data-marked]')).toHaveLength(1);
  h.close();
});
