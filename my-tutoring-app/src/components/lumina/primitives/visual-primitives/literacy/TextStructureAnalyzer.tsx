'use client';

/**
 * TextStructureAnalyzer — runs only on the shared tutor/JEV teaching workspace
 * (workspace rollout C7; the scripted runner was retired, LA-14, user ruling
 * 09-23: one path). The observer judges each spoken answer and the runtime owns
 * progression. There is no Next button, no mic panel, and no answer on screen
 * before credit. An unbound mount shows the shared "needs the tutor" card.
 *
 * THE MODALITY, in one sitting:
 *
 *   "I point you at one sentence — you read it and tell me which word links
 *    the ideas. Your turn. Read the second sentence."         → "because"
 *   "Yes, because is the word that links them."
 *   "Now you tell me how the whole passage is put together.
 *    Cause and Effect, Time Order, or Description?"           → "Cause and Effect"
 *   "Listen: the river rose over its banks.
 *    Does that go with Cause, or Effect?"                     → "Cause"
 *
 * WHAT WENT, AND WHY:
 *  - **All four phases' taps.** Clicking a highlighted span, tapping one of two
 *    cards at a 1-in-2 floor, and re-tapping a misplaced idea until it landed
 *    are three actions a child who cannot analyse structure performs perfectly.
 *    All three answers are spoken now (`textStructureAnalyzerScript.ts`).
 *  - **⚠️ THE HEADER BADGE THAT PRINTED THE ANSWER.** The card rendered
 *    `<LuminaBadge>{structureType.replace('-', ' ')}</LuminaBadge>` beside the
 *    grade chip, so "cause effect" was on screen from the first paint, above a
 *    menu asking the child to work it out. No string gate in this family would
 *    ever have caught it — it is a pixel, not an utterance.
 *  - **The `easy` pre-highlight.** `prehighlightSignalWords` seeded phase 1's
 *    answers as a perception cue. The lever is not deleted, it MOVES to the same
 *    axis without the answer in it: easy/medium highlight the focus SENTENCE
 *    (which one to read), hard highlights nothing. Signal words light up only
 *    once the tutor has affirmed them.
 *  - **The Next/Back/Submit rail, the phase chips, the attempts counter and the
 *    feedback card.** Corrections cap in the runner; `PhaseSummaryPanel` reports.
 *  - **Six improvised tutor sends** (`[ACTIVITY_START]`, `[PHASE_TO_IDENTIFY]`,
 *    `[PHASE_TO_MAP]`, `[PHASE_TO_REVIEW]`, `[ANALYSIS_CORRECT]`,
 *    `[ANALYSIS_INSIGHT]`). The cues carry the entire spoken surface.
 *  - **The printed instruction sentences.** The tutor's line IS the instruction
 *    now (SWAP-1). Two instruction channels is what the click era had.
 *
 * WHAT STAYED — the PAGE, never the voice:
 *  - The passage. It is the reading material, and the tutor never reads it
 *    aloud: decoding it is the skill.
 *  - The printed structure menu with its kid-friendly glosses, and the labelled
 *    mats. A structure question whose candidates are unknowable is a broken task,
 *    not a harder one.
 *  - The `easy` worked anchor, shown pre-placed on its mat and excluded from the
 *    asked items — an exemplar is page material, not a question.
 *  - (Tap-to-hear is gone: with the tutor present, the learner asks it to repeat.)
 *
 * Asks and build gates live in `textStructureAnalyzerScript.ts`; the items,
 * assignment and scene the tutor receives live in `textStructureAnalyzerWorkspace.ts`.
 */

import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  LuminaBadge,
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaChallengeCounter,
  LuminaDropZone,
  LuminaPanel,
  LuminaReadAloudGlyph,
  type DropZoneState,
} from '../../../ui';
import { useStimulusPipSurface } from '../../../pip/useStimulusPipSurface';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { TextStructureAnalyzerMetrics } from '../../../evaluation/types';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceRunner, type TeachingEvaluationResult }
  from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { phaseResultsFromSummary } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel, { type PhaseResult } from '../../../components/PhaseSummaryPanel';
import {
  wordBoundedIndexOf,
  type StructureTypeId,
  type TextStructureAction,
  type TextStructureItem,
  type TextStructureTier,
} from './textStructureAnalyzerScript';
import { textStructureAssignment, textStructureItems, textStructureScene } from './textStructureAnalyzerWorkspace';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export type StructureType = StructureTypeId;

export interface TextStructureAnalyzerData {
  title: string;
  gradeLevel: string;
  passage: string;
  structureType: StructureType;

  /** Signal words embedded in the passage. Offsets are recomputed from the
   *  passage text by `locateSignalWords`; the model is told not to count. */
  signalWords: Array<{
    word: string;
    startIndex: number;
    endIndex: number;
  }>;

  /** The printed structure menu. `label` is CANONICAL (owned by the script
   *  module, derived from `type`) so a spoken closed set cannot have its option
   *  strings authored per generation; `description` is the generated gloss. */
  structureOptions: Array<{
    type: StructureType;
    label: string;
    description: string;
  }>;

  /** The mats — "Cause" / "Effect", "Problem" / "Solution". */
  templateRegions: Array<{
    regionId: string;
    label: string;
  }>;

  keyIdeas: Array<{
    ideaId: string;
    text: string;
    correctRegionId: string;
  }>;

  authorPurposeExplanation?: string;

  // ──────────────────────────────────────────────────────────────────────
  // Within-mode support tier (config.difficulty) — on-screen scaffolding only.
  // These NEVER change the passage, the correct structure, the signal-word set,
  // or any correctRegionId.
  // ──────────────────────────────────────────────────────────────────────

  /** easy/medium: the ASK names the structures and mats aloud; hard prints them
   *  only (band floor at grade 2 forces it on at every tier). Consumed by the
   *  script module from `supportTier`. */
  nameStrategy?: boolean;
  /** easy: fewer structures in the spoken menu. FLOORED AT THREE by the script
   *  module — a 2-option menu is a 1-in-2 guess on the run's single Identify
   *  ask, and the guess floor is what a judged loop exists to delete. Saturates
   *  at 2 in grade 2, where the curriculum has only two structures in band. */
  maxStructureOptions?: number;
  /** easy: one key idea is shown already placed as a worked example. It is
   *  EXCLUDED from the asked items and never spoken. */
  anchorIdeaId?: string;
  supportTier?: TextStructureTier;

  // Evaluation props
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<TextStructureAnalyzerMetrics>) => void;
}

interface TextStructureAnalyzerProps {
  data: TextStructureAnalyzerData;
  className?: string;
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted. */
  runtimeEvalMode?: string;
}

// ============================================================================
// Constants
// ============================================================================

type TextStructureAccent = NonNullable<PhaseResult['accentColor']>;

const ACTION_META: Record<
  TextStructureAction,
  { label: string; icon: string; accent: TextStructureAccent }
> = {
  'find-signal': { label: 'Linking Words', icon: '🔗', accent: 'amber' },
  'name-structure': { label: 'How It Is Built', icon: '🧭', accent: 'blue' },
  'place-idea': { label: 'Where Ideas Go', icon: '🗂️', accent: 'emerald' },
};

const MAT_COLORS = ['text-violet-300', 'text-sky-300', 'text-emerald-300', 'text-amber-300'];

// ============================================================================
// Component
// ============================================================================

/** The catalog mode a structure belongs to, for a mount that did not pass its resolved mode. */
const evalModeFor = (structure: StructureType): string =>
  structure === 'chronological' || structure === 'description' ? 'chronological_description' : structure.replace('-', '_');

const TextStructureAnalyzerSurface: React.FC<TextStructureAnalyzerProps> = ({ data, className, runtimePlanItemId, runtimeEvalMode }) => {
  const {
    title,
    gradeLevel = '4',
    passage,
    structureType,
    templateRegions = [],
    keyIdeas = [],
    anchorIdeaId,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const stableInstanceIdRef = useRef(instanceId || `text-structure-analyzer-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;
  const workspace = useRef<TeachingWorkspace | null>(null);

  /** Build gates drop what cannot be asked; the structure menu takes its per-instance order. */
  const { items, sentences } = useMemo(() => textStructureItems(data, resolvedInstanceId), [data, resolvedInstanceId]);

  /** The credited item's reveal payload, rendered behind `runner.revealHeld`. */
  const [reveal, setReveal] = useState<{ action: TextStructureAction; answer: string } | null>(null);
  /** Items credited so far: the only route by which a linking word or a filed idea reaches the screen. */
  const [solvedIds, setSolvedIds] = useState<ReadonlySet<string>>(() => new Set());

  // ── Evaluation ─────────────────────────────────────────────────────────────
  const evaluation = usePrimitiveEvaluation<TextStructureAnalyzerMetrics>({
    primitiveType: 'text-structure-analyzer',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const finish = (summary: TeachingEvaluationResult) => {
    const solvedOf = (action: TextStructureAction) => {
      const ids = new Set(items.filter((i) => i.action === action).map((i) => i.id));
      return summary.outcomes.filter((o) => ids.has(o.id) && o.solved).length;
    };
    const totalOf = (action: TextStructureAction) =>
      items.filter((i) => i.action === action).length;

    const mapTotal = totalOf('place-idea');
    const metrics: TextStructureAnalyzerMetrics = {
      type: 'text-structure-analyzer',
      structureIdentifiedCorrectly: solvedOf('name-structure') > 0,
      signalWordsFound: solvedOf('find-signal'),
      signalWordsTotal: totalOf('find-signal'),
      templateMappingAccuracy: mapTotal === 0
        ? 0
        : Math.round((solvedOf('place-idea') / mapTotal) * 100),
      structureType,
      attemptsCount: summary.attemptsCount,
    };
    evaluation.submitResult(
      summary.passed,
      summary.accuracy,
      metrics,
      { itemResults: summary.outcomes, learningResponses: summary.learningResponses,
        teachingAttempts: summary.teachingAttempts, assistanceProvenance: summary.assistanceProvenance },
      undefined,
      summary.diagnosisEvidence,
    );
  };

  const runner = useWorkspaceRunner<TextStructureItem>({
    primitiveId: 'text-structure-analyzer',
    assignment: textStructureAssignment,
    items,
    workspace,
    objectiveId,
    planItemId: runtimePlanItemId,
    // The SESSION's mode, from the mount: a mount's identity must not change while the workspace owns it.
    evalMode: runtimeEvalMode || evalModeFor(structureType),
    instanceId: resolvedInstanceId,
    onFinished: finish,
    onAffirmed: (item) => {
      setReveal({ action: item.action, answer: item.answer });
      setSolvedIds((prev) => new Set(prev).add(item.id));
    },
  });
  const showSummary = evaluation.hasSubmitted || !!runner.practiceSummary;

  const currentItem = runner.currentItem;
  const actionMeta = ACTION_META[currentItem?.action ?? 'find-signal'];

  // What the tutor and the observer are shown, republished every render. W1 offers no
  // demonstration targets and no presentation; every item is answerable once it opens.
  useLayoutEffect(() => {
    if (!currentItem) return;
    workspace.current = { ...textStructureScene(currentItem, passage), demonstration: [], canDemonstrate: false,
      canPresent: false, readyForResponse: true, mark: () => {}, clearPresentation: () => {} };
    runner.publishWorkspace();
  });

  // Pip: the passage is the question side. On a place-idea item the idea card
  // is already marked on screen, so Pip may point at it; the structure menu and
  // the mats are answers and are never targets.
  const pip = useStimulusPipSurface({
    run: runner, instanceId: resolvedInstanceId, label: 'The passage', finished: showSummary,
    cueId: currentItem?.action === 'place-idea' ? 'idea' : 'stimulus',
  });

  /** The linking words this run has already earned, by sentence: only a credit lights one up. */
  const affirmedWordBySentence = useMemo(() => {
    const map = new Map<number, string>();
    for (const item of items) {
      if (item.action !== 'find-signal' || !solvedIds.has(item.id)) continue;
      map.set(item.sentenceIndex, item.answer);
    }
    return map;
  }, [items, solvedIds]);

  /** Ideas already filed on their mats — same rule. */
  const filedByRegion = useMemo(() => {
    const map = new Map<string, string[]>();
    if (anchorIdeaId) {
      const anchor = keyIdeas.find((k) => k.ideaId === anchorIdeaId);
      const label = templateRegions.find((r) => r.regionId === anchor?.correctRegionId)?.label;
      if (anchor && label) map.set(label, [anchor.text]);
    }
    for (const item of items) {
      if (item.action !== 'place-idea' || !solvedIds.has(item.id)) continue;
      map.set(item.answer, [...(map.get(item.answer) ?? []), item.stimulusText]);
    }
    return map;
  }, [items, solvedIds, anchorIdeaId, keyIdeas, templateRegions]);

  /** The choice just credited, for the reveal ring. Guarded on the ACTION. */
  const revealedChoice =
    runner.revealHeld && reveal && reveal.action === currentItem?.action ? reveal.answer : null;

  const focusSentence =
    currentItem?.action === 'find-signal' && currentItem.showFocusSentence
      ? currentItem.sentenceIndex
      : -1;

  // ── Phase summary ─────────────────────────────────────────────────────────
  const phaseResults = useMemo<PhaseResult[]>(() => {
    if (!runner.practiceSummary) return [];
    return phaseResultsFromSummary(items, runner.practiceSummary, (item) => ({
      label: ACTION_META[item.action].label,
      icon: ACTION_META[item.action].icon,
      accentColor: ACTION_META[item.action].accent,
    }));
  }, [runner.practiceSummary, items]);

  // ============================================================================
  // Render
  // ============================================================================

  if (items.length === 0) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-8 text-center text-slate-400">
          This passage is still being written. Try generating it again.
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  /**
   * The passage — printed material, never an answer surface and never read
   * aloud by the tutor. Nothing here is clickable: the child reads it and says
   * the answer. A linking word is marked only once the tutor has affirmed it.
   */
  const renderPassage = () => (
    <LuminaPanel className="p-4">
      <p className="text-sm leading-relaxed text-slate-200">
        {sentences.map((sentence) => {
          const isFocus = sentence.index === focusSentence;
          const affirmed = affirmedWordBySentence.get(sentence.index);
          const at = affirmed ? wordBoundedIndexOf(sentence.text, affirmed) : -1;
          const body = at >= 0 && affirmed
            ? (
              <>
                {sentence.text.slice(0, at)}
                <span className="rounded bg-amber-400/25 px-0.5 text-amber-200 underline underline-offset-2">
                  {sentence.text.slice(at, at + affirmed.length)}
                </span>
                {sentence.text.slice(at + affirmed.length)}
              </>
            )
            : sentence.text;
          return (
            <span
              key={sentence.index}
              className={`rounded px-0.5 transition-colors ${
                isFocus ? 'bg-sky-400/15 ring-1 ring-sky-400/40' : ''
              }`}
            >
              {body}{' '}
            </span>
          );
        })}
      </p>
    </LuminaPanel>
  );

  /** The structure menu — printed, glossed, and not a button. The child says
   *  which one it is; the ring appears only when the tutor affirms. */
  const renderStructureMenu = (item: TextStructureItem) => (
    <div className="grid gap-2">
      {item.choices.map((label, idx) => {
        const isRevealed = revealedChoice === label;
        return (
          <div
            key={label}
            className={`rounded-xl border p-3 transition-colors ${
              isRevealed
                ? 'border-emerald-400/40 bg-emerald-500/15'
                : 'border-white/10 bg-white/5'
            }`}
          >
            <p className={`text-sm font-medium ${isRevealed ? 'text-emerald-200' : 'text-slate-100'}`}>
              {label}
            </p>
            {item.choiceNotes[idx] && (
              <p className="mt-0.5 text-xs text-slate-400">{item.choiceNotes[idx]}</p>
            )}
          </div>
        );
      })}
    </div>
  );

  /** The mats. Nothing is clickable and nothing is dragged: the child says the
   *  mat's name. Filed ideas are what the tutor has already affirmed, plus the
   *  `easy` worked anchor, which is marked as the example it is. */
  const renderMats = (item: TextStructureItem) => (
    <div className={`grid gap-3 ${item.choices.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
      {item.choices.map((label, idx) => {
        const filed = filedByRegion.get(label) ?? [];
        const isRevealed = revealedChoice === label;
        const zoneState: DropZoneState = isRevealed ? 'correct' : filed.length > 0 ? 'filled' : 'idle';
        return (
          <div key={label} className="w-full">
            <h3 className={`mb-2 text-center text-sm font-bold ${MAT_COLORS[idx] ?? MAT_COLORS[0]}`}>
              {label}
            </h3>
            <LuminaDropZone
              state={zoneState}
              className="min-h-[88px] content-start justify-start gap-1 pointer-events-none p-2"
            >
              {filed.map((text) => (
                <span key={text} className="rounded bg-black/20 px-2 py-1 text-xs text-slate-200">
                  {text}
                  {anchorIdeaId
                    && keyIdeas.find((k) => k.ideaId === anchorIdeaId)?.text === text
                    && <span className="ml-1 opacity-60">(example)</span>}
                </span>
              ))}
            </LuminaDropZone>
          </div>
        );
      })}
    </div>
  );

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
            <LuminaBadge className="text-xs">Grade {gradeLevel}</LuminaBadge>
          </div>
          {/* NO STRUCTURE BADGE. The click era printed the answer here. */}
          {!showSummary && (
            <LuminaBadge accent={actionMeta.accent} className="text-xs">
              {actionMeta.icon} {actionMeta.label}
            </LuminaBadge>
          )}
        </div>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {!showSummary && (
          <>
            <div className="flex items-center justify-center gap-4">
              <LuminaChallengeCounter
                current={Math.min(runner.currentIndex + 1, items.length)}
                total={items.length}
                variant="dots"
              />
              <LuminaReadAloudGlyph size={22} speaking={runner.tutorSpeaking} />
            </div>

            {pip.store && <div {...pip.dock} />}
            <div {...pip.target('stimulus')}>{renderPassage()}</div>

            {currentItem?.action === 'name-structure' && renderStructureMenu(currentItem)}

            {currentItem?.action === 'place-idea' && (
              <div className="space-y-3">
                <div className="flex justify-center">
                  <div {...pip.target('idea')} className="rounded-2xl border-2 border-white/15 bg-white/5 px-6 py-3 text-center text-sm font-medium text-slate-100">
                    {currentItem.stimulusText}
                  </div>
                </div>
                {renderMats(currentItem)}
              </div>
            )}

          </>
        )}

        {showSummary && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={evaluation.submittedResult?.score ?? runner.teachingResult?.accuracy}
            durationMs={evaluation.elapsedMs}
            heading="Text Structure Complete!"
            celebrationMessage="Great reading — you told me every answer out loud!"
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

/** Runs only on the teaching workspace; an unbound mount shows the "needs the tutor" card. */
const TextStructureAnalyzer = withWorkspaceOnly<TextStructureAnalyzerProps>('text-structure-analyzer',
  TextStructureAnalyzerSurface, (props) => props.data.title);

export default TextStructureAnalyzer;
