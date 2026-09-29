// @vitest-environment jsdom
/**
 * decodable-reader's levers on the shared teaching workspace (handoff 22 L3), mounted the way a lesson mounts it.
 * A pull marks the line in the same commit and nothing is said; the practice line is ungraded and gives the story
 * line back; the story region waits for a wrong answer.
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

const sentence = (id: string, text: string) => ({ id, words: text.split(' ').map((t, i) => ({ id: `${id}-${i}`, text: t,
  phonicsPattern: /^[a-z]{3}\W*$/i.test(t) ? 'cvc' : 'sight' })) });
const DATA = { title: 'The Cat', gradeLevel: '1', comprehensionType: 'literal', phonicsPatternsInPassage: ['cvc'],
  passage: { sentences: [sentence('s1', 'The cat sat on the mat.'), sentence('s2', 'The cat had a red hat.')] },
  comprehensionQuestions: [{ question: 'What did the cat have?', answerWord: 'hat' }] };
const mount = () => mountWorkspace({ primitiveId: 'decodable-reader', evalMode: 'literal', data: DATA });
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));
const text = (h: WorkspaceHarness) => h.view.container.textContent ?? '';

it('the underline and dots mark the line in one commit, nothing said; the next read carries both levers', () => {
  const h = mount();
  const sent = seam.send.mock.calls.length;
  h.dispatch('pull_lever', { lever: 'tracking_underline' });
  expect(q(h, '[data-track-segment]')).toHaveLength(6);
  const receipt = h.dispatch('pull_lever', { lever: 'sound_dots' });
  expect(q(h, '[data-sound-dot]').length).toBeGreaterThanOrEqual(12);
  expect(seam.send.mock.calls.length).toBe(sent);
  expect(String(receipt.state.task!.demand.levers_on_screen)).not.toMatch(/\bcat\b|\bmat\b/);
  expect(Array.from(q(h, '[data-print-word]')).map(w => w.textContent).join(' ')).toBe('The cat sat on the mat.');
  h.say('The cat sat on the mat.'); h.feedback('correct');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: true, assisted: true, levers: ['tracking_underline', 'sound_dots'] });
  h.close();
});

it('the practice line is ungraded, prints no story word, and gives the story line back', () => {
  const h = mount();
  h.say('The cat sat on a mat.'); h.feedback('incorrect', 'retry');
  h.dispatch('pull_lever', { lever: 'short_line' });
  expect(h.state().task).toMatchObject({ itemId: 'line-s1~simpler' });
  expect(h.view.container.querySelector('[data-pip-object="line"]')!.textContent).not.toMatch(/\b(the|cat|sat|on|mat|had|a|red|hat)\b/i);
  h.say('Sam can hop.'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task).toMatchObject({ itemId: 'line-s1' });
  expect(text(h)).toMatch(/The cat sat on the mat\./);
  h.say('The cat sat on the mat.'); h.feedback('correct');
  expect(h.state().task!.workspace!.attempts.map(a => [a.itemId, a.correct])).toEqual([
    ['line-s1', false], ['line-s1~simpler', true], ['line-s1', true]]);
  h.close();
});

it('the story region is refused before a try, then shows two whole sentences with nothing marked', () => {
  const h = mount();
  for (const line of ['The cat sat on the mat.', 'The cat had a red hat.']) { h.say(line); h.feedback('correct', 'advance'); h.confirmVisible(); }
  expect(h.state().task).toMatchObject({ itemId: expect.stringMatching(/^q/) });
  const refused = h.dispatch('pull_lever', { lever: 'story_region' });
  expect(refused.status).not.toBe('committed');
  expect(q(h, '[data-lever="story-region"]')).toHaveLength(0);
  h.say('cat'); h.feedback('incorrect', 'retry');
  expect(h.dispatch('pull_lever', { lever: 'story_region' }).status).toBe('committed');
  const region = q(h, '[data-lever="story-region"] p').map(p => p.textContent);
  expect(region).toEqual(['The cat sat on the mat.', 'The cat had a red hat.']);
  expect(q(h, '[data-lever="story-region"] span, [data-lever="story-region"] mark')).toHaveLength(0);
  h.close();
});
