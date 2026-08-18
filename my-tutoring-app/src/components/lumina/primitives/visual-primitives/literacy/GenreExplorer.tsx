'use client';

/**
 * GenreExplorer — DI modality (NINETEENTH literacy port, 2026-08-17;
 * qa/di/BACKLOG.md item 22, port 2 of the closed-set literacy frontier). The Live
 * tutor owns the clock: it asks ONCE, waits, judges the child's spoken answer
 * from the audio in-band, corrects contrastively, and its OWN affirmation is the
 * advance. There is no advance timer, no Next button, no push-to-talk mic, and no
 * answer on screen before the tutor affirms.
 *
 * THE MODALITY, in one sitting:
 *
 *   "Listen to the first one. A fox saw some grapes hanging high …
 *    Your turn. Does the first one have animals that talk?"     → "yes"
 *   "Yes, that is right — the first one does have animals that talk."
 *   "Your turn. What kind of writing is the first one?
 *    Fable, Poem, or Informational?"                            → "Fable"
 *   "Does the first one teach a lesson at the end, or does the
 *    second one?"                                               → "the first one"
 *
 * WHAT WENT, AND WHY:
 *  - **The feature CHECKLIST.** Six to eight toggle rows, each a 1-in-2 coin flip,
 *    every one of which a child who cannot tell a fable from a news report clicks
 *    perfectly. The rows survive as the evidence step — SPOKEN, one judged yes/no
 *    each, which is the DISTAR discrimination question the checklist was pretending
 *    to be.
 *  - **The genre tap.** `LuminaAnswerChoice` cards over `genreOptions`. Saying the
 *    genre is production; tapping it is recognition at 1/N.
 *  - **The Read/Features/Classify/Review rail, the phase chips, the excerpt tabs,
 *    the "Compare Excerpts Side by Side" button and Submit.** Corrections cap in
 *    the runner; `PhaseSummaryPanel` reports.
 *  - **The Review phase**, which printed each excerpt's correct genre beside a
 *    right/wrong chip — the click era's answer key, rendered.
 *
 * WHAT STAYED — the PAGE, never the voice:
 *  - The texts. They are the reading material.
 *  - The printed genre menu with its kid-friendly glosses. A genre question whose
 *    candidates are unknowable is a broken task, not a harder one.
 *  - Tap-to-hear, which re-speaks the QUESTION — and, at the band floor, the text
 *    with it, because there the text IS question-side audio.
 *
 * ⚠️ THE TUTOR READS THE TEXT AT GRADES K-2, WHICH IS THE OPPOSITE OF THE PORT
 * BEFORE IT. text-structure-analyzer's tutor may never read the passage, because
 * its answer is a word IN the passage. Genre's answer is a CATEGORY NAME that is
 * not in the text at all (`namesAGenre` drops any excerpt that says one), so
 * reading a fable aloud gives nothing away — and `identify_basic` is grades 1-2,
 * where a child cannot decode four sentences unaided. The rule is a property of
 * the answer material, not a family constant.
 *
 * Cue lines, judging contracts and build gates live in `genreExplorerScript.ts`
 * (hand-authored, DISTAR). Nothing in this file writes a spoken line.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  LuminaBadge,
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaChallengeCounter,
  LuminaPanel,
  LuminaReadAloudGlyph,
} from '../../../ui';
import JudgedMicPanel from '../../../components/JudgedMicPanel';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { GenreExplorerMetrics } from '../../../evaluation/types';
import {
  useJudgedScriptRunner,
  type JudgedRunSummary,
} from '../../../hooks/useJudgedScriptRunner';
import type { JudgedScriptPack } from '../../../hooks/judgedScriptContract';
import { phaseResultsFromSummary } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel, { type PhaseResult } from '../../../components/PhaseSummaryPanel';
import {
  genreExplorerPackBase,
  itemsFromPayload,
  type GenreAction,
  type GenreExplorerItem,
  type GenreTier,
} from './genreExplorerScript';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface GenreExcerpt {
  /** EXACTLY 'e1' | 'e2' | 'e3', in order — `presentIn` points at these. */
  excerptId: string;
  text: string;
  /** A canonical `GenreId` from `genreExplorerScript`. */
  genre: string;
}

/**
 * One row of evidence, shared across the whole activity.
 *
 * ⚠️ `predicate` REPLACES the click era's `label`, and it is not a rename. The
 * child hears "Does this one ___?", so the field must be a BASE-VERB phrase that
 * completes it: "have animals that talk", not "Has characters". A heading form
 * produces "Does this one has characters?" and is DROPPED by the build gates
 * rather than conjugated — the schema owns the grammar, not a regex on our side.
 *
 * `presentIn` replaces a per-excerpt `present` boolean because the entire
 * `compare_genres` question is "true of THIS one but not that one", which was a
 * cross-reference between two sibling arrays and is now one field.
 */
export interface GenreFeature {
  featureId: string;
  predicate: string;
  /** The excerptIds this is TRUE of. `[]` = true of none. */
  presentIn: string[];
}

export interface GenreExplorerData {
  title: string;
  gradeLevel: string;
  /**
   * Classification task identity (eval mode). The judged pack branches on it in
   * exactly ONE place: `compare_genres` builds contrast questions across two
   * texts, the other two build evidence-then-verdict per text.
   */
  mode?: 'identify_basic' | 'classify_genre' | 'compare_genres';
  excerpts: GenreExcerpt[];
  features: GenreFeature[];
  /** Canonical `GenreId`s. Labels and glosses are owned by the script module —
   *  the child SAYS one out loud, so it may not be authored per generation. */
  genreOptions: string[];

  // ──────────────────────────────────────────────────────────────────────
  // Within-mode support tier (config.difficulty) — scaffolding only. These
  // NEVER change an excerpt, its genre, or any presentIn value.
  // ──────────────────────────────────────────────────────────────────────

  /** easy/medium: the ASK names the genre menu aloud; hard prints it only (the
   *  band floor forces it on at every tier). Consumed by the script module. */
  supportTier?: GenreTier;
  /** easy: fewer genres in the spoken menu. Never trims a correct answer, and
   *  saturates at 2 in `identify_basic`, which is a real ceiling. */
  maxGenreOptions?: number;

  /** @deprecated Click-era side-by-side toggle. `mode` decides the shape now. */
  comparisonEnabled?: boolean;

  // Evaluation props
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<GenreExplorerMetrics>) => void;
}

interface GenreExplorerProps {
  data: GenreExplorerData;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

type GenreAccent = NonNullable<PhaseResult['accentColor']>;

const ACTION_META: Record<GenreAction, { label: string; icon: string; accent: GenreAccent }> = {
  'check-feature': { label: 'What Is In It', icon: '🔍', accent: 'amber' },
  'name-genre': { label: 'What Kind Of Writing', icon: '📚', accent: 'blue' },
  'pick-excerpt': { label: 'Which One', icon: '⚖️', accent: 'emerald' },
};

// ============================================================================
// Component
// ============================================================================

const GenreExplorer: React.FC<GenreExplorerProps> = ({ data, className }) => {
  const {
    title,
    gradeLevel = '3',
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const stableInstanceIdRef = useRef(instanceId || `genre-explorer-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  /** Build gates drop what cannot be asked — a placeholder in a judged loop
   *  becomes a spoken ask the tutor has to stand behind. */
  const { items, excerpts, menu, menuNotes } = useMemo(() => itemsFromPayload(data), [data]);

  /**
   * The affirmed item's reveal payload. Set on the affirm and rendered behind
   * `runner.revealHeld` — NOT `currentSolved` and NOT `stage`, and deliberately
   * never cleared in `onItemOpened` (18b): the runner opens the next item in the
   * SAME dispatch as the affirmation, so both of the obvious gates are already
   * false by render time and a payload cleared there paints on the last item and
   * nowhere else.
   */
  const [reveal, setReveal] = useState<{ action: GenreAction; answer: string } | null>(null);

  // ── Evaluation ─────────────────────────────────────────────────────────────
  const evaluation = usePrimitiveEvaluation<GenreExplorerMetrics>({
    primitiveType: 'genre-explorer',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const handleFinished = useCallback((summary: JudgedRunSummary) => {
    const solvedOf = (...actions: GenreAction[]) => {
      const ids = new Set(items.filter((i) => actions.includes(i.action)).map((i) => i.id));
      return summary.outcomes.filter((o) => ids.has(o.id) && o.solved).length;
    };
    const totalOf = (...actions: GenreAction[]) =>
      items.filter((i) => actions.includes(i.action)).length;

    const metrics: GenreExplorerMetrics = {
      type: 'genre-explorer',
      genresIdentifiedCorrectly: solvedOf('name-genre'),
      genresTotal: totalOf('name-genre'),
      // The evidence step, whichever shape this mode gave it: a yes/no about one
      // text, or a contrast across two.
      featuresCheckedCorrectly: solvedOf('check-feature', 'pick-excerpt'),
      featuresTotal: totalOf('check-feature', 'pick-excerpt'),
      // ⚠️ EARNED, NOT OFFERED. The click era set this true when the child pressed
      // "Compare Excerpts Side by Side" — a button press recorded as an analysis.
      // It now means the child answered a contrast question correctly.
      comparisonMade: solvedOf('pick-excerpt') > 0,
      attemptsCount: summary.attemptsCount,
    };
    evaluation.submitResult(
      summary.passed,
      summary.accuracy,
      metrics,
      { itemResults: summary.outcomes, hearTaps: summary.hearTaps },
      undefined,
      summary.diagnosisEvidence,
    );
  }, [items, evaluation]);

  // ── The pack — wording lives in genreExplorerScript.ts ─────────────────────
  const pack = useMemo<JudgedScriptPack<GenreExplorerItem>>(() => ({
    ...genreExplorerPackBase(items),
    statusLines: {
      idle: 'Tap the microphone to start reading.',
      ready: () => 'Listen — then say your answer out loud.',
      retry: () => 'Have another go — say your answer out loud.',
      noVerdict: () => 'One more time — say your answer out loud.',
      done: 'Great reading today!',
    },
    diagnosisObservation: (item, { lastHeard }) => {
      const heard = lastHeard?.trim() ?? '';
      const challenge = item.action === 'check-feature'
        ? `Say yes or no: does ${item.excerptOrdinal} ${item.predicate}?`
        : item.action === 'pick-excerpt'
          ? `Say which of two texts ${item.predicate}.`
          : 'Read a text, then say what kind of writing it is.';
      return {
        challenge,
        expected: `"${item.answer}" said out loud.`,
        observed: heard ? `Said "${heard}".` : 'Said something that did not match.',
      };
    },
  }), [items]);

  const runner = useJudgedScriptRunner<GenreExplorerItem>({
    pack,
    instanceId: resolvedInstanceId,
    gradeLevel,
    exhibitId,
    onFinished: handleFinished,
    onAffirmed: (item) => setReveal({ action: item.action, answer: item.answer }),
  });

  const currentItem = runner.currentItem;
  const actionMeta = ACTION_META[currentItem?.action ?? 'check-feature'];

  /**
   * The evidence this run has already EARNED, in the order it was earned. Read
   * off the runner's solved ledger rather than a local list, so the only thing
   * that can put a finding on screen is a tutor affirmation.
   */
  const findings = useMemo(() => {
    const rows: Array<{ id: string; text: string; positive: boolean }> = [];
    for (const item of items) {
      if (!runner.solvedIds.has(item.id)) continue;
      if (item.action === 'check-feature') {
        rows.push({
          id: item.id,
          text: `${item.excerptOrdinal} ${item.answer === 'yes' ? 'does' : 'does not'} ${item.predicate}`,
          positive: item.answer === 'yes',
        });
      } else if (item.action === 'pick-excerpt') {
        rows.push({ id: item.id, text: `${item.answer} does ${item.predicate}`, positive: true });
      }
    }
    return rows;
  }, [items, runner.solvedIds]);

  /** Genres the tutor has already affirmed, by excerpt index — the only route by
   *  which a genre name reaches the screen. */
  const affirmedGenreByExcerpt = useMemo(() => {
    const map = new Map<number, string>();
    for (const item of items) {
      if (item.action !== 'name-genre' || !runner.solvedIds.has(item.id)) continue;
      map.set(item.excerptIndex, item.answer);
    }
    return map;
  }, [items, runner.solvedIds]);

  /** What the tutor is affirming right now, for the reveal ring. Guarded on the
   *  ACTION: by render time the surface may already point at the next step. */
  const revealed =
    runner.revealHeld && reveal && reveal.action === currentItem?.action ? reveal.answer : null;

  /**
   * Which texts are on screen. A contrast item is about BOTH, so both are shown;
   * every other item shows the one it is about, which keeps a six-year-old's
   * attention where the question is.
   */
  const shownExcerpts = useMemo(() => {
    if (!currentItem || currentItem.excerptIndex < 0) return excerpts;
    return excerpts.filter((e) => e.index === currentItem.excerptIndex);
  }, [currentItem, excerpts]);

  // ── Phase summary ─────────────────────────────────────────────────────────
  const phaseResults = useMemo<PhaseResult[]>(() => {
    if (!evaluation.hasSubmitted) return [];
    return phaseResultsFromSummary(items, runner.summary, (item) => ({
      label: ACTION_META[item.action].label,
      icon: ACTION_META[item.action].icon,
      accentColor: ACTION_META[item.action].accent,
    }));
  }, [evaluation.hasSubmitted, runner.summary, items]);

  // ============================================================================
  // Render
  // ============================================================================

  if (items.length === 0) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-8 text-center text-slate-400">
          This reading activity is still being written. Try generating it again.
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  /**
   * The texts — printed material, never an answer surface and never clickable.
   * A genre label appears here only once the tutor has affirmed it, which is what
   * the click era's Review phase was doing four phases too early.
   */
  const renderExcerpts = () => (
    <div className={`grid gap-3 ${shownExcerpts.length > 1 ? 'md:grid-cols-2' : ''}`}>
      {shownExcerpts.map((excerpt) => {
        const affirmedGenre = affirmedGenreByExcerpt.get(excerpt.index);
        const isRevealed = revealed === excerpt.ordinal;
        return (
          <LuminaPanel
            key={excerpt.excerptId}
            className={`p-4 transition-colors ${
              isRevealed ? 'ring-2 ring-emerald-400/50 bg-emerald-500/10' : ''
            }`}
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-400">
                {excerpts.length > 1 ? excerpt.ordinal : 'the text'}
              </span>
              {affirmedGenre && (
                <LuminaBadge accent="emerald" className="text-xs">{affirmedGenre}</LuminaBadge>
              )}
            </div>
            <p className="whitespace-pre-line text-sm leading-relaxed text-slate-200">
              {excerpt.text}
            </p>
          </LuminaPanel>
        );
      })}
    </div>
  );

  /** What the child has established out loud, so far. Nothing lands here that the
   *  tutor has not affirmed. */
  const renderFindings = () => (
    <div className="space-y-1">
      {findings.map((finding) => (
        <p key={finding.id} className="text-xs text-slate-400">
          <span className={finding.positive ? 'text-emerald-300' : 'text-slate-500'}>
            {finding.positive ? '✓' : '✗'}
          </span>{' '}
          {finding.text}
        </p>
      ))}
    </div>
  );

  /** The genre menu — printed, glossed, and not a button. The child says which
   *  one it is; the ring appears only when the tutor affirms. */
  const renderMenu = () => (
    <div className="grid gap-2 sm:grid-cols-2">
      {menu.map((label, idx) => {
        const isRevealed = revealed === label;
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
            {menuNotes[idx] && (
              <p className="mt-0.5 text-xs text-slate-400">{menuNotes[idx]}</p>
            )}
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
          {/* NO GENRE BADGE ANYWHERE. The click era's Review phase printed each
              excerpt's correct genre beside a right/wrong chip. */}
          {!evaluation.hasSubmitted && (
            <LuminaBadge accent={actionMeta.accent} className="text-xs">
              {actionMeta.icon} {actionMeta.label}
            </LuminaBadge>
          )}
        </div>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {!evaluation.hasSubmitted && (
          <>
            <div className="flex items-center justify-center gap-4">
              <LuminaChallengeCounter
                current={Math.min(runner.currentIndex + 1, items.length)}
                total={items.length}
                variant="dots"
              />
              {/* Tap-to-hear — the question again (and the text with it at the
                  band floor), never a hint ladder, never withdrawn. */}
              <button
                type="button"
                onClick={runner.hearStimulus}
                className={`
                  flex h-11 w-11 items-center justify-center rounded-full
                  bg-amber-500/15 border-2 border-amber-500/30
                  hover:bg-amber-500/25 hover:scale-105 active:scale-95 transition-all
                  ${runner.stimulusTapped ? 'ring-2 ring-cyan-300/60' : ''}
                `}
                aria-label="Hear the question again"
              >
                <span className="text-xl">🔁</span>
              </button>
              <LuminaReadAloudGlyph size={22} speaking={runner.tutorSpeaking} />
            </div>

            {renderExcerpts()}

            {findings.length > 0 && renderFindings()}

            {menu.length > 0 && renderMenu()}

            {/* Open for the whole run — no tutor-busy gate, no push-to-talk. */}
            <JudgedMicPanel run={runner} />
          </>
        )}

        {evaluation.hasSubmitted && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={evaluation.submittedResult?.score}
            durationMs={evaluation.elapsedMs}
            heading="Genre Work Complete!"
            celebrationMessage="Great reading — you told me every answer out loud!"
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default GenreExplorer;
