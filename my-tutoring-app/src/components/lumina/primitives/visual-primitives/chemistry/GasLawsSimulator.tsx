'use client';

/**
 * Gas Laws Simulator: a container of gas, its state before, one or two changes, and a question about the quantity that
 * moves (one eval mode each).
 * - observe: predict the direction (goes up, goes down, stays the same) before the change is run.
 * - predict: one change; choose the new value.
 * - calculate: two changes at once; choose the new value.
 *
 * Taught only on the shared tutor/JEV workspace (`withWorkspaceOnly`; its wiring is `gasLawsSimulator.card.ts` +
 * `gasLawsSimulator.boss.ts`, a SAY_OR_SHOW card on the spoken preset). Every item is built and keyed by code
 * (`gasLawsWorkspace.ts`); the particle cylinder shows the gas BEFORE the change and runs the change only once the
 * answer is credited, so no readout, plot or piston position states the answer first. A tap commits through
 * `progress.commitCheck` with its named miss, a spoken answer is judged by the tutor, and the levers are one lever set
 * (`gasLawsLevers.ts`) published with the scene. No Next: the runtime moves the item.
 */
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../../../evaluation';
import type { GasLawsSimulatorMetrics } from '../../../evaluation/types';
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
  askOf, choicesOf, describeGasWork, directionOf, gasCorrect, gasMiss, heldVars, keyChoice, NAME, showValue,
  stateAfter, workspaceScene, type Apparatus, type GasItem, type GasLawFocus, type GasMode,
  type GasState, type GasTier, type GasVar,
} from './gasLawsWorkspace';
import {
  factorLines, FACTOR_LEVER, GAS_LEVER_CONTEXT, GAS_LEVERS, heldLines, HELD_LEVER, kelvinLines, KELVIN_LEVER, particleLines,
  PARTICLE_LEVER, relationLines, RELATION_LEVER,
} from './gasLawsLevers';
import { gasLawsSimulatorBoss } from './gasLawsSimulator.boss';

// ============================================================================
// Data Types (single source of truth; the generator imports them)
// ============================================================================

export type { GasItem, GasLawFocus, GasMode, GasTier };

export interface GasLawsSimulatorData {
  title: string;
  description?: string;
  /** Which law the lesson is about (the model's reading of the topic); code picks the containers from it. */
  lawFocus?: GasLawFocus;
  /** The gas in every container ("air", "helium"). */
  gas?: string;
  /** The eval modes this session asks, in order (`resolveGasModes`). */
  challengeTypes?: GasMode[];
  /** config.difficulty: the structural band the items were built at. */
  difficulty?: GasTier;
  /** The items, built and keyed by code at generation; absent or invalid: rebuilt from the fields above. */
  items?: GasItem[];
  gradeBand?: '8' | '9-10' | '11-12';
  /** Legacy generations: read only for the law focus and the modes. */
  scenario?: { lawFocus?: string };
  challenges?: Array<{ type?: string }>;
  supportTier?: string;

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<GasLawsSimulatorMetrics>) => void;
}

interface GasLawsSimulatorProps {
  data: GasLawsSimulatorData;
  className?: string;
  /** Carried onto the runtime mount so the live host keeps its resolved plan metadata. */
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted rather than rebuilt from the item. */
  runtimeEvalMode?: string;
}

const MODE_LABEL: Record<GasMode, string> = { observe: 'Predict the direction', predict: 'Predict the value', calculate: 'Two changes at once' };

// ============================================================================
// The particle container (canvas). Draws the state it is given; the surface gives it the state before the change
// until the answer is credited.
// ============================================================================

const SIM_W = 220;
const SIM_H = 280;

interface Particle { x: number; y: number; vx: number; vy: number }

const GasContainer = ({ apparatus, state, scale }: { apparatus: Apparatus; state: GasState; scale: GasState }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const frame = useRef(0);
  // Rigid tank: the walls never move. Otherwise the piston height follows the volume, scaled to the item's largest.
  const top = apparatus === 'tank' ? 40 : SIM_H - 20 - (state.V / (scale.V * 1.15)) * (SIM_H - 70);
  const speed = 0.6 + 1.6 * Math.sqrt(state.T / 300);
  const count = Math.round(Math.min(90, 24 * state.n));

  useEffect(() => {
    const cur = particles.current;
    if (cur.length < count) {
      for (let i = cur.length; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        cur.push({ x: 24 + Math.random() * (SIM_W - 48), y: top + 10 + Math.random() * Math.max(20, SIM_H - top - 40), vx: Math.cos(a) * speed, vy: Math.sin(a) * speed });
      }
    } else particles.current = cur.slice(0, count);
  }, [count, top, speed]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext?.('2d');
    if (!ctx) return;
    const draw = () => {
      ctx.clearRect(0, 0, SIM_W, SIM_H);
      if (apparatus === 'syringe') { ctx.fillStyle = 'rgba(56, 189, 248, 0.10)'; ctx.fillRect(0, SIM_H * 0.35, SIM_W, SIM_H * 0.65); }
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.7)';
      ctx.lineWidth = apparatus === 'tank' ? 5 : 2;
      ctx.beginPath(); ctx.moveTo(14, 20); ctx.lineTo(14, SIM_H - 14); ctx.lineTo(SIM_W - 14, SIM_H - 14); ctx.lineTo(SIM_W - 14, 20); ctx.stroke();
      if (apparatus === 'tank') {
        ctx.fillStyle = 'rgba(100, 116, 139, 0.95)'; ctx.fillRect(12, top - 10, SIM_W - 24, 10);
        ctx.beginPath(); ctx.arc(SIM_W / 2, top - 22, 11, 0, Math.PI * 2); ctx.fillStyle = 'rgba(30, 41, 59, 1)'; ctx.fill();
        ctx.strokeStyle = 'rgba(203, 213, 225, 0.8)'; ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(71, 85, 105, 0.95)'; ctx.fillRect(16, top - 10, SIM_W - 32, 10);
        ctx.fillStyle = 'rgba(100, 116, 139, 0.8)'; ctx.fillRect(SIM_W / 2 - 5, Math.max(0, top - 40), 10, 30);
        if (apparatus === 'piston') { ctx.fillStyle = 'rgba(148, 163, 184, 0.9)'; ctx.fillRect(SIM_W / 2 - 22, Math.max(0, top - 54), 44, 16); }
        if (apparatus === 'syringe') { ctx.fillRect(SIM_W / 2 - 26, Math.max(0, top - 46), 52, 6); }
      }
      for (const p of particles.current) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 20) { p.x = 20; p.vx = Math.abs(p.vx); }
        if (p.x > SIM_W - 20) { p.x = SIM_W - 20; p.vx = -Math.abs(p.vx); }
        if (p.y > SIM_H - 20) { p.y = SIM_H - 20; p.vy = -Math.abs(p.vy); }
        if (p.y < top + 5) { p.y = top + 5; p.vy = Math.abs(p.vy); }
        const sp = Math.hypot(p.vx, p.vy);
        if (sp > 0) { p.vx *= speed / sp; p.vy *= speed / sp; }
        ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fillStyle = 'rgba(96, 165, 250, 0.85)'; ctx.fill();
      }
      frame.current = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame.current);
  }, [apparatus, top, speed]);

  return <canvas ref={canvasRef} width={SIM_W} height={SIM_H} className="rounded-lg border border-white/10 bg-slate-900/70"
    style={{ width: SIM_W, height: SIM_H }} aria-label="The container of gas" />;
};

// ============================================================================
// Component
// ============================================================================

const ROWS: GasVar[] = ['P', 'V', 'T'];

const useGasProgress = useWorkspaceProgressFor('gas-laws-simulator');

const GasLawsSimulatorSurface = ({ data, className, runtimePlanItemId }: GasLawsSimulatorProps) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const { title, instanceId, skillId, subskillId, objectiveId, exhibitId, onEvaluationSubmit } = data;

  const items = useMemo(() => [...gasLawsSimulatorBoss.items(data)],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.items, data.challengeTypes, data.difficulty, data.lawFocus, data.gas, data.title]);
  const stableInstanceId = useRef(instanceId || `gas-laws-simulator-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceId.current;

  // ── Progress: the runtime moves the index (callbacks bound below) ──
  const openItem = useRef<(index: number, retry: boolean) => void>(() => {});
  const solvedAloud = useRef<(index: number) => void>(() => {});
  /** Bound below; an answer the observer credited on the simplify lever's practice item. */
  const practiceAloud = useRef<(source: 'speech' | 'gesture') => void>(() => {});
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const progress = useGasProgress({
    challenges: items,
    getChallengeId: i => i.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: gasLawsSimulatorBoss.assignment,
    onItemOpened: (index, retry) => openItem.current(index, retry),
    onSolved: index => solvedAloud.current(index),
    onPracticeSolved: (_id, source) => practiceAloud.current(source),
    onFinished: result => finish.current(result),
  });
  const { currentIndex, currentAttempts, results, isComplete } = progress;
  /** A checked answer stays closed until Try again or Next challenge on the shell. */
  const learnerBlocked = () => progress.canAttempt === false;

  const sessionItem: GasItem | undefined = items[Math.min(currentIndex, Math.max(items.length - 1, 0))];
  const [practice, setPractice] = useState<GasItem | null>(null);
  const item = practice ?? sessionItem;

  const [choice, setChoice] = useState<string | null>(null);
  /** The wrong choice just checked, shown until Try again. */
  const [wrongPick, setWrongPick] = useState<string | null>(null);
  const [practiceSolved, setPracticeSolved] = useState(false);
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [submitted, setSubmitted] = useState(false);
  const tappedCorrect = useRef<string | null>(null);

  const pulled = sessionItem && leverState.item === sessionItem.id && !practice ? leverState.pulled : [];
  const leverOn = (id: string) => pulled.includes(id);
  const revealed = practice ? practiceSolved : !!item && results.some(r => r.challengeId === item.id && r.correct);

  const { submitResult, hasSubmitted } = usePrimitiveEvaluation<GasLawsSimulatorMetrics>({
    primitiveType: 'gas-laws-simulator',
    instanceId: resolvedInstanceId,
    skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const clearItem = () => { setChoice(null); setWrongPick(null); setPracticeSolved(false); };

  // A fresh item (or the full item back after practice) opens blank; Try again clears the choice.
  openItem.current = (_index, retry) => {
    if (!retry) setPractice(null);
    clearItem();
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

  // ── Handlers ──
  const pick = (c: string) => {
    if (!item || revealed || wrongPick !== null || learnerBlocked()) return;
    SoundManager.select();
    setChoice(c);
  };

  const check = () => {
    if (!item || choice === null || revealed || wrongPick !== null || learnerBlocked()) return;
    const correct = gasCorrect(item, choice);
    progress.commitCheck(describeGasWork(item, { choice }), correct, correct ? undefined : gasMiss(item, choice));
    if (correct) {
      SoundManager.playCorrect();
      if (practice) setPracticeSolved(true); else tappedCorrect.current = item.id;
      return;
    }
    SoundManager.playIncorrect();
    // The tutor and the runtime take it from here: the wrong choice stays marked until Try again.
    setWrongPick(choice);
  };

  const metrics = (): GasLawsSimulatorMetrics => {
    const right = (modes: GasMode[]) => items.filter(i => modes.includes(i.mode) && results.some(r => r.challengeId === i.id && r.correct)).length;
    const total = (modes: GasMode[]) => items.filter(i => modes.includes(i.mode)).length;
    return {
      type: 'gas-laws-simulator',
      challengesCorrect: right(['observe', 'predict', 'calculate']), challengesTotal: items.length,
      directionalPredictionCorrect: right(['observe']), directionalPredictionTotal: total(['observe']),
      calculationWithinTolerance: right(['predict', 'calculate']), calculationTotal: total(['predict', 'calculate']),
      attemptsCount: currentAttempts,
    };
  };

  // Under a lesson's evaluation provider only: the scored session.
  finish.current = (result) => {
    if (hasSubmitted || progress.recordsEvaluation === false || !items.length) return;
    setSubmitted(true);
    submitResult(result.passed, result.accuracy, { ...metrics(), attemptsCount: result.teachingAttempts.length },
      { challengeResults: result.outcomes, learningResponses: result.learningResponses,
        teachingAttempts: result.teachingAttempts, assistanceProvenance: result.assistanceProvenance },
      undefined, result.diagnosisEvidence);
  };

  // ── What the tutor and the observer are shown, republished every render. A practice item offers no lever. ──
  useLayoutEffect(() => {
    if (!item || !sessionItem || isComplete) return;
    const scene = workspaceScene(item, { choice: wrongPick ?? choice, solved: revealed });
    const ctx = GAS_LEVER_CONTEXT;
    const levers = practice ? [] : GAS_LEVERS.declare(sessionItem, ctx, pulled);
    const published = leverScene(scene, { support: practice ? '' : GAS_LEVERS.support(sessionItem, ctx),
      onScreen: practice ? '' : GAS_LEVERS.onScreen(sessionItem, ctx, pulled) });
    workspace.current = {
      ...published,
      facts: { ...published.facts, ...(practice ? { practice: 'A simpler item of the same kind, before the full item comes back.' } : {}) },
      levers,
      // A synchronous commit (the workspace runs it inside flushSync): the screen changes before this returns.
      pullLever: (id) => {
        const l = levers.find(x => x.id === id);
        if (practice || !l) return `No lever ${id} on this item.`;
        if (l.pulled) return `${id} is already on screen.`;
        const nextState = { item: sessionItem.id, pulled: [...pulled, id] };
        if (l.kind === 'simplify') {
          const simpler = GAS_LEVERS.simpler(sessionItem, ctx, id);
          if (!simpler) return 'There is no simpler item here; try a help lever.';
          setLeverState(nextState); clearItem(); setPractice(simpler);
          return { practice: gasLawsSimulatorBoss.assignment(simpler) };
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
        <LuminaCardContent><p className="text-sm text-slate-400">This lab has no questions to ask.</p></LuminaCardContent>
      </LuminaCard>
    );
  }

  const key = item ? keyChoice(item) : '';
  const choiceState = (c: string): AnswerChoiceState => revealed ? (c === key ? 'correct' : c === choice ? 'incorrect' : 'dimmed')
    : wrongPick === c ? 'incorrect' : choice === c ? 'selected' : 'idle';
  const closed = revealed || wrongPick !== null || learnerBlocked();

  const after = item ? stateAfter(item) : null;
  const scale: GasState | null = item && after
    ? { P: Math.max(item.before.P, after.P), V: Math.max(item.before.V, after.V), T: Math.max(item.before.T, after.T), n: Math.max(item.before.n, after.n) }
    : null;
  const held = item ? heldVars(item) : [];
  const rows: GasVar[] = item && item.changes.some(c => c.v === 'n') ? [...ROWS, 'n'] : ROWS;
  const afterCell = (v: GasVar): string => {
    if (!item || !after) return '';
    const changed = item.changes.find(c => c.v === v);
    if (changed) return showValue(item, v, changed.to);
    if (v === item.asked) return revealed ? showValue(item, v, after[v]) : '?';
    if (held.includes(v)) return item.heldNamed ? 'held' : '';
    return '';
  };
  const beforeCell = (v: GasVar) => (item ? (v === 'n' ? 'the gas it holds' : showValue(item, v, item.before[v])) : '');
  const afterN = (v: GasVar) => (v === 'n' && item ? item.changes.find(c => c.v === 'n') : undefined);

  const revealText = () => {
    if (!item || !after) return '';
    const from = showValue(item, item.asked, item.before[item.asked]), to = showValue(item, item.asked, after[item.asked]);
    const moved = item.mode === 'observe' ? `The ${NAME[item.asked]} ${directionOf(item).toLowerCase()}` : `The ${NAME[item.asked]} is now ${to}`;
    const story = item.mode === 'observe' ? particleLines(item)[0] : relationLines(item)[0];
    return `${moved}${from !== to ? ` (${from} before)` : ''}. ${story}`;
  };

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
          <LuminaFeedbackCard status="insight" label="Lab complete">
            {`${results.filter(r => r.correct).length} of ${items.length} items answered.`}
          </LuminaFeedbackCard>
        ) : item && after && scale && (
          <>
            <LuminaPrompt accent="cyan" {...(practice ? { 'data-practice': 'simpler' } : {})}>{askOf(item)}</LuminaPrompt>

            {/* Pip comes from the workspace runner (`pip/WorkspacePip.tsx`): the dock above, the lab and the choices as its region. */}
            <PipDock />
            <PipWorkspace className="space-y-4">
              <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-[auto_1fr]">
                <div className="flex flex-col items-center gap-2">
                  {/* Before the answer is credited the container shows the gas BEFORE the change. */}
                  <GasContainer key={item.id} apparatus={item.apparatus} state={revealed ? after : item.before} scale={scale} />
                  {leverOn(HELD_LEVER) && (
                    <LuminaPanel accent="cyan" data-lever="held-label" className="max-w-[240px] space-y-1 text-xs text-slate-300">
                      {heldLines(item).map(l => <p key={l}>{l}</p>)}
                    </LuminaPanel>
                  )}
                </div>
                <div className="space-y-3">
                  <LuminaPanel>
                    <table className="w-full text-sm" aria-label="Before and after">
                      <thead>
                        <tr className="text-left text-xs text-slate-400"><th className="py-1" /> <th className="py-1">Before</th><th className="py-1">After</th></tr>
                      </thead>
                      <tbody>
                        {rows.map(v => (
                          <tr key={v} className={v === item.asked ? 'text-cyan-200' : 'text-slate-200'}>
                            <td className="py-1 pr-2 capitalize text-slate-400">{NAME[v]}</td>
                            <td className="py-1 font-mono">{beforeCell(v)}</td>
                            <td className="py-1 font-mono">{afterN(v) ? factorLines(item).find(l => l.startsWith('Amount')) ?? '' : afterCell(v)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </LuminaPanel>
                  {leverOn(PARTICLE_LEVER) && (
                    <LuminaPanel accent="cyan" data-lever="particle-card" className="space-y-1 text-sm text-slate-300">
                      {particleLines(item).map(l => <p key={l}>{l}</p>)}
                    </LuminaPanel>
                  )}
                  {leverOn(KELVIN_LEVER) && (
                    <LuminaPanel accent="cyan" data-lever="kelvin-scale" className="space-y-1 font-mono text-sm text-slate-300">
                      {kelvinLines(item).map(l => <p key={l}>{l}</p>)}
                    </LuminaPanel>
                  )}
                  {leverOn(RELATION_LEVER) && (
                    <LuminaPanel accent="cyan" data-lever="relation-card" className="text-sm text-slate-300">
                      {relationLines(item).map(l => <p key={l}>{l}</p>)}
                    </LuminaPanel>
                  )}
                  {leverOn(FACTOR_LEVER) && (
                    <LuminaPanel accent="cyan" data-lever="factor-line" className="space-y-1 text-sm text-slate-300">
                      {factorLines(item).map(l => <p key={l}>{l}</p>)}
                    </LuminaPanel>
                  )}
                </div>
              </div>

              <div className={`grid gap-2 ${choicesOf(item).length > 3 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                {choicesOf(item).map(c => (
                  <LuminaAnswerChoice key={c} aria-label={c} state={choiceState(c)} disabled={closed}
                    className="p-3 text-center font-semibold" onClick={() => pick(c)}>
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
              <LuminaFeedbackCard status="correct">
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

const GasLawsSimulator = withWorkspaceOnly<GasLawsSimulatorProps>('gas-laws-simulator', GasLawsSimulatorSurface, props => props.data.title);

export default GasLawsSimulator;
