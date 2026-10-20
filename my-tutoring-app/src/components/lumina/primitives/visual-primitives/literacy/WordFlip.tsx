'use client';

/**
 * WordFlip, taught on the shared teaching workspace only (the boss: `wordFlip.card.ts` + `wordFlip.boss.ts`). A mount
 * with no tutor shows the shared "needs the tutor" card (`withWorkspaceOnly`).
 *
 * WHAT THE CHILD DOES. The child sees a counted-picture frame (one 🐕 "dog" → three 🐕🐕🐕 ___?) or an action today and
 * yesterday, may tap the one-thing card to hear its word, and SAYS THE NEW WORD ALOUD; the tutor judges it against the
 * key. build_inflect is the shared word-part build (`WordBuildAffix.tsx` with `inflectBuild.ts`): a word card and an
 * ending card make a word for the ask, and the build checks it.
 *
 * WHY THERE ARE NO CHIPS (qa/di/BACKLOG.md item 16). Tapping "dogs" out of three printed words is READING, which a
 * child who cannot form a plural does correctly every time, and a chip PRINTS THE ANSWER. The answer is spoken.
 *
 * ANSWER-LEAK RULE. The source word, its emoji and the frame are the stimulus and are shown. The transformed word is
 * the answer: the blank stays a blank until the word is credited, and nothing on screen offers it.
 *
 * The domain is `wordFlipDomain.ts`, the levers `wordFlipLevers.ts`; nothing in this file writes a spoken line.
 */

import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
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
import { phaseResultsFromSummary, practiceScore } from '../../../hooks/usePhaseResults';
import type { TeachingWorkspace, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceRunner, type TeachingEvaluationResult }
  from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { leverScene } from '../../../components/live-activity/bossLevers';
import { PipDock, PipWorkspace } from '../../../pip/WorkspacePip';
import WordBuildAffix from './WordBuildAffix';
import type { AffixBuildItem, AffixBuildSummary, BuildPart } from './affixBuild';
import { inflectBuildRules, type InflectBuildItem } from './inflectBuild';
import { asFlipBuild, countWord, countWordCapitalized, flipScene, flipWords, isPluralFlip, sourceWordRequest, type FlipWord } from './wordFlipDomain';
import { FLIP_EMOJI, FLIP_LEVERS, IRREGULAR_LEVER, RULE_LEVER, buildLevers, flipModelFor } from './wordFlipLevers';
import { wordFlipBoss } from './wordFlip.boss';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

// Grammar-transformation task identities, each on the same counted one-to-many (or today-to-yesterday) frame.
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
  /** Word-space calibration stamp (service/wordSpace); never rendered, never sent to the tutor. */
  wordSpace?: import('../../../service/wordSpace/pick').WordSpaceStamp;
  /** The source word shown in the frame — "dog" or "jump". */
  sourceWord: string;
  /**
   * The transformed word the student must PRODUCE ("dogs"). Derived by code so it can never desync from the stimulus.
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
  /** config.difficulty: the easy tier asks for one word per build item; on every mode, when the model lever comes. */
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
  const workspace = useRef<TeachingWorkspace | null>(null);
  const items = useMemo(() => flipWords({ challenges, supportTier: data.supportTier }), [challenges, data.supportTier]);
  const leverCtx = useMemo(() => ({ challenges, board: [] as BuildPart[] }), [challenges]);

  const [wordTapped, setWordTapped] = useState(false);
  // In-item levers, keyed by the session item they were pulled on, and the easier practice item a simplify lever put
  // on screen in its place (ungraded; the full item comes back after it).
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<FlipWord | null>(null);
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

  const runner = useWorkspaceRunner<FlipWord>({
    primitiveId: 'word-flip',
    assignment: wordFlipBoss.assignment,
    items,
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
  // Asks for the ONE-THING word, for a child who does not recognise the emoji; never the new word, which is the
  // answer. Silent and host-authored, so it is not a learner turn.
  const handleSayWord = () => {
    if (!currentChallenge) return;
    SoundManager.tap();
    setWordTapped(true);
    runner.requestHear(sourceWordRequest(currentChallenge.sourceWord));
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    tapTimerRef.current = setTimeout(() => setWordTapped(false), 1200);
  };

  // What the tutor and the observer are shown, republished every render. The lever set writes the support and
  // on-screen facts; a practice item carries no levers.
  useLayoutEffect(() => {
    if (!currentChallenge || !sessionItem) return;
    const levers = practice ? [] : FLIP_LEVERS.declare(sessionItem, leverCtx, pulledLevers);
    const scene: WorkspaceScene = flipScene(currentChallenge);
    workspace.current = {
      ...leverScene(practice
        ? { ...scene, facts: { ...scene.facts, practice: 'An easier practice item on another word, ungraded. The full item comes back after it.' } }
        : scene, {
        support: practice ? '' : FLIP_LEVERS.support(sessionItem, leverCtx),
        onScreen: practice ? '' : FLIP_LEVERS.onScreen(sessionItem, leverCtx, pulledLevers) }),
      levers,
      // A synchronous commit (the workspace runs it inside flushSync): the screen changes before this returns.
      pullLever: id => {
        const lever = levers.find(l => l.id === id);
        if (!lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled.`;
        if (lever.kind === 'simplify') {
          const simpler = FLIP_LEVERS.simpler(sessionItem, leverCtx, id);
          if (!simpler || simpler.mode === 'build_inflect') return 'There is no easier item here.';
          setLeverState({ item: sessionItem.id, pulled: [...pulledLevers, id] });
          setPractice(simpler);
          setWordTapped(false);
          return { practice: wordFlipBoss.assignment(simpler) };
        }
        setLeverState({ item: sessionItem.id, pulled: [...pulledLevers, id] });
        return true;
      },
      endPractice: () => { setPractice(null); setWordTapped(false); },
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

            <PipDock />

            <PipWorkspace className="space-y-4">
              {/* The transformation frame. Plurals use one/many; past tense uses today/yesterday. The source is
                  tappable, while the transformed answer stays blank until the tutor credits it. */}
              <div data-flip-frame="true" className="flex items-stretch justify-center gap-3">
                <button
                  type="button"
                  onClick={handleSayWord}
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

              {/* rule_model_cards / irregular_model: the same change on another word, before and after. Never the
                  item's answer. */}
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
            </PipWorkspace>

            {!isPreReader && (
              <p className="text-center text-xs text-slate-500">
                Tap the word to hear it, then say the new word.
              </p>
            )}
          </>
        )}

        {showSummary && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={practiceScore(runner.practiceSummary) ?? (evaluation.submittedResult?.score ?? runner.teachingResult?.accuracy)}
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

/** The open build (`build_inflect`) on the shared word-part surface, wired from this boss. */
function FlipBuildSurface({ data, className, runtimePlanItemId }: WordFlipProps) {
  const boss = useMemo(() => {
    const tier = data.supportTier ?? 'medium';
    const levers = buildLevers({ challenges: [], board: data.availableParts ?? [] }, tier);
    return { assignment: (item: AffixBuildItem) => wordFlipBoss.assignment(asFlipBuild(item as InflectBuildItem, tier)), levers };
  }, [data.supportTier, data.availableParts]);
  return <WordBuildAffix data={data} className={className} runtimePlanItemId={runtimePlanItemId}
    primitiveId="word-flip" rules={inflectBuildRules} metrics={buildMetrics} boss={boss} />;
}

/** One mount, one shape: the open build (`build_inflect`) runs on the word-part surface; every other mode is spoken. */
function WordFlipMount(props: WordFlipProps) {
  return props.data.task === 'build_inflect' ? <FlipBuildSurface {...props} /> : <WordFlipSurface {...props} />;
}

// The teaching workspace is the only path: an unbound mount shows the "needs the tutor" card.
const WordFlip = withWorkspaceOnly<WordFlipProps>('word-flip', WordFlipMount, props => props.data.title);

export default WordFlip;
