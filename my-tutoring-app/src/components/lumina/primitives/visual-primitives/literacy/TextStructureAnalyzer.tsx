'use client';

/**
 * TextStructureAnalyzer — DI modality (EIGHTEENTH literacy port, 2026-08-16;
 * qa/di/BACKLOG.md item 22, port 1 of the closed-set literacy frontier). The
 * Live tutor owns the clock: it points at a sentence, asks ONCE, waits, judges
 * the child's spoken answer from the audio in-band, corrects contrastively, and
 * its OWN affirmation is the advance. There is no advance timer, no Next button,
 * no push-to-talk mic, and no answer on screen before the tutor affirms.
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
 *  - Tap-to-hear, which re-speaks the QUESTION and is never withdrawn.
 *
 * Cue lines, judging contracts and build gates live in
 * `textStructureAnalyzerScript.ts` (hand-authored, DISTAR). Nothing in this file
 * writes a spoken line.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
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
import JudgedMicPanel from '../../../components/JudgedMicPanel';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { TextStructureAnalyzerMetrics } from '../../../evaluation/types';
import {
  useJudgedScriptRunner,
  type JudgedRunSummary,
} from '../../../hooks/useJudgedScriptRunner';
import type { JudgedScriptPack } from '../../../hooks/judgedScriptContract';
import { phaseResultsFromSummary } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel, { type PhaseResult } from '../../../components/PhaseSummaryPanel';
import {
  itemsFromPayload,
  textStructureAnalyzerPackBase,
  wordBoundedIndexOf,
  type StructureTypeId,
  type TextStructureAction,
  type TextStructureItem,
  type TextStructureTier,
} from './textStructureAnalyzerScript';

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

const TextStructureAnalyzer: React.FC<TextStructureAnalyzerProps> = ({ data, className }) => {
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

  /** Build gates drop what cannot be asked — a placeholder in a judged loop
   *  becomes a spoken ask the tutor has to stand behind. */
  const { items, sentences } = useMemo(() => itemsFromPayload(data), [data]);

  /**
   * The affirmed item's reveal payload. Set on the affirm and rendered behind
   * `runner.revealHeld` — NOT `currentSolved` and NOT `stage`, and deliberately
   * never cleared in `onItemOpened` (18b): the runner opens the next item in the
   * SAME dispatch as the affirmation, so both of the obvious gates are already
   * false by render time and a payload cleared there paints on the last item and
   * nowhere else.
   */
  const [reveal, setReveal] = useState<{ action: TextStructureAction; answer: string } | null>(null);

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

  const handleFinished = useCallback((summary: JudgedRunSummary) => {
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
      { itemResults: summary.outcomes, hearTaps: summary.hearTaps },
      undefined,
      summary.diagnosisEvidence,
    );
  }, [items, structureType, evaluation]);

  // ── The pack — wording lives in textStructureAnalyzerScript.ts ─────────────
  const pack = useMemo<JudgedScriptPack<TextStructureItem>>(() => ({
    ...textStructureAnalyzerPackBase(items),
    statusLines: {
      idle: 'Tap the microphone to start reading.',
      ready: () => 'Read the passage — then say your answer out loud.',
      retry: () => 'Have another go — say your answer out loud.',
      noVerdict: () => 'One more time — say your answer out loud.',
      done: 'Great reading today!',
    },
    diagnosisObservation: (item, { lastHeard }) => {
      const heard = lastHeard?.trim() ?? '';
      const challenge = item.action === 'find-signal'
        ? `Read one sentence, then say the word that links the ideas: "${item.stimulusText}"`
        : item.action === 'name-structure'
          ? 'Read the whole passage, then say how it is organised.'
          : `Say which part of the chart an idea belongs in: "${item.stimulusText}"`;
      return {
        challenge,
        expected: `"${item.answer}" said out loud.`,
        observed: heard ? `Said "${heard}".` : 'Said something that did not match.',
      };
    },
  }), [items]);

  const runner = useJudgedScriptRunner<TextStructureItem>({
    pack,
    instanceId: resolvedInstanceId,
    gradeLevel,
    exhibitId,
    onFinished: handleFinished,
    onAffirmed: (item) => setReveal({ action: item.action, answer: item.answer }),
  });

  const currentItem = runner.currentItem;
  const actionMeta = ACTION_META[currentItem?.action ?? 'find-signal'];

  /**
   * The linking words this run has already earned, by sentence. Read off the
   * runner's solved ledger rather than a local set, so the only thing that can
   * light a word up in the passage is a tutor affirmation.
   */
  const affirmedWordBySentence = useMemo(() => {
    const map = new Map<number, string>();
    for (const item of items) {
      if (item.action !== 'find-signal' || !runner.solvedIds.has(item.id)) continue;
      map.set(item.sentenceIndex, item.answer);
    }
    return map;
  }, [items, runner.solvedIds]);

  /** Ideas already filed on their mats — same rule, same ledger. */
  const filedByRegion = useMemo(() => {
    const map = new Map<string, string[]>();
    if (anchorIdeaId) {
      const anchor = keyIdeas.find((k) => k.ideaId === anchorIdeaId);
      const label = templateRegions.find((r) => r.regionId === anchor?.correctRegionId)?.label;
      if (anchor && label) map.set(label, [anchor.text]);
    }
    for (const item of items) {
      if (item.action !== 'place-idea' || !runner.solvedIds.has(item.id)) continue;
      map.set(item.answer, [...(map.get(item.answer) ?? []), item.stimulusText]);
    }
    return map;
  }, [items, runner.solvedIds, anchorIdeaId, keyIdeas, templateRegions]);

  /** The choice the tutor is affirming right now, for the reveal ring. Guarded
   *  on the ACTION: by render time the surface may already point at the next
   *  step, and ringing one of its choices would be wrong. */
  const revealedChoice =
    runner.revealHeld && reveal && reveal.action === currentItem?.action ? reveal.answer : null;

  const focusSentence =
    currentItem?.action === 'find-signal' && currentItem.showFocusSentence
      ? currentItem.sentenceIndex
      : -1;

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
              {/* Tap-to-hear — the question again, never a hint ladder, and
                  never withdrawn by band or tier. */}
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

            {renderPassage()}

            {currentItem?.action === 'name-structure' && renderStructureMenu(currentItem)}

            {currentItem?.action === 'place-idea' && (
              <div className="space-y-3">
                <div className="flex justify-center">
                  <div className="rounded-2xl border-2 border-white/15 bg-white/5 px-6 py-3 text-center text-sm font-medium text-slate-100">
                    {currentItem.stimulusText}
                  </div>
                </div>
                {renderMats(currentItem)}
              </div>
            )}

            {/* Open for the whole run — no tutor-busy gate, no push-to-talk. */}
            <JudgedMicPanel run={runner} />
          </>
        )}

        {evaluation.hasSubmitted && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={evaluation.submittedResult?.score}
            durationMs={evaluation.elapsedMs}
            heading="Text Structure Complete!"
            celebrationMessage="Great reading — you told me every answer out loud!"
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default TextStructureAnalyzer;
