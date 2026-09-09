// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import BarModel, { type BarModelChallenge } from '../BarModel';

const state = vi.hoisted(() => ({ options: null as any, submit: vi.fn(), sendText: vi.fn() }));
vi.mock('../../../../components/PhaseSummaryPanel', () => ({ default: ({ phases }: { phases: { score: number }[] }) => <div>Graph session complete: {phases[0]?.score}</div> }));
vi.mock('../../../../hooks/useLuminaAI', () => ({ useLuminaAI: () => ({ sendText: state.sendText, isConnected: true }) }));
vi.mock('../../../../hooks/useJudgedScriptRunner', () => ({ useJudgedScriptRunner: (options: any) => {
  state.options = options; return { hearStimulus: vi.fn() };
} }));
vi.mock('../../../../components/JudgedMicPanel', () => ({ default: () => <div>Spoken microphone</div> }));
vi.mock('../../../../evaluation', () => ({ useEvaluationContext: () => null, usePrimitiveEvaluation: () => ({ submitResult: state.submit, hasSubmitted: false, elapsedMs: 100 }) }));
vi.mock('../../../../utils/SoundManager', () => ({ SoundManager: { navigate: vi.fn(), tick: vi.fn(), playCorrect: vi.fn(), playIncorrect: vi.fn(), playCelebrate: vi.fn() } }));

const pair: BarModelChallenge = {
  id: 'p1', evalMode: 'compare_two_graphs', prompt: 'Tell me what is the same or different.',
  graphStyle: 'picture', graphLabel: 'Morning', secondGraphLabel: 'Afternoon',
  scale: { step: 1, max: 10, iconValue: 1 }, showBarValues: false,
  values: [{ label: 'Apples', value: 4, emoji: '🍎' }, { label: 'Pears', value: 2, emoji: '🍐' }],
  secondValues: [{ label: 'Apples', value: 4, emoji: '🍎' }, { label: 'Pears', value: 3, emoji: '🍐' }],
};
const finish = (solved: boolean, corrections: number, score: number) => act(() => state.options.onFinished({
  outcomes: [{ id: state.options.pack.items[0].id, solved, corrections, score }],
  solvedCount: solved ? 1 : 0, firstTryCount: corrections === 0 && solved ? 1 : 0,
  attemptsCount: corrections + 1, accuracy: score, passed: solved, observations: [{ observed: 'heard response' }],
}));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('BarModel spoken interaction', () => {
  it('never prints placed totals during a sticker build, even from an older payload', () => {
    render(<BarModel data={{ title: 'Our survey', description: '', challenges: [{ ...pair,
      evalMode: 'build_one_to_one', showPlacedCount: true, secondValues: undefined,
    }] }} />);
    expect(screen.queryByText(/placed/)).toBeNull();
  });
  it('renders both surveys as countable rows, with no numeric choices or competing intro', () => {
    render(<BarModel data={{ title: 'Our surveys', description: 'Look at both graphs.', challenges: [pair] }} />);
    expect(screen.getByText('Morning')).toBeTruthy();
    expect(screen.getByText('Afternoon')).toBeTruthy();
    expect(screen.getAllByText('🍎')).toHaveLength(8);
    expect(screen.getAllByText('🍐')).toHaveLength(5);
    expect(screen.queryByRole('button', { name: '4' })).toBeNull();
    expect(state.sendText).not.toHaveBeenCalled();
  });
  it('preserves the real correction score and submits only once', () => {
    render(<BarModel data={{ title: 'Our surveys', description: '', challenges: [pair] }} />);
    finish(true, 1, 67);
    expect(state.submit).toHaveBeenCalledTimes(1);
    expect(state.submit.mock.calls[0][1]).toBe(67);
    expect(screen.getByText('Graph session complete: 67')).toBeTruthy();
    expect(state.submit.mock.calls[0][2]).toMatchObject({ evalMode: 'compare_two_graphs', attemptsCount: 2 });
    expect(state.submit.mock.calls[0][3].studentWork.challengeResults[0].observations).toHaveLength(1);
  });
  it('records a capped wrong answer as wrong, then advances to a fresh spoken graph', () => {
    render(<BarModel data={{ title: 'Our surveys', description: '', challenges: [pair, { ...pair, id: 'p2' }] }} />);
    finish(false, 2, 0);
    expect(state.submit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Next Challenge/ }));
    expect(state.options.pack.items[0].id).toBe('p2');
    finish(true, 0, 100);
    expect(state.submit.mock.calls[0][0]).toBe(false);
    expect(state.submit.mock.calls[0][1]).toBe(50);
    expect(state.submit.mock.calls[0][2].correctCount).toBe(1);
  });
});
