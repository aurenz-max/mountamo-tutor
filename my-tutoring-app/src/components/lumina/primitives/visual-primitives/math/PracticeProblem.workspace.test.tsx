// @vitest-environment jsdom
/**
 * Practice problem on the teaching workspace: what is its own. The generic W1 contract
 * (runtime/workspaceContract.test.tsx) covers ownership, the packet and self-advance.
 *
 * The check is the primitive's own judge: the whiteboard is transcribed (`transcribeWork`) and the lines compared
 * with the worked solution (`compareWork`). Both routes are stubbed here with the verdict the case needs; what is
 * tested is what the binding does with it.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { getComponentById } from '../../../service/manifest/catalog';
import type { JudgeVerdict } from '../../../service/annotated-example/judge-types';
import type { PracticeProblemData } from './PracticeProblem';
import { PRACTICE_MISSES, practiceMiss } from './practiceProblemWorkspace';

/** What the stubbed routes answer: the transcription's lines and the judge's next verdicts, in order. */
const routes = { lines: [] as string[], verdicts: [] as JudgeVerdict[], compared: 0 };
const verdict = (v: JudgeVerdict['verdict'], finalAnswer: string, errorLine?: string): JudgeVerdict => ({
  verdict: v, finalAnswer, canonicalAnswer: 'x = 7', summary: 'The worked solution divides 21 by 3 to get x = 7.',
  stepAnalysis: [{ studentLine: '3x = 21', matchedCanonicalStep: 0, status: 'aligned' },
    ...(errorLine ? [{ studentLine: errorLine, matchedCanonicalStep: 1, status: 'error' as const, note: 'Should be x = 7' }] : [])],
});

beforeEach(() => {
  installRuntimeTimers();
  routes.lines = []; routes.verdicts = []; routes.compared = 0;
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 600, height: 420,
    right: 600, bottom: 420, x: 0, y: 0, toJSON: () => ({}) });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,AAAA');
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    const { action } = JSON.parse(String(init?.body ?? '{}'));
    const body = action === 'transcribeWork' ? { lines: routes.lines.map(latex => ({ latex, confidence: 0.95 })) }
      : action === 'compareWork' ? (routes.compared++, routes.verdicts.shift())
      : action === 'reviewProgress' ? { totalSteps: 2, completedSteps: 1, lineReviews: [], allStepsComplete: false, headline: '' }
      : {};
    return { ok: !!body, json: async () => body };
  }));
});
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const MODES = ['derive_easy', 'derive_medium', 'derive_hard'] as const;
const problem = (mode: string, extra: Partial<PracticeProblemData> = {}): PracticeProblemData => ({
  title: 'Two-step equation', subject: 'Algebra', evalMode: mode as PracticeProblemData['evalMode'],
  difficulty: mode === 'derive_easy' ? 'easy' : mode === 'derive_medium' ? 'medium' : 'hard',
  problem: { statement: 'Solve $3x - 7 = 14$ for $x$.' }, solutionStrategy: 'Undo the operations in reverse order.',
  canonicalAnswer: 'x = 7',
  steps: [
    { id: 0, title: 'Undo the subtraction', type: 'algebra', canonicalBody: '3x - 7 = 14 -> [add 7] -> 3x = 21',
      strategy: 'Inverse operations remove the constant.', misconceptions: 'Subtracting 7 instead.' },
    { id: 1, title: 'Undo the multiplication', type: 'algebra', canonicalBody: '3x = 21 -> [divide by 3] -> x = 7',
      strategy: 'Divide by the coefficient.', misconceptions: 'Multiplying by 3.' },
  ],
  ...extra,
});

const flush = () => act(async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); });
function write(h: WorkspaceHarness) {
  const canvas = h.view.container.querySelector('canvas')!;
  act(() => { fireEvent.mouseDown(canvas, { clientX: 40, clientY: 40 }); });
  act(() => { fireEvent.mouseMove(canvas, { clientX: 120, clientY: 60 }); });
  act(() => { fireEvent.mouseUp(canvas); });
}
async function done(h: WorkspaceHarness) {
  h.press('Done');
  for (let i = 0; i < 4; i++) { await flush(); h.settle(10); }
}
const doneButton = (h: WorkspaceHarness) => Array.from(h.view.container.querySelectorAll('button'))
  .find(b => (b.textContent ?? '').trim() === 'Done') as HTMLButtonElement;

it('every catalog mode binds, with its miss list', () => {
  const entry = getComponentById('practice-problem')!;
  expect((entry.evalModes ?? []).map(m => m.evalMode)).toEqual([...MODES]);
  for (const mode of MODES) expect(entry.teachingWorkspace!.misses![mode]).toEqual(PRACTICE_MISSES);
});

it.each(MODES)('%s mounts under tutor ownership with the problem as the task and no key in the packet', mode => {
  const h = mountWorkspace({ primitiveId: 'practice-problem', evalMode: mode, data: problem(mode) as never });
  expect(h.state().owner).toBe('tutor');
  expect(h.state().task!.task).toContain('Solve $3x - 7 = 14$');
  expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
  const packet = JSON.stringify(h.packet());
  expect(packet).not.toMatch(/x = 7|3x = 21|\[add 7\]|divide by 3/);
  expect(seam.legacyAI).not.toHaveBeenCalled();
  expect(h.view.container.textContent).not.toMatch(/next/i);
  h.close();
});

it('hard tier: the step slots carry no titles, and the scene says not to name a step', () => {
  const h = mountWorkspace({ primitiveId: 'practice-problem', evalMode: 'derive_hard', data: problem('derive_hard', {
    supportTier: 'hard', support: { showStepSkeleton: false, showFirstStepHint: false, showStrategyPreview: false } }) as never });
  expect(h.view.container.textContent).not.toMatch(/Undo the subtraction|Start here|reverse order/);
  expect(h.state().task!.demand).toMatchObject({ stepSlots: expect.stringContaining('no titles') });
  expect(JSON.stringify(h.state().task!.demand)).not.toMatch(/startHint|strategyShown|Undo the/);
  h.close();
});

it('a wrong check commits its named miss without showing the worked solution; Try again keeps the work; a right one completes once', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mountWorkspace({ primitiveId: 'practice-problem', evalMode: 'derive_easy', data: problem('derive_easy') as never });
  routes.lines = ['3x - 7 = 14', '3x = 21', 'x = 63'];
  routes.verdicts = [verdict('partial', 'x = 63', 'x = 63'), verdict('correct', 'x = 7')];
  write(h); h.settle(2000); await flush();
  expect(h.state().task!.demand).toMatchObject({ learnerWork: expect.stringContaining('x = 63') });
  await done(h);
  expect(routes.compared).toBe(1);
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, miss: 'step_error' });
  // The verdict is shown without the worked solution, the checker's summary or its notes.
  expect(h.view.container.textContent).toMatch(/part of your work matches/i);
  expect(h.view.container.textContent).not.toMatch(/x = 7|Should be|divides 21/);
  expect(JSON.stringify(h.packet())).not.toMatch(/x = 7|Should be|divides 21/);
  expect(doneButton(h).disabled).toBe(true);
  h.dispatch('retry'); h.confirmVisible();
  // The learner fixes a line: the work stays on the board.
  expect(h.state().task!.phase).toBe('working');
  expect(doneButton(h).disabled).toBe(false);
  routes.lines = ['3x - 7 = 14', '3x = 21', 'x = 7'];
  write(h); h.settle(2000); await flush();
  await done(h);
  expect(h.state().task!.evidence.correctness).toBe('correct');
  h.dispatch('advance'); h.confirmVisible(); await flush();
  expect(h.state().status).toBe('completed');
  expect(seam.submit).toHaveBeenCalledOnce();
  const [success, , metrics, work] = (seam.submit as any).mock.calls[0];
  expect(success).toBe(true);
  expect(metrics).toMatchObject({ type: 'practice-problem', verdict: 'correct', attempts: 2 });
  expect(work.teachingAttempts.map((a: { miss?: string }) => a.miss ?? null)).toEqual(['step_error', null]);
  expect(seam.legacyAI).not.toHaveBeenCalled();
  h.close();
});

it('submits nothing without an evaluation provider (the live host)', async () => {
  const h = mountWorkspace({ primitiveId: 'practice-problem', evalMode: 'derive_medium', data: problem('derive_medium') as never });
  routes.lines = ['3x = 21', 'x = 7'];
  routes.verdicts = [verdict('correct', 'x = 7')];
  write(h); h.settle(2000); await flush();
  await done(h);
  h.dispatch('advance'); h.confirmVisible(); await flush();
  expect(h.state().status).toBe('completed');
  expect(seam.submit).not.toHaveBeenCalled();
  h.close();
});

it('practiceMiss names what the verdict shows', () => {
  expect(practiceMiss([], verdict('incorrect', ''))).toBe('nothing_read');
  expect(practiceMiss(['3x = 21'], verdict('partial', ''))).toBe('unfinished');
  expect(practiceMiss(['x = 7'], verdict('partial', 'x=7'))).toBe('answer_without_work');
  expect(practiceMiss(['3x = 21', 'x = 63'], verdict('incorrect', 'x = 63', 'x = 63'))).toBe('step_error');
  expect(practiceMiss(['3x = 21', 'x = 8'], verdict('incorrect', 'x = 8'))).toBe('wrong_answer');
  expect(practiceMiss(['x = 7'], verdict('correct', 'x = 7'))).toBeUndefined();
});
