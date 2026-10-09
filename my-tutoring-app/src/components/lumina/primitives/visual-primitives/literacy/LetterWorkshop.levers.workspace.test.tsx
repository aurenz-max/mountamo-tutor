// @vitest-environment jsdom
/**
 * letter-workshop levers (`letterWorkshopLevers.ts`), mounted the way a lesson mounts it: a help pull changes the paper
 * (or the model) and the scene fact in one commit and is recorded on the next attempt; a refused pull changes nothing;
 * an easier item is ungraded, the full item comes back blank, and only its answer is credited. jsdom has no 2D canvas,
 * so the vision judge never answers: geometry decides.
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
import { observerLever } from '../../../components/live-activity/runtime/observerLever';
import type { LetterWorkshopChallenge } from './LetterWorkshop';
import { getLetterTemplate } from './letterWorkshopGeometry';
import { letterWorkshopHarnessStrokes } from './letterWorkshopWorkspace';
import {
  ARROWS_LEVER, COPY_PART_LEVER, DOTS_LEVER, FIRST_PART_LEVER, LINES_LEVER, MODEL_STROKES_LEVER, SIMPLER_LETTER_LEVER, TRACE_PART_LEVER,
} from './letterWorkshopLevers';

beforeEach(() => {
  installRuntimeTimers();
  Object.assign(SVGElement.prototype, {
    getScreenCTM: () => ({ inverse: () => ({}) }),
    createSVGPoint: () => ({ x: 0, y: 0, matrixTransform() { return this; } }),
    setPointerCapture: () => {}, hasPointerCapture: () => false, releasePointerCapture: () => {},
  });
});
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const item = (id: string, type: LetterWorkshopChallenge['type'], templateId: string, extra: Partial<LetterWorkshopChallenge> = {}): LetterWorkshopChallenge =>
  ({ id, type, templateId, ...extra });
const mount = (mode: string, challenges: LetterWorkshopChallenge[]) => mountWorkspace({ primitiveId: 'letter-workshop',
  evalMode: mode, instanceId: 'letters',
  data: { title: 'Letter Workshop', description: 'Practice letters.', gradeLevel: 'K', challengeType: mode, challenges } });
const levers = (h: WorkspaceHarness) => h.state().task!.workspace!.levers ?? [];
const attempts = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts;
const demand = (h: WorkspaceHarness) => h.state().task!.demand as Record<string, unknown>;
const paper = (h: WorkspaceHarness) => h.view.getByTestId('letter-writing-paper');
const unchanged = (h: WorkspaceHarness) => JSON.stringify({ d: demand(h), l: levers(h), a: attempts(h), html: h.view.container.innerHTML });

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
const check = async (h: WorkspaceHarness) => {
  const button = Array.from(h.view.container.querySelectorAll('button')).find(b => /^Check my/.test(b.textContent?.trim() ?? ''))!;
  await act(async () => { fireEvent.click(button); });
};

it('trace on hard: start_dots after a backwards trace puts the numbered dots and the fact in one commit, recorded on the next try', async () => {
  const t = item('t1', 'trace', 'lowercase-t', { supportTier: 'hard' });
  const h = mount('trace', [t]);
  expect(levers(h).map(l => [l.id, l.kind, l.pulled])).toEqual([
    [DOTS_LEVER, 'help', false], [ARROWS_LEVER, 'help', false], [LINES_LEVER, 'help', false], [TRACE_PART_LEVER, 'simplify', false]]);
  expect(paper(h).querySelectorAll('[data-testid="letter-start"]')).toHaveLength(0);
  draw(h, t, true); await check(h);
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'start_or_order' });
  expect(observerLever(h.state(), true)).toBe(DOTS_LEVER);
  const receipt = h.dispatch('pull_lever', { lever: DOTS_LEVER });
  expect(receipt.status).toBe('committed');
  expect(String(receipt.state.task!.demand.onScreen)).toContain('A numbered dot on the paper marks where each of the 2 strokes starts.');
  expect(paper(h).querySelectorAll('[data-testid="letter-start"]')).toHaveLength(2);
  const before = unchanged(h);
  expect(h.dispatch('pull_lever', { lever: DOTS_LEVER }).status).toBe('blocked');
  expect(h.dispatch('pull_lever', { lever: FIRST_PART_LEVER }).status).toBe('blocked');
  expect(unchanged(h)).toBe(before);
  h.dispatch('retry');
  draw(h, t); await check(h);
  expect(attempts(h).at(-1)).toMatchObject({ itemId: 't1', correct: true, assisted: true, levers: [DOTS_LEVER] });
  h.close();
});

it('trace: trace_part opens the first stroke alone, ungraded; the whole letter comes back blank and is credited', async () => {
  const t = item('t1', 'trace', 'lowercase-t');
  const h = mount('trace', [t]);
  draw(h, t, true); await check(h);
  const receipt = h.dispatch('pull_lever', { lever: TRACE_PART_LEVER });
  expect(receipt.status).toBe('committed');
  expect(receipt.state.task!.itemId).toBe('t1~simpler');
  expect(receipt.state.task!.workspace!.practice).toEqual({ returnsTo: 't1' });
  expect(demand(h)).toMatchObject({ strokesDrawn: 0, practice: expect.stringMatching(/ungraded/) });
  expect(levers(h)).toEqual([]);
  expect(h.view.container.textContent).toContain('Trace the first part of lowercase t.');
  draw(h, { ...t, part: true }); await check(h);
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('t1');
  expect(demand(h)).toMatchObject({ strokesDrawn: 0 });
  draw(h, t); await check(h);
  expect(attempts(h).map(a => [a.itemId, a.correct, !!(a as { practice?: boolean }).practice])).toEqual([
    ['t1', false, false], ['t1~simpler', true, true], ['t1', true, false]]);
  h.close();
});

it('copy: model_strokes marks the model only; copy_part opens part of the letter beside its part model', () => {
  const c = item('k1', 'copy', 'uppercase-T');
  const h = mount('copy', [c]);
  const receipt = h.dispatch('pull_lever', { lever: MODEL_STROKES_LEVER });
  expect(receipt.status).toBe('committed');
  const model = h.view.getByTestId('letter-copy-model');
  expect(Array.from(model.querySelectorAll('[data-lever="model-strokes"] text')).map(n => n.textContent)).toEqual(['1', '2']);
  expect(paper(h).querySelector('[data-testid="letter-start"]')).toBeNull();
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/model beside the paper has a numbered dot/);
  const easier = h.dispatch('pull_lever', { lever: COPY_PART_LEVER });
  expect(easier.status).toBe('committed');
  expect(easier.state.task!.itemId).toBe('k1~simpler');
  expect(h.view.getByTestId('letter-copy-model').querySelectorAll('path[stroke="#386f72"]')).toHaveLength(1);
  h.close();
});

it('write: first_part draws only the opening of the first stroke; writing_lines shades the short-letter space; the letter stays unnamed on screen', () => {
  const w = item('w1', 'write', 'lowercase-b');
  const h = mount('write', [w, item('w2', 'write', 'lowercase-l')]);
  expect(levers(h).map(l => l.id)).toEqual([DOTS_LEVER, FIRST_PART_LEVER, LINES_LEVER, SIMPLER_LETTER_LEVER]);
  const receipt = h.dispatch('pull_lever', { lever: FIRST_PART_LEVER });
  expect(receipt.status).toBe('committed');
  const part = paper(h).querySelector('[data-lever="first-part"]')!;
  expect(part.getAttribute('d')!.split('L').length).toBeLessThan(getLetterTemplate('lowercase-b').strokes[0].length + 2);
  expect(h.dispatch('pull_lever', { lever: LINES_LEVER }).status).toBe('committed');
  expect(paper(h).querySelector('[data-lever="writing-lines"] rect')).toBeTruthy();
  const facts = String(demand(h).onScreen);
  expect(facts).toMatch(/opening part of the first stroke/);
  expect(facts).not.toMatch(/\bb\b/);
  expect(paper(h).getAttribute('aria-label')).not.toMatch(/\bb\b/);
  // The easier letter: a different letter of the same case, never this one, its mirror, or the next item's.
  const easier = h.dispatch('pull_lever', { lever: SIMPLER_LETTER_LEVER });
  expect(easier.status).toBe('committed');
  expect(easier.state.task!.task).not.toMatch(/letter [BDL] /);
  expect(easier.state.task!.task).toMatch(/^Write the lowercase letter [A-Z] /);
  h.close();
});
