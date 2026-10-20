'use client';

/**
 * Gravity Drop Tower: objects dropped from a tower, with or without air, one eval mode each.
 * - observe: drop and watch, then report what happened (which landed first, or whether it sped up).
 * - predict: which of two lands first (hard: and why), said or tapped before the drop.
 * - compare: three objects from different heights; tap them in landing order.
 * - measure: a stopwatch table of measured drops; the fall time for a new height (hard: the height for a new time).
 * - calculate: h = 1/2 g t^2; fall time, drop height, or impact speed.
 *
 * Every item is built and keyed by code (`gravityDropWorkspace.ts`). Nothing on screen states the answer first: the
 * tower prints no speed or landing time before credit, the asked drop runs only once the answer is credited (observe
 * is the exception: watching is its task, and the choices open after the first drop), and a hidden height is drawn
 * with no ruler. Taught only on the shared tutor/JEV workspace (`withWorkspaceOnly`; its wiring is
 * `gravityDropTower.card.ts` + `gravityDropTower.boss.ts`): every check commits through `progress.commitCheck` with a
 * named miss, a spoken answer is judged by the tutor, and the runtime moves on. The levers are one lever set in
 * `gravityDropLevers.ts`.
 */
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../../../evaluation';
import type { GravityDropTowerMetrics } from '../../../evaluation/types';
import { SoundManager } from '../../../utils/SoundManager';
import { PipDock, PipWorkspace } from '../../../pip/WorkspacePip';
import {
  LuminaActionButton, LuminaAnswerChoice, LuminaButton, LuminaCard, LuminaCardContent, LuminaCardHeader, LuminaCardTitle,
  LuminaFeedbackCard, LuminaPanel, LuminaPrompt, LuminaSectionLabel, type AnswerChoiceState,
} from '../../../ui';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { TeachingEvaluationResult } from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceProgressFor } from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { leverScene } from '../../../components/live-activity/bossLevers';
import {
  askOf, choicesOf, describeDropWork, dropCorrect, dropItems, dropMiss, fallen, fallTime, FALLERS, fmt, keyChoice,
  keyOrder, landingOrder, landTogether, massText, measuredTime, nameOf, speedAt, tapLabel,
  workspaceScene, type Drop, type DropItem, type DropMode, type DropTier,
} from './gravityDropWorkspace';
import {
  AIR_LEVER, airLines, DROP_LEVERS, FALL_LEVER, fallLines, FILL_LEVER, fillLines, FORMULA_LEVER, formulaLines,
  MOON_LEVER, MOON_LINES, PATTERN_LEVER, patternLines, SAME_LOOK_LEVER, SLOW_LEVER, type DropLeverContext,
} from './gravityDropLevers';
import { gravityDropTowerBoss } from './gravityDropTower.boss';

// ============================================================================
// Data Types (single source of truth; the generator imports them)
// ============================================================================

export type { DropItem, DropMode, DropTier };

export interface GravityDropTowerData {
  title: string;
  description?: string;
  /** The eval modes this session asks, in order (`resolveDropModes`). */
  challengeTypes?: DropMode[];
  /** config.difficulty: the structural band the items were built at. */
  difficulty?: DropTier;
  /** The items, built and keyed by code at generation; absent or invalid: rebuilt from the fields above. */
  items?: DropItem[];
  gradeLevel?: string;
  /** Legacy generations (before 2026-10-15): read only for the modes. */
  challenges?: Array<{ type?: string }>;
  supportTier?: string;

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<GravityDropTowerMetrics>) => void;
}

interface GravityDropTowerProps {
  data: GravityDropTowerData;
  className?: string;
  /** Carried onto the runtime mount so the live host keeps its resolved plan metadata. */
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted rather than rebuilt from the item. */
  runtimeEvalMode?: string;
}

const MODE_LABEL: Record<DropMode, string> = {
  observe: 'Watch and tell', predict: 'Predict, then drop', compare: 'Landing order', measure: 'Read the stopwatch', calculate: 'Use h = ½gt²',
};

// ============================================================================
// The tower (canvas). Draws the drops it is given at physical time t; no speed or time label unless `stopwatch`.
// ============================================================================

const CANVAS_W = 700;
const CANVAS_H = 400;
const TOP = 40;
const GROUND = CANVAS_H - 56;

interface TowerPicture {
  drops: Drop[];
  air: boolean;
  /** Physical seconds since release (0 = on the platforms). */
  t: number;
  /** Drop heights drawn as "? m" with no ruler. */
  hideHeight: boolean;
  stopwatch: boolean;
  ghosts: boolean;
  levelLine: boolean;
  airArrows: boolean;
  sameLook: boolean;
  fallBars: boolean;
}

function drawTower(ctx: CanvasRenderingContext2D, p: TowerPicture, dpr: number) {
  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND);
  sky.addColorStop(0, '#0B1426'); sky.addColorStop(1, '#1E293B');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, CANVAS_W, GROUND);
  ctx.fillStyle = '#57534E'; ctx.fillRect(0, GROUND, CANVAS_W, CANVAS_H - GROUND);
  const maxH = Math.max(...p.drops.map(d => d.height));
  const pxPerM = (GROUND - TOP) / maxH;
  if (!p.hideHeight) {
    ctx.font = '10px sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(255,255,255,0.35)';
    const step = maxH > 40 ? 10 : maxH > 15 ? 5 : maxH > 6 ? 2 : 1;
    for (let m = 0; m <= maxH + 1e-9; m += step) {
      const y = GROUND - m * pxPerM;
      ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.beginPath(); ctx.moveTo(34, y); ctx.lineTo(CANVAS_W - 10, y); ctx.stroke();
      ctx.fillText(`${m} m`, 4, y + 3);
    }
  }
  if (p.air) {
    ctx.strokeStyle = 'rgba(147,197,253,0.12)';
    for (let i = 0; i < 7; i++) {
      const x = 70 + i * 90, o = (i * 37) % 60;
      for (let y = TOP + o; y < GROUND - 40; y += 90) { ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 14, y + 25, x, y + 50); ctx.stroke(); }
    }
  }
  const spacing = CANVAS_W / (p.drops.length + 1);
  const centers: Array<{ x: number; y: number }> = [];
  p.drops.forEach((d, i) => {
    const f = FALLERS[d.obj], x = spacing * (i + 1), r = p.sameLook ? 18 : 14 + Math.min(4, Math.log10(f.mass * 1000 + 1) * 2) * 2;
    const top = GROUND - d.height * pxPerM;
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x - 34, top - 4, 68, 4);
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(p.hideHeight ? '? m' : `${d.height} m`, x, top - 10);
    const total = fallTime(d.obj, d.height, p.air);
    // The object's centre: resting on its platform at t = 0, on the ground once it has fallen the whole height.
    const y0 = top - r, y1 = GROUND - r;
    const at = (tt: number) => y0 + (y1 - y0) * Math.min(1, fallen(d.obj, Math.min(tt, total), p.air) / d.height);
    if (p.fallBars) {
      ctx.fillStyle = 'rgba(56,189,248,0.35)'; ctx.fillRect(x + 40, top, 6, GROUND - top);
      ctx.fillStyle = 'rgba(186,230,253,0.9)'; ctx.textAlign = 'left'; ctx.fillText(`${d.height} m`, x + 50, (top + GROUND) / 2);
    }
    if (p.ghosts && p.t > 0) {
      for (let k = 1; k < 10; k++) {
        const gt = (total * k) / 10;
        if (gt > p.t) break;
        ctx.globalAlpha = 0.25; ctx.beginPath(); ctx.arc(x, at(gt), r * 0.8, 0, Math.PI * 2); ctx.fillStyle = '#93C5FD'; ctx.fill(); ctx.globalAlpha = 1;
      }
    }
    const yy = at(Math.max(0, p.t));
    centers.push({ x, y: yy });
    ctx.fillStyle = p.sameLook ? '#94A3B8' : `hsl(${200 - Math.min(160, f.mass * 25)}, 55%, 55%)`;
    ctx.beginPath(); ctx.arc(x, yy, r, 0, Math.PI * 2); ctx.fill();
    if (!p.sameLook) { ctx.font = `${Math.round(r)}px sans-serif`; ctx.textBaseline = 'middle'; ctx.fillText(f.emoji, x, yy); ctx.textBaseline = 'alphabetic'; }
    if (p.airArrows && p.air) {
      const len = f.vt <= 2 ? 46 : f.vt < 30 ? 18 : 6;
      ctx.strokeStyle = 'rgba(147,197,253,0.95)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + r + 10, yy + 10); ctx.lineTo(x + r + 10, yy + 10 - len); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + r + 4, yy + 16 - len); ctx.lineTo(x + r + 10, yy + 10 - len); ctx.lineTo(x + r + 16, yy + 16 - len); ctx.stroke(); ctx.lineWidth = 1;
    }
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(p.sameLook ? 'ball' : f.name, x, GROUND + 18);
    if (!p.sameLook) { ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.font = '10px sans-serif'; ctx.fillText(massText(d.obj), x, GROUND + 32); }
  });
  if (p.levelLine && p.t > 0 && centers.length === 2) {
    ctx.setLineDash([6, 4]); ctx.strokeStyle = 'rgba(251,191,36,0.8)';
    ctx.beginPath(); ctx.moveTo(centers[0].x, centers[0].y); ctx.lineTo(centers[1].x, centers[1].y); ctx.stroke(); ctx.setLineDash([]);
  }
  if (p.stopwatch) {
    const end = Math.max(...p.drops.map(d => fallTime(d.obj, d.height, p.air)));
    ctx.fillStyle = 'rgba(52,211,153,0.95)'; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'right';
    ctx.fillText(`⏱ ${fmt(Math.min(p.t, end))} s`, CANVAS_W - 12, 22);
  }
  ctx.restore();
}

interface Run { key: number; drops: Drop[]; air: boolean; rate: number; stopwatch: boolean }

/** Physical seconds per wall second: the whole drop plays in 1.2-4 s of wall time, a quarter as fast when slowed. */
const playRate = (drops: Drop[], air: boolean, slow: number) => {
  const end = Math.max(...drops.map(d => fallTime(d.obj, d.height, air)));
  return end / Math.min(4, Math.max(1.2, end / 0.7)) / slow;
};

const DropCanvas = ({ picture, run, onDone }: { picture: Omit<TowerPicture, 't'>; run: Run | null; onDone: () => void }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const t = useRef(0);
  const pic = useRef(picture); pic.current = picture;
  const done = useRef(onDone); done.current = onDone;
  const paint = () => {
    const c = ref.current, ctx = c?.getContext?.('2d');
    if (c && ctx) drawTower(ctx, { ...pic.current, ...(run ? { drops: run.drops, air: run.air, stopwatch: run.stopwatch } : {}), t: t.current }, window.devicePixelRatio || 1);
  };
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = CANVAS_W * dpr; c.height = CANVAS_H * dpr;
  }, []);
  useEffect(() => {
    if (!run) { t.current = 0; paint(); return; }
    t.current = 0;
    const end = Math.max(...run.drops.map(d => fallTime(d.obj, d.height, run.air)));
    let frame = 0;
    const step = () => {
      t.current = Math.min(end, t.current + run.rate / 60);
      paint();
      if (t.current >= end) { done.current(); return; }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run?.key]);
  // Lever pictures and a new item repaint without restarting a run.
  useEffect(() => { paint(); });
  return <canvas ref={ref} className="w-full rounded-lg border border-white/10" style={{ maxWidth: CANVAS_W, aspectRatio: `${CANVAS_W}/${CANVAS_H}` }}
    aria-label="The drop tower" />;
};

// ============================================================================
// Component
// ============================================================================

const useDropProgress = useWorkspaceProgressFor('gravity-drop-tower');
/** The levers read nothing beside the item. */
const LEVER_CTX: DropLeverContext = {};

const GravityDropTowerSurface = ({ data, className, runtimePlanItemId }: GravityDropTowerProps) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const { title, instanceId, skillId, subskillId, objectiveId, exhibitId, onEvaluationSubmit } = data;

  const items = useMemo(() => dropItems(data),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.items, data.challengeTypes, data.difficulty, data.title, data.challenges]);
  const stableInstanceId = useRef(instanceId || `gravity-drop-tower-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceId.current;

  // ── Progress: the runtime moves the index (callbacks bound below) ──
  const openItem = useRef<(index: number, retry: boolean) => void>(() => {});
  const solvedAloud = useRef<(index: number) => void>(() => {});
  /** Bound below; an answer the observer credited on the simplify lever's practice item. */
  const practiceAloud = useRef<(source: 'speech' | 'gesture') => void>(() => {});
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const progress = useDropProgress({
    challenges: items,
    getChallengeId: i => i.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: gravityDropTowerBoss.assignment,
    onItemOpened: (index, retry) => openItem.current(index, retry),
    onSolved: index => solvedAloud.current(index),
    onPracticeSolved: (_id, source) => practiceAloud.current(source),
    onFinished: result => finish.current(result),
  });
  const { currentIndex, currentAttempts, results, isComplete } = progress;
  /** A checked answer stays closed until Try again or Next challenge on the shell. */
  const learnerBlocked = () => progress.canAttempt === false;

  const sessionItem: DropItem | undefined = items[Math.min(currentIndex, Math.max(items.length - 1, 0))];
  const [practice, setPractice] = useState<DropItem | null>(null);
  const item = practice ?? sessionItem;

  const [choice, setChoice] = useState<string | null>(null);
  const [order, setOrder] = useState<number[]>([]);
  /** The wrong answer just checked, shown until Try again. */
  const [wrongPick, setWrongPick] = useState<{ choice: string | null; order: number[] } | null>(null);
  const [practiceSolved, setPracticeSolved] = useState(false);
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [submitted, setSubmitted] = useState(false);
  const [watched, setWatched] = useState(0);
  const [slowMo, setSlowMo] = useState(false);
  const [run, setRun] = useState<Run | null>(null);
  const [running, setRunning] = useState(false);
  const runKey = useRef(0);
  const tappedCorrect = useRef<string | null>(null);

  const pulled = sessionItem && leverState.item === sessionItem.id && !practice ? leverState.pulled : [];
  const leverOn = (id: string) => pulled.includes(id);
  const solvedNow = practice ? practiceSolved : !!item && results.some(r => r.challengeId === item.id && r.correct);
  const revealed = solvedNow;

  const { submitResult, hasSubmitted } = usePrimitiveEvaluation<GravityDropTowerMetrics>({
    primitiveType: 'gravity-drop-tower',
    instanceId: resolvedInstanceId,
    skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const startRun = (drops: Drop[], air: boolean, opts: { slow?: number; stopwatch?: boolean } = {}) => {
    runKey.current += 1;
    setRun({ key: runKey.current, drops, air, rate: playRate(drops, air, opts.slow ?? (slowMo ? 3 : 1)), stopwatch: !!opts.stopwatch });
    setRunning(true);
  };
  const clearWork = () => { setChoice(null); setOrder([]); setWrongPick(null); };
  const clearItem = () => {
    clearWork(); setPracticeSolved(false); setWatched(0); setRun(null); setRunning(false);
  };

  openItem.current = (_index, retry) => {
    if (retry) { clearWork(); setPracticeSolved(false); return; }
    setPractice(null); clearItem();
  };

  solvedAloud.current = (index) => {
    const solved = items[index];
    if (!solved || tappedCorrect.current === solved.id || results.some(r => r.challengeId === solved.id && r.correct)) return;
    progress.mergeResult({ challengeId: solved.id, correct: true, attempts: currentAttempts + 1 });
    if (solved.ask !== 'order') setChoice(keyChoice(solved));
    setWrongPick(null);
  };

  // A spoken answer credited on the practice item: shown there as on a session item, recorded nowhere. The full item
  // comes back blank when the practice closes. A tap shows its own credit in the check.
  practiceAloud.current = (source) => {
    if (source !== 'speech' || !practice) return;
    setPracticeSolved(true);
    if (practice.ask !== 'order') setChoice(keyChoice(practice));
    setWrongPick(null);
  };

  // Once credited, the asked drop runs: the test of the prediction. Observe is run by the learner.
  const revealedFor = revealed && item ? item.id : null;
  useEffect(() => {
    if (!revealedFor || !item || item.mode === 'observe') return;
    startRun(item.drops, item.air, { stopwatch: item.mode === 'measure' || item.mode === 'calculate', slow: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealedFor]);

  // ── Handlers ──
  const closed = revealed || wrongPick !== null || learnerBlocked();
  const mustWatch = item?.mode === 'observe' && watched === 0;

  const drop = () => {
    if (!item || running || learnerBlocked()) return;
    SoundManager.tap();
    setWatched(w => w + 1);
    startRun(item.drops, item.air);
  };
  const replayMeasured = (height: number) => {
    if (running) return;
    SoundManager.tap();
    startRun([{ obj: 'rock', height }], false, { stopwatch: true });
  };
  const pick = (c: string) => {
    if (!item || closed || mustWatch) return;
    SoundManager.select();
    setChoice(c);
  };
  const tapObject = (i: number) => {
    if (!item || closed || order.includes(i)) return;
    SoundManager.select();
    setOrder(o => [...o, i]);
  };
  const work = { choice, order };
  const ready = item ? (item.ask === 'order' ? order.length === item.drops.length : choice !== null) : false;

  const check = () => {
    if (!item || !ready || closed || mustWatch) return;
    const correct = dropCorrect(item, work);
    progress.commitCheck(describeDropWork(item, work), correct, correct ? undefined : dropMiss(item, work));
    if (correct) {
      SoundManager.playCorrect();
      if (practice) setPracticeSolved(true); else tappedCorrect.current = item.id;
      return;
    }
    SoundManager.playIncorrect();
    setWrongPick({ choice, order });
  };

  const metrics = (): GravityDropTowerMetrics => {
    const correct = items.filter(i => results.some(r => r.challengeId === i.id && r.correct)).length;
    const attempts = results.reduce((s, r) => s + (r.attempts ?? 0), 0);
    return {
      type: 'gravity-drop-tower', evalMode: items[0]?.mode, challengesCompleted: results.length, challengesCorrect: correct,
      totalAttempts: attempts, accuracy: items.length ? Math.round((correct / items.length) * 100) : 0,
      averageAttemptsPerChallenge: attempts / Math.max(results.length, 1),
    };
  };

  finish.current = (result) => {
    if (hasSubmitted || progress.recordsEvaluation === false || !items.length) return;
    setSubmitted(true);
    submitResult(result.passed, result.accuracy, { ...metrics(), totalAttempts: result.teachingAttempts.length },
      { challengeResults: result.outcomes, learningResponses: result.learningResponses,
        teachingAttempts: result.teachingAttempts, assistanceProvenance: result.assistanceProvenance },
      undefined, result.diagnosisEvidence);
  };

  // ── What the tutor and the observer are shown, republished every render ──
  useLayoutEffect(() => {
    if (!item || isComplete) return;
    const shownWork = wrongPick ?? work;
    const scene = workspaceScene(item, { ...shownWork, drops: watched, solved: revealed });
    // No lever on the practice item: the full item's levers come back with it.
    const levers = practice || !sessionItem ? [] : DROP_LEVERS.declare(sessionItem, LEVER_CTX, pulled);
    const withPractice = practice
      ? { ...scene, facts: { ...scene.facts, practice: 'A simpler item of the same kind, before the full item comes back.' } }
      : scene;
    workspace.current = {
      ...leverScene(withPractice, { support: '',
        onScreen: practice || !sessionItem ? '' : DROP_LEVERS.onScreen(sessionItem, LEVER_CTX, pulled) }),
      // observe waits for the learner to drop: before that there is nothing to answer from.
      ...(item.mode === 'observe' && watched === 0 ? { readyForResponse: false } : {}),
      levers,
      pullLever: (id) => {
        const l = levers.find(x => x.id === id);
        if (practice || !l || !sessionItem) return `No lever ${id} on this item.`;
        if (l.pulled) return `${id} is already on screen.`;
        const nextState = { item: sessionItem.id, pulled: [...pulled, id] };
        if (l.kind === 'simplify') {
          const simpler = DROP_LEVERS.simpler(sessionItem, LEVER_CTX, id);
          if (!simpler) return 'There is no simpler item here; try a help lever.';
          setLeverState(nextState); clearItem(); setPractice(simpler);
          return { practice: gravityDropTowerBoss.assignment(simpler) };
        }
        setLeverState(nextState);
        // Drawing the pulled slow replay: it plays the drop again, slowed, and counts as watching.
        if (id === SLOW_LEVER) { setWatched(w => w + 1); startRun(sessionItem.drops, sessionItem.air, { slow: 4 }); }
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
        <LuminaCardContent><p className="text-sm text-slate-400">This tower has no drops to ask about.</p></LuminaCardContent>
      </LuminaCard>
    );
  }

  const key = item && item.ask !== 'order' ? keyChoice(item) : '';
  const shownChoice = wrongPick?.choice ?? choice;
  const choiceState = (c: string): AnswerChoiceState => revealed ? (c === key ? 'correct' : c === choice ? 'incorrect' : 'dimmed')
    : wrongPick?.choice === c ? 'incorrect' : shownChoice === c ? 'selected' : 'idle';
  const shownOrder = wrongPick?.order ?? order;
  const hidden = !!item && !revealed && (item.ask === 'height');

  const revealText = (): string => {
    if (!item) return '';
    if (item.mode === 'measure' || item.mode === 'calculate') {
      const h = item.drops[0].height, t = fallTime('rock', h, false);
      return item.ask === 'impact' ? `From ${h} m the fall takes ${fmt(t)} s, and the rock hits the ground at ${fmt(speedAt('rock', t, false))} m/s.`
        : `From ${h} m the stopwatch reads ${fmt(t)} s.`;
    }
    if (item.ask === 'speed') return 'It sped up the whole way down: gravity keeps adding speed as it falls.';
    if (item.ask === 'order') return `They land ${keyOrder(item).map(i => nameOf(item.drops[i])).join(', then ')}.`;
    if (landTogether(item)) return 'They land together: with no air, gravity speeds every object up the same amount, heavy or light.';
    const first = item.drops[landingOrder(item)[0]], other = item.drops.find(d => d !== first)!;
    return `The ${nameOf(first)} lands first: air pushes back much harder on the ${nameOf(other)} for its weight.`;
  };

  const picture: Omit<TowerPicture, 't'> | null = item ? {
    drops: item.drops, air: item.air, hideHeight: hidden, stopwatch: false,
    ghosts: leverOn(SLOW_LEVER) && item.ask === 'speed', levelLine: leverOn(SLOW_LEVER) && item.drops.length === 2,
    airArrows: leverOn(AIR_LEVER), sameLook: leverOn(SAME_LOOK_LEVER), fallBars: leverOn(FALL_LEVER),
  } : null;

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader>
        <LuminaCardTitle>{title}</LuminaCardTitle>
        {!done && item && (
          <LuminaSectionLabel accent="cyan" size="sm">
            {practice ? 'A simpler item first' : `${MODE_LABEL[item.mode]} · item ${Math.min(currentIndex, items.length - 1) + 1} of ${items.length}`}
          </LuminaSectionLabel>
        )}
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {done ? (
          <LuminaFeedbackCard status="insight" label="Tower complete">
            {`${results.filter(r => r.correct).length} of ${items.length} drops answered.`}
          </LuminaFeedbackCard>
        ) : item && picture && (
          <>
            <LuminaPrompt accent="cyan" {...(practice ? { 'data-practice': 'simpler' } : {})}>{askOf(item)}</LuminaPrompt>

            {/* Pip comes from the workspace runner (`pip/WorkspacePip.tsx`): the dock above, the tower and the answers as its region. */}
            <PipDock />
            <PipWorkspace className="space-y-4">
              <DropCanvas picture={picture} run={run} onDone={() => setRunning(false)} />

              {item.mode === 'observe' && (
                <div className="flex flex-wrap items-center gap-3">
                  <LuminaButton tone="primary" aria-label="Drop" disabled={running || learnerBlocked()} onClick={drop}>
                    {running ? 'Falling…' : watched ? 'Drop again' : 'Drop'}
                  </LuminaButton>
                  <LuminaButton tone="subtle" aria-label={slowMo ? 'Slow motion on' : 'Slow motion off'} disabled={running}
                    onClick={() => setSlowMo(s => !s)}>{slowMo ? 'Slow motion: on' : 'Slow motion: off'}</LuminaButton>
                  {mustWatch && <span className="text-xs text-slate-400">Drop them and watch before you answer.</span>}
                </div>
              )}

              {item.mode === 'measure' && (
                <LuminaPanel>
                  <table className="w-full text-sm" aria-label="Stopwatch table">
                    <thead><tr className="text-left text-xs text-slate-400"><th className="py-1">Height</th><th className="py-1">Fall time</th><th /></tr></thead>
                    <tbody>
                      {(item.measured ?? []).map(m => (
                        <tr key={m} className="text-slate-200">
                          <td className="py-1 font-mono">{m} m</td><td className="py-1 font-mono">{fmt(measuredTime(m))} s</td>
                          <td className="py-1 text-right">
                            <LuminaButton tone="subtle" size="sm" aria-label={`Replay the ${m} m drop`} disabled={running} onClick={() => replayMeasured(m)}>Replay</LuminaButton>
                          </td>
                        </tr>
                      ))}
                      <tr className="text-cyan-200">
                        <td className="py-1 font-mono">{item.ask === 'height' && !revealed ? '?' : `${item.drops[0].height} m`}</td>
                        <td className="py-1 font-mono">{item.ask === 'time' && !revealed ? '?' : `${fmt(item.ask === 'height' ? item.time! : measuredTime(item.drops[0].height))} s`}</td>
                        <td />
                      </tr>
                    </tbody>
                  </table>
                  {leverOn(PATTERN_LEVER) && (
                    <p data-lever="pattern-line" className="mt-2 text-sm text-slate-300">{patternLines(item).join(' ')}</p>
                  )}
                </LuminaPanel>
              )}

              {leverOn(MOON_LEVER) && (
                <LuminaPanel accent="cyan" data-lever="moon-card" className="space-y-1 text-sm text-slate-300">
                  <p className="text-lg" aria-hidden="true">🌕 🔨 🪶</p>
                  {MOON_LINES.map(l => <p key={l}>{l}</p>)}
                </LuminaPanel>
              )}
              {leverOn(AIR_LEVER) && (
                <LuminaPanel accent="cyan" data-lever="air-arrows" className="space-y-1 text-sm text-slate-300">
                  {airLines(item).map(l => <p key={l}>{l}</p>)}
                </LuminaPanel>
              )}
              {leverOn(FALL_LEVER) && (
                <LuminaPanel accent="cyan" data-lever="fall-lines" className="text-sm text-slate-300">{fallLines(item).join(' · ')}</LuminaPanel>
              )}
              {leverOn(SAME_LOOK_LEVER) && (
                <LuminaPanel accent="cyan" data-lever="same-look" className="text-sm text-slate-300">The three are drawn as the same grey ball; only the heights differ.</LuminaPanel>
              )}
              {leverOn(SLOW_LEVER) && (
                <LuminaPanel accent="cyan" data-lever="slow-replay" className="text-sm text-slate-300">
                  {item.ask === 'speed' ? 'Slow replay with a ghost picture at equal moments of the fall.' : 'Slow replay with a line joining the two objects.'}
                </LuminaPanel>
              )}
              {leverOn(FORMULA_LEVER) && (
                <LuminaPanel accent="cyan" data-lever="formula-card" className="space-y-1 font-mono text-sm text-slate-300">
                  {formulaLines(item).map(l => <p key={l}>{l}</p>)}
                </LuminaPanel>
              )}
              {leverOn(FILL_LEVER) && (
                <LuminaPanel accent="cyan" data-lever="fill-in" className="space-y-1 font-mono text-sm text-slate-300">
                  {fillLines(item).map(l => <p key={l}>{l}</p>)}
                </LuminaPanel>
              )}

              {item.ask === 'order' ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    {item.drops.map((d, i) => {
                      const at = shownOrder.indexOf(i);
                      return (
                        <LuminaAnswerChoice key={i} aria-label={tapLabel(item, i)} disabled={closed || at >= 0}
                          state={revealed ? 'dimmed' : wrongPick ? 'incorrect' : at >= 0 ? 'selected' : 'idle'}
                          className="p-3 text-center text-sm" onClick={() => tapObject(i)}>
                          <span aria-hidden="true">{at >= 0 ? `${at + 1}. ` : ''}{FALLERS[d.obj].emoji} </span>
                          {tapLabel(item, i)}
                        </LuminaAnswerChoice>
                      );
                    })}
                  </div>
                  {!closed && order.length > 0 && (
                    <LuminaButton tone="subtle" size="sm" onClick={() => setOrder([])}>Start over</LuminaButton>
                  )}
                </div>
              ) : (
                <div className={`grid gap-2 ${choicesOf(item).length > 3 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-3'}`}>
                  {choicesOf(item).map(c => (
                    <LuminaAnswerChoice key={c} aria-label={c} state={choiceState(c)} disabled={closed || mustWatch}
                      className="p-3 text-center text-sm font-semibold" onClick={() => pick(c)}>
                      {c}
                    </LuminaAnswerChoice>
                  ))}
                </div>
              )}
            </PipWorkspace>

            {!revealed && (
              <div className="flex justify-center">
                <LuminaActionButton action="check" disabled={!ready || closed || mustWatch} onClick={check}>Check Answer</LuminaActionButton>
              </div>
            )}

            {revealed && <LuminaFeedbackCard status="correct">{revealText()}</LuminaFeedbackCard>}
            {revealed && item.mode !== 'observe' && (
              <div className="flex justify-center">
                <LuminaButton tone="subtle" size="sm" disabled={running}
                  onClick={() => startRun(item.drops, item.air, { stopwatch: item.mode === 'measure' || item.mode === 'calculate' })}>Watch the drop again</LuminaButton>
              </div>
            )}
            {!revealed && wrongPick !== null && <LuminaFeedbackCard status="incorrect">{wrongPick.choice ? `"${wrongPick.choice}" is not it.` : 'That order is not it.'}</LuminaFeedbackCard>}
          </>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

const GravityDropTower = withWorkspaceOnly<GravityDropTowerProps>('gravity-drop-tower', GravityDropTowerSurface, props => props.data.title);

export default GravityDropTower;
