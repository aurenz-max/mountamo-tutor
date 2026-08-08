// @vitest-environment jsdom
/**
 * Reader-fit behavioral verification for planetary-explorer — item 16 / slice 2.
 *
 * This is the first slice in the sweep where the primitive ALREADY had a voice:
 * 14 sendText tags, 8 of 12 context vars resolving from the component. So the
 * job was auditing an existing voice for band-fitness, not adding one — and the
 * probe found three things a source read would not:
 *
 *  1. NOTHING ANNOUNCED THE QUESTION. `handleStartQuestions` fired no moment at
 *     all, and [NEXT_ITEM] said only "Moving to question 2 of 3" — never the
 *     question text, never the options. At K the entire question and every
 *     answer were silent text. Replaced with [QUESTION_SHOWN], which carries the
 *     question and every option.
 *  2. THE FIRST-ATTEMPT HINT WAS HANDED THE ANSWER. The message interpolated
 *     `q.options[q.correctIndex]` and then said "give a hint without revealing
 *     the answer" — telling the model the answer while the student still had a
 *     try left, and relying on an instruction to keep it quiet. (The 2026-08-07
 *     handoff recorded this primitive as answer-leak CLEAN; it was not.)
 *  3. The scaffold spoke to a reader: level1 is "Look at the stats panel — one
 *     of those numbers will help you."
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

const sendTextSpy = vi.fn();
vi.mock('../../../../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText: sendTextSpy, isAudioPlaying: false, isConnected: true }),
}));
vi.mock('../../../../evaluation', () => ({
  usePrimitiveEvaluation: () => ({
    submitResult: vi.fn(),
    hasSubmitted: false,
    resetAttempt: vi.fn(),
  }),
}));
vi.mock('../../../../utils/SoundManager', () => ({
  SoundManager: new Proxy({}, { get: () => vi.fn() }),
}));

import PlanetaryExplorer, { type PlanetaryExplorerData } from '../PlanetaryExplorer';

const planet = (id: string) => ({
  planetId: id,
  focusTheme: 'What it looks like',
  description: `${id} is a bright world.`,
  funFact: `${id} is fun to look at.`,
  transition: '',
  keyStats: [
    { label: 'Colour', value: 'Red', unit: '', comparisonToEarth: 'Earth is blue' },
    { label: 'Moons', value: '2', unit: '', comparisonToEarth: 'Earth has 1' },
  ],
  questions: [
    {
      id: `${id}-q0`,
      question: `What colour is ${id}?`,
      questionType: 'mc' as const,
      options: ['Red', 'Blue', 'Green', 'Pink'],
      correctIndex: 0,
      explanation: 'It looks red.',
      difficulty: 1,
    },
    {
      id: `${id}-q1`,
      question: `${id} is red.`,
      questionType: 'true-false' as const,
      options: ['True', 'False'],
      correctIndex: 0,
      explanation: 'Yes it is.',
      difficulty: 1,
    },
  ],
});

const kData = (over: Partial<PlanetaryExplorerData> = {}): PlanetaryExplorerData => ({
  title: 'Planet Trip',
  description: 'Go and see the planets.',
  introduction: 'Come with me to space!',
  celebration: 'You did it!',
  gradeLevel: 'K',
  planets: [planet('mars'), planet('jupiter')],
  quizQuestions: [],
  showOrbits: true,
  showScale: true,
  ...over,
}) as PlanetaryExplorerData;

const g4Data = () => kData({ gradeLevel: '4' });

const sent = () => sendTextSpy.mock.calls.map((c) => String(c[0]));
const sentWith = (t: string) => sent().filter((m) => m.includes(t));

/** Overview -> planet-info -> planet-questions. */
const openQuestions = () => {
  fireEvent.click(screen.getByRole('button', { name: /start|begin|journey|explore/i }));
  fireEvent.click(screen.getByRole('button', { name: /Ready for Questions/i }));
};

beforeEach(() => {
  sendTextSpy.mockReset();
  cleanup();
});

describe('PlanetaryExplorer — the question is spoken, not just shown', () => {
  it('announces the question when the question screen opens (it announced nothing before)', () => {
    render(<PlanetaryExplorer data={kData()} />);
    openQuestions();
    const msg = sentWith('[QUESTION_SHOWN]')[0];
    expect(msg).toBeTruthy();
    expect(msg).toContain('What colour is mars?');
  });

  it('reads EVERY option, because a choice you cannot read is not a choice', () => {
    render(<PlanetaryExplorer data={kData()} />);
    openQuestions();
    const msg = sentWith('[QUESTION_SHOWN]')[0];
    for (const opt of ['Red', 'Blue', 'Green', 'Pink']) expect(msg).toContain(opt);
    expect(msg).toMatch(/read EVERY choice aloud in order/i);
  });

  it('withholds the answer while doing it', () => {
    render(<PlanetaryExplorer data={kData()} />);
    openQuestions();
    expect(sentWith('[QUESTION_SHOWN]')[0]).toMatch(/Do NOT say which one is right/i);
  });

  it('re-announces on the NEXT question too (that beat carried no text before)', () => {
    render(<PlanetaryExplorer data={kData()} />);
    openQuestions();
    fireEvent.click(screen.getByText('Red'));
    fireEvent.click(screen.getByRole('button', { name: /Check Answer/i }));
    fireEvent.click(screen.getByRole('button', { name: /Next Question/i }));
    expect(sentWith('[QUESTION_SHOWN]').some((m) => m.includes('mars is red.'))).toBe(true);
  });
});

describe('PlanetaryExplorer — the answer is not handed over early', () => {
  it('does NOT tell the tutor the correct option on the first wrong attempt', () => {
    render(<PlanetaryExplorer data={kData()} />);
    openQuestions();
    fireEvent.click(screen.getByText('Blue')); // wrong; correct is "Red"
    fireEvent.click(screen.getByRole('button', { name: /Check Answer/i }));

    const first = sentWith('[ANSWER_INCORRECT]')[0];
    expect(first).toBeTruthy();
    expect(first).toMatch(/You are NOT being told the right answer/i);
    expect(first).toMatch(/ONE more try/i);
    expect(first).toMatch(/Do not eliminate options for them/i);
  });

  it('DOES reveal on the final attempt, and says so explicitly', () => {
    render(<PlanetaryExplorer data={kData()} />);
    openQuestions();
    for (const _ of [0, 1]) {
      fireEvent.click(screen.getByText('Blue'));
      fireEvent.click(screen.getByRole('button', { name: /Check Answer/i }));
    }
    const last = sentWith('[ANSWER_INCORRECT]').at(-1)!;
    expect(last).toMatch(/FINAL ATTEMPT/);
    expect(last).toContain('correct is "Red"');
  });
});

describe('PlanetaryExplorer — spoken twins at K-1', () => {
  it('offers read-aloud for the planet description and the fun fact at K', () => {
    render(<PlanetaryExplorer data={kData()} />);
    fireEvent.click(screen.getByRole('button', { name: /start|begin|journey|explore/i }));
    fireEvent.click(screen.getByLabelText(/hear about this planet/i));
    expect(sentWith('[PLANET_READ_ALOUD]')[0]).toContain('mars is a bright world.');
    fireEvent.click(screen.getByLabelText(/hear the fun fact/i));
    expect(sentWith('[PLANET_READ_ALOUD]').some((m) => m.includes('fun to look at'))).toBe(true);
  });

  it('offers a replay of the question and choices at K', () => {
    render(<PlanetaryExplorer data={kData()} />);
    openQuestions();
    fireEvent.click(screen.getByLabelText(/hear the question and choices/i));
    expect(sentWith('[QUESTION_SHOWN]').length).toBeGreaterThan(1);
  });

  it('offers none of it at grade 4', () => {
    render(<PlanetaryExplorer data={g4Data()} />);
    fireEvent.click(screen.getByRole('button', { name: /start|begin|journey|explore/i }));
    expect(screen.queryByLabelText(/hear about this planet/i)).toBeNull();
    expect(screen.queryByLabelText(/hear the fun fact/i)).toBeNull();
  });

  it('sends every beat silently', () => {
    render(<PlanetaryExplorer data={kData()} />);
    openQuestions();
    fireEvent.click(screen.getByLabelText(/hear the question and choices/i));
    for (const c of sendTextSpy.mock.calls) {
      expect((c[1] as { silent?: boolean } | undefined)?.silent).toBe(true);
    }
  });
});

describe('PlanetaryExplorer — adult chrome is gone at K-1 (band contract rule 7)', () => {
  it('hides the "Q1/2" counter at K but keeps it at grade 4', () => {
    const { unmount } = render(<PlanetaryExplorer data={kData()} />);
    openQuestions();
    expect(screen.queryByText(/^Q\d+\/\d+$/)).toBeNull();
    unmount();
    render(<PlanetaryExplorer data={g4Data()} />);
    openQuestions();
    expect(screen.getByText('Q1/2')).toBeTruthy();
  });

  it('drops the A./B. option letters at K but keeps them at grade 4', () => {
    const { unmount } = render(<PlanetaryExplorer data={kData()} />);
    openQuestions();
    expect(screen.queryByText('A.')).toBeNull();
    unmount();
    render(<PlanetaryExplorer data={g4Data()} />);
    openQuestions();
    expect(screen.getByText('A.')).toBeTruthy();
  });

  it('gates by conditional render, not Tailwind `hidden`', () => {
    const { container } = render(<PlanetaryExplorer data={kData()} />);
    openQuestions();
    expect(container.querySelectorAll('.hidden')).toHaveLength(0);
  });
});

describe('PlanetaryExplorer — structural', () => {
  it('never nests a button inside a button', () => {
    for (const d of [kData(), g4Data()]) {
      const { container, unmount } = render(<PlanetaryExplorer data={d} />);
      openQuestions();
      expect(container.querySelectorAll('button button')).toHaveLength(0);
      unmount();
    }
  });
});
