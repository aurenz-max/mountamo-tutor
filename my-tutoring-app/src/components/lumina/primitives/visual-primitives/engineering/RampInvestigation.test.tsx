// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RampLab from './RampLab';
import RampInvestigation from './RampInvestigation';
import { selectRampChallenges, type RampInvestigationChallenge } from './rampChallenges';
const mocks = vi.hoisted(() => ({ submit: vi.fn(), send: vi.fn(), spokenFinish: null as null | ((s: any) => void) }));
vi.mock('../../../hooks/useLuminaAI', () => ({ useLuminaAI: () => ({ sendText: mocks.send }) }));
vi.mock('../../../hooks/useJudgedScriptRunner', () => ({ useJudgedScriptRunner: (options: any) => { mocks.spokenFinish = options.onFinished; return { hearStimulus: vi.fn() }; } }));
vi.mock('../../../components/JudgedMicPanel', () => ({ default: () => <div>Spoken evidence turn</div> }));
vi.mock('../../../evaluation', () => ({ usePrimitiveEvaluation: () => ({ submitResult: mocks.submit, hasSubmitted: false }) }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: { tick: vi.fn(), select: vi.fn(), playCorrect: vi.fn(), playIncorrect: vi.fn(), navigate: vi.fn(), playStreak: vi.fn() } }));
const plan = selectRampChallenges(['plan_fair_test'], 1)[0] as RampInvestigationChallenge;
const explanation = selectRampChallenges(['explain_from_trials'], 1)[0] as RampInvestigationChallenge;
function click(name: string) { fireEvent.click(screen.getByRole('button', { name, exact: true })); }
async function collect() {
  click('Setup A'); click('Record prediction');
  click('Run trial A'); await act(async () => { vi.advanceTimersByTime(6000); });
  click('Run trial B'); await act(async () => { vi.advanceTimersByTime(6000); });
}
beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ clearRect() {}, fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, fill() {}, save() {}, restore() {}, translate() {}, rotate() {}, fillText() {} } as any);
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16));
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe('Ramp investigation learner flow', () => {
  it('rejects a two-variable plan, preserves the error, locks the repaired setup and records both trials', async () => {
    const done = vi.fn(); render(<RampInvestigation challenge={plan} instanceId="plan" onFinished={done} />);
    expect(screen.queryByText('Your trial notebook')).toBeNull();
    fireEvent.change(screen.getByLabelText('Setup B surface'), { target: { value: 'high' } });
    fireEvent.change(screen.getByLabelText('Setup B angle'), { target: { value: '35' } });
    click('Commit my plan');
    expect(screen.getByText(/cannot isolate/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Run trial A' })).toBeNull();
    fireEvent.change(screen.getByLabelText('Setup B angle'), { target: { value: '25' } }); click('Commit my plan');
    expect(screen.getByLabelText('Setup B angle').closest('fieldset')?.disabled).toBe(true);
    await collect(); click('Record investigation');
    expect(done).toHaveBeenCalledTimes(1);
    const result = done.mock.calls[0][0];
    expect(result.solved).toBe(true); expect(result.firstTryCorrect).toBe(false);
    expect(result.planAttempts.map((p: any) => p.fair)).toEqual([false, true]);
    expect(result.trials).toHaveLength(2);
  });
  it('never completes a plan from a correct prediction alone', () => {
    const done = vi.fn(); render(<RampInvestigation challenge={plan} instanceId="plan" onFinished={done} />);
    click('Commit my plan');
    expect(screen.queryByRole('button', { name: 'Record prediction' })).toBeNull();
    expect(done).not.toHaveBeenCalled();
  });
  it('requires both observations before the spoken turn; a capped wrong explanation remains wrong', async () => {
    const done = vi.fn(); render(<RampInvestigation challenge={explanation} instanceId="explain" onFinished={done} />);
    expect(screen.queryByText('Spoken evidence turn')).toBeNull();
    await collect(); click('Explain my results');
    expect(screen.getByText('Spoken evidence turn')).toBeTruthy();
    act(() => mocks.spokenFinish!({ outcomes: [{ solved: false, corrections: 2, score: 0 }] }));
    expect(done.mock.calls[0][0]).toMatchObject({ solved: false, firstTryCorrect: false, explanation: { solved: false, corrections: 2 } });
  });
  it('allows finishing an unsuccessful explanation session without converting completion to success', async () => {
    render(<RampLab data={{ title: 'Test', description: 'Investigate', rampLength: 10, rampAngle: 25, adjustableAngle: true, loadWeight: 4, loadType: 'box', showMeasurements: true, frictionLevel: 'low', theme: 'generic', challenges: [explanation] }} />);
    await collect(); click('Explain my results');
    act(() => mocks.spokenFinish!({ outcomes: [{ solved: false, corrections: 2, score: 0 }] }));
    click('Finish Session');
    expect(mocks.submit.mock.calls[0][0]).toBe(false);
    expect(mocks.submit.mock.calls[0][2]).toMatchObject({ challengesSolved: 0, challengesTotal: 1, predictionAccuracy: 100, firstTryCorrect: 0, checksMade: 2 });
    expect(mocks.submit.mock.calls[0][3].investigations[0].trials).toHaveLength(2);
  });
});
