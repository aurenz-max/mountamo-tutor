// @vitest-environment jsdom
/**
 * SortingStation's page on the live workspace, per band. Every intent the click era pinned is still pinned, re-based:
 *  1. (reader-fit PRE / contract R4) Trays are PICTURE-primary at K — the `bucketEmoji` (or a colour-coded fallback)
 *     with the word as a caption — and adult chrome is hidden.
 *  2. (R7) The commit step for the sort family is the spoken answer the tutor credits, not a button: no Check
 *     control at either band, and every sort item is one spoken turn.
 *  3. (R6) Odd-one-out has no tap left to latch: the cards are not buttons, the answer is said.
 *  4. Grade 1 keeps the reader chrome (mode badges, description), so nothing leaks across `isPreReader`.
 *  5. The printed instruction is gone at both bands: the tutor speaks the ask.
 *  Plus the pixel leak: the per-tray count badge is withheld on a count ask until the answer is credited.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import type { SortingStationData } from './SortingStation';
import { sortingStationItems } from './sortingStation.boss';

const sortByOne = (gradeBand: 'K' | '1'): SortingStationData => ({
  title: 'Needs and Wants',
  description: 'Sort each thing into a need or a want',
  gradeBand,
  maxCategories: 2,
  showCounts: true,
  showTallyChart: false,
  challenges: [
    {
      id: 'c1',
      type: 'sort-by-one',
      instruction: 'Sort these into needs and wants',
      sortingAttribute: 'category',
      objects: [
        { id: 'o1', label: 'water', emoji: '💧', attributes: { category: 'need' } },
        { id: 'o2', label: 'toy', emoji: '🧸', attributes: { category: 'want' } },
      ],
      categories: [
        { label: 'Need', rule: { category: 'need' }, bucketEmoji: '🏠' },
        { label: 'Want', rule: { category: 'want' }, bucketEmoji: '🎁' },
      ],
    },
  ],
});

const oddOneOut = (gradeBand: 'K' | '1'): SortingStationData => ({
  title: 'Which One Is Different',
  description: 'Find the one that does not belong',
  gradeBand,
  maxCategories: 2,
  showCounts: false,
  showTallyChart: false,
  challenges: [
    {
      id: 'c1',
      type: 'odd-one-out',
      instruction: 'Which one does not belong?',
      sortingAttribute: 'category',
      objects: [
        { id: 'o1', label: 'dog', emoji: '🐶', attributes: { category: 'animal' } },
        { id: 'o2', label: 'cat', emoji: '🐱', attributes: { category: 'animal' } },
        { id: 'o3', label: 'car', emoji: '🚗', attributes: { category: 'vehicle' } },
      ],
      oddOneOut: 'o3',
      oddOneOutReason: 'It is not an animal',
    },
  ],
});

const countCompare = (gradeBand: 'K' | '1'): SortingStationData => ({
  title: 'Count and Compare',
  gradeBand,
  maxCategories: 2,
  showCounts: true,
  showTallyChart: false,
  challenges: [
    {
      id: 'c1',
      type: 'count-and-compare',
      instruction: 'Count each group',
      sortingAttribute: 'color',
      correctComparison: 'more',
      objects: [
        { id: 'o1', label: 'apple', emoji: '🍎', attributes: { color: 'red' } },
        { id: 'o2', label: 'cherry', emoji: '🍒', attributes: { color: 'red' } },
        { id: 'o3', label: 'sky', emoji: '🟦', attributes: { color: 'blue' } },
      ],
      categories: [
        { label: 'Red', rule: { color: 'red' }, bucketEmoji: '🔴' },
        { label: 'Blue', rule: { color: 'blue' }, bucketEmoji: '🔵' },
      ],
    },
  ],
});

const CHECK_CONTROLS = /check answer|check sort|check counts|check tallies|next|finish|submit/i;
const show = (data: SortingStationData, evalMode = 'sort_one') =>
  mountWorkspace({ primitiveId: 'sorting-station', evalMode, instanceId: 'station', data: { ...data, instanceId: 'station' } });

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

describe('SortingStation @ PRE (gradeBand K) — R4', () => {
  it('renders picture-primary trays (emoji + word caption)', () => {
    show(sortByOne('K'));
    expect(screen.getByText('🏠')).toBeTruthy();
    expect(screen.getByText('🎁')).toBeTruthy();
    expect(screen.getByText('Need')).toBeTruthy();
    expect(screen.getByText('Want')).toBeTruthy();
  });

  it('hides adult chrome and the unreadable description', () => {
    show(sortByOne('K'));
    expect(screen.queryByText('Sort each thing into a need or a want')).toBeNull();
    expect(screen.queryByText(/Sort It/)).toBeNull();
    expect(screen.queryByText(/Say your answer out loud/)).toBeNull();
  });

  it('never prints the instruction — the tutor speaks it', () => {
    show(sortByOne('K'));
    expect(screen.queryByText('Sort these into needs and wants')).toBeNull();
  });
});

describe('R7 re-based — the commit step is the credited answer, not a button', () => {
  it.each(['K', '1'] as const)('the sort family has no Check control at %s', band => {
    show(sortByOne(band));
    expect(screen.queryByText(CHECK_CONTROLS)).toBeNull();
  });

  it('every sort item is one spoken turn — the commit is the answer', () => {
    const items = sortingStationItems(sortByOne('K'));
    expect(items).toHaveLength(2);
    expect(items.every(i => i.answerKind === 'voice' && i.kind === 'sort')).toBe(true);
    expect(show(sortByOne('K')).state().task!.workspace).toBeTruthy();
  });
});

describe('R6 re-based — there is no tap left to latch', () => {
  it('odd-one-out renders cards that are not buttons', () => {
    const h = show(oddOneOut('K'), 'odd_one_out');
    expect(screen.getByText('🐶')).toBeTruthy();
    expect(screen.getByText('🚗')).toBeTruthy();
    const cardButtons = Array.from(h.view.container.querySelectorAll('button')).filter(b => /🐶|🐱|🚗/.test(b.textContent ?? ''));
    expect(cardButtons).toHaveLength(0);
  });

  it('the odd-one-out answer is SPOKEN, and one challenge is one turn', () => {
    const items = sortingStationItems(oddOneOut('K'));
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ answerKind: 'voice', kind: 'odd_one', answer: 'car' });
  });

  it('never prints which card is the odd one before it is credited', () => {
    show(oddOneOut('K'), 'odd_one_out');
    expect(screen.queryByText(/does(n't| not) belong/i)).toBeNull();
    expect(screen.queryByText('car', { selector: '.animate-bounce' })).toBeNull();
  });
});

describe('the pixel leak: the count badge is the answer on a count ask', () => {
  it('withdraws the tray count badge on a count ask, even with showCounts on', () => {
    const h = show(countCompare('1'), 'count_compare');
    expect(h.state().task!.itemId).toBe('c1::count::red');
    // 2 red + 1 blue — neither count may be on screen while it is the answer.
    expect(screen.queryByText('2')).toBeNull();
    expect(screen.queryByText('1')).toBeNull();
  });

  it('restores it once the answer is credited', () => {
    const h = show(countCompare('1'), 'count_compare');
    h.say('two'); h.feedback('correct');
    expect(screen.queryAllByText('2').length).toBeGreaterThan(0);
  });
});

describe('SortingStation @ reader grade (control, Grade 1)', () => {
  it('keeps the reader chrome: mode badge, description', () => {
    show(sortByOne('1'));
    expect(screen.getByText('Sort each thing into a need or a want')).toBeTruthy();
    expect(screen.getByText(/Sort It/)).toBeTruthy();
  });

  it('keeps text-primary trays — no big picture header leaks down from K', () => {
    show(sortByOne('1'));
    expect(screen.getByText('Need')).toBeTruthy();
    expect(screen.queryByText('🏠')).toBeNull();
    expect(screen.queryByText('🎁')).toBeNull();
  });
});
