'use client';

/**
 * SyllableClapper — the tutor says a word (joined, in parts, or minus a part) and the
 * child answers OUT LOUD. It runs only on the shared tutor/JEV teaching workspace
 * (workspace rollout C1; the scripted runner was retired, LA-14, user ruling 09-23: one
 * path). The tutor teaches in its own words, the observer judges each spoken answer and
 * the runtime owns progression. An unbound mount shows the shared "needs the tutor" card.
 * There is no advance timer, no Clap button, no Check button and no Next button.
 *
 * ⭐ THE CLAP MOVED OFF THE SCREEN AND INTO THE ROOM. The click era's `👏 Clap!`
 * button failed the costume test outright — a child who cannot hear a single
 * syllable boundary can press it three times — and the six counter circles it
 * filled did the COUNTING, which is the one act this primitive exists to train.
 * The ask now invites the hands ("Clap the parts with your hands, then tell me
 * how many parts"), and those hands are the child's own, invisible to us exactly
 * as they are to a teacher at a table whose real signal is the spoken count.
 *
 * ANSWER-LEAK RULE, and it is the whole reason this stage is nearly empty:
 * NOTHING ON SCREEN MAY EQUAL WHAT THE CHILD IS ABOUT TO SAY. The word is never
 * printed before the affirmation (a reader chunks it orthographically instead of
 * hearing it), and the split syllable bar — three boxes for a three-part word —
 * is literally the answer drawn as furniture. Both live behind `revealHeld`,
 * which opens on a credited answer and closes when the next item opens.
 * Before credit the child has the tutor's voice and tap-to-hear, which is what
 * they would have at the table.
 *
 * SUPPORT TIERS SURVIVE AS ASK LEVERS (L3 contract, re-based): the on-screen
 * tally and the directional miss hint are gone with the button they measured, so
 * the tier now shapes the ENUNCIATION — easy hears the word twice (natural, then
 * slower and still joined), medium once, and hard loses the clap invitation so
 * the segmenting happens in the ear alone. `syllableClapperScript` honors both
 * flags; the spoken word and tap-to-hear are never withdrawn at any tier.
 *
 * Items that cannot be asked or judged honestly — parts that do not spell their
 * word, a count outside 1..5, or a word whose syllable count is not one number
 * in English ("squirrel", "every", "fire") — are DROPPED at build time by
 * `itemsFromChallenges`. Ship nothing over a broken ask.
 */

import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaBadge,
  LuminaPanel,
  LuminaChallengeCounter,
  type LuminaAccent,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { SyllableClapperMetrics } from '../../../evaluation/types';
import { useLuminaAIContext } from '@/contexts/LuminaAIContext';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceRunner, type TeachingEvaluationResult }
  from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { itemsFromChallenges, type SyllableClapperItem } from './syllableClapperScript';
import { hearPartRequest, hearQuestionRequest, syllableAssignment, syllableScene } from './syllableClapperWorkspace';
import type { SyllableTask } from './syllableClapperModes';
import { SoundManager } from '../../../utils/SoundManager';
import PhaseSummaryPanel, { type PhaseResult } from '../../../components/PhaseSummaryPanel';
import { usePipSurface, usePipTargets } from '../../../pip/PipSurfaceContext';
import { syllableClapperPipPose } from '../../../pip/syllableClapperPipPose';
import { phaseResultsFromSummary } from '../../../hooks/usePhaseResults';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

interface SyllableChallenge {
  id: string;
  word: string;
  syllableCount: number;       // 1-5; the LENGTH of `syllables` is authoritative
  syllables: string[];         // ["but", "ter", "fly"]
  imageDescription: string;
  difficulty: number;          // 3-5
  /** The TASK IDENTITY (the eval mode). Legacy payloads carrying a word-length
   *  band ('easy'|'medium'|'hard') resolve to `count_parts` at build. */
  challengeType: SyllableTask | 'easy' | 'medium' | 'hard';
  /** `delete_compound` only — the part the ask takes away. */
  removePart?: string;
  /** `delete_compound` only — the real word left behind. */
  residue?: string;

  // ── Within-mode SUPPORT-TIER scaffolds (stamped by the generator from
  //    ctx.supportTier). ASK levers now, not render levers: the click era's
  //    on-screen tally and directional miss hint went with the Check button
  //    they measured. All optional; absent ⇒ the fully supported ask, so every
  //    legacy payload still plays. ──
  /** The ask says the word a second time, slower and still joined. easy only. */
  echoWordSlowly?: boolean;
  /** The ask invites the hands. Withdrawn at the hard tier (motor scaffold). */
  inviteClap?: boolean;
}

export interface SyllableClapperData {
  title: string;
  /**
   * Within-mode SUPPORT tier from the manifest (config.difficulty): the ask
   * scaffolds AND the word-length band. The generator stamps the per-challenge
   * flags from it; nothing in this component reads it.
   */
  supportTier?: 'easy' | 'medium' | 'hard';
  challenges: SyllableChallenge[];
  gradeLevel?: string;

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<SyllableClapperMetrics>) => void;
}

interface SyllableClapperProps {
  data: SyllableClapperData;
  className?: string;
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted. */
  runtimeEvalMode?: string;
}

// ============================================================================
// Constants
// ============================================================================

const SYLLABLE_COLORS = [
  'bg-blue-500/30 border-blue-400/50 text-blue-200',
  'bg-purple-500/30 border-purple-400/50 text-purple-200',
  'bg-emerald-500/30 border-emerald-400/50 text-emerald-200',
  'bg-amber-500/30 border-amber-400/50 text-amber-200',
  'bg-rose-500/30 border-rose-400/50 text-rose-200',
];

/** One row per ACT. The badge names what the child is doing, which is the only
 *  thing a five-year-old could read off the screen anyway — the old badge named
 *  the word-length band, a fact about the content that meant nothing to them. */
const TASK_META: Record<SyllableTask, { badge: string; icon: string; accent: LuminaAccent }> = {
  blend_syllables: { badge: 'Put It Together', icon: '🔗', accent: 'blue' },
  count_parts: { badge: 'Clap and Count', icon: '👏', accent: 'purple' },
  delete_compound: { badge: 'Take a Part Away', icon: '✂️', accent: 'emerald' },
};

/** The on-screen line under the stimulus button. It must never name the answer:
 *  no count, no word, no residue — only the ACT. */
const promptLineFor = (item: SyllableClapperItem): string => {
  if (item.task === 'blend_syllables') return 'Listen to the parts — then say the whole word!';
  if (item.task === 'delete_compound') return 'Take the part away — then say what is left!';
  return item.inviteClap
    ? 'Clap the parts — then say how many!'
    : 'How many parts do you hear? Say the number!';
};

// ============================================================================
// Component
// ============================================================================

function SyllableClapperSurface({ data, className, runtimePlanItemId, runtimeEvalMode }: SyllableClapperProps) {
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

  const stableInstanceIdRef = useRef(instanceId || `syllable-clapper-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  const ctx = useLuminaAIContext();
  const workspace = useRef<TeachingWorkspace | null>(null);

  // ── Items (drop-gated) ────────────────────────────────────────────────────
  const items = useMemo<SyllableClapperItem[]>(() => {
    const built = itemsFromChallenges(challenges);
    if (built.length < challenges.length) {
      console.warn(
        `[SyllableClapper] dropped ${challenges.length - built.length} unaskable challenge(s) `
        + '(split/join, count range, sayability or dialect-variable gates)',
      );
    }
    return built;
  }, [challenges]);

  // ── The reveal payload (18b) ──────────────────────────────────────────────
  // Set on the credit, rendered behind `runner.revealHeld`, and DELIBERATELY
  // NOT cleared when the next item opens: the hold is the gate, and the next
  // credit overwrites the payload.
  const [revealed, setRevealed] = useState<SyllableClapperItem | null>(null);

  // ── Evaluation ────────────────────────────────────────────────────────────
  const evaluation = usePrimitiveEvaluation<SyllableClapperMetrics>({
    primitiveType: 'syllable-clapper',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const finish = (summary: TeachingEvaluationResult) => {
    const syllableCountsEncountered: Record<number, number> = {};
    for (const item of items) {
      syllableCountsEncountered[item.partCount] =
        (syllableCountsEncountered[item.partCount] ?? 0) + 1;
    }
    const scores = new Map(summary.outcomes.map((o) => [o.id, o.score]));
    const accuracyFor = (task: SyllableTask): number | undefined => {
      const group = items.filter((i) => i.task === task);
      if (!group.length) return undefined;
      return Math.round(group.reduce((sum, i) => sum + (scores.get(i.id) ?? 0), 0) / group.length);
    };
    // With no mode on the metric the backend files every attempt under 'default'. A run is
    // one act in practice (the manifest pins one mode), so the dominant act is the label.
    const dominantTask = (['blend_syllables', 'count_parts', 'delete_compound'] as SyllableTask[])
      .map((task) => ({ task, n: items.filter((i) => i.task === task).length }))
      .sort((a, b) => b.n - a.n)[0];
    const metrics: SyllableClapperMetrics = {
      type: 'syllable-clapper',
      evalMode: dominantTask.n ? dominantTask.task : undefined,
      wordsCorrect: summary.solvedCount,
      wordsTotal: items.length,
      clapCountAccuracy: summary.accuracy,
      syllableCountsEncountered,
      attemptsCount: summary.attemptsCount,
      blendAccuracy: accuracyFor('blend_syllables'),
      countPartsAccuracy: accuracyFor('count_parts'),
      deleteAccuracy: accuracyFor('delete_compound'),
    };
    evaluation.submitResult(
      summary.passed,
      summary.accuracy,
      metrics,
      { challengeResults: summary.outcomes, learningResponses: summary.learningResponses,
        ...(summary.teachingAttempts ? { teachingAttempts: summary.teachingAttempts, assistanceProvenance: summary.assistanceProvenance } : {}) },
      undefined,
      summary.diagnosisEvidence,
    );
  };

  const runner = useWorkspaceRunner<SyllableClapperItem>({
    primitiveId: 'syllable-clapper',
    assignment: syllableAssignment,
    items,
    workspace,
    objectiveId,
    planItemId: runtimePlanItemId,
    // The SESSION's mode, from the mount: a mount's identity must not change while the workspace owns it.
    evalMode: runtimeEvalMode || items[0]?.task || 'count_parts',
    instanceId: resolvedInstanceId,
    onFinished: finish,
    onAffirmed: setRevealed,
  });

  const currentItem = runner.currentItem;
  const showSummary = evaluation.hasSubmitted || !!runner.practiceSummary;
  /** The credited item whose reveal is still on screen. `revealHeld`, never `currentSolved`. */
  const revealItem = runner.revealHeld ? revealed : null;

  // What the tutor and the observer are shown, republished every render.
  // W1 offers no demonstration targets and no presentation.
  useLayoutEffect(() => {
    if (!currentItem) return;
    workspace.current = { ...syllableScene(currentItem), demonstration: [], canDemonstrate: false,
      canPresent: false, readyForResponse: true, mark: () => {}, clearPresentation: () => {} };
    runner.publishWorkspace();
  });

  // ── Pip shared surface ────────────────────────────────────────────────────
  // A projection of the workspace's committed state onto the hear-it-again button; Pip never
  // answers, judges, or advances.
  const pip = usePipTargets(currentItem?.id ?? null, false);
  const pipStore = usePipSurface(() => {
    if (!pip.dock.current || !currentItem || showSummary) return null;
    const targets = pip.targets(['stimulus'], () => 'Hear the question again');
    const pose = syllableClapperPipPose({
      running: runner.running, preparing: false,
      currentSolved: runner.currentSolved, revealHeld: runner.revealHeld, judging: false,
      // Audio belongs to this block only while the lesson is pointed at it.
      tutorSpeaking: ctx.isAudioPlaying && (ctx.sessionMode !== 'lesson' || ctx.activePrimitiveId === resolvedInstanceId),
      cueMatchesItem: runner.cuedItemId === currentItem.id,
      visibleIds: targets.map((target) => target.id),
    });
    return { instanceId: resolvedInstanceId, scopeId: currentItem.id, label: 'Syllable clapper', dock: pip.dock.current, targets, pose };
  });

  // ── Tap-to-hear. Silent host requests: never a learner turn, never the answer. ──
  const hearQuestion = useCallback(() => {
    if (!currentItem) return;
    SoundManager.tap();
    ctx.sendText(hearQuestionRequest(currentItem), { silent: true, author: 'host' });
  }, [ctx, currentItem]);
  /** One part of the reveal bar, which exists only after credit. */
  const hearPart = useCallback((part: string) => {
    SoundManager.tap();
    ctx.sendText(hearPartRequest(part), { silent: true, author: 'host' });
  }, [ctx]);

  // ── Phase summary ─────────────────────────────────────────────────────────
  const phaseResults = useMemo<PhaseResult[]>(() => {
    if (!runner.practiceSummary) return [];
    return phaseResultsFromSummary(items, runner.practiceSummary, (item) => {
      const meta = TASK_META[item.task];
      return { label: meta.badge, icon: meta.icon };
    });
  }, [runner.practiceSummary, items]);

  // ============================================================================
  // Main Render
  // ============================================================================

  if (items.length === 0 || !currentItem) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-6">
          <p className="text-slate-400 text-center">No challenges available.</p>
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  const taskMeta = TASK_META[currentItem.task];

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
          {!showSummary && (
            <LuminaBadge accent={taskMeta.accent} className="text-xs">
              {taskMeta.icon} {taskMeta.badge}
            </LuminaBadge>
          )}
        </div>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {!showSummary && (
          <>
            <div className="flex justify-center">
              <LuminaChallengeCounter
                current={Math.min(runner.currentIndex + 1, items.length)}
                total={items.length}
                variant="dots"
              />
            </div>

            {/* The stimulus. The word is NEVER printed here — it arrives in the tutor's
                voice, and a printed word lets a reader chunk it by sight instead of
                hearing it, or read a blend's answer straight off the screen. Tapping
                asks the tutor to say the whole question again. */}
            <div className="flex flex-col items-center gap-3">
              <button
                ref={pip.ref('stimulus')}
                data-pip-object="stimulus"
                onClick={hearQuestion}
                disabled={!runner.running}
                data-testid="hear-word"
                className="rounded-2xl border-2 px-12 py-8 text-center transition-all duration-200
                  disabled:opacity-40 disabled:cursor-default bg-emerald-500/10 border-emerald-500/30 cursor-pointer"
              >
                <span className="text-6xl">🔊</span>
                <p className="text-xs text-emerald-300/70 mt-3">Tap to hear the question again</p>
              </button>
              <p className="text-center text-base text-slate-300 font-medium">
                {promptLineFor(currentItem)}
              </p>
            </div>

            {/* Pip's dock sits below the question, above the reveal bar. */}
            {pipStore && <div ref={pip.dock} data-pip-dock={resolvedInstanceId}
              className="mx-auto flex min-h-28 w-full max-w-xl items-center rounded-2xl border border-cyan-300/10 bg-cyan-950/10 px-2" />}

            {/* The reveal — the first moment the word, the split and the count
                may appear on screen, held while the credit is on screen. Tap a part to hear it. */}
            {revealItem && (
              <LuminaPanel className="p-4 space-y-3" data-testid="reveal">
                <div className="flex gap-1">
                  {revealItem.parts.map((part, idx) => (
                    <button
                      key={`${revealItem.id}-${idx}`}
                      onClick={() => hearPart(part)}
                      className={`
                        flex-1 rounded-xl border-2 p-3 text-center cursor-pointer
                        transition-all duration-200 hover:scale-105 active:scale-95
                        ${SYLLABLE_COLORS[idx % SYLLABLE_COLORS.length]}
                      `}
                    >
                      <span className="text-2xl font-bold block">{part}</span>
                    </button>
                  ))}
                </div>
                <p className="text-center text-emerald-300 text-lg font-black">
                  {revealItem.task === 'count_parts'
                    ? `${revealItem.word} — ${revealItem.answer} ${revealItem.partCount === 1 ? 'part' : 'parts'}`
                    : revealItem.task === 'delete_compound'
                      ? `${revealItem.word} without ${revealItem.removePart} — ${revealItem.residue}`
                      : revealItem.word}
                </p>
                {revealItem.imageDescription && (
                  <p className="text-center text-sm text-slate-500 italic">
                    {revealItem.imageDescription}
                  </p>
                )}
                <p className="text-center text-xs text-slate-600">Tap a part to hear it</p>
              </LuminaPanel>
            )}
          </>
        )}

        {showSummary && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={evaluation.submittedResult?.score ?? runner.teachingResult?.accuracy}
            durationMs={evaluation.elapsedMs}
            heading="Syllable Clapping Complete!"
            celebrationMessage="Your ears found the parts in every word!"
            className="mt-4"
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
}

// The teaching workspace is the only path: an unbound mount shows the "needs the tutor" card.
const SyllableClapper = withWorkspaceOnly<SyllableClapperProps>('syllable-clapper', SyllableClapperSurface,
  props => props.data.title);

export default SyllableClapper;

