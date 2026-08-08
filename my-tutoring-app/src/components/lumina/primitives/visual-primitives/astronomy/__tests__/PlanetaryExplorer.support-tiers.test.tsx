// @vitest-environment jsdom
/**
 * Within-mode SUPPORT TIER verification for planetary-explorer.
 *
 * The tier is scaffold WITHDRAWAL only — it never changes the journey structure,
 * the questions, the options, the correctIndex, the 2-attempt allowance, or the
 * post-answer explanations. What it does change (hard tier only; easy = legacy):
 *   L1 canvas planet-name labels — hidden ONLY while viewMode === 'quiz'
 *      (legitimate scaffold in every other view — untouched there)
 *   L2 comparisonToEarth captions — hidden; raw value + unit remain
 *   L3 first-miss tutor hint — silent retry (the hint sendText is skipped;
 *      the 2-attempt allowance itself is UNCHANGED)
 *
 * Plus the in-slice rule-#1 leak fix at EVERY tier (incl. legacy):
 *   F1 quiz option dots are neutral slate — a planet's signature color on its
 *      name option answers color-descriptive identify questions from the dot.
 *      Planet-info/stats views keep their colors (teaching surface, untouched).
 *
 * A payload with NO tier field must render the legacy full-help UI unchanged.
 * External hooks (live tutor, evaluation, sound) are mocked.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

const sendText = vi.hoisted(() => vi.fn());
const luminaArgs = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));
vi.mock('../../../../hooks/useLuminaAI', () => ({
  useLuminaAI: (args: Record<string, unknown>) => {
    luminaArgs.current = args;
    return { sendText, isConnected: true };
  },
}));

vi.mock('../../../../evaluation', () => ({
  usePrimitiveEvaluation: () => ({
    submitResult: vi.fn(),
    hasSubmitted: false,
    submittedResult: null,
    elapsedMs: 0,
  }),
  useEvaluationContext: () => null,
}));

vi.mock('../../../../utils/SoundManager', () => ({
  SoundManager: new Proxy({}, { get: () => vi.fn() }),
}));

import PlanetaryExplorer, { type PlanetaryExplorerData } from '../PlanetaryExplorer';

/** Base payload = what the generator emits with NO support tier (legacy full help).
 *  One planet + one question + one quiz question keeps navigation short. The quiz
 *  options deliberately EXCLUDE the journey planet so canvas-label queries are
 *  unambiguous, and they are planet names so the F1 dot fix is exercised. */
const makeData = (
  tierFields: Partial<PlanetaryExplorerData> = {},
): PlanetaryExplorerData => ({
  title: 'Journey Through the Solar System',
  description: 'Visit a planet and answer questions.',
  introduction: 'Welcome, explorer!',
  celebration: 'You did it!',
  gradeLevel: '3',
  planets: [
    {
      planetId: 'earth',
      focusTheme: 'Our Home Planet',
      description: 'The third planet from the Sun.',
      keyStats: [
        { label: 'Diameter', value: '12,742', unit: 'km', comparisonToEarth: 'Reference size' },
        { label: 'Moons', value: '1', comparisonToEarth: 'Our Moon' },
      ],
      funFact: 'It is mostly covered by water.',
      transition: '',
      questions: [
        {
          question: 'How many moons does our home planet have?',
          questionType: 'mc',
          options: ['0', '1', '2', '4'],
          correctIndex: 1,
          explanation: 'It has exactly one moon.',
          difficulty: 'easy',
        },
      ],
    },
  ],
  quizQuestions: [
    {
      question: 'Which planet is known as the red planet?',
      questionType: 'mc',
      options: ['Mars', 'Venus', 'Jupiter', 'Saturn'],
      correctIndex: 0,
      explanation: 'Its surface is covered in iron oxide.',
      difficulty: 'medium',
      aboutPlanetId: 'mars',
    },
  ],
  ...tierFields,
});

const EASY: Partial<PlanetaryExplorerData> = { supportTier: 'easy' };
const MEDIUM: Partial<PlanetaryExplorerData> = { supportTier: 'medium' };
const HARD: Partial<PlanetaryExplorerData> = { supportTier: 'hard' };

// ── Navigation helpers ──────────────────────────────────────────────────────

const begin = () =>
  fireEvent.click(screen.getByRole('button', { name: /Begin Journey/ }));

const toQuestions = () =>
  fireEvent.click(screen.getByRole('button', { name: /Ready for Questions/ }));

const check = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Check Answer' }));

/** Find an answer-option button by its label (strips the "A." letter prefix). */
const optionButton = (label: string): HTMLButtonElement => {
  const btn = screen
    .getAllByRole('button')
    .find((b) => (b.textContent ?? '').replace(/^[A-D]\./, '').trim() === label);
  expect(btn).toBeTruthy();
  return btn as HTMLButtonElement;
};

const clickOption = (label: string) => fireEvent.click(optionButton(label));

/** overview → planet-info → answer the one question correctly → quiz view. */
const toQuiz = () => {
  begin();
  toQuestions();
  clickOption('1'); // correct
  check();
  fireEvent.click(screen.getByRole('button', { name: /Start Identification Quiz/ }));
};

const callsContaining = (fragment: string) =>
  sendText.mock.calls.map((c) => String(c[0])).filter((m) => m.includes(fragment));

// ============================================================================
// L1 — canvas planet-name labels, quiz view only
// ============================================================================

describe('planetary-explorer tier · L1: canvas labels in quiz view', () => {
  beforeEach(() => sendText.mockClear());
  afterEach(cleanup);

  it('hard hides the journey planet label while viewMode is quiz', () => {
    render(<PlanetaryExplorer data={makeData(HARD)} />);
    toQuiz();
    expect(screen.getByText('Identification Quiz')).toBeTruthy(); // we ARE in the quiz
    expect(screen.queryByText('Earth')).toBeNull();               // label withdrawn
  });

  it('hard KEEPS the label in the planet-info view (scaffold untouched outside quiz)', () => {
    render(<PlanetaryExplorer data={makeData(HARD)} />);
    begin();
    // canvas label is a <span>; the planet-info CardTitle is an <h3>
    expect(screen.getByText('Earth', { selector: 'span' })).toBeTruthy();
  });

  it('medium keeps labels in the quiz view', () => {
    render(<PlanetaryExplorer data={makeData(MEDIUM)} />);
    toQuiz();
    expect(screen.getByText('Earth')).toBeTruthy();
  });

  it('easy keeps labels in the quiz view (easy = legacy)', () => {
    render(<PlanetaryExplorer data={makeData(EASY)} />);
    toQuiz();
    expect(screen.getByText('Earth')).toBeTruthy();
  });

  it('legacy (no tier) keeps labels in the quiz view', () => {
    render(<PlanetaryExplorer data={makeData()} />);
    toQuiz();
    expect(screen.getByText('Earth')).toBeTruthy();
  });
});

// ============================================================================
// L2 — comparisonToEarth captions
// ============================================================================

describe('planetary-explorer tier · L2: comparisonToEarth captions', () => {
  beforeEach(() => sendText.mockClear());
  afterEach(cleanup);

  it('legacy shows the caption under every stat', () => {
    render(<PlanetaryExplorer data={makeData()} />);
    begin();
    expect(screen.getByText('Reference size')).toBeTruthy();
    expect(screen.getByText('Our Moon')).toBeTruthy();
  });

  it('easy and medium show the caption (easy = legacy)', () => {
    render(<PlanetaryExplorer data={makeData(EASY)} />);
    begin();
    expect(screen.getByText('Reference size')).toBeTruthy();
    cleanup();
    render(<PlanetaryExplorer data={makeData(MEDIUM)} />);
    begin();
    expect(screen.getByText('Reference size')).toBeTruthy();
  });

  it('hard hides the caption but keeps the raw value + unit (content untouched)', () => {
    render(<PlanetaryExplorer data={makeData(HARD)} />);
    begin();
    expect(screen.queryByText('Reference size')).toBeNull();
    expect(screen.queryByText('Our Moon')).toBeNull();
    expect(screen.getByText('12,742 km')).toBeTruthy(); // value + unit remain
    expect(screen.getByText('Diameter')).toBeTruthy();  // label remains
  });
});

// ============================================================================
// L3 — first-miss tutor hint (silent retry at hard)
// ============================================================================

describe('planetary-explorer tier · L3: first-miss tutor hint', () => {
  beforeEach(() => sendText.mockClear());
  afterEach(cleanup);

  // reader-fit (item 16/S2) re-worded both branches: the first-miss hint no
  // longer interpolates the correct option (it used to hand the model the answer
  // and ask it not to say it). The TIER contract below is unchanged — legacy
  // hints, hard stays silent — so these now match on the branch marker rather
  // than on the prose, which is what the tier is actually about.
  const FIRST_MISS = 'ONE more try';
  const FINAL_REVEAL = 'FINAL ATTEMPT';

  it('legacy sends the first-miss hint on a per-planet question', () => {
    render(<PlanetaryExplorer data={makeData()} />);
    begin();
    toQuestions();
    clickOption('0'); // wrong
    check();
    expect(callsContaining(FIRST_MISS)).toHaveLength(1);
    // …and that hint must NOT contain the answer.
    expect(callsContaining('correct is')).toHaveLength(0);
  });

  it('hard skips the hint — silent retry, but the 2-attempt allowance and explanation channel are UNCHANGED', () => {
    render(<PlanetaryExplorer data={makeData(HARD)} />);
    begin();
    toQuestions();
    clickOption('0'); // wrong, attempt 1
    check();
    expect(callsContaining(FIRST_MISS)).toHaveLength(0);
    // retry still allowed: no feedback shown, Check Answer still on screen
    expect(screen.getByRole('button', { name: 'Check Answer' })).toBeTruthy();
    clickOption('0'); // wrong, attempt 2 — locks in
    check();
    expect(callsContaining(FINAL_REVEAL)).toHaveLength(1); // post-answer channel intact
    expect(screen.getByText('It has exactly one moon.')).toBeTruthy();   // explanation still shown
  });

  it('easy sends the quiz first-miss hint', () => {
    render(<PlanetaryExplorer data={makeData(EASY)} />);
    toQuiz();
    sendText.mockClear();
    clickOption('Venus'); // wrong
    check();
    expect(callsContaining('[QUIZ_HINT]')).toHaveLength(1);
  });

  it('hard skips the quiz hint but keeps the 2-attempt allowance and the incorrect explanation', () => {
    render(<PlanetaryExplorer data={makeData(HARD)} />);
    toQuiz();
    sendText.mockClear();
    clickOption('Venus'); // wrong, attempt 1
    check();
    expect(callsContaining('[QUIZ_HINT]')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Check Answer' })).toBeTruthy(); // retry allowed
    clickOption('Venus'); // wrong, attempt 2 — locks in
    check();
    expect(callsContaining('[QUIZ_INCORRECT]')).toHaveLength(1);
    expect(screen.getByText('Its surface is covered in iron oxide.')).toBeTruthy();
  });
});

// ============================================================================
// F1 — quiz option dots are NEUTRAL at every tier (rule-#1 leak fix)
// ============================================================================

describe('planetary-explorer · F1: neutral quiz option dots at ALL tiers', () => {
  beforeEach(() => sendText.mockClear());
  afterEach(cleanup);

  const QUIZ_OPTIONS = ['Mars', 'Venus', 'Jupiter', 'Saturn'];

  const expectNeutralDots = () => {
    for (const name of QUIZ_OPTIONS) {
      const btn = optionButton(name);
      const dot = btn.querySelector('div');
      expect(dot).toBeTruthy();
      expect(dot!.className).toContain('bg-slate-600');
      // no inline signature color on ANYTHING inside the option button
      expect(btn.innerHTML).not.toMatch(/background-color/);
    }
  };

  it('legacy (no tier): dots are neutral slate — the leak is fixed, not tier-gated', () => {
    render(<PlanetaryExplorer data={makeData()} />);
    toQuiz();
    expectNeutralDots();
  });

  it('easy: dots are neutral slate', () => {
    render(<PlanetaryExplorer data={makeData(EASY)} />);
    toQuiz();
    expectNeutralDots();
  });

  it('hard: dots are neutral slate', () => {
    render(<PlanetaryExplorer data={makeData(HARD)} />);
    toQuiz();
    expectNeutralDots();
  });

  it('planet-info keeps its signature colors even at hard (teaching surface untouched)', () => {
    const { container } = render(<PlanetaryExplorer data={makeData(HARD)} />);
    begin();
    // earth signature color #4a90d9 → rgb(74, 144, 217) on the header planet circle
    const colored = Array.from(container.querySelectorAll('div')).some(
      (d) => (d as HTMLElement).style.backgroundColor === 'rgb(74, 144, 217)',
    );
    expect(colored).toBe(true);
  });
});

// ============================================================================
// Tutor threading — supportTier rides in aiPrimitiveData, omitted when absent
// ============================================================================

describe('planetary-explorer tier · aiPrimitiveData threading', () => {
  beforeEach(() => sendText.mockClear());
  afterEach(cleanup);

  it('supportTier is present in the useLuminaAI primitiveData when set', () => {
    render(<PlanetaryExplorer data={makeData(HARD)} />);
    const pd = luminaArgs.current?.primitiveData as Record<string, unknown>;
    expect(pd.supportTier).toBe('hard');
  });

  it('supportTier is ABSENT (not undefined-present) from primitiveData with no tier', () => {
    render(<PlanetaryExplorer data={makeData()} />);
    const pd = luminaArgs.current?.primitiveData as Record<string, unknown>;
    expect('supportTier' in pd).toBe(false);
  });
});

// ============================================================================
// Keep-trues — structure/content identical across tiers
// ============================================================================

describe('planetary-explorer tier · keep-trues', () => {
  beforeEach(() => sendText.mockClear());
  afterEach(cleanup);

  it('hard renders the same question, all 4 options, and the same correct answer', () => {
    render(<PlanetaryExplorer data={makeData(HARD)} />);
    begin();
    toQuestions();
    expect(screen.getByText('How many moons does our home planet have?')).toBeTruthy();
    for (const label of ['0', '1', '2', '4']) expect(optionButton(label)).toBeTruthy();
    clickOption('1');
    check();
    // correct on index 1 → feedback + explanation shown (correctIndex untouched)
    expect(screen.getByText('It has exactly one moon.')).toBeTruthy();
  });
});
