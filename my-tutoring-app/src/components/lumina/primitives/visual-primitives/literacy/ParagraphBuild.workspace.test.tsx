// @vitest-environment jsdom
/**
 * paragraph-architect `build_paragraph` (open build) on the real teaching workspace, with a real generation as the
 * payload; the writing modes stay off the workspace. The Live context, evaluation writes and sound are substituted.
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
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'pb',
  conversation: [], sendText: seam.send, sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} },
}) }));
vi.mock('../../../evaluation', () => ({ useEvaluationContext: () => seam.evaluationContext,
  usePrimitiveEvaluation: () => ({ hasSubmitted: false, submitResult: seam.submit, elapsedMs: 0 }) }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => () => true }) }));
import ParagraphArchitect, { type ParagraphArchitectData } from './ParagraphArchitect';
import payload from '../../../components/live-activity/runtime/testing/w1-payloads/paragraph-architect.build_paragraph.json';
import { getComponentById } from '../../../service/manifest/catalog';
import { validateParagraphArchitectData } from '../../../components/live-activity/adapters/paragraphArchitectLive';
import { workspaceBinding } from '../../../components/live-activity/lessonWorkspacePlan';
import {
  askableParagraph, boardOrder, fewerCardsFor, paragraphLevers, paragraphMiss, paragraphsFrom, type ParagraphItem,
} from './paragraphBuild';

const data = (payload as unknown as { data: ParagraphArchitectData }).data;
const items = paragraphsFrom(data.paragraphs!);
const idOf = (p: ParagraphItem, role: string, n = 0) => p.cards.filter(c => c.role === role)[n].id;
beforeEach(() => { vi.clearAllMocks(); seam.evaluationContext = null; });
afterEach(() => { cleanup(); });

describe('build_paragraph rules (pure)', () => {
  const p = items[0];
  it('topic first, 2+ belonging facts in any order, closing last; each miss named', () => {
    expect(paragraphMiss(p, [idOf(p, 'topic'), idOf(p, 'detail', 1), idOf(p, 'detail'), idOf(p, 'closing')])).toBeUndefined();
    expect(paragraphMiss(p, [idOf(p, 'topic'), idOf(p, 'detail'), idOf(p, 'detail', 1), idOf(p, 'detail', 2), idOf(p, 'closing')])).toBeUndefined();
    expect(paragraphMiss(p, [idOf(p, 'detail'), idOf(p, 'topic'), idOf(p, 'detail', 1), idOf(p, 'closing')])).toBe('topic_not_first');
    expect(paragraphMiss(p, [idOf(p, 'topic'), idOf(p, 'closing'), idOf(p, 'detail')])).toBe('closing_not_last');
    expect(paragraphMiss(p, [idOf(p, 'topic'), idOf(p, 'detail'), idOf(p, 'closing')])).toBe('too_few_details');
    expect(paragraphMiss(p, [idOf(p, 'topic'), idOf(p, 'detail'), idOf(p, 'off_topic'), idOf(p, 'closing')])).toBe('off_topic_detail');
  });

  it('a set needs one topic, one wrap-up closing, 3+ facts and 1-2 off-topic facts; the board never shows the frame', () => {
    expect(askableParagraph({ ...p, cards: p.cards.filter(c => c.role !== 'off_topic') })).toBeNull();
    expect(askableParagraph({ ...p, cards: p.cards.map(c => c.role === 'closing' ? { ...c, text: 'Dolphins are wonderful.' } : c) })).toBeNull();
    for (const item of items) {
      const b = boardOrder(item);
      expect(b[0].role === 'topic' && b[b.length - 1].role === 'closing').toBe(false);
      expect(boardOrder(item).map(c => c.id)).toEqual(b.map(c => c.id));
    }
    expect(fewerCardsFor(p)!.cards).toHaveLength(5);
  });

  it('binds only the build payload; levers answer every miss; the adapter refuses a writing-mode payload', () => {
    expect(() => validateParagraphArchitectData(data)).not.toThrow();
    const writing = { title: 'x', paragraphType: 'informational', gradeLevel: '2', topic: 'sharks', topicSentenceFrames: [],
      detailSentenceFrames: [], concludingSentenceFrames: [], linkingWords: [] };
    expect(() => validateParagraphArchitectData(writing)).toThrow();
    expect(workspaceBinding({ instanceId: 'w', primitiveId: 'paragraph-architect', pin: 'informational', objectiveIds: ['o'], data: writing })).toBeNull();
    expect(workspaceBinding({ instanceId: 'b', primitiveId: 'paragraph-architect', pin: 'build_paragraph', objectiveIds: ['o'], data })).not.toBeNull();
    const tw = getComponentById('paragraph-architect')!.teachingWorkspace!;
    const answered = new Set(paragraphLevers(p, []).flatMap(l => l.answers ?? []));
    for (const m of tw.misses!.build_paragraph) expect(answered.has(m), m).toBe(true);
  });
});

describe('build_paragraph on the workspace', () => {
  function mount() {
    const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
    new RuntimeTransport(runtime, () => {});
    render(<LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
      <ParagraphArchitect data={{ ...data, instanceId: 'pb' }} {...{ runtimePlanItemId: 'plan-pb', runtimeEvalMode: 'build_paragraph' }} />
    </LiveRuntimeSurface></LiveRuntimeContext.Provider>);
    const state = () => runtime.getSnapshot();
    const tap = (...ids: string[]) => { for (const id of ids) act(() => { fireEvent.click(screen.getByRole('button', { name: `card ${id}` })); }); };
    const done = () => act(() => { fireEvent.click(screen.getByRole('button', { name: "I'm done!" })); });
    const retry = () => {
      const s = state(); const a = s.affordances.find(x => x.action.type === 'retry')!;
      act(() => { runtime.dispatch({ sessionEpoch: 'test', commandId: crypto.randomUUID(), instanceId: 'pb', itemId: s.task!.itemId,
        expectedRevision: s.revision, action: a.action }); });
    };
    return { state, tap, done, retry };
  }

  it('binds the ask with no key; an off-topic fact misses; Try again keeps the paragraph; a good paragraph passes', () => {
    const h = mount(); const p = items[0];
    expect(h.state().task!.task).toContain(`Build a paragraph about ${p.topic}`);
    expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
    h.tap(idOf(p, 'topic'), idOf(p, 'detail'), idOf(p, 'off_topic'), idOf(p, 'closing'));
    expect((h.state().task!.demand as Record<string, unknown>).sentencesPlaced).toBe(4);
    h.done();
    expect(h.state().task!.evidence.correctness).toBe('incorrect');
    expect(screen.getByText(new RegExp(`Is every one about ${p.topic}`))).toBeTruthy();
    h.retry();
    expect(screen.getByRole('button', { name: `take out ${idOf(p, 'off_topic')}` })).toBeTruthy();
    act(() => { fireEvent.click(screen.getByRole('button', { name: `take out ${idOf(p, 'off_topic')}` })); });
    act(() => { fireEvent.click(screen.getByRole('button', { name: `take out ${idOf(p, 'closing')}` })); });
    h.tap(idOf(p, 'detail', 1), idOf(p, 'closing'));
    h.done();
    expect(h.state().task!.evidence.correctness).toBe('correct');
  });

  it('the writing modes still render their own component, unbound', () => {
    const writing = { title: 'Writing', paragraphType: 'informational', gradeLevel: '2', topic: 'sharks', topicSentenceFrames: ['___ are fish.'],
      detailSentenceFrames: ['First, ___.'], concludingSentenceFrames: ['In the end, ___.'], linkingWords: ['also'] } as ParagraphArchitectData;
    render(<ParagraphArchitect data={writing} />);
    expect(screen.queryByRole('group', { name: 'Your paragraph' })).toBeNull();
    expect(document.querySelector('[data-workspace-unbound]')).toBeNull();
  });
});
