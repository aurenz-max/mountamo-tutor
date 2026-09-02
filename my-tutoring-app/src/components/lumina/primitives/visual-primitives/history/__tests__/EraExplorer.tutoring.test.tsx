// @vitest-environment jsdom
/**
 * L2 tutoring-surface gate for era-explorer.
 *
 * `/tutor-test` Tier 1 proves the catalog scaffold RESOLVES; it cannot prove the
 * two new student-facing surfaces actually fire what the directives promise. The
 * live risks are behavioral: a read-aloud that ships the pre-reader a statement
 * without its choices leaves a non-reader unable to answer, and a first-person
 * era voice that survives into the challenge phase can brush the live statement
 * the NEVER NAME THE BOX directive is there to protect.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

const sendTextSpy = vi.fn();
vi.mock('../../../../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText: sendTextSpy, isConnected: true, isAudioPlaying: false }),
}));
vi.mock('../../../../evaluation', () => ({
  usePrimitiveEvaluation: () => ({
    submitResult: vi.fn(),
    hasSubmitted: false,
    resetAttempt: vi.fn(),
    submittedResult: null,
    elapsedMs: 0,
  }),
}));
vi.mock('../../../../utils/SoundManager', () => ({
  SoundManager: new Proxy({}, { get: () => vi.fn() }),
}));

import EraExplorer, { type EraExplorerData } from '../EraExplorer';

const LENS_BODY = 'Families cooked on a wood stove and carried water in from the pump outside.';

const data = (over: Partial<EraExplorerData> = {}): EraExplorerData => ({
  title: 'Life Long Ago',
  description: 'Look at how people lived.',
  eraName: 'Pioneer Times',
  eraPeriod: 'about 150 years ago',
  priorEra: { name: 'Before the Wagons', body: 'People walked everywhere.' },
  lenses: [
    { title: 'Daily Life', body: LENS_BODY, icon: '🏠' },
    { title: 'Technology', body: 'Light came from candles and oil lamps.', icon: '🕯️' },
    { title: 'School & Work', body: 'Children did chores before walking to school.', icon: '✏️' },
  ],
  challenges: [
    {
      id: 'c1',
      type: 'era_sort',
      statement: 'Children carry water in from outside.',
      options: ['Pioneer Times', 'Today', 'Both'],
      correctIndex: 0,
      explanation: 'Homes did not have taps yet.',
      lensHint: 'Daily Life',
    },
  ],
  challengeType: 'era_sort',
  gradeLevel: 'K',
  ...over,
});

const sent = () => sendTextSpy.mock.calls.map((c) => String(c[0]));
const tagged = (tag: string) => sent().find((m) => m.includes(tag));

/** Open every lens tab, then cross into the challenge phase. */
const startQuestions = () => {
  fireEvent.click(screen.getByText('Technology'));
  fireEvent.click(screen.getByText('School & Work'));
  fireEvent.click(screen.getByText(/Start the Questions/));
};

beforeEach(() => {
  cleanup();
  sendTextSpy.mockClear();
});

describe('era-explorer L2 — the read-aloud channel', () => {
  it('opens with a pre-reader clause at K and without one at grade 4', () => {
    render(<EraExplorer data={data()} />);
    expect(tagged('[ACTIVITY_START]')).toMatch(/pre-reader and cannot read/i);
    cleanup();
    sendTextSpy.mockClear();
    render(<EraExplorer data={data({ gradeLevel: '4' })} />);
    expect(tagged('[ACTIVITY_START]')).toBeTruthy();
    expect(tagged('[ACTIVITY_START]')).not.toMatch(/pre-reader/i);
  });

  it('reads the lens body word for word, tied to the era', () => {
    render(<EraExplorer data={data()} />);
    fireEvent.click(screen.getByLabelText('Read this to me'));
    const msg = tagged('[ERA_READ_ALOUD]')!;
    expect(msg).toContain(LENS_BODY);
    expect(msg).toContain('Daily Life, in Pioneer Times');
    expect(msg).toMatch(/word for word/i);
  });

  it('reads the question WITH all three choices — a non-reader cannot see them', () => {
    render(<EraExplorer data={data()} />);
    startQuestions();
    sendTextSpy.mockClear();
    fireEvent.click(screen.getByLabelText('Hear the question and the choices'));
    const msg = tagged('[ERA_READ_ALOUD]')!;
    expect(msg).toContain('When did life look like this?');
    expect(msg).toContain('Children carry water in from outside.');
    expect(msg).toContain('Pioneer Times, Today, Both');
  });
});

describe('era-explorer L2 — the first-person era voice', () => {
  it('carries only the open lens, and never the challenge statement', () => {
    render(<EraExplorer data={data()} />);
    fireEvent.click(screen.getByText(/Someone who lived then/));
    const msg = tagged('[ERA_FIGURE_VOICE]')!;
    expect(msg).toContain('Daily Life');
    expect(msg).toContain(LENS_BODY);
    expect(msg).not.toContain('Children carry water in from outside.');
  });

  it('is gone once the questions start — it cannot brush a live statement', () => {
    render(<EraExplorer data={data()} />);
    startQuestions();
    expect(screen.queryByText(/Someone who lived then/)).toBeNull();
    // The lens read-aloud survives the crossing; only the persona withdraws.
    expect(screen.getByLabelText('Read this to me')).toBeTruthy();
  });
});
