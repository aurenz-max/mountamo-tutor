// @vitest-environment jsdom
/**
 * agent-canvas on its boss (`agentCanvas.boss.ts`): what is its own. The generic W1 contract
 * (runtime/workspaceContract.test.tsx) covers ownership, the packet and self-advance.
 * The canvas page does not run in jsdom, so these tests deliver the page's reports from its frame, as the journey does.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('canvas-confetti', () => ({ default: vi.fn() }));
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../../components/live-activity/runtime/testing/workspaceHarness';
import type { AgentCanvasData } from './AgentCanvas';
import { agentCanvasBoss, validateAgentCanvasData } from './agentCanvas.boss';
import type { CanvasChallenge } from './agentCanvasWorkspace';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const PAGE = '<!doctype html><html><body><div id="root"></div><script>/* lumina-display */</script></body></html>';
const canvas = (id: string, ask: string): CanvasChallenge => ({ id, title: 'Patio', ask, goal: 'width times height equals 18', html: PAGE,
  proof: [{ do: 'click', target: '#width-plus' }], miss: [{ do: 'click', target: '#deliver' }], scene: { width: 1, height: 1, delivered: false } });
const DATA: AgentCanvasData = { title: 'Patio Paver Delivery', description: '', challengeType: 'canvas',
  challenges: [canvas('canvas-1', 'Use all 18 pavers.'), canvas('canvas-2', 'Use all 24 pavers.')] };

const mount = () => {
  const h = mountWorkspace({ primitiveId: 'agent-canvas', evalMode: 'canvas', instanceId: 'agent-canvas', data: DATA as never });
  h.settle(1000);
  return h;
};
const frame = (h: WorkspaceHarness) => h.view.container.querySelector<HTMLIFrameElement>('iframe[data-canvas-frame]')!;
/** What the page posts, from this frame (or from another window). */
const post = (h: WorkspaceHarness, kind: string, data: unknown, source: unknown = frame(h).contentWindow) =>
  act(() => { window.dispatchEvent(new MessageEvent('message', { source: source as Window, data: { source: 'lumina-display', kind, data } })); });
const demand = (h: WorkspaceHarness) => h.state().task!.demand as Record<string, unknown>;
const last = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts.at(-1);
const check = (h: WorkspaceHarness) => Array.from(h.view.container.querySelectorAll('button')).find(b => /check/i.test(b.textContent ?? ''))!;

it('binds as a gesture with no key: the goal the program checks reaches neither the screen nor the tutor', () => {
  const h = mount();
  expect(h.state().owner).toBe('tutor');
  expect(seam.legacyAI).not.toHaveBeenCalled();
  expect(h.state().task!.task).toBe(agentCanvasBoss.assignment(DATA.challenges[0]).task);
  expect(demand(h).response).toBe('gesture');
  expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
  expect(JSON.stringify(h.packet())).not.toContain('equals 18');
  expect(h.view.container.textContent).not.toContain('equals 18');
  // The page runs with scripts only: an opaque origin, no access to the app.
  expect(frame(h).getAttribute('sandbox')).toBe('allow-scripts');
  h.close();
});

it('Check waits for the page to report, and only this frame\'s reports count', () => {
  const h = mount();
  expect(check(h).disabled).toBe(true);
  post(h, 'goal', true, window);
  expect(check(h).disabled).toBe(true);
  post(h, 'goal', false);
  expect(check(h).disabled).toBe(false);
  h.close();
});

it('a wrong canvas is a miss that keeps the work; the goal met credits; each hand action sounds; it submits once', () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount();
  post(h, 'act', { type: 'tap', id: 'width-plus' });
  post(h, 'act', { type: 'drop', id: 'handle', to: 'slot-2' });
  expect(seam.sound.playById.mock.calls.map(c => c[0])).toEqual(['tap', 'snap']);
  post(h, 'scene', { width: 4, height: 3, delivered: true });
  post(h, 'goal', false);
  h.press('Check');
  expect(last(h)).toMatchObject({ correct: false, miss: 'goal_unmet' });
  // The attempt records what the canvas showed, in the page's own facts.
  expect(JSON.stringify(last(h))).toContain('width\\":4');
  expect(seam.sound.playIncorrect).toHaveBeenCalledOnce();
  // Closed until Try again: a second Check does nothing, and the frame is covered.
  expect(check(h).disabled).toBe(true);
  const before = frame(h);
  h.dispatch('retry'); h.confirmVisible();
  // Try again keeps the same page: the child changes their work.
  expect(frame(h)).toBe(before);
  post(h, 'scene', { width: 6, height: 3, delivered: true });
  post(h, 'goal', true);
  h.press('Check');
  expect(last(h)).toMatchObject({ correct: true });
  expect(seam.sound.playCorrect).toHaveBeenCalledOnce();
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('canvas-2');
  // A new item is a new page: nothing the last one reported holds.
  expect(check(h).disabled).toBe(true);
  post(h, 'goal', true);
  h.press('Check');
  h.dispatch('advance'); h.confirmVisible(); h.settle();
  expect(h.state().status).toBe('completed');
  expect(seam.submit).toHaveBeenCalledOnce();
  const [, , metrics, work] = seam.submit.mock.calls[0];
  expect(metrics).toMatchObject({ type: 'agent-canvas', challengeType: 'canvas', totalChallenges: 2, correctCount: 2, firstTryCount: 1 });
  expect(work.teachingAttempts.map((a: { correct: boolean }) => a.correct)).toEqual([false, true, true]);
  h.close();
});

it('rejects a canvas its author never played both ways', () => {
  expect(() => validateAgentCanvasData({ ...DATA, challenges: [{ ...DATA.challenges[0], miss: [] }] })).toThrow('wrong attempt');
  expect(() => validateAgentCanvasData({ ...DATA, challenges: [{ ...DATA.challenges[0], proof: [] }] })).toThrow('played it to the goal');
  expect(validateAgentCanvasData(DATA).challenges).toHaveLength(2);
});

it('several problems share one page: each frame gets the page with its own params, and a lesson with no page is rejected', () => {
  const shared = PAGE.replace('/* lumina-display */', '/* lumina-display */ var params = {"__LUMINA_PARAMS__":true};');
  const problem = (id: string, params: Record<string, unknown>): CanvasChallenge => { const { html: _html, ...rest } = canvas(id, 'Make the slope.'); return { ...rest, params }; };
  const data: AgentCanvasData = { ...DATA, page: shared, challenges: [problem('canvas-1', { targetRise: 3, note: '</script>' }), problem('canvas-2', { targetRise: 2 })] };
  expect(() => validateAgentCanvasData({ ...data, page: undefined })).toThrow('no canvas page');
  const h = mountWorkspace({ primitiveId: 'agent-canvas', evalMode: 'canvas', instanceId: 'agent-canvas', data: data as never });
  h.settle(1000);
  const doc = frame(h).getAttribute('srcdoc') ?? '';
  expect(doc).toContain('"targetRise":3');
  expect(doc).not.toContain('__LUMINA_PARAMS__');
  // A string value cannot close the page's script tag.
  expect(doc).not.toContain('</script>"');
  expect(doc).toContain('\u003c/script>');
  h.close();
});
