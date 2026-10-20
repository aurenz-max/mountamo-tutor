'use client';

/**
 * Flight Forces Explorer: a plane, its four force arrows (lift, weight, thrust, drag), and one task per eval mode.
 * - predict: a plane flying level at a steady speed, one change (a pilot action, a load); predict what it does, then
 *   the change runs.
 * - observe: a plane drawn with its arrows at set lengths, standing still; say what its height and speed are doing.
 * - adjust: a goal; set the thrust and the nose angle, then fly it.
 *
 * Every item is built and keyed by code (`flightForcesWorkspace.ts`). No label, badge or readout names what the plane
 * is doing, and the plane moves only after a credited answer (predict, observe) or a flight (adjust). Taught only on
 * the shared tutor/JEV workspace (`withWorkspaceOnly`; its wiring is `flightForcesExplorer.card.ts` +
 * `flightForcesExplorer.boss.ts`): every check commits through `progress.commitCheck` with a named miss, a spoken
 * answer is judged by the tutor against the key, and the runtime moves on. The levers are one lever set in
 * `flightForcesLevers.ts`.
 */
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../../../evaluation';
import type { FlightForcesExplorerMetrics } from '../../../evaluation/types';
import { SoundManager } from '../../../utils/SoundManager';
import { PipDock, PipWorkspace } from '../../../pip/WorkspacePip';
import {
  LuminaActionButton,
  LuminaAnswerChoice,
  LuminaButton,
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaFeedbackCard,
  LuminaPanel,
  LuminaPrompt,
  LuminaSectionLabel,
  type AnswerChoiceState,
} from '../../../ui';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { TeachingEvaluationResult } from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceProgressFor } from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { leverScene } from '../../../components/live-activity/bossLevers';
import {
  angleOf, askedAxes, askOf, choicesFor, describeFlightWork, emptyWork, flightCorrect, flightItems, flightMiss,
  forcesAt, forcesRun, isStalled, keyOf, LEVEL, MAX_THRUST, maxNose, motionText, solution, speedOf, workComplete,
  workspaceScene, type AircraftId, type Axis, type FlightItem, type FlightMode, type FlightTier,
  type FlightWork, type Forces, type Setting,
} from './flightForcesWorkspace';
import {
  COUNT_UNITS_LEVER, countLines, FLIGHT_LEVERS, FORCE_LINK_LEVER, forceLinkLines, PAIR_UP_LEVER,
  SHOW_ARROWS_LEVER, shownArrows, STALL_MARK_LEVER, stallLine, TARGET_MARKS_LEVER,
} from './flightForcesLevers';
import { flightForcesExplorerBoss } from './flightForcesExplorer.boss';

// ============================================================================
// Data Types (single source of truth; the generator imports them)
// ============================================================================

export type { FlightItem, FlightMode, FlightTier };

export interface FlightForcesExplorerData {
  title: string;
  description?: string;
  /** One sentence shown under the title; never states an outcome. */
  overview?: string;
  aircraftType?: string;
  aircraftName?: string;
  gradeBand?: '1-2' | '3-5';
  /** The eval modes this session asks, in order (`resolveFlightModes`). */
  challengeTypes?: FlightMode[];
  /** config.difficulty: the structural band the items were built at. */
  difficulty?: FlightTier;
  /** The items, built and keyed by code at generation; absent or invalid: rebuilt from the fields above. */
  items?: FlightItem[];
  /** Legacy generations (model-written multiple choice): read only for their modes. */
  challenges?: Array<{ type?: string }>;
  forceDescriptions?: Record<string, { name: string; description: string; analogy: string }>;
  flightStateDescriptions?: Record<string, { name: string; description: string }>;

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<FlightForcesExplorerMetrics>) => void;
}

interface FlightForcesExplorerProps {
  data: FlightForcesExplorerData;
  className?: string;
  runtimePlanItemId?: string;
  runtimeEvalMode?: string;
}

const MODE_LABEL: Record<FlightMode, string> = { predict: 'Predict, then watch', observe: 'Read the arrows', adjust: 'Set the controls' };
const AXIS_LABEL: Record<Axis, string> = { height: 'Height', speed: 'Speed' };

// ============================================================================
// The flight scene (canvas). Draws the arrows it is given; the plane moves only when `motion` is set.
// ============================================================================

const CW = 640;
const CH = 360;
const UNIT = 11;
const COLORS = { lift: '#60a5fa', weight: '#f87171', thrust: '#4ade80', drag: '#fb923c' };

interface SceneProps {
  aircraft: AircraftId;
  forces: Forces;
  pitch: number;
  /** The forces that move the plane, once run; null while it holds still. */
  motion: Forces | null;
  stalled: boolean;
  marks: { lift: number; thrust: number } | null;
}

const FlightScene = ({ aircraft, forces, pitch, motion, stalled, marks }: SceneProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const live = useRef({ forces, pitch, motion, stalled, marks });
  live.current = { forces, pitch, motion, stalled, marks };
  const sim = useRef({ y: CH * 0.5, scroll: 0, speed: 1 });
  const particles = useRef<Array<{ x: number; y: number; v: number; swirl: number }>>([]);

  // A new run starts from the middle at the cruising speed.
  useEffect(() => { sim.current = { y: CH * 0.5, scroll: sim.current.scroll, speed: 1 }; }, [motion]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext?.('2d');
    if (!ctx) return;
    let frame = 0;
    const clouds = Array.from({ length: 7 }, (_, i) => ({ x: (i * 173) % CW, y: 30 + (i * 61) % 110, w: 40 + (i * 29) % 40 }));
    const arrow = (x: number, y: number, dx: number, dy: number, n: number, color: string, label: string) => {
      const len = n * UNIT;
      if (len <= 0) return;
      ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dx * len, y + dy * len); ctx.stroke();
      // One tick per unit, so the lengths can be counted.
      ctx.lineWidth = 2;
      for (let i = 1; i < n; i++) {
        const tx = x + dx * i * UNIT, ty = y + dy * i * UNIT;
        ctx.beginPath(); ctx.moveTo(tx - dy * 5, ty - dx * 5); ctx.lineTo(tx + dy * 5, ty + dx * 5); ctx.stroke();
      }
      const ex = x + dx * len, ey = y + dy * len;
      ctx.beginPath(); ctx.moveTo(ex + dx * 10, ey + dy * 10); ctx.lineTo(ex - dy * 6, ey - dx * 6); ctx.lineTo(ex + dy * 6, ey + dx * 6); ctx.closePath(); ctx.fill();
      ctx.font = '10px monospace'; ctx.textAlign = 'center';
      ctx.fillText(label, ex + dx * 24 + (dy !== 0 ? 22 : 0), ey + dy * 24 + (dx !== 0 ? -10 : 4));
    };
    const draw = () => {
      const { forces: f, pitch: p, motion: m, stalled: st, marks: mk } = live.current;
      const s = sim.current;
      if (m) {
        const dv = m.lift - m.weight, dh = m.thrust - m.drag;
        s.y = Math.max(70, Math.min(CH - 70, s.y - dv * 0.12));
        s.speed = Math.max(0.3, Math.min(2.4, s.speed + dh * 0.002));
      }
      s.scroll = (s.scroll + 1.6 * s.speed) % CW;
      const px = CW * 0.45, py = s.y;
      const bg = ctx.createLinearGradient(0, 0, 0, CH);
      bg.addColorStop(0, '#0a1628'); bg.addColorStop(1, '#1e3a5f');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, CW, CH);
      ctx.fillStyle = 'rgba(148,163,184,0.10)';
      for (const c of clouds) { ctx.beginPath(); ctx.ellipse(((c.x - s.scroll) % CW + CW) % CW, c.y, c.w, 12, 0, 0, Math.PI * 2); ctx.fill(); }
      // Air streaming past the wing: faster over the top; swirling above it when the wing is stalled.
      while (particles.current.length < 50) particles.current.push({ x: CW + Math.random() * 60, y: py + (Math.random() - 0.5) * 160, v: 2.5 + Math.random(), swirl: 0 });
      for (const q of particles.current) {
        const over = q.y < py && Math.abs(q.x - px) < 60;
        q.x -= q.v * s.speed * (over && !st ? 1.5 : 1);
        if (over && st) { q.swirl += 0.2; q.y += Math.sin(q.swirl) * 2; }
        ctx.beginPath(); ctx.arc(q.x, q.y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = over && st ? 'rgba(248,113,113,0.6)' : 'rgba(165,210,255,0.45)'; ctx.fill();
      }
      particles.current = particles.current.filter(q => q.x > -20);
      ctx.save(); ctx.translate(px, py); ctx.rotate((-p * Math.PI) / 180);
      ctx.fillStyle = '#64748b';
      ctx.beginPath(); ctx.ellipse(0, 0, 44, 9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-6, -2); ctx.lineTo(18, -2); ctx.lineTo(4, -26); ctx.closePath(); ctx.fillStyle = '#475569'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(-40, -2); ctx.lineTo(-30, -2); ctx.lineTo(-44, -20); ctx.closePath(); ctx.fill();
      ctx.restore();
      arrow(px, py, 0, -1, f.lift, COLORS.lift, 'LIFT');
      arrow(px, py, 0, 1, f.weight, COLORS.weight, 'WEIGHT');
      arrow(px, py, 1, 0, f.thrust, COLORS.thrust, 'THRUST');
      arrow(px, py, -1, 0, f.drag, COLORS.drag, 'DRAG');
      if (mk) {
        ctx.setLineDash([5, 4]); ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(px - 14, py - mk.lift * UNIT); ctx.lineTo(px + 14, py - mk.lift * UNIT); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(px + mk.thrust * UNIT, py - 14); ctx.lineTo(px + mk.thrust * UNIT, py + 14); ctx.stroke();
        ctx.setLineDash([]);
      }
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [aircraft]);

  return <canvas ref={canvasRef} width={CW} height={CH} className="w-full rounded-xl border border-white/10"
    style={{ maxWidth: CW }} aria-label="The plane and its four force arrows" />;
};

/** pair_up: the arrows side by side in their pairs, as bars on one unit grid. */
const PairBars = ({ forces, counts }: { forces: Forces; counts: boolean }) => (
  <LuminaPanel accent="cyan" data-lever="pair-up" className="space-y-2 text-xs text-slate-300">
    {([['lift', 'weight'], ['thrust', 'drag']] as Array<[keyof Forces, keyof Forces]>).map(pair => (
      <div key={pair[0]} className="space-y-1">
        {pair.map(k => (
          <div key={k} className="flex items-center gap-2">
            <span className="w-14 capitalize">{k}</span>
            <div className="flex">
              {Array.from({ length: forces[k] }, (_, i) => (
                <span key={i} className="mr-px inline-block h-3 w-3 rounded-sm" style={{ background: COLORS[k] }} />
              ))}
            </div>
            {counts && <span className="font-mono">{forces[k]}</span>}
          </div>
        ))}
      </div>
    ))}
  </LuminaPanel>
);

// ============================================================================
// Component
// ============================================================================

const pairSentence = (f: Forces, axis: Axis): string => axis === 'height'
  ? (f.lift === f.weight ? `Lift (${f.lift}) is as big as weight (${f.weight}).` : f.lift > f.weight ? `Lift (${f.lift}) is bigger than weight (${f.weight}).` : `Weight (${f.weight}) is bigger than lift (${f.lift}).`)
  : (f.thrust === f.drag ? `Thrust (${f.thrust}) is as big as drag (${f.drag}).` : f.thrust > f.drag ? `Thrust (${f.thrust}) is bigger than drag (${f.drag}).` : `Drag (${f.drag}) is bigger than thrust (${f.thrust}).`);

const useFlightProgress = useWorkspaceProgressFor('flight-forces-explorer');

const FlightForcesExplorerSurface = ({ data, className, runtimePlanItemId }: FlightForcesExplorerProps) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const { title, overview, instanceId, skillId, subskillId, objectiveId, exhibitId, onEvaluationSubmit } = data;

  const items = useMemo(() => flightItems(data),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.items, data.challengeTypes, data.difficulty, data.aircraftType, data.title]);
  const stableInstanceId = useRef(instanceId || `flight-forces-explorer-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceId.current;

  // ── Progress: the runtime moves the index (callbacks bound below) ──
  const openItem = useRef<(index: number, retry: boolean) => void>(() => {});
  const solvedAloud = useRef<(index: number) => void>(() => {});
  /** Bound below; an answer the observer credited on the simplify lever's practice item. */
  const practiceAloud = useRef<(source: 'speech' | 'gesture') => void>(() => {});
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const progress = useFlightProgress({
    challenges: items,
    getChallengeId: i => i.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: flightForcesExplorerBoss.assignment,
    onItemOpened: (index, retry) => openItem.current(index, retry),
    onSolved: index => solvedAloud.current(index),
    onPracticeSolved: (_id, source) => practiceAloud.current(source),
    onFinished: result => finish.current(result),
  });
  const { currentIndex, currentAttempts, results, isComplete } = progress;
  /** A checked answer stays closed until Try again or Next challenge on the shell. */
  const learnerBlocked = () => progress.canAttempt === false;

  const sessionItem: FlightItem | undefined = items[Math.min(currentIndex, Math.max(items.length - 1, 0))];
  const [practice, setPractice] = useState<FlightItem | null>(null);
  const item = practice ?? sessionItem;

  const [work, setWork] = useState<FlightWork>(() => emptyWork(sessionItem));
  /** The checked wrong work, shown until Try again. */
  const [wrongShown, setWrongShown] = useState(false);
  /** Adjust: the setting last flown. */
  const [flown, setFlown] = useState<Setting | null>(null);
  const [practiceSolved, setPracticeSolved] = useState(false);
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [submitted, setSubmitted] = useState(false);
  const tappedCorrect = useRef<string | null>(null);

  const pulled = sessionItem && leverState.item === sessionItem.id && !practice ? leverState.pulled : [];
  const leverOn = (id: string) => pulled.includes(id);
  const solvedNow = practice ? practiceSolved : !!item && results.some(r => r.challengeId === item.id && r.correct);
  const revealed = solvedNow;

  const { submitResult, hasSubmitted } = usePrimitiveEvaluation<FlightForcesExplorerMetrics>({
    primitiveType: 'flight-forces-explorer',
    instanceId: resolvedInstanceId,
    skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const clearItem = (next?: FlightItem) => {
    setWork(emptyWork(next ?? item)); setWrongShown(false); setFlown(null); setPracticeSolved(false);
  };

  openItem.current = (index, retry) => {
    if (retry) { clearItem(item); return; }
    setPractice(null); clearItem(items[index]);
  };

  solvedAloud.current = (index) => {
    const solved = items[index];
    if (!solved || solved.mode === 'adjust' || tappedCorrect.current === solved.id || results.some(r => r.challengeId === solved.id && r.correct)) return;
    progress.mergeResult({ challengeId: solved.id, correct: true, attempts: currentAttempts + 1 });
    setWork(w => ({ ...w, ...keyOf(solved) })); setWrongShown(false);
  };

  // A spoken answer credited on the practice item: shown there as on a session item, recorded nowhere. The full item
  // comes back blank when the practice closes. A tap shows its own credit in the check.
  practiceAloud.current = (source) => {
    if (source !== 'speech' || !practice || practice.mode === 'adjust') return;
    setPracticeSolved(true);
    setWork(w => ({ ...w, ...keyOf(practice) })); setWrongShown(false);
  };

  // ── Handlers ──
  const closed = revealed || wrongShown || learnerBlocked();
  const pick = (axis: Axis, c: string) => {
    if (!item || closed) return;
    SoundManager.select();
    setWork(w => ({ ...w, [axis]: c }));
  };
  const nudge = (control: 'thrust' | 'nose', by: number) => {
    if (!item || item.mode !== 'adjust' || closed || !item.controls.includes(control)) return;
    SoundManager.tick();
    setWork(w => {
      const max = control === 'thrust' ? MAX_THRUST : maxNose(item);
      return { ...w, setting: { ...w.setting, [control]: Math.max(0, Math.min(max, w.setting[control] + by)) } };
    });
    setFlown(null);
  };

  const check = () => {
    if (!item || closed || !workComplete(item, work)) return;
    const correct = flightCorrect(item, work);
    progress.commitCheck(describeFlightWork(item, work), correct, correct ? undefined : flightMiss(item, work));
    if (item.mode === 'adjust') setFlown({ ...work.setting });
    if (correct) {
      SoundManager.playCorrect();
      if (practice) setPracticeSolved(true); else tappedCorrect.current = item.id;
      return;
    }
    SoundManager.playIncorrect();
    setWrongShown(true);
  };

  const metrics = (): FlightForcesExplorerMetrics => {
    const right = items.filter(i => results.some(r => r.challengeId === i.id && r.correct));
    return {
      type: 'flight-forces-explorer',
      flightStatesExplored: new Set(right.map(i => (i.mode === 'adjust' ? motionText(forcesAt(i, solution(i) ?? i.start))
        : i.mode === 'observe' ? motionText(i.forces) : motionText(forcesRun(i))))).size,
      flightStatesTotal: 9,
      aircraftTypesExplored: new Set(items.map(i => i.aircraft)).size,
      stallDiscoveries: right.filter(i => (i.mode === 'predict' && i.change === 'stall') || (i.mode === 'adjust' && i.stall)).length,
      challengesCompleted: results.length,
      challengesCorrect: right.length,
      challengesTotal: items.length,
      attemptsCount: currentAttempts,
    };
  };

  finish.current = (result) => {
    if (hasSubmitted || progress.recordsEvaluation === false || !items.length) return;
    setSubmitted(true);
    submitResult(result.passed, result.accuracy, { ...metrics(), attemptsCount: result.teachingAttempts.length },
      { challengeResults: result.outcomes, learningResponses: result.learningResponses,
        teachingAttempts: result.teachingAttempts, assistanceProvenance: result.assistanceProvenance },
      undefined, result.diagnosisEvidence);
  };

  // ── What the tutor and the observer are shown, republished every render ──
  useLayoutEffect(() => {
    if (!item || isComplete) return;
    const scene = workspaceScene(item, { work, solved: revealed, flown });
    const ctx = { setting: work.setting };
    // No lever on the practice item: the full item's levers come back with it.
    const levers = practice || !sessionItem ? [] : FLIGHT_LEVERS.declare(sessionItem, ctx, pulled);
    const withPractice = practice
      ? { ...scene, facts: { ...scene.facts, practice: 'A simpler item of the same kind, before the full item comes back.' } }
      : scene;
    workspace.current = {
      ...leverScene(withPractice, { support: '',
        onScreen: practice || !sessionItem ? '' : FLIGHT_LEVERS.onScreen(sessionItem, ctx, pulled) }),
      levers,
      pullLever: (id) => {
        const l = levers.find(x => x.id === id);
        if (practice || !l || !sessionItem) return `No lever ${id} on this item.`;
        if (l.pulled) return `${id} is already on screen.`;
        const nextState = { item: sessionItem.id, pulled: [...pulled, id] };
        if (l.kind === 'simplify') {
          const simpler = FLIGHT_LEVERS.simpler(sessionItem, ctx, id);
          if (!simpler) return 'There is no simpler item here; try a help lever.';
          setLeverState(nextState); clearItem(simpler); setPractice(simpler);
          return { practice: flightForcesExplorerBoss.assignment(simpler) };
        }
        setLeverState(nextState);
        return true;
      },
      endPractice: () => { clearItem(sessionItem); setPractice(null); },
    };
  });

  const done = hasSubmitted || submitted || isComplete;

  if (!items.length) {
    return (
      <LuminaCard className={className}>
        <LuminaCardHeader><LuminaCardTitle>{title}</LuminaCardTitle></LuminaCardHeader>
        <LuminaCardContent><p className="text-sm text-slate-400">This lab has no questions to ask.</p></LuminaCardContent>
      </LuminaCard>
    );
  }

  // ── What the scene draws ──
  let drawn: Forces = LEVEL, pitch = 2, motion: Forces | null = null, stalled = false;
  let marks: SceneProps['marks'] = null;
  if (item?.mode === 'predict') {
    const run = forcesRun(item);
    drawn = revealed ? run : leverOn(SHOW_ARROWS_LEVER) ? shownArrows(item) : LEVEL;
    pitch = revealed && (item.change === 'nose_up' || item.change === 'stall') ? (item.change === 'stall' ? 18 : 6) : 2;
    motion = revealed ? run : null;
    stalled = revealed && item.change === 'stall';
  } else if (item?.mode === 'observe') {
    drawn = item.forces; pitch = item.noseUp ? 12 : 2; motion = revealed ? item.forces : null;
  } else if (item?.mode === 'adjust') {
    drawn = forcesAt(item, work.setting); pitch = angleOf(work.setting.nose);
    motion = flown ? forcesAt(item, flown) : null;
    stalled = isStalled(item, work.setting);
    if (leverOn(TARGET_MARKS_LEVER)) marks = { lift: drawn.weight, thrust: drawn.drag };
  }

  const choiceState = (axis: Axis, c: string): AnswerChoiceState => {
    if (!item || item.mode === 'adjust') return 'idle';
    const key = keyOf(item)[axis];
    if (revealed) return c === key ? 'correct' : c === work[axis] ? 'incorrect' : 'dimmed';
    if (wrongShown && work[axis] === c) return c === key ? 'selected' : 'incorrect';
    return work[axis] === c ? 'selected' : 'idle';
  };

  const revealText = (): string => {
    if (!item) return '';
    if (item.mode === 'adjust') {
      const f = forcesAt(item, flown ?? work.setting);
      return `The plane ${motionText(f)}. ${pairSentence(f, 'height')} ${pairSentence(f, 'speed')}`;
    }
    const f = item.mode === 'observe' ? item.forces : forcesRun(item);
    const axes = askedAxes(item);
    const lead = item.mode === 'predict' && item.later
      ? (speedOf(shownArrows(item)) === 'Slows down' ? 'First the plane slows down, so less air rushes over the wings and the lift gets smaller. '
        : 'First the plane speeds up, so more air rushes over the wings and the lift gets bigger. ')
      : item.mode === 'predict' && item.change === 'stall' ? 'Past the stall angle the air swirls off the top of the wing, and the lift collapses. ' : '';
    return `${lead}The plane ${motionText(f)}. ${axes.map(a => pairSentence(f, a)).join(' ')}`;
  };

  const adjustItem = item?.mode === 'adjust' ? item : null;

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader>
        <LuminaCardTitle>{title}</LuminaCardTitle>
        {!done && item && (
          <LuminaSectionLabel accent="cyan" size="sm">
            {practice ? 'A simpler item first' : `${MODE_LABEL[item.mode]} · item ${Math.min(currentIndex, items.length - 1) + 1} of ${items.length}`}
          </LuminaSectionLabel>
        )}
        {overview && !done && <p className="text-sm text-slate-400">{overview}</p>}
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {done ? (
          <LuminaFeedbackCard status="insight" label="Lab complete">
            {`${results.filter(r => r.correct).length} of ${items.length} items answered.`}
          </LuminaFeedbackCard>
        ) : item && (
          <>
            <LuminaPrompt accent="cyan" {...(practice ? { 'data-practice': 'simpler' } : {})}>{askOf(item)}</LuminaPrompt>

            {/* Pip comes from the workspace runner (`pip/WorkspacePip.tsx`): the dock above, the plane and the answer as its region. */}
            <PipDock />
            <PipWorkspace className="space-y-4">
              <FlightScene aircraft={item.aircraft} forces={drawn} pitch={pitch} motion={motion} stalled={stalled} marks={marks} />

              {item.mode === 'predict' && leverOn(FORCE_LINK_LEVER) && (
                <LuminaPanel accent="cyan" data-lever="force-link" className="text-sm text-slate-300">
                  {forceLinkLines(item).map(l => <p key={l}>{l}</p>)}
                </LuminaPanel>
              )}
              {item.mode === 'predict' && leverOn(SHOW_ARROWS_LEVER) && !revealed && (
                <LuminaPanel accent="cyan" data-lever="show-arrows" className="text-sm text-slate-300">
                  The arrows now show the forces right after the change. The plane has not moved yet.
                </LuminaPanel>
              )}
              {item.mode === 'observe' && (leverOn(PAIR_UP_LEVER) || leverOn(COUNT_UNITS_LEVER)) && (
                leverOn(PAIR_UP_LEVER) ? <PairBars forces={item.forces} counts={leverOn(COUNT_UNITS_LEVER)} />
                  : <LuminaPanel accent="cyan" data-lever="count-units" className="font-mono text-sm text-slate-300">{countLines(item.forces).join('   ')}</LuminaPanel>
              )}

              {item.mode !== 'adjust' && (
                <div className="space-y-2">
                  {askedAxes(item).map(axis => (
                    <div key={axis} className="space-y-1">
                      {askedAxes(item).length > 1 && <p className="text-xs uppercase tracking-wider text-slate-400">{AXIS_LABEL[axis]}</p>}
                      <div className="grid grid-cols-3 gap-2">
                        {choicesFor(axis).map(c => (
                          <LuminaAnswerChoice key={c} aria-label={c} state={choiceState(axis, c)} disabled={closed}
                            className="p-3 text-center font-semibold" onClick={() => pick(axis, c)}>
                            {c}
                          </LuminaAnswerChoice>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {adjustItem && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <LuminaPanel className="space-y-2">
                    <p className="text-xs uppercase tracking-wider text-slate-400">Thrust</p>
                    <div className="flex items-center gap-3">
                      <LuminaButton aria-label="Less thrust" disabled={closed || !adjustItem.controls.includes('thrust') || work.setting.thrust <= 0} onClick={() => nudge('thrust', -1)}>−</LuminaButton>
                      <span className="font-mono text-lg text-green-300">{work.setting.thrust}</span>
                      <LuminaButton aria-label="More thrust" disabled={closed || !adjustItem.controls.includes('thrust') || work.setting.thrust >= MAX_THRUST} onClick={() => nudge('thrust', 1)}>+</LuminaButton>
                      {!adjustItem.controls.includes('thrust') && <span className="text-xs text-slate-500">fixed</span>}
                    </div>
                  </LuminaPanel>
                  <LuminaPanel className="space-y-2">
                    <p className="text-xs uppercase tracking-wider text-slate-400">Nose angle</p>
                    <div className="flex items-center gap-3">
                      <LuminaButton aria-label="Nose down" disabled={closed || !adjustItem.controls.includes('nose') || work.setting.nose <= 0} onClick={() => nudge('nose', -1)}>−</LuminaButton>
                      <span className="font-mono text-lg text-sky-300">{`${angleOf(work.setting.nose)}°`}</span>
                      <LuminaButton aria-label="Nose up" disabled={closed || !adjustItem.controls.includes('nose') || work.setting.nose >= maxNose(adjustItem)} onClick={() => nudge('nose', 1)}>+</LuminaButton>
                      {!adjustItem.controls.includes('nose') && <span className="text-xs text-slate-500">fixed</span>}
                    </div>
                    {leverOn(STALL_MARK_LEVER) && <p data-lever="stall-mark" className="text-xs text-rose-300">{stallLine(adjustItem)}</p>}
                  </LuminaPanel>
                  {leverOn(TARGET_MARKS_LEVER) && (
                    <LuminaPanel accent="cyan" data-lever="target-marks" className="text-sm text-slate-300 sm:col-span-2">
                      {`Dashed marks: on the lift arrow at the weight's length (${drawn.weight}), on the thrust arrow at the drag's length (${drawn.drag}). A mark shows where an arrow would equal its partner.`}
                    </LuminaPanel>
                  )}
                </div>
              )}
            </PipWorkspace>

            {!revealed && (
              <div className="flex justify-center">
                <LuminaActionButton action="check" disabled={closed || !workComplete(item, work)} onClick={check}>
                  {item.mode === 'adjust' ? 'Fly and check' : 'Check Answer'}
                </LuminaActionButton>
              </div>
            )}

            {revealed && <LuminaFeedbackCard status="correct">{revealText()}</LuminaFeedbackCard>}
            {!revealed && wrongShown && (
              <LuminaFeedbackCard status="incorrect">
                {item.mode === 'adjust' && flown ? `The plane ${motionText(forcesAt(item, flown))}. That is not the goal.` : 'That is not it.'}
              </LuminaFeedbackCard>
            )}
          </>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

const FlightForcesExplorer = withWorkspaceOnly<FlightForcesExplorerProps>('flight-forces-explorer', FlightForcesExplorerSurface, props => props.data.title);

export default FlightForcesExplorer;
