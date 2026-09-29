'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type MutableRefObject } from 'react';
import { flushSync } from 'react-dom';
import { useLuminaAIContext } from '@/contexts/LuminaAIContext';
import { useLiveRuntimeActive, usePrimitiveRuntime } from './LiveRuntimeContext';
import { TeachingSession, teachingSummary } from './TeachingSession';
import { abstainItemScore, gradeOf, scoreSession, type AttemptGrade, type ItemScoreDecision, type ItemScoreRequest,
  type ScoredSession } from './itemScoringContract';
import { OBSERVATION_TIMEOUT_MS, postObservation } from './observationContract';
import { abstainSpokenMiss, type KnownMiss, type SpokenMissDecision, type SpokenMissRequest } from './spokenMissContract';
import { SoundManager } from '../../../utils/SoundManager';
import { latestLearnerUtterance } from './learnerUtterance';
import { lastMiss, nextLever } from './observerLever';
import { useWorkspacePin } from './workspacePin';
import type { ExecutableAffordance, RuntimeMount, WorkspaceLever } from './contract';

export interface TeachingItem {
  id: string;
  task: string;
  /** Full assignment answer for tutor-feedback assessment, not a transcript parser. */
  expectedAnswer?: string;
  response: 'speech' | 'gesture';
  /** Checks gesture submissions only. Speech is judged by the tutor. The key stays private. */
  checkResponse: (response: string) => boolean | null;
  /**
   * A spoken item's known wrong answers, in precedence order (the family's `<x>SpokenMisses(item)`). The
   * `spoken_miss` observer maps a pending answer onto one of them, and a not-credited verdict records it as the
   * attempt's `miss`, as a gesture check does. Never published to the tutor: the patterns state the key.
   */
  misses?: KnownMiss[];
}
/**
 * What a primitive sets on `workspace.current` in a layout effect; the hook publishes it after every
 * render (handoff 19, slice 3). Only `objects` and `facts` are required: a binding with no
 * demonstration or timed stimulus leaves the rest out, and the defaults below apply.
 */
export interface TeachingWorkspace {
  objects: Array<{ id: string; label: string; selected: boolean; group?: string }>;
  facts: Record<string, string | number>;
  /** Ids the tutor has marked. Default none. */
  demonstration?: string[];
  /** Default true. False while a stimulus is still pending (a flash not yet shown, a die not yet rolled). */
  readyForResponse?: boolean;
  /** The tutor may mark `objects` (`mark`). Default false. */
  canDemonstrate?: boolean;
  /** A timed stimulus the tutor may present (`onPresentStimulus`). Default false. */
  canPresent?: boolean;
  mark?: (ids: string[]) => void;
  /** Clears marks and a presented stimulus when the item reopens or the activity is suspended. */
  clearPresentation?: () => void;
  /** The levers the primitive declares on its current item (`/add-support-tiers`). */
  levers?: WorkspaceLever[];
  /**
   * Pull one lever as a synchronous commit: the screen and the scene change before this returns.
   * `true` for a help lever; for a simplify lever, the simpler item now on screen in place of the
   * current one; or a refusal the tutor reads, leaving everything unchanged.
   */
  pullLever?: (id: string) => LeverPull;
  /** The simpler item is done: put the session item back on screen. Retry on the simpler item keeps it. */
  endPractice?: () => void;
}
export type LeverPull = true | string | { practice: TeachingAssignment };
/** An item as the tutor and the outcome observer are told it, without the private checker. */
export type TeachingAssignment = Omit<TeachingItem, 'checkResponse'>;
/**
 * What the tutor and the outcome observer are shown about the current item. Each domain
 * builds it with a pure `workspaceScene`, so the component and the verdict probe
 * (`scripts/tutor-verdict-probe.mjs`) send the same model input.
 */
export type WorkspaceScene = Pick<TeachingWorkspace, 'objects' | 'facts'>;
export interface TeachingWorkspaceOptions {
  instanceId: string; primitiveId: string; objectiveId?: string; planItemId?: string;
  items: TeachingItem[];
  workspace: MutableRefObject<TeachingWorkspace | null>;
  onItemOpened?: (index: number) => void;
  onPresentStimulus?: (index: number) => void;
  /**
   * A correct response was just committed for the item at `index`, synchronously and before any
   * advance. A verdict that also advances never renders the checked phase, so a primitive that
   * reveals or records on success reads its own state here rather than from a later render.
   */
  onSolved?: (index: number, response: string) => void;
  /** The activity's own check of a gesture on a simpler (practice) item, as `checkResponse` for a session item. */
  checkPractice?: (itemId: string, response: string) => boolean | null;
}
const noSubscription = () => () => {};
/** No scene yet is not ready; a scene that does not say otherwise is. */
const isReady = (w: TeachingWorkspace | null | undefined) => !!w && w.readyForResponse !== false;
const scoreAttempt = postObservation<ItemScoreRequest, ItemScoreDecision>('/api/lumina/observe-item-score', abstainItemScore);
const nameSpokenMiss = postObservation<SpokenMissRequest, SpokenMissDecision>('/api/lumina/observe-spoken-miss', abstainSpokenMiss);
/** The whole scoring pass waits at most this long; an attempt not graded by then keeps its flow verdict. */
export const SCORING_BUDGET_MS = 5000;

/** Shared live teaching lifecycle. Domain bindings provide tasks, scene facts and a response checker. */
export function useTeachingWorkspace(options: TeachingWorkspaceOptions) {
  const ai = useLuminaAIContext();
  // The mount's mode is the lesson's pin, from the family wrapper (`workspacePin.ts`).
  const evalMode = useWorkspacePin();
  const active = useLiveRuntimeActive();
  const activeRef = useRef(active); activeRef.current = active;
  const latest = useRef(options);
  const aiRef = useRef(ai);
  useLayoutEffect(() => { latest.current = options; aiRef.current = ai; });
  const session = useMemo(() => new TeachingSession(options.items.map(i => i.id)), [options.instanceId]);
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const celebratedItems = useMemo(() => new Set<string>(), [session]);
  useEffect(() => {
    for (const attempt of state.attempts) if (attempt.correct && !celebratedItems.has(attempt.itemId)) {
      celebratedItems.add(attempt.itemId);
      SoundManager.playCorrect();
    }
  }, [state.attempts, celebratedItems]);
  const mounted = useRef(false), suspended = useRef(false), gestureSequence = useRef(0);
  const presentations = useRef(new Set<string>());
  const speechFloor = useRef(ai.conversation.length);
  const wasReady = useRef(false);
  const examinedSpeech = useRef(new Set<string>());
  const pendingSpeech = useRef<{ id: string; text: string } | null>(null);
  /** The `spoken_miss` reading of the pending answer; `miss` is set once it lands (median 165 ms, before the tutor's reply). */
  const spokenMiss = useRef<{ speechId: string; miss: string | null; abort: AbortController } | null>(null);
  const dropSpokenMiss = () => { spokenMiss.current?.abort.abort(); spokenMiss.current = null; };
  /** The simpler item a simplify lever put on screen; the session holds only its id. */
  const practiceItem = useRef<TeachingItem | null>(null);
  const itemAt = (s: { index: number; practice: string | null }) =>
    s.practice && practiceItem.current?.id === s.practice ? practiceItem.current : latest.current.items[s.index];
  const item = state.practice && practiceItem.current?.id === state.practice ? practiceItem.current : options.items[state.index];
  const currentItem = () => itemAt(session.getSnapshot());
  const lastSpeech = () => {
    if (aiRef.current.sharedVoiceTurns?.isVoiceActive()) return null;
    return latestLearnerUtterance(aiRef.current.conversation, speechFloor.current);
  };
  const checkResponse = (text: string) => currentItem().checkResponse(text);
  const commit = (fn: () => boolean) => {
    if (!mounted.current || !activeRef.current || suspended.current) return false;
    let applied = false;
    flushSync(() => { applied = fn(); });
    return applied;
  };
  /** A new response scope on the same surface: speech heard before it is not an answer to it. */
  const rescope = () => {
    pendingSpeech.current = null; dropSpokenMiss();
    speechFloor.current = aiRef.current.conversation.length;
    wasReady.current = false;
  };
  const closePractice = () => {
    if (!session.closePractice()) return false;
    practiceItem.current = null;
    latest.current.workspace.current?.endPractice?.();
    reset();
    return true;
  };
  const reset = () => {
    pendingSpeech.current = null; dropSpokenMiss();
    latest.current.workspace.current?.clearPresentation?.();
    latest.current.onItemOpened?.(session.getSnapshot().index);
    speechFloor.current = aiRef.current.conversation.length;
    wasReady.current = false;
  };
  const present = () => commit(() => {
    const i = currentItem(), s = session.getSnapshot();
    if (s.phase !== 'working' || !latest.current.workspace.current?.canPresent || !latest.current.onPresentStimulus) return false;
    if (presentations.current.has(i.id)) session.assist();
    presentations.current.add(i.id);
    latest.current.onPresentStimulus(s.index);
    return true;
  });
  const mount = useMemo<RuntimeMount>(() => ({ instanceId: options.instanceId,
    objectiveId: options.objectiveId || options.primitiveId + '-practice', planItemId: options.planItemId || options.instanceId,
    primitiveId: options.primitiveId, evalMode,
    adapter: {
      getTutorState: () => {
        const s = session.getSnapshot(), i = currentItem(), w = latest.current.workspace.current;
        const response = s.lastResponse;
        return { itemId: i.id, phase: suspended.current ? 'paused' : s.phase, task: i.task, completed: s.phase === 'completed',
          evidence: { attemptNumber: s.attempts.filter(a => a.itemId === i.id).length,
            correctness: response ? response.correct ? 'correct' : 'incorrect' : 'unknown',
            recentResponses: response ? [{ response: response.response, source: response.source, recognition: 'clear' }] : [] },
          demand: { ...w?.facts, response: i.response, presentation: isReady(w) ? 'ready' : 'not ready' },
          support: { level: s.assisted ? 2 : 0, answerExposure: s.answerExposure },
          workspace: { progression: 'observer', objects: w?.objects ?? [], demonstration: w?.demonstration ?? [],
            ...(w?.levers?.length ? { levers: w.levers } : {}),
            ...(s.practice ? { practice: { returnsTo: latest.current.items[s.index].id } } : {}),
            ...(i.expectedAnswer !== undefined ? { expectedAnswer: i.expectedAnswer } : {}),
            ...(pendingSpeech.current ? { pendingResponse: pendingSpeech.current } : {}),
            lastResponse: response, attempts: s.attempts.slice(-20) } };
      },
      getAffordances: () => {
        const s = session.getSnapshot(), i = currentItem(), w = latest.current.workspace.current;
        if (!mounted.current || !activeRef.current || suspended.current || s.phase === 'completed') return [];
        const actions: ExecutableAffordance[] = [];
        const operation = (name: string, description: string, execute: ExecutableAffordance['execute'], assisted = false, exposure: 'none' | 'full' = 'none') => {
          actions.push({ action: { type: 'workspace', operation: name }, description, execute,
            ...(assisted ? { assistance: { level: 2, answerExposure: exposure } } : {}) });
        };
        // A lever on offer changes the screen and records the help itself; begin_help described as THE
        // step before guiding questions drew the tutor into words instead (number-line bench 09-27: 0/3 pulls).
        const leverOffered = !!w?.pullLever && !!w.levers?.some(l => !l.pulled) && !s.practice;
        operation('begin_help', leverOffered
          ? 'Begin a teaching exchange in words only. Records assistance without submitting an answer. No parameters. '
            + 'When the learner is stuck on this item, use pull_lever instead: it changes the screen and records the help itself.'
          : 'Begin a teaching exchange. Use before verbal help, questions that guide the solution, or demonstration. Records assistance without submitting an answer. No parameters.',
          input => !input?.targets?.length && commit(() => session.assist()), true);
        if (w?.objects.length && w.canDemonstrate && w.mark) {
          operation('demonstrate', 'Mark whole visible objects for a tutor demonstration. Supply targets from workspace.objects; [] clears it. These marks are NOT learner responses and do not change the assignment target. Only describe the marked objects; this action does not mark individual sides, corners, or other unregistered parts. Explain, then let the learner try.', input => {
            if (!Array.isArray(input?.targets)) return 'demonstrate needs targets: ids from workspace.objects, or [] to clear the marks.';
            const unknown = input.targets.filter(id => !latest.current.workspace.current?.objects.some(o => o.id === id));
            if (unknown.length) return `Not in workspace.objects: ${unknown.join(', ')}. Use ids listed there.`;
            return commit(() => { session.assist('full'); latest.current.workspace.current!.mark!(input.targets!); return true; });
          }, true, 'full');
        }
        const pullable = w?.levers?.filter(l => !l.pulled) ?? [];
        if (pullable.length && w?.pullLever && !s.practice && !(s.phase === 'checked' && s.lastResponse?.correct)) operation('pull_lever',
          'Pull one lever from workspace.levers on this item when the learner is stuck: pick the one whose "when" fits why. '
          + 'It changes the screen and is recorded as help. Supply lever: its id (without one, the first help lever is pulled). Wait for the visible result, then say what changed, '
          + 'in your own words, and let the learner try. A simplify lever opens an easier practice item first; the full item comes back after it.',
          input => {
            // A call without a lever pulls the one the observer would (number-line --audio 09-27: the tutor sent
            // pull_lever {} and the refusal left the stuck learner waiting for the observer).
            const levers = latest.current.workspace.current?.levers ?? [];
            const id = input?.lever || nextLever(levers, lastMiss(session.getSnapshot().attempts, currentItem().id));
            if (!id) return 'Every lever on this item is already pulled; their changes are on screen.';
            const lever = levers.find(l => l.id === id);
            if (!lever) return `No lever ${id} here. Levers: ${levers.map(l => l.id).join(', ')}.`;
            if (lever.pulled) return `${id} is already pulled; its change is on screen.`;
            let refusal: string | null = null;
            const applied = commit(() => {
              const pulled = latest.current.workspace.current?.pullLever?.(id);
              if (pulled === undefined || typeof pulled === 'string') { refusal = pulled ?? 'This item has no levers now.'; return false; }
              if (pulled !== true) {
                practiceItem.current = { ...pulled.practice, checkResponse: response =>
                  latest.current.checkPractice?.(pulled.practice.id, response) ?? null };
                if (!session.openPractice(pulled.practice.id)) {
                  practiceItem.current = null; latest.current.workspace.current?.endPractice?.();
                  refusal = 'The easier item could not open here.'; return false;
                }
                rescope();
              }
              session.assist('none', id);
              return true;
            });
            return refusal ?? applied;
          }, true);
        if (w?.canPresent && latest.current.onPresentStimulus && s.phase === 'working') operation('present',
          'Present this timed stimulus. Use only after preparing the learner; a repeat is assisted practice. No parameters.', input =>
          !input?.targets?.length && present(), presentations.current.has(i.id));
        if (i.response === 'speech' && pendingSpeech.current) actions.push({ controller: 'observer',
          action: { type: 'workspace', operation: 'apply_tutor_verdict' },
          description: 'Record observed tutor feedback for this spoken turn and its settled transition.',
          execute: input => {
            const d = input?.dialogue, speech = pendingSpeech.current;
            if (!d || !speech || d.responseId !== speech.id || (d.transition === 'advance' && d.verdict !== 'correct')) return false;
            // Only a reading of THIS answer that has already landed; a late one is dropped, never attached afterwards.
            const miss = d.verdict !== 'correct' && spokenMiss.current?.speechId === speech.id ? spokenMiss.current.miss ?? undefined : undefined;
            return commit(() => {
              if (!session.submit(speech.id, speech.text, 'speech', d.verdict === 'correct', true, d.tutor, miss)) return false;
              pendingSpeech.current = null; dropSpokenMiss();
              if (d.verdict === 'correct' && !session.getSnapshot().practice) latest.current.onSolved?.(session.getSnapshot().index, speech.text);
              if (d.transition === 'retry') { session.retry(); reset(); }
              if (d.transition === 'advance' && session.getSnapshot().practice) closePractice();
              else if (d.transition === 'advance') {
                session.advance();
                if (session.getSnapshot().phase !== 'completed') reset();
                else runtime?.afterVisibleResponse(() => { if (mounted.current) runtime.requestCompletion(); });
              }
              return true;
            });
          } });
        if (s.phase === 'checked') actions.push({ controller: 'observer', action: { type: 'retry' },
          description: 'Reopen this same item and clear the working surface. Preserve all attempts and assistance. No automatic correction or speech.',
          execute: () => commit(() => { if (!session.retry()) return false; reset(); return true; }) });
        if (s.phase === 'checked' && s.lastResponse?.correct && s.practice) actions.push({ controller: 'observer', action: { type: 'advance' },
          description: 'After discussing the easier practice item, return to the full item it stood in for, blank. Its levers and assistance stay recorded.',
          execute: () => commit(closePractice) });
        else if (s.phase === 'checked' && s.lastResponse?.correct) actions.push({ controller: 'observer', action: { type: 'advance' },
          description: 'After discussing the checked success, open the next blank item, or finish if this is the last. The new item has no inherited assistance.',
          execute: () => commit(() => {
            if (!session.advance()) return false;
            if (session.getSnapshot().phase !== 'completed') reset();
            else runtime?.afterVisibleResponse(() => { if (mounted.current) runtime.requestCompletion(); });
            return true;
          }) });
        // The lever first: a stuck learner's tutor reads the choices in order.
        const lever = actions.findIndex(a => a.action.type === 'workspace' && a.action.operation === 'pull_lever');
        if (lever > 0) actions.unshift(...actions.splice(lever, 1));
        return actions;
      },
      suspension: { suspend: () => { suspended.current = true; latest.current.workspace.current?.clearPresentation?.(); },
        resume: () => { suspended.current = false; } },
    },
  }), [options.instanceId, options.primitiveId, options.objectiveId, options.planItemId, evalMode, session]);
  useLayoutEffect(() => { mounted.current = true; suspended.current = false; return () => {
    mounted.current = false; suspended.current = true; pendingSpeech.current = null; dropSpokenMiss();
  }; }, [mount]);
  const { runtime, changed } = usePrimitiveRuntime(mount);
  const runtimeStatus = useSyncExternalStore(runtime?.subscribe ?? noSubscription,
    () => runtime?.getSnapshot().status ?? 'empty', () => 'empty');
  const settledSummary = useRef<ReturnType<typeof teachingSummary>>(null);
  if (runtimeStatus === 'completed' && runtime?.getSnapshot().instanceId === options.instanceId) {
    settledSummary.current = teachingSummary(options.items.map(i => i.id), state);
  }
  const summary = settledSummary.current;
  // The scoring pass (user direction 09-24): the flow verdicts moved the lesson; the RECORD comes from
  // re-grading each spoken attempt's own answer once the session completes. Submissions wait for it;
  // the practice summary on screen does not. Gesture attempts keep their code check.
  const [gradedScore, setGradedScore] = useState<ScoredSession | null>(null);
  const scoringStarted = useRef(false);
  const spokenToGrade = !!summary && state.attempts.some(a => a.source === 'speech');
  useEffect(() => {
    if (!summary || !spokenToGrade || scoringStarted.current) return;
    scoringStarted.current = true;
    const items = new Map(latest.current.items.map(i => [i.id, i]));
    const ids = latest.current.items.map(i => i.id), attempts = state, epoch = runtime?.getSnapshot().sessionEpoch || 'session';
    const abort = new AbortController(), timer = setTimeout(() => abort.abort(), SCORING_BUDGET_MS);
    const grades = attempts.attempts.map((a, attemptIndex): Promise<AttemptGrade | undefined> => {
      const item = items.get(a.itemId);
      if (a.source !== 'speech' || item?.expectedAnswer === undefined || !a.response.trim()) return Promise.resolve(undefined);
      return scoreAttempt({ scope: { sessionEpoch: epoch, instanceId: latest.current.instanceId, itemId: a.itemId }, attemptIndex,
        task: item.task.slice(0, 1500), expectedAnswer: String(item.expectedAnswer).slice(0, 2000),
        learner: a.response.slice(-2000), tutor: (a.tutorResponse ?? '').slice(-4000) }, abort.signal)
        .then(gradeOf, () => 'unclear' as const);
    });
    void Promise.all(grades).then(g => {
      const scoredSession = scoreSession(ids, attempts, g);
      // Inspectable like every observation: what each spoken attempt was graded, and where the record departs from the flow.
      runtime?.trace.record({ stage: 'item_scoring', status: 'context', reason: `Scoring pass: ${scoredSession.disagreements} `
        + `attempt(s) recorded differently from the flow verdict.`, input: { grades: g.map((grade, i) => ({
          itemId: attempts.attempts[i].itemId, source: attempts.attempts[i].source, flowCorrect: attempts.attempts[i].correct,
          grade: grade ?? (attempts.attempts[i].source === 'speech' ? 'unclear' : 'activity_check') })) } });
      if (mounted.current) setGradedScore(scoredSession);
    })
      .finally(() => clearTimeout(timer));
  }, [summary, spokenToGrade, state, runtime]);
  const scored = useMemo(() => !summary ? null : spokenToGrade ? gradedScore
    : scoreSession(options.items.map(i => i.id), state, []), [summary, spokenToGrade, gradedScore, state, options.items]);
  useEffect(() => {
    if (!active || !runtime || !settledSummary.current) return;
    const restoreCompletion = () => {
      const snapshot = runtime.getSnapshot();
      if (snapshot.instanceId === options.instanceId && snapshot.status === 'active'
          && snapshot.task?.completed && snapshot.visibleRevision === snapshot.revision) runtime.requestCompletion();
    };
    const off = runtime.subscribe(restoreCompletion); restoreCompletion();
    return off;
  }, [active, runtime, runtimeStatus, options.instanceId]);
  useLayoutEffect(() => {
    // A focus/reconnect boundary cannot reuse speech heard on another surface.
    pendingSpeech.current = null; dropSpokenMiss();
    speechFloor.current = aiRef.current.conversation.length;
    wasReady.current = false;
  }, [active, ai.isConnected, ai.sessionResumeCount]);
  useEffect(() => { reset(); }, [session]);
  // The primitive's layout effects set `workspace.current`; this passive effect runs after all of them, in
  // this component and its children, so every render's scene reaches the tutor without a publish call of its own.
  // Unchanged scenes publish nothing (`changed` compares).
  useEffect(() => { if (mounted.current) publishWorkspace(); });
  useEffect(() => ai.sharedVoiceTurns?.subscribe({
    onTurnClose: () => { void Promise.resolve().then(() => { if (mounted.current) publishWorkspace(); }); },
  }), [ai.sharedVoiceTurns, changed]);
  const publishWorkspace = () => {
    if (!activeRef.current) return;
    const ready = isReady(latest.current.workspace.current);
    if (ready && !wasReady.current) speechFloor.current = aiRef.current.conversation.length;
    wasReady.current = ready;
    // Spoken input supplies context. Completed tutor feedback owns its judgment;
    // gestures retain the activity checker at their source.
    const speech = lastSpeech();
    if (ready && mounted.current && !suspended.current && currentItem().response === 'speech'
        && (session.getSnapshot().phase === 'working' || session.getSnapshot().phase === 'checked' && session.getSnapshot().lastResponse?.correct === false) && speech
        && !examinedSpeech.current.has(speech.id)) {
      examinedSpeech.current.add(speech.id);
      pendingSpeech.current = { id: speech.id, text: speech.text };
      runtime?.trace.record({ stage: 'learner_response', status: 'context', reason: 'Awaiting tutor feedback; transcript is supporting context.',
        input: { task: currentItem().task, utterance: speech.text,
          scope: { instanceId: latest.current.instanceId, itemId: currentItem().id } } });
      observeSpokenMiss(speech);
    }
    changed();
  };

  /**
   * Handoff 20 Part B: which of the item's known wrong answers this pending answer is, read from the learner's
   * words in parallel with the tutor's reply. Advisory: it judges no credit and moves nothing; the dialogue
   * observer's not-credited verdict carries it onto the attempt, where the packet and `nextLever` read it.
   */
  const observeSpokenMiss = (speech: { id: string; text: string }) => {
    dropSpokenMiss();
    const i = currentItem(), epoch = runtime?.getSnapshot().sessionEpoch;
    if (!i.misses?.length || i.expectedAnswer === undefined || !epoch) return;
    const abort = new AbortController(), entry = { speechId: speech.id, miss: null as string | null, abort };
    spokenMiss.current = entry;
    const request: SpokenMissRequest = { scope: { sessionEpoch: epoch, instanceId: latest.current.instanceId, itemId: i.id },
      task: i.task.slice(0, 1500), expectedAnswer: String(i.expectedAnswer).slice(0, 2000), learner: speech.text.slice(-2000), misses: i.misses };
    const timer = setTimeout(() => abort.abort(), OBSERVATION_TIMEOUT_MS);
    void nameSpokenMiss(request, abort.signal).catch(() => abstainSpokenMiss(abort.signal.aborted ? 'timeout' : 'unavailable'))
      .then(decision => {
        if (spokenMiss.current !== entry) return;
        entry.miss = decision.miss;
        runtime?.trace.record({ stage: 'spoken_miss', status: decision.miss ? 'named' : decision.accepted ? 'unnamed' : 'abstained',
          reason: decision.reason, input: request, result: decision });
      })
      .finally(() => clearTimeout(timer));
  };

  const submitGestureResponse = (response: string, miss?: string) => {
    if (!mounted.current || !activeRef.current || suspended.current || currentItem().id !== item.id || currentItem().response !== 'gesture') return;
    const correct = checkResponse(response);
    if (correct === null || !session.submit(`gesture:${++gestureSequence.current}`, response, 'gesture', correct, false, undefined, miss)) return;
    if (correct && !session.getSnapshot().practice) latest.current.onSolved?.(session.getSnapshot().index, response);
    // Facts trigger the live conversation. No prescribed words; the browser has already checked the response.
    const facts = `The learner submitted their selection. Current workspace response: ${JSON.stringify(session.getSnapshot().lastResponse)}. Respond to the learner using the current task and workspace.`;
    aiRef.current.sendText(facts, { scripted: false, author: 'host' });
  };
  return { state, item, summary, scored, submitGestureResponse, publishWorkspace, present: () => currentItem().id === item.id && present(),
    currentItemId: () => currentItem().id,
    canAttempt: active && state.phase === 'working' && !suspended.current,
    isBlocked: () => !mounted.current || !activeRef.current || suspended.current || currentItem().id !== item.id || session.getSnapshot().phase !== 'working',
    tutorSpeaking: ai.isAudioPlaying, stop: () => runtime?.stop() };
}
