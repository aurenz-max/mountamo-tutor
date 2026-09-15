// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PipSurfaceContext } from './PipSurfaceContext';
import { PipSurfaceStore } from './PipSurfaceStore';
import InteractiveBook, { type InteractiveBookData } from '../primitives/visual-primitives/literacy/InteractiveBook';

const phase = vi.hoisted(() => ({
  tutorSpeaking: false, stage: 'asking', currentSolved: false, revealHeld: false, index: 0, cued: true,
  retry: () => {}, submit: vi.fn(),
}));
vi.mock('../hooks/useJudgedScriptRunner', () => ({
  useJudgedScriptRunner: ({ pack, onCorrectionRetry }: { pack: { items: Array<{ id: string }> }; onCorrectionRetry?: () => void }) => {
    const item = pack.items[phase.index] ?? null;
    phase.retry = () => onCorrectionRetry?.();
    return {
      currentItem: item, currentIndex: phase.index, stage: phase.stage, tutorSpeaking: phase.tutorSpeaking,
      currentSolved: phase.currentSolved, revealHeld: phase.revealHeld, cuedItemId: phase.cued ? item?.id ?? null : 'elsewhere',
      canAttempt: phase.stage !== 'judging' && !phase.currentSolved, solvedIds: new Set(),
      running: true, preparing: false, summary: null, stimulusTapped: false, hearStimulus: vi.fn(),
      isAwaitingGesture: () => false, submitGestureAttempt: phase.submit,
    };
  },
}));
vi.mock('../evaluation', () => ({
  usePrimitiveEvaluation: () => ({ submitResult: vi.fn(), hasSubmitted: false, submittedResult: null, elapsedMs: 0 }),
  useEvaluationContext: () => null,
}));
vi.mock('../service/geminiClient-api', () => ({ generateConceptImage: vi.fn(async () => null) }));
vi.mock('../components/JudgedMicPanel', () => ({ default: () => null }));
vi.mock('../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));

beforeEach(() => {
  Object.assign(phase, { tutorSpeaking: false, stage: 'asking', currentSolved: false, revealHeld: false, index: 0, cued: true });
  phase.submit.mockClear();
});
afterEach(cleanup);

const page = (n: number, heading: string, caption: string, paragraph: string) => ({
  id: `interactive-book-page-${n}`, pageNumber: n, heading, caption, paragraphs: [paragraph],
  imagePrompt: '', imageAlt: 'a picture', imageUrl: 'data:image/png;base64,', focusWords: [],
});
const data: InteractiveBookData = {
  title: 'Pond', description: '', gradeLevel: 'K', mode: 'mixed', challengeType: 'mixed', wordDifficulty: 'easy', instanceId: 'book',
  books: [{
    id: 'b1', bookTitle: 'Pond Neighbors', author: 'Mia Lee', coverColor: 'blue', coverImagePrompt: '', coverImageAlt: 'a pond',
    coverImageUrl: 'data:image/png;base64,',
    pages: [
      page(1, 'At the Pond', 'Frog Friends', 'The green frog can hop by the pond.'),
      page(2, 'Safe Nests', 'Nest Above', 'A bird sits in a nest.'),
    ],
  }],
  challenges: [
    { id: 'ib-w1', type: 'read-focus-word', prompt: '', hint: '', targetPageId: 'interactive-book-page-1', targetFeature: 'focus-word',
      targetText: 'frog', optionTexts: ['frog', 'pond'], readLead: 'The green', readTail: 'can hop by the pond.' },
    { id: 'ib-f2', type: 'find-feature', prompt: '', hint: '', targetPageId: 'interactive-book-page-2', targetFeature: 'caption',
      targetText: 'Nest Above', optionTexts: ['Safe Nests', 'Nest Above', 'Page 2'] },
  ],
};

function mount() {
  const store = new PipSurfaceStore();
  const ui = () => <PipSurfaceContext.Provider value={store}><InteractiveBook data={data} /></PipSurfaceContext.Provider>;
  const view = render(ui());
  const update = (next: Partial<typeof phase>) => act(() => { Object.assign(phase, next); view.rerender(ui()); });
  return { store, update, ...view };
}
const pose = (store: PipSurfaceStore) => store.getActive()?.pose;

describe('Interactive Book drives Pip from its judged phases', () => {
  it('a read item points at the glowing word the screen marks; celebrates only the affirmed read', () => {
    const { store, update, container } = mount();
    expect(container.querySelector('[data-pip-dock="book"]')).not.toBeNull();
    expect(container.querySelector('[data-pip-object="glow"]')?.textContent).toBe('frog');
    update({ tutorSpeaking: true });
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'glow' });
    update({ tutorSpeaking: false, stage: 'judging' });
    expect(pose(store)).toEqual({ phase: 'checking', gesture: 'look', targetId: 'glow' });
    update({ stage: 'affirmed', currentSolved: true });
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
  });

  it('find a feature outlines the whole page, never a printed part; watches the tapped part while judged', () => {
    const { store, update, container } = mount();
    update({ index: 1, tutorSpeaking: true });
    expect(store.getActive()?.targets.map((t) => t.id)).not.toContain('glow');
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'page' });
    update({ tutorSpeaking: false });
    act(() => { fireEvent.click(container.querySelector('[data-pip-object="part-interactive-book-page-2-heading"]') as HTMLElement); });
    expect(phase.submit).toHaveBeenCalledTimes(1);
    update({ stage: 'judging' });
    expect(pose(store)).toEqual({ phase: 'checking', gesture: 'look', targetId: 'part-interactive-book-page-2-heading' });
    update({ stage: 'asking' });
    act(() => { phase.retry(); });
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'page' });
  });

  it('unregisters on unmount', () => {
    const { store, unmount } = mount();
    unmount();
    expect(store.getActive()).toBeNull();
  });
});
