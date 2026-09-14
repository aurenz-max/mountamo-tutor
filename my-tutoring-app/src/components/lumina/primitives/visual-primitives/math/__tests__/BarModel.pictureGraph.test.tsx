// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import BarModel, { type BarModelChallenge } from '../BarModel';
import { buildPictureGraphEvidence } from '../barModelEvidence';
import { classifyEvidenceTier } from '../../../../evaluation/diagnosis/types';

const state = vi.hoisted(() => ({ submit: vi.fn(), sendText: vi.fn() }));
vi.mock('../../../../components/PhaseSummaryPanel', () => ({ default: () => <div>Graph session complete</div> }));
vi.mock('../../../../hooks/useLuminaAI', () => ({ useLuminaAI: () => ({ sendText: state.sendText, isConnected: false }) }));
vi.mock('../../../../hooks/useJudgedScriptRunner', () => ({ useJudgedScriptRunner: () => ({ hearStimulus: vi.fn() }) }));
vi.mock('../../../../components/JudgedMicPanel', () => ({ default: () => null }));
vi.mock('../../../../evaluation', () => ({ useEvaluationContext: () => null, usePrimitiveEvaluation: () => ({ submitResult: state.submit, hasSubmitted: false, elapsedMs: 100 }) }));
vi.mock('../../../../utils/SoundManager', () => ({ SoundManager: { navigate: vi.fn(), tick: vi.fn(), playCorrect: vi.fn(), playIncorrect: vi.fn(), playCelebrate: vi.fn() } }));

const graph = (id: string, target: number, options: number[]): BarModelChallenge => ({
  id, evalMode: 'picture_graph', graphStyle: 'picture', prompt: 'Each 🐶 stands for 5. How many dogs?',
  hint: 'Count the icons, then multiply by 5.', showTargetHighlight: true, showBarValues: false, supportTier: 'medium',
  values: [{ label: 'Dogs', value: target }, { label: 'Cats', value: 10 }, { label: 'Birds', value: 20 }, { label: 'Fish', value: 15 }],
  scale: { step: 5, max: 25, iconEmoji: '🐶', iconValue: 5 }, targetBarIndex: 0, expectedValue: target, options,
});
const choose = (n: number) => fireEvent.click(screen.getByRole('button', { name: String(n) }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('BarModel picture_graph selection evidence', () => {
  it('submits every tapped choice and a structured packet naming the icon count, key and total', () => {
    render(<BarModel data={{ title: 'Pets', description: '', challenges: [graph('g1', 25, [5, 20, 25, 30]), graph('g2', 5, [0, 1, 5, 10])] }} />);
    choose(5); choose(25);
    fireEvent.click(screen.getByRole('button', { name: /Next Challenge/ }));
    choose(5);
    expect(state.submit).toHaveBeenCalledTimes(1);
    const [success, , , work, , evidence] = state.submit.mock.calls[0];
    expect(success).toBe(true);
    expect(work.studentWork.selections).toEqual([{ challengeId: 'g1', selectedOptions: [5, 25] }, { challengeId: 'g2', selectedOptions: [5] }]);
    expect(work.studentWork.challengeResults[0].selectedOptions).toEqual([5, 25]);
    expect(classifyEvidenceTier(evidence)).toBe('structured');
    expect(evidence.phases).toHaveLength(1);
    expect(evidence.phases[0]).toMatchObject({ itemId: 'g1', expected: '25', observed: 'Selections in order: 5, 25' });
    expect(evidence.phases[0].challenge).toContain('shows 5 icons');
    expect(evidence.challengeSummary).toContain('1 of 2 were answered correctly on the first choice');
    expect(evidence.firstResponseScore).toBe(50);
  });

  it('supplies no evidence when every first choice was correct', () => {
    render(<BarModel data={{ title: 'Pets', description: '', challenges: [graph('g1', 25, [5, 20, 25, 30])] }} />);
    choose(25);
    expect(state.submit.mock.calls[0][5]).toBeUndefined();
  });
});

it('ignores other modes and unsolved graphs stay factual', () => {
  const scale = { ...graph('s', 20, [16, 18, 20, 22]), evalMode: 'read_scale' as const, graphStyle: 'scaled_bar' as const, scale: { step: 2, max: 20 } };
  expect(buildPictureGraphEvidence([scale], [{ challengeId: 's', selectedOptions: [18, 20] }])).toBeUndefined();
  const evidence = buildPictureGraphEvidence([graph('g', 15, [3, 10, 15, 20])], [{ challengeId: 'g', selectedOptions: [3, 20] }]);
  expect(evidence?.observed).toBe('Selections in order: 3, 20 (not solved)');
  expect(evidence?.priorAttempts).toEqual([]);
});
