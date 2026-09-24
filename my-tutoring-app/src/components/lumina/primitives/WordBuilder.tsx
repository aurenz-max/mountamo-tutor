'use client';

/**
 * WordBuilder — the tutor says what a word MEANS and the child says the word,
 * built from the morpheme parts on the board. It runs only on the shared tutor/JEV
 * teaching workspace (workspace rollout C2; the scripted runner was retired, LA-14,
 * user ruling 09-23: one path). The observer judges the spoken word and the runtime
 * owns progression. An unbound mount shows the shared "needs the tutor" card. There
 * is no advance timer, no Check button and no Next button anywhere in this file.
 *
 * ── WHAT CHANGED, AND WHY THE CARDS SURVIVED THE BUTTON ─────────────────────
 * The click-era primitive was drag-to-slots + Check + Next. The port was queued
 * as a HYBRID — build with the hands, then say the word — and the user
 * overturned that on sight: *"kind of disagree on tap, this feels like a pure
 * spoken with cards on the board"*. Correct, and for a reason specific to this
 * skill: a spoken "unhelpful" CARRIES its own decomposition (/ʌn/-/hɛlp/-/fəl/
 * is audible), where a spoken "cat" does not carry c-a-t. Morphemes are
 * pronounceable; graphemes are not. So the arrangement is not an answer with no
 * spoken form, and the tap was a costume — the same one `phonics-blender`'s
 * first port wore and shed.
 *
 * What is NOT a costume is the BOARD. A morpheme wall with meanings is what a
 * teacher lays on the table, and it is the difference between morphological
 * construction and plain vocabulary recall. It stays, as PRINT: nothing on it
 * is tappable, because a tappable card is a menu and a menu is a guess floor.
 *
 * ── ANSWER-LEAK RULE ────────────────────────────────────────────────────────
 * The word, its assembly, its definition and the completed sentence appear on
 * screen ONLY after the word is credited, and they hold while the credit does
 * (`runner.revealHeld`). The clue never contains the
 * word and the board never shows it — both enforced at build time by
 * `itemsFromTargets`, which DROPS what cannot be asked rather than repairing it.
 *
 * The reveal is gated on `revealHeld` and NOT cleared in `onItemOpened`: a
 * credit that also advances opens the next item in the SAME dispatch, so a
 * payload cleared there paints on the last item and nowhere else (18b).
 */

import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  LuminaBadge,
  LuminaButton,
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaChallengeCounter,
  LuminaPanel,
} from '../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../evaluation';
import type { WordBuilderMetrics } from '../evaluation/types';
import { useLuminaAIContext } from '@/contexts/LuminaAIContext';
import type { TeachingWorkspace } from '../components/live-activity/runtime/useTeachingWorkspace';
import { withWorkspaceOnly } from '../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceRunner, type TeachingEvaluationResult }
  from '../components/live-activity/runtime/useWorkspaceRunner';
import {
  itemsFromTargets,
  type WordBuilderComplexity,
  type WordBuilderItem,
} from './visual-primitives/literacy/wordBuilderScript';
import { hearClueRequest, wordBuilderAssignment, wordBuilderScene } from './visual-primitives/literacy/wordBuilderWorkspace';
import { useStimulusPipSurface } from '../pip/useStimulusPipSurface';
import PhaseSummaryPanel, { type PhaseResult } from '../components/PhaseSummaryPanel';
import { phaseResultsFromSummary } from '../hooks/usePhaseResults';
import type { WordBuilderData } from '../types';

// ============================================================================
// Props
// ============================================================================

interface WordBuilderProps {
  data: WordBuilderData;
  className?: string;
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted. */
  runtimeEvalMode?: string;
}

// ============================================================================
// Display config
// ============================================================================

/** Typed to the PHASE panel's narrower accent set, which is a subset of
 *  `LuminaAccent` — one constant feeds both the badge and the summary rows. */
type PhaseAccent = NonNullable<PhaseResult['accentColor']>;

const COMPLEXITY_META: Record<
  WordBuilderComplexity,
  { badge: string; icon: string; accent: PhaseAccent }
> = {
  simple_affix: { badge: 'Simple Affixes', icon: '🟢', accent: 'emerald' },
  compound_affix: { badge: 'Compound Affixes', icon: '🟡', accent: 'amber' },
  greek_latin: { badge: 'Greek & Latin Roots', icon: '🟠', accent: 'orange' },
  multi_morpheme: { badge: 'Multi-Morpheme', icon: '🔴', accent: 'pink' },
};

const PART_COLORS: Record<string, string> = {
  prefix: 'bg-purple-500/15 border-purple-400/30 text-purple-100',
  root: 'bg-blue-500/15 border-blue-400/30 text-blue-100',
  suffix: 'bg-emerald-500/15 border-emerald-400/30 text-emerald-100',
};

const SLOT_LABEL_COLORS: Record<string, string> = {
  prefix: 'text-purple-300',
  root: 'text-blue-300',
  suffix: 'text-emerald-300',
};

// ============================================================================
// Component
// ============================================================================

function WordBuilderSurface({ data, className, runtimePlanItemId, runtimeEvalMode }: WordBuilderProps) {
  const {
    title,
    targets = [],
    availableParts = [],
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const complexity: WordBuilderComplexity = data.complexityLevel ?? 'compound_affix';
  const ctx = useLuminaAIContext();
  const workspace = useRef<TeachingWorkspace | null>(null);

  const stableInstanceIdRef = useRef(instanceId || `word-builder-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // ── Items (drop-gated). Every display below binds to THESE, never to
  //    `targets` by index — a gate that can drop makes a positional binding
  //    render one word while the tutor asks about another. ──
  const items = useMemo<WordBuilderItem[]>(() => {
    const built = itemsFromTargets(targets, availableParts, complexity);
    if (built.length < targets.length) {
      console.warn(
        `[WordBuilder] dropped ${targets.length - built.length} unaskable target(s) `
        + '(composition/leak/sayability gates)',
      );
    }
    return built;
  }, [targets, availableParts, complexity]);

  // ── Evaluation ────────────────────────────────────────────────────────────
  const evaluation = usePrimitiveEvaluation<WordBuilderMetrics>({
    primitiveType: 'word-builder',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const finish = (summary: TeachingEvaluationResult) => {
    const metrics: WordBuilderMetrics = {
      type: 'word-builder',
      complexityLevel: complexity,
      wordsCompleted: summary.solvedCount,
      wordsTotal: items.length,
      accuracy: summary.accuracy,
      attemptsCount: summary.attemptsCount,
      firstTryCorrect: summary.firstTryCount,
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

  // ── The reveal payload. Set on the affirmation, rendered behind
  //    `revealHeld`, and deliberately NOT cleared when the next item opens. ──
  const [revealed, setRevealed] = useState<WordBuilderItem | null>(null);

  const runner = useWorkspaceRunner<WordBuilderItem>({
    primitiveId: 'word-builder',
    assignment: wordBuilderAssignment,
    items,
    workspace,
    objectiveId,
    planItemId: runtimePlanItemId,
    // The SESSION's mode, from the mount: a mount's identity must not change while the workspace owns it.
    evalMode: runtimeEvalMode || complexity,
    instanceId: resolvedInstanceId,
    onFinished: finish,
    onAffirmed: setRevealed,
  });

  const currentItem = runner.currentItem;
  const showSummary = evaluation.hasSubmitted || !!runner.practiceSummary;
  // Pip: the clue is the question side; the word-part wall is what the answer
  // is built from, so Pip points only at the clue.
  const pip = useStimulusPipSurface({
    run: runner, instanceId: resolvedInstanceId, label: 'The clue', finished: showSummary,
  });
  const showReveal = runner.revealHeld && revealed != null;

  // What the tutor and the observer are shown, republished every render.
  // W1 offers no demonstration targets and no presentation.
  useLayoutEffect(() => {
    if (!currentItem) return;
    workspace.current = { ...wordBuilderScene(currentItem, availableParts), demonstration: [], canDemonstrate: false,
      canPresent: false, readyForResponse: true, mark: () => {}, clearPresentation: () => {} };
    runner.publishWorkspace();
  });

  /** Asks the tutor for the clue again: a silent host request, never the word. */
  const hearClue = useCallback(() => {
    if (!currentItem) return;
    ctx.sendText(hearClueRequest(currentItem), { silent: true, author: 'host' });
  }, [ctx, currentItem]);

  // ── Phase summary ─────────────────────────────────────────────────────────
  const phaseResults = useMemo<PhaseResult[]>(() => {
    if (!runner.practiceSummary) return [];
    return phaseResultsFromSummary(items, runner.practiceSummary, (item) => ({
      label: item.word,
      icon: COMPLEXITY_META[item.complexity].icon,
      accentColor: COMPLEXITY_META[item.complexity].accent,
    }));
  }, [runner.practiceSummary, items]);

  // ============================================================================
  // Render
  // ============================================================================

  if (items.length === 0 || !currentItem) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-6">
          <p className="text-slate-400 text-center">No words available to build.</p>
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  const meta = COMPLEXITY_META[currentItem.complexity];

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
          {!showSummary && (
            <LuminaBadge accent={meta.accent} className="text-xs">
              {meta.icon} {meta.badge}
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

            {/* The clue — the whole question side, printed AND spoken. This
                band reads, so print is honest stimulus; the tutor says it too
                because every correction re-ask inherits the ask. */}
            {pip.store && <div {...pip.dock} />}
            {(
              <LuminaPanel {...pip.target('stimulus')} className="text-center">
                <p className="text-xs text-slate-500 font-mono uppercase tracking-widest mb-1">
                  Build the word that means
                </p>
                <p className="text-slate-100 text-lg font-medium">{currentItem.clue}</p>
              </LuminaPanel>
            )}

            {/* The reveal — the FIRST moment the word, its assembly and its
                definition may appear. Held for the length of her affirmation. */}
            {showReveal && revealed && (
              <LuminaPanel className="p-4 text-center border-emerald-400/30 bg-emerald-500/10">
                <p className="text-2xl font-black text-emerald-200">{revealed.word}</p>
                <div className="flex flex-wrap items-end justify-center gap-2 mt-3">
                  {revealed.parts.map((part, i) => (
                    <React.Fragment key={`${revealed.id}-slot-${i}`}>
                      {i > 0 && <span className="text-emerald-400/60 text-lg pb-2">+</span>}
                      <div className="flex flex-col items-center gap-1">
                        <span
                          className={`text-[10px] font-mono uppercase tracking-widest ${
                            SLOT_LABEL_COLORS[part.type] ?? 'text-slate-400'
                          }`}
                        >
                          {part.type}
                        </span>
                        <div
                          className={`rounded-lg border px-3 py-2 ${
                            PART_COLORS[part.type] ?? 'bg-white/5 border-white/10'
                          }`}
                        >
                          <span className="text-base font-bold">{part.text}</span>
                          <span className="block text-[10px] opacity-70">{part.meaning}</span>
                        </div>
                      </div>
                    </React.Fragment>
                  ))}
                </div>
                {revealed.definition && (
                  <p className="text-sm text-slate-300 mt-3">{revealed.definition}</p>
                )}
                {revealed.sentenceContext && (
                  <p className="text-sm text-slate-400 italic mt-1">
                    &ldquo;{revealed.sentenceContext.replace(/_{2,}/g, revealed.word)}&rdquo;
                  </p>
                )}
              </LuminaPanel>
            )}

            {/* The board — the morpheme word wall. PRINT, not an answer
                surface: a tappable card would turn production into a menu. */}
            <div>
              <p className="text-xs text-slate-500 font-mono uppercase tracking-widest mb-2">
                Word parts
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {availableParts.map((part) => (
                  <div
                    key={part.id}
                    className={`rounded-xl border p-2.5 text-center ${
                      PART_COLORS[part.type] ?? 'bg-white/5 border-white/10'
                    }`}
                  >
                    <span className="block text-base font-bold">{part.text}</span>
                    <span className="block text-[10px] font-mono uppercase opacity-60">
                      {part.type}
                    </span>
                    <span className="block text-xs opacity-85">{part.meaning}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Every answer here is spoken; the tutor repeats the clue on request. */}
            <div className="text-center">
              <LuminaButton tone="subtle" size="sm" className="text-slate-400" onClick={hearClue}>
                Say the clue again
              </LuminaButton>
            </div>
          </>
        )}

        {showSummary && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={evaluation.submittedResult?.score ?? runner.teachingResult?.accuracy}
            durationMs={evaluation.elapsedMs}
            heading="Word Building Complete!"
            celebrationMessage="You built every word out loud — that is how big words come apart."
            className="mt-4"
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
}

// The teaching workspace is the only path: an unbound mount shows the "needs the tutor" card.
const WordBuilder = withWorkspaceOnly<WordBuilderProps>('word-builder', WordBuilderSurface, props => props.data.title);

export default WordBuilder;
