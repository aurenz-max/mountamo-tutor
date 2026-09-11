'use client';

/**
 * ReadAloudStudio — DI modality (ninth literacy port, 2026-08-12). The Live
 * tutor owns the clock: it asks, waits, judges the child's READ from the audio
 * in-band, corrects contrastively, and its own affirmation is the advance.
 * There is no advance timer, no Record button, no Next button, no self-
 * assessment scale and no push-to-talk mic anywhere in this file.
 *
 * WHAT THIS REPLACES. The pre-port surface judged nothing. Its score was
 * `modelListened + recordingMade + selfAssessment + comparisonUsed` — four
 * button presses — and "estimated WPM" was wall-clock duration divided by the
 * passage word count, computed whether or not the child said a single word (tap
 * Start and Stop back to back and it read 6000 WPM). A child who cannot read
 * could tap Play, Start, Stop, then "5 out of 5" and finish with a full score.
 * Every graded action was a costume, so all of them are gone: the four-phase
 * stepper, the fake recorder, the WPM stat, the 1-5 self-rating, the "Compare
 * with Model" toggle and the playback-speed picker. The generated comprehension
 * question went with them — it was produced on every call and never rendered.
 *
 * ONE LINE AT A TIME, IN ORDER, AND NEVER THE WHOLE PASSAGE MID-RUN. The
 * passage arrives already split into 3-8 word lines (the benched judged-
 * utterance window). Expression expands each line into a plan and two reads.
 * Showing the block of text
 * while a single line is being read would put the next line in front of a child
 * still reading this one; the whole passage is the END-OF-RUN reward, which is
 * also when seeing what they read is worth something.
 *
 * WHAT THE TUTOR MAY SPEAK, PER MODE. `accuracy` is a COLD read — the tutor
 * must not say the line before the child does, because decoding print unaided
 * is the entire measurement. `expression` now plans and reads before hearing
 * a model and rereading; `dialogue` models first. In all
 * three the WORDS are the verdict and the delivery is the teaching: there is no
 * prosody response class, so nothing here grades how it sounded. Cue wording,
 * delivery notes, the cold-read guard and the judging contracts are hand-
 * authored in `readAloudStudioScript.ts` and `readAloudPhrasing.ts`; lines that cannot be asked honestly
 * (outside the benched window, a sentinel-opening sentence, dialogue with no
 * speaker) are DROPPED at build — never degraded.
 *
 * CONNECTED TEXT RAISES THE VOICE-TURN FLOOR. A reader pauses between words and
 * the family default (500ms, tuned for one-word answers) splits one read into
 * two turns — di-sentence-reading's ship-blocking bench finding. This pack
 * passes the same 1100ms through the runner.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaBadge,
  LuminaPanel,
  LuminaChallengeCounter,
  motion,
  type LuminaAccent,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { ReadAloudStudioMetrics } from '../../../evaluation/types';
import {
  useJudgedScriptRunner,
  type JudgedRunSummary,
} from '../../../hooks/useJudgedScriptRunner';
import type { JudgedScriptPack } from '../../../hooks/judgedScriptContract';
import JudgedMicPanel from '../../../components/JudgedMicPanel';
import DiActionPanel from '../../../components/DiActionPanel';
import {
  studioItems, studioItemCue, studioMoveCue, studioHearCue, phrasePlanCue,
  markedGroups, scoredReadingItems, readingSummary, type StudioItem,
} from './readAloudPhrasing';
import {
  completeCue,
  passageFrom,
  stimulusFor,
  type ReadAloudLineLike,
  type ReadAloudMode,
} from './readAloudStudioScript';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

/**
 * One printed line of the passage — the judged unit. Dialogue lines carry the
 * SPOKEN WORDS ONLY; the speaker rides in `speaker` and the quotation marks are
 * drawn on screen, so the tutor's cue never contains a stray quote character.
 */
export type ReadAloudLine = ReadAloudLineLike;

export interface ReadAloudStudioData {
  title: string;
  gradeLevel: string;
  /** Which fluency identity this passage practises — the eval mode. */
  fluencyFocus?: ReadAloudMode;
  /** The passage, already split into judged lines, in reading order. */
  lines: ReadAloudLine[];
  lexileLevel: string;

  // Evaluation props
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<ReadAloudStudioMetrics>) => void;
}

interface ReadAloudStudioProps {
  data: ReadAloudStudioData;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Silence that closes a learner voice turn, for CONNECTED TEXT. See the header
 * note: 500ms is right for one-word answers and wrong for a read line.
 */
const LINE_SILENCE_CLOSE_MS = 1100;

const MODE_META: Record<ReadAloudMode, { badge: string; icon: string; accent: LuminaAccent; ready: string }> = {
  accuracy: { badge: 'Read It', icon: '📖', accent: 'blue', ready: 'Read the line out loud — every word.' },
  expression: { badge: 'Phrase and Read', icon: '🎵', accent: 'purple', ready: 'Mark phrases, read, listen, and read again.' },
  dialogue: { badge: 'Character Voice', icon: '🎭', accent: 'amber', ready: 'Listen, then say it their way.' },
};

/** Print size for a reader: as large as the line allows without wrapping into
 *  a wall. Length is the only variable that matters here. */
const lineSizeClass = (wordCount: number): string =>
  wordCount <= 4 ? 'text-5xl' : wordCount <= 6 ? 'text-4xl' : 'text-3xl';

// ============================================================================
// Component
// ============================================================================

const ReadAloudStudio: React.FC<ReadAloudStudioProps> = ({ data, className }) => {
  const {
    title,
    gradeLevel,
    lexileLevel,
    lines = [],
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const mode: ReadAloudMode = data.fluencyFocus ?? 'accuracy';

  const stableInstanceIdRef = useRef(instanceId || `read-aloud-studio-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // ── Items (drop-gated) ────────────────────────────────────────────────────
  const items = useMemo<StudioItem[]>(() => {
    const built = studioItems(lines, mode);
    const lineCount = scoredReadingItems(built).length;
    if (lineCount < lines.length) {
      console.warn(
        `[ReadAloudStudio] dropped ${lines.length - lineCount} unaskable line(s) (word-window / sentinel / speaker gates)`,
      );
    }
    return built;
  }, [lines, mode]);
  const readingItems = useMemo(() => scoredReadingItems(items), [items]);
  const [phrasePlans, setPhrasePlans] = useState<Record<string, number[]>>({});
  const phrasePlansRef = useRef<Record<string, number[]>>({});

  // ── Evaluation ────────────────────────────────────────────────────────────
  const evaluation = usePrimitiveEvaluation<ReadAloudStudioMetrics>({
    primitiveType: 'read-aloud-studio',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const handleFinished = useCallback((summary: JudgedRunSummary) => {
    const scored = readingSummary(items, summary);
    // The runner also acknowledges unscored planning. Build failure evidence
    // from scored-reading observations even if its all-step average passed.
    const source = [...summary.observations].reverse().find((observation) => observation.judgeFeedback)
      ?? summary.observations[summary.observations.length - 1];
    const diagnosisEvidence = !scored.passed && source ? {
      challengeSummary: source.challenge, expected: source.expected, observed: source.observed,
      judgeFeedback: source.judgeFeedback,
      priorAttempts: summary.observations.filter((observation) => observation !== source).slice(-4)
        .map((observation) => ({ challenge: observation.challenge, observed: observation.observed })),
    } : undefined;
    // The set's actual difficulty. Line length is this pack's structural axis,
    // and without it the metrics cannot tell a 3-word set from an 8-word one.
    const meanLineWords = readingItems.length
      ? Math.round((readingItems.reduce((sum, it) => sum + it.wordCount, 0) / readingItems.length) * 10) / 10
      : 0;
    const metrics: ReadAloudStudioMetrics = {
      type: 'read-aloud-studio',
      evalMode: mode,
      fluencyFocus: mode,
      linesTotal: readingItems.length,
      linesRead: scored.solvedCount,
      firstTryCount: scored.firstTryCount,
      attemptsCount: scored.attemptsCount,
      accuracy: scored.accuracy,
      meanLineWords,
      passageLexileLevel: lexileLevel,
    };
    evaluation.submitResult(
      scored.passed,
      scored.accuracy,
      metrics,
      { lineResults: scored.outcomes,
        ...(mode === 'expression' ? {
          practiceVersion: 'phrase-read-reread-v1',
          scoringBasis: 'modeled-reread-word-accuracy',
          prosodyAssessed: false,
          firstReadResults: summary.outcomes.filter((outcome) => outcome.id.endsWith('-first_read')),
          phrasePlans: readingItems.map((item) => ({ lineId: item.lineId,
            learnerGroups: markedGroups(item.text, phrasePlansRef.current[item.lineId] ?? []),
            modelGroups: item.modelGroups })),
        } : {}),
      },
      undefined,
      diagnosisEvidence,
    );
  }, [items, readingItems, mode, lexileLevel, evaluation]);

  // ── The pack — wording lives in readAloudStudioScript.ts ──────────────────
  const pack = useMemo<JudgedScriptPack<StudioItem>>(() => ({
    primitiveType: 'read-aloud-studio',
    activityLine: 'live direct instruction read-aloud fluency practice',
    items,
    itemCue: (item, opts) => studioItemCue(item, opts, phrasePlansRef.current[item.lineId]),
    moveOnCue: (item, next, opts) => studioMoveCue(item, next, opts, next ? phrasePlansRef.current[next.lineId] : []),
    completeCue: mode === 'expression'
      ? () => '[RA_COMPLETE] Say exactly: "You practiced grouping words and reading them together. Great effort today!" Then stop — the activity is over.'
      : completeCue,
    pronounceCue: (item) => studioHearCue(item, phrasePlansRef.current[item.lineId]),
    contextFor: (item) => ({
      challengeType: item.kind,
      stimulus: stimulusFor(item),
    }),
    statusLines: {
      idle: 'Tap the microphone to start reading.',
      ready: (item) => item.step ? item.actionContract.instruction : MODE_META[item.kind].ready,
      retry: () => 'Have another go — read it again.',
      noVerdict: () => 'One more time — read it out loud.',
      affirmedNext: 'Ready for the next step.',
      affirmedLast: 'You read the whole thing!',
      moveOn: 'Good try — here comes the next line.',
      done: 'Great reading today!',
    },
    diagnosisObservation: (item, { lastHeard }) => item.step && item.step !== 'reread' ? null : ({
      challenge: `Read the printed ${item.wordCount}-word line aloud`
        + (item.kind === 'dialogue' ? ` as ${item.speaker} says it` : '')
        + (item.step === 'reread' ? ' after the tutor modelled the phrase' : '')
        + `: "${item.text}".`,
      expected: item.text,
      observed: lastHeard
        ? `Heard "${lastHeard}".`
        : 'The tutor judged the read wrong from the audio.',
    }),
  }), [items, mode]);

  const runner = useJudgedScriptRunner<StudioItem>({
    pack,
    instanceId: resolvedInstanceId,
    gradeLevel,
    exhibitId,
    silenceCloseMs: LINE_SILENCE_CLOSE_MS,
    onFinished: handleFinished,
    onItemOpened: (_item, index) => {
      if (index === 0) {
        phrasePlansRef.current = {};
        setPhrasePlans({});
      }
    },
  });

  const currentItem = runner.currentItem;
  /** Affirmed: the line is marked read in place. The runner owns this latch
   *  now (it replaces the `onItemOpened`/`onAffirmed` pair). */
  const revealed = runner.currentSolved;
  const currentBreaks = currentItem ? phrasePlans[currentItem.lineId] ?? [] : [];
  const canMark = currentItem?.step === 'mark' && runner.canAttempt && !runner.isAwaitingGesture();
  const updateBreak = (boundary: number) => {
    if (!currentItem || !canMark || runner.isAwaitingGesture()) return;
    const previous = phrasePlansRef.current[currentItem.lineId] ?? [];
    const next = previous.includes(boundary) ? previous.filter((n) => n !== boundary) : [...previous, boundary].sort((a, b) => a - b);
    phrasePlansRef.current = { ...phrasePlansRef.current, [currentItem.lineId]: next };
    setPhrasePlans(phrasePlansRef.current);
  };

  // ============================================================================
  // Render
  // ============================================================================

  if (items.length === 0) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-6">
          <p className="text-slate-400 text-center">No reading lines available.</p>
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  const meta = MODE_META[mode];
  const outcomes = runner.summary?.outcomes ?? [];

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
            <div className="flex items-center gap-2">
              <LuminaBadge className="text-xs">Grade {gradeLevel}</LuminaBadge>
              <LuminaBadge accent="blue" className="text-xs">{lexileLevel}</LuminaBadge>
            </div>
          </div>
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
                current={Math.max(1, readingItems.findIndex((item) => item.lineId === currentItem?.lineId) + 1)}
                total={readingItems.length}
                variant="dots"
              />
            </div>

            {/* One printed line persists through planning, reading and modeling. */}
            {currentItem && (
              <div className="flex min-h-56 flex-col items-center justify-center gap-4 rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 to-slate-900/50 p-8 text-center">
                {currentItem.kind === 'dialogue' && currentItem.speaker && (
                  <LuminaBadge accent="amber" className="text-xs">🎭 {currentItem.speaker} says</LuminaBadge>
                )}
                {currentItem.step === 'reread' && (
                  <p className="text-xs uppercase tracking-widest text-slate-300">Your phrase plan</p>
                )}
                <div
                  key={`${currentItem.id}-${revealed}`}
                  className={`font-bold leading-snug tracking-wide ${lineSizeClass(currentItem.wordCount)} ${
                    revealed ? `text-emerald-300 ${motion.pop}` : `text-white ${motion.reveal}`
                  }`}
                >
                  {currentItem.step === 'mark' ? (
                    <div className="flex flex-wrap items-center justify-center" aria-label="Mark phrase breaks">
                      {currentItem.text.split(' ').map((word, index, words) => (
                        <React.Fragment key={index}>
                          <span>{word}</span>
                          {index < words.length - 1 && (
                            <button type="button" disabled={!canMark}
                              aria-label={`Pause after ${word.replace(/[,;:.!?]+$/, '')}, word ${index + 1}`}
                              aria-pressed={currentBreaks.includes(index + 1)}
                              onClick={() => updateBreak(index + 1)}
                              className="mx-1 min-h-12 min-w-11 rounded-lg border border-purple-300/30 text-purple-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-200 disabled:opacity-40">
                              {currentBreaks.includes(index + 1) ? '|' : '·'}
                            </button>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  ) : currentItem.step ? (
                    <span>{markedGroups(currentItem.text, currentBreaks).join(' / ')}</span>
                  ) : currentItem.kind === 'dialogue' ? `“${currentItem.text}”` : currentItem.text}
                </div>
                {currentItem.step === 'mark' && (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-300">Tap a mark again to remove it. You can keep the whole line together.</p>
                    <button type="button" disabled={!canMark}
                      onClick={() => {
                        if (canMark && !runner.isAwaitingGesture()) runner.submitGestureAttempt(phrasePlanCue(currentItem, phrasePlansRef.current[currentItem.lineId] ?? []));
                      }}
                      className="min-h-12 rounded-xl bg-purple-500 px-5 py-3 font-semibold text-white disabled:opacity-40">
                      Use my phrase plan
                    </button>
                  </div>
                )}
                {currentItem.step === 'reread' && (
                  <div className="space-y-2 rounded-xl border border-purple-300/30 bg-purple-500/10 p-4">
                    <p className="text-xs uppercase tracking-widest text-purple-200">One way to group the words</p>
                    <p className="text-2xl leading-relaxed text-white">{currentItem.modelGroups.join(' / ')}</p>
                    <p className="text-sm text-slate-300">{currentItem.modelGroups.length > 1
                      ? 'Keep each group smooth. A slash means a small pause.'
                      : 'Keep the whole line together as one smooth phrase.'}</p>
                  </div>
                )}
                <div className="text-xs uppercase tracking-[0.25em] text-cyan-300">
                  {runner.stage === 'judging'
                    ? currentItem.step === 'mark' ? 'saving your plan' : 'listening'
                    : revealed
                      ? 'yes!'
                      : currentItem.step === 'mark' ? 'plan your phrases'
                        : currentItem.step === 'first_read' ? 'your first reading'
                          : currentItem.kind === 'accuracy' ? 'read it' : 'listen, then say it back'}
                </div>
              </div>
            )}

            {/* Every item here is a line the child READS aloud. */}
            {mode === 'expression' ? (
              <DiActionPanel run={runner} running={runner.running} stage={runner.stage}
                currentItem={currentItem} steps={items.filter((item) => item.lineId === currentItem?.lineId)}
                completedIds={runner.solvedIds}
                carriedIds={new Set(items.filter((item, index) => index < runner.currentIndex
                  && item.lineId === currentItem?.lineId && !runner.solvedIds.has(item.id)).map((item) => item.id))}
                startInstruction="Start the tutor, then mark where you want to pause." />
            ) : <JudgedMicPanel run={runner} />}
              {/* Tap-to-hear re-speaks the INSTRUCTION. On accuracy the line
                  itself stays unspoken — that is the mode, not an omission. */}
              <button
                onClick={runner.hearStimulus}
                disabled={!runner.running}
                className={`text-xs text-cyan-300/80 underline underline-offset-4 disabled:opacity-30 ${
                  runner.stimulusTapped ? 'opacity-50' : ''
                }`}
              >
                Say that again
              </button>
          </>
        )}

        {/* Completion — the passage whole, which is the first time the child
            sees the text they just read as one piece, plus a per-line mark. */}
        {evaluation.hasSubmitted && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/5 p-5 text-center">
              <div className="text-xl font-semibold text-emerald-200">Great reading today!</div>
              <p className="mt-1 text-xs text-slate-400">
                {runner.summary ? readingSummary(items, runner.summary).solvedCount : 0} of {readingItems.length} lines read accurately{mode === 'expression' ? ' after the model' : ''}.
              </p>
            </div>

            <LuminaPanel className="p-4">
              <p className="text-[11px] uppercase tracking-widest text-slate-500 mb-2">The whole passage</p>
              <p className="text-base leading-relaxed text-slate-200">{passageFrom(readingItems)}</p>
            </LuminaPanel>

            <div className="flex flex-col items-center gap-2">
              {readingItems.map((item) => {
                const outcome = outcomes.find((o) => o.id === item.id);
                const ok = outcome?.solved;
                return (
                  <div
                    key={item.id}
                    className={`flex w-full max-w-lg items-center justify-between gap-3 rounded-xl border px-4 py-2 text-left ${
                      ok ? 'border-emerald-400/40 bg-emerald-500/10' : 'border-amber-400/30 bg-amber-500/10'
                    }`}
                  >
                    <span className="text-sm font-medium text-white">{item.text}</span>
                    <span className="text-lg" aria-hidden="true">{ok ? '✅' : '🔁'}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default ReadAloudStudio;
