'use client';

/**
 * Orbit Mechanics Lab: a rocket above Earth, gravity, and one task per eval mode (rebuilt 2026-10-16 under the 10-15
 * ruling; the old lab scored a thrust-slider sandbox, kept the K-1 answer always in the middle and retried until right).
 * - pick_speed: say or tap the sideways push that makes the rocket fall back, circle, swing out in a stretched loop, or fly away.
 * - orbit_speed: say or tap the fastest or slowest rocket, or the one with the shortest or longest trip around Earth.
 * - predict_burn: say or tap what a push forward or backward does to a circling rocket's path.
 * - circularize: say or tap where and which way to fire once, to turn a stretched loop into a circle.
 *
 * Every item is built and keyed by code from the physics (`orbitWorkspace.ts`). Nothing flies before the answer is
 * checked, and no label says what a push or a rocket does. Two paths, chosen by `withWorkspaceController`: the scripted
 * path (tester, no tutor) has its own Next and two tries before a reveal; the workspace path (W1, plain shape) commits
 * every check through `progress.commitCheck` with a named miss, takes a spoken answer judged by the tutor, and lets the
 * runtime move on. The levers live in `orbitLevers.ts`.
 */
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../../../evaluation';
import type { OrbitMechanicsLabMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { SoundManager } from '../../../utils/SoundManager';
import { useWorkspacePipSurface } from '../../../pip/useWorkspacePipSurface';
import { ReadMeButton } from '../../shared/ReadMeButton';
import {
  LuminaActionButton,
  LuminaAnswerChoice,
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
import { withWorkspaceController } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useScriptedProgress, useWorkspaceProgressFor, type Progress, type ProgressOptions }
  from '../../../components/live-activity/runtime/useWorkspaceProgress';
import {
  answerFlight, askOf, BURN_TEXT, burnResult, choiceKey, choiceLabel, CIRCLE_TEXT, COLOR_HEX, craftLabel,
  craftPeriod, describeOrbitWork, emptyWork, flightText, isTapItem, loopPoint, orbitCorrect, orbitItems, orbitMiss,
  PATH_TEXT, pushLabel, pushPath, RE, tapKey, tapLabel, viewKm, workComplete, workspaceAssignment, workspaceScene,
  type ChoiceItem, type CircleItem, type OrbitItem, type OrbitMode, type OrbitTier, type OrbitWork, type Path,
  type TapItem,
} from './orbitWorkspace';
import {
  BURN_CARD_LEVER, BURN_CARD_LINES, DROP_LEVER, dropTarget, leverFacts, MARK_POINTS_LEVER, NO_LEVERS, orbitLevers,
  PULL_CARD_LINE, PULL_LEVER, SAME_SIZE_LEVER, SPEED_ARROWS_LEVER, speedArrows, THROW_CARD_LINE, THROW_LEVER,
  type OrbitLeverState,
} from './orbitLevers';

// ============================================================================
// Data Types (single source of truth; the generator imports them)
// ============================================================================

export type { OrbitItem, OrbitMode, OrbitTier };
/** Legacy names `types.ts` re-exports. */
export interface OrbitConfig { semiMajorAxis: number; eccentricity: number; argumentOfPeriapsis?: number }
export interface OrbitalBody { id: string; name: string; type: 'spacecraft' | 'target' | 'debris'; color: string }

export interface OrbitMechanicsLabData {
  title: string;
  description?: string;
  /** One neutral sentence under the title; never states what a push or a burn does. */
  overview?: string;
  /** Grade rung 'K'..'5'. */
  gradeLevel?: string;
  /** The eval modes this session asks, in order. */
  challengeTypes?: OrbitMode[];
  /** config.difficulty: the structural band the items were built at. */
  difficulty?: OrbitTier;
  /** The items, built and keyed by code at generation; absent or invalid: rebuilt from the fields above. */
  items?: OrbitItem[];

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<OrbitMechanicsLabMetrics>) => void;
}

interface OrbitMechanicsLabProps {
  data: OrbitMechanicsLabData;
  className?: string;
  runtimePlanItemId?: string;
  runtimeEvalMode?: string;
}

const MODE_LABEL: Record<OrbitMode, string> = {
  pick_speed: 'Pick the push', orbit_speed: 'Which rocket?', predict_burn: 'Predict the burn', circularize: 'Make it a circle',
};

// ============================================================================
// The space view (bespoke SVG). Draws what it is given; a path only once flown.
// ============================================================================

const VIEW = 400;
const C = 200;
const FIT = 180;
const STARS = Array.from({ length: 80 }, (_, i) => {
  const r = (n: number) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
  return { x: r(1) * VIEW, y: r(2) * VIEW, r: 0.4 + r(3) * 0.7, o: 0.15 + r(4) * 0.4 };
});

type Pt = [number, number];
const toScreen = (scale: number) => ([x, y]: Pt): Pt => [C + x * scale, C - y * scale];
const toD = (pts: Pt[]) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
const headingDeg = (a: Pt, b: Pt) => (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;

/** A rocket pointing along +x (rotate it to its heading). */
const RocketGlyph = ({ color = '#e2e8f0', size = 1 }: { color?: string; size?: number }) => (
  <g transform={`scale(${size})`}>
    <polygon points="10,0 -7,-6 -3,0 -7,6" fill={color} stroke="#0f172a" strokeWidth={0.8} />
  </g>
);

/** The flight of an answer: the path draws itself and the rocket rides it (SMIL, started on mount). */
function FlightPath({ d, lap, color, crash }: { d: string; lap: boolean; color: string; crash: Pt | null }) {
  const draw = useRef<SVGElement>(null);
  const ride = useRef<SVGElement>(null);
  useEffect(() => {
    (draw.current as unknown as { beginElement?: () => void } | null)?.beginElement?.();
    (ride.current as unknown as { beginElement?: () => void } | null)?.beginElement?.();
  }, [d]);
  return (
    <g data-flight={lap ? 'lap' : crash ? 'crash' : 'leave'}>
      <path d={d} fill="none" stroke={color} strokeWidth={2} pathLength={1} strokeDasharray="1" strokeDashoffset={0} opacity={0.8}>
        <animate ref={draw as never} attributeName="stroke-dashoffset" from="1" to="0" dur="2.5s" begin="indefinite" fill="freeze" />
      </path>
      <g>
        <RocketGlyph color="#f8fafc" />
        <animateMotion ref={ride as never} dur={lap ? '4s' : '2.5s'} begin="indefinite" fill="freeze" rotate="auto" path={d}
          {...(lap ? { repeatCount: 'indefinite' } : {})} />
      </g>
      {crash && <circle cx={crash[0]} cy={crash[1]} r={6} fill="#fb923c" opacity={0.85} />}
    </g>
  );
}

function SpaceView({ label, km, children }: { label: string; km: number; children: React.ReactNode }) {
  const er = RE * (FIT / km);
  return (
    <svg viewBox={`0 0 ${VIEW} ${VIEW}`} className="mx-auto block w-full max-w-[440px] select-none rounded-2xl bg-[#050712]" role="group" aria-label={label}>
      <defs>
        <radialGradient id="oml-earth" cx="35%" cy="35%"><stop offset="0%" stopColor="#7fb2e5" /><stop offset="60%" stopColor="#3b7dd8" /><stop offset="100%" stopColor="#1e3a6e" /></radialGradient>
        <radialGradient id="oml-glow"><stop offset="70%" stopColor="#60a5fa" stopOpacity={0.25} /><stop offset="100%" stopColor="#60a5fa" stopOpacity={0} /></radialGradient>
      </defs>
      {STARS.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#e2e8f0" opacity={s.o} />)}
      <circle cx={C} cy={C} r={er * 1.12} fill="url(#oml-glow)" />
      <circle cx={C} cy={C} r={er} fill="url(#oml-earth)" />
      <ellipse cx={C - er * 0.25} cy={C - er * 0.1} rx={er * 0.3} ry={er * 0.2} fill="#4ade80" opacity={0.35} />
      <ellipse cx={C + er * 0.3} cy={C + er * 0.25} rx={er * 0.22} ry={er * 0.14} fill="#4ade80" opacity={0.35} />
      {children}
    </svg>
  );
}

// ============================================================================
// Pictures: the asked outcome, a push arrow, and the lever cards
// ============================================================================

/** The asked outcome as a picture (a pre-reader hears the ask; this shows it). */
function OutcomePicture({ path }: { path: Path }) {
  const ball = <circle cx={24} cy={30} r={9} fill="#3b7dd8" />;
  const line = { fill: 'none', stroke: '#e2e8f0', strokeWidth: 1.8 } as const;
  const body = {
    falls: <>{ball}<path d="M24 8 Q34 10 31 22" {...line} /><circle cx={31} cy={22} r={2.5} fill="#fb923c" /></>,
    circle: <>{ball}<circle cx={24} cy={30} r={16} {...line} /></>,
    stretched: <>{ball}<ellipse cx={30} cy={30} rx={22} ry={13} {...line} /></>,
    away: <>{ball}<path d="M24 12 Q40 12 46 2" {...line} /><polygon points="46,2 41,4 44,8" fill="#e2e8f0" /></>,
  }[path];
  return <svg width={52} height={52} viewBox="0 0 52 52" aria-hidden="true" data-asked={path}>{body}</svg>;
}

/** A push: the rocket with a sideways arrow as long as the push. */
function PushPicture({ f }: { f: number }) {
  const len = Math.round(f * 46);
  return (
    <svg width={100} height={30} viewBox="0 0 100 30" aria-hidden="true">
      <g transform="translate(10 15)"><RocketGlyph color="#cbd5e1" /></g>
      <line x1={22} y1={15} x2={22 + len} y2={15} stroke="#fb923c" strokeWidth={3} />
      <polygon points={`${26 + len},15 ${20 + len},11 ${20 + len},19`} fill="#fb923c" />
    </svg>
  );
}

function ThrowCard() {
  return (
    <LuminaPanel accent="cyan" data-lever="throw-model" className="space-y-2 text-center text-xs text-slate-300">
      <svg width={260} height={90} viewBox="0 0 260 90" aria-label="A ball thrown sideways from a hill three times" className="mx-auto">
        <rect x={0} y={78} width={260} height={12} fill="#14532d" />
        <polygon points="8,78 30,30 52,78" fill="#166534" />
        {[60, 120, 190].map((x, i) => (
          <g key={x}>
            <path d={`M30 30 Q${30 + (x - 30) * 0.45} ${26 - i * 2} ${x} 78`} fill="none" stroke="#e2e8f0" strokeDasharray="3 3" />
            <circle cx={x} cy={76} r={3} fill="#fbbf24" />
          </g>
        ))}
      </svg>
      <p>{THROW_CARD_LINE}</p>
    </LuminaPanel>
  );
}

function PullCard() {
  return (
    <LuminaPanel accent="cyan" data-lever="pull-card" className="space-y-2 text-center text-xs text-slate-300">
      <svg width={220} height={110} viewBox="0 0 220 110" aria-label="Earth's pull, drawn as arrows" className="mx-auto">
        <circle cx={30} cy={55} r={22} fill="#3b7dd8" />
        {[[64, 26], [110, 15], [170, 8]].map(([x, len]) => (
          <g key={x}>
            <line x1={x} y1={55} x2={x - len} y2={55} stroke="#f472b6" strokeWidth={3} />
            <polygon points={`${x - len - 6},55 ${x - len},51 ${x - len},59`} fill="#f472b6" />
            <circle cx={x + 4} cy={55} r={3} fill="#cbd5e1" />
          </g>
        ))}
      </svg>
      <p>{PULL_CARD_LINE}</p>
    </LuminaPanel>
  );
}

function BurnCard() {
  return (
    <LuminaPanel accent="cyan" data-lever="burn-card" className="space-y-2 text-xs text-slate-300">
      <svg width={240} height={80} viewBox="0 0 240 80" aria-label="A different loop: a push changes the other side" className="mx-auto block">
        <circle cx={60} cy={40} r={8} fill="#64748b" />
        <ellipse cx={60} cy={40} rx={28} ry={22} fill="none" stroke="#94a3b8" strokeDasharray="3 3" />
        <ellipse cx={74} cy={40} rx={42} ry={26} fill="none" stroke="#e2e8f0" />
        <line x1={32} y1={40} x2={32} y2={24} stroke="#fb923c" strokeWidth={3} />
        <polygon points="32,18 28,25 36,25" fill="#fb923c" />
        <text x={150} y={36} fontSize={9} fill="#cbd5e1">push forward here:</text>
        <text x={150} y={48} fontSize={9} fill="#cbd5e1">the other side lifts</text>
      </svg>
      {BURN_CARD_LINES.map(l => <p key={l}>{l}</p>)}
    </LuminaPanel>
  );
}

function SpeedArrowsCard({ before, after }: { before: number; after: number }) {
  const px = (f: number) => Math.round(f * 110);
  const row = (label: string, f: number, color: string) => (
    <div className="flex items-center gap-2">
      <span className="w-24 text-right">{label}</span>
      <svg width={180} height={14} viewBox="0 0 180 14" aria-hidden="true">
        <line x1={2} y1={7} x2={px(f)} y2={7} stroke={color} strokeWidth={3} />
        <polygon points={`${px(f) + 6},7 ${px(f)},3 ${px(f)},11`} fill={color} />
      </svg>
    </div>
  );
  return (
    <LuminaPanel accent="cyan" data-lever="speed-arrows" className="space-y-1 text-xs text-slate-300">
      {row('Speed before', before, '#e2e8f0')}
      {row('Speed after', after, '#fb923c')}
    </LuminaPanel>
  );
}

// ============================================================================
// Component
// ============================================================================

type LeverMemo = { item: string } & OrbitLeverState;

/** The loop of a circularize item, sampled for drawing (world km). */
function loopPoints(item: CircleItem): Pt[] {
  const rp = item.near * RE, ra = item.far * RE, e = (ra - rp) / (ra + rp), p = rp * (1 + e);
  const peri = ((item.tilt + 180) * Math.PI) / 180;
  return Array.from({ length: 121 }, (_, k) => {
    const nu = (k / 120) * 2 * Math.PI, r = p / (1 + e * Math.cos(nu));
    return [r * Math.cos(peri + nu), r * Math.sin(peri + nu)] as Pt;
  });
}

/** A rocket's round track (world km), clockwise from where it sits. */
function trackPoints(radiusRe: number, angleDeg: number): Pt[] {
  const r = radiusRe * RE, a0 = (angleDeg * Math.PI) / 180;
  return Array.from({ length: 121 }, (_, k) => {
    const a = a0 - (k / 120) * 2 * Math.PI;
    return [r * Math.cos(a), r * Math.sin(a)] as Pt;
  });
}

const OrbitMechanicsLabSurface = ({ data, className, runtimePlanItemId, tutorOwned, useController }:
  OrbitMechanicsLabProps & { tutorOwned: boolean; useController: (options: ProgressOptions<OrbitItem>) => Progress }) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const { title, overview, description, gradeLevel, instanceId, skillId, subskillId, objectiveId, exhibitId, onEvaluationSubmit } = data;

  const items = useMemo(() => orbitItems(data),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.items, data.challengeTypes, data.difficulty, data.title, data.gradeLevel]);
  const stableInstanceId = useRef(instanceId || `orbit-mechanics-lab-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceId.current;

  // ── Progress: the runtime moves the index on the workspace path (callbacks bound below) ──
  const openItem = useRef<(index: number, retry: boolean) => void>(() => {});
  const solvedAloud = useRef<(index: number) => void>(() => {});
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const progress = useController({
    challenges: items,
    getChallengeId: i => i.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: workspaceAssignment,
    onItemOpened: (index, retry) => openItem.current(index, retry),
    onSolved: index => solvedAloud.current(index),
    onFinished: result => finish.current(result),
  });
  const { currentIndex, currentAttempts, results, isComplete } = progress;
  const learnerBlocked = () => tutorOwned && progress.canAttempt === false;

  const item: OrbitItem | undefined = items[Math.min(currentIndex, Math.max(items.length - 1, 0))];
  const [work, setWork] = useState<OrbitWork>(emptyWork);
  /** The checked answer whose flight is on screen (pick_speed, circularize: any check; the others once solved). */
  const [flown, setFlown] = useState<OrbitWork | null>(null);
  /** Workspace path: the checked wrong work, shown until Try again. */
  const [wrongShown, setWrongShown] = useState(false);
  const [scriptedWrongs, setScriptedWrongs] = useState(0);
  const [scriptedReveal, setScriptedReveal] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [leverMemo, setLeverMemo] = useState<LeverMemo>({ item: '', ...NO_LEVERS });
  const [submitted, setSubmitted] = useState(false);
  const tappedCorrect = useRef<string | null>(null);

  const lever: OrbitLeverState = item && leverMemo.item === item.id ? leverMemo : NO_LEVERS;
  const editLevers = (change: (s: OrbitLeverState) => Partial<OrbitLeverState>) => {
    const id = item?.id ?? '';
    setLeverMemo(m => { const s = m.item === id ? m : { item: id, ...NO_LEVERS }; return { ...s, ...change(s), item: id }; });
  };
  const leverOn = (id: string) => lever.pulled.includes(id);

  const solvedNow = !!item && results.some(r => r.challengeId === item.id && r.correct);
  const revealed = solvedNow || scriptedReveal;

  const { submitResult, hasSubmitted } = usePrimitiveEvaluation<OrbitMechanicsLabMetrics>({
    primitiveType: 'orbit-mechanics-lab',
    instanceId: resolvedInstanceId,
    skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // ── Scripted tutor only: its context carries no key; the workspace tutor reads the scene instead ──
  const aiPrimitiveData = useMemo(() => ({
    gradeLevel: gradeLevel ?? 'unspecified', mode: item?.mode ?? 'pick_speed', itemIndex: currentIndex + 1,
    totalItems: items.length, ask: item ? askOf(item) : title, attemptNumber: currentAttempts + 1,
  }), [gradeLevel, item, currentIndex, items.length, title, currentAttempts]);
  const { sendText, isAudioPlaying, activePrimitiveId } = useLuminaAI({
    primitiveType: 'orbit-mechanics-lab', instanceId: resolvedInstanceId, primitiveData: aiPrimitiveData,
    gradeLevel: gradeLevel ? (gradeLevel === 'K' ? 'Kindergarten' : `Grade ${gradeLevel}`) : undefined, enabled: !tutorOwned,
  });
  const say = (text: string) => { if (!tutorOwned) sendText(text, { silent: true }); };

  const clearItem = () => { setWork(emptyWork()); setFlown(null); setWrongShown(false); setFeedback(null); setScriptedWrongs(0); setScriptedReveal(false); };

  openItem.current = (_index, retry) => {
    if (retry) { setWork(emptyWork()); setFlown(null); setWrongShown(false); setFeedback(null); editLevers(s => ({ wrongs: s.wrongs + 1 })); return; }
    clearItem();
  };

  /** A spoken answer the observer credited: recorded as a correct tap records it, and shown the same way. */
  solvedAloud.current = (index) => {
    const solved = items[index];
    if (!solved || tappedCorrect.current === solved.id || results.some(r => r.challengeId === solved.id && r.correct)) return;
    progress.mergeResult({ challengeId: solved.id, correct: true, attempts: currentAttempts + 1 });
    const keyWork = isTapItem(solved) ? { pick: tapKey(solved), choice: null } : { pick: null, choice: choiceKey(solved) };
    setWork(keyWork); setFlown(keyWork); setWrongShown(false);
  };

  // ── Handlers ──
  const closed = revealed || wrongShown || learnerBlocked();
  const tap = (i: number) => {
    if (!item || !isTapItem(item) || closed || lever.dropped.includes(i)) return;
    SoundManager.select();
    setWork({ pick: i, choice: null }); setFlown(null); setFeedback(null);
  };
  const choose = (c: string) => {
    if (!item || isTapItem(item) || closed) return;
    if (lever.dropped.includes((item.choices as string[]).indexOf(c))) return;
    SoundManager.select();
    setWork({ pick: null, choice: c }); setFlown(null); setFeedback(null);
  };

  /** pick_speed and circularize fly the learner's own answer after any check; the others fly only the answer. */
  const fliesOwnAnswer = (it: OrbitItem) => it.mode === 'pick_speed' || it.mode === 'circularize';

  const check = () => {
    if (!item || closed || !workComplete(item, work)) return;
    const correct = orbitCorrect(item, work);
    progress.commitCheck(describeOrbitWork(item, work), correct, correct ? undefined : orbitMiss(item, work));
    if (correct || fliesOwnAnswer(item)) setFlown({ ...work });
    if (correct) {
      SoundManager.playCorrect(); tappedCorrect.current = item.id;
      say(`[ANSWER_CORRECT] The learner answered: ${askOf(item)} The flight now shows on screen. Praise briefly.`);
      return;
    }
    SoundManager.playIncorrect();
    if (tutorOwned) {
      const at = isTapItem(item) ? work.pick! : (item.choices as string[]).indexOf(work.choice!);
      editLevers(s => ({ picked: [...s.picked, at] }));
      setWrongShown(true);
      return;
    }
    const wrongs = scriptedWrongs + 1;
    setScriptedWrongs(wrongs);
    if (wrongs >= 2) {
      setScriptedReveal(true);
      const keyWork = isTapItem(item) ? { pick: tapKey(item), choice: null } : { pick: null, choice: choiceKey(item) };
      setWork(keyWork); setFlown(keyWork);
      progress.recordResult({ challengeId: item.id, correct: false, attempts: currentAttempts + 1 });
      say(`[ANSWER_REVEALED] Two tries missed on: ${askOf(item)} The answer and its flight are now on screen; explain them.`);
      return;
    }
    if (!fliesOwnAnswer(item)) setWork(emptyWork());
    setFeedback(fliesOwnAnswer(item) ? `${flightText(item, work) ?? ''} That is not what was asked. Look again, and try once more.` : 'Not quite. Look again, and try once more.');
    say(`[ANSWER_INCORRECT] ${describeOrbitWork(item, work)} for: ${askOf(item)} It is wrong. You are not told the answer: ask what the learner noticed, without naming a choice.`);
  };

  const metrics = (): OrbitMechanicsLabMetrics => {
    const right = items.filter(i => results.some(r => r.challengeId === i.id && r.correct));
    return {
      type: 'orbit-mechanics-lab',
      challengeType: item?.mode ?? 'pick_speed',
      challengeCompleted: items.length > 0 && right.length === items.length,
      launchAttempts: results.length,
      burnsPerformed: 0,
      finalOrbitEccentricity: 0,
      finalOrbitApogee: 0,
      finalOrbitPerigee: 0,
      achievedStableOrbit: right.length > 0,
      reachedOrbit: right.length > 0,
    };
  };

  /** Scripted path: Next, and on the last item the session report. Only a first-try answer scores (a second try is
   *  recorded with its attempts, but a retried item never counts toward the score). */
  const next = () => {
    if (progress.advance()) { clearItem(); say(`[NEXT_ITEM] Item ${currentIndex + 2} of ${items.length}: ${askOf(items[currentIndex + 1])}`); return; }
    if (hasSubmitted || submitted || progress.recordsEvaluation === false) return;
    const score = items.length ? Math.round((results.filter(r => r.correct && r.attempts === 1).length / items.length) * 100) : 0;
    setSubmitted(true);
    submitResult(score >= 50, score, metrics(), { challengeResults: results });
    say(`[ALL_COMPLETE] The learner finished all ${items.length} items. Celebrate briefly.`);
  };

  finish.current = (result) => {
    if (hasSubmitted || progress.recordsEvaluation === false || !items.length) return;
    setSubmitted(true);
    submitResult(result.passed, result.accuracy, { ...metrics(), launchAttempts: result.teachingAttempts.length },
      { challengeResults: result.outcomes, learningResponses: result.learningResponses,
        teachingAttempts: result.teachingAttempts, assistanceProvenance: result.assistanceProvenance },
      undefined, result.diagnosisEvidence);
  };

  // ── Workspace path: what the tutor and the observer are shown, republished every render ──
  useLayoutEffect(() => {
    if (!tutorOwned || !item || (isComplete && !solvedNow)) return;
    const scene = workspaceScene(item, { work: flown ?? work, solved: revealed, flown: !!flown });
    const levers = revealed ? [] : orbitLevers(item, lever);
    const onScreen = leverFacts(item, lever);
    workspace.current = {
      ...scene,
      facts: { ...scene.facts, ...(onScreen ? { onScreen } : {}) },
      levers,
      // A synchronous commit (the workspace runs it inside flushSync): the screen changes before this returns.
      pullLever: (id) => {
        const l = levers.find(x => x.id === id);
        if (!l) return `No lever ${id} on this item.`;
        if (l.pulled) return `${id} is already on screen.`;
        if (id === DROP_LEVER) {
          const far = dropTarget(item, lever);
          if (far === null) return 'Nothing more can be greyed out here; too few would be left.';
          editLevers(s => ({ pulled: [...s.pulled, id], dropped: [...s.dropped, far] }));
          if (isTapItem(item) ? work.pick === far : (item.choices as string[]).indexOf(work.choice ?? '') === far) setWork(emptyWork());
          return true;
        }
        editLevers(s => ({ pulled: [...s.pulled, id] }));
        return true;
      },
    };
  });

  // The workspace path keeps the last credited item on screen (its flight) until the session is submitted.
  const done = hasSubmitted || submitted || (tutorOwned && isComplete && !solvedNow);
  const pip = useWorkspacePipSurface({
    instanceId: resolvedInstanceId,
    scopeId: done || !item ? null : item.id,
    label: 'The rocket, Earth and your answer',
    solved: revealed,
    tutorSpeaking: isAudioPlaying && activePrimitiveId === resolvedInstanceId,
  });

  if (!items.length) {
    return (
      <LuminaCard className={className}>
        <LuminaCardHeader><LuminaCardTitle>{title || 'Orbit Mechanics Lab'}</LuminaCardTitle></LuminaCardHeader>
        <LuminaCardContent><p className="text-sm text-slate-400">This lab has nothing to ask.</p></LuminaCardContent>
      </LuminaCard>
    );
  }

  // ── Render pieces ──
  const km = item ? viewKm(item) : RE * 3;
  const scale = FIT / km;
  const S = toScreen(scale);
  const flight = item && flown ? answerFlight(item, flown) : null;
  const flightD = flight ? toD(flight.points.map(S)) : null;
  const crashAt = flight?.end === 'crash' ? S(flight.points[flight.points.length - 1]) : null;
  const flightColor = revealed ? '#4ade80' : '#fb923c';

  const tapState = (it: TapItem, i: number): AnswerChoiceState => {
    if (lever.dropped.includes(i)) return 'dimmed';
    const key = tapKey(it);
    if (revealed) return i === key ? 'correct' : i === work.pick ? 'incorrect' : 'dimmed';
    if (wrongShown && work.pick === i) return 'incorrect';
    return work.pick === i ? 'selected' : 'idle';
  };
  const choiceState = (it: ChoiceItem, c: string, i: number): AnswerChoiceState => {
    if (lever.dropped.includes(i)) return 'dimmed';
    const key = choiceKey(it);
    if (revealed) return c === key ? 'correct' : c === work.choice ? 'incorrect' : 'dimmed';
    if (wrongShown && work.choice === c) return 'incorrect';
    return work.choice === c ? 'selected' : 'idle';
  };

  const renderScene = (it: OrbitItem) => {
    if (it.mode === 'pick_speed' || it.mode === 'predict_burn') {
      const start = S([0, it.height * RE]);
      return (
        <SpaceView km={km} label="The rocket above Earth">
          {it.mode === 'predict_burn' && (
            <circle cx={C} cy={C} r={it.height * RE * scale} fill="none" stroke="#94a3b8" strokeDasharray="5 5" opacity={0.6} data-track="circle" />
          )}
          {!flightD && (
            <g transform={`translate(${start[0]} ${start[1]})`}>
              <RocketGlyph color="#f8fafc" size={1.2} />
              {it.mode === 'predict_burn' && (() => {
                const len = it.size === 'small' ? 16 : 42, s = it.dir === 'forward' ? 1 : -1, x0 = s * 12;
                return (
                  <g data-push={`${it.size}-${it.dir}`}>
                    <line x1={x0} y1={-14} x2={x0 + s * len} y2={-14} stroke="#fb923c" strokeWidth={3} />
                    <polygon points={`${x0 + s * (len + 7)},-14 ${x0 + s * len},-18 ${x0 + s * len},-10`} fill="#fb923c" />
                  </g>
                );
              })()}
            </g>
          )}
          {flightD && <FlightPath key={flightD} d={flightD} lap={flight!.end === 'lap'} color={flightColor} crash={crashAt} />}
        </SpaceView>
      );
    }
    if (it.mode === 'orbit_speed') {
      const sameSize = leverOn(SAME_SIZE_LEVER);
      const tMin = Math.min(...it.crafts.map(craftPeriod));
      return (
        <SpaceView km={km} label="Rockets on their tracks around Earth">
          {it.crafts.map((c, i) => {
            const pts = trackPoints(c.radius, c.angle).map(S);
            const d = toD(pts);
            const dropped = lever.dropped.includes(i);
            const size = (sameSize ? 1 : c.size) * 1.3;
            const marked = work.pick === i || (revealed && i === tapKey(it));
            return (
              <g key={c.color} data-pip-object={`rocket-${i + 1}`} opacity={dropped ? 0.2 : 1} data-dropped={dropped || undefined}
                style={{ cursor: closed || dropped ? 'default' : 'pointer' }} onClick={() => tap(i)}>
                <path d={d} fill="none" stroke={COLOR_HEX[c.color]} strokeDasharray="4 5" opacity={0.45} />
                {marked && <circle cx={pts[0][0]} cy={pts[0][1]} r={16} fill="none" stroke={revealed && i === tapKey(it) ? '#4ade80' : wrongShown ? '#f87171' : '#e2e8f0'} strokeDasharray={revealed ? undefined : '3 3'} />}
                <circle cx={pts[0][0]} cy={pts[0][1]} r={18} fill="transparent" style={{ pointerEvents: 'all' }} />
                {revealed ? (
                  <g>
                    <RocketGlyph color={COLOR_HEX[c.color]} size={size} />
                    <animateMotion dur={`${(3 * craftPeriod(c)) / tMin}s`} repeatCount="indefinite" rotate="auto" path={d} />
                  </g>
                ) : (
                  <g transform={`translate(${pts[0][0]} ${pts[0][1]}) rotate(${headingDeg(pts[0], pts[1])})`}>
                    <RocketGlyph color={COLOR_HEX[c.color]} size={size} />
                  </g>
                )}
              </g>
            );
          })}
        </SpaceView>
      );
    }
    // circularize
    const loop = toD(loopPoints(it).map(S));
    const at = loopPoint(it, it.at);
    const atS = S([at.x, at.y]), nextS = S([at.x + at.vx * 60, at.y + at.vy * 60]);
    const near = S([loopPoint(it, 'near').x, loopPoint(it, 'near').y]), far = S([loopPoint(it, 'far').x, loopPoint(it, 'far').y]);
    return (
      <SpaceView km={km} label="The rocket on a stretched loop around Earth">
        <path d={loop} fill="none" stroke="#94a3b8" strokeWidth={1.5} opacity={0.7} data-track="loop" />
        {it.show === 'ring' && (
          <circle cx={C} cy={C} r={(it.target === 'far' ? it.far : it.near) * RE * scale} fill="none" stroke="#e2e8f0" strokeDasharray="6 5" opacity={0.7} data-ring="target" />
        )}
        {leverOn(MARK_POINTS_LEVER) && (
          <g data-lever="mark-points">
            {([[near, 'near point'], [far, 'far point']] as Array<[Pt, string]>).map(([p, w]) => (
              <g key={w}><circle cx={p[0]} cy={p[1]} r={4} fill="#fbbf24" /><text x={p[0] + 7} y={p[1] - 7} fontSize={11} fill="#fde68a">{w}</text></g>
            ))}
          </g>
        )}
        {!flightD && (
          <g transform={`translate(${atS[0]} ${atS[1]}) rotate(${headingDeg(atS, nextS)})`}><RocketGlyph color="#f8fafc" size={1.2} /></g>
        )}
        {flightD && <FlightPath key={flightD} d={flightD} lap={flight!.end === 'lap'} color={flightColor} crash={crashAt} />}
      </SpaceView>
    );
  };

  const revealText = (it: OrbitItem): string => {
    if (it.mode === 'pick_speed') {
      const path = pushPath(it, it.pushes[tapKey(it)]);
      const why: Record<Path, string> = {
        falls: 'Too slow sideways: gravity pulls it down before it can get around Earth.',
        circle: 'Just fast enough sideways: it keeps falling toward Earth and keeps missing it, all the way around.',
        stretched: 'Faster than a circle needs: it swings far out, then gravity pulls it back in.',
        away: 'So fast sideways that gravity cannot pull it back.',
      };
      return `The ${pushLabel(it, tapKey(it)).toLowerCase()}: the rocket ${PATH_TEXT[path]}. ${why[path]}`;
    }
    if (it.mode === 'orbit_speed') {
      return `The ${craftLabel(it.crafts[tapKey(it)]).toLowerCase()}. Close to Earth, gravity pulls harder, so a rocket there must go faster to keep missing Earth, and its trip around is shorter. Farther out, rockets go slower and take longer to get around.`;
    }
    if (it.mode === 'predict_burn') {
      const k = burnResult(it);
      const why = { falls: 'The big push backward took away so much speed that gravity pulls it down.', closer: 'Going a little slower, it falls closer to Earth on the other side of its trip.',
        same: '', farther: 'Going a little faster, it swings farther out on the other side of its trip.', away: 'The big push forward made it so fast that gravity cannot pull it back.' }[k];
      return `${BURN_TEXT[k]}. ${why}`;
    }
    const k = choiceKey(it);
    return `${CIRCLE_TEXT[k as keyof typeof CIRCLE_TEXT]}. ${k === 'far_up'
      ? 'Speeding up at the far point lifts the near side of the loop out to the far point, so the loop becomes a circle there.'
      : 'Slowing down at the near point lowers the far side of the loop in to the near point, so the loop becomes a circle there.'}`;
  };

  const tapItem = item && isTapItem(item) ? item : null;
  const choiceItem = item && !isTapItem(item) ? item : null;
  const isPre = gradeLevel === 'K' || gradeLevel === '1';

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader>
        <LuminaCardTitle>{`🚀 ${title || 'Orbit Mechanics Lab'}`}</LuminaCardTitle>
        {!done && item && !isPre && (
          <LuminaSectionLabel accent="cyan" size="sm">
            {`${MODE_LABEL[item.mode]} · item ${Math.min(currentIndex, items.length - 1) + 1} of ${items.length}`}
          </LuminaSectionLabel>
        )}
        {(overview || description) && !done && !isPre && <p className="text-sm text-slate-400">{overview || description}</p>}
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {done ? (
          <LuminaFeedbackCard status="insight" label="Lab complete">
            {`${results.filter(r => r.correct).length} of ${items.length} answered.`}
          </LuminaFeedbackCard>
        ) : item && (
          <>
            <div className="flex items-center gap-3">
              {item.mode === 'pick_speed' && <OutcomePicture path={item.ask} />}
              <LuminaPrompt accent="cyan" className="flex-1">{askOf(item)}</LuminaPrompt>
              {!tutorOwned && (
                <ReadMeButton instruction={askOf(item)} ask="Look at the rocket, then answer."
                  speaking={isAudioPlaying} onAskTutor={m => sendText?.(m)} tag="[READ_CHALLENGE]"
                  className="flex-shrink-0" aria-label="Read the question to me" />
              )}
            </div>

            {pip.store && <div {...pip.dock} />}
            <div {...pip.workspace} className="space-y-3">
              {renderScene(item)}
              {flown && !revealed && fliesOwnAnswer(item) && (
                <p className="text-center text-sm text-amber-200" data-flight-result>{flightText(item, flown)}</p>
              )}

              {item.mode === 'pick_speed' && leverOn(THROW_LEVER) && <ThrowCard />}
              {item.mode === 'orbit_speed' && leverOn(PULL_LEVER) && <PullCard />}
              {item.mode === 'predict_burn' && leverOn(SPEED_ARROWS_LEVER) && (() => { const a = speedArrows(item)!; return <SpeedArrowsCard before={a.before} after={a.after} />; })()}
              {item.mode === 'circularize' && leverOn(BURN_CARD_LEVER) && <BurnCard />}

              {tapItem && (
                <div className={`grid gap-2 ${tapItem.mode === 'pick_speed' ? (tapItem.pushes.length > 2 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2') : 'grid-cols-2 sm:grid-cols-4'}`}>
                  {(tapItem.mode === 'pick_speed' ? tapItem.pushes : tapItem.crafts).map((_, i) => (
                    <LuminaAnswerChoice key={i} aria-label={tapLabel(tapItem, i)} state={tapState(tapItem, i)}
                      disabled={closed || lever.dropped.includes(i)} data-dropped={lever.dropped.includes(i) || undefined}
                      className="flex items-center justify-center p-2" onClick={() => tap(i)}>
                      {tapItem.mode === 'pick_speed'
                        ? <PushPicture f={tapItem.pushes[i].f} />
                        : <span className="flex items-center gap-2 font-semibold">
                          <span className="inline-block h-3 w-3 rounded-full" style={{ background: COLOR_HEX[tapItem.crafts[i].color] }} />
                          {craftLabel(tapItem.crafts[i])}
                        </span>}
                    </LuminaAnswerChoice>
                  ))}
                </div>
              )}

              {choiceItem && (
                <div className={`grid gap-2 ${choiceItem.choices.length > 3 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
                  {(choiceItem.choices as string[]).map((c, i) => (
                    <LuminaAnswerChoice key={c} aria-label={choiceLabel(choiceItem, c)} state={choiceState(choiceItem, c, i)}
                      disabled={closed || lever.dropped.includes(i)} data-dropped={lever.dropped.includes(i) || undefined}
                      className="p-3 text-left font-semibold" onClick={() => choose(c)}>
                      {choiceLabel(choiceItem, c)}
                    </LuminaAnswerChoice>
                  ))}
                </div>
              )}
            </div>

            {!revealed && (
              <div className="flex justify-center">
                <LuminaActionButton action="check" disabled={closed || !workComplete(item, work)} onClick={check}>
                  {item.mode === 'pick_speed' ? 'Launch and check' : 'Check Answer'}
                </LuminaActionButton>
              </div>
            )}
            {revealed && (
              <LuminaFeedbackCard status={solvedNow ? 'correct' : 'insight'} label={solvedNow ? undefined : 'The answer'}>
                {revealText(item)}
              </LuminaFeedbackCard>
            )}
            {!revealed && wrongShown && <LuminaFeedbackCard status="incorrect">That is not it.</LuminaFeedbackCard>}
            {!revealed && feedback && <LuminaFeedbackCard status="incorrect">{feedback}</LuminaFeedbackCard>}

            {!tutorOwned && revealed && (
              <div className="flex justify-end">
                <LuminaActionButton action="next" onClick={next}>{currentIndex < items.length - 1 ? 'Next →' : 'Finish'}</LuminaActionButton>
              </div>
            )}
          </>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

// The workspace path never mounts the scripted progress, whose Next would compete with the observer.
const OrbitMechanicsLab = withWorkspaceController<OrbitMechanicsLabProps, ProgressOptions<OrbitItem>, Progress>(
  'orbit-mechanics-lab', OrbitMechanicsLabSurface, useScriptedProgress, useWorkspaceProgressFor('orbit-mechanics-lab'));

export default OrbitMechanicsLab;
