// @vitest-environment jsdom
/**
 * Skip counting runner answered aloud (ROLLOUT.md VB-1; boss `skipCounting.boss.ts`): predict, find_skip_value,
 * connect_multiplication and a one-gap fill_missing ask for one number, so they are SAY_OR_SHOW items that still take
 * the typed number and Check. The observer credits a spoken answer from the tutor's feedback; a Check stays checked by
 * the activity. count_along and a fill_missing item with two or more gaps have no key and stay on screen.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { installRuntimeTimers, resetSeams, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { getComponentById } from '../../../service/manifest/catalog';
import type { SkipCountingChallenge, SkipCountingRunnerData } from './SkipCountingRunner';
import { skipCountingBoss } from './skipCounting.boss';
import { skipKey, skipSpokenMisses, spokenSkipKey, type SkipLine } from './skipCountingWorkspace';

beforeEach(() => { resetSeams(); vi.clearAllMocks(); installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const flushScoring = () => act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });
const LINE: SkipLine = { skipValue: 5, startFrom: 0, endAt: 30, direction: 'forward' };
const base = { hint: '', narration: '' };
const PREDICT: SkipCountingChallenge = { ...base, id: 'p', type: 'predict', instruction: 'Where does it land next?', startPosition: 15 };
const FIND: SkipCountingChallenge = { ...base, id: 's', type: 'find_skip_value', instruction: 'How far is each jump?', startPosition: 0 };
const CONNECT: SkipCountingChallenge = { ...base, id: 'm', type: 'connect_multiplication', instruction: 'How many jumps to reach 20?', startPosition: 20 };
const FILL1: SkipCountingChallenge = { ...base, id: 'f', type: 'fill_missing', instruction: 'Type the missing number.', startPosition: 0, hiddenPositions: [15] };
const FILL2: SkipCountingChallenge = { ...FILL1, id: 'f2', hiddenPositions: [10, 20] };
const ALONG: SkipCountingChallenge = { ...base, id: 'a', type: 'count_along', instruction: 'Tap each landing.', startPosition: 0 };

const BOX: Record<string, string> = { predict: 'Next landing', fill_missing: 'Missing number', find_skip_value: 'Skip value',
  connect_multiplication: 'Number of jumps' };
const typeAndCheck = (h: WorkspaceHarness, c: SkipCountingChallenge, text: string) => {
  act(() => {
    const box = h.view.container.querySelector(`input[aria-label="${BOX[c.type]}"]`) as HTMLInputElement;
    fireEvent.change(box, { target: { value: text } });
  });
  h.press('Check Answer');
};
const mount = (challenges: SkipCountingChallenge[]) => mountWorkspace({ primitiveId: 'skip-counting-runner',
  evalMode: challenges[0].type, instanceId: 'skip',
  data: { title: 'Hops', ...LINE, character: { type: 'frog' }, challenges, gradeBand: '1-2' } as SkipCountingRunnerData as never });

/** One spoken challenge per converted mode: a wrong and a right spoken answer, the typed key, and the key in the scene. */
const SPOKEN: Array<[string, SkipCountingChallenge, string, string, string, RegExp, string]> = [
  ['predict', PREDICT, 'sixteen', 'twenty', '20', /\b20\b/, 'Yes! 20 is correct!'],
  ['find_skip_value', FIND, 'ten', 'five', '5', /\b5\b|by 5/, "You got it! We're counting by 5s!"],
  ['connect_multiplication', CONNECT, 'twenty', 'four jumps', '4', /\b4\b/, 'Correct! 4 × 5 = 20'],
  ['fill_missing (one gap)', FILL1, 'sixteen', 'fifteen', '15', /\b15\b/, 'Yes! 15 is in the sequence!'],
];

it.each(SPOKEN)('%s: a wrong spoken answer retries, a right one credited by the tutor completes once', async (_m, c, wrong, right, _t, key) => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount([c]);
  const task = h.state().task!;
  expect(task.demand.response).toBe('speech');
  expect(task.workspace!.expectedAnswer).toBeTruthy();
  // Said or shown; the scene never states the answer.
  expect(skipCountingBoss.assignment({ ...c, line: LINE }).acceptsGesture).toBe(true);
  expect(JSON.stringify(task.demand)).not.toMatch(key);
  h.say(wrong); h.feedback('incorrect', 'retry');
  expect(h.state().status).not.toBe('completed');
  h.say(right); h.feedback('correct', 'advance');
  h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await flushScoring();
  expect(seam.submit).toHaveBeenCalledOnce();
});

it.each(SPOKEN)('%s: a credited spoken number is shown as a correct check shows it', (_m, c, _w, right, _t, _k, shown) => {
  const h = mount([c]);
  h.say(right); h.feedback('correct');
  expect(screen.getByText(shown)).toBeTruthy();
});

it('after a credited spoken answer the next challenge still takes the typed answer', () => {
  const h = mount([PREDICT, { ...PREDICT, id: 'p2', startPosition: 5 }]);
  h.say('twenty'); h.feedback('correct');
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('p2');
  typeAndCheck(h, PREDICT, '10');
  expect(h.state().task!.evidence.correctness).toBe('correct');
});

it.each(SPOKEN)('%s: a Check after a spoken answer is checked by the activity and ends the pending speech', (_m, c, _w, right, typed) => {
  const h = mount([c]);
  h.say(right);
  expect(h.state().task!.workspace!.pendingResponse).toBeDefined();
  typeAndCheck(h, c, typed);
  expect(h.state().task!.evidence.correctness).toBe('correct');
  expect(h.state().task!.workspace!.pendingResponse).toBeUndefined();
});

it('a correct check is recorded once, though onSolved fires for it too', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount([CONNECT]);
  typeAndCheck(h, CONNECT, '4');
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await flushScoring();
  expect(seam.submit).toHaveBeenCalledOnce();
  expect(seam.submit.mock.calls[0][2]).toMatchObject({ attemptsCount: 1, multiplicationConnectionMade: true });
  expect(seam.submit.mock.calls[0][3]).toEqual({ challengeResults: [{ challengeId: 'm', correct: true, attempts: 1 }] });
});

it('count_along and a fill_missing item with two gaps stay on screen with no key', () => {
  for (const c of [ALONG, FILL2]) {
    const h = mount([c]);
    expect(h.state().task!.demand.response, c.id).toBe('gesture');
    expect(h.state().task!.workspace!.expectedAnswer, c.id).toBeUndefined();
    expect(skipCountingBoss.assignment({ ...c, line: LINE }).acceptsGesture, c.id).toBeFalsy();
    cleanup();
  }
});

it('every spoken miss is one the catalog lists for its mode, and no example is a way to say the key', () => {
  const lists = getComponentById('skip-counting-runner')!.teachingWorkspace!.misses as Record<string, readonly string[]>;
  const lines: SkipLine[] = [LINE, { skipValue: 2, startFrom: 0, endAt: 20, direction: 'forward' },
    { skipValue: 10, startFrom: 100, endAt: 0, direction: 'backward' }, { skipValue: 3, startFrom: 3, endAt: 30, direction: 'forward' }];
  for (const ln of lines) {
    const step = ln.direction === 'backward' ? -ln.skipValue : ln.skipValue;
    const cases = [PREDICT, FIND, CONNECT, FILL1].map(c => c.type === 'find_skip_value' ? c
      : { ...c, startPosition: ln.startFrom + 3 * step, hiddenPositions: c.hiddenPositions && [ln.startFrom + 2 * step] });
    for (const c of cases) {
      const key = spokenSkipKey(c, ln);
      expect(key, `${c.type} ${ln.skipValue}`).not.toBeNull();
      const misses = skipSpokenMisses({ ...c, line: ln });
      expect(misses.length).toBeGreaterThan(0);
      expect(new Set(misses.map(m => m.id)).size).toBe(misses.length);
      const keyForms = [String(key), ...skipKey({ ...c, line: ln })!.alsoAccept];
      for (const m of misses) {
        expect(lists[c.type], `${c.type} ${m.id}`).toContain(m.id);
        for (const e of m.examples ?? []) expect(keyForms, `${c.type} ${m.id}`).not.toContain(e);
      }
    }
  }
  // 15 on a count by 5: standing on 15, counting on by one (16), two jumps (25), the landing before (10).
  expect(skipSpokenMisses({ ...PREDICT, line: LINE }).map(m => [m.id, m.examples?.[0]])).toEqual(expect.arrayContaining([
    ['stayed_put', 'fifteen'], ['added_one', 'sixteen'], ['two_jumps', '25'], ['wrong_way', 'ten']]));
  expect(skipSpokenMisses({ ...CONNECT, line: LINE }).slice(0, 2).map(m => m.id)).toEqual(['typed_product', 'typed_skip']);
  expect(skipKey({ ...CONNECT, line: LINE })!.signatureError).toContain('The number reached (20)');
});
