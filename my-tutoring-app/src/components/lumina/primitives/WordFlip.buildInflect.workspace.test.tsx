// @vitest-environment jsdom
/**
 * word-flip `build_inflect` (open build, OB-8L) on the real teaching workspace, on word-builder's word-part surface:
 * the real TeachingSession, LiveLessonRuntime, transport and rendering shell, with a real grade 2 generation as the
 * payload. The Live context, evaluation writes, sound and the judge's HTTP call are substituted; the code check is real.
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
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'flip',
  conversation: [], sendText: seam.send, sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} },
}) }));
vi.mock('../evaluation', () => ({ useEvaluationContext: () => seam.evaluationContext,
  usePrimitiveEvaluation: () => ({ hasSubmitted: false, submitResult: seam.submit, elapsedMs: 0 }) }));
vi.mock('../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => () => true }) }));
import WordFlip, { type WordFlipData } from './visual-primitives/literacy/WordFlip';
import payload from '../components/live-activity/runtime/testing/w1-payloads/word-flip.build_inflect.json';
import { joined, type BuildPart } from './visual-primitives/literacy/affixBuild';
import {
  INFLECT_BUILD_MISSES, endingChartFor, fewerEndingsFor, inflectBuildLevers, inflectItemsFrom, inflectMiss,
  type InflectBuildItem,
} from './visual-primitives/literacy/inflectBuild';
import { getComponentById } from '../service/manifest/catalog';
import { validateWordFlipData } from '../components/live-activity/adapters/wordFlipLive';
import { wordFlipOracle } from '../service/qa/oracles/word-flip';

const data = (payload as unknown as { data: WordFlipData }).data;
const board = data.availableParts as BuildPart[];
const part = (text: string) => board.find(p => p.text === text)!;
const items = () => inflectItemsFrom(data.buildItems!, board);
const item = (id: string) => items().find(i => i.id === id)!;

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

function mount(d: WordFlipData = data) {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  new RuntimeTransport(runtime, () => {});
  render(<LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <WordFlip data={{ ...d, instanceId: 'flip' }} runtimePlanItemId="plan-flip" runtimeEvalMode="build_inflect" />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>);
  const state = () => runtime.getSnapshot();
  let lastCommand = '';
  const dispatch = (name: string, input?: Record<string, unknown>) => {
    const s = state();
    const a = s.affordances.find(x => x.action.type === name || x.action.type === 'workspace' && (x.action as { operation?: string }).operation === name);
    expect(a, `missing action ${name}`).toBeTruthy();
    lastCommand = crypto.randomUUID();
    act(() => { runtime.dispatch({ sessionEpoch: 'test', commandId: lastCommand, instanceId: 'flip', itemId: s.task!.itemId,
      expectedRevision: s.revision, action: { ...a!.action, ...(input ? { input } : {}) } as never }); });
  };
  const tap = (text: string) => act(() => { fireEvent.click(screen.getByRole('button', { name: new RegExp(`^Add ${text},`) })); });
  const out = (text: string) => act(() => { fireEvent.click(screen.getByRole('button', { name: `Take out ${text}` })); });
  const done = async () => { await act(async () => { fireEvent.click(screen.getByRole('button', { name: "I'm done!" })); }); };
  const next = () => { dispatch('advance'); act(() => { runtime.confirmVisibleResponse(lastCommand); }); };
  const facts = () => state().task!.demand as Record<string, unknown>;
  return { state, dispatch, tap, out, done, next, facts };
}

describe('build_inflect rules (pure)', () => {
  it('the ies card takes the place of a last y, and only a last y', () => {
    expect(joined([part('berry'), part('ies')])).toBe('berries');
    expect(joined([part('cup'), part('ies')])).toBe('cupies');
    expect(joined([part('box'), part('es')])).toBe('boxes');
  });

  it('the code check: shape, the ending\'s job, the named base, the fit, the y change, a word made twice', () => {
    const plural = item('f1'), past = item('f2'), yAsk = item('f3');
    expect(inflectMiss(plural, [part('box')])).toBe('base_only');
    expect(inflectMiss(plural, [part('s')])).toBe('ending_only');
    expect(inflectMiss(plural, [part('s'), part('cup')])).toBe('parts_out_of_order');
    expect(inflectMiss(plural, [part('cup'), part('box'), part('s')])).toBe('parts_out_of_order');
    expect(inflectMiss(plural, [part('cup'), part('s'), part('es')])).toBe('double_ending');
    expect(inflectMiss(plural, [part('cup'), part('ed')])).toBe('wrong_ending_kind');
    expect(inflectMiss(past, [part('wash'), part('es')])).toBe('wrong_ending_kind');
    expect(inflectMiss(yAsk, [part('cup'), part('s')])).toBe('other_base');
    expect(inflectMiss(plural, [part('box'), part('s')])).toBe('wrong_ending');
    expect(inflectMiss(plural, [part('cup'), part('es')])).toBe('wrong_ending');
    expect(inflectMiss(plural, [part('cup'), part('ies')])).toBe('wrong_ending');
    expect(inflectMiss(plural, [part('berry'), part('s')])).toBe('missed_y_change');
    expect(inflectMiss(plural, [part('berry'), part('es')])).toBe('missed_y_change');
    expect(inflectMiss(plural, [part('berry'), part('ies')])).toBeUndefined();
    expect(inflectMiss(plural, [part('berry'), part('ies')], ['berries'])).toBe('same_word');
    // "babyed" passed the judge in the labelled set; code names it.
    expect(inflectMiss(past, [part('berry'), part('ed')])).toBe('not_a_word');
    // The judge's to read, not code's: a past ending on a thing word, a plural ending on an action word.
    expect(inflectMiss(past, [part('box'), part('ed')])).toBeUndefined();
    expect(inflectMiss(plural, [part('wash'), part('es')])).toBeUndefined();
  });

  it('every second item asks for two words, none at the easy tier; the adapter and the oracle accept the generation', () => {
    expect(items().map(i => i.ways)).toEqual([1, 2, 1, 2, 1]);
    expect(inflectItemsFrom(data.buildItems!, board, 'easy').every(i => i.ways === 1)).toBe(true);
    expect(() => validateWordFlipData(data)).not.toThrow();
    const bad = data.buildItems!.map((i, n) => n === 0 ? { ...i, examples: [...i.examples, ['noun-box', 'end-s']] } : i);
    expect(() => validateWordFlipData({ ...data, buildItems: bad })).toThrow();
    expect(wordFlipOracle.verify(data as never, { componentId: 'word-flip', evalMode: 'build_inflect', topic: '', gradeLevel: 'Grade 2' }).violations).toEqual([]);
    const leaky = { ...data, buildItems: data.buildItems!.map((i, n) => n === 0 ? { ...i, ask: 'Make a word like cups.' } : i) };
    expect(wordFlipOracle.verify(leaky as never, { componentId: 'word-flip', evalMode: 'build_inflect', topic: '', gradeLevel: 'Grade 2' })
      .violations.map(v => v.check)).toContain('answer-leak');
  });

  it('every miss but same_word is answered by a lever; the catalog declares the misses and the mode', () => {
    const entry = getComponentById('word-flip')!;
    const tw = entry.teachingWorkspace!;
    expect(tw.misses!.build_inflect).toEqual([...INFLECT_BUILD_MISSES]);
    const answered = new Set(inflectBuildLevers(item('f1'), board, []).flatMap(l => l.answers ?? []));
    for (const m of INFLECT_BUILD_MISSES) if (m !== 'same_word') expect(answered.has(m), m).toBe(true);
    expect(tw.unanswered!.build_inflect).toEqual(['same_word']);
    const mode = entry.evalModes!.find(m => m.evalMode === 'build_inflect')!;
    expect(mode).toMatchObject({ beta: 3.6, challengeTypes: ['build_inflect'], affordances: { answers: ['build'] } });
    expect(inflectBuildLevers(item('f1'), board, []).every(l => !l.pulled)).toBe(true);
  });

  it('the chart shares no word with the board; fewer endings keeps two fitting words and two endings', () => {
    const words = new Set(board.map(p => p.text));
    const chart = endingChartFor(board);
    expect(chart.map(([p]) => p.split(' + ')[1])).toEqual(['s', 'es', 'ies', 'ed']);
    for (const [p, w] of chart) { expect(words.has(p.split(' + ')[0])).toBe(false); expect(words.has(w)).toBe(false); }
    for (const it of items()) {
      const small = fewerEndingsFor(it, board) as InflectBuildItem;
      expect(small.board!.filter(p => p.type === 'suffix')).toHaveLength(2);
      expect(small.examples.flat().every(id => small.board!.some(p => p.id === id))).toBe(true);
      expect(small.examples.every(ids => !inflectMiss(small, ids.map(id => small.board!.find(p => p.id === id)!)))).toBe(true);
    }
  });
});

describe('build_inflect on the workspace', () => {
  it('opens empty: the ask as a gesture task with no key, no ending printed with a meaning, done off', () => {
    const h = mount();
    expect(h.state().owner).toBe('tutor');
    expect(h.state().task!.task).toBe('Make a word that means more than one.');
    expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
    expect((screen.getByRole('button', { name: "I'm done!" }) as HTMLButtonElement).disabled).toBe(true);
    expect(h.facts()).toMatchObject({ row: 'empty', partsPlaced: 0, endingsPlaced: 0 });
    expect(screen.getByRole('button', { name: 'Add ies, ending' })).toBeTruthy();
    expect(document.querySelector('[data-lever]')).toBeNull();
  });

  it('a missed y change misses in code with no judge call; Try again keeps the row; ies strikes the y and passes', async () => {
    const h = mount();
    h.tap('berry'); h.tap('s');
    await h.done();
    expect(judged).toHaveLength(0);
    expect(h.state().task!.evidence.correctness).toBe('incorrect');
    expect(screen.getByText(/ends in y/)).toBeTruthy();
    h.dispatch('retry');
    expect(screen.getByRole('button', { name: 'Take out berry' })).toBeTruthy();
    h.out('s'); h.tap('ies');
    expect(screen.getByRole('button', { name: 'Take out berry' }).querySelector('[data-dropped]')!.textContent).toBe('y');
    expect(h.facts()).toMatchObject({ row: 'berry + ies', partsPlaced: 2, endingsPlaced: 1 });
    verdicts.push(pass());
    await h.done();
    expect(judged[0]).toMatchObject({ action: 'judgeWordBuild', params: { ask: 'Make a word that means more than one.', made: 'berries', pieces: 'berry + ies', grade: 'Grade 2' } });
    expect(h.state().task!.evidence.correctness).toBe('correct');
  });

  it('two endings then one: workHistory records the turn back', async () => {
    // Changes within 1.5 s of a host action are the host's, not the learner's: step the clock past it.
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      const later = () => vi.setSystemTime(Date.now() + 2000);
      const h = mount();
      later();
      h.tap('cup'); h.tap('s'); h.tap('es');
      await h.done();
      expect(judged).toHaveLength(0);
      expect(screen.getByText(/two endings/)).toBeTruthy();
      h.dispatch('retry');
      later();
      h.out('es');
      expect(h.facts()).toMatchObject({ endingsPlaced: 1, workHistory: expect.stringContaining('endingsPlaced 0 → 2 → 1') });
    } finally { vi.useRealTimers(); }
  });

  it('a two-word item keeps the first word on screen, refuses it again in code, and commits the second', async () => {
    const h = mount();
    h.tap('cup'); h.tap('s'); verdicts.push(pass()); await h.done();
    h.next();
    expect(h.state().task!.task).toMatch(/already happened\. Then make a different word/);
    h.tap('wash'); h.tap('ed'); verdicts.push(pass()); await h.done();
    expect(h.state().task!.evidence.correctness).not.toBe('correct');
    expect(screen.getByTestId('wb-made').textContent).toContain('washed');
    expect(h.facts()).toMatchObject({ waysAsked: 2, waysMade: 1, madeBefore: 'washed', row: 'empty' });
    h.tap('wash'); h.tap('ed'); await h.done();
    expect(h.state().task!.evidence.correctness).toBe('incorrect');
    expect(judged).toHaveLength(2);
    h.dispatch('retry');
    h.out('wash'); h.out('ed'); h.tap('open'); h.tap('ed'); verdicts.push(pass()); await h.done();
    expect(judged[2].params.made).toBe('opened');
    expect(h.state().task!.evidence.correctness).toBe('correct');
  });

  it('a wrong ending opens the levers: the chart shows other words, fewer endings opens a smaller board', async () => {
    const h = mount();
    h.tap('box'); h.tap('s');
    await h.done();
    expect(h.state().task!.evidence.correctness).toBe('incorrect');
    expect(screen.getByText(/does not fit this word/)).toBeTruthy();
    const levers = h.state().task!.workspace!.levers ?? [];
    expect(levers.map(l => l.id)).toEqual(['word_frame', 'ending_chart', 'fewer_endings']);
    h.dispatch('pull_lever', { lever: 'ending_chart' });
    const chart = document.querySelector('[data-lever="ending-chart"]')!;
    expect(chart).not.toBeNull();
    for (const p of board.filter(x => x.type === 'root')) expect(chart.textContent).not.toMatch(new RegExp(`\\b${p.text}\\b`));
    h.dispatch('pull_lever', { lever: 'word_frame' });
    expect(document.querySelector('[data-lever="part-frame"]')!.textContent).toBe('word+ending');
    h.dispatch('pull_lever', { lever: 'fewer_endings' });
    expect(screen.getByText(/Practice on a smaller board/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add ed, ending' })).toBeNull();
    expect(screen.getAllByRole('button', { name: /^Add .*, ending$/ })).toHaveLength(2);
  });

  it('a judged miss names it; a judge that cannot be reached commits nothing', async () => {
    const h = mount();
    h.tap('wash'); h.tap('es');
    verdicts.push({ met: false, miss: 'wrong_meaning', realWord: 0.95, fits: 0.2, judge: 'jev+flash' });
    await h.done();
    expect(h.state().task!.evidence.correctness).toBe('incorrect');
    expect(screen.getByText(/does not mean what the ask says/)).toBeTruthy();
    h.dispatch('retry');
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500 })));
    h.out('es'); h.out('wash'); h.tap('bowl'); h.tap('s');
    await h.done();
    expect(screen.getByText(/could not look just now/)).toBeTruthy();
  });
});
