// @vitest-environment jsdom
/**
 * figurative-language-finder on the real teaching workspace (OB-7L): find, meaning and make steps, with real
 * generations as payloads. The Live context, evaluation writes, sound and the judge's HTTP call are substituted.
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
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'fig',
  conversation: [], sendText: seam.send, sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} },
}) }));
vi.mock('../../../evaluation', () => ({ useEvaluationContext: () => seam.evaluationContext,
  usePrimitiveEvaluation: () => ({ hasSubmitted: false, submitResult: seam.submit, elapsedMs: 0 }) }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => () => true }) }));
import FigurativeLanguageFinder, { type FigurativeLanguageFinderData } from './FigurativeLanguageFinder';
import comparisonPayload from '../../../components/live-activity/runtime/testing/w1-payloads/figurative-language-finder.comparison.json';
import idiomPayload from '../../../components/live-activity/runtime/testing/w1-payloads/figurative-language-finder.idiom.json';
import buildPayload from '../../../components/live-activity/runtime/testing/w1-payloads/figurative-language-finder.build_figurative.json';
import { getComponentById } from '../../../service/manifest/catalog';
import { workspaceBinding } from '../../../components/live-activity/lessonWorkspacePlan';
import { figItems, figLevers, findVerdict, sentenceOf, sentencesOf, typeChoices, writtenJudgeRequest, writtenShapeMiss } from './figurativeSteps';

const comparison = (comparisonPayload as unknown as { data: FigurativeLanguageFinderData }).data;
const idiom = (idiomPayload as unknown as { data: FigurativeLanguageFinderData }).data;
const build = (buildPayload as unknown as { data: FigurativeLanguageFinderData }).data;
const MODES: [string, FigurativeLanguageFinderData][] = [['comparison', comparison], ['idiom', idiom], ['build_figurative', build]];
const sentences = sentencesOf(comparison.passage);
const at = (text: string) => sentenceOf(sentences, text);
let verdicts: { met: boolean; miss?: string; realWord: number; fits: number; judge: string }[] = [];
const judged: { params: Record<string, unknown> }[] = [];
beforeEach(() => {
  vi.clearAllMocks(); seam.evaluationContext = null; verdicts = []; judged.length = 0;
  vi.stubGlobal('fetch', vi.fn(async (_u: string, init: { body: string }) => { judged.push(JSON.parse(init.body)); return { ok: true, json: async () => verdicts.shift() }; }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('figurative rules (pure)', () => {
  const [metaphor, simile] = [comparison.instances.find(i => i.type === 'metaphor')!, comparison.instances.find(i => i.type === 'simile')!];
  it('a tagged figure passes in code once; another kind in a tagged sentence is wrong_type; an untagged sentence goes to the judge', () => {
    const pass = findVerdict(comparison, [], at(simile.text), 'simile');
    expect(pass).toMatchObject({ pass: { key: simile.instanceId } });
    expect(findVerdict(comparison, [(pass as { pass: never }).pass], at(simile.text), 'simile')).toEqual({ miss: 'already_found' });
    expect(findVerdict(comparison, [], at(simile.text), 'metaphor')).toEqual({ miss: 'wrong_type' });
    const plain = sentences.findIndex((_, n) => !comparison.instances.some(i => at(i.text) === n));
    expect(findVerdict(comparison, [], plain, 'simile')).toBe('judge');
    expect(at(metaphor.text)).toBeGreaterThanOrEqual(0);
  });

  it('an idiom meaning carries no key (its stored meaning is word for word); a copied phrase is unchanged; the menu has 3+ kinds', () => {
    const meaning = figItems(idiom).find(i => i.kind === 'meaning')!;
    expect(meaning.kind === 'meaning' && meaning.key).toBeFalsy();
    expect(String(writtenJudgeRequest(meaning, 'It was raining very hard.', idiom.passage).ask).length).toBeLessThanOrEqual(300);
    expect(writtenShapeMiss(meaning, `It means ${meaning.kind === 'meaning' ? meaning.phrase : ''} I think`)).toBe('unchanged');
    expect(typeChoices(idiom).length).toBeGreaterThanOrEqual(3);
    for (const i of figItems(comparison)) if (i.kind === 'meaning') expect(i.key).toBeTruthy();
  });

  it('every mode binds; every named miss is answered by a lever or declared unanswered', () => {
    const tw = getComponentById('figurative-language-finder')!.teachingWorkspace!;
    for (const [mode, data] of MODES) {
      expect(workspaceBinding({ instanceId: mode, primitiveId: 'figurative-language-finder', pin: mode, objectiveIds: ['o'], data }), mode).not.toBeNull();
      const answered = new Set(figItems(data).flatMap(i => figLevers(i, [])).flatMap(l => l.answers ?? []));
      const unanswered = new Set(tw.unanswered?.[mode] ?? []);
      for (const m of tw.misses![mode]) expect(answered.has(m) || unanswered.has(m), `${mode} ${m}`).toBe(true);
    }
  });
});

function mount(data: FigurativeLanguageFinderData, mode: string) {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  new RuntimeTransport(runtime, () => {});
  render(<LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <FigurativeLanguageFinder data={{ ...data, instanceId: 'fig' }} runtimePlanItemId="plan-fig" runtimeEvalMode={mode} />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>);
  const state = () => runtime.getSnapshot();
  const retry = () => {
    const s = state(); const a = s.affordances.find(x => x.action.type === 'retry')!;
    act(() => { runtime.dispatch({ sessionEpoch: 'test', commandId: crypto.randomUUID(), instanceId: 'fig', itemId: s.task!.itemId, expectedRevision: s.revision, action: a.action }); });
  };
  return { state, retry };
}
const tap = (name: string) => act(() => { fireEvent.click(screen.getByRole('button', { name })); });
const done = async () => { await act(async () => { fireEvent.click(screen.getByRole('button', { name: "I'm done!" })); }); };
const type = (v: string) => act(() => { fireEvent.change(screen.getByRole('textbox', { name: 'Your sentence' }), { target: { value: v } }); });

describe('figurative-language-finder on the workspace', () => {
  it('find: nothing is marked at the start; a wrong kind misses in code; the right kind passes and is marked', async () => {
    const h = mount(comparison, 'comparison');
    const simile = comparison.instances.find(i => i.type === 'simile')!;
    expect(document.querySelector('[data-testid="fig-passage"] .underline')).toBeNull();
    tap(`sentence ${at(simile.text) + 1}`); tap('kind metaphor');
    await done();
    expect(judged).toHaveLength(0);
    expect(h.state().task!.evidence.correctness).toBe('incorrect');
    expect(screen.getByText(/not that kind/)).toBeTruthy();
    h.retry();
    tap('kind simile');
    await done();
    expect(h.state().task!.evidence.correctness).toBe('correct');
    expect(document.querySelector('[data-testid="fig-passage"] .underline')?.textContent).toBe(simile.text.trim());
  });

  it('find: an untagged sentence is judged, strictly', async () => {
    const h = mount(comparison, 'comparison');
    const plain = sentences.findIndex((_, n) => !comparison.instances.some(i => at(i.text) === n));
    tap(`sentence ${plain + 1}`); tap('kind simile');
    verdicts.push({ met: false, miss: 'wrong_meaning', realWord: 0.99, fits: 0.1, judge: 'jev+flash' });
    await done();
    expect(judged[0].params).toMatchObject({ unit: 'writing', strict: true });
    expect(h.state().task!.evidence.correctness).toBe('incorrect');
  });

  it('make: a judged simile passes', async () => {
    const h = mount(build, 'build_figurative');
    expect(h.state().task!.task).toMatch(/simile about/);
    type('The storm clouds were as dark as ink.');
    verdicts.push({ met: true, realWord: 0.99, fits: 0.95, judge: 'jev' });
    await done();
    expect(judged[0].params).toMatchObject({ unit: 'writing', strict: true });
    expect(h.state().task!.evidence.correctness).toBe('correct');
  });
});
