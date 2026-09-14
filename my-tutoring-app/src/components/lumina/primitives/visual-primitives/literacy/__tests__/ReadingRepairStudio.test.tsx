// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UseVoiceCaptureOptions } from '../../../../hooks/useVoiceCapture';
import { compareReading, type ReadingRepairVerdict } from '../readingRepairEvidence';

const state = vi.hoisted(() => ({ options: null as unknown, evaluationOptions: null as unknown,
  submit: vi.fn(), send: vi.fn(), start: vi.fn(), stop: vi.fn(), tutorAudible: false,
  connected: true, aiOptions: {} as any, toggle: vi.fn(), select: vi.fn() }));
vi.mock('../../../../hooks/useVoiceCapture', () => ({ useVoiceCapture: (options: unknown) => {
  state.options = options;
  return { state: 'idle', level: 0, isSupported: true, micPermission: 'granted', start: state.start, stop: state.stop };
} }));
vi.mock('../../../../hooks/useLuminaAI', () => ({ useLuminaAI: (options: unknown) => {
  state.aiOptions = options;
  return { sendText: state.send, isAudioPlaying: state.tutorAudible, isConnected: state.connected, isAIResponding: false };
} }));
vi.mock('../../../../evaluation', () => ({ usePrimitiveEvaluation: (options: unknown) => {
  state.evaluationOptions = options;
  return { submitResult: state.submit };
} }));
vi.mock('../../../../utils/SoundManager', () => ({ SoundManager: { navigate: vi.fn(), toggle: state.toggle, select: state.select } }));
vi.mock('../../../../components/PhaseSummaryPanel', () => ({ default: () => <div>Provisional summary</div> }));
import ReadingRepairStudio, { type ReadingRepairStudioData } from '../ReadingRepairStudio';

type Context = { id: string; epoch: number; selected: number[]; supported: boolean };
type CaptureOptions = UseVoiceCaptureOptions<ReadingRepairVerdict, Context>;
const data: ReadingRepairStudioData = { title: 'Reading Repair Studio', description: 'Read, listen back, and check the print.', gradeLevel: '2',
  challengeType: 'notice_and_repair', challenges: [
    { id: 'r1', challengeType: 'notice_and_repair', text: 'Yesterday, Sam rode to the pond.' },
    { id: 'r2', challengeType: 'notice_and_repair', text: 'The small duck swam across the pond.' },
    { id: 'r3', challengeType: 'notice_and_repair', text: 'Rain made the narrow path muddy.' },
  ] };
let clip = 0;
function say(text: string, print = data.challenges[0].text) {
  const options = state.options as CaptureOptions;
  const verdict = compareReading(print, [0, 1].map(() => ({ transcript: text, confidence: 'high', complete: true })));
  act(() => options.onSettle(verdict, { context: options.getContext(), base64: 'test', url: `blob:reading-${++clip}`,
    ms: 5000, modality: 'ptt', timing: { earlyOnset: false, micOpenMs: 10, onsetMs: 500 } }));
}
function finish(hasAudio = true) {
  fireEvent.click(screen.getByRole('button', { name: hasAudio ? 'I’m done checking' : 'Continue without a recording' }));
  fireEvent.click(screen.getByRole('button', { name: 'Finish this sentence' }));
}
beforeEach(() => { vi.clearAllMocks(); state.tutorAudible = false; state.connected = true; clip = 0;
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('Reading Repair Studio learner contract', () => {
  it('offers progressive written help without speaking or exposing the print to the tutor', () => {
    render(<ReadingRepairStudio data={data} />);
    expect(state.aiOptions).toMatchObject({ enabled: false, ownsOpening: true });
    say('Yesterday Sam ride to the pond');
    fireEvent.click(screen.getByRole('button', { name: 'Help me check' }));
    expect(state.aiOptions.primitiveData).toMatchObject({ supportLevel: 1, supportRecorded: true, independentWindowOpen: false });
    fireEvent.click(screen.getByRole('button', { name: 'Another way to check' }));
    expect(screen.getByText(/A word that makes sense still needs/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Walk me through it' }));
    expect(state.aiOptions.primitiveData.supportLevel).toBe(3);
    expect(state.send).not.toHaveBeenCalled();
    expect(JSON.stringify(state.aiOptions.primitiveData)).not.toMatch(/Sam|rode|ride|mismatch|transcript|verdict/);
    fireEvent.click(screen.getByRole('button', { name: 'Hear this tip' }));
    expect((state.options as CaptureOptions).getContext().supported).toBe(true);
    expect(state.send).toHaveBeenCalledTimes(1);
    expect(state.send).toHaveBeenCalledWith(expect.stringContaining('[READING_HELP]'), { silent: true, activate: true });
    expect(state.aiOptions.enabled).toBe(true);
  });
  it.each(['advance', 'record', 'timeout'])('discards disconnected tip requests on %s', action => {
    vi.useFakeTimers(); state.connected = false;
    const view = render(<ReadingRepairStudio data={data} />);
    say('Yesterday Sam ride to the pond');
    fireEvent.click(screen.getByRole('button', { name: 'Help me check' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hear this tip' }));
    if (action === 'advance') {
      finish(); fireEvent.click(screen.getByRole('button', { name: 'Try a fresh sentence' }));
      expect(state.aiOptions.primitiveData).toMatchObject({ stage: 'cold_read', supportRecorded: false, independentWindowOpen: true });
    } else if (action === 'record') {
      fireEvent.click(screen.getByRole('button', { name: /Read it again/ }));
    } else { act(() => vi.advanceTimersByTime(15001)); }
    state.connected = true; view.rerender(<ReadingRepairStudio data={data} />);
    expect(state.send).not.toHaveBeenCalled();
  });
  it('holds recording and advance while a sent tip is pending and releases them after playback', () => {
    const view = render(<ReadingRepairStudio data={data} />);
    say('Yesterday Sam ride to the pond');
    fireEvent.click(screen.getByRole('button', { name: 'Help me check' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hear this tip' }));
    expect(screen.queryByRole('button', { name: /Read it again/ })).toBeNull();
    expect((screen.getByRole('button', { name: 'I’m done checking' }) as HTMLButtonElement).disabled).toBe(true);
    const pausedBefore = vi.mocked(HTMLMediaElement.prototype.pause).mock.calls.length;
    fireEvent.play(screen.getByLabelText('Replay my first reading'));
    expect(vi.mocked(HTMLMediaElement.prototype.pause).mock.calls.length).toBe(pausedBefore + 1);
    expect(state.aiOptions.primitiveData.replayCount).toBe(0);
    state.tutorAudible = true; view.rerender(<ReadingRepairStudio data={data} />);
    state.tutorAudible = false; view.rerender(<ReadingRepairStudio data={data} />);
    expect(screen.getByRole('button', { name: /Read it again/ })).toBeTruthy();
    expect(state.send).toHaveBeenCalledTimes(1);
    say(data.challenges[0].text); finish();
    expect(screen.getByText(/matched after help/)).toBeTruthy();
  });
  it('waits for connection before speaking completion and does not duplicate the local submission', () => {
    state.connected = false;
    const view = render(<ReadingRepairStudio data={data} />);
    for (let i = 0; i < 3; i++) { finish(false); if (i < 2) fireEvent.click(screen.getByRole('button', { name: 'Try a fresh sentence' })); }
    expect(state.submit).toHaveBeenCalledTimes(1); expect(state.send).not.toHaveBeenCalled();
    state.connected = true; view.rerender(<ReadingRepairStudio data={data} />);
    view.rerender(<ReadingRepairStudio data={data} />);
    expect(state.send).toHaveBeenCalledTimes(1);
    expect(state.send).toHaveBeenCalledWith(expect.stringContaining('[ALL_COMPLETE]'), { silent: true });
    expect(state.submit).toHaveBeenCalledTimes(1);
  });
  it('uses neutral sounds only for word marking and reflection, never for a hidden verdict', () => {
    render(<ReadingRepairStudio data={data} />);
    say('Yesterday Sam ride to the pond');
    expect(state.toggle).not.toHaveBeenCalled(); expect(state.select).not.toHaveBeenCalled();
    const word = screen.getByRole('button', { name: 'Revisit rode, word 3' });
    fireEvent.click(word); fireEvent.click(word);
    expect(state.toggle.mock.calls).toEqual([[true], [false]]);
    fireEvent.click(screen.getByRole('button', { name: 'I’m done checking' }));
    fireEvent.click(screen.getByRole('button', { name: 'The letters' }));
    expect(state.select).toHaveBeenCalledTimes(1);
  });
  it('hides initial verdict and error location until the learner closes checking', () => {
    render(<ReadingRepairStudio data={data} />);
    expect(screen.queryByRole('button', { name: 'Help me check' })).toBeNull();
    expect(screen.getAllByRole('button', { name: /Revisit/ }).every(b => (b as HTMLButtonElement).disabled)).toBe(true);
    say('Yesterday Sam ride to the pond');
    expect(screen.queryByText(/substitution|ride|unresolved/i)).toBeNull();
    expect(screen.getAllByRole('button', { name: /Revisit/ }).every(b => b.getAttribute('aria-pressed') === 'false')).toBe(true);
    expect(state.send).not.toHaveBeenCalled();
  });
  it('records actual independent repair and resets selection on fresh text', () => {
    render(<ReadingRepairStudio data={data} />);
    say('Yesterday Sam ride to the pond');
    fireEvent.click(screen.getByRole('button', { name: 'Revisit rode, word 3' }));
    say('Yesterday Sam rode to the pond');
    finish();
    expect(screen.getByText(/You chose a word to revisit/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try a fresh sentence' }));
    expect(screen.getByText('Challenge 2 of 3')).toBeTruthy();
    expect(screen.queryByLabelText('Replay my first reading')).toBeNull();
    expect(screen.getAllByRole('button', { name: /Revisit/ }).every(b => b.getAttribute('aria-pressed') === 'false')).toBe(true);
  });
  it('keeps support provenance and accurate-first evidence distinct', () => {
    render(<ReadingRepairStudio data={data} />);
    say('Yesterday Sam ride to the pond');
    fireEvent.click(screen.getByRole('button', { name: 'Help me check' }));
    expect((state.options as CaptureOptions).getContext().supported).toBe(true);
    say(data.challenges[0].text);
    finish();
    expect(screen.getByText(/matched after help/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try a fresh sentence' }));
    say(data.challenges[1].text, data.challenges[1].text);
    finish();
    expect(screen.getByText(/nothing to repair/)).toBeTruthy();
  });
  it('does not let replay or a strategy reflection count as repair', () => {
    render(<ReadingRepairStudio data={data} />);
    say('Yesterday Sam ride to the pond');
    fireEvent.play(screen.getByLabelText('Replay my first reading'));
    fireEvent.click(screen.getByRole('button', { name: 'I’m done checking' }));
    fireEvent.click(screen.getByRole('button', { name: 'The letters' }));
    fireEvent.click(screen.getByRole('button', { name: 'Finish this sentence' }));
    expect(screen.getByText(/Some words may still need another look/)).toBeTruthy();
  });
  it('submits one local ledger for a micless session and never calls renderer score callbacks', () => {
    const backendCallback = vi.fn();
    const localCallback = vi.fn();
    render(<ReadingRepairStudio data={{ ...data, onEvaluationSubmit: backendCallback }} onEvaluationSubmit={localCallback} />);
    for (let i = 0; i < 3; i++) { finish(false); if (i < 2) fireEvent.click(screen.getByRole('button', { name: 'Try a fresh sentence' })); }
    expect(state.submit).toHaveBeenCalledTimes(1);
    const [success, , metrics, work] = state.submit.mock.calls[0];
    expect(success).toBe(false);
    expect(metrics).toMatchObject({ unassessableCount: 3, assessableCount: 0, independentRepairRate: null, masteryEligible: false });
    expect(work.evidence).toHaveLength(3);
    expect(screen.queryByText('Provisional summary')).toBeNull();
    expect(state.evaluationOptions).toMatchObject({ localOnly: true, autoSubmitOnUnmount: false, onSubmit: localCallback });
    expect(backendCallback).not.toHaveBeenCalled();
  });
  it('rejects late callbacks after cancellation', () => {
    render(<ReadingRepairStudio data={data} />);
    const options = state.options as CaptureOptions;
    const frozen = options.getContext();
    fireEvent.click(screen.getByRole('button', { name: /Record my reading/ }));
    act(() => options.onSettle(compareReading(data.challenges[0].text, []), { context: frozen, base64: '', url: 'blob:late',
      ms: 3000, modality: 'ptt', timing: { earlyOnset: false, micOpenMs: 1, onsetMs: 1 } }));
    expect(screen.queryByLabelText('Replay my first reading')).toBeNull();
  });
  it('regeneration with reused IDs resets the entire session', () => {
    const view = render(<ReadingRepairStudio data={data} />);
    say(data.challenges[0].text); finish();
    const replacement = { ...data, challenges: data.challenges.map(c => ({ ...c, text: 'The little dog sat by the gate.' })) };
    view.rerender(<ReadingRepairStudio data={replacement} />);
    expect(screen.queryByText(/nothing to repair/)).toBeNull();
    expect(screen.getByText('Challenge 1 of 3')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Record my reading/ })).toBeTruthy();
  });
  it('treats shared tutor speech as support, even without pressing help', () => {
    const view = render(<ReadingRepairStudio data={data} />);
    say('Yesterday Sam ride to the pond');
    fireEvent.click(screen.getByRole('button', { name: 'Revisit rode, word 3' }));
    state.tutorAudible = true;
    view.rerender(<ReadingRepairStudio data={data} />);
    expect(screen.queryByRole('button', { name: /Read it again/ })).toBeNull();
    state.tutorAudible = false;
    view.rerender(<ReadingRepairStudio data={data} />);
    say(data.challenges[0].text); finish();
    expect(screen.getByText(/matched after help/)).toBeTruthy();
  });
});
