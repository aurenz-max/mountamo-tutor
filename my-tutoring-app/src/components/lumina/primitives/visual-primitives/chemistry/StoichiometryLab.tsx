'use client';

/**
 * Stoichiometry Lab: one balanced reaction, three task identities (one eval mode each).
 * - convert: build the chain of conversion-factor cards that turns a given mass into the asked amount.
 * - limiting: two reactant jars; say which runs out first, or that both run out together.
 * - yield: two reactant jars; how many grams of a product can form.
 *
 * Every item is built and keyed by code from the reaction (`stoichiometryLabWorkspace.ts`); molar masses come from the
 * formulas. Nothing on screen computes the answer before credit: no mole counts, no running units, no "run the
 * reaction" panel, and the jars are the same size whatever they hold. Taught only on the shared tutor/JEV workspace
 * (`withWorkspaceOnly`; its wiring is `stoichiometryLab.card.ts` + `stoichiometryLab.boss.ts`, the spoken preset: a
 * conversion-chain board and two SAY_OR_SHOW modes). Every check commits through `progress.commitCheck` with a named
 * miss, a spoken answer on limiting and yield is judged by the tutor, and the levers are one lever set
 * (`stoichiometryLabLevers.ts`) published with the scene. No Next: the runtime moves the item.
 */
import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../../../evaluation';
import type { StoichiometryLabMetrics } from '../../../evaluation/types';
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
  LuminaInput,
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
  askOf, BOTH, cardLabel, convertKey, convertValue, describeStoichWork, factorOf, fmt, limitingOf, NO_WORK, parseGrams,
  runningUnits, stoichCorrect, stoichMiss, subOf, workspaceScene, yieldOf,
  type Amount, type Qty, type Rx, type StoichItem, type StoichMode, type StoichTier, type StoichWork,
} from './stoichiometryLabWorkspace';
import {
  MAP_LEVER, mapStations, moleLine, MOLES_LEVER, RECIPE_LEVER, revealLine, STOICH_LEVERS, UNITS_LEVER,
} from './stoichiometryLabLevers';
import { stoichiometryLabBoss } from './stoichiometryLab.boss';

// ============================================================================
// Data Types (single source of truth; the generator imports them)
// ============================================================================

export interface StoichSubstance {
  formula: string;
  /** Recomputed from the formula wherever code can read it. */
  molarMass: number;
  coefficient: number;
  name?: string;
}

export interface StoichReaction {
  /** The library reaction's id (`REACTIONS`), when the generator picked one. */
  id?: string;
  equation: string;
  reactants: StoichSubstance[];
  products: StoichSubstance[];
}

export type StoichChallengeType = StoichMode;

/** One item as the generator writes it. Keys are never stored: code computes them from these givens. */
export interface StoichChallenge {
  id: string;
  type: StoichChallengeType;
  /** The structure the item was built at (`buildConvert`, `buildPair`). */
  tier?: StoichTier;
  givenFormulaA: string;
  givenMassA: number;
  givenFormulaB?: string | null;
  givenMassB?: number | null;
  /** convert: the goal substance; yield: the product. */
  answerFormula?: string | null;
  answerUnit?: 'g' | 'mol' | null;
  /** convert: the factor cards on the tray, in order. */
  tray?: string[];
  /** Legacy generations carry these; none is read (every key is recomputed, and the old text named the strategy). */
  instruction?: string;
  hint?: string;
  narration?: string;
  askFor?: string;
  targetAnswer?: number;
  tolerance?: number;
  targetAnswerFormula?: string | null;
  actualYield?: number | null;
}

/** Legacy panel toggles; the rebuilt lab has no pre-computed panels, so none is read. */
export interface StoichShowOptions {
  showMoleLadder: boolean;
  showLeftovers: boolean;
  showRatioStrip: boolean;
  showPercentYield: boolean;
  showReactionOutput: boolean;
}

export interface StoichiometryLabData {
  title: string;
  description?: string;
  reaction: StoichReaction;
  challenges: StoichChallenge[];
  /** The eval modes this session asks, in order (`resolveStoichModes`). */
  challengeTypes?: StoichMode[];
  showOptions?: Partial<StoichShowOptions>;
  gradeBand?: '8' | '9-10' | '11-12';
  /** The structure tier the items were built at (`config.difficulty`). */
  supportTier?: StoichTier;

  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<StoichiometryLabMetrics>) => void;
}

interface StoichiometryLabProps {
  data: StoichiometryLabData;
  className?: string;
  /** Carried onto the runtime mount so the live host keeps its resolved plan metadata. */
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted rather than rebuilt from the item. */
  runtimeEvalMode?: string;
}

const MODE_LABEL: Record<StoichMode, string> = { convert: 'Conversion chain', limiting: 'Which runs out first', yield: 'How much forms' };

// ============================================================================
// Bespoke lab pieces
// ============================================================================

/** A formula with its digits as subscripts. */
const Formula = ({ f }: { f: string }) => (
  <span className="font-mono">
    {Array.from(f).map((ch, i) => (/\d/.test(ch) && i > 0 && /[a-zA-Z)]/.test(f[i - 1])
      ? <sub key={i} className="text-[0.75em]">{ch}</sub> : <span key={i}>{ch}</span>))}
  </span>
);

const QtyText = ({ q }: { q: Qty }) => <span>{fmt(q.n)} {q.unit} <Formula f={q.formula} /></span>;

const EquationStrip = ({ rx }: { rx: Rx }) => {
  const side = (s: 'reactant' | 'product') => rx.subs.filter(x => x.side === s);
  const term = (x: Rx['subs'][number]) => (
    <div key={x.formula} className="flex flex-col items-center">
      <span className="text-lg text-slate-100">{x.c > 1 ? x.c : ''}<Formula f={x.formula} /></span>
      <span className="text-[10px] text-slate-500">{fmt(x.M)} g/mol</span>
    </div>
  );
  const join = (xs: Rx['subs']) => xs.flatMap((x, i) => [...(i ? [<span key={`p${i}`} className="text-slate-500">+</span>] : []), term(x)]);
  return (
    <LuminaPanel className="flex flex-wrap items-center justify-center gap-3">
      {join(side('reactant'))}
      <span className="mx-1 text-2xl text-slate-300">→</span>
      {join(side('product'))}
    </LuminaPanel>
  );
};

/** A reactant jar. Every jar is drawn the same size: its fill never shows how much it holds. */
const Jar = ({ rx, amount, note }: { rx: Rx; amount: Amount; note?: string }) => (
  <div className="flex flex-col items-center gap-1">
    <div className="relative h-24 w-20 overflow-hidden rounded-b-2xl rounded-t-md border-2 border-white/20 bg-slate-800/30">
      <div className="absolute bottom-0 left-0 right-0 h-[60%] bg-cyan-400/20" />
    </div>
    <span className="text-sm font-semibold text-slate-100">{fmt(amount.grams)} g <Formula f={amount.formula} /></span>
    <span className="text-[10px] text-slate-400">{subOf(rx, amount.formula)?.name}</span>
    {note && <span className="text-xs text-cyan-300" data-lever="mole-count">{note}</span>}
  </div>
);

/** A conversion factor drawn as a fraction. */
const FactorFace = ({ rx, id }: { rx: Rx; id: string }) => {
  const f = factorOf(rx, id);
  if (!f) return null;
  return (
    <span className="flex flex-col items-center text-xs leading-tight">
      <span><QtyText q={f.top} /></span>
      <span className="my-0.5 h-px w-full bg-slate-400/60" />
      <span><QtyText q={f.bottom} /></span>
    </span>
  );
};

/** One run of the reaction: a dot per mole of each coefficient. */
const RecipeCard = ({ rx }: { rx: Rx }) => {
  const group = (s: 'reactant' | 'product') => rx.subs.filter(x => x.side === s).map(x => (
    <div key={x.formula} className="flex flex-col items-center gap-1">
      <div className="flex max-w-24 flex-wrap justify-center gap-1">
        {Array.from({ length: x.c }).map((_, i) => <span key={i} className="inline-block h-3 w-3 rounded-full bg-amber-300/80" />)}
      </div>
      <span className="text-xs text-slate-300">{x.c} mol <Formula f={x.formula} /></span>
    </div>
  ));
  return (
    <LuminaPanel accent="cyan" data-lever="recipe-card" className="space-y-2">
      <p className="text-center text-xs text-slate-400">One run of the reaction</p>
      <div className="flex flex-wrap items-end justify-center gap-4">
        {group('reactant')}<span className="text-slate-400">→</span>{group('product')}
      </div>
    </LuminaPanel>
  );
};

// ============================================================================
// Component
// ============================================================================

const useStoichProgress = useWorkspaceProgressFor('stoichiometry-lab');

const StoichiometryLabSurface = ({ data, className, runtimePlanItemId }: StoichiometryLabProps) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const { title, instanceId, skillId, subskillId, objectiveId, exhibitId, onEvaluationSubmit } = data;

  const items = useMemo(() => [...stoichiometryLabBoss.items(data)],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.reaction, data.challenges, data.challengeTypes, data.gradeBand, data.supportTier, data.title]);
  const stableInstanceId = useRef(instanceId || `stoichiometry-lab-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceId.current;

  // ── Progress: the runtime moves the index (callbacks bound below) ──
  const openItem = useRef<(index: number, retry: boolean) => void>(() => {});
  const solvedAloud = useRef<(index: number) => void>(() => {});
  /** Bound below; an answer the observer credited on the simplify lever's practice item. */
  const practiceAloud = useRef<(source: 'speech' | 'gesture') => void>(() => {});
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const progress = useStoichProgress({
    challenges: items,
    getChallengeId: i => i.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: stoichiometryLabBoss.assignment,
    onItemOpened: (index, retry) => openItem.current(index, retry),
    onSolved: index => solvedAloud.current(index),
    onPracticeSolved: (_id, source) => practiceAloud.current(source),
    onFinished: result => finish.current(result),
  });
  const { currentIndex, currentAttempts, results, isComplete } = progress;
  /** A checked answer stays closed until Try again or Next challenge on the shell. */
  const learnerBlocked = () => progress.canAttempt === false;

  const sessionItem: StoichItem | undefined = items[Math.min(currentIndex, Math.max(items.length - 1, 0))];
  const [practice, setPractice] = useState<StoichItem | null>(null);
  const item = practice ?? sessionItem;

  const [work, setWork] = useState<StoichWork>(NO_WORK);
  /** The wrong answer just checked stays on screen, marked, until Try again. */
  const [wrongShown, setWrongShown] = useState(false);
  const [practiceSolved, setPracticeSolved] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [submitted, setSubmitted] = useState(false);
  /** The item a correct check already recorded, so its `onSolved` records nothing twice. */
  const checkedCorrect = useRef<string | null>(null);

  const pulled = sessionItem && leverState.item === sessionItem.id && !practice ? leverState.pulled : [];
  const leverOn = (id: string) => pulled.includes(id);
  const revealed = practice ? practiceSolved : !!item && results.some(r => r.challengeId === item.id && r.correct);

  const { submitResult, hasSubmitted } = usePrimitiveEvaluation<StoichiometryLabMetrics>({
    primitiveType: 'stoichiometry-lab',
    instanceId: resolvedInstanceId,
    skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const clearItem = () => { setWork(NO_WORK); setWrongShown(false); setFeedback(null); setPracticeSolved(false); };

  // A fresh item (or the full item back after practice) and Try again both open blank.
  openItem.current = (_index, retry) => {
    if (retry) { setWork(NO_WORK); setWrongShown(false); setFeedback(null); setPracticeSolved(false); return; }
    setPractice(null); clearItem();
  };

  solvedAloud.current = (index) => {
    const solved = items[index];
    if (!solved || checkedCorrect.current === solved.id || results.some(r => r.challengeId === solved.id && r.correct)) return;
    progress.mergeResult({ challengeId: solved.id, correct: true, attempts: currentAttempts + 1 });
    setWrongShown(false);
    if (solved.mode === 'limiting') setWork({ ...NO_WORK, choice: limitingOf(solved.rx, solved.a, solved.b) });
    if (solved.mode === 'yield') setWork({ ...NO_WORK, typed: fmt(yieldOf(solved)) });
  };

  // A spoken answer credited on the practice item: shown there as on a session item, recorded nowhere. The full item
  // comes back blank when the practice closes. A tap shows its own credit in the check.
  practiceAloud.current = (source) => {
    if (source !== 'speech' || !practice) return;
    setPracticeSolved(true);
    setWrongShown(false);
    if (practice.mode === 'limiting') setWork({ ...NO_WORK, choice: limitingOf(practice.rx, practice.a, practice.b) });
    if (practice.mode === 'yield') setWork({ ...NO_WORK, typed: fmt(yieldOf(practice)) });
  };

  // ── Handlers ──
  const closed = revealed || wrongShown || learnerBlocked();
  const edit = (next: StoichWork) => { if (!item || closed) return; setWork(next); setFeedback(null); };
  const place = (id: string) => { if (work.chain.length >= 4 || work.chain.includes(id)) return; SoundManager.select(); edit({ ...work, chain: [...work.chain, id] }); };
  const takeBack = (at: number) => { SoundManager.select(); edit({ ...work, chain: work.chain.filter((_, i) => i !== at) }); };
  const choose = (c: string) => { SoundManager.select(); edit({ ...work, choice: c }); };

  const ready = !!item && (item.mode === 'convert' ? work.chain.length > 0 : item.mode === 'limiting' ? work.choice !== null : work.typed.trim() !== '');

  const check = () => {
    if (!item || !ready || closed) return;
    if (item.mode === 'yield' && parseGrams(work.typed) === null) { setFeedback('Type a number of grams.'); return; }
    const correct = stoichCorrect(item, work);
    progress.commitCheck(describeStoichWork(item, work), correct, correct ? undefined : stoichMiss(item, work));
    if (correct) {
      SoundManager.playCorrect();
      if (practice) setPracticeSolved(true); else checkedCorrect.current = item.id;
      return;
    }
    SoundManager.playIncorrect();
    // The tutor and the runtime take it from here: the wrong answer stays marked until Try again.
    setWrongShown(true);
  };

  const metrics = (): StoichiometryLabMetrics => {
    const right = (mode: StoichMode) => items.filter(i => i.mode === mode && results.some(r => r.challengeId === i.id && r.correct)).length;
    const total = (mode: StoichMode) => items.filter(i => i.mode === mode).length;
    return {
      type: 'stoichiometry-lab',
      challengesCorrect: results.filter(r => r.correct).length, challengesTotal: items.length,
      convertCorrect: right('convert'), convertTotal: total('convert'),
      limitingReagentCorrect: right('limiting'), limitingReagentTotal: total('limiting'),
      yieldWithinTolerance: right('yield'), yieldTotal: total('yield'),
      attemptsCount: results.reduce((s, r) => s + r.attempts, 0),
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
    const scene = workspaceScene(item, work);
    const ctx = { items };
    const levers = practice ? [] : STOICH_LEVERS.declare(sessionItem, ctx, pulled);
    const published = leverScene(scene, { support: practice ? '' : STOICH_LEVERS.support(sessionItem, ctx),
      onScreen: practice ? '' : STOICH_LEVERS.onScreen(sessionItem, ctx, pulled) });
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
          const simpler = STOICH_LEVERS.simpler(sessionItem, ctx, id);
          if (!simpler) return 'There is no simpler item to practise on here; try a help lever.';
          setLeverState(nextState); clearItem(); setPractice(simpler);
          return { practice: stoichiometryLabBoss.assignment(simpler) };
        }
        setLeverState(nextState);
        return true;
      },
      endPractice: () => { clearItem(); setPractice(null); },
    };
  });

  // The lesson ends when the runtime completes it, not at the last credit (its worked result stays up).
  const done = hasSubmitted || submitted || !!progress.practiceSummary;

  if (!items.length || !item) {
    return (
      <LuminaCard className={className}>
        <LuminaCardHeader><LuminaCardTitle>{title}</LuminaCardTitle></LuminaCardHeader>
        <LuminaCardContent><p className="text-sm text-slate-400">This lab has no reaction to work with.</p></LuminaCardContent>
      </LuminaCard>
    );
  }

  const rx = item.rx;

  const renderConvert = () => {
    if (item.mode !== 'convert') return null;
    const units = leverOn(UNITS_LEVER) ? runningUnits(item, work.chain) : [];
    const shownChain = revealed ? convertKey(item) : work.chain;
    return (
      <div className="space-y-3">
        {leverOn(MAP_LEVER) && (
          <LuminaPanel accent="cyan" data-lever="mole-map" className="flex flex-wrap items-center justify-center gap-2 text-xs">
            {mapStations(item).map((s, i) => (
              <React.Fragment key={s.label}>
                {i > 0 && <span className="text-slate-500">→</span>}
                <span className={`rounded-full border px-3 py-1 ${s.mark ? 'border-cyan-400/50 text-cyan-200' : 'border-white/10 text-slate-300'}`}>
                  {s.label}{s.mark ? ` (${s.mark})` : ''}
                </span>
              </React.Fragment>
            ))}
          </LuminaPanel>
        )}
        <LuminaPanel className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg border border-white/15 bg-slate-900/50 px-3 py-2 text-sm font-semibold text-slate-100">
            {fmt(item.given.grams)} g <Formula f={item.given.formula} />
          </span>
          {shownChain.map((id, i) => (
            <div key={`${id}-${i}`} className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-1">
                <span className="text-slate-500">×</span>
                <button type="button" aria-label={`Take back ${cardLabel(item, id)}`} disabled={closed}
                  onClick={() => takeBack(i)}
                  className={`rounded-lg border px-2 py-1 text-slate-100 ${wrongShown ? 'border-red-400/50 bg-red-500/10' : 'border-white/20 bg-white/5 hover:bg-white/10'}`}>
                  <FactorFace rx={rx} id={id} />
                </button>
              </div>
              {units[i] && (
                <span className="text-[10px] text-cyan-300" data-lever="unit-track">
                  {units[i].after ? `→ ${units[i].after!.unit} ${units[i].after!.formula}` : 'does not cancel'}
                </span>
              )}
            </div>
          ))}
          <span className="text-slate-500">=</span>
          <span className="rounded-lg border border-dashed border-white/25 px-3 py-2 text-sm text-slate-200">
            {revealed ? fmt(convertValue(item)) : '?'} {item.target.unit} <Formula f={item.target.formula} />
          </span>
        </LuminaPanel>
        {!revealed && (
          <div>
            <p className="mb-2 text-xs text-slate-400">Conversion factors: tap one to add it to the chain.</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {item.tray.map(id => (
                <button key={id} type="button" aria-label={cardLabel(item, id)} disabled={closed || work.chain.includes(id) || work.chain.length >= 4}
                  onClick={() => place(id)}
                  className="flex justify-center rounded-lg border border-white/15 bg-slate-800/40 px-2 py-2 text-slate-100 transition-colors hover:bg-white/10 disabled:opacity-30">
                  <FactorFace rx={rx} id={id} />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderPair = () => {
    if (item.mode === 'convert') return null;
    const note = (a: Amount) => (leverOn(MOLES_LEVER) ? `= ${moleLine(rx, a).split(' = ')[1]}` : undefined);
    return (
      <div className="space-y-3">
        <LuminaPanel className="flex flex-wrap items-end justify-center gap-8">
          <Jar rx={rx} amount={item.a} note={note(item.a)} />
          <Jar rx={rx} amount={item.b} note={note(item.b)} />
        </LuminaPanel>
        {leverOn(RECIPE_LEVER) && <RecipeCard rx={rx} />}
        {item.mode === 'limiting' ? (
          <div className="grid grid-cols-3 gap-2">
            {item.choices.map(c => {
              const key = limitingOf(rx, item.a, item.b);
              const state: AnswerChoiceState = revealed ? (c === key ? 'correct' : c === work.choice ? 'incorrect' : 'dimmed')
                : wrongShown && c === work.choice ? 'incorrect' : work.choice === c ? 'selected' : 'idle';
              return (
                <LuminaAnswerChoice key={c} aria-label={c} state={state} disabled={closed} className="p-3 text-center font-semibold" onClick={() => choose(c)}>
                  {c === BOTH ? 'Both run out together' : <span><Formula f={c} /> runs out first</span>}
                </LuminaAnswerChoice>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2">
            <LuminaInput type="number" inputMode="decimal" aria-label={`Grams of ${item.product}`} value={work.typed} disabled={closed}
              onChange={e => edit({ ...work, typed: e.target.value })} className={`w-32 ${wrongShown ? 'border-red-400' : ''}`} />
            <span className="text-sm text-slate-300">g of <Formula f={item.product} /></span>
          </div>
        )}
      </div>
    );
  };

  const revealText = () => {
    if (item.mode === 'convert') {
      const steps = runningUnits(item, convertKey(item)).map(u => `${fmt(u.after!.n)} ${u.after!.unit} ${u.after!.formula}`);
      return `${fmt(item.given.grams)} g ${item.given.formula} = ${steps.join(' = ')}.`;
    }
    return revealLine(item);
  };

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader>
        <LuminaCardTitle>{title}</LuminaCardTitle>
        {!done && (
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
        ) : (
          <>
            <LuminaPrompt accent="purple" {...(practice ? { 'data-practice': 'easier-item' } : {})}>{askOf(item)}</LuminaPrompt>
            <EquationStrip rx={rx} />

            {/* Pip comes from the workspace runner (`pip/WorkspacePip.tsx`): the dock above, the lab and the answer as its region. */}
            <PipDock />
            <PipWorkspace className="space-y-4">
              {renderConvert()}
              {renderPair()}
            </PipWorkspace>

            {!revealed && (
              <div className="flex justify-center">
                <LuminaActionButton action="check" disabled={!ready || closed} onClick={check}>
                  {item.mode === 'convert' ? 'Check chain' : 'Check Answer'}
                </LuminaActionButton>
              </div>
            )}

            {revealed && (
              <LuminaFeedbackCard status="correct">
                {revealText()}
              </LuminaFeedbackCard>
            )}
            {!revealed && wrongShown && <LuminaFeedbackCard status="incorrect">Not quite.</LuminaFeedbackCard>}
            {!revealed && feedback && <LuminaFeedbackCard status="incorrect">{feedback}</LuminaFeedbackCard>}

          </>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

const StoichiometryLab = withWorkspaceOnly<StoichiometryLabProps>('stoichiometry-lab', StoichiometryLabSurface, props => props.data.title);

export default StoichiometryLab;
