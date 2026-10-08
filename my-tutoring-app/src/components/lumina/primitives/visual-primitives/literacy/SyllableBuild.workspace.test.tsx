// @vitest-environment jsdom
/**
 * syllable-clapper `build_parts` (the syllables kind of the shared letter build) on the real teaching workspace, with a
 * real generation as the payload. The Live context, evaluation writes, sound and the judge's HTTP call are substituted;
 * the part count is checked by the real code.
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
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'sb',
  conversation: [], sendText: seam.send, sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} },
}) }));
vi.mock('../../../evaluation', () => ({ useEvaluationContext: () => seam.evaluationContext,
  usePrimitiveEvaluation: () => ({ hasSubmitted: false, submitResult: seam.submit, elapsedMs: 0 }) }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => () => true }) }));
import SyllableClapper, { type SyllableClapperData } from './SyllableClapper';
import payload from '../../../components/live-activity/runtime/testing/w1-payloads/syllable-clapper.build_parts.json';
import { validateSyllableClapperData } from '../../../components/live-activity/adapters/syllableClapperLive';
import { getComponentById } from '../../../service/manifest/catalog';
import { askableLetterItem, letterBuildLevers, letterItemsFrom, letterShapeMiss, smallBankFor, startRow, type LetterBuildItem } from './letterBuild';
import { beatsIn, makeSyllableItems, partsTogether, seedWordsFrom, syllableModelFor } from './syllableBuild';
import { SYLLABLE_WORDS } from './syllableBuildWords';
import { endsWithSilentESyllable, hasStableSyllableCount } from './syllableClapperScript';
import { syllableClapperOracle } from '../../../service/qa/oracles/syllable-clapper';

const data = (payload as unknown as { data: SyllableClapperData }).data;
const three: LetterBuildItem = { id: 't', kind: 'syllables', parts: 3, ask: 'Make a word with three parts.', ways: 1,
  bank: ['ba', 'ter', 'pop', 'na', 'fly', 'corn', 'but'], examples: ['banana', 'butterfly'] };

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
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('syllable build rules (pure)', () => {
  it('every seed word claps the same everywhere, spells itself, comes out at its own count, and has no silent-e card', () => {
    for (const [word, parts] of Object.entries(SYLLABLE_WORDS)) {
      expect(parts.join(''), word).toBe(word);
      expect(hasStableSyllableCount(word), word).toBe(true);
      expect(endsWithSilentESyllable([...parts]), word).toBe(false);
      expect(beatsIn(parts), word).toBe(parts.length);
      for (const c of parts) expect(/^[^aeiou]e$/.test(c), `${word}: ${c}`).toBe(false);
    }
  });

  it('counts parts in code: one under, one over, letters counted, cards that run into one beat, a repeat', () => {
    expect(letterShapeMiss(three, ['ba', 'na', 'na'])).toBeUndefined();
    expect(letterShapeMiss(three, ['pop', 'corn'])).toBe('too_few_parts');
    expect(letterShapeMiss(three, ['but', 'ter', 'fly', 'na'])).toBe('too_many_parts');
    expect(letterShapeMiss(three, ['pop'])).toBe('counted_letters');
    expect(letterShapeMiss({ ...three, parts: 2 }, ['to', 'o'])).toBe('too_few_parts');
    expect(letterShapeMiss(three, ['ba', 'na', 'na'], ['banana'])).toBe('same_word');
    expect(startRow(three)).toEqual([]);
  });

  it('drops an ask that does not name its count, names a passing word, or lays a word out in the bank', () => {
    expect(askableLetterItem(three)!.examples).toEqual(['banana', 'butterfly']);
    expect(askableLetterItem({ ...three, ask: 'Make a word with parts.' })).toBeNull();
    expect(askableLetterItem({ ...three, ask: 'Make a word with three parts, like banana.' })).toBeNull();
    expect(askableLetterItem({ ...three, bank: ['but', 'ter', 'fly', 'ba', 'na', 'pop', 'corn'] })).toBeNull();
  });

  it('code-owned sessions vary the count, keep K to two and three parts, and never lay a word out', () => {
    for (let n = 0; n < 200; n++) {
      for (const grade of ['K', '1']) {
        const items = makeSyllableItems(grade, 4);
        expect(items).toHaveLength(4);
        const counts = items.map(i => i.parts!);
        expect(new Set(counts).size).toBeGreaterThan(1);
        counts.forEach((c, i) => { if (i) expect(c).not.toBe(counts[i - 1]); });
        if (grade === 'K') expect(Math.max(...counts)).toBeLessThanOrEqual(3);
        for (const item of items) {
          expect(askableLetterItem(item), item.bank.join(' ')).not.toBeNull();
          expect(partsTogether(item.bank, seedWordsFrom(item.bank))).toBe(false);
        }
        const oracle = syllableClapperOracle.verify({ task: 'letter_build', buildItems: items },
          { componentId: 'syllable-clapper', evalMode: 'build_parts', topic: '', gradeLevel: grade, grade });
        expect(oracle.violations).toEqual([]);
      }
    }
  });

  it('simplify is two parts from a smaller bank; the model shares no card and has another count', () => {
    const small = smallBankFor(three)!;
    expect(small.parts).toBe(2);
    expect(small.bank.length).toBeLessThan(three.bank.length);
    expect(askableLetterItem({ ...small, id: 'x' })).not.toBeNull();
    const model = syllableModelFor(three)!;
    expect(model.cards.length).not.toBe(3);
    expect(model.cards.some(c => three.bank.includes(c))).toBe(false);
  });

  it('the live adapter accepts the generation; the catalog prices the mode beside count_parts and a lever answers each named miss', () => {
    expect(() => validateSyllableClapperData(data)).not.toThrow();
    const entry = getComponentById('syllable-clapper')!;
    const mode = entry.evalModes!.find(m => m.evalMode === 'build_parts')!;
    const count = entry.evalModes!.find(m => m.evalMode === 'count_parts')!;
    expect(mode.beta - count.beta).toBeCloseTo(0.1);
    expect(mode.affordances).toEqual({ answers: ['build'] });
    const tw = entry.teachingWorkspace!;
    const answered = new Set(letterItemsFrom(data.buildItems!).flatMap(i => letterBuildLevers(i, []).flatMap(l => l.answers ?? [])));
    for (const m of tw.misses!.build_parts) if (!tw.unanswered!.build_parts.includes(m)) expect(answered.has(m), m).toBe(true);
    expect(tw.guidance!.length).toBeLessThanOrEqual(2000);
  });
});

function mount(d: SyllableClapperData) {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  new RuntimeTransport(runtime, () => {});
  render(<LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <SyllableClapper data={{ ...d, instanceId: 'sb' }} runtimePlanItemId="plan-sb" runtimeEvalMode="build_parts" />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>);
  const state = () => runtime.getSnapshot();
  let lastCommand = '';
  const dispatch = (name: string, input?: Record<string, unknown>) => {
    const s = state();
    const a = s.affordances.find(x => x.action.type === name || x.action.type === 'workspace' && (x.action as { operation?: string }).operation === name);
    expect(a, `missing action ${name}`).toBeTruthy();
    lastCommand = crypto.randomUUID();
    act(() => { runtime.dispatch({ sessionEpoch: 'test', commandId: lastCommand, instanceId: 'sb', itemId: s.task!.itemId,
      expectedRevision: s.revision, action: { ...a!.action, ...(input ? { input } : {}) } as never }); });
  };
  const cards = (...cs: string[]) => { for (const c of cs) act(() => { fireEvent.click(screen.getByRole('button', { name: `card ${c}` })); }); };
  const takeOut = (n: number) => act(() => { fireEvent.click(screen.getByRole('button', { name: new RegExp(`^box ${n},`) })); });
  const done = async () => { await act(async () => { fireEvent.click(screen.getByRole('button', { name: "I'm done!" })); }); };
  const next = () => { dispatch('advance'); act(() => { runtime.confirmVisibleResponse(lastCommand); }); };
  const demand = () => state().task!.demand as Record<string, unknown>;
  /** Past the window in which a screen change counts as the host's, not the learner's. */
  const later = () => { const t = Date.now() + 2000; vi.spyOn(Date, 'now').mockReturnValue(t); };
  return { state, dispatch, cards, takeOut, done, next, demand, later };
}

describe('build_parts on the workspace', () => {
  const items = letterItemsFrom(data.buildItems!, data.supportTier);
  const first = items[0];
  const split = (w: string) => [...SYLLABLE_WORDS[w]];

  it('opens empty with the count in the task and no key; done waits for a card; the scene publishes partsPlaced', () => {
    const h = mount(data);
    expect(h.state().task!.task).toBe(first.ask);
    expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
    expect(h.demand()).toMatchObject({ partsPlaced: 0, learnersWord: 'no cards yet' });
    expect((screen.getByRole('button', { name: "I'm done!" }) as HTMLButtonElement).disabled).toBe(true);
    // No clap marks or counts until a lever is pulled.
    expect(document.querySelector('[data-lever="clap-cards"]')).toBeNull();
  });

  it('a card is heard on request, never as a learner turn; so is the made word', () => {
    const h = mount(data);
    const card = first.bank[0];
    act(() => { fireEvent.click(screen.getByRole('button', { name: `hear ${card}` })); });
    expect(seam.send).toHaveBeenLastCalledWith(expect.stringContaining(`"${card}"`), { silent: true, author: 'host' });
    h.cards(card);
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Hear my word' })); });
    expect(seam.send).toHaveBeenLastCalledWith(expect.stringContaining(`"${card}"`), { silent: true, author: 'host' });
  });

  it('too few parts misses in code with no judge call; Try again keeps the cards; the right count goes to the judge and passes', async () => {
    const h = mount(data);
    const word = first.examples[0];
    const parts = split(word);
    h.later();
    h.cards(parts[0]);
    await h.done();
    expect(judged).toHaveLength(0);
    expect(h.state().task!.evidence.correctness).toBe('incorrect');
    expect(screen.getByText(/Does it have/)).toBeTruthy();
    h.dispatch('retry');
    expect(h.demand()).toMatchObject({ partsPlaced: 1 });
    h.later();
    h.cards(...parts.slice(1), parts[0]);
    expect(h.demand()).toMatchObject({ partsPlaced: parts.length + 1 });
    h.takeOut(parts.length + 1);
    expect(h.demand()).toMatchObject({ partsPlaced: parts.length, workHistory: expect.stringContaining(`partsPlaced 0 → ${parts.length + 1} → ${parts.length}`) });
    verdicts.push(real());
    await h.done();
    expect(judged[0]).toMatchObject({ action: 'judgeWordBuild', params: { made: word, only: 'real_word' } });
    expect(h.state().task!.evidence.correctness).toBe('correct');
  });

  it('real parts that make no word are not_a_word; the clap lever puts a clap under each card; simplify opens two parts', async () => {
    const h = mount(data);
    const [a, b] = first.examples.map(split);
    const made = [a[0], b[1], ...a.slice(2)].slice(0, first.parts);
    while (made.length < first.parts!) made.push(b[0]);
    h.cards(...made);
    verdicts.push({ met: false, miss: 'not_a_word', realWord: 0.1, fits: 1, judge: 'jev+flash' });
    await h.done();
    expect(h.state().task!.evidence.correctness).toBe('incorrect');
    expect(screen.getByText(/not a word we use/)).toBeTruthy();
    h.dispatch('pull_lever', { lever: 'clap_cards' });
    expect(document.querySelectorAll('[data-lever="clap-cards"]')).toHaveLength(made.length);
    h.dispatch('pull_lever', { lever: 'small_bank' });
    expect(h.demand()).toMatchObject({ ask: 'Make a word with two parts.', partsPlaced: 0 });
  });

  it('an item asking for two words keeps the first and refuses the same word again', async () => {
    const h = mount(data);
    const one = first.examples[0];
    h.cards(...split(one)); verdicts.push(real()); await h.done();
    h.next();
    const second = items[1];
    expect(second.ways).toBe(2);
    expect(h.state().task!.task).toMatch(/Then make a different one/);
    const w = second.examples[0];
    h.cards(...split(w)); verdicts.push(real()); await h.done();
    expect(h.state().task!.evidence.correctness).not.toBe('correct');
    expect(screen.getByTestId('lb-made').textContent).toContain(w);
    h.cards(...split(w)); await h.done();
    expect(h.state().task!.evidence.correctness).toBe('incorrect');
    expect(screen.getByText(/already made that word/)).toBeTruthy();
    h.dispatch('retry');
    for (let i = split(w).length; i >= 1; i--) h.takeOut(i);
    const other = second.examples[1];
    h.cards(...split(other)); verdicts.push(real()); await h.done();
    expect(judged.at(-1)!.params.made).toBe(other);
    expect(h.state().task!.evidence.correctness).toBe('correct');
  });
});
