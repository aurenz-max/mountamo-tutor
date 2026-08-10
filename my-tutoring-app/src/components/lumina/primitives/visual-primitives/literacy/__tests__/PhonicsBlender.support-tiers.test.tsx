// @vitest-environment jsdom
/**
 * Within-mode support tiers for phonics-blender, re-based 2026-08-09 onto the
 * DI modality's purely-verbal task.
 *
 * The tier withdraws SEGMENTATION HELP, never the stimulus and never the
 * answer. Two levers survive the verbal port; two have no surface left and are
 * asserted DEAD rather than quietly ignored:
 *
 *   showBlendPreview   LIVE — 'full' separated letters with dots · 'word'
 *                      separated, no dots · 'none' joined into one solid word,
 *                      so the child does the segmenting.
 *   nameTargetPhonemes LIVE — whether the tutor's scripted line models the
 *                      sounds in order, or only the word.
 *   showSlotCount      DEAD — there are no build slots; nothing is arranged.
 *   showTileLetters    DEAD — the letters ARE the stimulus and cannot be a
 *                      sub-label of themselves.
 *
 * Lever 2 is asserted against the SCRIPT directly. That is deliberate: the
 * script is the exact wording the tutor speaks (DISTAR — the wording IS the
 * pedagogy), it is pure, and a render test could only observe it second-hand
 * through an async live session.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

const sendText = vi.hoisted(() => vi.fn());
const ctxState = vi.hoisted(() => ({
  isConnected: true,
  isListening: false,
  isAudioPlaying: false,
  micLevel: 0,
  sessionMode: 'idle' as 'idle' | 'lesson',
  sessionResumeCount: 0,
  conversation: [] as Array<{ role: string; content: string }>,
}));
vi.mock('@/contexts/LuminaAIContext', () => ({
  useLuminaAIContext: () => ({
    ...ctxState,
    sendText,
    connect: vi.fn(async () => {}),
    disconnect: vi.fn(),
    reconnect: vi.fn(),
    startListening: vi.fn(() => { ctxState.isListening = true; }),
    stopListening: vi.fn(),
    updateContext: vi.fn(),
  }),
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

import PhonicsBlender, { type PhonicsBlenderData } from '../PhonicsBlender';
import {
  completeCue,
  HOW_TO_PLAY,
  itemCue,
  judgingContract,
  moveOnCue,
  soundWalk,
  type BlendItem,
} from '../phonicsBlenderScript';

const makeData = (
  gradeLevel: string,
  tierFields: Partial<PhonicsBlenderData> = {},
): PhonicsBlenderData => ({
  title: 'Animal Sounds',
  gradeLevel,
  patternType: 'cvc',
  words: [
    {
      id: 'w1',
      targetWord: 'cat',
      emoji: '🐱',
      imageDescription: 'a small furry cat',
      phonemes: [
        { id: 'w1_p1', sound: '/k/', letters: 'c' },
        { id: 'w1_p2', sound: '/a/', letters: 'a' },
        { id: 'w1_p3', sound: '/t/', letters: 't' },
      ],
    },
  ],
  ...tierFields,
});

const EASY: Partial<PhonicsBlenderData> = {
  supportTier: 'easy',
  showBlendPreview: 'full',
  nameTargetPhonemes: true,
};
const MEDIUM: Partial<PhonicsBlenderData> = {
  supportTier: 'medium',
  showBlendPreview: 'word',
  nameTargetPhonemes: true,
};
const HARD: Partial<PhonicsBlenderData> = {
  supportTier: 'hard',
  showBlendPreview: 'none',
  nameTargetPhonemes: false,
};

const CAT: BlendItem = {
  id: 'w1',
  targetWord: 'cat',
  emoji: '🐱',
  phonemes: [
    { id: 'w1_p1', sound: '/k/', letters: 'c' },
    { id: 'w1_p2', sound: '/a/', letters: 'a' },
    { id: 'w1_p3', sound: '/t/', letters: 't' },
  ],
};
const DOG: BlendItem = {
  id: 'w2',
  targetWord: 'dog',
  phonemes: [
    { id: 'w2_p1', sound: '/d/', letters: 'd' },
    { id: 'w2_p2', sound: '/o/', letters: 'o' },
    { id: 'w2_p3', sound: '/g/', letters: 'g' },
  ],
};

describe('phonics-blender tier · lever 1: showBlendPreview (segmentation help)', () => {
  beforeEach(() => sendText.mockClear());
  afterEach(cleanup);

  it('easy separates the letters and marks the breaks with dots', () => {
    render(<PhonicsBlender data={makeData('1', EASY)} />);
    expect(screen.getAllByText('·').length).toBe(2);
  });

  it('medium keeps the letters separated but drops the dots', () => {
    render(<PhonicsBlender data={makeData('1', MEDIUM)} />);
    expect(screen.queryByText('·')).toBeNull();
    expect(screen.getAllByRole('button', { name: /^sound / }).length).toBe(3);
  });

  it('hard joins the letters into one solid word — the child segments it', () => {
    render(<PhonicsBlender data={makeData('1', HARD)} />);
    expect(screen.queryByText('·')).toBeNull();
    // The stimulus is NOT withdrawn: every letter is still there and tappable.
    expect(screen.getAllByRole('button', { name: /^sound / }).length).toBe(3);
    expect(screen.getByText('c')).toBeTruthy();
  });

  it('NO tier withdraws tap-to-hear — a stuck child can always recover a sound (R2)', () => {
    for (const tier of [EASY, MEDIUM, HARD]) {
      sendText.mockClear();
      const view = render(<PhonicsBlender data={makeData('1', tier)} />);
      fireEvent.click(screen.getByRole('button', { name: 'sound /k/' }));
      expect(sendText.mock.calls.filter(c => String(c[0]).startsWith('[PRONOUNCE_SOUND]'))).toHaveLength(1);
      view.unmount();
    }
  });

  it('NO tier leaks the answer — no picture and no printed word at any tier', () => {
    for (const tier of [EASY, MEDIUM, HARD]) {
      const view = render(<PhonicsBlender data={makeData('1', tier)} />);
      expect(screen.queryByText('🐱')).toBeNull();
      expect(screen.queryByText('cat')).toBeNull();
      view.unmount();
    }
  });
});

describe('phonics-blender tier · dead levers (asserted, not ignored)', () => {
  afterEach(cleanup);

  it('showSlotCount has no surface — there are no build slots to count', () => {
    render(<PhonicsBlender data={makeData('1', { ...EASY, showSlotCount: false })} />);
    expect(screen.queryByText('?')).toBeNull();
  });

  it('showTileLetters has no surface — the letters ARE the stimulus', () => {
    render(<PhonicsBlender data={makeData('1', { ...EASY, showTileLetters: false })} />);
    expect(screen.getByText('c')).toBeTruthy();
    expect(screen.getByText('a')).toBeTruthy();
    expect(screen.getByText('t')).toBeTruthy();
  });
});

describe('phonics-blender tier · lever 2: nameTargetPhonemes (what the tutor is told)', () => {
  it('easy — the scripted line models the sounds in order, then the word', () => {
    const cue = itemCue(CAT, { nameSounds: true });
    expect(cue).toContain('Listen: /k/ … /a/ … /t/ … cat.');
    expect(cue).toContain('Together: /k/ … /a/ … /t/ … cat.');
    expect(cue).toContain('Your turn. What word?');
  });

  it('hard — the scripted line models the WORD only: no sounds, no count, no order', () => {
    const cue = itemCue(CAT, { nameSounds: false });
    expect(cue).toContain('Listen: cat.');
    const spoken = (cue.match(/Speak exactly:\s*\n?"([^"]*)"/) ?? [])[1] ?? '';
    expect(spoken).not.toContain('/k/');
    expect(spoken).not.toContain('/a/');
    expect(spoken).not.toContain('/t/');
  });

  it('hard withholds the sound list on the NEXT word too, not just the first', () => {
    const cue = moveOnCue(CAT, DOG, false);
    const spoken = (cue.match(/Speak exactly:\s*\n?"([^"]*)"/) ?? [])[1] ?? '';
    expect(spoken).toContain('Listen: dog.');
    expect(spoken).not.toContain('/d/');
  });

  it('easy DOES enumerate on the next word', () => {
    const spoken = (moveOnCue(CAT, DOG, true).match(/Speak exactly:\s*\n?"([^"]*)"/) ?? [])[1] ?? '';
    expect(spoken).toContain('/d/ … /o/ … /g/');
  });

  it('the CORRECTION re-models at every tier — remediation is not scaffolding (gate 3)', () => {
    // hard withholds the sounds from the ASK. It must not withhold them from
    // the correction: a child who just missed is owed the model.
    expect(judgingContract(CAT)).toContain('My turn: /k/ … /a/ … /t/ — cat.');
    expect(itemCue(CAT, { nameSounds: false })).toContain('My turn: /k/ … /a/ … /t/ — cat.');
  });
});

describe('phonics-blender · the judging contract (what counts as a blend)', () => {
  const contract = judgingContract(CAT);

  it('a sound-out that ENDS in the word is CORRECT — blending aloud is the skill', () => {
    expect(contract).toContain('sounded it out and then said it fast');
    expect(contract).toContain('Sounding it out first is correct, not a fault.');
  });

  it('separate sounds with NO word at the end is not the answer', () => {
    expect(contract).toContain('only the separate sounds without ever running them into the whole word');
  });

  it('a near neighbour is wrong, judged on the FINAL word', () => {
    expect(contract).toContain('even one that sounds close to cat');
    expect(contract).toContain('Judge strictly on the FINAL word');
  });

  it('both branches carry their exact sentinel opener', () => {
    expect(contract).toContain('say exactly "Yes, cat." and stop');
    expect(contract).toContain('say exactly "My turn: /k/ … /a/ … /t/ — cat. Your turn. What word?"');
  });
});

/** The line the tutor is told to SPEAK — the quote right after "Speak
 *  exactly:". Everything else a cue contains is instruction ABOUT speech,
 *  including the contract's own `"Yes"` / `"My turn"` anti-collision quotes,
 *  which are the rule and not an utterance. */
const spokenLine = (cue: string) =>
  (cue.match(/Speak exactly:\s*\n?"([^"]*)"/) ?? [])[1] ?? '';

describe('phonics-blender · the OPENING line says how to play (residual SWAP-1)', () => {
  // Fixed 2026-08-09 after word-flip (port 3) proved the shape. The how-to-play
  // used to be a CATALOG DIRECTIVE asking the tutor to compose one before
  // speaking the scripted line — two jobs in one turn. On sound-swap, whose
  // opener is identical in shape, that produced a spoken bracket tag and an
  // improvised ask, and item 1 ran without its model.
  it('how-to-play is INSIDE the quote, not a directive to compose one', () => {
    const line = spokenLine(itemCue(CAT, { nameSounds: true, opening: true, howToPlay: true }));
    expect(line.startsWith(HOW_TO_PLAY)).toBe(true);
    expect(line.endsWith('Your turn. What word?')).toBe(true);
  });

  it('the opener tells the tutor to add nothing of its own', () => {
    const cue = itemCue(CAT, { nameSounds: true, opening: true, howToPlay: true });
    expect(cue).toContain('it already contains how to play, so do not add your own');
    expect(cue).toContain('Never say, reproduce, or invent text inside square brackets');
  });

  it('how-to-play is band-gated, and never reaches a later cue', () => {
    // Reader grades have the same protocol printed under the letters, so they
    // do not get it spoken. Either way it exists only on the OPENING cue.
    expect(spokenLine(itemCue(CAT, { nameSounds: true, opening: true })))
      .toBe(spokenLine(itemCue(CAT, { nameSounds: true })));
    expect(spokenLine(itemCue(CAT, { nameSounds: true, howToPlay: true })))
      .toBe(spokenLine(itemCue(CAT, { nameSounds: true })));
  });
});

describe('phonics-blender · DI sentinel discipline (standing gate 2)', () => {

  const everyCue = [
    itemCue(CAT, { nameSounds: true, opening: true }),
    itemCue(CAT, { nameSounds: false }),
    moveOnCue(CAT, DOG, true),
    moveOnCue(CAT, null, true),
    completeCue(),
  ];

  it('no spoken line opens with a sentinel — only the in-band verdict branches may', () => {
    const lines = everyCue.map(spokenLine);
    expect(lines.every(l => l.length > 0)).toBe(true);   // extraction really found them
    for (const line of lines) {
      const lower = line.trimStart().toLowerCase();
      expect(lower.startsWith('yes')).toBe(false);
      expect(lower.startsWith('my turn')).toBe(false);
    }
  });

  it("the model line opens with 'Listen' — classic DISTAR's 'My turn.' opener is forbidden here", () => {
    for (const cue of [itemCue(CAT, { nameSounds: true }), itemCue(CAT, { nameSounds: false })]) {
      expect(spokenLine(cue).startsWith('Listen')).toBe(true);
    }
  });

  it('every item cue carries the judging contract, so no attempt can land unjudged', () => {
    for (const cue of [
      itemCue(CAT, { nameSounds: true }),
      itemCue(CAT, { nameSounds: false }),
      moveOnCue(CAT, DOG, true),
    ]) {
      expect(cue).toContain('Then wait for the learner to speak.');
      expect(cue).toContain('Never begin any other sentence with the word "Yes"');
    }
  });

  it('the final move-on has no next word and therefore no contract to wait on', () => {
    const cue = moveOnCue(CAT, null, true);
    expect(cue).toContain("That's the end of our blending practice.");
    expect(cue).not.toContain('Then wait for the learner to speak.');
  });

  it('soundWalk paces the sounds rather than running them together', () => {
    expect(soundWalk(CAT)).toBe('/k/ … /a/ … /t/');
  });
});
