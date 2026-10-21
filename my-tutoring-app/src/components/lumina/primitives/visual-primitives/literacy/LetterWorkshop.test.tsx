// @vitest-environment jsdom
/**
 * LetterWorkshop's paper, mounted the way a lesson mounts it (`mountWorkspace`): the copy model and the hidden write
 * target, the vision judge's second opinion on copy/write, the evidence ledger the evaluation submits, and what each
 * support tier draws. The judge is mocked: jsdom has no 2D canvas, so a stand-in image lets the paper ask it.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());
const { judge } = vi.hoisted(() => ({ judge: vi.fn() }));
vi.mock('./letterWorkshopJudge', async original => ({ ...(await original<typeof import('./letterWorkshopJudge')>()),
  judgeLetterDrawing: judge, renderLetterInkForJudge: () => 'data:image/png;base64,ink' }));

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import type { LetterWorkshopChallenge } from './LetterWorkshop';
import { getLetterTemplate } from './letterWorkshopGeometry';
import { judgeAcceptsLetter } from './letterWorkshopJudge';
import { letterWorkshopHarnessStrokes } from './letterWorkshopWorkspace';

beforeEach(() => {
  installRuntimeTimers();
  judge.mockReset(); judge.mockResolvedValue(null);
  Object.assign(SVGElement.prototype, {
    getScreenCTM: () => ({ inverse: () => ({}) }),
    createSVGPoint: () => ({ x: 0, y: 0, matrixTransform() { return this; } }),
    setPointerCapture: () => {}, hasPointerCapture: () => false, releasePointerCapture: () => {},
  });
});
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const item = (id: string, type: LetterWorkshopChallenge['type'], letter: string, extra: Partial<LetterWorkshopChallenge> = {}): LetterWorkshopChallenge =>
  ({ id, type, templateId: `lowercase-${letter}`, ...extra });
const mount = (mode: string, challenges: LetterWorkshopChallenge[], title = 'Letter Workshop', description = 'Practice letters.') =>
  mountWorkspace({ primitiveId: 'letter-workshop', evalMode: mode, instanceId: 'letters',
    data: { title, description, gradeLevel: 'K', challengeType: mode, challenges } });
const paper = (h: WorkspaceHarness) => h.view.getByTestId('letter-writing-paper');
const last = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts.at(-1);

function draw(h: WorkspaceHarness, c: LetterWorkshopChallenge, wrong = false) {
  const el = paper(h);
  const at = (type: string, p: { x: number; y: number }) => {
    const e = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: p.x, clientY: p.y });
    Object.assign(e, { pointerId: 1, pointerType: 'pen', isPrimary: true });
    fireEvent(el, e);
  };
  for (const stroke of letterWorkshopHarnessStrokes(c, wrong)) act(() => {
    at('pointerdown', stroke[0]); stroke.slice(1).forEach(p => at('pointermove', p)); at('pointerup', stroke[stroke.length - 1]);
  });
}
const press = async (h: WorkspaceHarness, name: RegExp) => {
  const button = Array.from(h.view.container.querySelectorAll('button')).find(b => name.test(b.textContent?.trim() ?? ''))!;
  await act(async () => { fireEvent.click(button); });
};
const check = (h: WorkspaceHarness) => press(h, /^Check my/);
const finish = (h: WorkspaceHarness) => { h.dispatch('advance'); h.confirmVisible(); };

describe('copy and write', () => {
  it('copy: a separate model beside a blank paper; the check shows the reference and the ledger says beside-model', async () => {
    seam.evaluationContext = { lesson: 'test' };
    // Two items: a right answer on the last item completes the session and the paper goes.
    const c = item('a', 'copy', 'l'), d = item('b', 'copy', 't');
    const h = mount('copy', [c, d]);
    expect(paper(h).querySelector('path[stroke="#386f72"]')).toBeNull();
    expect(h.view.queryByTestId('letter-feedback-reference')).toBeNull();
    expect(h.view.getByTestId('letter-copy-model').contains(paper(h))).toBe(false);
    draw(h, c); await check(h);
    expect(h.view.getByTestId('letter-feedback-reference')).toBeTruthy();
    finish(h); draw(h, d); await check(h); finish(h);
    expect(seam.submit.mock.calls[0][2]).toMatchObject({ challengeType: 'copy', correctCount: 2, hintsViewed: 0 });
    expect(seam.submit.mock.calls[0][3]).toMatchObject({ localOnly: true });
    expect(seam.submit.mock.calls[0][3].attempts[0]).toMatchObject({ type: 'copy', assistance: 'beside-model' });
    h.close();
  });

  it('write: the title, description and model never show the letter; a check reveals the model, recorded on the retry', async () => {
    seam.evaluationContext = { lesson: 'test' };
    const c = item('a', 'write', 'l');
    const h = mount('write', [c], 'Write lowercase l', 'The target is l.');
    expect(h.view.queryByText('Write lowercase l')).toBeNull();
    expect(h.view.queryByText('The target is l.')).toBeNull();
    expect(h.view.queryByTestId('letter-copy-model')).toBeNull();
    draw(h, c, true); await check(h);
    expect(h.view.getByTestId('letter-copy-model')).toBeTruthy();
    expect(h.view.getByTestId('letter-feedback-reference')).toBeTruthy();
    h.dispatch('retry');
    draw(h, c); await check(h); finish(h);
    const attempts = seam.submit.mock.calls[0][3].attempts;
    expect(attempts[0]).toMatchObject({ type: 'write', assistance: 'auditory-cue', modelPreviouslySeen: false });
    expect(attempts[1]).toMatchObject({ assistance: 'beside-model', modelPreviouslySeen: true });
    h.close();
  });
});

describe('the vision judge, a second opinion on copy and write', () => {
  const verdict = (writtenAs: string, recognized = true) => ({ writtenAs, recognized, score: 90, confidence: 90,
    feedback: recognized ? 'You made a tall line!' : 'That looks like a different letter.' });

  it('accepts a letter the geometry missed when it reads the target', async () => {
    seam.evaluationContext = { lesson: 'test' };
    judge.mockResolvedValue(verdict('l'));
    const c = item('a', 'copy', 'l');
    const h = mount('copy', [c, item('b', 'copy', 't')]);
    draw(h, c, true); await check(h);
    expect(judge).toHaveBeenCalledTimes(1);
    expect(judge.mock.calls[0][1]).toMatchObject({ id: 'lowercase-l' });
    expect(h.view.getByText('You wrote it')).toBeTruthy();
    expect(last(h)).toMatchObject({ correct: true });
    finish(h); draw(h, item('b', 'copy', 't')); await check(h); finish(h);
    const [attempt] = seam.submit.mock.calls[0][3].attempts;
    expect(attempt.assessment.passed).toBe(true);
    expect(attempt.visionJudge).toMatchObject({ writtenAs: 'l', accepted: true, version: 'letter-vision-v1' });
    h.close();
  });

  it('keeps the geometric miss when it reads another letter (named as the miss) or fails', async () => {
    judge.mockResolvedValueOnce(verdict('L')).mockResolvedValueOnce(null);
    const c = item('a', 'copy', 'l');
    const h = mount('copy', [c]);
    draw(h, c, true); await check(h);
    expect(h.view.getByText('Try this')).toBeTruthy();
    expect(last(h)).toMatchObject({ correct: false, miss: 'wrong_case' });
    h.dispatch('retry');
    draw(h, c, true); await check(h);
    expect(last(h)).toMatchObject({ correct: false, miss: 'start_or_order' });
    h.close();
  });

  it('never reads a trace', async () => {
    const c = item('a', 'trace', 'l');
    const h = mount('trace', [c]);
    draw(h, c, true); await check(h);
    expect(judge).not.toHaveBeenCalled();
    expect(h.view.getByText('Try this')).toBeTruthy();
    h.close();
  });

  it('accepts only its own reading, allowing case only for same-shape letters', () => {
    const lower = (letter: string) => getLetterTemplate(`lowercase-${letter}`);
    expect(judgeAcceptsLetter(verdict('p'), lower('p'))).toBe(true);
    expect(judgeAcceptsLetter(verdict('q'), lower('p'))).toBe(false);
    expect(judgeAcceptsLetter(verdict('P'), lower('p'))).toBe(false);
    expect(judgeAcceptsLetter(verdict('C'), lower('c'))).toBe(true);
    expect(judgeAcceptsLetter(verdict('c', false), lower('c'))).toBe(false);
    expect(judgeAcceptsLetter({ ...verdict('p'), confidence: 40 }, lower('p'))).toBe(false);
    expect(judgeAcceptsLetter(null, lower('p'))).toBe(false);
  });
});

it('keeps cleared and failed tries in the evidence ledger and submits it once', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const a = item('a', 'trace', 'l'), b = item('b', 'trace', 't');
  const h = mount('trace', [a, b]);
  draw(h, a); await press(h, /^Clear/);
  draw(h, a, true); await check(h);
  h.dispatch('retry');
  draw(h, a); await check(h); finish(h);
  draw(h, b); await check(h); finish(h);
  expect(h.state().status).toBe('completed');
  expect(seam.submit).toHaveBeenCalledOnce();
  const [success, , metrics, work] = seam.submit.mock.calls[0];
  expect(success).toBe(true);
  expect(metrics).toMatchObject({ correctCount: 2 });
  expect(work.assistance).toBe('trace-guide');
  expect(work.attempts.map((x: { disposition: string }) => x.disposition)).toEqual(['cleared', 'submitted', 'submitted', 'submitted']);
  expect(work.attempts[1].assessment.passed).toBe(false);
  h.close();
});

describe('support tiers keep the task and withdraw aids', () => {
  for (const mode of ['trace', 'copy', 'write'] as const) for (const tier of ['easy', 'medium', 'hard'] as const) {
    it(`${mode}/${tier}`, async () => {
      const c = item('a', mode, 'l', { supportTier: tier });
      const h = mount(mode, [c]);
      const el = paper(h);
      expect(Boolean(el.querySelector('path[stroke="#386f72"]'))).toBe(mode === 'trace');
      expect(Boolean(h.view.queryByTestId('letter-start'))).toBe(mode === 'trace' && tier !== 'hard');
      expect(Boolean(h.view.queryByTestId('letter-arrow'))).toBe(mode === 'trace' && tier === 'easy');
      expect(Boolean(h.view.queryByTestId('letter-line-labels'))).toBe(tier !== 'hard');
      expect(Boolean(h.view.queryByTestId('letter-self-check'))).toBe(tier === 'easy');
      expect(Boolean(h.view.queryByTestId('letter-copy-model'))).toBe(mode === 'copy');
      if (mode === 'trace' && tier === 'hard') {
        draw(h, c, true); await check(h);
        expect(h.view.getByRole('status').textContent).not.toMatch(/numbered|arrow|starting dot/i);
        expect(el.querySelector('circle[stroke="#b77824"]')).toBeNull();
      }
      h.close();
    });
  }
});
