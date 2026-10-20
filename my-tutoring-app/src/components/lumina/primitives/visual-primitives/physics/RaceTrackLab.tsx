'use client';

/**
 * Race Track Lab: toy cars on a track of numbered squares, one question per item (one eval mode each).
 * - observe: run a timed race that a bell stops; which car is the fastest?
 * - predict: a card per car gives its speed; which car will cross the finish line first? (run only after credit)
 * - measure: run a timed race, then count how far a car moved, or how much farther one car moved than another.
 * - calculate: a race log gives start, stop and seconds; what is the car's speed?
 * - graph: a position-time graph; which car is fastest, or what is a car's speed?
 *
 * Every item is built and keyed by code (`raceTrackWorkspace.ts`). Nothing on screen states the answer before credit:
 * no speed readout, medal or finish time; the cars are named by colour, never by an animal whose usual speed hints
 * the answer; the predict race and the graph's race play only once the answer is credited; the log's speed reads "?".
 * Taught only on the shared tutor/JEV workspace (`withWorkspaceOnly`; its wiring is `raceTrackLab.card.ts` +
 * `raceTrackLab.boss.ts`): every check commits through `progress.commitCheck` with a named miss, a spoken answer is
 * judged by the tutor, and the runtime moves on. The levers are one lever set in `raceTrackLevers.ts`.
 */
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../../../evaluation';
import type { RaceTrackLabMetrics } from '../../../evaluation/types';
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
  askOf, cardText, choicesOf, describeRaceWork, endOf, finishTime, fmtNum, keyChoice, needsRun, positionAt,
  raceCorrect, raceItems, raceMiss, runTime, workspaceScene,
  type RaceItem, type RaceMode, type RaceTier,
} from './raceTrackWorkspace';
import {
  GAP_BRACKET_LEVER, ONE_SECOND_LEVER, RACE_LEVERS, SECOND_MARKS_LEVER, stepLines,
  stepMarks, STEP_MARKS_LEVER, TO_GO_LEVER, TRAIL_COUNT_LEVER, TRAIL_TICKS_LEVER,
} from './raceTrackLevers';
import { raceTrackLabBoss } from './raceTrackLab.boss';

// ============================================================================
// Data Types (single source of truth; the generator imports them)
// ============================================================================

export type { RaceItem, RaceMode, RaceTier };

export interface RaceTrackLabData {
  title: string;
  description?: string;
  /** The eval modes this session asks, in order (`resolveRaceModes`). */
  challengeTypes?: RaceMode[];
  /** config.difficulty: the structural band the items were built at. */
  difficulty?: RaceTier;
  /** 'K', '1' ... '8': picks the modes when none is pinned. */
  grade?: string;
  /** The items, built and keyed by code at generation; absent or invalid: rebuilt from the fields above. */
  items?: RaceItem[];
  /** Legacy generations: read only for their modes. */
  challenges?: Array<{ type?: string }>;
  supportTier?: string;

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<RaceTrackLabMetrics>) => void;
}

interface RaceTrackLabProps {
  data: RaceTrackLabData;
  className?: string;
  /** Carried onto the runtime mount so the live host keeps its resolved plan metadata. */
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted rather than rebuilt from the item. */
  runtimeEvalMode?: string;
}

const MODE_LABEL: Record<RaceMode, string> = {
  observe: 'Who is fastest?', predict: 'Predict the winner', measure: 'Count the squares', calculate: 'Work out the speed', graph: 'Read the graph',
};

// ============================================================================
// The track (canvas). Draws each car where it is at the time it is given; the surface decides when a race plays.
// ============================================================================

const W = 720;
const LEFT = 92;
const RIGHT = W - 24;
const TOP = 46;
const LANE = 46;

const durationOf = (item: RaceItem) => Math.max(...item.racers.map(r => (item.mode === 'predict' ? finishTime(item, r) : runTime(item, r))));

const RaceTrack = ({ item, played, runKey, overlays }: { item: RaceItem; played: boolean; runKey: number; overlays: readonly string[] }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const H = TOP + item.racers.length * LANE + 34;
  const duration = durationOf(item);
  const [t, setT] = useState(played ? duration : 0);

  useEffect(() => { if (!runKey) setT(played ? duration : 0); }, [played, duration, runKey]);

  // A run plays from 0 to its end in real time, sped up so it never lasts more than about four seconds.
  useEffect(() => {
    if (!runKey) return;
    const rate = Math.max(1, duration / 4);
    let frame = 0;
    const began = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const tick = () => {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const next = Math.min(duration, ((now - began) / 1000) * rate);
      setT(next);
      if (next < duration) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [runKey, duration]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext?.('2d');
    if (!ctx) return;
    const L = item.trackLength, x = (sq: number) => LEFT + (sq / L) * (RIGHT - LEFT);
    const bottom = TOP + item.racers.length * LANE;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0F172A'; ctx.fillRect(0, 0, W, H);
    // Squares: a line at every square, its number on top.
    ctx.font = '10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    for (let sq = 0; sq <= L; sq++) {
      ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x(sq), TOP - 4); ctx.lineTo(x(sq), bottom + 4); ctx.stroke();
      ctx.fillStyle = 'rgba(226,232,240,0.7)'; ctx.fillText(String(sq), x(sq), TOP - 8);
    }
    if (item.mode === 'predict') {
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 3; ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.moveTo(x(L), TOP); ctx.lineTo(x(L), bottom); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.textBaseline = 'top'; ctx.fillText('FINISH', x(L), bottom + 6);
    }
    item.racers.forEach((r, i) => {
      const y = TOP + i * LANE + LANE / 2;
      ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.025)';
      ctx.fillRect(LEFT, TOP + i * LANE, RIGHT - LEFT, LANE);
      ctx.fillStyle = r.color; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText(r.name, LEFT - 8, y);
      const p = positionAt(item, r, t);
      // The trail: from where the car started to where it is now.
      ctx.strokeStyle = `${r.color}99`; ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x(r.start), y); ctx.lineTo(x(p), y); ctx.stroke();
      const showCounts = overlays.includes(TRAIL_COUNT_LEVER) || (overlays.includes(TRAIL_TICKS_LEVER) && i === (item.target ?? 0));
      if (showCounts && p > r.start) {
        for (let sq = r.start + 1; sq <= Math.floor(p + 1e-9); sq++) {
          const cx = (x(sq - 1) + x(sq)) / 2;
          if (overlays.includes(TRAIL_COUNT_LEVER)) {
            ctx.fillStyle = '#F8FAFC'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(String(sq - r.start), cx, y - 13);
          } else {
            ctx.strokeStyle = '#F8FAFC'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(cx, y - 17); ctx.lineTo(cx, y - 9); ctx.stroke();
          }
        }
      }
      if (overlays.includes(SECOND_MARKS_LEVER)) {
        for (let s = 1; s < runTime(item, r); s++) {
          const sx = x(r.start + r.speed * s);
          ctx.strokeStyle = '#FDE68A'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(sx, y - 15); ctx.lineTo(sx, y + 15); ctx.stroke();
        }
      }
      if (overlays.includes(STEP_MARKS_LEVER)) {
        for (const m of stepMarks(item).filter(mk => mk.car === i)) {
          ctx.fillStyle = '#FDE68A'; ctx.beginPath(); ctx.arc(x(m.square), y + 15, 4, 0, Math.PI * 2); ctx.fill();
          ctx.font = '9px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(`${m.second}s`, x(m.square), y + 18);
        }
      }
      if (overlays.includes(TO_GO_LEVER)) {
        ctx.fillStyle = '#FDE68A'; ctx.font = '10px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
        ctx.fillText(`${L - r.start} to go`, x(r.start) + 18, y - 12);
      }
      // The car.
      ctx.fillStyle = `${r.color}55`; ctx.beginPath(); ctx.arc(x(p), y, 14, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = r.color; ctx.lineWidth = 2; ctx.stroke();
      ctx.font = '16px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🚗', x(p), y + 1);
    });
    if (overlays.includes(GAP_BRACKET_LEVER) && item.other !== undefined && t >= duration) {
      const a = endOf(item, item.racers[item.target ?? 0]), b = endOf(item, item.racers[item.other]);
      ctx.strokeStyle = '#FDE68A'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x(b), bottom + 8); ctx.lineTo(x(b), bottom + 16); ctx.lineTo(x(a), bottom + 16); ctx.lineTo(x(a), bottom + 8); ctx.stroke();
    }
    if (item.mode !== 'predict') {
      ctx.fillStyle = 'rgba(248,250,252,0.85)'; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'right'; ctx.textBaseline = 'top';
      ctx.fillText(`⏱ ${fmtNum(Math.floor(t * 10) / 10)} s`, W - 8, 6);
    }
  }, [item, t, overlays, H, duration]);

  return <canvas ref={canvasRef} width={W} height={H} className="w-full rounded-lg border border-white/10"
    style={{ maxWidth: W, aspectRatio: `${W}/${H}` }} aria-label="The race track" />;
};

// ============================================================================
// The position-time graph (canvas, graph mode)
// ============================================================================

const GW = 560;
const GH = 320;
const RaceGraph = ({ item, overlays }: { item: RaceItem; overlays: readonly string[] }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = canvasRef.current?.getContext?.('2d');
    if (!ctx) return;
    const l = 56, r = GW - 110, top = 18, bottom = GH - 40, T = item.time, L = item.trackLength;
    const gx = (s: number) => l + (s / T) * (r - l), gy = (p: number) => bottom - (p / L) * (bottom - top);
    ctx.fillStyle = '#0F172A'; ctx.fillRect(0, 0, GW, GH);
    ctx.font = '10px sans-serif';
    for (let s = 0; s <= T; s++) {
      ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.moveTo(gx(s), top); ctx.lineTo(gx(s), bottom); ctx.stroke();
      ctx.fillStyle = 'rgba(226,232,240,0.75)'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(String(s), gx(s), bottom + 4);
    }
    for (let p = 0; p <= L; p += 2) {
      ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.moveTo(l, gy(p)); ctx.lineTo(r, gy(p)); ctx.stroke();
      ctx.fillStyle = 'rgba(226,232,240,0.75)'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(String(p), l - 6, gy(p));
    }
    ctx.fillStyle = 'rgba(226,232,240,0.8)'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText('Time (seconds)', (l + r) / 2, bottom + 20);
    ctx.save(); ctx.translate(14, (top + bottom) / 2); ctx.rotate(-Math.PI / 2); ctx.fillText('Position (squares)', 0, 0); ctx.restore();
    item.racers.forEach((car, i) => {
      ctx.strokeStyle = car.color; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(gx(0), gy(car.start)); ctx.lineTo(gx(T), gy(endOf(item, car))); ctx.stroke();
      for (let s = 0; s <= T; s++) { ctx.fillStyle = car.color; ctx.beginPath(); ctx.arc(gx(s), gy(car.start + car.speed * s), 4, 0, Math.PI * 2); ctx.fill(); }
      ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(car.name, gx(T) + 8, gy(endOf(item, car)));
      if (overlays.includes(ONE_SECOND_LEVER) && stepLines(item).includes(i)) {
        ctx.strokeStyle = '#FDE68A'; ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
        ctx.beginPath(); ctx.moveTo(gx(0), gy(car.start)); ctx.lineTo(gx(1), gy(car.start)); ctx.lineTo(gx(1), gy(car.start + car.speed)); ctx.stroke();
        ctx.setLineDash([]);
      }
    });
  }, [item, overlays]);
  return <canvas ref={canvasRef} width={GW} height={GH} className="w-full rounded-lg border border-white/10"
    style={{ maxWidth: GW, aspectRatio: `${GW}/${GH}` }} aria-label="The position-time graph" />;
};

// ============================================================================
// Component
// ============================================================================

const useRaceProgress = useWorkspaceProgressFor('race-track-lab');

const RaceTrackLabSurface = ({ data, className, runtimePlanItemId }: RaceTrackLabProps) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const { title, instanceId, skillId, subskillId, objectiveId, exhibitId, onEvaluationSubmit } = data;

  const items = useMemo(() => raceItems(data),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.items, data.challengeTypes, data.difficulty, data.grade, data.title]);
  const stableInstanceId = useRef(instanceId || `race-track-lab-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceId.current;

  // ── Progress: the runtime moves the index (callbacks bound below) ──
  const openItem = useRef<(index: number, retry: boolean) => void>(() => {});
  const solvedAloud = useRef<(index: number) => void>(() => {});
  /** Bound below; an answer the observer credited on the simplify lever's practice item. */
  const practiceAloud = useRef<(source: 'speech' | 'gesture') => void>(() => {});
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const progress = useRaceProgress({
    challenges: items,
    getChallengeId: i => i.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: raceTrackLabBoss.assignment,
    onItemOpened: (index, retry) => openItem.current(index, retry),
    onSolved: index => solvedAloud.current(index),
    onPracticeSolved: (_id, source) => practiceAloud.current(source),
    onFinished: result => finish.current(result),
  });
  const { currentIndex, currentAttempts, results, isComplete } = progress;
  /** A checked answer stays closed until Try again or Next challenge on the shell. */
  const learnerBlocked = () => progress.canAttempt === false;

  const sessionItem: RaceItem | undefined = items[Math.min(currentIndex, Math.max(items.length - 1, 0))];
  const [practice, setPractice] = useState<RaceItem | null>(null);
  const item = practice ?? sessionItem;

  const [choice, setChoice] = useState<string | null>(null);
  /** The wrong choice just checked, shown until Try again. */
  const [wrongPick, setWrongPick] = useState<string | null>(null);
  const [practiceSolved, setPracticeSolved] = useState(false);
  /** observe, measure: the learner pressed Run the race. */
  const [ran, setRan] = useState(false);
  /** Bumped to play the race on the track. */
  const [runKey, setRunKey] = useState(0);
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [submitted, setSubmitted] = useState(false);
  const tappedCorrect = useRef<string | null>(null);

  const pulled = sessionItem && leverState.item === sessionItem.id && !practice ? leverState.pulled : [];
  const solvedNow = practice ? practiceSolved : !!item && results.some(r => r.challengeId === item.id && r.correct);
  const revealed = solvedNow;
  const waitingForRun = !!item && needsRun(item) && !ran;

  const { submitResult, hasSubmitted } = usePrimitiveEvaluation<RaceTrackLabMetrics>({
    primitiveType: 'race-track-lab',
    instanceId: resolvedInstanceId,
    skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const clearItem = () => {
    setChoice(null); setWrongPick(null); setPracticeSolved(false);
    setRan(false); setRunKey(0);
  };

  openItem.current = (_index, retry) => {
    // Try again keeps the race on the track; a new item starts on the start line.
    if (retry) { setChoice(null); setWrongPick(null); setPracticeSolved(false); return; }
    setPractice(null); clearItem();
  };

  solvedAloud.current = (index) => {
    const solved = items[index];
    if (!solved || tappedCorrect.current === solved.id || results.some(r => r.challengeId === solved.id && r.correct)) return;
    progress.mergeResult({ challengeId: solved.id, correct: true, attempts: currentAttempts + 1 });
    setChoice(keyChoice(solved)); setWrongPick(null);
  };

  // A spoken answer credited on the practice item: shown there as on a session item, recorded nowhere. The full item
  // comes back blank when the practice closes. A tap shows its own credit in the check.
  practiceAloud.current = (source) => {
    if (source !== 'speech' || !practice) return;
    setPracticeSolved(true);
    setChoice(keyChoice(practice)); setWrongPick(null);
  };

  // Once credited, a race the learner has not watched plays: predict to the finish, the log, the graph's race.
  const playedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!item || !revealed || needsRun(item) || playedFor.current === item.id) return;
    playedFor.current = item.id;
    setRunKey(k => k + 1);
  }, [item, revealed]);
  useEffect(() => { if (!revealed) playedFor.current = null; }, [revealed]);

  // ── Handlers ──
  const run = () => {
    if (!item || !needsRun(item)) return;
    SoundManager.tap();
    setRan(true); setRunKey(k => k + 1);
  };

  const pick = (c: string) => {
    if (!item || revealed || waitingForRun || wrongPick !== null || learnerBlocked()) return;
    SoundManager.select();
    setChoice(c);
  };

  const check = () => {
    if (!item || choice === null || revealed || waitingForRun || wrongPick !== null || learnerBlocked()) return;
    const correct = raceCorrect(item, choice);
    progress.commitCheck(describeRaceWork(item, { choice }), correct, correct ? undefined : raceMiss(item, choice));
    if (correct) {
      SoundManager.playCorrect();
      if (practice) setPracticeSolved(true); else tappedCorrect.current = item.id;
      return;
    }
    SoundManager.playIncorrect();
    setWrongPick(choice);
  };

  const metrics = (attempts: number): RaceTrackLabMetrics => {
    const correct = items.filter(i => results.some(r => r.challengeId === i.id && r.correct)).length;
    const accuracy = items.length ? Math.round((correct / items.length) * 100) : 0;
    return {
      type: 'race-track-lab', evalMode: items[0]?.mode,
      challengesCompleted: items.length, challengesCorrect: correct, totalAttempts: attempts, accuracy,
      averageAttemptsPerChallenge: items.length ? attempts / items.length : 0,
    };
  };

  finish.current = (result) => {
    if (hasSubmitted || progress.recordsEvaluation === false || !items.length) return;
    setSubmitted(true);
    submitResult(result.passed, result.accuracy, metrics(result.teachingAttempts.length),
      { challengeResults: result.outcomes, learningResponses: result.learningResponses,
        teachingAttempts: result.teachingAttempts, assistanceProvenance: result.assistanceProvenance },
      undefined, result.diagnosisEvidence);
  };

  // ── What the tutor and the observer are shown, republished every render ──
  useLayoutEffect(() => {
    if (!item || isComplete) return;
    const scene = workspaceScene(item, { choice: wrongPick ?? choice, ran, solved: revealed });
    // No lever on the practice race: the full item's levers come back with it.
    const leverCtx = { ran };
    const levers = practice || !sessionItem ? [] : RACE_LEVERS.declare(sessionItem, leverCtx, pulled);
    const withPractice = practice
      ? { ...scene, facts: { ...scene.facts, practice: 'A simpler race of the same kind, with other cars, before the full item comes back.' } }
      : scene;
    workspace.current = {
      ...leverScene(withPractice, { support: '',
        onScreen: practice || !sessionItem ? '' : RACE_LEVERS.onScreen(sessionItem, leverCtx, pulled) }),
      // observe and measure wait for the learner to run the race: before that there is nothing to answer from.
      readyForResponse: !waitingForRun,
      levers,
      pullLever: (id) => {
        const l = levers.find(x => x.id === id);
        if (practice || !l || !sessionItem) return `No lever ${id} on this item.`;
        if (l.pulled) return `${id} is already on screen.`;
        const nextState = { item: sessionItem.id, pulled: [...pulled, id] };
        if (l.kind === 'simplify') {
          const simpler = RACE_LEVERS.simpler(sessionItem, leverCtx, id);
          if (!simpler) return 'There is no simpler race here; try a help lever.';
          setLeverState(nextState); clearItem(); setPractice(simpler);
          return { practice: raceTrackLabBoss.assignment(simpler) };
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
        <LuminaCardContent><p className="text-sm text-slate-400">This lab has no races to run.</p></LuminaCardContent>
      </LuminaCard>
    );
  }

  const key = item ? keyChoice(item) : '';
  const choiceState = (c: string): AnswerChoiceState => revealed ? (c === key ? 'correct' : c === choice ? 'incorrect' : 'dimmed')
    : wrongPick === c ? 'incorrect' : choice === c ? 'selected' : 'idle';
  const closed = revealed || waitingForRun || wrongPick !== null || learnerBlocked();
  const colorOf = (name: string) => item?.racers.find(r => r.name === name)?.color;

  const revealText = () => {
    if (!item) return '';
    if (item.ask === 'fastest') {
      const f = item.racers.find(r => r.name === key)!;
      return `${key} is the fastest: it moves ${fmtNum(f.speed)} squares every second.${item.mode === 'observe' ? ' Every car raced for the same time, so the one that moved the most squares is fastest.' : ' Its line is the steepest.'}`;
    }
    if (item.ask === 'winner') return `${key} crosses the finish line first.`;
    if (item.ask === 'distance' || item.ask === 'farther_by') return `The answer is ${key}.`;
    return `The answer is ${key}: the squares moved divided by the seconds.`;
  };

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader>
        <LuminaCardTitle>{title}</LuminaCardTitle>
        {!done && item && (
          <LuminaSectionLabel accent="cyan" size="sm">
            {practice ? 'A simpler race first' : `${MODE_LABEL[item.mode]} · race ${Math.min(currentIndex, items.length - 1) + 1} of ${items.length}`}
          </LuminaSectionLabel>
        )}
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {done ? (
          <LuminaFeedbackCard status="insight" label="Lab complete">
            {`${results.filter(r => r.correct).length} of ${items.length} races answered.`}
          </LuminaFeedbackCard>
        ) : item && (
          <>
            <LuminaPrompt accent="cyan" {...(practice ? { 'data-practice': 'simpler' } : {})}>{askOf(item)}</LuminaPrompt>

            {/* Pip comes from the workspace runner (`pip/WorkspacePip.tsx`): the dock above, the track and choices as its region. */}
            <PipDock />
            <PipWorkspace className="space-y-4">
              {item.mode === 'predict' && (
                <LuminaPanel>
                  <table className="w-full text-sm" aria-label="The cars">
                    <tbody>
                      {item.racers.map(r => (
                        <tr key={r.name} className="text-slate-200">
                          <td className="py-1 pr-3 font-semibold" style={{ color: r.color }}>{r.name}</td>
                          <td className="py-1">{cardText(item, r).slice(r.name.length + 1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </LuminaPanel>
              )}

              {item.mode === 'calculate' && (
                <LuminaPanel>
                  <table className="w-full text-sm" aria-label="The race log">
                    <thead>
                      <tr className="text-left text-xs text-slate-400">
                        <th className="py-1">Car</th><th className="py-1">Started at</th><th className="py-1">Stopped at</th>
                        <th className="py-1">Seconds</th><th className="py-1">Speed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {item.racers.map(r => (
                        <tr key={r.name} className="font-mono text-slate-200">
                          <td className="py-1 pr-2 font-sans font-semibold" style={{ color: r.color }}>{r.name}</td>
                          <td className="py-1">square {r.start}</td>
                          <td className="py-1">square {fmtNum(endOf(item, r))}</td>
                          <td className="py-1">{runTime(item, r)}</td>
                          <td className="py-1 text-cyan-200">{revealed ? `${fmtNum(r.speed)} squares per second` : '?'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </LuminaPanel>
              )}

              {item.mode === 'graph' && <RaceGraph key={item.id} item={item} overlays={pulled} />}

              {(item.mode !== 'graph' || revealed) && (
                <RaceTrack key={item.id} item={item} runKey={runKey} overlays={pulled}
                  played={item.mode === 'calculate' || (needsRun(item) ? ran : false) || (item.mode === 'graph' && revealed)} />
              )}

              {needsRun(item) && !revealed && (
                <div className="flex justify-center">
                  <LuminaButton tone="primary" aria-label={ran ? 'Watch again' : 'Run the race'} onClick={run}>
                    {ran ? 'Watch again' : 'Run the race'}
                  </LuminaButton>
                </div>
              )}

              <div className={`grid gap-2 ${choicesOf(item).length > 3 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                {choicesOf(item).map(c => (
                  <LuminaAnswerChoice key={c} aria-label={c} state={choiceState(c)} disabled={closed}
                    className="p-3 text-center font-semibold" onClick={() => pick(c)}>
                    {colorOf(c) && <span className="mr-2 inline-block h-3 w-3 rounded-full align-middle" style={{ background: colorOf(c) }} />}
                    {c}
                  </LuminaAnswerChoice>
                ))}
              </div>
            </PipWorkspace>

            {!revealed && (
              <div className="flex justify-center">
                <LuminaActionButton action="check" disabled={choice === null || closed} onClick={check}>Check Answer</LuminaActionButton>
              </div>
            )}

            {revealed && (
              <LuminaFeedbackCard status={solvedNow ? 'correct' : 'insight'} label={solvedNow ? undefined : 'The answer'}>
                {revealText()}
              </LuminaFeedbackCard>
            )}
            {!revealed && wrongPick !== null && <LuminaFeedbackCard status="incorrect">{`"${wrongPick}" is not it.`}</LuminaFeedbackCard>}
          </>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

const RaceTrackLab = withWorkspaceOnly<RaceTrackLabProps>('race-track-lab', RaceTrackLabSurface, props => props.data.title);

export default RaceTrackLab;
