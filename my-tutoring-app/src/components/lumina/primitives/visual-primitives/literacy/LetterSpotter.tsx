'use client';

/**
 * LetterSpotter — letter names and forms. It runs only on the shared tutor/JEV
 * teaching workspace (workspace rollout C2; the scripted runner was retired,
 * LA-14, user ruling 09-23: one path). The observer judges the spoken letter on
 * name it, the activity checks each tap on find it and match it, and the runtime
 * owns progression. An unbound mount shows the shared "needs the tutor" card.
 * There is no advance timer, no Check button, no Next button and no answer
 * anywhere on screen before it is credited.
 *
 * WHAT WENT, AND WHY (all four traced to one live session, 42edfc52e539):
 *  - **Three cue sites that each ordered the sentence re-read** — one on
 *    advance, one on a wrong answer ("re-read the sentence slowly") and, worst,
 *    one on a RIGHT answer ("read the full sentence aloud as celebration"). One
 *    item was spoken 2-4 times; the log has "I see an ant walk away" three
 *    times inside 13 seconds. The pack now speaks each item ONCE, and the only
 *    repeat is a child-initiated tap-to-hear.
 *  - **The advance handler, and every improvised tutor message this file used
 *    to push.** The cue queue they fed ran 8-16s behind the screen while the
 *    option buttons went live immediately, so the log shows a child answering
 *    before the question had finished being asked. Progression now has exactly
 *    one cause: a verdict.
 *  - **The three-attempt reveal-and-lock ladder.** Corrections cap in the
 *    runner and the lesson moves on; a hard item resurfaces through distributed
 *    review, not by drilling a five-year-old.
 *  - **The shape hint.** Group 1's `newLetters` IS the whole group, so the
 *    "NEW letter — hint at its shape" branch fired on every single item ("a
 *    triangle with a line across the middle"). That handed the answer to any
 *    child who knows letterforms. No cue in this pack may describe a letter's
 *    shape, at any tier, and the tap contract says so to the tutor explicitly.
 *
 * WHAT CHANGED AGAIN (2026-08-13, user ruling from session 6ada8c0a1bcf):
 *  - **name-it is SPOKEN, and its four option tiles are deleted.** "In real life
 *    … i ask the student to use context clues and the word to say the missing
 *    letter … they dont need to click a button." The tiles were never pedagogy:
 *    they existed because `letter_name` was marked BLOCKED, and they cost the
 *    mode its production task (a 1-in-4 menu is recognition) while smuggling the
 *    very homophony they were meant to avoid into the option set — the drive
 *    that produced the ruling offered n / s / i / a, and n and s share a cluster.
 *    The class is now `accepted-build-ahead`, judged against ONE target and
 *    accepting the letter's sound as well as its name.
 *
 * WHAT STAYED, AND WHY:
 *  - **find-it and match-it are still answered with the hands** — and only
 *    because their answers are not sayable. find-it's answer is a POSITION;
 *    match-it's is which lowercase FORM matches, which saying "S" would not
 *    demonstrate. Their verdicts stay CODE-COMPUTED (`commitGesture`), and the
 *    key never reaches the tutor.
 *  - **The printed word residue.** The click-era render replaced the WHOLE
 *    target word with the marker ("I see a ⭐ walk away"), which threw away the
 *    one decodable cue and left the sentence pure decoration — the data model
 *    already stored the marker over just the first character. It is rendered as
 *    stored now, so the sentence carries information again.
 *  - **The structural difficulty axis** (distractor letterform similarity) and
 *    the find-it target reference — both are RENDER levers a pre-reader can
 *    actually use. `strategyHint` did not survive: it was on-card text at a
 *    band that cannot read, and the tier now composes the spoken DISTAR lead-in
 *    instead (letterSpotterScript).
 *
 * Build gates, the asks and the tier ladder live in `letterSpotterScript.ts`; the
 * workspace assignment and scene in `letterSpotterWorkspace.ts`. Nothing in this
 * file writes a spoken line.
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
import { phaseResultsFromSummary } from '../../../hooks/usePhaseResults';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { LetterSpotterMetrics } from '../../../evaluation/types';
import { useLuminaAIContext } from '@/contexts/LuminaAIContext';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { commitGesture, useWorkspaceRunner, type TeachingEvaluationResult }
  from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { describeLetterTap, hearQuestionRequest, letterSpotterAssignment, letterSpotterMiss, letterSpotterScene } from './letterSpotterWorkspace';
import {
  itemsFromChallenges,
  SPOTTER_EMOJI,
  type LetterSpotterItem,
  type LetterSpotterMode,
  type LetterSpotterTier,
} from './letterSpotterScript';
import PhaseSummaryPanel, { type PhaseResult } from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import { CASE_LEVER, FIRST_LETTER_LEVER, PARTNER_LEVER, SCAN_LEVER, SMALL_GRID_LEVER, TWO_CHOICES_LEVER, firstLetterModelFor,
  letterSpotterLevers, partnerCapitals, practiceItem } from './letterSpotterLevers';
import { usePipSurface, usePipTargets } from '../../../pip/PipSurfaceContext';
import { letterSpotterPipPose } from '../../../pip/letterSpotterPipPose';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface LetterSpotterChallenge {
  id: string;
  mode: LetterSpotterMode;
  targetLetter: string;
  targetCase: 'uppercase' | 'lowercase' | 'both';
  /** name-it / match-it: the tappable letters, lowercase, answer included. */
  options?: string[];
  /** find-it: sixteen uppercase cells holding EXACTLY ONE target. Under the
   *  judged loop one tap is one commit, so a second target would be a second
   *  right answer to a question asked once. */
  letterGrid?: string[];
  /** find-it: instances of the target in the grid. Recomputed by the generator;
   *  1 under the judged loop. */
  targetCount?: number;
  /** name-it: the sentence as PRINTED — the marker sits over the target word's
   *  FIRST character ("I see an ⭐nt walk away."). */
  sentence?: string;
  /** name-it: the sentence as SPOKEN, word intact ("I see an ant walk away."). */
  spokenSentence?: string;
  /** name-it: the marker. Code-owned and invariant; kept on the type so cached
   *  pre-DI content still typechecks. */
  emoji?: string;
  /** name-it: the word whose first letter the marker hides ("ant"). */
  targetWord?: string;

  // ── Legacy within-mode support-tier scaffolds, stamped by the generator.
  //    `strategyHint` is INERT on the judged surface — on-card prose at a band
  //    that cannot read it. The tier now composes the spoken lead-in instead.
  //    `showTargetReference` is live: it is a picture, not prose. ──
  strategyHint?: string;
  showTargetReference?: boolean;
}

export interface LetterSpotterData {
  title: string;
  letterGroup: 1 | 2 | 3 | 4;
  cumulativeLetters: string[];
  newLetters: string[];
  challenges: LetterSpotterChallenge[];
  /** Canonical grade key ('K' | '1' | '2'…). Drives the pre-reader chrome gate. */
  gradeLevel?: string;
  /** Within-mode support tier from the manifest — the DISTAR lead-in ladder. */
  supportTier?: LetterSpotterTier;

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<LetterSpotterMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const MODE_META: Record<LetterSpotterMode, { badge: string; icon: string; accent: LuminaAccent }> = {
  'name-it': { badge: 'Sentence Spotter', icon: '⭐', accent: 'blue' },
  'find-it': { badge: 'Find It', icon: '🔎', accent: 'purple' },
  'match-it': { badge: 'Match It', icon: '🔤', accent: 'emerald' },
};

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);

// ============================================================================
// Props
// ============================================================================

interface LetterSpotterProps {
  data: LetterSpotterData;
  className?: string;
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted. */
  runtimeEvalMode?: string;
}

// ============================================================================
// Component
// ============================================================================

function LetterSpotterSurface({ data, className, runtimePlanItemId }: LetterSpotterProps) {
  const {
    title,
    letterGroup,
    cumulativeLetters = [],
    newLetters = [],
    challenges = [],
    gradeLevel = 'K',
    supportTier,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  /** Pre-reader band: adult chrome is hidden, never read (reader-fit rule 7). */
  const isPreReader = gradeLevel === 'K';
  const ctx = useLuminaAIContext();
  const workspace = useRef<TeachingWorkspace | null>(null);

  const stableInstanceIdRef = useRef(instanceId || `letter-spotter-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  const tier: LetterSpotterTier = supportTier ?? 'medium';

  /** Build gates drop what cannot be asked — a placeholder in a judged loop
   *  becomes a spoken ask the tutor has to stand behind. */
  const items = useMemo<LetterSpotterItem[]>(
    () => itemsFromChallenges(challenges, tier),
    [challenges, tier],
  );

  /** Render-only lookups the pack has no business carrying. */
  const challengeById = useMemo(
    () => new Map(challenges.map((ch) => [ch.id, ch])),
    [challenges],
  );

  // ── Per-item stage state ───────────────────────────────────────────────────
  /** The tapped letter (name-it / match-it) — cleared on retry and item open. */
  const [tapped, setTapped] = useState<string | null>(null);
  /** The tapped grid index (find-it) — a cell, not a letter. */
  const [tappedCell, setTappedCell] = useState<number | null>(null);
  // In-item levers (`letterSpotterLevers.ts`), keyed by the session item they were pulled on; the learner's
  // wrong taps on it (kept through Try again, for `wrong_choice_partner`); the easier practice item a simplify
  // lever put on screen in its place; and the row the `row_scan` highlight is on.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [wrongTaps, setWrongTaps] = useState<string[]>([]);
  const [practice, setPracticeState] = useState<LetterSpotterItem | null>(null);
  const practiceRef = useRef<LetterSpotterItem | null>(null);
  const [practiceSolved, setPracticeSolved] = useState(false);
  const setPractice = (next: LetterSpotterItem | null) => { practiceRef.current = next; setPracticeState(next); setPracticeSolved(false); };
  const [scanRow, setScanRow] = useState(0);
  /** [target, chosen] pairs from wrong taps — the confusion evidence this
   *  primitive exists to collect. */
  const confusedPairsRef = useRef<Array<[string, string]>>([]);

  // ── Evaluation ─────────────────────────────────────────────────────────────
  const evaluation = usePrimitiveEvaluation<LetterSpotterMetrics>({
    primitiveType: 'letter-spotter',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const finish = (summary: TeachingEvaluationResult) => {
    const rate = (predicate: (item: LetterSpotterItem) => boolean) => {
      const scoped = items.filter(predicate);
      if (scoped.length === 0) return 100;
      const solved = scoped.filter(
        (item) => summary.outcomes.find((o) => o.id === item.id)?.solved,
      ).length;
      return Math.round((solved / scoped.length) * 100);
    };

    // A spoken miss that is a single letter is a confusion pair too (name it); the taps recorded theirs as made.
    for (const attempt of summary.teachingAttempts ?? []) {
      const item = items.find((i) => i.id === attempt.itemId);
      const heard = attempt.response.trim().replace(/[.!?,]/g, '').toLowerCase();
      if (item?.mode === 'name-it' && attempt.source === 'speech' && !attempt.correct && /^[a-z]$/.test(heard)
          && heard !== item.targetLetter.toLowerCase()) confusedPairsRef.current.push([item.targetLetter.toLowerCase(), heard]);
    }

    const isNew = (item: LetterSpotterItem) =>
      newLetters.includes(item.targetLetter.toLowerCase());

    const metrics: LetterSpotterMetrics = {
      type: 'letter-spotter',
      letterGroup,
      challengesCorrect: summary.solvedCount,
      challengesTotal: items.length,
      newLetterAccuracy: rate(isNew),
      reviewLetterAccuracy: rate((item) => !isNew(item)),
      // Case accuracy is read off the FORM the child actually worked with, not
      // a `targetCase` field the click-era render never honoured (it printed
      // every option uppercase regardless). find-it grids and the match-it
      // stimulus are uppercase; the match-it ANSWER is the little form.
      // name-it counts as neither since its tiles went: a spoken letter name
      // carries no case at all.
      uppercaseAccuracy: rate((item) => item.mode !== 'name-it'),
      lowercaseAccuracy: rate((item) => item.mode === 'match-it'),
      confusedLetterPairs: Array.from(
        new Set(confusedPairsRef.current.map(([a, b]) => [a, b].sort().join('-'))),
      ),
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

  const runner = useWorkspaceRunner<LetterSpotterItem>({
    primitiveId: 'letter-spotter',
    assignment: letterSpotterAssignment,
    items,
    workspace,
    objectiveId,
    planItemId: runtimePlanItemId,
    // The SESSION's mode, from the mount: a mount's identity must not change while the workspace owns it.
    // Catalog modes are underscored (`name_it`); the item's mode is hyphenated (`name-it`).
    instanceId: resolvedInstanceId,
    onFinished: finish,
    onItemOpened: () => {
      setTapped(null);
      setTappedCell(null);
      setWrongTaps([]);
      setPractice(null);
    },
    onCorrectionRetry: () => {
      // Try again frees the surface for another go.
      setTapped(null);
      setTappedCell(null);
      pip.clear();
    },
  });

  const sessionItem = runner.currentItem;
  /** What is on screen: the practice item while a simplify lever holds it, else the session item. */
  const currentItem = practice ?? sessionItem;
  const pulledLevers = leverState.item === sessionItem?.id ? leverState.pulled : [];
  const leverOn = (id: string) => !practice && pulledLevers.includes(id);
  const showSummary = evaluation.hasSubmitted || !!runner.practiceSummary;

  // ── Pip shared surface ────────────────────────────────────────────────────
  // A projection of the workspace's committed state and the child's own tap; Pip never
  // answers, taps, or advances.
  const pip = usePipTargets(currentItem?.id ?? null, runner.canAttempt);
  const pipStore = usePipSurface(() => {
    if (!pip.dock.current || !currentItem || showSummary) return null;
    const targets = pip.targets();
    const pose = letterSpotterPipPose({
      running: runner.running, preparing: false,
      currentSolved: runner.currentSolved, revealHeld: runner.revealHeld,
      judging: runner.isAwaitingGesture(),
      // Audio belongs to this block only while the lesson is pointed at it.
      tutorSpeaking: ctx.isAudioPlaying && (ctx.sessionMode !== 'lesson' || ctx.activePrimitiveId === resolvedInstanceId),
      cueMatchesItem: runner.cuedItemId === currentItem.id,
      mode: currentItem.mode,
      visibleIds: targets.map((target) => target.id),
      lastTouchedId: pip.lastTouchedId,
    });
    return { instanceId: resolvedInstanceId, scopeId: currentItem.id, label: 'Letter spotter', dock: pip.dock.current, targets, pose };
  });
  const pipDock = pipStore && (
    <div ref={pip.dock} data-pip-dock={resolvedInstanceId}
      className="mx-auto flex min-h-28 w-full max-w-xl items-center rounded-2xl border border-cyan-300/10 bg-cyan-950/10 px-2" />
  );

  /** Credited: the first moment the answer may appear on screen. */
  const revealed = runner.currentSolved || practiceSolved;
  // Drawn from the pull, not from Try again: the host tells the tutor it is on screen at once (LB-16).
  const scanning = leverOn(SCAN_LEVER) && currentItem?.mode === 'find-it' && !revealed;
  // row_scan: the highlight moves on a clock, alike over every row, and never waits on the target's.
  useEffect(() => {
    if (!scanning) return;
    const timer = setInterval(() => setScanRow(r => (r + 1) % 4), 900);
    return () => clearInterval(timer);
  }, [scanning]);
  const partners = leverOn(PARTNER_LEVER) && sessionItem ? partnerCapitals(sessionItem, wrongTaps) : [];
  const firstModel = leverOn(FIRST_LETTER_LEVER) && sessionItem ? firstLetterModelFor(sessionItem, items, data.letterGroup) : null;

  // What the tutor and the observer are shown, republished every render.
  // W1 offers no demonstration targets and no presentation.
  useLayoutEffect(() => {
    if (!currentItem || !sessionItem) return;
    const levers = practice ? [] : letterSpotterLevers(sessionItem, pulledLevers, items, data.letterGroup, wrongTaps);
    const scene = letterSpotterScene(currentItem);
    const shown = [
      leverOn(CASE_LEVER) ? 'the named letter as a small letter on a card beside the grid' : '',
      leverOn(SCAN_LEVER) ? 'a highlight sweeping the rows of the grid one at a time, over and over' : '',
      partners.length ? `the big letter that goes with each little letter the learner tapped wrongly (${partners.join(', ')}), on that tile` : '',
      firstModel ? `a model on another word, ${firstModel.word}, as a picture and in print with its first letter lit: `
        + `${firstModel.word} starts with ${firstModel.letter.toUpperCase()}. It is not this item's word` : '',
    ].filter(Boolean);
    workspace.current = { ...scene,
      facts: { ...scene.facts, ...(shown.length ? { levers_on_screen: shown.join('; ') } : {}),
        ...(practice ? { practice: 'An easier practice item with a different letter, ungraded. The full item comes back after it.' } : {}) },
      levers,
      // A synchronous commit (the workspace runs it inside flushSync): the screen changes before this returns.
      pullLever: id => {
        const lever = levers.find(l => l.id === id);
        if (!lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled.`;
        if (id === SMALL_GRID_LEVER || id === TWO_CHOICES_LEVER) {
          const simpler = practiceItem(sessionItem, items, data.letterGroup);
          if (!simpler) return 'There is no easier item here.';
          setLeverState({ item: sessionItem.id, pulled: [...pulledLevers, id] });
          setPractice(simpler);
          setTapped(null); setTappedCell(null);
          return { practice: letterSpotterAssignment(simpler) };
        }
        setLeverState({ item: sessionItem.id, pulled: [...pulledLevers, id] });
        return true;
      },
      endPractice: () => { setPractice(null); setTapped(null); setTappedCell(null); },
    };
  });

  /** Asks the tutor for the question again: a silent host request, never the answer. */
  const hearQuestion = useCallback(() => {
    if (!currentItem) return;
    ctx.sendText(hearQuestionRequest(currentItem), { silent: true, author: 'host' });
  }, [ctx, currentItem]);

  // ── The tap IS the commit on find it and match it, checked by the activity ──
  const commitTap = useCallback((item: LetterSpotterItem, letter: string) => {
    if (!runner.canAttempt || showSummary) return false;
    // `canAttempt` closes through batched state; this stops a second tap in the same
    // tick from recording a second confusion pair.
    if (runner.isAwaitingGesture()) return false;
    SoundManager.tap();
    setTapped(letter);
    const correct = letter.toLowerCase() === item.targetLetter.toLowerCase();
    // The practice item is ungraded: it stays out of the confusion pairs, and its success is local.
    if (practiceRef.current) { if (correct) setPracticeSolved(true); }
    else if (!correct) {
      confusedPairsRef.current.push([item.targetLetter.toLowerCase(), letter.toLowerCase()]);
      setWrongTaps(prev => prev.concat(letter.toLowerCase()));
    }
    commitGesture(runner, { response: describeLetterTap(letter), correct, cue: () => describeLetterTap(letter),
      miss: letterSpotterMiss(item, letter) });
    return true;
  }, [runner, showSummary]);

  const handleOptionTap = useCallback((letter: string) => {
    const item = practiceRef.current ?? runner.currentItem;
    // match-it is the only tile mode left — name-it's answer is spoken.
    if (!item || item.mode !== 'match-it') return;
    commitTap(item, letter);
  }, [runner, commitTap]);

  const handleCellTap = useCallback((index: number) => {
    const item = practiceRef.current ?? runner.currentItem;
    if (!item || item.mode !== 'find-it') return;
    const letter = item.letterGrid?.[index];
    if (!letter) return;
    if (commitTap(item, letter)) setTappedCell(index);
  }, [runner, commitTap]);

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

  const letterColor = (letter: string) =>
    VOWELS.has(letter.toLowerCase()) ? 'text-red-300' : 'text-blue-300';

  /** The tappable answer tiles — match-it ONLY. Lowercase, because the match-it
   *  answer IS the little form. (The click-era render printed every option
   *  uppercase while the tutor described a lowercase shape — the buttons said
   *  "I", the tutor said "a straight line with a little dot on top".)
   *
   *  name-it lost its tiles in the 2026-08-13 ruling: a four-way menu turned
   *  "say the letter this word starts with" into a 1-in-4 recognition task, and
   *  the menu is the reason the mode was ever a tap. */
  const renderOptions = (item: LetterSpotterItem) => (
    <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
      {item.options.map((option) => {
        const isTarget = option.toLowerCase() === item.targetLetter.toLowerCase();
        const state = revealed && isTarget
          ? 'correct'
          : tapped === option && !isTarget
            ? 'incorrect'
            : 'idle';
        return (
          <button
            key={`${item.id}-${option}`}
            type="button"
            ref={pip.ref(`option-${option}`)}
            data-pip-object={`option-${option}`}
            onClick={() => { pip.look(`option-${option}`); handleOptionTap(option); }}
            disabled={!runner.canAttempt}
            className={`
              h-20 rounded-xl border-2 text-4xl font-bold transition-all
              ${answerStateClass(state)}
              ${state === 'idle' ? letterColor(option) : ''}
              ${revealed && isTarget ? 'ring-2 ring-emerald-400/40 scale-105' : ''}
            `}
          >
            {option}
            {/* wrong_choice_partner: the big letter this wrongly tapped little letter goes with. */}
            {partners.includes(option.toLowerCase()) && (
              <span data-lever="partner-capital" className="ml-2 text-2xl text-slate-300">{option.toUpperCase()}</span>
            )}
          </button>
        );
      })}
    </div>
  );

  const renderChallenge = (item: LetterSpotterItem) => {
    switch (item.mode) {
      // ── Hear a sentence, SAY the letter the marker is hiding ──────────────
      case 'name-it': {
        const printed = item.sentence ?? '';
        const parts = printed.split(SPOTTER_EMOJI);
        return (
          <div className="space-y-6">
            {/* The sentence. Tapping it re-speaks the QUESTION — the click-era
                item had no replay at all, and its audio ran up to 16s behind. */}
            <div className="flex justify-center">
              <div
                role="button"
                tabIndex={0}
                onClick={hearQuestion}
                className="bg-white/5 border-2 border-white/15 rounded-2xl px-8 py-6 max-w-lg cursor-pointer transition-all"
              >
                <p className="text-3xl font-bold text-slate-100 text-center leading-relaxed">
                  {parts.map((part, i) => (
                    <React.Fragment key={i}>
                      {part}
                      {i < parts.length - 1 && (
                        <span ref={pip.ref('marker')} data-pip-object="marker" className="relative inline-block mx-0.5">
                          <span className="absolute inset-0 -m-1.5 rounded-full border-2 border-dashed border-amber-400/70 animate-pulse" />
                          {revealed ? (
                            <span className="text-4xl text-emerald-300">
                              {item.targetLetter}
                            </span>
                          ) : (
                            <span className="text-4xl" role="img" aria-label="hidden letter">
                              {SPOTTER_EMOJI}
                            </span>
                          )}
                        </span>
                      )}
                    </React.Fragment>
                  ))}
                </p>
              </div>
            </div>
            {/* first_letter_model: another word, its first letter lit. Never a session target letter. */}
            {firstModel && (
              <div data-lever="first-letter-model" aria-label="First letter model"
                className="mx-auto flex w-fit items-center gap-4 rounded-2xl border border-cyan-300/20 bg-cyan-950/10 px-5 py-3">
                <span className="text-4xl" role="img" aria-label={firstModel.word}>{firstModel.emoji}</span>
                <span className="text-3xl font-bold text-slate-300">
                  <span data-lit="true" className="rounded-md bg-cyan-400/25 px-1 text-cyan-100">{firstModel.word[0]}</span>
                  {firstModel.word.slice(1)}
                </span>
              </div>
            )}
            {/* No answer tiles. The sentence IS the whole stage — the child
                reads the star, hears the word, and says the letter. */}
            {pipDock}
          </div>
        );
      }

      // ── Hear a letter named, tap the one cell holding it ──────────────────
      case 'find-it': {
        const grid = item.letterGrid ?? [];
        const showReference = challengeById.get(item.id)?.showTargetReference;
        // A practice grid of four sits in two columns; the session grid in four.
        const cols = grid.length === 4 ? 'grid-cols-2 max-w-[12rem]' : 'grid-cols-4 max-w-md';
        return (
          <div className="space-y-4">
            <div className="flex justify-center">
              <button
                onClick={hearQuestion}
                className="flex items-center justify-center w-20 h-20 rounded-full
                  bg-amber-500/15 border-2 border-amber-500/30
                  hover:bg-amber-500/25 hover:scale-105 active:scale-95 transition-all"
                aria-label="Hear the letter again"
              >
                <span className="text-3xl">🔊</span>
              </button>
            </div>

            {/* Perception support (tier lever). It prints the letter to FIND —
                the answer is WHERE it is, so this is a reference, not a reveal. */}
            {showReference && (
              <div className="flex justify-center">
                <div className="bg-white/5 border-2 border-white/15 rounded-xl px-5 py-2 flex items-center gap-3">
                  <span className="text-slate-400 text-xs">Looking for</span>
                  <span className={`text-2xl font-bold ${letterColor(item.targetLetter)}`}>
                    {item.targetLetter.toUpperCase()}
                  </span>
                </div>
              </div>
            )}

            {/* other_case_reference: the named letter in the OTHER case than the grid. */}
            {leverOn(CASE_LEVER) && (
              <div className="flex justify-center">
                <div data-lever="other-case-reference" className="bg-white/5 border-2 border-cyan-400/30 rounded-xl px-5 py-2">
                  <span className={`text-3xl font-bold ${letterColor(item.targetLetter)}`}>{item.targetLetter.toLowerCase()}</span>
                </div>
              </div>
            )}

            {/* Pip outlines the grid as a whole; every cell is a choice. */}
            {pipDock}

            <div ref={pip.ref('grid')} data-pip-object="grid" data-lever={scanning ? 'row-scan' : undefined} className={`grid ${cols} gap-2 mx-auto`}>
              {grid.map((letter, i) => {
                const isTarget = letter.toLowerCase() === item.targetLetter.toLowerCase();
                const state = revealed && isTarget
                  ? 'correct'
                  : tappedCell === i && !isTarget
                    ? 'incorrect'
                    : 'idle';
                return (
                  <button
                    key={`${item.id}-${i}`}
                    ref={pip.ref(`cell-${i}`)}
                    data-pip-object={`cell-${i}`}
                    data-scan-row={scanning && Math.floor(i / 4) === scanRow ? 'lit' : undefined}
                    onClick={() => { pip.look(`cell-${i}`); handleCellTap(i); }}
                    disabled={!runner.canAttempt}
                    className={`
                      aspect-square rounded-xl border-2 font-bold text-2xl
                      transition-all select-none
                      ${answerStateClass(state)}
                      ${scanning && Math.floor(i / 4) === scanRow ? 'ring-2 ring-cyan-300/70 bg-cyan-400/10' : ''}
                      ${revealed && isTarget ? 'ring-2 ring-emerald-400/40 scale-105' : ''}
                    `}
                  >
                    {letter}
                  </button>
                );
              })}
            </div>
          </div>
        );
      }

      // ── See a big letter, tap its little form ────────────────────────────
      case 'match-it':
        return (
          <div className="space-y-6">
            <div className="flex justify-center">
              <div
                role="button"
                tabIndex={0}
                ref={pip.ref('letter')}
                data-pip-object="letter"
                onClick={hearQuestion}
                className={`
                  text-8xl font-bold ${letterColor(item.targetLetter)}
                  bg-white/5 border-2 border-white/15 rounded-2xl
                  px-12 py-8 select-none cursor-pointer transition-all
                `}
              >
                {item.targetLetter.toUpperCase()}
              </div>
            </div>
            {/* Between the big letter and the little ones, so a pointer to the
                question side never crosses an option. */}
            {pipDock}
            {renderOptions(item)}
          </div>
        );
    }
  };

  // ============================================================================
  // Main render
  // ============================================================================

  if (items.length === 0 || !currentItem) {
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
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
          {/* Pre-reader: hide adult chrome (group/mode badges) — rule 7. */}
          {!isPreReader && !showSummary && (
            <div className="flex items-center gap-2">
              <LuminaBadge className="text-xs">Group {letterGroup}</LuminaBadge>
              <LuminaBadge accent={modeMeta.accent} className="text-xs">
                {modeMeta.icon} {modeMeta.badge}
              </LuminaBadge>
            </div>
          )}
        </div>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {!showSummary && (
          <>
            <div className="flex justify-center">
              <LuminaChallengeCounter
                current={Math.min(runner.currentIndex + 1, items.length)}
                total={items.length}
                variant="dots"
              />
            </div>

            {renderChallenge(currentItem)}
          </>
        )}

        {showSummary && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={evaluation.submittedResult?.score ?? runner.teachingResult?.accuracy}
            durationMs={evaluation.elapsedMs}
            heading="Letter Spotting Complete!"
            celebrationMessage={`You spotted letters across ${items.length} rounds — ${cumulativeLetters.length} letters in play!`}
            className="mt-4"
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
}

// The teaching workspace is the only path: an unbound mount shows the "needs the tutor" card.
const LetterSpotter = withWorkspaceOnly<LetterSpotterProps>('letter-spotter', LetterSpotterSurface, props => props.data.title);

export default LetterSpotter;
