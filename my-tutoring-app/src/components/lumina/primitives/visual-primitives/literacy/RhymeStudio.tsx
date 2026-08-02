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
  LuminaPrompt,
  LuminaProgress,
  LuminaChallengeCounter,
  LuminaFeedbackCard,
  answerStateClasses,
  LuminaMicListener,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { RhymeStudioMetrics } from '../../../evaluation/types';
import type { DiagnosisEvidence } from '../../../evaluation/diagnosis/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useSpokenWordCapture, type SpokenJudgeResult } from '../../../hooks/useSpokenWordCapture';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import { isPreReaderGrade } from '../../../utils/kindergartenMode';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

interface RhymeOption {
  word: string;
  /** Grade 1-2: a short prose image description. At K (pre-reader): a single
   *  depicting emoji — the option's picture surface. */
  image: string;
  isCorrect: boolean;
}

interface RhymeChallenge {
  id: string;
  mode: 'recognition' | 'identification' | 'production';
  targetWord: string;
  targetWordImage: string;
  /** Pre-reader picture surface: a single emoji depicting the target word. */
  targetWordEmoji?: string;
  rhymeFamily: string;
  comparisonWord?: string;
  comparisonWordImage?: string;
  /** Pre-reader picture surface: a single emoji depicting the comparison word. */
  comparisonWordEmoji?: string;
  doesRhyme?: boolean;
  options?: RhymeOption[];
  acceptableAnswers?: string[];
  remediationMove?: 'contrast_rime' | 'diagnostic_option' | 'constrained_production';

  // ── Within-mode support-tier scaffolds (stamped by the generator from
  //    ctx.supportTier). Display / instruction / tutor-latitude ONLY — they NEVER
  //    change the words, which option is correct, or the acceptableAnswers data.
  //    All optional; absent ⇒ legacy full-help behavior (every cue shown). ──
  /** #1 perception — amber rime-suffix highlight on the target card. Default: shown. */
  showRhymeFamilyHighlight?: boolean;
  /** #1 perception — the reader-grade prose image caption under a word/option. Default: shown. */
  showWordImage?: boolean;
  /** #2 instruction — the on-screen task restatement. Default: shown. */
  showInstructionText?: boolean;
  /** #2 instruction — may the tutor enumerate the answer choices aloud? Default: yes.
   *  FORCED true at PRE — the read-aloud is a non-reader's only instruction channel. */
  tutorNamesOptions?: boolean;
  /** #5 answer-form — correct tiles in the 4-tile production bank. Default: 2. */
  productionCorrectCount?: number;
}

export interface RhymeStudioData {
  title: string;
  gradeLevel: string;
  /** Within-mode support tier from the manifest. Threaded to the tutor reveal policy. */
  supportTier?: 'easy' | 'medium' | 'hard';
  challenges: RhymeChallenge[];

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<RhymeStudioMetrics>) => void;
}

// ============================================================================
// Props
// ============================================================================

interface RhymeStudioProps {
  data: RhymeStudioData;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const MODE_LABELS: Record<string, string> = {
  recognition: 'Recognition',
  identification: 'Identification',
  production: 'Production',
};

const MODE_ICONS: Record<string, string> = {
  recognition: '👂',
  identification: '🔍',
  production: '✏️',
};

const MODE_DESCRIPTIONS: Record<string, string> = {
  recognition: 'Do these words rhyme?',
  identification: 'Which word rhymes?',
  production: 'Think of a rhyming word!',
};

const MODE_ACCENT: Record<string, 'blue' | 'purple' | 'emerald'> = {
  recognition: 'blue',
  identification: 'purple',
  production: 'emerald',
};

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  recognition: { label: 'Recognition', icon: '👂', accentColor: 'blue' },
  identification: { label: 'Identification', icon: '🔍', accentColor: 'purple' },
  production: { label: 'Production', icon: '✏️', accentColor: 'emerald' },
};

const MAX_ATTEMPTS = 3;

// Production word-bank size. The bank always holds this many tiles; the support
// tier only shifts how many of them are correct rhymes (see productionCorrectCount).
const PRODUCTION_BANK_SIZE = 4;

// Common K-level words used as distractors for the production word bank.
// These are short CVC/CVCC words spanning many different rime patterns so we
// can always find a few that do NOT rhyme with the target family.
const DISTRACTOR_POOL = [
  'bed', 'big', 'box', 'bus', 'cup', 'dog', 'fix', 'got', 'hip',
  'jet', 'kid', 'leg', 'mud', 'net', 'pig', 'red', 'sit', 'top',
  'tub', 'web', 'yes', 'zip', 'nut', 'pen', 'rug', 'win', 'hop',
];

// ============================================================================
// Helper: split word to highlight rhyme family suffix
// ============================================================================

function splitByRhymeFamily(word: string, rhymeFamily: string): [string, string] {
  const suffix = rhymeFamily.startsWith('-') ? rhymeFamily.slice(1) : rhymeFamily;
  if (suffix && word.toLowerCase().endsWith(suffix.toLowerCase())) {
    return [
      word.slice(0, word.length - suffix.length),
      word.slice(word.length - suffix.length),
    ];
  }
  return [word, ''];
}

/**
 * Tutor reveal policy keyed to the within-mode support tier. The live tutor is a
 * SECOND scaffold channel, so its latitude must match what the screen withdrew:
 *  - easy   → may name the rhyme family and walk the student through the ending sound.
 *  - medium → the family highlight is off screen, so nudge by ear only; don't spell
 *             the rime out unless asked.
 *  - hard   → the screen shows no highlight, no instruction text and no read-out of
 *             the choices, so the tutor names the target + question ONLY.
 * At EVERY tier the tutor never says which word rhymes (that IS the answer).
 */
function tutorRevealPolicy(
  tier: 'easy' | 'medium' | 'hard' | undefined,
  mode: string,
): string {
  if (!tier) return '';
  if (tier === 'easy') {
    return `[SUPPORT_TIER easy] Full scaffolding: you may name the rhyme family and stretch the ending sound to help the student hear it. Still never say which word is the answer.`;
  }
  if (tier === 'medium') {
    return `[SUPPORT_TIER medium] Light scaffolding: the rhyme family is NOT highlighted on screen — guide by ear ("listen to how it ends"), don't spell out the rime unless the student is stuck, and never say which word is the answer.`;
  }
  return `[SUPPORT_TIER hard] Minimal scaffolding: the screen shows no rhyme-family highlight and no written question${mode === 'recognition' ? '' : ', and you must NOT read the answer choices aloud'}. Say only the target word and the question, then wait. Never name the rhyme family and never say which word is the answer.`;
}

// ============================================================================
// Component
// ============================================================================

const RhymeStudio: React.FC<RhymeStudioProps> = ({ data, className }) => {
  const {
    title,
    gradeLevel,
    supportTier,
    challenges = [],
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // ── Reading band ─────────────────────────────────────────────────
  // At PRE (Kindergarten) the child cannot read any word on screen: pictures +
  // audio carry the task, chrome is hidden, and feedback lands on the object.
  const isPreReader = isPreReaderGrade(gradeLevel);

  // ── Activity gate — student must click Start ─────────────────────
  const [hasStarted, setHasStarted] = useState(false);

  // ── Interaction state ─────────────────────────────────────────────
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | ''>('');
  const [showResult, setShowResult] = useState(false);
  const [isCelebrating, setIsCelebrating] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  // Rhyming words the student said ALOUD (judge-confirmed) — the culminating
  // production beat in production mode. Tracked by challenge id, cumulative.
  const [spokenWords, setSpokenWords] = useState<Set<string>>(new Set());
  const diagnosisObservationsRef = useRef<Array<{
    challenge: string; expected: string; observed: string; judgeFeedback?: string;
  }>>([]);

  // ── Timing ────────────────────────────────────────────────────────
  const startTimeRef = useRef(Date.now());

  // ── Instance ID ───────────────────────────────────────────────────
  const stableInstanceIdRef = useRef(instanceId || `rhyme-studio-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // ── Shared challenge progress hook ────────────────────────────────
  const {
    currentIndex,
    currentAttempts,
    results: challengeResults,
    isComplete: allChallengesComplete,
    recordResult,
    incrementAttempts,
    advance: advanceProgress,
  } = useChallengeProgress({ challenges, getChallengeId: (ch) => ch.id });

  const phaseResults = usePhaseResults({
    challenges,
    results: challengeResults,
    isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.mode,
    phaseConfig: PHASE_TYPE_CONFIG,
  });

  // ── Evaluation ────────────────────────────────────────────────────
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
  } = usePrimitiveEvaluation<RhymeStudioMetrics>({
    primitiveType: 'rhyme-studio',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const [submittedScore, setSubmittedScore] = useState<number | null>(null);

  const currentChallenge = challenges[currentIndex];
  const previousModeRef = useRef<string | null>(null);

  // ── Support-tier scaffolds (read with `!== false` so an ABSENT field is the
  //    legacy full-help render). Band supports compose and always WIN: at PRE the
  //    picture surface and the tutor's word read-aloud can never be withdrawn. ──
  const showRhymeFamilyHighlight = currentChallenge?.showRhymeFamilyHighlight !== false;
  const showInstructionText = currentChallenge?.showInstructionText !== false;
  const showWordImage = isPreReader || currentChallenge?.showWordImage !== false;
  const tutorNamesOptions = isPreReader || currentChallenge?.tutorNamesOptions !== false;

  // ── Shuffled identification options ──────────────────────────────
  // Memoised per challenge so it doesn't re-shuffle on every render.
  const shuffledIdentificationOptions = useMemo(() => {
    if (!currentChallenge?.options || currentChallenge.mode !== 'identification') return [];
    return [...currentChallenge.options].sort(() => Math.random() - 0.5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  // ── Production word bank (acceptable answers + distractors) ───────
  // Memoised per challenge so it doesn't re-shuffle on every render.
  const productionWordBank = useMemo(() => {
    if (!currentChallenge || currentChallenge.mode !== 'production') return [];

    const suffix = currentChallenge.rhymeFamily.startsWith('-')
      ? currentChallenge.rhymeFamily.slice(1).toLowerCase()
      : currentChallenge.rhymeFamily.toLowerCase();
    const target = currentChallenge.targetWord.toLowerCase();

    // #5 answer-form lever: how many of the 4 bank tiles are correct rhymes.
    // Absent ⇒ 2 (legacy: 2 correct + 2 distractors). hard ⇒ 1 correct + 3
    // distractors — same bank size, same acceptableAnswers data, a correct tile is
    // ALWAYS present; only the chance of a lucky tap drops.
    const correctTake = Math.max(1, currentChallenge.productionCorrectCount ?? 2);
    const distractorTake = Math.max(0, PRODUCTION_BANK_SIZE - correctTake);

    // Pick the distractors that don't rhyme with the target
    const distractors = DISTRACTOR_POOL
      .filter(w => !w.endsWith(suffix) && w !== target)
      .sort(() => Math.random() - 0.5)
      .slice(0, distractorTake);

    // Take the acceptable answers that will be shown as correct tiles
    const correct = (currentChallenge.acceptableAnswers ?? []).slice(0, correctTake);

    // Combine and shuffle
    const combined = [
      ...correct.map(w => ({ word: w, isCorrect: true })),
      ...distractors.map(w => ({ word: w, isCorrect: false })),
    ].sort(() => Math.random() - 0.5);

    return combined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  // Spoken option words for the current challenge — forwarded into the tutor bag
  // so the CATALOG read-aloud directive can name every choice on primitive switch
  // (durable, survives the lesson one-sentence cap). Component sendText moments
  // still inject the same words as reinforcement.
  const currentOptionWords = useMemo(() => {
    if (!currentChallenge) return '';
    // #2 instruction lever: at hard the tutor names the target + question only, so
    // the durable catalog read-aloud channel gets no choice list either. Forced on
    // at PRE (see tutorNamesOptions) — a non-reader has no other way in.
    if (!tutorNamesOptions) return '';
    if (currentChallenge.mode === 'identification') {
      return shuffledIdentificationOptions.map(o => o.word).join(', ');
    }
    if (currentChallenge.mode === 'production') {
      return productionWordBank.map(o => o.word).join(', ');
    }
    return '';
  }, [currentChallenge, tutorNamesOptions, shuffledIdentificationOptions, productionWordBank]);

  // ── AI Tutoring integration ───────────────────────────────────────
  const aiPrimitiveData = useMemo(() => ({
    challengeMode: currentChallenge?.mode ?? '',
    targetWord: currentChallenge?.targetWord ?? '',
    rhymeFamily: currentChallenge?.rhymeFamily ?? '',
    comparisonWord: currentChallenge?.comparisonWord ?? '',
    optionWords: currentOptionWords,
    currentChallenge: currentIndex + 1,
    totalChallenges: challenges.length,
    currentPhase: currentChallenge?.mode ?? '',
    attempts: currentAttempts,
    supportTier: supportTier ?? null,
  }), [currentChallenge, currentOptionWords, currentIndex, challenges.length, currentAttempts, supportTier]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'rhyme-studio',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel,
  });

  // ── Activity introduction — fire once when connected ──────────────
  const hasIntroducedRef = useRef(false);

  useEffect(() => {
    if (!hasStarted || !isConnected || hasIntroducedRef.current || !currentChallenge) return;
    hasIntroducedRef.current = true;

    // Build mode-specific context so the AI knows the exact words for challenge 1.
    // The two recognition words are the STIMULUS (never withdrawn); only the
    // enumeration of the answer CHOICES is tier-gated.
    let firstChallengeWords = '';
    if (currentChallenge.mode === 'recognition') {
      firstChallengeWords =
        `Say both words clearly: "${currentChallenge.targetWord}" and "${currentChallenge.comparisonWord}". `
        + `Then ask "Do these words rhyme?" Do NOT reveal the answer.`;
    } else if (currentChallenge.mode === 'identification') {
      const optionWords = shuffledIdentificationOptions.map(o => o.word).join(', ');
      firstChallengeWords = tutorNamesOptions
        ? `Say the target word "${currentChallenge.targetWord}" and the options: ${optionWords}. `
          + `Ask "Which word rhymes with ${currentChallenge.targetWord}?"`
        : `Say ONLY the target word "${currentChallenge.targetWord}" and ask `
          + `"Which word rhymes with ${currentChallenge.targetWord}?" Do NOT read the answer choices aloud — the student reads them.`;
    } else {
      const bankWords = productionWordBank.map(o => o.word).join(', ');
      firstChallengeWords = tutorNamesOptions
        ? `Say the target word "${currentChallenge.targetWord}" and the options: ${bankWords}. `
          + `Ask "Which of these words rhymes with ${currentChallenge.targetWord}?"`
        : `Say ONLY the target word "${currentChallenge.targetWord}" and ask `
          + `"Which of these words rhymes with ${currentChallenge.targetWord}?" Do NOT read the word bank aloud — the student reads it.`;
    }

    const policy = tutorRevealPolicy(supportTier, currentChallenge.mode);
    sendText(
      `[ACTIVITY_START] This is a rhyming activity for Grade ${gradeLevel}. `
      + `There are ${challenges.length} challenges. `
      + `Warmly introduce the activity (1-2 sentences), then: ${firstChallengeWords}`
      + (policy ? ` ${policy}` : ''),
      { silent: true },
    );
  }, [hasStarted, isConnected, currentChallenge, gradeLevel, challenges.length, sendText, shuffledIdentificationOptions, productionWordBank, tutorNamesOptions, supportTier]);

  // ── Phase transition detection ────────────────────────────────────
  useEffect(() => {
    if (!currentChallenge) return;
    const prevMode = previousModeRef.current;
    if (prevMode && prevMode !== currentChallenge.mode) {
      sendText(
        `[PHASE_TRANSITION] Moving from ${MODE_LABELS[prevMode]} to ${MODE_LABELS[currentChallenge.mode]} mode. `
        + `Briefly explain what's coming: ${MODE_DESCRIPTIONS[currentChallenge.mode]}`,
        { silent: true },
      );
    }
    previousModeRef.current = currentChallenge.mode;
  }, [currentChallenge, sendText]);

  // ── Pronounce words when challenge changes ────────────────────────
  useEffect(() => {
    if (!currentChallenge || !isConnected || !hasIntroducedRef.current) return;
    if (currentIndex === 0) return; // First challenge handled by ACTIVITY_START

    const policy = tutorRevealPolicy(supportTier, currentChallenge.mode);
    const withPolicy = (msg: string) => (policy ? `${msg} ${policy}` : msg);

    if (currentChallenge.mode === 'recognition') {
      sendText(
        withPolicy(
          `[PRONOUNCE_WORDS] Say "${currentChallenge.targetWord}" and "${currentChallenge.comparisonWord}". `
          + `Then ask "Do these words rhyme?"`,
        ),
        { silent: true },
      );
    } else if (currentChallenge.mode === 'identification') {
      const optionWords = shuffledIdentificationOptions.map(o => o.word).join(', ');
      sendText(
        withPolicy(
          tutorNamesOptions
            ? `[PRONOUNCE_WORDS] Say "${currentChallenge.targetWord}" and ask "Which word rhymes with ${currentChallenge.targetWord}?" `
              + `Then say each option: ${optionWords}.`
            : `[PRONOUNCE_WORDS] Say ONLY "${currentChallenge.targetWord}" and ask "Which word rhymes with ${currentChallenge.targetWord}?" `
              + `Do NOT read the answer choices aloud — the student reads them.`,
        ),
        { silent: true },
      );
    } else {
      const bankWords = productionWordBank.map(o => o.word).join(', ');
      sendText(
        withPolicy(
          tutorNamesOptions
            ? `[PRONOUNCE_WORDS] Say "${currentChallenge.targetWord}" and ask "Which of these words rhymes with ${currentChallenge.targetWord}?" `
              + `Then say each option: ${bankWords}.`
            : `[PRONOUNCE_WORDS] Say ONLY "${currentChallenge.targetWord}" and ask "Which of these words rhymes with ${currentChallenge.targetWord}?" `
              + `Do NOT read the word bank aloud — the student reads it.`,
        ),
        { silent: true },
      );
    }
  }, [currentIndex, currentChallenge, isConnected, sendText, productionWordBank, shuffledIdentificationOptions, tutorNamesOptions, supportTier]);

  // ── Reset interaction state when challenge advances ───────────────
  useEffect(() => {
    setSelectedOption(null);
    setFeedback('');
    setFeedbackType('');
    setShowResult(false);
    setIsCelebrating(false);
    setIsShaking(false);
  }, [currentIndex]);

  // ── Compute per-mode accuracy from results ────────────────────────
  const computeAccuracies = useCallback(() => {
    const byMode: Record<string, { correct: number; total: number }> = {
      recognition: { correct: 0, total: 0 },
      identification: { correct: 0, total: 0 },
      production: { correct: 0, total: 0 },
    };
    for (const ch of challenges) {
      const result = challengeResults.find(r => r.challengeId === ch.id);
      if (result) {
        byMode[ch.mode].total++;
        if (result.correct) byMode[ch.mode].correct++;
      }
    }
    return {
      recognitionAccuracy: byMode.recognition.total > 0
        ? Math.round((byMode.recognition.correct / byMode.recognition.total) * 100)
        : 0,
      identificationAccuracy: byMode.identification.total > 0
        ? Math.round((byMode.identification.correct / byMode.identification.total) * 100)
        : 0,
      productionAccuracy: byMode.production.total > 0
        ? Math.round((byMode.production.correct / byMode.production.total) * 100)
        : 0,
    };
  }, [challenges, challengeResults]);

  // ── Submit final evaluation ───────────────────────────────────────
  const submitFinalEvaluation = useCallback(() => {
    if (hasSubmittedEvaluation) return;

    const correctCount = challengeResults.filter(r => r.correct).length;
    const totalCount = challenges.length;
    const overallPct = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
    const totalAttempts = challengeResults.reduce((sum, r) => sum + r.attempts, 0);
    const elapsed = Date.now() - startTimeRef.current;
    const accs = computeAccuracies();
    const rhymeFamilies = Array.from(new Set(challenges.map(ch => ch.rhymeFamily)));

    const metrics: RhymeStudioMetrics = {
      type: 'rhyme-studio',
      challengeMode: currentChallenge?.mode ?? 'recognition',
      challengesCorrect: correctCount,
      challengesTotal: totalCount,
      recognitionAccuracy: accs.recognitionAccuracy,
      identificationAccuracy: accs.identificationAccuracy,
      productionAccuracy: accs.productionAccuracy,
      rhymeFamiliesPracticed: rhymeFamilies,
      attemptsCount: totalAttempts,
    };

    setSubmittedScore(overallPct);
    const observations = diagnosisObservationsRef.current;
    const judgeBacked = [...observations].reverse().find(item => item.judgeFeedback);
    const source = judgeBacked || observations[observations.length - 1];
    const diagnosisEvidence: DiagnosisEvidence | undefined = overallPct < 60 && source ? {
      challengeSummary: source.challenge,
      expected: source.expected,
      observed: source.observed,
      judgeFeedback: judgeBacked?.judgeFeedback,
      priorAttempts: observations.filter(item => item !== source).slice(-4)
        .map(item => ({ challenge: item.challenge, observed: item.observed })),
    } : undefined;
    submitEvaluation(
      overallPct >= 60,
      overallPct,
      metrics,
      { durationMs: elapsed, challengeResults, spokenWords: Array.from(spokenWords) },
      undefined,
      diagnosisEvidence,
    );

    // AI celebration
    const phaseScoreStr = phaseResults.map(
      p => `${p.label} ${p.score}% (${p.attempts} attempts)`,
    ).join(', ');
    sendText(
      `[SESSION_COMPLETE] All ${totalCount} challenges done! Phase scores: ${phaseScoreStr}. Overall: ${overallPct}%. `
      + `Rhyme families practiced: ${rhymeFamilies.join(', ')}. `
      + `Celebrate the full session and summarize what patterns were practiced.`,
      { silent: true },
    );
  }, [
    hasSubmittedEvaluation, challengeResults, challenges, currentChallenge,
    computeAccuracies, phaseResults, submitEvaluation, sendText, spokenWords,
  ]);

  // ── Handle recognition answer (Yes / No) ──────────────────────────
  const handleRecognition = useCallback((answer: boolean) => {
    if (showResult || !currentChallenge) return;

    incrementAttempts();
    const isCorrect = answer === currentChallenge.doesRhyme;

    if (isCorrect) {
      SoundManager.playCorrect();
      const msg = currentChallenge.doesRhyme
        ? `Yes! "${currentChallenge.targetWord}" and "${currentChallenge.comparisonWord}" both end in ${currentChallenge.rhymeFamily}!`
        : `Correct! "${currentChallenge.targetWord}" and "${currentChallenge.comparisonWord}" do NOT rhyme.`;
      setFeedback(msg);
      setFeedbackType('success');
      setShowResult(true);
      setIsCelebrating(true);
      setTimeout(() => setIsCelebrating(false), 1500);

      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: currentAttempts + 1,
      });

      sendText(
        `[ANSWER_CORRECT] Student correctly answered ${answer ? 'YES' : 'NO'} for `
        + `"${currentChallenge.targetWord}" and "${currentChallenge.comparisonWord}" `
        + `(rhyme family: ${currentChallenge.rhymeFamily}). Brief celebration — emphasize the rhyme pattern.`,
        { silent: true },
      );
    } else {
      diagnosisObservationsRef.current.push({
        challenge: `Decide whether "${currentChallenge.targetWord}" and "${currentChallenge.comparisonWord}" rhyme.`,
        expected: `Answer ${currentChallenge.doesRhyme ? 'yes' : 'no'} based on the ending sound.`,
        observed: `Answered ${answer ? 'yes' : 'no'}.`,
      });
      SoundManager.playIncorrect();
      setFeedback('Not quite — listen to the ending sounds...');
      setFeedbackType('error');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);

      sendText(
        `[ANSWER_INCORRECT] Student answered ${answer ? 'YES' : 'NO'} but correct was `
        + `${currentChallenge.doesRhyme ? 'YES' : 'NO'} for "${currentChallenge.targetWord}" and `
        + `"${currentChallenge.comparisonWord}". Attempt ${currentAttempts + 1}. Give a gentle hint.`,
        { silent: true },
      );

      // After max attempts, show the answer and move on
      if (currentAttempts + 1 >= MAX_ATTEMPTS) {
        setTimeout(() => {
          setShowResult(true);
          setFeedback(
            currentChallenge.doesRhyme
              ? `They DO rhyme! Both end in ${currentChallenge.rhymeFamily}.`
              : `They do NOT rhyme. "${currentChallenge.targetWord}" ends in ${currentChallenge.rhymeFamily}.`,
          );
          setFeedbackType('success');
          recordResult({
            challengeId: currentChallenge.id,
            correct: false,
            attempts: currentAttempts + 1,
          });
        }, 1000);
      }
    }
  }, [showResult, currentChallenge, currentAttempts, incrementAttempts, recordResult, sendText]);

  // ── Handle identification answer (tap an option) ──────────────────
  const handleIdentification = useCallback((optionIndex: number) => {
    if (showResult || !shuffledIdentificationOptions.length) return;

    setSelectedOption(optionIndex);
    incrementAttempts();
    const option = shuffledIdentificationOptions[optionIndex];
    const isCorrect = option.isCorrect;

    if (isCorrect) {
      SoundManager.playCorrect();
      setFeedback(
        `Yes! "${option.word}" rhymes with "${currentChallenge.targetWord}" `
        + `— they both end in ${currentChallenge.rhymeFamily}!`,
      );
      setFeedbackType('success');
      setShowResult(true);
      setIsCelebrating(true);
      setTimeout(() => setIsCelebrating(false), 1500);

      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: currentAttempts + 1,
      });

      sendText(
        `[ANSWER_CORRECT] Student picked "${option.word}" which rhymes with "${currentChallenge.targetWord}" `
        + `(${currentChallenge.rhymeFamily}). Brief celebration — emphasize the shared ending.`,
        { silent: true },
      );
    } else {
      diagnosisObservationsRef.current.push({
        challenge: `Choose a word that rhymes with "${currentChallenge.targetWord}".`,
        expected: `Choose the option ending in ${currentChallenge.rhymeFamily}.`,
        observed: `Chose "${option.word}".`,
      });
      SoundManager.playIncorrect();
      setFeedback(`"${option.word}" doesn't end with ${currentChallenge.rhymeFamily}. Try again!`);
      setFeedbackType('error');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      setSelectedOption(null);

      sendText(
        `[ANSWER_INCORRECT] Student picked "${option.word}" but it doesn't rhyme with "${currentChallenge.targetWord}" `
        + `(${currentChallenge.rhymeFamily}). Attempt ${currentAttempts + 1}. Hint about the ending sound.`,
        { silent: true },
      );

      if (currentAttempts + 1 >= MAX_ATTEMPTS) {
        const correct = shuffledIdentificationOptions.find(o => o.isCorrect);
        setTimeout(() => {
          setShowResult(true);
          setFeedback(
            `The answer is "${correct?.word}" — it ends in ${currentChallenge.rhymeFamily} `
            + `like "${currentChallenge.targetWord}"!`,
          );
          setFeedbackType('success');
          recordResult({
            challengeId: currentChallenge.id,
            correct: false,
            attempts: currentAttempts + 1,
          });
        }, 1000);
      }
    }
  }, [showResult, currentChallenge, currentAttempts, incrementAttempts, recordResult, sendText, shuffledIdentificationOptions]);

  // ── Handle production answer (tap a word card) ─────────────────────
  const handleProductionSelect = useCallback((word: string, isCorrect: boolean, optionIndex: number) => {
    if (showResult || !currentChallenge) return;

    setSelectedOption(optionIndex);
    incrementAttempts();

    if (isCorrect) {
      SoundManager.playCorrect();
      setFeedback(
        `Great! "${word}" rhymes with "${currentChallenge.targetWord}" `
        + `— they both end in ${currentChallenge.rhymeFamily}!`,
      );
      setFeedbackType('success');
      setShowResult(true);
      setIsCelebrating(true);
      setTimeout(() => setIsCelebrating(false), 1500);

      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: currentAttempts + 1,
      });

      sendText(
        `[ANSWER_CORRECT] Student picked "${word}" which rhymes with `
        + `"${currentChallenge.targetWord}" (${currentChallenge.rhymeFamily}). Celebrate and emphasize the pattern!`,
        { silent: true },
      );
    } else {
      diagnosisObservationsRef.current.push({
        challenge: `Produce a word that rhymes with "${currentChallenge.targetWord}".`,
        expected: `Choose or say a word ending in ${currentChallenge.rhymeFamily}.`,
        observed: `Chose "${word}".`,
      });
      SoundManager.playIncorrect();
      setFeedback(
        `"${word}" doesn't end with ${currentChallenge.rhymeFamily}. `
        + `Think about the ending sound...`,
      );
      setFeedbackType('error');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      setSelectedOption(null);

      sendText(
        `[ANSWER_INCORRECT] Student picked "${word}" but it doesn't rhyme with `
        + `"${currentChallenge.targetWord}" (${currentChallenge.rhymeFamily}). `
        + `Attempt ${currentAttempts + 1}. Hint about the ${currentChallenge.rhymeFamily} family.`,
        { silent: true },
      );

      if (currentAttempts + 1 >= MAX_ATTEMPTS) {
        const examples = currentChallenge.acceptableAnswers?.slice(0, 2).join(', ') ?? '';
        setTimeout(() => {
          setShowResult(true);
          setFeedback(`Words that rhyme: ${examples}. They all end in ${currentChallenge.rhymeFamily}!`);
          setFeedbackType('success');
          recordResult({
            challengeId: currentChallenge.id,
            correct: false,
            attempts: currentAttempts + 1,
          });
        }, 1000);
      }
    }
  }, [showResult, currentChallenge, currentAttempts, incrementAttempts, recordResult, sendText]);

  // ── Spoken production beat (production mode only) ─────────────────
  // Production mode's word-bank tap merely reports a rhyme the student already
  // found. Once the challenge is resolved, the mic turns that into real oral
  // production: the student SAYS the rhyming word aloud, and the judge ladder
  // (Azure dual-signal → Gemini, utils/spokenWordJudge.ts) confirms it. Purely
  // additive — the beat only appears after showResult, the Skip/Next path is
  // always reachable, and a 'no-match' is never scored against the student.
  //   'match'   → celebrate + track (bonus production credit)
  //   'no-match'→ tutor models the rhyme by voice, NO penalty
  //   'unclear' → invite a retry, silently
  const spokenTargetWord = useMemo(() => {
    if (!currentChallenge || currentChallenge.mode !== 'production') return '';
    // Prefer the exact word the student picked when it was correct; otherwise
    // (max-attempts reveal) fall back to a canonical acceptable rhyme.
    if (selectedOption !== null && productionWordBank[selectedOption]?.isCorrect) {
      return productionWordBank[selectedOption].word;
    }
    return currentChallenge.acceptableAnswers?.[0] ?? '';
  }, [currentChallenge, selectedOption, productionWordBank]);

  const handleSpokenResult = useCallback((result: SpokenJudgeResult) => {
    if (!currentChallenge || currentChallenge.mode !== 'production') return;
    if (!spokenTargetWord || spokenWords.has(currentChallenge.id)) return;

    if (result.outcome === 'match') {
      SoundManager.playCorrect();
      setSpokenWords(prev => new Set(Array.from(prev).concat(currentChallenge.id)));
      sendText(
        `[STUDENT_SAID_RHYME] The student said the rhyming word "${spokenTargetWord}" out loud all by themselves! `
        + `It rhymes with "${currentChallenge.targetWord}" — both end in ${currentChallenge.rhymeFamily}. `
        + `Celebrate enthusiastically that they SAID a rhyme (one sentence).`,
        { silent: true },
      );
    } else if (result.outcome === 'no-match' && result.verdict?.heard) {
      diagnosisObservationsRef.current.push({
        challenge: `Say the selected rhyming word aloud.`,
        expected: `Say the whole word "${spokenTargetWord}".`,
        observed: `Judge heard "${result.verdict.heard}".`,
        judgeFeedback: result.verdict.misconception
          || `The spoken-word judge heard "${result.verdict.heard}" instead of the selected rhyme and rated the mismatch high confidence.`,
      });
      sendText(
        `[SPOKEN_MISS] The student tried to say "${spokenTargetWord}" aloud but it sounded like "${result.verdict.heard}". `
        + `Gently model it — say "${spokenTargetWord}" and stretch the ${currentChallenge.rhymeFamily} ending — then invite one more try. `
        + `Warm, never scolding. Two short sentences max.`,
        { silent: true },
      );
    } else {
      sendText(
        `[SPOKEN_UNCLEAR] The microphone didn't catch it. One friendly sentence: invite them to say "${spokenTargetWord}" `
        + `again a little louder, or just tap Next.`,
        { silent: true },
      );
    }
  }, [currentChallenge, spokenTargetWord, spokenWords, sendText]);

  const spokenCapture = useSpokenWordCapture({
    targetWord: spokenTargetWord,
    gradeLevel,
    onResult: handleSpokenResult,
    onNoSpeech: () => {
      if (!currentChallenge || spokenWords.has(currentChallenge.id)) return;
      sendText(
        `[SPOKEN_UNCLEAR] The microphone didn't hear the student. One friendly sentence: invite them to say `
        + `"${spokenTargetWord}" again a little louder, or just tap Next.`,
        { silent: true },
      );
    },
  });

  // ── Advance to next challenge ─────────────────────────────────────
  const handleNext = useCallback(() => {
    spokenCapture.cancel(); // never carry a live mic across challenges
    if (!advanceProgress()) {
      // All challenges done — submit evaluation and show summary
      submitFinalEvaluation();
      setShowSummary(true);
      return;
    }
    sendText(
      `[NEXT_CHALLENGE] Moving to challenge ${currentIndex + 2} of ${challenges.length}.`,
      { silent: true },
    );
  }, [advanceProgress, currentIndex, challenges.length, sendText, submitFinalEvaluation, spokenCapture]);

  // Strong-flow UX: once the student says a rhyme aloud (judge-confirmed), glide
  // to the next challenge on their behalf — no extra click. The mic itself stays
  // tap-to-start (push-to-talk is the echo gate against the tutor's voice); only
  // the advance is automatic — auto-advance yes, auto-listen no.
  const handleNextRef = useRef(handleNext);
  handleNextRef.current = handleNext;
  useEffect(() => {
    if (!currentChallenge || currentChallenge.mode !== 'production') return;
    if (!spokenWords.has(currentChallenge.id)) return;
    const t = setTimeout(() => handleNextRef.current(), 1400);
    return () => clearTimeout(t);
  }, [spokenWords, currentChallenge]);

  // ── Render: word card with rhyme-family highlighting ──────────────
  // INTERACTION SURFACE (painting): the rhyme tile that visually splits the
  // word into prefix + highlighted rhyme-family suffix. Bespoke by design.
  const renderWordCard = (
    word: string,
    rhymeFamily: string,
    imageDesc: string,
    extraClasses?: string,
    emoji?: string,
  ) => {
    // PRE (pre-reader): the PICTURE is the primary mark — a big depicting emoji —
    // with the word only a small caption (spoken by the tutor). No amber
    // rhyme-family text emphasis (a non-reader can't use it) and no prose
    // "image description" (unreadable text). Reader grades keep the word-primary
    // card with the highlighted rhyme suffix.
    if (isPreReader) {
      return (
        <div
          className={`rounded-2xl bg-white/5 border border-white/10 p-6 text-center space-y-1 transition-all duration-300 ${extraClasses || ''}`}
        >
          <div className="text-6xl leading-none" role="img" aria-label={imageDesc || word}>
            {emoji || '⭐'}
          </div>
          <div className="text-lg font-semibold text-slate-300">{word}</div>
        </div>
      );
    }

    const [prefix, suffix] = splitByRhymeFamily(word, rhymeFamily);
    return (
      <div
        className={`rounded-2xl bg-white/5 border border-white/10 p-6 text-center space-y-2 transition-all duration-300 ${extraClasses || ''}`}
      >
        <div className="text-3xl font-bold text-slate-100">
          {suffix ? (
            <>
              <span>{prefix}</span>
              <span className="text-amber-300">{suffix}</span>
            </>
          ) : (
            <span>{word}</span>
          )}
        </div>
        {imageDesc && (
          <p className="text-sm text-slate-500 italic">{imageDesc}</p>
        )}
      </div>
    );
  };

  // ── Render: Recognition mode ──────────────────────────────────────
  const renderRecognitionMode = () => {
    if (!currentChallenge) return null;
    return (
      <div className="space-y-4">
        {/* ANSWER-LEAK GUARD (recognition): the amber rime highlight used to be
            painted on the comparison card ONLY when doesRhyme was true, so the
            highlight WAS the yes/no answer. Recognition therefore shows NO rime
            highlight on either card before the student answers; after the challenge
            resolves the rime is revealed as feedback (target always, comparison only
            when the pair really rhymes) — that is the teaching moment. */}
        <div className="grid grid-cols-2 gap-4">
          {renderWordCard(
            currentChallenge.targetWord,
            showResult ? currentChallenge.rhymeFamily : '',
            showWordImage ? currentChallenge.targetWordImage : '',
            isCelebrating ? 'ring-2 ring-emerald-500/50' : '',
            currentChallenge.targetWordEmoji,
          )}
          {currentChallenge.comparisonWord && renderWordCard(
            currentChallenge.comparisonWord,
            showResult && currentChallenge.doesRhyme ? currentChallenge.rhymeFamily : '',
            showWordImage ? (currentChallenge.comparisonWordImage ?? '') : '',
            isCelebrating ? 'ring-2 ring-emerald-500/50' : '',
            currentChallenge.comparisonWordEmoji,
          )}
        </div>

        {/* The question is spoken by the tutor at PRE (audio is the instruction
            channel); a non-reader cannot use the on-screen sentence. At the hard
            support tier the restatement is withdrawn for readers too — the tutor
            still asks it aloud, so the task is never lost. */}
        {!isPreReader && showInstructionText && (
          <p className="text-center text-lg text-slate-300 font-medium">
            Do these words rhyme?
          </p>
        )}

        {/* Recognition answer buttons — the binary YES/NO interaction surface.
            At PRE the mark is a big 👍 / 👎 icon (word a small caption) so a
            non-reader can answer by picture. Semantic green=rhyme / rose=no. */}
        {!showResult && (
          <div className={`flex justify-center gap-4 ${isShaking ? 'animate-shake' : ''}`}>
            <button
              onClick={() => handleRecognition(true)}
              aria-label="Yes, they rhyme"
              className="rounded-xl bg-emerald-500/20 border border-emerald-500/40 hover:bg-emerald-500/30 text-emerald-300 px-8 py-3 text-lg font-medium transition-colors"
            >
              {isPreReader ? (
                <span className="flex flex-col items-center gap-0.5">
                  <span className="text-3xl leading-none" role="img" aria-hidden="true">👍</span>
                  <span className="text-xs">Yes</span>
                </span>
              ) : 'Yes!'}
            </button>
            <button
              onClick={() => handleRecognition(false)}
              aria-label="No, they do not rhyme"
              className="rounded-xl bg-rose-500/20 border border-rose-500/40 hover:bg-rose-500/30 text-rose-300 px-8 py-3 text-lg font-medium transition-colors"
            >
              {isPreReader ? (
                <span className="flex flex-col items-center gap-0.5">
                  <span className="text-3xl leading-none" role="img" aria-hidden="true">👎</span>
                  <span className="text-xs">No</span>
                </span>
              ) : 'No'}
            </button>
          </div>
        )}
      </div>
    );
  };

  // ── Render: Identification mode ───────────────────────────────────
  const renderIdentificationMode = () => {
    if (!shuffledIdentificationOptions.length) return null;
    const optionCount = shuffledIdentificationOptions.length;
    const gridClass = optionCount <= 2 ? 'grid-cols-2' : 'grid-cols-3';

    return (
      <div className="space-y-4">
        {/* #1 perception lever: the target card's amber rime highlight is the
            strongest visual cue — withdrawn at medium/hard, revealed on resolution. */}
        {renderWordCard(
          currentChallenge.targetWord,
          showRhymeFamilyHighlight || showResult ? currentChallenge.rhymeFamily : '',
          showWordImage ? currentChallenge.targetWordImage : '',
          undefined,
          currentChallenge.targetWordEmoji,
        )}

        {/* Question spoken by the tutor at PRE (audio is the instruction channel);
            also withdrawn at the hard support tier (the tutor still asks it). */}
        {!isPreReader && showInstructionText && (
          <p className="text-center text-lg text-slate-300 font-medium">
            Which word rhymes with{' '}
            <span className="text-amber-300">{currentChallenge.targetWord}</span>?
          </p>
        )}

        {/* Rhyme word tiles — bespoke interaction surface; grading colors
            come from the shared answerStateClasses token. At PRE the option's
            PICTURE (emoji) is primary and the word is a small caption. */}
        <div className={`grid ${gridClass} gap-3 ${isShaking ? 'animate-shake' : ''}`}>
          {shuffledIdentificationOptions.map((option, idx) => {
            const isCorrectOption = showResult && option.isCorrect;
            const state = isCorrectOption
              ? 'correct'
              : showResult && selectedOption === idx && !option.isCorrect
                ? 'incorrect'
                : 'idle';
            return (
              <button
                key={idx}
                onClick={() => !showResult && handleIdentification(idx)}
                disabled={showResult}
                aria-label={isPreReader ? option.word : (option.image || option.word)}
                className={`
                  rounded-xl border-2 p-4 text-center transition-all duration-200 cursor-pointer
                  ${answerStateClasses[state]}
                  ${isCelebrating && isCorrectOption ? 'animate-bounce' : ''}
                `}
              >
                {isPreReader ? (
                  <>
                    <span className="text-5xl leading-none block" role="img" aria-hidden="true">
                      {option.image || '⭐'}
                    </span>
                    <span className="text-sm font-semibold text-slate-300 mt-1 block">{option.word}</span>
                  </>
                ) : (
                  <>
                    <span className="text-2xl font-bold block">{option.word}</span>
                    {option.image && showWordImage && (
                      <span className="text-xs text-slate-500 mt-1 block">{option.image}</span>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // ── Render: Production mode (word bank — no typing) ─────────────────
  const renderProductionMode = () => {
    if (!currentChallenge) return null;
    const gridClass = productionWordBank.length <= 3 ? 'grid-cols-3' : 'grid-cols-2';

    return (
      <div className="space-y-4">
        {renderWordCard(
          currentChallenge.targetWord,
          showRhymeFamilyHighlight || showResult ? currentChallenge.rhymeFamily : '',
          showWordImage ? currentChallenge.targetWordImage : '',
          undefined,
          currentChallenge.targetWordEmoji,
        )}

        {/* Task restatement — band-gated like the other two modes (a non-reader
            cannot use it; the tutor voices it) and withdrawn at the hard tier. */}
        {!isPreReader && showInstructionText && (
          <p className="text-center text-lg text-slate-300 font-medium">
            Pick a word that rhymes with{' '}
            <span className="text-amber-300">{currentChallenge.targetWord}</span>
          </p>
        )}

        {/* Rhyme word tiles — bespoke interaction surface; grading colors
            come from the shared answerStateClasses token. */}
        <div className={`grid ${gridClass} gap-3 ${isShaking ? 'animate-shake' : ''}`}>
          {productionWordBank.map((option, idx) => {
            const isCorrectOption = showResult && option.isCorrect;
            const state = isCorrectOption
              ? 'correct'
              : showResult && selectedOption === idx && !option.isCorrect
                ? 'incorrect'
                : 'idle';
            return (
              <button
                key={idx}
                onClick={() => !showResult && handleProductionSelect(option.word, option.isCorrect, idx)}
                disabled={showResult}
                className={`
                  rounded-xl border-2 p-4 text-center transition-all duration-200 cursor-pointer
                  ${answerStateClasses[state]}
                  ${isCelebrating && isCorrectOption ? 'animate-bounce' : ''}
                `}
              >
                <span className="text-2xl font-bold block">{option.word}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // ============================================================================
  // Main Render
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

  // ── Start screen ────────────────────────────────────────────────
  if (!hasStarted) {
    const modes = Array.from(new Set(challenges.map(ch => ch.mode)));
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-8 flex flex-col items-center text-center space-y-5">
          <div className={isPreReader ? 'text-7xl' : 'text-4xl'}>🎵</div>
          {/* Title, grade badge, and the start-gate paragraph are adult chrome —
              hidden at PRE (band contract rule 7); the tutor greets by voice. */}
          {!isPreReader && (
            <>
              <LuminaCardTitle className="text-xl">{title}</LuminaCardTitle>
              <LuminaBadge className="text-xs">Grade {gradeLevel}</LuminaBadge>
              <p className="text-slate-400 text-sm max-w-sm">
                {challenges.length} challenges across{' '}
                {modes.map(m => MODE_LABELS[m]).join(', ')} modes.
                Listen carefully and find the rhyming words!
              </p>
            </>
          )}
          <LuminaActionButton
            action="next"
            onClick={() => {
              SoundManager.tap();
              startTimeRef.current = Date.now();
              setHasStarted(true);
            }}
          >
            {isPreReader ? '▶' : 'Start Activity'}
          </LuminaActionButton>
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  return (
    <LuminaCard className={className}>
      {/* Adult chrome (title, grade badge, mode badge) hidden at PRE — band
          contract rule 7; the tutor names the activity by voice. */}
      {!isPreReader && (
        <LuminaCardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
              <div className="flex items-center gap-2">
                <LuminaBadge className="text-xs">Grade {gradeLevel}</LuminaBadge>
              </div>
            </div>
            {currentChallenge && !showSummary && (
              <LuminaBadge accent={MODE_ACCENT[currentChallenge.mode]} className="text-xs">
                {MODE_ICONS[currentChallenge.mode]} {MODE_LABELS[currentChallenge.mode]}
              </LuminaBadge>
            )}
          </div>
        </LuminaCardHeader>
      )}

      <LuminaCardContent className="space-y-4">
        {/* Progress indicator — counter + score ledger + bar are adult chrome,
            hidden at PRE (band contract rule 7). */}
        {!showSummary && !isPreReader && (
          <>
            <div className="flex items-center justify-between text-sm">
              <LuminaChallengeCounter
                current={currentIndex + 1}
                total={challenges.length}
                className="text-slate-400"
              />
              <span className="text-slate-500 text-xs">
                {challengeResults.filter(r => r.correct).length} correct
              </span>
            </div>
            <LuminaProgress
              accent="purple"
              value={((showResult ? currentIndex + 1 : currentIndex) / challenges.length) * 100}
            />
          </>
        )}

        {/* Challenge content */}
        {!showSummary && currentChallenge && (
          <>
            {currentChallenge.mode === 'recognition' && renderRecognitionMode()}
            {currentChallenge.mode === 'identification' && renderIdentificationMode()}
            {currentChallenge.mode === 'production' && renderProductionMode()}
          </>
        )}

        {/* Feedback banner. Hidden at PRE — a non-reader can't read it; the
            card ring/shake, SoundManager tones, and the spoken tutor carry
            right/wrong on the object instead (band contract rule 5). */}
        {feedback && !showSummary && !isPreReader && (
          <LuminaFeedbackCard status={feedbackType === 'error' ? 'incorrect' : 'correct'}>
            {feedback}
          </LuminaFeedbackCard>
        )}

        {/* Resolved footer. Production mode gets the culminating say-it beat as
            the PRIMARY next step (auto-advances on a judged rhyme); recognition
            and identification keep the plain Next / Finish. The mic is always
            additive — a quiet Skip is always reachable and 'no-match' is never
            scored. When the mic isn't supported, production falls back to Next. */}
        {showResult && !showSummary && currentChallenge && (
          currentChallenge.mode === 'production' && spokenCapture.isSupported && spokenTargetWord ? (
            <div className="flex flex-col items-center gap-3">
              {spokenWords.has(currentChallenge.id) ? (
                // Said it → celebrate, then auto-glide to the next challenge (effect above)
                <div className="flex flex-col items-center gap-1">
                  <span className="text-emerald-300 text-base font-semibold">
                    🎉 You said “{spokenTargetWord}” out loud!
                  </span>
                  <span className="text-slate-500 text-xs">
                    {currentIndex < challenges.length - 1 ? 'Next challenge coming up…' : 'Wrapping up…'}
                  </span>
                </div>
              ) : (
                // Mic available → the say-a-rhyme beat is the PRIMARY next step
                <div className="flex flex-col items-center gap-3">
                  <p className="text-slate-300 text-sm font-medium">Your turn — say a rhyming word!</p>
                  <div className="flex items-center justify-center gap-3 flex-wrap min-h-[52px]">
                    <LuminaMicListener
                      state={spokenCapture.state}
                      level={spokenCapture.level}
                      isSupported={spokenCapture.isSupported}
                      onStart={() => void spokenCapture.start()}
                      onCancel={spokenCapture.cancel}
                      size="sm"
                      idleLabel={`Say “${spokenTargetWord}”!`}
                      listeningLabel={`Say “${spokenTargetWord}”!`}
                    />
                  </div>
                  {/* Quiet skip — never traps a student who can't or won't speak */}
                  {spokenCapture.state === 'idle' && (
                    <button
                      onClick={handleNext}
                      className="text-slate-500 text-xs hover:text-slate-300 transition-colors"
                    >
                      {currentIndex < challenges.length - 1 ? 'Skip →' : 'Skip to finish →'}
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex justify-center">
              <LuminaActionButton action="next" onClick={handleNext}>
                {isPreReader
                  ? (currentIndex < challenges.length - 1 ? '▶' : '🎉')
                  : (currentIndex < challenges.length - 1 ? 'Next Challenge' : 'Finish')}
              </LuminaActionButton>
            </div>
          )
        )}

        {/* Phase summary panel */}
        {showSummary && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedScore ?? undefined}
            durationMs={elapsedMs}
            heading="Rhyme Studio Complete!"
            celebrationMessage={`You practiced recognizing, identifying, and producing rhymes!${spokenWords.size > 0 ? ` You said ${spokenWords.size} rhyme${spokenWords.size === 1 ? '' : 's'} out loud — amazing!` : ''}`}
            className="mb-6"
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default RhymeStudio;
