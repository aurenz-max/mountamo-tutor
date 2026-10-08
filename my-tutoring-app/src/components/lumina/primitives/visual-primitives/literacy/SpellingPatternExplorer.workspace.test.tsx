// @vitest-environment jsdom
/**
 * spelling-pattern-explorer on the shared teaching workspace: the five classic modes (W1, one dictation word per item,
 * the spelling checked in code) and the open build `pattern_build` (the `pattern` ask on the shared letter build
 * surface). The real component, TeachingSession and LiveLessonRuntime; the Live context, evaluation writes, sound and
 * the word judge's HTTP call are substituted.
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
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'spe',
  conversation: [], sendText: seam.send, sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} },
}) }));
vi.mock('../../../evaluation', () => ({ useEvaluationContext: () => seam.evaluationContext,
  usePrimitiveEvaluation: () => ({ hasSubmitted: false, submittedResult: null, submitResult: seam.submit, elapsedMs: 0 }) }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => () => true }) }));
vi.mock('../../../components/PhaseSummaryPanel', () => ({ default: () => <div>summary</div> }));
import SpellingPatternExplorer, { type SpellingPatternExplorerData } from './SpellingPatternExplorer';
import buildPayload from '../../../components/live-activity/runtime/testing/w1-payloads/spelling-pattern-explorer.pattern_build.json';
import classicPayload from '../../../components/live-activity/runtime/testing/w1-payloads/spelling-pattern-explorer.long_vowel.json';
import { validateSpellingPatternExplorerData } from '../../../components/live-activity/adapters/spellingPatternExplorerLive';
import { getComponentById } from '../../../service/manifest/catalog';
import { spellingPatternExplorerOracle } from '../../../service/qa/oracles/spelling-pattern-explorer';
import {
  askableLetterItem, letterBuildLevers, letterItemsFrom, letterShapeMiss, rowReady, smallBankFor, startRow, type LetterBuildItem,
} from './letterBuild';
import { PATTERNS, makePatternItems, patternsNamed, sessionPatterns, type PatternId } from './spellingPatternBuild';
import { dictationItems, spellingMiss, spellingHarnessAnswers } from './spellingPatternExplorerWorkspace';

const build = (buildPayload as unknown as { data: SpellingPatternExplorerData }).data;
const classic = (classicPayload as unknown as { data: SpellingPatternExplorerData }).data;
const CLASSIC_MODES = ['short_vowel', 'long_vowel', 'r_controlled', 'silent_letter', 'morphological'];
const item = (pattern: PatternId, bank = 'aeiybcdklmnprstw'): LetterBuildItem =>
  ({ id: 'x', kind: 'pattern', pattern, ask: PATTERNS[pattern].ask, bank: bank.split(''), examples: PATTERNS[pattern].words.slice(0, 4), ways: 1 });
const miss = (pattern: PatternId, w: string, made: string[] = []) => letterShapeMiss(item(pattern), w.split(''), made) ?? null;

type Verdict = { met: boolean; miss?: string; realWord: number; fits: number; judge: string };
let verdicts: Verdict[] = [];
const judged: { action: string; params: Record<string, unknown> }[] = [];
const real = (): Verdict => ({ met: true, realWord: 0.97, fits: 1, judge: 'jev' });
beforeEach(() => {
  vi.clearAllMocks(); seam.evaluationContext = null; verdicts = []; judged.length = 0;
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init: { body: string }) => {
    judged.push(JSON.parse(init.body));
    return { ok: true, json: async () => verdicts.shift() };
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });

function mount(data: SpellingPatternExplorerData, mode: string) {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  new RuntimeTransport(runtime, () => {});
  render(<LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <SpellingPatternExplorer data={{ ...data, instanceId: 'spe' }} runtimePlanItemId="plan-spe" runtimeEvalMode={mode} />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>);
  const state = () => runtime.getSnapshot();
  let lastCommand = '';
  const dispatch = (name: string, input?: Record<string, unknown>) => {
    const s = state();
    const a = s.affordances.find(x => x.action.type === name || x.action.type === 'workspace' && (x.action as { operation?: string }).operation === name);
    expect(a, `missing action ${name}`).toBeTruthy();
    lastCommand = crypto.randomUUID();
    act(() => { runtime.dispatch({ sessionEpoch: 'test', commandId: lastCommand, instanceId: 'spe', itemId: s.task!.itemId,
      expectedRevision: s.revision, action: { ...a!.action, ...(input ? { input } : {}) } as never }); });
  };
  const press = (name: string | RegExp) => act(() => { fireEvent.click(screen.getByRole('button', { name })); });
  const spell = (w: string) => { for (const l of w) press(`letter ${l}`); };
  const done = async () => { await act(async () => { fireEvent.click(screen.getByRole('button', { name: "I'm done!" })); }); };
  const type = (label: string, text: string) => act(() => { fireEvent.change(screen.getByLabelText(label), { target: { value: text } }); });
  const next = () => { dispatch('advance'); act(() => { runtime.confirmVisibleResponse(lastCommand); }); };
  const demand = () => state().task!.demand as Record<string, unknown>;
  const last = () => state().task!.workspace!.attempts.at(-1);
  return { state, dispatch, press, spell, done, type, next, demand, last };
}

describe('pattern rules (pure)', () => {
  it('passes the asked spelling in its place; names the miss for another spelling, a wrong place, none, or a different sound', () => {
    expect(miss('ai', 'rain')).toBeNull();
    expect(miss('ai', 'cake')).toBe('other_spelling');
    expect(miss('ai', 'play')).toBe('other_spelling');
    expect(miss('ai', 'rian')).toBe('wrong_place');
    expect(miss('ai', 'ran')).toBe('no_pattern');
    expect(miss('a_e', 'cake')).toBeNull();
    expect(miss('a_e', 'caek')).toBe('wrong_place');
    expect(miss('kn', 'knot')).toBeNull();
    expect(miss('kn', 'not')).toBe('other_spelling');
    expect(miss('kn', 'sink')).toBe('wrong_place');
    expect(miss('mb', 'lamb')).toBeNull();
    expect(miss('ar', 'crab')).toBe('wrong_place');
  });

  it('the letters without the sound: said, hair, have, warm, eight, bread miss not_the_sound; were and height do not', () => {
    for (const [p, w] of [['ai', 'said'], ['ai', 'hair'], ['a_e', 'have'], ['a_e', 'care'], ['ar', 'warm'], ['ar', 'scary'],
      ['igh', 'eight'], ['ea', 'bread'], ['o_e', 'come'], ['o_e', 'more'], ['ir', 'fire'], ['ur', 'pure']] as [PatternId, string][])
      expect(miss(p, w), `${p} ${w}`).toBe('not_the_sound');
    expect(miss('er', 'were')).toBeNull();
    expect(miss('igh', 'height')).toBeNull();
    expect(miss('ur', 'purr')).toBeNull();
  });

  it('a repeat is same_word; the row is ready once letters are packed from the left', () => {
    expect(miss('ai', 'rain', ['rain'])).toBe('same_word');
    const it6 = item('ai');
    // paint (5 letters) is the longest example: one box more.
    expect(startRow(it6)).toEqual(['', '', '', '', '', '']);
    expect(rowReady(it6, ['r', 'a', 'i', 'n', '', ''])).toBe(true);
    expect(rowReady(it6, ['r', '', 'i', 'n', '', ''])).toBe(false);
    expect(rowReady(it6, ['r', '', '', '', '', ''])).toBe(false);
  });

  it('every pattern\'s seed sessions: 3+ answers from the bank, no answer in the ask, small banks smaller, oracle clean', () => {
    for (let n = 0; n < 15; n++) for (const p of Object.keys(PATTERNS) as PatternId[]) {
      const items = makePatternItems([p], 1);
      expect(items, p).toHaveLength(1);
      const it1 = askableLetterItem(items[0])!;
      expect(it1, items[0].ask).not.toBeNull();
      expect(it1.examples.length, p).toBeGreaterThanOrEqual(3);
      expect(it1.bank.length, p).toBeLessThanOrEqual(14);
      expect(smallBankFor(it1)!.bank.length, p).toBeLessThan(it1.bank.length);
    }
    for (const g of ['1', '2', '3', '5']) {
      const data = { title: 't', task: 'letter_build', buildItems: makePatternItems(sessionPatterns([], g), 4) };
      expect(spellingPatternExplorerOracle.verify(data, { componentId: 'spelling-pattern-explorer', evalMode: 'pattern_build', topic: '', gradeLevel: g }).violations).toEqual([]);
    }
  });

  it('reads the objective: a named spelling first, then a sound, then a family', () => {
    expect(patternsNamed('Spell words with long a spelled ai')).toEqual(['ai']);
    expect(sessionPatterns(['ai'], '2')[0]).toBe('ai');
    expect(patternsNamed('Spell words with ar, or, ir and ur').sort()).toEqual(['ar', 'ir', 'or', 'ur']);
    expect(patternsNamed('Long o vowel teams').sort()).toEqual(['o_e', 'oa']);
    expect(patternsNamed('Silent e words')).toEqual(['a_e', 'i_e', 'o_e']);
    expect(patternsNamed('Read words or sentences')).toEqual([]);
  });

  it('the adapter accepts both generations; the catalog names every build miss and a lever answers each one not declared', () => {
    expect(() => validateSpellingPatternExplorerData(build)).not.toThrow();
    expect(() => validateSpellingPatternExplorerData(classic)).not.toThrow();
    const tw = getComponentById('spelling-pattern-explorer')!.teachingWorkspace!;
    const answered = new Set(letterItemsFrom(build.buildItems!).flatMap(i => letterBuildLevers(i, []).flatMap(l => l.answers ?? [])));
    for (const m of tw.misses!.pattern_build) if (!tw.unanswered!.pattern_build.includes(m)) expect(answered.has(m), m).toBe(true);
    const mode = getComponentById('spelling-pattern-explorer')!.evalModes!.find(m => m.evalMode === 'pattern_build')!;
    expect(mode.affordances).toEqual({ answers: ['build'] });
    expect(mode.beta).toBeCloseTo(2.6);
  });
});

describe('pattern_build on the workspace', () => {
  it('opens empty with the ask as a gesture and no key; done waits for two letters', () => {
    const h = mount(build, 'pattern_build');
    const first = letterItemsFrom(build.buildItems!)[0];
    expect(h.state().task!.task).toContain(first.ask);
    expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
    expect(h.demand()).toMatchObject({ lettersPlaced: 0 });
    expect((screen.getByRole('button', { name: "I'm done!" }) as HTMLButtonElement).disabled).toBe(true);
    for (const w of first.examples) expect(document.body.textContent).not.toContain(w);
  });

  it('another spelling misses in code with no judge call; Try again keeps the letters; the history records the fix; a real word passes', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const ai: LetterBuildItem = { id: 'p1', kind: 'pattern', pattern: 'ai', ask: PATTERNS.ai.ask, bank: 'aeiylnprt'.split(''), examples: ['rain', 'tail', 'pail'], ways: 1 };
    const h = mount({ ...build, buildItems: [ai, { ...ai, id: 'p2' }, { ...ai, id: 'p3' }] }, 'pattern_build');
    vi.setSystemTime(Date.now() + 2000);
    h.spell('play');
    await h.done();
    expect(judged).toHaveLength(0);
    expect(h.last()).toMatchObject({ correct: false, miss: 'other_spelling', response: 'Built "play"' });
    expect(screen.getByText(/Your word uses ay, not ai/)).toBeTruthy();
    h.dispatch('retry');
    expect(h.demand()).toMatchObject({ boxes: 'p l a y _', lettersPlaced: 4 });
    vi.setSystemTime(Date.now() + 2000);
    h.press('Start over');
    vi.setSystemTime(Date.now() + 2000);
    h.spell('pail');
    expect(h.demand()).toMatchObject({ lettersPlaced: 4, workHistory: expect.stringContaining('lettersPlaced') });
    verdicts.push(real());
    await h.done();
    expect(judged[0]).toMatchObject({ action: 'judgeWordBuild', params: { made: 'pail', only: 'real_word' } });
    expect(h.last()).toMatchObject({ correct: true });
  });

  it('said holds ai without the long a sound: not_the_sound in code, before any judge', async () => {
    const ai: LetterBuildItem = { id: 'p1', kind: 'pattern', pattern: 'ai', ask: PATTERNS.ai.ask, bank: 'adilnrst'.split(''), examples: ['rain', 'tail', 'nail'], ways: 1 };
    const h = mount({ ...build, buildItems: [ai, { ...ai, id: 'p2' }, { ...ai, id: 'p3' }] }, 'pattern_build');
    h.spell('said');
    await h.done();
    expect(judged).toHaveLength(0);
    expect(h.last()).toMatchObject({ correct: false, miss: 'not_the_sound' });
    expect(screen.getByText(/does not make the long a/)).toBeTruthy();
  });

  it('a second-word item keeps the first, refuses it again, commits the second; a new item opens empty', async () => {
    const h = mount(build, 'pattern_build');
    const items = letterItemsFrom(build.buildItems!);
    expect(items[1].ways).toBe(2);
    const [a] = items[0].examples;
    h.spell(a); verdicts.push(real()); await h.done();
    h.next();
    expect(h.state().task!.task).toMatch(/Then make a different one/);
    expect(h.demand()).toMatchObject({ lettersPlaced: 0 });
    const [w1, w2] = items[1].examples;
    h.spell(w1); verdicts.push(real()); await h.done();
    expect(h.state().task!.evidence.correctness).not.toBe('correct');
    expect(screen.getByTestId('lb-made').textContent).toContain(w1);
    h.spell(w1); await h.done();
    expect(h.last()).toMatchObject({ correct: false, miss: 'same_word' });
    h.dispatch('retry');
    h.press('Start over');
    h.spell(w2); verdicts.push(real()); await h.done();
    expect(h.last()).toMatchObject({ correct: true });
  });

  it('levers start bare; the pattern card shows the spelling and its sound; the small bank opens an ungraded practice', async () => {
    const h = mount(build, 'pattern_build');
    expect(document.querySelector('[data-lever]')).toBeNull();
    const first = letterItemsFrom(build.buildItems!)[0];
    h.dispatch('pull_lever', { lever: 'pattern_card' });
    expect(document.querySelector('[data-lever="pattern-card"]')!.textContent).toBe(PATTERNS[first.pattern!].card);
    h.dispatch('pull_lever', { lever: 'small_bank' });
    expect(screen.getByText('Practice with fewer letters')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /^letter / }).length).toBeLessThan(first.bank.length);
  });
});

describe('classic modes on the workspace', () => {
  it.each(CLASSIC_MODES)('%s binds each dictation word as a gesture item with no key', mode => {
    const h = mount(classic, mode);
    const items = dictationItems(classic.dictationWords, classic.dictationHints);
    expect(h.state().task!.itemId).toBe(items[0].id);
    expect(h.state().task!.task).toContain(`"${items[0].word}"`);
    expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
    expect(h.demand()).toMatchObject({ phase: 'observe' });
  });

  it('look, write the rule, then a wrong spelling misses with a name; Try again keeps the typing; the right one moves on', () => {
    const h = mount(classic, 'long_vowel');
    const items = dictationItems(classic.dictationWords, classic.dictationHints);
    h.press(/I see the pattern/);
    expect(h.demand()).toMatchObject({ phase: 'rule' });
    h.type('Your spelling rule', 'The words share ai.');
    h.press(/Next: Apply the Rule/);
    expect(h.demand()).toMatchObject({ phase: 'apply', lettersTyped: 0 });
    const answers = spellingHarnessAnswers(items[0], classic.highlightPattern);
    h.type('Your spelling', answers.plainWrong);
    h.press('Check spelling');
    expect(h.last()).toMatchObject({ correct: false, miss: spellingMiss(items[0], answers.plainWrong, classic.highlightPattern) });
    expect(document.body.textContent).not.toContain(`"${items[0].word}"`);
    h.dispatch('retry');
    expect((screen.getByLabelText('Your spelling') as HTMLInputElement).value).toBe(answers.plainWrong);
    h.type('Your spelling', answers.correct);
    h.press('Check spelling');
    expect(h.last()).toMatchObject({ correct: true });
    h.next();
    expect(h.state().task!.itemId).toBe(items[1].id);
    expect((screen.getByLabelText('Your spelling') as HTMLInputElement).value).toBe('');
  });

  it('outside a live runtime the scripted flow is unchanged (all words at once, Review, Submit)', () => {
    render(<SpellingPatternExplorer data={{ ...classic, instanceId: 'spe' }} />);
    fireEvent.click(screen.getByRole('button', { name: /I see the pattern/ }));
    fireEvent.change(screen.getByLabelText('Your spelling rule'), { target: { value: 'A rule I found.' } });
    fireEvent.click(screen.getByRole('button', { name: /Next: Apply the Rule/ }));
    expect(screen.getAllByPlaceholderText('Type the word...')).toHaveLength(classic.dictationWords.length);
    expect(screen.queryByRole('button', { name: 'Check spelling' })).toBeNull();
  });
});
