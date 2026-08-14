'use client';

/**
 * RhymeStudio — DI modality (eighth literacy port, 2026-08-12). The Live tutor
 * owns the clock in every mode: it asks, waits, judges, corrects contrastively,
 * and its OWN verdict is the advance. There is no advance timer, no
 * push-to-talk mic, no Next button and no Start-Activity gate in this file.
 *
 * WHAT THE CHILD DOES: every mode is answered ALOUD. Nothing here is tappable
 * except the cards, which repeat the question.
 *  - identification / production: say the word that rhymes. The choices stay ON
 *    SCREEN — they are not a scaffold to delete, they are the closed set that
 *    makes a spoken rhyme a benched response class at all (see
 *    rhymeStudioScript.ts).
 *  - recognition: say yes or no. This mode shipped with a 👍/👎 tap for exactly
 *    one day; the user's first drive removed it (*"we should just be able to
 *    say yes to the tutor"*) and the session log showed why it could not have
 *    survived — asked a spoken question, the child answered aloud, the silence
 *    contract had no line for that, and the tutor improvised a hallucinated
 *    verdict that the engine could not even read. See the script header.
 *
 * DELETED from the click-driven version: the Start Activity gate; the
 * push-to-talk transcribe-and-match bonus beat and the 1400ms advance timer
 * behind it; the attempt cap and its reveal-after-3 ladder; Next/Finish/Skip;
 * the whole tutor-message choreography (ten bracketed tags, from the activity
 * intro to the session summary); the reveal-policy prose that improvised the
 * tutor's latitude per tier (the tier is now the script's DISTAR lead-in
 * ladder); the on-screen question restatement (the tutor asks it); and the
 * component-owned distractor pool — hardcoded content in a primitive, and its
 * seventh entry was the affirm sentinel itself, which under a spoken correction
 * would have opened a sentence the engine reads as a judgment.
 *
 * ANSWER-LEAK RULE: the rime highlight and the correct-choice ring appear only
 * after the tutor has affirmed. Tap-to-hear re-speaks the QUESTION, never the
 * answer.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaBadge,
  LuminaChallengeCounter,
  answerStateClass,
  type LuminaAccent,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { RhymeStudioMetrics } from '../../../evaluation/types';
import {
  useJudgedScriptRunner,
  type JudgedRunSummary,
} from '../../../hooks/useJudgedScriptRunner';
import type { JudgedScriptPack } from '../../../hooks/judgedScriptContract';
import {
  completeCue,
  itemCue,
  itemFromChallenge,
  moveOnCue,
  pickModelRhymePair,
  pronounceCue,
  stimulusFor,
  type RhymeItem,
  type RhymeMode,
  type RhymeTier,
} from './rhymeStudioScript';
import { SoundManager } from '../../../utils/SoundManager';
import { isPreReaderGrade } from '../../../utils/kindergartenMode';
import PhaseSummaryPanel, { type PhaseResult } from '../../../components/PhaseSummaryPanel';
import JudgedMicPanel from '../../../components/JudgedMicPanel';
import { phaseResultsFromSummary } from '../../../hooks/usePhaseResults';

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
  mode: RhymeMode;
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
  /** Production only: the non-rhyming bank tiles, generated on topic. Replaces
   *  the component's old hardcoded DISTRACTOR_POOL. */
  bankDistractors?: string[];
  remediationMove?: 'contrast_rime' | 'diagnostic_option' | 'constrained_production';

  // ── Within-mode support-tier scaffolds (stamped by the generator from
  //    ctx.supportTier). Display / instruction / tutor-latitude ONLY — they
  //    NEVER change the words, which option is correct, or the
  //    acceptableAnswers data. All optional; absent ⇒ full-help behavior. ──
  /** #1 perception — amber rime-suffix highlight on the target card. Default: shown. */
  showRhymeFamilyHighlight?: boolean;
  /** #1 perception — the reader-grade prose image caption under a word. Default: shown. */
  showWordImage?: boolean;
  /** #2 instruction — may the tutor enumerate the choices aloud? Default: yes.
   *  FORCED true at PRE — a non-reader cannot read the set off the screen. */
  tutorNamesOptions?: boolean;
  /** #5 answer-form — correct tiles in the 4-tile production bank. Default: 2. */
  productionCorrectCount?: number;
}

export interface RhymeStudioData {
  title: string;
  gradeLevel: string;
  /** Within-mode support tier from the manifest. Drives the DISTAR lead-in ladder. */
  supportTier?: RhymeTier;
  challenges: RhymeChallenge[];

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<RhymeStudioMetrics>) => void;
}

interface RhymeStudioProps {
  data: RhymeStudioData;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const MODE_META: Record<RhymeMode, { badge: string; icon: string; accent: LuminaAccent; prompt: string }> = {
  recognition: { badge: 'Do They Rhyme?', icon: '👂', accent: 'blue', prompt: 'Listen… then say yes or no!' },
  identification: { badge: 'Find the Rhyme', icon: '🔍', accent: 'purple', prompt: 'Say the one that rhymes!' },
  production: { badge: 'Say a Rhyme', icon: '🎙️', accent: 'emerald', prompt: 'Say a card that rhymes!' },
};

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

  // At PRE (Kindergarten) the child cannot read any word on screen: pictures
  // carry the words, the tutor carries the task, and adult chrome is hidden.
  const isPreReader = isPreReaderGrade(gradeLevel);

  const stableInstanceIdRef = useRef(instanceId || `rhyme-studio-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // ── Items + the code-owned rule-model pair ────────────────────────────────
  const items = useMemo<RhymeItem[]>(
    () => challenges.map((ch) => itemFromChallenge(ch, supportTier ?? 'medium')),
    [challenges, supportTier],
  );
  const modelPair = useMemo(() => pickModelRhymePair(items), [items]);

  // ── Per-item stage state ──────────────────────────────────────────────────
  /** Affirmed: the first moment the rime / correct choice may appear on screen. */

  // ── Evaluation ────────────────────────────────────────────────────────────
  const evaluation = usePrimitiveEvaluation<RhymeStudioMetrics>({
    primitiveType: 'rhyme-studio',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const handleFinished = useCallback((summary: JudgedRunSummary) => {
    // Per-mode accuracy: join the run's outcomes back onto the challenges that
    // produced them. The IRT ladder reads these three fields per eval mode, so
    // they survive the port unchanged in shape.
    const byMode: Record<RhymeMode, { score: number; count: number }> = {
      recognition: { score: 0, count: 0 },
      identification: { score: 0, count: 0 },
      production: { score: 0, count: 0 },
    };
    for (const ch of challenges) {
      const outcome = summary.outcomes.find((o) => o.id === ch.id);
      if (!outcome) continue;
      byMode[ch.mode].score += outcome.score;
      byMode[ch.mode].count += 1;
    }
    const pct = (mode: RhymeMode) =>
      byMode[mode].count > 0 ? Math.round(byMode[mode].score / byMode[mode].count) : 0;

    const metrics: RhymeStudioMetrics = {
      type: 'rhyme-studio',
      challengeMode: challenges[0]?.mode ?? 'recognition',
      challengesCorrect: summary.solvedCount,
      challengesTotal: challenges.length,
      recognitionAccuracy: pct('recognition'),
      identificationAccuracy: pct('identification'),
      productionAccuracy: pct('production'),
      rhymeFamiliesPracticed: Array.from(new Set(challenges.map((ch) => ch.rhymeFamily))),
      attemptsCount: summary.attemptsCount,
    };
    evaluation.submitResult(
      summary.passed,
      summary.accuracy,
      metrics,
      { challengeResults: summary.outcomes },
      undefined,
      summary.diagnosisEvidence,
    );
  }, [challenges, evaluation]);

  // ── The pack — wording lives in rhymeStudioScript.ts ──────────────────────
  const pack = useMemo<JudgedScriptPack<RhymeItem>>(() => ({
    primitiveType: 'rhyme-studio',
    activityLine: 'live direct instruction rhyming practice',
    items,
    itemCue: (item, opts) => itemCue(item, opts, { modelPair }),
    moveOnCue: (item, next, opts) => moveOnCue(item, next, opts, { modelPair }),
    completeCue,
    pronounceCue,
    contextFor: (item) => ({
      challengeMode: item.mode,
      stimulus: stimulusFor(item),
    }),
    // Only what DIFFERS from the runner's defaults.
    statusLines: {
      ready: (item) => item.mode === 'recognition'
        ? 'Listen, then say yes or no.'
        : 'Listen, then say your answer out loud.',
      retry: (item) => item.mode === 'recognition'
        ? 'Listen again — then say yes or no.'
        : 'Have another go — say your answer.',
      done: 'Great rhyming work today!',
    },
    diagnosisObservation: (item, { lastHeard }) =>
      item.mode === 'recognition'
        ? {
            challenge: `Decide whether "${item.targetWord}" and "${item.comparisonWord}" rhyme.`,
            expected: `Say ${item.doesRhyme ? 'yes' : 'no'}, from the ending sound.`,
            observed: lastHeard
              ? `Heard "${lastHeard}".`
              : 'The tutor judged the answer wrong from the audio.',
          }
        : {
            challenge: item.mode === 'identification'
              ? `Say the word that rhymes with "${item.targetWord}".`
              : `Say a word card that rhymes with "${item.targetWord}".`,
            expected: `A word ending in "${item.rime}" — for example "${item.answer}".`,
            observed: lastHeard
              ? `Heard "${lastHeard}".`
              : 'The tutor judged the answer wrong from the audio.',
          },
  }), [items, modelPair]);

  const runner = useJudgedScriptRunner<RhymeItem>({
    pack,
    instanceId: resolvedInstanceId,
    gradeLevel,
    exhibitId,
    onFinished: handleFinished,
  });

  const currentItem = runner.currentItem;
  /** Affirmed: the first moment the answer may appear on screen. The runner
   *  owns this latch now (it replaces the `onItemOpened`/`onAffirmed` pair). */
  const revealed = runner.currentSolved;
  const currentChallenge = challenges[runner.currentIndex];

  // ── Support-tier display levers (read with `!== false` so an ABSENT field is
  //    the full-help render). The band support always WINS at PRE. ──
  const showRhymeFamilyHighlight = currentChallenge?.showRhymeFamilyHighlight !== false;
  const showWordImage = isPreReader || currentChallenge?.showWordImage !== false;

  // ── Phase summary ─────────────────────────────────────────────────────────
  const phaseResults = useMemo<PhaseResult[]>(() => {
    if (!evaluation.hasSubmitted) return [];
    return phaseResultsFromSummary(challenges, runner.summary, (ch) => {
      const meta = MODE_META[ch.mode];
      return { label: meta.badge, icon: meta.icon };
    });
  }, [evaluation.hasSubmitted, runner.summary, challenges]);

  // ============================================================================
  // Render helpers
  // ============================================================================

  /**
   * A word card. At PRE the PICTURE is the primary mark — a big depicting emoji
   * with the word a small caption (spoken by the tutor); no amber rime emphasis
   * (a non-reader cannot use it) and no prose caption (unreadable text). Reader
   * grades keep the word-primary card with the highlighted rime.
   */
  const renderWordCard = (
    word: string,
    rhymeFamily: string,
    imageDesc: string,
    emoji?: string,
    extraClasses?: string,
  ) => {
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
        {imageDesc && <p className="text-sm text-slate-500 italic">{imageDesc}</p>}
      </div>
    );
  };

  /** The target card, tappable to hear the question again (never the answer). */
  const renderTargetCard = (item: RhymeItem) => (
    <div className="flex justify-center">
      <div
        role="button"
        tabIndex={0}
        onClick={runner.hearStimulus}
        className={`cursor-pointer select-none rounded-2xl transition-all ${runner.stimulusTapped ? 'ring-2 ring-cyan-300/60' : ''}`}
      >
        {renderWordCard(
          item.targetWord,
          // ANSWER-LEAK GUARD: the rime names the family the answer belongs to,
          // so at medium/hard it is withheld until the tutor has affirmed.
          showRhymeFamilyHighlight || revealed ? `-${item.rime}` : '',
          showWordImage ? (currentChallenge?.targetWordImage ?? '') : '',
          item.targetEmoji,
        )}
      </div>
    </div>
  );

  /**
   * The choice set for the spoken modes. It is DISPLAYED, not tappable: saying
   * a word is the answer, and the cards are the closed set that makes saying it
   * a benched response class. The correct card is ringed only after the tutor
   * has affirmed.
   */
  const renderChoiceCards = (item: RhymeItem) => (
    <div className={`grid ${item.choices.length <= 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4'} gap-3`}>
      {item.choices.map((choice, idx) => (
        <div
          key={`${item.id}-${idx}`}
          className={`
            rounded-xl border-2 p-4 flex flex-col items-center gap-1.5 transition-all duration-200
            ${answerStateClass(revealed && choice.isCorrect ? 'correct' : 'idle')}
            ${revealed && choice.isCorrect ? 'ring-2 ring-emerald-400/40' : ''}
          `}
        >
          {isPreReader && choice.emoji && (
            <span className="text-5xl leading-none" role="img" aria-label={choice.word}>
              {choice.emoji}
            </span>
          )}
          <span className={isPreReader ? 'text-sm font-semibold text-slate-300' : 'text-2xl font-bold'}>
            {choice.word}
          </span>
        </div>
      ))}
    </div>
  );

  const renderChallenge = (item: RhymeItem) => {
    const meta = MODE_META[item.mode];
    if (item.mode === 'recognition') {
      return (
        <div className="space-y-5">
          {/* ANSWER-LEAK GUARD: the rime highlight used to be painted on the
              comparison card only when the pair really rhymed, so the highlight
              WAS the yes/no answer. Neither card carries it before the verdict;
              after the tutor affirms, the target always shows it and the
              comparison shows it only when the pair really rhymes — that is the
              teaching moment. */}
          <div
            role="button"
            tabIndex={0}
            onClick={runner.hearStimulus}
            className={`grid grid-cols-2 gap-4 cursor-pointer select-none rounded-2xl transition-all ${runner.stimulusTapped ? 'ring-2 ring-cyan-300/60' : ''}`}
          >
            {renderWordCard(
              item.targetWord,
              revealed ? `-${item.rime}` : '',
              showWordImage ? (currentChallenge?.targetWordImage ?? '') : '',
              item.targetEmoji,
            )}
            {item.comparisonWord && renderWordCard(
              item.comparisonWord,
              revealed && item.doesRhyme ? `-${item.rime}` : '',
              showWordImage ? (currentChallenge?.comparisonWordImage ?? '') : '',
              item.comparisonEmoji,
            )}
          </div>

          {/* No answer buttons: the child says yes or no. After the tutor
              affirms, the verdict lands on the CARDS — a rhyming pair lights
              up together, a non-rhyming one does not. */}
          <p className="text-center text-base text-slate-300 font-medium">
            {meta.icon} {meta.prompt}
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-5">
        {renderTargetCard(item)}
        <p className="text-center text-base text-slate-300 font-medium">
          {meta.icon} {meta.prompt}
        </p>
        {renderChoiceCards(item)}
      </div>
    );
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

  const modeMeta = MODE_META[currentItem?.mode ?? 'recognition'];

  return (
    <LuminaCard className={className}>
      {/* Adult chrome (title, grade badge, mode badge) hidden at PRE — band
          contract rule 7; the tutor names the activity by voice. */}
      {!isPreReader && (
        <LuminaCardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
              <LuminaBadge className="text-xs">Grade {gradeLevel}</LuminaBadge>
            </div>
            {!evaluation.hasSubmitted && currentItem && (
              <LuminaBadge accent={modeMeta.accent} className="text-xs">
                {modeMeta.icon} {modeMeta.badge}
              </LuminaBadge>
            )}
          </div>
        </LuminaCardHeader>
      )}

      <LuminaCardContent className="space-y-4">
        {!evaluation.hasSubmitted && (
          <>
            {!isPreReader && (
              <div className="flex justify-center">
                <LuminaChallengeCounter
                  current={Math.min(runner.currentIndex + 1, challenges.length)}
                  total={challenges.length}
                  variant="dots"
                />
              </div>
            )}

            {currentItem && renderChallenge(currentItem)}

            {/* Every mode here is answered out loud. */}
            <JudgedMicPanel run={runner} />
          </>
        )}

        {evaluation.hasSubmitted && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={evaluation.submittedResult?.score}
            durationMs={evaluation.elapsedMs}
            heading="Rhyme Studio Complete!"
            celebrationMessage={`You listened for rhymes in ${challenges.length} rounds — with your own ears and your own voice!`}
            className="mt-4"
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default RhymeStudio;
