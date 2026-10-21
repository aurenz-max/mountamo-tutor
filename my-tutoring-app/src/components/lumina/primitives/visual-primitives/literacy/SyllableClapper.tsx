'use client';

/**
 * SyllableClapper, taught on the shared teaching workspace only (the boss: `syllableClapper.card.ts` +
 * `syllableClapper.boss.ts`). A mount with no tutor shows the shared "needs the tutor" card (`withWorkspaceOnly`).
 *
 * WHAT THE CHILD DOES. The tutor says a word (in parts, joined, or minus a part) and the child answers OUT LOUD: the
 * whole word, how many parts, or the word left; the tutor judges it against the key. build_parts is the shared letter
 * build (`LetterBuildSurface.tsx`): the child taps word-part cards into a word with the number of parts the task names.
 *
 * THE CLAP MOVED OFF THE SCREEN AND INTO THE ROOM. The click era's `Clap!` button failed the costume test (a child who
 * cannot hear a single syllable boundary can press it three times) and its counter circles did the COUNTING, the one
 * act this primitive trains. The ask invites the hands, and those hands are the child's own.
 *
 * ANSWER-LEAK RULE. Nothing on screen may equal what the child is about to say: the word is never printed before
 * credit, and the split bar (three boxes for a three-part word) is the answer drawn as furniture. Both live behind
 * `revealHeld`. Before credit the child has the tutor's voice and tap-to-hear. The domain is
 * `syllableClapperDomain.ts`, the levers `syllableClapperLevers.ts`; nothing in this file writes a spoken line.
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
import type { TeachingWorkspace, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceRunner, type TeachingEvaluationResult }
  from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { leverScene } from '../../../components/live-activity/bossLevers';
import { PipDock, PipWorkspace } from '../../../pip/WorkspacePip';
import { isPreReaderGrade } from '../../../utils/kindergartenMode';
import { SoundManager } from '../../../utils/SoundManager';
import PhaseSummaryPanel, { type PhaseResult } from '../../../components/PhaseSummaryPanel';
import { phaseResultsFromSummary, practiceScore } from '../../../hooks/usePhaseResults';
import LetterBuildSurface, { type LetterBuildSummary } from './LetterBuildSurface';
import type { LetterBuildItem } from './letterBuild';
import type { WordSpaceStamp } from '../../../service/wordSpace/pick';
import type { SyllableTask } from './syllableClapperModes';
import {
  hearPartRequest, hearQuestionRequest, syllableScene, syllableWords, type SyllableClapperItem,
} from './syllableClapperDomain';
import {
  BEATS_LEVER, CLAP_MODEL_LEVER, DELETE_MODEL_LEVER, SYLLABLE_LEVERS, clapModelFor, deleteModelFor, syllableBuildLevers,
} from './syllableClapperLevers';
import { syllableClapperBoss } from './syllableClapper.boss';

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
  /** Word-space calibration stamp (service/wordSpace); never rendered, never sent to the tutor. */
  wordSpace?: WordSpaceStamp;

  // ── Within-mode SUPPORT-TIER scaffolds (stamped by the generator from ctx.supportTier). Ask levers: all optional;
  //    absent ⇒ the fully supported ask, so every legacy payload still plays. ──
  /** The ask says the word a second time, slower and still joined. easy only. */
  echoWordSlowly?: boolean;
  /** The ask invites the hands. Withdrawn at the hard tier (motor scaffold). */
  inviteClap?: boolean;
}

export interface SyllableClapperData {
  title: string;
  /**
   * Within-mode SUPPORT tier from the manifest (config.difficulty): the ask scaffolds, the word-length band, and when
   * the model lever comes (the lever set's `support` fact). Absent ⇒ medium for the model.
   */
  supportTier?: 'easy' | 'medium' | 'hard';
  challenges: SyllableChallenge[];
  gradeLevel?: string;
  /** `build_parts` (open build): the shared letter build surface runs the session from `buildItems` (syllable cards,
   *  `syllableBuild.ts`); `challenges` is empty. */
  task?: 'letter_build';
  buildItems?: LetterBuildItem[];

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

/** One row per ACT. The badge names what the child is doing. */
const TASK_META: Record<SyllableTask, { badge: string; icon: string; accent: LuminaAccent }> = {
  blend_syllables: { badge: 'Put It Together', icon: '🔗', accent: 'blue' },
  count_parts: { badge: 'Clap and Count', icon: '👏', accent: 'purple' },
  delete_compound: { badge: 'Take a Part Away', icon: '✂️', accent: 'emerald' },
};

/** The on-screen line under the stimulus button. It must never name the answer: no count, no word, no residue. */
const promptLineFor = (item: SyllableClapperItem): string => {
  if (item.task === 'blend_syllables') return 'Listen to the parts — then say the whole word!';
  if (item.task === 'delete_compound') return 'Take the part away — then say what is left!';
  return item.inviteClap
    ? 'Clap the parts — then say how many!'
    : 'How many parts do you hear? Say the number!';
};

const PRACTICE_FACT = 'An easier practice item on another word, ungraded. The full item comes back after it.';

// ============================================================================
// Component
// ============================================================================

function SyllableClapperSurface({ data, className, runtimePlanItemId }: SyllableClapperProps) {
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
  const workspace = useRef<TeachingWorkspace | null>(null);

  // ── Items (drop-gated) ────────────────────────────────────────────────────
  const items = useMemo<SyllableClapperItem[]>(() => {
    const built = syllableWords({ challenges, supportTier: data.supportTier });
    if (built.length < challenges.length) {
      console.warn(
        `[SyllableClapper] dropped ${challenges.length - built.length} unaskable challenge(s) `
        + '(split/join, count range, sayability or dialect-variable gates)',
      );
    }
    return built;
  }, [challenges, data.supportTier]);
  const leverCtx = useMemo(() => ({ items }), [items]);

  // The reveal payload: set on the credit, rendered behind `runner.revealHeld`, overwritten by the next credit.
  const [revealed, setRevealed] = useState<SyllableClapperItem | null>(null);
  // In-item levers, keyed by the session item they were pulled on, and the easier practice item a simplify lever put
  // on screen in its place (ungraded; the full item comes back after it).
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<SyllableClapperItem | null>(null);

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
      syllableCountsEncountered[item.partCount] = (syllableCountsEncountered[item.partCount] ?? 0) + 1;
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
    assignment: syllableClapperBoss.assignment,
    items,
    workspace,
    objectiveId,
    planItemId: runtimePlanItemId,
    // The SESSION's mode, from the mount: a mount's identity must not change while the workspace owns it.
    instanceId: resolvedInstanceId,
    onFinished: finish,
    onAffirmed: setRevealed,
  });

  const sessionItem = runner.currentItem;
  /** What is on screen: the practice item while a simplify lever holds it, else the session item. */
  const currentItem = practice ?? sessionItem;
  const pulledLevers = practice || leverState.item !== sessionItem?.id ? [] : leverState.pulled;
  const pulled = (id: string) => pulledLevers.includes(id);
  const clapModel = pulled(CLAP_MODEL_LEVER) && sessionItem ? clapModelFor(sessionItem, items) : null;
  const deleteModel = pulled(DELETE_MODEL_LEVER) && sessionItem ? deleteModelFor(sessionItem, items) : null;
  const isPreReader = isPreReaderGrade(data.gradeLevel ?? '');
  const showSummary = evaluation.hasSubmitted || !!runner.practiceSummary;
  /** The credited item whose reveal is still on screen. `revealHeld`, never `currentSolved`. */
  const revealItem = runner.revealHeld ? revealed : null;

  // What the tutor and the observer are shown, republished every render. The lever set writes the support and
  // on-screen facts; a practice item carries no levers.
  useLayoutEffect(() => {
    if (!currentItem || !sessionItem) return;
    const levers = practice ? [] : SYLLABLE_LEVERS.declare(sessionItem, leverCtx, pulledLevers);
    const scene: WorkspaceScene = syllableScene(currentItem);
    workspace.current = {
      ...leverScene(practice ? { ...scene, facts: { ...scene.facts, practice: PRACTICE_FACT } } : scene, {
        support: practice ? '' : SYLLABLE_LEVERS.support(sessionItem, leverCtx),
        onScreen: practice ? '' : SYLLABLE_LEVERS.onScreen(sessionItem, leverCtx, pulledLevers) }),
      levers,
      // A synchronous commit (the workspace runs it inside flushSync): the screen changes before this returns.
      pullLever: id => {
        const lever = levers.find(l => l.id === id);
        if (!lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled.`;
        if (lever.kind === 'simplify') {
          const simpler = SYLLABLE_LEVERS.simpler(sessionItem, leverCtx, id);
          if (!simpler || 'mode' in simpler) return 'There is no easier item here.';
          setLeverState({ item: sessionItem.id, pulled: [...pulledLevers, id] });
          setPractice(simpler);
          return { practice: syllableClapperBoss.assignment(simpler) };
        }
        setLeverState({ item: sessionItem.id, pulled: [...pulledLevers, id] });
        return true;
      },
      endPractice: () => setPractice(null),
    };
  });

  // ── Tap-to-hear. Silent host requests: never a learner turn, never the answer. ──
  const { requestHear } = runner;
  const hearQuestion = useCallback(() => {
    if (!currentItem) return;
    SoundManager.tap();
    requestHear(hearQuestionRequest(currentItem));
  }, [requestHear, currentItem]);
  /** One part of the reveal bar, which exists only after credit. */
  const hearPart = useCallback((part: string) => {
    SoundManager.tap();
    requestHear(hearPartRequest(part));
  }, [requestHear]);

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
            <div className="flex items-center gap-2">
              {practice && <LuminaBadge accent="amber" className="text-[10px] uppercase tracking-wider">Practice</LuminaBadge>}
              <LuminaBadge accent={taskMeta.accent} className="text-xs">
                {taskMeta.icon} {taskMeta.badge}
              </LuminaBadge>
            </div>
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

            <PipDock />

            <PipWorkspace className="space-y-4">
              {/* The stimulus. The word is NEVER printed here — it arrives in the tutor's voice. Tapping asks the
                  tutor to say the whole question again. */}
              <div className="flex flex-col items-center gap-3">
                <button
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

              {/* Help: a dot per part slides together. The parts are never printed or pictured. */}
              {pulled(BEATS_LEVER) && (
                <div data-lever="part-beats" className="flex flex-col items-center gap-1">
                  <div className="flex items-center gap-0.5">
                    {currentItem.parts.map((_, i) => <span key={i} data-beat className="h-6 w-6 rounded-full bg-purple-400/70" />)}
                  </div>
                  <span aria-hidden className="text-2xl text-purple-300/80">⟶</span>
                </div>
              )}
              {clapModel && (
                <div data-lever="clap-model" aria-label="Clap model"
                  className="flex items-center justify-center gap-3 rounded-2xl border border-emerald-300/20 bg-emerald-950/10 p-3">
                  <span className="text-4xl" role="img" aria-label={clapModel.word}>{clapModel.emoji}</span>
                  {!isPreReader && <span className="text-lg font-bold text-slate-100">{clapModel.word}</span>}
                  <div className="flex gap-1.5">
                    {clapModel.parts.map((_, i) => <span key={i} data-clap className="text-2xl">👏</span>)}
                  </div>
                </div>
              )}
              {deleteModel && (
                <div data-lever="delete-model" aria-label="Take-away model"
                  className="flex items-center justify-center gap-3 rounded-2xl border border-amber-300/20 bg-amber-950/10 p-3">
                  <span className="text-4xl opacity-30 line-through" role="img" aria-label={deleteModel.parts[0]}>{deleteModel.partEmoji[0]}</span>
                  <span className="text-4xl" role="img" aria-label={deleteModel.parts[1]}>{deleteModel.partEmoji[1]}</span>
                  <span aria-hidden className="text-2xl text-slate-400">→</span>
                  <span className="text-4xl" role="img" aria-label={`${deleteModel.parts[1]} left`}>{deleteModel.partEmoji[1]}</span>
                  {!isPreReader && <span className="text-lg font-bold text-slate-100">{deleteModel.parts[1]}</span>}
                </div>
              )}

              {/* The reveal — the first moment the word, the split and the count may appear on screen, held while the
                  credit is on screen. Tap a part to hear it. */}
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
            </PipWorkspace>
          </>
        )}

        {showSummary && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={practiceScore(runner.practiceSummary) ?? (evaluation.submittedResult?.score ?? runner.teachingResult?.accuracy)}
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

/** build_parts' metrics in this primitive's shape. */
const buildPartsMetrics = (s: LetterBuildSummary): SyllableClapperMetrics => ({ type: 'syllable-clapper', evalMode: 'build_parts',
  wordsCorrect: s.solved, wordsTotal: s.total, clapCountAccuracy: s.accuracy, syllableCountsEncountered: {},
  attemptsCount: s.attemptsCount });

/** The open build (`build_parts`) on the shared letter build surface, wired from this boss. */
function SyllableBuildSurface({ data, className, runtimePlanItemId }: SyllableClapperProps) {
  const boss = useMemo(() => {
    const tier = data.supportTier ?? 'medium';
    return { assignment: (item: LetterBuildItem) => syllableClapperBoss.assignment({ ...item, mode: 'build_parts', supportTier: tier }),
      levers: syllableBuildLevers(tier) };
  }, [data.supportTier]);
  return <LetterBuildSurface primitiveId="syllable-clapper" className={className} runtimePlanItemId={runtimePlanItemId}
    data={{ ...data, task: 'letter_build', buildItems: data.buildItems ?? [] } as never} metrics={buildPartsMetrics} boss={boss} />;
}

/** One mount, one shape: the open build (`build_parts`) runs on the shared letter build surface. */
function SyllableClapperHost(props: SyllableClapperProps) {
  return props.data.task === 'letter_build' ? <SyllableBuildSurface {...props} /> : <SyllableClapperSurface {...props} />;
}

// The teaching workspace is the only path: an unbound mount shows the "needs the tutor" card.
const SyllableClapper = withWorkspaceOnly<SyllableClapperProps>('syllable-clapper', SyllableClapperHost,
  props => props.data.title);

export default SyllableClapper;
