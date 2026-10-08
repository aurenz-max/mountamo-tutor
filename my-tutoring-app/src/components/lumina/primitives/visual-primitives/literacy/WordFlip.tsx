'use client';

/**
 * WordFlip — the child sees a counted-picture frame (one 🐕 "dog" → three 🐕🐕🐕 ___?),
 * may tap the one-thing card to hear its word, and SAYS THE NEW WORD ALOUD. It runs only
 * on the shared tutor/JEV teaching workspace (workspace rollout B2; the scripted speech
 * loop was retired, LA-14, user ruling 09-23: one path). The tutor teaches in its own
 * words, the observer judges the spoken word against the challenge's `answer`, and the
 * runtime owns progression. An unbound mount shows the shared "needs the tutor" card.
 *
 * WHY THERE ARE NO CHIPS (qa/di/BACKLOG.md item 16). Tapping "dogs" out of three printed
 * words is READING, which a child who cannot form a plural does correctly every time, and
 * a chip PRINTS THE ANSWER. The answer is spoken.
 *
 * ANSWER-LEAK RULE. The source word, its emoji and the frame are the stimulus and are
 * shown. The transformed word is the answer: the blank stays a blank until the word is
 * credited, and nothing on screen offers it.
 */

import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLuminaAIContext } from '@/contexts/LuminaAIContext';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaBadge,
  LuminaChallengeCounter,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { WordFlipMetrics } from '../../../evaluation/types';
import { SoundManager } from '../../../utils/SoundManager';
import { isPreReaderGrade } from '../../../utils/kindergartenMode';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { phaseResultsFromSummary } from '../../../hooks/usePhaseResults';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceRunner, type TeachingEvaluationResult }
  from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { countWord, countWordCapitalized } from './wordFlipScript';
import { flipAssignment, flipScene, isPluralFlip, sourceWordRequest } from './wordFlipWorkspace';
import { COMMON_IRREGULAR_LEVER, FAMILIAR_LEVER, FLIP_EMOJI, IRREGULAR_LEVER, RULE_LEVER, flipModelFor, leversOnScreen,
  practiceItemFor, wordFlipLevers } from './wordFlipLevers';
import { usePipSurface, usePipTargets } from '../../../pip/PipSurfaceContext';
import { wordFlipPipPose } from '../../../pip/wordFlipPipPose';
import WordBuildAffix from './WordBuildAffix';
import type { AffixBuildSummary, BuildPart } from './affixBuild';
import { inflectBuildRules, type InflectBuildItem } from './inflectBuild';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

// Grammar-transformation task identities. These four preserve the same honest
// counted one-to-many surface. Pronoun and tense flips require a different
// visual/script contract; article_choice remains off the spoken ladder.
export type WordFlipChallengeType =
  | 'plural_s'
  | 'plural_es'
  | 'plural_y'
  | 'irregulars'
  | 'past_ed'
  | 'past_irregular';

export interface WordFlipChallenge {
  id: string;
  type: WordFlipChallengeType;
  /** The source word shown in the frame — "dog" or "jump". */
  sourceWord: string;
  /**
   * The transformed word the student must PRODUCE ("dogs"). Derived by code
   * by code so it can never desync from the stimulus.
   */
  answer: string;
  /** Emoji picture of the noun/action. Repeated only on plural challenges. */
  emoji: string;
  /** How many on the many-side (2-5); present only for plural challenges. */
  count?: number;
}

export interface WordFlipData {
  title: string;
  /** Session-level mode; mixed means the per-challenge type is authoritative. */
  challengeType: WordFlipChallengeType | 'mixed' | 'build_inflect';
  /** 4-6 challenges. REQUIRED — assembled by the generator from Gemini's noun pool. Empty on the open build. */
  challenges: WordFlipChallenge[];
  gradeLevel?: string;
  /** `build_inflect` (open build, `inflectBuild.ts`): the learner makes words from base and ending cards. */
  task?: 'build_inflect';
  /** The build's board: base-word cards (`noun-`/`verb-` ids, emoji as meaning) and the four ending cards. */
  availableParts?: BuildPart[];
  /** The build's asks, code-written (`inflectAsksFor`). */
  buildItems?: InflectBuildItem[];
  /** config.difficulty: the easy tier asks for one word per item. */
  supportTier?: 'easy' | 'medium' | 'hard';

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<WordFlipMetrics>) => void;
}

interface WordFlipProps {
  data: WordFlipData;
  className?: string;
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted. */
  runtimeEvalMode?: string;
}

// ============================================================================
// Component
// ============================================================================

function WordFlipSurface({ data, className, runtimePlanItemId }: WordFlipProps) {
  const {
    title,
    challenges = [],
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const gradeLevel = data.gradeLevel ?? 'K';
  const ctx = useLuminaAIContext();
  const workspace = useRef<TeachingWorkspace | null>(null);

  const [wordTapped, setWordTapped] = useState(false);
  // In-item levers (`wordFlipLevers.ts`), keyed by the session item they were pulled on, and the easier practice
  // item a simplify lever put on screen in its place.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<WordFlipChallenge | null>(null);
  /** Visual only: clears the tapped-card highlight. Nothing here advances. */
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stableInstanceIdRef = useRef(instanceId || `word-flip-${Math.round(performance.now())}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;
  const isPreReader = isPreReaderGrade(gradeLevel);

  const evaluation = usePrimitiveEvaluation<WordFlipMetrics>({
    primitiveType: 'word-flip',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const finish = (summary: TeachingEvaluationResult) => {
    const outcomes = summary.outcomes;
    const attemptsCount = outcomes.reduce((s, o) => s + 1 + o.corrections, 0);
    const metrics: WordFlipMetrics = {
      type: 'word-flip',
      challengeType: data.challengeType,
      totalChallenges: challenges.length,
      correctCount: outcomes.filter(o => o.solved).length,
      attemptsCount,
      firstTryCount: outcomes.filter(o => o.solved && o.corrections === 0).length,
      hintsViewed: 0,
      overallAccuracy: summary.accuracy,
      averageAttemptsPerChallenge: outcomes.length ? attemptsCount / outcomes.length : 0,
    };
    const diagnosisEvidence = summary.accuracy < 60 ? summary.diagnosisEvidence : undefined;
    evaluation.submitResult(summary.accuracy >= 60, summary.accuracy, metrics,
      { outcomes, learningResponses: summary.learningResponses,
        ...(summary.teachingAttempts ? { teachingAttempts: summary.teachingAttempts, assistanceProvenance: summary.assistanceProvenance } : {}) },
      undefined, diagnosisEvidence);
  };

  const runner = useWorkspaceRunner<WordFlipChallenge>({
    primitiveId: 'word-flip',
    assignment: flipAssignment,
    items: challenges,
    workspace,
    objectiveId,
    planItemId: runtimePlanItemId,
    // The SESSION's mode, from the mount: a mount's identity must not change while the workspace owns it.
    instanceId: resolvedInstanceId,
    onFinished: finish,
    onItemOpened: () => setWordTapped(false),
  });
  const sessionItem = runner.currentItem;
  /** What is on screen: the practice item while a simplify lever holds it, else the session item. */
  const currentChallenge = practice ?? sessionItem;
  const currentIndex = runner.currentIndex;
  const pulledLevers = practice || leverState.item !== sessionItem?.id ? [] : leverState.pulled;
  const flipModel = sessionItem && pulledLevers.some(id => id === RULE_LEVER || id === IRREGULAR_LEVER)
    ? flipModelFor(sessionItem, challenges) : null;
  // The workspace shows its finish without an evaluation provider (the live host has none).
  const showSummary = evaluation.hasSubmitted || !!runner.practiceSummary;

  // ── Tap-to-hear — never withdrawn by band or tier ─────────────────
  // Asks for the ONE-THING word, for a child who does not recognise the emoji; never the
  // new word, which is the answer. Silent, so it is not a learner turn.
  const handleSayWord = useCallback(() => {
    if (!currentChallenge) return;
    SoundManager.tap();
    setWordTapped(true);
    ctx.sendText(sourceWordRequest(currentChallenge.sourceWord), { silent: true, author: 'host' });
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    tapTimerRef.current = setTimeout(() => setWordTapped(false), 1200);
  }, [ctx, currentChallenge]);

  // What the tutor and the observer are shown, republished every render.
  // W1 offers no demonstration targets and no presentation.
  useLayoutEffect(() => {
    if (!currentChallenge || !sessionItem) return;
    const levers = practice ? [] : wordFlipLevers(sessionItem, pulledLevers, challenges);
    const scene = flipScene(currentChallenge);
    const onScreen = leversOnScreen(currentChallenge, pulledLevers, challenges);
    workspace.current = { ...scene,
      facts: { ...scene.facts,
        ...(onScreen ? { levers_on_screen: onScreen } : {}),
        ...(practice ? { practice: 'An easier practice item on another word, ungraded. The full item comes back after it.' } : {}) },
      levers,
      // A synchronous commit (the workspace runs it inside flushSync): the screen changes before this returns.
      pullLever: id => {
        const lever = levers.find(l => l.id === id);
        if (!lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled.`;
        setLeverState({ item: sessionItem.id, pulled: [...pulledLevers, id] });
        if (id === FAMILIAR_LEVER || id === COMMON_IRREGULAR_LEVER) {
          const simpler = practiceItemFor(sessionItem, challenges);
          if (!simpler) return 'There is no easier item here.';
          setPractice(simpler);
          setWordTapped(false);
          return { practice: flipAssignment(simpler) };
        }
        return true;
      },
      endPractice: () => { setPractice(null); setWordTapped(false); },
    };
  });

  // ── Pip shared surface ───────────────────────────────────────────
  // A projection of the workspace's committed state and the child's own tap on the source
  // card; Pip never answers, judges, or moves to the next item.
  const pip = usePipTargets(currentChallenge?.id ?? null, runner.running);
  const pipStore = usePipSurface(() => {
    if (!pip.dock.current || !currentChallenge || showSummary) return null;
    const targets = pip.targets(undefined, (id) => (id === 'frame' ? 'The word frame' : 'The one-thing card'));
    const pose = wordFlipPipPose({
      running: runner.running, preparing: false,
      stage: runner.revealHeld ? 'affirmed' : runner.running ? 'asking' : 'done',
      // Audio belongs to this block only while the lesson is pointed at it.
      tutorSpeaking: ctx.isAudioPlaying && (ctx.sessionMode !== 'lesson' || ctx.activePrimitiveId === resolvedInstanceId),
      cueOnItem: runner.cuedItemId === currentChallenge.id && !runner.revealHeld,
      visibleIds: targets.map((target) => target.id),
      lastTouchedId: pip.lastTouchedId,
    });
    return {
      instanceId: resolvedInstanceId, scopeId: currentChallenge.id, label: 'Word flip',
      dock: pip.dock.current, targets, pose,
    };
  });

  const phaseResults = useMemo(() => phaseResultsFromSummary(challenges, runner.practiceSummary, (challenge) => ({
    label: `${challenge.sourceWord} → ${challenge.answer}`,
    icon: challenge.emoji || '🔁',
  })), [runner.practiceSummary, challenges]);

  // ============================================================================
  // Render
  // ============================================================================

  if (!currentChallenge) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-6">
          <p className="text-slate-400 text-center">No challenges available.</p>
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  const currentIsPlural = isPluralFlip(currentChallenge.type);
  const stageWord = runner.revealHeld
    ? 'yes!'
    : currentIsPlural
      ? `${countWord(currentChallenge.count ?? 2)} what?`
      : 'yesterday I...';

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
            {/* Grade / mode badges are adult chrome — hidden for pre-readers. */}
            {!isPreReader && (
              <div className="flex items-center gap-2">
                <LuminaBadge className="text-xs">Grade {gradeLevel}</LuminaBadge>
                <LuminaBadge accent="emerald" className="text-xs">
                  {currentIsPlural ? '🔁 One & Many' : '⏪ Today & Yesterday'}
                </LuminaBadge>
              </div>
            )}
          </div>
          <LuminaBadge accent="cyan" className="text-xs">Say it out loud</LuminaBadge>
        </div>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {!showSummary && (
          <>
            {!isPreReader && challenges.length > 0 && (
              <div className="mb-2 flex justify-center">
                <LuminaChallengeCounter current={currentIndex + 1} total={challenges.length} variant="dots" />
              </div>
            )}

            {/* The transformation frame. Plurals use one/many; past tense uses
                today/yesterday. The source is tappable, while the transformed
                answer stays blank until the tutor affirms it. */}
            <div ref={pip.ref('frame')} data-pip-object="frame" className="flex items-stretch justify-center gap-3">
              <button
                ref={pip.ref('source')}
                data-pip-object="source"
                onClick={() => { pip.look('source'); handleSayWord(); }}
                aria-label={`word ${currentChallenge.sourceWord}`}
                className={`
                  rounded-2xl border-2 px-5 py-4 text-center flex-1 max-w-[180px]
                  transition-all duration-200 cursor-pointer select-none
                  ${wordTapped
                    ? 'bg-amber-500/25 border-amber-400/60 scale-105 shadow-lg shadow-amber-500/20'
                    : 'bg-white/5 border-white/10 hover:bg-white/10 hover:scale-[1.02]'
                  }
                `}
              >
                <div className="text-xs uppercase tracking-wide text-slate-500 font-mono mb-1">
                  {currentIsPlural ? 'One' : 'Today'}
                </div>
                <div className="text-5xl leading-tight">{currentChallenge.emoji}</div>
                <div className="text-xl font-black text-slate-100 mt-2">{currentChallenge.sourceWord}</div>
              </button>

              <div className="flex items-center text-2xl text-slate-500" aria-hidden>→</div>

              <div className="rounded-2xl bg-emerald-500/10 border-2 border-emerald-500/30 px-5 py-4 text-center flex-1 max-w-[220px]">
                <div className="text-xs uppercase tracking-wide text-emerald-300/80 font-mono mb-1">
                  {currentIsPlural ? countWordCapitalized(currentChallenge.count ?? 2) : 'Yesterday'}
                </div>
                <div className="text-4xl leading-tight break-words">
                  {currentIsPlural
                    ? currentChallenge.emoji.repeat(currentChallenge.count ?? 2)
                    : currentChallenge.emoji}
                </div>
                <div className="text-xl font-black mt-2">
                  {runner.revealHeld ? (
                    <span className="text-emerald-300 animate-bounce inline-block" data-flip-reward="true">{currentChallenge.answer}</span>
                  ) : (
                    <span className="text-emerald-300/70 border-b-2 border-emerald-400/60 px-4">&nbsp;___&nbsp;</span>
                  )}
                </div>
              </div>
            </div>

            <div className="text-center text-xs uppercase tracking-[0.25em] text-cyan-300">{stageWord}</div>

            {/* Help: the same change on another word, before and after. Never the item's answer. */}
            {flipModel && (
              <div data-lever="rule-model" aria-label="Word change model"
                className="flex items-center justify-center gap-3 rounded-2xl border border-cyan-300/20 bg-cyan-950/10 p-3">
                <div className="text-center">
                  <div className="text-xs uppercase text-slate-500">{currentIsPlural ? 'One' : 'Today'}</div>
                  <div className="text-3xl" role="img" aria-label={flipModel.singular}>{FLIP_EMOJI[flipModel.singular]}</div>
                  <div className="font-bold text-slate-100">{flipModel.singular}</div>
                </div>
                <span aria-hidden className="text-xl text-slate-400">→</span>
                <div className="text-center">
                  <div className="text-xs uppercase text-slate-500">{currentIsPlural ? 'Two' : 'Yesterday'}</div>
                  <div className="text-3xl" role="img" aria-label={flipModel.plural}>
                    {currentIsPlural ? FLIP_EMOJI[flipModel.singular].repeat(2) : FLIP_EMOJI[flipModel.singular]}
                  </div>
                  <div className="font-bold text-emerald-200">{flipModel.plural}</div>
                </div>
              </div>
            )}

            {!isPreReader && (
              <p className="text-center text-xs text-slate-500">
                Tap the word to hear it, then say the new word.
              </p>
            )}

            {pipStore && (
              <div ref={pip.dock} data-pip-dock={resolvedInstanceId}
                className="mx-auto flex min-h-28 w-full max-w-xl items-center rounded-2xl border border-cyan-300/10 bg-cyan-950/10 px-2" />
            )}
          </>
        )}

        {showSummary && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={evaluation.submittedResult?.score ?? runner.teachingResult?.accuracy}
            durationMs={evaluation.elapsedMs}
            heading="Word Flip Complete!"
            celebrationMessage={`You flipped ${runner.practiceSummary?.solvedCount ?? 0} word${runner.practiceSummary?.solvedCount === 1 ? '' : 's'} out loud!`}
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
}

/** The open build's metrics, in word-flip's shape. */
const buildMetrics = (s: AffixBuildSummary): WordFlipMetrics => ({
  type: 'word-flip', challengeType: 'build_inflect', task: 'build_inflect', totalChallenges: s.total, correctCount: s.solved,
  attemptsCount: s.attemptsCount, firstTryCount: s.firstTryCorrect, hintsViewed: 0, overallAccuracy: s.accuracy,
  averageAttemptsPerChallenge: s.total ? s.attemptsCount / s.total : 0,
});

/** One mount, one shape: the open build (`build_inflect`) runs on the word-part surface; every other mode is spoken. */
function WordFlipMount(props: WordFlipProps) {
  return props.data.task === 'build_inflect'
    ? <WordBuildAffix data={props.data} className={props.className} runtimePlanItemId={props.runtimePlanItemId}
        primitiveId="word-flip" rules={inflectBuildRules} metrics={buildMetrics} />
    : <WordFlipSurface {...props} />;
}

// The teaching workspace is the only path: an unbound mount shows the "needs the tutor" card.
const WordFlip = withWorkspaceOnly<WordFlipProps>('word-flip', WordFlipMount, props => props.data.title);

export default WordFlip;
