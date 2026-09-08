// @vitest-environment jsdom
import React from 'react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import LetterWorkshop, { type LetterWorkshopData } from './LetterWorkshop';
import { getLetterTemplate } from './letterWorkshopGeometry';

const { submit, sendText, evaluationOptions, tutor } = vi.hoisted(() => ({ submit: vi.fn(), sendText: vi.fn(), evaluationOptions: vi.fn(), tutor: { isConnected: false, requestHint: vi.fn(), data: vi.fn() } }));
vi.mock('../../../evaluation', () => ({ usePrimitiveEvaluation: (options: unknown) => { evaluationOptions(options); return { submitResult: submit, elapsedMs: 100 }; } }));
vi.mock('../../../hooks/useLuminaAI', () => ({ useLuminaAI: (options: unknown) => { tutor.data(options); return { sendText, isConnected: tutor.isConnected, requestHint: tutor.requestHint, isAudioPlaying: false, sessionMode: 'standalone' }; } }));
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
    expect(screen.getByTestId('letter-copy-model').contains(paper)).toBe(false);
    trace('l'); fireEvent.click(screen.getByRole('button', { name: 'Check my writing' })); next();
    expect(submit.mock.calls[0][2]).toMatchObject({ challengeType: 'copy', correctCount: 1 });
    expect(submit.mock.calls[0][3].attempts[0]).toMatchObject({ type: 'copy', assistance: 'beside-model' });
    expect(evaluationOptions).toHaveBeenLastCalledWith(expect.objectContaining({ localOnly: true }));
  });
  it('hides the target, requires completed speech, and records model exposure on retry', () => {
    const speak = vi.fn();
    vi.stubGlobal('speechSynthesis', { speak, cancel: vi.fn() });
    vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(public text: string) {} });
    const value = modeData('write');
    value.title = 'Write lowercase l'; value.description = 'The target is l.';
    render(<LetterWorkshop data={value} />);
    expect(screen.queryByText(value.title)).toBeNull();
    expect(screen.queryByText(value.description)).toBeNull();
    expect(screen.queryByTestId('letter-copy-model')).toBeNull();
    trace('l');
    expect(screen.getByTestId('letter-writing-paper').querySelector('path[stroke="#244d76"]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Hear the letter name' }));
    expect(speak.mock.calls[0][0].text).toBe('Write the lowercase letter ell.');
    act(() => speak.mock.calls[0][0].onend());
    trace('l'); fireEvent.click(screen.getByRole('button', { name: 'Check my writing' }));
    expect(screen.getByTestId('letter-copy-model')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try this letter again' }));
    trace('l'); fireEvent.click(screen.getByRole('button', { name: 'Check my writing' })); next();
    const attempts = submit.mock.calls[0][3].attempts;
    expect(attempts[0]).toMatchObject({ type: 'write', assistance: 'auditory-cue', modelPreviouslySeen: false, cuePlays: 1 });
    expect(attempts[1]).toMatchObject({ assistance: 'beside-model', modelPreviouslySeen: true });
    expect(sendText.mock.calls.some(([message]) => message.includes('lowercase l'))).toBe(false);
  });
  it('keeps an audio failure unscored and cancels its cue on unmount', () => {
    const speak = vi.fn(), cancel = vi.fn();
    vi.stubGlobal('speechSynthesis', { speak, cancel });
    vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(public text: string) {} });
    const view = render(<LetterWorkshop data={modeData('write')} />);
    fireEvent.click(screen.getByRole('button', { name: 'Hear the letter name' }));
    act(() => speak.mock.calls[0][0].onerror());
    expect(screen.getByText(/could not play/)).toBeTruthy();
    trace('l'); expect(submit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Hear the letter name' }));
    const stale = speak.mock.calls[1][0];
    view.unmount();
    expect(cancel).toHaveBeenCalled(); expect(stale.onend).toBeNull();
  });
});

beforeEach(() => {
  vi.clearAllMocks();
  tutor.isConnected = false;
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
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

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
    tutor.isConnected = true;
    const value = data(['l', 't']); value.challenges[1].type = 'write';
    render(<LetterWorkshop data={value} />);
    trace('l'); check(); next();
    expect(tutor.data.mock.lastCall?.[0].primitiveData).toMatchObject({ letter: 'withheld', letterCase: 'withheld', modelVisible: false, challengeType: 'write' });
    expect(sendText.mock.calls.filter(([text]) => text.includes('[NEXT_ITEM]'))).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Help me' }));
    const state = tutor.requestHint.mock.lastCall?.[1];
    expect(state).toMatchObject({ letter: 'withheld', assistance: 'auditory-cue', cueState: 'idle' });
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
