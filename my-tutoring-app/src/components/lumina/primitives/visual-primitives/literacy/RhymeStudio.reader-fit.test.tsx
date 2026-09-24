// @vitest-environment jsdom
/**
 * RhymeStudio render contract after the DI port (qa/di/BACKLOG.md item 16),
 * carrying forward the PRE-band reader-fit gates that survived it
 * (qa/reader-fit/rhyme-studio-PRE-2026-07-15.md).
 *
 * What this locks in:
 *  1. §1 GATE A — nothing on screen carries the child forward: no Start
 *     Activity, Next, Finish, Skip or Check. The runtime owns progression.
 *  2. §1 GATE B — nothing names the answer before the child gives it. The rime
 *     highlight and the correct-card ring are post-verdict only, and the
 *     recognition pair shows no highlight on either card (the old surface
 *     painted the comparison card's rime only when the pair rhymed, so the
 *     highlight WAS the yes/no answer).
 *  3. The spoken modes keep their choices ON SCREEN but make nothing tappable:
 *     the cards are the closed set the child speaks from — the thing that keeps
 *     a spoken rhyme a benched response class — not a tap surface.
 *  4. Recognition has no thumbs: yes or no is said aloud.
 *  5. Pre-reader presentation: every word is picture-primary, adult chrome is
 *     hidden at K and present at a reader grade.
 *
 * Mounted under a runtime (the studio runs only on the teaching workspace); the workspace
 * behaviour itself is in RhymeStudio.workspace.test.tsx.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import type { RhymeStudioData } from './RhymeStudio';

const render = (data: RhymeStudioData) =>
  mountWorkspace({ primitiveId: 'rhyme-studio', evalMode: data.challenges[0].mode, data: data as unknown as Record<string, unknown> }).view;

const recognition = (gradeLevel: 'K' | '1'): RhymeStudioData => ({
  title: 'Rhyme Time',
  gradeLevel,
  challenges: [{
    id: 'c1',
    mode: 'recognition',
    targetWord: 'cat',
    targetWordImage: 'a cute cat',
    targetWordEmoji: '🐱',
    rhymeFamily: '-at',
    comparisonWord: 'bat',
    comparisonWordImage: 'a fruit bat',
    comparisonWordEmoji: '🦇',
    doesRhyme: true,
  }],
});

const identification = (gradeLevel: 'K' | '1'): RhymeStudioData => ({
  title: 'Rhyme Time',
  gradeLevel,
  challenges: [{
    id: 'c1',
    mode: 'identification',
    targetWord: 'cat',
    targetWordImage: 'a cute cat',
    targetWordEmoji: '🐱',
    rhymeFamily: '-at',
    // At K the option's picture rides the `image` field as a single emoji.
    options: [
      { word: 'bat', image: '🦇', isCorrect: true },
      { word: 'dog', image: '🐶', isCorrect: false },
    ],
  }],
});

const production = (): RhymeStudioData => ({
  title: 'Rhyme Time',
  gradeLevel: '1',
  challenges: [{
    id: 'c1',
    mode: 'production',
    targetWord: 'sun',
    targetWordImage: 'a bright sun',
    rhymeFamily: '-un',
    acceptableAnswers: ['bun', 'run', 'fun'],
  }],
});

const collection = (): RhymeStudioData => ({
  title: 'Rhyme Family Builder',
  gradeLevel: '1',
  challenges: [{
    id: 'family-1',
    mode: 'collection',
    targetWord: 'cat',
    targetWordImage: 'a cute cat',
    rhymeFamily: '-at',
    acceptableAnswers: ['hat', 'mat', 'bat'],
  }],
});

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

// ── GATE A: nothing on screen carries the child forward ─────────────────────

describe('RhymeStudio · the tutor owns the clock', () => {
  it('offers no Start, Next, Finish, Skip or Check anywhere', () => {
    render(recognition('K'));
    for (const label of [/^start activity$/i, /next/i, /finish/i, /skip/i, /check/i, /continue/i]) {
      expect(screen.queryByRole('button', { name: label })).toBeNull();
    }
  });

  it('the challenge is on screen immediately — no Start gate stands in front of it', () => {
    render(recognition('K'));
    expect(screen.getByText('🐱')).toBeTruthy();
  });
});

// ── GATE B: nothing names the answer before the child gives it ──────────────

describe('RhymeStudio · answer-leak', () => {
  it('recognition shows no rime highlight on either card before the verdict', () => {
    const { container } = render(recognition('1'));
    // The amber span is the rime split; at a reader grade it is the give-away.
    expect(container.querySelectorAll('.text-amber-300')).toHaveLength(0);
    expect(screen.getByText('cat')).toBeTruthy();
    expect(screen.getByText('bat')).toBeTruthy();
  });

  it('identification rings no card before the verdict', () => {
    const { container } = render(identification('1'));
    expect(container.querySelectorAll('.ring-emerald-400\\/40')).toHaveLength(0);
  });

  it('the on-screen question restatement is gone — the tutor asks it', () => {
    render(identification('1'));
    expect(screen.queryByText(/Which word rhymes with/)).toBeNull();
    expect(screen.queryByText('Do these words rhyme?')).toBeNull();
  });
});

// ── The spoken modes: the set is shown, nothing is tapped ───────────────────

describe('RhymeStudio · the choices are a closed set, not a tap surface', () => {
  it('identification shows every choice and makes none of them a button', () => {
    render(identification('1'));
    expect(screen.getByText('bat')).toBeTruthy();
    expect(screen.getByText('dog')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^bat$/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^dog$/ })).toBeNull();
  });

  it('production shows NO bank — the screen carries the stimulus and nothing else', () => {
    // INVERTED 2026-08-19. This asserted the four tiles were on screen, because
    // the bank was what made the mode a closed (and therefore benched) class.
    // `open_set_word` cleared its bench and the bank is deleted: the child now
    // THINKS OF a rhyme instead of reading four words and saying one. Any word
    // rendered here would be a candidate answer, which is the whole thing this
    // mode no longer has.
    render(production());
    for (const word of ['bun', 'run', 'dog', 'book']) {
      expect(screen.queryByText(word)).toBeNull();
    }
    // The target IS the question and stays on screen.
    expect(screen.getByText(/sun/i)).toBeTruthy();
  });

  it('collection starts with three empty slots and hides unused examples', () => {
    render(collection());
    expect(screen.getByLabelText('Empty rhyme spot 1')).toBeTruthy();
    expect(screen.getByLabelText('Empty rhyme spot 2')).toBeTruthy();
    expect(screen.getByLabelText('Empty rhyme spot 3')).toBeTruthy();
    for (const hidden of ['hat', 'mat', 'bat']) expect(screen.queryByText(hidden)).toBeNull();
  });
});

// ── Nothing in this pack is answered with the hands ─────────────────────────

describe('RhymeStudio · every mode is answered aloud', () => {
  /**
   * REGRESSION. Recognition shipped with a 👍/👎 for one day. The user's first
   * drive removed it — *"we should just be able to say yes to the tutor"* — and
   * the session log showed the tap could not have survived anyway: asked a
   * spoken question, the child answered aloud, the silence contract had no line
   * for that, and the tutor improvised a verdict the engine could not read.
   */
  it('recognition offers NO thumbs — the answer is spoken', () => {
    render(recognition('K'));
    expect(screen.queryByLabelText('Yes, they rhyme')).toBeNull();
    expect(screen.queryByLabelText('No, they do not rhyme')).toBeNull();
    expect(screen.queryByText('👍')).toBeNull();
    expect(screen.queryByText('👎')).toBeNull();
  });

  it('the cards only repeat the question, in every mode: a tap never answers', () => {
    for (const data of [recognition('K'), identification('1'), production()]) {
      const { unmount } = render(data);
      // The cards repeat the question (role=button for tap-to-hear); nothing on the stage
      // commits an answer, so a tap sends only a silent host request.
      fireEvent.click(screen.getAllByRole('button')[0]);
      expect(seam.send.mock.calls.at(-1)?.[1]).toMatchObject({ silent: true, author: 'host' });
      unmount();
    }
  });

  it('tells the child how to answer recognition without printing the answer', () => {
    render(recognition('K'));
    expect(screen.getByText(/say yes or no/i)).toBeTruthy();
  });
});

// ── Band presentation ───────────────────────────────────────────────────────

describe('RhymeStudio · pre-reader band', () => {
  it('renders every word picture-primary and hides adult chrome at K', () => {
    render(identification('K'));
    expect(screen.getByText('🐱')).toBeTruthy();   // target
    expect(screen.getByText('🦇')).toBeTruthy();   // option
    expect(screen.getByText('🐶')).toBeTruthy();   // option
    expect(screen.queryByText(/Grade K/)).toBeNull();
    expect(screen.queryByText(/Find the Rhyme/)).toBeNull();
  });

  it('keeps the word-primary card and the chrome at a reader grade (control)', () => {
    render(recognition('1'));
    expect(screen.getAllByText(/Grade 1/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Do They Rhyme\?/)).toBeTruthy();
    expect(screen.queryByText('🐱')).toBeNull();   // emoji is a PRE-only affordance
  });
});
