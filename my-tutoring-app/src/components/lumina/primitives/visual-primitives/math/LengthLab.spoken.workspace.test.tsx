// @vitest-environment jsdom
/**
 * Length lab answered aloud (ROLLOUT.md VB-1): compare and indirect ask for one choice, so they are spoken items that
 * still take the tap. The observer credits a spoken answer from the tutor's feedback; the tap stays checked by the
 * activity. Laying units, measuring with two units and putting objects in order stay tap-only.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, screen } from '@testing-library/react';
import { installRuntimeTimers, resetSeams, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { getComponentById } from '../../../service/manifest/catalog';
import type { LengthLabChallenge } from './LengthLab';
import { lengthSpokenMisses } from './lengthLabWorkspace';

beforeEach(() => { resetSeams(); vi.clearAllMocks(); installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const flushScoring = () => act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });

const base = { hint: 'Look again.', narration: '', objectColor0: '#f00', objectColor1: '#0f0' };
const COMPARE: LengthLabChallenge = { ...base, id: 'c', type: 'compare', instruction: 'Which one is shorter?',
  objectName0: 'crayon', objectLength0: 3, objectName1: 'pencil', objectLength1: 5, correctAnswer: 'shorter' };
const INDIRECT: LengthLabChallenge = { ...base, id: 'i', type: 'indirect', instruction: 'Which is longer?',
  objectName0: 'pencil', objectLength0: 4, objectName1: 'ribbon', objectLength1: 8, correctAnswer: 'ribbon',
  clue0: 'The pencil is shorter than the string.', clue1: 'The ribbon is longer than the string.',
  referenceObjectName: 'string', referenceObjectLength: 6, referenceObjectColor: '#888' };

/** One spoken challenge per converted mode, with a wrong and a right spoken answer and the tap that is right. */
const SPOKEN: Array<[string, LengthLabChallenge, string, string, string]> = [
  ['compare', COMPARE, 'the pencil', 'the crayon', 'crayon is shorter'],
  ['indirect', INDIRECT, 'the pencil', 'the ribbon is longer', 'ribbon is longer'],
];
const lab = (challenges: LengthLabChallenge[]) =>
  ({ title: 'Lengths', description: '', unitType: 'cubes', gradeBand: 'K', challenges }) as unknown as Record<string, unknown>;
const mount = (mode: string, challenges: LengthLabChallenge[]) =>
  mountWorkspace({ primitiveId: 'length-lab', evalMode: mode, data: lab(challenges) });

it.each(SPOKEN)('%s: a wrong spoken answer retries, a right one credited by the tutor completes once', async (mode, c, wrong, right) => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount(mode, [c]);
  const task = h.state().task!;
  expect(task.demand.response).toBe('speech');
  expect(task.workspace!.expectedAnswer).toBeTruthy();
  // The scene says how the learner answers, never the answer.
  expect(String(task.demand.constraints)).toMatch(/says the answer/);
  expect(JSON.stringify(task)).not.toMatch(/correctAnswer|objectLength|\b[3458]\b/);
  h.say(wrong); h.feedback('incorrect', 'retry');
  expect(h.state().status).not.toBe('completed');
  h.say(right); h.feedback('correct', 'advance');
  h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await flushScoring();
  expect(seam.submit).toHaveBeenCalledOnce();
});

it('a credited spoken answer shows the credited choice, and the next challenge still takes the tap', () => {
  const h = mount('compare', [COMPARE, { ...COMPARE, id: 'c2', instruction: 'Which one is longer?', objectName0: 'rope',
    objectLength0: 9, objectName1: 'spoon', objectLength1: 4, correctAnswer: 'longer' }]);
  h.say('the crayon'); h.feedback('correct');
  expect(h.state().task!.demand).toMatchObject({ learnerWork: 'Chose: the crayon is shorter' });
  expect(screen.getByText("That's right!")).toBeTruthy();
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('c2');
  h.press('rope is longer');
  expect(h.state().task!.evidence.correctness).toBe('correct');
});

it.each(SPOKEN)('%s: a tap after a spoken answer is checked by the activity and ends the pending speech', (mode, c, _wrong, right, tap) => {
  const h = mount(mode, [c]);
  h.say(right);
  expect(h.state().task!.workspace!.pendingResponse).toBeDefined();
  h.press(tap);
  expect(h.state().task!.evidence.correctness).toBe('correct');
  expect(h.state().task!.workspace!.pendingResponse).toBeUndefined();
});

it('a correct tap is recorded once, though onSolved fires for it too', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('indirect', [INDIRECT]);
  h.press('ribbon is longer');
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await flushScoring();
  expect(seam.submit).toHaveBeenCalledOnce();
  expect(seam.submit.mock.calls[0][2]).toMatchObject({ totalChallenges: 1, correctAnswers: 1, totalAttempts: 1 });
});

it('laying units, measuring with two units and ordering stay tap-only with no key', () => {
  const tile = { ...base, objectName0: 'straw', objectLength0: 6, objectName1: '', objectLength1: 0, correctAnswer: '6',
    correctUnitCount: 6, unitType: 'cubes', estimateOptions: [4, 5, 6, 7] };
  const kept: LengthLabChallenge[] = [
    { ...tile, id: 'k', type: 'tile_and_count', instruction: 'How many cubes long is the straw?' },
    { ...tile, id: 'e', type: 'estimate_then_tile', instruction: 'Guess, then measure the straw.' },
    { ...tile, id: 't', type: 'two_unit_compare', instruction: 'Measure the straw twice.', correctAnswer: 'cubes', unitTypeB: 'bears', correctUnitCountB: 2 },
    { ...base, id: 'o', type: 'order', instruction: 'Shortest to longest.', objectName0: 'pencil', objectLength0: 5, objectName1: 'crayon',
      objectLength1: 3, objectName2: 'marker', objectLength2: 7, objectColor2: '#00f', correctAnswer: 'crayon,pencil,marker',
      correctOrderCsv: 'crayon,pencil,marker' },
  ];
  for (const c of kept) {
    const h = mount(c.type, [c]);
    expect(h.state().task!.demand.response, c.type).toBe('gesture');
    expect(h.state().task!.workspace!.expectedAnswer, c.type).toBeUndefined();
    cleanup();
  }
});

it('every spoken miss is one the catalog lists for its mode, and none is the answer', () => {
  const lists = getComponentById('length-lab')!.teachingWorkspace!.misses as Record<string, readonly string[]>;
  const cases: Array<[string, LengthLabChallenge, string]> = [
    ['compare', COMPARE, 'the crayon'],
    ['compare', { ...COMPARE, correctAnswer: 'longer', objectLength0: 7 }, 'the crayon'],
    ['compare', { ...COMPARE, correctAnswer: 'same', objectLength0: 5 }, 'the same'],
    ['indirect', INDIRECT, 'the ribbon'],
    ['indirect', { ...INDIRECT, correctAnswer: 'same' }, 'the same'],
  ];
  for (const [mode, c, key] of cases) {
    const misses = lengthSpokenMisses(c);
    expect(misses.length).toBeGreaterThan(0);
    expect(new Set(misses.map(m => m.id)).size).toBe(misses.length);
    for (const m of misses) {
      expect(lists[mode]).toContain(m.id);
      for (const e of m.examples ?? []) expect(e.toLowerCase()).not.toBe(key.toLowerCase());
    }
  }
});
