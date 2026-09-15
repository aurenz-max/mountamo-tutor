// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PipSurfaceContext } from './PipSurfaceContext';
import { PipSurfaceStore } from './PipSurfaceStore';
import DecodableReader, { type DecodableReaderData } from '../primitives/visual-primitives/literacy/DecodableReader';
import { itemsFromChallenges } from '../primitives/visual-primitives/literacy/decodableReaderScript';

const phase = vi.hoisted(() => ({
  tutorSpeaking: false, stage: 'asking', currentSolved: false, revealHeld: false, index: 0, cued: true,
}));
vi.mock('../hooks/useJudgedScriptRunner', () => ({
  useJudgedScriptRunner: ({ pack }: { pack: { items: Array<{ id: string }> } }) => {
    const item = pack.items[phase.index] ?? null;
    return {
      currentItem: item, currentIndex: phase.index, stage: phase.stage, tutorSpeaking: phase.tutorSpeaking,
      currentSolved: phase.currentSolved, revealHeld: phase.revealHeld, cuedItemId: phase.cued ? item?.id ?? null : 'elsewhere',
      canAttempt: phase.stage !== 'judging' && !phase.currentSolved, solvedIds: new Set(),
      running: true, preparing: false, summary: null, stimulusTapped: false, hearStimulus: vi.fn(),
      isAwaitingGesture: () => false, submitGestureAttempt: vi.fn(),
    };
  },
}));
vi.mock('../evaluation', () => ({
  usePrimitiveEvaluation: () => ({ submitResult: vi.fn(), hasSubmitted: false, submittedResult: null, elapsedMs: 0 }),
  useEvaluationContext: () => null,
}));
vi.mock('../components/JudgedMicPanel', () => ({ default: () => null }));

beforeEach(() => {
  Object.assign(phase, { tutorSpeaking: false, stage: 'asking', currentSolved: false, revealHeld: false, index: 0, cued: true });
});
afterEach(cleanup);

const sentence = (id: string, text: string) => ({
  id, words: text.split(' ').map((w, i) => ({ id: `${id}_w${i}`, text: w, phonicsPattern: 'cvc' as const })),
});
const base = (over: Partial<DecodableReaderData>): DecodableReaderData => ({
  title: 'Story', gradeLevel: 'K', instanceId: 'reader', phonicsPatternsInPassage: ['cvc'],
  passage: { sentences: [sentence('s1', 'The cat sat on a mat.'), sentence('s2', 'The dog can run.')] },
  ...over,
});
const decode = base({
  readingMode: 'decode', comprehensionType: 'main_idea',
  comprehensionQuestions: [{
    question: 'What is the story mostly about?', correctOptionId: 'A',
    options: [
      { id: 'A', text: 'A cat and a dog at home.', emoji: '🏠' },
      { id: 'B', text: 'A trip to the moon.', emoji: '🚀' },
      { id: 'C', text: 'Baking a big cake.', emoji: '🎂' },
    ],
  }],
});
const readAlong = base({
  readingMode: 'read_along', comprehensionType: 'literal',
  comprehensionQuestions: [{ question: 'What did the cat sit on?', answerWord: 'mat' }],
});
const indexOf = (data: DecodableReaderData, kind: string) =>
  itemsFromChallenges({ ...data, passage: { sentences: data.passage.sentences } }).items.findIndex((item) => item.kind === kind);

function mount(data: DecodableReaderData) {
  const store = new PipSurfaceStore();
  const ui = () => <PipSurfaceContext.Provider value={store}><DecodableReader data={data} /></PipSurfaceContext.Provider>;
  const view = render(ui());
  const update = (next: Partial<typeof phase>) => act(() => { Object.assign(phase, next); view.rerender(ui()); });
  return { store, update, ...view };
}
const pose = (store: PipSurfaceStore) => store.getActive()?.pose;
const ids = (store: PipSurfaceStore) => store.getActive()?.targets.map((t) => t.id);

describe('Decodable Reader drives Pip from its judged phases', () => {
  it('a read line is pointed at as a whole line; celebrates only the affirmed read', () => {
    const { store, update, container } = mount(decode);
    expect(container.querySelector('[data-pip-dock="reader"]')).not.toBeNull();
    expect(ids(store)).toEqual(['line']);
    update({ tutorSpeaking: true });
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'line' });
    update({ tutorSpeaking: false, stage: 'judging' });
    expect(pose(store)).toEqual({ phase: 'checking', gesture: 'look', targetId: 'line' });
    update({ stage: 'affirmed', currentSolved: true });
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
  });

  it('a choice question points at the question card, never a choice', () => {
    const { store, update } = mount(decode);
    const index = indexOf(decode, 'answer_choice');
    expect(index).toBeGreaterThan(0);
    update({ index, tutorSpeaking: true });
    expect(ids(store)).toEqual(['question']);
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'question' });
  });

  it('read-along points at the story the child answers from; unregisters on unmount', () => {
    const { store, update, unmount } = mount(readAlong);
    update({ index: indexOf(readAlong, 'answer_spoken'), tutorSpeaking: true });
    expect(ids(store)).toEqual(expect.arrayContaining(['story', 'question']));
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'story' });
    unmount();
    expect(store.getActive()).toBeNull();
  });
});
