'use client';

/**
 * Mission Planner (rebuilt 2026-10-16 under the 10-15 ruling and the 10-16 ruling for this primitive). The old planner
 * was a four-step wizard that always passed, with a "Best!" badge on the right launch window, window descriptions that
 * stated the answer, a supply table that ticked "enough" and travel times from Gemini.
 *
 * Grades 2-5, graded, one code-keyed choice per eval mode (`missionWorkspace.ts`):
 * - farther_closer: say or tap the place farthest (or closest) from Earth; no map until the answer.
 * - pick_window: say or tap the launch month that needs the least (or most) fuel, from where the planets are.
 * - pack_days: say or tap how many food packs a Moon trip needs, there, staying and home the same way.
 * - assist_tradeoff: say or tap the route that uses the least fuel and arrives within the year limit.
 * Two paths, chosen by `withWorkspaceController`: the scripted path (tester, no tutor) has its own Next and up to two
 * tries before a reveal (one on two-choice items), and only a first-try answer scores; the workspace path (W1, plain
 * shape) commits every check through `progress.commitCheck` with a named miss, takes a spoken answer judged by the
 * tutor, and lets the runtime move on. The levers live in `missionLevers.ts`.
 *
 * K and Grade 1: an ungraded planning story (`MissionStory`): pick a place, pack, fly, hear how long the trip takes in
 * words. No score, no evaluation submitted, and it never mounts the graded workspace (the adapter refuses a story).
 */
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../../../evaluation';
import type { MissionPlannerMetrics } from '../../../evaluation/types';
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
  askOf, describeMissionWork, emptyWork, FAR_NAME, FLYBY_NAME, isStoryGrade, keyOf, missionCorrect, missionItems,
  missionMiss, optionCount, optionLabel, PLACE_AU, PLACE_COLOR, PLACE_NAME, PLACES, revealText, routeLabel, STORY_TRIP,
  storyPlaces, TARGET_NAME, workComplete, workspaceAssignment, workspaceScene,
  type AssistItem, type LaunchWindow, type MissionItem, type MissionMode, type MissionTier, type MissionWork, type PackItem,
  type Place, type Route, type StoryPlace, type Target, type WindowItem,
} from './missionWorkspace';
import {
  ASSIST_CARD_LEVER, ASSIST_CARD_LINES, CREW_LINE, CREW_ROWS_LEVER, DISTANCE_LINES_LEVER, DROP_LEVER, dropTarget,
  FUEL_CARD_LEVER, FUEL_CARD_LINES, HOME_LEG_LEVER, leverFacts, LIMIT_LINE_LEVER, missionLevers, NO_LEVERS,
  ASK_ARROW_LEVER, type MissionLeverState,
} from './missionLevers';

// ============================================================================
// Data Types (single source of truth; the generator imports them)
// ============================================================================

export type { MissionItem, MissionMode, MissionTier, StoryPlace };

export interface MissionPlannerData {
  title: string;
  /** One neutral sentence under the title; never states which place, month, number or route is right. */
  overview?: string;
  description?: string;
  /** Grade rung 'K'..'5'. K and 1 get the ungraded story. */
  gradeLevel?: string;
  /** The eval modes this session asks, in order (grades 2-5). */
  challengeTypes?: MissionMode[];
  /** config.difficulty: the structural band the items were built at. */
  difficulty?: MissionTier;
  /** The items, built and keyed by code at generation; absent or invalid: rebuilt from the fields above. */
  items?: MissionItem[];
  /** K-1: the places the story offers. */
  story?: { places: StoryPlace[] };

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<MissionPlannerMetrics>) => void;
}

interface MissionPlannerProps {
  data: MissionPlannerData;
  className?: string;
  runtimePlanItemId?: string;
  runtimeEvalMode?: string;
}

const MODE_LABEL: Record<MissionMode, string> = {
  farther_closer: 'Near or far?', pick_window: 'When to launch', pack_days: 'Pack the food', assist_tradeoff: 'Pick a route',
};

// ============================================================================
// Pictures
// ============================================================================

/** A place, always the same size (a bigger picture must not hint at a farther place). */
function PlacePicture({ place, size = 56 }: { place: Place | StoryPlace; size?: number }) {
  const c = size / 2, r = size * 0.36, fill = PLACE_COLOR[place];
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" data-place={place}>
      {place === 'asteroids' ? (
        [[-10, -6, 5], [6, -9, 4], [9, 5, 6], [-6, 8, 4], [0, 0, 3], [-13, 4, 3]].map(([dx, dy, rr], i) => (
          <circle key={i} cx={c + dx} cy={c + dy} r={rr} fill={fill} stroke="#57534e" strokeWidth={0.8} />
        ))
      ) : (
        <>
          <circle cx={c} cy={c} r={r} fill={fill} stroke="#0f172a" strokeWidth={0.8} />
          {place === 'saturn' && <ellipse cx={c} cy={c} rx={r * 1.45} ry={r * 0.38} fill="none" stroke="#fde68a" strokeWidth={2} />}
          {place === 'jupiter' && <path d={`M${c - r} ${c - 3} H${c + r} M${c - r + 2} ${c + 5} H${c + r - 2}`} stroke="#92400e" strokeWidth={2} opacity={0.6} />}
          {place === 'moon' && <><circle cx={c - 5} cy={c - 4} r={3} fill="#94a3b8" /><circle cx={c + 6} cy={c + 5} r={2.4} fill="#94a3b8" /></>}
        </>
      )}
    </svg>
  );
}

/** After the answer (farther_closer): Earth on the left, every place at its distance (log scale), the asked ones named. */
function DistanceStrip({ places }: { places: Place[] }) {
  const W = 320, lo = Math.log10(0.0015), hi = Math.log10(32);
  const x = (au: number) => 30 + ((Math.log10(au) - lo) / (hi - lo)) * (W - 50);
  // Labels alternate above and below in distance order, so neighbours never overlap.
  const order = [...places].sort((a, b) => PLACE_AU[a] - PLACE_AU[b]);
  return (
    <svg viewBox={`0 0 ${W} 76`} className="mx-auto block w-full max-w-[520px]" role="img" aria-label="Each place at its distance from Earth" data-distance-strip>
      <line x1={14} y1={34} x2={W - 8} y2={34} stroke="#475569" strokeWidth={1} />
      <circle cx={14} cy={34} r={6} fill="#4a90d9" />
      <text x={14} y={56} fontSize={9} fill="#cbd5e1" textAnchor="middle">Earth</text>
      {PLACES.map(p => {
        const shown = places.includes(p), px = x(PLACE_AU[p]);
        return (
          <g key={p} opacity={shown ? 1 : 0.3}>
            <circle cx={px} cy={34} r={shown ? 5 : 3} fill={PLACE_COLOR[p]} />
            {shown && <text x={px} y={order.indexOf(p) % 2 ? 58 : 20} fontSize={9} fill="#e2e8f0" textAnchor="middle">{PLACE_NAME[p].replace('The ', '')}</text>}
          </g>
        );
      })}
      <text x={W - 8} y={72} fontSize={8} fill="#94a3b8" textAnchor="end">farther →</text>
    </svg>
  );
}

/** farther_closer's `ask_arrow` lever: which end of "out from Earth" the question asks for. No place is drawn on it. */
function AskArrow({ ask }: { ask: 'far' | 'near' }) {
  const far = ask === 'far';
  return (
    <svg viewBox="0 0 320 44" className="block w-full" role="img" aria-label={far ? 'An arrow out from Earth, its far end marked' : 'An arrow out from Earth, its near end marked'} data-lever="ask-arrow">
      <defs><marker id="ask-arrow-head" markerWidth={8} markerHeight={8} refX={6} refY={4} orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="#fbbf24" /></marker></defs>
      <circle cx={14} cy={18} r={7} fill="#4a90d9" />
      <text x={14} y={38} fontSize={9} fill="#cbd5e1" textAnchor="middle">Earth</text>
      <line x1={26} y1={18} x2={306} y2={18} stroke="#fbbf24" strokeWidth={2} markerEnd="url(#ask-arrow-head)" />
      <rect x={far ? 236 : 26} y={6} width={74} height={24} rx={5} fill="none" stroke="#f87171" strokeWidth={1.5} strokeDasharray="3 2" />
      <text x={far ? 273 : 63} y={40} fontSize={9} fill="#fecaca" textAnchor="middle">{far ? 'farthest from Earth' : 'closest to Earth'}</text>
    </svg>
  );
}

const RING: Record<Target, { earth: number; planet: number }> = {
  venus: { earth: 48, planet: 30 }, mars: { earth: 32, planet: 52 }, jupiter: { earth: 22, planet: 60 },
};
const at = (cx: number, r: number, deg: number) => ({ x: cx + r * Math.cos((deg * Math.PI) / 180), y: cx - r * Math.sin((deg * Math.PI) / 180) });

/** One launch month: the Sun, two orbits (not to scale), Earth and the target where they are that month. */
function WindowPicture({ target, w, lines, path }: { target: Target; w: LaunchWindow; lines: boolean; path: boolean }) {
  const S = 140, c = S / 2, ring = RING[target];
  const e = at(c, ring.earth, w.earth), p = at(c, ring.planet, w.planet);
  // The ship's path (after the answer): a curve from Earth to the planet, bowed away from the Sun.
  const mid = { x: (e.x + p.x) / 2, y: (e.y + p.y) / 2 };
  const out = Math.hypot(mid.x - c, mid.y - c) || 1;
  const bow = { x: mid.x + ((mid.x - c) / out) * 18, y: mid.y + ((mid.y - c) / out) * 18 };
  return (
    <svg viewBox={`0 0 ${S} ${S}`} className="block w-full max-w-[150px] mx-auto" aria-hidden="true">
      <rect width={S} height={S} rx={10} fill="#0b1026" />
      <circle cx={c} cy={c} r={ring.earth} fill="none" stroke="rgba(255,255,255,0.18)" />
      <circle cx={c} cy={c} r={ring.planet} fill="none" stroke="rgba(255,255,255,0.18)" strokeDasharray="3 3" />
      <circle cx={c} cy={c} r={8} fill="#fcd34d" />
      {lines && <line x1={e.x} y1={e.y} x2={p.x} y2={p.y} stroke="#e2e8f0" strokeWidth={1.2} strokeDasharray="4 3" data-distance-line />}
      {path && <path d={`M${e.x} ${e.y} Q${bow.x} ${bow.y} ${p.x} ${p.y}`} fill="none" stroke="#4ade80" strokeWidth={2} data-ship-path />}
      <circle cx={e.x} cy={e.y} r={5} fill="#4a90d9" data-earth />
      <circle cx={p.x} cy={p.y} r={target === 'jupiter' ? 7 : 5} fill={target === 'venus' ? '#e8a838' : target === 'mars' ? '#ef4444' : '#d4a46a'} data-target />
    </svg>
  );
}

/** pack_days: the trip line. Day squares for the way there and the stay; the way home is an arrow until `homeLeg`. */
function TripLine({ item, homeLeg, crewRows }: { item: PackItem; homeLeg: boolean; crewRows: boolean }) {
  const sq = 11, gap = 3;
  const thereW = item.there * (sq + gap);
  const x0 = 34, moonX = x0 + thereW + 22, stayX = moonX + 22;
  const W = Math.max(stayX + item.stay * (sq + gap) + 10, 260);
  const squares = (n: number, x: number, y: number, key: string) => Array.from({ length: n }, (_, i) => (
    <rect key={`${key}${i}`} x={x + i * (sq + gap)} y={y} width={sq} height={sq} rx={2} fill="#64748b" stroke="#cbd5e1" strokeWidth={0.6} data-day={key} />
  ));
  return (
    <div className="space-y-2">
      <svg viewBox={`0 0 ${W} 92`} className="mx-auto block w-full max-w-[520px]" role="img" aria-label="The trip line: the days there and the days staying" data-trip-line>
        <circle cx={16} cy={26} r={12} fill="#4a90d9" />
        <text x={16} y={50} fontSize={9} fill="#cbd5e1" textAnchor="middle">Earth</text>
        {squares(item.there, x0, 20, 'there')}
        <text x={x0} y={14} fontSize={8} fill="#94a3b8">there</text>
        <circle cx={moonX} cy={26} r={10} fill="#cbd5e1" />
        <text x={moonX} y={50} fontSize={9} fill="#cbd5e1" textAnchor="middle">Moon</text>
        {squares(item.stay, stayX, 20, 'stay')}
        <text x={stayX} y={14} fontSize={8} fill="#94a3b8">stay</text>
        <path d={`M${moonX} 62 L${x0 - 4} 62`} stroke="#fbbf24" strokeWidth={1.5} markerEnd="url(#home-arrow)" />
        <defs><marker id="home-arrow" markerWidth={8} markerHeight={8} refX={7} refY={4} orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="#fbbf24" /></marker></defs>
        {homeLeg ? squares(item.there, x0, 68, 'home') : <text x={x0} y={82} fontSize={9} fill="#fde68a">home the same way</text>}
      </svg>
      <div className="flex flex-wrap items-center justify-center gap-2 text-xl" aria-label={`${item.crew} astronaut${item.crew === 1 ? '' : 's'}`} data-crew={item.crew}>
        {Array.from({ length: item.crew }, (_, i) => (
          <span key={i} className="flex items-center gap-0.5">
            <span aria-hidden="true">🧑‍🚀</span>{crewRows && <span aria-hidden="true" className="text-base" data-crew-pack>🥫</span>}
          </span>
        ))}
      </div>
      {crewRows && <p className="text-center text-xs text-rose-200" data-lever="crew-rows">{CREW_LINE}</p>}
    </div>
  );
}

const FLYBY_COLOR: Record<string, string> = { venus: '#e8a838', earth: '#4a90d9', mars: '#ef4444' };

/** assist_tradeoff: a route's path from Earth past its flyby planets to the target, and its years as squares. */
function RoutePicture({ route, target, limit, limitLine, chosen }: { route: Route; target: AssistItem['target']; limit: number; limitLine: boolean; chosen: boolean }) {
  const W = 170, n = route.flybys.length;
  const stops = route.flybys.map((f, i) => ({ f, x: 30 + ((i + 1) * (W - 60)) / (n + 1), y: i % 2 ? 62 : 22 }));
  const pts = [{ x: 14, y: 42 }, ...stops.map(s => ({ x: s.x, y: s.y })), { x: W - 16, y: 42 }];
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ');
  const yr = 9, yg = 2, maxYears = Math.max(route.years, limit);
  const yearW = Math.min(yr, (W - 20) / maxYears - yg);
  return (
    <svg viewBox={`0 0 ${W} 104`} className="block w-full" aria-hidden="true">
      <rect width={W} height={82} rx={8} fill="#0b1026" />
      <path d={d} fill="none" stroke={chosen ? '#4ade80' : '#94a3b8'} strokeWidth={chosen ? 2.2 : 1.4} strokeDasharray={chosen ? undefined : '4 3'} data-route-path />
      <circle cx={14} cy={42} r={6} fill="#4a90d9" />
      {stops.map((s, i) => (
        <g key={i} data-flyby={s.f}>
          <circle cx={s.x} cy={s.y} r={6} fill={FLYBY_COLOR[s.f]} />
          <path d={`M${s.x - 9} ${s.y} A9 9 0 0 1 ${s.x + 9} ${s.y}`} fill="none" stroke="#fde68a" strokeWidth={1} transform={s.y > 42 ? `rotate(180 ${s.x} ${s.y})` : undefined} />
          <text x={s.x} y={s.y > 42 ? s.y + 18 : s.y - 11} fontSize={9} fill="#cbd5e1" textAnchor="middle">{FLYBY_NAME[s.f]}</text>
        </g>
      ))}
      <circle cx={W - 16} cy={42} r={target === 'saturn' ? 7 : 8} fill={target === 'saturn' ? '#e9c46a' : '#d4a46a'} />
      {target === 'saturn' && <ellipse cx={W - 16} cy={42} rx={11} ry={3} fill="none" stroke="#fde68a" />}
      <g data-years={route.years}>
        {Array.from({ length: route.years }, (_, i) => (
          <rect key={i} x={10 + i * (yearW + yg)} y={88} width={yearW} height={9} rx={1.5} fill="#38bdf8" opacity={0.85} />
        ))}
      </g>
      {limitLine && <line x1={10 + limit * (yearW + yg) - yg / 2} x2={10 + limit * (yearW + yg) - yg / 2} y1={84} y2={101} stroke="#f87171" strokeWidth={2} data-limit-line />}
    </svg>
  );
}

function CardLines({ lines, lever }: { lines: string[]; lever: string }) {
  return (
    <LuminaPanel accent="cyan" data-lever={lever} className="space-y-1 text-xs text-slate-300">
      {lines.map(l => <p key={l}>{l}</p>)}
    </LuminaPanel>
  );
}

// ============================================================================
// Graded surface (grades 2-5)
// ============================================================================

type LeverMemo = { item: string } & MissionLeverState;

const MissionPlannerSurface = ({ data, className, runtimePlanItemId, tutorOwned, useController }:
  MissionPlannerProps & { tutorOwned: boolean; useController: (options: ProgressOptions<MissionItem>) => Progress }) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const { title, overview, description, gradeLevel, instanceId, skillId, subskillId, objectiveId, exhibitId, onEvaluationSubmit } = data;

  const items = useMemo(() => missionItems(data),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.items, data.challengeTypes, data.difficulty, data.title, data.gradeLevel]);
  const stableInstanceId = useRef(instanceId || `mission-planner-${Date.now()}`);
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

  const item: MissionItem | undefined = items[Math.min(currentIndex, Math.max(items.length - 1, 0))];
  const [work, setWork] = useState<MissionWork>(emptyWork);
  /** Workspace path: the checked wrong work, shown until Try again. */
  const [wrongShown, setWrongShown] = useState(false);
  const [scriptedWrongs, setScriptedWrongs] = useState(0);
  const [scriptedReveal, setScriptedReveal] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [leverMemo, setLeverMemo] = useState<LeverMemo>({ item: '', ...NO_LEVERS });
  const [submitted, setSubmitted] = useState(false);
  const tappedCorrect = useRef<string | null>(null);

  const lever: MissionLeverState = item && leverMemo.item === item.id ? leverMemo : NO_LEVERS;
  const editLevers = (change: (s: MissionLeverState) => Partial<MissionLeverState>) => {
    const id = item?.id ?? '';
    setLeverMemo(m => { const s = m.item === id ? m : { item: id, ...NO_LEVERS }; return { ...s, ...change(s), item: id }; });
  };
  const leverOn = (id: string) => lever.pulled.includes(id);

  const solvedNow = !!item && results.some(r => r.challengeId === item.id && r.correct);
  const revealed = solvedNow || scriptedReveal;

  const { submitResult, hasSubmitted } = usePrimitiveEvaluation<MissionPlannerMetrics>({
    primitiveType: 'mission-planner',
    instanceId: resolvedInstanceId,
    skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // ── Scripted tutor only: its context carries no key; the workspace tutor reads the scene instead ──
  const aiPrimitiveData = useMemo(() => ({
    title, gradeLevel: gradeLevel ?? 'unspecified', mode: item?.mode ?? 'farther_closer', itemIndex: currentIndex + 1,
    totalItems: items.length, ask: item ? askOf(item) : title, attemptNumber: currentAttempts + 1,
  }), [gradeLevel, item, currentIndex, items.length, title, currentAttempts]);
  const { sendText, isAudioPlaying, activePrimitiveId } = useLuminaAI({
    primitiveType: 'mission-planner', instanceId: resolvedInstanceId, primitiveData: aiPrimitiveData,
    gradeLevel: gradeLevel ? `Grade ${gradeLevel}` : undefined, enabled: !tutorOwned,
  });
  const say = (text: string) => { if (!tutorOwned) sendText(text, { silent: true }); };

  const clearItem = () => { setWork(emptyWork()); setWrongShown(false); setFeedback(null); setScriptedWrongs(0); setScriptedReveal(false); };

  openItem.current = (_index, retry) => {
    if (retry) { setWork(emptyWork()); setWrongShown(false); setFeedback(null); editLevers(s => ({ wrongs: s.wrongs + 1 })); return; }
    clearItem();
  };

  /** A spoken answer the observer credited: recorded as a correct tap records it, and shown the same way. */
  solvedAloud.current = (index) => {
    const solved = items[index];
    if (!solved || tappedCorrect.current === solved.id || results.some(r => r.challengeId === solved.id && r.correct)) return;
    progress.mergeResult({ challengeId: solved.id, correct: true, attempts: currentAttempts + 1 });
    setWork({ pick: keyOf(solved) }); setWrongShown(false);
  };

  // ── Handlers ──
  const closed = revealed || wrongShown || learnerBlocked();
  const tap = (i: number) => {
    if (!item || closed || lever.dropped.includes(i)) return;
    SoundManager.select();
    setWork({ pick: i }); setFeedback(null);
  };

  /** Two choices reveal after one wrong try; more choices after two. */
  const triesBeforeReveal = (it: MissionItem) => (optionCount(it) <= 2 ? 1 : 2);

  const check = () => {
    if (!item || closed || !workComplete(item, work)) return;
    const correct = missionCorrect(item, work);
    progress.commitCheck(describeMissionWork(item, work), correct, correct ? undefined : missionMiss(item, work));
    if (correct) {
      SoundManager.playCorrect(); tappedCorrect.current = item.id;
      say(`[ANSWER_CORRECT] The learner answered: ${askOf(item)} The answer is now explained on screen. Praise briefly.`);
      return;
    }
    SoundManager.playIncorrect();
    if (tutorOwned) {
      editLevers(s => ({ picked: [...s.picked, work.pick!] }));
      setWrongShown(true);
      return;
    }
    const wrongs = scriptedWrongs + 1;
    setScriptedWrongs(wrongs);
    if (wrongs >= triesBeforeReveal(item)) {
      setScriptedReveal(true);
      setWork({ pick: keyOf(item) });
      progress.recordResult({ challengeId: item.id, correct: false, attempts: currentAttempts + 1 });
      say(`[ANSWER_REVEALED] The learner missed: ${askOf(item)} The answer is now on screen; explain it.`);
      return;
    }
    setWork(emptyWork());
    setFeedback('Not quite. Look again, and try once more.');
    say(`[ANSWER_INCORRECT] ${describeMissionWork(item, work)} for: ${askOf(item)} It is wrong. You are not told the answer: ask what the learner noticed, without naming a choice.`);
  };

  const metrics = (): MissionPlannerMetrics => {
    const right = items.filter(i => results.some(r => r.challengeId === i.id && r.correct));
    return {
      type: 'mission-planner',
      challengeType: item?.mode ?? 'farther_closer',
      itemsTotal: items.length,
      itemsCorrect: right.length,
      firstTryCorrect: results.filter(r => r.correct && r.attempts === 1).length,
      checkedAnswers: results.reduce((s, r) => s + (r.attempts ?? 1), 0),
    };
  };

  /** Scripted path: Next, and on the last item the session report. Only a first-try answer scores. */
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
    submitResult(result.passed, result.accuracy, { ...metrics(), checkedAnswers: result.teachingAttempts.length },
      { challengeResults: result.outcomes, learningResponses: result.learningResponses,
        teachingAttempts: result.teachingAttempts, assistanceProvenance: result.assistanceProvenance },
      undefined, result.diagnosisEvidence);
  };

  // ── Workspace path: what the tutor and the observer are shown, republished every render ──
  useLayoutEffect(() => {
    if (!tutorOwned || !item || (isComplete && !solvedNow)) return;
    const scene = workspaceScene(item, { work, solved: revealed });
    const levers = revealed ? [] : missionLevers(item, lever);
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
          if (work.pick === far) setWork(emptyWork());
          return true;
        }
        editLevers(s => ({ pulled: [...s.pulled, id] }));
        return true;
      },
    };
  });

  // The workspace path keeps the last credited item on screen until the session is submitted.
  const done = hasSubmitted || submitted || (tutorOwned && isComplete && !solvedNow);
  const pip = useWorkspacePipSurface({
    instanceId: resolvedInstanceId,
    scopeId: done || !item ? null : item.id,
    label: 'The mission choices and your answer',
    solved: revealed,
    tutorSpeaking: isAudioPlaying && activePrimitiveId === resolvedInstanceId,
  });

  if (!items.length) {
    return (
      <LuminaCard className={className}>
        <LuminaCardHeader><LuminaCardTitle>{title || 'Mission Planner'}</LuminaCardTitle></LuminaCardHeader>
        <LuminaCardContent><p className="text-sm text-slate-400">This planner has nothing to ask.</p></LuminaCardContent>
      </LuminaCard>
    );
  }

  // ── Render pieces ──
  const keyIdx = item ? keyOf(item) : -1;
  const optionState = (i: number): AnswerChoiceState => {
    if (lever.dropped.includes(i)) return 'dimmed';
    if (revealed) return i === keyIdx ? 'correct' : i === work.pick ? 'incorrect' : 'dimmed';
    if (wrongShown && work.pick === i) return 'incorrect';
    return work.pick === i ? 'selected' : 'idle';
  };
  const choice = (i: number, label: string, children: React.ReactNode, cls: string) => (
    <LuminaAnswerChoice key={i} aria-label={label} state={optionState(i)}
      disabled={closed || lever.dropped.includes(i)} data-dropped={lever.dropped.includes(i) || undefined}
      className={cls} onClick={() => tap(i)}>
      {children}
    </LuminaAnswerChoice>
  );
  const grid = (n: number) => `grid gap-2 ${n > 2 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2'}`;

  const renderChoices = (it: MissionItem) => {
    if (it.mode === 'farther_closer') {
      return (
        <div className={grid(it.places.length)}>
          {it.places.map((p, i) => choice(i, PLACE_NAME[p], (
            <>
              <PlacePicture place={p} />
              <span className="text-sm font-semibold">{PLACE_NAME[p]}</span>
            </>
          ), 'flex flex-col items-center gap-1 p-2'))}
        </div>
      );
    }
    if (it.mode === 'pick_window') {
      return (
        <div className={grid(it.windows.length)}>
          {it.windows.map((w, i) => choice(i, w.month, (
            <>
              <WindowPicture target={it.target} w={w} lines={leverOn(DISTANCE_LINES_LEVER)} path={revealed && i === keyIdx} />
              <span className="text-sm font-semibold">{w.month}</span>
            </>
          ), 'flex flex-col items-stretch gap-1 p-1.5'))}
        </div>
      );
    }
    if (it.mode === 'pack_days') {
      return (
        <div className={grid(it.options.length)}>
          {it.options.map((v, i) => choice(i, `${v} packs`, <span className="text-lg font-bold">{`${v} packs`}</span>, 'flex items-center justify-center p-3'))}
        </div>
      );
    }
    return (
      <div className={grid(it.routes.length)}>
        {it.routes.map((r, i) => choice(i, routeLabel(i), (
          <>
            <RoutePicture route={r} target={it.target} limit={it.limit} limitLine={leverOn(LIMIT_LINE_LEVER)} chosen={revealed && i === keyIdx} />
            <span className="flex items-center justify-between gap-1 px-1 text-xs">
              <span className="font-semibold">{routeLabel(i)}</span>
              <span className="text-slate-300">{`${r.years} year${r.years === 1 ? '' : 's'}`}</span>
            </span>
          </>
        ), 'flex flex-col items-stretch gap-1 p-1.5'))}
      </div>
    );
  };

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader>
        <LuminaCardTitle>{`🛸 ${title || 'Mission Planner'}`}</LuminaCardTitle>
        {!done && item && (
          <LuminaSectionLabel accent="cyan" size="sm">
            {`${MODE_LABEL[item.mode]} · item ${Math.min(currentIndex, items.length - 1) + 1} of ${items.length}`}
          </LuminaSectionLabel>
        )}
        {(overview || description) && !done && <p className="text-sm text-slate-400">{overview || description}</p>}
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {done ? (
          <LuminaFeedbackCard status="insight" label="Planner complete">
            {`${results.filter(r => r.correct).length} of ${items.length} answered.`}
          </LuminaFeedbackCard>
        ) : item && (
          <>
            <div className="flex items-center gap-3">
              <LuminaPrompt accent="cyan" className="flex-1">{askOf(item)}</LuminaPrompt>
              {!tutorOwned && (
                <ReadMeButton instruction={askOf(item)} ask="Look at the choices, then answer."
                  speaking={isAudioPlaying} onAskTutor={m => sendText?.(m)} tag="[READ_CHALLENGE]"
                  className="flex-shrink-0" aria-label="Read the question to me" />
              )}
            </div>

            {pip.store && <div {...pip.dock} />}
            <div {...pip.workspace} className="space-y-3">
              {item.mode === 'pack_days' && <TripLine item={item} homeLeg={leverOn(HOME_LEG_LEVER)} crewRows={leverOn(CREW_ROWS_LEVER)} />}
              {item.mode === 'pick_window' && <p className="text-center text-xs text-slate-400">{`The Sun, Earth (blue) and ${TARGET_NAME[item.target]}, in each month. Not to scale.`}</p>}
              {item.mode === 'assist_tradeoff' && <p className="text-center text-xs text-slate-400">{`From Earth (left) to ${FAR_NAME[item.target]} (right). Each blue square is one year.`}</p>}

              {leverOn(FUEL_CARD_LEVER) && <CardLines lines={FUEL_CARD_LINES} lever="fuel-card" />}
              {leverOn(ASSIST_CARD_LEVER) && <CardLines lines={ASSIST_CARD_LINES} lever="assist-card" />}

              {renderChoices(item)}
              {item.mode === 'farther_closer' && leverOn(ASK_ARROW_LEVER) && !revealed && <AskArrow ask={item.ask} />}
              {revealed && item.mode === 'farther_closer' && <DistanceStrip places={item.places} />}
            </div>

            {!revealed && (
              <div className="flex justify-center">
                <LuminaActionButton action="check" disabled={closed || !workComplete(item, work)} onClick={check}>
                  Check Answer
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
const MissionPlannerBound = withWorkspaceController<MissionPlannerProps, ProgressOptions<MissionItem>, Progress>(
  'mission-planner', MissionPlannerSurface, useScriptedProgress, useWorkspaceProgressFor('mission-planner'));

// ============================================================================
// K-1: the ungraded planning story (user ruling 10-16). Nothing is scored or submitted.
// ============================================================================

type StoryStep = 'choose' | 'pack' | 'fly' | 'arrived';
const STORY_PACK = [
  { id: 'food', icon: '🍎', name: 'Food' },
  { id: 'water', icon: '💧', name: 'Water' },
  { id: 'air', icon: '🫧', name: 'Air' },
] as const;
const STORY_SAY: Record<StoryStep, string> = {
  choose: 'Where shall our spaceship fly? Pick a place.',
  pack: 'Astronauts need food, water and air. Tap them to put them in the ship, then press Fly.',
  fly: 'Off we go!',
  arrived: 'We made it! Want to fly somewhere else?',
};
const STORY_NAME: Record<StoryPlace, string> = { moon: 'The Moon', mars: 'Mars', jupiter: 'Jupiter' };

function MissionStory({ data, className }: MissionPlannerProps) {
  const { title, gradeLevel, instanceId } = data;
  const places = useMemo<StoryPlace[]>(() => {
    const asked = (data.story?.places ?? []).filter((p): p is StoryPlace => p in STORY_TRIP);
    return asked.length >= 2 ? asked : storyPlaces(gradeLevel);
  }, [data.story?.places, gradeLevel]);
  const stableId = useRef(instanceId || `mission-planner-story-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableId.current;
  const [step, setStep] = useState<StoryStep>('choose');
  const [place, setPlace] = useState<StoryPlace | null>(null);
  const [packed, setPacked] = useState<string[]>([]);
  const [flown, setFlown] = useState(false);

  const aiPrimitiveData = useMemo(() => ({
    title, gradeLevel: gradeLevel ?? 'K', mode: 'story (ungraded: nothing is right or wrong)',
    ask: `${STORY_SAY[step]} Places: ${places.map(p => STORY_NAME[p]).join(', ')}. Chosen: ${place ? STORY_NAME[place] : 'nothing yet'}.`,
  }), [title, gradeLevel, step, places, place]);
  const { sendText, isAudioPlaying, activePrimitiveId } = useLuminaAI({
    primitiveType: 'mission-planner', instanceId: resolvedInstanceId, primitiveData: aiPrimitiveData, gradeLevel: 'kindergarten',
  });
  const tell = (text: string) => sendText(text, { silent: true });

  const oriented = useRef(false);
  useEffect(() => {
    if (oriented.current) return;
    oriented.current = true;
    tell(`[MISSION_ORIENT] A pre-reader who cannot read any text opened a space-trip story: "${title}". They pick a place to `
      + `fly to (${places.map(p => STORY_NAME[p]).join(' or ')}). Nothing here is right or wrong and nothing is scored. Say what to do in child words.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The flight takes a moment on screen, then the arrival.
  useEffect(() => {
    if (step !== 'fly') return;
    const raf = requestAnimationFrame(() => setFlown(true));
    const t = setTimeout(() => {
      setStep('arrived');
      if (place) tell(`[MISSION_ARRIVED] The ship reached ${STORY_NAME[place]}. Say, without numbers: "${STORY_TRIP[place]}"`);
    }, 2600);
    return () => { cancelAnimationFrame(raf); clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const choose = (p: StoryPlace) => {
    SoundManager.select();
    setPlace(p); setStep('pack');
    tell(`[MISSION_DESTINATION_SELECTED] The child picked ${STORY_NAME[p]}. Say its name and one thing about it they can picture. Any place is a fine choice.`);
  };
  const togglePack = (id: string) => { SoundManager.select(); setPacked(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id])); };
  const fly = () => { SoundManager.playCorrect(); setFlown(false); setStep('fly'); };
  const again = () => { setPlace(null); setPacked([]); setFlown(false); setStep('choose'); };

  const pip = useWorkspacePipSurface({
    instanceId: resolvedInstanceId,
    scopeId: 'story',
    label: 'The space trip story',
    solved: step === 'arrived',
    tutorSpeaking: isAudioPlaying && activePrimitiveId === resolvedInstanceId,
  });

  const farX = place === 'moon' ? 120 : place === 'mars' ? 220 : 290;
  return (
    <LuminaCard className={className}>
      <LuminaCardHeader>
        <LuminaCardTitle>{`🛸 ${title || 'Space Trip'}`}</LuminaCardTitle>
      </LuminaCardHeader>
      <LuminaCardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <LuminaPrompt accent="cyan" className="flex-1">{STORY_SAY[step]}</LuminaPrompt>
          <ReadMeButton instruction={STORY_SAY[step]} ask="Then wait." speaking={isAudioPlaying}
            onAskTutor={m => sendText?.(m)} tag="[MISSION_READ_ALOUD]" className="flex-shrink-0" aria-label="Read it to me" />
        </div>
        {pip.store && <div {...pip.dock} />}
        <div {...pip.workspace} className="space-y-3" data-story-step={step}>
          {step === 'choose' && (
            <div className={`grid gap-2 ${places.length > 2 ? 'grid-cols-3' : 'grid-cols-2'}`}>
              {places.map(p => (
                <LuminaAnswerChoice key={p} aria-label={STORY_NAME[p]} state="idle" className="flex flex-col items-center gap-1 p-3" onClick={() => choose(p)}>
                  <PlacePicture place={p} size={64} />
                  <span className="text-sm font-semibold">{STORY_NAME[p]}</span>
                </LuminaAnswerChoice>
              ))}
            </div>
          )}
          {step === 'pack' && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {STORY_PACK.map(s => (
                  <LuminaAnswerChoice key={s.id} aria-label={s.name} state={packed.includes(s.id) ? 'selected' : 'idle'}
                    className="flex flex-col items-center gap-1 p-3" onClick={() => togglePack(s.id)}>
                    <span aria-hidden="true" className="text-3xl">{s.icon}</span>
                    <span className="text-sm">{s.name}</span>
                  </LuminaAnswerChoice>
                ))}
              </div>
              <div className="flex justify-center">
                <LuminaActionButton action="next" onClick={fly}>🚀 Fly!</LuminaActionButton>
              </div>
            </div>
          )}
          {(step === 'fly' || step === 'arrived') && place && (
            <svg viewBox="0 0 320 120" className="block w-full rounded-xl bg-[#0b1026]" role="img" aria-label={`The ship flying to ${STORY_NAME[place]}`} data-story-flight>
              <circle cx={30} cy={70} r={16} fill="#4a90d9" />
              <g transform={`translate(${farX - 28} 42)`}><PlacePicture place={place} size={56} /></g>
              <path d={`M46 66 Q${(46 + farX) / 2} 18 ${farX - 22} 64`} fill="none" stroke="#94a3b8" strokeDasharray="4 4" />
              <text fontSize={20} style={{ transition: 'transform 2.4s ease-in-out', transform: `translate(${flown ? farX - 40 : 40}px, ${flown ? 60 : 64}px)` }} data-ship>🚀</text>
              <text x={8} y={112} fontSize={10} fill="#cbd5e1">{packed.map(id => STORY_PACK.find(s => s.id === id)?.icon).join(' ')}</text>
            </svg>
          )}
          {step === 'arrived' && place && (
            <div className="space-y-3">
              <LuminaFeedbackCard status="insight" label={`${STORY_NAME[place]}!`}>{STORY_TRIP[place]}</LuminaFeedbackCard>
              <div className="flex justify-center">
                <LuminaActionButton action="next" onClick={again}>Fly somewhere else</LuminaActionButton>
              </div>
            </div>
          )}
        </div>
      </LuminaCardContent>
    </LuminaCard>
  );
}

/** Grades 2-5: the graded planner on the workspace. K-1: the ungraded story, which never mounts the workspace. */
const MissionPlanner: React.FC<MissionPlannerProps> = (props) =>
  (isStoryGrade(props.data.gradeLevel) ? <MissionStory {...props} /> : <MissionPlannerBound {...props} />);

export default MissionPlanner;
