// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { StudioItem } from '../readAloudPhrasing';
import type { JudgedScriptRunnerOptions } from '../../../../hooks/useJudgedScriptRunner';

const state = vi.hoisted(() => ({ index: 0, running: true, awaiting: false,
  submit: vi.fn(), evaluationSubmit: vi.fn(), options: null as unknown }));
vi.mock('../../../../evaluation', () => ({ usePrimitiveEvaluation: () => ({
  submitResult: state.evaluationSubmit, hasSubmitted: false,
}) }));
vi.mock('../../../../hooks/useJudgedScriptRunner', () => ({
  useJudgedScriptRunner: (options: JudgedScriptRunnerOptions<StudioItem>) => {
    state.options = options;
    return { currentItem: options.pack.items[state.index], currentIndex: state.index,
      running: state.running, canAttempt: state.running && !state.awaiting,
      stage: state.awaiting ? 'judging' : 'asking', statusLine: 'Your turn.',
      micState: 'armed', start: vi.fn(), summary: null, currentSolved: false,
      solvedIds: new Set(options.pack.items.slice(0, state.index).map((item) => item.id)),
      isAwaitingGesture: () => state.awaiting,
      submitGestureAttempt: (cue: string) => { state.awaiting = true; state.submit(cue); },
      hearStimulus: vi.fn(), stimulusTapped: false,
    };
  },
}));
vi.mock('../../../../components/JudgedMicPanel', () => ({ default: () => <div data-testid="mic-panel" /> }));
import ReadAloudStudio, { type ReadAloudStudioData } from '../ReadAloudStudio';

const data: ReadAloudStudioData = { title: 'After the rain', gradeLevel: '3', lexileLevel: '520L',
  fluencyFocus: 'expression', lines: [
    { text: 'After the rain, the birds sang.', phraseGroups: ['After the rain,', 'the birds sang.'] },
    { text: 'The sun came out.', phraseGroups: ['The sun came out.'] },
  ] };
beforeEach(() => { state.index = 0; state.running = true; state.awaiting = false; vi.clearAllMocks(); });
afterEach(cleanup);

describe('expression page-work and voice handoff', () => {
  it('edits and removes marks, commits the plan once, and preserves it into both readings', () => {
    const view = render(<ReadAloudStudio data={data} />);
    expect(screen.queryByTestId('mic-panel')).toBeNull();
    expect(screen.queryByText('One way to group the words')).toBeNull();
    const pause = screen.getByRole('button', { name: 'Pause after rain, word 3' });
    fireEvent.click(pause);
    expect(pause.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(pause);
    expect(pause.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(pause);
    fireEvent.click(screen.getByRole('button', { name: 'Use my phrase plan' }));
    fireEvent.click(screen.getByRole('button', { name: 'Use my phrase plan' }));
    expect(state.submit).toHaveBeenCalledTimes(1);
    expect(state.submit.mock.calls[0][0]).toContain('["After the rain,","the birds sang."]');
    expect(state.evaluationSubmit).not.toHaveBeenCalled();
    state.index = 1; state.awaiting = false;
    view.rerender(<ReadAloudStudio data={data} />);
    expect(screen.getByTestId('mic-panel')).toBeTruthy();
    expect(screen.getByText('After the rain, / the birds sang.')).toBeTruthy();
    expect(screen.queryByText('One way to group the words')).toBeNull();
    const options = state.options as JudgedScriptRunnerOptions<StudioItem>;
    expect(options.pack.itemCue(options.pack.items[1], { opening: false, howToPlay: false })).toContain('["After the rain,","the birds sang."]');
    state.index = 2;
    view.rerender(<ReadAloudStudio data={data} />);
    expect(screen.getByText('One way to group the words')).toBeTruthy();
    state.index = 3;
    view.rerender(<ReadAloudStudio data={data} />);
    expect(screen.getAllByRole('button', { name: /Pause after/ }).every((button) => button.getAttribute('aria-pressed') === 'false')).toBe(true);
  });

  it('permits a one-phrase plan and gates page work until the tutor starts', () => {
    state.running = false;
    const view = render(<ReadAloudStudio data={data} />);
    expect(screen.getByTestId('mic-panel')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Use my phrase plan' }) as HTMLButtonElement).disabled).toBe(true);
    state.running = true;
    view.rerender(<ReadAloudStudio data={data} />);
    fireEvent.click(screen.getByRole('button', { name: 'Use my phrase plan' }));
    expect(state.submit.mock.calls[0][0]).toContain('["After the rain, the birds sang."]');
  });

  it('submits only modeled reading scores and stores the practice channels separately', () => {
    render(<ReadAloudStudio data={data} />);
    const options = state.options as JudgedScriptRunnerOptions<StudioItem>;
    const outcomes = options.pack.items.map((item) => ({ id: item.id,
      solved: item.step !== 'reread', score: item.step === 'reread' ? 0 : 100,
      corrections: item.step === 'reread' ? 2 : 0, seconds: 3 }));
    expect(options.pack.diagnosisObservation?.(options.pack.items[0], { lastHeard: 'hello' })).toBeNull();
    expect(options.pack.diagnosisObservation?.(options.pack.items[1], { lastHeard: 'hello' })).toBeNull();
    const observation = options.pack.diagnosisObservation?.(options.pack.items[2], { lastHeard: 'After the rain the bird sang' });
    expect(observation).toBeTruthy();
    options.onFinished({ outcomes, accuracy: 67, passed: true, solvedCount: 4,
      firstTryCount: 4, attemptsCount: 10, hearTaps: 0, observations: [{ ...observation!, judgeFeedback: 'My turn: birds.' }] });
    const [passed, score, metrics, work] = state.evaluationSubmit.mock.calls[0];
    expect(passed).toBe(false);
    expect(score).toBe(0);
    expect(metrics.linesTotal).toBe(2);
    expect(metrics.linesRead).toBe(0);
    expect(work.firstReadResults).toHaveLength(2);
    expect(work.lineResults).toHaveLength(2);
    expect(work.prosodyAssessed).toBe(false);
    expect(state.evaluationSubmit.mock.calls[0][5].judgeFeedback).toBe('My turn: birds.');
  });
});
