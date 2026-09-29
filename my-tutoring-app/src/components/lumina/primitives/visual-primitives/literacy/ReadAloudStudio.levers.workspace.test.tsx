// @vitest-environment jsdom
/**
 * read-aloud-studio's levers on the shared teaching workspace (handoff 22 L3), mounted the way a lesson mounts it.
 * A pull marks the line in the same commit and nothing is said; the practice line is ungraded and gives the line back.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const LINE = 'Green frogs sit still upon large lily pads.';
const mount = () => mountWorkspace({ primitiveId: 'read-aloud-studio', evalMode: 'accuracy',
  data: { title: 'Pond', gradeLevel: '3', fluencyFocus: 'accuracy', lexileLevel: '520L', lines: [{ text: LINE }] } });
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));

it('the underline and dots mark the line in one commit, nothing said, the words unchanged', () => {
  const h = mount();
  const sent = seam.send.mock.calls.length;
  const receipt = h.dispatch('pull_lever', { lever: 'tracking_underline' });
  expect(receipt.status).toBe('committed');
  expect(q(h, '[data-track-segment]')).toHaveLength(8);
  h.dispatch('pull_lever', { lever: 'sound_dots' });
  expect(q(h, '[data-sound-dot]').length).toBeGreaterThan(20);
  expect(q(h, '[data-print-word]').map(w => w.textContent).join(' ')).toBe(LINE);
  expect(seam.send.mock.calls.length).toBe(sent);
  h.say(LINE); h.feedback('correct');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: true, assisted: true, levers: ['tracking_underline', 'sound_dots'] });
  h.close();
});

it('the practice line is ungraded, prints no passage word, and gives the line back', () => {
  const h = mount();
  h.say('Green frogs sit on large lily pads.'); h.feedback('incorrect', 'retry');
  h.dispatch('pull_lever', { lever: 'short_line' });
  expect(h.state().task).toMatchObject({ itemId: 'line-1~simpler' });
  expect(h.view.container.textContent).not.toMatch(/frogs|lily/);
  h.say('Sam can hop.'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task).toMatchObject({ itemId: 'line-1' });
  expect(h.view.container.textContent).toContain(LINE);
  h.say(LINE); h.feedback('correct');
  expect(h.state().task!.workspace!.attempts.map(a => [a.itemId, a.correct])).toEqual([
    ['line-1', false], ['line-1~simpler', true], ['line-1', true]]);
  h.close();
});
