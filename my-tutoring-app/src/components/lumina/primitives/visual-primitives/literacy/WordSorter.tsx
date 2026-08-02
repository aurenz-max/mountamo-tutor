'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { WordSorterMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import {
  LuminaChip,
  LuminaCard,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaCardContent,
  LuminaBadge,
  LuminaPanel,
  LuminaActionButton,
  LuminaDropZone,
  LuminaReadAloudGlyph,
  type DropZoneState,
} from '../../../ui';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface WordCard {
  id: string;
  word: string;
  emoji?: string;
  correctBucket: string;
}

export interface MatchPair {
  id: string;
  term: string;
  termEmoji?: string;
  match: string;
  matchEmoji?: string;
}

/** A non-answer entry shown in the match column (support-tier answer-form lever). */
export interface DistractorMatch {
  id: string;
  text: string;
  emoji?: string;
}

export interface WordSorterChallenge {
  id: string;
  type: 'binary_sort' | 'ternary_sort' | 'match_pairs';
  instruction: string;
  bucketLabels?: string[];
  /** Optional emoji per bucket, index-aligned with bucketLabels (pre-reader answer surface). */
  bucketEmojis?: string[];
  words?: WordCard[];
  pairs?: MatchPair[];

  // ── Within-mode support tier scaffolds (stamped by the generator from
  //    config.difficulty). Display / instruction only — they NEVER change which
  //    words are drawn or which bucket is correct. ALL OPTIONAL: absent ⇒ the
  //    legacy full-help render, so every read below uses `!== false` (or an
  //    explicit opt-in where the legacy render showed nothing). ──
  /**
   * #1 perception — the picture cue on each bucket.
   * At K this is FORCED on by the band floor (bucket emoji are the pre-reader
   * answer surface). At reader grades the cue is opt-IN: the legacy render showed
   * label-only, so it appears only when a tier explicitly grants it.
   */
  showBucketEmojis?: boolean;
  /** #1 perception — badges of the words already filed in each bucket. Default: shown. */
  showFiledWords?: boolean;
  /** #2 instruction — the instruction names the sort criterion. Default: named. */
  namesSortCriterion?: boolean;
  /** #5 answer-form (match_pairs) — extra non-answer entries in the match column. */
  distractorMatches?: DistractorMatch[];
}

export interface WordSorterData {
  title: string;
  description?: string;
  gradeLevel: string;
  sortingTopic: string;
  /** Within-mode support tier from the manifest. Threaded to the tutor reveal policy. */
  supportTier?: 'easy' | 'medium' | 'hard';
  challenges: WordSorterChallenge[];

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<WordSorterMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const CHALLENGE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  binary_sort:  { label: 'Two Buckets',   icon: '📂', accentColor: 'purple' },
  ternary_sort: { label: 'Three Buckets', icon: '🗂️', accentColor: 'blue' },
  match_pairs:  { label: 'Match Pairs',   icon: '🔗', accentColor: 'emerald' },
};

const BUCKET_COLORS = [
  { text: 'text-violet-300' },
  { text: 'text-sky-300' },
  { text: 'text-emerald-300' },
];

/**
 * Tutor reveal policy keyed to the within-mode support tier. The tutor is a second
 * scaffold channel, so its reveal latitude must MATCH what is on screen:
 *  - easy   → name each bucket aloud and restate the sorting rule in child terms.
 *  - medium → name the buckets and ask the question, but stop pre-chewing the rule.
 *  - hard   → the on-screen instruction hid the criterion, so the tutor must not
 *             state it either; coach by question.
 * BAND FLOOR: at K the child cannot read anything on screen, so hard still names
 * each bucket aloud (and [WORD_STAGED] read-aloud is never withdrawn) — what hard
 * withholds at K is the sorting RULE. At EVERY tier the tutor never says which
 * bucket or match is correct.
 */
function tutorRevealPolicy(
  tier: 'easy' | 'medium' | 'hard' | undefined,
  isPreReader: boolean,
): string {
  if (!tier) return '';
  if (tier === 'easy') {
    return '[SUPPORT_TIER easy] Full support: name each bucket out loud, restate the sorting rule in child terms, '
      + 'and think it through with the student. Never say which bucket a word belongs in.';
  }
  if (tier === 'medium') {
    return '[SUPPORT_TIER medium] Light support: name each bucket out loud and ask the sorting question, but do not '
      + 'restate the rule for every word. Never say which bucket a word belongs in.';
  }
  if (isPreReader) {
    return '[SUPPORT_TIER hard] Name-free coaching, Kindergarten floor: the child cannot read, so you STILL say each '
      + 'word card aloud when it is staged and you STILL name each bucket out loud so the choices exist for them. '
      + 'What you withhold is the sorting RULE — do not state the criterion, and never say which bucket a word '
      + 'belongs in. Coach by question ("Say the word with me. What do you notice about it?").';
  }
  return '[SUPPORT_TIER hard] Name-free coaching: the on-screen instruction deliberately does NOT name the sorting '
    + 'rule, so you must not name it either. Do not state the criterion and do not read the bucket labels aloud — '
    + 'the student can read them. Coach by question ("Say the word out loud. What do you notice about it?"). '
    + 'Never say which bucket or match is correct.';
}

/** Partial credit: 1st try = 100%, 2nd = 75%, 3rd = 50%, 4th+ = 25%. */
function attemptScore(attempts: number): number {
  if (attempts <= 1) return 100;
  if (attempts === 2) return 75;
  if (attempts === 3) return 50;
  return 25;
}

// ============================================================================
// Component
// ============================================================================

interface WordSorterProps {
  data: WordSorterData;
  className?: string;
}

const WordSorter: React.FC<WordSorterProps> = ({ data, className }) => {
  const {
    title,
    description,
    gradeLevel = 'K',
    sortingTopic,
    supportTier,
    challenges = [],
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // Pre-reader presentation (reader-fit PRE band): one word staged at a time,
  // tap-a-bucket = choose, tutor voices every card, adult chrome hidden.
  const isPreReader = gradeLevel === 'K';

  // ─── Shared hooks ──────────────────────────────────────────────
  const {
    currentIndex: currentChallengeIndex,
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
    getChallengeType: (ch) => ch.type,
    phaseConfig: CHALLENGE_TYPE_CONFIG,
  });

  // ─── Domain state ──────────────────────────────────────────────
  const [selectedWordId, setSelectedWordId] = useState<string | null>(null);
  const [bucketAssignments, setBucketAssignments] = useState<Map<string, string>>(new Map());
  // match_pairs: which term is selected, and which pairs have been matched
  const [selectedTermId, setSelectedTermId] = useState<string | null>(null);
  const [matchedPairs, setMatchedPairs] = useState<Map<string, string>>(new Map()); // termId → matchId
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | ''>('');
  const [bucketFlash, setBucketFlash] = useState<{ label: string; ok: boolean } | null>(null);

  // ─── Refs ──────────────────────────────────────────────────────
  const stableInstanceIdRef = useRef(instanceId || `word-sorter-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;
  const bucketFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (bucketFlashTimer.current) clearTimeout(bucketFlashTimer.current);
    },
    []
  );

  // ─── Current challenge ─────────────────────────────────────────
  const currentChallenge = useMemo(
    () => challenges[currentChallengeIndex] || null,
    [challenges, currentChallengeIndex],
  );

  // ─── Support-tier scaffolds (all default to the legacy full-help render) ───
  // #1 perception. BAND FLOOR: at K the bucket emoji ARE the pre-reader answer
  // surface, so no tier may withdraw them. At reader grades the cue is opt-IN —
  // the legacy render was label-only, so a payload with no tier fields is
  // byte-identical and only an explicit `true` adds the picture.
  const showBucketEmojis = isPreReader || currentChallenge?.showBucketEmojis === true;
  // #1 perception — filed-word badges. Withdrawn at hard so the criterion cannot
  // be read off the exemplars already sorted. The drop zone's fill state (progress)
  // survives, so the student still sees that words landed.
  const showFiledWords = currentChallenge?.showFiledWords !== false;
  // #2 instruction — when the instruction no longer names the criterion, the
  // on-screen error line must not name it either ("X doesn't belong in Y" is the
  // criterion restated), and neither may the tutor.
  const namesSortCriterion = currentChallenge?.namesSortCriterion !== false;

  // ─── Unsorted words ────────────────────────────────────────────
  const unsortedWords = useMemo(() => {
    if (!currentChallenge?.words) return [];
    return currentChallenge.words.filter(w => !bucketAssignments.has(w.id));
  }, [currentChallenge, bucketAssignments]);

  // Pre-reader: the single word currently on stage (always the next unsorted).
  const stagedWord = isPreReader ? (unsortedWords[0] ?? null) : null;

  // ─── Words per bucket ──────────────────────────────────────────
  const wordsInBuckets = useMemo(() => {
    if (!currentChallenge?.words || !currentChallenge?.bucketLabels) return new Map<string, WordCard[]>();
    const map = new Map<string, WordCard[]>();
    for (const label of currentChallenge.bucketLabels) {
      map.set(label, []);
    }
    for (const [wordId, bucketLabel] of Array.from(bucketAssignments.entries())) {
      const word = currentChallenge.words.find(w => w.id === wordId);
      if (word) {
        const arr = map.get(bucketLabel) || [];
        arr.push(word);
        map.set(bucketLabel, arr);
      }
    }
    return map;
  }, [currentChallenge, bucketAssignments]);

  // ─── Unmatched items for match_pairs ───────────────────────────
  const unmatchedTerms = useMemo(() => {
    if (!currentChallenge?.pairs) return [];
    return currentChallenge.pairs.filter(p => !matchedPairs.has(p.id));
  }, [currentChallenge, matchedPairs]);

  // Stable shuffled order for the matches column — computed once per challenge
  const matchDisplayOrderRef = useRef<{ challengeId: string; order: { id: string; text: string; emoji?: string }[] }>({ challengeId: '', order: [] });
  if (currentChallenge?.type === 'match_pairs' && currentChallenge.pairs && matchDisplayOrderRef.current.challengeId !== currentChallenge.id) {
    // #5 answer-form lever: tier distractors join the SAME column and the SAME
    // shuffle, so they are positionally indistinguishable from real matches.
    // Every correct partner is still present — completion keys on pairs.length,
    // which distractors can never enter (they are never written to matchedPairs).
    const items = [
      ...currentChallenge.pairs.map(p => ({ id: p.id, text: p.match, emoji: p.matchEmoji })),
      ...(currentChallenge.distractorMatches ?? []).map(d => ({ id: d.id, text: d.text, emoji: d.emoji })),
    ];
    // Fisher-Yates shuffle
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    matchDisplayOrderRef.current = { challengeId: currentChallenge.id, order: items };
  }

  const unmatchedMatches = useMemo(() => {
    if (!currentChallenge?.pairs) return [];
    const matchedSet = new Set(matchedPairs.values());
    return matchDisplayOrderRef.current.order.filter(m => !matchedSet.has(m.id));
  }, [currentChallenge, matchedPairs]);

  // ─── Evaluation ────────────────────────────────────────────────
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<WordSorterMetrics>({
    primitiveType: 'word-sorter',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // ─── AI Tutoring ───────────────────────────────────────────────
  const aiPrimitiveData = useMemo(() => ({
    challengeType: currentChallenge?.type ?? '',
    instruction: currentChallenge?.instruction ?? '',
    bucketLabels: currentChallenge?.bucketLabels ?? [],
    wordsSorted: bucketAssignments.size + matchedPairs.size,
    totalWords: (currentChallenge?.words?.length ?? 0) + (currentChallenge?.pairs?.length ?? 0),
    attemptNumber: currentAttempts + 1,
    challengeNumber: currentChallengeIndex + 1,
    totalChallenges: challenges.length,
    gradeLevel,
    sortingTopic,
    // The support tier the on-screen scaffolds are set to — the catalog's
    // SUPPORT TIER directive keys the tutor's reveal latitude off this.
    supportTier: supportTier ?? null,
    // The stimulus word the student is holding (never the answer key) — the
    // scaffold's spoken lines reference it so the tutor can say it aloud.
    selectedWord:
      stagedWord?.word
      ?? currentChallenge?.words?.find(w => w.id === selectedWordId)?.word
      ?? currentChallenge?.pairs?.find(p => p.id === selectedTermId)?.term
      ?? '',
  }), [
    currentChallenge, bucketAssignments.size, matchedPairs.size, currentAttempts,
    currentChallengeIndex, challenges.length, gradeLevel, sortingTopic,
    stagedWord, selectedWordId, selectedTermId, supportTier,
  ]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'word-sorter',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel,
  });

  // ─── Activity introduction ─────────────────────────────────────
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current || challenges.length === 0) return;
    hasIntroducedRef.current = true;
    const policy = tutorRevealPolicy(supportTier, isPreReader);
    // At hard (reader grades) the bucket-naming step of the SAY THE SORT directive
    // is scoped off — the reveal policy replaces it with the name-free stance.
    const openingAsk = supportTier === 'hard' && !isPreReader
      ? `Follow your SUPPORT TIER directive for this activity: open with a name-free coaching question.`
      : `Follow your SAY THE SORT OUT LOUD FIRST directive now: say the challenge in child terms, `
        + `name each bucket aloud, and ask the sorting question.`;
    sendText(
      `[ACTIVITY_START] Word Sorter activity for grade ${gradeLevel}. Topic: ${sortingTopic}. `
      + `${challenges.length} challenges. First: "${currentChallenge?.instruction}" (${currentChallenge?.type}). `
      + openingAsk
      + (policy ? ` ${policy}` : ''),
      { silent: true },
    );
  }, [isConnected, challenges.length, currentChallenge, gradeLevel, sortingTopic, sendText, supportTier, isPreReader]);

  // ─── Pre-reader: tutor voices each word as it comes on stage ───
  // The child cannot read the card; the tutor's voice IS the card (reader-fit
  // STIMULUS). One utterance per staged word — this is the instruction channel,
  // not celebration chatter, so it does not violate quiet-by-default.
  const lastStagedAnnouncedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isPreReader || !isConnected || !stagedWord || !currentChallenge) return;
    const stageKey = `${currentChallenge.id}:${stagedWord.id}`;
    if (lastStagedAnnouncedRef.current === stageKey) return;
    lastStagedAnnouncedRef.current = stageKey;
    sendText(
      `[WORD_STAGED] The next word card is on stage: "${stagedWord.word}". `
      + `Say just this word aloud clearly for the student. Do not say which bucket it belongs in.`,
      { silent: true },
    );
  }, [isPreReader, isConnected, stagedWord, currentChallenge, sendText]);

  // ─── Handle word selection (sort modes) ────────────────────────
  const handleWordClick = useCallback((wordId: string) => {
    if (hasSubmittedEvaluation || !currentChallenge) return;
    SoundManager.tap();
    if (isPreReader) {
      // Tap-to-hear: the staged card replays its word; no selection protocol.
      const word = currentChallenge.words?.find(w => w.id === wordId);
      if (word) {
        sendText(
          `[WORD_TAP] The student tapped the word card "${word.word}" to hear it again. `
          + `Say just this word aloud clearly. Do not say which bucket it belongs in.`,
          { silent: true },
        );
      }
      return;
    }
    setSelectedWordId(prev => prev === wordId ? null : wordId);
  }, [hasSubmittedEvaluation, currentChallenge, isPreReader, sendText]);

  // ─── Handle bucket click (drop word into bucket) ───────────────
  const handleBucketClick = useCallback((bucketLabel: string) => {
    if (hasSubmittedEvaluation || !currentChallenge) return;

    // Pre-reader: the staged word is the active word (tap bucket = choose).
    const word = isPreReader
      ? stagedWord
      : currentChallenge.words?.find(w => w.id === selectedWordId);
    if (!word) return;
    const isCorrect = word.correctBucket === bucketLabel;

    if (bucketFlashTimer.current) clearTimeout(bucketFlashTimer.current);
    setBucketFlash({ label: bucketLabel, ok: isCorrect });
    bucketFlashTimer.current = setTimeout(() => setBucketFlash(null), 900);

    if (isCorrect) {
      SoundManager.playCorrect();
      setBucketAssignments(prev => new Map(prev).set(word.id, bucketLabel));
      setFeedback('Correct!');
      setFeedbackType('success');
      setSelectedWordId(null);
      // No spoken cue on a routine correct sort — the SFX + on-screen "Correct!"
      // carry it. The tutor speaks at the meaningful beats (challenge advance +
      // completion); narrating every tile is over-talk (quiet-by-default).
    } else {
      SoundManager.playIncorrect();
      incrementAttempts();
      // #2 instruction lever: naming the bucket a word does NOT belong in restates
      // the criterion the hard-tier instruction deliberately withheld.
      setFeedback(
        namesSortCriterion
          ? `Try again — "${word.word}" doesn't belong in "${bucketLabel}".`
          : 'Try again.',
      );
      setFeedbackType('error');
      sendText(
        namesSortCriterion
          ? `[ANSWER_INCORRECT] Student tried to put "${word.word}" in "${bucketLabel}" but it belongs in "${word.correctBucket}". Give a hint without revealing the answer.`
          // Hard tier: the correct bucket is withheld from the tutor too, so it
          // cannot leak the criterion the screen is hiding.
          : `[ANSWER_INCORRECT] Student put "${word.word}" in "${bucketLabel}" and that is not right. Do NOT name the correct group or the sorting rule — ask what they notice about the word and let them try again.`,
        { silent: true },
      );
    }

    // Clear feedback after 2s
    setTimeout(() => { setFeedback(''); setFeedbackType(''); }, 2000);
  }, [hasSubmittedEvaluation, currentChallenge, isPreReader, stagedWord, selectedWordId, incrementAttempts, sendText, namesSortCriterion]);

  // ─── Handle match pair selection ───────────────────────────────
  const handleTermClick = useCallback((termId: string) => {
    if (hasSubmittedEvaluation) return;
    setSelectedTermId(prev => prev === termId ? null : termId);
  }, [hasSubmittedEvaluation]);

  const handleMatchClick = useCallback((matchId: string) => {
    if (hasSubmittedEvaluation || !selectedTermId || !currentChallenge?.pairs) return;

    const pair = currentChallenge.pairs.find(p => p.id === selectedTermId);
    if (!pair) return;

    if (pair.id === matchId) {
      // Correct match
      SoundManager.playCorrect();
      setMatchedPairs(prev => new Map(prev).set(pair.id, matchId));
      setSelectedTermId(null);
      setFeedback(`"${pair.term}" → "${pair.match}"`);
      setFeedbackType('success');
      // No spoken cue on a routine correct match — SFX + on-screen feedback carry
      // it; the tutor speaks on advance/completion, not every pairing.
    } else {
      SoundManager.playIncorrect();
      // The tapped entry may be a tier distractor, which has no pair — read the
      // text off the display order so the tutor never gets a bare "?".
      const wrongText =
        currentChallenge.pairs.find(p => p.id === matchId)?.match
        ?? matchDisplayOrderRef.current.order.find(m => m.id === matchId)?.text
        ?? '?';
      incrementAttempts();
      setFeedback('Not quite — try a different match.');
      setFeedbackType('error');
      sendText(
        namesSortCriterion
          ? `[ANSWER_INCORRECT] Student tried to match "${pair.term}" with "${wrongText}". Correct match is "${pair.match}". Give a hint.`
          // Hard tier: the correct partner is withheld from the tutor too.
          : `[ANSWER_INCORRECT] Student tried to match "${pair.term}" with "${wrongText}" and that is not right. Do NOT name the correct partner or the matching rule — ask what they notice about "${pair.term}" and let them try again.`,
        { silent: true },
      );
    }

    setTimeout(() => { setFeedback(''); setFeedbackType(''); }, 2000);
  }, [hasSubmittedEvaluation, selectedTermId, currentChallenge, incrementAttempts, sendText, namesSortCriterion]);

  // ─── Check if current challenge is done ────────────────────────
  const isChallengeAllSorted = useMemo(() => {
    if (!currentChallenge) return false;
    if (currentChallenge.type === 'match_pairs') {
      // Keys on pairs.length ONLY — tier distractors are never a completion target,
      // so adding them can never soft-lock or shorten the challenge.
      return (currentChallenge.pairs?.length ?? 0) > 0 &&
        matchedPairs.size >= (currentChallenge.pairs?.length ?? 0);
    }
    return (currentChallenge.words?.length ?? 0) > 0 &&
      bucketAssignments.size >= (currentChallenge.words?.length ?? 0);
  }, [currentChallenge, bucketAssignments.size, matchedPairs.size]);

  // ─── Auto-record result when all items sorted ──────────────────
  const hasRecordedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isChallengeAllSorted || !currentChallenge || hasRecordedRef.current === currentChallenge.id) return;
    hasRecordedRef.current = currentChallenge.id;

    const score = attemptScore(currentAttempts);
    recordResult({
      challengeId: currentChallenge.id,
      correct: true,
      attempts: currentAttempts + 1,
      score,
    });
  }, [isChallengeAllSorted, currentChallenge, currentAttempts, recordResult]);

  // ─── Advance ───────────────────────────────────────────────────
  const advanceToNextChallenge = useCallback(() => {
    if (!advanceProgress()) {
      // All complete
      const phaseScoreStr = phaseResults
        .map(p => `${p.label} ${p.score}% (${p.attempts} attempts)`)
        .join(', ');
      const overallPct = Math.round(
        challengeResults.reduce((s, r) => s + (r.score ?? 0), 0) / challenges.length,
      );

      sendText(
        `[ALL_COMPLETE] Phase scores: ${phaseScoreStr}. Overall: ${overallPct}%. `
        + `Give encouraging feedback about their word sorting skills!`,
        { silent: true },
      );

      if (!hasSubmittedEvaluation) {
        const totalScore = challengeResults.reduce((s, r) => s + (r.score ?? (r.correct ? 100 : 0)), 0);
        const score = Math.round(totalScore / challenges.length);
        const allCorrect = challengeResults.every(r => r.correct);

        const metrics: WordSorterMetrics = {
          type: 'word-sorter',
          sortingAccuracy: score,
          attemptsCount: challengeResults.reduce((s, r) => s + r.attempts, 0),
          wordsProcessed: challenges.reduce((s, ch) =>
            s + (ch.words?.length ?? 0) + (ch.pairs?.length ?? 0), 0),
        };

        submitEvaluation(allCorrect, score, metrics, { challengeResults });
      }
      return;
    }

    // Reset domain state for next challenge
    setFeedback('');
    setFeedbackType('');
    setSelectedWordId(null);
    setBucketAssignments(new Map());
    setSelectedTermId(null);
    setMatchedPairs(new Map());
    setBucketFlash(null);
    if (bucketFlashTimer.current) clearTimeout(bucketFlashTimer.current);
    hasRecordedRef.current = null;

    const nextChallenge = challenges[currentChallengeIndex + 1];
    const policy = tutorRevealPolicy(supportTier, isPreReader);
    const nextAsk = supportTier === 'hard' && !isPreReader
      ? `Follow your SUPPORT TIER directive for this new challenge: open name-free.`
      : `Follow your SAY THE SORT OUT LOUD FIRST directive for this new challenge.`;
    sendText(
      `[NEXT_ITEM] Moving to challenge ${currentChallengeIndex + 2} of ${challenges.length}: `
      + `"${nextChallenge.instruction}" (${nextChallenge.type}). `
      + nextAsk
      + (policy ? ` ${policy}` : ''),
      { silent: true },
    );
  }, [
    advanceProgress, phaseResults, challenges, challengeResults, sendText,
    hasSubmittedEvaluation, submitEvaluation, currentChallengeIndex,
    supportTier, isPreReader,
  ]);

  // ─── Auto-submit on complete ───────────────────────────────────
  const hasAutoSubmittedRef = useRef(false);
  useEffect(() => {
    if (allChallengesComplete && !hasSubmittedEvaluation && !hasAutoSubmittedRef.current) {
      hasAutoSubmittedRef.current = true;
      advanceToNextChallenge();
    }
  }, [allChallengesComplete, hasSubmittedEvaluation, advanceToNextChallenge]);

  // ─── Local score ───────────────────────────────────────────────
  const localOverallScore = useMemo(() => {
    if (!allChallengesComplete || challenges.length === 0) return 0;
    return Math.round(
      challengeResults.reduce((s, r) => s + (r.score ?? (r.correct ? 100 : 0)), 0) / challenges.length,
    );
  }, [allChallengesComplete, challenges, challengeResults]);

  // ─── Render: bucket grid (shared by both sort presentations) ───
  const renderBuckets = (interactive: boolean) => {
    if (!currentChallenge?.bucketLabels) return null;
    return (
      <div className={`grid gap-4 ${currentChallenge.bucketLabels.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
        {currentChallenge.bucketLabels.map((label, idx) => {
          const color = BUCKET_COLORS[idx] || BUCKET_COLORS[0];
          const bucketEmoji = showBucketEmojis ? currentChallenge.bucketEmojis?.[idx] : undefined;
          const wordsHere = wordsInBuckets.get(label) || [];
          const zoneState: DropZoneState =
            bucketFlash?.label === label
              ? bucketFlash.ok
                ? 'correct'
                : 'incorrect'
              : wordsHere.length > 0
                ? 'filled'
                : 'idle';

          return (
            <button
              key={label}
              onClick={() => handleBucketClick(label)}
              disabled={!interactive}
              className={`w-full ${interactive ? 'cursor-pointer' : 'cursor-default'}`}
            >
              {isPreReader ? (
                <div className="mb-3 flex flex-col items-center gap-1">
                  {bucketEmoji && <span className="text-4xl leading-none">{bucketEmoji}</span>}
                  <h3 className={`text-lg font-bold ${color.text} text-center`}>{label}</h3>
                </div>
              ) : (
                <h3 className={`text-sm font-bold ${color.text} mb-3 text-center`}>
                  {bucketEmoji && <span className="mr-1.5">{bucketEmoji}</span>}
                  {label}
                </h3>
              )}
              <LuminaDropZone
                state={zoneState}
                emptyPrompt={isPreReader ? undefined : 'Tap to place word here'}
                className="min-h-[104px] pointer-events-none content-center justify-center"
              >
                {showFiledWords
                  ? wordsHere.map(w => (
                    <LuminaBadge
                      key={w.id}
                      className={`bg-white/10 border-white/10 text-slate-200 ${isPreReader ? 'text-base' : 'text-xs'}`}
                    >
                      {w.emoji && <span className="mr-1">{w.emoji}</span>}
                      {w.word}
                    </LuminaBadge>
                  ))
                  // Hard tier: the exemplars are hidden, but PROGRESS is not — an
                  // anonymous count keeps the "words landed here" feedback without
                  // handing back the criterion.
                  : wordsHere.length > 0 && (
                    <LuminaBadge
                      aria-label={`${wordsHere.length} words placed here`}
                      className={`bg-white/10 border-white/10 text-slate-300 ${isPreReader ? 'text-base' : 'text-xs'}`}
                    >
                      {wordsHere.length}
                    </LuminaBadge>
                  )}
              </LuminaDropZone>
            </button>
          );
        })}
      </div>
    );
  };

  // ─── Render: Sort Challenge, pre-reader (staged word, tap = choose) ─
  const renderPreReaderSortChallenge = () => {
    if (!currentChallenge?.words || !currentChallenge?.bucketLabels) return null;

    return (
      <div className="space-y-8">
        {/* Staged word card — tap to hear it again */}
        <div className="flex justify-center min-h-[150px] items-center">
          {stagedWord && (
            <button
              onClick={() => handleWordClick(stagedWord.id)}
              aria-label={`Hear the word ${stagedWord.word}`}
              className="flex flex-col items-center gap-2 px-10 py-6 rounded-3xl border-2 border-white/15 bg-white/5 hover:bg-white/10 transition-all active:scale-95"
            >
              {stagedWord.emoji ? (
                <>
                  <span className="text-7xl leading-none">{stagedWord.emoji}</span>
                  <span className="text-2xl font-bold text-slate-100">{stagedWord.word}</span>
                </>
              ) : (
                <span className="text-4xl font-bold text-slate-100">{stagedWord.word}</span>
              )}
              <LuminaReadAloudGlyph size={22} />
            </button>
          )}
        </div>

        {/* Buckets — tap one to choose */}
        {renderBuckets(!!stagedWord)}
      </div>
    );
  };

  // ─── Render: Sort Challenge (binary/ternary, reader presentation) ──
  const renderSortChallenge = () => {
    if (!currentChallenge?.words || !currentChallenge?.bucketLabels) return null;

    return (
      <div className="space-y-6">
        {/* Word Pool */}
        <div className="space-y-2">
          <p className="text-sm text-slate-400 font-medium">Tap a word, then tap the bucket it belongs in:</p>
          <div className="flex flex-wrap gap-3 justify-center min-h-[60px] p-4 rounded-xl border border-white/5 bg-white/[0.02]">
            {unsortedWords.length === 0 && (
              <p className="text-slate-500 text-sm">All words sorted!</p>
            )}
            {unsortedWords.map(word => (
              <LuminaChip
                key={word.id}
                onClick={() => handleWordClick(word.id)}
                state={selectedWordId === word.id ? 'selected' : 'idle'}
              >
                {word.emoji && <span className="mr-1.5">{word.emoji}</span>}
                {word.word}
              </LuminaChip>
            ))}
          </div>
        </div>

        {/* Buckets */}
        {renderBuckets(!!selectedWordId)}
      </div>
    );
  };

  // ─── Render: Match Pairs Challenge ─────────────────────────────
  const renderMatchPairsChallenge = () => {
    if (!currentChallenge?.pairs) return null;

    return (
      <div className="space-y-6">
        <p className="text-sm text-slate-400 font-medium">Tap a word on the left, then tap its match on the right:</p>

        <div className="grid grid-cols-2 gap-6">
          {/* Terms column */}
          <div className="space-y-2">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-2">Words</p>
            {currentChallenge.pairs.map(pair => {
              const isMatched = matchedPairs.has(pair.id);
              const isSelected = selectedTermId === pair.id;

              return (
                <button
                  key={pair.id}
                  onClick={() => !isMatched && handleTermClick(pair.id)}
                  disabled={isMatched}
                  className={`
                    w-full px-4 py-3 rounded-xl border text-sm font-medium transition-all text-left
                    ${isMatched
                      ? 'bg-emerald-500/10 border-emerald-400/20 text-emerald-300 opacity-60'
                      : isSelected
                        ? 'bg-violet-500/20 border-violet-400/40 text-white ring-2 ring-violet-400/40'
                        : 'bg-white/5 border-white/15 text-slate-200 hover:bg-white/10 cursor-pointer'
                    }
                  `}
                >
                  {pair.termEmoji && <span className="mr-1.5">{pair.termEmoji}</span>}
                  {pair.term}
                  {isMatched && <span className="float-right text-emerald-400">✓</span>}
                </button>
              );
            })}
          </div>

          {/* Matches column */}
          <div className="space-y-2">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-2">Matches</p>
            {unmatchedMatches.map(m => (
              <button
                key={m.id}
                onClick={() => handleMatchClick(m.id)}
                disabled={!selectedTermId}
                className={`
                  w-full px-4 py-3 rounded-xl border text-sm font-medium transition-all text-left
                  ${selectedTermId
                    ? 'bg-white/5 border-white/15 text-slate-200 hover:bg-sky-500/10 hover:border-sky-400/30 cursor-pointer'
                    : 'bg-white/5 border-white/10 text-slate-400 cursor-default'
                  }
                `}
              >
                {m.emoji && <span className="mr-1.5">{m.emoji}</span>}
                {m.text}
              </button>
            ))}
            {/* Show matched items (greyed) */}
            {currentChallenge.pairs
              .filter(p => matchedPairs.has(p.id))
              .map(p => (
                <div
                  key={`matched-${p.id}`}
                  className="w-full px-4 py-3 rounded-xl border bg-emerald-500/10 border-emerald-400/20 text-emerald-300 text-sm font-medium opacity-60"
                >
                  {p.matchEmoji && <span className="mr-1.5">{p.matchEmoji}</span>}
                  {p.match}
                  <span className="float-right">✓</span>
                </div>
              ))}
          </div>
        </div>
      </div>
    );
  };

  // ─── Main Render ───────────────────────────────────────────────
  if (challenges.length === 0) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-6 text-center text-slate-400">
          No challenges available.
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <LuminaCardTitle className="text-lg font-semibold">{title}</LuminaCardTitle>
          {/* Progress counter is adult chrome at PRE (reader-fit rule 7) */}
          {!isPreReader && (
            <LuminaBadge className="text-xs">
              {currentChallengeIndex + 1} / {challenges.length}
            </LuminaBadge>
          )}
        </div>
        {description && !isPreReader && (
          <p className="text-sm text-slate-400 mt-1">{description}</p>
        )}
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-5">
        {/* Phase Summary (when complete) */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score ?? localOverallScore}
            durationMs={elapsedMs}
            heading="Word Sorting Complete!"
            celebrationMessage="You sorted all the words!"
            className="mb-6"
          />
        )}

        {/* Active challenge */}
        {!allChallengesComplete && currentChallenge && (
          <>
            {/* Challenge instruction — at PRE the tutor voices it (aiDirectives);
                the on-screen sentence is unreadable load and stays hidden. */}
            {!isPreReader && (
              <LuminaPanel>
                <p className="text-slate-200 text-sm font-medium">
                  {currentChallenge.instruction}
                </p>
              </LuminaPanel>
            )}

            {/* Challenge type + attempt badges are adult chrome at PRE (rule 7) */}
            {!isPreReader && (
              <div className="flex items-center gap-2">
                <LuminaBadge className="text-xs">
                  {CHALLENGE_TYPE_CONFIG[currentChallenge.type]?.icon}{' '}
                  {CHALLENGE_TYPE_CONFIG[currentChallenge.type]?.label}
                </LuminaBadge>
                {currentAttempts > 0 && (
                  <LuminaBadge accent="amber" className="text-xs">
                    {currentAttempts} wrong
                  </LuminaBadge>
                )}
              </div>
            )}

            {/* Feedback text — at PRE the SFX + bucket flash + spoken hint carry
                it; a transient sentence card is unreadable (rule 5). */}
            {feedback && !isPreReader && (
              <div className={`p-3 rounded-lg text-sm font-medium text-center transition-all ${
                feedbackType === 'success'
                  ? 'bg-emerald-500/10 border border-emerald-400/20 text-emerald-300'
                  : 'bg-red-500/10 border border-red-400/20 text-red-300'
              }`}>
                {feedback}
              </div>
            )}

            {/* Challenge content */}
            {(currentChallenge.type === 'binary_sort' || currentChallenge.type === 'ternary_sort')
              ? (isPreReader ? renderPreReaderSortChallenge() : renderSortChallenge())
              : renderMatchPairsChallenge()
            }

            {/* Next button (appears when challenge is fully sorted) */}
            {isChallengeAllSorted && !allChallengesComplete && (
              <div className="flex justify-center pt-2">
                <LuminaActionButton action="next" onClick={advanceToNextChallenge}>
                  Next Challenge →
                </LuminaActionButton>
              </div>
            )}
          </>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default WordSorter;
