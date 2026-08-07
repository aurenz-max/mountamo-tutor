// @vitest-environment jsdom
/**
 * Reader-fit behavioral verification for classification-sorter — 15B / S9.
 *
 * The queued verdict was SCAFFOLD-GAP (no voice), but the audit also found a
 * PRIMITIVE-GAP the triage had not: the ONLY way to place an item was HTML5
 * drag-and-drop, which a five-year-old cannot execute, and every item label,
 * group name and rule was text-only. The fix follows the WordSorter PRE
 * precedent — stage ONE item at a time so the two-part drag collapses to
 * tap-a-group = choose.
 *
 * Behaviors tsc cannot see: the ORIENT beat fires, each staged item is voiced,
 * a tap on a group places the staged item, chrome is gone at K-2 but kept at
 * 3-5, and no message leaks the correct group.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

const sendTextSpy = vi.fn();
vi.mock('../../../../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText: sendTextSpy, isAudioPlaying: false, isConnected: true }),
}));
const submitResultSpy = vi.fn();
vi.mock('../../../../evaluation', () => ({
  usePrimitiveEvaluation: () => ({
    submitResult: submitResultSpy,
    hasSubmitted: false,
    resetAttempt: vi.fn(),
  }),
}));
vi.mock('../../../../utils/SoundManager', () => ({
  SoundManager: new Proxy({}, { get: () => vi.fn() }),
}));

import ClassificationSorter, { type ClassificationSorterData } from '../ClassificationSorter';

const RULE = 'Sort by whether the animal has wings';

const baseData = (over: Partial<ClassificationSorterData> = {}): ClassificationSorterData => ({
  title: 'Wings or No Wings',
  instructions: 'Put each animal in the right group.',
  sortingRule: RULE,
  gradeBand: 'K-2',
  allowPartialCredit: true,
  categories: [
    { id: 'wings', label: 'Has Wings', description: 'Animals with wings', parentId: null },
    { id: 'nowings', label: 'No Wings', description: 'Animals without wings', parentId: null },
  ],
  items: [
    {
      id: 'bird', label: 'Robin', imagePrompt: 'a red-breasted robin on a branch',
      hint: 'Look at its sides.', correctCategoryId: 'wings',
      distractorReasoning: 'some think birds are insects',
    },
    {
      id: 'dog', label: 'Dog', imagePrompt: 'a brown dog',
      hint: 'Can it fly?', correctCategoryId: 'nowings',
      distractorReasoning: 'n/a',
    },
  ],
  ...over,
});

const g4Data = () => baseData({
  gradeBand: '3-5',
  categories: [
    { id: 'birds', label: 'Birds', description: 'Feathered animals', parentId: null },
    { id: 'mammals', label: 'Mammals', description: 'Fur and milk', parentId: null },
  ],
  items: [
    {
      id: 'bird', label: 'Robin', imagePrompt: 'a red-breasted robin on a branch',
      hint: 'Look at its feathers.', correctCategoryId: 'birds', distractorReasoning: 'x',
    },
    {
      id: 'dog', label: 'Dog', imagePrompt: 'a brown dog',
      hint: 'Does it have fur?', correctCategoryId: 'mammals', distractorReasoning: 'y',
    },
  ],
});

const sent = () => sendTextSpy.mock.calls.map((c) => String(c[0]));

beforeEach(() => {
  cleanup();
  sendTextSpy.mockClear();
  submitResultSpy.mockClear();
});

describe('ClassificationSorter reader-fit — the voice (was the SCAFFOLD-GAP)', () => {
  it('fires an ORIENT beat naming the rule and the groups, but never a destination', () => {
    render(<ClassificationSorter data={baseData()} />);
    const orient = sent().find((m) => m.includes('[SORT_ORIENT]'))!;
    expect(orient).toBeTruthy();
    expect(orient).toContain(RULE);
    expect(orient).toContain('Has Wings');
    expect(orient).toContain('No Wings');
    expect(orient).toMatch(/Never say where any item belongs/i);
  });

  it('voices each staged item at K-2 without naming its group', () => {
    render(<ClassificationSorter data={baseData()} />);
    const staged = sent().find((m) => m.includes('[SORT_ITEM_STAGED]'))!;
    expect(staged).toBeTruthy();
    expect(staged).toContain('Robin');
    expect(staged).toMatch(/Do NOT say which group/i);
    // The answer must not appear anywhere in the message.
    expect(staged).not.toContain('Has Wings');
  });

  it('does NOT stage-voice at 3-5, where the pool is visible and readable', () => {
    render(<ClassificationSorter data={g4Data()} />);
    expect(sent().some((m) => m.includes('[SORT_ITEM_STAGED]'))).toBe(false);
  });

  it('read-aloud sends the instructions and the rule verbatim', () => {
    render(<ClassificationSorter data={baseData()} />);
    sendTextSpy.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /read the instructions to me/i }));
    const msg = sent().find((m) => m.includes('[SORT_READ_ALOUD]'))!;
    expect(msg).toContain('Put each animal in the right group.');
    expect(msg).toContain(RULE);
  });

  it('a wrong placement asks what they notice and never names the correct group', () => {
    render(<ClassificationSorter data={baseData()} />);
    sendTextSpy.mockClear();
    // Robin is staged; "No Wings" is wrong.
    fireEvent.click(screen.getByRole('button', { name: /put it in no wings/i }));
    const msg = sent().find((m) => m.includes('[SORT_INCORRECT]'))!;
    expect(msg).toBeTruthy();
    expect(msg).toContain('Robin');
    expect(msg).toMatch(/Do NOT name the correct group/i);
    // "Has Wings" is the answer for Robin — it must not be in the message.
    expect(msg).not.toContain('Has Wings');
  });

  it('every tagged send is silent', () => {
    render(<ClassificationSorter data={baseData()} />);
    fireEvent.click(screen.getByRole('button', { name: /read the instructions to me/i }));
    sendTextSpy.mock.calls.forEach((call) => {
      if (/^\[[A-Z_]+\]/.test(String(call[0]))) {
        expect(call[1]).toEqual({ silent: true });
      }
    });
    expect(sendTextSpy).toHaveBeenCalled();
  });
});

describe('ClassificationSorter reader-fit — band contract at PRE (K-2)', () => {
  it('stages exactly ONE item, not the whole pool (rule 4: one thing per screen)', () => {
    render(<ClassificationSorter data={baseData()} />);
    expect(screen.getByRole('button', { name: /hear robin again/i })).toBeTruthy();
    // The second item is not on screen yet.
    expect(screen.queryByRole('button', { name: /hear dog again/i })).toBeNull();
    expect(screen.queryByText(/items to sort/i)).toBeNull();
  });

  it('tapping a group places the staged item — tap = choose, no drag (rule 2)', () => {
    render(<ClassificationSorter data={baseData()} />);
    // Correct placement for Robin advances the stage to Dog.
    fireEvent.click(screen.getByRole('button', { name: /put it in has wings/i }));
    expect(screen.getByRole('button', { name: /hear dog again/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /hear robin again/i })).toBeNull();
  });

  it('hides the progress fraction, percentage and debug band readout at K-2 (rule 7)', () => {
    render(<ClassificationSorter data={baseData()} />);
    expect(screen.queryByText(/items sorted correctly/i)).toBeNull();
    expect(screen.queryByText(/grade band:/i)).toBeNull();
    expect(screen.queryByText(/^\d+%$/)).toBeNull();
  });

  it('keeps the progress bar and the item pool at 3-5 — band-gated, not deleted', () => {
    render(<ClassificationSorter data={g4Data()} />);
    expect(screen.getByText(/items sorted correctly/i)).toBeTruthy();
    expect(screen.getByText(/items to sort/i)).toBeTruthy();
    // No tap-to-place affordance at 3-5; drag is still the protocol there.
    expect(screen.queryByRole('button', { name: /put it in birds/i })).toBeNull();
  });

  it('never renders imagePrompt — it is an image-generation instruction, not copy', () => {
    const { container } = render(<ClassificationSorter data={g4Data()} />);
    expect(container.textContent).not.toContain('a red-breasted robin on a branch');
    expect(container.textContent).not.toContain('a brown dog');
  });

  it('drops the scientific group description at K-2 but keeps it at 3-5', () => {
    const { unmount } = render(<ClassificationSorter data={baseData()} />);
    expect(screen.queryByText('Animals with wings')).toBeNull();
    unmount();
    render(<ClassificationSorter data={g4Data()} />);
    expect(screen.getByText('Feathered animals')).toBeTruthy();
  });
});
