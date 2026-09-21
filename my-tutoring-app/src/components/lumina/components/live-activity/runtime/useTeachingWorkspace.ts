'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore, type MutableRefObject } from 'react';
import { flushSync } from 'react-dom';
import { useLuminaAIContext } from '@/contexts/LuminaAIContext';
import { useLiveRuntimeActive, usePrimitiveRuntime } from './LiveRuntimeContext';
import { TeachingSession, teachingSummary } from './TeachingSession';
import { SoundManager } from '../../../utils/SoundManager';
import { latestLearnerUtterance } from './learnerUtterance';
import type { ExecutableAffordance, RuntimeMount } from './contract';

export interface TeachingItem {
  id: string;
  task: string;
  /** Full assignment answer for tutor-feedback assessment, not a transcript parser. */
  expectedAnswer?: string;
  response: 'speech' | 'gesture';
  /** Checks gesture submissions only. Speech is judged by the tutor. The key stays private. */
  checkResponse: (response: string) => boolean | null;
}
export interface TeachingWorkspace {
  objects: Array<{ id: string; label: string; selected: boolean; group?: string }>;
  demonstration: string[];
  facts: Record<string, string | number>;
  readyForResponse: boolean;
  canDemonstrate: boolean;
  canPresent: boolean;
  mark: (ids: string[]) => void;
  clearPresentation: () => void;
}
export interface TeachingWorkspaceOptions {
  instanceId: string; primitiveId: string; objectiveId?: string; planItemId?: string; evalMode: string;
  items: TeachingItem[];
  workspace: MutableRefObject<TeachingWorkspace | null>;
  onItemOpened?: (index: number) => void;
  onPresentStimulus?: (index: number) => void;
}
const noSubscription = () => () => {};

/** Shared live teaching lifecycle. Domain bindings provide tasks, scene facts and a response checker. */
export function useTeachingWorkspace(options: TeachingWorkspaceOptions) {
  const ai = useLuminaAIContext();
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
  const item = options.items[state.index];
  const currentItem = () => latest.current.items[session.getSnapshot().index];
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
  const reset = () => {
    pendingSpeech.current = null;
    latest.current.workspace.current?.clearPresentation();
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
    primitiveId: options.primitiveId, evalMode: options.evalMode,
    adapter: {
      getTutorState: () => {
        const s = session.getSnapshot(), i = currentItem(), w = latest.current.workspace.current;
        const response = s.lastResponse;
        return { itemId: i.id, phase: suspended.current ? 'paused' : s.phase, task: i.task, completed: s.phase === 'completed',
          evidence: { attemptNumber: s.attempts.filter(a => a.itemId === i.id).length,
            correctness: response ? response.correct ? 'correct' : 'incorrect' : 'unknown',
            recentResponses: response ? [{ response: response.response, source: response.source, recognition: 'clear' }] : [] },
          demand: { ...w?.facts, response: i.response, presentation: w?.readyForResponse ? 'ready' : 'not ready' },
          support: { level: s.assisted ? 2 : 0, answerExposure: s.answerExposure },
          workspace: { progression: 'observer', objects: w?.objects ?? [], demonstration: w?.demonstration ?? [],
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
        operation('begin_help', 'Begin a teaching exchange. Use before verbal help, questions that guide the solution, or demonstration. Records assistance without submitting an answer. No parameters.',
          input => !input?.targets?.length && commit(() => session.assist()), true);
        if (w?.objects.length && w.canDemonstrate) {
          operation('demonstrate', 'Mark whole visible objects for a tutor demonstration. Supply targets from workspace.objects; [] clears it. These marks are NOT learner responses and do not change the assignment target. Only describe the marked objects; this action does not mark individual sides, corners, or other unregistered parts. Explain, then let the learner try.', input => {
            if (!Array.isArray(input?.targets)) return 'demonstrate needs targets: ids from workspace.objects, or [] to clear the marks.';
            const unknown = input.targets.filter(id => !latest.current.workspace.current?.objects.some(o => o.id === id));
            if (unknown.length) return `Not in workspace.objects: ${unknown.join(', ')}. Use ids listed there.`;
            return commit(() => { session.assist('full'); latest.current.workspace.current!.mark(input.targets!); return true; });
          }, true, 'full');
        }
        if (w?.canPresent && latest.current.onPresentStimulus && s.phase === 'working') operation('present',
          'Present this timed stimulus. Use only after preparing the learner; a repeat is assisted practice. No parameters.', input =>
          !input?.targets?.length && present(), presentations.current.has(i.id));
        if (i.response === 'speech' && pendingSpeech.current) actions.push({ controller: 'observer',
          action: { type: 'workspace', operation: 'apply_tutor_verdict' },
          description: 'Record observed tutor feedback for this spoken turn and its settled transition.',
          execute: input => {
            const d = input?.dialogue, speech = pendingSpeech.current;
            if (!d || !speech || d.responseId !== speech.id || (d.transition === 'advance' && d.verdict !== 'correct')) return false;
            return commit(() => {
              if (!session.submit(speech.id, speech.text, 'speech', d.verdict === 'correct', true, d.tutor)) return false;
              pendingSpeech.current = null;
              if (d.transition === 'retry') { session.retry(); reset(); }
              if (d.transition === 'advance') {
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
        if (s.phase === 'checked' && s.lastResponse?.correct) actions.push({ controller: 'observer', action: { type: 'advance' },
          description: 'After discussing the checked success, open the next blank item, or finish if this is the last. The new item has no inherited assistance.',
          execute: () => commit(() => {
            if (!session.advance()) return false;
            if (session.getSnapshot().phase !== 'completed') reset();
            else runtime?.afterVisibleResponse(() => { if (mounted.current) runtime.requestCompletion(); });
            return true;
          }) });
        return actions;
      },
      suspension: { suspend: () => { suspended.current = true; latest.current.workspace.current?.clearPresentation(); },
        resume: () => { suspended.current = false; } },
    },
  }), [options.instanceId, options.primitiveId, options.objectiveId, options.planItemId, options.evalMode, session]);
  useLayoutEffect(() => { mounted.current = true; suspended.current = false; return () => {
    mounted.current = false; suspended.current = true; pendingSpeech.current = null;
  }; }, [mount]);
  const { runtime, changed } = usePrimitiveRuntime(mount);
  const runtimeStatus = useSyncExternalStore(runtime?.subscribe ?? noSubscription,
    () => runtime?.getSnapshot().status ?? 'empty', () => 'empty');
  const settledSummary = useRef<ReturnType<typeof teachingSummary>>(null);
  if (runtimeStatus === 'completed' && runtime?.getSnapshot().instanceId === options.instanceId) {
    settledSummary.current = teachingSummary(options.items.map(i => i.id), state);
  }
  const summary = settledSummary.current;
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
    pendingSpeech.current = null;
    speechFloor.current = aiRef.current.conversation.length;
    wasReady.current = false;
  }, [active, ai.isConnected, ai.sessionResumeCount]);
  useEffect(() => { reset(); }, [session]);
  useEffect(() => ai.sharedVoiceTurns?.subscribe({
    onTurnClose: () => { void Promise.resolve().then(() => { if (mounted.current) publishWorkspace(); }); },
  }), [ai.sharedVoiceTurns, changed]);
  const publishWorkspace = () => {
    if (!activeRef.current) return;
    const ready = !!latest.current.workspace.current?.readyForResponse;
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
    }
    changed();
  };

  const submitGestureResponse = (response: string) => {
    if (!mounted.current || !activeRef.current || suspended.current || currentItem().id !== item.id || currentItem().response !== 'gesture') return;
    const correct = checkResponse(response);
    if (correct === null || !session.submit(`gesture:${++gestureSequence.current}`, response, 'gesture', correct)) return;
    // Facts trigger the live conversation. No prescribed words; the browser has already checked the response.
    const facts = `The learner submitted their selection. Current workspace response: ${JSON.stringify(session.getSnapshot().lastResponse)}. Respond to the learner using the current task and workspace.`;
    // This host-written message travels the learner-text channel; it is not a learner turn.
    runtime?.learner.expectHostText(facts);
    aiRef.current.sendText(facts, { scripted: false });
  };
  return { state, item, summary, submitGestureResponse, publishWorkspace, present: () => currentItem().id === item.id && present(),
    canAttempt: active && state.phase === 'working' && !suspended.current,
    isBlocked: () => !mounted.current || !activeRef.current || suspended.current || currentItem().id !== item.id || session.getSnapshot().phase !== 'working',
    tutorSpeaking: ai.isAudioPlaying, stop: () => runtime?.stop() };
}
