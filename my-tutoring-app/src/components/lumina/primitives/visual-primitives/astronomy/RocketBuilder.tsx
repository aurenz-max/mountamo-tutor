'use client';

/**
 * Rocket Builder: rockets made of parts, each part with its weight drawn as blocks and each engine its push as arrows,
 * and one prediction per eval mode (rebuilt 2026-10-16 under the 10-15 ruling; the old builder showed a live
 * Thrust/Weight panel, printed the ratio in its failure line, and scored a third-launch success 100).
 * - can_it_lift: say or tap whether the rocket lifts off the pad.
 * - add_to_lift: say or tap the one part that makes a grounded rocket lift off.
 * - on_budget: say or tap the rocket that lifts off and costs no more than the budget.
 * - reach_target: say or tap the rocket that flies highest (or least high).
 *
 * Every item is built and keyed by code from one toy flight model (`rocketWorkspace.ts`). Nothing launches before the
 * answer is checked, and no total, ratio or readout is drawn. Taught only on the shared tutor/JEV workspace
 * (`withWorkspaceOnly`; its wiring is `rocketBuilder.card.ts` + `rocketBuilder.boss.ts`): every check commits through
 * `progress.commitCheck` with a named miss, a spoken answer is judged by the tutor, and the runtime moves on. The levers
 * are one lever set in `rocketLevers.ts`.
 */
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../../../evaluation';
import type { RocketBuilderMetrics } from '../../../evaluation/types';
import { SoundManager } from '../../../utils/SoundManager';
import { PipDock, PipWorkspace } from '../../../pip/WorkspacePip';
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
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceProgressFor } from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { leverScene } from '../../../components/live-activity/bossLevers';
import {
  askOf, COLOR_HEX, describeRocketWork, emptyWork, flightOf, isManyItem, keyOf, LIFT_CHOICES, LIFT_TEXT, lifts,
  partLabel, revealText, rocketCorrect, rocketItems, rocketLabel, rocketMiss, withPart, workComplete, workspaceScene,
  type Part, type Rocket, type RocketItem, type RocketMode, type RocketTier, type RocketWork,
} from './rocketWorkspace';
import {
  COUNT_LEVER, DROP_LEVER, dropTarget, FUEL_CARD_LEVER, FUEL_CARD_LINES, LIFT_CARD_LEVER, LIFT_CARD_LINE,
  NO_LEVERS, OWN_WEIGHT_LEVER, OWN_WEIGHT_LINE, ROCKET_LEVERS, type RocketLeverState,
} from './rocketLevers';
import { rocketBuilderBoss } from './rocketBuilder.boss';

// ============================================================================
// Data Types (single source of truth; the generator imports them)
// ============================================================================

export type { RocketItem, RocketMode, RocketTier };

/** Legacy part shape (the pre-rebuild parts library); `types.ts` re-exports it. Ignored by the rebuilt builder. */
export interface RocketComponent {
  id: string;
  name: string;
  type: 'capsule' | 'fuel_tank' | 'engine' | 'booster' | 'fins' | 'fairing' | 'payload';
  massKg: number;
  thrustKN?: number;
  propellantMassKg?: number;
  widthUnits?: number;
  heightUnits?: number;
  color?: string;
  description?: string;
  cost?: number;
}

export interface RocketBuilderData {
  title: string;
  /** One neutral sentence under the title; never states what makes a rocket lift off or fly higher. */
  overview?: string;
  description?: string;
  /** Grade rung 'K'..'5'. */
  gradeLevel?: string;
  /** The eval modes this session asks, in order. */
  challengeTypes?: RocketMode[];
  /** config.difficulty: the structural band the items were built at. */
  difficulty?: RocketTier;
  /** The items, built and keyed by code at generation; absent or invalid: rebuilt from the fields above. */
  items?: RocketItem[];

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<RocketBuilderMetrics>) => void;
}

interface RocketBuilderProps {
  data: RocketBuilderData;
  className?: string;
  runtimePlanItemId?: string;
  runtimeEvalMode?: string;
}

const MODE_LABEL: Record<RocketMode, string> = {
  can_it_lift: 'Will it lift off?', add_to_lift: 'Add one part', on_budget: 'On budget', reach_target: 'Which flies highest?',
};

// ============================================================================
// Drawing a rocket: parts bottom-up, weight blocks and push arrows (and coins) beside each part
// ============================================================================

const BODY_X = 14;
const BODY_W = 40;
const ICON_X = BODY_X + BODY_W + 10;
const ICON = 9;
const PART_H: Record<Part['kind'], number> = { engine: 24, tank: 34, cargo: 24, capsule: 28 };
const SKY = 150;
const PAD = 14;
const PANEL_W = 214;

interface Marks { count: boolean; coins: boolean; ownWeight?: boolean }

/** The rows of icons one part carries: weight blocks, push arrows, coins. */
const rowsOf = (p: Part, coins: boolean) => 1 + (p.push ? 1 : 0) + (coins && p.cost ? 1 : 0);
const bandH = (p: Part, coins: boolean) => Math.max(PART_H[p.kind], rowsOf(p, coins) * (ICON + 3) + 4);

function Blocks({ n, x, y, outlined }: { n: number; x: number; y: number; outlined?: boolean }) {
  return (
    <g data-weight={n}>
      {Array.from({ length: n }, (_, i) => <rect key={i} x={x + i * (ICON + 2)} y={y} width={ICON} height={ICON} rx={1.5} fill="#94a3b8" stroke="#0f172a" strokeWidth={0.6} />)}
      {outlined && <rect x={x - 2} y={y - 2} width={n * (ICON + 2) + 2} height={ICON + 4} rx={3} fill="none" stroke="#f87171" strokeWidth={1.4} strokeDasharray="3 2" data-own-weight />}
    </g>
  );
}

function Arrows({ n, x, y }: { n: number; x: number; y: number }) {
  return (
    <g data-push={n}>
      {Array.from({ length: n }, (_, i) => {
        const cx = x + i * (ICON + 2) + ICON / 2;
        return <polygon key={i} fill="#fb923c"
          points={`${cx},${y} ${cx - ICON / 2},${y + 5} ${cx - 1.5},${y + 5} ${cx - 1.5},${y + ICON} ${cx + 1.5},${y + ICON} ${cx + 1.5},${y + 5} ${cx + ICON / 2},${y + 5}`} />;
      })}
    </g>
  );
}

function Coins({ n, x, y }: { n: number; x: number; y: number }) {
  return (
    <g data-coins={n}>
      {Array.from({ length: n }, (_, i) => <circle key={i} cx={x + i * (ICON + 2) + ICON / 2} cy={y + ICON / 2} r={ICON / 2} fill="#facc15" stroke="#a16207" strokeWidth={0.8} />)}
    </g>
  );
}

/** The icon rows beside one part (shared by the rocket and the add_to_lift option pictures). */
function PartIcons({ p, x, y, marks }: { p: Part; x: number; y: number; marks: Marks }) {
  let row = y;
  const out: React.ReactNode[] = [];
  const num = (n: number, at: number, len: number) => marks.count
    ? <text key={`n${at}`} x={x + len * (ICON + 2) + 4} y={at + ICON - 1} fontSize={10} fill="#e2e8f0" data-count>{n}</text> : null;
  out.push(<Blocks key="w" n={p.weight} x={x} y={row} outlined={marks.ownWeight} />, num(p.weight, row, p.weight));
  row += ICON + 3;
  if (p.push) { out.push(<Arrows key="p" n={p.push} x={x} y={row} />, num(p.push, row, p.push)); row += ICON + 3; }
  if (marks.coins && p.cost) { out.push(<Coins key="c" n={p.cost} x={x} y={row} />, num(p.cost, row, p.cost)); }
  return <g>{out}</g>;
}

/** One part's body, drawn in a box of the band's height. */
function PartBody({ p, y, h, tint }: { p: Part; y: number; h: number; tint: string }) {
  const x = BODY_X, w = BODY_W, ph = PART_H[p.kind], top = y + (h - ph) / 2;
  if (p.kind === 'engine') {
    return <g>
      <path d={`M${x + 8} ${top} L${x + w - 8} ${top} L${x + w} ${top + ph} L${x} ${top + ph} Z`} fill={p.color ? COLOR_HEX[p.color] : '#f59e0b'} stroke="#0f172a" strokeWidth={0.8} />
    </g>;
  }
  if (p.kind === 'capsule') {
    return <path d={`M${x} ${top + ph} L${x} ${top + ph * 0.45} Q${x + w / 2} ${top - 4} ${x + w} ${top + ph * 0.45} L${x + w} ${top + ph} Z`} fill={tint} stroke="#0f172a" strokeWidth={0.8} />;
  }
  if (p.kind === 'tank') {
    return <g>
      <rect x={x} y={top} width={w} height={ph} rx={3} fill="#3b82f6" stroke="#0f172a" strokeWidth={0.8} />
      <rect x={x + 4} y={top + 4} width={w - 8} height={ph - 8} rx={2} fill="#93c5fd" opacity={0.6} />
    </g>;
  }
  return <g>
    <rect x={x + 2} y={top} width={w - 4} height={ph} rx={2} fill="#a16207" stroke="#0f172a" strokeWidth={0.8} />
    <line x1={x + 2} y1={top + ph / 2} x2={x + w - 2} y2={top + ph / 2} stroke="#78350f" />
  </g>;
}

type Launch = 'up' | 'stays' | null;

/**
 * One rocket on its pad, in its own SVG. `launch` starts once the answer is checked: up by `rise` (0-1 of the sky), or a
 * shake on the pad. The drawing never states a total.
 */
function RocketPanel({ rocket, marks, launch, rise, out, label }: {
  rocket: Rocket; marks: Marks; launch: Launch; rise: number; out?: boolean; label?: string;
}) {
  const bands = rocket.parts.map(p => bandH(p, marks.coins));
  const stackH = bands.reduce((s, h) => s + h, 0);
  const H = SKY + stackH + PAD + 6;
  const tint = COLOR_HEX[rocket.color];
  const move = useRef<SVGElement>(null);
  useEffect(() => { (move.current as unknown as { beginElement?: () => void } | null)?.beginElement?.(); }, [launch, rise]);
  let y = SKY + stackH;
  const parts = rocket.parts.map((p, i) => {
    y -= bands[i];
    const top = y;
    return (
      <g key={i} data-part={p.kind}>
        <PartBody p={p} y={top} h={bands[i]} tint={tint} />
        {rocket.staged && i > 0 && p.kind !== 'capsule' && rocket.parts[i - 1].kind === 'tank' && (
          <line x1={BODY_X - 4} x2={BODY_X + BODY_W + 4} y1={top + bands[i]} y2={top + bands[i]} stroke="#fbbf24" strokeWidth={1.5} strokeDasharray="3 2" />
        )}
        <PartIcons p={p} x={ICON_X} y={top + 2} marks={marks} />
      </g>
    );
  });
  // Up by its share of the sky; `out`: on past the top of the view.
  const dy = launch === 'up' ? -Math.max(8, rise * (SKY - 12)) - (out ? stackH + 40 : 0) : 0;
  return (
    <svg viewBox={`0 0 ${PANEL_W} ${H}`} className="block w-full select-none rounded-xl bg-gradient-to-b from-[#0b1026] to-[#1e293b]"
      role="img" aria-label={label ?? 'A rocket on its launch pad'} data-launch={launch ?? 'none'}>
      {rocket.staged && (
        <text x={6} y={14} fontSize={10} fill="#fde68a" data-staged>drops empty tanks</text>
      )}
      <rect x={0} y={SKY + stackH} width={PANEL_W} height={PAD + 6} fill="#334155" />
      <rect x={BODY_X - 6} y={SKY + stackH} width={BODY_W + 12} height={5} fill="#64748b" />
      <g>
        {launch === 'up' && <ellipse cx={BODY_X + BODY_W / 2} cy={SKY + stackH + 10} rx={BODY_W / 3} ry={14} fill="#fb923c" opacity={0.85} />}
        {parts}
        {launch === 'up' && (
          <animateTransform ref={move as never} attributeName="transform" type="translate" from="0 0" to={`0 ${dy}`} dur="2.2s" begin="indefinite" fill="freeze" />
        )}
        {launch === 'stays' && (
          <animateTransform ref={move as never} attributeName="transform" type="translate" values="0 0; -2 0; 2 0; -2 0; 0 0" dur="0.5s" repeatCount={3} begin="indefinite" />
        )}
      </g>
      {launch === 'stays' && <ellipse cx={BODY_X + BODY_W / 2} cy={SKY + stackH + 2} rx={BODY_W} ry={6} fill="#94a3b8" opacity={0.35} />}
    </svg>
  );
}

/** add_to_lift: one part that could be added, as a small picture with its blocks and arrows. */
function PartPicture({ p, marks }: { p: Part; marks: Marks }) {
  const h = bandH(p, false) + 4;
  return (
    <svg width={170} height={h} viewBox={`0 0 170 ${h}`} aria-hidden="true">
      <PartBody p={p} y={2} h={h - 4} tint="#cbd5e1" />
      <PartIcons p={p} x={ICON_X} y={4} marks={marks} />
    </svg>
  );
}

function LiftCard() {
  const box = (x: number, push: number, weight: number, rises: boolean) => (
    <g>
      <rect x={x} y={rises ? 18 : 40} width={36} height={22} rx={3} fill="#a16207" />
      {Array.from({ length: weight }, (_, i) => <rect key={i} x={x + 42 + i * 9} y={rises ? 20 : 42} width={7} height={7} fill="#94a3b8" />)}
      {Array.from({ length: push }, (_, i) => <polygon key={i} points={`${x + 45.5 + i * 9},${rises ? 30 : 52} ${x + 42 + i * 9},${rises ? 37 : 59} ${x + 49 + i * 9},${rises ? 37 : 59}`} fill="#fb923c" />)}
      {rises && <path d={`M${x + 18} 14 L${x + 18} 4`} stroke="#4ade80" strokeWidth={2} />}
      <rect x={x - 4} y={62} width={44} height={4} fill="#475569" />
    </g>
  );
  return (
    <LuminaPanel accent="cyan" data-lever="lift-card" className="space-y-2 text-center text-xs text-slate-300">
      <svg width={260} height={70} viewBox="0 0 260 70" aria-label="Two boxes: one with more push than weight rises, one with push equal to weight stays down" className="mx-auto">
        {box(6, 5, 3, true)}
        {box(140, 4, 4, false)}
      </svg>
      <p>{LIFT_CARD_LINE}</p>
    </LuminaPanel>
  );
}

function FuelCard() {
  return (
    <LuminaPanel accent="cyan" data-lever="fuel-card" className="space-y-1 text-xs text-slate-300">
      {FUEL_CARD_LINES.map(l => <p key={l}>{l}</p>)}
    </LuminaPanel>
  );
}

// ============================================================================
// Component
// ============================================================================

type LeverMemo = { item: string } & RocketLeverState;

const useRocketProgress = useWorkspaceProgressFor('rocket-builder');

const RocketBuilderSurface = ({ data, className, runtimePlanItemId }: RocketBuilderProps) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const { title, overview, description, gradeLevel, instanceId, skillId, subskillId, objectiveId, exhibitId, onEvaluationSubmit } = data;

  const items = useMemo(() => rocketItems(data),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.items, data.challengeTypes, data.difficulty, data.title, data.gradeLevel]);
  const stableInstanceId = useRef(instanceId || `rocket-builder-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceId.current;

  // ── Progress: the runtime moves the index on the workspace path (callbacks bound below) ──
  const openItem = useRef<(index: number, retry: boolean) => void>(() => {});
  const solvedAloud = useRef<(index: number) => void>(() => {});
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const progress = useRocketProgress({
    challenges: items,
    getChallengeId: i => i.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: rocketBuilderBoss.assignment,
    onItemOpened: (index, retry) => openItem.current(index, retry),
    onSolved: index => solvedAloud.current(index),
    onFinished: result => finish.current(result),
  });
  const { currentIndex, currentAttempts, results, isComplete } = progress;
  const learnerBlocked = () => progress.canAttempt === false;

  const item: RocketItem | undefined = items[Math.min(currentIndex, Math.max(items.length - 1, 0))];
  const [work, setWork] = useState<RocketWork>(emptyWork);
  /** add_to_lift: the checked part, on the rocket and launched. */
  const [flown, setFlown] = useState<RocketWork | null>(null);
  /** The checked wrong work, shown until Try again. */
  const [wrongShown, setWrongShown] = useState(false);
  const [leverMemo, setLeverMemo] = useState<LeverMemo>({ item: '', ...NO_LEVERS });
  const [submitted, setSubmitted] = useState(false);
  const tappedCorrect = useRef<string | null>(null);

  const lever: RocketLeverState = item && leverMemo.item === item.id ? leverMemo : NO_LEVERS;
  const editLevers = (change: (s: RocketLeverState) => Partial<RocketLeverState>) => {
    const id = item?.id ?? '';
    setLeverMemo(m => { const s = m.item === id ? m : { item: id, ...NO_LEVERS }; return { ...s, ...change(s), item: id }; });
  };
  const leverOn = (id: string) => lever.pulled.includes(id);

  const solvedNow = !!item && results.some(r => r.challengeId === item.id && r.correct);
  const revealed = solvedNow;

  const { submitResult, hasSubmitted } = usePrimitiveEvaluation<RocketBuilderMetrics>({
    primitiveType: 'rocket-builder',
    instanceId: resolvedInstanceId,
    skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const clearItem = () => { setWork(emptyWork()); setFlown(null); setWrongShown(false); };

  openItem.current = (_index, retry) => {
    if (retry) { clearItem(); editLevers(s => ({ wrongs: s.wrongs + 1 })); return; }
    clearItem();
  };

  /** A spoken answer the observer credited: recorded as a correct tap records it, and shown the same way. */
  solvedAloud.current = (index) => {
    const solved = items[index];
    if (!solved || tappedCorrect.current === solved.id || results.some(r => r.challengeId === solved.id && r.correct)) return;
    progress.mergeResult({ challengeId: solved.id, correct: true, attempts: currentAttempts + 1 });
    const keyWork = { pick: keyOf(solved) };
    setWork(keyWork); setFlown(keyWork); setWrongShown(false);
  };

  // ── Handlers ──
  const closed = revealed || wrongShown || learnerBlocked();
  const tap = (i: number) => {
    if (!item || closed || lever.dropped.includes(i)) return;
    SoundManager.select();
    setWork({ pick: i }); setFlown(null);
  };

  const check = () => {
    if (!item || closed || !workComplete(item, work)) return;
    const correct = rocketCorrect(item, work);
    progress.commitCheck(describeRocketWork(item, work), correct, correct ? undefined : rocketMiss(item, work));
    if (correct || item.mode === 'add_to_lift') setFlown({ ...work });
    if (correct) { SoundManager.playCorrect(); tappedCorrect.current = item.id; return; }
    SoundManager.playIncorrect();
    editLevers(s => ({ picked: [...s.picked, work.pick!] }));
    setWrongShown(true);
  };

  const metrics = (): RocketBuilderMetrics => {
    const right = items.filter(i => results.some(r => r.challengeId === i.id && r.correct));
    return {
      type: 'rocket-builder',
      challengeType: item?.mode ?? 'can_it_lift',
      itemsTotal: items.length,
      itemsCorrect: right.length,
      firstTryCorrect: results.filter(r => r.correct && r.attempts === 1).length,
      launchAttempts: results.reduce((s, r) => s + (r.attempts ?? 1), 0),
    };
  };

  finish.current = (result) => {
    if (hasSubmitted || progress.recordsEvaluation === false || !items.length) return;
    setSubmitted(true);
    submitResult(result.passed, result.accuracy, { ...metrics(), launchAttempts: result.teachingAttempts.length },
      { challengeResults: result.outcomes, learningResponses: result.learningResponses,
        teachingAttempts: result.teachingAttempts, assistanceProvenance: result.assistanceProvenance },
      undefined, result.diagnosisEvidence);
  };

  // ── What the tutor and the observer are shown, republished every render ──
  useLayoutEffect(() => {
    if (!item || (isComplete && !solvedNow)) return;
    const scene = workspaceScene(item, { work: flown ?? work, solved: revealed, flown: !!flown });
    const leverCtx = { state: lever };
    const levers = revealed ? [] : ROCKET_LEVERS.declare(item, leverCtx, lever.pulled);
    workspace.current = {
      ...leverScene(scene, { support: '', onScreen: ROCKET_LEVERS.onScreen(item, leverCtx, lever.pulled) }),
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

  // The workspace path keeps the last credited item on screen (its launch) until the session is submitted.
  const done = hasSubmitted || submitted || (isComplete && !solvedNow);

  if (!items.length) {
    return (
      <LuminaCard className={className}>
        <LuminaCardHeader><LuminaCardTitle>{title || 'Rocket Builder'}</LuminaCardTitle></LuminaCardHeader>
        <LuminaCardContent><p className="text-sm text-slate-400">This builder has nothing to ask.</p></LuminaCardContent>
      </LuminaCard>
    );
  }

  // ── Render pieces ──
  const marks = (coins: boolean): Marks => ({ count: leverOn(COUNT_LEVER), coins });
  const optionState = (i: number): AnswerChoiceState => {
    if (lever.dropped.includes(i)) return 'dimmed';
    const key = item ? keyOf(item) : -1;
    if (revealed) return i === key ? 'correct' : i === work.pick ? 'incorrect' : 'dimmed';
    if (wrongShown && work.pick === i) return 'incorrect';
    return work.pick === i ? 'selected' : 'idle';
  };

  const renderSingle = (it: Extract<RocketItem, { mode: 'can_it_lift' | 'add_to_lift' }>) => {
    const added = it.mode === 'add_to_lift' && flown?.pick != null ? it.options[flown.pick] : null;
    const rocket = added ? withPart(it.rocket, added) : it.rocket;
    const launched = it.mode === 'can_it_lift' ? revealed : !!flown;
    const launch: Launch = launched ? (lifts(rocket) ? 'up' : 'stays') : null;
    return (
      <div className="mx-auto w-full max-w-[300px]">
        <RocketPanel rocket={rocket} marks={marks(false)} launch={launch} rise={1} out label="The rocket on its launch pad" />
      </div>
    );
  };

  const renderChoices = (it: RocketItem) => {
    if (it.mode === 'can_it_lift') {
      return (
        <div className="grid grid-cols-2 gap-2">
          {LIFT_CHOICES.map((c, i) => (
            <LuminaAnswerChoice key={c} aria-label={LIFT_TEXT[c]} state={optionState(i)} disabled={closed}
              className="flex items-center justify-center gap-2 p-3 font-semibold" onClick={() => tap(i)}>
              <span aria-hidden="true" className="text-2xl">{c === 'lifts' ? '🚀⬆' : '🚀▁'}</span>
              <span>{LIFT_TEXT[c]}</span>
            </LuminaAnswerChoice>
          ))}
        </div>
      );
    }
    if (it.mode === 'add_to_lift') {
      return (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {it.options.map((p, i) => (
            <LuminaAnswerChoice key={i} aria-label={partLabel(p)} state={optionState(i)}
              disabled={closed || lever.dropped.includes(i)} data-dropped={lever.dropped.includes(i) || undefined}
              className="flex flex-col items-center gap-1 p-2" onClick={() => tap(i)}>
              <PartPicture p={p} marks={{ count: leverOn(COUNT_LEVER), coins: false, ownWeight: leverOn(OWN_WEIGHT_LEVER) }} />
              <span className="text-sm font-semibold">{partLabel(p)}</span>
            </LuminaAnswerChoice>
          ))}
        </div>
      );
    }
    const many = it;
    const launched = revealed;
    const h = many.rockets.map(flightOf);
    const top = Math.max(...h, 1e-9);
    return (
      <div className={`grid gap-2 ${many.rockets.length > 2 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2'}`}>
        {many.rockets.map((r, i) => (
          <LuminaAnswerChoice key={r.color} aria-label={rocketLabel(r)} state={optionState(i)}
            disabled={closed || lever.dropped.includes(i)} data-dropped={lever.dropped.includes(i) || undefined}
            className="flex flex-col items-stretch gap-1 p-1" onClick={() => tap(i)}>
            <RocketPanel rocket={r} marks={marks(many.mode === 'on_budget')} label={rocketLabel(r)}
              launch={launched ? (lifts(r) ? 'up' : 'stays') : null}
              rise={many.mode === 'reach_target' ? h[i] / top : 1} out={many.mode === 'on_budget'} />
            <span className="flex items-center justify-center gap-2 text-sm font-semibold">
              <span className="inline-block h-3 w-3 rounded-full" style={{ background: COLOR_HEX[r.color] }} />
              {rocketLabel(r)}
            </span>
          </LuminaAnswerChoice>
        ))}
      </div>
    );
  };

  const isPre = gradeLevel === 'K' || gradeLevel === '1';
  const flightLine = item?.mode === 'add_to_lift' && flown?.pick != null && !revealed
    ? `The ${partLabel(item.options[flown.pick]).toLowerCase()} is on, and the rocket still stays on the pad.` : null;

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader>
        <LuminaCardTitle>{`🚀 ${title || 'Rocket Builder'}`}</LuminaCardTitle>
        {!done && item && !isPre && (
          <LuminaSectionLabel accent="cyan" size="sm">
            {`${MODE_LABEL[item.mode]} · item ${Math.min(currentIndex, items.length - 1) + 1} of ${items.length}`}
          </LuminaSectionLabel>
        )}
        {(overview || description) && !done && !isPre && <p className="text-sm text-slate-400">{overview || description}</p>}
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {done ? (
          <LuminaFeedbackCard status="insight" label="Builder complete">
            {`${results.filter(r => r.correct).length} of ${items.length} answered.`}
          </LuminaFeedbackCard>
        ) : item && (
          <>
            <LuminaPrompt accent="cyan">{askOf(item)}</LuminaPrompt>

            {/* Pip comes from the workspace runner (`pip/WorkspacePip.tsx`): the dock above, the rockets and choices as its region. */}
            <PipDock />
            <PipWorkspace className="space-y-3">
              {!isManyItem(item) && renderSingle(item)}
              {flightLine && <p className="text-center text-sm text-amber-200" data-flight-result>{flightLine}</p>}

              {leverOn(LIFT_CARD_LEVER) && <LiftCard />}
              {leverOn(FUEL_CARD_LEVER) && <FuelCard />}
              {leverOn(OWN_WEIGHT_LEVER) && <p className="text-center text-xs text-rose-200" data-lever="own-weight">{OWN_WEIGHT_LINE}</p>}

              {renderChoices(item)}
            </PipWorkspace>

            {!revealed && (
              <div className="flex justify-center">
                <LuminaActionButton action="check" disabled={closed || !workComplete(item, work)} onClick={check}>
                  {item.mode === 'add_to_lift' ? 'Add it and check' : 'Check Answer'}
                </LuminaActionButton>
              </div>
            )}
            {revealed && (
              <LuminaFeedbackCard status={solvedNow ? 'correct' : 'insight'} label={solvedNow ? undefined : 'The answer'}>
                {revealText(item)}
              </LuminaFeedbackCard>
            )}
            {!revealed && wrongShown && <LuminaFeedbackCard status="incorrect">That is not it.</LuminaFeedbackCard>}
          </>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

const RocketBuilder = withWorkspaceOnly<RocketBuilderProps>('rocket-builder', RocketBuilderSurface, props => props.data.title);

export default RocketBuilder;
