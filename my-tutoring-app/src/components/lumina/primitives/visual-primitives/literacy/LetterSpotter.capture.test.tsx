// @vitest-environment jsdom
/**
 * The judged evidence letter spotter owes the capture layer, on the teaching workspace: a run that
 * passes on the average but was mostly right only after a correction must still fail the
 * first-response gate, and a confusion pair comes only from a corrected letter.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { isDiagnosableFailure } from '../../../evaluation/diagnosis/types';

beforeEach(() => { installRuntimeTimers(); seam.evaluationContext = { lesson: 'test' }; });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const flushScoring = () => act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });
const nameIt = (id: string, letter: string, word: string, sentence: string) =>
  ({ id, mode: 'name-it', targetLetter: letter, targetCase: 'lowercase', targetWord: word, sentence, spokenSentence: sentence });
const challenges = [
  nameIt('c1', 'm', 'mat', 'The mat is red.'), nameIt('c2', 's', 'sun', 'The sun is hot.'), nameIt('c3', 't', 'top', 'The top spins.'),
  nameIt('c4', 'p', 'pig', 'The pig is pink.'), nameIt('c5', 'n', 'net', 'The net is wet.'),
];
const data = { title: 'Letters', letterGroup: 1, cumulativeLetters: ['m', 's', 't', 'p', 'n'], newLetters: ['m', 's'], gradeLevel: 'K', challenges };

/** Each item: an optional wrong answer (corrected, Try again), then the right letter (credited, advance). */
async function drive(wrong: Record<string, string>) {
  const h = mountWorkspace({ primitiveId: 'letter-spotter', evalMode: 'name_it', data });
  for (const c of challenges) {
    if (wrong[c.id]) { h.say(wrong[c.id]); h.feedback('incorrect', 'retry'); h.confirmVisible(); }
    h.say(c.targetLetter.toUpperCase()); h.feedback('correct', 'advance'); h.confirmVisible();
  }
  expect(h.state().status).toBe('completed');
  await flushScoring();
  expect(seam.submit).toHaveBeenCalledOnce();
  const [success, score, metrics, studentWork, , diagnosisEvidence] = seam.submit.mock.calls[0];
  return { success, score, metrics, studentWork, diagnosisEvidence };
}

it('three words said straight back, each corrected once: the first-response gate fails and the evidence names each miss', async () => {
  const { success, score, diagnosisEvidence } = await drive({ c2: 'sun', c3: 'top', c4: 'pig' });
  expect(diagnosisEvidence.firstResponseScore).toBe(40);
  expect(diagnosisEvidence.phases.map((p: { itemId: string; observed: string }) => [p.itemId, p.observed])).toEqual([
    ['c2', 'Heard (speech transcript, may be noisy): "sun"'], ['c3', 'Heard (speech transcript, may be noisy): "top"'],
    ['c4', 'Heard (speech transcript, may be noisy): "pig"'],
  ]);
  expect(isDiagnosableFailure({ success, score }, diagnosisEvidence)).toBe(true);
});

it('a confusion pair comes only from a corrected letter, never from a word said back', async () => {
  const { metrics } = await drive({ c2: 'p', c3: 'top' });
  expect(metrics.confusedLetterPairs).toEqual(['p-s']);
});
