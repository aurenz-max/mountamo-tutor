'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { LuminaAIProvider, useLuminaAIContext } from '@/contexts/LuminaAIContext';
import { useAuth } from '@/contexts/AuthContext';
import { getComponentById } from '../../service/manifest/catalog';
import { parseLessonPackage, type LessonPackage } from '../../service/qa/lessonBench/lessonPackage';
import type { PrimitiveEvaluationResult } from '../../evaluation/types';
import { LIVE_ADAPTERS, LIVE_PRIMITIVE_IDS, generatedActivityState, parseActivityRequest, validateGeneratedActivity, type LivePrimitiveId, type MountedActivity } from './activityContract';
import { nextPlanItem, planForTutor, projectLessonPlan, type LiveSessionPlan, type PlanItemOutcome } from './livePlan';
import DirectVisual, { type DirectVisualControls } from './DirectVisual';
import ConversationTranscript from './ConversationTranscript';
import JevInspector from './JevInspector';
import { LiveLessonRuntime } from './runtime/LiveLessonRuntime';
import { RuntimeTransport, runtimePacket } from './runtime/runtimeTransport';
import { LiveRuntimeSurface } from './runtime/LiveRuntimeSurface';
import { useRuntimeSnapshot } from './runtime/LiveRuntimeContext';
import { buildDirectVisual, visualSize, type MountedVisual } from './directVisualContract';

import { buildLiveActivitySpec } from './liveActivitySpec';
import { LIVE_RENDERERS, type NumberLineControls } from './liveRenderers';

/** Picker copy comes from the adapter registry, so a new family adds no map here. */
const familyCopy = (id: LivePrimitiveId) => LIVE_ADAPTERS[id].copy;

type Event = Record<string, any>;
type Log = { at: string; text: string };

class ActivityBoundary extends React.Component<{
  children: React.ReactNode; onError: () => void;
}, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? <p role="alert">This activity could not be displayed. Ask for another example.</p> : this.props.children; }
}

/** Mounted receipt comes after child effects and a paint, never after fetch alone. */
function VisibleActivity({ activity, onVisible, onControls }: {
  activity: MountedActivity; onVisible: (activity: MountedActivity) => void;
  onControls: (instanceId: string, controls: NumberLineControls | null) => void;
}) {
  const registerControls = useCallback((controls: NumberLineControls | null) => {
    onControls(activity.instanceId, controls);
  }, [activity.instanceId, onControls]);
  useEffect(() => {
    let second = 0;
    const first = requestAnimationFrame(() => { second = requestAnimationFrame(() => onVisible(activity)); });
    return () => { cancelAnimationFrame(first); cancelAnimationFrame(second); };
  }, [activity, onVisible]);
  const id = activity.request.primitiveId;
  return <div data-testid="live-activity" data-instance-id={activity.instanceId}>
    {LIVE_RENDERERS[id]({ data: activity.data, autoStart: false, planItemId: activity.planItemId,
      evalMode: activity.resolvedEvalMode ?? activity.request.mode ?? '', onControls: registerControls })}
  </div>;
}

function VisibleDirectVisual({ visual, onVisible, onState, onControls }: {
  visual: MountedVisual;
  onVisible: (visual: MountedVisual, state: Record<string, unknown>) => void;
  onState: (instanceId: string, state: Record<string, unknown>) => void;
  onControls: (instanceId: string, controls: DirectVisualControls | null) => void;
}) {
  const visible = useCallback((state: Record<string, unknown>) => onVisible(visual, state), [visual, onVisible]);
  const state = useCallback((state: Record<string, unknown>) => onState(visual.instanceId, state), [visual.instanceId, onState]);
  const controls = useCallback((controls: DirectVisualControls | null) => onControls(visual.instanceId, controls), [visual.instanceId, onControls]);
  return <DirectVisual data={visual.data} onVisible={visible} onState={state} onControls={controls} />;
}

/** Load a Lesson Bench package and pick which objective blocks the live lesson runs. */
function PlanPicker({ disabled, pkg, objectiveId, plan, planError, onPackage, onObjective, onClear }: {
  disabled: boolean; pkg: LessonPackage | null; objectiveId: string; plan: LiveSessionPlan | null; planError: string;
  onPackage: (file: File) => void; onObjective: (id: string) => void; onClear: () => void;
}) {
  return <details className="rounded-xl border border-slate-800 p-4" open={!!pkg}>
    <summary className="cursor-pointer text-sm text-slate-400">Planned lesson from a lesson package</summary>
    <div className="mt-3 space-y-3 text-sm">
      <p className="text-slate-400">Load a package from <code>qa/lesson-bench/packages</code>. Its prepared number-line and ten-frame activities run in manifest order; nothing is regenerated.</p>
      <div className="flex flex-wrap items-center gap-3">
        <input aria-label="Lesson package" type="file" accept="application/json,.json" disabled={disabled}
          onChange={e => { const file = e.target.files?.[0]; if (file) onPackage(file); e.target.value = ''; }} />
        {pkg && <label>Objectives <select aria-label="Objectives" value={objectiveId} disabled={disabled} onChange={e => onObjective(e.target.value)} className="ml-2 max-w-md rounded bg-slate-800 p-2">
          <option value="">All objectives</option>
          {pkg.manifest.objectiveBlocks.map(b => <option key={b.objectiveId} value={b.objectiveId}>{b.objectiveId}: {b.objectiveText}</option>)}
        </select></label>}
        {pkg && <button className="text-indigo-300 underline disabled:opacity-40" disabled={disabled} onClick={onClear}>Clear plan</button>}
      </div>
      {planError && <p role="alert" className="text-red-300">{planError}</p>}
      {plan && <div>
        <p className="text-slate-300">{plan.topic} · {plan.gradeLevel} · {plan.items.length} live {plan.items.length === 1 ? 'activity' : 'activities'}</p>
        {plan.unavailable.length > 0 && <details className="mt-2 text-slate-500"><summary className="cursor-pointer">Not available live ({plan.unavailable.length})</summary>
          <ul className="mt-1 list-disc pl-5">{plan.unavailable.map(u => <li key={u.manifestInstanceId}>{u.objectiveId} · {u.componentId}: {u.reason}</li>)}</ul>
        </details>}
      </div>}
    </div>
  </details>;
}

function Workspace({ eventHandler, onBack, runtime, resetRuntime }: {
  runtime: LiveLessonRuntime; resetRuntime: () => LiveLessonRuntime;
  eventHandler: React.MutableRefObject<((event: Event) => void) | null>;
  onBack?: () => void;
}) {
  const ai = useLuminaAIContext();
  const runtimeState = useRuntimeSnapshot(runtime);
  const transportRef = useRef<RuntimeTransport | null>(null);
  const aiRef = useRef(ai); aiRef.current = ai;
  const { user } = useAuth();
  // One row per adopted family rather than one boolean per family: a third
  // primitive is a key here, not another piece of branching in start/render.
  const [families, setFamilies] = useState<Record<LivePrimitiveId, boolean>>(
    () => Object.fromEntries(LIVE_PRIMITIVE_IDS.map(id => [id, true])) as Record<LivePrimitiveId, boolean>);
  const enabledFamilies = useMemo(() => (Object.keys(families) as LivePrimitiveId[]).filter(id => families[id]), [families]);
  const [lessonMode, setLessonMode] = useState('make_ten');
  const [lessonPrimitive, setLessonPrimitive] = useState<LivePrimitiveId>('ten-frame');
  // The session_ready log reads the family after the connect closure was built.
  const lessonPrimitiveRef = useRef(lessonPrimitive); lessonPrimitiveRef.current = lessonPrimitive;
  const openingRef = useRef<string | null>(null);
  const [directVisuals, setDirectVisuals] = useState(true);
  const [generatedPictures, setGeneratedPictures] = useState(true);
  const [drawing, setDrawing] = useState(false);
  const [grade, setGrade] = useState('Grade 1');
  const gradeRef = useRef(grade); gradeRef.current = grade;
  const [ready, setReady] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [activity, setActivity] = useState<MountedActivity | null>(null);
  const activityRef = useRef(activity); activityRef.current = activity;
  const [visual, setVisual] = useState<MountedVisual | null>(null);
  const visualRef = useRef(visual); visualRef.current = visual;
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [logs, setLogs] = useState<Log[]>([]);
  const current = useRef<{ id: string; abort: AbortController; started: number; mounted: boolean } | null>(null);
  const controlsRef = useRef<{ instanceId: string; controls: NumberLineControls } | null>(null);
  const commandRef = useRef<string | null>(null);
  const visualControlsRef = useRef<{ instanceId: string; controls: DirectVisualControls } | null>(null);

  // ── Planned lesson (LA-02/LA-03) ──
  const [pkg, setPkg] = useState<LessonPackage | null>(null);
  const [objectiveId, setObjectiveId] = useState('');
  const [loadError, setLoadError] = useState('');
  const projected = useMemo(() => {
    if (!pkg) return { plan: null, error: '' };
    try { return { plan: projectLessonPlan(pkg, objectiveId ? { objectiveIds: [objectiveId] } : {}), error: '' }; }
    catch (e) { return { plan: null, error: e instanceof Error ? e.message : 'This package cannot run live.' }; }
  }, [pkg, objectiveId]);
  /** The plan the connected session runs; frozen at Start so a picker change cannot alter it mid-lesson. */
  const [sessionPlan, setSessionPlan] = useState<LiveSessionPlan | null>(null);
  const sessionPlanRef = useRef(sessionPlan); sessionPlanRef.current = sessionPlan;
  const [outcomes, setOutcomes] = useState<Record<string, PlanItemOutcome>>({});
  const outcomesRef = useRef(outcomes);
  const planMode = !!(sessionPlan ?? projected.plan);

  const onVisualControls = useCallback((instanceId: string, controls: DirectVisualControls | null) => {
    if (controls) visualControlsRef.current = { instanceId, controls };
    else if (visualControlsRef.current?.instanceId === instanceId) visualControlsRef.current = null;
  }, []);
  const onControls = useCallback((instanceId: string, controls: NumberLineControls | null) => {
    if (controls) controlsRef.current = { instanceId, controls };
    else if (controlsRef.current?.instanceId === instanceId) controlsRef.current = null;
  }, []);
  const log = useCallback((text: string) => setLogs(old => [...old.slice(-99), { at: new Date().toLocaleTimeString(), text }]), []);
  useEffect(() => {
    const transport = new RuntimeTransport(runtime, message => {
      if (message.type === 'dialogue_observation') log(`Dialogue: ${message.verdict}; ${message.transition} (${message.status}, ${message.reason}).`);
      aiRef.current.sendActivityMessage(message);
    });
    transportRef.current = transport;
    return () => { transport.close(); transportRef.current = null; };
  }, [runtime]);

  const loadPackage = useCallback(async (file: File) => {
    try {
      setPkg(parseLessonPackage(JSON.parse(await file.text()))); setObjectiveId(''); setLoadError('');
    } catch (e) {
      setPkg(null); setLoadError(e instanceof Error ? e.message : 'Could not read the package.');
    }
  }, []);

  const cancel = useCallback((notify = true) => {
    const job = current.current;
    if (!job || job.mounted) return;
    current.current = null;
    job.abort.abort();
    setPending(null);
    setActivity(old => old?.callId === job.id ? null : old);
    setVisual(old => old?.callId === job.id ? null : old);
    if (notify) aiRef.current.sendActivityMessage({ type: 'activity_cancel', callId: job.id });
    log('Pending activity cancelled.');
  }, [log]);

  const fail = useCallback((id: string, message: string) => {
    if (current.current?.id !== id || current.current.mounted) return;
    current.current.abort.abort();
    current.current = null;
    setPending(null); setError(message);
    setActivity(old => old?.callId === id ? null : old);
    setVisual(old => old?.callId === id ? null : old);
    aiRef.current.sendActivityMessage({ type: 'activity_result', callId: id, status: 'error', error: message });
    log(`Failed: ${message}`);
  }, [log]);

  /** The primitive's own evaluation callback is the completion signal. The sandbox has no EvaluationProvider, so nothing is written. */
  const pendingCompletion = useRef<{ instanceId: string; result: PrimitiveEvaluationResult } | null>(null);
  const onPlanItemSubmitted = useCallback((instanceId: string, result: PrimitiveEvaluationResult) => {
    const plan = sessionPlanRef.current, shown = activityRef.current;
    if (!plan || !shown?.planItemId || shown.instanceId !== instanceId || outcomesRef.current[shown.planItemId]) return;
    const snapshot = runtime.getSnapshot();
    if (snapshot.instanceId === instanceId && snapshot.status !== 'completed') {
      pendingCompletion.current = { instanceId, result }; return;
    }
    pendingCompletion.current = null;
    const outcome: PlanItemOutcome = { itemId: shown.planItemId, disposition: 'completed', allCorrect: result.success, score: result.score };
    const updated = { ...outcomesRef.current, [shown.planItemId]: outcome };
    outcomesRef.current = updated;
    setOutcomes(updated);
    const following = nextPlanItem(plan, updated);
    aiRef.current.sendActivityMessage({ type: 'plan_item_complete', callId: shown.callId, instanceId, itemId: shown.planItemId,
      nextItemId: following?.itemId ?? '', outcome });
    log(`${shown.planItemId} complete (score ${result.score}). ${following ? `Next: ${following.itemId}.` : 'Lesson plan finished.'}`);
  }, [log, runtime]);
  const onPlanItemSubmittedRef = useRef(onPlanItemSubmitted); onPlanItemSubmittedRef.current = onPlanItemSubmitted;

  useEffect(() => runtime.onCompletion(state => {
    const pending = pendingCompletion.current;
    if (pending?.instanceId === state.instanceId) onPlanItemSubmittedRef.current(pending.instanceId, pending.result);
  }), [runtime]);

  const onVisualVisible = useCallback((mounted: MountedVisual, state: Record<string, unknown>) => {
    const job = current.current;
    if (!job || job.id !== mounted.callId || job.abort.signal.aborted || job.mounted) return;
    job.mounted = true;
    setPending(null);
    aiRef.current.sendActivityMessage({ type: 'activity_result', callId: mounted.callId, status: 'mounted',
      instanceId: mounted.instanceId, primitiveId: `live-${mounted.data.kind}`, data: state, highlightCount: visualSize(mounted.data),
      guidance: 'This direct visual is visible. Teach conversationally from this state; do not invent values. There is no Check or Next button. Use show tools for another example or highlight_visual to point. Student taps are state, not verified correctness.',
    });
    log(`Displayed ${mounted.data.kind} in ${Math.round(performance.now() - job.started)}ms; no generation call.`);
  }, [log]);
  const onVisualState = useCallback((instanceId: string, state: Record<string, unknown>) => {
    if (visualRef.current?.instanceId === instanceId && current.current?.mounted) {
      aiRef.current.sendActivityMessage({ type: 'visual_state', instanceId, state });
    }
  }, []);

  const onVisible = useCallback((mounted: MountedActivity) => {
    const job = current.current;
    if (!job || job.id !== mounted.callId || job.abort.signal.aborted || job.mounted) return;
    job.mounted = true;
    setPending(null);
    const item = mounted.planItemId ? sessionPlanRef.current?.items.find(i => i.itemId === mounted.planItemId) : undefined;
    const primitiveId = mounted.request.primitiveId;
    aiRef.current.sendActivityMessage({ type: 'activity_result', callId: mounted.callId,
      status: 'mounted', instanceId: mounted.instanceId, primitiveId,
      data: generatedActivityState(primitiveId, item?.data ?? mounted.data),
      tutoring: LIVE_ADAPTERS[primitiveId].tutoring !== undefined
        ? LIVE_ADAPTERS[primitiveId].tutoring : getComponentById(primitiveId)?.tutoring,
      guidance: LIVE_ADAPTERS[primitiveId].guidance,
      ...(item ? { planItem: { itemId: item.itemId, title: item.title, intent: item.intent, evalMode: item.evalMode, objective: item.objective.text } } : {}),
    });
    log(`Mounted ${item ? `${item.itemId} (${primitiveId}, ${item.evalMode})` : mounted.instanceId} in ${((performance.now() - job.started) / 1000).toFixed(1)}s. Tutor received actual content.`);
  }, [log]);

  /** Mount a prepared plan item. Only the next unfinished item may start; a rejection leaves the current activity untouched. */
  const startPlanItem = useCallback((event: Event) => {
    const plan = sessionPlanRef.current, shown = activityRef.current;
    const itemId = event.args?.planItemId;
    const following = plan ? nextPlanItem(plan, outcomesRef.current) : null;
    const reject = (message: string) => {
      aiRef.current.sendActivityMessage({ type: 'activity_result', callId: event.callId, status: 'error', error: message });
      log(`Rejected start of ${String(itemId)}: ${message}`);
    };
    if (!plan || !following) return reject('The planned lesson is finished.');
    if (itemId !== following.itemId) return reject(`Only the next planned activity can start: ${following.itemId}.`);
    if (shown?.planItemId === itemId) return reject('That activity is already on screen.');
    cancel(false);
    current.current = { id: event.callId, abort: new AbortController(), started: performance.now(), mounted: false };
    const instanceId = `live-plan-${following.itemId}-${crypto.randomUUID()}`;
    const data = { ...following.data, instanceId, objectiveId: following.objective.id,
      onEvaluationSubmit: (result: PrimitiveEvaluationResult) => onPlanItemSubmittedRef.current(instanceId, result) };
    setError(''); commandRef.current = null; setVisual(null);
    setActivity({ callId: event.callId, instanceId, request: { primitiveId: following.primitiveId }, data: data as MountedActivity['data'], planItemId: following.itemId, resolvedEvalMode: following.evalMode });
    log(`Starting ${following.itemId}: ${following.title} (${following.primitiveId}, ${following.evalMode}); prepared content, no generation.`);
  }, [cancel, log]);

  useEffect(() => {
    eventHandler.current = (event) => {
      const transport = transportRef.current;
      if (event.type === 'runtime_command') { void transport?.command(event.command); return; }
      if (event.type === 'runtime_cancelled') { transport?.cancel(event.commandId); return; }
      if (event.type === 'runtime_compose_move') {
        const move = event.move;
        // The tutor's own diagnosis goes to the timeline verbatim, beside what it asked for,
        // because whether the move ADDS anything to the child's screen is the thing under review.
        log(`Tutor move (${move.delta}, ${move.representation}, values ${JSON.stringify(move.values)}): obstacle "${move.obstacle}" -> next "${move.nextAction}"`
          + (move.description ? ` picture: "${move.description}"` : ''));
        const drawing = move.delta === 'illustrate';
        if (drawing) setDrawing(true);
        void transport?.composeMove(event.commandId, event.scope, move, async (request, signal) => {
          const response = await fetch('/api/lumina/live-activity/support-image', { method: 'POST', signal,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ purpose: request.delta, concept: request.obstacle.slice(0, 120),
              description: request.description, counts: request.values, gradeLevel: gradeRef.current }) });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || 'Picture failed');
          log(`Picture drawn in ${result.timing.generateMs}ms, checked in ${result.timing.checkMs}ms, ${result.attempts} attempt(s). Checker saw: "${result.check.seen}" ${result.usable ? 'Usable.' : `REJECTED: ${result.check.problem || 'unrequested text'}`}`);
          return result.usable ? { imageUrl: result.imageUrl }
            : { refused: `The drawing did not match your description (${result.check.problem || 'it contained text'}). Make a cheaper move or use words instead.` };
        }).then(outcome => { if (outcome) log(`Move ${outcome.status}${outcome.reason ? `: ${outcome.reason}` : ''}`); })
          .finally(() => { if (drawing) setDrawing(false); });
        return;
      }
      if (event.type === 'runtime_turn_output') { transport?.beginTurn(typeof event.text === 'string' ? event.text : ''); return; }
      if (event.type === 'runtime_learner_text') { transport?.learnerText(String(event.text ?? ''), event.finished === true); return; }
      if (event.type === 'runtime_host_text') { transport?.hostText(); return; }
      if (event.type === 'runtime_interrupted') { transport?.dialogue.interrupt(); transport?.endTurn(false); return; }
      if (event.type === 'runtime_turn_end') { transport?.endTurn(event.audioPending === true); return; }
      if (event.type === 'runtime_audio_idle') { transport?.audioChanged(false); return; }
      if (event.type === 'session_ready') {
        setReady(true); setConnecting(false); log('Live session ready.');
        const opening = openingRef.current; openingRef.current = null;
        if (opening) {
          aiRef.current.sendText(opening, { silent: true });
          log(sessionPlanRef.current ? 'Starting the planned lesson automatically.'
            : `Starting the ${familyCopy(lessonPrimitiveRef.current).label.toLowerCase()} lesson automatically.`);
        }
        return;
      }
      if (event.type === 'activity_session_closed') {
        runtime.stop(); transport?.close();
        openingRef.current = null;
        commandRef.current = null;
        cancel(false); setReady(false); setConnecting(false);
        if (!event.intentional) setError(event.reason || 'Session closed. Start a new session to continue.');
        return;
      }
      if (event.type === 'activity_cancelled') {
        if (current.current?.id === event.callId) cancel(false);
        log(`Request cancelled: ${event.reason}`); return;
      }
      if (['activity_request', 'activity_visual'].includes(event.type)
          && runtime.getSnapshot().instanceId && !runtime.getSnapshot().canStartNext) {
        if (runtime.getSnapshot().status === 'completed') {
          // A tool request may precede its own transition speech. Keep the
          // original request and wait for that turn before replacing the owner.
          const instanceId = runtime.getSnapshot().instanceId;
          void (async () => {
            const started = performance.now();
            while (runtime.getSnapshot().status === 'completed' && !runtime.getSnapshot().canStartNext
                && performance.now() - started < 8000) await new Promise(resolve => setTimeout(resolve, 50));
            if (runtime.getSnapshot().status === 'stopped' || runtime.getSnapshot().instanceId !== instanceId) return;
            if (runtime.getSnapshot().canStartNext) eventHandler.current?.(event);
            else aiRef.current.sendActivityMessage({ type: 'activity_result', callId: event.callId, status: 'error', error: 'The tutor transition has not settled yet.' });
          })();
          return;
        }
        aiRef.current.sendActivityMessage({ type: 'activity_result', callId: event.callId, status: 'error',
          error: 'The current activity still owns this lesson. Use its advertised help actions, or finish it before starting another activity.' });
        return;
      }
      if (event.type === 'activity_visual') {
        try {
          if (!directVisuals) throw new Error('Direct visuals are not enabled.');
          const data = buildDirectVisual(event.toolName, event.args);
          cancel(false);
          current.current = { id: event.callId, abort: new AbortController(), started: performance.now(), mounted: false };
          setPending(null); setError(''); commandRef.current = null;
          setActivity(null); setVisual({ callId: event.callId, instanceId: event.instanceId, data });
          log(`Requested direct ${data.kind}.`);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Invalid visual';
          setError(message);
          aiRef.current.sendActivityMessage({ type: 'activity_result', callId: event.callId, status: 'error', error: message });
          log(`Rejected visual: ${message}`);
        }
        return;
      }
      if (event.type === 'activity_highlight') {
        const surface = visualControlsRef.current;
        const receipt = (status: string, state: Record<string, unknown>) => aiRef.current.sendActivityMessage({
          type: 'activity_command_result', callId: event.callId, instanceId: event.instanceId, status, state,
        });
        if (!surface || surface.instanceId !== event.instanceId || commandRef.current || !surface.controls.highlight(event.indices)) {
          receipt('rejected', {}); return;
        }
        commandRef.current = event.callId;
        requestAnimationFrame(() => requestAnimationFrame(() => {
          if (commandRef.current !== event.callId) return;
          commandRef.current = null;
          const latest = visualControlsRef.current;
          if (!latest || latest.instanceId !== event.instanceId) { receipt('rejected', {}); return; }
          receipt('updated', latest.controls.getState());
          log(`Highlighted items ${event.indices.map((i: number) => i + 1).join(', ') || '(cleared)'}.`);
        }));
        return;
      }
      if (event.type === 'activity_command') {
        const surface = controlsRef.current;
        const receipt = (status: string, state: Record<string, unknown>, error?: string) => {
          aiRef.current.sendActivityMessage({ type: 'activity_command_result', callId: event.callId,
            instanceId: event.instanceId, status, state, error });
          log(`Advance ${status}: ${event.instanceId}`);
        };
        if (!surface || surface.instanceId !== event.instanceId || commandRef.current
            || !Number.isInteger(event.challengeIndex)) {
          receipt('rejected', {}, 'No matching screen or another advance is pending.'); return;
        }
        const status = surface.controls.advance(event.challengeIndex);
        if (status === 'rejected') {
          receipt(status, surface.controls.getState(), 'Finish and check the current challenge before advancing. The index must match.'); return;
        }
        commandRef.current = event.callId;
        // Acknowledge the committed next screen, not the event dispatch.
        requestAnimationFrame(() => requestAnimationFrame(() => {
          if (commandRef.current !== event.callId) return;
          commandRef.current = null;
          const latest = controlsRef.current;
          if (!latest || latest.instanceId !== event.instanceId) {
            receipt('rejected', {}, 'Activity changed before the screen receipt.'); return;
          }
          receipt(status, latest.controls.getState());
        }));
        return;
      }
      if (event.type !== 'activity_request') return;
      if (sessionPlanRef.current) { startPlanItem(event); return; }
      cancel(false);
      const abort = new AbortController();
      current.current = { id: event.callId, abort, started: performance.now(), mounted: false };
      setPending(event.callId); setError('');
      void (async () => {
        try {
          const request = parseActivityRequest(event.args);
          log(`Requested ${request.mode}: ${request.intent}`);
          const response = await fetch('/api/lumina/live-activity', { method: 'POST',
            headers: { 'Content-Type': 'application/json' }, signal: abort.signal,
            body: JSON.stringify({ request, gradeLevel: gradeRef.current }),
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || 'Generation failed');
          const data = validateGeneratedActivity(request.primitiveId, result.data);
          const job = current.current;
          if (abort.signal.aborted || !job || job.id !== event.callId) return;
          log(`Generated in ${((performance.now() - job.started) / 1000).toFixed(1)}s; mounting.`);
          setVisual(null); setActivity({ callId: event.callId, instanceId: result.instanceId, request, data });
        } catch (error) {
          if (!abort.signal.aborted) fail(event.callId, error instanceof Error ? error.message : 'Generation failed');
        }
      })();
    };
    return () => { eventHandler.current = null; };
  }, [cancel, eventHandler, fail, log, startPlanItem, runtime, directVisuals]);

  useEffect(() => () => { current.current?.abort.abort(); commandRef.current = null; }, []);
  useEffect(() => {
    if (!pending) return;
    const timeout = setTimeout(() => fail(pending, 'Activity generation or display timed out.'), 115_000);
    return () => clearTimeout(timeout);
  }, [pending, fail]);
  useEffect(() => {
    if (!connecting) return;
    const timeout = setTimeout(() => {
      setConnecting(false); aiRef.current.disconnect();
      setError('Could not connect. Check sign-in and the development backend.');
    }, 20_000);
    return () => clearTimeout(timeout);
  }, [connecting]);

  const start = async () => {
    const nextRuntime = resetRuntime();
    const runtimeSandbox = { sessionEpoch: nextRuntime.sessionEpoch, initialState: runtimePacket(nextRuntime.getSnapshot()), teachingMoves: generatedPictures };
    commandRef.current = null;
    setError(''); setConnecting(true); setActivity(null); setVisual(null); setLogs([]);
    outcomesRef.current = {}; setOutcomes({}); pendingCompletion.current = null;
    current.current?.abort.abort(); current.current = null;
    const plan = projected.plan;
    setSessionPlan(plan); sessionPlanRef.current = plan;
    if (plan) {
      openingRef.current = `[LESSON_START] Begin the planned lesson now. Call start_plan_item with itemId ${plan.items[0].itemId}. Do not greet first or describe the activity before it is mounted.`;
      await ai.connectLesson({ runtimeSandbox, exhibit_id: `sandbox-plan-${crypto.randomUUID()}`, topic: plan.topic, grade_level: plan.gradeLevel,
        activitySandbox: buildLiveActivitySpec(plan.items.map(i => i.primitiveId), false, { topic: plan.topic, items: planForTutor(plan) }),
        firstPrimitive: {
          primitive_type: 'live-activity-sandbox', instance_id: 'empty-workspace',
          primitive_data: { workspace: 'empty', gradeLevel: plan.gradeLevel, lessonPlan: plan.planId },
          topic: plan.topic, grade_level: plan.gradeLevel, owns_opening: true,
        },
      });
      return;
    }
    openingRef.current = families[lessonPrimitive]
      ? LIVE_ADAPTERS[lessonPrimitive].lessonStart(grade, lessonMode) : null;
    await ai.connectLesson({ runtimeSandbox, exhibit_id: `sandbox-${crypto.randomUUID()}`, topic: 'Live activity tutoring', grade_level: grade,
      activitySandbox: buildLiveActivitySpec(enabledFamilies, directVisuals), firstPrimitive: {
        primitive_type: 'live-activity-sandbox', instance_id: 'empty-workspace', primitive_data: { workspace: 'empty', gradeLevel: grade },
        topic: 'Live activity tutoring', grade_level: grade, owns_opening: true,
      },
    });
  };
  const stop = () => { runtime.stop(); transportRef.current?.close(); openingRef.current = null; commandRef.current = null; cancel(); ai.disconnect(); setReady(false); setConnecting(false); setActivity(null); setVisual(null); setPending(null); setSessionPlan(null); };
  const send = (message: string) => { if (message.trim() && ready) ai.sendText(message.trim(), { interrupt: true }); };
  const button = 'rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 hover:bg-indigo-400';
  const shownPlan = sessionPlan ?? projected.plan;
  const busy = connecting || ready;

  return <main className="min-h-screen bg-slate-950 p-6 text-slate-100">
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>{onBack ? <button onClick={onBack} className="text-sm text-indigo-300">← Back to testers</button>
          : <Link href="/lumina" className="text-sm text-indigo-300">← Lumina</Link>}
          <h1 className="mt-3 text-3xl font-semibold">{shownPlan ? shownPlan.topic : familyCopy(lessonPrimitive).title}</h1>
          <p className="mt-2 text-slate-400">{shownPlan
            ? `A planned ${shownPlan.gradeLevel} lesson. Your tutor starts each activity and moves on when you finish.`
            : 'Start the lesson. Your tutor introduces each problem, helps you practice, and works with you on the activity.'}</p>
        </div><span className="rounded-full border border-slate-700 px-3 py-1 text-sm">{ready ? 'Session ready' : connecting ? 'Connecting…' : 'Disconnected'}</span>
      </header>
      <section className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-800 bg-slate-900 p-4">
        {!planMode && <>
          <label>Activity <select aria-label="Activity" value={lessonPrimitive} disabled={busy} onChange={e => {
            const id = e.target.value as LivePrimitiveId; setLessonPrimitive(id); setLessonMode(familyCopy(id).lessons[0][0]);
            setFamilies(old => ({ ...old, [id]: true }));
          }} className="ml-2 rounded bg-slate-800 p-2">{LIVE_PRIMITIVE_IDS.map(id =>
            <option key={id} value={id}>{familyCopy(id).label}</option>)}</select></label>
          <label>Lesson <select aria-label="Lesson" value={lessonMode} disabled={busy} onChange={e => setLessonMode(e.target.value)} className="ml-2 rounded bg-slate-800 p-2">
            {familyCopy(lessonPrimitive).lessons.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></label>
          <label>Grade <select aria-label="Grade" value={grade} disabled={busy} onChange={e => setGrade(e.target.value)} className="ml-2 rounded bg-slate-800 p-2">
            {['Kindergarten', 'Grade 1', 'Grade 2'].map(g => <option key={g}>{g}</option>)}
          </select></label>
        </>}
        {!ready && !connecting ? <button className={button} disabled={(!planMode && !enabledFamilies.length && !directVisuals) || (!!pkg && !projected.plan) || !user} onClick={start}>Start lesson</button>
          : <button className={button} onClick={stop}>End session</button>}
        {ready && <button className={button} onClick={ai.isListening ? ai.stopListening : ai.startListening}>{ai.isListening ? 'Pause microphone' : 'Enable microphone'}</button>}
        {!user && <Link href="/login" className="text-indigo-300 underline">Sign in to start</Link>}
        <span className="text-xs text-slate-400">Practice here stays out of mastery records.</span>
      </section>
      <PlanPicker disabled={busy} pkg={pkg} objectiveId={objectiveId} plan={projected.plan} planError={loadError || projected.error}
        onPackage={file => void loadPackage(file)} onObjective={setObjectiveId}
        onClear={() => { setPkg(null); setObjectiveId(''); setLoadError(''); }} />
      {!planMode && <details className="rounded-xl border border-slate-800 p-4"><summary className="cursor-pointer text-sm text-slate-400">Sandbox tools</summary>
        <div className="mt-3 flex flex-wrap gap-4 text-sm">
          {LIVE_PRIMITIVE_IDS.map(id => <label key={id}>
            <input type="checkbox" checked={families[id]} disabled={busy} onChange={e => setFamilies(old => ({ ...old, [id]: e.target.checked }))} /> {familyCopy(id).checkbox}</label>)}
          <label><input type="checkbox" checked={directVisuals} disabled={busy} onChange={e => setDirectVisuals(e.target.checked)} /> Counters, fractions &amp; letter tiles</label>
          <label><input type="checkbox" checked={generatedPictures} disabled={busy} onChange={e => setGeneratedPictures(e.target.checked)} /> Teaching moves (composed shapes; pictures checked before showing)</label>
        </div>
      </details>}
      {error && <p role="alert" className="rounded-lg bg-red-950 p-3 text-red-200">{error}</p>}
      {ready && !ai.isListening && sessionPlan && <p role="status" className="rounded-lg bg-indigo-950 p-3">Enable the microphone above to begin the lesson. Your tutor will start as soon as it is ready.</p>}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="min-w-0 space-y-4">
          {sessionPlan && <ol aria-label="Lesson plan" className="flex flex-wrap gap-2 text-sm">
            {sessionPlan.items.map((item, i) => {
              const state = outcomes[item.itemId] ? 'done' : activity?.planItemId === item.itemId ? 'current' : 'upcoming';
              return <li key={item.itemId} data-state={state} className={`rounded-full border px-3 py-1 ${state === 'current' ? 'border-indigo-400 text-indigo-100' : state === 'done' ? 'border-emerald-700 text-emerald-300' : 'border-slate-700 text-slate-400'}`}>
                {i + 1}. {item.title}{state === 'done' ? ' ✓' : ''}
              </li>;
            })}
          </ol>}
          {drawing && <p role="status" className="rounded-lg bg-indigo-950 p-3">Your tutor is drawing a picture…</p>}
          {pending && <div role="status" className="flex items-center justify-between rounded-lg bg-indigo-950 p-3"><span>Preparing your activity…</span><button className="underline" onClick={() => cancel()}>Cancel</button></div>}
          {visual ? <ActivityBoundary key={visual.instanceId} onError={() => fail(visual.callId, 'The visual could not render.')}>
            <VisibleDirectVisual visual={visual} onVisible={onVisualVisible} onState={onVisualState} onControls={onVisualControls} />
          </ActivityBoundary> : activity ? <ActivityBoundary key={activity.instanceId} onError={() => fail(activity.callId, 'The activity could not render.')}>
            {<LiveRuntimeSurface runtime={runtime} learnerProgress={ready ? { disabled: ai.isAudioPlaying,
              act: type => void transportRef.current?.learnerProgress(type) } : undefined}><VisibleActivity activity={activity} onVisible={onVisible} onControls={onControls} /></LiveRuntimeSurface>}
          </ActivityBoundary> : <div className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700 p-8 text-center">
            <h2 className="text-xl">{shownPlan ? 'Your planned lesson is ready' : 'Your lesson is ready'}</h2><p className="mt-3 max-w-md text-slate-400">{shownPlan ? 'Press Start lesson and allow the microphone. Your tutor opens the first activity.' : 'Choose a lesson and press Start lesson. Allow the microphone, then your tutor will begin. No opening question needed.'}</p>
          </div>}
          <form onSubmit={e => { e.preventDefault(); send(text); setText(''); }} className="flex gap-2">
            <input aria-label="Message to tutor" className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 p-3" value={text} onChange={e => setText(e.target.value)} placeholder="Talk or type to the tutor…" />
            <button className={button} disabled={!ready || !text.trim()}>Send</button>
          </form>
          {ready && runtimeState.instanceId && <div className="flex flex-wrap gap-3">
            {runtimeState.affordances.some(a => a.action.type === 'scaffold') && <button className={button} onClick={() => send('Please show me a reminder for this task.')}>Help me start</button>}
            {runtimeState.affordances.some(a => a.action.type === 'request_support') && <button className={button} onClick={() => send('Please show me the worked example, keeping my task saved.')}>Show an example</button>}
            {generatedPictures && runtimeState.moveOptions && <button className={button} disabled={drawing} onClick={() => send('I am stuck. Please help me with this in a way that is different from what is already on my screen, keeping my task saved.')}>Help me another way</button>}
            {runtimeState.status === 'support' && <button className={button} onClick={() => send('I am ready to return to my saved task. Please close the example.')}>Return to my task</button>}
          </div>}
          {!planMode && <button className="text-sm text-indigo-300 disabled:opacity-40" disabled={!ready} onClick={() => send(visual ? 'Please give me another example using the same kind of visual.' : 'Please give me another example with a new number line.')}>Ask for another example</button>}
          {directVisuals && !planMode && <details><summary className="cursor-pointer text-sm text-slate-400">Explore another visual</summary><div className="mt-3 flex flex-wrap gap-2" aria-label="Try a visual">
            {['Show six counters and help me take away two.', 'Show three quarters as a fraction bar.', 'Help me blend the word ship using letter tiles.'].map(prompt =>
              <button key={prompt} disabled={!ready} className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-cyan-200 disabled:opacity-40" onClick={() => send(prompt)}>{prompt}</button>)}
          </div></details>}
        </section>
        <aside className="min-w-0 space-y-5">
          <section className="rounded-xl border border-slate-800 p-4"><h2 className="font-semibold">Conversation</h2>
            <div className="mt-3 max-h-80 space-y-2 overflow-y-auto text-sm" aria-live="polite">
              <ConversationTranscript messages={ai.conversation} />
            </div>
          </section>
          <JevInspector runtime={runtime} />
          <details open className="rounded-xl border border-slate-800 p-4"><summary className="cursor-pointer font-semibold">Experiment timeline</summary>
            <ol className="mt-3 max-h-80 space-y-3 overflow-y-auto text-xs text-slate-400">{logs.map((entry, i) => <li key={i}><time className="text-slate-500">{entry.at}</time><p>{entry.text}</p></li>)}</ol>
          </details>
        </aside>
      </div>
    </div>
  </main>;
}

export default function LiveActivitySandbox({ onBack }: { onBack?: () => void } = {}) {
  const makeRuntime = () => new LiveLessonRuntime(crypto.randomUUID(), { maxSupportLevel: 3, allowAnswerExposure: true, allowSupportArtifacts: true, allowGeneratedSupport: true });
  const [runtime, setRuntime] = useState(makeRuntime);
  const resetRuntime = () => { if (runtime.getSnapshot().status !== 'empty') runtime.stop(); const next = makeRuntime(); setRuntime(next); return next; };
  const handler = useRef<((event: Event) => void) | null>(null);
  const onEvent = useCallback((event: Event) => handler.current?.(event), []);
  // No EvaluationProvider: the existing primitive evaluates locally but cannot persist attempts.
  if (process.env.NODE_ENV === 'production') return null;
  return <LuminaAIProvider liveLessonRuntime={runtime} onActivityEvent={onEvent}><Workspace eventHandler={handler} onBack={onBack} runtime={runtime} resetRuntime={resetRuntime} /></LuminaAIProvider>;
}
