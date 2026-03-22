'use client';

import React, { useReducer, useCallback, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { getPrimitive } from '../config/primitiveRegistry';
import { KnowledgeCheck } from '../primitives/KnowledgeCheck';
import { AIHelper } from '../components/AIHelper';
import { EvaluationProvider } from '../evaluation';
import { pulseApi } from './pulseApi';
import type { ComponentId, HydratedPracticeItem, SessionBrief } from '../types';
import type { PrimitiveEvaluationResult } from '../evaluation/types';
import type { GradeLevel } from '../components/GradeLevelSelector';
import type {
  PulseItemSpec,
  PulseBand,
  PulseResultResponse,
  GateProgress,
  IrtProbabilityData,
  LeapfrogEvent,
  RecentPrimitive,
  SessionFrontierContext,
} from './types';
import { BAND_LABELS, BAND_COLORS, BAND_BG_COLORS } from './types';
import { FrontierContextCard } from './FrontierContextCard';

// ---------------------------------------------------------------------------
// Logging prefix
// ---------------------------------------------------------------------------

const LOG = '[Pulse]';

// ---------------------------------------------------------------------------
// Reducer state & actions
// ---------------------------------------------------------------------------

export type ItemStatus = 'pending' | 'hydrating' | 'active' | 'completed' | 'error';

export interface ItemState {
  spec: PulseItemSpec;
  status: ItemStatus;
  hydrated: HydratedPracticeItem | null;
  /** Primitive component ID resolved after hydration */
  primitiveId: string | null;
  /** Score from primitive evaluation (0-100) */
  score: number | null;
  durationMs: number | null;
  backendResult: PulseResultResponse | null;
}

/** Manifest-level info for an item (received before full hydration) */
interface ManifestItemInfo {
  componentId: string;
  title?: string;
}

interface RendererState {
  phase: 'hydrating' | 'practicing' | 'submitting' | 'leapfrog' | 'complete' | 'error';
  currentIndex: number;
  items: ItemState[];
  streamingMessage: string;
  latestGateProgress: GateProgress | null;
  latestIrt: IrtProbabilityData | null;
  latestSigma: number | null;
  leapfrogs: LeapfrogEvent[];
  error: string | null;
  /** How many items the stream has finished hydrating so far */
  hydratedCount: number;
  /** Manifest-level info per item (component IDs, titles) */
  manifestItems: ManifestItemInfo[];
  /** Evaluation result from the primitive, held until "Next" is clicked */
  pendingEval: {
    evalResult: PrimitiveEvaluationResult;
    score: number;
    durationMs: number;
  } | null;
}

type RendererAction =
  | { type: 'STREAMING_MESSAGE'; message: string }
  | { type: 'MANIFEST_RECEIVED'; items: ManifestItemInfo[] }
  | { type: 'ITEM_HYDRATED'; index: number }
  | { type: 'BATCH_HYDRATION_COMPLETE'; hydrated: HydratedPracticeItem[] }
  | { type: 'HYDRATION_FAILED'; error: string }
  | { type: 'ITEM_EVALUATED'; evalResult: PrimitiveEvaluationResult; score: number; durationMs: number }
  | { type: 'SUBMIT_START' }
  | { type: 'SUBMIT_COMPLETE'; response: PulseResultResponse }
  | { type: 'SUBMIT_FAILED'; error: string }
  | { type: 'ADVANCE'; nextIndex: number }
  | { type: 'LEAPFROG'; event: LeapfrogEvent }
  | { type: 'LEAPFROG_DONE' }
  | { type: 'SESSION_COMPLETE' }
  | { type: 'RETRY' };

function initState(specs: PulseItemSpec[]): RendererState {
  return {
    phase: 'hydrating',
    currentIndex: 0,
    items: specs.map((spec) => ({
      spec,
      status: 'pending',
      hydrated: null,
      primitiveId: null,
      score: null,
      durationMs: null,
      backendResult: null,
    })),
    streamingMessage: 'Preparing your activities...',
    latestGateProgress: null,
    latestIrt: null,
    latestSigma: null,
    leapfrogs: [],
    error: null,
    hydratedCount: 0,
    manifestItems: [],
    pendingEval: null,
  };
}

function reducer(state: RendererState, action: RendererAction): RendererState {
  switch (action.type) {
    case 'STREAMING_MESSAGE':
      return { ...state, streamingMessage: action.message };

    case 'MANIFEST_RECEIVED':
      return { ...state, manifestItems: action.items };

    case 'ITEM_HYDRATED':
      return { ...state, hydratedCount: action.index + 1 };

    case 'BATCH_HYDRATION_COMPLETE': {
      // All items hydrated at once — stamp them and activate the first
      const items = state.items.map((item, i) => {
        const hydrated = action.hydrated[i] ?? null;
        const primitiveId = hydrated
          ? String(hydrated.manifestItem.visualPrimitive?.componentId || hydrated.manifestItem.standardProblem?.problemType || 'unknown')
          : null;
        return { ...item, status: (i === 0 ? 'active' : 'pending') as ItemStatus, hydrated, primitiveId };
      });
      return { ...state, phase: 'practicing', currentIndex: 0, items, streamingMessage: '' };
    }

    case 'HYDRATION_FAILED':
      return { ...state, phase: 'error', error: action.error, streamingMessage: '' };

    case 'ITEM_EVALUATED':
      return { ...state, pendingEval: { evalResult: action.evalResult, score: action.score, durationMs: action.durationMs } };

    case 'SUBMIT_START':
      return { ...state, phase: 'submitting' };

    case 'SUBMIT_COMPLETE': {
      const items = [...state.items];
      const idx = state.currentIndex;
      items[idx] = {
        ...items[idx],
        status: 'completed',
        score: state.pendingEval?.score ?? null,
        durationMs: state.pendingEval?.durationMs ?? null,
        backendResult: action.response,
      };
      const gateProgress = action.response.gate_progress ?? state.latestGateProgress;
      const nextSpec = items[idx + 1]?.spec;
      const currentSpec = items[idx].spec;
      const shouldClearGate = nextSpec && nextSpec.subskill_id !== currentSpec.subskill_id;
      return {
        ...state,
        items,
        latestGateProgress: shouldClearGate ? null : gateProgress,
        latestIrt: action.response.irt ?? state.latestIrt,
        latestSigma: action.response.theta_update?.sigma ?? state.latestSigma,
        pendingEval: null,
      };
    }

    case 'SUBMIT_FAILED':
      return { ...state, phase: 'error', error: action.error };

    case 'ADVANCE': {
      // Items are already hydrated — just move the pointer
      const items = [...state.items];
      items[action.nextIndex] = { ...items[action.nextIndex], status: 'active' };
      return { ...state, phase: 'practicing', currentIndex: action.nextIndex, items, pendingEval: null };
    }

    case 'LEAPFROG':
      return { ...state, phase: 'leapfrog', leapfrogs: [...state.leapfrogs, action.event] };

    case 'LEAPFROG_DONE': {
      if (state.currentIndex >= state.items.length - 1) return { ...state, phase: 'complete' };
      const nextIdx = state.currentIndex + 1;
      const items = [...state.items];
      items[nextIdx] = { ...items[nextIdx], status: 'active' };
      return { ...state, phase: 'practicing', currentIndex: nextIdx, items, pendingEval: null };
    }

    case 'SESSION_COMPLETE':
      return { ...state, phase: 'complete' };

    case 'RETRY':
      return { ...state, phase: 'hydrating', error: null, streamingMessage: 'Retrying...', hydratedCount: 0, manifestItems: [] };

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PulseActivityRendererProps {
  sessionId: string;
  items: PulseItemSpec[];
  gradeLevel: GradeLevel;
  recentPrimitives?: RecentPrimitive[];
  isColdStart?: boolean;
  sessionFrontierContext?: SessionFrontierContext | null;
  onSessionComplete: (leapfrogs: LeapfrogEvent[], results: PulseResultResponse[]) => void;
  onError?: (error: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const PulseActivityRenderer: React.FC<PulseActivityRendererProps> = ({
  sessionId,
  items: itemSpecs,
  gradeLevel,
  recentPrimitives,
  isColdStart = false,
  sessionFrontierContext,
  onSessionComplete,
}) => {
  const [state, dispatch] = useReducer(reducer, itemSpecs, initState);
  const startTimeRef = useRef(Date.now());
  const didHydrateRef = useRef(false);

  const currentItem = state.items[state.currentIndex];
  const currentSpec = currentItem?.spec;

  // -------------------------------------------------------------------------
  // Batch-hydrate ALL items via /api/lumina/pulse-stream
  // -------------------------------------------------------------------------

  const hydrateAllItems = useCallback(async () => {
    console.log(`${LOG} Batch hydrating ${itemSpecs.length} items via pulse-stream...`);
    console.log(`${LOG} Manifest payload subskills:`);
    itemSpecs.forEach((spec, i) => {
      console.log(`${LOG}   ${i + 1}. ${spec.subskill_id} [${spec.band}] "${spec.description}" mode=${spec.target_mode} β=${spec.target_beta.toFixed(1)}`);
    });

    const payload = {
      items: itemSpecs.map((spec) => ({
        item_id: spec.item_id,
        description: spec.description,
        band: spec.band,
        target_mode: spec.target_mode,
        target_beta: spec.target_beta,
        eval_mode_name: spec.eval_mode_name,
        skill_id: spec.skill_id,
        subskill_id: spec.subskill_id,
        subject: spec.subject,
      })),
      gradeLevel,
      recentPrimitives: recentPrimitives?.length ? recentPrimitives : undefined,
    };

    try {
      const res = await fetch('/api/lumina/pulse-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`pulse-stream responded ${res.status}: ${err}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No readable stream from pulse-stream');

      const decoder = new TextDecoder();
      let buffer = '';
      let hydratedItems: HydratedPracticeItem[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);

            if (event.type === 'progress') {
              console.log(`${LOG} Stream: ${event.message}`);
              dispatch({ type: 'STREAMING_MESSAGE', message: event.message });
            } else if (event.type === 'manifest') {
              console.log(`${LOG} Manifest received: ${event.itemCount} items, primitives: ${event.items?.map((i: { componentId: string }) => i.componentId).join(', ')}`);
              const manifestItems: ManifestItemInfo[] = (event.items ?? []).map((i: { componentId: string; title?: string }) => ({
                componentId: i.componentId,
                title: i.title,
              }));
              dispatch({ type: 'MANIFEST_RECEIVED', items: manifestItems });
            } else if (event.type === 'item') {
              console.log(`${LOG} Item ${event.index + 1}/${event.total} hydrated`);
              dispatch({ type: 'ITEM_HYDRATED', index: event.index });
            } else if (event.type === 'complete') {
              hydratedItems = event.items;
              console.log(`${LOG} Batch hydration complete: ${hydratedItems.length} items ready`);
            } else if (event.type === 'error') {
              throw new Error(event.error);
            }
          } catch (parseErr) {
            if (parseErr instanceof SyntaxError) continue; // partial JSON line
            throw parseErr;
          }
        }
      }

      if (hydratedItems.length === 0) {
        throw new Error('No items returned from pulse-stream');
      }

      // Stamp curriculum IDs and Pulse item_ids on each hydrated item
      hydratedItems.forEach((hydrated, i) => {
        const spec = itemSpecs[i];
        if (!spec) return;
        hydrated.manifestItem.instanceId = spec.item_id;
        hydrated.curriculumIds = {
          subject: spec.subject,
          skillId: spec.skill_id,
          subskillId: spec.subskill_id,
          source: 'curriculum',
        };
      });

      // Log primitive diversity
      const primitiveTypes = hydratedItems.map((h) =>
        h.manifestItem.visualPrimitive?.componentId || h.manifestItem.standardProblem?.problemType || 'standard'
      );
      console.log(`${LOG} Primitive diversity: [${primitiveTypes.join(', ')}]`);

      dispatch({ type: 'BATCH_HYDRATION_COMPLETE', hydrated: hydratedItems });
    } catch (err) {
      console.error(`${LOG} Batch hydration failed:`, err);
      dispatch({ type: 'HYDRATION_FAILED', error: err instanceof Error ? err.message : 'Failed to prepare activities' });
    }
  }, [itemSpecs, gradeLevel, recentPrimitives]);

  // -------------------------------------------------------------------------
  // Handle primitive evaluation callback
  // -------------------------------------------------------------------------

  const handleEvaluation = useCallback((result: PrimitiveEvaluationResult) => {
    if (state.pendingEval) return; // Already evaluated this item

    const durationMs = Date.now() - startTimeRef.current;
    console.log(`${LOG} Item ${state.currentIndex + 1} evaluated: score=${result.score} success=${result.success} duration=${durationMs}ms`);
    dispatch({ type: 'ITEM_EVALUATED', evalResult: result, score: result.score, durationMs });
  }, [state.pendingEval, state.currentIndex]);

  // -------------------------------------------------------------------------
  // Handle "Next" button — submit result + advance
  // -------------------------------------------------------------------------

  const handleNext = useCallback(async () => {
    if (!state.pendingEval || !currentSpec) return;

    const { evalResult, score, durationMs } = state.pendingEval;
    dispatch({ type: 'SUBMIT_START' });

    const primitiveType = String(evalResult.primitiveType || currentItem.primitiveId || 'unknown');
    const evalMode = evalResult.metrics?.evalMode
      || currentItem.hydrated?.manifestItem.standardProblem?.evalMode
      || currentSpec.eval_mode_name
      || (currentItem.hydrated?.manifestItem.visualPrimitive ? 'visual' : 'standard');
    const scoreOn10 = score / 10;

    console.log(`${LOG} Submitting item ${state.currentIndex + 1}: score=${scoreOn10.toFixed(1)}/10 primitive="${primitiveType}" mode="${evalMode}"`);

    try {
      const response = await pulseApi.submitResult(sessionId, {
        item_id: currentSpec.item_id,
        score: scoreOn10,
        primitive_type: primitiveType,
        eval_mode: evalMode,
        duration_ms: durationMs,
      });

      console.log(`${LOG} Backend response for item ${state.currentIndex + 1}: theta=${response.theta_update.new_theta.toFixed(2)} gate=${response.gate_update?.new_gate ?? '-'} complete=${response.session_progress.is_complete}`);

      dispatch({ type: 'SUBMIT_COMPLETE', response });

      // Decide what happens next
      const isComplete = response.session_progress.is_complete;
      const hasLeapfrog = !!response.leapfrog;

      if (hasLeapfrog) {
        console.log(`${LOG} LEAPFROG detected! Inferred ${response.leapfrog!.inferred_skills.length} skills`);
        dispatch({ type: 'LEAPFROG', event: response.leapfrog! });
        // After celebration, advance or complete
        setTimeout(() => {
          if (isComplete) {
            const allResults = state.items.map(i => i.backendResult).filter(Boolean) as PulseResultResponse[];
            allResults.push(response);
            dispatch({ type: 'SESSION_COMPLETE' });
            onSessionComplete([...state.leapfrogs, response.leapfrog!], allResults);
          } else {
            dispatch({ type: 'LEAPFROG_DONE' });
          }
        }, 3000);
      } else if (isComplete) {
        console.log(`${LOG} Session complete!`);
        const allResults = state.items.map(i => i.backendResult).filter(Boolean) as PulseResultResponse[];
        allResults.push(response);
        dispatch({ type: 'SESSION_COMPLETE' });
        onSessionComplete(state.leapfrogs, allResults);
      } else {
        // Advance to next pre-hydrated item
        const nextIndex = state.currentIndex + 1;
        console.log(`${LOG} Advancing to item ${nextIndex + 1}/${state.items.length}`);
        dispatch({ type: 'ADVANCE', nextIndex });
      }
    } catch (err) {
      console.error(`${LOG} Submit failed for item ${state.currentIndex + 1}:`, err);
      dispatch({ type: 'SUBMIT_FAILED', error: err instanceof Error ? err.message : 'Failed to submit result' });
    }
  }, [state, currentSpec, currentItem, sessionId, onSessionComplete]);

  // -------------------------------------------------------------------------
  // Initial hydration on mount
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (didHydrateRef.current || itemSpecs.length === 0) return;
    didHydrateRef.current = true;

    console.log(`${LOG} Session started: ${itemSpecs.length} items`);
    console.log(`${LOG} Item queue:`);
    itemSpecs.forEach((spec, i) => {
      console.log(`${LOG}   ${i + 1}. [${spec.band}] ${spec.subskill_id} (mode ${spec.target_mode}, beta ${spec.target_beta.toFixed(1)})`);
    });
    hydrateAllItems();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset timer when item changes to practicing
  useEffect(() => {
    if (state.phase === 'practicing') {
      startTimeRef.current = Date.now();
    }
  }, [state.phase, state.currentIndex]);

  // -------------------------------------------------------------------------
  // Render: Item queue sidebar
  // -------------------------------------------------------------------------

  const renderItemQueue = () => (
    <div className="flex items-center gap-1.5 justify-center mb-6">
      {state.items.map((item, i) => {
        const isActive = i === state.currentIndex && state.phase !== 'complete';
        const isDone = item.status === 'completed';
        const bandColor = item.spec.band === 'frontier' ? 'violet' : item.spec.band === 'current' ? 'blue' : 'emerald';

        return (
          <TooltipProvider key={item.spec.item_id} delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={`
                  w-8 h-8 rounded-lg flex items-center justify-center text-xs font-mono transition-all
                  ${isActive ? `ring-2 ring-${bandColor}-400/50 bg-${bandColor}-500/20 border border-${bandColor}-500/40 text-${bandColor}-300 scale-110` : ''}
                  ${isDone ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400' : ''}
                  ${!isActive && !isDone ? 'bg-white/5 border border-white/10 text-slate-600' : ''}
                `}>
                  {isDone ? (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent className="backdrop-blur-xl bg-slate-900/90 border-white/10 text-slate-200 text-xs max-w-[220px] px-3 py-2">
                <p className="font-semibold text-slate-100">{formatSkillLabel(item.spec.subskill_id)}</p>
                <p className="text-slate-500 text-[10px] font-mono mt-0.5">
                  {BAND_LABELS[item.spec.band]} &middot; Mode {item.spec.target_mode}
                </p>
                {isDone && item.score != null && (
                  <p className="text-emerald-400 text-[10px] mt-0.5">Score: {item.score}%</p>
                )}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      })}
    </div>
  );

  // -------------------------------------------------------------------------
  // Render: Primitive (directly from registry)
  // -------------------------------------------------------------------------

  const renderPrimitive = () => {
    if (!currentItem?.hydrated) return null;

    const { manifestItem, visualData, problemData } = currentItem.hydrated;

    // === VISUAL PRIMITIVE ===
    if (manifestItem.visualPrimitive && visualData) {
      const { componentId } = manifestItem.visualPrimitive;
      const primitiveConfig = getPrimitive(componentId as ComponentId);

      if (!primitiveConfig?.component) {
        console.warn(`${LOG} No primitive config for: ${componentId}`);
        return renderFallback(manifestItem.problemText);
      }

      const Component = primitiveConfig.component;
      const innerData = visualData.data ?? visualData;
      const mergedData = {
        ...innerData,
        instanceId: currentSpec.item_id,
        onEvaluationSubmit: handleEvaluation,
        allowInteraction: true,
        skillId: currentSpec.skill_id,
        subskillId: currentSpec.subskill_id,
      };

      return (
        <div className="max-w-5xl mx-auto">
          <Component data={mergedData} index={state.currentIndex} />
        </div>
      );
    }

    // === STANDARD PROBLEM ===
    if (problemData) {
      return (
        <KnowledgeCheck
          data={{
            problems: [problemData],
            instanceId: currentSpec.item_id,
            onEvaluationSubmit: handleEvaluation,
            skillId: currentSpec.skill_id,
            subskillId: currentSpec.subskill_id,
          }}
        />
      );
    }

    return renderFallback(manifestItem.problemText);
  };

  // -------------------------------------------------------------------------
  // Render: Progress bar
  // -------------------------------------------------------------------------

  const completedCount = state.items.filter(i => i.status === 'completed').length;
  const progressPct = state.items.length > 0 ? (completedCount / state.items.length) * 100 : 0;

  // -------------------------------------------------------------------------
  // Main render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="max-w-md mx-auto">
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-400 to-blue-400 transition-all duration-500"
            style={{ width: `${Math.min(100, progressPct)}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-1">
          <p className="text-xs text-slate-500">
            {completedCount} of {state.items.length} activities
          </p>
          {currentSpec && (
            <span className={`text-[10px] font-mono uppercase tracking-wider ${BAND_COLORS[currentSpec.band]}`}>
              {BAND_LABELS[currentSpec.band]}
            </span>
          )}
        </div>
      </div>

      {/* Item queue */}
      {renderItemQueue()}

      {/* ---- HYDRATING ---- */}
      {state.phase === 'hydrating' && (
        <PulseHydrationView
          items={state.items}
          hydratedCount={state.hydratedCount}
          manifestItems={state.manifestItems}
          streamingMessage={state.streamingMessage}
        />
      )}

      {/* ---- PRACTICING ---- */}
      {(state.phase === 'practicing' || state.phase === 'submitting') && currentItem?.hydrated && (
        <EvaluationProvider
          key={currentSpec.item_id}
          localOnly
          curriculumSubject={currentSpec.subject}
          curriculumSkillId={currentSpec.skill_id}
          curriculumSubskillId={currentSpec.subskill_id}
        >
          <div className="animate-fade-in">
            {/* Band indicator + challenge level + gate progress */}
            <div className="mb-4 flex flex-col items-center gap-2">
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-mono uppercase tracking-wider ${BAND_BG_COLORS[currentSpec.band]} ${BAND_COLORS[currentSpec.band]}`}>
                  <BandIcon band={currentSpec.band} />
                  {BAND_LABELS[currentSpec.band]}
                </span>
                <ChallengeDots mode={currentSpec.target_mode} />
              </div>

              {/* Metadata row */}
              <TooltipProvider delayDuration={200}>
                <div className="flex items-center gap-3 text-[10px] font-mono text-slate-500">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-help border-b border-dotted border-slate-700">
                        {MODE_TIER_LABELS[currentSpec.target_mode] ?? `Mode ${currentSpec.target_mode}`}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="backdrop-blur-xl bg-slate-900/90 border-white/10 text-slate-200 text-xs max-w-[220px] px-3 py-2">
                      <p className="font-semibold text-slate-100 mb-1">Scaffolding Tier {currentSpec.target_mode}/6</p>
                      <p className="text-slate-400 leading-relaxed">How the activity is presented — from concrete objects to symbolic math</p>
                    </TooltipContent>
                  </Tooltip>
                  <span className="text-slate-700">&middot;</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-amber-400/70 cursor-help border-b border-dotted border-amber-500/30">
                        &beta; {currentSpec.target_beta.toFixed(1)}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="backdrop-blur-xl bg-slate-900/90 border-white/10 text-slate-200 text-xs max-w-[220px] px-3 py-2">
                      <p className="font-semibold text-amber-300 mb-1">Difficulty &beta; {currentSpec.target_beta.toFixed(1)}</p>
                      <p className="text-slate-400 leading-relaxed">Item difficulty on a 0-10 scale. Higher means harder</p>
                    </TooltipContent>
                  </Tooltip>
                  {state.latestGateProgress && (
                    <>
                      <span className="text-slate-700">&middot;</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-indigo-400/70 cursor-help border-b border-dotted border-indigo-500/30">
                            EL {state.latestGateProgress.theta.toFixed(1)}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="backdrop-blur-xl bg-slate-900/90 border-white/10 text-slate-200 text-xs max-w-[240px] px-3 py-2">
                          <p className="font-semibold text-indigo-300 mb-1">Earned Level {state.latestGateProgress.theta.toFixed(2)}</p>
                          <p className="text-slate-500 text-[10px] mb-1 font-mono">{formatSkillLabel(currentSpec.subskill_id)}</p>
                          <p className="text-slate-400 leading-relaxed">Your ability estimate for this skill. Activities are matched to this level in real-time</p>
                        </TooltipContent>
                      </Tooltip>
                    </>
                  )}
                </div>
              </TooltipProvider>

              {state.latestGateProgress && (
                <GateProgressIndicator gateProgress={state.latestGateProgress} skillLabel={formatSkillLabel(currentSpec.subskill_id)} />
              )}
            </div>

            {/* Frontier context card — graph position visibility */}
            <FrontierContextCard
              band={currentSpec.band}
              itemContext={currentSpec.frontier_context}
              sessionContext={sessionFrontierContext ?? undefined}
              isColdStart={isColdStart}
              irt={state.latestIrt ?? undefined}
              gateProgress={state.latestGateProgress ?? undefined}
              sigma={state.latestSigma ?? undefined}
            />

            {/* Primitive (rendered directly from registry) */}
            {renderPrimitive()}

            {/* AI Helper for audio/hint interaction */}
            {currentItem.hydrated.manifestItem.visualPrimitive ? (
              <AIHelper
                primitiveType={currentItem.hydrated.manifestItem.visualPrimitive.componentId as ComponentId}
                instanceId={currentSpec.item_id}
                primitiveData={currentItem.hydrated.visualData || currentItem.hydrated.manifestItem}
              />
            ) : currentItem.hydrated.problemData ? (
              <AIHelper
                primitiveType={'knowledge-check' as ComponentId}
                instanceId={currentSpec.item_id}
                primitiveData={currentItem.hydrated.problemData}
              />
            ) : null}

            {/* Next button */}
            <div className="mt-6 flex justify-center">
              <Button
                onClick={handleNext}
                disabled={!state.pendingEval || state.phase === 'submitting'}
                className={`px-8 py-3 rounded-xl shadow-lg transition-all ${
                  state.pendingEval
                    ? 'bg-gradient-to-r from-violet-500 to-blue-500 hover:from-violet-400 hover:to-blue-400 text-white shadow-violet-500/20'
                    : 'bg-white/5 border border-white/10 text-slate-500 cursor-not-allowed'
                }`}
              >
                {state.phase === 'submitting' ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Submitting...
                  </span>
                ) : (
                  <>
                    {state.currentIndex >= state.items.length - 1 ? 'Finish Session' : 'Next'}
                    <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </>
                )}
              </Button>
            </div>
          </div>
        </EvaluationProvider>
      )}

      {/* ---- LEAPFROG ---- */}
      {state.phase === 'leapfrog' && state.leapfrogs.length > 0 && (
        <PulseLeapfrogCelebration leapfrog={state.leapfrogs[state.leapfrogs.length - 1]} />
      )}

      {/* ---- ERROR ---- */}
      {state.phase === 'error' && (
        <div className="animate-fade-in">
          <Card className="backdrop-blur-xl bg-red-900/20 border-red-500/20 max-w-lg mx-auto">
            <CardContent className="p-8 text-center space-y-5">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500/30 to-rose-500/30 border border-red-500/20 flex items-center justify-center mx-auto">
                <span className="text-3xl">&#128533;</span>
              </div>
              <h3 className="text-lg font-semibold text-white">Something went wrong</h3>
              <p className="text-slate-400 text-sm">{state.error || 'An unexpected error occurred.'}</p>
              <Button
                variant="ghost"
                onClick={() => {
                  dispatch({ type: 'RETRY' });
                  hydrateAllItems();
                }}
                className="bg-white/5 border border-white/20 hover:bg-white/10"
              >
                Try Again
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Helper: format skill label
// ---------------------------------------------------------------------------

function formatSkillLabel(id: string): string {
  return id.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// ---------------------------------------------------------------------------
// Helper: fallback renderer
// ---------------------------------------------------------------------------

function renderFallback(problemText: string) {
  return (
    <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
      <CardContent className="p-6">
        <p className="text-white text-lg">{problemText}</p>
        <p className="text-slate-500 text-sm mt-2">This problem could not be loaded.</p>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Hydration view (ComponentViewer-style)
// ---------------------------------------------------------------------------

const BAND_ICONS: Record<PulseBand, string> = {
  frontier: '\u{1F680}',  // rocket
  current: '\u{1F527}',   // wrench
  review: '\u{1F504}',    // arrows cycle
};

const COMPONENT_ICONS: Record<string, string> = {
  'ten-frame': '\u{1F9EE}',
  'counting-board': '\u{1F522}',
  'number-line': '\u{1F4CF}',
  'function-machine': '\u{2699}\u{FE0F}',
  'pattern-builder': '\u{1F9E9}',
  'base-ten-blocks': '\u{1F9F1}',
  'fraction-bar': '\u{1F4CA}',
  'phonics-blender': '\u{1F524}',
  'sentence-builder': '\u{270D}\u{FE0F}',
  'knowledge-check': '\u{2705}',
  'standard': '\u{1F4DD}',
};

function PulseHydrationView({ items, hydratedCount, manifestItems, streamingMessage }: {
  items: ItemState[];
  hydratedCount: number;
  manifestItems: ManifestItemInfo[];
  streamingMessage: string;
}) {
  const total = items.length;
  const hasManifest = manifestItems.length > 0;
  const progressPct = total > 0 ? (hydratedCount / total) * 100 : 0;

  return (
    <div className="w-full max-w-3xl mx-auto animate-fade-in space-y-6">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-3 px-5 py-2.5 bg-gradient-to-r from-violet-500/10 via-blue-500/10 to-violet-500/10 rounded-full border border-white/10 backdrop-blur-sm">
          <div className="w-2 h-2 bg-violet-400 rounded-full animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-widest text-slate-300">
            {hasManifest ? 'Building Activities' : 'Planning Session'}
          </span>
          <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.3s' }} />
        </div>
        <p className="text-slate-400 text-sm">
          {streamingMessage || 'Generating activities matched to your level...'}
        </p>
      </div>

      {/* Item grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {items.map((item, i) => {
          const spec = item.spec;
          const manifestInfo = manifestItems[i];
          const isHydrated = i < hydratedCount;
          const isBuilding = hasManifest && i === hydratedCount;
          const componentId = manifestInfo?.componentId || 'standard';
          const icon = COMPONENT_ICONS[componentId] || '\u{1F4DD}';

          return (
            <div
              key={spec.item_id}
              className={`relative overflow-hidden rounded-xl border transition-all duration-500 ${
                isHydrated
                  ? 'bg-emerald-950/20 border-emerald-500/30'
                  : isBuilding
                  ? 'bg-blue-950/20 border-blue-500/30'
                  : 'bg-slate-900/20 border-slate-700/30'
              }`}
              style={{
                animationDelay: `${i * 80}ms`,
                animation: 'fade-in-up 0.4s ease-out backwards',
              }}
            >
              {/* Shimmer for building item */}
              {isBuilding && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-500/10 to-transparent animate-shimmer" />
              )}

              <div className="relative p-4 flex items-center gap-3.5">
                {/* Status icon */}
                <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-300 ${
                  isHydrated
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : isBuilding
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'bg-white/5 text-slate-600'
                }`}>
                  {isHydrated ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : isBuilding ? (
                    <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span className="text-lg">{hasManifest ? icon : BAND_ICONS[spec.band]}</span>
                  )}
                </div>

                {/* Item info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-mono font-bold ${
                      isHydrated ? 'text-emerald-400' : 'text-slate-500'
                    }`}>
                      [{i + 1}/{total}]
                    </span>
                    <span className={`text-sm font-medium truncate ${
                      isHydrated ? 'text-white' : isBuilding ? 'text-slate-200' : 'text-slate-400'
                    }`}>
                      {formatSkillLabel(spec.subskill_id)}
                    </span>
                  </div>

                  {/* Band + component badges */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${BAND_BG_COLORS[spec.band]} ${BAND_COLORS[spec.band]}`}>
                      {BAND_LABELS[spec.band]}
                    </span>
                    {hasManifest && manifestInfo && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-slate-500">
                        {manifestInfo.componentId}
                      </span>
                    )}
                    <span className="text-[10px] font-mono text-slate-600">
                      &beta;{spec.target_beta.toFixed(1)}
                    </span>
                  </div>

                  {/* Description (short) */}
                  {spec.description && (
                    <p className={`text-xs leading-relaxed mt-1 line-clamp-1 ${
                      isHydrated ? 'text-emerald-500/70' : isBuilding ? 'text-blue-400/70' : 'text-slate-600'
                    }`}>
                      {spec.description}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      {hasManifest && (
        <div className="max-w-md mx-auto">
          <div className="w-full h-2 bg-slate-800/50 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-500 to-emerald-500 transition-all duration-500 ease-out"
              style={{ width: `${progressPct}%` }}
            >
              <div className="w-full h-full bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
            </div>
          </div>
          <p className="text-center text-xs text-slate-500 mt-2">
            {hydratedCount === total
              ? 'All activities ready!'
              : `Building activities... ${Math.round(progressPct)}% complete`}
          </p>
        </div>
      )}

      {/* Spinner fallback when no manifest yet */}
      {!hasManifest && (
        <div className="flex items-center justify-center gap-3 py-2">
          <div className="w-4 h-4 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-500">Generating activity plan...</span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Band icon
// ---------------------------------------------------------------------------

function BandIcon({ band }: { band: PulseBand }) {
  switch (band) {
    case 'frontier':
      return (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      );
    case 'current':
      return (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      );
    case 'review':
      return (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      );
  }
}

// ---------------------------------------------------------------------------
// Sub-component: Challenge dots
// ---------------------------------------------------------------------------

const CHALLENGE_GRADIENT = [
  'bg-emerald-400', 'bg-teal-400', 'bg-sky-400',
  'bg-blue-400', 'bg-violet-400', 'bg-rose-400',
];

const MODE_TIER_LABELS: Record<number, string> = {
  1: 'Concrete', 2: 'Pictorial', 3: 'Pictorial+',
  4: 'Transitional', 5: 'Symbolic', 6: 'Multi-step',
};

function ChallengeDots({ mode }: { mode: number }) {
  const level = Math.max(1, Math.min(6, mode));
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-flex items-center gap-1 px-2 py-1.5 rounded-full bg-white/5 border border-white/10 cursor-help">
            {Array.from({ length: 6 }, (_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  i < level ? CHALLENGE_GRADIENT[i] : 'bg-white/10'
                }`}
              />
            ))}
          </div>
        </TooltipTrigger>
        <TooltipContent className="backdrop-blur-xl bg-slate-900/90 border-white/10 text-slate-200 text-xs max-w-[220px] px-3 py-2">
          <p className="font-semibold text-slate-100 mb-1">Challenge Level {level}/6</p>
          <p className="text-slate-400 leading-relaxed">Filled dots show how advanced this activity is</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Gate progress indicator
// ---------------------------------------------------------------------------

const GATE_COLORS = [
  'bg-slate-500', 'bg-emerald-400', 'bg-sky-400', 'bg-violet-400', 'bg-amber-400',
];

function GateProgressIndicator({ gateProgress, skillLabel }: { gateProgress: GateProgress; skillLabel?: string }) {
  const { current_gate, theta, next_gate_theta, thresholds } = gateProgress;
  const g4 = thresholds.g4;

  let progressPct = 100;
  if (current_gate < 4 && next_gate_theta != null) {
    const gateValues = [0, thresholds.g1, thresholds.g2, thresholds.g3, thresholds.g4];
    const floor = gateValues[current_gate];
    const range = next_gate_theta - floor;
    progressPct = range > 0 ? Math.min(100, Math.max(0, ((theta - floor) / range) * 100)) : 100;
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 cursor-help">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4].map((g) => (
                <div key={g} className={`w-2 h-2 rounded-full transition-colors ${g <= current_gate ? GATE_COLORS[g] : 'bg-white/10'}`} />
              ))}
            </div>
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              Gate {current_gate}/4
            </span>
            {current_gate < 4 && (
              <div className="w-12 h-1 rounded-full bg-white/10 overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${GATE_COLORS[current_gate + 1]}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPct}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                />
              </div>
            )}
            <span className="text-[10px] font-mono text-slate-500">
              {theta.toFixed(1)}/{g4.toFixed(1)}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent className="backdrop-blur-xl bg-slate-900/90 border-white/10 text-slate-200 text-xs max-w-[240px] px-3 py-2">
          <p className="font-semibold text-slate-100 mb-1">Mastery Gate {current_gate}/4</p>
          {skillLabel && <p className="text-slate-500 text-[10px] mb-1 font-mono">{skillLabel}</p>}
          <p className="text-slate-400 leading-relaxed">
            Each gate requires stronger evidence of understanding.
            {current_gate < 4 && next_gate_theta != null
              ? ` Next gate at ${next_gate_theta.toFixed(1)} (you're at ${theta.toFixed(1)})`
              : ' Full mastery reached!'}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Leapfrog celebration
// ---------------------------------------------------------------------------

function PulseLeapfrogCelebration({ leapfrog }: { leapfrog: LeapfrogEvent }) {
  const scorePercent = Math.round(leapfrog.aggregate_score * 10);
  const circumference = 2 * Math.PI * 28;
  const strokeOffset = circumference - (circumference * scorePercent) / 100;

  return (
    <div className="flex items-center justify-center py-12">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className="max-w-md w-full"
      >
        <Card className="backdrop-blur-xl bg-violet-900/20 border-violet-500/20 relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full blur-[100px] opacity-30 bg-gradient-to-br from-violet-500 to-amber-500" />
          <CardContent className="p-8 flex flex-col items-center text-center space-y-6 relative z-10">
            <div className="relative">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.1 }}
                className="w-24 h-24 rounded-2xl bg-gradient-to-br from-violet-500/30 to-amber-500/30 border border-violet-500/20 flex items-center justify-center"
              >
                <span className="text-5xl">&#128640;</span>
              </motion.div>
              <svg className="absolute -inset-2 w-[calc(100%+16px)] h-[calc(100%+16px)]" viewBox="0 0 64 64">
                <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2.5" />
                <motion.circle
                  cx="32" cy="32" r="28" fill="none" stroke="url(#scoreGradientPulse)" strokeWidth="2.5" strokeLinecap="round"
                  strokeDasharray={circumference}
                  initial={{ strokeDashoffset: circumference }}
                  animate={{ strokeDashoffset: strokeOffset }}
                  transition={{ duration: 1, delay: 0.3, ease: 'easeOut' }}
                  transform="rotate(-90 32 32)"
                />
                <defs>
                  <linearGradient id="scoreGradientPulse" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#a78bfa" />
                    <stop offset="100%" stopColor="#fbbf24" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="space-y-2">
              <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-300 to-amber-300">Leapfrog!</h2>
              {leapfrog.inferred_skills.length > 0 && (
                <p className="text-violet-300/80 text-sm font-medium">
                  You just skipped {leapfrog.inferred_skills.length} {leapfrog.inferred_skills.length === 1 ? 'skill' : 'skills'}!
                </p>
              )}
              <p className="text-slate-500 text-xs">Score: {scorePercent}%</p>
            </motion.div>
            {leapfrog.probed_skills.length > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="w-full space-y-2">
                <h4 className="text-[10px] uppercase tracking-widest font-mono text-emerald-400 flex items-center gap-2 justify-center">
                  <span className="w-1 h-3 bg-emerald-500 rounded-full" />
                  You proved you know
                </h4>
                <div className="flex flex-wrap gap-2 justify-center">
                  {leapfrog.probed_skills.map((skillId, i) => (
                    <motion.span key={skillId} initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.5 + i * 0.08, type: 'spring', stiffness: 400, damping: 20 }} className="glass-panel text-xs px-3 py-1.5 rounded-full border border-emerald-500/20 text-emerald-300 font-mono">
                      {formatSkillLabel(skillId)}
                    </motion.span>
                  ))}
                </div>
              </motion.div>
            )}
            {leapfrog.inferred_skills.length > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }} className="w-full space-y-2">
                <h4 className="text-[10px] uppercase tracking-widest font-mono text-violet-400 flex items-center gap-2 justify-center">
                  <span className="w-1 h-3 bg-violet-500 rounded-full" />
                  So we unlocked
                </h4>
                <div className="flex flex-wrap gap-2 justify-center">
                  {leapfrog.inferred_skills.map((skillId, i) => (
                    <motion.span key={skillId} initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.8 + i * 0.1, type: 'spring', stiffness: 400, damping: 20 }} className="glass-panel text-xs px-3 py-1.5 rounded-full border border-violet-500/20 text-violet-300 font-mono">
                      {formatSkillLabel(skillId)}
                    </motion.span>
                  ))}
                </div>
              </motion.div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

export default PulseActivityRenderer;
