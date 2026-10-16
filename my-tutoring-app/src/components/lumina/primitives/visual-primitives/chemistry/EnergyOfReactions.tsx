'use client';

/**
 * Energy of Reactions: why some reactions warm their surroundings and others cool them, read three ways (one eval mode each).
 * - classify: run a named reaction in a beaker of water and read the thermometer; say whether it releases or absorbs energy.
 * - diagram: read an energy diagram drawn on a kJ grid with no arrows or values: the direction, the energy change, the
 *   activation energy, or how much a catalyst lowers it.
 * - bond_energy: from a table of bonds broken and formed (count and energy per bond, no totals), choose ΔH.
 *
 * Every item is built and keyed by code (`energyOfReactionsWorkspace.ts`); nothing on screen states the answer before
 * credit (no exothermic/endothermic badge, no type colours or icons, no ΔH or Ea arrows, no bond totals, no real-world
 * line). Two paths, chosen by `withWorkspaceController`: the scripted path (tester, no tutor) has its own Next and two
 * tries before a reveal; the workspace path (W1, plain shape) commits every check through `progress.commitCheck` with a
 * named miss, takes a spoken answer judged by the tutor, and lets the runtime move on. Levers: `energyOfReactionsLevers.ts`.
 */
import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../../../evaluation';
import type { EnergyOfReactionsMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { SoundManager } from '../../../utils/SoundManager';
import { useWorkspacePipSurface } from '../../../pip/useWorkspacePipSurface';
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
import { withWorkspaceController } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useScriptedProgress, useWorkspaceProgressFor, type Progress, type ProgressOptions }
  from '../../../components/live-activity/runtime/useWorkspaceProgress';
import {
  activation, askOf, AXIS_MAX, BOND_ENERGY, bondDeltaH, deltaH, describeEnergyWork, energyCorrect, energyIn, energyItems,
  energyMiss, energyOut, equationOf, GRID, keyChoice, releases, workspaceAssignment, workspaceScene,
  type BondRow, type DiagramLevels, type EnergyBand, type EnergyItem, type EnergyMode,
} from './energyOfReactionsWorkspace';
import {
  energyLevers, FEWER_LEVER, FLOW_LEVER, HEAT_FLOW_CARD, leverFact, LINE_LEVER, MARK_LEVER, rowLine, ROWS_LEVER, SIMPLER_LEVER,
  simplerItem, totalsLines, TOTALS_LEVER, VALUES_LEVER,
} from './energyOfReactionsLevers';

// ============================================================================
// Data Types (single source of truth; the generator imports them)
// ============================================================================

/** Legacy generations carry these; the component builds its items from `reactionIds` and code tables only. */
export interface ReactionInfo {
  name: string; equation: string; type: 'exothermic' | 'endothermic'; deltaH: number; activationEnergy: number;
  realWorldExample: string; imagePrompt?: string;
}
export interface EnergyDiagram { reactantLevel: number; productLevel: number; activationPeak: number; showCatalystPath: boolean; catalystActivation: number | null }
export interface BondEntry { bond: string; energy: number; count: number }
export interface BondEnergies { enabled: boolean; bondsBreaking: BondEntry[]; bondsForming: BondEntry[] }
export interface EnergyChallenge {
  id: string; type: string; answerType: 'multiple_choice' | 'true_false'; instruction: string; options: string[];
  correctOptionIndex: number; hint: string; narration: string;
}
export interface EnergyShowOptions {
  showEnergyDiagram: boolean; showTemperatureGauge: boolean; showBondView: boolean; showRealWorldPanel: boolean;
  showCalculation: boolean; showCatalystComparison: boolean; animateReactionPath: boolean;
}

export interface EnergyOfReactionsData {
  title: string;
  description?: string;
  /** Library reactions the classify items run (`THERMO_REACTIONS` ids); absent: the library's own order. */
  reactionIds?: string[];
  /** The eval modes this session asks, in order (`resolveEnergyModes`); absent: classify and diagram, plus bond_energy at 7-8. */
  challengeTypes?: EnergyMode[];
  gradeBand?: EnergyBand;
  /** Legacy fields; never read for items or keys. */
  reaction?: ReactionInfo;
  energyDiagram?: EnergyDiagram;
  bondEnergies?: BondEnergies;
  challenges?: EnergyChallenge[];
  showOptions?: Partial<EnergyShowOptions>;

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<EnergyOfReactionsMetrics>) => void;
}

interface EnergyOfReactionsProps {
  data: EnergyOfReactionsData;
  className?: string;
  /** Carried onto the runtime mount so the live host keeps its resolved plan metadata. */
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted rather than rebuilt from the item. */
  runtimeEvalMode?: string;
}

const MODE_LABEL: Record<EnergyMode, string> = { classify: 'Thermometer evidence', diagram: 'Energy diagram', bond_energy: 'Bond energies' };

// ============================================================================
// Bespoke lab pieces
// ============================================================================

const T_MIN = -10, T_MAX = 60;

/** A beaker of water with a thermometer. One liquid colour at every temperature: the reading is the evidence. */
const ThermometerStation = ({ reading, mark }: { reading: number; mark: number | null }) => {
  const toY = (t: number) => 170 - ((t - T_MIN) / (T_MAX - T_MIN)) * 150;
  return (
    <svg viewBox="0 0 220 190" className="h-56 w-full max-w-xs" role="img" aria-label={`Thermometer reading ${reading} degrees Celsius`}>
      {/* Beaker of water */}
      <path d="M20 70 L20 175 Q20 182 28 182 L112 182 Q120 182 120 175 L120 70" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" />
      <rect x="22" y="100" width="96" height="80" rx="4" fill="rgba(96,165,250,0.18)" />
      {/* Thermometer */}
      <rect x="150" y="14" width="16" height="160" rx="8" fill="rgba(15,23,42,0.6)" stroke="rgba(255,255,255,0.3)" />
      <circle cx="158" cy="176" r="10" fill="#ef4444" />
      <rect x="154" y={toY(reading)} width="8" height={176 - toY(reading)} fill="#ef4444" style={{ transition: 'y 1.4s ease, height 1.4s ease' }} />
      {[-10, 0, 10, 20, 30, 40, 50, 60].map(t => (
        <g key={t}>
          <line x1="166" x2="172" y1={toY(t)} y2={toY(t)} stroke="rgba(255,255,255,0.5)" />
          <text x="175" y={toY(t) + 3} fontSize="9" fill="rgba(226,232,240,0.8)">{t}°</text>
        </g>
      ))}
      {mark !== null && (
        <g data-lever="start-mark">
          <line x1="140" x2="170" y1={toY(mark)} y2={toY(mark)} stroke="#facc15" strokeWidth="2" strokeDasharray="3 2" />
          <text x="100" y={toY(mark) + 3} fontSize="9" fill="#facc15">start</text>
        </g>
      )}
      {/* The bulb sits in the water */}
      <line x1="150" y1="150" x2="118" y2="150" stroke="rgba(255,255,255,0.15)" />
    </svg>
  );
};

/** An energy diagram on a kJ grid: lines labelled Reactants and Products, a hill, no arrows and no values. */
const EnergyDiagramSvg = ({ levels, showValues, startLine, reveal }:
  { levels: DiagramLevels; showValues: boolean; startLine: boolean; reveal: boolean }) => {
  const y = (e: number) => 200 - (e / AXIS_MAX) * 180;
  const { reactants: r, products: p, peak, catalyst } = levels;
  const path = (top: number) => `M 60 ${y(r)} L 110 ${y(r)} C 140 ${y(r)} 150 ${y(top)} 170 ${y(top)} C 190 ${y(top)} 200 ${y(p)} 230 ${y(p)} L 290 ${y(p)}`;
  const ticks = Array.from({ length: AXIS_MAX / GRID + 1 }, (_, i) => i * GRID);
  return (
    <svg viewBox="0 0 320 225" className="w-full" role="img" aria-label="Energy diagram">
      {ticks.map(t => (
        <g key={t}>
          <line x1="48" x2="305" y1={y(t)} y2={y(t)} stroke={t % 100 === 0 ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.07)'} />
          <text x="44" y={y(t) + 3} fontSize="8" textAnchor="end" fill="rgba(203,213,225,0.8)">{t}</text>
        </g>
      ))}
      <text x="10" y="110" fontSize="9" fill="rgba(203,213,225,0.8)" transform="rotate(-90 10 110)" textAnchor="middle">Energy (kJ)</text>
      <text x="176" y="220" fontSize="9" fill="rgba(203,213,225,0.8)" textAnchor="middle">Reaction progress →</text>
      {startLine && <line data-lever="start-line" x1="60" x2="300" y1={y(r)} y2={y(r)} stroke="#facc15" strokeWidth="1.2" strokeDasharray="4 3" />}
      {catalyst !== undefined && <path d={path(catalyst)} fill="none" stroke="#c084fc" strokeWidth="1.6" strokeDasharray="5 3" />}
      <path d={path(peak)} fill="none" stroke="#e2e8f0" strokeWidth="2" />
      <text x="62" y={y(r) - 5} fontSize="9" fill="#e2e8f0">Reactants</text>
      <text x="236" y={y(p) - 5} fontSize="9" fill="#e2e8f0">Products</text>
      {catalyst !== undefined && <text x="240" y="16" fontSize="9" fill="#c084fc">- - with catalyst</text>}
      {showValues && (
        <g data-lever="level-values" fontSize="8" fill="#facc15">
          <text x="62" y={y(r) + 11}>{r} kJ</text>
          <text x="236" y={y(p) + 11}>{p} kJ</text>
          <text x="176" y={y(peak) - 5}>{peak} kJ</text>
          {catalyst !== undefined && <text x="176" y={y(catalyst) + 11} fill="#c084fc">{catalyst} kJ</text>}
        </g>
      )}
      {reveal && (
        <g data-reveal="arrows" fontSize="8">
          <line x1="140" x2="140" y1={y(r)} y2={y(peak)} stroke="#facc15" strokeWidth="1.2" />
          <text x="112" y={(y(r) + y(peak)) / 2} fill="#facc15">Ea {activation(levels)}</text>
          <line x1="262" x2="262" y1={y(r)} y2={y(p)} stroke="#38bdf8" strokeWidth="1.2" />
          <text x="266" y={(y(r) + y(p)) / 2} fill="#38bdf8">ΔH {deltaH(levels) > 0 ? '+' : '−'}{Math.abs(deltaH(levels))}</text>
        </g>
      )}
    </svg>
  );
};

const BondColumn = ({ title, rows, subtotals }: { title: string; rows: BondRow[]; subtotals: boolean }) => (
  <div className="space-y-1">
    <p className="text-xs font-medium text-slate-300">{title}</p>
    {rows.map(b => (
      <div key={b.bond} className="flex justify-between gap-3 font-mono text-sm text-slate-200">
        <span>{b.count} × {b.bond}</span>
        <span className="text-slate-400">{subtotals ? rowLine(b) : `${BOND_ENERGY[b.bond]} kJ each`}</span>
      </div>
    ))}
  </div>
);

// ============================================================================
// Component
// ============================================================================

const EnergyOfReactionsSurface = ({ data, className, runtimePlanItemId, tutorOwned, useController }:
  EnergyOfReactionsProps & { tutorOwned: boolean; useController: (options: ProgressOptions<EnergyItem>) => Progress }) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const { title, gradeBand = '5-6', instanceId, skillId, subskillId, objectiveId, exhibitId, onEvaluationSubmit } = data;

  const items = useMemo(() => energyItems(data), [data.reactionIds, data.challengeTypes, data.gradeBand]);
  const stableInstanceId = useRef(instanceId || `energy-of-reactions-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceId.current;

  // ── Progress: the runtime moves the index on the workspace path (callbacks bound below) ──
  const openItem = useRef<(index: number, retry: boolean) => void>(() => {});
  const solvedAloud = useRef<(index: number) => void>(() => {});
  /** Bound below; an answer the observer credited on the simplify lever's practice item. */
  const practiceAloud = useRef<(source: 'speech' | 'gesture') => void>(() => {});
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const progress = useController({
    challenges: items,
    getChallengeId: i => i.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: workspaceAssignment,
    onItemOpened: (index, retry) => openItem.current(index, retry),
    onSolved: index => solvedAloud.current(index),
    onPracticeSolved: (_id, source) => practiceAloud.current(source),
    onFinished: result => finish.current(result),
  });
  const { currentIndex, currentAttempts, results, isComplete } = progress;
  /** Workspace path: a checked answer stays closed until Try again or Next challenge on the shell. */
  const learnerBlocked = () => tutorOwned && progress.canAttempt === false;

  const sessionItem: EnergyItem | undefined = items[Math.min(currentIndex, Math.max(items.length - 1, 0))];
  const [practice, setPractice] = useState<EnergyItem | null>(null);
  const item = practice ?? sessionItem;

  const [choice, setChoice] = useState<string | null>(null);
  /** Workspace path: the wrong choice just checked, shown until Try again. */
  const [wrongPick, setWrongPick] = useState<string | null>(null);
  const [ran, setRan] = useState(false);
  /** Scripted path: wrong tries on the current item, and whether its answer has been shown after two. */
  const [scriptedWrongs, setScriptedWrongs] = useState(0);
  const [scriptedReveal, setScriptedReveal] = useState(false);
  const [practiceSolved, setPracticeSolved] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [submitted, setSubmitted] = useState(false);
  /** The item a correct tap already recorded, so its `onSolved` records nothing twice. */
  const tappedCorrect = useRef<string | null>(null);

  const pulled = sessionItem && leverState.item === sessionItem.id && !practice ? leverState.pulled : [];
  const leverOn = (id: string) => pulled.includes(id);
  const solvedNow = practice ? practiceSolved : !!item && results.some(r => r.challengeId === item.id && r.correct);
  const revealed = solvedNow || scriptedReveal;

  const { submitResult, hasSubmitted } = usePrimitiveEvaluation<EnergyOfReactionsMetrics>({
    primitiveType: 'energy-of-reactions',
    instanceId: resolvedInstanceId,
    skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // ── Scripted tutor only: its context carries no key; the workspace tutor reads the scene instead ──
  const aiPrimitiveData = useMemo(() => ({
    gradeBand, mode: item?.mode ?? 'classify', itemIndex: currentIndex + 1, totalItems: items.length,
    ask: item ? askOf(item) : title, attemptNumber: currentAttempts + 1,
  }), [gradeBand, item, currentIndex, items.length, title, currentAttempts]);
  const { sendText, isAudioPlaying, activePrimitiveId } = useLuminaAI({
    primitiveType: 'energy-of-reactions', instanceId: resolvedInstanceId, primitiveData: aiPrimitiveData,
    gradeLevel: gradeBand === '5-6' ? 'Grade 5-6' : 'Grade 7-8', enabled: !tutorOwned,
  });
  const say = (text: string) => { if (!tutorOwned) sendText(text, { silent: true }); };

  const clearItem = (keepRun: boolean) => {
    setChoice(null); setWrongPick(null); setFeedback(null);
    setScriptedWrongs(0); setScriptedReveal(false); setPracticeSolved(false);
    if (!keepRun) setRan(false);
  };

  // Workspace path: a fresh item (or the full item back after practice) opens blank; Try again keeps the run.
  openItem.current = (_index, retry) => {
    if (retry) { setChoice(null); setWrongPick(null); setFeedback(null); setPracticeSolved(false); return; }
    setPractice(null); clearItem(false);
  };

  solvedAloud.current = (index) => {
    const solved = items[index];
    if (!solved || tappedCorrect.current === solved.id || results.some(r => r.challengeId === solved.id && r.correct)) return;
    progress.mergeResult({ challengeId: solved.id, correct: true, attempts: currentAttempts + 1 });
    setChoice(keyChoice(solved)); setWrongPick(null);
    if (solved.mode === 'classify') setRan(true);
  };

  // A spoken answer credited on the practice item: shown there as on a session item, recorded nowhere. The full item
  // comes back blank when the practice closes. A tap shows its own credit in the check.
  practiceAloud.current = (source) => {
    if (source !== 'speech' || !practice) return;
    setPracticeSolved(true);
    setChoice(keyChoice(practice)); setWrongPick(null);
    if (practice.mode === 'classify') setRan(true);
  };

  // ── Handlers ──
  const pick = (c: string) => {
    if (!item || revealed || wrongPick !== null || learnerBlocked()) return;
    SoundManager.select();
    setChoice(c); setFeedback(null);
  };

  const run = () => {
    if (!item || item.mode !== 'classify' || ran || learnerBlocked()) return;
    SoundManager.select();
    setRan(true);
  };

  const check = () => {
    if (!item || choice === null || revealed || wrongPick !== null || learnerBlocked()) return;
    const correct = energyCorrect(item, choice);
    progress.commitCheck(describeEnergyWork(item, { choice }), correct, correct ? undefined : energyMiss(item, choice));
    if (correct) {
      SoundManager.playCorrect();
      if (practice) setPracticeSolved(true); else tappedCorrect.current = item.id;
      if (item.mode === 'classify') setRan(true);
      say(`[ANSWER_CORRECT] The learner chose "${choice}" for: ${askOf(item)} Praise briefly.`);
      return;
    }
    SoundManager.playIncorrect();
    if (tutorOwned) { setWrongPick(choice); return; }
    const wrongs = scriptedWrongs + 1;
    setScriptedWrongs(wrongs);
    if (wrongs >= 2) {
      setScriptedReveal(true);
      if (!practice) progress.recordResult({ challengeId: item.id, correct: false, attempts: currentAttempts + 1 });
      say(`[ANSWER_REVEALED] Two tries missed on: ${askOf(item)} The answer is now on screen ("${keyChoice(item)}"); explain it plainly.`);
      return;
    }
    setChoice(null);
    setFeedback('Not quite. Look again and try once more.');
    say(`[ANSWER_INCORRECT] The learner chose "${choice}" for: ${askOf(item)} It is wrong. You are not told the answer: point them `
      + 'at what the screen shows (the thermometer, the levels on the grid, the bond table) without naming a choice.');
  };

  const metrics = (): EnergyOfReactionsMetrics => {
    const credited = (i: EnergyItem) => results.some(r => r.challengeId === i.id && r.correct);
    const right = (mode: EnergyMode) => items.filter(i => i.mode === mode && credited(i)).length;
    const total = (mode: EnergyMode) => items.filter(i => i.mode === mode).length;
    const kindDone = (kind: string) => items.some(i => i.mode === 'diagram' && i.kind === kind && credited(i));
    return {
      type: 'energy-of-reactions',
      classificationCorrect: right('classify'), classificationTotal: total('classify'),
      diagramReadCorrect: right('diagram'), diagramTotal: total('diagram'),
      activationEnergyUnderstood: kindDone('activation'), catalystEffectExplained: kindDone('catalyst'),
      bondEnergyCalculationCorrect: right('bond_energy'), calculationTotal: total('bond_energy'),
      realWorldConnectionMade: false,
      attemptsCount: currentAttempts,
    };
  };

  /** Scripted path: Next, and on the last item the session report. */
  const next = () => {
    if (progress.advance()) { clearItem(false); say(`[NEXT_ITEM] Item ${currentIndex + 2} of ${items.length}: ${askOf(items[currentIndex + 1])}`); return; }
    if (hasSubmitted || submitted || progress.recordsEvaluation === false) return;
    const score = items.length ? Math.round((results.filter(r => r.correct).length / items.length) * 100) : 0;
    setSubmitted(true);
    submitResult(score >= 50, score, metrics(), { challengeResults: results });
    say(`[ALL_COMPLETE] The learner finished all ${items.length} items. Celebrate briefly.`);
  };

  // Workspace path, under a lesson's evaluation provider only: the scored session.
  finish.current = (result) => {
    if (hasSubmitted || progress.recordsEvaluation === false || !items.length) return;
    setSubmitted(true);
    submitResult(result.passed, result.accuracy, { ...metrics(), attemptsCount: result.teachingAttempts.length },
      { challengeResults: result.outcomes, learningResponses: result.learningResponses,
        teachingAttempts: result.teachingAttempts, assistanceProvenance: result.assistanceProvenance },
      undefined, result.diagnosisEvidence);
  };

  // ── Workspace path: what the tutor and the observer are shown, republished every render ──
  useLayoutEffect(() => {
    if (!tutorOwned || !item || isComplete) return;
    const scene = workspaceScene(item, { choice: wrongPick ?? choice, ran, solved: revealed });
    const levers = practice ? [] : energyLevers(sessionItem, pulled);
    const onScreen = practice ? '' : leverFact(sessionItem, pulled, ran);
    workspace.current = {
      ...scene,
      facts: { ...scene.facts, ...(practice ? { practice: 'A simpler practice item, before the full item comes back.' } : {}),
        ...(onScreen ? { onScreen } : {}) },
      levers,
      // A synchronous commit (the workspace runs it inside flushSync): the screen changes before this returns.
      pullLever: (id) => {
        const l = levers.find(x => x.id === id);
        if (practice || !l || !sessionItem) return `No lever ${id} on this item.`;
        if (l.pulled) return `${id} is already on screen.`;
        if (id === MARK_LEVER && !ran) return 'The reaction has not run yet: the marker shows the start beside the reading after the run. Ask the learner to press Run the reaction first.';
        const next = { item: sessionItem.id, pulled: [...pulled, id] };
        if (l.kind === 'simplify') {
          const simpler = simplerItem(sessionItem);
          if (!simpler) return 'There is no simpler item to practise on here; try a help lever.';
          setLeverState(next); clearItem(false); setPractice(simpler);
          return { practice: workspaceAssignment(simpler) };
        }
        setLeverState(next);
        return true;
      },
      endPractice: () => { clearItem(false); setPractice(null); },
    };
  });

  // ── Pip shared surface: the item's check state, the tutor's speech on it, and the child's touches ──
  // The scripted path ends on Finish (its last credit still shows Next); the workspace path when the runtime completes.
  const done = hasSubmitted || submitted || (tutorOwned && isComplete);
  const pip = useWorkspacePipSurface({
    instanceId: resolvedInstanceId,
    scopeId: done || !item ? null : item.id,
    label: 'The energy lab and your answer',
    solved: revealed,
    tutorSpeaking: isAudioPlaying && activePrimitiveId === resolvedInstanceId,
  });

  if (!items.length) {
    return (
      <LuminaCard className={className}>
        <LuminaCardHeader><LuminaCardTitle>{title}</LuminaCardTitle></LuminaCardHeader>
        <LuminaCardContent><p className="text-sm text-slate-400">This lab has no reactions to run.</p></LuminaCardContent>
      </LuminaCard>
    );
  }

  const key = item ? keyChoice(item) : '';
  const choiceState = (c: string): AnswerChoiceState => revealed ? (c === key ? 'correct' : c === choice ? 'incorrect' : 'dimmed')
    : wrongPick === c ? 'incorrect' : choice === c ? 'selected' : 'idle';
  const closed = revealed || wrongPick !== null || learnerBlocked();

  const renderStation = () => {
    if (!item) return null;
    if (item.mode === 'classify') {
      const r = item.reaction;
      const reading = ran ? r.end : r.start;
      return (
        <LuminaPanel className="flex flex-col items-center gap-3">
          <p className="text-center font-mono text-sm text-slate-200">{equationOf(item)}</p>
          <ThermometerStation reading={reading} mark={ran && leverOn(MARK_LEVER) ? r.start : null} />
          <p className="text-sm text-slate-300" data-reading>
            {ran ? `Thermometer now: ${r.end} °C` : `Thermometer: ${r.start} °C`}
            {ran && leverOn(MARK_LEVER) && <span className="text-amber-300">{` (it started at ${r.start} °C)`}</span>}
          </p>
          <LuminaButton onClick={run} disabled={ran || learnerBlocked()}>Run the reaction</LuminaButton>
        </LuminaPanel>
      );
    }
    if (item.mode === 'diagram') {
      return (
        <LuminaPanel>
          <EnergyDiagramSvg levels={item.levels} showValues={leverOn(VALUES_LEVER) || revealed} startLine={leverOn(LINE_LEVER)} reveal={revealed} />
        </LuminaPanel>
      );
    }
    const r = item.reaction;
    return (
      <LuminaPanel className="space-y-3">
        <p className="text-center font-mono text-lg text-slate-100">{r.equation}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <BondColumn title="Bonds broken" rows={r.broken} subtotals={leverOn(ROWS_LEVER) || revealed} />
          <BondColumn title="Bonds formed" rows={r.formed} subtotals={leverOn(ROWS_LEVER) || revealed} />
        </div>
      </LuminaPanel>
    );
  };

  const renderLevers = () => (
    <>
      {leverOn(FLOW_LEVER) && (
        <LuminaPanel accent="cyan" data-lever="heat-flow" className="space-y-1 text-sm text-slate-300">
          {HEAT_FLOW_CARD.map(line => <p key={line}>{line}</p>)}
        </LuminaPanel>
      )}
      {leverOn(TOTALS_LEVER) && item && !revealed && (
        <LuminaPanel accent="cyan" data-lever="in-out-totals" className="space-y-1 font-mono text-sm text-slate-300">
          {totalsLines(item).map(line => <p key={line}>{line}</p>)}
        </LuminaPanel>
      )}
    </>
  );

  const revealText = () => {
    if (!item) return '';
    if (item.mode === 'classify') {
      const r = item.reaction;
      return `The water went from ${r.start} °C to ${r.end} °C. ${releases(r)
        ? 'Energy moved out of the reaction into the water, so it releases energy: exothermic.'
        : 'Energy moved out of the water into the reaction, so it absorbs energy: endothermic.'} ${r.fact}`;
    }
    if (item.mode === 'diagram') {
      const l = item.levels, dh = deltaH(l);
      const base = `Reactants ${l.reactants} kJ, products ${l.products} kJ, top of the hill ${l.peak} kJ.`;
      if (item.kind === 'direction') return `${base} The products sit ${dh < 0 ? 'lower' : 'higher'} than the reactants, so it ${dh < 0 ? 'releases' : 'absorbs'} energy.`;
      if (item.kind === 'catalyst') return `${base} The catalyst path tops out at ${l.catalyst} kJ instead of ${l.peak} kJ: ${key} lower. The energy change is the same.`;
      if (item.kind === 'activation') return `${base} The climb from the reactants to the top is ${l.peak} − ${l.reactants} = ${activation(l)} kJ.`;
      return `${base} From reactants to products is ${l.products} − ${l.reactants} = ${dh > 0 ? '+' : '−'}${Math.abs(dh)} kJ.`;
    }
    const r = item.reaction, dh = bondDeltaH(r);
    return `Energy in to break bonds: ${energyIn(r)} kJ. Energy out from forming bonds: ${energyOut(r)} kJ. ΔH = ${energyIn(r)} − ${energyOut(r)} = ${key}, `
      + `so it ${dh < 0 ? 'releases energy (exothermic)' : 'absorbs energy (endothermic)'}.`;
  };

  const practiceMark = practice ? { 'data-practice': practice.mode === 'bond_energy' ? SIMPLER_LEVER : FEWER_LEVER } : {};

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader>
        <LuminaCardTitle>{title}</LuminaCardTitle>
        {!done && item && (
          <LuminaSectionLabel accent="purple" size="sm">
            {practice ? 'A simpler item first' : `${MODE_LABEL[item.mode]} · item ${Math.min(currentIndex, items.length - 1) + 1} of ${items.length}`}
          </LuminaSectionLabel>
        )}
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {done ? (
          <LuminaFeedbackCard status="insight" label="Lab complete">
            {`${results.filter(r => r.correct).length} of ${items.length} items answered.`}
          </LuminaFeedbackCard>
        ) : item && (
          <>
            <LuminaPrompt accent="purple" {...practiceMark}>{askOf(item)}</LuminaPrompt>

            {pip.store && <div {...pip.dock} />}
            <div {...pip.workspace} className="space-y-4">
              {renderStation()}
              {renderLevers()}

              <div className={`grid gap-2 ${item.choices.length > 2 ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'}`}>
                {item.choices.map(c => (
                  <LuminaAnswerChoice key={c} aria-label={c} state={choiceState(c)} disabled={closed}
                    className="p-3 text-center font-semibold" onClick={() => pick(c)}>
                    {c}
                  </LuminaAnswerChoice>
                ))}
              </div>
            </div>

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
            {!revealed && feedback && <LuminaFeedbackCard status="incorrect">{feedback}</LuminaFeedbackCard>}

            {!tutorOwned && revealed && !practice && (
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
const EnergyOfReactions = withWorkspaceController<EnergyOfReactionsProps, ProgressOptions<EnergyItem>, Progress>(
  'energy-of-reactions', EnergyOfReactionsSurface, useScriptedProgress, useWorkspaceProgressFor('energy-of-reactions'));

export default EnergyOfReactions;
