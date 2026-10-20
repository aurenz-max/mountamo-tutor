'use client';

/**
 * Equation Balancer: conservation of atoms in real reactions, three tasks (one eval mode each).
 * - simple: the equation is printed with its numbers in front; how many atoms of one element are on one side?
 * - guided: set the number in front of each formula so every element matches (each element in one compound per side).
 * - complex: the same, where an element sits in two compounds on one side, so fixing one element moves another.
 *
 * Taught only on the shared tutor/JEV workspace (`withWorkspaceOnly`; its wiring is `equationBalancer.card.ts` +
 * `equationBalancer.boss.ts`, the spoken preset: a SAY_OR_SHOW count mode and two balance boards). Every equation comes
 * from the code bank and every key is solved by code (`equationBalancerWorkspace.ts`). Nothing on screen counts atoms or
 * marks a match before a check: no live atom counter, no tipping scale, no "Balanced!" badge. Every check commits
 * through `progress.commitCheck` with a named miss, a spoken count is judged by the tutor, and the levers are one lever
 * set (`equationBalancerLevers.ts`) published with the scene. No Next: the runtime moves the item.
 */
import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../../../evaluation';
import type { EquationBalancerMetrics } from '../../../evaluation/types';
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
import { CPK_COLORS } from './constants';
import {
  addLabel, askOf, balanceCorrect, balanceMiss, compounds, countCorrect, countKey, countMiss, describeBalancerWork,
  elementName, MAX_COEFFICIENT, removeLabel, workspaceScene,
  type BalancerItem, type BalancerMode, type Compound, type CountItem, type LessonEquation,
} from './equationBalancerWorkspace';
import { BALANCER_LEVERS, MOLECULES_LEVER, tallyRows, TALLY_LEVER } from './equationBalancerLevers';
import { equationBalancerBoss } from './equationBalancer.boss';

// ============================================================================
// Data Types (single source of truth; the generator imports them)
// ============================================================================

/** Legacy shapes: older generations carried per-challenge formulas; their formulas are read, their keys are not. */
export interface CompoundEntry { formula: string; coefficient: number; atoms: Record<string, number> }
export interface EquationData { reactants: CompoundEntry[]; products: CompoundEntry[]; arrow: '→' | '⇌' }
export interface EquationSolution { coefficients: number[] }
export interface EquationChallenge {
  id: string;
  type?: string;
  instruction?: string;
  equation?: string;
  equationData?: EquationData;
  solutionData?: EquationSolution;
}

export interface EquationBalancerData {
  title: string;
  description?: string;
  /** The lesson's equations: bank ids (or formulas) with a real-world line each, shown only after credit. */
  equations?: LessonEquation[];
  /** The eval modes this session asks, in order (`resolveBalancerModes`). */
  challengeTypes?: BalancerMode[];
  gradeBand?: '6-7' | '7-8';
  /** Legacy content only. */
  equation?: EquationData;
  solution?: EquationSolution;
  challenges?: EquationChallenge[];

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<EquationBalancerMetrics>) => void;
}

interface EquationBalancerProps {
  data: EquationBalancerData;
  className?: string;
  /** Carried onto the runtime mount so the live host keeps its resolved plan metadata. */
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted rather than rebuilt from the item. */
  runtimeEvalMode?: string;
}

const MODE_LABEL: Record<BalancerMode, string> = { simple: 'Count the atoms', guided: 'Balance', complex: 'Balance: shared element' };

// ============================================================================
// Bespoke pieces
// ============================================================================

/** A formula with its digits as subscripts. */
const Formula = ({ formula }: { formula: string }) => (
  <span className="font-mono">
    {Array.from(formula).map((ch, i) => (/\d/.test(ch) && i > 0 && /[A-Za-z)]|\d/.test(formula[i - 1])
      ? <sub key={i} className="text-[0.7em]">{ch}</sub> : <span key={i}>{ch}</span>))}
  </span>
);

/** One cluster per copy, each atom a lettered ball (the molecule_view lever). No totals. */
const Molecules = ({ compound, copies }: { compound: Compound; copies: number }) => (
  <div className="flex max-w-[11rem] flex-wrap justify-center gap-1" data-lever="molecule-view">
    {Array.from({ length: copies }).map((_, m) => (
      <div key={m} className="flex flex-wrap items-center gap-0.5 rounded-full border border-white/5 bg-slate-800/40 px-1.5 py-0.5">
        {Object.entries(compound.atoms).flatMap(([el, n]) => Array.from({ length: n }).map((__, a) => (
          <span key={`${el}-${a}`} className="flex h-4 w-4 items-center justify-center rounded-full border text-[7px] font-bold text-white/90"
            style={{ backgroundColor: `${CPK_COLORS[el] ?? '#94a3b8'}60`, borderColor: `${CPK_COLORS[el] ?? '#94a3b8'}90` }}>{el}</span>
        )))}
      </div>
    ))}
  </div>
);

/** How a count is built, said after credit: "2 Fe2O3: 2 × 3 = 6 oxygen atoms." */
function countWorking(item: CountItem): string {
  const side = item.side === 'left' ? item.equation.reactants : item.equation.products;
  const ks = item.side === 'left' ? item.coefficients.slice(0, item.equation.reactants.length) : item.coefficients.slice(item.equation.reactants.length);
  const parts = side.map((c, i) => ({ c, k: ks[i] })).filter(x => x.c.atoms[item.element])
    .map(x => `${x.k} ${x.c.formula}: ${x.k} × ${x.c.atoms[item.element]} = ${x.k * x.c.atoms[item.element]}`);
  return `${parts.join('; ')}. ${parts.length > 1 ? 'Together, ' : ''}${countKey(item)} ${elementName(item.element)} atoms.`;
}

// ============================================================================
// Component
// ============================================================================

const useBalancerProgress = useWorkspaceProgressFor('equation-balancer');

const EquationBalancerSurface = ({ data, className, runtimePlanItemId }: EquationBalancerProps) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const { title, instanceId, skillId, subskillId, objectiveId, exhibitId, onEvaluationSubmit } = data;

  const items = useMemo(() => [...equationBalancerBoss.items(data)], [data.equations, data.challenges, data.challengeTypes, data.gradeBand]);
  const stableInstanceId = useRef(instanceId || `equation-balancer-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceId.current;

  // ── Progress: the runtime moves the index (callbacks bound below) ──
  const openItem = useRef<(index: number, retry: boolean) => void>(() => {});
  const solvedAloud = useRef<(index: number) => void>(() => {});
  /** Bound below; an answer the observer credited on the simplify lever's practice item. */
  const practiceAloud = useRef<(source: 'speech' | 'gesture') => void>(() => {});
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const progress = useBalancerProgress({
    challenges: items,
    getChallengeId: i => i.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: equationBalancerBoss.assignment,
    onItemOpened: (index, retry) => openItem.current(index, retry),
    onSolved: index => solvedAloud.current(index),
    onPracticeSolved: (_id, source) => practiceAloud.current(source),
    onFinished: result => finish.current(result),
  });
  const { currentIndex, currentAttempts, results, isComplete } = progress;
  /** A checked answer stays closed until Try again or Next challenge on the shell. */
  const learnerBlocked = () => progress.canAttempt === false;

  const sessionItem: BalancerItem | undefined = items[Math.min(currentIndex, Math.max(items.length - 1, 0))];
  const [practice, setPractice] = useState<BalancerItem | null>(null);
  const item = practice ?? sessionItem;

  const ones = (it: BalancerItem | undefined) => (it ? compounds(it.equation).map(() => 1) : []);
  const [choice, setChoice] = useState<string | null>(null);
  /** The wrong count just checked, shown until Try again. */
  const [wrongPick, setWrongPick] = useState<string | null>(null);
  const [coefficients, setCoefficients] = useState<{ item: string; ks: number[] }>({ item: '', ks: [] });
  /** The wrong balance just checked, with its miss, shown until Try again. */
  const [checkedWrong, setCheckedWrong] = useState<string | null>(null);
  const [practiceSolved, setPracticeSolved] = useState(false);
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [submitted, setSubmitted] = useState(false);
  const [missesSeen, setMissesSeen] = useState<string[]>([]);
  const [leversUsed, setLeversUsed] = useState(false);
  /** The item a correct tap already recorded, so its `onSolved` records nothing twice. */
  const tappedCorrect = useRef<string | null>(null);

  const ks = item && coefficients.item === item.id ? coefficients.ks : ones(item);
  const pulled = sessionItem && leverState.item === sessionItem.id && !practice ? leverState.pulled : [];
  const leverOn = (id: string) => pulled.includes(id);
  const revealed = practice ? practiceSolved : !!item && results.some(r => r.challengeId === item.id && r.correct);
  /** On screen once credited: the key's numbers on a balance item. */
  const shownKs = item && item.mode !== 'simple' && revealed ? item.key : ks;

  const { submitResult, hasSubmitted } = usePrimitiveEvaluation<EquationBalancerMetrics>({
    primitiveType: 'equation-balancer',
    instanceId: resolvedInstanceId,
    skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const clearItem = (keepNumbers: boolean) => {
    setChoice(null); setWrongPick(null); setCheckedWrong(null); setPracticeSolved(false);
    if (!keepNumbers) setCoefficients({ item: '', ks: [] });
  };

  // A fresh item (or the full item back after practice) opens at all ones; Try again keeps the numbers.
  openItem.current = (_index, retry) => {
    if (retry) { setChoice(null); setWrongPick(null); setCheckedWrong(null); setPracticeSolved(false); return; }
    setPractice(null); clearItem(false);
  };

  solvedAloud.current = (index) => {
    const solved = items[index];
    if (!solved || tappedCorrect.current === solved.id || results.some(r => r.challengeId === solved.id && r.correct)) return;
    progress.mergeResult({ challengeId: solved.id, correct: true, attempts: currentAttempts + 1 });
    if (solved.mode === 'simple') { setChoice(countKey(solved)); setWrongPick(null); }
  };

  // A spoken answer credited on the practice item: shown there as on a session item, recorded nowhere. The full item
  // comes back blank when the practice closes. A tap shows its own credit in the check.
  practiceAloud.current = (source) => {
    if (source !== 'speech' || !practice) return;
    setPracticeSolved(true);
    if (practice.mode === 'simple') { setChoice(countKey(practice)); setWrongPick(null); }
  };

  // ── Handlers ──
  const closed = revealed || wrongPick !== null || checkedWrong !== null || learnerBlocked();

  const pick = (c: string) => {
    if (!item || item.mode !== 'simple' || closed) return;
    SoundManager.select();
    setChoice(c);
  };

  const step = (i: number, delta: number) => {
    if (!item || item.mode === 'simple' || closed) return;
    const next = [...ks];
    next[i] = Math.min(MAX_COEFFICIENT, Math.max(1, next[i] + delta));
    if (next[i] === ks[i]) return;
    SoundManager.select();
    setCoefficients({ item: item.id, ks: next });
  };

  const startOver = () => {
    if (!item || item.mode === 'simple' || closed) return;
    setCoefficients({ item: item.id, ks: ones(item) });
  };

  const check = () => {
    if (!item || closed) return;
    if (item.mode === 'simple' && choice === null) return;
    const correct = item.mode === 'simple' ? countCorrect(item, choice) : balanceCorrect(item, ks);
    const miss = correct ? undefined : item.mode === 'simple' ? countMiss(item, choice) : balanceMiss(item, ks);
    progress.commitCheck(describeBalancerWork(item, { choice, coefficients: ks }), correct, miss);
    if (correct) {
      SoundManager.playCorrect();
      if (practice) setPracticeSolved(true); else tappedCorrect.current = item.id;
      return;
    }
    SoundManager.playIncorrect();
    if (miss) setMissesSeen(m => [...m, miss]);
    // The tutor and the runtime take it from here: the wrong answer stays marked until Try again.
    if (item.mode === 'simple') setWrongPick(choice); else setCheckedWrong(miss ?? 'several_off');
  };

  const metrics = (): EquationBalancerMetrics => {
    const right = (pred: (i: BalancerItem) => boolean) => items.filter(i => pred(i) && results.some(r => r.challengeId === i.id && r.correct)).length;
    const balance = (i: BalancerItem) => i.mode !== 'simple', count = (i: BalancerItem) => i.mode === 'simple';
    return {
      type: 'equation-balancer',
      equationsBalanced: right(balance), equationsTotal: items.filter(balance).length,
      atomCountingCorrect: right(count), countingTotal: items.filter(count).length,
      averageAttemptsPerEquation: results.length ? results.reduce((s, r) => s + r.attempts, 0) / results.length : 0,
      usedGuidedMode: leversUsed,
      strategyUsed: leversUsed ? 'levers' : 'free',
      coefficientVsSubscriptConfusion: missesSeen.some(m => m === 'ignored_coefficient' || m === 'ignored_subscript' || m === 'added_not_multiplied'),
      conservationArticulated: right(balance) > 0,
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
    const scene = workspaceScene(item, { choice: wrongPick ?? choice, coefficients: ks });
    const ctx = { items, coefficients: ks };
    const levers = practice ? [] : BALANCER_LEVERS.declare(sessionItem, ctx, pulled);
    const published = leverScene(scene, { support: practice ? '' : BALANCER_LEVERS.support(sessionItem, ctx),
      onScreen: practice ? '' : BALANCER_LEVERS.onScreen(sessionItem, ctx, pulled) });
    const verdict = checkedWrong === 'not_lowest' ? 'Under the equation: "Every element matches, but these are not the smallest whole numbers."'
      : checkedWrong ? 'Under the equation: "Not balanced yet."' : '';
    workspace.current = {
      ...published,
      facts: { ...published.facts, ...(practice ? { practice: 'A smaller equation of the same kind, before the full item comes back.' } : {}),
        ...(verdict ? { checked: verdict } : {}) },
      levers,
      // A synchronous commit (the workspace runs it inside flushSync): the screen changes before this returns.
      pullLever: (id) => {
        const l = levers.find(x => x.id === id);
        if (practice || !l) return `No lever ${id} on this item.`;
        if (l.pulled) return `${id} is already on screen.`;
        const nextState = { item: sessionItem.id, pulled: [...pulled, id] };
        setLeversUsed(true);
        if (l.kind === 'simplify') {
          const simpler = BALANCER_LEVERS.simpler(sessionItem, ctx, id);
          if (!simpler) return 'There is no smaller equation of this kind; try a help lever.';
          setLeverState(nextState); clearItem(false); setPractice(simpler);
          return { practice: equationBalancerBoss.assignment(simpler) };
        }
        setLeverState(nextState);
        return true;
      },
      endPractice: () => { clearItem(false); setPractice(null); },
    };
  });

  const done = hasSubmitted || submitted || isComplete;

  if (!items.length) {
    return (
      <LuminaCard className={className}>
        <LuminaCardHeader><LuminaCardTitle>{title}</LuminaCardTitle></LuminaCardHeader>
        <LuminaCardContent><p className="text-sm text-slate-400">This activity has no equations to work on.</p></LuminaCardContent>
      </LuminaCard>
    );
  }

  const key = item?.mode === 'simple' ? countKey(item) : '';
  const choiceState = (c: string): AnswerChoiceState => revealed ? (c === key ? 'correct' : c === choice ? 'incorrect' : 'dimmed')
    : wrongPick === c ? 'incorrect' : choice === c ? 'selected' : 'idle';
  // A practice item has no levers; the session item's pulls stay with it.
  const showMolecules = !practice && leverOn(MOLECULES_LEVER);
  const showTally = !practice && leverOn(TALLY_LEVER) && item?.mode !== 'simple';

  const renderEquation = () => {
    if (!item) return null;
    const all = compounds(item.equation);
    const nR = item.equation.reactants.length;
    const numbers = item.mode === 'simple' ? item.coefficients : shownKs;
    return (
      <LuminaPanel className="flex flex-wrap items-start justify-center gap-3" data-equation="">
        {all.map((c, i) => (
          <React.Fragment key={`${c.formula}-${i}`}>
            {i > 0 && i !== nR && <span className="pt-2 text-xl text-slate-500">+</span>}
            {i === nR && <span className="mx-1 pt-2 text-2xl text-slate-400">{'→'}</span>}
            <div className="flex flex-col items-center gap-2" data-pip-object={`compound-${i}`}>
              <div className="flex items-center gap-1">
                {item.mode !== 'simple' && !revealed && (
                  <LuminaButton size="sm" className="h-7 w-7 p-0" aria-label={removeLabel(c.formula)}
                    disabled={closed || ks[i] <= 1} onClick={() => step(i, -1)}>{'−'}</LuminaButton>
                )}
                <span className="flex h-8 min-w-8 items-center justify-center rounded-md border border-white/10 bg-slate-800/50 px-1 text-lg font-bold text-slate-100">
                  {numbers[i]}
                </span>
                {item.mode !== 'simple' && !revealed && (
                  <LuminaButton size="sm" className="h-7 w-7 p-0" aria-label={addLabel(c.formula)}
                    disabled={closed || ks[i] >= MAX_COEFFICIENT} onClick={() => step(i, 1)}>+</LuminaButton>
                )}
              </div>
              <span className="text-lg text-slate-100"><Formula formula={c.formula} /></span>
              {showMolecules && <Molecules compound={c} copies={numbers[i]} />}
            </div>
          </React.Fragment>
        ))}
      </LuminaPanel>
    );
  };

  const renderTally = (rows: Array<{ element: string; left: number; right: number }>, lever: boolean) => (
    <LuminaPanel accent={lever ? 'cyan' : undefined} {...(lever ? { 'data-lever': 'atom-tally' } : {})}>
      <table className="w-full text-sm text-slate-300">
        <thead><tr className="text-xs text-slate-500"><th className="text-left">Element</th><th>Left side</th><th>Right side</th></tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.element} className="border-t border-white/5">
              <td className="py-1 font-mono">{r.element}</td>
              <td className="text-center font-mono">{r.left}</td>
              <td className="text-center font-mono">{r.right}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </LuminaPanel>
  );

  const revealText = () => {
    if (!item) return '';
    const line = item.equation.realWorld ?? item.equation.name;
    if (item.mode === 'simple') return `${countWorking(item)} ${line}`.trim();
    const rows = tallyRows(item, item.key).map(r => `${r.element} ${r.left} = ${r.right}`).join(', ');
    return `Every atom is accounted for: ${rows}. ${line}`.trim();
  };

  const wrongText = checkedWrong === 'not_lowest' ? 'Every element matches, but these are not the smallest whole numbers.' : 'Not balanced yet.';

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader>
        <LuminaCardTitle>{title}</LuminaCardTitle>
        {!done && item && (
          <LuminaSectionLabel accent="purple" size="sm">
            {practice ? 'A smaller equation first' : `${MODE_LABEL[item.mode]} · item ${Math.min(currentIndex, items.length - 1) + 1} of ${items.length}`}
          </LuminaSectionLabel>
        )}
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {done ? (
          <LuminaFeedbackCard status="insight" label="Activity complete">
            {`${results.filter(r => r.correct).length} of ${items.length} items answered.`}
          </LuminaFeedbackCard>
        ) : item && (
          <>
            <LuminaPrompt accent="purple" {...(practice ? { 'data-practice': 'simpler-equation' } : {})}>{askOf(item)}</LuminaPrompt>

            {/* Pip comes from the workspace runner (`pip/WorkspacePip.tsx`): the dock above, the equation and the answer as its region. */}
            <PipDock />
            <PipWorkspace className="space-y-4">
              {renderEquation()}
              {showTally && renderTally(tallyRows(item, ks), true)}

              {item.mode === 'simple' && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {item.choices.map(c => (
                    <LuminaAnswerChoice key={c} aria-label={c} state={choiceState(c)} disabled={closed}
                      className="p-3 text-center text-lg font-semibold" onClick={() => pick(c)}>
                      {c}
                    </LuminaAnswerChoice>
                  ))}
                </div>
              )}
            </PipWorkspace>

            {!revealed && (
              <div className="flex flex-wrap justify-center gap-2">
                {item.mode !== 'simple' && (
                  <LuminaButton tone="subtle" disabled={closed || ks.every(k => k === 1)} onClick={startOver}>Start over</LuminaButton>
                )}
                <LuminaActionButton action="check" disabled={closed || (item.mode === 'simple' && choice === null)} onClick={check}>
                  {item.mode === 'simple' ? 'Check Answer' : 'Check Balance'}
                </LuminaActionButton>
              </div>
            )}

            {revealed && (
              <LuminaFeedbackCard status="correct">
                {revealText()}
              </LuminaFeedbackCard>
            )}
            {!revealed && wrongPick !== null && <LuminaFeedbackCard status="incorrect">{`${wrongPick} is not it.`}</LuminaFeedbackCard>}
            {!revealed && checkedWrong !== null && <LuminaFeedbackCard status="incorrect">{wrongText}</LuminaFeedbackCard>}
          </>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

const EquationBalancer = withWorkspaceOnly<EquationBalancerProps>('equation-balancer', EquationBalancerSurface, props => props.data.title);

export default EquationBalancer;
