'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CategorizationActivityProblemData } from '../../types';
import { InsetRenderer } from './insets';
import { SoundManager } from '../../utils/SoundManager';
import {
  usePrimitiveEvaluation,
  type CategorizationActivityMetrics,
  type PrimitiveEvaluationResult,
} from '../../evaluation';
// Answer FSM + feedback chrome from the Lumina UI kit; the microstep flow
// (one item, tap a group) is the bespoke interaction and stays custom.
import {
  LuminaActionButton,
  LuminaAnswerChoice,
  LuminaChallengeCounter,
  LuminaFeedbackCard,
  answerStateClasses,
  motion,
  type AnswerChoiceState,
} from '../../ui';

/**
 * Categorization Activity — MICROSTEP surface (qa/di/BACKLOG.md item 23 slice 1).
 *
 * One item at a time: the active item shows large, the student taps the group
 * it belongs to, the verdict lands immediately, and the next item appears.
 * This replaced a drag-all-six-then-Verify surface for three reasons:
 * - HTML5 `draggable` never fires on touch devices, so the old surface was
 *   uncompletable on tablets — the primary K-2 device class.
 * - A young reader shown 5-6 items at once must read and hold the whole set;
 *   the microstep asks one decision at a time (user call, 2026-08-18).
 * - Per-item verdicts teach at the moment of the decision; a batch Verify
 *   delivered six verdicts after the last placement, too late to teach.
 *
 * Measurement honesty: each item takes exactly ONE tap — there is no per-item
 * retry, so a 2-category item can't be brute-forced by elimination. Retry is
 * whole-problem (same semantics the batch surface had). The aggregate
 * submission keeps the exact `CategorizationActivityMetrics` shape and fires
 * once, after the last item's beat, so the KnowledgeCheck container's
 * `${instanceId}::pN` completion gate (contract R7) and per-objective
 * attribution (R8) are unchanged.
 *
 * Correction beat: a missed item lands in its CORRECT group marked ✗ — the
 * board a student studies at the end is a true sort (what a teacher does:
 * "no, spoon goes with Hard", and puts it there). `placements` records what
 * the student actually chose; only the rendered landing spot is corrected.
 *
 * This is the DI-off tap surface. Slice 2 (`/add-di-loop`) adds the judged
 * loop over the same one-item model, where the tutor asks "which group?" and
 * the child answers out loud.
 */

interface CategorizationActivityProblemProps {
  data: CategorizationActivityProblemData;
}

// A correct verdict needs the pop + chime to land; a miss holds longer so the
// student sees where the item actually goes before the next one appears.
const CORRECT_BEAT_MS = 1100;
const INCORRECT_BEAT_MS = 2200;

interface VerdictBeat {
  itemText: string;
  chosen: string;
  correct: string;
  isCorrect: boolean;
}

export const CategorizationActivityProblem: React.FC<CategorizationActivityProblemProps> = ({ data }) => {
  // Shuffle items once so sequential category ordering from Gemini doesn't reveal answers
  const shuffledItems = useMemo(() => {
    const items = [...data.categorizationItems];
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }, [data.categorizationItems]);

  // Student's chosen category per item — the honest record that feeds metrics
  // and studentWork, independent of where the chip visually lands.
  const [placements, setPlacements] = useState<{ [itemText: string]: string }>({});
  const [activeIdx, setActiveIdx] = useState(0);
  const [verdictBeat, setVerdictBeat] = useState<VerdictBeat | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    },
    []
  );

  // Destructure evaluation props (injected by KnowledgeCheck/ProblemRenderer)
  const {
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data as any;

  // Initialize evaluation hook
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    resetAttempt: resetEvaluationAttempt,
  } = usePrimitiveEvaluation<CategorizationActivityMetrics>({
    primitiveType: 'knowledge-check',
    instanceId: instanceId || `categorization-${data.id}-${Date.now()}`,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    contentSubject: data.subject,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const activeItem = shuffledItems[activeIdx];

  const correctCategoryOf = (itemText: string): string | undefined =>
    data.categorizationItems.find((i) => i.itemText === itemText)?.correctCategory;

  // Aggregate submission — byte-compatible with the batch surface's metrics.
  const submitAggregate = (finalPlacements: { [itemText: string]: string }) => {
    if (hasSubmittedEvaluation) return;

    const categoryResults = data.categories.map((category) => {
      const itemsPlaced = data.categorizationItems
        .filter((item) => finalPlacements[item.itemText] === category)
        .map((item) => item.itemText);
      const correctItems = data.categorizationItems
        .filter((item) => item.correctCategory === category)
        .map((item) => item.itemText);
      const correctInCategory = itemsPlaced.filter(
        (itemText) => correctCategoryOf(itemText) === category
      ).length;
      const precision =
        itemsPlaced.length > 0 ? Math.round((correctInCategory / itemsPlaced.length) * 100) : 0;

      return {
        categoryId: category,
        categoryName: category,
        itemsPlaced,
        correctItems,
        precision,
      };
    });

    const correctlyCategorized = data.categorizationItems.filter(
      (item) => finalPlacements[item.itemText] === item.correctCategory
    ).length;
    const totalItems = data.categorizationItems.length;
    const accuracy = totalItems > 0 ? Math.round((correctlyCategorized / totalItems) * 100) : 0;
    const allCorrect = correctlyCategorized === totalItems;

    const metrics: CategorizationActivityMetrics = {
      type: 'categorization-activity',
      totalItems,
      correctlyCategorized,
      accuracy,
      categoryResults,
    };

    submitEvaluation(allCorrect, accuracy, metrics, {
      studentWork: {
        itemCategories: finalPlacements,
        instruction: data.instruction,
        categories: data.categories,
      },
    });
  };

  const handleGroupTap = (category: string) => {
    // One tap per item; the beat gate also absorbs StrictMode double-invokes.
    if (!activeItem || verdictBeat || isComplete) return;
    const correct = correctCategoryOf(activeItem.itemText) ?? '';
    const isCorrect = category === correct;
    const nextPlacements = { ...placements, [activeItem.itemText]: category };

    if (isCorrect) {
      SoundManager.playCorrect();
    } else {
      SoundManager.playIncorrect();
    }
    setPlacements(nextPlacements);
    setVerdictBeat({ itemText: activeItem.itemText, chosen: category, correct, isCorrect });

    const isLast = activeIdx >= shuffledItems.length - 1;
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(
      () => {
        setVerdictBeat(null);
        if (isLast) {
          setIsComplete(true);
          submitAggregate(nextPlacements);
        } else {
          setActiveIdx((i) => i + 1);
        }
      },
      isCorrect ? CORRECT_BEAT_MS : INCORRECT_BEAT_MS
    );
  };

  const handleReset = () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    setPlacements({});
    setActiveIdx(0);
    setVerdictBeat(null);
    setIsComplete(false);
    resetEvaluationAttempt();
  };

  // Chips land in their CORRECT group (the board ends true); ✓/✗ records
  // whether the student's tap agreed.
  const landedItemsFor = (category: string) =>
    shuffledItems.filter(
      (item) => placements[item.itemText] !== undefined && item.correctCategory === category
    );

  const groupState = (category: string): AnswerChoiceState => {
    if (verdictBeat) {
      if (category === verdictBeat.correct) return 'correct';
      if (category === verdictBeat.chosen) return 'incorrect';
      return 'dimmed';
    }
    return 'idle';
  };

  const allCorrect =
    isComplete &&
    data.categorizationItems.every((item) => placements[item.itemText] === item.correctCategory);

  if (shuffledItems.length === 0) return null;

  return (
    <div className="w-full">
      {/* Instruction */}
      <h3 className="text-xl md:text-2xl font-bold text-white mb-6 leading-tight">
        {data.instruction}
      </h3>

      {/* Inset (rich inline content) */}
      {data.inset && <InsetRenderer inset={data.inset} />}

      {!isComplete && (
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-slate-400 text-sm">Tap the group where it belongs.</p>
            <LuminaChallengeCounter
              variant="dots"
              current={Math.min(activeIdx + 1, shuffledItems.length)}
              total={shuffledItems.length}
            />
          </div>

          {/* Active item — one decision at a time (the microstep) */}
          {activeItem && (
            <div
              key={activeItem.itemText}
              className={`mb-6 flex justify-center ${motion.reveal}`}
            >
              <div className="px-8 py-5 bg-white/5 border border-white/15 rounded-2xl">
                <span className="text-2xl md:text-3xl font-bold text-white">
                  {activeItem.itemText}
                </span>
              </div>
            </div>
          )}
        </>
      )}

      {/* Group targets — real buttons (touch + keyboard), grading FSM from the
          kit. Landed chips accumulate inside so the sort builds up visibly. */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {data.categories.map((category) => (
          <LuminaAnswerChoice
            key={category}
            state={groupState(category)}
            disabled={!!verdictBeat || isComplete}
            onClick={() => handleGroupTap(category)}
            aria-label={
              activeItem && !isComplete
                ? `Put ${activeItem.itemText} in ${category}`
                : category
            }
            className="min-h-[140px] align-top"
          >
            <h4 className="text-lg font-bold text-blue-400 mb-3">{category}</h4>
            <div className="flex flex-wrap gap-2">
              {landedItemsFor(category).map((item) => {
                const wasRight = placements[item.itemText] === item.correctCategory;
                return (
                  <span
                    key={item.itemText}
                    className={`px-3 py-1.5 rounded-lg border text-sm text-slate-200 ${
                      wasRight ? answerStateClasses.correct : answerStateClasses.incorrect
                    }`}
                  >
                    {item.itemText}
                    <span className={`ml-1.5 ${wasRight ? 'text-emerald-400' : 'text-red-400'}`}>
                      {wasRight ? '✓' : '✗'}
                    </span>
                  </span>
                );
              })}
            </div>
          </LuminaAnswerChoice>
        ))}
      </div>

      {/* Completion — rationale + whole-problem retry (same semantics as batch) */}
      {isComplete && (
        <div className="flex flex-col items-center">
          <div className="w-full space-y-4">
            <LuminaFeedbackCard
              status={allCorrect ? 'correct' : 'insight'}
              label={allCorrect ? 'Correct Analysis' : undefined}
              teachingNote={data.teachingNote}
            >
              {data.rationale}
            </LuminaFeedbackCard>
            <LuminaActionButton action="retry" onClick={handleReset} />
          </div>
        </div>
      )}
    </div>
  );
};
