'use client';

/**
 * WordBuilder — DI modality. The Live tutor owns the clock: it states what a
 * word MEANS, waits, judges the child's spoken word from the audio in-band,
 * corrects contrastively, and its OWN affirmation is the advance. There is no
 * advance timer, no Check button, no Next button and no push-to-talk mic
 * anywhere in this file.
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
 * screen ONLY after the tutor has affirmed, and they hold for exactly as long
 * as her affirmation does (`runner.revealHeld`). The clue never contains the
 * word and the board never shows it — both enforced at build time by
 * `itemsFromTargets`, which DROPS what cannot be asked rather than repairing it.
 *
 * The reveal is gated on `revealHeld` and NOT cleared in `onItemOpened`: the
 * runner affirms and opens the next item in the SAME dispatch, so a payload
 * cleared there (or gated on `currentSolved`) paints on the last item and
 * nowhere else — the family-wide 18b defect.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
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
import {
  useJudgedScriptRunner,
  type JudgedRunSummary,
} from '../hooks/useJudgedScriptRunner';
import type { JudgedScriptPack } from '../hooks/judgedScriptContract';
import {
  itemsFromTargets,
  wordBuilderPackBase,
  type WordBuilderComplexity,
  type WordBuilderItem,
} from './visual-primitives/literacy/wordBuilderScript';
import JudgedMicPanel from '../components/JudgedMicPanel';
import PhaseSummaryPanel, { type PhaseResult } from '../components/PhaseSummaryPanel';
import { phaseResultsFromSummary } from '../hooks/usePhaseResults';
import type { WordBuilderData } from '../types';

// ============================================================================
// Props
// ============================================================================

interface WordBuilderProps {
  data: WordBuilderData;
  className?: string;
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

const WordBuilder: React.FC<WordBuilderProps> = ({ data, className }) => {
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
  const gradeLevel = data.gradeLevel ?? 'grade 4';

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

  const handleFinished = useCallback((summary: JudgedRunSummary) => {
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
      { challengeResults: summary.outcomes },
      undefined,
      summary.diagnosisEvidence,
    );
  }, [complexity, items.length, evaluation]);

  // ── The reveal payload. Set on the affirmation, rendered behind
  //    `revealHeld`, and deliberately NOT cleared when the next item opens. ──
  const [revealed, setRevealed] = useState<WordBuilderItem | null>(null);

  // ── The pack — the tutor's whole side is `wordBuilderPackBase`, spread from
  //    the script module so the DI drive-plan endpoint replays the SAME cues
  //    this component sends. Only what the SCREEN owns stays here. ──
  const pack = useMemo<JudgedScriptPack<WordBuilderItem>>(() => ({
    ...wordBuilderPackBase(items),
    statusLines: {
      ready: () => 'Listen to what the word means, then say the whole word.',
      retry: () => 'Have another go — say the whole word.',
      affirmedNext: 'Yes! You built it.',
      done: 'Great work with word parts today!',
    },
    diagnosisObservation: (item, { lastHeard }) => ({
      challenge: `Say the word that means: ${item.clue}`,
      expected: `${item.word} (${item.parts.map((p) => p.text).join(' + ')})`,
      observed: lastHeard
        ? `Heard "${lastHeard}".`
        : 'The tutor judged the answer wrong from the audio.',
    }),
  }), [items]);

  const runner = useJudgedScriptRunner<WordBuilderItem>({
    pack,
    instanceId: resolvedInstanceId,
    gradeLevel,
    exhibitId,
    onFinished: handleFinished,
    onAffirmed: setRevealed,
  });

  const currentItem = runner.currentItem;
  const showReveal = runner.revealHeld && revealed != null;

  // ── Phase summary ─────────────────────────────────────────────────────────
  const phaseResults = useMemo<PhaseResult[]>(() => {
    if (!evaluation.hasSubmitted) return [];
    return phaseResultsFromSummary(items, runner.summary, (item) => ({
      label: item.word,
      icon: COMPLEXITY_META[item.complexity].icon,
      accentColor: COMPLEXITY_META[item.complexity].accent,
    }));
  }, [evaluation.hasSubmitted, runner.summary, items]);

  // ============================================================================
  // Render
  // ============================================================================

  if (items.length === 0) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-6">
          <p className="text-slate-400 text-center">No words available to build.</p>
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  const meta = COMPLEXITY_META[currentItem?.complexity ?? complexity];

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
          {!evaluation.hasSubmitted && (
            <LuminaBadge accent={meta.accent} className="text-xs">
              {meta.icon} {meta.badge}
            </LuminaBadge>
          )}
        </div>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {!evaluation.hasSubmitted && (
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
            {currentItem && (
              <LuminaPanel className="text-center">
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

            {/* Every answer here is spoken. */}
            <JudgedMicPanel run={runner} voiceLabel="I’m listening">
              {runner.running && (
                <LuminaButton
                  tone="subtle"
                  size="sm"
                  className="text-slate-400"
                  onClick={runner.hearStimulus}
                >
                  {runner.stimulusTapped ? 'Listen…' : 'Say the clue again'}
                </LuminaButton>
              )}
            </JudgedMicPanel>
          </>
        )}

        {evaluation.hasSubmitted && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={evaluation.submittedResult?.score}
            durationMs={evaluation.elapsedMs}
            heading="Word Building Complete!"
            celebrationMessage="You built every word out loud — that is how big words come apart."
            className="mt-4"
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default WordBuilder;
