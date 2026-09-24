// @vitest-environment jsdom
/**
 * The real BaseTenBlocks on the shared teaching workspace, its only teaching path, with the real
 * TeachingSession, LiveLessonRuntime, transport and rendering shell. The family has two surfaces,
 * chosen by the payload: the spoken mat (read_blocks, regroup) and the click mat (build_number,
 * operate). Both bind under tutor ownership; no scripted cue runs beside the tutor, and an unbound
 * mount of either renders the "needs the tutor" card, never a scripted fallback. Only the Live
 * context, evaluation writes, sound and the capture transport are substituted.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LiveLessonRuntime } from '../../../components/live-activity/runtime/LiveLessonRuntime';
import { LiveRuntimeContext } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from '../../../components/live-activity/runtime/LiveRuntimeSurface';
import { RuntimeTransport } from '../../../components/live-activity/runtime/runtimeTransport';
import type { WorkspaceInput } from '../../../components/live-activity/runtime/contract';

const seam = vi.hoisted(() => ({ conversation: [] as any[], send: vi.fn(), submit: vi.fn(), evaluationContext: null as unknown }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => ({
  isConnected: true, isListening: true, isAudioPlaying: false, sessionMode: 'lesson', activePrimitiveId: 'blocks',
  conversation: seam.conversation, sendText: seam.send,
  sharedVoiceTurns: { isVoiceActive: () => false, subscribe: () => () => {} },
}) }));
vi.mock('../../../evaluation', () => ({ useEvaluationContext: () => seam.evaluationContext,
  // Submitted once `submitResult` has run, as the real hook reports it.
  usePrimitiveEvaluation: () => ({ hasSubmitted: seam.submit.mock.calls.length > 0, submitResult: seam.submit, submittedResult: null, elapsedMs: 0 }) }));
vi.mock('../../../utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => () => true }) }));
vi.mock('canvas-confetti', () => ({ default: vi.fn() }));
vi.mock('@/lib/authApiClient', () => ({ authApi: { post: vi.fn() } }));
import BaseTenBlocks, { type BaseTenBlocksChallenge, type BaseTenBlocksData } from './BaseTenBlocks';
import { itemsFromChallenges } from './baseTenScript';
import { LIVE_ADAPTERS } from '../../../components/live-activity/activityContract';
import { captureMisconception, resetMisconceptionCaptureLatch } from '../../../evaluation/diagnosis/captureMisconception';
import type { PrimitiveEvaluationResult } from '../../../evaluation/types';
import { authApi } from '@/lib/authApiClient';
/** The submission waits for the scoring pass (a fetch that rejects in jsdom, so every spoken attempt keeps its flow verdict). */
const flushScoring = () => act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });

beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); seam.conversation = []; seam.evaluationContext = null;
  resetMisconceptionCaptureLatch();
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => setTimeout(() => fn(performance.now()), 16));
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

type Mode = 'build_number' | 'read_blocks' | 'regroup' | 'operate';
const challenge = (type: BaseTenBlocksChallenge['type'], targetNumber: number, instruction: string): BaseTenBlocksChallenge =>
  ({ type, targetNumber, instruction, hint: 'Look at each column.' });
const DECKS: Record<Mode, BaseTenBlocksChallenge[]> = {
  build_number: [challenge('build_number', 12, 'Build the number 12 with blocks.')],
  read_blocks: [challenge('read_blocks', 47, 'unused: the modes own every ask')],
  regroup: [challenge('regroup', 34, 'unused: the modes own every ask')],
  operate: [challenge('add_with_blocks', 41, 'Add 23 and 18 with blocks.')],
};

function mount(mode: Mode, challenges: BaseTenBlocksChallenge[] = DECKS[mode]) {
  const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
  const sent: any[] = [];
  const transport = new RuntimeTransport(runtime, m => sent.push(m));
  const data: BaseTenBlocksData = { instanceId: 'blocks', title: 'Blocks', description: 'Place value with blocks.',
    numberValue: challenges[0].targetNumber, maxPlace: 'hundreds', gradeBand: '2-3', challenges,
    skillId: 'NBT004-01', subskillId: 'NBT004-01-b' };
  const tree = () => <LiveRuntimeContext.Provider value={runtime}><LiveRuntimeSurface runtime={runtime}>
    <BaseTenBlocks data={data} runtimePlanItemId="plan-blocks" runtimeEvalMode={mode} />
  </LiveRuntimeSurface></LiveRuntimeContext.Provider>;
  const view = render(tree());
  const state = () => runtime.getSnapshot();
  let lastCommand = '';
  const confirmVisible = () => act(() => { runtime.confirmVisibleResponse(lastCommand); });
  const offer = (name: string) => state().affordances.find(a => a.action.type === name
    || a.action.type === 'workspace' && a.action.operation === name);
  const dispatch = (name: string, input?: WorkspaceInput) => {
    const s = state(), a = offer(name);
    expect(a, `missing action ${name}`).toBeTruthy();
    const commandId = crypto.randomUUID(); lastCommand = commandId;
    act(() => { runtime.dispatch({ sessionEpoch: 'test', commandId, instanceId: 'blocks',
      itemId: s.task!.itemId, expectedRevision: s.revision, action: { ...a!.action, ...(input ? { input } : {}) } }); });
  };
  const press = (name: string | RegExp) => act(() => { fireEvent.click(screen.getAllByRole('button', { name })[0]); });
  const settle = () => act(() => { vi.advanceTimersByTime(4000); });
  const say = (text: string) => act(() => {
    seam.conversation = [...seam.conversation, { role: 'user', content: text, timestamp: seam.conversation.length + 1 }];
    view.rerender(tree());
  });
  const feedback = (verdict: 'correct' | 'incorrect', transition: 'none' | 'advance' | 'retry' = 'none') =>
    dispatch('apply_tutor_verdict', { dialogue: { responseId: state().task!.workspace!.pendingResponse!.id, verdict, transition,
      tutor: verdict === 'correct' ? 'Yes, that is right.' : 'Not quite.' } });
  const advance = () => { dispatch('advance'); confirmVisible(); };
  return { runtime, transport, sent, view, state, offer, dispatch, confirmVisible, press, settle, say, feedback, advance };
}

const tutorTools = (h: ReturnType<typeof mount>) => h.state().affordances.filter(a => !a.controller)
  .map(a => (a.action as { operation?: string }).operation ?? a.action.type).sort();

/** Every block button of one place on the spoken mat, by its accessible name. */
const blocksOf = (place: 0 | 1 | 2) => {
  const noun = ['ones cube', 'ten-stick', 'hundred-flat'][place];
  return screen.queryAllByRole('button', { name: new RegExp(`^(Trade one ${noun} for ten |${noun}$)`) });
};
const columnOf = (name: string) => screen.getByLabelText(`${name} column`);

it.each(['build_number', 'read_blocks', 'regroup', 'operate'] as const)(
  '%s binds the workspace under tutor ownership, with no scripted cue, Next button or runner control', mode => {
    const h = mount(mode);
    expect(h.state().owner).toBe('tutor');
    expect(h.state().task!.task).not.toMatch(/Say exactly|\[BT_|unused/);
    expect(tutorTools(h)).toEqual(['begin_help']);
    expect(seam.send.mock.calls.flat().join(' ')).not.toMatch(/\[BT_|Say exactly|\[ACTIVITY_START|\[REGROUP_|\[BUILD_|\[ANSWER_/);
    expect(screen.queryByRole('button', { name: /next challenge|say that again/i })).toBeNull();
  });

it.each([['the spoken mat', 'read_blocks'], ['the click mat', 'build_number']] as const)(
  'an unbound mount of %s (no runtime, or a pin outside the catalog) renders the needs-the-tutor card', (_surface, mode) => {
    const data: BaseTenBlocksData = { instanceId: 'blocks', title: 'Our blocks', description: '', numberValue: 47,
      maxPlace: 'hundreds', challenges: DECKS[mode] };
    const { container } = render(<BaseTenBlocks data={data} runtimeEvalMode={mode} />);
    expect(container.querySelector('[data-workspace-unbound="base-ten-blocks"]')).not.toBeNull();
    expect(screen.getByText('Our blocks')).toBeTruthy();
    expect(container.querySelector('[data-base-ten-mat]')).toBeNull();
    cleanup();
    const runtime = new LiveLessonRuntime('test', { allowSupportArtifacts: true, allowAnswerExposure: true, maxSupportLevel: 3 });
    const off = render(<LiveRuntimeContext.Provider value={runtime}><BaseTenBlocks data={data} runtimeEvalMode="not_a_mode" />
    </LiveRuntimeContext.Provider>);
    expect(off.container.querySelector('[data-workspace-unbound="base-ten-blocks"]')).not.toBeNull();
    expect(off.container.querySelector('[data-base-ten-mat]')).toBeNull();
  });

it('a spoken step publishes the number it asks for; the trade, build and operate keys are never published', () => {
  const read = itemsFromChallenges(DECKS.read_blocks, 'read_blocks');
  let h = mount('read_blocks');
  expect(h.state().task!.task).toBe(read[0].actionContract.instruction);
  expect(h.state().task!.workspace!.expectedAnswer).toBe('4');
  // The counts are the answers: the scene names the asked size and no count or total.
  expect(JSON.stringify(h.state().task!.demand)).not.toMatch(/47|\b4\b|forty/);
  cleanup();
  h = mount('regroup');
  expect(h.state().task!.workspace!.expectedAnswer).toBe('14');
  h.say('fourteen'); h.feedback('correct', 'advance');
  expect(h.state().task!.task).toBe('Now make that trade. Tap one ten-stick to break it apart.');
  expect(h.state().task!.workspace!.expectedAnswer).toBeUndefined();
  for (const mode of ['build_number', 'operate'] as const) {
    cleanup();
    expect(mount(mode).state().task!.workspace!.expectedAnswer).toBeUndefined();
  }
});

it('the spoken mat prints no count, total or composed number, and offers no keypad or Check button', () => {
  mount('read_blocks', [challenge('read_blocks', 247, 'unused')]);
  // The scan is scoped to the mat: the problem counter elsewhere counts things the child can see.
  const mat = screen.getByLabelText('Block mat');
  expect(mat.textContent).toBe('hundred-flatsten-sticksones cubes');
  expect(document.body.textContent).not.toContain('247');
  expect(document.body.textContent).not.toMatch(/blocks total|\bforty\b|two hundred/i);
  for (const label of [/check my blocks/i, /check my trade/i, /^7$/, /^✓$/]) {
    expect(screen.queryByRole('button', { name: label })).toBeNull();
  }
  // One block per unit is the only place the count lives, and reading is a mouth turn: nothing is tappable.
  expect(blocksOf(2)).toHaveLength(2);
  expect(blocksOf(1)).toHaveLength(4);
  expect(blocksOf(0)).toHaveLength(7);
  for (const block of [...blocksOf(2), ...blocksOf(1), ...blocksOf(0)]) expect((block as HTMLButtonElement).disabled).toBe(true);
  // The subject column is highlighted, and only that one.
  expect(columnOf('hundreds').getAttribute('data-highlighted')).toBe('true');
  expect(columnOf('tens').getAttribute('data-highlighted')).toBeNull();
  expect(screen.queryByRole('button', { name: /put the blocks back/i })).toBeNull();
});

it('read_blocks: a wrong count is retried, the worth step is judged against the value, and the submission counts problems', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('read_blocks');
  h.say('forty'); h.feedback('incorrect', 'retry');
  expect(h.state().task!.workspace!.expectedAnswer).toBe('4');
  h.say('four'); h.feedback('correct', 'advance');
  expect(h.state().task!.workspace!.expectedAnswer).toBe('40');
  expect(columnOf('tens').getAttribute('data-highlighted')).toBe('true');
  h.say('forty'); h.feedback('correct', 'advance');
  expect(h.state().status).not.toBe('completed');
  h.confirmVisible();
  expect(h.state().status).toBe('completed');
  const done = screen.getByText(/Nice work with the blocks!/);
  expect(done.parentElement!.textContent).not.toMatch(/\d/);
  await flushScoring();
  expect(seam.submit).toHaveBeenCalledOnce();
  const [success, score, metrics, work, , evidence] = seam.submit.mock.calls[0];
  expect([success, score]).toEqual([true, 67]);
  expect(metrics).toMatchObject({ evalMode: 'read_blocks', totalChallenges: 1, challengesCompleted: 1, placeValuesUsed: ['tens'] });
  // The workspace's record of every judged attempt, and the correction as diagnosis evidence.
  expect(work.learningResponses).toHaveLength(3);
  expect(work.problem.challenges).toEqual(DECKS.read_blocks);
  expect(evidence.firstResponseScore).toBe(50);
  expect(evidence.phases).toHaveLength(1);
  expect(evidence.phases[0]).toMatchObject({ expected: '4' });
  expect(evidence.phases[0].observed).toContain('forty');
  expect(work.diagnosisEvidence).toEqual(evidence);
});

it('read_blocks correction evidence reaches the skill-scoped observation capture', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('read_blocks', [challenge('read_blocks', 2305, 'unused'), challenge('read_blocks', 5206, 'unused')]);
  // Each worth step is said as the bare count first: every mat passes after one correction.
  for (const [count, worth] of [['two', 'two thousand'], ['two', 'two hundred']]) {
    h.say(count); h.feedback('correct', 'advance');
    h.say(count); h.feedback('incorrect', 'retry');
    h.say(worth); h.feedback('correct', 'advance');
  }
  h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await flushScoring();
  const [success, score, metrics, studentWork, , diagnosisEvidence] = seam.submit.mock.calls[0];
  expect([success, score, diagnosisEvidence.firstResponseScore]).toEqual([true, 67, 50]);
  vi.useRealTimers();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ abstain: false, confidence: 'high', evidenceTier: 'judge',
    misconceptionText: 'Synthetic hypothesis.', teachingImplication: 'Pair equal counts of different block sizes.', checkNext: 'Ask worth independently.' }) }));
  vi.mocked(authApi.post).mockResolvedValue({ stored: true });
  const result = { skillId: 'NBT004-01', subskillId: 'NBT004-01-b', primitiveType: 'base-ten-blocks', success, score, metrics,
    diagnosisEvidence, studentWork, attemptId: 'blocks-attempt', instanceId: 'blocks',
    lessonContext: { gradeLevel: '4', curriculumSubject: 'MATHEMATICS' } } as unknown as PrimitiveEvaluationResult;
  await captureMisconception(result, { sessionId: 's', subskillId: 'NBT004-01-b', gradeLevel: '4' });
  expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]!.body)).params.evidence.firstResponseScore).toBe(50);
  expect(authApi.post).toHaveBeenCalledWith('/api/student-profile/misconceptions', expect.objectContaining({
    primitive_type: 'base-ten-blocks', scope: 'skill', skill_id: 'NBT004-01', subskill_id: 'NBT004-01-b' }));
});

it('regroup: the prediction turn is untradeable; a wrong trade commits on stillness, Try again puts the blocks back, a right trade completes once', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('regroup');
  expect(blocksOf(1).every(b => (b as HTMLButtonElement).disabled)).toBe(true);
  expect(screen.queryByRole('button', { name: /put the blocks back/i })).toBeNull();
  expect(columnOf('tens').getAttribute('data-highlighted')).toBeNull();
  h.say('fourteen'); h.feedback('correct', 'advance');
  const tenStick = 'Trade one ten-stick for ten ones cubes';
  // A ones cube is never tradeable: nothing sits below it.
  expect(blocksOf(0).every(b => (b as HTMLButtonElement).disabled)).toBe(true);
  // Two tens broken: the value is kept, but it is not the one trade asked for.
  h.press(tenStick); h.press(tenStick);
  expect(screen.getByText('That is a different block from the one we are trading.')).toBeTruthy();
  expect(h.state().task!.evidence.attemptNumber).toBe(0);
  h.settle();
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  const [facts, options] = seam.send.mock.calls.at(-1)!;
  expect(options).toMatchObject({ author: 'host' });
  expect(facts).toContain('1 ten-stick, 24 ones cubes');
  // The checked mat is closed: no block offers a trade until Try again.
  expect(screen.queryAllByRole('button', { name: tenStick })).toHaveLength(0);
  h.dispatch('retry');
  expect(h.state().task!.demand).toMatchObject({ matNow: '3 ten-sticks, 4 ones cubes' });
  h.press(tenStick); h.settle();
  expect(h.state().task!.evidence.correctness).toBe('correct');
  h.advance();
  expect(h.state().status).toBe('completed');
  await flushScoring();
  expect(seam.submit).toHaveBeenCalledOnce();
  expect(seam.submit.mock.calls[0].slice(0, 2)).toEqual([true, 67]);
  // regroup supplies no correction evidence, so capture never calls the model.
  expect(seam.submit.mock.calls[0][5]).toBeUndefined();
  expect(seam.submit.mock.calls[0][3].diagnosisEvidence).toBeUndefined();
});

it('regroup: Put the blocks back restores the starting mat before the check', () => {
  const h = mount('regroup');
  h.say('fourteen'); h.feedback('correct', 'advance');
  h.press('Trade one ten-stick for ten ones cubes');
  expect(blocksOf(0)).toHaveLength(14);
  h.press(/put the blocks back/i);
  expect(blocksOf(1)).toHaveLength(3);
  expect(blocksOf(0)).toHaveLength(4);
  expect(document.body.textContent).not.toMatch(/different block/i);
  h.settle();
  // The undo cleared the pending stillness commit: nothing was checked.
  expect(h.state().task!.evidence.attemptNumber).toBe(0);
});

it('build_number: Check My Blocks commits, the mat closes until Try again empties it, a standard build completes once', () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('build_number');
  for (let i = 0; i < 12; i++) h.press('Add one to Ones');
  h.press(/check my blocks/i);
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  const [facts, options] = seam.send.mock.calls.at(-1)!;
  expect(options).toMatchObject({ author: 'host' });
  expect(facts).toContain('Checked the blocks: 12 ones');
  expect(screen.getByRole('button', { name: 'Add one to Tens' })).toHaveProperty('disabled', true);
  h.dispatch('retry');
  expect(h.state().task!.demand).toMatchObject({ learnerBlocks: 'no blocks' });
  h.press('Add one to Tens'); h.press('Add one to Ones'); h.press('Add one to Ones');
  h.press(/check my blocks/i);
  expect(h.state().task!.evidence.correctness).toBe('correct');
  h.advance();
  expect(h.state().status).toBe('completed');
  expect(seam.submit).toHaveBeenCalledOnce();
  expect(seam.submit.mock.calls[0][0]).toBe(true);
});

it('operate: the keypad result is checked by the activity and never published', () => {
  const h = mount('operate');
  h.press('4'); h.press('2'); h.press('✓');
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(seam.send.mock.calls.at(-1)![0]).toContain('Typed 42');
  h.dispatch('retry');
  h.press('4'); h.press('1'); h.press('✓');
  expect(h.state().task!.evidence.correctness).toBe('correct');
  // No evaluation provider in the live host: nothing is submitted.
  h.advance();
  expect(h.state().status).toBe('completed');
  expect(seam.submit).not.toHaveBeenCalled();
});

it('its fixture list covers every catalog mode, and validation holds', () => {
  expect([...LIVE_ADAPTERS['base-ten-blocks'].modes].sort()).toEqual(['build_number', 'operate', 'read_blocks', 'regroup']);
});
