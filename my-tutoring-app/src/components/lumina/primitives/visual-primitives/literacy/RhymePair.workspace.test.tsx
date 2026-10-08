// @vitest-environment jsdom
/**
 * rhyme-studio `pair_build` (open build) on the real teaching workspace, with a real generation as the payload. The
 * Live context, evaluation writes and sound are substituted; the rhyme check is the real code.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LiveLessonRuntime } from '../../../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../../../components/live-activity/runtime/LiveRuntimeSurface';
import { RuntimeTransport } from '../../../components/live-activity/runtime/runtimeTransport';

const seam = vi.hoisted(() => ({ send: vi.fn(), submit: vi.fn(), evaluationContext: null as unknown }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'rp',
  conversation: [], sendText: seam.send, sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} },
}) }));
vi.mock('../../../evaluation', () => ({ useEvaluationContext: () => seam.evaluationContext,
  usePrimitiveEvaluation: () => ({ hasSubmitted: false, submitResult: seam.submit, elapsedMs: 0 }) }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => () => true }) }));
import RhymeStudio, { type RhymeStudioData } from './RhymeStudio';
import payload from '../../../components/live-activity/runtime/testing/w1-payloads/rhyme-studio.pair_build.json';
import { getComponentById } from '../../../service/manifest/catalog';
import { validateRhymeStudioData } from '../../../components/live-activity/adapters/rhymeStudioLive';
import {
  PICTURES, askablePairItem, makePairItems, pairItemsFrom, pairLevers, pairMiss, rhymingPairs, smallBoardFor,
} from './rhymePairBuild';

const data = (payload as unknown as { data: RhymeStudioData }).data;
beforeEach(() => { vi.clearAllMocks(); seam.evaluationContext = null; });
afterEach(() => { cleanup(); });

function mount() {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  new RuntimeTransport(runtime, () => {});
  render(<LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <RhymeStudio data={{ ...data, instanceId: 'rp' }} runtimePlanItemId="plan-rp" runtimeEvalMode="pair_build" />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>);
  const state = () => runtime.getSnapshot();
  let lastCommand = '';
  const dispatch = (name: string, input?: Record<string, unknown>) => {
    const s = state();
    const a = s.affordances.find(x => x.action.type === name || x.action.type === 'workspace' && (x.action as { operation?: string }).operation === name);
    expect(a, `missing action ${name}`).toBeTruthy();
    lastCommand = crypto.randomUUID();
    act(() => { runtime.dispatch({ sessionEpoch: 'test', commandId: lastCommand, instanceId: 'rp', itemId: s.task!.itemId,
      expectedRevision: s.revision, action: { ...a!.action, ...(input ? { input } : {}) } as never }); });
  };
  const pick = (...words: string[]) => { for (const w of words) act(() => { fireEvent.click(screen.getByRole('button', { name: `picture ${w}` })); }); };
  const done = () => act(() => { fireEvent.click(screen.getByRole('button', { name: "I'm done!" })); });
  const next = () => { dispatch('advance'); act(() => { runtime.confirmVisibleResponse(lastCommand); }); };
  return { state, dispatch, pick, done, next };
}

const items = pairItemsFrom(data.pairItems!);
const pairsOf = (n: number) => rhymingPairs(items[n].board).map(p => p.split('+'));
const decoyOf = (n: number) => {
  const b = items[n].board;
  for (const a of b) for (const c of b) if (a < c && pairMiss([a, c]) === 'same_start') return [a, c];
  throw new Error('no decoy');
};

describe('pair_build rules (pure)', () => {
  it('rhyme is the rime; a shared first sound alone is same_start; a repeat is same_pair', () => {
    expect(pairMiss(['cat', 'hat'])).toBeUndefined();
    expect(pairMiss(['cat', 'car'])).toBe('same_start');
    expect(pairMiss(['cat', 'dog'])).toBe('no_rhyme');
    expect(pairMiss(['hat', 'cat'], ['cat+hat'])).toBe('same_pair');
    expect(pairMiss(['bear', 'chair'])).toBeUndefined();
  });

  it('every picture word is unique and every rime used for a pair has 2+ pictures', () => {
    expect(new Set(PICTURES.map(p => p.word)).size).toBe(PICTURES.length);
    expect(new Set(PICTURES.map(p => p.emoji)).size).toBe(PICTURES.length);
  });

  it('code-owned boards always have 3 rhyming pairs and a same-start decoy; a board without a decoy is dropped', () => {
    for (let n = 0; n < 30; n++) for (const item of makePairItems(4)) {
      expect(rhymingPairs(item.board).length).toBe(3);
      expect(askablePairItem({ ...item, ways: 2 })).not.toBeNull();
    }
    expect(askablePairItem({ id: 'x', board: ['cat', 'hat', 'dog', 'log', 'moon', 'spoon'], ways: 1 })).toBeNull();
  });

  it('the small board has exactly one pair; every named miss but same_pair is answered by a lever; the adapter accepts', () => {
    const small = smallBoardFor(items[0])!;
    expect(rhymingPairs(small.board)).toHaveLength(1);
    const tw = getComponentById('rhyme-studio')!.teachingWorkspace!;
    const answered = new Set(pairLevers(items[0], []).flatMap(l => l.answers ?? []));
    for (const m of tw.misses!.pair_build) if (m !== 'same_pair') expect(answered.has(m), m).toBe(true);
    expect(tw.unanswered!.pair_build).toEqual(['same_pair']);
    expect(() => validateRhymeStudioData(data)).not.toThrow();
  });
});

describe('pair_build on the workspace', () => {
  it('binds a gesture task with no key and no print; the decoy is same_start; Try again keeps the tray; a rhyme passes', () => {
    const h = mount();
    expect(h.state().task!.task).toMatch(/Find two pictures that rhyme/);
    expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
    for (const w of items[0].board) expect(screen.queryByText(w)).toBeNull();
    const [a, c] = decoyOf(0);
    h.pick(a, c); h.done();
    expect(h.state().task!.evidence.correctness).toBe('incorrect');
    expect(screen.getByText(/start the same/)).toBeTruthy();
    h.dispatch('retry');
    expect(screen.getByRole('button', { name: `take back ${a}` })).toBeTruthy();
    act(() => { fireEvent.click(screen.getByRole('button', { name: `take back ${a}` })); });
    act(() => { fireEvent.click(screen.getByRole('button', { name: `take back ${c}` })); });
    const [p, q] = pairsOf(0)[0];
    h.pick(p, q); h.done();
    expect(h.state().task!.evidence.correctness).toBe('correct');
  });

  it('a two-pair board keeps the first pair, refuses it again, and commits a different one', () => {
    const h = mount();
    const [p, q] = pairsOf(0)[0];
    h.pick(p, q); h.done(); h.next();
    expect(h.state().task!.task).toMatch(/Then find a different pair/);
    const [[a, b], [c, d]] = pairsOf(1);
    h.pick(a, b); h.done();
    expect(h.state().task!.evidence.correctness).not.toBe('correct');
    expect(screen.getByTestId('rp-made')).toBeTruthy();
    h.pick(b, a); h.done();
    expect(h.state().task!.evidence.correctness).toBe('incorrect');
    h.dispatch('retry');
    act(() => { fireEvent.click(screen.getByRole('button', { name: `take back ${b}` })); });
    act(() => { fireEvent.click(screen.getByRole('button', { name: `take back ${a}` })); });
    h.pick(c, d); h.done();
    expect(h.state().task!.evidence.correctness).toBe('correct');
  });

  it('a speaker asks the tutor for that name only', () => {
    mount();
    act(() => { fireEvent.click(screen.getByRole('button', { name: `say ${items[0].board[0]}` })); });
    expect(seam.send).toHaveBeenCalledWith(expect.stringContaining(`"${items[0].board[0]}"`), expect.objectContaining({ silent: true }));
  });
});
