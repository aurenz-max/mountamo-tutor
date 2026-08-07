// @vitest-environment jsdom
/**
 * Reader-fit behavioral test for story-planner @ PRE — 2026-08-07. Item 15A / S4.
 *
 * Pre-fix this primitive was mute (no catalog `tutoring` block, no `useLuminaAI`)
 * and its entire interaction at Kindergarten was two free-text `<textarea>`s —
 * band-contract rule 6, the day-night-seasons shape. It also scored the plan by
 * `text.length > 5`, so a K child who cannot type scored 0 and any six
 * characters scored full marks.
 *
 * The contract asserted here:
 *   - K-1 has NO typing: one question per screen, three picture cards, tap = choose
 *   - the arc is ORDERED by tapping picture cards into numbered slots, and the
 *     generated (correct) order never reaches the screen
 *   - the tutor carries every load-bearing string — the story idea, the question,
 *     the option captions — and never states or eliminates the arc order
 *   - adult chrome (grade badge, phase ribbon, "Writing Prompt:" label, the
 *     generated arc labels) is gone at K-1
 *   - the score comes from the INSTRUMENT (plan complete + events in order)
 *   - grade 2+ keeps the free-text planner untouched (the control)
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

const sendText = vi.fn();
vi.mock('../../../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText, isAudioPlaying: false, isConnected: true }),
}));

const submitResult = vi.fn();
const evalState = { hasSubmitted: false };
vi.mock('../../../evaluation', () => ({
  usePrimitiveEvaluation: () => ({
    submitResult,
    hasSubmitted: evalState.hasSubmitted,
    submittedResult: null,
    elapsedMs: 0,
  }),
  useEvaluationContext: () => null,
}));

vi.mock('../../../utils/SoundManager', () => ({
  SoundManager: {
    select: vi.fn(), snap: vi.fn(), pop: vi.fn(), navigate: vi.fn(),
    tap: vi.fn(), playPerfect: vi.fn(), playCorrect: vi.fn(), playIncorrect: vi.fn(),
    isEnabled: () => false, getVolume: () => 0,
  },
}));

import StoryPlanner, {
  splitPictureOption,
  shuffleArcEvents,
  type StoryPlannerData,
} from './StoryPlanner';

const PROMPT_K = 'Tell a fun story about what happens when you go to play at the park!';
const ARC_EVENTS = ['🏃 Came to the big park', '🏠 Went back home to rest'];

const kData = (over: Partial<StoryPlannerData> = {}): StoryPlannerData => ({
  title: 'A Day at the Park',
  gradeLevel: 'K',
  writingPrompt: PROMPT_K,
  elements: [
    {
      elementId: 'char_1', label: 'Character', prompt: 'Who is in your story?', required: true,
      choices: ['🐶 A happy puppy', '👧 A smiling girl', '🐸 A little frog'],
    },
    {
      elementId: 'event_1', label: 'What Happened', prompt: 'What did they do at the park?', required: true,
      choices: ['🛝 Went down the slide', '⚽ Played with a ball', '🍦 Ate a sweet treat'],
    },
  ],
  storyArcLabels: ['Beginning', 'End'],
  arcEvents: ARC_EVENTS.slice(),
  instanceId: 'test-story-planner',
  ...over,
});

/** Grade 3: what the generator actually returns above the band — no picture content. */
const g3Data = (): StoryPlannerData => ({
  title: 'A Day at the Park',
  gradeLevel: '3',
  writingPrompt: 'Write a narrative about an unforgettable afternoon at the park.',
  elements: [
    { elementId: 'char_1', label: 'Character', prompt: 'Who is the main character?', required: true },
    { elementId: 'set_1', label: 'Setting', prompt: 'Describe the park in detail.', required: true },
  ],
  storyArcLabels: ['Beginning', 'Rising Action', 'Climax', 'Falling Action', 'Resolution'],
  instanceId: 'test-story-planner-g3',
});

const sent = () => sendText.mock.calls.map(c => String(c[0]));
const textareas = () => document.querySelectorAll('textarea');

/** Walk the K plan phase by tapping the first option on every element screen. */
const completePlan = () => {
  fireEvent.click(screen.getByLabelText('A happy puppy'));
  fireEvent.click(screen.getByLabelText('Went down the slide'));
};

beforeEach(() => {
  cleanup();
  sendText.mockClear();
  submitResult.mockClear();
  evalState.hasSubmitted = false;
});

// ---------------------------------------------------------------------------

describe('StoryPlanner @ K — rule 6: no typing', () => {
  it('renders NO textarea anywhere in the K flow', () => {
    render(<StoryPlanner data={kData()} />);
    expect(textareas()).toHaveLength(0);
    completePlan();
    expect(textareas()).toHaveLength(0);
  });

  it('grade 3 still gets the free-text planner (control)', () => {
    render(<StoryPlanner data={g3Data()} />);
    expect(textareas().length).toBeGreaterThan(0);
  });
});

describe('StoryPlanner @ K — rules 2/3/4: one question, three pictures, one tap', () => {
  it('shows exactly the three picture options for the FIRST element only', () => {
    render(<StoryPlanner data={kData()} />);
    expect(screen.getByLabelText('A happy puppy')).toBeTruthy();
    expect(screen.getByLabelText('A smiling girl')).toBeTruthy();
    expect(screen.getByLabelText('A little frog')).toBeTruthy();
    // Element 2 is a separate screen — band-contract rule 4.
    expect(screen.queryByLabelText('Went down the slide')).toBeNull();
  });

  it('renders the emoji as the answer surface with the words as a caption', () => {
    render(<StoryPlanner data={kData()} />);
    const card = screen.getByLabelText('A happy puppy');
    expect(card.textContent).toContain('🐶');
    expect(card.textContent).toContain('A happy puppy');
  });

  it('one tap chooses AND advances — no confirm step', () => {
    render(<StoryPlanner data={kData()} />);
    fireEvent.click(screen.getByLabelText('A happy puppy'));
    expect(screen.getByLabelText('Went down the slide')).toBeTruthy();
    expect(screen.queryByLabelText('A happy puppy')).toBeNull();
  });
});

describe('StoryPlanner @ K — rule 7: no adult chrome in the child field', () => {
  it('hides the grade badge, the phase ribbon and the "Writing Prompt:" label', () => {
    render(<StoryPlanner data={kData()} />);
    expect(screen.queryByText(/Grade K/)).toBeNull();
    expect(screen.queryByText('Plan Elements')).toBeNull();
    expect(screen.queryByText('Story Arc')).toBeNull();
    expect(screen.queryByText('Review')).toBeNull();
    expect(screen.queryByText(/Writing Prompt:/)).toBeNull();
  });

  it('does not PRINT the writing-prompt sentence a non-reader cannot decode', () => {
    render(<StoryPlanner data={kData()} />);
    expect(document.body.textContent).not.toContain(PROMPT_K);
  });

  it('keeps all of it at grade 3 (control)', () => {
    render(<StoryPlanner data={g3Data()} />);
    expect(screen.getByText(/Grade 3/)).toBeTruthy();
    expect(screen.getByText('Plan Elements')).toBeTruthy();
    expect(screen.getByText(/Writing Prompt:/)).toBeTruthy();
  });
});

describe('StoryPlanner @ K — rule 1: the tutor is the instruction channel', () => {
  it('reads the story idea aloud in the opening beat, with the one-sentence cap override', () => {
    render(<StoryPlanner data={kData()} />);
    const beat = sent().find(m => m.includes('[STORY_ELEMENT_ASKED]'))!;
    expect(beat).toBeTruthy();
    expect(beat).toContain(PROMPT_K);
    expect(beat).toMatch(/OVERRIDES any instruction to keep it to one sentence/i);
  });

  it('speaks the question AND every option caption — the only channel that carries them', () => {
    render(<StoryPlanner data={kData()} />);
    const beat = sent().find(m => m.includes('[STORY_ELEMENT_ASKED]'))!;
    expect(beat).toContain('Who is in your story?');
    for (const label of ['A happy puppy', 'A smiling girl', 'A little frog']) {
      expect(beat).toContain(label);
    }
  });

  it('asks each later element on its own screen', () => {
    render(<StoryPlanner data={kData()} />);
    fireEvent.click(screen.getByLabelText('A happy puppy'));
    const beats = sent().filter(m => m.includes('[STORY_ELEMENT_ASKED]'));
    expect(beats).toHaveLength(2);
    expect(beats[1]).toContain('What did they do at the park?');
    // The story idea is the greeting — read once, not re-read every screen.
    expect(beats[1]).not.toContain(PROMPT_K);
  });

  it('uses the plain ORIENT beat at grade 2+ instead (no per-element screens there)', () => {
    render(<StoryPlanner data={g3Data()} />);
    expect(sent().some(m => m.includes('[STORY_PLAN_ORIENT]'))).toBe(true);
    expect(sent().some(m => m.includes('[STORY_ELEMENT_ASKED]'))).toBe(false);
  });
});

describe('StoryPlanner @ K — the arc board: order is the answer', () => {
  it('never renders the generated arc order', () => {
    render(<StoryPlanner data={kData()} />);
    completePlan();
    const tray = screen.getByLabelText('Came to the big park');
    const board = tray.closest('div')!.parentElement!;
    // The first tray position must not be the first event.
    expect(board.textContent!.indexOf('Went back home to rest'))
      .toBeLessThan(board.textContent!.indexOf('Came to the big park'));
  });

  it('hides the generated arc LABELS — sentences at grade 1, unreadable at both', () => {
    render(<StoryPlanner data={kData()} />);
    completePlan();
    expect(screen.queryByText('Beginning')).toBeNull();
    expect(screen.queryByText('End')).toBeNull();
    // Numerals carry the sequence instead — numbers are not text.
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('one tap drops a card into the next empty slot', () => {
    render(<StoryPlanner data={kData()} />);
    completePlan();
    fireEvent.click(screen.getByLabelText('Came to the big park'));
    expect(screen.getByLabelText('Came to the big park — tap to take it back out')).toBeTruthy();
  });

  it('a placed card can be taken back out with one tap', () => {
    render(<StoryPlanner data={kData()} />);
    completePlan();
    fireEvent.click(screen.getByLabelText('Came to the big park'));
    fireEvent.click(screen.getByLabelText('Came to the big park — tap to take it back out'));
    expect(screen.getByLabelText('Came to the big park')).toBeTruthy();
  });

  it('the placement beat names the card and forbids a verdict', () => {
    render(<StoryPlanner data={kData()} />);
    completePlan();
    fireEvent.click(screen.getByLabelText('Went back home to rest'));
    const beat = sent().find(m => m.includes('[STORY_EVENT_PLACED]'))!;
    expect(beat).toContain('Went back home to rest');
    expect(beat).toMatch(/NEVER say whether it is in the right place/i);
  });

  it('sends an IDENTICALLY shaped beat for a right and a wrong placement', () => {
    // The real leak risk is not a word in the prompt — it is the tutor being
    // able to infer the answer from how the message differs. Placing the wrong
    // card in slot 1 and the right one must be indistinguishable apart from the
    // card the child actually touched.
    const placeFirst = (label: string) => {
      cleanup();
      sendText.mockClear();
      render(<StoryPlanner data={kData()} />);
      completePlan();
      fireEvent.click(screen.getByLabelText(label));
      return sent().find(m => m.includes('[STORY_EVENT_PLACED]'))!;
    };
    const wrong = placeFirst('Went back home to rest');
    const right = placeFirst('Came to the big park');
    const strip = (s: string) =>
      s.replace('Went back home to rest', '<CARD>').replace('Came to the big park', '<CARD>');
    expect(strip(wrong)).toBe(strip(right));
  });

  it('tells the tutor to describe the cards but never the order', () => {
    render(<StoryPlanner data={kData()} />);
    completePlan();
    const beat = sent().find(m => m.includes('[STORY_ARC_STARTED]'))!;
    expect(beat).toContain('Came to the big park');
    expect(beat).toMatch(/NEVER tell them which card goes where/i);
  });
});

describe('StoryPlanner @ K — rule 8: the score comes from the instrument', () => {
  const finish = () => fireEvent.click(screen.getByText('Finish').closest('button')!);

  it('offers Finish only once every slot is filled', () => {
    render(<StoryPlanner data={kData()} />);
    completePlan();
    expect(screen.queryByText('Finish')).toBeNull();
    fireEvent.click(screen.getByLabelText('Came to the big park'));
    expect(screen.queryByText('Finish')).toBeNull();
    fireEvent.click(screen.getByLabelText('Went back home to rest'));
    expect(screen.getByText('Finish')).toBeTruthy();
  });

  it('scores a complete plan in the RIGHT order as correct', () => {
    render(<StoryPlanner data={kData()} />);
    completePlan();
    fireEvent.click(screen.getByLabelText('Came to the big park'));
    fireEvent.click(screen.getByLabelText('Went back home to rest'));
    finish();
    expect(submitResult).toHaveBeenCalledTimes(1);
    expect(submitResult.mock.calls[0][0]).toBe(true);
    expect(submitResult.mock.calls[0][1]).toBe(100);
  });

  it('scores the WRONG order as incorrect — the old text-length check could not', () => {
    render(<StoryPlanner data={kData()} />);
    completePlan();
    fireEvent.click(screen.getByLabelText('Went back home to rest'));
    fireEvent.click(screen.getByLabelText('Came to the big park'));
    finish();
    expect(submitResult.mock.calls[0][0]).toBe(false);
    expect(submitResult.mock.calls[0][1]).toBe(40); // plan complete, order 0/2
  });

  it('marks each slot on the touched object once submitted, not in error prose', () => {
    evalState.hasSubmitted = true;
    render(<StoryPlanner data={kData()} />);
    completePlan();
    // Nothing quantitative about the outcome reaches the child.
    expect(document.body.textContent).not.toMatch(/\d+\s*(of|\/)\s*\d+\s*(correct|right)/i);
    expect(document.body.textContent).toContain('Your story is ready!');
  });
});

describe('StoryPlanner @ K — degraded content falls back honestly', () => {
  it('keeps the chrome gated even when the generator supplied no picture content', () => {
    render(<StoryPlanner data={kData({
      elements: [{ elementId: 'c', label: 'Character', prompt: 'Who?', required: true }],
      arcEvents: undefined,
    })} />);
    // No picture content ⇒ the compose fields come back (honest, and recorded as
    // a residual) — but a five-year-old still never sees the adult chrome.
    expect(textareas().length).toBeGreaterThan(0);
    expect(screen.queryByText(/Grade K/)).toBeNull();
    expect(screen.queryByText('Plan Elements')).toBeNull();
  });
});

describe('picture helpers', () => {
  it('splits a leading emoji from its caption', () => {
    expect(splitPictureOption('🐶 A happy puppy')).toEqual({
      emoji: '🐶', label: 'A happy puppy', raw: '🐶 A happy puppy',
    });
  });

  it('passes a caption-only option through rather than eating its first word', () => {
    expect(splitPictureOption('A happy puppy')).toEqual({
      emoji: '', label: 'A happy puppy', raw: 'A happy puppy',
    });
  });

  it('shuffles the arc into a derangement — no card starts in its own slot', () => {
    for (const events of [ARC_EVENTS, ['a', 'b', 'c'], ['a', 'b', 'c', 'd', 'e']]) {
      const shuffled = shuffleArcEvents(events);
      expect(shuffled.slice().sort()).toEqual(events.slice().sort());
      events.forEach((e, i) => expect(shuffled[i]).not.toBe(e));
    }
  });

  it('is deterministic, so the board does not reshuffle on every render', () => {
    expect(shuffleArcEvents(ARC_EVENTS)).toEqual(shuffleArcEvents(ARC_EVENTS));
  });
});
