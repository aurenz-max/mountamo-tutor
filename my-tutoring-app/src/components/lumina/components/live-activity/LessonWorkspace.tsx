'use client';

import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { LuminaAIProvider, useLuminaAIContext, type LessonConnectionInfo } from '@/contexts/LuminaAIContext';
import type { ExhibitData } from '../../types';
import { LiveLessonRuntime } from './runtime/LiveLessonRuntime';
import { RuntimeTransport, runtimePacket, type ComposedDemonstration, type DemonstrationNeed } from './runtime/runtimeTransport';
import { demonstrationEvidence, requestDemonstration } from './demo/demonstrationEvidence';
import { lessonPrimitiveContext, lessonWorkspaceItems, type LessonWorkspaceItem } from './lessonWorkspacePlan';
import { waitForVisible } from './runtime/waitForVisible';
import { LiveRuntimeActiveContext, LiveRuntimeConnectionContext, LiveRuntimeContext } from './runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from './runtime/LiveRuntimeSurface';

interface LessonWorkspaceContextValue {
  runtime: LiveLessonRuntime;
  items: Map<string, LessonWorkspaceItem>;
  activeId: string | null;
  focus: (id: string) => void;
  /** The learner's Try again / Next challenge on a checked item, through the lesson's own transport. */
  learnerProgress: (type: 'advance' | 'retry') => void;
  /** LA-15: the lesson facts a demonstration is authored against, per section. Absent = no demonstrations. */
  demonstrationContext?: (instanceId: string) => DemonstrationContext | null;
}

/** What the demonstration author needs about the section beyond the runtime's own snapshot. */
export interface DemonstrationContext { topic: string; gradeLevel: string; grade: string; objectiveText: string }

/** Reads a lesson section's objective and grade from the manifest layout the flatten step stamped. */
export function lessonDemonstrationContext(exhibit: ExhibitData) {
  return (instanceId: string): DemonstrationContext | null => {
    const config = exhibit.manifest?.layout?.find(item => item.instanceId === instanceId)?.config;
    const objectiveText = typeof config?.objectiveText === 'string' ? config.objectiveText : null;
    const grade = typeof config?.objectiveGrade === 'string' ? config.objectiveGrade : null;
    return objectiveText && grade ? { topic: exhibit.topic, gradeLevel: exhibit.manifest?.gradeLevel ?? 'elementary', grade, objectiveText } : null;
  };
}
const Context = createContext<LessonWorkspaceContextValue | null>(null);
export const useLessonWorkspace = () => useContext(Context);

/** Normal lesson entry. Primitives submit through the existing evaluation provider. */
export function LessonWorkspaceProvider({ exhibit, children }: { exhibit: ExhibitData; children: React.ReactNode }) {
  const items = useMemo(() => lessonWorkspaceItems(exhibit), [exhibit]);
  const demonstrationContext = useMemo(() => lessonDemonstrationContext(exhibit), [exhibit]);
  return <WorkspaceHostProvider scope="lesson" items={items} demonstrationContext={demonstrationContext}
    initialActiveId={exhibit.orderedComponents?.find(s => s.audience !== 'caregiver')?.instanceId ?? null}>{children}</WorkspaceHostProvider>;
}

/**
 * One runtime scope and the Live session that serves it. A lesson passes every section it
 * binds; Pulse passes its one current item and remounts the scope per item. With no bound
 * item the provider carries no runtime, so every primitive keeps its ordinary path.
 */
export function WorkspaceHostProvider({ scope, items, initialActiveId, demonstrationContext, children }: {
  scope: string; items: Map<string, LessonWorkspaceItem>; initialActiveId: string | null;
  demonstrationContext?: (instanceId: string) => DemonstrationContext | null; children: React.ReactNode;
}) {
  const runtime = useMemo(() => new LiveLessonRuntime(`${scope}-${crypto.randomUUID()}`,
    { maxSupportLevel: 3, allowAnswerExposure: true, allowSupportArtifacts: false, allowDemonstrations: !!demonstrationContext }),
    [scope, items, demonstrationContext]);
  const [activeId, setActiveId] = useState<string | null>(initialActiveId);
  const handler = useRef<(event: Record<string, any>) => void>(() => {});
  const onEvent = useCallback((event: Record<string, any>) => handler.current(event), []);
  const progress = useRef<(type: 'advance' | 'retry') => void>(() => {});
  const learnerProgress = useCallback((type: 'advance' | 'retry') => progress.current(type), []);
  const value = useMemo(() => ({ runtime, items, activeId, focus: setActiveId, learnerProgress, demonstrationContext }),
    [runtime, items, activeId, learnerProgress, demonstrationContext]);
  return <Context.Provider value={value}>
    <LuminaAIProvider liveLessonRuntime={items.size ? runtime : undefined} onActivityEvent={onEvent}>
      <LessonWorkspaceBridge handler={handler} progress={progress} />{children}
    </LuminaAIProvider>
  </Context.Provider>;
}

/** Props a bound primitive mounts with: the resolved mode and plan item, never inferred. */
export function workspaceMountProps(binding: LessonWorkspaceItem | undefined) {
  return binding ? { runtimePlanItemId: binding.planItemId, runtimeEvalMode: binding.evalMode, autoStart: true } : {};
}

/**
 * The mounted half of the host, shared by every host. A bound primitive gets the runtime, the
 * focus flag, the connection epoch and the shared surface; an unbound one gets none of them, so
 * it cannot register a legacy adapter on the runtime. An inactive bound surface stays mounted on
 * the workspace controller without consuming speech.
 */
export function WorkspaceSection({ instanceId, children }: { instanceId: string; children: React.ReactNode }) {
  const host = useLessonWorkspace();
  const ai = useLuminaAIContext();
  if (!host) return <>{children}</>;
  const bound = host.items.has(instanceId);
  const active = host.activeId === instanceId && ai.isConnected;
  return <LiveRuntimeContext.Provider value={bound ? host.runtime : null}>
    <LiveRuntimeActiveContext.Provider value={bound && active}>
      <LiveRuntimeConnectionContext.Provider value={ai.sessionResumeCount ?? 0}>
        {bound ? <LiveRuntimeSurface runtime={host.runtime} active={active}
          learnerProgress={{ act: host.learnerProgress, disabled: ai.isAudioPlaying }}>{children}</LiveRuntimeSurface> : children}
      </LiveRuntimeConnectionContext.Provider>
    </LiveRuntimeActiveContext.Provider>
  </LiveRuntimeContext.Provider>;
}

/** Author a demonstration for the section the tutor is looking at, from the runtime's own snapshot and the lesson facts. */
async function composeLessonDemonstration(host: LessonWorkspaceContextValue, need: DemonstrationNeed, signal: AbortSignal): Promise<ComposedDemonstration> {
  const state = host.runtime.getSnapshot();
  const lesson = state.instanceId ? host.demonstrationContext?.(state.instanceId) : null;
  const evidence = demonstrationEvidence(state);
  if (!lesson || !evidence) return { refused: 'This section has no lesson objective to demonstrate against. Teach in words.' };
  return requestDemonstration('', { lesson, evidence, note: need.note }, signal);
}

function LessonWorkspaceBridge({ handler, progress }: {
  handler: React.MutableRefObject<(event: Record<string, any>) => void>;
  progress: React.MutableRefObject<(type: 'advance' | 'retry') => void>;
}) {
  const host = useLessonWorkspace()!;
  const hostRef = useRef(host); hostRef.current = host;
  const ai = useLuminaAIContext();
  const aiRef = useRef(ai); aiRef.current = ai;
  const transport = useRef<RuntimeTransport | null>(null);
  const [ready, setReady] = useState(0);
  // Recreate on a focus or connection boundary: late feedback belongs to the old turn.
  useLayoutEffect(() => {
    const current = new RuntimeTransport(host.runtime, message => aiRef.current.sendActivityMessage(message));
    transport.current = current;
    return () => { current.close(); transport.current = null; };
  }, [host.runtime, host.activeId, ai.isConnected, ready]);
  useLayoutEffect(() => {
    handler.current = event => {
      const t = transport.current;
      switch (event.type) {
        case 'runtime_command': void t?.command(event.command); break;
        case 'runtime_cancelled': t?.cancel(event.commandId); break;
        case 'runtime_request_demonstration': void t?.requestDemonstration(event.commandId, event.scope, event.need,
          (need, signal) => composeLessonDemonstration(hostRef.current, need, signal)); break;
        case 'runtime_turn_output': t?.beginTurn(String(event.text ?? '')); break;
        case 'runtime_learner_text': t?.learnerText(String(event.text ?? ''), event.finished === true); break;
        case 'runtime_host_text': t?.hostText(); break;
        case 'runtime_turn_end': t?.endTurn(event.audioPending === true); break;
        case 'runtime_audio_idle': t?.audioChanged(false); break;
        case 'runtime_interrupted': t?.dialogue.interrupt(); t?.endTurn(false); break;
        case 'session_ready': case 'session_resumed': setReady(n => n + 1); break;
        case 'session_resuming': case 'session_ended': case 'activity_session_closed': t?.close(); break;
      }
    };
    progress.current = type => void transport.current?.learnerProgress(type);
    return () => { handler.current = () => {}; progress.current = () => {}; };
  }, [handler, progress]);
  useEffect(() => {
    if (!ai.isConnected || !ready || !host.activeId || !host.items.has(host.activeId)) return;
    const abort = new AbortController();
    const instanceId = host.activeId;
    let opened = false;
    const introduce = async () => {
      const state = host.runtime.getSnapshot();
      if (opened || state.instanceId !== instanceId || !state.task) return;
      opened = true;
      const receipt = await waitForVisible(host.runtime, state.revision, { signal: abort.signal });
      if (abort.signal.aborted) return;
      if (receipt.status !== 'visible') { opened = false; return; }
      transport.current?.publish();
      aiRef.current.sendText('The learner is viewing the current lesson workspace. Call observe_runtime to receive its current task and ongoing updates, then continue teaching naturally. If completed, let the learner use Next. Do not read state or answers aloud.', { silent: true });
    };
    const off = host.runtime.subscribe(() => { void introduce(); });
    void introduce();
    return () => { abort.abort(); off(); };
  }, [host.runtime, host.activeId, host.items, ai.isConnected, ready]);
  return null;
}

export function workspaceConnectionInfo(info: LessonConnectionInfo, host: LessonWorkspaceContextValue | null): LessonConnectionInfo {
  if (!host?.items.size) return info;
  const binding = host.items.get(info.firstPrimitive.instance_id);
  return { ...info, runtimeLesson: { sessionEpoch: host.runtime.sessionEpoch, initialState: runtimePacket(host.runtime.getSnapshot()),
      ...(host.demonstrationContext ? { demonstrations: true } : {}) },
    firstPrimitive: binding ? { ...info.firstPrimitive, ...lessonPrimitiveContext({ componentId: binding.primitiveId, instanceId: binding.instanceId,
      data: info.firstPrimitive.primitive_data, title: '' }, binding) } : info.firstPrimitive };
}
