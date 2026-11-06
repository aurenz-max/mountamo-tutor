'use client';

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  LuminaCard, LuminaCardHeader, LuminaCardTitle, LuminaCardDescription, LuminaCardContent,
  LuminaBadge, LuminaButton, LuminaActionButton, LuminaChallengeCounter, LuminaFeedbackCard, LuminaPanel, LuminaPrompt,
} from '../../../ui';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../../../evaluation';
import type { BodyWorkshopMetrics } from '../../../evaluation/types';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceProgressFor } from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { leverScene } from '../../../components/live-activity/bossLevers';
import { usePhaseResults, type PhaseConfig, practiceScore } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import { PipDock, PipWorkspace } from '../../../pip/WorkspacePip';
import {
  FLOW, HABITAT_WORDS, PART_LOOKS, PART_NAMES, TASK_NOUN, TASK_VERB, TOKEN_WORDS, describeBuild, judgeBuild,
  type BodyChallenge, type BodyPart, type BodyTask, type BodyVerdict, type Habitat, type Token,
} from './bodyModel';
import { jobFor } from './bodyAtlas';
import { bodyScene, type BodyTry } from './bodyWorkspace';
import { bodyWorkshopBoss } from './bodyWorkshop.boss';
import {
  BODY_LEVERS, COUNT_LEVER, EATS_LEVER, FACT_LEVER, FLOW_LEVER, PRACTICE_NOTE, WHERE_LEVER, benchShown, partsCount,
  type BodyLeverContext,
} from './bodyLevers';

export type { BodyChallenge } from './bodyModel';

// ============================================================================
// Data contract
// ============================================================================

export interface BodyWorkshopData {
  title: string;
  description: string;
  /** 3-6 animals. REQUIRED. The animals and their words come from the author agent (checked against the atlas). */
  challenges: BodyChallenge[];
  challengeType: BodyTask;
  gradeBand: 'K-2' | '3-5';
  /** Where the levers start (`config.difficulty`). */
  supportTier?: 'easy' | 'medium' | 'hard';
  /** How the animals were authored (for QA; never shown). */
  authoring?: {
    calls: number; sources: string[]; failure?: string;
    rejected: Array<{ animal: string; errors: string[] }>; repaired?: Array<{ animal: string; errors: string[] }>;
  };

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<BodyWorkshopMetrics>) => void;
}

interface BodyWorkshopProps {
  data: BodyWorkshopData;
  className?: string;
  runtimeEvalMode?: string;
  runtimePlanItemId?: string;
}

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  deliver_oxygen: { label: 'Deliver oxygen', icon: '🫁', accentColor: 'emerald' },
  fuel_the_body: { label: 'Fuel the body', icon: '🍎', accentColor: 'amber' },
};

const MAX_ROW = 6;
const STEP_MS = 480;

// ── Pictures (2D, one stroke style) ─────────────────────────────────────────

type GlyphKey = BodyPart | Habitat | 'body' | 'muscle' | 'air' | 'water' | 'blood' | 'food';
const ICON: Record<GlyphKey, string> = {
  nose: 'M16 4C14 11 10 17 9 23q3 4 7 1q4 3 7-1C22 17 18 11 16 4Z',
  mouth: 'M5 13q11 14 22 0q-11 5-22 0Z',
  blowhole: 'M4 22q12-14 24 0M16 14v-8M12 8l4-3 4 3',
  breathing_holes: 'M3 16a13 6 0 1 0 26 0a13 6 0 1 0-26 0M9 16h.01M14 16h.01M19 16h.01M24 16h.01',
  wet_skin: 'M4 10q4-3 8 0t8 0t8 0M4 16q4-3 8 0t8 0t8 0M4 22q4-3 8 0t8 0t8 0',
  windpipe: 'M12 3h8v26h-8ZM12 9h8M12 14h8M12 19h8M12 24h8',
  lungs: 'M16 4v10M16 12l-3 3M16 12l3 3M13 9C7 9 5 18 5 24q0 4 4 3c4-1 5-5 5-10V11ZM19 9c6 0 8 9 8 15q0 4-4 3c-4-1-5-5-5-10V11Z',
  gills: 'M8 6q8 10 0 20M13 6q8 10 0 20M18 6q8 10 0 20',
  air_tubes: 'M16 3v8M16 11l-8 6M16 11l8 6M16 11v9M8 17l-3 8M8 17l2 8M24 17l3 8M24 17l-2 8M16 20l-3 8M16 20l3 8',
  heart: 'M16 27C6 20 4 14 6 10s7-4 10 0c3-4 8-4 10 0s0 10-10 17Z',
  blood_tubes: 'M4 16h10M14 16l6-8h8M14 16l6 8h8M20 8l3-4M20 24l3 4',
  stomach: 'M11 4c-2 7-5 15 1 20s14-2 12-8-8-2-10-6c-1-2-1-4-3-6Z',
  intestines: 'M6 6h18q3 0 3 3t-3 3H9q-3 0-3 3t3 3h15q3 0 3 3t-3 3H6',
  crop: 'M14 3v9M18 3v9M14 12c-6 2-7 10-2 12s9 0 8-6c0-3-1-5-2-6',
  gizzard: 'M16 5c-7 0-11 5-11 11s5 11 11 11 11-5 11-11S23 5 16 5ZM12 14h.01M18 12h.01M15 19h.01M20 18h.01M11 20h.01',
  four_stomach: 'M5 8h10v8H5ZM17 8h10v8H17ZM5 18h10v8H5ZM17 18h10v8H17Z',
  land: 'M3 24h26M6 24q4-10 10-6t10-2',
  sky: 'M8 20a5 5 0 0 1 2-9a6 6 0 0 1 11 1a4 4 0 0 1 2 8ZM6 26h20',
  sea: 'M3 12q3-3 6 0t6 0t6 0t6 0M3 19q3-3 6 0t6 0t6 0t6 0M3 26q3-3 6 0t6 0t6 0t6 0',
  pond: 'M4 20a12 5 0 1 0 24 0a12 5 0 1 0-24 0M12 18q4-3 8 0',
  soil: 'M3 10h26M6 15h.01M14 18h.01M22 14h.01M10 23h.01M20 24h.01M26 20h.01',
  body: 'M16 4a4 4 0 1 0 0 8a4 4 0 1 0 0-8M10 28l2-14h8l2 14M8 18l4-4M24 18l-4-4',
  muscle: 'M5 20c2-8 6-12 11-12s9 4 11 12c-4 3-8 4-11 4s-7-1-11-4ZM10 16q6-3 12 0',
  air: 'M4 11h16q4 0 4-4M4 17h21q4 0 4 4t-4 3M4 23h10',
  water: 'M16 4C12 12 8 16 8 21a8 8 0 0 0 16 0c0-5-4-9-8-17Z',
  blood: 'M16 4C12 12 8 16 8 21a8 8 0 0 0 16 0c0-5-4-9-8-17ZM12 21h8',
  food: 'M16 10c-6-4-12 0-11 8s6 11 11 9c5 2 10-1 11-9s-5-12-11-8ZM16 10q0-4 3-6',
};

const Glyph: React.FC<{ k: GlyphKey; className?: string }> = ({ k, className }) => (
  <svg viewBox="0 0 32 32" className={className ?? 'h-8 w-8'} fill="none" stroke="currentColor" strokeWidth={2}
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICON[k]} /></svg>
);

const TOKEN_TONE: Record<Token, string> = {
  outside_air: 'bg-sky-500/80', air: 'bg-sky-500/80', outside_water: 'bg-cyan-600/80', water: 'bg-cyan-600/80',
  blood: 'bg-rose-500/80', pumped_blood: 'bg-rose-600/80', at_muscle: 'bg-rose-600/80',
  outside_food: 'bg-amber-600/80', food: 'bg-amber-600/80', mush: 'bg-amber-700/80', blood_food: 'bg-orange-600/80',
  pumped_food: 'bg-orange-600/80', food_at_muscle: 'bg-orange-700/80',
};
const TOKEN_GLYPH: Record<Token, GlyphKey> = {
  outside_air: 'air', air: 'air', outside_water: 'water', water: 'water', blood: 'blood', pumped_blood: 'blood',
  at_muscle: 'muscle', outside_food: 'food', food: 'food', mush: 'stomach', blood_food: 'blood', pumped_food: 'blood',
  food_at_muscle: 'muscle',
};
const TOKEN_TEXT: Record<Token, string> = {
  outside_air: 'text-sky-300', air: 'text-sky-300', outside_water: 'text-cyan-300', water: 'text-cyan-300',
  blood: 'text-rose-300', pumped_blood: 'text-rose-300', at_muscle: 'text-rose-300',
  outside_food: 'text-amber-300', food: 'text-amber-300', mush: 'text-amber-300', blood_food: 'text-orange-300',
  pumped_food: 'text-orange-300', food_at_muscle: 'text-orange-300',
};

/** `show_flow`: what a part takes in and passes on, as pictures (one row per thing it can take). */
const FlowPictures: React.FC<{ part: BodyPart }> = ({ part }) => (
  <span className="flex flex-col items-center gap-0.5" data-body-flow={part}
    aria-label={Object.entries(FLOW[part]).map(([i, o]) => `${TOKEN_WORDS[i as Token]} in, ${TOKEN_WORDS[o as Token]} out`).join('; ')}>
    {Object.entries(FLOW[part]).slice(0, 2).map(([i, o]) => (
      <span key={i} className="flex items-center gap-0.5">
        <Glyph k={TOKEN_GLYPH[i as Token]} className={`h-3.5 w-3.5 ${TOKEN_TEXT[i as Token]}`} />
        <span className="text-[9px] text-slate-400">→</span>
        <Glyph k={TOKEN_GLYPH[o as Token]} className={`h-3.5 w-3.5 ${TOKEN_TEXT[o as Token]}`} />
      </span>
    ))}
  </span>
);

/** The teaching workspace is this primitive's only controller: the runtime owns progression. */
const useBodyProgress = useWorkspaceProgressFor('body-workshop');

const BodyWorkshopSurface: React.FC<BodyWorkshopProps> = ({ data, className, runtimePlanItemId }) => {
  const { title, description, challenges = [], challengeType, gradeBand, instanceId, skillId, subskillId, objectiveId,
    exhibitId, onEvaluationSubmit } = data;
  const workspace = useRef<TeachingWorkspace | null>(null);
  const stableInstanceId = useRef(instanceId || `body-workshop-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceId.current;

  const [build, setBuild] = useState<BodyPart[]>([]);
  const [tries, setTries] = useState<BodyTry[]>([]);
  /** The breath on screen: the verdict it shows and how far along the row it has got. */
  const [breath, setBreath] = useState<{ v: BodyVerdict; step: number; done: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [verdict, setVerdict] = useState<'correct' | 'incorrect' | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; status: 'correct' | 'incorrect' } | null>(null);
  const [triesTotal, setTriesTotal] = useState(0);
  // In-item levers, keyed by the session animal they were pulled on, and the practice animal a simplify lever puts in
  // place of the session animal until the observer returns to it.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<BodyChallenge | null>(null);
  const stopBreath = () => { if (timer.current) clearInterval(timer.current); timer.current = null; };
  useEffect(() => stopBreath, []);
  const clearRow = () => { stopBreath(); setBuild([]); setTries([]); setBreath(null); setVerdict(null); setFeedback(null); };

  const progress = useBodyProgress<BodyChallenge>({
    challenges, getChallengeId: (ch) => ch.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: bodyWorkshopBoss.assignment!,
    // A fresh animal opens an empty row. Try again keeps the row and the tries (and a practice animal).
    onItemOpened: (_index, retry) => {
      setVerdict(null); setFeedback(null);
      if (retry) return;
      setPractice(null); clearRow();
    },
  });
  const { currentIndex, results: challengeResults, isComplete } = progress;
  const allChallengesComplete = isComplete || !!progress.practiceSummary;
  const sessionItem = challenges[currentIndex] ?? null;
  const current = practice ?? sessionItem;
  /** The current animal's facts for this task (the judge and the clues read them). */
  const animal = current ? jobFor(current.animal, current.type) : undefined;
  const pulledLevers = !practice && sessionItem && leverState.item === sessionItem.id ? leverState.pulled : [];
  /** What is drawn: the generator's starting levers plus the ones pulled on this animal. Only pulls are recorded. */
  const on = practice || !sessionItem ? [] : Array.from(new Set([...(sessionItem.startLevers ?? []), ...pulledLevers]));
  const solved = verdict === 'correct';
  const running = !!breath && !breath.done;
  const locked = !current || !animal || progress.canAttempt === false || allChallengesComplete || verdict !== null;

  const phaseResults = usePhaseResults({
    challenges, results: challengeResults, isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.type, phaseConfig: PHASE_TYPE_CONFIG,
    getScore: (rs) => Math.round(rs.reduce((s, r) => s + (typeof r.score === 'number' ? r.score : r.correct ? 100 : 0), 0)
      / Math.max(rs.length, 1)),
  });

  const { submitResult, hasSubmitted, submittedResult, elapsedMs } = usePrimitiveEvaluation<BodyWorkshopMetrics>({
    primitiveType: 'body-workshop', instanceId: resolvedInstanceId, skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  /** Send a breath along the row: it lights each part in turn and stops where the path breaks. */
  const breathe = (b: BodyPart[], record: boolean) => {
    if (!current || !animal) return;
    const v = judgeBuild(current, animal, b);
    const last = v.trace.blockedAt >= 0 ? v.trace.blockedAt : b.length + 1;
    stopBreath();
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const finish = () => {
      stopBreath();
      setBreath({ v, step: last, done: true });
      if (record) { setTries(ts => [...ts, { build: b, why: v.why, correct: v.correct }]); setTriesTotal(n => n + 1); }
    };
    if (reduce) { finish(); return; }
    setBreath({ v, step: 0, done: false });
    SoundManager.select();
    let step = 0;
    timer.current = setInterval(() => {
      step++;
      if (step >= last) finish();
      else setBreath({ v, step, done: false });
    }, STEP_MS);
  };

  const add = (p: BodyPart) => {
    if (locked || running || build.length >= MAX_ROW) return;
    setBuild(b => [...b, p]); setBreath(null); setFeedback(null);
    SoundManager.tap();
  };
  const removeAt = (i: number) => {
    if (locked || running) return;
    setBuild(b => b.filter((_, j) => j !== i)); setBreath(null); setFeedback(null);
    SoundManager.tap();
  };
  const runIt = () => { if (!locked && !running && build.length) breathe(build, true); };

  const check = () => {
    if (!current || !animal || locked || running || !build.length) return;
    const v = judgeBuild(current, animal, build);
    setVerdict(v.correct ? 'correct' : 'incorrect');
    setFeedback({ text: v.correct ? `${v.why} ${current.principle}` : v.why, status: v.correct ? 'correct' : 'incorrect' });
    progress.commitCheck(describeBuild(current, build), v.correct, v.miss ?? undefined);
    if (v.correct) {
      SoundManager.playCorrect();
      breathe(build, false);
      if (!practice) {
        const attempts = progress.currentAttempts + 1;
        progress.mergeResult({ challengeId: current.id, correct: true, attempts, score: Math.max(20, 100 - 30 * (attempts - 1)) });
      }
    } else SoundManager.playIncorrect();
  };

  // ── Evaluation: submit once, only under an evaluation provider ────────────
  useEffect(() => {
    if (!allChallengesComplete || hasSubmitted || challenges.length === 0 || !progress.recordsEvaluation) return;
    const total = challenges.length;
    const correctCount = challengeResults.filter(r => r.correct).length;
    const attemptsCount = challengeResults.reduce((s, r) => s + r.attempts, 0);
    const firstTryCount = challengeResults.filter(r => r.correct && r.attempts === 1).length;
    const accuracy = Math.round(challengeResults.reduce((s, r) => s + (typeof r.score === 'number' ? r.score : r.correct ? 100 : 0), 0)
      / Math.max(total, 1));
    const metrics: BodyWorkshopMetrics = {
      type: 'body-workshop', challengeType, totalChallenges: total, correctCount, attemptsCount, firstTryCount,
      hintsViewed: 0, overallAccuracy: accuracy, averageAttemptsPerChallenge: Math.round((attemptsCount / total) * 10) / 10,
      breathsCount: triesTotal,
    };
    submitResult(correctCount === total, accuracy, metrics, { challengeResults });
  }, [allChallengesComplete, hasSubmitted, challenges, challengeType, challengeResults, submitResult, progress.recordsEvaluation, triesTotal]);

  // What the tutor and the observer see, republished every render, with the session animal's levers.
  useLayoutEffect(() => {
    if (!current || !sessionItem || allChallengesComplete) return;
    const ctx: BodyLeverContext = { build };
    const scene = bodyScene(current, { build, tries, running, solved });
    const levers = practice ? [] : BODY_LEVERS.declare(sessionItem, ctx, on);
    const published = leverScene(scene, {
      support: practice ? '' : BODY_LEVERS.support(sessionItem, ctx),
      onScreen: practice ? '' : BODY_LEVERS.onScreen(sessionItem, ctx, on),
    });
    workspace.current = {
      ...published,
      facts: { ...published.facts, ...(practice ? { practice: PRACTICE_NOTE } : {}) },
      levers,
      pullLever: (id: string) => {
        const lever = levers.find(l => l.id === id);
        if (practice || !lever) return `No lever ${id} on this animal.`;
        if (lever.pulled) return `${id} is already on screen.`;
        const next = { item: sessionItem.id, pulled: [...pulledLevers, id] };
        if (lever.kind === 'simplify') {
          const easier = BODY_LEVERS.simpler(sessionItem, ctx, id);
          if (!easier) return 'There is no easier animal for this one.';
          setLeverState(next); setPractice(easier); clearRow();
          return { practice: bodyWorkshopBoss.assignment!(easier) };
        }
        setLeverState(next);
        return true as const;
      },
      // Back to the full animal: the practice row is not the learner's work on it.
      endPractice: () => { setPractice(null); clearRow(); },
    };
  });

  const localScore = useMemo(() => phaseResults.length
    ? Math.round(phaseResults.reduce((s, p) => s + p.score, 0) / phaseResults.length) : 0, [phaseResults]);

  if (!challenges.length) {
    return <LuminaCard className={className}><LuminaCardContent className="p-6 text-slate-400">No animals to visit yet.</LuminaCardContent></LuminaCard>;
  }

  const v = breath?.v ?? null;
  const shown = (i: number) => !!breath && breath.step > i;             // the breath has passed part i
  const chipAt = (i: number): Token | null => (breath && breath.step >= i && v ? v.trace.tokens[i] ?? null : null);
  const brokeAt = breath?.done && v && !v.correct ? (v.at ?? null) : null;
  const reached = !!breath?.done && !!v && v.trace.arrives;
  const why = breath?.done && v && !feedback ? v.why : null;
  const flowOn = on.includes(FLOW_LEVER);
  const slotsWanted = current && on.includes(COUNT_LEVER) ? partsCount(current, build) : 0;
  const emptySlots = solved ? 0 : slotsWanted ? Math.max(0, slotsWanted - build.length) : build.length < MAX_ROW ? 1 : 0;
  const bench = current ? benchShown(current, on) : [];
  const noun = current ? TASK_NOUN[current.type] : 'breath';
  const verb = current ? TASK_VERB[current.type] : 'Breathe';
  const fuel = current?.type === 'fuel_the_body';
  const step = solved ? 'It works!' : running ? `Watch the ${noun}…`
    : !build.length ? `Tap the body parts the ${noun} goes through, in order.`
    : breath?.done ? `Change the path and try again, or press I'm done! when the ${noun} gets through.`
    : `Press ${verb} to send the ${noun} along your path.`;

  const Chip: React.FC<{ t: Token | null }> = ({ t }) => (
    <div className="flex w-14 flex-col items-center gap-0.5" aria-hidden="true">
      <span className={`min-h-[14px] max-w-[56px] rounded px-1 text-center text-[9px] leading-tight text-white ${t ? TOKEN_TONE[t] : ''}`}>
        {t ? TOKEN_WORDS[t] : ''}
      </span>
      <span className="relative block h-0.5 w-full bg-slate-500/60 after:absolute after:-right-0.5 after:-top-[4px] after:border-[5px] after:border-transparent after:border-l-slate-500/60" />
    </div>
  );

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <LuminaCardTitle>{title}</LuminaCardTitle>
          <div className="flex items-center gap-2">
            <LuminaBadge accent="emerald">{gradeBand}</LuminaBadge>
            <LuminaChallengeCounter current={Math.min(currentIndex + 1, challenges.length)} total={challenges.length} />
          </div>
        </div>
        <LuminaCardDescription>{description}</LuminaCardDescription>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel phases={phaseResults} overallScore={practiceScore(progress.practiceSummary) ?? (submittedResult?.score ?? localScore)}
            durationMs={elapsedMs} heading="Every path got through!" celebrationMessage="You followed oxygen and food through real animals' bodies." className="mb-2" />
        )}

        {!allChallengesComplete && current && (
          <LuminaPrompt accent="emerald">
            {practice && (
              <p className="mb-2 inline-block rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-amber-300" data-practice="">
                Practice: {practice.name}
              </p>
            )}
            <div className="flex items-center gap-3">
              <span className="text-4xl" aria-hidden="true">{current.emoji}</span>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-emerald-200/80">{current.name} · {HABITAT_WORDS[current.habitat]}</div>
                <div className="text-sm text-slate-200/90">{current.intro}</div>
                {on.includes(EATS_LEVER) && animal && (
                  <div className="mt-1 text-sm text-amber-200" data-body-lever={EATS_LEVER}>{animal.clue}</div>
                )}
                {on.includes(FACT_LEVER) && animal && (
                  <div className="mt-1 text-sm text-amber-200" data-body-lever={FACT_LEVER}>{animal.hasNo}</div>
                )}
              </div>
            </div>
            <div className="mt-2 text-base">{current.instruction}</div>
            <div className="mt-1 text-sm text-emerald-100/80" data-body-step="">{step}</div>
          </LuminaPrompt>
        )}

        <PipDock />
        <PipWorkspace className="space-y-3">
          {current && (
            <div className="overflow-x-auto rounded-xl border border-white/10 bg-slate-900/40 p-3">
              <div className="flex min-h-[96px] flex-wrap items-center gap-y-3" data-body-row="">
                <div className="flex w-20 flex-col items-center gap-1 rounded-xl border-2 border-dashed border-slate-500/60 p-2 text-center text-xs text-slate-300"
                  data-body-start="">
                  {fuel ? <><Glyph k="food" className="h-8 w-8 text-amber-300" />{current.food ?? 'food'}</>
                    : <><Glyph k={current.habitat} />{HABITAT_WORDS[current.habitat]}</>}
                  {!fuel && on.includes(WHERE_LEVER) && (
                    <span className={`flex items-center gap-1 ${TOKEN_TEXT[current.medium]}`} data-body-lever={WHERE_LEVER}>
                      <Glyph k={TOKEN_GLYPH[current.medium]} className="h-5 w-5" />{TOKEN_WORDS[current.medium]}
                    </span>
                  )}
                </div>
                {build.map((p, i) => {
                  const tone = brokeAt === i ? 'border-rose-400 ring-2 ring-rose-400/40'
                    : shown(i) ? 'border-emerald-400 ring-2 ring-emerald-400/30' : 'border-white/15';
                  return (
                    <React.Fragment key={`${p}-${i}`}>
                      <Chip t={chipAt(i)} />
                      <button type="button" onClick={() => removeAt(i)} disabled={locked || running}
                        aria-label={`Take out ${PART_NAMES[p]}`} data-body-placed={p}
                        className={`flex w-20 flex-col items-center gap-1 rounded-xl border-2 bg-slate-800/70 p-2 text-center text-xs text-slate-100 transition-colors hover:border-rose-300/70 disabled:opacity-80 ${tone}`}>
                        <Glyph k={p} />{PART_NAMES[p]}
                        {flowOn && <FlowPictures part={p} />}
                      </button>
                    </React.Fragment>
                  );
                })}
                {Array.from({ length: emptySlots }, (_, i) => (
                  <React.Fragment key={`slot-${i}`}>
                    <Chip t={null} />
                    <div className="flex h-[84px] w-20 items-center justify-center rounded-xl border-2 border-dashed border-slate-600/70 text-center text-[11px] text-slate-500"
                      data-body-slot="">
                      {slotsWanted ? '' : 'tap a part'}
                    </div>
                  </React.Fragment>
                ))}
                <Chip t={breath && v && breath.step > build.length && v.trace.blockedAt < 0 ? v.trace.tokens[build.length] : null} />
                <div className={`flex w-20 flex-col items-center gap-1 rounded-xl border-2 border-dashed p-2 text-center text-xs ${reached && v?.correct
                  ? 'border-emerald-400 text-emerald-200' : brokeAt === -1 ? 'border-rose-400 text-rose-200' : 'border-slate-500/60 text-slate-300'}`}
                  data-body-goal="">
                  <Glyph k={current.goal === 'to_muscle' ? 'muscle' : 'body'} className={`h-8 w-8 ${reached && v?.correct ? 'animate-pulse' : ''}`} />
                  {current.goal === 'to_muscle' ? current.muscle : 'into the blood'}
                </div>
              </div>
              {!fuel && on.includes(WHERE_LEVER) && animal && !practice && (
                <p className="mt-2 text-xs text-sky-200/90">{animal.clue}</p>
              )}
            </div>
          )}

          {!allChallengesComplete && current && (
            <LuminaPanel className="space-y-3 p-3" data-body-bench="">
              <div className="text-xs text-slate-400">Body parts:</div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                {bench.map(p => (
                  <button key={p} type="button" onClick={() => add(p)} disabled={locked || running || build.length >= MAX_ROW}
                    aria-label={`Add ${PART_NAMES[p]}`} title={PART_LOOKS[p]} data-pip-object={`part-${p}`}
                    className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-slate-800/60 px-1 py-2 text-xs text-slate-200 transition-colors hover:border-emerald-400/60 hover:bg-slate-700/60 disabled:opacity-50">
                    <Glyph k={p} className="h-9 w-9" />
                    <span className="text-center leading-tight">{PART_NAMES[p]}</span>
                    {flowOn && <FlowPictures part={p} />}
                  </button>
                ))}
              </div>
              <details className="rounded-lg bg-slate-800/50 px-3 py-2 text-xs text-slate-300" data-body-guide="">
                <summary className="cursor-pointer text-slate-400">What the parts look like</summary>
                <ul className="mt-1 space-y-0.5">
                  {bench.map(p => <li key={p}><span className="font-semibold text-slate-200">{PART_NAMES[p]}</span>: {PART_LOOKS[p]}</li>)}
                </ul>
              </details>
              <div className="flex flex-wrap items-center gap-2">
                <LuminaButton tone="primary" onClick={runIt} disabled={locked || running || !build.length}>{verb}</LuminaButton>
                <LuminaButton tone="ghost" data-pip-object="clear-row" onClick={() => { if (!locked && !running) { setBuild([]); setBreath(null); } }}
                  disabled={locked || running || !build.length}>Clear</LuminaButton>
              </div>
            </LuminaPanel>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {!allChallengesComplete && current && (
              <LuminaActionButton action="check" onClick={check} disabled={locked || running || !build.length}>I&apos;m done!</LuminaActionButton>
            )}
          </div>

          {why && (
            <LuminaFeedbackCard status="insight" data-body-why=""><p>{why}</p></LuminaFeedbackCard>
          )}
          {feedback && (
            <LuminaFeedbackCard status={feedback.status}><p>{feedback.text}</p></LuminaFeedbackCard>
          )}
          {solved && current && (
            <ul className="space-y-1 rounded-lg bg-slate-800/40 p-3 text-sm text-slate-300" data-body-jobs="">
              {build.map((p, i) => <li key={i}><span className="font-semibold text-slate-100">{PART_NAMES[p]}</span>: {current.jobs[p]}</li>)}
            </ul>
          )}
        </PipWorkspace>
      </LuminaCardContent>
    </LuminaCard>
  );
};

const BodyWorkshop = withWorkspaceOnly<BodyWorkshopProps>('body-workshop', BodyWorkshopSurface, props => props.data.title);

/**
 * Body Workshop runs only on the teaching workspace: the tutor is present, I'm done! commits, and the runtime moves
 * to the next animal. Outside a bound session the "needs the tutor" card shows. The tutor (or the observer) can pull
 * in-item levers (`bodyLevers.ts`); a simplify lever opens an ungraded practice animal before the full one comes back.
 */
export default BodyWorkshop;
