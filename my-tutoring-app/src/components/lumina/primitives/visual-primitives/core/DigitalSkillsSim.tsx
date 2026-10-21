'use client';

/**
 * Digital Skills Sim: K-1 device skills with one right action among wrong ones, per eval mode.
 * - click: pictures in a play area; click the one the question names.
 * - drag: a picture and some boxes; press, hold, move it and let go over the named box.
 * - type: an on-screen keyboard; press the letter on the card (a capital, a small letter, or a word in order).
 *
 * Every item is built and keyed by code (`digitalSkillsWorkspace.ts`). Nothing marks the target picture, box or key;
 * pictures and boxes carry no words. Taught only on the workspace (`digitalSkillsSim.boss.ts`): every check commits
 * through `progress.commitCheck` with a named miss and the runtime retries and moves on. The levers are
 * `SKILL_LEVERS` (`digitalSkillsLevers.ts`).
 */
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  LuminaBadge,
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
import { SoundManager } from '../../../utils/SoundManager';
import { PipDock, PipWorkspace } from '../../../pip/WorkspacePip';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { TeachingEvaluationResult } from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceProgressFor } from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { leverScene } from '../../../components/live-activity/bossLevers';
import {
  ARENA, askOf, BOXES, boxOf, describeSkillWork, DRAG_START, emptyWork, KEY_ROWS, keyLabel, onGrab, radiusOf,
  skillCorrect, skillItems, skillMiss, SPOTS, workComplete, workspaceScene,
  type Point, type SkillItem, type SkillMode, type SkillTier, type SkillWork, type ThemeId,
} from './digitalSkillsWorkspace';
import {
  BIG_BOXES_LEVER, BIG_KEYS_LEVER, BIG_TARGETS_LEVER, CAPITAL_CARD_LEVER, GLOW_ROW_LEVER, glowRow, nextLetter,
  pictureOf, SHOW_PICTURE_LEVER, SKILL_LEVERS,
} from './digitalSkillsLevers';
import { digitalSkillsSimBoss } from './digitalSkillsSim.boss';

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

const MODE_LABEL: Record<SkillMode, string> = { click: 'Click Practice', drag: 'Drag Practice', type: 'Type Practice' };
const PRACTICE_NOTE = 'A simpler item of the same kind, before the full item comes back.';

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

const useDigitalSkillsProgress = useWorkspaceProgressFor('digital-skills-sim');

const DigitalSkillsSimSurface = ({ data, className, runtimePlanItemId }: DigitalSkillsSimProps) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const { title, description, instanceId, skillId, subskillId, objectiveId, exhibitId, onEvaluationSubmit } = data;

  const items = useMemo(() => skillItems(data),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.items, data.challengeTypes, data.difficulty, data.theme, data.title]);
  const stableInstanceId = useRef(instanceId || `digital-skills-sim-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceId.current;
  const startedAt = useRef(Date.now());

  // ── Progress: the runtime moves the index (callbacks bound below) ──
  const openItem = useRef<(index: number, retry: boolean) => void>(() => {});
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const progress = useDigitalSkillsProgress({
    challenges: items,
    getChallengeId: i => i.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: digitalSkillsSimBoss.assignment!,
    onItemOpened: (index, retry) => openItem.current(index, retry),
    onFinished: result => finish.current(result),
  });
  const { currentIndex, results, isComplete } = progress;
  const learnerBlocked = () => progress.canAttempt === false;

  const sessionItem: SkillItem | undefined = items[Math.min(currentIndex, Math.max(items.length - 1, 0))];
  const [practice, setPractice] = useState<SkillItem | null>(null);
  const item = practice ?? sessionItem;

  const [work, setWork] = useState<SkillWork>(emptyWork);
  /** The picture while it is being dragged (viewBox units), or null. */
  const [dragAt, setDragAt] = useState<Point | null>(null);
  const dragFrom = useRef<Point | null>(null);
  /** The checked wrong work, shown until Try again. */
  const [wrongShown, setWrongShown] = useState(false);
  const [practiceSolved, setPracticeSolved] = useState(false);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [submitted, setSubmitted] = useState(false);

  const pulled = sessionItem && leverState.item === sessionItem.id && !practice ? leverState.pulled : [];
  const leverOn = (id: string) => pulled.includes(id);
  const reach = { big: leverOn(BIG_TARGETS_LEVER) || leverOn(BIG_BOXES_LEVER) };
  const solvedNow = practice ? practiceSolved : !!item && results.some(r => r.challengeId === item.id && r.correct);
  /** Right keys typed so far (the keyboard levers act on the next letter). */
  const typedRight = item?.mode === 'type' ? work.keys.findIndex((k, i) => k !== item.text[i]) : -1;
  const typed = item?.mode === 'type' ? (typedRight < 0 ? work.keys.length : typedRight) : 0;
  const leverCtx = { typed };

  const { submitResult, hasSubmitted } = usePrimitiveEvaluation<DigitalSkillsSimMetrics>({
    primitiveType: 'digital-skills-sim',
    instanceId: resolvedInstanceId,
    skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

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

  // Under a lesson's evaluation provider only: the scored session, with each wrong check's named miss.
  finish.current = (result) => {
    if (hasSubmitted || progress.recordsEvaluation === false || !items.length) return;
    setSubmitted(true);
    submitResult(result.passed, result.accuracy, { ...metrics(), totalAttempts: result.teachingAttempts.length },
      { challengeResults: result.outcomes, learningResponses: result.learningResponses,
        teachingAttempts: result.teachingAttempts, assistanceProvenance: result.assistanceProvenance },
      undefined, result.diagnosisEvidence);
  };

  // ── The check: every action commits, right or wrong; a wrong one stays on screen until Try again. ──
  const closed = solvedNow || wrongShown || learnerBlocked();
  const commit = (w: SkillWork) => {
    if (!item) return;
    const correct = skillCorrect(item, w, reach);
    progress.commitCheck(describeSkillWork(item, w, reach), correct, correct ? undefined : skillMiss(item, w, reach));
    if (correct) {
      SoundManager.playCorrect();
      setFeedback('correct');
      if (practice) setPracticeSolved(true);
      return;
    }
    SoundManager.playIncorrect();
    setFeedback('wrong');
    setWrongShown(true);
  };

  // ── Arena (click, drag): one SVG, read in viewBox units ──
  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!item || item.mode === 'type' || closed || work.release) return;
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
    if (!item || item.mode === 'type' || closed || work.release) return;
    const p = coordinate(e);
    if (!p) return;
    if (item.mode === 'click') { const w = { ...work, release: p }; setWork(w); commit(w); return; }
    const from = dragFrom.current;
    dragFrom.current = null;
    try { e.currentTarget.releasePointerCapture?.(e.pointerId); } catch { /* as above */ }
    if (!from) return;
    const at = { x: DRAG_START.x + p.x - from.x, y: DRAG_START.y + p.y - from.y };
    if (Math.hypot(p.x - from.x, p.y - from.y) < MIN_DRAG) { setDragAt(null); return; }
    // The drop is where the picture's centre is let go: the picture moved with the pointer from where it was grabbed.
    const w = { ...work, release: at };
    setDragAt(at); setWork(w); commit(w);
  };

  // ── Keyboard ──
  const pressKey = (k: string) => {
    if (!item || item.mode !== 'type' || closed || workComplete(item, work)) return;
    SoundManager.tick();
    const w = { ...work, keys: [...work.keys, k.toUpperCase()] };
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

  // ── What the tutor and the observer are shown, republished every render ──
  useLayoutEffect(() => {
    if (!item || !sessionItem || isComplete) return;
    const scene = workspaceScene(item, { work, reach });
    const levers = practice ? [] : SKILL_LEVERS.declare(sessionItem, leverCtx, pulled);
    const published = leverScene(scene, {
      support: practice ? '' : SKILL_LEVERS.support(sessionItem, leverCtx),
      onScreen: practice ? '' : SKILL_LEVERS.onScreen(sessionItem, leverCtx, pulled),
    });
    workspace.current = {
      ...published,
      facts: { ...published.facts, ...(practice ? { practice: PRACTICE_NOTE } : {}) },
      levers,
      pullLever: (id) => {
        const lever = levers.find(x => x.id === id);
        if (practice || !lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already on screen.`;
        const nextState = { item: sessionItem.id, pulled: [...pulled, id] };
        if (lever.kind === 'simplify') {
          const simpler = SKILL_LEVERS.simpler(sessionItem, leverCtx, id);
          if (!simpler) return 'There is no simpler item here; try a help lever.';
          setLeverState(nextState); clearItem(); setPractice(simpler);
          return { practice: digitalSkillsSimBoss.assignment!(simpler) };
        }
        setLeverState(nextState);
        return true;
      },
      endPractice: () => { clearItem(); setPractice(null); },
    };
  });

  const done = hasSubmitted || submitted || isComplete;

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
                    stroke={wrongShown ? '#f87171' : 'rgba(255,255,255,0.35)'} strokeWidth={2} />
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
                const state = pressedLast && wrongShown ? 'wrong' : pressedLast && feedback === 'correct' ? 'right' : 'idle';
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
          {practice && !done && <LuminaBadge accent="amber" className="text-[10px] uppercase tracking-wider">Practice</LuminaBadge>}
        </div>
        {!done && item && (
          <LuminaSectionLabel accent="cyan" size="sm">
            {practice ? 'A simpler one first' : `${MODE_LABEL[item.mode]} · ${Math.min(currentIndex, items.length - 1) + 1} of ${items.length}`}
          </LuminaSectionLabel>
        )}
        {description && !done && <p className="mt-1 text-sm text-slate-400">{description}</p>}
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {done ? (
          <LuminaFeedbackCard status="insight" label="All done">{`${items.length} of ${items.length} finished.`}</LuminaFeedbackCard>
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

            {/* Pip comes from the workspace runner (`pip/WorkspacePip.tsx`): the dock above, the play area or keyboard as one region. */}
            <PipDock />
            <PipWorkspace>
              {renderArena()}
              {renderKeyboard()}
            </PipWorkspace>

            {feedback === 'correct' && <LuminaFeedbackCard status="correct">Nice work!</LuminaFeedbackCard>}
            {feedback === 'wrong' && <LuminaFeedbackCard status="incorrect">Not that one.</LuminaFeedbackCard>}
          </>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

// Taught only on the workspace: an unbound mount shows the shared "needs the tutor" card.
const DigitalSkillsSim = withWorkspaceOnly<DigitalSkillsSimProps>('digital-skills-sim', DigitalSkillsSimSurface, props => props.data.title);

export default DigitalSkillsSim;
