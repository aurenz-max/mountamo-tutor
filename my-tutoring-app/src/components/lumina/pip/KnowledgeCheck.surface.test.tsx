// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PipSurfaceContext } from './PipSurfaceContext';
import { PipSurfaceStore } from './PipSurfaceStore';
import { KnowledgeCheck } from '../primitives/KnowledgeCheck';
import { itemsFromProblems } from '../primitives/knowledgeCheckScript';
import type { ProblemData } from '../types';

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
vi.mock('../components/JudgedMicPanel', () => ({ default: () => null }));
vi.mock('@/contexts/LuminaAIContext', () => ({
  useMicLevel: () => 0,
  useLuminaAIContext: () => ({ isConnected: false, isAudioPlaying: false, sessionMode: 'idle', activePrimitiveId: null, sendText: vi.fn(), updateContext: vi.fn() }),
}));

beforeEach(() => {
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: vi.fn() }, configurable: true });
  Object.assign(phase, { tutorSpeaking: false, stage: 'asking', currentSolved: false, revealHeld: false, index: 0, cued: true });
  phase.submit.mockClear();
});
afterEach(cleanup);

const base = { difficulty: 'easy' as const, gradeLevel: '1', rationale: 'Because.', teachingNote: '', successCriteria: [] };
const problems = [
  { ...base, type: 'true_false', id: 'tf1', statement: 'A spider has eight legs', correct: true },
  { ...base, type: 'multiple_choice', id: 'mc1', question: 'Which animal says moo?', correctOptionId: 'A',
    options: [{ id: 'A', text: 'cow', emoji: '🐄' }, { id: 'B', text: 'duck', emoji: '🦆' }, { id: 'C', text: 'frog', emoji: '🐸' }] },
  { ...base, type: 'multiple_choice', id: 'mc2', question: 'Which expression equals ten?', optionFormat: 'katex', correctOptionId: 'A',
    options: [{ id: 'A', text: '7+3' }, { id: 'B', text: '5+2' }] },
] as unknown as ProblemData[];
const items = itemsFromProblems(problems).items;
const indexOf = (kind: string) => items.findIndex((item) => item.kind === kind);

function mount() {
  const store = new PipSurfaceStore();
  const ui = () => <PipSurfaceContext.Provider value={store}><KnowledgeCheck data={{ problems, instanceId: 'check' }} /></PipSurfaceContext.Provider>;
  const view = render(ui());
  const update = (next: Partial<typeof phase>) => act(() => { Object.assign(phase, next); view.rerender(ui()); });
  return { ...view, store, update };
}
const pose = (store: PipSurfaceStore) => store.getActive()?.pose;
const ids = (store: PipSurfaceStore) => store.getActive()?.targets.map((t) => t.id);

describe('Knowledge Check drives Pip from its judged phases', () => {
  it('spoken items point at the question card, never a True/False or choice card', () => {
    const { store, update, container } = mount();
    expect(container.querySelector('[data-pip-dock="check"]')).not.toBeNull();
    for (const kind of ['true_false', 'choice']) {
      expect(indexOf(kind)).toBeGreaterThanOrEqual(0);
      update({ index: indexOf(kind), tutorSpeaking: true });
      expect(ids(store)).toEqual(['question']);
      expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'question' });
    }
    update({ tutorSpeaking: false, revealHeld: true });
    expect(pose(store)).toEqual({ phase: 'celebrating', gesture: 'none' });
  });

  it('a tapped choice is watched while judged, never received; a retry drops it', () => {
    const { store, update, container } = mount();
    expect(indexOf('choice_tap')).toBeGreaterThanOrEqual(0);
    update({ index: indexOf('choice_tap'), tutorSpeaking: true });
    expect(pose(store)).toEqual({ phase: 'introducing', gesture: 'point', targetId: 'question' });
    update({ tutorSpeaking: false });
    act(() => { fireEvent.click(container.querySelector('[data-pip-object="option-B"]') as HTMLElement); });
    expect(phase.submit).toHaveBeenCalledTimes(1);
    update({ stage: 'judging' });
    expect(pose(store)).toEqual({ phase: 'checking', gesture: 'look', targetId: 'option-B' });
    update({ stage: 'asking' });
    act(() => { phase.retry(); });
    expect(pose(store)).toEqual({ phase: 'working', gesture: 'look', targetId: 'question' });
  });

  it('unregisters on unmount', () => {
    const { store, unmount } = mount();
    unmount();
    expect(store.getActive()).toBeNull();
  });
});
