// @vitest-environment jsdom
/**
 * W1 minimal binding, plain shape: the real LetterWorkshop on the shared teaching workspace, mounted the way a lesson
 * mounts it. The paper's own Check commits a checked gesture; the runtime owns progression. jsdom has no 2D canvas, so
 * the vision judge never answers and geometry decides, as on a failed judge request. Write sends no scripted cue: the
 * tutor says the letter's name as the task, and nothing on the screen shows it.
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
import type { LetterWorkshopChallenge } from './LetterWorkshop';
import { getLetterTemplate } from './letterWorkshopGeometry';
import { letterWorkshopHarnessStrokes, letterWorkshopMiss } from './letterWorkshopWorkspace';

beforeEach(() => {
  installRuntimeTimers();
  Object.assign(SVGElement.prototype, {
    getScreenCTM: () => ({ inverse: () => ({}) }),
    createSVGPoint: () => ({ x: 0, y: 0, matrixTransform() { return this; } }),
    setPointerCapture: () => {}, hasPointerCapture: () => false, releasePointerCapture: () => {},
  });
});
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const item = (id: string, type: LetterWorkshopChallenge['type'], letter: string): LetterWorkshopChallenge =>
  ({ id, type, templateId: `lowercase-${letter}` });
const mount = (mode: string, challenges: LetterWorkshopChallenge[]) => mountWorkspace({ primitiveId: 'letter-workshop',
  evalMode: mode, instanceId: 'letters',
  data: { title: 'Letter Workshop', description: 'Practice letters.', gradeLevel: 'K', challengeType: mode, challenges } });
const demand = (h: WorkspaceHarness) => h.state().task!.demand as Record<string, unknown>;
const last = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts.at(-1);

/** Pointer strokes on the paper, in its viewBox coordinates. */
function draw(h: WorkspaceHarness, c: LetterWorkshopChallenge, wrong = false) {
  const paper = h.view.container.querySelector('[data-pip-object="paper"]')!;
  const at = (type: string, p: { x: number; y: number }) => {
    const e = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: p.x, clientY: p.y });
    Object.assign(e, { pointerId: 1, pointerType: 'pen', isPrimary: true });
    fireEvent(paper, e);
  };
  for (const stroke of letterWorkshopHarnessStrokes(c, wrong)) act(() => {
    at('pointerdown', stroke[0]); stroke.slice(1).forEach(p => at('pointermove', p)); at('pointerup', stroke[stroke.length - 1]);
  });
}
const check = async (h: WorkspaceHarness) => {
  const button = Array.from(h.view.container.querySelectorAll('button')).find(b => /^Check my/.test(b.textContent?.trim() ?? ''))!;
  await act(async () => { fireEvent.click(button); });
};

it.each(['trace', 'copy', 'write'] as const)('%s mounts under tutor ownership with no scripted turn and no published key', mode => {
  const c = item('a', mode, 't');
  const h = mount(mode, [c]);
  expect(h.state().owner).toBe('tutor');
  expect(h.state().task!.task).toContain(mode === 'write' ? 'letter T' : 'lowercase t');
  expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
  expect(JSON.stringify(demand(h))).not.toMatch(/strokes":\[|templateId|lowercase-t/);
  expect(seam.legacyAI).not.toHaveBeenCalled();
  expect(seam.send.mock.calls.some(([text]) => /SAY_LETTER|ACTIVITY_START|NEXT_ITEM/.test(String(text)))).toBe(false);
  expect(h.view.queryByRole('button', { name: /next letter|finish practice|help me|hear the/i })).toBeNull();
  if (mode === 'write') {
    // Nothing on the screen names or shows the letter; the paper is open without a cue.
    expect(String(demand(h).onScreen)).toMatch(/Nothing on the screen/);
    expect(h.view.queryByTestId('letter-copy-model')).toBeNull();
    expect(h.view.getByTestId('letter-writing-paper').getAttribute('aria-label')).not.toMatch(/\bt\b/);
    expect(h.view.queryByText(/Waiting for your tutor/)).toBeNull();
  }
  draw(h, c);
  expect(demand(h)).toMatchObject({ strokesDrawn: 2 });
  h.close();
});

it.each(['trace', 'copy', 'write'] as const)('%s: a backwards letter commits start_or_order and closes the paper until Try again; a right one completes once', async mode => {
  seam.evaluationContext = { lesson: 'test' };
  const a = item('a', mode, 'l'), b = item('b', mode, 't');
  const h = mount(mode, [a, b]);
  draw(h, a, true); await check(h);
  expect(last(h)).toMatchObject({ correct: false, miss: 'start_or_order' });
  const [facts, options] = seam.send.mock.calls.at(-1)!;
  expect(options).toMatchObject({ author: 'host' });
  expect(facts).toContain('Made 1 stroke on the paper');
  // Closed: no more ink, no Clear, no second check.
  draw(h, a);
  expect(demand(h)).toMatchObject({ strokesDrawn: 1 });
  if (mode === 'write') expect(h.view.getByTestId('letter-copy-model')).toBeTruthy();
  h.dispatch('retry');
  expect(demand(h)).toMatchObject({ strokesDrawn: 0 });
  // Write keeps the model it revealed for Try again.
  if (mode === 'write') expect(String(demand(h).onScreen)).toMatch(/model of the letter is shown/);
  draw(h, a); await check(h);
  expect(h.state().task!.evidence.correctness).toBe('correct');
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('b');
  expect(demand(h)).toMatchObject({ strokesDrawn: 0 });
  draw(h, b); await check(h);
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  expect(seam.submit).toHaveBeenCalledOnce();
  h.close();
});

it('submits nothing without an evaluation provider (the live host)', async () => {
  const c = item('a', 'trace', 'l');
  const h = mount('trace', [c]);
  draw(h, c); await check(h); h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  expect(seam.submit).not.toHaveBeenCalled();
  h.close();
});

it('letterWorkshopMiss names the judge reading before geometry', () => {
  const base = { passed: false, coverage: 1, precision: 1, startAccuracy: 1, directionAccuracy: 1, strokeCountMatch: true, feedback: '' };
  const b = item('x', 'write', 'b');
  expect(letterWorkshopMiss(b, { assessment: base, writtenAs: 'd' })).toBe('reversed');
  expect(letterWorkshopMiss(b, { assessment: base, writtenAs: 'B' })).toBe('wrong_case');
  expect(letterWorkshopMiss(b, { assessment: base, writtenAs: 'h' })).toBe('other_letter');
  expect(letterWorkshopMiss(b, { assessment: base, writtenAs: 'b' })).toBe('direction_or_shape');
  expect(letterWorkshopMiss(b, { assessment: { ...base, strokeCountMatch: false }, writtenAs: null })).toBe('stroke_count');
  expect(letterWorkshopMiss(b, { assessment: { ...base, coverage: 0.5 }, writtenAs: null })).toBe('part_left_out');
  expect(letterWorkshopMiss(b, { assessment: { ...base, precision: 0.5 }, writtenAs: null })).toBe('extra_ink');
  expect(getLetterTemplate('lowercase-b').strokes).toHaveLength(2);
});
