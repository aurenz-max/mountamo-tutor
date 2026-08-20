// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HabitatItem } from '../habitatDioramaScript';

const runnerState = vi.hoisted(() => ({
  index: 0,
  submitGestureAttempt: vi.fn(),
  hearStimulus: vi.fn(),
  options: null as null | { pack: { items: HabitatItem[] }; onFinished: (summary: unknown) => void; onAffirmed?: (item: HabitatItem) => void },
}));

vi.mock('../../../../hooks/useJudgedScriptRunner', () => ({
  useJudgedScriptRunner: (options: typeof runnerState.options) => {
    runnerState.options = options;
    const item = options?.pack.items[runnerState.index] ?? null;
    return {
      running: true, preparing: false, stage: 'asking', statusLine: 'status', currentIndex: runnerState.index,
      currentItem: item, solvedIds: new Set<string>(), currentSolved: false, canAttempt: Boolean(item), summary: null,
      micState: 'armed', tutorSpeaking: false, cuedItemId: item?.id ?? null, revealHeld: false,
      armStillness: vi.fn(), clearStillness: vi.fn(), cancelListening: undefined, start: vi.fn(),
      hearStimulus: runnerState.hearStimulus, stimulusTapped: false, submitGestureAttempt: runnerState.submitGestureAttempt,
      isAwaitingGesture: () => item?.answerKind === 'gesture', loop: {},
    };
  },
}));

vi.mock('../../../../components/JudgedMicPanel', () => ({
  default: ({ children }: { children?: React.ReactNode }) => <div data-testid="judged-panel">{children}</div>,
}));

const submitResult = vi.fn();
vi.mock('../../../../evaluation', () => ({
  usePrimitiveEvaluation: () => ({ submitResult, hasSubmitted: false, submittedResult: null, resetAttempt: vi.fn(), elapsedMs: 2400 }),
  useEvaluationContext: () => null,
}));
vi.mock('../../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));

import HabitatDiorama, { type HabitatDioramaData } from '../HabitatDiorama';

const data: HabitatDioramaData = {
  primitiveType: 'habitat-diorama',
  habitat: { name: 'Forest Web', biome: 'forest', climate: 'cool and wet', description: 'A connected forest.' },
  gradeBand: '3-5',
  organisms: [
    { id: 'oak', commonName: 'Oak Tree', role: 'producer', imagePrompt: 'oak', position: { x: '15%', y: '30%' }, description: 'Makes food.', adaptations: ['leaves'] },
    { id: 'hare', commonName: 'Snowshoe Hare', role: 'primary-consumer', imagePrompt: 'hare', position: { x: '40%', y: '65%' }, description: 'Eats leaves.', adaptations: ['feet'] },
    { id: 'fox', commonName: 'Red Fox', role: 'secondary-consumer', imagePrompt: 'fox', position: { x: '68%', y: '55%' }, description: 'Hunts hare.', adaptations: ['ears'] },
    { id: 'fungus', commonName: 'Shelf Fungus', role: 'decomposer', imagePrompt: 'fungus', position: { x: '28%', y: '80%' }, description: 'Breaks down wood.', adaptations: ['enzymes'] },
  ],
  relationships: [
    { fromId: 'fox', toId: 'hare', type: 'predation', description: 'Fox hunts hare.' },
    { fromId: 'hare', toId: 'oak', type: 'predation', description: 'Hare eats oak.' },
  ],
  environmentalFeatures: [{ id: 'stream', name: 'Stream', description: 'Fresh water.', position: { x: '80%', y: '75%' } }],
  challenges: [
    { id: 'connect', type: 'connect', prompt: 'Complete the fox feeding relationship.', explanation: 'The fox hunts the hare.', fromId: 'fox', toId: 'hare' },
    { id: 'restore', type: 'restore', prompt: 'Return the decomposer to a viable layer.', explanation: 'Dead wood collects by soil.', restorationEntityId: 'fungus', restorationZone: 'ground' },
  ],
};

beforeEach(() => {
  cleanup();
  runnerState.index = 0;
  runnerState.options = null;
  runnerState.submitGestureAttempt.mockClear();
  runnerState.hearStimulus.mockClear();
  submitResult.mockClear();
});

describe('habitat-diorama judged stage', () => {
  it('renders tutor-owned chrome with no Check or Next controls', () => {
    render(<HabitatDiorama data={data} />);
    expect(runnerState.options?.pack.items).toHaveLength(2);
    expect(screen.getByTestId('judged-panel')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /check|next|submit/i })).toBeNull();
  });

  it('commits a relationship only when the learner selects a destination', () => {
    render(<HabitatDiorama data={data} />);
    fireEvent.click(screen.getByRole('button', { name: 'Red Fox' }));
    expect(runnerState.submitGestureAttempt).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Snowshoe Hare' }));
    expect(runnerState.submitGestureAttempt).toHaveBeenCalledOnce();
    expect(String(runnerState.submitGestureAttempt.mock.calls[0][0])).toContain('MATCHES');
  });

  it('commits restoration through a habitat zone gesture', () => {
    runnerState.index = 1;
    render(<HabitatDiorama data={data} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ground layer' }));
    expect(runnerState.submitGestureAttempt).toHaveBeenCalledOnce();
    expect(String(runnerState.submitGestureAttempt.mock.calls[0][0])).toContain('MATCHES');
  });

  it('submits measured evidence when the tutor-owned run finishes', () => {
    render(<HabitatDiorama data={data} />);
    act(() => runnerState.options!.onFinished({
      outcomes: [{ id: 'connect', solved: true }, { id: 'restore', solved: false }],
      solvedCount: 1, firstTryCount: 1, attemptsCount: 3, accuracy: 50, passed: false,
      hearTaps: 0, observations: [], diagnosisEvidence: [],
    }));
    expect(submitResult).toHaveBeenCalledOnce();
    expect(submitResult.mock.calls[0][2]).toMatchObject({
      type: 'habitat-diorama', totalChallenges: 2, correctChallenges: 1,
      totalAttempts: 3, accuracy: 50, spokenChallenges: 0, modelChallenges: 2,
    });
  });
});
