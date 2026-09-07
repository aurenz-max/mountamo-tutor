// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JudgedRunSummary, JudgedScriptRunnerOptions } from '../../../hooks/useJudgedScriptRunner';
import type { YouAndMeItem } from './youAndMeScript';
import YouAndMe, { type YouAndMeData } from './YouAndMe';

const mocks = vi.hoisted(() => ({ evaluation: vi.fn(), submit: vi.fn() }));
vi.mock('../../../evaluation', () => ({ usePrimitiveEvaluation: mocks.evaluation }));
vi.mock('../../../components/JudgedMicPanel', () => ({ default: () => <div>Microphone controls</div> }));

let runnerOptions: JudgedScriptRunnerOptions<YouAndMeItem>;
let advance: (index: number) => void;
vi.mock('../../../hooks/useJudgedScriptRunner', () => ({
  useJudgedScriptRunner: (options: JudgedScriptRunnerOptions<YouAndMeItem>) => {
    const [index, setIndex] = React.useState(0);
    runnerOptions = options;
    advance = setIndex;
    return { currentIndex: index, currentItem: options.pack.items[index], running: false, summary: null };
  },
}));

function fixture(): YouAndMeData {
  const scene = {
    sceneId: 'bag', type: 'describe_action' as const,
    participants: [{ name: 'Maya', emoji: '👧' }, { name: 'Leo', emoji: '👦' }] as YouAndMeData['challenges'][number]['participants'],
    actor: 0 as const, object: 'bag', objectEmoji: '🎒', action: 'packed the bag',
  };
  return { title: 'You & Me', description: 'Trade speaking roles', gradeLevel: 'K',
    challengeType: 'describe_action', instanceId: 'test-pair',
    challenges: [{ ...scene, id: 'bag-a', speaker: 0 }, { ...scene, id: 'bag-b', speaker: 1 }] };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.evaluation.mockReturnValue({ submitResult: mocks.submit });
});
afterEach(cleanup);

describe('You & Me learner contract', () => {
  it.each(['easy', 'medium', 'hard'] as const)('renders %s support while retaining task and correction access', supportTier => {
    const data = fixture();
    data.challenges = data.challenges.map(ch => ({ ...ch, type: 'describe_independent_action', supportTier }));
    render(<YouAndMe data={data} />);
    expect(Boolean(screen.queryByText('Did the action'))).toBe(supportTier === 'easy');
    expect(screen.getByRole('img', { name: 'Maya' }).parentElement!.className.includes('border-pink-300')).toBe(supportTier !== 'hard');
    expect(Boolean(screen.queryByText(/Check before speaking:/))).toBe(supportTier === 'easy');
    expect(Boolean(screen.queryByText(/Keep the no-help sentence/))).toBe(supportTier === 'medium');
    expect(screen.getByText('Maya packed the bag without any help.')).toBeTruthy();
    expect(screen.getByText(/Use a self word/)).toBeTruthy();
    expect(screen.queryByText(/by myself/)).toBeNull();
    const pack = runnerOptions.pack;
    const item = pack.items[0];
    expect(pack.contextFor(item).supportTier).toBe(supportTier);
    expect(pack.itemCue(item, { opening: true, howToPlay: false })).toContain(`SUPPORT TIER: ${supportTier}`);
    expect(pack.pronounceCue!(item)).toContain('Use a self word');
    act(() => runnerOptions.onCorrectionRetry?.(item, 1));
    expect(screen.getByText('Maya is speaking. Maya did the action.')).toBeTruthy();
  });
  it('uses the current item task in mixed sessions and keeps per-mode scores separate', () => {
    const data = fixture();
    data.challengeType = 'mixed';
    data.challenges[1].type = 'describe_independent_action';
    render(<YouAndMe data={data} />);
    expect(screen.queryByText(/Use a self word/)).toBeNull();
    act(() => { advance(1); runnerOptions.onItemOpened?.(runnerOptions.pack.items[1], 1); });
    expect(screen.getByText('Maya packed the bag without any help.')).toBeTruthy();
    expect(screen.getByText(/Use a self word/)).toBeTruthy();
    expect(screen.queryByText(/by yourself/)).toBeNull();
    act(() => runnerOptions.onFinished({
      outcomes: [{ id: 'bag-a', solved: true, corrections: 0, score: 100, seconds: null },
        { id: 'bag-b', solved: false, corrections: 2, score: 0, seconds: null }],
      solvedCount: 1, firstTryCount: 1, attemptsCount: 4, accuracy: 50,
      passed: false, hearTaps: 0, observations: [],
    }));
    expect(mocks.submit.mock.calls[0][2]).toMatchObject({ challengeType: 'mixed', modeResults: [
      { mode: 'describe_action', total: 1, correct: 1, accuracy: 100 },
      { mode: 'describe_independent_action', total: 1, correct: 0, accuracy: 0 },
    ] });
  });
  it('trades the speaking role while keeping the actor fixed, without printing a model answer', () => {
    render(<YouAndMe data={fixture()} />);
    const maya = screen.getByRole('img', { name: 'Maya' }).parentElement!;
    const leo = screen.getByRole('img', { name: 'Leo' }).parentElement!;
    expect(within(maya).getByText('Speaking now')).toBeTruthy();
    expect(maya.className).toContain('border-pink-300');
    expect(within(maya).getByText('Did the action')).toBeTruthy();
    expect(screen.queryByText('I packed the bag.')).toBeNull();
    act(() => {
      advance(1);
      runnerOptions.onItemOpened?.(runnerOptions.pack.items[1], 1);
    });
    expect(within(leo).getByText('Speaking now')).toBeTruthy();
    expect(leo.className).toContain('border-pink-300');
    expect(within(maya).getByText('Listening partner')).toBeTruthy();
    expect(within(maya).getByText('Did the action')).toBeTruthy();
    expect(screen.getByText(/Trade roles/)).toBeTruthy();
    expect(screen.queryByText('You packed the bag.')).toBeNull();
  });

  it('clears correction help on the next turn and starts regenerated content at its first turn', () => {
    const data = fixture();
    const view = render(<YouAndMe data={data} />);
    act(() => runnerOptions.onCorrectionRetry?.(runnerOptions.pack.items[0], 1));
    expect(screen.getByText('Maya is speaking. Maya did the action.')).toBeTruthy();
    act(() => {
      advance(1);
      runnerOptions.onItemOpened?.(runnerOptions.pack.items[1], 1);
    });
    expect(screen.queryByText('Maya is speaking. Maya did the action.')).toBeNull();
    act(() => runnerOptions.onCorrectionRetry?.(runnerOptions.pack.items[1], 1));
    expect(screen.getByText('Leo is speaking. Maya did the action.')).toBeTruthy();
    view.rerender(<YouAndMe data={{ ...data, challenges: data.challenges.map(ch => ({ ...ch, action: 'carried the bag' })) }} />);
    expect(screen.getByText('Meet the partners')).toBeTruthy();
    expect(screen.getByText('Maya carried the bag.')).toBeTruthy();
    expect(screen.queryByText('Leo is speaking. Maya did the action.')).toBeNull();
    expect(within(screen.getByRole('img', { name: 'Maya' }).parentElement!).getByText('Speaking now')).toBeTruthy();
  });

  it('submits the runner ledger as canonical aggregate metrics and forwards the caller callback', () => {
    const onEvaluationSubmit = vi.fn();
    render(<YouAndMe data={{ ...fixture(), onEvaluationSubmit }} />);
    expect(mocks.evaluation.mock.calls[0][0].onSubmit).toBe(onEvaluationSubmit);
    const summary: JudgedRunSummary = {
      outcomes: [
        { id: 'bag-a', solved: true, corrections: 0, score: 100, seconds: null },
        { id: 'bag-b', solved: false, corrections: 2, score: 0, seconds: null },
      ],
      solvedCount: 1, firstTryCount: 1, attemptsCount: 4, accuracy: 50,
      passed: false, hearTaps: 2, observations: [],
    };
    act(() => runnerOptions.onFinished(summary));
    expect(mocks.submit).toHaveBeenCalledExactlyOnceWith(false, 50, {
      type: 'you-and-me', challengeType: 'describe_action', totalChallenges: 2,
      correctCount: 1, attemptsCount: 4, firstTryCount: 1, hintsViewed: 2,
      overallAccuracy: 50, averageAttemptsPerChallenge: 2,
      modeResults: [{ mode: 'describe_action', total: 2, correct: 1, accuracy: 50 }],
    }, {
      outcomes: summary.outcomes, observations: [], perspectives: [
        { id: 'bag-a', sceneId: 'bag', type: 'describe_action', actor: 0, speaker: 0 },
        { id: 'bag-b', sceneId: 'bag', type: 'describe_action', actor: 0, speaker: 1 },
      ],
    }, undefined, undefined);
  });
});
