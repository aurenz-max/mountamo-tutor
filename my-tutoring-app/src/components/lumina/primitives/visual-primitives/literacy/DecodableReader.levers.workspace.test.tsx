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

// Read-along (K): the tutor reads the story; the learner says one word. The region is read aloud by the tutor
// (carrier both) and the practice story is a two-sentence read-along item of its own.
const RA = { title: 'Nap Time', gradeLevel: 'K', readingMode: 'read_along', phonicsPatternsInPassage: ['cvc'],
  passage: { sentences: [sentence('s1', 'The fat cat sat on a mat.'), sentence('s2', 'A rat ran to the mat.'), sentence('s3', 'The cat can nap.')] },
  comprehensionQuestions: [{ question: 'What animal sat on a mat?', answerWord: 'cat' }, { question: 'What can the cat do?', answerWord: 'nap' }] };
const mountRA = () => mountWorkspace({ primitiveId: 'decodable-reader', evalMode: 'read_along', data: RA });
const leverState = (h: WorkspaceHarness) => h.state().task!.workspace!.levers!.map(l => [l.id, l.pulled]);

it('read-along: the region is refused before a try and changes nothing; after a miss it shows two sentences in one commit', () => {
  const h = mountRA();
  expect(h.state().task).toMatchObject({ itemId: 'q-1' });
  const levers = leverState(h), attempts = h.state().task!.workspace!.attempts.length, screen = text(h);
  expect(levers).toEqual([['story_region', false], ['short_story', false]]);
  expect(h.dispatch('pull_lever', { lever: 'story_region' }).status).not.toBe('committed');
  expect(leverState(h)).toEqual(levers);
  expect(h.state().task!.workspace!.attempts).toHaveLength(attempts);
  expect(text(h)).toBe(screen);
  expect(q(h, '[data-lever="story-region"]')).toHaveLength(0);

  h.say('rat'); h.feedback('incorrect', 'retry');
  const receipt = h.dispatch('pull_lever', { lever: 'story_region' });
  expect(receipt.status).toBe('committed');
  expect(q(h, '[data-lever="story-region"] p').map(p => p.textContent)).toEqual(['The fat cat sat on a mat.', 'A rat ran to the mat.']);
  expect(q(h, '[data-lever="story-region"] span, [data-lever="story-region"] mark')).toHaveLength(0);
  expect(String(receipt.state.task!.demand.levers_on_screen)).toMatch(/two sentences of the story/);
  expect(String(receipt.state.task!.demand.levers_on_screen)).not.toMatch(/\bcat\b/);
  h.say('cat'); h.feedback('correct');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: true, assisted: true, levers: ['story_region'] });
  h.close();
});

it('read-along: the practice story is ungraded, shares no story word, and the full question comes back blank, then credited', () => {
  const h = mountRA();
  h.say('rat'); h.feedback('incorrect', 'retry');
  h.dispatch('pull_lever', { lever: 'short_story' });
  expect(h.state().task).toMatchObject({ itemId: 'q-1~simpler' });
  const story = h.view.container.querySelector('[data-pip-object="story"]')!.textContent!;
  expect(story).toBe('Ben has a red bus. The bus is big.');
  expect(story).not.toMatch(/\b(fat|cat|sat|mat|rat|ran|nap|animal)\b/i);
  expect(h.view.container.querySelector('[data-pip-object="question"]')!.textContent).toBe('What does Ben have?');
  expect(String(h.state().task!.demand.practice)).toMatch(/practice story of two sentences/);
  h.say('bus'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task).toMatchObject({ itemId: 'q-1' });
  expect(h.view.container.querySelector('[data-pip-object="story"]')!.textContent).toBe('The fat cat sat on a mat. A rat ran to the mat. The cat can nap.');
  expect(text(h)).toMatch(/say your answer/);
  expect(h.view.container.querySelector('.font-black')).toBeNull();
  h.say('cat'); h.feedback('correct');
  const attempts = h.state().task!.workspace!.attempts;
  expect(attempts.map(a => [a.itemId, a.correct])).toEqual([['q-1', false], ['q-1~simpler', true], ['q-1', true]]);
  expect(attempts[1]).toMatchObject({ practice: true });
  expect(attempts.at(-1)).toMatchObject({ assisted: true, levers: ['short_story'] });
  h.close();
});
