// @vitest-environment jsdom
/**
 * sentence-builder `build_sentence` (open build) on the real teaching workspace, with a real generation as the payload;
 * the tile-order modes stay off the workspace. The Live context, evaluation writes, sound and the judge's HTTP call
 * are substituted.
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
import SentenceBuilder, { type SentenceBuilderData } from './SentenceBuilder';
import payload from '../../../components/live-activity/runtime/testing/w1-payloads/sentence-builder.build_sentence.json';
import { getComponentById } from '../../../service/manifest/catalog';
import { validateSentenceBuilderData } from '../../../components/live-activity/adapters/sentenceBuilderLive';
import { workspaceBinding } from '../../../components/live-activity/lessonWorkspacePlan';
import { askableSentence, sentenceLevers, sentenceShapeMiss, sentenceText, sentencesFrom, type SentenceItem } from './sentenceBuild';

const data = (payload as unknown as { data: SentenceBuilderData }).data;
const items = sentencesFrom(data.sentences!);
const q: SentenceItem = { id: 'q', kind: 'question', about: 'the dog', ways: 1, bank: ['can', 'the', 'dog', 'run', 'is', 'big', '.', '?'],
  examples: [['can', 'the', 'dog', 'run', '?'], ['is', 'the', 'dog', 'big', '?']] };
const t: SentenceItem = { ...q, id: 't', kind: 'telling', examples: [['the', 'dog', 'is', 'big', '.'], ['the', 'dog', 'can', 'run', '.']] };

type Verdict = { met: boolean; miss?: string; realWord: number; fits: number; judge: string };
let verdicts: Verdict[] = [];
const judged: { action: string; params: Record<string, unknown> }[] = [];
beforeEach(() => {
  vi.clearAllMocks(); seam.evaluationContext = null; verdicts = []; judged.length = 0;
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init: { body: string }) => {
    judged.push(JSON.parse(init.body));
    return { ok: true, json: async () => verdicts.shift() };
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('build_sentence rules (pure)', () => {
  it('checks the end mark, where it is, the right one, length, and how each kind starts', () => {
    expect(sentenceShapeMiss(q, ['can', 'the', 'dog', 'run', '?'])).toBeUndefined();
    expect(sentenceShapeMiss(q, ['can', 'the', 'dog', 'run'])).toBe('no_end_mark');
    expect(sentenceShapeMiss(q, ['can', '?', 'dog', 'run', '?'])).toBe('end_mark_inside');
    expect(sentenceShapeMiss(q, ['can', 'the', 'dog', 'run', '.'])).toBe('wrong_end_mark');
    expect(sentenceShapeMiss(q, ['the', 'dog', 'can', 'run', '?'])).toBe('not_question_start');
    expect(sentenceShapeMiss(q, ['can', 'dog', '?'])).toBe('too_short');
    expect(sentenceShapeMiss(t, ['is', 'the', 'dog', 'big', '.'])).toBe('question_start');
    expect(sentenceShapeMiss(t, ['the', 'dog', 'is', 'big', '.'])).toBeUndefined();
    expect(sentenceShapeMiss(q, ['can', 'the', 'dog', 'run', '?'], ['can the dog run?'])).toBe('same_sentence');
    expect(sentenceText(['can', 'the', 'dog', 'run', '?'])).toBe('Can the dog run?');
  });

  it('an item ships with both end marks and 2+ good examples; the adapter binds only the build payload', () => {
    expect(askableSentence({ ...q, bank: q.bank.filter(x => x !== '.') })).toBeNull();
    expect(askableSentence({ ...q, examples: [q.examples[0]] })).toBeNull();
    expect(() => validateSentenceBuilderData(data)).not.toThrow();
    const tiles = { title: 'x', gradeLevel: '1', sentenceType: 'simple', challenges: [], roleColors: {} };
    expect(() => validateSentenceBuilderData(tiles)).toThrow();
    expect(workspaceBinding({ instanceId: 'w', primitiveId: 'sentence-builder', pin: 'simple', objectiveIds: ['o'], data: tiles })).toBeNull();
    expect(workspaceBinding({ instanceId: 'b', primitiveId: 'sentence-builder', pin: 'build_sentence', objectiveIds: ['o'], data })).not.toBeNull();
    const tw = getComponentById('sentence-builder')!.teachingWorkspace!;
    const answered = new Set(sentenceLevers(items[0], []).flatMap(l => l.answers ?? []));
    for (const m of tw.misses!.build_sentence) if (m !== 'same_sentence') expect(answered.has(m), m).toBe(true);
  });
});

describe('build_sentence on the workspace', () => {
  it('a missing end mark misses in code; Try again keeps the row; a good sentence is judged and passes', async () => {
    const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
    new RuntimeTransport(runtime, () => {});
    render(<LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
      <SentenceBuilder data={{ ...data, instanceId: 'sb' }} {...{ runtimePlanItemId: 'plan-sb', runtimeEvalMode: 'build_sentence' }} />
    </LiveRuntimeSurface></LiveRuntimeContext.Provider>);
    const item = items[0];
    const ex = item.examples[0];
    const tap = (tile: string) => act(() => { fireEvent.click(screen.getByRole('button', { name: `tile ${tile}` })); });
    for (const tile of ex.slice(0, -1)) tap(tile);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: "I'm done!" })); });
    expect(judged).toHaveLength(0);
    expect(runtime.getSnapshot().task!.evidence.correctness).toBe('incorrect');
    expect(screen.getByText(/needs an end mark/)).toBeTruthy();
    const s = runtime.getSnapshot();
    const retry = s.affordances.find(x => x.action.type === 'retry')!;
    act(() => { runtime.dispatch({ sessionEpoch: 'test', commandId: crypto.randomUUID(), instanceId: 'sb', itemId: s.task!.itemId,
      expectedRevision: s.revision, action: retry.action }); });
    expect((runtime.getSnapshot().task!.demand as Record<string, unknown>).tilesPlaced).toBe(ex.length - 1);
    tap(ex[ex.length - 1]);
    verdicts.push({ met: true, realWord: 0.98, fits: 0.95, judge: 'jev' });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: "I'm done!" })); });
    expect(judged[0].params).toMatchObject({ unit: 'sentence', made: sentenceText(ex) });
    expect(runtime.getSnapshot().task!.evidence.correctness).toBe('correct');
  });
});
