// @vitest-environment jsdom
/**
 * Hundreds chart answered aloud (ROLLOUT.md VB-1): identify_pattern and find_skip_value ask for one choice, so they
 * are spoken items that still take the tap and Check. The observer credits a spoken answer from the tutor's
 * feedback; a Check stays checked by the chart. highlight_sequence and complete_sequence (a set of cells) stay tap-only.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { installRuntimeTimers, resetSeams, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { getComponentById } from '../../../service/manifest/catalog';
import type { HundredsChartChallenge } from './HundredsChart';
import { spokenKeyText } from '../../../components/live-activity/spokenKey';
import { hundredsChartKey, hundredsChartSpokenMisses } from './hundredsChartWorkspace';

beforeEach(() => { resetSeams(); vi.clearAllMocks(); installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const flushScoring = () => act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });
const base = { skipValue: 5, startNumber: 5, correctAnswer: '', options: [] as string[], hint: '' };
const IDENTIFY: HundredsChartChallenge = { ...base, id: 'i', type: 'identify_pattern', instruction: 'Which description matches the pattern?',
  givenCells: [5, 10, 15, 20], correctCells: [5, 10, 15, 20], correctAnswer: 'Two vertical columns (5th and 10th)',
  options: ['They fill every other row', 'Every other cell in each row', 'Two vertical columns (5th and 10th)', 'A diagonal stripe across the grid'] };
const FIND: HundredsChartChallenge = { ...base, id: 'f', type: 'find_skip_value', instruction: 'What is the skip value?',
  givenCells: [5, 10, 15], correctCells: [5, 10, 15], options: ['2', '5', '10', '3'] };
const HIGHLIGHT: HundredsChartChallenge = { ...base, id: 'h', type: 'highlight_sequence', instruction: 'Tap every number counting by 5s.',
  givenCells: [], correctCells: [5, 10, 15, 20] };
const COMPLETE: HundredsChartChallenge = { ...HIGHLIGHT, id: 'c', type: 'complete_sequence', instruction: 'Tap the rest.', givenCells: [5, 10] };

const mount = (challenges: HundredsChartChallenge[]) => mountWorkspace({ primitiveId: 'hundreds-chart', evalMode: challenges[0].type,
  data: { title: 'Skip counting', gridMax: 20, gradeBand: '1', challenges } });
const chosen = (h: WorkspaceHarness, option: string) =>
  h.view.container.querySelector(`button[data-pip-object="option-${option}"]`)!.className;

/** One spoken challenge per converted mode: a wrong and a right spoken answer, the right choice, and its key in the scene. */
const SPOKEN: Array<[string, HundredsChartChallenge, string, string, string]> = [
  ['identify_pattern', IDENTIFY, 'a diagonal', 'two columns', 'Two vertical columns (5th and 10th)'],
  ['find_skip_value', FIND, 'ten', 'five', '5'],
];

it.each(SPOKEN)('%s: a wrong spoken answer retries, a right one credited by the tutor completes once', async (_m, c, wrong, right) => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount([c]);
  const task = h.state().task!;
  expect(task.demand.response).toBe('speech');
  expect(task.workspace!.expectedAnswer).toBeTruthy();
  // The scene lists the printed choices, but never which one is right.
  expect(JSON.stringify(task.demand)).not.toMatch(/correct|is added 5|by 5/i);
  h.say(wrong); h.feedback('incorrect', 'retry');
  expect(h.state().status).not.toBe('completed');
  h.say(right); h.feedback('correct', 'advance');
  h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await flushScoring();
  expect(seam.submit).toHaveBeenCalledOnce();
  expect(seam.submit.mock.calls[0][3]).toMatchObject({ challengeResults: [{ challengeId: c.id, correct: true, attempts: 1, score: 100 }] });
});

it.each(SPOKEN)('%s: a credited spoken answer marks the choice correct', (_m, c, _w, right, key) => {
  // A second challenge keeps the lesson open, so the choices stay drawn after the credit.
  const h = mount([c, { ...c, id: `${c.id}2` }]);
  const before = chosen(h, key);
  h.say(right); h.feedback('correct');
  expect(chosen(h, key)).not.toBe(before);
  expect(h.view.container.textContent).toContain('Correct!');
});

it.each(SPOKEN)('%s: a Check after a spoken answer is checked by the chart and ends the pending speech', (_m, c, _w, right, key) => {
  const h = mount([c]);
  h.say(right);
  expect(h.state().task!.workspace!.pendingResponse).toBeDefined();
  h.touch(`option-${key}`); h.press('Check Answer');
  expect(h.state().task!.evidence.correctness).toBe('correct');
  expect(h.state().task!.workspace!.pendingResponse).toBeUndefined();
});

it('a correct Check is recorded once, though onSolved fires for it too', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount([FIND, { ...FIND, id: 'f2' }]);
  h.touch('option-5'); h.press('Check Answer');
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('f2');
  h.touch('option-5'); h.press('Check Answer');
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await flushScoring();
  expect(seam.submit).toHaveBeenCalledOnce();
  expect(seam.submit.mock.calls[0][2]).toMatchObject({ totalChallenges: 2, correctCount: 2, averageAttempts: 1 });
});

it('highlight_sequence and complete_sequence stay tap-only with no key', () => {
  for (const c of [HIGHLIGHT, COMPLETE]) {
    const h = mount([c]);
    expect(h.state().task!.demand.response, c.type).toBe('gesture');
    expect(h.state().task!.workspace!.expectedAnswer, c.type).toBeUndefined();
    expect(String(h.state().task!.demand.constraints), c.type).not.toMatch(/says/);
    cleanup();
  }
});

it('every spoken miss is one the catalog lists for its mode, and no example is a way to say the key', () => {
  const lists = getComponentById('hundreds-chart')!.teachingWorkspace!.misses as Record<string, readonly string[]>;
  const cases = [IDENTIFY, FIND, { ...FIND, skipValue: 2, options: ['2', '4', '1', '3'] }, { ...FIND, skipValue: 10, options: ['10', '5', '20', '2'] },
    { ...IDENTIFY, correctAnswer: 'Every other cell in each row', options: ['They are scattered randomly', 'A checkerboard pattern', 'Every other cell in each row', 'They fill every row completely'] }];
  for (const c of cases) {
    const misses = hundredsChartSpokenMisses(c);
    expect(misses.length).toBeGreaterThan(0);
    expect(new Set(misses.map(m => m.id)).size).toBe(misses.length);
    const key = c.type === 'identify_pattern' ? c.correctAnswer : String(c.skipValue);
    for (const m of misses) {
      expect(lists[c.type], `${c.type} ${m.id}`).toContain(m.id);
      for (const e of m.examples ?? []) expect(e, `${c.type} ${m.id}`).not.toBe(key);
    }
  }
  // Two of the four descriptions are scattered shapes: one entry names both.
  const scattered = hundredsChartSpokenMisses(cases[4]).find(m => m.id === 'chose_scattered')!;
  expect(scattered.examples).toEqual(['They are scattered randomly', 'the first one', 'A checkerboard pattern', 'the second one']);
  expect(hundredsChartSpokenMisses(FIND).map(m => m.id)).toEqual(['twice_the_step', 'one_short', 'one_over', 'short_by_more', 'over_by_more']);
  expect(spokenKeyText(hundredsChartKey(IDENTIFY)!)).toContain('"the third one"');
  expect(hundredsChartKey(HIGHLIGHT)).toBeNull();
});
