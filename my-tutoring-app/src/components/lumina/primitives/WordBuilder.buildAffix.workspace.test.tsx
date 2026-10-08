// @vitest-environment jsdom
/**
 * word-builder `build_affix` (open build) on the real teaching workspace: the real TeachingSession, LiveLessonRuntime,
 * transport and rendering shell, with a real grade 2 generation as the payload. The Live context, evaluation writes,
 * sound and the judge's HTTP call are substituted; the row's shape check is real.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LiveLessonRuntime } from '../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../components/live-activity/runtime/LiveRuntimeSurface';
import { RuntimeTransport } from '../components/live-activity/runtime/runtimeTransport';

const seam = vi.hoisted(() => ({ send: vi.fn(), submit: vi.fn(), evaluationContext: null as unknown }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'wb',
  conversation: [], sendText: seam.send, sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} },
}) }));
vi.mock('../evaluation', () => ({ useEvaluationContext: () => seam.evaluationContext,
  usePrimitiveEvaluation: () => ({ hasSubmitted: false, submitResult: seam.submit, elapsedMs: 0 }) }));
vi.mock('../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => () => true }) }));
import WordBuilder from './WordBuilder';
import type { WordBuilderData } from '../types';
import payload from '../components/live-activity/runtime/testing/w1-payloads/word-builder.build_affix.json';
import { affixBuildLevers, affixShapeMiss, askableBuildItem, buildItemsFrom, smallBoardFor, type BuildPart } from './visual-primitives/literacy/affixBuild';
import { getComponentById } from '../service/manifest/catalog';
import { decideWordBuild, secondOpinion } from '../service/build-layer/wordBuildDecision';
import { validateWordBuilderData } from '../components/live-activity/adapters/wordBuilderLive';

const data = (payload as unknown as { data: WordBuilderData }).data;
const board = data.availableParts as BuildPart[];
const part = (text: string) => board.find(p => p.text === text)!;

type Verdict = { met: boolean; miss?: string; realWord: number; fits: number; judge: string };
let verdicts: Verdict[] = [];
const judged: { action: string; params: Record<string, unknown> }[] = [];
const pass = (): Verdict => ({ met: true, realWord: 0.98, fits: 0.9, judge: 'jev' });
beforeEach(() => {
  vi.clearAllMocks(); seam.evaluationContext = null; verdicts = []; judged.length = 0;
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init: { body: string }) => {
    judged.push(JSON.parse(init.body));
    return { ok: true, json: async () => verdicts.shift() };
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function mount(d: WordBuilderData = data) {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  new RuntimeTransport(runtime, () => {});
  render(<LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <WordBuilder data={{ ...d, instanceId: 'wb' }} runtimePlanItemId="plan-wb" runtimeEvalMode="build_affix" />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>);
  const state = () => runtime.getSnapshot();
  let lastCommand = '';
  const dispatch = (name: string, input?: Record<string, unknown>) => {
    const s = state();
    const a = s.affordances.find(x => x.action.type === name || x.action.type === 'workspace' && (x.action as { operation?: string }).operation === name);
    expect(a, `missing action ${name}`).toBeTruthy();
    lastCommand = crypto.randomUUID();
    act(() => { runtime.dispatch({ sessionEpoch: 'test', commandId: lastCommand, instanceId: 'wb', itemId: s.task!.itemId,
      expectedRevision: s.revision, action: { ...a!.action, ...(input ? { input } : {}) } as never }); });
  };
  const tap = (text: string) => act(() => { fireEvent.click(screen.getByRole('button', { name: new RegExp(`^Add ${text},`) })); });
  const done = async () => { await act(async () => { fireEvent.click(screen.getByRole('button', { name: "I'm done!" })); }); };
  const next = () => { dispatch('advance'); act(() => { runtime.confirmVisibleResponse(lastCommand); }); };
  const facts = () => state().task!.demand as Record<string, unknown>;
  return { state, dispatch, tap, done, next, facts };
}

describe('build_affix rules (pure)', () => {
  it('the row shape is checked in code: root alone, affix alone, wrong order, a word already made', () => {
    expect(affixShapeMiss([part('play')])).toBe('root_only');
    expect(affixShapeMiss([part('re'), part('ed')])).toBe('affix_only');
    expect(affixShapeMiss([part('play'), part('re')])).toBe('parts_out_of_order');
    expect(affixShapeMiss([part('re'), part('play'), part('kind')])).toBe('parts_out_of_order');
    expect(affixShapeMiss([part('re'), part('play')], ['replay'])).toBe('same_word');
    expect(affixShapeMiss([part('re'), part('play'), part('ed')])).toBeUndefined();
  });

  it('drops an ask that names a passing word or that fewer than two board words fit', () => {
    expect(askableBuildItem({ id: 'x', ask: 'Make a word like replay.', examples: [['pre-re', 'root-play'], ['pre-re', 'root-heat']], ways: 1 }, board)).toBeNull();
    expect(askableBuildItem({ id: 'x', ask: 'Make a word that means to do it again.', examples: [['pre-re', 'root-play']], ways: 1 }, board)).toBeNull();
    expect(askableBuildItem({ id: 'x', ask: 'Make a word that means to do it again.', examples: [['pre-re', 'root-play'], ['root-play', 'pre-re']], ways: 1 }, board)).toBeNull();
    expect(askableBuildItem({ id: 'x', ask: 'Make a word that means to do it again.', examples: [['pre-re', 'root-play'], ['pre-re', 'root-heat']], ways: 1 }, board)).not.toBeNull();
  });

  it('every second item asks for two words, none at the easy tier; the live adapter accepts the generation', () => {
    expect(buildItemsFrom(data.buildItems!, board).map(i => i.ways)).toEqual([1, 2, 1, 2, 1, 2]);
    expect(buildItemsFrom(data.buildItems!, board, 'easy').every(i => i.ways === 1)).toBe(true);
    expect(() => validateWordBuilderData(data)).not.toThrow();
    expect(() => validateWordBuilderData({ ...data, buildItems: [{ id: 'x', ask: 'Make replay.', examples: [], ways: 1 }] })).toThrow();
  });

  it('every build_affix miss but same_word is answered by a lever; same_word is declared unanswered', () => {
    const tw = getComponentById('word-builder')!.teachingWorkspace!;
    const item = buildItemsFrom(data.buildItems!, board)[0];
    const answered = new Set(affixBuildLevers(item, board, []).flatMap(l => l.answers ?? []));
    for (const m of tw.misses!.build_affix) if (m !== 'same_word') expect(answered.has(m), m).toBe(true);
    expect(tw.unanswered!.build_affix).toEqual(['same_word']);
  });

  it('the small board keeps every example part and one other card per type, and is smaller', () => {
    const item = buildItemsFrom(data.buildItems!, board)[0];
    const small = smallBoardFor(item, board)!;
    expect(small.board!.length).toBeLessThan(board.length);
    expect(item.examples.flat().every(id => small.board!.some(p => p.id === id))).toBe(true);
  });

  it('the judge decides from two probabilities; a Jev rejection gets a second opinion', () => {
    expect(decideWordBuild(0.2, 0.9, 'jev')).toMatchObject({ met: false, miss: 'not_a_word' });
    expect(decideWordBuild(0.95, 0.2, 'jev')).toMatchObject({ met: false, miss: 'wrong_meaning' });
    expect(decideWordBuild(0.95, 0.8, 'jev').met).toBe(true);
    const jevNo = decideWordBuild(0.98, 0.27, 'jev');
    expect(secondOpinion(jevNo, decideWordBuild(1, 1, 'flash'))).toMatchObject({ met: true, judge: 'jev+flash' });
    expect(secondOpinion(decideWordBuild(0.3, 0, 'jev'), decideWordBuild(1, 0, 'flash'))).toMatchObject({ met: false, miss: 'not_a_word' });
  });
});

describe('build_affix on the workspace', () => {
  it('binds the ask as a gesture task with no key; done is off on an empty row', () => {
    const h = mount();
    expect(h.state().owner).toBe('tutor');
    expect(h.state().task!.task).toBe('Make a word that means to do it again.');
    expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
    expect((screen.getByRole('button', { name: "I'm done!" }) as HTMLButtonElement).disabled).toBe(true);
    expect(h.facts()).toMatchObject({ row: 'empty', partsPlaced: 0 });
  });

  it('a root alone misses in code with no judge call; Try again keeps the row; a fitting word passes', async () => {
    const h = mount();
    h.tap('play');
    await h.done();
    expect(judged).toHaveLength(0);
    expect(h.state().task!.evidence.correctness).toBe('incorrect');
    expect(screen.getByText(/root on its own/)).toBeTruthy();
    h.dispatch('retry');
    expect(screen.getByRole('button', { name: 'Take out play' })).toBeTruthy();
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Take out play' })); });
    h.tap('re'); h.tap('play');
    expect(h.facts()).toMatchObject({ row: 're + play', partsPlaced: 2 });
    verdicts.push(pass());
    await h.done();
    expect(judged[0]).toMatchObject({ action: 'judgeWordBuild', params: { ask: 'Make a word that means to do it again.', made: 'replay', pieces: 're + play' } });
    expect(h.state().task!.evidence.correctness).toBe('correct');
  });

  it('a two-word item keeps the first word on screen, refuses it again in code, and commits the second', async () => {
    const h = mount();
    h.tap('re'); h.tap('heat'); verdicts.push(pass()); await h.done();
    h.next();
    expect(h.state().task!.task).toMatch(/do it before\. Then make a different word/);
    h.tap('pre'); h.tap('heat'); verdicts.push(pass()); await h.done();
    expect(h.state().task!.evidence.correctness).not.toBe('correct');
    expect(screen.getByTestId('wb-made').textContent).toContain('preheat');
    expect(h.facts()).toMatchObject({ waysAsked: 2, waysMade: 1, madeBefore: 'preheat', row: 'empty' });
    h.tap('pre'); h.tap('heat'); await h.done();
    expect(h.state().task!.evidence.correctness).toBe('incorrect');
    expect(judged).toHaveLength(2);
    h.dispatch('retry');
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Take out heat' })); });
    h.tap('view'); verdicts.push(pass()); await h.done();
    expect(judged[2].params.made).toBe('preview');
    expect(h.state().task!.evidence.correctness).toBe('correct');
  });

  it('a judged miss names it; the levers answer it, and the simplify lever opens the small board as practice', async () => {
    const h = mount();
    h.tap('un'); h.tap('play');
    verdicts.push({ met: false, miss: 'not_a_word', realWord: 0.1, fits: 0, judge: 'jev+flash' });
    await h.done();
    expect(h.state().task!.evidence.correctness).toBe('incorrect');
    expect(screen.getByText(/not a word we use/)).toBeTruthy();
    const levers = h.state().task!.workspace!.levers ?? [];
    expect(levers.map(l => l.id)).toEqual(['part_frame', 'model_word', 'small_board']);
    expect(levers.find(l => l.id === 'model_word')!.answers).toContain('not_a_word');
    h.dispatch('pull_lever', { lever: 'part_frame' });
    expect(document.querySelector('[data-lever="part-frame"]')).not.toBeNull();
    expect(document.querySelector('[data-lever="part-frame"]')!.textContent).toBe('prefix+root');
  });

  it('a judge that cannot be reached commits nothing', async () => {
    const h = mount();
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500 })));
    h.tap('re'); h.tap('play');
    await h.done();
    expect(h.state().task!.evidence.correctness).not.toBe('incorrect');
    expect(screen.getByText(/could not look just now/)).toBeTruthy();
  });
});
