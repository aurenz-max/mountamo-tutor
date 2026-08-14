'use client';

/**
 * PhonicsBlender — DI modality, purely verbal. The Live tutor owns the clock.
 *
 * WHAT THE CHILD DOES. They see the word's letters laid out as separate cards
 * (c a t), they may tap any card to hear that sound, and they SAY THE WORD
 * ALOUD into an open mic. The Live tutor models it, waits, judges the audio
 * in-band, corrects contrastively, and its own affirmation is the advance.
 *
 * WHAT CHANGED, IN TWO RULINGS (both 2026-08-09).
 *  1. The loop was click-driven with a spoken judge bolted onto the answer — a
 *     push-to-talk mic, "Ready to Build!", "Check", "Blend!", "Next Word", and
 *     a `setTimeout` between phases. A pre-reader cannot read any of those, and
 *     a stopwatch rushes the slow child while holding back the fast one. Every
 *     transition is now the tutor's. There is no advance timer in this file.
 *  2. The first port kept the tile-arranging step as a judged gesture, so a
 *     word took two answers. Driven live, the tutor said "put the sounds in
 *     order" and the child answered by SAYING "k-a-t" — the right response to a
 *     blending task and not the one the screen wanted. Blending is a VERBAL
 *     skill; arranging tiles is sequencing practice wearing a blending costume.
 *     One word, one spoken answer.
 *
 * ANSWER-LEAK RULE (di-word-reading's, and it bit this primitive live). The
 * letters ARE the stimulus and are always shown. What must NOT appear before
 * the child speaks: the whole word printed as a word, and the picture — 🐱
 * hands a five-year-old "cat" without a sound being blended. The emoji is a
 * post-affirmation reward. This SUPERSEDES contract R8's "always visible"
 * reading; see docs/contracts/phonics-blender.md.
 *
 * DOCTRINE HELD: open mic, never push-to-talk; the mic is never gated on
 * tutor-busy; the tutor is quiet by default (it speaks only scripted lines); no
 * visible timers; tap-to-hear is never withdrawn (R2); the K band-gate
 * presentation is kept (R3).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLuminaAIContext } from '@/contexts/LuminaAIContext';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaBadge,
  LuminaChallengeCounter,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
  type DiagnosisEvidence,
} from '../../../evaluation';
import type { PhonicsBlenderMetrics } from '../../../evaluation/types';
import { useJudgedSpeechLoop } from '../../../hooks/useJudgedSpeechLoop';
import type { LoopEmission } from '../../../hooks/judgedLoopModel';
import { SoundManager } from '../../../utils/SoundManager';
import { isPreReaderGrade } from '../../../utils/kindergartenMode';
import PhaseSummaryPanel, { type PhaseResult } from '../../../components/PhaseSummaryPanel';
import JudgedMicPanel from '../../../components/JudgedMicPanel';
import { phaseResultsFromSummary } from '../../../hooks/usePhaseResults';
import {
  completeCue,
  itemCue,
  moveOnCue,
  pronounceCue,
  type BlendItem,
} from './phonicsBlenderScript';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface PhonicsBlenderData {
  title: string;
  gradeLevel: string;
  patternType: 'cvc' | 'cvce' | 'blend' | 'digraph' | 'r-controlled' | 'diphthong';

  words: Array<{
    id: string;
    targetWord: string;
    phonemes: Array<{
      id: string;
      sound: string;                  // The phoneme, e.g. "/k/" — spoken on tap
      letters: string;                // The letters it maps to, e.g. "c" — SHOWN
    }>;
    /** POST-affirmation reward picture only. Never shown before the blend. */
    emoji?: string;
    imageDescription?: string;
  }>;

  // ── Within-mode support tier (stamped in code by the generator from
  //    ctx.supportTier). Presentation / instruction ONLY — never the words, the
  //    sounds, or the answer. ALL OPTIONAL: absent ⇒ full help. ──
  /** Threaded to the tutor so its reveal latitude matches the on-screen tier. */
  supportTier?: 'easy' | 'medium' | 'hard';
  /**
   * How much SEGMENTATION help the letter row gives:
   *   'full'  — separated letter cards with dots between (c · a · t)
   *   'word'  — separated letter cards, no dots
   *   'none'  — the letters joined as one solid word; the child segments it
   * The stimulus itself is never withdrawn, only the help reading it.
   */
  showBlendPreview?: 'full' | 'word' | 'none';
  /** Tutor: enumerate the word's sounds when it models. Default true. */
  nameTargetPhonemes?: boolean;
  /** @deprecated No surface since the verbal port — there are no build slots. */
  showSlotCount?: boolean;
  /** @deprecated No surface since the verbal port — the letters ARE the tile. */
  showTileLetters?: boolean;

  // Evaluation props (optional, auto-injected)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  componentIntent?: string;
  objectiveText?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<PhonicsBlenderMetrics>) => void;
}

interface PhonicsBlenderProps {
  data: PhonicsBlenderData;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const PATTERN_LABELS: Record<string, string> = {
  'cvc': 'CVC Words',
  'cvce': 'Silent-E Words',
  'blend': 'Consonant Blends',
  'digraph': 'Digraphs',
  'r-controlled': 'R-Controlled Vowels',
  'diphthong': 'Diphthongs',
};

/** Corrections the tutor may run on one word before the lesson moves on anyway.
 *  A hard word resurfaces through distributed review, not by drilling a
 *  frustrated five-year-old in place. */
const MAX_CORRECTIONS_PER_WORD = 2;

/** Manual voice-activity mode: our amplitude detector brackets every learner
 *  turn. Gemini's speech-likeness VAD is unusable for short spoken responses
 *  (DI bench run-3 ruling). Also declared on the catalog entry so the lesson
 *  path opens the shared session the same way. */
const BLEND_AUDIO_INPUT = { manual_activity: true };

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type Stage = 'idle' | 'reading' | 'affirmed' | 'done';

interface WordOutcome {
  id: string;
  /** The family's word for "the tutor affirmed it"; `blended` is what this
   *  primitive calls the act, and it is still the argument name below. */
  solved: boolean;
  corrections: number;
  score: number;
  seconds: number | null;
}

const scoreForCorrections = (corrections: number): number =>
  corrections <= 0 ? 100 : corrections === 1 ? 67 : 33;

// ============================================================================
// Component
// ============================================================================

const PhonicsBlender: React.FC<PhonicsBlenderProps> = ({ data, className }) => {
  const {
    title,
    gradeLevel,
    patternType,
    words = [],
    supportTier,
    showBlendPreview,
    nameTargetPhonemes,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    componentIntent,
    objectiveText,
    onEvaluationSubmit,
  } = data;

  const ctx = useLuminaAIContext();

  // ── State ────────────────────────────────────────────────────────
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [stage, setStage] = useState<Stage>('idle');
  const [activeSoundId, setActiveSoundId] = useState<string | null>(null);
  const [statusLine, setStatusLine] = useState('Tap the microphone to start.');
  const [running, setRunning] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [completedWords, setCompletedWords] = useState<Set<string>>(new Set());
  /** Reward picture for the word JUST blended — post-answer only (answer-leak
   *  rule), cleared the moment the next word opens. */
  const [rewardEmoji, setRewardEmoji] = useState<string | null>(null);

  // Visual-only timers. NONE advance anything — they clear a highlight. The
  // lane's gate ("no setTimeout-to-advance survives") is about progression, and
  // progression here has exactly one cause: a tutor verdict.
  const soundTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stableInstanceIdRef = useRef(instanceId || `phonics-blender-${Math.round(performance.now())}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  const currentWord = words[currentWordIndex];

  // Progression authority is React state; mirror into refs so the emission
  // handler (which fires inside the loop's dispatch) reads it live.
  const idxRef = useRef(0);
  idxRef.current = currentWordIndex;

  const correctionsRef = useRef(new Map<string, number>());
  const outcomesRef = useRef<WordOutcome[]>([]);
  const wordStartRef = useRef<number | null>(null);
  const submittedRef = useRef(false);
  const weConnectedRef = useRef(false);
  const connectedRef = useRef(ctx.isConnected);
  const listeningRef = useRef(ctx.isListening);
  connectedRef.current = ctx.isConnected;
  listeningRef.current = ctx.isListening;

  /** What the child SAID, and what the tutor said back. Misconception Loop S1
   *  Tier-A evidence — DATA only, never rendered (a stray write to a status
   *  line in this family gets spoken aloud). */
  const lastHeardRef = useRef<string | null>(null);
  const failedVerdictsRef = useRef<Array<{ word: string; heard: string; judgeFeedback: string }>>([]);

  const isPreReader = isPreReaderGrade(gradeLevel);

  // ── Support tier: read-with-full-help-default ────────────────────
  const segmentation: 'full' | 'word' | 'none' =
    showBlendPreview === 'none' ? 'none' : showBlendPreview === 'word' ? 'word' : 'full';
  /** The tier lever that reaches the TUTOR: at `hard` the screen shows the word
   *  unsegmented, so the tutor must not read the sounds out either. */
  const phonemesNamed = nameTargetPhonemes !== false;

  const evaluation = usePrimitiveEvaluation<PhonicsBlenderMetrics>({
    primitiveType: 'phonics-blender',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    componentIntent,
    objectiveText,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const itemOf = useCallback(
    (index: number): BlendItem | null => {
      const word = words[index];
      if (!word) return null;
      return {
        id: word.id,
        targetWord: word.targetWord,
        phonemes: word.phonemes,
        emoji: word.emoji,
      };
    },
    [words],
  );
  const currentItem = useCallback(() => itemOf(idxRef.current), [itemOf]);

  const wordResults = useMemo<PhaseResult[]>(() => {
    if (!evaluation.hasSubmitted) return [];
    // This port drives the loop itself, so its ledger is the ref, not a
    // runner summary — the row shape is the family's either way.
    return phaseResultsFromSummary(words, { outcomes: outcomesRef.current }, (word) => ({
      label: word.targetWord,
      icon: word.emoji || '🔤',
    }));
  }, [evaluation.hasSubmitted, words]);

  // ── Submit ───────────────────────────────────────────────────────
  const finishAndSubmit = useCallback(() => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    const outcomes = outcomesRef.current;
    const wordsBlended = outcomes.filter(o => o.solved).length;
    const wordsTotal = words.length;
    const totalSounds = words.reduce((sum, w) => sum + w.phonemes.length, 0);
    const firstTry = outcomes.filter(o => o.solved && o.corrections === 0).length;
    const attemptsCount = outcomes.reduce((s, o) => s + 1 + o.corrections, 0);
    const timed = outcomes.map(o => o.seconds).filter((s): s is number => s != null);
    const avgSeconds = timed.length ? timed.reduce((s, v) => s + v, 0) / timed.length : 0;
    const accuracy = outcomes.length
      ? Math.round(outcomes.reduce((s, o) => s + o.score, 0) / outcomes.length)
      : 0;

    const metrics: PhonicsBlenderMetrics = {
      type: 'phonics-blender',
      patternType,
      gradeLevel,
      wordsBlended,
      wordsTotal,
      phonemeAccuracy: accuracy,
      averageBlendingSpeed: Math.round(avgSeconds * 10) / 10,
      soundsCorrectOnFirstTry: firstTry,
      soundsTotal: totalSounds,
      attemptsCount,
    };

    // Misconception Loop S1 — Tier-A packet on diagnosable sessions. The judge
    // (the Live tutor) already articulated the failure in its correction line.
    const fails = failedVerdictsRef.current;
    const latest = fails[fails.length - 1];
    const diagnosisEvidence: DiagnosisEvidence | undefined = accuracy < 60 && latest ? {
      challengeSummary: `Sound out the letters of "${latest.word}" and blend them into the whole word aloud.`,
      expected: `Say the blended word "${latest.word}".`,
      observed: `Student said: "${latest.heard}".`,
      judgeFeedback: latest.judgeFeedback,
      priorAttempts: fails.slice(0, -1).map(f => ({
        challenge: `blend "${f.word}"`,
        observed: `said "${f.heard}" — ${f.judgeFeedback}`,
      })),
    } : undefined;

    evaluation.submitResult(accuracy >= 60, accuracy, metrics, { outcomes }, undefined, diagnosisEvidence);
    setRunning(false);
    setStage('done');
    setStatusLine('Great blending today!');
  }, [evaluation, gradeLevel, patternType, words]);

  // ── The loop ─────────────────────────────────────────────────────
  const loopRef = useRef<ReturnType<typeof useJudgedSpeechLoop> | null>(null);

  const closeWord = useCallback((item: BlendItem, blended: boolean) => {
    const corrections = correctionsRef.current.get(item.id) ?? 0;
    outcomesRef.current.push({
      id: item.id,
      solved: blended,
      corrections,
      score: blended ? scoreForCorrections(corrections) : 0,
      seconds: wordStartRef.current == null
        ? null
        : Math.round(((performance.now() - wordStartRef.current) / 1000) * 10) / 10,
    });
    if (blended) setCompletedWords(prev => new Set(Array.from(prev).concat(item.id)));
  }, []);

  const applyVerdict = useCallback(
    (judgment: 'affirmed' | 'corrected' | 'off-script', verdictText?: string) => {
      const item = currentItem();
      const loop = loopRef.current;
      if (!item || !loop || judgment === 'off-script') return;

      if (judgment === 'corrected') {
        const used = (correctionsRef.current.get(item.id) ?? 0) + 1;
        correctionsRef.current.set(item.id, used);
        SoundManager.playIncorrect();
        failedVerdictsRef.current = [
          ...failedVerdictsRef.current,
          {
            word: item.targetWord,
            heard: lastHeardRef.current ?? '(not caught)',
            judgeFeedback: verdictText ?? '',
          },
        ].slice(-8);

        if (used <= MAX_CORRECTIONS_PER_WORD) {
          // The tutor's correction line already re-modeled and re-asked in-band.
          setStage('reading');
          setStatusLine('Have another go — what word?');
          return;
        }
        // Capped: acknowledge and move the lesson forward.
        closeWord(item, false);
        const next = itemOf(idxRef.current + 1);
        loop.queueCue(moveOnCue(item, next, phonemesNamed));
        if (next) {
          setCurrentWordIndex(idxRef.current + 1);
          idxRef.current += 1;
          setRewardEmoji(null);
          setStage('reading');
          setStatusLine('Good try — here comes the next one.');
          wordStartRef.current = performance.now();
        } else {
          finishAndSubmit();
        }
        return;
      }

      // Affirmed — the word is theirs. The picture is the reward, and this is
      // the first moment it may appear.
      SoundManager.playCorrect();
      closeWord(item, true);
      setStage('affirmed');
      setRewardEmoji(item.emoji ?? null);
      const next = itemOf(idxRef.current + 1);
      if (next) {
        setCurrentWordIndex(idxRef.current + 1);
        idxRef.current += 1;
        setStatusLine('Yes! Nice blending.');
        wordStartRef.current = performance.now();
        loop.queueCue(itemCue(next, { nameSounds: phonemesNamed }));
      } else {
        setStatusLine('You did it!');
        loop.queueCue(completeCue());
        finishAndSubmit();
      }
    },
    [closeWord, currentItem, finishAndSubmit, itemOf, phonemesNamed],
  );

  const handleEmission = useCallback(
    (emission: LoopEmission) => {
      switch (emission.kind) {
        case 'attempt-open':
          lastHeardRef.current = null;
          setStatusLine('Listening…');
          return;
        case 'attempt-transcript':
          lastHeardRef.current = emission.text;
          return;
        case 'verdict':
          if (emission.judgment === 'no-verdict') {
            setStatusLine('One more time — what word?');
            return;
          }
          applyVerdict(emission.judgment, emission.verdictText);
          return;
        case 'session-resumed':
        case 'resync': {
          // The session survived but the word in flight did not. Re-ask it
          // verbatim rather than leaving the child answering into something
          // that will never judge them.
          const item = currentItem();
          const loop = loopRef.current;
          if (item && loop) {
            setStage('reading');
            setStatusLine('Let’s take that word again.');
            loop.queueCue(itemCue(item, { nameSounds: phonemesNamed }));
          }
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
    [applyVerdict, currentItem, phonemesNamed],
  );

  const loop = useJudgedSpeechLoop({
    enabled: running,
    onEmission: handleEmission,
  });
  loopRef.current = loop;

  // ── Keep the tutor's RUNTIME STATE truthful as words advance ─────
  useEffect(() => {
    if (!ctx.isConnected || !currentWord) return;
    ctx.updateContext({
      patternType,
      currentWord: currentWord.targetWord,
      targetPhonemes: currentWord.phonemes.map(p => p.sound).join(' + '),
      supportTier: supportTier ?? null,
    });
    // Context methods are stable; keyed on the current word + connection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.isConnected, currentWord, patternType, supportTier]);

  // ── Tap-to-hear (R2) — never withdrawn by band or tier ───────────
  // Speaks the SOUND, never the whole word: the word is the answer. A child
  // who taps every letter has assembled the parts by ear and still has to run
  // them together themselves, which is the skill.
  const handlePlaySound = useCallback((phonemeId: string) => {
    const phoneme = currentWord?.phonemes.find(p => p.id === phonemeId);
    if (!phoneme) return;
    SoundManager.tap();
    setActiveSoundId(phonemeId);
    ctx.sendText(pronounceCue(phoneme.sound), { silent: true });
    if (soundTimerRef.current) clearTimeout(soundTimerRef.current);
    soundTimerRef.current = setTimeout(() => setActiveSoundId(null), 1200);
  }, [ctx, currentWord]);

  // ── Start: one gesture, because a browser will not open a mic without one ─
  const startRun = useCallback(() => {
    const first = itemOf(0);
    const activeLoop = loopRef.current;
    if (!first || !activeLoop) return;
    correctionsRef.current.clear();
    outcomesRef.current = [];
    failedVerdictsRef.current = [];
    lastHeardRef.current = null;
    submittedRef.current = false;
    setCompletedWords(new Set());
    setCurrentWordIndex(0);
    idxRef.current = 0;
    setRewardEmoji(null);
    activeLoop.reset();
    setRunning(true);
    setStage('reading');
    setStatusLine('Listen, then say the word.');
    wordStartRef.current = performance.now();
    // ONE cue with ONE job: speak this. How-to-play is inside the quoted line
    // rather than a directive telling the tutor to compose one — residual
    // SWAP-1, where a two-job opening turn improvised its own ask and item 1
    // ran without its model.
    activeLoop.sendCueNow(itemCue(first, {
      nameSounds: phonemesNamed, opening: true, howToPlay: isPreReader,
    }));
    activeLoop.arm();
  }, [isPreReader, itemOf, phonemesNamed]);

  const startRunRef = useRef(startRun);
  startRunRef.current = startRun;

  const prepareLive = useCallback(async () => {
    if (preparing) return;
    setPreparing(true);
    setStatusLine('Getting ready…');
    try {
      if (!connectedRef.current && ctx.sessionMode === 'idle') {
        weConnectedRef.current = true;
        await ctx.connect({
          primitive_type: 'phonics-blender',
          instance_id: resolvedInstanceId,
          primitive_data: {
            activity: 'live direct instruction sound blending',
            patternType,
            currentWord: words[0]?.targetWord ?? '',
            targetPhonemes: words[0]?.phonemes.map(p => p.sound).join(' + ') ?? '',
            supportTier: supportTier ?? null,
          },
          grade_level: gradeLevel || 'kindergarten',
          exhibit_id: exhibitId,
          audio_input: BLEND_AUDIO_INPUT,
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
  }, [ctx, exhibitId, gradeLevel, patternType, preparing, resolvedInstanceId, supportTier, words]);

  // Unmount: never leave Live holding the mic, never leave a timer running.
  useEffect(() => () => {
    if (soundTimerRef.current) clearTimeout(soundTimerRef.current);
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

  if (!currentWord) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-6">
          <p className="text-slate-400 text-center">No words available.</p>
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  // Gated on `running`, not on `ctx.isListening` alone: a lesson opens one
  // shared mic at connect, so `isListening` is true before the child acts —
  // the orb painted 'armed', which is the state that renders the live surface
  // INSTEAD of the tap-to-start button, leaving the run unstartable and the
  // board dead. See the same gate in useJudgedScriptRunner (19b drive, 08-14).
  const micState = preparing ? 'opening' : running && ctx.isListening ? 'armed' : 'idle';
  const stageWord = stage === 'affirmed' ? 'yes!' : stage === 'reading' ? 'what word?' : 'get ready';

  /** The stimulus: the word's letters. Tap any one to hear its sound. At
   *  `none` the letters are joined into a solid word, so the child does the
   *  segmenting — the help is withdrawn, never the letters themselves. */
  const renderLetters = () => (
    <div className={`flex items-center justify-center ${segmentation === 'none' ? 'gap-0' : 'gap-3'}`}>
      {currentWord.phonemes.map((phoneme, i) => (
        <React.Fragment key={phoneme.id}>
          {segmentation === 'full' && i > 0 && (
            <span className="text-slate-600 text-2xl" aria-hidden="true">·</span>
          )}
          <button
            onClick={() => handlePlaySound(phoneme.id)}
            aria-label={`sound ${phoneme.sound}`}
            className={`
              rounded-xl border-2 font-bold uppercase transition-all duration-200 cursor-pointer select-none
              ${segmentation === 'none' ? 'px-1 py-3 border-transparent' : 'px-5 py-4'}
              ${activeSoundId === phoneme.id
                ? 'bg-amber-500/30 border-amber-400/60 text-amber-200 scale-110 shadow-lg shadow-amber-500/20'
                : segmentation === 'none'
                  ? 'text-white hover:text-amber-200'
                  : 'bg-slate-700/40 border-slate-500/30 text-white hover:scale-105 hover:bg-slate-600/40'
              }
            `}
          >
            <span className="text-5xl">{phoneme.letters}</span>
          </button>
        </React.Fragment>
      ))}
    </div>
  );

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
            {/* Grade/pattern badges are adult chrome — hidden for pre-readers (R3). */}
            {!isPreReader && (
              <div className="flex items-center gap-2">
                <LuminaBadge className="text-xs">Grade {gradeLevel}</LuminaBadge>
                <LuminaBadge className="text-xs">{PATTERN_LABELS[patternType] || patternType}</LuminaBadge>
              </div>
            )}
          </div>
          <LuminaBadge accent="cyan" className="text-xs">Say it out loud</LuminaBadge>
        </div>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {!evaluation.hasSubmitted && (
          <>
            {!isPreReader && words.length > 0 && (
              <div className="mb-2 flex justify-center">
                <LuminaChallengeCounter current={currentWordIndex + 1} total={words.length} variant="dots" />
              </div>
            )}

            {/* The stage: the letters, and nothing that names the word. The
                reward picture appears only after the child has blended it. */}
            <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 to-slate-900/50 p-8 text-center">
              {renderLetters()}
              {rewardEmoji && stage === 'affirmed' && (
                <div className="mt-4 text-5xl leading-none animate-bounce" aria-hidden="true">
                  {rewardEmoji}
                </div>
              )}
              <div className="mt-4 text-xs uppercase tracking-[0.25em] text-cyan-300">{stageWord}</div>
            </div>

            {!isPreReader && (
              <p className="text-center text-xs text-slate-500">
                Tap a letter to hear its sound, then say the whole word.
              </p>
            )}

            {/* Every word here is blended OUT LOUD — the spoken label is the
                honest one on every item. */}
            <JudgedMicPanel
              state={micState}
              statusLine={statusLine}
              onStart={() => void prepareLive()}
              onCancel={running || ctx.sessionMode === 'lesson' ? undefined : ctx.stopListening}
            />
          </>
        )}

        {evaluation.hasSubmitted && wordResults.length > 0 && (
          <PhaseSummaryPanel
            phases={wordResults}
            overallScore={evaluation.submittedResult?.score}
            durationMs={evaluation.elapsedMs}
            heading="Session Complete!"
            celebrationMessage={`You blended ${completedWords.size} out of ${words.length} words!`}
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default PhonicsBlender;
