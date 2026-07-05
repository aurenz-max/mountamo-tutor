'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaBadge,
  LuminaButton,
  LuminaActionButton,
  LuminaChallengeCounter,
  LuminaProgress,
  LuminaFeedbackCard,
  LuminaMicListener,
  answerStateClass,
  type LuminaAccent,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { PictureVocabularyMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useSpokenTurn, type SpokenJudgeResult } from '../../../hooks/useSpokenTurn';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export type PictureVocabChallengeType =
  | 'receptive_match'   // tutor says the word → student taps the picture
  | 'naming'            // student sees the picture → says the word
  | 'opposite'          // student sees a word+picture → says its opposite
  | 'association'       // student sees a word+picture → says the thing that GOES WITH it (sock→shoe)
  | 'gradable_scale'    // student sees an ordered gradient with one rung blank → says the missing rung
  | 'sentence_frame';   // tutor voices a sentence with a blank → student says the missing word

export interface PictureVocabOption {
  word: string;
  emoji: string;
}

export interface PictureVocabChallenge {
  id: string;
  type: PictureVocabChallengeType;
  /** The word the student must produce (or tap). For 'opposite' this is the OPPOSITE word. */
  word: string;
  /** Picture (emoji) of the target word. Never shown pre-solve in sentence_frame mode. */
  emoji: string;
  /** Exactly 4 options (includes the target once). Used for receptive taps and as the spoken-mode fallback. */
  options: PictureVocabOption[];
  // -- opposite mode --
  baseWord?: string;
  baseEmoji?: string;
  // -- sentence_frame mode --
  /** Display text with a blank, e.g. "We sleep in a ____." Must NOT contain the target word. */
  frameDisplay?: string;
  /** What the tutor says aloud. Must NOT contain the target word. */
  frameSpoken?: string;
  // -- association mode --
  // reuses baseWord/baseEmoji (the prompt object shown) + word/emoji (the partner = the answer).
  // -- gradable_scale mode --
  /** Ordered rung words on the gradient, e.g. ['freezing','cold','cool','warm','hot']. */
  scaleWords?: string[];
  /** Index into scaleWords of the blanked target rung (scaleWords[scaleTargetIndex] === word). */
  scaleTargetIndex?: number;
}

export interface PictureVocabularyData {
  title: string;
  description: string;
  /** Session-level mode; mixed sessions still render per challenge.type. */
  challengeType: PictureVocabChallengeType;
  /** 4-6 challenges. REQUIRED — built by the generator from the word pool. */
  challenges: PictureVocabChallenge[];
  gradeLevel?: string;

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<PictureVocabularyMetrics>) => void;
}

interface PictureVocabularyProps {
  data: PictureVocabularyData;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const PHASE_CONFIG: Record<string, PhaseConfig> = {
  receptive_match: { label: 'Listen & Find', icon: '👂', accentColor: 'blue' },
  naming: { label: 'Say It', icon: '🎙️', accentColor: 'emerald' },
  association: { label: 'Goes Together', icon: '🧩', accentColor: 'pink' },
  opposite: { label: 'Opposites', icon: '🔁', accentColor: 'amber' },
  sentence_frame: { label: 'Finish the Sentence', icon: '💬', accentColor: 'purple' },
  gradable_scale: { label: 'Word Scale', icon: '🎚️', accentColor: 'cyan' },
};

const MODE_META: Record<PictureVocabChallengeType, { badge: string; icon: string; accent: LuminaAccent }> = {
  receptive_match: { badge: 'Listen & Find', icon: '👂', accent: 'blue' },
  naming: { badge: 'Say It', icon: '🎙️', accent: 'emerald' },
  association: { badge: 'Goes Together', icon: '🧩', accent: 'pink' },
  opposite: { badge: 'Opposites', icon: '🔁', accent: 'amber' },
  sentence_frame: { badge: 'Finish the Sentence', icon: '💬', accent: 'purple' },
  gradable_scale: { badge: 'Word Scale', icon: '🎚️', accent: 'cyan' },
};

const MAX_WRONG_TAPS = 3;
const AUTO_ADVANCE_MS = 1600;

const isSpokenMode = (t: PictureVocabChallengeType | undefined) =>
  t === 'naming' || t === 'opposite' || t === 'association'
  || t === 'gradable_scale' || t === 'sentence_frame';

// ============================================================================
// Component
// ============================================================================

const PictureVocabulary: React.FC<PictureVocabularyProps> = ({ data, className }) => {
  const {
    title,
    challenges = [],
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const gradeLevel = data.gradeLevel ?? 'K';

  // ── Activity gate + session voice consent ─────────────────────
  const [hasStarted, setHasStarted] = useState(false);
  // 'auto' = conversational voice-activity mode (session-level opt-in from the
  // start screen — THE consent gesture). 'off' = tap-only.
  const [voiceMode, setVoiceMode] = useState<'auto' | 'off'>('off');

  // ── Interaction state (reset per challenge) ────────────────────
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [spokenMatched, setSpokenMatched] = useState(false);
  const [choicesRevealed, setChoicesRevealed] = useState(false);
  const [spokenMisses, setSpokenMisses] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | ''>('');
  const [isShaking, setIsShaking] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  // Session-level spoken metrics
  const [spokenWords, setSpokenWords] = useState<Set<string>>(new Set());
  const [totalSpokenMisses, setTotalSpokenMisses] = useState(0);

  const startTimeRef = useRef(Date.now());
  const recordedRef = useRef(false);

  const stableInstanceIdRef = useRef(instanceId || `picture-vocabulary-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // ── Shared challenge progress ──────────────────────────────────
  const {
    currentIndex,
    currentAttempts,
    results: challengeResults,
    isComplete: allChallengesComplete,
    recordResult,
    incrementAttempts,
    advance: advanceProgress,
  } = useChallengeProgress({ challenges, getChallengeId: (ch) => ch.id });

  const currentChallenge = challenges[currentIndex];

  const phaseResults = usePhaseResults({
    challenges,
    results: challengeResults,
    isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.type,
    phaseConfig: PHASE_CONFIG,
  });

  // ── Evaluation ─────────────────────────────────────────────────
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
  } = usePrimitiveEvaluation<PictureVocabularyMetrics>({
    primitiveType: 'picture-vocabulary',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const [submittedScore, setSubmittedScore] = useState<number | null>(null);

  // ── Shuffle options once per challenge ─────────────────────────
  const shuffledOptions = useMemo(() => {
    if (!currentChallenge?.options) return [];
    return [...currentChallenge.options].sort(() => Math.random() - 0.5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChallenge?.id]);

  // ── AI tutoring ────────────────────────────────────────────────
  const aiPrimitiveData = useMemo(() => ({
    challengeType: currentChallenge?.type,
    currentChallengeIndex: currentIndex + 1,
    totalChallenges: challenges.length,
    attempts: currentAttempts,
    voiceMode,
  }), [currentChallenge?.type, currentIndex, challenges.length, currentAttempts, voiceMode]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'picture-vocabulary',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel,
  });

  // ── Challenge intros (quiet-by-default elicitation) ────────────
  // PRINCIPLE: less is more. In a spoken session the tutor's voice should be
  // RARE, not per-round. We set the game frame ONCE up front, then the tutor
  // speaks on a round ONLY to deliver audio the screen can't give a pre-reader:
  // the word to TAP (receptive), the base word (opposite), or the sentence to
  // finish. Naming is fully self-evident on screen → the tutor stays SILENT and
  // lets the picture + on-screen prompt + live mic carry it.
  //
  // PROMPT LAW: for spoken modes the tutor must NEVER speak the target word —
  // the mic is OPEN while the tutor talks (decoupled from tutor state by
  // design: a missed student answer is worse than tutor bleed, which can only
  // land as no-match/unclear). The bracketed instructions below (and the
  // catalog aiDirectives) enforce this.
  const sendChallengeIntro = useCallback((ch: PictureVocabChallenge, isFirst: boolean) => {
    if (isFirst) {
      // One warm sentence that sets up the WHOLE game, then start the first item.
      const frame =
        `[ACTIVITY_START] Picture vocabulary — ${challenges.length} quick pictures. `
        + `Give ONE short, warm sentence to set it up (e.g. "Let's look at some pictures — when each one pops up, just say what it is!"), then start the first one. Keep it brief. `;
      switch (ch.type) {
        case 'receptive_match':
          sendText(frame + `First: say "Find the ${ch.word}!" clearly — the student answers by TAPPING (you MAY say "${ch.word}").`, { silent: true });
          break;
        case 'naming':
          sendText(frame + `First: a picture is on screen. Ask ONE short "What is this? Say it!" then be SILENT and wait. NEVER say "${ch.word}". The mic is live.`, { silent: true });
          break;
        case 'opposite':
          sendText(frame + `First: the screen shows "${ch.baseWord}". Ask "What's the opposite of ${ch.baseWord}?" then be SILENT and wait. NEVER say "${ch.word}". The mic is live.`, { silent: true });
          break;
        case 'association':
          sendText(frame + `First: the screen shows "${ch.baseWord}". Ask "What goes with ${ch.baseWord}?" then be SILENT and wait. NEVER say "${ch.word}". The mic is live.`, { silent: true });
          break;
        case 'gradable_scale': {
          const spokenScale = (ch.scaleWords ?? []).map((w, i) => i === ch.scaleTargetIndex ? 'hmm' : w).join(', ');
          sendText(frame + `First: read the scale in order, the blank spoken as "hmm": "${spokenScale}" — then ask "Which word is missing? Say it!" and be SILENT and wait. NEVER say "${ch.word}". The mic is live.`, { silent: true });
          break;
        }
        case 'sentence_frame':
          sendText(frame + `First: say this sentence, pausing at the blank: "${ch.frameSpoken ?? ch.frameDisplay}" — then be SILENT and wait. NEVER say "${ch.word}". The mic is live.`, { silent: true });
          break;
      }
      return;
    }
    // Subsequent rounds: speak ONLY to deliver content the screen can't convey.
    switch (ch.type) {
      case 'receptive_match':
        // Mechanism — the student taps what you name.
        sendText(`[NEXT_WORD] Say only: "Find the ${ch.word}." The student taps (you MAY say "${ch.word}").`, { silent: true });
        break;
      case 'naming':
        // Self-evident on screen → stay SILENT. The picture + live mic do the work.
        break;
      case 'opposite':
        // Base OBJECT is shown as an emoji and the ch1 framing established the task,
        // so stay SILENT — voicing a per-round cue talks over the student and stalls
        // the mic (same collision as association/naming). The live mic carries it.
        break;
      case 'association':
        // Self-evident on screen — the base OBJECT is shown as an emoji (like naming's
        // picture), so the tutor stays SILENT. This also avoids colliding the tutor's
        // audio playback with the judge mic arming on the same challenge, which stalled
        // capture (the "Goes Together" challenge-2 block). The live mic carries it.
        break;
      case 'gradable_scale': {
        // The scale must be heard; speak the blank as "hmm" so the answer is never voiced.
        const spokenScale = (ch.scaleWords ?? []).map((w, i) => i === ch.scaleTargetIndex ? 'hmm' : w).join(', ');
        sendText(`[NEXT_WORD] Read the scale, blank as "hmm": "${spokenScale}". NEVER say "${ch.word}". Then be silent — the mic is live.`, { silent: true });
        break;
      }
      case 'sentence_frame':
        // The sentence IS the content and must be heard.
        sendText(`[NEXT_WORD] Say the sentence, pausing at the blank: "${ch.frameSpoken ?? ch.frameDisplay}". NEVER say "${ch.word}". Then be silent — the mic is live.`, { silent: true });
        break;
    }
  }, [challenges.length, sendText]);

  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!hasStarted || !isConnected || hasIntroducedRef.current || !currentChallenge) return;
    hasIntroducedRef.current = true;
    sendChallengeIntro(currentChallenge, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasStarted, isConnected, currentChallenge]);

  useEffect(() => {
    if (!currentChallenge || !isConnected || !hasIntroducedRef.current) return;
    if (currentIndex === 0) return;
    sendChallengeIntro(currentChallenge, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  // ── Complete current challenge (stale-state guarded) ───────────
  const completeCurrentChallenge = useCallback((correct: boolean, viaSpoken: boolean) => {
    if (!currentChallenge || recordedRef.current) return;
    recordedRef.current = true;
    const wrongTaps = currentAttempts;
    const score = correct ? Math.max(25, 100 - wrongTaps * 25) : 0;
    recordResult({
      challengeId: currentChallenge.id,
      correct,
      attempts: wrongTaps + 1,
      score,
      ...(viaSpoken ? { spoken: true } : {}),
    });
  }, [currentChallenge, currentAttempts, recordResult]);

  // ── Spoken turn (the conversational beat) ──────────────────────
  const spokenActive =
    hasStarted && !showSummary && !showResult && !spokenMatched
    && voiceMode === 'auto' && isSpokenMode(currentChallenge?.type);

  // DESIGN LAW: the tutor NEVER speaks in response to a miss, an unclear catch,
  // or silence. The mic is open and decoupled from tutor state, so any coaching
  // audio here plays straight over a student who is still thinking or already
  // forming their next try — worst on opposite/association, where the answer
  // takes the longest to reach. The always-visible tap choices ARE the support
  // net; the tutor stays quiet and lets the student's voice have the floor.
  const handleSpokenResult = useCallback((result: SpokenJudgeResult) => {
    if (!currentChallenge || showResult || spokenMatched) return;
    if (result.outcome === 'match') {
      SoundManager.playCorrect();
      setSpokenMatched(true);
      setShowResult(true);
      setSpokenWords(prev => new Set(Array.from(prev).concat(currentChallenge.id)));
      setFeedback(`You said "${currentChallenge.word}"! ${currentChallenge.emoji}`);
      setFeedbackType('success');
      completeCurrentChallenge(true, true);
      // Quiet-by-default: the happy SFX + on-screen feedback + auto-advance carry
      // a routine success. The tutor speaks up ONLY for a moment that earns it —
      // the FIRST time the student uses their voice, or a comeback after a miss.
      const firstVoice = spokenWords.size === 0;
      const recovered = spokenMisses > 0;
      if (firstVoice || recovered) {
        sendText(
          `[SPOKEN_MATCH] Student said "${currentChallenge.word}" out loud`
          + (firstVoice ? ' — their FIRST spoken answer' : ' after trying again')
          + `! ONE short, joyful sentence (you may say the word now). Then STOP.`,
          { silent: true },
        );
      }
    } else if (result.outcome === 'no-match' && result.verdict?.heard) {
      // Heard a real but wrong word. Stay silent — the choices are already on
      // screen as a support net, and the mic keeps listening for another try.
      setSpokenMisses(m => m + 1);
      setTotalSpokenMisses(t => t + 1);
    } else {
      // Mic didn't catch a clear word (silence/noise). Stay silent and keep
      // listening; a spoken "say it again" here just talks over the student.
      setSpokenMisses(m => m + 1);
    }
  }, [currentChallenge, showResult, spokenMatched, spokenWords, spokenMisses, completeCurrentChallenge, sendText]);

  const handleNoSpeech = useCallback(() => {
    if (!currentChallenge || showResult || spokenMatched) return;
    // The student went quiet — almost always still thinking (opposites and
    // associations take a beat). The tutor stays silent and the mic keeps
    // listening; the choices are already visible if they'd rather tap.
  }, [currentChallenge, showResult, spokenMatched]);

  const spokenTurn = useSpokenTurn({
    targetWord: currentChallenge?.word ?? '',
    gradeLevel,
    active: spokenActive,
    mode: 'auto',
    onResult: handleSpokenResult,
    onNoSpeech: handleNoSpeech,
  });
  // Ref so handleNext (declared before spokenTurn is in scope for its deps) can cancel.
  const spokenTurnRef = useRef<typeof spokenTurn | null>(null);
  spokenTurnRef.current = spokenTurn;

  // ── Tap path (receptive mode + fallback for spoken modes) ──────
  const handleOptionTap = useCallback((idx: number) => {
    if (!currentChallenge || showResult) return;
    const option = shuffledOptions[idx];
    if (!option) return;
    setSelectedIndex(idx);

    if (option.word === currentChallenge.word) {
      SoundManager.playCorrect();
      setShowResult(true);
      setFeedback(`Yes! ${currentChallenge.emoji} "${currentChallenge.word}"!`);
      setFeedbackType('success');
      completeCurrentChallenge(true, false);
      // Quiet-by-default: SFX + on-screen feedback carry a routine correct tap.
      // No tutor chatter — the session celebration ([ALL_COMPLETE]) covers the win.
    } else {
      SoundManager.playIncorrect();
      incrementAttempts();
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      setSelectedIndex(null);
      setFeedback(`Hmm, not that one. Try again!`);
      setFeedbackType('error');
      sendText(
        `[ANSWER_INCORRECT] Student tapped "${option.word}" — incorrect (attempt ${currentAttempts + 1}). Give a tiny hint without saying "${currentChallenge.word}".`,
        { silent: true },
      );
      if (currentAttempts + 1 >= MAX_WRONG_TAPS) {
        setTimeout(() => {
          setShowResult(true);
          setFeedback(`It's ${currentChallenge.emoji} "${currentChallenge.word}"!`);
          setFeedbackType('success');
          completeCurrentChallenge(false, false);
          sendText(
            `[ANSWER_REVEALED] Out of tries — the answer "${currentChallenge.word}" is now shown. Say it warmly and move on. No shame.`,
            { silent: true },
          );
        }, 900);
      }
    }
  }, [currentChallenge, showResult, shuffledOptions, currentAttempts, incrementAttempts, completeCurrentChallenge, sendText]);

  // ── Advance / submit ───────────────────────────────────────────
  const submitFinalEvaluation = useCallback(() => {
    if (hasSubmittedEvaluation) return;
    const correctCount = challengeResults.filter(r => r.correct).length;
    const totalCount = challenges.length;
    const totalAttempts = challengeResults.reduce((sum, r) => sum + r.attempts, 0);
    const firstTryCount = challengeResults.filter(r => r.correct && r.attempts <= 1).length;
    const overallPct = totalCount > 0
      ? Math.round(challengeResults.reduce((s, r) => s + (r.score ?? (r.correct ? 100 : 0)), 0) / totalCount)
      : 0;
    const elapsed = Date.now() - startTimeRef.current;

    const metrics: PictureVocabularyMetrics = {
      type: 'picture-vocabulary',
      challengeType: data.challengeType,
      totalChallenges: totalCount,
      correctCount,
      attemptsCount: totalAttempts,
      firstTryCount,
      hintsViewed: 0,
      overallAccuracy: overallPct,
      averageAttemptsPerChallenge: totalCount > 0 ? totalAttempts / totalCount : 0,
    };

    setSubmittedScore(overallPct);
    submitEvaluation(overallPct >= 60, overallPct, metrics, {
      durationMs: elapsed,
      challengeResults,
      spokenWords: Array.from(spokenWords),
      spokenMisses: totalSpokenMisses,
      voiceMode,
    });

    const spokenCount = spokenWords.size;
    const phaseScoreStr = phaseResults.map(p => `${p.label} ${p.score}%`).join(', ');
    sendText(
      `[ALL_COMPLETE] All ${totalCount} done! Scores: ${phaseScoreStr}. Overall ${overallPct}%. `
      + `${spokenCount > 0 ? `The student SAID ${spokenCount} word${spokenCount === 1 ? '' : 's'} out loud — celebrate that especially. ` : ''}`
      + `Short celebration, then STOP.`,
      { silent: true },
    );
  }, [
    hasSubmittedEvaluation, challengeResults, challenges.length, data.challengeType,
    phaseResults, spokenWords, totalSpokenMisses, voiceMode, submitEvaluation, sendText,
  ]);

  const handleNext = useCallback(() => {
    spokenTurnRef.current?.cancel(); // never carry a live mic across challenges
    if (!advanceProgress()) {
      submitFinalEvaluation();
      setShowSummary(true);
    }
  }, [advanceProgress, submitFinalEvaluation]);

  // Auto-advance after a spoken match — driven off recorded state, ref-guarded
  // so a timer and a click can never both fire.
  const advanceRef = useRef(handleNext);
  advanceRef.current = handleNext;
  const autoAdvancedForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!currentChallenge || !spokenMatched || !showResult) return;
    if (autoAdvancedForRef.current === currentChallenge.id) return;
    autoAdvancedForRef.current = currentChallenge.id;
    const t = setTimeout(() => advanceRef.current(), AUTO_ADVANCE_MS);
    return () => clearTimeout(t);
    // Key on the stable id (matches the reset/shuffle effects). The latch that
    // guards this effect (autoAdvancedForRef) is cleared per-challenge in the
    // reset effect below — otherwise the advance→reset transition, where
    // spokenMatched is briefly still true under the NEXT challenge's id, poisons
    // the latch and the next real match never schedules ("Next one coming up…"
    // hangs forever).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spokenMatched, showResult, currentChallenge?.id]);

  // ── Per-challenge reset (PRD §5 rule 8) ────────────────────────
  useEffect(() => {
    setSelectedIndex(null);
    setShowResult(false);
    setSpokenMatched(false);
    setSpokenMisses(0);
    setFeedback('');
    setFeedbackType('');
    setIsShaking(false);
    recordedRef.current = false;
    // Clear the auto-advance latch so this fresh challenge can schedule its own
    // advance. Runs after the auto-advance effect in the transition commit, so
    // it wipes any latch that effect set on stale (still-true) spokenMatched.
    autoAdvancedForRef.current = null;
    // Always show the 4 choices from the start — the spoken answer stays the
    // primary, judged path, but the visible words are a support net AND a
    // guaranteed way forward when the mic stalls or the tutor is mid-sentence.
    setChoicesRevealed(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChallenge?.id]);

  // Voice toggled off mid-session → reveal choices for the live challenge.
  useEffect(() => {
    if (voiceMode === 'off') setChoicesRevealed(true);
  }, [voiceMode]);

  // ============================================================================
  // Render helpers
  // ============================================================================

  const renderListeningState = () => {
    if (!spokenActive || !spokenTurn.isSupported) return null;
    // The mic is tinted to the live challenge's mode accent so the orb reads as
    // part of the same beat (emerald=naming, amber=opposite, pink=association…).
    return (
      <div className="flex justify-center min-h-[64px] items-center">
        <LuminaMicListener
          state={spokenTurn.state}
          level={spokenTurn.level}
          isSupported={spokenTurn.isSupported}
          dormant={spokenTurn.dormant}
          onStart={() => spokenTurn.startManual()}
          onCancel={() => spokenTurn.cancel()}
          accent={modeMeta.accent}
          idleLabel="Say it!"
          listeningLabel="Your turn — say it!"
        />
      </div>
    );
  };

  const renderOptionCards = (showEmoji: boolean, showWord: boolean) => (
    <div className={`grid grid-cols-2 gap-3 ${isShaking ? 'animate-shake' : ''}`}>
      {shuffledOptions.map((option, idx) => {
        const isCorrectOption = showResult && option.word === currentChallenge?.word;
        const isWrongSelected = showResult && selectedIndex === idx && !isCorrectOption;
        const state = isCorrectOption ? 'correct' : isWrongSelected ? 'incorrect' : 'idle';
        return (
          <button
            key={`${currentChallenge?.id}-${idx}`}
            onClick={() => !showResult && handleOptionTap(idx)}
            disabled={showResult}
            className={`
              rounded-xl border-2 p-4 flex flex-col items-center gap-1.5
              transition-all duration-200 cursor-pointer
              ${answerStateClass(state)}
              ${isCorrectOption ? 'ring-2 ring-emerald-400/40' : ''}
            `}
          >
            {showEmoji && <span className="text-4xl">{option.emoji}</span>}
            {showWord && <span className="text-lg font-bold">{option.word}</span>}
          </button>
        );
      })}
    </div>
  );

  const renderChallenge = (ch: PictureVocabChallenge) => {
    switch (ch.type) {
      case 'receptive_match':
        return (
          <div className="space-y-5">
            <p className="text-center text-base text-slate-300 font-medium">
              {'👂'} Listen… tap the picture your tutor names!
            </p>
            {/* Emoji-only cards: the word stays spoken, not printed */}
            {renderOptionCards(true, false)}
          </div>
        );
      case 'naming':
        return (
          <div className="space-y-5">
            <div className="flex justify-center">
              <div className="rounded-2xl bg-emerald-500/10 border-2 border-emerald-500/30 px-12 py-8 text-center">
                <span className="text-7xl">{ch.emoji}</span>
              </div>
            </div>
            <p className="text-center text-base text-slate-300 font-medium">
              What is this?{voiceMode === 'auto' ? ' Say it out loud!' : ''}
            </p>
            {renderListeningState()}
            {choicesRevealed && !spokenMatched && (
              <>
                {voiceMode === 'auto' && !showResult && (
                  <p className="text-center text-xs text-slate-500">…or tap the word:</p>
                )}
                {renderOptionCards(false, true)}
              </>
            )}
            {voiceMode === 'auto' && !choicesRevealed && !showResult && (
              <div className="flex justify-center">
                <button
                  onClick={() => setChoicesRevealed(true)}
                  className="text-slate-500 text-xs hover:text-slate-300"
                >
                  Show me choices →
                </button>
              </div>
            )}
          </div>
        );
      case 'opposite':
        return (
          <div className="space-y-5">
            <div className="flex justify-center">
              <div className="rounded-2xl bg-amber-500/10 border-2 border-amber-500/30 px-10 py-6 text-center">
                <span className="text-5xl">{ch.baseEmoji}</span>
                <div className="text-2xl font-black text-amber-200 mt-2">{ch.baseWord}</div>
              </div>
            </div>
            <p className="text-center text-base text-slate-300 font-medium">
              What&rsquo;s the <span className="text-amber-300 font-bold">opposite</span>?
              {voiceMode === 'auto' ? ' Say it!' : ''}
            </p>
            {renderListeningState()}
            {choicesRevealed && !spokenMatched && renderOptionCards(false, true)}
            {voiceMode === 'auto' && !choicesRevealed && !showResult && (
              <div className="flex justify-center">
                <button
                  onClick={() => setChoicesRevealed(true)}
                  className="text-slate-500 text-xs hover:text-slate-300"
                >
                  Show me choices →
                </button>
              </div>
            )}
          </div>
        );
      case 'association':
        return (
          <div className="space-y-5">
            <div className="flex justify-center">
              <div className="rounded-2xl bg-pink-500/10 border-2 border-pink-500/30 px-10 py-6 text-center">
                <span className="text-5xl">{ch.baseEmoji}</span>
                <div className="text-2xl font-black text-pink-200 mt-2">{ch.baseWord}</div>
              </div>
            </div>
            <p className="text-center text-base text-slate-300 font-medium">
              What <span className="text-pink-300 font-bold">goes with</span> it?
              {voiceMode === 'auto' ? ' Say it!' : ''}
            </p>
            {renderListeningState()}
            {choicesRevealed && !spokenMatched && renderOptionCards(false, true)}
            {voiceMode === 'auto' && !choicesRevealed && !showResult && (
              <div className="flex justify-center">
                <button
                  onClick={() => setChoicesRevealed(true)}
                  className="text-slate-500 text-xs hover:text-slate-300"
                >
                  Show me choices →
                </button>
              </div>
            )}
          </div>
        );
      case 'gradable_scale': {
        const rungs = ch.scaleWords ?? [];
        return (
          <div className="space-y-5">
            <div className="flex justify-center">
              <div className="flex items-stretch gap-1.5 rounded-2xl bg-cyan-500/10 border-2 border-cyan-500/30 p-3 overflow-x-auto max-w-full">
                {rungs.map((w, i) => {
                  const isTarget = i === ch.scaleTargetIndex;
                  const reveal = isTarget && showResult;
                  return (
                    <div
                      key={i}
                      className={`flex flex-col items-center justify-center rounded-lg px-3 py-2 min-w-[60px] text-center ${
                        isTarget
                          ? reveal
                            ? 'bg-emerald-500/20 border-2 border-emerald-400/50'
                            : 'bg-white/5 border-2 border-dashed border-cyan-300/60'
                          : 'bg-white/5 border border-white/10'
                      }`}
                    >
                      <span className="text-[10px] text-slate-500">{i + 1}</span>
                      <span className={`text-base font-bold ${isTarget && !reveal ? 'text-cyan-300' : 'text-slate-100'}`}>
                        {isTarget && !reveal ? '???' : w}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            <p className="text-center text-base text-slate-300 font-medium">
              Which word is <span className="text-cyan-300 font-bold">missing</span>?
              {voiceMode === 'auto' ? ' Say it!' : ''}
            </p>
            {renderListeningState()}
            {choicesRevealed && !spokenMatched && renderOptionCards(false, true)}
            {voiceMode === 'auto' && !choicesRevealed && !showResult && (
              <div className="flex justify-center">
                <button
                  onClick={() => setChoicesRevealed(true)}
                  className="text-slate-500 text-xs hover:text-slate-300"
                >
                  Show me choices →
                </button>
              </div>
            )}
          </div>
        );
      }
      case 'sentence_frame':
        return (
          <div className="space-y-5">
            {/* No emoji pre-solve — the picture IS the answer */}
            <div className="flex justify-center">
              <div className="rounded-2xl bg-purple-500/10 border-2 border-purple-500/30 px-8 py-6 text-center max-w-md">
                {showResult ? (
                  <span className="text-5xl">{ch.emoji}</span>
                ) : (
                  <span className="text-4xl">{'💬'}</span>
                )}
                <div className="text-xl font-bold text-purple-100 mt-3 leading-relaxed">
                  {showResult && ch.frameDisplay
                    ? ch.frameDisplay.replace(/_{2,}/, ch.word)
                    : ch.frameDisplay}
                </div>
              </div>
            </div>
            <p className="text-center text-base text-slate-300 font-medium">
              What&rsquo;s the missing word?{voiceMode === 'auto' ? ' Say it!' : ''}
            </p>
            {renderListeningState()}
            {choicesRevealed && !spokenMatched && renderOptionCards(false, true)}
            {voiceMode === 'auto' && !choicesRevealed && !showResult && (
              <div className="flex justify-center">
                <button
                  onClick={() => setChoicesRevealed(true)}
                  className="text-slate-500 text-xs hover:text-slate-300"
                >
                  Show me choices →
                </button>
              </div>
            )}
          </div>
        );
    }
  };

  // ============================================================================
  // Main render
  // ============================================================================

  if (challenges.length === 0) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-6">
          <p className="text-slate-400 text-center">No challenges available.</p>
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  const elapsedMs = Date.now() - startTimeRef.current;
  const modeMeta = MODE_META[currentChallenge?.type ?? 'naming'];
  const micSupported = spokenTurn.isSupported;

  // ── Start screen: the session-level voice consent gesture ─────
  if (!hasStarted) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-8 flex flex-col items-center text-center space-y-5">
          <div className="text-5xl">{'🗣️'}</div>
          <LuminaCardTitle className="text-xl">{title}</LuminaCardTitle>
          <LuminaBadge className="text-xs">Picture Vocabulary</LuminaBadge>
          <p className="text-slate-400 text-sm max-w-sm">
            {data.description || 'Look at pictures and show what words you know!'}
            {' '}{challenges.length} challenges.
          </p>
          <div className="flex flex-col items-center gap-2.5">
            {micSupported && (
              <LuminaButton
                tone="primary"
                onClick={() => {
                  startTimeRef.current = Date.now();
                  setVoiceMode('auto');
                  setHasStarted(true);
                }}
                className="px-8 py-3 text-lg"
              >
                {'🎙️'} Start with Voice
              </LuminaButton>
            )}
            <LuminaButton
              tone={micSupported ? 'ghost' : 'primary'}
              onClick={() => {
                startTimeRef.current = Date.now();
                setVoiceMode('off');
                setHasStarted(true);
              }}
              className={micSupported ? 'px-6 py-2 text-sm' : 'px-8 py-3 text-lg'}
            >
              Start tap-only
            </LuminaButton>
            {micSupported && (
              <p className="text-slate-600 text-xs max-w-xs">
                Voice mode keeps the microphone open so you can just say your answers — best with a headset.
              </p>
            )}
          </div>
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
          <div className="flex items-center gap-2">
            {!showSummary && voiceMode === 'auto' && (
              <button
                onClick={() => { spokenTurn.cancel(); setVoiceMode('off'); }}
                className="text-xs text-slate-500 hover:text-slate-300 border border-white/10 rounded-full px-2.5 py-1"
                title="Turn off voice mode"
              >
                {'🎙️'} on
              </button>
            )}
            {!showSummary && (
              <LuminaBadge accent={modeMeta.accent} className="text-xs">
                {modeMeta.icon} {modeMeta.badge}
              </LuminaBadge>
            )}
          </div>
        </div>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {!showSummary && (
          <>
            <div className="flex items-center justify-between text-sm">
              <LuminaChallengeCounter
                current={currentIndex + 1}
                total={challenges.length}
                className="text-slate-400 text-sm"
              />
              <span className="text-slate-500 text-xs">
                {challengeResults.filter(r => r.correct).length} correct
                {spokenWords.size > 0 && ` · ${spokenWords.size} spoken 🎙️`}
              </span>
            </div>
            <LuminaProgress
              accent={modeMeta.accent}
              value={((showResult ? currentIndex + 1 : currentIndex) / challenges.length) * 100}
            />
          </>
        )}

        {!showSummary && currentChallenge && renderChallenge(currentChallenge)}

        {feedback && !showSummary && (
          <LuminaFeedbackCard
            status={feedbackType === 'success' ? 'correct' : 'incorrect'}
            className="text-center"
          >
            {feedback}
          </LuminaFeedbackCard>
        )}

        {/* Next: manual for tap path; spoken match auto-advances (no button = no double-advance) */}
        {showResult && !showSummary && !spokenMatched && (
          <div className="flex justify-center">
            <LuminaActionButton action="next" onClick={handleNext}>
              {currentIndex < challenges.length - 1 ? 'Next' : 'Finish'}
            </LuminaActionButton>
          </div>
        )}
        {showResult && !showSummary && spokenMatched && (
          <p className="text-center text-slate-500 text-xs animate-pulse">Next one coming up…</p>
        )}

        {showSummary && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedScore ?? undefined}
            durationMs={elapsedMs}
            heading="Picture Vocabulary Complete!"
            celebrationMessage={
              spokenWords.size > 0
                ? `Amazing — you said ${spokenWords.size} word${spokenWords.size === 1 ? '' : 's'} out loud! 🎙️`
                : 'Great job with your words!'
            }
            className="mb-6"
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default PictureVocabulary;
