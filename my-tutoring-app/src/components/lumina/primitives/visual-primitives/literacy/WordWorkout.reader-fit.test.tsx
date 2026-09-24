// @vitest-environment jsdom
/**
 * Reader-fit for word-workout. The original file pinned a PRE (Kindergarten) band gate:
 * hide the adult chrome, hide the on-screen instruction sentences, and have the tutor voice
 * the play action.
 *
 * The DI port replaced that with a stronger contract, kept on the workspace:
 *   - the on-screen instruction sentences are gone at EVERY grade, because the tutor speaks
 *     the ask (now the workspace task);
 *   - the ask never names a printed word: everything printed is read cold;
 *   - the vowel-scope label that LEAKED the lesson scope is not rendered at all;
 *   - right/wrong is carried by the tutor's voice and the answer ring, so there is no text
 *     feedback card to band-gate.
 * So this file pins BAND INVARIANCE plus the answer surface.
 *
 * A child who cannot yet decode CVC print has nothing to work from here, because the tutor
 * never reads the words aloud first. The catalog says so in its constraints and routes those
 * objectives to letter-sound-link / phonics-blender.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import type { WordWorkoutData } from './WordWorkout';

const MODE_PIN: Record<string, string> = {
  'real-vs-nonsense': 'real_vs_nonsense', 'picture-match': 'picture_match', 'word-chains': 'word_chains',
  'inflected-word': 'read_inflected', 'compound-word': 'read_compound', 'context-discrimination': 'choose_in_context',
  'sentence-reading': 'sentence_reading',
};
const mount = (data: WordWorkoutData) =>
  mountWorkspace({ primitiveId: 'word-workout', evalMode: MODE_PIN[data.mode], data: data as unknown as Record<string, unknown> });
const render = (data: WordWorkoutData) => mount(data).view;
/** Credit the pending spoken answer and move to the next item. */
const creditAndAdvance = (h: ReturnType<typeof mount>, answer: string) => {
  h.say(answer); h.feedback('correct', 'advance'); h.confirmVisible();
};

const realNonsenseData = (gradeLevel: string): WordWorkoutData => ({
  title: 'CVC Word Workout: short a',
  mode: 'real-vs-nonsense',
  masteredVowels: ['a'],
  gradeLevel,
  challenges: [{ id: 'c1', mode: 'real-vs-nonsense', realWord: 'cat', nonsenseWord: 'zat' }],
});

const pictureMatchData = (gradeLevel: string): WordWorkoutData => ({
  title: 'CVC Word Workout: short i',
  mode: 'picture-match',
  masteredVowels: ['i'],
  gradeLevel,
  challenges: [{
    id: 'c1',
    mode: 'picture-match',
    targetWord: 'pig',
    targetImage: '🐷',
    distractorImages: [{ word: 'pin', image: '📌' }, { word: 'bin', image: '🗑️' }],
  }],
});

const wordChainsData = (gradeLevel: string): WordWorkoutData => ({
  title: 'CVC Word Workout: short a',
  mode: 'word-chains',
  masteredVowels: ['a'],
  gradeLevel,
  challenges: [{ id: 'c1', mode: 'word-chains', chain: ['cat', 'bat', 'bad'], changedPositions: [0, 2] }],
});

const inflectedData = (): WordWorkoutData => ({
  title: 'Read Common Endings',
  mode: 'inflected-word',
  masteredVowels: ['a'],
  gradeLevel: 'K',
  challenges: [{ id: 'c1', mode: 'inflected-word', targetWord: 'cats', includeMeaning: true }],
});

const contextData = (): WordWorkoutData => ({
  title: 'Near Words in Context',
  mode: 'context-discrimination',
  masteredVowels: ['a'],
  gradeLevel: 'K',
  challenges: [{ id: 'c1', mode: 'context-discrimination', contextTrialId: 'cat-cap' }],
});

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

describe('WordWorkout extended-decoding mask and reveal', () => {
  it('shows only the inflected word before the cold read, then reveals its decoding chunks', () => {
    const h = mount(inflectedData());
    expect(screen.getByText('cats')).toBeTruthy();
    expect(screen.queryByText('/s/')).toBeNull();
    expect(screen.queryByText('The cats nap.')).toBeNull();
    h.say('cats'); h.feedback('correct');
    expect(screen.getByText('/s/')).toBeTruthy();
  });

  it('withholds sentence context during both cold reads, then shows it for the separate choice', () => {
    const h = mount(contextData());
    expect(screen.getByText('cat')).toBeTruthy();
    expect(screen.getByText('cap')).toBeTruthy();
    expect(screen.queryByText('The ___ sat on the mat.')).toBeNull();
    creditAndAdvance(h, 'cat');
    expect(screen.queryByText('The ___ sat on the mat.')).toBeNull();
    creditAndAdvance(h, 'cap');
    expect(screen.getByText('The ___ sat on the mat.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /cat|cap/i })).toBeNull();
  });

  it('shows the meaning sentence only on the separately scored comprehension item', () => {
    const h = mount(inflectedData());
    creditAndAdvance(h, 'cats');
    expect(screen.getByText('The cats nap.')).toBeTruthy();
    expect(screen.getByText('What does cats tell you about how many cats there are?')).toBeTruthy();
  });
});

describe.each(['K', '1'])('WordWorkout stage @ grade %s', (grade) => {
  it('renders no on-screen instruction sentence — the tutor speaks the ask', () => {
    render(realNonsenseData(grade));
    expect(screen.queryByText(/which is a real word/i)).toBeNull();
    expect(screen.queryByText(/sound out both words/i)).toBeNull();
  });

  it('the ask names neither printed word: both are read cold', () => {
    const h = mount(realNonsenseData(grade));
    const task = h.state().task!.task;
    expect(task).toMatch(/real word/);
    expect(task).not.toMatch(/\bcat\b|\bzat\b/);
  });

  it('never renders the vowel-scope label that leaked the lesson scope', () => {
    render(realNonsenseData(grade));
    expect(screen.queryByText(/vowels:/i)).toBeNull();
  });

  it('keeps the answer surface honest: the words are printed, not tappable', () => {
    const { container } = render(realNonsenseData(grade));
    expect(screen.getByText('cat')).toBeTruthy();
    expect(screen.getByText('zat')).toBeTruthy();
    // A tappable word card is the costume this port deleted: the answer is said.
    expect(container.querySelectorAll('[role="button"]').length).toBe(0);
  });

  it('picture-match is picture-primary and its pictures ARE tappable', () => {
    render(pictureMatchData(grade));
    expect(screen.getByText('🐷')).toBeTruthy();
    expect(screen.getByText('📌')).toBeTruthy();
    // The word is printed (decoding it is the first half of the task)…
    expect(screen.getByText('pig')).toBeTruthy();
    // …and the pictures are the answer surface. (Matched as whole strings: an
    // emoji character class matches by SURROGATE, so it also catches the 🔁
    // tap-to-hear button.)
    const pictureEmoji = ['🐷', '📌', '🗑️'];
    expect(screen.getAllByRole('button').filter((b) => pictureEmoji.includes(b.textContent ?? '')))
      .toHaveLength(3);
  });

  it('word chains print every word with no advance button anywhere', () => {
    render(wordChainsData(grade));
    for (const word of ['cat', 'bat', 'bad']) {
      expect(screen.getByText((_, node) => node?.textContent === word)).toBeTruthy();
    }
    expect(screen.queryByRole('button', { name: /start reading|next word|finish chain/i })).toBeNull();
  });

  it('has no Next / Finish control — the runtime owns progression', () => {
    render(realNonsenseData(grade));
    expect(screen.queryByRole('button', { name: /next|finish|i read it/i })).toBeNull();
  });
});

describe('WordWorkout stage · band invariance', () => {
  it('renders the same stage at K and at Grade 1', () => {
    // The click era hid chrome and instruction text at PRE only. The stage carries
    // neither at any band, so the two renders agree.
    const k = render(realNonsenseData('K')).container.innerHTML;
    cleanup();
    const g1 = render(realNonsenseData('1')).container.innerHTML;
    expect(k).toBe(g1);
  });
});
