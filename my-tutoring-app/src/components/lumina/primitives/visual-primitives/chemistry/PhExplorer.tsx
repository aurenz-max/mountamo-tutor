'use client';

/**
 * pH Explorer: everyday and lab substances on the pH scale, read three ways (one eval mode each).
 * - test: dip a blue and a red litmus paper into a named substance and say acid, base or neutral.
 * - indicator: an unnamed sample in red cabbage juice; say which pH range its colour shows.
 * - neutralize: how many cups of a strong base, at a given pH, neutralize 1 cup of a strong acid at a given pH.
 *
 * Every item is built and keyed by code from the substances' pH values (`phExplorerWorkspace.ts`); nothing on screen
 * states the answer before credit (no pH, kind or real-world line on a test card, no scale beside the cabbage tube, no
 * meter before a mix). Two paths, chosen by `withWorkspaceController`: the scripted path (tester, no tutor) has its
 * own Next and two tries before a reveal; the workspace path (W1, plain shape) commits every check through
 * `progress.commitCheck` with a named miss, takes a spoken answer judged by the tutor, and lets the runtime move on.
 * The levers live in `phExplorerLevers.ts`.
 */
import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../../../evaluation';
import type { PhExplorerMetrics } from '../../../evaluation/types';
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
  AMOUNTS, askOf, bandOf, CABBAGE_BANDS, cupsToNeutral, describePhWork, keyChoice, kindOf, litmusAfter, mixedPH, phCorrect,
  phItems, phMiss, universalHex, workspaceAssignment, workspaceScene, PH_COLORS, type PhItem, type PhMode,
} from './phExplorerWorkspace';
import {
  chartRows, CHART_LEVER, FEWER_LEVER, fewerChoices, leverFact, LITMUS_KEY, LITMUS_LEVER, METER_LEVER, phLevers, stepLines, STEPS_LEVER,
} from './phExplorerLevers';

// ============================================================================
// Data Types (single source of truth; the generator imports them)
// ============================================================================

export interface Substance {
  id: string;
  name: string;
  pH: number;
  /** Legacy generations carry these; code recomputes the kind and every colour from `pH`. */
  type?: 'acid' | 'base' | 'neutral';
  strength?: 'strong' | 'weak';
  category?: 'food' | 'cleaning' | 'body' | 'nature' | 'lab';
  indicatorColors?: { litmus?: string; cabbageJuice?: string; universal?: string };
  /** Shown only after the substance's item is credited (it can say "acid"). */
  realWorldInfo?: string;
  imagePrompt?: string;
}

/** Legacy fields kept so old content still type-checks; the component builds its items from `substances`. */
export interface Indicator { name: 'litmus' | 'cabbage_juice' | 'universal' | 'phenolphthalein'; colorRange: Record<string, string> }
export interface NeutralizationConfig { enabled: boolean; acid: string; base: string; showpHMeter: boolean; showParticleView: boolean }
export interface PHChallenge {
  id: string;
  type: string;
  instruction: string;
  targetAnswer: string;
  hint: string;
  narration: string;
}
export interface PHShowOptions {
  showPHScale: boolean; showIndicators: boolean; showNeutralization: boolean; showParticleView: boolean;
  showRealWorldImages: boolean; showConcentration: boolean;
}

export interface PhExplorerData {
  title: string;
  description?: string;
  substances: Substance[];
  /** The eval modes this session asks, in order (`resolvePhModes`); absent: test and indicator, plus neutralize at 7-8. */
  challengeTypes?: PhMode[];
  gradeBand?: '4-6' | '7-8';
  indicators?: Indicator[];
  neutralization?: NeutralizationConfig;
  challenges?: PHChallenge[];
  showOptions?: Partial<PHShowOptions>;
  imagePrompt?: string | null;

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<PhExplorerMetrics>) => void;
}

interface PhExplorerProps {
  data: PhExplorerData;
  className?: string;
  /** Carried onto the runtime mount so the live host keeps its resolved plan metadata. */
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted rather than rebuilt from the item. */
  runtimeEvalMode?: string;
}

const MODE_LABEL: Record<PhMode, string> = { test: 'Litmus test', indicator: 'Indicator colours', neutralize: 'Neutralize' };
const KIND_WORD = { acid: 'an acid', base: 'a base', neutral: 'neutral' } as const;
const PAPER_HEX: Record<string, string> = { red: '#e53e3e', blue: '#4299e1' };

// ============================================================================
// Bespoke lab pieces
// ============================================================================

/** The pH scale with marked liquids. Never drawn beside the cabbage tube (its colours are not cabbage colours). */
const PHScaleBar = ({ marks }: { marks: Array<{ id: string; label: string; pH: number }> }) => (
  <LuminaPanel>
    <div className="mb-2 flex items-center gap-2 text-xs text-slate-400">
      <span className="font-medium text-slate-300">pH scale</span>
      <span>0 to 14</span>
    </div>
    <div className="relative h-10 overflow-hidden rounded-lg"
      style={{ background: `linear-gradient(to right, ${Object.values(PH_COLORS).join(', ')})` }}>
      {Array.from({ length: 15 }).map((_, pH) => (
        <span key={pH} className="absolute top-0.5 -translate-x-1/2 text-[9px] font-bold text-white drop-shadow"
          style={{ left: `${(pH / 14) * 100}%` }}>{pH}</span>
      ))}
      {marks.map(m => (
        <div key={m.id} className="absolute bottom-0 flex -translate-x-1/2 flex-col items-center" style={{ left: `${(m.pH / 14) * 100}%` }}>
          <div className="h-3 w-3 rounded-full border-2 border-slate-900 bg-white shadow" />
          <span className="whitespace-nowrap text-[8px] font-medium text-white drop-shadow">{m.label}</span>
        </div>
      ))}
    </div>
  </LuminaPanel>
);

const Tube = ({ hex, label, sub }: { hex: string | null; label: string; sub?: string }) => (
  <div className="flex flex-col items-center gap-1">
    <div className="relative h-28 w-12 overflow-hidden rounded-b-full border-2 border-white/20 bg-slate-800/30">
      {hex && <div className="absolute bottom-0 left-0 right-0 h-[60%] rounded-b-full transition-all duration-700" style={{ backgroundColor: `${hex}cc` }} />}
    </div>
    <span className="max-w-24 text-center text-xs font-medium text-slate-200">{label}</span>
    {sub && <span className="text-[10px] italic text-slate-500">{sub}</span>}
  </div>
);

const Paper = ({ start, now, dipped }: { start: 'blue' | 'red'; now: string; dipped: boolean }) => (
  <div className="flex flex-col items-center gap-1">
    <div className="h-20 w-6 rounded-sm border border-white/20 transition-colors duration-700"
      style={{ backgroundColor: PAPER_HEX[dipped ? now : start] }} />
    <span className="text-[10px] text-slate-400">{start === 'blue' ? 'Blue litmus' : 'Red litmus'}</span>
  </div>
);

// ============================================================================
// Component
// ============================================================================

const PhExplorerSurface = ({ data, className, runtimePlanItemId, tutorOwned, useController }:
  PhExplorerProps & { tutorOwned: boolean; useController: (options: ProgressOptions<PhItem>) => Progress }) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const { title, substances = [], gradeBand = '4-6', instanceId, skillId, subskillId, objectiveId, exhibitId, onEvaluationSubmit } = data;

  const items = useMemo(() => phItems(data), [data.substances, data.challengeTypes, data.gradeBand]);
  const stableInstanceId = useRef(instanceId || `ph-explorer-${Date.now()}`);
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

  const sessionItem: PhItem | undefined = items[Math.min(currentIndex, Math.max(items.length - 1, 0))];
  const [practice, setPractice] = useState<PhItem | null>(null);
  const item = practice ?? sessionItem;

  const [choice, setChoice] = useState<string | null>(null);
  /** Workspace path: the wrong choice just checked, shown until Try again. */
  const [wrongPick, setWrongPick] = useState<string | null>(null);
  const [dipped, setDipped] = useState(false);
  const [mixedCups, setMixedCups] = useState<number | null>(null);
  /** The last mix on this item, kept across Try again for the pH meter lever. */
  const [lastMix, setLastMix] = useState<{ item: string; cups: number } | null>(null);
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
  const meterPH = item?.mode === 'neutralize' && lastMix?.item === item.id ? mixedPH(item.acid.pH, item.base.pH, lastMix.cups) : null;

  const { submitResult, hasSubmitted } = usePrimitiveEvaluation<PhExplorerMetrics>({
    primitiveType: 'ph-explorer',
    instanceId: resolvedInstanceId,
    skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // ── Scripted tutor only: its context carries no key; the workspace tutor reads the scene instead ──
  const aiPrimitiveData = useMemo(() => ({
    gradeBand, mode: item?.mode ?? 'test', itemIndex: currentIndex + 1, totalItems: items.length,
    ask: item ? askOf(item) : title, attemptNumber: currentAttempts + 1,
  }), [gradeBand, item, currentIndex, items.length, title, currentAttempts]);
  const { sendText, isAudioPlaying, activePrimitiveId } = useLuminaAI({
    primitiveType: 'ph-explorer', instanceId: resolvedInstanceId, primitiveData: aiPrimitiveData,
    gradeLevel: gradeBand === '4-6' ? 'Grade 4-6' : 'Grade 7-8', enabled: !tutorOwned,
  });
  const say = (text: string) => { if (!tutorOwned) sendText(text, { silent: true }); };

  const clearItem = (keepDip: boolean) => {
    setChoice(null); setWrongPick(null); setMixedCups(null); setFeedback(null);
    setScriptedWrongs(0); setScriptedReveal(false); setPracticeSolved(false);
    if (!keepDip) setDipped(false);
  };

  // Workspace path: a fresh item (or the full item back after practice) opens blank; Try again keeps the dipped papers.
  openItem.current = (_index, retry) => {
    if (retry) { setChoice(null); setWrongPick(null); setMixedCups(null); setFeedback(null); setPracticeSolved(false); return; }
    setPractice(null); clearItem(false);
  };

  solvedAloud.current = (index) => {
    const solved = items[index];
    if (!solved || tappedCorrect.current === solved.id || results.some(r => r.challengeId === solved.id && r.correct)) return;
    progress.mergeResult({ challengeId: solved.id, correct: true, attempts: currentAttempts + 1 });
    setChoice(keyChoice(solved)); setWrongPick(null);
    if (solved.mode === 'neutralize') setMixedCups(cupsToNeutral(solved.acid.pH, solved.base.pH));
    if (solved.mode === 'test') setDipped(true);
  };

  // A spoken answer credited on the practice item: shown there as on a session item, recorded nowhere. The full item
  // comes back blank when the practice closes. A tap shows its own credit in the check.
  practiceAloud.current = (source) => {
    if (source !== 'speech' || !practice) return;
    setPracticeSolved(true);
    setChoice(keyChoice(practice)); setWrongPick(null);
    if (practice.mode === 'neutralize') setMixedCups(cupsToNeutral(practice.acid.pH, practice.base.pH));
    if (practice.mode === 'test') setDipped(true);
  };

  // ── Handlers ──
  const pick = (c: string) => {
    if (!item || revealed || wrongPick !== null || learnerBlocked()) return;
    SoundManager.select();
    setChoice(c); setFeedback(null);
  };

  const dip = () => {
    if (!item || item.mode !== 'test' || dipped || learnerBlocked()) return;
    SoundManager.select();
    setDipped(true);
  };

  const check = () => {
    if (!item || choice === null || revealed || wrongPick !== null || learnerBlocked()) return;
    const correct = phCorrect(item, choice);
    if (item.mode === 'neutralize') {
      const cups = AMOUNTS.find(a => a.label === choice)!.cups;
      setMixedCups(cups); setLastMix({ item: item.id, cups });
    }
    progress.commitCheck(describePhWork(item, { choice }), correct, correct ? undefined : phMiss(item, choice));
    if (correct) {
      SoundManager.playCorrect();
      if (practice) setPracticeSolved(true); else tappedCorrect.current = item.id;
      if (item.mode === 'test') setDipped(true);
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
      + 'at what the screen shows (the papers, the colour, the two pH values) without naming a choice.');
  };

  const metrics = (): PhExplorerMetrics => {
    const right = (mode: PhMode) => items.filter(i => i.mode === mode && results.some(r => r.challengeId === i.id && r.correct)).length;
    const total = (mode: PhMode) => items.filter(i => i.mode === mode).length;
    return {
      type: 'ph-explorer',
      sortingCorrect: right('test'), sortingTotal: total('test'),
      pHEstimateAccuracy: 0,
      indicatorColorInterpreted: right('indicator'), interpretationsTotal: total('indicator'),
      neutralizationCompleted: right('neutralize') > 0, neutralizationPointFound: total('neutralize') > 0 && right('neutralize') === total('neutralize'),
      rainbowCreated: false,
      substancesExplored: items.filter(i => i.mode !== 'neutralize').length,
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
    const scene = workspaceScene(item, { choice: wrongPick ?? choice, dipped, mixedCups, solved: revealed });
    const levers = practice ? [] : phLevers(sessionItem, pulled, substances, items);
    const onScreen = practice ? '' : leverFact(sessionItem, pulled, meterPH);
    workspace.current = {
      ...scene,
      facts: { ...scene.facts, ...(practice ? { practice: 'A simpler item with three choices, before the full item comes back.' } : {}),
        ...(onScreen ? { onScreen } : {}) },
      levers,
      // A synchronous commit (the workspace runs it inside flushSync): the screen changes before this returns.
      pullLever: (id) => {
        const l = levers.find(x => x.id === id);
        if (practice || !l || !sessionItem) return `No lever ${id} on this item.`;
        if (l.pulled) return `${id} is already on screen.`;
        if (id === METER_LEVER && meterPH === null) return 'No mix yet: the meter reads the last mix. Ask the learner to choose an amount and mix first.';
        const next = { item: sessionItem.id, pulled: [...pulled, id] };
        if (l.kind === 'simplify') {
          const simpler = fewerChoices(sessionItem, substances, items);
          if (!simpler) return 'There is no other item to practise on here; try a help lever.';
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
    label: 'The pH lab and your answer',
    solved: revealed,
    tutorSpeaking: isAudioPlaying && activePrimitiveId === resolvedInstanceId,
  });

  if (!items.length) {
    return (
      <LuminaCard className={className}>
        <LuminaCardHeader><LuminaCardTitle>{title}</LuminaCardTitle></LuminaCardHeader>
        <LuminaCardContent><p className="text-sm text-slate-400">This lab has no substances to test.</p></LuminaCardContent>
      </LuminaCard>
    );
  }

  const key = item ? keyChoice(item) : '';
  const choiceState = (c: string): AnswerChoiceState => revealed ? (c === key ? 'correct' : c === choice ? 'incorrect' : 'dimmed')
    : wrongPick === c ? 'incorrect' : choice === c ? 'selected' : 'idle';
  const closed = revealed || wrongPick !== null || learnerBlocked();

  // The scale's marks: credited test substances (and this one once credited); both liquids on a neutralize item.
  const credited = items.filter(i => i.mode === 'test' && results.some(r => r.challengeId === i.id && r.correct));
  const marks = item?.mode === 'neutralize'
    ? [{ id: 'acid', label: `acid ${item.acid.pH}`, pH: item.acid.pH }, { id: 'base', label: `base ${item.base.pH}`, pH: item.base.pH },
      ...(revealed && mixedCups !== null ? [{ id: 'mix', label: 'mix', pH: mixedPH(item.acid.pH, item.base.pH, mixedCups) }] : [])]
    : credited.map(i => ({ id: i.id, label: i.mode === 'test' ? i.substance.name : '', pH: i.mode === 'test' ? i.substance.pH : 7 }));

  const renderStation = () => {
    if (!item) return null;
    if (item.mode === 'test') {
      const after = litmusAfter(kindOf(item.substance.pH));
      return (
        <LuminaPanel className="flex flex-wrap items-end justify-center gap-6">
          <Tube hex="#94a3b8" label={item.substance.name} />
          <Paper start="blue" now={after.bluePaper} dipped={dipped} />
          <Paper start="red" now={after.redPaper} dipped={dipped} />
          <LuminaButton onClick={dip} disabled={dipped || learnerBlocked()}>Dip the litmus papers</LuminaButton>
        </LuminaPanel>
      );
    }
    if (item.mode === 'indicator') {
      return (
        <LuminaPanel className="flex justify-center">
          <Tube hex={CABBAGE_BANDS[bandOf(item.substance.pH)].hex} label={item.sample} sub="in red cabbage juice" />
        </LuminaPanel>
      );
    }
    const beakerPH = mixedCups === null ? item.acid.pH : mixedPH(item.acid.pH, item.base.pH, mixedCups);
    return (
      <LuminaPanel className="flex flex-wrap items-end justify-center gap-6">
        <Tube hex={universalHex(beakerPH)} label={`1 cup of ${item.acid.name}`} sub={mixedCups === null ? `pH ${item.acid.pH}, with universal indicator` : 'after mixing'} />
        <Tube hex="#cbd5e1" label={item.base.name} sub={`pH ${item.base.pH}`} />
        {(revealed || leverOn(METER_LEVER)) && meterPH !== null && (
          <div className="rounded-lg border border-white/10 bg-slate-900/60 px-4 py-2 font-mono text-lg font-bold text-slate-100" data-lever="ph-meter">
            pH {(revealed && mixedCups !== null ? mixedPH(item.acid.pH, item.base.pH, mixedCups) : meterPH).toFixed(1)}
          </div>
        )}
      </LuminaPanel>
    );
  };

  const renderLevers = () => (
    <>
      {leverOn(LITMUS_LEVER) && (
        <LuminaPanel accent="cyan" data-lever="litmus-key" className="space-y-1 text-sm text-slate-300">
          {LITMUS_KEY.map(line => <p key={line}>{line}</p>)}
        </LuminaPanel>
      )}
      {leverOn(CHART_LEVER) && (
        <LuminaPanel accent="cyan" data-lever="color-chart" className="flex flex-wrap gap-3 text-xs text-slate-300">
          {CABBAGE_BANDS.map((b, i) => (
            <span key={b.label} className="flex items-center gap-1">
              <span className="inline-block h-4 w-4 rounded-full" style={{ backgroundColor: b.hex }} />{chartRows()[i]}
            </span>
          ))}
        </LuminaPanel>
      )}
      {leverOn(STEPS_LEVER) && item && (
        <LuminaPanel accent="cyan" data-lever="step-count" className="space-y-1 text-sm text-slate-300">
          {stepLines(item).map(line => <p key={line}>{line}</p>)}
        </LuminaPanel>
      )}
    </>
  );

  const revealText = () => {
    if (!item) return '';
    if (item.mode === 'test') {
      const s = item.substance;
      return `${s.name} has a pH of ${s.pH}, so it is ${KIND_WORD[kindOf(s.pH)]}. ${s.realWorldInfo ?? ''}`.trim();
    }
    if (item.mode === 'indicator') return `${item.sample} was ${item.substance.name}, pH ${item.substance.pH}: cabbage juice turns ${CABBAGE_BANDS[bandOf(item.substance.pH)].color} at ${key}.`;
    return `${key} of ${item.base.name} matches the acid: the beaker reads pH 7, neutral.`;
  };

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
            <LuminaPrompt accent="purple" {...(practice ? { 'data-practice': 'fewer-choices' } : {})}>{askOf(item)}</LuminaPrompt>

            {pip.store && <div {...pip.dock} />}
            <div {...pip.workspace} className="space-y-4">
              {item.mode !== 'indicator' && <PHScaleBar marks={marks} />}
              {renderStation()}
              {renderLevers()}

              <div className={`grid gap-2 ${item.choices.length > 3 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-3'}`}>
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
                <LuminaActionButton action="check" disabled={choice === null || closed} onClick={check}>
                  {item.mode === 'neutralize' ? 'Mix and check' : 'Check Answer'}
                </LuminaActionButton>
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
const PhExplorer = withWorkspaceController<PhExplorerProps, ProgressOptions<PhItem>, Progress>(
  'ph-explorer', PhExplorerSurface, useScriptedProgress, useWorkspaceProgressFor('ph-explorer'));

export default PhExplorer;
