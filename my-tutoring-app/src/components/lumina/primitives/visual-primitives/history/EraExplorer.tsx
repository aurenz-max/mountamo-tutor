'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  LuminaCard,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaCardContent,
  LuminaBadge,
  LuminaButton,
  LuminaPanel,
  LuminaSectionLabel,
  LuminaChallengeCounter,
  LuminaPrompt,
  LuminaAnswerChoice,
  LuminaFeedbackCard,
  LuminaActionButton,
  LuminaHintDisclosure,
  LuminaReadAloud,
  type AnswerChoiceState,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { EraExplorerMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

/**
 * The four historian's moves this primitive evaluates — the eval-mode ladder.
 * Each is a DIFFERENT SKILL over the same era card, not a difficulty level:
 *
 *   lens_id          locate the detail in its lens        (β 2.0)
 *   era_sort         only then / only now / both          (β 3.5)
 *   era_compare      this era / the era before / both     (β 5.0)
 *   cause_of_change  why life changed                     (β 6.5)
 */
export type EraChallengeType = 'lens_id' | 'era_sort' | 'era_compare' | 'cause_of_change';

/**
 * Within-mode support tier. Second field of the two-field contract: the eval
 * mode says WHICH historian move, this says HOW MUCH on-screen help inside it.
 * Set by the generator from `config.difficulty`; absent means "no tier", and
 * every default below reproduces the pre-tier rendering exactly.
 */
export type EraSupportTier = 'easy' | 'medium' | 'hard';

/** On-screen hint strength. `lens_id` never reaches 'named_lens' — the lens IS its answer. */
export type EraHintLevel = 'named_lens' | 'generic' | 'none';

/** One lens on the era: daily life, technology, school & work, etc. */
export interface EraLens {
  title: string;
  body: string;
  /** Single depicting emoji for the lens tab. */
  icon: string;
}

/** The period immediately before the main era — the era_compare study material. */
export interface EraPriorEra {
  name: string;
  body: string;
}

export interface EraExplorerChallenge {
  id: string;
  /** Which historian's move this challenge asks for. Drives bins, prompt, and hint. */
  type: EraChallengeType;
  /**
   * The stimulus to judge. Never answers itself: no era name / date / time word
   * for the time-placement modes, no lens title for lens_id, no stated cause for
   * cause_of_change. The generator enforces all four audits.
   */
  statement: string;
  /**
   * The three on-screen choices, ALWAYS built by the generator — from session
   * data for the fixed-bin modes, from the emitted causes for cause_of_change.
   */
  options: string[];
  /** Index into `options`. Derived in code from the generator's answer text. */
  correctIndex: number;
  /** Why that answer is right — shown only after the student answers. */
  explanation: string;
  /**
   * Which lens to re-read. Absent for lens_id, where naming a lens would BE the
   * answer — that mode renders a generic "open every lens" nudge instead.
   */
  lensHint?: string;

  // ---- Support tier (scaffolding withdrawal; never touches options/correctIndex) ----
  /** Name the historian's move on screen, under the question. Default: off. */
  showStrategy?: boolean;
  /** Hint disclosure strength. Default: named lens when one exists, else generic. */
  hintLevel?: EraHintLevel;
  /** Plain-language captions under the time bins. Default: on. */
  showBinCaptions?: boolean;
}

export interface EraExplorerData {
  title: string;
  description: string;
  /** The era under exploration — doubles as an answer-choice label. */
  eraName: string;
  /** Kid-readable period tag, e.g. "about 150 years ago" or "1850–1900". */
  eraPeriod: string;
  /** The period just before. Rendered only when the session sorts across eras. */
  priorEra: EraPriorEra;
  /** Exactly 3 lenses. The stimulus the student explores first. */
  lenses: EraLens[];
  /** 4-6 challenges. REQUIRED. Built by the generator. */
  challenges: EraExplorerChallenge[];

  /**
   * Session-level task identity: the one type when single-mode, 'mixed' when the
   * session spans several. REPRESENTATIVE METADATA ONLY — every render decision
   * reads the per-challenge `type`, so a mixed session never renders as one mode.
   */
  challengeType: EraChallengeType | 'mixed';
  /** Canonical grade key ('K'|'1'…) stamped by the generator for band-gating. */
  gradeLevel?: string;

  // ---- Support tier, session scope ----
  /** The tier the manifest asked for, or absent. Calibrates the tutor's reveal. */
  supportTier?: EraSupportTier;
  /** Must every lens be opened before the questions unlock? Default: true. */
  requireAllLenses?: boolean;
  /**
   * Whether the source cards sit open beside the question or fold away between
   * challenges. Never 'hidden' — era analysis is open-book by design, so the
   * hard tier withdraws the source from the eye, not from the student.
   * Default: 'open'.
   */
  lensAccess?: 'open' | 'collapsible';

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<EraExplorerMetrics>) => void;
}

// ============================================================================
// Config
// ============================================================================

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  lens_id: { label: 'Find the Lens', icon: '🔍', accentColor: 'amber' },
  era_sort: { label: 'Then, Now, or Both', icon: '🏛️', accentColor: 'amber' },
  era_compare: { label: 'Compare Two Eras', icon: '🕰️', accentColor: 'amber' },
  cause_of_change: { label: 'Why Life Changed', icon: '🔗', accentColor: 'amber' },
};

/** Wrong tries before the correct answer is revealed and the challenge closes. */
const MAX_TRIES = 2;

/**
 * Per-mode render config. Icons and captions are POSITIONAL for the fixed-bin
 * modes (the generator always emits those options in the same order), and
 * absent for cause_of_change, whose three causes are rotated by index.
 */
const MODE_META: Record<
  EraChallengeType,
  { question: string; strategy: string; icons?: string[]; captions?: string[] }
> = {
  lens_id: {
    question: 'Which lens tells you about this?',
    strategy: 'Match the KIND of thing in the sentence to the kind of thing each lens talks about.',
  },
  era_sort: {
    question: 'When did life look like this?',
    strategy: 'Check it twice — was this true back then? Is it true in your own day? The two answers pick the box.',
    icons: ['🏛️', '🏙️', '🔁'],
    captions: ['Long ago', 'Our time', 'Then AND now'],
  },
  era_compare: {
    question: 'Which time does this belong to?',
    strategy: 'Today is not a choice here. Weigh the two old times: the earlier card, then this era\u2019s lenses.',
    icons: ['🕰️', '🏛️', '🔁'],
    captions: ['The era before', 'This era', 'Both past eras'],
  },
  cause_of_change: {
    question: 'Why did life change?',
    strategy: 'Ask which one had to happen FIRST before life could change this way.',
  },
};

/**
 * How much the live tutor may reveal at this tier — the second scaffold channel.
 * A tier that hides the lens name and the historian's move on screen but lets
 * the tutor say both is only half-applied, so the reveal level tracks the
 * withdrawal exactly. `NEVER NAME THE BOX` (the catalog directive) holds at
 * every tier: the three choices are always the student's to pick.
 */
function tutorRevealPolicy(tier: EraSupportTier | undefined): string {
  if (!tier) return '';
  const common = 'Never say which of the three choices is right.';
  switch (tier) {
    case 'easy':
      return 'SUPPORT TIER easy: the historian move is named on screen and the hint names the lens to '
        + `re-read — you may name that lens too and walk the move through step by step. ${common}`;
    case 'medium':
      return 'SUPPORT TIER medium: the move is NOT named on screen. If the student stalls you may point '
        + `at ONE lens to re-read, but let them run the move themselves. ${common}`;
    default:
      return 'SUPPORT TIER hard: the screen deliberately gives no hint, no lens name, and no plain-language '
        + 'caption under the choices — working out which source to consult is part of the task. Do NOT name '
        + 'a lens, do NOT name the method, and do NOT translate the choice labels into "long ago" or "now". '
        + `Ask what they noticed in what they read. ${common}`;
  }
}

// ============================================================================
// Props
// ============================================================================

interface EraExplorerProps {
  data: EraExplorerData;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

const EraExplorer: React.FC<EraExplorerProps> = ({ data, className }) => {
  const {
    title,
    description,
    eraName,
    eraPeriod,
    priorEra,
    lenses = [],
    challenges = [],
    gradeLevel,
    supportTier,
    requireAllLenses = true,
    lensAccess = 'open',
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  /**
   * K-1 cannot read the lens bodies, the statement, or the choice labels — the
   * tutor's voice is their only channel, so the read-aloud surface is sized to
   * the pre-reader tap tier and the greeting orients by ear.
   */
  const isPreReader = gradeLevel === 'K' || gradeLevel === '1';

  /** True when any challenge contrasts two past eras — gates the priorEra card. */
  const needsPriorEra = useMemo(
    () => challenges.some((c) => c.type === 'era_compare'),
    [challenges],
  );

  // -------------------------------------------------------------------------
  // Explore state (lens card)
  // -------------------------------------------------------------------------
  const [activeLens, setActiveLens] = useState(0);
  const [visitedLenses, setVisitedLenses] = useState<Set<number>>(new Set([0]));
  const [sortingStarted, setSortingStarted] = useState(false);
  /**
   * Hard tier only: the student has re-opened the source cards for THIS
   * challenge. Re-folded on every advance — otherwise one tap would downgrade
   * the rest of the session to the open-source tier.
   */
  const [sourceRevealed, setSourceRevealed] = useState(false);
  /**
   * The student has clicked past the LAST challenge. Distinct from
   * `allChallengesComplete`, which flips the moment the final answer is
   * RECORDED — gating the summary on that would swap the challenge out from
   * under the final explanation, so the last teaching note (and, on a wrong
   * answer, the reveal) would never be read.
   */
  const [sessionFinished, setSessionFinished] = useState(false);

  const allLensesVisited = lenses.length > 0 && visitedLenses.size >= lenses.length;
  /** The explore gate: relaxed at the hard tier, where choosing what to consult is the student's job. */
  const canStartSorting = !requireAllLenses || allLensesVisited;
  const sourceVisible = lensAccess === 'open' || sourceRevealed;

  // -------------------------------------------------------------------------
  // Challenge progression (canonical multi-instance wiring)
  // -------------------------------------------------------------------------
  const {
    currentIndex: currentChallengeIndex,
    currentAttempts,
    results: challengeResults,
    isComplete: allChallengesComplete,
    recordResult,
    incrementAttempts,
    advance: advanceProgress,
  } = useChallengeProgress({ challenges, getChallengeId: (ch) => ch.id });

  const currentChallenge = challenges[currentChallengeIndex] ?? null;

  // Per-challenge interaction state
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | 'revealed' | null>(null);
  const [hintsViewed, setHintsViewed] = useState(0);
  const recordedRef = useRef(false);

  // Per-challenge reset — every useState slot that depends on the active challenge.
  useEffect(() => {
    if (!currentChallenge) return;
    setSelectedIndex(null);
    setFeedback(null);
    setSourceRevealed(false);
    recordedRef.current = false;
  }, [currentChallenge?.id]);

  // -------------------------------------------------------------------------
  // Evaluation hook
  // -------------------------------------------------------------------------
  const stableInstanceIdRef = useRef(instanceId || `era-explorer-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<EraExplorerMetrics>({
    primitiveType: 'era-explorer',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // -------------------------------------------------------------------------
  // AI tutoring
  // -------------------------------------------------------------------------
  const activeLensTitle = lenses[activeLens]?.title ?? '';

  const aiPrimitiveData = useMemo(() => ({
    title,
    gradeLevel: gradeLevel || 'Elementary',
    eraName,
    eraPeriod,
    priorEraName: priorEra?.name ?? '',
    phase: sortingStarted ? 'sorting' : 'exploring',
    activeLens: activeLensTitle,
    lensesVisited: visitedLenses.size,
    totalLenses: lenses.length,
    challengeType: currentChallenge?.type ?? data.challengeType,
    // The mode's on-screen question, so the tutor nudges toward the move actually
    // being asked instead of inventing one from the statement alone.
    question: currentChallenge ? MODE_META[currentChallenge.type].question : '',
    challengeIndex: currentChallengeIndex + 1,
    totalChallenges: challenges.length,
    currentStatement: currentChallenge?.statement ?? '',
    // Always a non-empty string: the bag is interpolated literally, so an absent
    // value would reach the tutor as "(not set)". Not a catalog contextKey — the
    // tier's real teeth are the per-turn policy clause in the sendText calls below.
    supportTier: supportTier ?? 'standard',
  }), [
    title, gradeLevel, eraName, eraPeriod, priorEra?.name, sortingStarted, data.challengeType,
    activeLensTitle, visitedLenses.size, lenses.length, currentChallengeIndex, challenges.length,
    currentChallenge?.type, currentChallenge?.statement, supportTier,
  ]);

  const { sendText, isConnected, isAudioPlaying } = useLuminaAI({
    primitiveType: 'era-explorer',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: gradeLevel || 'Elementary',
  });

  /** The tutor's reveal ceiling for this session's tier — see `tutorRevealPolicy`. */
  const revealPolicy = tutorRevealPolicy(supportTier);

  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current) return;
    hasIntroducedRef.current = true;
    sendText(
      `[ACTIVITY_START] Era Explorer: "${eraName}" (${eraPeriod}). `
      + `The student will explore ${lenses.length} lenses on life in this era, then answer `
      + `${challenges.length} questions about it. `
      + `Introduce the era warmly in 1-2 sentences and invite them to open each lens.`
      + (isPreReader
        ? ` This student is a pre-reader and cannot read any of the text on screen — say the era name aloud, `
          + `tell them the lens tabs at the top can be tapped, and let them know you will read anything to them. `
          + `Use "back then" and "now", never a year.`
        : '')
      + (revealPolicy ? ` ${revealPolicy}` : ''),
      { silent: true }
    );
  }, [isConnected, eraName, eraPeriod, lenses.length, challenges.length, isPreReader, revealPolicy, sendText]);

  /**
   * Read-aloud. `silent` suppresses only the chat-transcript entry — the socket
   * payload is unchanged, so the tutor speaks. Never counted as a hint: hearing
   * the text is the pre-reader's baseline access to it, not extra help.
   */
  const readAloud = useCallback((text: string) => {
    if (!text) return;
    sendText(
      `[ERA_READ_ALOUD] The student tapped "read this to me" and cannot read the screen. `
      + `Read this aloud, word for word, warmly and slowly: "${text}". Then wait.`,
      { silent: true }
    );
  }, [sendText]);

  /**
   * The era speaks in the first person — the PRD's key-figure voice, held to the
   * explore phase so it can never brush against a challenge statement.
   */
  const figureVoice = useCallback((lensTitle: string, lensBody: string) => {
    sendText(
      `[ERA_FIGURE_VOICE] The student wants to hear from someone living in ${eraName} (${eraPeriod}). `
      + `Speak as an ordinary person of that era about "${lensTitle}", using only what this lens says: "${lensBody}". `
      + `Two or three first-person sentences, then one short line in your own voice inviting them to keep exploring.`,
      { silent: true }
    );
  }, [eraName, eraPeriod, sendText]);

  // -------------------------------------------------------------------------
  // Explore handlers
  // -------------------------------------------------------------------------
  const handleLensChange = useCallback((index: number) => {
    SoundManager.tap();
    setActiveLens(index);
    setVisitedLenses(prev => {
      if (prev.has(index)) return prev;
      const next = new Set(prev);
      next.add(index);
      return next;
    });

    const lens = lenses[index];
    if (isConnected && lens && !visitedLenses.has(index)) {
      sendText(
        `[LENS_OPENED] Student opened the "${lens.title}" lens `
        + `(${visitedLenses.size + 1} of ${lenses.length} visited). `
        + `In ONE sentence, point out something worth noticing in this lens.`,
        { silent: true }
      );
    }
  }, [lenses, visitedLenses, isConnected, sendText]);

  const handleStartSorting = useCallback(() => {
    SoundManager.tap();
    setSortingStarted(true);
    if (isConnected) {
      const modes = Array.from(new Set(challenges.map(c => PHASE_TYPE_CONFIG[c.type]?.label ?? c.type)));
      sendText(
        `[CHALLENGES_START] Student finished exploring and is starting the questions `
        + `(${challenges.length} of them: ${modes.join(', ')}). Frame the task once in ONE sentence, `
        + `then stay quiet per round.`
        + (revealPolicy ? ` ${revealPolicy}` : ''),
        { silent: true }
      );
    }
  }, [isConnected, challenges, revealPolicy, sendText]);

  // -------------------------------------------------------------------------
  // Challenge handlers
  // -------------------------------------------------------------------------
  const scoreForAttempts = (attemptsUsed: number): number =>
    attemptsUsed <= 1 ? 100 : 50;

  const completeCurrentChallenge = useCallback((correct: boolean, score: number, attempts: number) => {
    if (!currentChallenge) return;
    if (recordedRef.current) return;
    recordedRef.current = true;
    recordResult({ challengeId: currentChallenge.id, correct, attempts, score });
  }, [currentChallenge, recordResult]);

  const handleCheck = useCallback(() => {
    if (!currentChallenge || selectedIndex === null || feedback === 'correct' || feedback === 'revealed') return;

    const correct = selectedIndex === currentChallenge.correctIndex;
    const triesUsed = currentAttempts + 1;
    const correctLabel = currentChallenge.options[currentChallenge.correctIndex] ?? '';
    const chosenLabel = currentChallenge.options[selectedIndex] ?? '';
    const question = MODE_META[currentChallenge.type].question;

    if (correct) {
      SoundManager.playCorrect();
      setFeedback('correct');
      completeCurrentChallenge(true, scoreForAttempts(triesUsed), triesUsed);
      if (isConnected) {
        sendText(
          `[ANSWER_CORRECT] ${question} "${currentChallenge.statement}" — answered `
          + `"${correctLabel}" correctly (try ${triesUsed}). Congratulate in ONE short sentence.`,
          { silent: true }
        );
      }
      return;
    }

    SoundManager.playIncorrect();
    incrementAttempts();

    if (triesUsed >= MAX_TRIES) {
      setFeedback('revealed');
      completeCurrentChallenge(false, 0, triesUsed);
      if (isConnected) {
        sendText(
          `[ANSWER_INCORRECT] ${question} "${currentChallenge.statement}": student chose `
          + `"${chosenLabel}" but the answer is "${correctLabel}" — now revealed. `
          + `In ONE sentence, restate why.`,
          { silent: true }
        );
      }
    } else {
      setFeedback('incorrect');
      if (isConnected) {
        // The hard tier withheld the lens name on screen; naming it here would
        // hand back exactly what the tier withdrew (Gotcha: the tutor is a
        // second scaffold channel).
        const nudge = supportTier === 'hard'
          ? `Give ONE nudge that asks what they noticed in the lenses they read, WITHOUT naming a lens, `
            + `the method, or the correct answer.`
          : currentChallenge.lensHint
            ? `Give ONE nudge toward the "${currentChallenge.lensHint}" lens WITHOUT naming the correct answer.`
            : `Give ONE nudge to re-read the lenses WITHOUT naming which lens or the correct answer.`;
        sendText(
          `[ANSWER_INCORRECT] ${question} "${currentChallenge.statement}": student chose `
          + `"${chosenLabel}" — not correct, one try left. ${nudge}`,
          { silent: true }
        );
      }
    }
  }, [
    currentChallenge, selectedIndex, feedback, currentAttempts, isConnected, supportTier,
    completeCurrentChallenge, incrementAttempts, sendText,
  ]);

  const handleNext = useCallback(() => {
    if (!advanceProgress()) {
      // Past the last challenge — now, and only now, show the summary.
      setSessionFinished(true);
      return;
    }
    if (isConnected) {
      sendText(
        `[NEXT_ITEM] Moving to question ${currentChallengeIndex + 2} of ${challenges.length}. `
        + `Stay quiet unless the student struggles.`,
        { silent: true }
      );
    }
  }, [advanceProgress, isConnected, currentChallengeIndex, challenges.length, sendText]);

  const handleSelect = useCallback((index: number) => {
    if (feedback === 'correct' || feedback === 'revealed') return;
    SoundManager.tap();
    setSelectedIndex(index);
    if (feedback === 'incorrect') setFeedback(null);
  }, [feedback]);

  // -------------------------------------------------------------------------
  // Phase results + session-complete submit
  // -------------------------------------------------------------------------
  const phaseResults = usePhaseResults({
    challenges,
    results: challengeResults,
    isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.type,
    phaseConfig: PHASE_TYPE_CONFIG,
    getScore: (rs) => Math.round(rs.reduce((s, r) => s + (r.score ?? (r.correct ? 100 : 0)), 0) / rs.length),
  });

  useEffect(() => {
    if (!allChallengesComplete || hasSubmittedEvaluation || challenges.length === 0) return;

    const totalChallenges = challenges.length;
    const correctCount = challengeResults.filter(r => r.correct).length;
    const attemptsCount = challengeResults.reduce((s, r) => s + r.attempts, 0);
    const firstTryCount = challengeResults.filter(r => (r.score ?? 0) === 100).length;
    const overallAccuracy = Math.round(
      challengeResults.reduce((s, r) => s + (r.score ?? (r.correct ? 100 : 0)), 0) / totalChallenges
    );

    const metrics: EraExplorerMetrics = {
      type: 'era-explorer',
      challengeType: data.challengeType,
      totalChallenges,
      correctCount,
      attemptsCount,
      firstTryCount,
      hintsViewed,
      overallAccuracy,
      averageAttemptsPerChallenge: Math.round((attemptsCount / totalChallenges) * 10) / 10,
    };

    if (isConnected) {
      const phaseScoreStr = phaseResults.map(p => `${p.label} ${p.score}% (${p.attempts} attempts)`).join(', ');
      sendText(
        `[ALL_COMPLETE] Era Explorer finished: ${correctCount}/${totalChallenges} correct, `
        + `${phaseScoreStr}. Celebrate briefly and name one thing they judged well.`,
        { silent: true }
      );
    }

    submitEvaluation(overallAccuracy >= 70, overallAccuracy, metrics, {
      eraName,
      results: challengeResults.map(r => ({ challengeId: r.challengeId, correct: r.correct, attempts: r.attempts })),
    });
  }, [
    allChallengesComplete, hasSubmittedEvaluation, challenges.length, challengeResults,
    hintsViewed, phaseResults, isConnected, eraName, data.challengeType, sendText, submitEvaluation,
  ]);

  // -------------------------------------------------------------------------
  // Render: era lens card (the stimulus)
  // -------------------------------------------------------------------------
  const renderLensCard = (compact: boolean) => (
    <div className="space-y-3">
      <div className="flex gap-1 overflow-x-auto pb-1">
        {lenses.map((lens, i) => {
          const isActive = activeLens === i;
          const isVisited = visitedLenses.has(i);
          return (
            <LuminaButton
              key={i}
              tone={isActive ? 'ghost' : 'subtle'}
              className={`shrink-0 text-xs px-3 py-2 h-auto ${
                isActive ? 'text-slate-100' : isVisited ? 'text-slate-300' : 'text-slate-500'
              }`}
              onClick={() => handleLensChange(i)}
            >
              <span className="mr-1">{lens.icon}</span>
              {lens.title}
              {isVisited && !isActive && <span className="ml-1 text-emerald-400">✓</span>}
            </LuminaButton>
          );
        })}
      </div>
      {lenses[activeLens] && (
        <LuminaPanel accent="amber" className={compact ? 'py-3' : ''}>
          <p className="text-slate-200 text-sm leading-relaxed">{lenses[activeLens].body}</p>
          {isConnected && (
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <LuminaReadAloud
                size={isPreReader ? 'lg' : 'sm'}
                speaking={isAudioPlaying}
                label="Read this to me"
                onClick={() => readAloud(
                  `${lenses[activeLens].title}, in ${eraName}. ${lenses[activeLens].body}`
                )}
              />
              {/* Explore phase only — a first-person voice must never brush a live statement. */}
              {!compact && (
                <LuminaButton
                  tone="subtle"
                  className={`h-auto ${isPreReader ? 'text-sm px-4 py-3' : 'text-xs px-3 py-1.5'}`}
                  onClick={() => figureVoice(lenses[activeLens].title, lenses[activeLens].body)}
                >
                  <span className="mr-1">🗣️</span>
                  Someone who lived then
                </LuminaButton>
              )}
            </div>
          )}
        </LuminaPanel>
      )}
    </div>
  );

  /**
   * The earlier-era card. Rendered only when the session actually contrasts two
   * past periods — otherwise it is background the student would read as noise.
   */
  const renderPriorEraCard = () => {
    if (!needsPriorEra || !priorEra) return null;
    return (
      <div className="space-y-2">
        <LuminaSectionLabel accent="amber" size="sm">
          Before that: {priorEra.name}
        </LuminaSectionLabel>
        <LuminaPanel accent="amber" className="py-3">
          <p className="text-slate-300 text-sm leading-relaxed">{priorEra.body}</p>
        </LuminaPanel>
      </div>
    );
  };

  // -------------------------------------------------------------------------
  // Render: one challenge
  // -------------------------------------------------------------------------
  const renderChallenge = () => {
    if (!currentChallenge) return null;
    const answered = feedback === 'correct' || feedback === 'revealed';
    const meta = MODE_META[currentChallenge.type];
    const correctLabel = currentChallenge.options[currentChallenge.correctIndex] ?? '';
    /**
     * Tier scaffolds, per challenge — each default reproduces the pre-tier
     * rendering, so a session the manifest sent no difficulty for is unchanged.
     */
    const showStrategy = currentChallenge.showStrategy ?? false;
    const hintLevel: EraHintLevel =
      currentChallenge.hintLevel ?? (currentChallenge.lensHint ? 'named_lens' : 'generic');
    const showBinCaptions = currentChallenge.showBinCaptions ?? true;
    // Options are stacked when they carry prose (causes), gridded when they are bins.
    const stacked = currentChallenge.type === 'cause_of_change';

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <LuminaSectionLabel accent="amber" size="sm">{meta.question}</LuminaSectionLabel>
          <LuminaChallengeCounter current={currentChallengeIndex + 1} total={challenges.length} accent="amber" />
        </div>

        {/* Easy tier only: the historian move named, so the student knows which
            question to ask themselves before reading the statement. */}
        {showStrategy && (
          <p className="text-xs text-amber-200/70 text-center px-2">{meta.strategy}</p>
        )}

        <LuminaPrompt accent="amber" center>
          “{currentChallenge.statement}”
        </LuminaPrompt>

        {isConnected && (
          <div className="flex justify-center">
            <LuminaReadAloud
              size={isPreReader ? 'lg' : 'sm'}
              iconOnly={!isPreReader}
              speaking={isAudioPlaying}
              label="Hear the question"
              aria-label="Hear the question and the choices"
              onClick={() => readAloud(
                `${meta.question} `
                // A pre-reader cannot read the strategy line, so the easy tier
                // would be invisible to them unless the read-aloud carries it.
                + (showStrategy ? `${meta.strategy} ` : '')
                + `${currentChallenge.statement}. `
                + `Your choices are: ${currentChallenge.options.join(', ')}.`
              )}
            />
          </div>
        )}

        <div className={stacked ? 'space-y-2' : 'grid grid-cols-1 sm:grid-cols-3 gap-3'}>
          {currentChallenge.options.map((option, i) => {
            const isSelected = selectedIndex === i;
            const isCorrectOption = i === currentChallenge.correctIndex;

            let state: AnswerChoiceState;
            if (answered) {
              if (isCorrectOption) state = 'correct';
              else if (isSelected) state = 'incorrect';
              else state = 'dimmed';
            } else if (feedback === 'incorrect' && isSelected) {
              state = 'incorrect';
            } else {
              state = isSelected ? 'selected' : 'idle';
            }

            // lens_id borrows each lens's own emoji so the bins read as the tabs above.
            const icon = currentChallenge.type === 'lens_id'
              ? lenses.find((l) => l.title === option)?.icon
              : meta.icons?.[i];

            return (
              <LuminaAnswerChoice
                key={`${currentChallenge.id}-${i}`}
                state={state}
                className={stacked ? 'p-3 text-left' : 'p-4 text-center'}
                onClick={() => handleSelect(i)}
                disabled={answered}
              >
                {icon && <span className="block text-2xl mb-1">{icon}</span>}
                <span className="block text-sm font-semibold text-slate-100">{option}</span>
                {/* The plain-language gloss on each bin. Withdrawn at hard, where
                    mapping the era name onto "long ago" is the student's work.
                    The ICON stays at every tier — it is the pre-reader's only
                    channel to the choice, not a scaffold. */}
                {showBinCaptions && meta.captions?.[i] && (
                  <span className="block text-[11px] text-slate-400 mt-0.5">{meta.captions[i]}</span>
                )}
              </LuminaAnswerChoice>
            );
          })}
        </div>

        {/* Hint ladder: names the lens (easy) → sends them hunting (medium)
            → nothing at all (hard). lens_id never reaches the named rung — the
            lens IS its answer — so it starts one rung down. */}
        {!answered && hintLevel !== 'none' && (
          <LuminaHintDisclosure
            accent="amber"
            onOpenChange={(open) => { if (open) setHintsViewed(h => h + 1); }}
          >
            {hintLevel === 'named_lens' && currentChallenge.lensHint ? (
              <>
                Re-read the <span className="font-semibold">{currentChallenge.lensHint}</span> lens above —
                what does it tell you about this?
              </>
            ) : (
              <>Open each lens tab above and look for where this detail is described.</>
            )}
          </LuminaHintDisclosure>
        )}

        {feedback === 'incorrect' && (
          <LuminaFeedbackCard status="incorrect" label="Not quite">
            Think again — pick a different answer and check once more.
          </LuminaFeedbackCard>
        )}

        {answered && (
          <div className="space-y-3">
            <LuminaFeedbackCard
              status={feedback === 'correct' ? 'correct' : 'incorrect'}
              label={feedback === 'revealed' ? `The answer is “${correctLabel}”` : undefined}
              teachingNote={currentChallenge.explanation}
            >
              {feedback === 'correct'
                ? `Right — “${correctLabel}”.`
                : 'Here is the story behind it:'}
            </LuminaFeedbackCard>
            <div className="flex justify-center">
              <LuminaActionButton action="next" onClick={handleNext}>
                {currentChallengeIndex + 1 >= challenges.length ? 'See Results' : 'Next Question'}
              </LuminaActionButton>
            </div>
          </div>
        )}

        {!answered && (
          <div className="flex justify-center">
            <LuminaActionButton action="check" onClick={handleCheck} disabled={selectedIndex === null}>
              Check
            </LuminaActionButton>
          </div>
        )}
      </div>
    );
  };

  // -------------------------------------------------------------------------
  // Main render
  // -------------------------------------------------------------------------
  return (
    <LuminaCard className={className} topAccent="amber">
      <LuminaCardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">🏛️</span>
            <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
          </div>
          <LuminaBadge accent="amber" className="text-xs">{eraPeriod}</LuminaBadge>
        </div>
        <p className="text-slate-400 text-sm mt-1">{description}</p>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-5">
        {sessionFinished && phaseResults.length > 0 ? (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score ?? phaseResults[0]?.score ?? 0}
            durationMs={elapsedMs}
            heading="Era Explored!"
            celebrationMessage={`You thought about ${eraName} like a historian.`}
          />
        ) : sortingStarted ? (
          <>
            {/* Hard tier: the source folds away between challenges. Still one tap
                from the student — era analysis is open-book by design — but they
                judge from what they read rather than from what is on screen. */}
            {sourceVisible ? (
              <>
                {renderLensCard(true)}
                {renderPriorEraCard()}
                {lensAccess === 'collapsible' && (
                  <div className="flex justify-end">
                    <LuminaButton
                      tone="subtle"
                      className="text-xs h-7 px-3"
                      onClick={() => { SoundManager.tap(); setSourceRevealed(false); }}
                    >
                      Put the lenses away
                    </LuminaButton>
                  </div>
                )}
              </>
            ) : (
              <div className="flex justify-center">
                <LuminaButton
                  tone="subtle"
                  className={`h-auto ${isPreReader ? 'text-sm px-4 py-3' : 'text-xs px-3 py-2'}`}
                  onClick={() => { SoundManager.tap(); setSourceRevealed(true); }}
                >
                  <span className="mr-1">📚</span>
                  Look at the lenses again
                </LuminaButton>
              </div>
            )}
            <div className="border-t border-white/10 pt-4">{renderChallenge()}</div>
          </>
        ) : (
          <>
            <LuminaSectionLabel accent="amber" size="sm">
              Explore life in {eraName}
            </LuminaSectionLabel>
            {renderLensCard(false)}
            {renderPriorEraCard()}
            {/* The explore gate. At easy/medium the workspace does the study
                planning — every lens must be opened, and the counter tracks it.
                At hard both come off: deciding what to consult is the task. */}
            <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-white/5">
              <span>
                {requireAllLenses
                  ? `${visitedLenses.size} of ${lenses.length} lenses explored`
                  : 'Read whichever lenses you need'}
              </span>
              {canStartSorting ? (
                <LuminaButton tone="primary" className="text-xs h-8" onClick={handleStartSorting}>
                  Start the Questions ({challenges.length})
                </LuminaButton>
              ) : (
                <span className="text-slate-600">Open every lens to start</span>
              )}
            </div>
          </>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default EraExplorer;
