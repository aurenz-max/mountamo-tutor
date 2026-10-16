'use client';

/**
 * Digital Skills Sim: K-2 device skills with one right action among wrong ones, per eval mode.
 * - click: pictures in a play area; click the one the question names.
 * - drag: a picture and some boxes; press, hold, move it and let go over the named box.
 * - type: an on-screen keyboard; press the letter on the card (a capital, a small letter, or a word in order).
 *
 * Every item is built and keyed by code (`digitalSkillsWorkspace.ts`). Nothing marks the target picture, box or key;
 * pictures and boxes carry no words. Two paths, chosen by `withWorkspaceController`: the scripted path (tester, no
 * tutor) moves on by itself after a right answer and lets a wrong one be tried again; the workspace path (W1, plain
 * shape) commits every check through `progress.commitCheck` with a named miss and lets the runtime move on. The levers
 * live in `digitalSkillsLevers.ts`.
 */
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaFeedbackCard,
  LuminaPanel,
  LuminaPrompt,
  LuminaSectionLabel,
} from '../../../ui';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../../../evaluation';
import type { DigitalSkillsSimMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import { useWorkspacePipSurface } from '../../../pip/useWorkspacePipSurface';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { TeachingEvaluationResult } from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { withWorkspaceController } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useScriptedProgress, useWorkspaceProgressFor, type Progress, type ProgressOptions }
  from '../../../components/live-activity/runtime/useWorkspaceProgress';
import {
  ARENA, askOf, BOXES, boxOf, describeSkillWork, DRAG_START, emptyWork, KEY_ROWS, keyLabel, onGrab, radiusOf,
  skillCorrect, skillItems, skillMiss, SPOTS, workComplete, workspaceAssignment, workspaceScene,
  type Point, type SkillItem, type SkillMode, type SkillTier, type SkillWork, type ThemeId,
} from './digitalSkillsWorkspace';
import {
  BIG_BOXES_LEVER, BIG_KEYS_LEVER, BIG_TARGETS_LEVER, CAPITAL_CARD_LEVER, GLOW_ROW_LEVER, glowRow, leverFact,
  nextLetter, pictureOf, SHOW_PICTURE_LEVER, simplerItem, skillLevers,
} from './digitalSkillsLevers';

// ============================================================================
// Data Types (single source of truth; the generator imports them)
// ============================================================================

export type { SkillItem, SkillMode, SkillTier, ThemeId };

export interface DigitalSkillsSimData {
  title: string;
  description?: string;
  /** The picture set the click and drag items draw from (`THEMES`). */
  theme?: ThemeId;
  /** The eval modes this session asks, in order (`resolveSkillModes`). */
  challengeTypes?: SkillMode[];
  /** config.difficulty: the structural band the items were built at. */
  difficulty?: SkillTier;
  /** The items, built and keyed by code at generation; absent or invalid: rebuilt from the fields above. */
  items?: SkillItem[];
  /** Legacy generations (model-written challenges): read only for their modes. */
  challenges?: Array<{ type?: string }>;

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<DigitalSkillsSimMetrics>) => void;
}

interface DigitalSkillsSimProps {
  data: DigitalSkillsSimData;
  className?: string;
  runtimePlanItemId?: string;
  runtimeEvalMode?: string;
}

const PHASE_TYPE_CONFIG: Record<SkillMode, PhaseConfig> = {
  click: { label: 'Click Practice', icon: '🖱️', accentColor: 'blue' },
  drag: { label: 'Drag Practice', icon: '✋', accentColor: 'purple' },
  type: { label: 'Type Practice', icon: '⌨️', accentColor: 'emerald' },
};

/** A drag shorter than this (viewBox units) is a tap on the picture, not a drag. */
const MIN_DRAG = 12;

function coordinate(event: React.PointerEvent<SVGSVGElement>): Point | null {
  const svg = event.currentTarget;
  const matrix = svg.getScreenCTM?.();
  if (!matrix || !svg.createSVGPoint) return null;
  const point = svg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  const local = point.matrixTransform(matrix.inverse());
  return { x: local.x, y: local.y };
}

// ============================================================================
// Component
// ============================================================================

const DigitalSkillsSimSurface = ({ data, className, runtimePlanItemId, tutorOwned, useController }:
  DigitalSkillsSimProps & { tutorOwned: boolean; useController: (options: ProgressOptions<SkillItem>) => Progress }) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const { title, description, instanceId, skillId, subskillId, objectiveId, exhibitId, onEvaluationSubmit } = data;

  const items = useMemo(() => skillItems(data),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.items, data.challengeTypes, data.difficulty, data.theme, data.title]);
  const stableInstanceId = useRef(instanceId || `digital-skills-sim-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceId.current;
  const startedAt = useRef(Date.now());

  // ── Progress: the runtime moves the index on the workspace path (callbacks bound below) ──
  const openItem = useRef<(index: number, retry: boolean) => void>(() => {});
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const progress = useController({
    challenges: items,
    getChallengeId: i => i.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: workspaceAssignment,
    onItemOpened: (index, retry) => openItem.current(index, retry),
    onFinished: result => finish.current(result),
  });
  const { currentIndex, currentAttempts, results, isComplete } = progress;
  const learnerBlocked = () => tutorOwned && progress.canAttempt === false;

  const sessionItem: SkillItem | undefined = items[Math.min(currentIndex, Math.max(items.length - 1, 0))];
  const [practice, setPractice] = useState<SkillItem | null>(null);
  const item = practice ?? sessionItem;

  const [work, setWork] = useState<SkillWork>(emptyWork);
  /** The picture while it is being dragged (viewBox units), or null. */
  const [dragAt, setDragAt] = useState<Point | null>(null);
  const dragFrom = useRef<Point | null>(null);
  /** Workspace path: the checked wrong work, shown until Try again. */
  const [wrongShown, setWrongShown] = useState(false);
  const [practiceSolved, setPracticeSolved] = useState(false);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [submitted, setSubmitted] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const pulled = sessionItem && leverState.item === sessionItem.id && !practice ? leverState.pulled : [];
  const leverOn = (id: string) => pulled.includes(id);
  const reach = { big: leverOn(BIG_TARGETS_LEVER) || leverOn(BIG_BOXES_LEVER) };
  const solvedNow = practice ? practiceSolved : !!item && results.some(r => r.challengeId === item.id && r.correct);
  /** Right keys typed so far (the keyboard levers act on the next letter). */
  const typedRight = item?.mode === 'type' ? work.keys.findIndex((k, i) => k !== item.text[i]) : -1;
  const typed = item?.mode === 'type' ? (typedRight < 0 ? work.keys.length : typedRight) : 0;

  const { submitResult, hasSubmitted, elapsedMs } = usePrimitiveEvaluation<DigitalSkillsSimMetrics>({
    primitiveType: 'digital-skills-sim',
    instanceId: resolvedInstanceId,
    skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const phaseResults = usePhaseResults({
    challenges: items, results, isComplete, getChallengeType: i => i.mode, phaseConfig: PHASE_TYPE_CONFIG,
  });

  // ── Scripted tutor only: the context carries the ask, never where the target is ──
  const aiPrimitiveData = useMemo(() => ({
    title, currentPhase: item?.mode ?? 'none', challengeIndex: currentIndex + 1, totalChallenges: items.length,
    instruction: item ? askOf(item) : '',
  }), [title, item, currentIndex, items.length]);
  const { sendText, isAudioPlaying, activePrimitiveId } = useLuminaAI({
    primitiveType: 'digital-skills-sim', instanceId: resolvedInstanceId, primitiveData: aiPrimitiveData,
    gradeLevel: 'K-1', enabled: !tutorOwned,
  });
  const say = (text: string) => { if (!tutorOwned) sendText(text, { silent: true }); };

  const clearItem = () => {
    setWork(emptyWork()); setDragAt(null); dragFrom.current = null; setWrongShown(false); setFeedback(null); setPracticeSolved(false);
  };

  // A retry keeps a practice item on screen; a fresh item drops it.
  openItem.current = (_index, retry) => {
    if (!retry) setPractice(null);
    clearItem();
  };

  const metrics = (): DigitalSkillsSimMetrics => {
    const firstTry = (mode: SkillMode) => {
      const of = items.filter(i => i.mode === mode);
      if (!of.length) return 100;
      return Math.round((of.filter(i => results.some(r => r.challengeId === i.id && r.correct && r.attempts === 1)).length / of.length) * 100);
    };
    return {
      type: 'digital-skills-sim',
      clickAccuracy: firstTry('click'), dragAccuracy: firstTry('drag'), typeAccuracy: firstTry('type'),
      totalAttempts: results.reduce((s, r) => s + r.attempts, 0),
      averageTimeMs: items.length ? Math.round((Date.now() - startedAt.current) / items.length) : 0,
      challengesCompleted: results.filter(r => r.correct).length,
      totalChallenges: items.length,
    };
  };

  /** Scripted path: the next item, and after the last the session report. */
  const next = () => {
    if (progress.advance()) { clearItem(); say(`[NEXT_ITEM] Item ${currentIndex + 2} of ${items.length}: ${askOf(items[currentIndex + 1])}`); return; }
    if (hasSubmitted || submitted || progress.recordsEvaluation === false) return;
    const score = items.length ? Math.round((items.filter(i => results.some(r => r.challengeId === i.id && r.correct && r.attempts === 1)).length / items.length) * 100) : 0;
    setSubmitted(true);
    submitResult(score >= 70, score, metrics(), { challengeResults: results });
    say(`[ALL_COMPLETE] The learner finished all ${items.length} digital skills items. Celebrate briefly.`);
  };

  finish.current = (result) => {
    if (hasSubmitted || progress.recordsEvaluation === false || !items.length) return;
    setSubmitted(true);
    submitResult(result.passed, result.accuracy, { ...metrics(), totalAttempts: result.teachingAttempts.length },
      { challengeResults: result.outcomes, learningResponses: result.learningResponses,
        teachingAttempts: result.teachingAttempts, assistanceProvenance: result.assistanceProvenance },
      undefined, result.diagnosisEvidence);
  };

  // ── The check ──
  const closed = solvedNow || wrongShown || learnerBlocked();
  /**
   * Scripted path: a wrong try (its red mark, the key it pressed, "Not quite") stays on screen until the next try
   * clears it. It used to clear after 700 ms, so a wrong click read as no response at all (browser run 10-16, R14).
   */
  const retryPending = !tutorOwned && feedback === 'wrong';
  const freshTry = (): SkillWork => { setWork(emptyWork()); setDragAt(null); setFeedback(null); return emptyWork(); };
  const commit = (w: SkillWork) => {
    if (!item) return;
    const correct = skillCorrect(item, w, reach);
    progress.commitCheck(describeSkillWork(item, w, reach), correct, correct ? undefined : skillMiss(item, w, reach));
    if (correct) {
      SoundManager.playCorrect();
      setFeedback('correct');
      if (practice) { setPracticeSolved(true); return; }
      say(`[ANSWER_CORRECT] The learner did it: ${askOf(item)} Praise briefly.`);
      if (!tutorOwned) timer.current = setTimeout(next, 900);
      return;
    }
    SoundManager.playIncorrect();
    setFeedback('wrong');
    if (tutorOwned) { setWrongShown(true); return; }
    say(`[ANSWER_INCORRECT] ${describeSkillWork(item, w, reach)}, for: ${askOf(item)} Encourage another try without saying where to go.`);
  };

  // ── Arena (click, drag): one SVG, read in viewBox units ──
  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!item || item.mode === 'type' || closed) return;
    const base = retryPending ? freshTry() : work;
    if (base.release) return;
    const p = coordinate(e);
    if (!p) return;
    if (item.mode === 'drag') {
      if (!onGrab(p)) return;
      dragFrom.current = p; setDragAt(DRAG_START); SoundManager.select();
      try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* jsdom and old browsers */ }
    }
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!item || item.mode !== 'drag' || !dragFrom.current) return;
    const p = coordinate(e);
    if (p) setDragAt({ x: DRAG_START.x + p.x - dragFrom.current.x, y: DRAG_START.y + p.y - dragFrom.current.y });
  };
  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!item || item.mode === 'type' || closed) return;
    const base = retryPending ? freshTry() : work;
    if (base.release) return;
    const p = coordinate(e);
    if (!p) return;
    if (item.mode === 'click') { const w = { ...base, release: p }; setWork(w); commit(w); return; }
    const from = dragFrom.current;
    dragFrom.current = null;
    try { e.currentTarget.releasePointerCapture?.(e.pointerId); } catch { /* as above */ }
    if (!from) return;
    const at = { x: DRAG_START.x + p.x - from.x, y: DRAG_START.y + p.y - from.y };
    if (Math.hypot(p.x - from.x, p.y - from.y) < MIN_DRAG) { setDragAt(null); return; }
    // The drop is where the picture's centre is let go: the picture moved with the pointer from where it was grabbed.
    const w = { ...base, release: at };
    setDragAt(at); setWork(w); commit(w);
  };

  // ── Keyboard ──
  const pressKey = (k: string) => {
    if (!item || item.mode !== 'type' || closed) return;
    const base = retryPending ? freshTry() : work;
    if (workComplete(item, base)) return;
    SoundManager.tick();
    const w = { ...base, keys: [...base.keys, k.toUpperCase()] };
    setWork(w);
    if (workComplete(item, w)) commit(w);
  };
  const pressRef = useRef(pressKey); pressRef.current = pressKey;
  useEffect(() => {
    if (item?.mode !== 'type') return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return;
      if (/^[a-z]$/i.test(e.key)) pressRef.current(e.key);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [item?.mode, item?.id]);

  // ── Workspace path: what the tutor and the observer are shown, republished every render ──
  useLayoutEffect(() => {
    if (!tutorOwned || !item || isComplete) return;
    const scene = workspaceScene(item, { work, reach });
    const levers = practice ? [] : skillLevers(sessionItem, pulled);
    const onScreen = practice ? '' : leverFact(sessionItem, pulled, typed);
    workspace.current = {
      ...scene,
      facts: { ...scene.facts, ...(practice ? { practice: 'A simpler item of the same kind, before the full item comes back.' } : {}),
        ...(onScreen ? { onScreen } : {}) },
      levers,
      pullLever: (id) => {
        const l = levers.find(x => x.id === id);
        if (practice || !l || !sessionItem) return `No lever ${id} on this item.`;
        if (l.pulled) return `${id} is already on screen.`;
        const nextState = { item: sessionItem.id, pulled: [...pulled, id] };
        if (l.kind === 'simplify') {
          const simpler = simplerItem(sessionItem);
          if (!simpler) return 'There is no simpler item here; try a help lever.';
          setLeverState(nextState); clearItem(); setPractice(simpler);
          return { practice: workspaceAssignment(simpler) };
        }
        setLeverState(nextState);
        return true;
      },
      endPractice: () => { clearItem(); setPractice(null); },
    };
  });

  const done = hasSubmitted || submitted || isComplete;
  const pip = useWorkspacePipSurface({
    instanceId: resolvedInstanceId,
    scopeId: done || !item ? null : item.id,
    label: 'The practice area',
    solved: solvedNow,
    tutorSpeaking: isAudioPlaying && activePrimitiveId === resolvedInstanceId,
  });

  if (!items.length) {
    return (
      <LuminaCard className={className}>
        <LuminaCardHeader><LuminaCardTitle>{title}</LuminaCardTitle></LuminaCardHeader>
        <LuminaCardContent><p className="text-sm text-slate-400">No challenges available.</p></LuminaCardContent>
      </LuminaCard>
    );
  }

  // ── Render: the arena ──
  const renderArena = () => {
    if (!item || item.mode === 'type') return null;
    const bigBoxes = leverOn(BIG_BOXES_LEVER);
    return (
      <svg data-pip-object="arena" viewBox={`0 0 ${ARENA.w} ${ARENA.h}`} role="application"
        aria-label={item.mode === 'click' ? 'Play area with pictures to click' : 'Play area with a picture to drag and boxes'}
        className={`w-full rounded-xl border border-white/10 bg-slate-800/50 touch-none select-none ${item.mode === 'click' ? 'cursor-pointer' : ''}`}
        style={{ maxWidth: 720 }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
        {item.mode === 'click' && (
          <g {...(leverOn(BIG_TARGETS_LEVER) ? { 'data-lever': 'big-targets' } : {})}>
            {item.things.map((thing, i) => {
              const s = SPOTS[item.things.length][i], r = radiusOf(item.things.length, leverOn(BIG_TARGETS_LEVER));
              const right = solvedNow && i === item.target;
              return (
                <g key={thing.name} data-thing={i}>
                  <circle cx={s.x} cy={s.y} r={r} fill={right ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.06)'}
                    stroke={right ? '#34d399' : 'rgba(255,255,255,0.25)'} strokeWidth={2} />
                  <text x={s.x} y={s.y} textAnchor="middle" dominantBaseline="central" fontSize={r * 1.1} aria-hidden="true">{thing.emoji}</text>
                </g>
              );
            })}
            {work.release && !solvedNow && (
              <circle data-release cx={work.release.x} cy={work.release.y} r={8} fill="none" stroke="#f87171" strokeWidth={3} />
            )}
          </g>
        )}
        {item.mode === 'drag' && (
          <>
            {BOXES[item.homes.length].map((b, i) => {
              const right = solvedNow && i === item.target;
              const catchBox = boxOf(b, true);
              return (
                <g key={item.homes[i].name} data-box={i}>
                  {bigBoxes && (
                    <rect data-lever="big-boxes" x={catchBox.x} y={catchBox.y} width={catchBox.w} height={catchBox.h} rx={16}
                      fill="rgba(56,189,248,0.06)" stroke="rgba(56,189,248,0.6)" strokeDasharray="6 5" strokeWidth={2} />
                  )}
                  <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={14}
                    fill={right ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.05)'} stroke={right ? '#34d399' : 'rgba(255,255,255,0.3)'} strokeWidth={2} />
                  <text x={b.x + b.w / 2} y={b.y + b.h / 2} textAnchor="middle" dominantBaseline="central" fontSize={Math.min(b.w, b.h) * 0.55} aria-hidden="true">
                    {item.homes[i].emoji}
                  </text>
                </g>
              );
            })}
            {(() => {
              const at = dragAt ?? DRAG_START;
              return (
                <g data-drag-picture style={{ cursor: closed ? 'default' : 'grab' }} pointerEvents="all">
                  <circle cx={at.x} cy={at.y} r={34} fill={dragAt ? 'rgba(59,130,246,0.25)' : 'rgba(255,255,255,0.1)'}
                    stroke={wrongShown || feedback === 'wrong' ? '#f87171' : 'rgba(255,255,255,0.35)'} strokeWidth={2} />
                  <text x={at.x} y={at.y} textAnchor="middle" dominantBaseline="central" fontSize={36} aria-hidden="true">{item.thing.emoji}</text>
                </g>
              );
            })()}
          </>
        )}
      </svg>
    );
  };

  // ── Render: the keyboard ──
  const renderKeyboard = () => {
    if (!item || item.mode !== 'type') return null;
    const big = leverOn(BIG_KEYS_LEVER);
    const glow = leverOn(GLOW_ROW_LEVER) ? glowRow(item, typed) : -1;
    const shown = item.lower ? item.text.toLowerCase() : item.text;
    const last = work.keys.length - 1;
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-center gap-4">
          <div className="inline-flex items-center justify-center gap-1 rounded-2xl border-2 border-blue-400/40 bg-blue-500/10 px-5 py-3 font-bold text-blue-200" style={{ fontSize: 40 }}>
            {shown.split('').map((ch, i) => (
              <span key={i} className={item.text.length > 1 && i === typed && !solvedNow ? 'underline decoration-4 underline-offset-8' : ''}>{ch}</span>
            ))}
          </div>
          {leverOn(CAPITAL_CARD_LEVER) && (
            <LuminaPanel accent="cyan" data-lever="capital-card" className="text-2xl font-bold text-slate-200">
              {`${nextLetter(item, typed).toLowerCase()}  ·  ${nextLetter(item, typed)}`}
            </LuminaPanel>
          )}
        </div>
        {item.text.length > 1 && (
          <p className="text-center font-mono text-xl tracking-[0.5em] text-slate-300" aria-label="Typed so far">
            {item.text.split('').map((_, i) => work.keys[i] ?? '_').join('')}
          </p>
        )}
        <div className={`px-2 ${big ? 'space-y-2.5' : 'space-y-1.5'}`} {...(big ? { 'data-lever': 'big-keys' } : {})}>
          {KEY_ROWS.map((row, r) => (
            <div key={row} className={`flex justify-center rounded-lg py-1 ${big ? 'gap-2' : 'gap-1'} ${r === glow ? 'bg-amber-400/15 ring-2 ring-amber-300/60' : ''}`}
              {...(r === glow ? { 'data-lever': 'glow-row' } : {})}>
              {row.split('').map(k => {
                const pressedLast = work.keys[last] === k;
                const state = pressedLast && (feedback === 'wrong' || wrongShown) ? 'wrong' : pressedLast && feedback === 'correct' ? 'right' : 'idle';
                return (
                  <button key={k} type="button" aria-label={keyLabel(k)} disabled={closed}
                    className={`${big ? 'h-14 w-12 text-lg' : 'h-10 w-8 text-sm sm:h-11 sm:w-10'} rounded-md border p-0 font-mono transition-colors duration-150
                      ${state === 'wrong' ? 'border-red-400 bg-red-500/20 text-red-300'
                        : state === 'right' ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300'
                          : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'}`}
                    onClick={() => pressKey(k)}>
                    {k}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const showPicture = item && item.mode !== 'type' && leverOn(SHOW_PICTURE_LEVER) ? pictureOf(item) : null;

  return (
    <LuminaCard className={`shadow-2xl ${className || ''}`}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg" aria-hidden="true">🖥️</span>
          <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
        </div>
        {!done && item && (
          <LuminaSectionLabel accent="cyan" size="sm">
            {practice ? 'A simpler one first' : `${PHASE_TYPE_CONFIG[item.mode].label} · ${Math.min(currentIndex, items.length - 1) + 1} of ${items.length}`}
          </LuminaSectionLabel>
        )}
        {description && !done && <p className="mt-1 text-sm text-slate-400">{description}</p>}
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {done ? (
          tutorOwned ? (
            <LuminaFeedbackCard status="insight" label="All done">{`${items.length} of ${items.length} finished.`}</LuminaFeedbackCard>
          ) : (
            <PhaseSummaryPanel phases={phaseResults} durationMs={elapsedMs} heading="Great Job!"
              celebrationMessage="You finished the digital skills practice!" className="mb-6" />
          )
        ) : item && (
          <>
            <div className="flex items-center gap-3">
              <LuminaPrompt accent="cyan" className="flex-1" {...(practice ? { 'data-practice': 'simpler' } : {})}>{askOf(item)}</LuminaPrompt>
              {showPicture && (
                <LuminaPanel accent="cyan" data-lever="show-picture" className="flex-shrink-0 text-4xl" aria-label="The picture to look for">
                  {showPicture.emoji}
                </LuminaPanel>
              )}
            </div>

            {pip.store && <div {...pip.dock} />}
            <div {...pip.workspace}>
              {renderArena()}
              {renderKeyboard()}
            </div>

            {feedback === 'correct' && <LuminaFeedbackCard status="correct">Nice work!</LuminaFeedbackCard>}
            {feedback === 'wrong' && <LuminaFeedbackCard status="incorrect">{tutorOwned ? 'Not that one.' : 'Not quite. Try again!'}</LuminaFeedbackCard>}
          </>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

// The workspace path never mounts the scripted progress, whose own moving on would compete with the observer.
const DigitalSkillsSim = withWorkspaceController<DigitalSkillsSimProps, ProgressOptions<SkillItem>, Progress>(
  'digital-skills-sim', DigitalSkillsSimSurface, useScriptedProgress, useWorkspaceProgressFor('digital-skills-sim'));

export default DigitalSkillsSim;
