// @vitest-environment jsdom
/**
 * Sorting-station on the one `observation` callback (observation alias migration, Phase A): a wrong-first run
 * submits every attempt as student work, right answers included, with text that states the card and what was
 * heard rather than the verdict; the corrections still reach the capture gate as diagnosis evidence.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { LoopEmission } from '../../../hooks/judgedLoopModel';
const seam = vi.hoisted(() => ({ emit: null as ((e: LoopEmission) => void) | null, submit: vi.fn() }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({ isConnected: true, isListening: true,
  isAudioPlaying: false, sessionMode: 'idle', activePrimitiveId: null, sessionResumeCount: 0, conversation: [],
  sendText: vi.fn(), connect: vi.fn(), disconnect: vi.fn(), reconnect: vi.fn(), startListening: vi.fn(), stopListening: vi.fn(), updateContext: vi.fn() }) }));
vi.mock('../../../hooks/useJudgedSpeechLoop', () => ({ useJudgedSpeechLoop: (options: { onEmission: (e: LoopEmission) => void }) => {
  seam.emit = options.onEmission;
  return { queueCue: vi.fn(), sendCueNow: vi.fn(), submitGestureAttempt: vi.fn(), clearQueuedCue: vi.fn(), arm: vi.fn(), disarm: vi.fn(), reset: vi.fn(), isAwaitingJudgment: () => false, voiceTurns: {}, config: {} };
} }));
vi.mock('../../../evaluation', () => ({ usePrimitiveEvaluation: () => ({ hasSubmitted: false, submitResult: seam.submit, submittedResult: null, elapsedMs: 0 }),
  useEvaluationContext: () => null }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));
vi.mock('../../../components/JudgedMicPanel', () => ({ default: ({ run }: { run: { start: () => void } }) => <button onClick={run.start}>Start test</button> }));
import SortingStation, { type SortingStationData } from './SortingStation';
import { itemsFromChallenges, sortingStationHarnessAnswers, type SortingStationItem } from './sortingStationScript';
import { isDiagnosableFailure } from '../../../evaluation/diagnosis/types';

beforeEach(() => { seam.submit.mockReset(); });
afterEach(() => { cleanup(); vi.clearAllMocks(); });

const fruit = (id: string, label: string, color: string) => ({ id, label, emoji: '', attributes: { color } });
const data: SortingStationData = {
  title: 'Colors', maxCategories: 2, showCounts: false, showTallyChart: false, gradeBand: 'K', supportTier: 'medium',
  instanceId: 'ss', skillId: 'MATH-K-SORT', subskillId: 'MATH-K-SORT-A',
  challenges: [{ id: 'c1', type: 'sort-by-one', instruction: 'Sort by color.', sortingAttribute: 'color',
    categories: [{ label: 'Red', rule: { color: 'Red' } }, { label: 'Yellow', rule: { color: 'Yellow' } }],
    objects: [fruit('o1', 'apple', 'Red'), fruit('o2', 'banana', 'Yellow'), fruit('o3', 'cherry', 'Red'),
      fruit('o4', 'lemon', 'Yellow'), fruit('o5', 'strawberry', 'Red')] }],
};

const voice = (judgment: 'affirmed' | 'corrected', text: string) => act(async () => {
  seam.emit?.({ kind: 'attempt-open', attempt: { source: 'voice' } } as LoopEmission);
  seam.emit?.({ kind: 'attempt-transcript', attempt: {}, text } as LoopEmission);
  seam.emit?.({ kind: 'verdict', judgment, attempt: { source: 'voice', transcript: text } } as LoopEmission);
});

it('a run with three cards said straight back submits every attempt as student work, stated as facts, and fires the gate', async () => {
  render(<SortingStation data={data} />);
  await act(async () => { fireEvent.click(screen.getByText('Start test')); });
  const items: SortingStationItem[] = itemsFromChallenges(data.challenges, { tier: 'medium', isPreReader: true });
  expect(items.map((i) => i.kind)).toEqual(['sort', 'sort', 'sort', 'sort', 'sort']);
  for (let index = 0; index < items.length; index += 1) {
    const answers = sortingStationHarnessAnswers(items[index]);
    if (index >= 1 && index <= 3) await voice('corrected', answers.signatureWrong!.text);
    await voice('affirmed', answers.correct);
  }
  expect(seam.submit).toHaveBeenCalledOnce();
  const [success, score, , studentWork, , diagnosisEvidence] = seam.submit.mock.calls[0];

  const responses = studentWork.learningResponses as Array<{ itemId: string; verdict: string; challenge: string; observed: string }>;
  expect(responses.map((r) => `${r.verdict}:${r.observed}`)).toEqual(items.flatMap((item, index) => [
    ...(index >= 1 && index <= 3 ? [`corrected:Heard "${item.stimulus}".`] : []),
    `affirmed:Heard "${item.answer}".`,
  ]));
  for (const item of items) {
    expect(responses.find((r) => r.itemId === item.id)!.challenge).toBe(
      `sort: which group ${item.stimulus} belongs with (sorting by color; groups: Red, Yellow).`);
  }
  for (const r of responses) expect(r.observed).not.toMatch(/wrong|did not match|incorrect|does not support|judged/i);

  expect(diagnosisEvidence.firstResponseScore).toBe(40);
  expect(diagnosisEvidence.phases.map((p: { itemId: string; observed: string }) => [p.itemId, p.observed]))
    .toEqual(items.slice(1, 4).map((item) => [item.id, `Heard "${item.stimulus}".`]));
  expect(isDiagnosableFailure({ success, score }, diagnosisEvidence)).toBe(true);
});
