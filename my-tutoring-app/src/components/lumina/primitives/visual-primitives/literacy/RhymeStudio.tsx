'use client';

/**
 * RhymeStudio — every mode is answered out loud. It runs only on the shared
 * tutor/JEV teaching workspace (workspace rollout C1; the scripted runner was
 * retired, LA-14, user ruling 09-23: one path). The tutor teaches in its own words,
 * the observer judges each spoken answer and the runtime owns progression. An
 * unbound mount shows the shared "needs the tutor" card. There is no advance timer,
 * no Next button and no Start-Activity gate in this file.
 *
 * WHAT THE CHILD DOES: every mode is answered ALOUD. Nothing here is tappable
 * except the cards, which repeat the question.
 *  - identification: say the word that rhymes from the visible closed set.
 *  - production: think of any real rhyme with no answer bank.
 *  - collection: fill three retained slots with distinct open rhymes; only
 *    learner-produced accepted words appear in those slots.
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
 * after the answer is credited. Tap-to-hear re-speaks the QUESTION, never the
 * answer.
 */

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
import { useLuminaAIContext } from '@/contexts/LuminaAIContext';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceRunner, type TeachingEvaluationResult }
  from '../../../components/live-activity/runtime/useWorkspaceRunner';
import {
  itemsFromChallenge,
  recordCollectedRhyme,
  type RhymeItem,
  type RhymeMode,
  type RhymeTier,
} from './rhymeStudioScript';
import { hearRhymeRequest, rhymeAssignment, rhymeScene } from './rhymeStudioWorkspace';
import {
  CONTRAST_LEVER, DENSE_LEVER, FAR_FOIL_LEVER, FAR_PAIR_LEVER, NAME_CHOICES_LEVER, STRIP_LEVER, SWAP_LEVER,
  contrastModelFor, leversOnScreen, onsetCardsFor, practiceItemFor, rhymeStudioLevers, swapModelFor, usedOnsets,
} from './rhymeStudioLevers';
import { onsetOf, rimeOfWord } from './rhymeModels';
import { SoundManager } from '../../../utils/SoundManager';
import { isPreReaderGrade } from '../../../utils/kindergartenMode';
import PhaseSummaryPanel, { type PhaseResult } from '../../../components/PhaseSummaryPanel';
import { phaseResultsFromSummary } from '../../../hooks/usePhaseResults';
import { stableShuffle } from '../../../utils/choiceOrder';
import { usePipSurface, usePipTargets } from '../../../pip/PipSurfaceContext';
import { rhymeStudioPipPose } from '../../../pip/rhymeStudioPipPose';

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
  /** Identification only. Production is OPEN and enumerates nothing — see the
   *  bank-deletion note in rhymeStudioScript.ts. */
  acceptableAnswers?: string[];
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
  // #5 answer-form (`productionCorrectCount`) RETIRED 2026-08-19: it tuned how
  // many of the four production bank tiles rhymed, and the bank is deleted.
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
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted. */
  runtimeEvalMode?: string;
}

// ============================================================================
// Constants
// ============================================================================

const MODE_META: Record<RhymeMode, { badge: string; icon: string; accent: LuminaAccent; prompt: string }> = {
  recognition: { badge: 'Do They Rhyme?', icon: '👂', accent: 'blue', prompt: 'Listen… then say yes or no!' },
  identification: { badge: 'Find the Rhyme', icon: '🔍', accent: 'purple', prompt: 'Say the one that rhymes!' },
  // Production is OPEN since 2026-08-19 (the word bank is deleted). No card, no
  // menu — the prompt must not point at a surface the child cannot answer from,
  // and "Think of" is the honest verb for what the mode now asks.
  production: { badge: 'Think of a Rhyme', icon: '💭', accent: 'emerald', prompt: 'Think of a word that rhymes!' },
  collection: { badge: 'Build a Rhyme Family', icon: '🧺', accent: 'amber', prompt: 'Fill all three spots with different rhymes!' },
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

function RhymeStudioSurface({ data, className, runtimePlanItemId }: RhymeStudioProps) {
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

  const ctx = useLuminaAIContext();
  const workspace = useRef<TeachingWorkspace | null>(null);

  // ── Items ─────────────────────────────────────────────────────────────────
  const items = useMemo<RhymeItem[]>(
    () => challenges
      .flatMap((ch) => itemsFromChallenge(ch, supportTier ?? 'medium'))
      .map((item) => item.choices.length < 2
        ? item
        : {
            ...item,
            choices: stableShuffle(
              item.choices,
              `${resolvedInstanceId}|${item.id}|${item.choices.map((choice) => choice.word).join('|')}`,
            ),
          }),
    [challenges, supportTier, resolvedInstanceId],
  );
  const [collectedFamilies, setCollectedFamilies] = useState<Record<string, string[]>>({});
  useEffect(() => {
    setCollectedFamilies({});
  }, [items]);
  const collectedFor = (item: RhymeItem) =>
    collectedFamilies[item.collectionId ?? item.challengeId] ?? item.priorAcceptedWords;
  // In-item levers (`rhymeStudioLevers.ts`), keyed by the session item they were pulled on, and the easier
  // practice item a simplify lever put on screen in its place.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<RhymeItem | null>(null);

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

  const finish = (summary: TeachingEvaluationResult) => {
    // Per-mode accuracy: join the run's outcomes back onto the challenges that
    // produced them. The IRT ladder reads these three fields per eval mode, so
    // they survive the port unchanged in shape.
    const byMode: Record<RhymeMode, { score: number; count: number }> = {
      recognition: { score: 0, count: 0 },
      identification: { score: 0, count: 0 },
      production: { score: 0, count: 0 },
      collection: { score: 0, count: 0 },
    };
    for (const item of items) {
      const outcome = summary.outcomes.find((o) => o.id === item.id);
      if (!outcome) continue;
      byMode[item.mode].score += outcome.score;
      byMode[item.mode].count += 1;
    }
    const pct = (mode: RhymeMode) =>
      byMode[mode].count > 0 ? Math.round(byMode[mode].score / byMode[mode].count) : 0;

    const metrics: RhymeStudioMetrics = {
      type: 'rhyme-studio',
      challengeMode: items[0]?.mode ?? 'recognition',
      challengesCorrect: summary.solvedCount,
      challengesTotal: items.length,
      recognitionAccuracy: pct('recognition'),
      identificationAccuracy: pct('identification'),
      productionAccuracy: pct('production'),
      collectionAccuracy: pct('collection'),
      rhymeFamiliesPracticed: Array.from(new Set(challenges.map((ch) => ch.rhymeFamily))),
      attemptsCount: summary.attemptsCount,
    };
    evaluation.submitResult(
      summary.passed,
      summary.accuracy,
      metrics,
      { challengeResults: summary.outcomes, learningResponses: summary.learningResponses,
        ...(summary.teachingAttempts ? { teachingAttempts: summary.teachingAttempts, assistanceProvenance: summary.assistanceProvenance } : {}) },
      undefined,
      summary.diagnosisEvidence,
    );
  };

  /** A credited collection answer fills the family's next spot with the word the learner said. */
  const handleAffirmed = (item: RhymeItem, response?: string) => {
    if (item.mode !== 'collection' || !item.collectionId) return;
    const words = recordCollectedRhyme(items, item, response ?? '');
    setCollectedFamilies((current) => ({ ...current, [item.collectionId!]: words }));
  };

  const runner = useWorkspaceRunner<RhymeItem>({
    primitiveId: 'rhyme-studio',
    // A collection slot must not repeat a rhyme the family already holds.
    assignment: item => rhymeAssignment(item, collectedFor(item)),
    items,
    workspace,
    objectiveId,
    planItemId: runtimePlanItemId,
    // The SESSION's mode, from the mount: a mount's identity must not change while the workspace owns it.
    instanceId: resolvedInstanceId,
    onFinished: finish,
    onAffirmed: handleAffirmed,
  });

  const sessionItem = runner.currentItem;
  /** What is on screen: the practice item while a simplify lever holds it, else the session item. */
  const currentItem = practice ?? sessionItem;
  const pulledLevers = practice || leverState.item !== sessionItem?.id ? [] : leverState.pulled;
  const contrastModel = pulledLevers.includes(CONTRAST_LEVER) ? contrastModelFor(items) : null;
  const swapModel = pulledLevers.includes(SWAP_LEVER) ? swapModelFor(items) : null;
  const showSummary = evaluation.hasSubmitted || !!runner.practiceSummary;
  /** Credited: the first moment the answer may appear on screen. */
  const revealed = runner.currentSolved;
  // A practice item has no challenge: no caption, no tier highlight.
  const currentChallenge = practice ? undefined : challenges.find((challenge) => challenge.id === currentItem?.challengeId);

  // ── Pip shared surface ────────────────────────────────────────────────────
  // A projection of the workspace's committed state onto the card the ask names; Pip never
  // answers, judges, or advances.
  const pip = usePipTargets(currentItem?.id ?? null, false);
  const pipStore = usePipSurface(() => {
    if (!pip.dock.current || !currentItem || showSummary) return null;
    const targets = pip.targets(undefined, (id) => (id === 'pair' ? 'The two words' : 'The word card'));
    const pose = rhymeStudioPipPose({
      mode: currentItem.mode,
      running: runner.running, preparing: false,
      currentSolved: runner.currentSolved, revealHeld: runner.revealHeld, judging: false,
      // Audio belongs to this block only while the lesson is pointed at it.
      tutorSpeaking: ctx.isAudioPlaying && (ctx.sessionMode !== 'lesson' || ctx.activePrimitiveId === resolvedInstanceId),
      cueMatchesItem: runner.cuedItemId === currentItem.id,
      visibleIds: targets.map((target) => target.id),
    });
    return { instanceId: resolvedInstanceId, scopeId: currentItem.id, label: 'Rhyme studio', dock: pip.dock.current, targets, pose };
  });

  // ── Support-tier display levers (read with `!== false` so an ABSENT field is
  //    the full-help render). The band support always WINS at PRE. ──
  const showRhymeFamilyHighlight = !practice && currentChallenge?.showRhymeFamilyHighlight !== false;
  const showWordImage = isPreReader || currentChallenge?.showWordImage !== false;

  // What the tutor and the observer are shown, republished every render.
  // W1 offers no demonstration targets and no presentation.
  useLayoutEffect(() => {
    if (!currentItem || !sessionItem) return;
    const levers = practice ? [] : rhymeStudioLevers(sessionItem, pulledLevers, items);
    const scene = rhymeScene(currentItem, { collected: collectedFor(currentItem), familyShown: showRhymeFamilyHighlight && !isPreReader });
    const onScreen = leversOnScreen(currentItem, pulledLevers, items);
    workspace.current = { ...scene,
      facts: { ...scene.facts,
        ...(pulledLevers.includes(NAME_CHOICES_LEVER) ? { namingChoices: 'Read every choice aloud, in screen order, evenly; stress none.' } : {}),
        ...(onScreen ? { levers_on_screen: onScreen } : {}),
        ...(practice ? { practice: 'An easier practice item on other words, ungraded. The full item comes back after it.' } : {}) },
      levers,
      // A synchronous commit (the workspace runs it inside flushSync): the screen changes before this returns.
      pullLever: id => {
        const lever = levers.find(l => l.id === id);
        if (!lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled.`;
        if (id === FAR_PAIR_LEVER || id === FAR_FOIL_LEVER || id === DENSE_LEVER) {
          const simpler = practiceItemFor(sessionItem, items);
          if (!simpler) return 'There is no easier item here.';
          setLeverState({ item: sessionItem.id, pulled: [...pulledLevers, id] });
          setPractice(simpler);
          return { practice: rhymeAssignment(simpler) };
        }
        setLeverState({ item: sessionItem.id, pulled: [...pulledLevers, id] });
        return true;
      },
      endPractice: () => setPractice(null),
    };
  });

  /** Tapping a card asks the tutor for the question again: a silent host request, never the answer. */
  const hearQuestion = useCallback(() => {
    if (!currentItem) return;
    SoundManager.tap();
    ctx.sendText(hearRhymeRequest(currentItem), { silent: true, author: 'host' });
  }, [ctx, currentItem]);

  // ── Phase summary ─────────────────────────────────────────────────────────
  const phaseResults = useMemo<PhaseResult[]>(() => {
    if (!runner.practiceSummary) return [];
    return phaseResultsFromSummary(items, runner.practiceSummary, (item) => {
      const meta = MODE_META[item.mode];
      return { label: meta.badge, icon: meta.icon };
    });
  }, [runner.practiceSummary, items]);

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
        ref={pip.ref('target')}
        data-pip-object="target"
        role="button"
        tabIndex={0}
        onClick={hearQuestion}
        className="cursor-pointer select-none rounded-2xl transition-all"
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
          {pulledLevers.includes(NAME_CHOICES_LEVER) && (
            <span data-lever="name-choice" role="img" aria-label="read aloud" className="text-base leading-none">🔊</span>
          )}
        </div>
      ))}
    </div>
  );

  /** Collection shows only learner-produced words. Empty spots are neutral
   *  placeholders, never example answers that could drain the open set. */
  const renderCollectionSlots = (item: RhymeItem) => {
    const collectionId = item.collectionId ?? item.challengeId;
    const accepted = collectedFamilies[collectionId] ?? item.priorAcceptedWords;
    const size = item.collectionSize ?? 3;
    return (
      <div className="grid grid-cols-3 gap-3" aria-label="Your rhyme family">
        {Array.from({ length: size }, (_, index) => {
          const word = accepted[index];
          return (
            <div
              key={`${collectionId}-visible-slot-${index + 1}`}
              aria-label={word ? `Rhyme ${index + 1}: ${word}` : `Empty rhyme spot ${index + 1}`}
              className={`min-h-20 rounded-xl border-2 px-3 py-4 flex items-center justify-center text-center transition-all ${
                word
                  ? 'border-emerald-400/60 bg-emerald-500/10 text-emerald-100'
                  : 'border-dashed border-white/20 bg-white/[0.03] text-slate-500'
              }`}
            >
              <span className="text-xl font-bold">{word || `Rhyme ${index + 1}`}</span>
            </div>
          );
        })}
      </div>
    );
  };

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
            ref={pip.ref('pair')}
            data-pip-object="pair"
            role="button"
            tabIndex={0}
            onClick={hearQuestion}
            className="grid grid-cols-2 gap-4 cursor-pointer select-none rounded-2xl transition-all"
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
        {/* PRODUCTION RENDERS NO CARDS — the word bank was deleted when
            `open_set_word` cleared its bench (2026-08-19). The screen shows the
            STIMULUS and nothing else, which is the whole difference between
            reading four words and saying one, and thinking of a rhyme.
            `item.choices` is empty there by construction, so this is a guard on
            intent rather than on data. */}
        {item.mode === 'identification' && renderChoiceCards(item)}
        {item.mode === 'collection' && renderCollectionSlots(item)}
        {pulledLevers.includes(STRIP_LEVER) && renderOnsetStrip(item)}
        {swapModel && renderSwapModel(swapModel)}
      </div>
    );
  };

  /** A model word with the part the model teaches lit: its ending (`end`) or its first sound (`start`). */
  const renderModelWord = (word: string, emoji: string, lit: 'end' | 'start') => {
    const cut = lit === 'end' ? word.length - rimeOfWord(word).length : onsetOf(word).length;
    const [head, tail] = [word.slice(0, cut), word.slice(cut)];
    return (
      <div className="flex flex-col items-center gap-0.5 px-2">
        <span className="text-4xl leading-none" role="img" aria-label={word}>{emoji}</span>
        {!isPreReader && (
          <span className="text-lg font-semibold text-slate-200">
            {lit === 'start' ? <><span className="text-cyan-300">{head}</span>{tail}</> : <>{head}<span className="text-amber-300">{tail}</span></>}
          </span>
        )}
      </div>
    );
  };

  /** Help: a rhyme and a same-start pair on model words outside the session. The item's words are untouched. */
  const renderContrastModel = (model: NonNullable<typeof contrastModel>) => {
    const [a, b] = model.words;
    return (
      <div data-lever="contrast-model" aria-label="Rhyme model" className="rounded-2xl border border-amber-300/20 bg-amber-950/10 p-3 space-y-2">
        <div data-model-row="rhyme" className="flex items-center justify-center gap-2 rounded-xl ring-2 ring-amber-300/50 py-2">
          {renderModelWord(a.word, a.emoji, 'end')}
          <span aria-hidden className="text-2xl">🎵</span>
          {renderModelWord(b.word, b.emoji, 'end')}
        </div>
        <div data-model-row="start" className="flex items-center justify-center gap-2 rounded-xl ring-2 ring-cyan-300/40 py-2">
          {renderModelWord(a.word, a.emoji, 'start')}
          <span aria-hidden className="text-2xl">✋</span>
          {renderModelWord(model.onsetFoil.word, model.onsetFoil.emoji, 'start')}
        </div>
      </div>
    );
  };

  /** Help: one model word, its first sound changed twice. */
  const renderSwapModel = (model: NonNullable<typeof swapModel>) => (
    <div data-lever="swap-model" aria-label="First sound model" className="flex items-center justify-center gap-1 rounded-2xl border border-cyan-300/20 bg-cyan-950/10 p-3">
      {model.words.slice(0, 3).map((w, i) => (
        <React.Fragment key={w.word}>
          {i > 0 && <span aria-hidden className="text-xl text-slate-400">→</span>}
          {renderModelWord(w.word, w.emoji, 'start')}
        </React.Fragment>
      ))}
    </div>
  );

  /** Help: single first sounds on pictures, never the target's; a collection greys the ones it already used. */
  const renderOnsetStrip = (item: RhymeItem) => {
    const used = usedOnsets(item.mode === 'collection' ? collectedFor(item) : []);
    return (
      <div data-lever="onset-strip" aria-label="First sounds" className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {onsetCardsFor(item).map((card) => (
          <div key={card.sound} data-onset={card.sound} data-used={used.has(card.sound) ? 'true' : undefined}
            className={`rounded-xl border border-white/10 bg-white/5 p-2 flex flex-col items-center ${used.has(card.sound) ? 'opacity-30' : ''}`}>
            <span className="text-3xl leading-none" role="img" aria-label={card.word}>{card.emoji}</span>
            {!isPreReader && <span className="text-base font-bold text-cyan-300">{card.sound}</span>}
          </div>
        ))}
      </div>
    );
  };

  // ============================================================================
  // Main render
  // ============================================================================

  if (challenges.length === 0 || !currentItem) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-6">
          <p className="text-slate-400 text-center">No challenges available.</p>
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  const modeMeta = MODE_META[currentItem.mode];

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
            {!showSummary && (
              <LuminaBadge accent={modeMeta.accent} className="text-xs">
                {modeMeta.icon} {modeMeta.badge}
              </LuminaBadge>
            )}
          </div>
        </LuminaCardHeader>
      )}

      <LuminaCardContent className="space-y-4">
        {!showSummary && (
          <>
            {!isPreReader && (
              <div className="flex justify-center">
                <LuminaChallengeCounter
                  current={Math.min(runner.currentIndex + 1, items.length)}
                  total={items.length}
                  variant="dots"
                />
              </div>
            )}

            {/* Pip's dock sits above the stage: a pointer to the word card
                never crosses a choice card or a rhyme slot below it. */}
            {pipStore && (
              <div ref={pip.dock} data-pip-dock={resolvedInstanceId}
                className="mx-auto flex min-h-28 w-full max-w-xl items-center rounded-2xl border border-cyan-300/10 bg-cyan-950/10 px-2" />
            )}

            {renderChallenge(currentItem)}
            {contrastModel && renderContrastModel(contrastModel)}
          </>
        )}

        {showSummary && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={evaluation.submittedResult?.score ?? runner.teachingResult?.accuracy}
            durationMs={evaluation.elapsedMs}
            heading="Rhyme Studio Complete!"
            celebrationMessage={`You listened for rhymes in ${items.length} rounds — with your own ears and your own voice!`}
            className="mt-4"
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
}

// The teaching workspace is the only path: an unbound mount shows the "needs the tutor" card.
const RhymeStudio = withWorkspaceOnly<RhymeStudioProps>('rhyme-studio', RhymeStudioSurface, props => props.data.title);

export default RhymeStudio;
