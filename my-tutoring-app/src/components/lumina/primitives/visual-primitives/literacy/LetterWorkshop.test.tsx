// @vitest-environment jsdom
import React from 'react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import LetterWorkshop, { type LetterWorkshopData } from './LetterWorkshop';
import { getLetterTemplate } from './letterWorkshopGeometry';
import { judgeAcceptsLetter } from './letterWorkshopJudge';

const { submit, sendText, evaluationOptions, tutor, judge } = vi.hoisted(() => ({ submit: vi.fn(), sendText: vi.fn(), evaluationOptions: vi.fn(), judge: vi.fn(), tutor: { isConnected: false, isAudioPlaying: false, requestHint: vi.fn(), data: vi.fn() } }));
vi.mock('../../../evaluation', () => ({ usePrimitiveEvaluation: (options: unknown) => { evaluationOptions(options); return { submitResult: submit, elapsedMs: 100 }; } }));
vi.mock('../../../hooks/useLuminaAI', () => ({ useLuminaAI: (options: unknown) => { tutor.data(options); return { sendText, isConnected: tutor.isConnected, requestHint: tutor.requestHint, isAudioPlaying: tutor.isAudioPlaying, isAIResponding: false, sessionMode: 'standalone' }; } }));
vi.mock('./letterWorkshopJudge', async (original) => ({ ...(await original<typeof import('./letterWorkshopJudge')>()), judgeLetterDrawing: judge }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: { navigate: vi.fn() } }));
vi.mock('../../../components/PhaseSummaryPanel', () => ({ default: () => <div>Tracing session complete</div> }));

const data = (letters = ['l', 'i', 't']): LetterWorkshopData => ({ title: 'Letter Workshop',
  description: 'Practice letter paths.', gradeLevel: 'K', challengeType: 'trace', instanceId: 'test-workshop',
  challenges: letters.map((letter, index) => ({ id: `letter-${index}`, type: 'trace', templateId: `lowercase-${letter}` })),
});

describe('Letter Workshop copy and auditory writing', () => {
  const modeData = (mode: 'copy' | 'write') => {
    const value = data(['l']);
    value.challengeType = mode;
    value.challenges[0].type = mode;
    return value;
  };
  it('renders a separate copy model and blank drawing paper, with local practice evidence', () => {
    render(<LetterWorkshop data={modeData('copy')} />);
    const paper = screen.getByTestId('letter-writing-paper');
    expect(paper.querySelector('path[stroke="#386f72"]')).toBeNull();
    expect(screen.queryByTestId('letter-feedback-reference')).toBeNull();
    expect(screen.getByTestId('letter-copy-model').contains(paper)).toBe(false);
    trace('l'); fireEvent.click(screen.getByRole('button', { name: 'Check my writing' }));
    expect(screen.getByTestId('letter-feedback-reference')).toBeTruthy();
    next();
    expect(submit.mock.calls[0][2]).toMatchObject({ challengeType: 'copy', correctCount: 1 });
    expect(submit.mock.calls[0][3].attempts[0]).toMatchObject({ type: 'copy', assistance: 'beside-model' });
    expect(evaluationOptions).toHaveBeenLastCalledWith(expect.objectContaining({ localOnly: true }));
  });
  it('hides the target, has the live tutor say its name, and records model exposure on retry', () => {
    vi.useFakeTimers();
    tutor.isConnected = true;
    const value = modeData('write');
    value.title = 'Write lowercase l'; value.description = 'The target is l.';
    const view = render(<LetterWorkshop data={value} />);
    expect(screen.queryByText(value.title)).toBeNull();
    expect(screen.queryByText(value.description)).toBeNull();
    expect(screen.queryByTestId('letter-copy-model')).toBeNull();
    // The item says its letter as soon as the tutor is free; the paper waits for that audio.
    const cues = sendText.mock.calls.filter(([message]) => message.startsWith('[SAY_LETTER]'));
    expect(cues).toHaveLength(1);
    expect(cues[0][0]).toContain('"Write the lowercase letter L. Lowercase L."');
    expect(cues[0][0]).toContain('pronounced "ell"');
    expect(cues[0][1]).toEqual({ silent: true, scripted: true });
    trace('l');
    expect(screen.getByTestId('letter-writing-paper').querySelector('path[stroke="#244d76"]')).toBeNull();
    tutorSays(view, value);
    trace('l'); fireEvent.click(screen.getByRole('button', { name: 'Check my writing' }));
    expect(screen.getByTestId('letter-copy-model')).toBeTruthy();
    expect(screen.getByTestId('letter-feedback-reference')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try this letter again' }));
    trace('l'); fireEvent.click(screen.getByRole('button', { name: 'Check my writing' })); next();
    const attempts = submit.mock.calls[0][3].attempts;
    expect(attempts[0]).toMatchObject({ type: 'write', assistance: 'auditory-cue', modelPreviouslySeen: false, cuePlays: 1, visionJudge: null });
    expect(attempts[1]).toMatchObject({ assistance: 'beside-model', modelPreviouslySeen: true });
    expect(judge).not.toHaveBeenCalled();
    // Only the private cue names the letter.
    expect(sendText.mock.calls.filter(([message]) => !message.startsWith('[SAY_LETTER]'))
      .some(([message]) => /lowercase l\b|letter L\b/i.test(message))).toBe(false);
  });
  it('keeps a silent cue unscored, offers a replay, and clears its timer on unmount', () => {
    vi.useFakeTimers();
    tutor.isConnected = true;
    const view = render(<LetterWorkshop data={modeData('write')} />);
    act(() => { vi.advanceTimersByTime(10000); });
    expect(screen.getByText(/did not play/)).toBeTruthy();
    trace('l'); expect(submit).not.toHaveBeenCalled();
    expect(screen.getByTestId('letter-writing-paper').querySelector('path[stroke="#244d76"]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Hear the letter name' }));
    expect(sendText.mock.calls.filter(([message]) => message.startsWith('[SAY_LETTER]'))).toHaveLength(2);
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('waits for the tutor instead of falling back to browser speech', () => {
    const speak = vi.fn();
    vi.stubGlobal('speechSynthesis', { speak, cancel: vi.fn() });
    render(<LetterWorkshop data={modeData('write')} />);
    expect(screen.getByText(/Waiting for your tutor/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Hear the letter name' }) as HTMLButtonElement).disabled).toBe(true);
    expect(speak).not.toHaveBeenCalled();
    expect(sendText).not.toHaveBeenCalled();
  });
});

describe('Letter Workshop vision second opinion', () => {
  const copyData = () => { const value = data(['l']); value.challengeType = 'copy'; value.challenges[0].type = 'copy'; return value; };
  const verdict = (writtenAs: string, recognized = true) => ({ writtenAs, recognized, score: 90, confidence: 90, feedback: recognized ? 'You made a tall line!' : 'That looks like a different letter.' });

  it('accepts a letter the geometry missed when Gemini reads the target', async () => {
    judge.mockResolvedValue(verdict('l'));
    render(<LetterWorkshop data={copyData()} />);
    trace('l', true);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Check my writing' })); });
    expect(judge).toHaveBeenCalledTimes(1);
    expect(judge.mock.calls[0][1]).toMatchObject({ id: 'lowercase-l' });
    expect(screen.getByText('You wrote it')).toBeTruthy();
    expect(screen.getByText('You made a tall line!')).toBeTruthy();
    next();
    expect(submit.mock.calls[0][2]).toMatchObject({ correctCount: 1 });
    const [attempt] = submit.mock.calls[0][3].attempts;
    expect(attempt.assessment.passed).toBe(true);
    expect(attempt.visionJudge).toMatchObject({ writtenAs: 'l', accepted: true, version: 'letter-vision-v1' });
  });

  it('keeps the geometric miss when Gemini reads another letter or fails', async () => {
    judge.mockResolvedValueOnce(verdict('L')).mockResolvedValueOnce(null);
    render(<LetterWorkshop data={copyData()} />);
    trace('l', true);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Check my writing' })); });
    expect(screen.getByText('Try this')).toBeTruthy();
    expect(screen.queryByText('You made a tall line!')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Try this letter again' }));
    trace('l', true);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Check my writing' })); });
    expect(screen.getByText('Try this')).toBeTruthy();
    next();
    const attempts = submit.mock.calls[0][3].attempts;
    expect(attempts.map((a: { assessment: { passed: boolean } }) => a.assessment.passed)).toEqual([false, false]);
    expect(attempts[0].visionJudge).toMatchObject({ writtenAs: 'L', accepted: false });
    expect(attempts[1].visionJudge).toBeNull();
  });

  it('never asks Gemini about a trace', () => {
    render(<LetterWorkshop data={data(['l'])} />);
    trace('l', true); check();
    expect(judge).not.toHaveBeenCalled();
    expect(screen.getByText('Try this')).toBeTruthy();
  });

  it('accepts only its own reading, allowing case only for same-shape letters', () => {
    const lower = (letter: string) => getLetterTemplate(`lowercase-${letter}`);
    expect(judgeAcceptsLetter(verdict('p'), lower('p'))).toBe(true);
    expect(judgeAcceptsLetter(verdict('q'), lower('p'))).toBe(false);
    expect(judgeAcceptsLetter(verdict('P'), lower('p'))).toBe(false);
    expect(judgeAcceptsLetter(verdict('C'), lower('c'))).toBe(true);
    expect(judgeAcceptsLetter(verdict('c', false), lower('c'))).toBe(false);
    expect(judgeAcceptsLetter({ ...verdict('p'), confidence: 40 }, lower('p'))).toBe(false);
    expect(judgeAcceptsLetter(null, lower('p'))).toBe(false);
  });
});

/** Tutor audio plays and then stays quiet past the 500 ms settle window. */
function tutorSays(view: ReturnType<typeof render>, value: LetterWorkshopData) {
  tutor.isAudioPlaying = true; view.rerender(<LetterWorkshop data={value} />);
  tutor.isAudioPlaying = false; view.rerender(<LetterWorkshop data={value} />);
  act(() => { vi.advanceTimersByTime(600); });
}

beforeEach(() => {
  vi.clearAllMocks();
  judge.mockResolvedValue(null);
  tutor.isConnected = false;
  tutor.isAudioPlaying = false;
  class Pointer extends MouseEvent {
    pointerId: number; pointerType: string; isPrimary: boolean;
    constructor(type: string, options: PointerEventInit) {
      super(type, options);
      this.pointerId = options.pointerId ?? 1;
      this.pointerType = options.pointerType ?? 'pen';
      this.isPrimary = options.isPrimary ?? true;
    }
  }
  vi.stubGlobal('PointerEvent', Pointer);
  Object.assign(SVGElement.prototype, {
    getScreenCTM: () => ({ inverse: () => ({}) }),
    createSVGPoint: () => ({ x: 0, y: 0, matrixTransform() { return this; } }),
    setPointerCapture: vi.fn(), hasPointerCapture: () => false, releasePointerCapture: vi.fn(),
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });

function trace(letter: string, reverse = false) {
  const paper = screen.getByTestId('letter-writing-paper');
  for (const reference of getLetterTemplate(`lowercase-${letter}`).strokes) {
    const path = reverse ? [...reference].reverse() : reference;
    const first = path[0];
    fireEvent.pointerDown(paper, { clientX: first.x, clientY: first.y, button: 0, pointerId: 1, isPrimary: true });
    for (const point of path.slice(1)) fireEvent.pointerMove(paper, { clientX: point.x, clientY: point.y, pointerId: 1 });
    const last = path[path.length - 1];
    fireEvent.pointerUp(paper, { clientX: last.x, clientY: last.y, pointerId: 1 });
  }
}
const check = () => fireEvent.click(screen.getByRole('button', { name: 'Check my tracing' }));
const next = () => fireEvent.click(screen.getByRole('button', { name: /Next letter|Finish practice/ }));

describe('Letter Workshop captured-writing lifecycle', () => {
  it('preserves cleared and failed attempts, resets each letter, and submits one full evidence ledger', () => {
    render(<LetterWorkshop data={data()} />);
    expect((screen.getByRole('button', { name: 'Check my tracing' }) as HTMLButtonElement).disabled).toBe(true);
    trace('l');
    fireEvent.click(screen.getByRole('button', { name: 'Clear writing' }));
    trace('l', true); check();
    expect(screen.getByText('Try this')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try this letter again' }));
    trace('l'); check(); next();
    expect((screen.getByRole('button', { name: 'Check my tracing' }) as HTMLButtonElement).disabled).toBe(true);
    trace('i'); check(); next();
    trace('t'); check(); next();
    expect(screen.getByText('Tracing session complete')).toBeTruthy();
    expect(submit).toHaveBeenCalledTimes(1);
    const [success, score, metrics, work] = submit.mock.calls[0];
    expect(success).toBe(true); expect(score).toBe(100);
    expect(metrics).toMatchObject({ correctCount: 3, attemptsCount: 5, firstTryCount: 2 });
    expect(work.assistance).toBe('trace-guide');
    expect(work.attempts.map((attempt: { disposition: string }) => attempt.disposition))
      .toEqual(['cleared', 'submitted', 'submitted', 'submitted', 'submitted']);
    expect(work.attempts[1].assessment.passed).toBe(false);
    expect(work.attempts[0].strokes[0].points.length).toBeGreaterThan(1);
  });

  it('can move on after an unsuccessful trace without awarding success', () => {
    render(<LetterWorkshop data={data(['l'])} />);
    trace('l', true); check(); next();
    expect(submit.mock.calls[0][0]).toBe(false);
    expect(submit.mock.calls[0][2]).toMatchObject({ correctCount: 0, overallAccuracy: 0 });
  });

  it('starts a fresh evidence and submission session on regenerated payloads with reused challenge IDs', () => {
    const view = render(<LetterWorkshop data={data(['l'])} />);
    trace('l'); check(); next();
    view.rerender(<LetterWorkshop data={data(['t'])} />);
    expect((screen.getByRole('button', { name: 'Check my tracing' }) as HTMLButtonElement).disabled).toBe(true);
    trace('t'); check(); next();
    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit.mock.calls[1][3].attempts).toHaveLength(1);
    expect(submit.mock.calls[1][3].attempts[0].templateId).toBe('lowercase-t');
  });

  it('ignores a second pointer and releases interrupted capture without submitting', () => {
    render(<LetterWorkshop data={data(['l'])} />);
    const paper = screen.getByTestId('letter-writing-paper');
    fireEvent.pointerDown(paper, { clientX: 200, clientY: 60, pointerId: 1, button: 0 });
    fireEvent.pointerDown(paper, { clientX: 20, clientY: 20, pointerId: 2, button: 0, isPrimary: false });
    fireEvent.pointerMove(paper, { clientX: 350, clientY: 250, pointerId: 2 });
    expect((screen.getByRole('button', { name: 'Check my tracing' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.pointerCancel(paper, { pointerId: 1 });
    check(); next();
    expect(submit.mock.calls[0][3].attempts[0].strokes).toHaveLength(1);
    expect(submit.mock.calls[0][0]).toBe(false);
  });

  it('resets evidence and submission guards when regenerated letters happen to be identical', () => {
    const view = render(<LetterWorkshop data={data(['l'])} />);
    trace('l'); check(); next();
    view.rerender(<LetterWorkshop data={data(['l'])} />);
    expect(screen.queryByText('Tracing session complete')).toBeNull();
    expect((screen.getByRole('button', { name: 'Check my tracing' }) as HTMLButtonElement).disabled).toBe(true);
    trace('l'); check(); next();
    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit.mock.calls[1][3].attempts).toHaveLength(1);
  });

  it('rejects duplicate IDs and unknown geometry before mounting an evaluated session', () => {
    const invalid = data();
    invalid.challenges[1].id = invalid.challenges[0].id;
    render(<LetterWorkshop data={invalid} />);
    expect(screen.queryByTestId('letter-writing-paper')).toBeNull();
    expect(submit).not.toHaveBeenCalled();
  });
});


describe('Letter Workshop tutor moments', () => {
  it('introduces each trace once and keeps pointer gestures silent', () => {
    tutor.isConnected = true;
    render(<LetterWorkshop data={data(['l', 't'])} />);
    expect(sendText.mock.calls.filter(([text]) => text.includes('[ACTIVITY_START]'))).toHaveLength(1);
    const paper = screen.getByTestId('letter-writing-paper');
    fireEvent.pointerDown(paper, { clientX: 200, clientY: 60, pointerId: 1, button: 0 });
    expect((screen.getByRole('button', { name: 'Help me' }) as HTMLButtonElement).disabled).toBe(true);
    expect(tutor.data.mock.lastCall?.[0].primitiveData.interactionState).toBe('drawing');
    expect(sendText).toHaveBeenCalledTimes(1);
    fireEvent.pointerUp(paper, { clientX: 200, clientY: 240, pointerId: 1 });
    check();
    expect(sendText.mock.lastCall?.[0]).toContain('[ANSWER_CORRECT]');
    next();
    expect(sendText.mock.calls.filter(([text]) => text.includes('[NEXT_ITEM]'))).toHaveLength(1);
    expect(sendText.mock.lastCall?.[0]).toContain('lowercase t');
    expect(sendText.mock.calls.every(([, options]) => options.silent === true)).toBe(true);
  });
  it('sends progressively stronger hints with current feedback and assistance', () => {
    tutor.isConnected = true;
    render(<LetterWorkshop data={data(['l'])} />);
    trace('l', true); check();
    for (let i = 0; i < 4; i++) fireEvent.click(screen.getByRole('button', { name: 'Help me' }));
    expect(tutor.requestHint.mock.calls.map(([level]) => level)).toEqual([1, 2, 3, 3]);
    expect(tutor.requestHint.mock.lastCall?.[1]).toMatchObject({ assistance: 'trace-guide', interactionState: 'feedback', feedbackFocus: 'start-or-order', hintLevel: 3 });
    next();
    expect(submit.mock.calls[0][2].hintsViewed).toBe(4);
  });
  it('overwrites visible-letter context on transition to write and uses procedural hints', () => {
    vi.useFakeTimers();
    tutor.isConnected = true;
    const value = data(['l', 't']); value.challenges[1].type = 'write';
    const view = render(<LetterWorkshop data={value} />);
    trace('l'); check(); next();
    expect(tutor.data.mock.lastCall?.[0].primitiveData).toMatchObject({ letter: 'withheld', letterCase: 'withheld', modelVisible: false, challengeType: 'write', cueState: 'speaking' });
    expect(sendText.mock.calls.filter(([text]) => text.includes('[NEXT_ITEM]'))).toHaveLength(0);
    expect(sendText.mock.lastCall?.[0]).toContain('[SAY_LETTER] Say exactly this and nothing else: "Write the lowercase letter T.');
    expect((screen.getByRole('button', { name: 'Help me' }) as HTMLButtonElement).disabled).toBe(true);
    tutorSays(view, value);
    fireEvent.click(screen.getByRole('button', { name: 'Help me' }));
    const state = tutor.requestHint.mock.lastCall?.[1];
    expect(state).toMatchObject({ letter: 'withheld', assistance: 'auditory-cue', cueState: 'ready' });
    expect(JSON.stringify(state)).not.toContain('lowercase-t');
  });
  it('does not interrupt existing handwriting with a late-connection greeting', () => {
    const value = data(['l']);
    const view = render(<LetterWorkshop data={value} />);
    trace('l');
    tutor.isConnected = true; view.rerender(<LetterWorkshop data={value} />);
    expect(sendText).not.toHaveBeenCalled();
  });
});


describe('Letter Workshop tier surfaces', () => {
  for (const mode of ['trace', 'copy', 'write'] as const) for (const tier of ['easy', 'medium', 'hard'] as const) {
    it(`${mode}/${tier} preserves its task while withdrawing aids`, () => {
      const value = data(['l']); value.challengeType = mode;
      value.challenges[0].type = mode; value.challenges[0].supportTier = tier;
      render(<LetterWorkshop data={value} />);
      const paper = screen.getByTestId('letter-writing-paper');
      expect(Boolean(paper.querySelector('path[stroke="#386f72"]'))).toBe(mode === 'trace');
      expect(Boolean(screen.queryByTestId('letter-start'))).toBe(mode === 'trace' && tier !== 'hard');
      expect(Boolean(screen.queryByTestId('letter-arrow'))).toBe(mode === 'trace' && tier === 'easy');
      expect(Boolean(screen.queryByTestId('letter-line-labels'))).toBe(tier !== 'hard');
      expect(Boolean(screen.queryByTestId('letter-self-check'))).toBe(tier === 'easy');
      expect(Boolean(screen.queryByTestId('letter-copy-model'))).toBe(mode === 'copy');
      if (mode === 'trace' && tier === 'hard') {
        trace('l', true); check();
        expect(screen.getByRole('status').textContent).not.toMatch(/numbered|arrow|starting dot/i);
        expect(paper.querySelector('circle[stroke="#b77824"]')).toBeNull();
      }
    });
  }
});
