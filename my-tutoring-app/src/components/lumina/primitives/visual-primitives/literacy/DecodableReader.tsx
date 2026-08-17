'use client';

/**
 * DecodableReader — DI modality (tenth literacy port, 2026-08-12). The Live
 * tutor owns the clock: it asks, waits, judges the child's read and their
 * comprehension answer from the audio in-band, corrects contrastively, and its
 * own affirmation is the advance. There is no advance timer, no "Done Reading"
 * button, no Check button, no Next/Finish and no push-to-talk mic in this file.
 *
 * WHAT THIS REPLACES. The READING PHASE MEASURED NOTHING. Its only signal was
 * `wordsTapped` — how often the child asked for a word — and the phase ended on
 * a button labelled "I read it!". A child who cannot read a word could tap that
 * button, guess one of three pictures and finish with a score. Pressing "Done
 * Reading" requires no reading, so it fails the costume test outright and it is
 * gone, along with the phase stepper, the words-tapped counter, the colour
 * toggle, the Check button, the "Skip to Review" escape and the score ledger.
 *
 * THE READING IS NOW READ. One passage sentence at a time, out loud, into an
 * open microphone, judged word by word — a skipped, added or swapped word is
 * corrected, not waved through. The judged window is 3-8 words, IMPORTED from
 * di-sentence-reading (the pack that benched it), and a sentence outside it is
 * DROPPED rather than trimmed.
 *
 * EVERY ANSWER IN THIS FILE IS SPOKEN (2026-08-13 user ruling, from the drive on
 * this primitive: "mode sequence/cause effect doesnt let me answer for the 2nd
 * part verbally, i need to click on the button even though im speaking, this is
 * the same issue with inference mode"). A literal / read-along question is
 * answered by SAYING one word from the story (`short_spoken_word`); a sequence /
 * inference / main-idea answer is a whole proposition, and the child SAYS which
 * of the printed choices it is (`closed_set_choice`). The cards are still on
 * screen — they are what closes the set, and their pictures are how a pre-reader
 * holds four propositions at once — but they are a menu to read from, NOT
 * buttons: nothing here commits an answer by click. Both forks, their gates and
 * every spoken line live in `decodableReaderScript.ts` (hand-authored, DISTAR).
 *
 * PER-WORD "TAP TO HEAR IT" IS GONE, and that is the answer-leak rule, not a
 * simplification: a channel that speaks any word on demand lets a child hear
 * every word of a line and echo it, which is exactly the measurement. Help
 * arrives the way DISTAR gives it — through the correction, which re-models.
 *
 * CONNECTED TEXT RAISES THE VOICE-TURN FLOOR. A reader pauses between words and
 * the family default (500ms, tuned for one-word answers) splits one read into
 * two turns — di-sentence-reading's ship-blocking bench finding. Same 1100ms.
 *
 * THE SUMMARY IS THE FAMILY'S, NOT A BESPOKE ONE. The port shipped a hand-rolled
 * completion block that counted `solvedCount` and printed "N of N done all by
 * yourself" with a ✅ per item — so a child who missed a question, was corrected
 * and then got it right read as flawless, and the first drive caught exactly
 * that. `solved` says the item closed; `corrections === 0` says it was done
 * alone, and they are not the same claim. PhaseSummaryPanel already renders that
 * distinction (score, attempts, first-try star) for seventeen literacy
 * primitives, and this one is no longer the exception.
 */

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
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
import type { DecodableReaderMetrics } from '../../../evaluation/types';
import {
  useJudgedScriptRunner,
  type JudgedRunSummary,
} from '../../../hooks/useJudgedScriptRunner';
import type { JudgedScriptPack } from '../../../hooks/judgedScriptContract';
import PhaseSummaryPanel, { type PhaseResult } from '../../../components/PhaseSummaryPanel';
import JudgedMicPanel from '../../../components/JudgedMicPanel';
import { phaseResultsFromSummary } from '../../../hooks/usePhaseResults';
import {
  correctOptionText,
  decodableReaderPackBase,
  itemsFromChallenges,
  passageTextFrom,
  type DecodableOption,
  type DecodableReaderItem,
  type DecodableReaderMode,
} from './decodableReaderScript';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface DecodableComprehensionQuestion {
  question: string;
  /** The ONE-WORD answer, for a question whose answer is a word stated in the
   *  story (literal / read-along). Present = the question is answered ALOUD. */
  answerWord?: string;
  /** The choices, for a question whose answer is a whole proposition — said
   *  aloud, not tapped. `emoji` is the picture stand-in so a pre/emerging
   *  reader can hold the set in mind by picture. */
  options?: DecodableOption[];
  correctOptionId?: string;
}

export interface DecodableReaderData {
  title: string;
  gradeLevel: string;

  // Reading mode. 'decode' (default) = the child reads the passage themselves,
  // one judged sentence at a time. 'read_along' = the TUTOR reads the whole
  // story aloud (the shared-reading stimulus for a true pre-reader) and the
  // child answers questions about it — there are no judged read items at all.
  // The generator sets this from the resolved eval mode.
  // NB: named readingMode, NOT `mode` — `mode` is the eval-test/challenge-type
  // field-name convention for literacy generators and collides with the validator.
  readingMode?: 'decode' | 'read_along';

  // The passage
  passage: {
    sentences: Array<{
      id: string;
      words: Array<{
        id: string;
        text: string;                         // The word as displayed AND as read
        phonicsPattern: 'cvc' | 'cvce' | 'sight' | 'blend' | 'digraph' | 'r-controlled' | 'diphthong' | 'other';
        phonemes?: string[];                  // Legacy; nothing renders these
      }>;
    }>;
    imageDescription?: string;
  };

  // Phonics patterns present in this passage
  phonicsPatternsInPassage: string[];

  // Comprehension SKILL the questions demand (eval-mode task identity). Drives
  // the answer-material fork with `readingMode`.
  comprehensionType?: 'literal' | 'sequence' | 'inference' | 'main_idea';

  /** The judged comprehension questions, asked after the reading. */
  comprehensionQuestions?: DecodableComprehensionQuestion[];
  /** Legacy single-question shape — still built, so pre-port content runs. */
  comprehensionQuestion?: DecodableComprehensionQuestion;

  // Evaluation props (optional, auto-injected)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<DecodableReaderMetrics>) => void;
}

interface DecodableReaderProps {
  data: DecodableReaderData;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

/** Silence that closes a learner voice turn, for CONNECTED TEXT. See the header
 *  note: 500ms is right for one-word answers and wrong for a read line. */
const LINE_SILENCE_CLOSE_MS = 1100;

// Pattern colours are part of the decodable-text SURFACE — they tint each word
// by phonics pattern, which is what makes this a phonics reader rather than a
// passage. Kept bespoke; suppressed at the early band (reader-fit rule 6).
const PATTERN_COLORS: Record<string, string> = {
  cvc: 'text-blue-300',
  cvce: 'text-violet-300',
  sight: 'text-amber-300',
  blend: 'text-cyan-300',
  digraph: 'text-emerald-300',
  'r-controlled': 'text-rose-300',
  diphthong: 'text-orange-300',
  other: 'text-slate-100',
};

const PATTERN_LABELS: Record<string, string> = {
  cvc: 'CVC',
  cvce: 'Silent-E',
  sight: 'Sight Word',
  blend: 'Blend',
  digraph: 'Digraph',
  'r-controlled': 'R-Controlled',
  diphthong: 'Diphthong',
  other: 'Other',
};

const PATTERN_ACCENTS: Record<string, LuminaAccent> = {
  cvc: 'blue',
  cvce: 'purple',
  sight: 'amber',
  blend: 'cyan',
  digraph: 'emerald',
  'r-controlled': 'rose',
  diphthong: 'orange',
  other: 'cyan',
};

const MODE_META: Record<DecodableReaderMode, { badge: string; icon: string; accent: LuminaAccent }> = {
  read_along: { badge: 'Story Time', icon: '📚', accent: 'purple' },
  literal: { badge: 'Read & Tell', icon: '📖', accent: 'blue' },
  sequence: { badge: 'What Happened', icon: '🔗', accent: 'cyan' },
  inference: { badge: 'Think It Through', icon: '🔍', accent: 'amber' },
  main_idea: { badge: 'The Big Idea', icon: '💡', accent: 'emerald' },
};

/** Summary-row icons, by what the child actually DID on that item. */
const ITEM_ICONS: Record<DecodableReaderItem['kind'], string> = {
  read_line: '📖',
  answer_spoken: '🗣️',
  answer_choice: '🤔',
};

/** Print size for a reader: as large as the line allows without wrapping into
 *  a wall. Length is the only variable that matters here. */
const lineSizeClass = (wordCount: number): string =>
  wordCount <= 4 ? 'text-5xl' : wordCount <= 6 ? 'text-4xl' : 'text-3xl';

// ============================================================================
// Component
// ============================================================================

const DecodableReader: React.FC<DecodableReaderProps> = ({ data, className }) => {
  const {
    title,
    gradeLevel,
    readingMode = 'decode',
    passage,
    phonicsPatternsInPassage = [],
    comprehensionType,
    comprehensionQuestions,
    comprehensionQuestion,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // K/PRE and Grade-1 readers cannot decode adult chrome (legend, pattern
  // names), so it is suppressed there — reader-fit contract rules 2-7.
  const isEarlyBand = gradeLevel === 'K' || gradeLevel === '1';

  const stableInstanceIdRef = useRef(instanceId || `decodable-reader-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // ── Items (drop-gated) ────────────────────────────────────────────────────
  // The mode fork, the legacy single-question coalesce and the build gates all
  // live at ONE boundary now, because the DI drive harness reads the same one:
  // a harness that re-derived any of them would drive a different session from
  // the one the child gets.
  const sentences = useMemo(() => passage?.sentences ?? [], [passage]);
  const { items, mode, dropped } = useMemo(
    () => itemsFromChallenges({
      readingMode,
      comprehensionType,
      passage: { sentences },
      comprehensionQuestions,
      comprehensionQuestion,
    }),
    [readingMode, comprehensionType, sentences, comprehensionQuestions, comprehensionQuestion],
  );

  useEffect(() => {
    if (dropped > 0) {
      console.warn(
        `[DecodableReader] dropped ${dropped} unaskable item(s) (word-window / sentinel / `
        + 'answer-material / ear-separability / repeated-answer gates)',
      );
    }
  }, [dropped]);

  const passageText = useMemo(() => passageTextFrom(sentences), [sentences]);

  // ── Evaluation ────────────────────────────────────────────────────────────
  const evaluation = usePrimitiveEvaluation<DecodableReaderMetrics>({
    primitiveType: 'decodable-reader',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const handleFinished = useCallback((summary: JudgedRunSummary) => {
    const lines = items.filter((i) => i.kind === 'read_line');
    const answers = items.filter((i) => i.kind !== 'read_line');
    const solved = new Set(summary.outcomes.filter((o) => o.solved).map((o) => o.id));
    // Line length is this pack's structural axis; without it the metrics cannot
    // tell a 3-word passage from an 8-word one.
    const meanLineWords = lines.length
      ? Math.round((lines.reduce((sum, it) => sum + it.wordCount, 0) / lines.length) * 10) / 10
      : 0;
    const metrics: DecodableReaderMetrics = {
      type: 'decodable-reader',
      evalMode: mode,
      gradeLevel,
      readingMode,
      linesTotal: lines.length,
      linesRead: lines.filter((i) => solved.has(i.id)).length,
      questionsTotal: answers.length,
      questionsCorrect: answers.filter((i) => solved.has(i.id)).length,
      firstTryCount: summary.firstTryCount,
      attemptsCount: summary.attemptsCount,
      accuracy: summary.accuracy,
      meanLineWords,
      phonicsPatternsInPassage,
    };
    evaluation.submitResult(
      summary.passed,
      summary.accuracy,
      metrics,
      { itemResults: summary.outcomes },
      undefined,
      summary.diagnosisEvidence,
    );
  }, [items, mode, gradeLevel, readingMode, phonicsPatternsInPassage, evaluation]);

  // ── The pack — everything the TUTOR is told lives in the shared cue surface
  //    (decodableReaderScript.ts), which the DI drive harness reads too. Only
  //    what the SCREEN owns stays here.
  const pack = useMemo<JudgedScriptPack<DecodableReaderItem>>(() => ({
    ...decodableReaderPackBase(items, mode),
    // Only what DIFFERS from the runner's defaults.
    statusLines: {
      ready: (item) => item.kind === 'read_line'
        ? 'Read the line out loud — every word.'
        : item.kind === 'answer_spoken'
          ? 'Listen, then say your answer out loud.'
          : 'Listen, then say the one you pick.',
      retry: (item) => item.kind === 'read_line'
        ? 'Have another go — read it again.'
        : item.kind === 'answer_spoken'
          ? 'Have another go — say your answer.'
          : 'Think about the story — then tell me again.',
      noVerdict: () => 'One more time — say it out loud.',
      affirmedNext: 'Yes! Next one.',
      done: 'Great story time today!',
    },
    diagnosisObservation: (item, { lastHeard }) => {
      if (item.kind === 'read_line') {
        return {
          challenge: `Read the printed ${item.wordCount}-word line aloud: "${item.text}".`,
          expected: item.text,
          observed: lastHeard ? `Heard "${lastHeard}".` : 'The tutor judged the read wrong from the audio.',
        };
      }
      if (item.kind === 'answer_spoken') {
        return {
          challenge: `Answer aloud from the story: ${item.question}`,
          expected: `The word "${item.answerWord}".`,
          observed: lastHeard ? `Heard "${lastHeard}".` : 'The tutor judged the answer wrong from the audio.',
        };
      }
      return {
        challenge: `Answer aloud about the story, from the choices: ${item.question}`,
        expected: correctOptionText(item),
        observed: lastHeard
          ? `Heard "${lastHeard}".`
          : 'Named a choice the story does not support.',
      };
    },
  }), [items, mode]);

  const runner = useJudgedScriptRunner<DecodableReaderItem>({
    pack,
    instanceId: resolvedInstanceId,
    gradeLevel,
    exhibitId,
    silenceCloseMs: LINE_SILENCE_CLOSE_MS,
    onFinished: handleFinished,
  });

  const currentItem = runner.currentItem;
  /** Affirmed: the answer may appear on screen. The runner owns the latch —
   *  it used to be a `useState` reset in `onItemOpened` and set in `onAffirmed`. */
  const revealed = runner.currentSolved;

  // ── Phase summary — `solved` is not `solved alone` ────────────────────────
  const phaseResults = useMemo<PhaseResult[]>(() => {
    if (!evaluation.hasSubmitted) return [];
    return phaseResultsFromSummary(items, runner.summary, (item) => ({
      label: item.kind === 'read_line' ? item.text : (item.question ?? ''),
      icon: ITEM_ICONS[item.kind],
    }));
  }, [evaluation.hasSubmitted, runner.summary, items]);

  // ============================================================================
  // Render
  // ============================================================================

  if (items.length === 0) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-6">
          <p className="text-slate-400 text-center">No story available.</p>
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  const meta = MODE_META[mode];
  const firstTryCount = runner.summary?.firstTryCount ?? 0;

  /** The printed line, word by word — the phonics tint is the decodable-text
   *  surface. No word is tappable: audio on demand is an echo route through the
   *  measurement (see the header). */
  const renderLine = (item: DecodableReaderItem) => (
    <p className={`font-bold leading-snug tracking-wide ${lineSizeClass(item.wordCount)}`}>
      {(item.words ?? []).map((word, i) => (
        <React.Fragment key={word.id}>
          <span
            className={
              revealed
                ? 'text-emerald-300'
                : isEarlyBand
                  ? 'text-white'
                  : PATTERN_COLORS[word.phonicsPattern] ?? 'text-slate-100'
            }
          >
            {word.text}
          </span>
          {i < (item.words?.length ?? 0) - 1 && ' '}
        </React.Fragment>
      ))}
    </p>
  );

  /** The choice menu. NOT buttons — the child says which one, and nothing here
   *  commits an answer (2026-08-13 ruling). It is on screen because it CLOSES
   *  the set: the tutor speaks these choices in this order, and a pre-reader
   *  holds them by picture while they think. */
  const renderChoices = (item: DecodableReaderItem) => (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {(item.options ?? []).map((option) => {
        const isTarget = option.id === item.correctOptionId;
        return (
          <li
            key={option.id}
            className={`
              flex min-h-[7rem] flex-col items-center justify-center gap-2 rounded-xl border-2 p-4
              text-center transition-all duration-200
              ${revealed && isTarget
                ? 'border-emerald-400/60 bg-emerald-500/15 ring-2 ring-emerald-400/40'
                : 'border-white/10 bg-slate-800/40'}
            `}
          >
            <span className="text-5xl leading-none" aria-hidden>{option.emoji || '🔊'}</span>
            <span className="text-sm text-slate-100">{option.text}</span>
          </li>
        );
      })}
    </ul>
  );

  const renderStage = (item: DecodableReaderItem) => {
    if (item.kind === 'read_line') {
      return (
        <div className="flex min-h-56 flex-col items-center justify-center gap-4 rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 to-slate-900/50 p-8 text-center">
          <div key={`${item.id}-${revealed}`} className={revealed ? motion.pop : motion.reveal}>
            {renderLine(item)}
          </div>
          <div className="text-xs uppercase tracking-[0.25em] text-cyan-300">
            {runner.stage === 'judging' ? 'listening' : revealed ? 'yes!' : 'read it'}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* read-along keeps the story on screen while the tutor reads it — a
            pre-reader following print IS the shared-reading task. */}
        {item.storyText && (
          <LuminaPanel accent="purple" className="p-5">
            <p className="text-center text-2xl leading-relaxed text-slate-100">{item.storyText}</p>
          </LuminaPanel>
        )}
        <div className="rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 to-slate-900/50 p-6 text-center">
          <p className="text-xl font-semibold leading-snug text-white">{item.question}</p>
          <div className="mt-3 text-xs uppercase tracking-[0.25em] text-cyan-300">
            {runner.stage === 'judging' ? 'listening' : revealed ? 'yes!' : 'say your answer'}
          </div>
          {/* The answer appears for the first time when the tutor affirms it. */}
          {item.kind === 'answer_spoken' && revealed && (
            <div className={`mt-2 text-3xl font-black text-emerald-300 ${motion.pop}`}>{item.answerWord}</div>
          )}
        </div>
        {item.kind === 'answer_choice' && renderChoices(item)}
      </div>
    );
  };

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <LuminaCardTitle className={isEarlyBand ? 'text-xl' : 'text-lg'}>{title}</LuminaCardTitle>
            {!isEarlyBand && (
              <div className="flex items-center gap-2">
                <LuminaBadge className="text-xs">Grade {gradeLevel}</LuminaBadge>
                {phonicsPatternsInPassage.slice(0, 4).map((pattern) => (
                  <LuminaBadge key={pattern} accent={PATTERN_ACCENTS[pattern] ?? 'cyan'} className="text-xs">
                    {PATTERN_LABELS[pattern] ?? pattern}
                  </LuminaBadge>
                ))}
              </div>
            )}
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
                current={Math.min(runner.currentIndex + 1, items.length)}
                total={items.length}
                variant="dots"
              />
            </div>

            {currentItem && renderStage(currentItem)}

            {/* Every item here is answered out loud, so the orb's spoken label
                is the honest one in all three kinds. */}
            <JudgedMicPanel run={runner}>
              {/* Tap-to-hear re-speaks the QUESTION. On a read line the line
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
            </JudgedMicPanel>
          </>
        )}

        {/* Completion — the family panel (score, attempts, first-try star), then
            the story whole, which for a decode run is the first time the child
            sees what they read as one piece. */}
        {evaluation.hasSubmitted && phaseResults.length > 0 && (
          <div className="space-y-4">
            <PhaseSummaryPanel
              phases={phaseResults}
              overallScore={evaluation.submittedResult?.score}
              durationMs={evaluation.elapsedMs}
              heading={mode === 'read_along' ? 'Great story time!' : 'Great reading today!'}
              celebrationMessage={
                mode === 'read_along'
                  ? `You listened to the whole story — ${firstTryCount} of ${items.length} answered on the first try.`
                  : `You read the whole story — ${firstTryCount} of ${items.length} on the first try.`
              }
            />

            <LuminaPanel className="p-4">
              <p className="mb-2 text-[11px] uppercase tracking-widest text-slate-500">The whole story</p>
              <p className="text-base leading-relaxed text-slate-200">{passageText}</p>
            </LuminaPanel>
          </div>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default DecodableReader;
