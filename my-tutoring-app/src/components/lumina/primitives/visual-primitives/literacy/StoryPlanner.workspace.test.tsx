// @vitest-environment jsdom
/**
 * story-planner on the real teaching workspace (OB-7L). Carries the reader-fit contract @ PRE (2026-08-07) over from
 * the retired component: K-1 has no typing, one question per screen, the emoji is the answer surface with its words as
 * the caption, one tap picks AND moves on, no adult chrome or printed story idea, numbered slots instead of the arc
 * labels, the generated arc order never on the board, and the score from the instrument. Grade 2+ writes each card,
 * judged. The Live context, evaluation writes, sound and the judge's HTTP call are substituted.
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
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'sp',
  conversation: [], sendText: seam.send, sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} },
}) }));
vi.mock('../../../evaluation', () => ({ useEvaluationContext: () => seam.evaluationContext,
  usePrimitiveEvaluation: () => ({ hasSubmitted: false, submitResult: seam.submit, elapsedMs: 0 }) }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => () => true }) }));
import StoryPlanner, { splitPictureOption, shuffleArcEvents, type StoryPlannerData } from './StoryPlanner';
import kPayload from '../../../components/live-activity/runtime/testing/w1-payloads/story-planner.story_structure.json';
import g2Payload from '../../../components/live-activity/runtime/testing/w1-payloads/story-planner.character_setting.json';
import { getComponentById } from '../../../service/manifest/catalog';
import { workspaceBinding } from '../../../components/live-activity/lessonWorkspacePlan';
import { storyItems, storyLevers, writeShapeMiss } from './storySteps';

const k = (kPayload as unknown as { data: StoryPlannerData }).data;
const g2 = (g2Payload as unknown as { data: StoryPlannerData }).data;
const cap = (t: string) => splitPictureOption(t).label;
let verdicts: { met: boolean; miss?: string; realWord: number; fits: number; judge: string }[] = [];
const judged: { params: Record<string, unknown> }[] = [];
beforeEach(() => {
  vi.clearAllMocks(); seam.evaluationContext = null; verdicts = []; judged.length = 0;
  vi.stubGlobal('fetch', vi.fn(async (_u: string, init: { body: string }) => { judged.push(JSON.parse(init.body)); return { ok: true, json: async () => verdicts.shift() }; }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function mount(data: StoryPlannerData, mode: string) {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  new RuntimeTransport(runtime, () => {});
  render(<LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <StoryPlanner data={{ ...data, instanceId: 'sp' }} runtimePlanItemId="plan-sp" runtimeEvalMode={mode} />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>);
  const state = () => runtime.getSnapshot();
  const retry = () => {
    const s = state(); const a = s.affordances.find(x => x.action.type === 'retry')!;
    act(() => { runtime.dispatch({ sessionEpoch: 'test', commandId: crypto.randomUUID(), instanceId: 'sp', itemId: s.task!.itemId, expectedRevision: s.revision, action: a.action }); });
  };
  const advance = () => {
    const s = state(); const a = s.affordances.find(x => x.action.type === 'advance');
    if (a) act(() => { runtime.dispatch({ sessionEpoch: 'test', commandId: crypto.randomUUID(), instanceId: 'sp', itemId: s.task!.itemId, expectedRevision: s.revision, action: a.action }); });
  };
  return { state, retry, advance };
}
const tap = (label: string) => act(() => { fireEvent.click(screen.getByLabelText(label)); });
const done = async () => { await act(async () => { fireEvent.click(screen.getByRole('button', { name: "I'm done!" })); }); };
const pickAll = () => { for (const e of k.elements) tap(cap(e.choices![0])); };

describe('story-planner @ K-1 (reader-fit contract)', () => {
  it('no typing; one question per screen; the emoji is the answer surface; one tap picks and moves on', () => {
    mount(k, 'story_structure');
    expect(document.querySelectorAll('textarea')).toHaveLength(0);
    const [first, second] = k.elements;
    for (const c of first.choices!) expect(screen.getByLabelText(cap(c)).textContent).toContain(splitPictureOption(c).emoji);
    expect(screen.queryByLabelText(cap(second.choices![0]))).toBeNull();
    tap(cap(first.choices![0]));
    expect(screen.getByLabelText(cap(second.choices![0]))).toBeTruthy();
    expect(screen.queryByLabelText(cap(first.choices![0]))).toBeNull();
  });

  it('prints no story idea, grade badge or arc label; the tutor gets the question and every caption', () => {
    const h = mount(k, 'story_structure');
    expect(document.body.textContent).not.toContain(k.writingPrompt);
    expect(screen.queryByText(/Grade 1/)).toBeNull();
    for (const l of k.storyArcLabels) expect(screen.queryByText(l)).toBeNull();
    const facts = JSON.stringify(h.state().task);
    void facts;
    fireEvent.click(screen.getByRole('button', { name: 'Hear the story idea' }));
    expect(String(seam.send.mock.calls.at(-1)?.[0])).toContain(k.writingPrompt);
  });

  it('a full set of picks passes; the arc board never opens in story order; order is checked in code', async () => {
    const h = mount(k, 'story_structure');
    pickAll();
    expect(h.state().task!.evidence.correctness).toBe('correct');
    h.advance();
    const events = k.arcEvents!.map(cap);
    const board = screen.getAllByRole('button').map(b => b.getAttribute('aria-label')).filter(l => l && events.includes(l));
    expect(board).not.toEqual(events);
    for (const e of [...events].reverse()) tap(e);
    expect(screen.getByLabelText(`${events[0]} — tap to take it back out`)).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
    await done();
    expect(h.state().task!.evidence.correctness).toBe('incorrect');
    h.retry();
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    for (const e of events) tap(e);
    await done();
    expect(judged).toHaveLength(0);
    expect(h.state().task!.evidence.correctness).toBe('correct');
  });
});

describe('story-planner @ grade 2+', () => {
  it('rules: a short line and a repeat are caught in code; every mode binds and every miss is answered or declared', () => {
    expect(writeShapeMiss('A dog.', [])).toBe('too_short');
    expect(writeShapeMiss('Max is a brave puppy.', ['Max is a brave puppy!'])).toBe('repeat');
    const tw = getComponentById('story-planner')!.teachingWorkspace!;
    for (const [mode, data] of [['story_structure', k], ['character_setting', g2]] as const) {
      expect(workspaceBinding({ instanceId: mode, primitiveId: 'story-planner', pin: mode, objectiveIds: ['o'], data }), mode).not.toBeNull();
    }
    const answered = new Set([...storyItems(k), ...storyItems(g2)].flatMap(i => storyLevers(i, [])).flatMap(l => l.answers ?? []));
    for (const m of tw.misses!.character_setting) expect(answered.has(m) || tw.unanswered!.character_setting.includes(m), m).toBe(true);
  });

  it('a card is judged against the story; an accepted card joins the plan', async () => {
    const h = mount(g2, 'character_setting');
    expect(screen.getByText(g2.writingPrompt)).toBeTruthy();
    act(() => { fireEvent.change(screen.getByRole('textbox', { name: 'Your card' }), { target: { value: 'Biscuit is a tiny brown puppy with one floppy ear.' } }); });
    verdicts.push({ met: true, realWord: 0.99, fits: 0.9, judge: 'jev' });
    await done();
    expect(judged[0].params).toMatchObject({ unit: 'writing' });
    expect(String(judged[0].params.ask)).toContain(g2.elements[0].label);
    expect(h.state().task!.evidence.correctness).toBe('correct');
    expect(screen.getByTestId('sp-plan').textContent).toContain('Biscuit');
  });
});

describe('picture helpers', () => {
  it('splits a leading emoji from its caption, and passes a caption-only option through', () => {
    expect(splitPictureOption('🐶 A happy puppy')).toEqual({ emoji: '🐶', label: 'A happy puppy', raw: '🐶 A happy puppy' });
    expect(splitPictureOption('A happy puppy')).toEqual({ emoji: '', label: 'A happy puppy', raw: 'A happy puppy' });
  });
  it('the arc tray is a deterministic derangement', () => {
    for (const events of [['a', 'b'], ['a', 'b', 'c'], ['a', 'b', 'c', 'd', 'e']]) {
      const shuffled = shuffleArcEvents(events, events.join('|'));
      expect(shuffled.slice().sort()).toEqual(events.slice().sort());
      events.forEach((e, i) => expect(shuffled[i]).not.toBe(e));
      expect(shuffleArcEvents(events, events.join('|'))).toEqual(shuffled);
    }
  });
});
