'use client';

import React, { useState, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaBadge,
  LuminaPanel,
  LuminaButton,
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
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useLuminaAIContext } from '@/contexts/LuminaAIContext';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import { useWorkspacePipSurface } from '../../../pip/useWorkspacePipSurface';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { TeachingEvaluationResult } from '../../../components/live-activity/runtime/useTeachingEvaluation';
import { withWorkspaceController } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useScriptedProgress, useWorkspaceProgressFor, type Progress, type ProgressOptions }
  from '../../../components/live-activity/runtime/useWorkspaceProgress';
import {
  EMPTY_VIEW, countSyllables, describePoetryWork, lineCount, moodChoices, poemWords, poetryCorrect, poetryItems,
  poetryMiss, rhymeCards, schemeChoices, workspaceAssignment, workspaceScene,
  type PoetryItem, type PoetryView,
} from './poetryLabWorkspace';
import {
  END_WORDS_LEVER, FIGURE_MODELS_LEVER, FIRST_LETTERS_LEVER, MODEL_POEM_LEVER, MOOD_FACES_LEVER, PHRASE_COUNT_LEVER,
  PRACTICE_NOTE, RHYME_MODEL_LEVER, SYLLABLE_BEATS_LEVER, endWords, figureModels, modelPoem, moodFace, poetryLeverFacts,
  poetryLevers, practiceAssignment, practiceFor, rhymeModel, syllableBeats, type PoetryPractice,
} from './poetryLabLevers';

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
   * the RhymeHunt fork must never read it. Absent ⇒ full-support legacy render;
   * 'easy' renders byte-identical to legacy.
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
// Props & Types
// ============================================================================

interface PoetryLabProps {
  data: PoetryLabData;
  className?: string;
  runtimePlanItemId?: string;
  runtimeEvalMode?: string;
}

type PoetryController = (options: ProgressOptions<PoetryItem>) => Progress;

type PoetryLabSurfaceProps = PoetryLabProps & {
  tutorOwned: boolean;
  useController: PoetryController;
};

type AnalysisPhase = 'mood' | 'figurative' | 'rhyme' | 'review';
type CompositionPhase = 'write' | 'review';

// ============================================================================
// Constants
// ============================================================================

const RHYME_COLORS: Record<string, string> = {
  A: 'text-blue-300 bg-blue-500/20',
  B: 'text-rose-300 bg-rose-500/20',
  C: 'text-emerald-300 bg-emerald-500/20',
  D: 'text-amber-300 bg-amber-500/20',
};

const PHASE_NEXT_LABELS: Record<AnalysisPhase, string> = {
  mood: 'Next: Mood',
  figurative: 'Next: Find Figurative Language',
  rhyme: 'Next: Rhyme Scheme',
  review: 'Review',
};

// Phases whose data is absent are skipped entirely (RF-2): a K draw
// legitimately has zero figurative instances, and a partial generation must
// degrade to the phases the content actually supports instead of dead-ending
// on an unsatisfiable Next gate.
const computeAnalysisPhases = (d: PoetryLabData): AnalysisPhase[] => {
  const phases: AnalysisPhase[] = [];
  if ((d.moodOptions?.length ?? 0) > 0) phases.push('mood');
  if ((d.figurativeInstances?.length ?? 0) > 0) phases.push('figurative');
  if ((d.rhymeSchemeOptions?.length ?? 0) > 0 && !!d.rhymeScheme) phases.push('rhyme');
  phases.push('review');
  return phases;
};

const REVIEW_GRID_COLS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
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

/** Rhyme Hunt never reads `supportTier` (band contract). */
const RhymeHunt: React.FC<PoetryLabSurfaceProps> = ({ data, className, runtimePlanItemId, tutorOwned, useController }) => {
  const rounds = data.rounds ?? [];
  const items = useMemo(() => poetryItems(data), [data]);
  const workspace = useRef<TeachingWorkspace | null>(null);
  const stableInstanceIdRef = useRef(data.instanceId || `poetry-lab-${Date.now()}`);
  const resolvedInstanceId = data.instanceId || stableInstanceIdRef.current;
  const introducedRef = useRef(false);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [selectedWords, setSelectedWords] = useState<string[]>([]);
  const [wrongWords, setWrongWords] = useState<string[]>([]);
  const [correctWords, setCorrectWords] = useState<string[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [showScriptedSummary, setShowSummary] = useState(false);
  const [submittedScore, setSubmittedScore] = useState<number | null>(null);
  const startTimeRef = useRef(Date.now());

  const clearRound = () => {
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    setSelectedWords([]);
    setWrongWords([]);
    setCorrectWords([]);
    setIsLocked(false);
  };
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const progress = useController({
    challenges: items,
    getChallengeId: (item) => item.id,
    instanceId: resolvedInstanceId, objectiveId: data.objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: (item) => workspaceAssignment(item, data),
    // Workspace path: a fresh round and Try again both open with no card tapped (a practice round stays on Try again).
    onItemOpened: () => clearRound(),
    onFinished: (result) => finish.current(result),
  });
  const {
    currentIndex,
    currentAttempts,
    results: roundResults,
    isComplete: allRoundsComplete,
    advance: advanceProgress,
  } = progress;
  /** Workspace path: a checked pair stays closed until Try again or Next challenge on the shell. */
  const learnerBlocked = () => tutorOwned && progress.canAttempt === false;

  // In-item levers (`poetryLabLevers.ts`, workspace path only), keyed by the round they were pulled on, and the
  // practice round a simplify lever puts in place of this one until the observer returns to it.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<PoetryPractice | null>(null);
  const sessionRound = rounds[currentIndex];
  const sessionItem = items[currentIndex];
  const currentRound = practice?.item.round ?? sessionRound;
  const currentItem = practice?.item ?? sessionItem;
  const shownData = practice?.data ?? data;
  const pulledLevers = !practice && sessionItem && leverState.item === sessionItem.id ? leverState.pulled : [];
  const itemLevers = tutorOwned && !practice && !allRoundsComplete ? poetryLevers(sessionItem, data, pulledLevers) : [];
  const model = pulledLevers.includes(RHYME_MODEL_LEVER) ? rhymeModel(data) : null;
  const cards = useMemo(() => (currentRound ? rhymeCards(currentRound) : []), [currentRound]);
  const showSummary = tutorOwned ? allRoundsComplete || !!progress.practiceSummary : showScriptedSummary;

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

  const firstTryCorrect = roundResults.filter((result) => result.score === 100).length;
  const roundPoem = currentRound?.poemLines.join('\n') ?? '';
  const candidateWords = cards.map((candidate) => candidate.word).join(', ');
  const aiPrimitiveData = useMemo(() => ({
    title: data.title,
    gradeLevel: data.gradeLevel,
    mode: 'rhyme_hunt',
    currentRound: currentIndex + 1,
    roundsTotal: rounds.length,
    roundPoem,
    candidateWords,
    rhymeWordA: currentRound?.rhymeWordA ?? '',
    rhymeWordB: currentRound?.rhymeWordB ?? '',
    attempts: currentAttempts,
    firstTryCorrect,
  }), [
    data.title, data.gradeLevel, currentIndex, rounds.length, roundPoem,
    candidateWords, currentRound?.rhymeWordA, currentRound?.rhymeWordB,
    currentAttempts, firstTryCorrect,
  ]);

  // Its context carries the answer pair: never enabled with the tutor, and its sends are muted there.
  const ai = useLuminaAI({
    primitiveType: 'poetry-lab',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: data.gradeLevel,
    enabled: !tutorOwned,
  });
  const { isConnected, isAudioPlaying, activePrimitiveId } = ai;
  const aiSend = ai.sendText;
  const sendText = useCallback((text: string, options?: { silent?: boolean }) => {
    if (!tutorOwned) aiSend(text, options);
  }, [aiSend, tutorOwned]);

  const readRound = useCallback((round: RhymeHuntRound, first: boolean) => {
    const stimulus = `Read this poem aloud slowly and with playful prosody, emphasizing every line-ending word equally: `
      + `"${round.poemLines.join(' / ')}" `
      + `Then say only: "Tap the two words that rhyme." Never name, repeat as a pair, or otherwise reveal the answer words.`;
    if (first) {
      sendText(
        `[ACTIVITY_START] Round 1 of ${rounds.length}. Frame this once: `
        + `"We're going to listen to a little poem and find the two words that rhyme." ${stimulus}`,
        { silent: true },
      );
      return;
    }
    sendText(
      `[ROUND_START] Round ${currentIndex + 1} of ${rounds.length}. ${stimulus}`,
      { silent: true },
    );
  }, [currentIndex, rounds.length, sendText]);

  useEffect(() => {
    if (tutorOwned || !isConnected || !currentRound || introducedRef.current) return;
    introducedRef.current = true;
    readRound(currentRound, true);
  }, [tutorOwned, isConnected, currentRound, readRound]);

  useEffect(() => {
    if (tutorOwned || !isConnected || !currentRound || !introducedRef.current || currentIndex === 0) return;
    readRound(currentRound, false);
    // One full-data tutor turn per advance. readRound intentionally owns it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  // Scripted path: a new round opens blank (the workspace path clears in onItemOpened).
  useEffect(() => {
    if (tutorOwned) return;
    clearRound();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRound?.id]);

  useEffect(() => () => {
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
  }, []);

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

  // Scripted path: one submission when every round is found.
  useEffect(() => {
    if (tutorOwned || !allRoundsComplete || hasSubmittedEvaluation) return;
    const roundsFirstTry = roundResults.filter((result) => result.score === 100).length;
    const score = rounds.length > 0 ? Math.round((roundsFirstTry / rounds.length) * 100) : 0;
    setSubmittedScore(score);
    submitEvaluation(score >= 50, score, buildMetrics(roundsFirstTry), {
      durationMs: Date.now() - startTimeRef.current,
      roundResults,
    });
    sendText(
      `[ACTIVITY_COMPLETE] [RHYME_CORRECT] The final rhyme pair was found. `
      + `${roundsFirstTry} of ${rounds.length} rounds were correct on the first try. `
      + `Give one short, joyful closing celebration without naming any answer pair.`,
      { silent: true },
    );
    setShowSummary(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorOwned, allRoundsComplete, hasSubmittedEvaluation, roundResults, rounds.length, sendText, submitEvaluation]);

  // Workspace path, under a lesson's evaluation provider only: the scored session.
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
    const firstTry = currentAttempts === 0;
    progress.commitCheck(describePoetryWork(currentItem, shownData, view), correct, correct ? undefined : poetryMiss(currentItem, shownData, view));
    // A practice round records nothing; the shared lifecycle brings the session round back.
    if (practice) { if (correct) { setCorrectWords(nextSelection); SoundManager.playCorrect(); } else { setWrongWords(nextSelection); SoundManager.playIncorrect(); } return; }
    if (correct) {
      setCorrectWords(nextSelection);
      SoundManager.playCorrect();
      progress.mergeResult({ challengeId: sessionRound.id, correct: true, attempts: currentAttempts + 1, score: firstTry ? 100 : 0 });

      const isFinal = currentIndex === rounds.length - 1;
      if (!isFinal && (currentIndex === 0 || currentAttempts > 0)) {
        sendText(
          `[RHYME_CORRECT] The student found the rhyming pair${currentAttempts > 0 ? ' after a comeback' : ' on the first round'}. `
          + `Celebrate in one brief sentence without saying either answer word.`,
          { silent: true },
        );
      }
      // The runtime advances the workspace path.
      if (!isFinal && !tutorOwned) {
        transitionTimerRef.current = setTimeout(() => advanceProgress(), 900);
      }
      return;
    }

    setWrongWords(nextSelection);
    SoundManager.playIncorrect();
    sendText(
      `[RHYME_MISS] The student tapped "${nextSelection[0]}" and "${nextSelection[1]}" on attempt ${currentAttempts + 1}. `
      + `Stretch those two endings slowly and ask whether they sound the same. Do not name or hint another candidate.`,
      { silent: true },
    );
    // Workspace path: the pair stays marked until Try again.
    if (!tutorOwned) {
      transitionTimerRef.current = setTimeout(() => {
        setSelectedWords([]);
        setWrongWords([]);
        setIsLocked(false);
      }, 600);
    }
  };

  // Workspace path: what the tutor and the observer are shown, republished every render. W1: no demonstration.
  useLayoutEffect(() => {
    if (!tutorOwned || !currentItem || allRoundsComplete) return;
    const scene = workspaceScene(currentItem, shownData, { ...EMPTY_VIEW, picked: selectedWords });
    const levers = itemLevers;
    const onScreen = practice ? '' : poetryLeverFacts(sessionItem, data, pulledLevers);
    workspace.current = {
      ...scene,
      facts: { ...scene.facts, ...(onScreen ? { onScreen } : {}), ...(practice ? { practice: PRACTICE_NOTE } : {}) },
      levers,
      pullLever: (id: string) => {
        const lever = levers.find((l) => l.id === id);
        if (practice || !lever) return `No lever ${id} on this round.`;
        if (lever.pulled) return `${id} is already on screen.`;
        const next = { item: sessionItem.id, pulled: [...pulledLevers, id] };
        if (lever.kind === 'simplify') {
          const easier = practiceFor(sessionItem, data);
          if (!easier) return 'There is no practice round for this one.';
          setLeverState(next); setPractice(easier); clearRound();
          return { practice: practiceAssignment(easier) };
        }
        setLeverState(next);
        return true as const;
      },
      // Back to the session round, blank: the practice round is not the learner's work on it.
      endPractice: () => { setPractice(null); clearRound(); },
    };
  });

  // ── Pip shared surface ───────────────────────────────────────────
  // A projection of this item's check state, the tutor's speech on it, and
  // the child's touches; Pip points only at the workspace as a whole and never
  // chooses, checks, or advances.
  const pip = useWorkspacePipSurface({
    instanceId: resolvedInstanceId,
    scopeId: allRoundsComplete || hasSubmittedEvaluation ? null : currentRound?.id ?? null,
    label: 'The poem and the word cards',
    solved: correctWords.length === 2,
    tutorSpeaking: isAudioPlaying && activePrimitiveId === resolvedInstanceId,
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

  if (showSummary) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-5">
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedScore ?? progress.teachingResult?.accuracy ?? undefined}
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
        {pip.store && <div {...pip.dock} />}
        <div {...pip.workspace} className="space-y-5">
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

        </div>

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
// Analysis and composition on the teaching workspace
// ============================================================================

/**
 * The workspace path for analysis and composition: each analysis phase, and the poem, is one checked item
 * (`poetryLabWorkspace.ts`). Every word of the poem is a button on the figurative item, so the phrases are not
 * marked by being the only tappable text. The scripted path below (`LegacyPoetryLab`) is unchanged.
 */
const PoetryWorkspaceBoard: React.FC<PoetryLabSurfaceProps> = ({ data, className, runtimePlanItemId, useController }) => {
  const { title, gradeLevel, mode, supportTier, templateType } = data;
  const items = useMemo(() => poetryItems(data), [data]);
  const workspace = useRef<TeachingWorkspace | null>(null);
  const aiContext = useLuminaAIContext();
  const stableId = useRef(data.instanceId || `poetry-lab-${Date.now()}`);
  const resolvedInstanceId = data.instanceId || stableId.current;
  const startTime = useRef(Date.now());

  // Support tiers withdraw display help only, as on the scripted path.
  const showFigurativeTargetCount = !supportTier || supportTier === 'easy';
  const showRhymePreview = supportTier !== 'hard';
  const colorRhymePreview = !supportTier || supportTier === 'easy';
  const showSyllableChips = supportTier !== 'hard';
  const judgeSyllableChips = !supportTier || supportTier === 'easy';

  const [mood, setMood] = useState<string | null>(null);
  const [tapped, setTapped] = useState<string[]>([]);
  const [scheme, setScheme] = useState<string | null>(null);
  const [lines, setLines] = useState<string[]>(() => Array(lineCount(data)).fill(''));
  const [verdict, setVerdict] = useState<boolean | null>(null);
  // In-item levers (`poetryLabLevers.ts`), keyed by the item they were pulled on, and the practice item a simplify
  // lever puts in place of this one until the observer returns to it.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<PoetryPractice | null>(null);
  const clearWork = (d: PoetryLabData, keepLines: boolean) => {
    setVerdict(null); setMood(null); setTapped([]); setScheme(null);
    if (!keepLines) setLines(Array(lineCount(d)).fill(''));
  };

  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const progress = useController({
    challenges: items,
    getChallengeId: (item) => item.id,
    instanceId: resolvedInstanceId, objectiveId: data.objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: (item) => workspaceAssignment(item, data),
    // A fresh item and Try again both open blank; a poem's lines are kept on Try again.
    // Try again on a practice item keeps it; back from one (`endPractice` first) opens the session item's lines.
    onItemOpened: (_index, retry) => clearWork(retry ? practice?.data ?? data : data, retry),
    onFinished: (result) => finish.current(result),
  });
  const sessionItem = items[progress.currentIndex];
  const done = progress.isComplete || !!progress.practiceSummary;
  const item = practice?.item ?? sessionItem;
  const shown = practice?.data ?? data;
  const tc = shown.templateConstraints;
  const words = useMemo(() => poemWords(shown), [shown]);
  const moods = useMemo(() => moodChoices(shown), [shown]);
  const schemes = useMemo(() => schemeChoices(shown), [shown]);
  const pulled = !practice && sessionItem && leverState.item === sessionItem.id ? leverState.pulled : [];
  const itemLevers = !practice && !done ? poetryLevers(sessionItem, data, pulled, { figurativeCount: showFigurativeTargetCount }) : [];
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
    const scene = workspaceScene(item, shown, view, { figurativeCount: showFigurativeTargetCount });
    const levers = itemLevers;
    const onScreen = practice ? '' : poetryLeverFacts(sessionItem, data, pulled, lines);
    workspace.current = {
      ...scene,
      facts: { ...scene.facts, ...(onScreen ? { onScreen } : {}), ...(practice ? { practice: PRACTICE_NOTE } : {}) },
      levers,
      pullLever: (id: string) => {
        const lever = levers.find((l) => l.id === id);
        if (practice || !lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already on screen.`;
        const next = { item: sessionItem.id, pulled: [...pulled, id] };
        if (lever.kind === 'simplify') {
          const easier = practiceFor(sessionItem, data);
          if (!easier) return 'There is no practice item for this one.';
          setLeverState(next); setPractice(easier); clearWork(easier.data, false);
          return { practice: practiceAssignment(easier) };
        }
        setLeverState(next);
        return true as const;
      },
      // Back to the full item, blank: the practice is not the learner's work on it.
      endPractice: () => { setPractice(null); clearWork(data, false); },
    };
  });

  const pip = useWorkspacePipSurface({
    instanceId: resolvedInstanceId, scopeId: done || !item ? null : item.id,
    label: mode === 'composition' ? 'The poem you are writing' : 'The poem', solved: verdict === true,
    tutorSpeaking: aiContext.isAudioPlaying
      && (aiContext.sessionMode !== 'lesson' || aiContext.activePrimitiveId === resolvedInstanceId),
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
          <PhaseSummaryPanel phases={phaseResults} overallScore={submittedResult?.score ?? progress.teachingResult?.accuracy}
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
            {pip.store && <div {...pip.dock} />}
            <div {...pip.workspace} className="space-y-4">
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
            </div>
          </>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

// ============================================================================
// Scripted analysis and composition
// ============================================================================

const LegacyPoetryLab: React.FC<PoetryLabProps> = ({ data, className }) => {
  const {
    title, gradeLevel, mode, poem, poemLines, correctMood,
    figurativeInstances, rhymeScheme,
    templateType, compositionPrompt, templateConstraints,
    instanceId, skillId, subskillId, objectiveId, exhibitId, onEvaluationSubmit,
    supportTier,
  } = data;
  const moodOptions = useMemo(() => moodChoices(data), [data]);
  const rhymeSchemeOptions = useMemo(() => schemeChoices(data), [data]);

  // ── Support-tier render gates — scaffolding WITHDRAWAL only. Content,
  // options, and checking are tier-invariant. Absent tier ⇒ every gate takes
  // its full-support legacy value; 'easy' renders byte-identical to legacy.
  // rhyme_hunt never reaches this fork (band/mode gate wins over tier).
  // L1 — figurative count disclosure (easy: "(N to find)" + "Found: N / M";
  //      medium: "Found: N" only; hard: no counts — the student decides when
  //      the hunt is done; the Next gate and scoring read foundFigurative
  //      independently, so no phase can dead-end).
  const showFigurativeTargetCount = !supportTier || supportTier === 'easy';
  const showFigurativeFoundCount = supportTier !== 'hard';
  // L2 — rhyme-scheme live overlay (easy: colored-letter preview per selection;
  //      medium: letters without color coding; hard: no preview — bare poem).
  const showRhymePreview = supportTier !== 'hard';
  const colorRhymePreview = !supportTier || supportTier === 'easy';
  // L3 — composition syllable feedback (easy: live green/red N/M chips +
  //      placeholder targets; medium: neutral count chip, targets stay in the
  //      hint line; hard: no per-line chips or placeholder targets — the
  //      constraints stay stated once in the prompt panel, which is task
  //      identity and never withdrawn).
  const showSyllableChips = supportTier !== 'hard';
  const judgeSyllableChips = !supportTier || supportTier === 'easy';
  const showPlaceholderTargets = !supportTier || supportTier === 'easy';

  // Analysis state
  const analysisPhases = useMemo(() => computeAnalysisPhases(data), [data]);
  const [analysisPhase, setAnalysisPhase] = useState<AnalysisPhase>(() => computeAnalysisPhases(data)[0]);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [foundFigurative, setFoundFigurative] = useState<Set<number>>(new Set());
  const [selectedRhymeScheme, setSelectedRhymeScheme] = useState<string | null>(null);
  const [elementsExplored, setElementsExplored] = useState(0);

  // Composition state
  const [compositionPhase, setCompositionPhase] = useState<CompositionPhase>('write');
  const [compositionLines, setCompositionLines] = useState<string[]>(
    Array(templateConstraints?.lineCount || 3).fill('')
  );

  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
  } = usePrimitiveEvaluation<PoetryLabMetrics>({
    primitiveType: 'poetry-lab',
    instanceId: instanceId || `poetry-lab-${Date.now()}`,
    skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // Analysis phase navigation
  const phaseIndex = analysisPhases.indexOf(analysisPhase);
  const nextAnalysis = () => {
    if (phaseIndex < analysisPhases.length - 1) {
      SoundManager.navigate();
      setAnalysisPhase(analysisPhases[phaseIndex + 1]);
      setElementsExplored(prev => prev + 1);
    }
  };
  const prevAnalysis = () => {
    if (phaseIndex > 0) {
      SoundManager.navigate();
      setAnalysisPhase(analysisPhases[phaseIndex - 1]);
    }
  };

  const nextPhaseLabel = PHASE_NEXT_LABELS[analysisPhases[phaseIndex + 1] ?? 'review'];
  const hasPrevPhase = phaseIndex > 0;

  // Toggle figurative instance
  const toggleFigurative = useCallback((index: number) => {
    setFoundFigurative(prev => {
      const next = new Set(Array.from(prev));
      if (next.has(index)) { next.delete(index); SoundManager.toggle(false); }
      else { next.add(index); SoundManager.toggle(true); }
      return next;
    });
  }, []);

  // Render poem with clickable figurative instances
  const renderPoemWithHighlights = useMemo(() => {
    if (!poem || !figurativeInstances || figurativeInstances.length === 0) {
      return (poemLines || []).map((line, i) => (
        <p key={i} className="text-slate-200 text-sm">{line}</p>
      ));
    }

    const sorted = [...figurativeInstances].map((inst, origIdx) => ({ ...inst, origIdx }))
      .sort((a, b) => a.startIndex - b.startIndex);
    const elements: React.ReactNode[] = [];
    let lastEnd = 0;

    sorted.forEach((inst) => {
      if (inst.startIndex > lastEnd) {
        elements.push(<span key={`t-${inst.origIdx}`} className="text-slate-200">{poem.slice(lastEnd, inst.startIndex)}</span>);
      }
      const isFound = foundFigurative.has(inst.origIdx);
      elements.push(
        <span
          key={`f-${inst.origIdx}`}
          onClick={() => analysisPhase === 'figurative' ? toggleFigurative(inst.origIdx) : undefined}
          className={`rounded px-0.5 transition-colors ${
            analysisPhase === 'figurative' ? 'cursor-pointer hover:bg-violet-400/20' : ''
          } ${isFound ? 'bg-violet-500/20 text-violet-200 underline underline-offset-2' : 'text-slate-200'}`}
        >
          {poem.slice(inst.startIndex, inst.endIndex)}
        </span>
      );
      lastEnd = inst.endIndex;
    });
    if (lastEnd < poem.length) {
      elements.push(<span key="t-end" className="text-slate-200">{poem.slice(lastEnd)}</span>);
    }
    return <p className="text-sm leading-relaxed whitespace-pre-line">{elements}</p>;
  }, [poem, poemLines, figurativeInstances, foundFigurative, analysisPhase, toggleFigurative]);

  // Render rhyme scheme overlay on lines. L2 medium withdraws the color coding
  // (letters render in one neutral style so same-letter lines no longer
  // visually pair themselves); hard never calls this — the panel is gated off.
  const renderRhymeLines = () => {
    if (!poemLines || !selectedRhymeScheme) return null;
    return poemLines.map((line, i) => {
      const letter = selectedRhymeScheme[i] || '';
      const colorClass = colorRhymePreview
        ? (RHYME_COLORS[letter] || 'text-slate-500')
        : 'text-slate-300 bg-slate-500/20';
      return (
        <div key={i} className="flex items-center gap-2">
          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${colorClass}`}>{letter}</span>
          <span className="text-slate-200 text-sm">{line}</span>
        </div>
      );
    });
  };

  // Submit analysis evaluation — score only over the phases actually present,
  // so a draw without (say) figurative language isn't penalized for a phase
  // the student never saw.
  const submitAnalysis = useCallback(() => {
    if (hasSubmittedEvaluation) return;
    const hasMood = analysisPhases.includes('mood');
    const hasFig = analysisPhases.includes('figurative');
    const hasRhyme = analysisPhases.includes('rhyme');

    const figTotal = figurativeInstances?.length || 0;
    const figFound = foundFigurative.size;
    const rhymeCorrect = selectedRhymeScheme === rhymeScheme;
    const moodCorrect = selectedMood === correctMood;

    // Base weights: mood 25, figurative 40, rhyme 35 — normalized over present phases
    const moodWeight = hasMood ? 25 : 0;
    const figWeight = hasFig ? 40 : 0;
    const rhymeWeight = hasRhyme ? 35 : 0;
    const totalWeight = moodWeight + figWeight + rhymeWeight;

    const earned =
      (moodCorrect ? moodWeight : 0)
      + (figTotal > 0 ? (figFound / figTotal) * figWeight : 0)
      + (rhymeCorrect ? rhymeWeight : 0);
    const score = totalWeight > 0 ? Math.round((earned / totalWeight) * 100) : 100;

    const metrics: PoetryLabMetrics = {
      type: 'poetry-lab',
      mode: 'analysis',
      figurativeLanguageIdentified: figFound,
      figurativeLanguageTotal: figTotal,
      rhymeSchemeCorrect: rhymeCorrect,
      syllableCountAccurate: true,
      elementsExplored: elementsExplored + 1,
      poemCompleted: false,
      templateType: templateType || 'free-verse',
    };

    submitEvaluation(score >= 50, score, metrics, { selectedMood, foundFigurative: Array.from(foundFigurative), selectedRhymeScheme });
  }, [hasSubmittedEvaluation, analysisPhases, figurativeInstances, foundFigurative, selectedRhymeScheme, rhymeScheme, selectedMood, correctMood, elementsExplored, templateType, submitEvaluation]);

  // Submit composition evaluation
  const submitComposition = useCallback(() => {
    if (hasSubmittedEvaluation) return;
    const lines = compositionLines.filter(l => l.trim());
    const poemComplete = lines.length >= (templateConstraints?.lineCount || 1);

    let syllableAccurate = true;
    if (templateConstraints?.syllablesPerLine) {
      syllableAccurate = templateConstraints.syllablesPerLine.every((target, i) => {
        const actual = countSyllables(compositionLines[i] || '');
        return Math.abs(actual - target) <= 1;
      });
    }

    const score = poemComplete ? (syllableAccurate ? 85 : 65) : 30;

    const metrics: PoetryLabMetrics = {
      type: 'poetry-lab',
      mode: 'composition',
      figurativeLanguageIdentified: 0,
      figurativeLanguageTotal: 0,
      rhymeSchemeCorrect: false,
      syllableCountAccurate: syllableAccurate,
      elementsExplored: 0,
      poemCompleted: poemComplete,
      templateType: templateType || 'free-verse',
    };

    submitEvaluation(score >= 50, score, metrics, { compositionLines });
  }, [hasSubmittedEvaluation, compositionLines, templateConstraints, templateType, submitEvaluation]);

  // Render progress
  const renderProgress = (phases: string[], current: string) => (
    <div className="flex items-center gap-2 mb-4">
      {phases.map((phase, i) => {
        const isActive = phase === current;
        const phaseIdx = phases.indexOf(current);
        const isCompleted = i < phaseIdx;
        return (
          <React.Fragment key={phase}>
            {i > 0 && <div className={`h-0.5 w-6 ${isCompleted || isActive ? 'bg-emerald-500/60' : 'bg-slate-600/40'}`} />}
            <div className={`px-2 py-1 rounded text-xs font-medium border capitalize ${
              isCompleted ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
              : isActive ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
              : 'bg-slate-700/20 border-slate-600/30 text-slate-500'
            }`}>
              {phase}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );

  // ============================================================================
  // ANALYSIS MODE
  // ============================================================================

  const reviewPanelCount = (analysisPhases.includes('mood') ? 1 : 0)
    + (analysisPhases.includes('figurative') ? 1 : 0)
    + (analysisPhases.includes('rhyme') ? 1 : 0);

  const renderAnalysis = () => (
    <div className="space-y-4">
      {renderProgress(analysisPhases, analysisPhase)}

      {/* Poem display — the readable poem surface; clickable spans stay bespoke */}
      <LuminaPanel className="font-serif">
        {analysisPhase === 'figurative' ? renderPoemWithHighlights : (
          (poemLines || []).map((line, i) => <p key={i} className="text-slate-200 text-sm">{line}</p>)
        )}
      </LuminaPanel>

      {/* Phase: Mood */}
      {analysisPhase === 'mood' && (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">What mood or feeling does this poem create?</p>
          <div className="flex flex-wrap gap-2">
            {(moodOptions || []).map(mood => (
              <button key={mood} onClick={() => { SoundManager.select(); setSelectedMood(mood); }}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
                  selectedMood === mood
                    ? `${accentSoftBg.purple} ${accentSoftBorder.purple} ${accentText.purple}`
                    : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                }`}>
                {mood}
              </button>
            ))}
          </div>
          <div className="flex justify-end">
            <LuminaButton tone="primary" onClick={nextAnalysis} disabled={!selectedMood}>
              {nextPhaseLabel}
            </LuminaButton>
          </div>
        </div>
      )}

      {/* Phase: Figurative Language — L1 gates the count disclosure only; the
          Next gate and scoring read foundFigurative independently at all tiers */}
      {analysisPhase === 'figurative' && (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">Tap the figurative language in the poem{showFigurativeTargetCount ? ` (${figurativeInstances?.length || 0} to find)` : ''}:</p>
          {showFigurativeFoundCount && (
            <p className="text-xs text-slate-400">Found: {foundFigurative.size}{showFigurativeTargetCount ? ` / ${figurativeInstances?.length || 0}` : ''}</p>
          )}
          <div className={`flex ${hasPrevPhase ? 'justify-between' : 'justify-end'}`}>
            {hasPrevPhase && <LuminaButton onClick={prevAnalysis}>Back</LuminaButton>}
            <LuminaButton tone="primary" onClick={nextAnalysis} disabled={foundFigurative.size === 0}>
              {nextPhaseLabel}
            </LuminaButton>
          </div>
        </div>
      )}

      {/* Phase: Rhyme Scheme */}
      {analysisPhase === 'rhyme' && (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">What is the rhyme scheme of this poem?</p>
          {showRhymePreview && selectedRhymeScheme && (
            <LuminaPanel className="space-y-1">
              {renderRhymeLines()}
            </LuminaPanel>
          )}
          <div className="flex flex-wrap gap-2">
            {(rhymeSchemeOptions || []).map(scheme => (
              <button key={scheme} onClick={() => setSelectedRhymeScheme(scheme)}
                className={`px-3 py-1.5 rounded-lg text-sm font-mono border transition-all ${
                  selectedRhymeScheme === scheme
                    ? `${accentSoftBg.blue} ${accentSoftBorder.blue} ${accentText.blue}`
                    : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                }`}>
                {scheme}
              </button>
            ))}
          </div>
          <div className={`flex ${hasPrevPhase ? 'justify-between' : 'justify-end'}`}>
            {hasPrevPhase && <LuminaButton onClick={prevAnalysis}>Back</LuminaButton>}
            <LuminaButton tone="primary" onClick={nextAnalysis} disabled={!selectedRhymeScheme}>
              {nextPhaseLabel}
            </LuminaButton>
          </div>
        </div>
      )}

      {/* Phase: Review */}
      {analysisPhase === 'review' && (
        <div className="space-y-3">
          {reviewPanelCount > 0 && (
            <div className={`grid gap-2 ${REVIEW_GRID_COLS[reviewPanelCount] || 'grid-cols-3'}`}>
              {analysisPhases.includes('mood') && (
                <LuminaPanel className="p-2 text-center">
                  <p className="text-xs text-slate-500">Mood</p>
                  {/* F1: correctness stays NEUTRAL until submitAnalysis has run
                      (at every tier) — the pre-submit emerald reveal plus the
                      Edit path was a free guess-and-check loop */}
                  <p className={`text-sm font-medium ${hasSubmittedEvaluation && selectedMood === correctMood ? 'text-emerald-300' : 'text-slate-300'}`}>{selectedMood}</p>
                </LuminaPanel>
              )}
              {analysisPhases.includes('figurative') && (
                <LuminaPanel className="p-2 text-center">
                  <p className="text-xs text-slate-500">Figurative</p>
                  <p className="text-sm font-medium text-slate-300">{foundFigurative.size}/{figurativeInstances?.length || 0}</p>
                </LuminaPanel>
              )}
              {analysisPhases.includes('rhyme') && (
                <LuminaPanel className="p-2 text-center">
                  <p className="text-xs text-slate-500">Rhyme</p>
                  {/* F1: neutral until submitted — same leak class as mood above */}
                  <p className={`text-sm font-mono font-medium ${hasSubmittedEvaluation && selectedRhymeScheme === rhymeScheme ? 'text-emerald-300' : 'text-slate-300'}`}>{selectedRhymeScheme}</p>
                </LuminaPanel>
              )}
            </div>
          )}
          {!hasSubmittedEvaluation ? (
            <div className={`flex ${hasPrevPhase ? 'justify-between' : 'justify-end'}`}>
              {hasPrevPhase && <LuminaButton onClick={prevAnalysis}>Edit</LuminaButton>}
              <LuminaActionButton action="check" onClick={submitAnalysis}>Submit</LuminaActionButton>
            </div>
          ) : (
            <LuminaFeedbackCard status="correct" label="Poetry Analysis Complete!">
              Great work breaking down the elements of this poem.
            </LuminaFeedbackCard>
          )}
        </div>
      )}
    </div>
  );

  // ============================================================================
  // COMPOSITION MODE
  // ============================================================================

  const renderComposition = () => (
    <div className="space-y-4">
      {renderProgress(['write', 'review'], compositionPhase)}

      <LuminaPanel>
        <p className="text-sm text-slate-300">{compositionPrompt}</p>
        {templateConstraints?.syllablesPerLine && (
          <p className="text-xs text-slate-500 mt-1">Syllables per line: {templateConstraints.syllablesPerLine.join('-')}</p>
        )}
        {templateConstraints?.acrosticWord && (
          <p className="text-xs text-slate-500 mt-1">Acrostic word: <span className={`font-bold ${accentText.purple}`}>{templateConstraints.acrosticWord}</span></p>
        )}
      </LuminaPanel>

      {compositionPhase === 'write' && (
        <div className="space-y-2">
          {compositionLines.map((line, i) => {
            const syllables = countSyllables(line);
            const targetSyllables = templateConstraints?.syllablesPerLine?.[i];
            const acrosticLetter = templateConstraints?.acrosticWord?.[i];
            return (
              <div key={i} className="flex items-center gap-2">
                {/* Acrostic letter chips are task identity — never tier-gated */}
                {acrosticLetter && (
                  <span className="w-6 h-6 rounded bg-violet-500/20 text-violet-300 text-sm font-bold flex items-center justify-center">{acrosticLetter}</span>
                )}
                <LuminaInput
                  value={line}
                  onChange={e => {
                    const next = [...compositionLines];
                    next[i] = e.target.value;
                    setCompositionLines(next);
                  }}
                  placeholder={`Line ${i + 1}${showPlaceholderTargets && targetSyllables ? ` (${targetSyllables} syllables)` : ''}...`}
                  className="flex-1 text-sm"
                />
                {/* L3: easy = judged green/red N/M chip; medium = neutral live
                    count only (target stays in the hint line); hard = no chip.
                    submitComposition recomputes syllables itself either way. */}
                {targetSyllables !== undefined && showSyllableChips && (
                  judgeSyllableChips ? (
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      Math.abs(syllables - targetSyllables) <= 1 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                    }`}>
                      {syllables}/{targetSyllables}
                    </span>
                  ) : (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-slate-500/20 text-slate-300">
                      {syllables}
                    </span>
                  )
                )}
              </div>
            );
          })}
          <div className="flex justify-end">
            <LuminaButton tone="primary" onClick={() => setCompositionPhase('review')}
              disabled={!compositionLines.some(l => l.trim())}>
              Review
            </LuminaButton>
          </div>
        </div>
      )}

      {compositionPhase === 'review' && (
        <div className="space-y-3">
          {/* The composed poem surface — the student's writing artifact stays bespoke */}
          <div className="rounded-lg bg-violet-500/10 border border-violet-500/30 p-4 font-serif">
            {compositionLines.map((line, i) => (
              <p key={i} className="text-slate-200 text-sm">{line || <span className="italic text-slate-600">Empty line</span>}</p>
            ))}
          </div>
          {!hasSubmittedEvaluation ? (
            <div className="flex justify-between">
              <LuminaButton onClick={() => setCompositionPhase('write')}>Edit</LuminaButton>
              <LuminaActionButton action="check" onClick={submitComposition}>Finish</LuminaActionButton>
            </div>
          ) : (
            <LuminaFeedbackCard status="correct" label="Poem Complete!">
              You wrote and shaped your own poem — nice work bringing it together.
            </LuminaFeedbackCard>
          )}
        </div>
      )}
    </div>
  );

  // ============================================================================
  // Main Render
  // ============================================================================

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
            <div className="flex items-center gap-2">
              <LuminaBadge className="text-xs">Grade {gradeLevel}</LuminaBadge>
              <LuminaBadge accent="purple" className="text-xs capitalize">{mode}</LuminaBadge>
              {mode === 'composition' && templateType && (
                <LuminaBadge accent="pink" className="text-xs capitalize">{templateType}</LuminaBadge>
              )}
            </div>
          </div>
        </div>
      </LuminaCardHeader>

      <LuminaCardContent>
        {mode === 'analysis' ? renderAnalysis() : renderComposition()}
      </LuminaCardContent>
    </LuminaCard>
  );
};

/**
 * One surface per mount, keyed by `withWorkspaceController`: Rhyme Hunt swaps its controller on both paths;
 * analysis and composition render the workspace board with the tutor and the scripted lab without it.
 */
const PoetryLabSurface: React.FC<PoetryLabSurfaceProps> = (props) => {
  if (props.data.mode === 'rhyme_hunt') return <RhymeHunt {...props} />;
  if (props.tutorOwned) return <PoetryWorkspaceBoard {...props} />;
  return <LegacyPoetryLab data={props.data} className={props.className} />;
};

// The workspace path never mounts the scripted progress, whose timers would compete with the observer.
const PoetryLab = withWorkspaceController<PoetryLabProps, ProgressOptions<PoetryItem>, Progress>(
  'poetry-lab', PoetryLabSurface, useScriptedProgress, useWorkspaceProgressFor('poetry-lab'));

export default PoetryLab;
