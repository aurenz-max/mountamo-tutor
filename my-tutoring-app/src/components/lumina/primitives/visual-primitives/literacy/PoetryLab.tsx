'use client';

import React, { useState, useLayoutEffect, useMemo, useRef } from 'react';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaBadge,
  LuminaPanel,
  LuminaAnswerChoice,
  LuminaActionButton,
  LuminaChallengeCounter,
  LuminaFeedbackCard,
  LuminaInput,
  accentSoftBg,
  accentSoftBorder,
  accentText,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { PoetryLabMetrics } from '../../../evaluation/types';
import { usePhaseResults, type PhaseConfig, practiceScore } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import { PipDock, PipWorkspace } from '../../../pip/WorkspacePip';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { TeachingEvaluationResult } from '../../../components/live-activity/runtime/useTeachingEvaluation';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceProgressFor } from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { leverScene } from '../../../components/live-activity/bossLevers';
import {
  EMPTY_VIEW, countSyllables, describePoetryWork, itemData, lineCount, moodChoices, poemWords, poetryCorrect, poetryItems,
  poetryMiss, rhymeCards, schemeChoices, showsFigurativeCount, workspaceScene,
  type PoetryItem, type PoetryView,
} from './poetryLabWorkspace';
import {
  END_WORDS_LEVER, FIGURE_MODELS_LEVER, FIRST_LETTERS_LEVER, MODEL_POEM_LEVER, MOOD_FACES_LEVER, PHRASE_COUNT_LEVER,
  POETRY_LEVERS, PRACTICE_NOTE, RHYME_MODEL_LEVER, SYLLABLE_BEATS_LEVER, endWords, figureModels, modelPoem, moodFace,
  rhymeModel, syllableBeats, type PoetryCtx,
} from './poetryLabLevers';
import { poetryLabBoss } from './poetryLab.boss';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export type PoetryMode = 'rhyme_hunt' | 'analysis' | 'composition';
export type TemplateType = 'haiku' | 'limerick' | 'acrostic' | 'free-verse' | 'sonnet-intro';

export interface RhymeHuntCandidate {
  word: string;
  emoji: string;
}

export interface RhymeHuntRound {
  id: string;
  type: 'rhyme_hunt';
  poemLines: [string, string, string, string];
  candidates: [RhymeHuntCandidate, RhymeHuntCandidate, RhymeHuntCandidate, RhymeHuntCandidate];
  rhymeWordA: string;
  rhymeWordB: string;
}

export interface FigurativeInstance {
  text: string;
  startIndex: number;
  endIndex: number;
  type: string;           // simile, metaphor, personification, etc.
}

export interface PoetryLabData {
  title: string;
  gradeLevel: string;
  mode: PoetryMode;

  /**
   * Within-mode support tier — scaffolding withdrawal ONLY (display/help, never
   * content or checking). Stamped by the generator for analysis/composition;
   * NEVER present on rhyme_hunt, where the K-1 band contract wins over tier and
   * the RhymeHunt fork must never read it. Absent ⇒ full-support render;
   * 'easy' renders the same as no tier.
   */
  supportTier?: 'easy' | 'medium' | 'hard';

  // Rhyme Hunt mode data (K-1, audio-first)
  rounds?: RhymeHuntRound[];

  // Analysis mode data
  poem?: string;
  poemLines?: string[];                  // Lines of the poem
  correctMood?: string;                  // Expected mood (happy, sad, mysterious, peaceful, etc.)
  moodOptions?: string[];                // 3-4 mood choices
  figurativeInstances?: FigurativeInstance[];
  rhymeScheme?: string;                  // e.g. "AABB", "ABAB", "ABCB"
  rhymeSchemeOptions?: string[];         // 3-4 options

  // Composition mode data
  templateType?: TemplateType;
  compositionPrompt?: string;            // "Write a haiku about..."
  templateConstraints?: {
    lineCount: number;
    syllablesPerLine?: number[];         // e.g. [5, 7, 5] for haiku
    rhymePattern?: string;              // e.g. "AABBA" for limerick
    acrosticWord?: string;              // For acrostic poems
  };

  // Evaluation props
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<PoetryLabMetrics>) => void;
}

// ============================================================================
// Props & Constants
// ============================================================================

interface PoetryLabProps {
  data: PoetryLabData;
  className?: string;
  runtimePlanItemId?: string;
  runtimeEvalMode?: string;
}

const usePoetryProgress = useWorkspaceProgressFor('poetry-lab');

const RHYME_COLORS: Record<string, string> = {
  A: 'text-blue-300 bg-blue-500/20',
  B: 'text-rose-300 bg-rose-500/20',
  C: 'text-emerald-300 bg-emerald-500/20',
  D: 'text-amber-300 bg-amber-500/20',
};

const RHYME_HUNT_PHASE_CONFIG: Record<string, PhaseConfig> = {
  rhyme_hunt: { label: 'Rhyme Hunt', icon: '👂', accentColor: 'purple' },
};

const WORKSPACE_PHASE_CONFIG: Record<string, PhaseConfig> = {
  mood: { label: 'Mood', icon: '🎭', accentColor: 'purple' },
  figurative: { label: 'Figurative Language', icon: '✨', accentColor: 'blue' },
  rhyme: { label: 'Rhyme Scheme', icon: '🔤', accentColor: 'emerald' },
  compose: { label: 'Your Poem', icon: '✍️', accentColor: 'pink' },
};

// ============================================================================
// Rhyme hunt (K-1)
// ============================================================================

/** Rhyme Hunt never reads `supportTier` (band contract). Each round is one checked item; the second tap checks. */
const RhymeHunt: React.FC<PoetryLabProps> = ({ data, className, runtimePlanItemId }) => {
  const rounds = data.rounds ?? [];
  const items = useMemo(() => poetryItems(data), [data]);
  const ctx: PoetryCtx = useMemo(() => ({ data }), [data]);
  const workspace = useRef<TeachingWorkspace | null>(null);
  const stableInstanceIdRef = useRef(data.instanceId || `poetry-lab-${Date.now()}`);
  const resolvedInstanceId = data.instanceId || stableInstanceIdRef.current;

  const [selectedWords, setSelectedWords] = useState<string[]>([]);
  const [wrongWords, setWrongWords] = useState<string[]>([]);
  const [correctWords, setCorrectWords] = useState<string[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [submittedScore, setSubmittedScore] = useState<number | null>(null);
  const startTimeRef = useRef(Date.now());

  const clearRound = () => {
    setSelectedWords([]);
    setWrongWords([]);
    setCorrectWords([]);
    setIsLocked(false);
  };
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const progress = usePoetryProgress({
    challenges: items,
    getChallengeId: (item) => item.id,
    instanceId: resolvedInstanceId, objectiveId: data.objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: poetryLabBoss.assignment!,
    // A fresh round and Try again both open with no card tapped (a practice round stays on Try again).
    onItemOpened: () => clearRound(),
    onFinished: (result) => finish.current(result),
  });
  const { currentIndex, currentAttempts, results: roundResults, isComplete: allRoundsComplete } = progress;
  /** A checked pair stays closed until Try again or Next challenge on the shell. */
  const learnerBlocked = () => progress.canAttempt === false;

  // In-item levers (`POETRY_LEVERS`), keyed by the round they were pulled on, and the practice round a simplify
  // lever puts in place of this one until the observer returns to it.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<PoetryItem | null>(null);
  const sessionItem = items[currentIndex];
  const currentItem = practice ?? sessionItem;
  const currentRound = currentItem?.round;
  const shownData = currentItem ? itemData(currentItem, data) : data;
  const pulledLevers = !practice && sessionItem && leverState.item === sessionItem.id ? leverState.pulled : [];
  const model = pulledLevers.includes(RHYME_MODEL_LEVER) ? rhymeModel(data) : null;
  const cards = useMemo(() => (currentRound ? rhymeCards(currentRound) : []), [currentRound]);
  const showSummary = allRoundsComplete || !!progress.practiceSummary;

  const phaseResults = usePhaseResults({
    challenges: items,
    results: roundResults,
    isComplete: allRoundsComplete,
    getChallengeType: () => 'rhyme_hunt',
    phaseConfig: RHYME_HUNT_PHASE_CONFIG,
    getScore: (results) => results.length > 0
      ? Math.round(results.reduce((sum, result) => sum + (result.score ?? 0), 0) / results.length)
      : 0,
  });

  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
  } = usePrimitiveEvaluation<PoetryLabMetrics>({
    primitiveType: 'poetry-lab',
    instanceId: resolvedInstanceId,
    skillId: data.skillId,
    subskillId: data.subskillId,
    objectiveId: data.objectiveId,
    exhibitId: data.exhibitId,
    onSubmit: data.onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const buildMetrics = (roundsFirstTry: number): PoetryLabMetrics => ({
    type: 'poetry-lab',
    mode: 'rhyme_hunt',
    roundsTotal: rounds.length,
    roundsFirstTry,
    figurativeLanguageIdentified: 0,
    figurativeLanguageTotal: 0,
    rhymeSchemeCorrect: false,
    syllableCountAccurate: true,
    elementsExplored: rounds.length,
    poemCompleted: false,
    templateType: 'free-verse',
  });

  // Under a lesson's evaluation provider only: the scored session.
  finish.current = (result) => {
    if (hasSubmittedEvaluation || progress.recordsEvaluation === false) return;
    const roundsFirstTry = roundResults.filter((r) => r.score === 100).length;
    setSubmittedScore(result.accuracy);
    submitEvaluation(result.passed, result.accuracy, buildMetrics(roundsFirstTry),
      { roundResults, challengeResults: result.outcomes, learningResponses: result.learningResponses,
        teachingAttempts: result.teachingAttempts, assistanceProvenance: result.assistanceProvenance },
      undefined, result.diagnosisEvidence);
  };

  const handleCandidateTap = (word: string) => {
    if (!currentRound || !currentItem || isLocked || learnerBlocked() || selectedWords.includes(word)) return;
    SoundManager.select();
    const nextSelection = [...selectedWords, word];
    setSelectedWords(nextSelection);
    if (nextSelection.length < 2) return;

    setIsLocked(true);
    const view: PoetryView = { ...EMPTY_VIEW, picked: nextSelection };
    const correct = poetryCorrect(currentItem, shownData, view);
    progress.commitCheck(describePoetryWork(currentItem, shownData, view), correct, correct ? undefined : poetryMiss(currentItem, shownData, view));
    // The pair stays marked until Try again; a practice round records nothing.
    if (correct) {
      setCorrectWords(nextSelection);
      SoundManager.playCorrect();
      if (!practice) progress.mergeResult({ challengeId: currentItem.id, correct: true, attempts: currentAttempts + 1, score: currentAttempts === 0 ? 100 : 0 });
    } else {
      setWrongWords(nextSelection);
      SoundManager.playIncorrect();
    }
  };

  // What the tutor and the observer are shown, republished every render.
  useLayoutEffect(() => {
    if (!currentItem || !sessionItem || allRoundsComplete) return;
    const levers = practice ? [] : POETRY_LEVERS.declare(sessionItem, ctx, pulledLevers);
    const published = leverScene(workspaceScene(currentItem, shownData, { ...EMPTY_VIEW, picked: selectedWords }), {
      support: practice ? '' : POETRY_LEVERS.support(sessionItem, ctx),
      onScreen: practice ? '' : POETRY_LEVERS.onScreen(sessionItem, ctx, pulledLevers),
    });
    workspace.current = {
      ...published,
      facts: { ...published.facts, ...(practice ? { practice: PRACTICE_NOTE } : {}) },
      levers,
      pullLever: (id: string) => {
        const lever = levers.find((l) => l.id === id);
        if (practice || !lever) return `No lever ${id} on this round.`;
        if (lever.pulled) return `${id} is already on screen.`;
        const next = { item: sessionItem.id, pulled: [...pulledLevers, id] };
        if (lever.kind === 'simplify') {
          const easier = POETRY_LEVERS.simpler(sessionItem, ctx, id);
          if (!easier) return 'There is no practice round for this one.';
          setLeverState(next); setPractice(easier); clearRound();
          return { practice: poetryLabBoss.assignment!(easier) };
        }
        setLeverState(next);
        return true as const;
      },
      // Back to the session round, blank: the practice round is not the learner's work on it.
      endPractice: () => { setPractice(null); clearRound(); },
    };
  });

  if (rounds.length === 0) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-6 text-center text-slate-400">
          No rhyme rounds available.
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  if (showSummary || !currentRound) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-5">
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={practiceScore(progress.practiceSummary) ?? (submittedScore ?? progress.teachingResult?.accuracy ?? undefined)}
            durationMs={Date.now() - startTimeRef.current}
            heading="Rhyme Hunt Complete"
            celebrationMessage="You listened closely for matching word endings!"
          />
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  return (
    <LuminaCard className={className}>
      <LuminaCardContent className="p-5 space-y-5">
        <div className="flex justify-center gap-2" aria-label={`Round ${currentIndex + 1} of ${rounds.length}`}>
          {rounds.map((round, index) => (
            <span
              key={round.id}
              className={`h-2.5 w-2.5 rounded-full transition-colors ${index <= currentIndex ? 'bg-violet-400' : 'bg-slate-700'}`}
            />
          ))}
        </div>

        {/* Pip's dock sits above the workspace, which it outlines as a region. */}
        <PipDock />
        <PipWorkspace className="space-y-5">
          {practice && <p className="text-center text-sm font-semibold text-amber-300">Practice poem</p>}
          {model && !practice && (
            <LuminaPanel data-lever="rhyme-model" className="flex flex-wrap items-center justify-center gap-4 text-center text-sm text-cyan-100">
              <span><span aria-hidden>{model.words[0].emoji}</span> {model.words[0].word} + <span aria-hidden>{model.words[1].emoji}</span> {model.words[1].word}: rhyme</span>
              <span><span aria-hidden>{model.words[0].emoji}</span> {model.words[0].word} + <span aria-hidden>{model.onsetFoil.emoji}</span> {model.onsetFoil.word}: same start, no rhyme</span>
            </LuminaPanel>
          )}
          <LuminaPanel className="space-y-1 text-center font-serif" aria-label="Poem">
            {currentRound.poemLines.map((line, index) => (
              <p key={`${currentRound.id}-line-${index}`} className="text-base leading-relaxed text-slate-200">
                {line}
              </p>
            ))}
          </LuminaPanel>

          <div className="grid grid-cols-2 gap-3">
            {cards.map((candidate) => {
              const isSelected = selectedWords.includes(candidate.word);
              const isWrong = wrongWords.includes(candidate.word);
              const isCorrect = correctWords.includes(candidate.word);
              const state = isCorrect ? 'correct' : isWrong ? 'incorrect' : isSelected ? 'selected' : 'idle';
              return (
                <LuminaAnswerChoice
                  key={`${currentRound.id}-${candidate.word}`}
                  state={state}
                  aria-label={candidate.word}
                  disabled={isLocked || learnerBlocked()}
                  onClick={() => handleCandidateTap(candidate.word)}
                  className="min-h-28 p-3 text-center"
                >
                  <span className="block text-4xl" aria-hidden>{candidate.emoji}</span>
                  <span className="mt-1 block text-lg font-semibold text-slate-100">{candidate.word}</span>
                </LuminaAnswerChoice>
              );
            })}
          </div>
        </PipWorkspace>

        {correctWords.length === 2 && (
          <div className="flex items-center justify-center gap-3 text-emerald-300 animate-pulse" aria-live="polite">
            <span className="font-semibold">{correctWords[0]}</span>
            <span className="h-0.5 w-16 bg-emerald-400 rounded-full" />
            <span className="font-semibold">{correctWords[1]}</span>
          </div>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

// ============================================================================
// Analysis and composition
// ============================================================================

/**
 * Analysis and composition: each analysis phase, and the poem, is one checked item (`poetryLabWorkspace.ts`). Every
 * word of the poem is a button on the figurative item, so the phrases are not marked by being the only tappable text.
 * The support tier withdraws display help only (the figurative count, the scheme preview's colors, the syllable chips).
 */
const PoetryWorkspaceBoard: React.FC<PoetryLabProps> = ({ data, className, runtimePlanItemId }) => {
  const { title, gradeLevel, mode, supportTier, templateType } = data;
  const items = useMemo(() => poetryItems(data), [data]);
  const workspace = useRef<TeachingWorkspace | null>(null);
  const stableId = useRef(data.instanceId || `poetry-lab-${Date.now()}`);
  const resolvedInstanceId = data.instanceId || stableId.current;
  const startTime = useRef(Date.now());

  const showFigurativeTargetCount = showsFigurativeCount(supportTier);
  const showRhymePreview = supportTier !== 'hard';
  const colorRhymePreview = !supportTier || supportTier === 'easy';
  const showSyllableChips = supportTier !== 'hard';
  const judgeSyllableChips = !supportTier || supportTier === 'easy';

  const [mood, setMood] = useState<string | null>(null);
  const [tapped, setTapped] = useState<string[]>([]);
  const [scheme, setScheme] = useState<string | null>(null);
  const [lines, setLines] = useState<string[]>(() => Array(lineCount(data)).fill(''));
  const [verdict, setVerdict] = useState<boolean | null>(null);
  // In-item levers (`POETRY_LEVERS`), keyed by the item they were pulled on, and the practice item a simplify lever
  // puts in place of this one until the observer returns to it.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<PoetryItem | null>(null);
  const clearWork = (d: PoetryLabData, keepLines: boolean) => {
    setVerdict(null); setMood(null); setTapped([]); setScheme(null);
    if (!keepLines) setLines(Array(lineCount(d)).fill(''));
  };

  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const progress = usePoetryProgress({
    challenges: items,
    getChallengeId: (item) => item.id,
    instanceId: resolvedInstanceId, objectiveId: data.objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: poetryLabBoss.assignment!,
    // A fresh item and Try again both open blank; a poem's lines are kept on Try again.
    // Try again on a practice item keeps it; back from one (`endPractice` first) opens the session item's lines.
    onItemOpened: (_index, retry) => clearWork(retry && practice ? itemData(practice, data) : data, retry),
    onFinished: (result) => finish.current(result),
  });
  const sessionItem = items[progress.currentIndex];
  const done = progress.isComplete || !!progress.practiceSummary;
  const item = practice ?? sessionItem;
  const shown = item ? itemData(item, data) : data;
  const tc = shown.templateConstraints;
  const words = useMemo(() => poemWords(shown), [shown]);
  const moods = useMemo(() => moodChoices(shown), [shown]);
  const schemes = useMemo(() => schemeChoices(shown), [shown]);
  const pulled = !practice && sessionItem && leverState.item === sessionItem.id ? leverState.pulled : [];
  const has = (id: string) => pulled.includes(id);
  const model = has(MODEL_POEM_LEVER) ? modelPoem(data) : null;
  const blocked = progress.canAttempt === false;
  const view: PoetryView = { picked: [], mood, tapped, scheme, lines, modelLines: model?.lines };

  const phaseResults = usePhaseResults({
    challenges: items, results: progress.results, isComplete: done,
    getChallengeType: (i) => i.kind, phaseConfig: WORKSPACE_PHASE_CONFIG,
  });
  const { submitResult, hasSubmitted, submittedResult } = usePrimitiveEvaluation<PoetryLabMetrics>({
    primitiveType: 'poetry-lab', instanceId: resolvedInstanceId, skillId: data.skillId, subskillId: data.subskillId,
    objectiveId: data.objectiveId, exhibitId: data.exhibitId,
    onSubmit: data.onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // Under a lesson's evaluation provider only: the scored session.
  finish.current = (result) => {
    if (hasSubmitted || progress.recordsEvaluation === false) return;
    const solved = (kind: string) => progress.results.some((r) => r.challengeId === kind && r.correct);
    const metrics: PoetryLabMetrics = {
      type: 'poetry-lab', mode: mode === 'composition' ? 'composition' : 'analysis',
      figurativeLanguageIdentified: solved('figurative') ? data.figurativeInstances?.length ?? 0 : 0,
      figurativeLanguageTotal: data.figurativeInstances?.length ?? 0,
      rhymeSchemeCorrect: solved('rhyme'),
      syllableCountAccurate: mode === 'composition' ? solved('compose') : true,
      elementsExplored: items.length,
      poemCompleted: solved('compose'),
      templateType: templateType || 'free-verse',
    };
    submitResult(result.passed, result.accuracy, metrics,
      { compositionLines: mode === 'composition' ? lines : undefined, challengeResults: result.outcomes,
        learningResponses: result.learningResponses, teachingAttempts: result.teachingAttempts,
        assistanceProvenance: result.assistanceProvenance },
      undefined, result.diagnosisEvidence);
  };

  const check = () => {
    if (!item || blocked) return;
    const correct = poetryCorrect(item, shown, view);
    setVerdict(correct);
    if (correct) SoundManager.playCorrect(); else SoundManager.playIncorrect();
    progress.commitCheck(describePoetryWork(item, shown, view), correct, correct ? undefined : poetryMiss(item, shown, view));
    // A practice item records nothing.
    if (correct && !practice) progress.mergeResult({ challengeId: item.id, correct: true, attempts: progress.currentAttempts + 1,
      score: Math.max(20, 100 - 20 * progress.currentAttempts) });
  };

  useLayoutEffect(() => {
    if (!item || !sessionItem || done) return;
    const ctx: PoetryCtx = { data, lines };
    const levers = practice ? [] : POETRY_LEVERS.declare(sessionItem, ctx, pulled);
    const published = leverScene(workspaceScene(item, shown, view), {
      support: practice ? '' : POETRY_LEVERS.support(sessionItem, ctx),
      onScreen: practice ? '' : POETRY_LEVERS.onScreen(sessionItem, ctx, pulled),
    });
    workspace.current = {
      ...published,
      facts: { ...published.facts, ...(practice ? { practice: PRACTICE_NOTE } : {}) },
      levers,
      pullLever: (id: string) => {
        const lever = levers.find((l) => l.id === id);
        if (practice || !lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already on screen.`;
        const next = { item: sessionItem.id, pulled: [...pulled, id] };
        if (lever.kind === 'simplify') {
          const easier = POETRY_LEVERS.simpler(sessionItem, ctx, id);
          if (!easier) return 'There is no practice item for this one.';
          setLeverState(next); setPractice(easier); clearWork(itemData(easier, data), false);
          return { practice: poetryLabBoss.assignment!(easier) };
        }
        setLeverState(next);
        return true as const;
      },
      // Back to the full item, blank: the practice is not the learner's work on it.
      endPractice: () => { setPractice(null); clearWork(data, false); },
    };
  });

  const canCheck = !blocked && verdict === null && (
    item?.kind === 'mood' ? !!mood : item?.kind === 'figurative' ? tapped.length > 0
      : item?.kind === 'rhyme' ? !!scheme : lines.some((l) => l.trim()));
  const foundFigs = new Set(words.filter((w) => tapped.includes(w.key) && w.fig !== null).map((w) => w.fig));
  const figurativeSolved = item?.kind === 'figurative' && verdict === true;
  const ends = endWords(shown);

  const renderPoem = () => {
    if (item?.kind === 'figurative') {
      const byLine = new Map<number, typeof words>();
      words.forEach((w) => byLine.set(w.line, [...(byLine.get(w.line) ?? []), w]));
      return Array.from(byLine.entries()).map(([line, row]) => (
        <p key={line} className="flex flex-wrap gap-x-1 gap-y-0.5 text-sm leading-relaxed">
          {row.map((w) => {
            const on = tapped.includes(w.key);
            // After a right check, each found phrase is underlined whole; before it only the tapped word shows.
            const whole = figurativeSolved && w.fig !== null && foundFigs.has(w.fig);
            return (
              <button key={w.key} type="button" data-pip-object={w.key} disabled={blocked || verdict !== null}
                onClick={() => { SoundManager.toggle(!on); setTapped((t) => (on ? t.filter((k) => k !== w.key) : [...t, w.key])); }}
                className={`rounded px-0.5 transition-colors hover:bg-violet-400/20 ${on || whole
                  ? 'bg-violet-500/20 text-violet-200 underline underline-offset-2' : 'text-slate-200'}`}>
                {w.text}
              </button>
            );
          })}
        </p>
      ));
    }
    return (shown.poemLines ?? []).map((line, i) => (
      <div key={i} className="flex items-center gap-2">
        {item?.kind === 'rhyme' && showRhymePreview && scheme && (
          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${colorRhymePreview
            ? (RHYME_COLORS[scheme[i]] || 'text-slate-500') : 'text-slate-300 bg-slate-500/20'}`}>{scheme[i] ?? ''}</span>
        )}
        <span className="text-slate-200 text-sm flex-1">{line}</span>
        {item?.kind === 'rhyme' && has(END_WORDS_LEVER) && (
          <span data-lever="end-words" className="text-sm font-semibold text-cyan-200">{ends[i]}</span>
        )}
      </div>
    ));
  };

  const choiceClass = (on: boolean) => `px-3 py-1.5 rounded-lg text-sm border transition-all ${on
    ? `${accentSoftBg.purple} ${accentSoftBorder.purple} ${accentText.purple}`
    : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`;

  if (!items.length) {
    return <LuminaCard className={className}><LuminaCardContent className="p-6 text-center text-slate-400">Nothing to do in this poem.</LuminaCardContent></LuminaCard>;
  }

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="space-y-1">
          <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
          <div className="flex items-center gap-2">
            <LuminaBadge className="text-xs">Grade {gradeLevel}</LuminaBadge>
            <LuminaBadge accent="purple" className="text-xs capitalize">{mode}</LuminaBadge>
            {mode === 'composition' && templateType && <LuminaBadge accent="pink" className="text-xs capitalize">{templateType}</LuminaBadge>}
          </div>
        </div>
      </LuminaCardHeader>
      <LuminaCardContent className="space-y-4">
        {done ? (
          <PhaseSummaryPanel phases={phaseResults} overallScore={practiceScore(progress.practiceSummary) ?? (submittedResult?.score ?? progress.teachingResult?.accuracy)}
            durationMs={Date.now() - startTime.current}
            heading={mode === 'composition' ? 'Poem Complete!' : 'Poetry Analysis Complete!'}
            celebrationMessage={mode === 'composition' ? 'You wrote and shaped your own poem.' : 'You broke down the elements of this poem.'} />
        ) : item && (
          <>
            {items.length > 1 && (
              <div className="flex justify-center">
                <LuminaChallengeCounter current={progress.currentIndex + 1} total={items.length} variant="dots" />
              </div>
            )}
            {practice && <p className="text-center text-sm font-semibold text-amber-300">Practice: this one is not graded.</p>}
            <PipDock />
            <PipWorkspace className="space-y-4">
              {mode !== 'composition' ? (
                <>
                  {item.kind === 'figurative' && has(FIGURE_MODELS_LEVER) && (
                    <LuminaPanel data-lever="figure-models" className="space-y-0.5 text-sm text-cyan-100">
                      {figureModels(data).map((m) => <p key={m.kind}><span className="font-semibold capitalize">{m.kind}</span>: {m.example}</p>)}
                    </LuminaPanel>
                  )}
                  <LuminaPanel className="font-serif space-y-1" aria-label="Poem">{renderPoem()}</LuminaPanel>
                  {item.kind === 'mood' && (
                    <div className="space-y-3">
                      <p className="text-sm text-slate-400">What mood or feeling does this poem create?</p>
                      <div className="flex flex-wrap gap-2">
                        {moods.map((m) => (
                          <button key={m} type="button" aria-label={m} disabled={blocked || verdict !== null}
                            onClick={() => { SoundManager.select(); setMood(m); }} className={choiceClass(mood === m)}>
                            {has(MOOD_FACES_LEVER) && moodFace(m) && <span aria-hidden className="mr-1">{moodFace(m)}</span>}{m}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {item.kind === 'figurative' && (
                    <p className="text-sm text-slate-400">
                      Tap a word of each figurative phrase in the poem
                      {showFigurativeTargetCount || has(PHRASE_COUNT_LEVER) ? ` (${shown.figurativeInstances?.length ?? 0} to find)` : ''}.
                    </p>
                  )}
                  {item.kind === 'rhyme' && (
                    <div className="space-y-3">
                      <p className="text-sm text-slate-400">What is the rhyme scheme of this poem?</p>
                      <div className="flex flex-wrap gap-2">
                        {schemes.map((s) => (
                          <button key={s} type="button" disabled={blocked || verdict !== null}
                            onClick={() => { SoundManager.select(); setScheme(s); }} className={`${choiceClass(scheme === s)} font-mono`}>{s}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <LuminaPanel>
                    <p className="text-sm text-slate-300">{shown.compositionPrompt}</p>
                    {tc?.syllablesPerLine && (
                      <p className="text-xs text-slate-500 mt-1">Syllables per line: {tc.syllablesPerLine.join('-')}</p>
                    )}
                    {tc?.acrosticWord && (
                      <p className="text-xs text-slate-500 mt-1">Acrostic word: <span className={`font-bold ${accentText.purple}`}>{tc.acrosticWord}</span></p>
                    )}
                    {tc?.rhymePattern && (
                      <p className="text-xs text-slate-500 mt-1">Rhyme pattern: {tc.rhymePattern}</p>
                    )}
                  </LuminaPanel>
                  {model && (
                    <LuminaPanel data-lever="model-poem" className="space-y-0.5 text-sm text-cyan-100 font-serif">
                      <p className="text-xs font-sans text-cyan-300">A finished poem of this form, about {model.subject}:</p>
                      {model.lines.map((l, i) => <p key={i}>{l}</p>)}
                    </LuminaPanel>
                  )}
                  <div className="space-y-2">
                    {lines.map((line, i) => {
                      const target = tc?.syllablesPerLine?.[i];
                      const letter = tc?.acrosticWord?.[i];
                      const syllables = countSyllables(line);
                      return (
                        <div key={i} className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            {letter && <span className="w-6 h-6 rounded bg-violet-500/20 text-violet-300 text-sm font-bold flex items-center justify-center">{letter}</span>}
                            {letter && has(FIRST_LETTERS_LEVER) && (
                              <span data-lever="first-letters" className="w-6 h-6 rounded bg-slate-500/20 text-slate-200 text-sm font-bold flex items-center justify-center">
                                {line.trim().charAt(0).toUpperCase() || '·'}
                              </span>
                            )}
                            <LuminaInput aria-label={`Line ${i + 1}`} value={line} disabled={blocked}
                              onChange={(e) => { const next = [...lines]; next[i] = e.target.value; setLines(next); setVerdict(null); }}
                              placeholder={`Line ${i + 1}${judgeSyllableChips && target ? ` (${target} syllables)` : ''}...`} className="flex-1 text-sm" />
                            {target !== undefined && showSyllableChips && (
                              <span className={`text-xs px-1.5 py-0.5 rounded ${judgeSyllableChips
                                ? (Math.abs(syllables - target) <= 1 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300')
                                : 'bg-slate-500/20 text-slate-300'}`}>
                                {judgeSyllableChips ? `${syllables}/${target}` : syllables}
                              </span>
                            )}
                          </div>
                          {target !== undefined && has(SYLLABLE_BEATS_LEVER) && line.trim() && (
                            <p data-lever="syllable-beats" className="pl-2 text-xs text-cyan-200">{syllableBeats(line)}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
              <div className="flex justify-end">
                <LuminaActionButton action="check" onClick={check} disabled={!canCheck}>
                  {mode === 'composition' ? 'Check Poem' : 'Check'}
                </LuminaActionButton>
              </div>
              {verdict !== null && (
                <LuminaFeedbackCard status={verdict ? 'correct' : 'incorrect'}>
                  <p className="text-sm">{verdict ? 'Yes! That checks out.' : 'Not yet. Look again.'}</p>
                </LuminaFeedbackCard>
              )}
            </PipWorkspace>
          </>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

/** One surface per mount: Rhyme Hunt for K-1, the board for analysis and composition. */
const PoetryLabSurface: React.FC<PoetryLabProps> = (props) =>
  (props.data.mode === 'rhyme_hunt' ? <RhymeHunt {...props} /> : <PoetryWorkspaceBoard {...props} />);

// Taught only on the workspace: a mount with no tutor shows the shared "needs the tutor" card.
const PoetryLab = withWorkspaceOnly<PoetryLabProps>('poetry-lab', PoetryLabSurface, (props) => props.data?.title);

export default PoetryLab;
