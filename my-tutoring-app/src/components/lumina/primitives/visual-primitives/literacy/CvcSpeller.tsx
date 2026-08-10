'use client';

/**
 * CvcSpeller — DI modality. The Live tutor owns the clock in all three modes.
 *
 * WHAT THE CHILD DOES, PER MODE.
 *  - `fill-vowel` / `word-sort`: they hear the word and SAY THE MIDDLE SOUND
 *    ALOUD into an open mic. The tutor says the word, waits, judges the audio
 *    in-band, corrects contrastively, and its own affirmation is the advance.
 *  - `spell-word`: they hear the word and PUT A LETTER IN EACH BOX. The third
 *    letter landing is the commit; the tutor is told what they built, speaks
 *    the verdict, and that verdict is the advance.
 *
 * WHAT CHANGED (qa/di/BACKLOG.md item 16, fourth literacy port after
 * phonics-blender, sound-swap and word-flip). Deleted: the push-to-talk
 * spoken-capture beat, the 1400ms auto-advance timer, the 500ms say-the-word
 * timer, `Check Spelling`, `Next Word` / `Finish` / `Skip →`, the
 * attempt-counted scaffolding ladder, `MAX_ATTEMPTS`, the two vowel option
 * buttons and the two sort buckets. There is no advance timer anywhere in
 * this file, and the §1 gate greps this header too — so the deleted hook and
 * the deleted timer are named in prose rather than spelled out as tokens.
 *
 * ⚠️ THE COSTUME AND THE LEAK WERE THE SAME OBJECT ON TWO OF THREE MODES.
 * `fill-vowel`'s two vowel buttons and `word-sort`'s two buckets each printed
 * ONE OF TWO OPTIONS THAT INCLUDED THE ANSWER, captioned with its keyword
 * ("a · apple"). That is word-flip's chips exactly: it makes the task
 * recognition (a child who cannot isolate the middle sound taps correctly half
 * the time) and it prints the answer for anyone who can read. Isolating a
 * sound inside a spoken word is an oral act, so both answers are now oral.
 *
 * ⚠️ `spell-word` STAYS IN THE HANDS, and it is the gesture anchor's first
 * production caller. Three ordered slots out of a distractor-populated bank is
 * not guessable, and it is ENCODING — the thing that makes this primitive not
 * a duplicate of phonics-blender. Porting it to speech would have deleted its
 * own curriculum home. What went was the Check button and the stopwatch.
 *
 * ANSWER-LEAK RULE. The word, its picture and (in `spell-word`) the empty
 * boxes are the stimulus and are shown. The middle sound and the spelling are
 * the answer: nothing prints, offers or speaks them until the tutor has
 * affirmed. `word-sort`'s two vowel columns are built out of answers ALREADY
 * GIVEN — a column is labelled at the moment its first word is affirmed, never
 * before. Tap-to-hear says the WORD and stops (the control it replaces
 * escalated into isolating the middle sound on demand, which on two modes is
 * the answer).
 *
 * DOCTRINE HELD: open mic, never push-to-talk; the mic is never gated on
 * tutor-busy; the tutor is quiet by default (it speaks only scripted lines);
 * no visible timers; tap-to-hear is never withdrawn; adult chrome is hidden
 * for pre-readers.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLuminaAIContext } from '@/contexts/LuminaAIContext';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaBadge,
  LuminaPanel,
  LuminaChallengeCounter,
  LuminaMicListener,
  dropZoneStateClass,
  motion,
  type DropZoneState,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { CvcSpellerMetrics } from '../../../evaluation/types';
import type { DiagnosisEvidence } from '../../../evaluation/diagnosis/types';
import { useJudgedSpeechLoop } from '../../../hooks/useJudgedSpeechLoop';
import type { LoopEmission } from '../../../hooks/judgedLoopModel';
import { SoundManager } from '../../../utils/SoundManager';
import { isPreReaderGrade } from '../../../utils/kindergartenMode';
import PhaseSummaryPanel, { type PhaseResult } from '../../../components/PhaseSummaryPanel';
import {
  buildVerdictCue,
  completeCue,
  itemCue,
  moveOnCue,
  pronounceCue,
  spokenVowel,
  vowelKeyword,
  type CvcItem,
  type CvcTask,
} from './cvcSpellerScript';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface CvcSpellerChallenge {
  id: string;
  taskType: CvcTask;
  targetWord: string;
  /** Private generator trace; never rendered as student-visible copy. */
  remediationMove?: 'contrast_vowel' | 'phoneme_slots' | 'minimal_pair_sort';
  targetLetters: string[];     // e.g. ['c', 'a', 't']
  targetPhonemes: string[];    // e.g. ['/k/', '/æ/', '/t/']
  emoji: string;
  imageDescription: string;
  distractorLetters: string[];
  /** Support-tier lever (spell-word + word-sort): show the emoji self-check cue.
   *  Withdrawn at the hard tier so the student works purely from the heard
   *  word. Undefined (no tier) = treated as shown. */
  showPictureCue?: boolean;
}

export interface CvcSpellerData {
  title: string;
  /**
   * OPTIONAL narrowing, present only when the objective actually names a vowel.
   * Absent means the session spans whatever vowels the cumulative letter group
   * carries — which is the normal case, because the K curriculum's own CVC
   * spelling objective carries no vowel scoping and its letter-sound objective
   * names all five. It used to be required and defaulted to `short-a`, which
   * made every unscoped lesson a short-a lesson and gave a spoken "which sound
   * is in the middle?" task the same answer every item. See `letterGroups.ts`.
   */
  vowelFocus?: 'short-a' | 'short-e' | 'short-i' | 'short-o' | 'short-u';
  /** Cumulative letter group (1-4) — the scope CEILING, and it carries vowels. */
  letterGroup: 1 | 2 | 3 | 4;
  availableLetters: string[];
  challenges: CvcSpellerChallenge[];
  gradeLevel?: string;

  /** Within-mode support tier ('easy'|'medium'|'hard') — set by the generator
   *  from config.difficulty. At `easy` the tutor repeats the word with its
   *  vowel HELD before handing over; it never changes the words. */
  supportTier?: 'easy' | 'medium' | 'hard';

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<CvcSpellerMetrics>) => void;
}

interface CvcSpellerProps {
  data: CvcSpellerData;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);

// Child-facing labels: no phoneme slash-notation in the child's field
// (reader-fit PRE contract); the tutor SPEAKS the sounds instead.
const VOWEL_LABELS: Record<string, string> = {
  'short-a': 'Short A',
  'short-e': 'Short E',
  'short-i': 'Short I',
  'short-o': 'Short O',
  'short-u': 'Short U',
};

const TASK_BADGE: Record<CvcTask, string> = {
  'fill-vowel': '🔤 Middle Sound',
  'spell-word': '📝 Spell It',
  'word-sort': '📥 Sound Groups',
};

/** Corrections the tutor may run on one item before the lesson moves on anyway.
 *  A hard word resurfaces through distributed review, not by drilling a
 *  frustrated five-year-old in place. */
const MAX_CORRECTIONS_PER_CHALLENGE = 2;

/** Manual voice-activity mode: our amplitude detector brackets every learner
 *  turn. Gemini's speech-likeness VAD is unusable for short spoken responses
 *  (DI bench run-3 ruling). Also declared on the catalog entry so the lesson
 *  path opens the shared session the same way. */
const CVC_AUDIO_INPUT = { manual_activity: true };

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type Stage = 'idle' | 'asking' | 'judging' | 'affirmed' | 'done';

interface ChallengeOutcome {
  id: string;
  task: CvcTask;
  solved: boolean;
  corrections: number;
  score: number;
  seconds: number | null;
}

const scoreForCorrections = (corrections: number): number =>
  corrections <= 0 ? 100 : corrections === 1 ? 67 : 33;

// ============================================================================
// Speaker Icon SVG
// ============================================================================

const SpeakerIcon: React.FC<{ className?: string; size?: string }> = ({ className = '', size = 'w-8 h-8' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`${size} ${className}`}
    aria-hidden
  >
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" opacity={0.3} />
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
  </svg>
);

// ============================================================================
// Component
// ============================================================================

const CvcSpeller: React.FC<CvcSpellerProps> = ({ data, className }) => {
  const {
    title,
    vowelFocus,
    availableLetters = [],
    challenges = [],
    supportTier,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const gradeLevel = data.gradeLevel ?? 'K';
  const ctx = useLuminaAIContext();

  // ── State ────────────────────────────────────────────────────────
  const [currentIndex, setCurrentIndex] = useState(0);
  const [stage, setStage] = useState<Stage>('idle');
  const [statusLine, setStatusLine] = useState('Tap the microphone to start.');
  const [running, setRunning] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [wordTapped, setWordTapped] = useState(false);
  const [solvedIds, setSolvedIds] = useState<Set<string>>(new Set());

  // spell-word board
  const [slots, setSlots] = useState<(string | null)[]>([null, null, null]);
  const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(0);
  const [boardFlash, setBoardFlash] = useState<'correct' | 'incorrect' | null>(null);

  /** The middle LETTER just earned — post-answer only (answer-leak rule),
   *  cleared the moment the next item opens. */
  const [reward, setReward] = useState<string | null>(null);

  /** word-sort: the columns, built ONLY out of affirmed answers. */
  const [sorted, setSorted] = useState<Array<{ id: string; word: string; emoji: string; vowel: string }>>([]);

  // Visual-only timer. It does NOT advance anything — it clears a highlight.
  // Progression here has exactly one cause: a tutor verdict.
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stableInstanceIdRef = useRef(instanceId || `cvc-speller-${Math.round(performance.now())}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  const currentChallenge = challenges[currentIndex];
  const isPreReader = isPreReaderGrade(gradeLevel);

  // Progression authority is React state; mirror into refs so the emission
  // handler (which fires inside the loop's dispatch) reads it live.
  const idxRef = useRef(0);
  idxRef.current = currentIndex;
  const slotsRef = useRef<(string | null)[]>([null, null, null]);

  const correctionsRef = useRef(new Map<string, number>());
  const outcomesRef = useRef<ChallengeOutcome[]>([]);
  const challengeStartRef = useRef<number | null>(null);
  const submittedRef = useRef(false);
  const weConnectedRef = useRef(false);
  const connectedRef = useRef(ctx.isConnected);
  const listeningRef = useRef(ctx.isListening);
  connectedRef.current = ctx.isConnected;
  listeningRef.current = ctx.isListening;

  /** A build has been committed and its verdict has not landed. Locks the
   *  board and gates the auto-commit so one placement can never fire twice. */
  const awaitingBuildRef = useRef(false);

  /** What the child SAID — DATA only, never rendered (a stray write to a status
   *  line in this family gets spoken aloud). */
  const lastHeardRef = useRef<string | null>(null);

  /** Sound-level accuracy, accumulated from what was actually judged. */
  const soundStatsRef = useRef({ vowelOk: 0, vowelTried: 0, consonantOk: 0, consonantTried: 0 });
  const errorPatternsRef = useRef<string[]>([]);
  const hearTapsRef = useRef(0);
  const diagnosisObservationsRef = useRef<Array<{
    challenge: string;
    expected: string;
    observed: string;
    judgeFeedback?: string;
  }>>([]);

  const evaluation = usePrimitiveEvaluation<CvcSpellerMetrics>({
    primitiveType: 'cvc-speller',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // ── Items ────────────────────────────────────────────────────────
  const itemOf = useCallback(
    (index: number): CvcItem | null => {
      const challenge = challenges[index];
      if (!challenge) return null;
      const letters = (challenge.targetLetters?.length === 3
        ? challenge.targetLetters
        : challenge.targetWord.split(''))
        .map((l) => (l ?? '').toLowerCase());
      return {
        id: challenge.id,
        task: challenge.taskType,
        word: challenge.targetWord,
        letters,
        phonemes: challenge.targetPhonemes ?? [],
        vowelLetter: letters[1] ?? '',
        emoji: challenge.emoji,
      };
    },
    [challenges],
  );
  const currentItem = useCallback(() => itemOf(idxRef.current), [itemOf]);

  /**
   * Cue options for the item at `index`. The how-to-play is spoken on the first
   * item AND whenever the ACTION changes — a blended session interleaves three
   * different actions, so it is not a static protocol statement anybody can
   * look up on screen (see the script header for why this is not band-gated
   * the way ports 1-2 are).
   */
  const cueOptsFor = useCallback(
    (index: number) => {
      const item = itemOf(index);
      const previous = index > 0 ? itemOf(index - 1) : null;
      return {
        howToPlay: !!item && (!previous || previous.task !== item.task),
        stretch: supportTier === 'easy',
      };
    },
    [itemOf, supportTier],
  );

  // Letter bank for spell-word. Bank = targets + generator-tiered distractors
  // only; availableLetters just tops up to a floor of 5 so the support-tier
  // distractor cap (clean/some/full) actually controls how cluttered the bank
  // is — unioning ALL availableLetters defeated the tier lever and inflated the
  // PRE screen to 13-16 elements.
  const letterBank = useMemo(() => {
    const challenge = challenges[currentIndex];
    if (!challenge || challenge.taskType !== 'spell-word') return [];
    const all = new Set<string>();
    (challenge.targetLetters ?? challenge.targetWord.split('')).forEach((l) => all.add(l.toLowerCase()));
    (challenge.distractorLetters ?? []).forEach((l) => all.add(l.toLowerCase()));
    for (const l of availableLetters) {
      if (all.size >= 5) break;
      all.add(l.toLowerCase());
    }
    const letters = Array.from(all);
    for (let i = letters.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [letters[i], letters[j]] = [letters[j], letters[i]];
    }
    return letters;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  const phaseResults = useMemo<PhaseResult[]>(() => {
    if (!evaluation.hasSubmitted) return [];
    return challenges.map((challenge) => {
      const outcome = outcomesRef.current.find((o) => o.id === challenge.id);
      return {
        label: challenge.targetWord,
        icon: challenge.emoji || '🔤',
        score: outcome?.score ?? 0,
        attempts: (outcome?.corrections ?? 0) + 1,
        firstTry: !!outcome?.solved && (outcome?.corrections ?? 0) === 0,
      };
    });
  }, [evaluation.hasSubmitted, challenges]);

  // ── Submit ───────────────────────────────────────────────────────
  const finishAndSubmit = useCallback(() => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    const outcomes = outcomesRef.current;
    const solved = outcomes.filter((o) => o.solved).length;
    const attemptsCount = outcomes.reduce((s, o) => s + 1 + o.corrections, 0);
    const accuracy = outcomes.length
      ? Math.round(outcomes.reduce((s, o) => s + o.score, 0) / outcomes.length)
      : 0;
    const stats = soundStatsRef.current;

    const metrics: CvcSpellerMetrics = {
      type: 'cvc-speller',
      vowelFocus,
      taskType: challenges[0]?.taskType ?? 'spell-word',
      wordsSpelledCorrectly: solved,
      wordsTotal: challenges.length,
      vowelAccuracy: stats.vowelTried > 0 ? Math.round((stats.vowelOk / stats.vowelTried) * 100) : 100,
      consonantAccuracy: stats.consonantTried > 0
        ? Math.round((stats.consonantOk / stats.consonantTried) * 100)
        : 100,
      commonErrors: Array.from(new Set(errorPatternsRef.current)),
      // The three-tap stretch ladder is deleted (it isolated the middle sound
      // on demand, which is the answer on two of three modes). Tap-to-hear —
      // the support that replaced it — rides in details, not in this field.
      stretchUsed: 0,
      attemptsCount,
    };

    const observations = diagnosisObservationsRef.current;
    const latest = observations[observations.length - 1];
    const judgeBacked = [...observations].reverse().find((item) => item.judgeFeedback);
    const source = judgeBacked || latest;
    const diagnosisEvidence: DiagnosisEvidence | undefined = accuracy < 60 && source
      ? {
          challengeSummary: source.challenge,
          expected: source.expected,
          observed: source.observed,
          judgeFeedback: judgeBacked?.judgeFeedback,
          priorAttempts: observations
            .filter((item) => item !== source)
            .slice(-4)
            .map((item) => ({ challenge: item.challenge, observed: item.observed })),
        }
      : undefined;

    evaluation.submitResult(
      accuracy >= 60,
      accuracy,
      metrics,
      { outcomes, hearTaps: hearTapsRef.current },
      undefined,
      diagnosisEvidence,
    );
    setRunning(false);
    setStage('done');
    setStatusLine('Great listening today!');
  }, [challenges, evaluation, vowelFocus]);

  // ── The loop ─────────────────────────────────────────────────────
  const loopRef = useRef<ReturnType<typeof useJudgedSpeechLoop> | null>(null);

  const closeChallenge = useCallback((item: CvcItem, solved: boolean) => {
    const corrections = correctionsRef.current.get(item.id) ?? 0;
    outcomesRef.current.push({
      id: item.id,
      task: item.task,
      solved,
      corrections,
      score: solved ? scoreForCorrections(corrections) : 0,
      seconds: challengeStartRef.current == null
        ? null
        : Math.round(((performance.now() - challengeStartRef.current) / 1000) * 10) / 10,
    });
    if (solved) setSolvedIds((prev) => new Set(Array.from(prev).concat(item.id)));
  }, []);

  const resetBoard = useCallback(() => {
    slotsRef.current = [null, null, null];
    setSlots([null, null, null]);
    setActiveSlotIndex(0);
    setBoardFlash(null);
    awaitingBuildRef.current = false;
  }, []);

  /** Move the surface to the next item. The CUE for it is queued by the caller
   *  first: the tutor's line is what actually advances the lesson, this only
   *  re-points the screen at what that line is about. */
  const openNext = useCallback(() => {
    const nextIndex = idxRef.current + 1;
    if (!itemOf(nextIndex)) return false;
    setCurrentIndex(nextIndex);
    idxRef.current = nextIndex;
    setReward(null);
    setWordTapped(false);
    resetBoard();
    challengeStartRef.current = performance.now();
    return true;
  }, [itemOf, resetBoard]);

  const applyVerdict = useCallback(
    (judgment: 'affirmed' | 'corrected') => {
      const item = currentItem();
      const loop = loopRef.current;
      if (!item || !loop) return;

      if (judgment === 'corrected') {
        const used = (correctionsRef.current.get(item.id) ?? 0) + 1;
        correctionsRef.current.set(item.id, used);
        SoundManager.playIncorrect();

        if (used <= MAX_CORRECTIONS_PER_CHALLENGE) {
          // The tutor's correction line already re-modeled and re-asked in-band.
          if (item.task === 'spell-word') {
            // Keep what was right, clear only what was wrong — the Elkonin
            // discipline, and it makes the re-elicit tractable for a
            // five-year-old instead of starting the whole word over.
            const cleared = slotsRef.current.map((letter, i) =>
              (letter ?? '').toLowerCase() === item.letters[i] ? letter : null);
            slotsRef.current = cleared;
            setSlots(cleared);
            const firstEmpty = cleared.findIndex((s) => s === null);
            setActiveSlotIndex(firstEmpty === -1 ? 0 : firstEmpty);
            setBoardFlash('incorrect');
            awaitingBuildRef.current = false;
            setStage('asking');
            setStatusLine('Have another go — fill in the boxes.');
          } else {
            setStage('asking');
            setStatusLine('Have another go — say the middle sound.');
          }
          return;
        }

        // Capped: acknowledge and move the lesson forward.
        closeChallenge(item, false);
        const nextIndex = idxRef.current + 1;
        const next = itemOf(nextIndex);
        loop.queueCue(moveOnCue(item, next, cueOptsFor(nextIndex)));
        if (openNext()) {
          setStage('asking');
          setStatusLine('Good try — here comes the next one.');
        } else {
          finishAndSubmit();
        }
        return;
      }

      // Affirmed — the answer is theirs, and this is the first moment it may
      // appear on screen.
      SoundManager.playCorrect();
      closeChallenge(item, true);
      if (item.task === 'spell-word') {
        setBoardFlash('correct');
        awaitingBuildRef.current = false;
      } else {
        setReward(item.vowelLetter);
      }
      if (item.task === 'word-sort') {
        setSorted((prev) => prev.concat({
          id: item.id, word: item.word, emoji: item.emoji, vowel: item.vowelLetter,
        }));
      }
      setStage('affirmed');

      const nextIndex = idxRef.current + 1;
      const next = itemOf(nextIndex);
      if (next) {
        setStatusLine('Yes! You got it.');
        loop.queueCue(itemCue(next, cueOptsFor(nextIndex)));
        openNext();
      } else {
        setStatusLine('You did it!');
        loop.queueCue(completeCue());
        finishAndSubmit();
      }
    },
    [closeChallenge, cueOptsFor, currentItem, finishAndSubmit, itemOf, openNext],
  );

  const handleEmission = useCallback(
    (emission: LoopEmission) => {
      const item = currentItem();
      switch (emission.kind) {
        case 'attempt-open':
          lastHeardRef.current = null;
          if (emission.attempt.source === 'voice') setStatusLine('Listening…');
          return;
        case 'attempt-transcript':
          lastHeardRef.current = emission.text;
          return;
        case 'verdict':
          if (emission.judgment === 'off-script') return;
          if (emission.judgment === 'no-verdict') {
            // On a BUILD item this is routinely the child talking while they
            // work: a stray voice turn opened an attempt the tutor was
            // explicitly told not to answer. Never re-ask over a board the
            // child is still filling.
            if (item?.task !== 'spell-word') setStatusLine('One more time — say the middle sound.');
            return;
          }
          if (emission.judgment === 'corrected' && item) {
            diagnosisObservationsRef.current.push(
              item.task === 'spell-word'
                ? {
                    challenge: `Hear "${item.word}" and put a letter in each box for its sounds.`,
                    expected: `Spell ${item.letters.join('')}.`,
                    observed: `Built "${slotsRef.current.map((l) => l ?? '_').join('')}".`,
                  }
                : {
                    challenge: `Hear "${item.word}" and say its middle sound.`,
                    expected: `Say the middle sound of ${item.word} (${spokenVowel(item)}).`,
                    observed: lastHeardRef.current
                      ? `Heard "${lastHeardRef.current}".`
                      : 'The tutor judged the answer wrong from the audio.',
                  },
            );
          }
          applyVerdict(emission.judgment);
          return;
        case 'verdict-text': {
          // The tutor's finished correction NAMES the error, which is Tier-A
          // misconception evidence rather than something we have to infer.
          if (emission.judgment !== 'corrected') return;
          const observations = diagnosisObservationsRef.current;
          const last = observations[observations.length - 1];
          if (last && !last.judgeFeedback) last.judgeFeedback = emission.text;
          return;
        }
        case 'unanchored-verdict': {
          // A build verdict that arrived with nothing anchored — the child
          // spoke while building, that voice attempt timed out, and the
          // gesture attempt never opened behind it. The judgment is still
          // about the build we just submitted, and dropping it would wedge the
          // lesson on a board that can no longer be committed again.
          if (!awaitingBuildRef.current) return;
          applyVerdict(emission.judgment);
          return;
        }
        case 'session-resumed':
        case 'resync': {
          // The session survived but the item in flight did not. Re-ask it
          // verbatim rather than leaving the child answering into something
          // that will never judge them — except mid-build, where the board is
          // still on screen and re-asking would talk over a child working.
          const loop = loopRef.current;
          if (!item || !loop) return;
          if (emission.kind === 'resync' && item.task === 'spell-word') return;
          setStage('asking');
          setStatusLine('Let’s take that one again.');
          loop.queueCue(itemCue(item, cueOptsFor(idxRef.current)));
          return;
        }
        case 'session-dead':
          // Visible state, never a silent "Listening…".
          setStatusLine('The tutor went quiet — tap the microphone to pick things back up.');
          return;
        default:
          return;
      }
    },
    [applyVerdict, cueOptsFor, currentItem],
  );

  const loop = useJudgedSpeechLoop({
    enabled: running,
    onEmission: handleEmission,
  });
  loopRef.current = loop;

  // ── The BUILD commit (spell-word) — the third letter IS the commit ────
  // No Check button: nothing on screen may carry the child forward, and a
  // 3-slot placement is an answer the moment it is complete. The cue goes out
  // through `submitGestureAttempt`, which opens the attempt when the cue is
  // actually SENT — an attempt opened at commit time would block the very cue
  // meant to provoke its verdict.
  const commitBuild = useCallback(
    (placed: (string | null)[]) => {
      const item = currentItem();
      const activeLoop = loopRef.current;
      if (!item || !activeLoop || item.task !== 'spell-word') return;
      if (awaitingBuildRef.current) return;

      const wrongIndex = placed.findIndex((letter, i) => (letter ?? '').toLowerCase() !== item.letters[i]);
      const correct = wrongIndex === -1;

      const stats = soundStatsRef.current;
      placed.forEach((letter, i) => {
        const ok = (letter ?? '').toLowerCase() === item.letters[i];
        if (i === 1) {
          stats.vowelTried += 1;
          if (ok) stats.vowelOk += 1;
        } else {
          stats.consonantTried += 1;
          if (ok) stats.consonantOk += 1;
        }
      });
      if (!correct) {
        errorPatternsRef.current.push(placed.map((l) => l ?? '_').join(''));
      }

      awaitingBuildRef.current = true;
      setBoardFlash(null);
      setStage('judging');
      setStatusLine('Let’s see…');
      activeLoop.submitGestureAttempt(buildVerdictCue(item, {
        placed,
        correct,
        wrongIndex: correct ? undefined : wrongIndex,
        correction: (correctionsRef.current.get(item.id) ?? 0) + 1,
      }));
    },
    [currentItem],
  );

  const handleSelectLetter = useCallback(
    (letter: string) => {
      if (!running || awaitingBuildRef.current) return;
      const item = currentItem();
      if (!item || item.task !== 'spell-word') return;
      const target = activeSlotIndex ?? slotsRef.current.findIndex((s) => s === null);
      if (target < 0) return;

      SoundManager.tap();
      const next = [...slotsRef.current];
      next[target] = letter;
      slotsRef.current = next;
      setSlots(next);
      setBoardFlash(null);

      const nextEmpty = next.findIndex((s) => s === null);
      setActiveSlotIndex(nextEmpty === -1 ? null : nextEmpty);
      if (nextEmpty === -1) commitBuild(next);
    },
    [activeSlotIndex, commitBuild, currentItem, running],
  );

  const handleSlotTap = useCallback(
    (index: number) => {
      if (!running || awaitingBuildRef.current) return;
      const next = [...slotsRef.current];
      next[index] = null;
      slotsRef.current = next;
      setSlots(next);
      setActiveSlotIndex(index);
      setBoardFlash(null);
    },
    [running],
  );

  // ── Keep the tutor's RUNTIME STATE truthful as items advance ──────
  useEffect(() => {
    if (!ctx.isConnected || !currentChallenge) return;
    const item = itemOf(currentIndex);
    if (!item) return;
    ctx.updateContext({
      task: item.task,
      word: item.word,
      middleSound: spokenVowel(item),
    });
    // Context methods are stable; keyed on the current challenge + connection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.isConnected, currentChallenge, currentIndex]);

  // ── Tap-to-hear — never withdrawn by band or tier ─────────────────
  // Says the WORD and stops. It never segments and never isolates the middle
  // sound: on two of the three modes that IS the answer.
  const handleHearWord = useCallback(() => {
    const item = currentItem();
    if (!item) return;
    SoundManager.tap();
    hearTapsRef.current += 1;
    setWordTapped(true);
    ctx.sendText(pronounceCue(item.word), { silent: true });
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    tapTimerRef.current = setTimeout(() => setWordTapped(false), 1200);
  }, [ctx, currentItem]);

  // ── Start: one gesture, because a browser will not open a mic without one ─
  const startRun = useCallback(() => {
    const first = itemOf(0);
    const activeLoop = loopRef.current;
    if (!first || !activeLoop) return;
    correctionsRef.current.clear();
    outcomesRef.current = [];
    errorPatternsRef.current = [];
    diagnosisObservationsRef.current = [];
    soundStatsRef.current = { vowelOk: 0, vowelTried: 0, consonantOk: 0, consonantTried: 0 };
    lastHeardRef.current = null;
    hearTapsRef.current = 0;
    submittedRef.current = false;
    setSolvedIds(new Set());
    setSorted([]);
    setCurrentIndex(0);
    idxRef.current = 0;
    setReward(null);
    setWordTapped(false);
    resetBoard();
    activeLoop.reset();
    setRunning(true);
    setStage('asking');
    setStatusLine(first.task === 'spell-word' ? 'Listen, then fill in the boxes.' : 'Listen, then say the middle sound.');
    challengeStartRef.current = performance.now();
    // ONE cue with ONE job: speak this. The how-to-play is inside the quoted
    // line rather than a directive telling the tutor to compose one — residual
    // SWAP-1, where a two-job opening turn improvised its own ask and item 1
    // ran without its model.
    activeLoop.sendCueNow(itemCue(first, { ...cueOptsFor(0), opening: true, howToPlay: true }));
    activeLoop.arm();
  }, [cueOptsFor, itemOf, resetBoard]);

  const startRunRef = useRef(startRun);
  startRunRef.current = startRun;

  const prepareLive = useCallback(async () => {
    if (preparing) return;
    setPreparing(true);
    setStatusLine('Getting ready…');
    try {
      if (!connectedRef.current && ctx.sessionMode === 'idle') {
        weConnectedRef.current = true;
        const first = itemOf(0);
        await ctx.connect({
          primitive_type: 'cvc-speller',
          instance_id: resolvedInstanceId,
          primitive_data: {
            activity: 'live direct instruction CVC sounds-and-letters practice',
            task: first?.task ?? '',
            word: first?.word ?? '',
            middleSound: first ? spokenVowel(first) : '',
          },
          grade_level: gradeLevel || 'kindergarten',
          exhibit_id: exhibitId,
          audio_input: CVC_AUDIO_INPUT,
          // DI-GREET-1: this pack's first cue is its opening line — the tutor
          // must not improvise a greeting turn before it arrives.
          owns_opening: true,
        });
        const started = performance.now();
        while (!connectedRef.current && performance.now() - started < 12_000) await sleep(100);
        if (!connectedRef.current) throw new Error('The tutor did not connect.');
      }

      ctx.startListening();
      const micStarted = performance.now();
      while (!listeningRef.current && performance.now() - micStarted < 10_000) await sleep(100);
      if (!listeningRef.current) throw new Error('The microphone did not open.');

      startRunRef.current();
    } catch (error) {
      setStatusLine(error instanceof Error ? error.message : 'Could not start.');
      setStage('idle');
    } finally {
      setPreparing(false);
    }
  }, [ctx, exhibitId, gradeLevel, itemOf, preparing, resolvedInstanceId]);

  // Unmount: never leave Live holding the mic, never leave a timer running.
  useEffect(() => () => {
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    if (weConnectedRef.current) {
      ctx.stopListening();
      ctx.disconnect();
    }
    // Context methods are stable; unmount-only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ============================================================================
  // Render
  // ============================================================================

  if (!currentChallenge) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-6">
          <p className="text-slate-400 text-center">No spelling challenges available.</p>
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  const item = itemOf(currentIndex)!;
  const micState = preparing ? 'opening' : ctx.isListening ? 'armed' : 'idle';
  const isSupported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  const showPicture = currentChallenge.showPictureCue !== false && !!currentChallenge.emoji;
  const stageWord = stage === 'affirmed'
    ? 'yes!'
    : stage === 'judging'
      ? 'let’s see…'
      : stage === 'asking'
        ? (item.task === 'spell-word' ? 'fill the boxes' : 'middle sound?')
        : 'get ready';

  // ── fill-vowel: the consonant frame. The blank stays a blank until the
  //    tutor has affirmed; the letter arriving IS the reward, and it is the
  //    only place the sound→letter link is ever shown.
  const renderFillVowel = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-2">
        <div className="w-20 h-20 rounded-xl bg-blue-500/15 border-2 border-blue-500/30 flex items-center justify-center text-3xl font-bold uppercase text-blue-300">
          {item.letters[0]}
        </div>
        <div
          className={`w-20 h-20 rounded-xl border-2 border-dashed flex items-center justify-center text-3xl font-bold uppercase transition-all ${
            reward && stage === 'affirmed'
              ? 'bg-emerald-500/30 border-emerald-400/60 text-emerald-200 animate-bounce'
              : 'bg-slate-800/40 border-slate-500/40 text-slate-500 animate-pulse'
          }`}
        >
          {reward && stage === 'affirmed' ? reward : '?'}
        </div>
        <div className="w-20 h-20 rounded-xl bg-blue-500/15 border-2 border-blue-500/30 flex items-center justify-center text-3xl font-bold uppercase text-blue-300">
          {item.letters[2]}
        </div>
      </div>
      {reward && stage === 'affirmed' && (
        <p className="text-center text-emerald-300 text-sm">
          {vowelKeyword(reward) ? `like ${vowelKeyword(reward)}` : ''}
        </p>
      )}
    </div>
  );

  // ── spell-word: Elkonin boxes + letter bank. The third letter landing is
  //    the commit; the board locks while the tutor judges.
  const renderSpellWord = () => (
    <div className="space-y-5">
      {showPicture && (
        <LuminaPanel className="flex items-center justify-center px-5 py-3">
          <span
            className="text-4xl"
            role="img"
            aria-label={currentChallenge.imageDescription || currentChallenge.targetWord}
          >
            {currentChallenge.emoji}
          </span>
        </LuminaPanel>
      )}

      <div className="flex items-center justify-center gap-3">
        {slots.map((letter, index) => {
          const isActive = activeSlotIndex === index && !awaitingBuildRef.current;
          const slotState: DropZoneState = boardFlash
            ?? (letter !== null ? 'filled' : isActive ? 'dragOver' : 'idle');
          return (
            <button
              key={index}
              onClick={() => handleSlotTap(index)}
              disabled={!running || stage === 'judging'}
              aria-label={`box ${index + 1}`}
              className={`
                relative w-20 h-20 rounded-xl border-2 flex items-center justify-center
                text-3xl font-bold uppercase transition-all duration-200 cursor-pointer select-none
                ${dropZoneStateClass(slotState)}
                ${slotState === 'correct' ? motion.pop : ''}
                ${slotState === 'incorrect' ? motion.shake : ''}
              `}
            >
              {letter ? <span>{letter}</span> : <span className="text-lg">?</span>}
            </button>
          );
        })}
      </div>

      <LuminaPanel className="p-4">
        <div className="flex flex-wrap gap-2 justify-center">
          {letterBank.map((letter, index) => (
            <button
              key={`${letter}-${index}`}
              onClick={() => handleSelectLetter(letter)}
              disabled={!running || stage === 'judging' || activeSlotIndex === null}
              className={`
                w-12 h-12 rounded-lg border-2 flex items-center justify-center
                text-xl font-bold uppercase transition-all duration-150
                cursor-pointer select-none hover:scale-110
                ${VOWELS.has(letter)
                  ? 'bg-red-500/15 border-red-500/30 text-red-300 hover:bg-red-500/25'
                  : 'bg-blue-500/15 border-blue-500/30 text-blue-300 hover:bg-blue-500/25'
                }
                ${(!running || stage === 'judging' || activeSlotIndex === null)
                  ? 'opacity-40 cursor-not-allowed hover:scale-100'
                  : ''}
              `}
            >
              {letter}
            </button>
          ))}
        </div>
      </LuminaPanel>
    </div>
  );

  // ── word-sort: the current word's picture, plus the columns built out of
  //    answers ALREADY GIVEN. A column is labelled the moment its first word
  //    is affirmed — never before, so nothing on screen names the answer.
  const renderWordSort = () => {
    const columns = Array.from(new Set(sorted.map((s) => s.vowel)));
    return (
      <div className="space-y-5">
        {showPicture && (
          <div className="flex justify-center">
            <span className="text-5xl" role="img" aria-label={currentChallenge.imageDescription || currentChallenge.targetWord}>
              {currentChallenge.emoji}
            </span>
          </div>
        )}
        {reward && stage === 'affirmed' && (
          <p className="text-center text-emerald-300 text-lg font-black">
            {reward.toUpperCase()}
            {vowelKeyword(reward) ? <span className="text-sm font-normal text-emerald-300/80"> — like {vowelKeyword(reward)}</span> : null}
          </p>
        )}
        {columns.length > 0 && (
          <div className="flex items-start justify-center gap-4">
            {columns.map((vowel) => (
              <div key={vowel} className="rounded-2xl bg-white/5 border-2 border-white/10 px-4 py-3 min-w-[110px]">
                <div className="text-center text-2xl font-black text-emerald-300 uppercase">{vowel}</div>
                <div className="text-center text-[10px] text-slate-500 mb-2">like {vowelKeyword(vowel)}</div>
                <div className="flex flex-col items-center gap-1">
                  {sorted.filter((s) => s.vowel === vowel).map((s) => (
                    <span key={s.id} className="text-2xl" role="img" aria-label={s.word}>{s.emoji || '•'}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
            {/* Grade / mode badges are adult chrome — hidden for pre-readers. */}
            {!isPreReader && (
              <div className="flex items-center gap-2">
                {/* The vowel badge appears only when the objective NAMED a vowel.
                    An unscoped session spans the letter group's vowels, and
                    labelling it "Short A" would be both wrong and a hint. */}
                {vowelFocus && (
                  <LuminaBadge className="text-xs">{VOWEL_LABELS[vowelFocus] || vowelFocus}</LuminaBadge>
                )}
                <LuminaBadge accent="emerald" className="text-xs">{TASK_BADGE[item.task]}</LuminaBadge>
              </div>
            )}
          </div>
          <LuminaBadge accent="cyan" className="text-xs">
            {item.task === 'spell-word' ? 'Build it' : 'Say it out loud'}
          </LuminaBadge>
        </div>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {!evaluation.hasSubmitted && (
          <>
            {!isPreReader && challenges.length > 0 && (
              <div className="mb-2 flex justify-center">
                <LuminaChallengeCounter current={currentIndex + 1} total={challenges.length} variant="dots" />
              </div>
            )}

            {/* One audio affordance, all modes: hear the word again. It never
                stretches and never isolates a sound — that is the answer. */}
            <div className="flex items-center justify-center">
              <button
                onClick={handleHearWord}
                aria-label="hear the word"
                className={`
                  flex items-center rounded-full px-5 py-2.5 text-sm font-medium border-2 transition-all cursor-pointer
                  ${wordTapped
                    ? 'bg-amber-500/25 border-amber-400/60 text-amber-200 scale-105'
                    : 'bg-amber-500/15 border-amber-500/30 hover:bg-amber-500/25 hover:scale-105 text-amber-300'}
                `}
              >
                <SpeakerIcon className="text-amber-300 mr-1.5" size="w-5 h-5" /> Hear It
              </button>
            </div>

            {item.task === 'fill-vowel' && renderFillVowel()}
            {item.task === 'spell-word' && renderSpellWord()}
            {item.task === 'word-sort' && renderWordSort()}

            <div className="text-center text-xs uppercase tracking-[0.25em] text-cyan-300">{stageWord}</div>

            {!isPreReader && (
              <p className="text-center text-xs text-slate-500">
                {item.task === 'spell-word'
                  ? 'Tap “Hear It” for the word, then put a letter in each box.'
                  : 'Tap “Hear It” for the word, then say the middle sound.'}
              </p>
            )}

            {/* The mic. ONE tap, at the start, because a browser will not open a
                microphone without a gesture — never per answer, and never a
                push-to-talk button the child has to find mid-challenge. It stays
                open through `spell-word` too: the doctrine is one open mic per
                session, not one per spoken mode. */}
            <div className="flex flex-col items-center gap-3 pt-1">
              <LuminaMicListener
                state={micState}
                level={ctx.micLevel}
                isSupported={isSupported}
                onStart={() => void prepareLive()}
                onCancel={running || ctx.sessionMode === 'lesson' ? undefined : ctx.stopListening}
                size="lg"
                idleLabel="Tap to start"
                openingLabel="Getting ready…"
                listeningLabel="I’m listening"
              />
              <p className="text-sm text-slate-300">{statusLine}</p>
            </div>
          </>
        )}

        {evaluation.hasSubmitted && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={evaluation.submittedResult?.score}
            durationMs={evaluation.elapsedMs}
            heading="Sounds and Letters Complete!"
            celebrationMessage={`You got ${solvedIds.size} word${solvedIds.size === 1 ? '' : 's'}!`}
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default CvcSpeller;
