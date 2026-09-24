'use client';

/**
 * CvcSpeller — three modes on one CVC word. It runs only on the shared tutor/JEV
 * teaching workspace (workspace rollout B2; the scripted speech loop was retired, LA-14,
 * user ruling 09-23: one path). The tutor teaches in its own words, the observer commits
 * outcomes, and the runtime owns progression. An unbound mount shows the shared "needs
 * the tutor" card.
 *
 * WHAT THE CHILD DOES, PER MODE.
 *  - `fill-vowel` / `word-sort`: they hear the word and SAY THE MIDDLE SOUND aloud,
 *    judged against it.
 *  - `spell-word`: they hear the word and PUT A LETTER IN EACH BOX. The third letter
 *    landing is the commit, and the boxes are checked in code, never by the tutor.
 *
 * WHY THE SPOKEN MODES HAVE NO BUTTONS (qa/di/BACKLOG.md item 16). Two vowel buttons or
 * two sort buckets each printed one of two options including the answer: recognition, and
 * a leak for anyone who can read. `spell-word` stays in the hands: three ordered slots out
 * of a distractor bank is not guessable, and it is ENCODING.
 *
 * ANSWER-LEAK RULE. The word, its picture and the empty boxes are the stimulus. The middle
 * sound and the spelling are the answer: nothing prints or offers them until credited.
 * `word-sort`'s columns are built out of answers already credited. Hear It says the WORD
 * and stops; isolating the middle sound on demand would be the answer.
 */

import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLuminaAIContext } from '@/contexts/LuminaAIContext';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaBadge,
  LuminaPanel,
  LuminaChallengeCounter,
  dropZoneStateClass,
  motion,
  type DropZoneState,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { CvcSpellerMetrics } from '../../../evaluation/types';
import { SoundManager } from '../../../utils/SoundManager';
import { isPreReaderGrade } from '../../../utils/kindergartenMode';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { phaseResultsFromSummary } from '../../../hooks/usePhaseResults';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceRunner, type TeachingEvaluationResult }
  from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { vowelKeyword, type CvcTask } from './cvcSpellerScript';
import { cvcAssignment, cvcItem, cvcScene, describeSpelling, hearWordRequest, spellingMatches } from './cvcSpellerWorkspace';
import { usePipSurface, usePipTargets } from '../../../pip/PipSurfaceContext';
import { cvcSpellerPipPose } from '../../../pip/cvcSpellerPipPose';

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
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted. */
  runtimeEvalMode?: string;
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

const EMPTY: (string | null)[] = [null, null, null];

function CvcSpellerSurface({ data, className, runtimePlanItemId, runtimeEvalMode }: CvcSpellerProps) {
  const {
    title,
    vowelFocus,
    availableLetters = [],
    challenges = [],
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const gradeLevel = data.gradeLevel ?? 'K';
  const ctx = useLuminaAIContext();
  const workspace = useRef<TeachingWorkspace | null>(null);

  const [wordTapped, setWordTapped] = useState(false);
  // spell-word board
  const [slots, setSlots] = useState<(string | null)[]>(EMPTY);
  const slotsRef = useRef<(string | null)[]>(EMPTY);
  const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(0);
  /** word-sort: the columns, built ONLY out of credited answers. */
  const [sorted, setSorted] = useState<Array<{ id: string; word: string; emoji: string; vowel: string }>>([]);
  /** Visual only: clears the Hear It highlight. Nothing here advances. */
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Sound-level accuracy, accumulated from checked builds. */
  const soundStatsRef = useRef({ vowelOk: 0, vowelTried: 0, consonantOk: 0, consonantTried: 0 });
  const errorPatternsRef = useRef<string[]>([]);
  const hearTapsRef = useRef(0);

  const stableInstanceIdRef = useRef(instanceId || `cvc-speller-${Math.round(performance.now())}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;
  const isPreReader = isPreReaderGrade(gradeLevel);

  const evaluation = usePrimitiveEvaluation<CvcSpellerMetrics>({
    primitiveType: 'cvc-speller',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const finish = (summary: TeachingEvaluationResult) => {
    const outcomes = summary.outcomes.map(o => ({ ...o, task: challenges.find(c => c.id === o.id)?.taskType }));
    const stats = soundStatsRef.current;
    const metrics: CvcSpellerMetrics = {
      type: 'cvc-speller',
      vowelFocus,
      taskType: challenges[0]?.taskType ?? 'spell-word',
      wordsSpelledCorrectly: outcomes.filter(o => o.solved).length,
      wordsTotal: challenges.length,
      vowelAccuracy: stats.vowelTried > 0 ? Math.round((stats.vowelOk / stats.vowelTried) * 100) : 100,
      consonantAccuracy: stats.consonantTried > 0 ? Math.round((stats.consonantOk / stats.consonantTried) * 100) : 100,
      commonErrors: Array.from(new Set(errorPatternsRef.current)),
      // The stretch ladder is deleted (it isolated the middle sound on demand); Hear It rides in details.
      stretchUsed: 0,
      attemptsCount: outcomes.reduce((s, o) => s + 1 + o.corrections, 0),
    };
    const diagnosisEvidence = summary.accuracy < 60 ? summary.diagnosisEvidence : undefined;
    evaluation.submitResult(summary.accuracy >= 60, summary.accuracy, metrics,
      { outcomes, hearTaps: hearTapsRef.current, learningResponses: summary.learningResponses,
        ...(summary.teachingAttempts ? { teachingAttempts: summary.teachingAttempts, assistanceProvenance: summary.assistanceProvenance } : {}) },
      undefined, diagnosisEvidence);
  };

  const setBoard = (next: (string | null)[]) => {
    slotsRef.current = next;
    setSlots(next);
    const firstEmpty = next.findIndex(s => s === null);
    setActiveSlotIndex(firstEmpty === -1 ? null : firstEmpty);
  };

  const runner = useWorkspaceRunner<CvcSpellerChallenge>({
    primitiveId: 'cvc-speller',
    assignment: cvcAssignment,
    items: challenges,
    workspace,
    objectiveId,
    planItemId: runtimePlanItemId,
    // The SESSION's mode, from the mount: a mount's identity must not change while the workspace owns it.
    evalMode: runtimeEvalMode || challenges[0]?.taskType.replace('-', '_') || 'mixed',
    instanceId: resolvedInstanceId,
    onFinished: finish,
    onItemOpened: (_item, index) => {
      if (index === 0) setSorted([]);
      setWordTapped(false);
      setBoard(EMPTY);
    },
    // Try again keeps what was right and clears only what was wrong (the Elkonin discipline).
    onCorrectionRetry: (item) => {
      const letters = cvcItem(item).letters;
      setBoard(slotsRef.current.map((letter, i) => ((letter ?? '').toLowerCase() === letters[i] ? letter : null)));
    },
    onAffirmed: (item) => {
      if (item.taskType === 'word-sort') {
        const it = cvcItem(item);
        setSorted(prev => prev.some(s => s.id === it.id) ? prev
          : prev.concat({ id: it.id, word: it.word, emoji: it.emoji, vowel: it.vowelLetter }));
      }
    },
  });
  const currentChallenge = runner.currentItem;
  const currentIndex = runner.currentIndex;
  const item = currentChallenge ? cvcItem(currentChallenge) : null;
  // The workspace shows its finish without an evaluation provider (the live host has none).
  const showSummary = evaluation.hasSubmitted || !!runner.practiceSummary;
  /** The boxes take letters only while the learner may answer and nothing is being checked. */
  const boardOpen = !!item && item.task === 'spell-word' && runner.canAttempt && !runner.isAwaitingGesture()
    && !runner.revealHeld;

  // Letter bank for spell-word: targets + tiered distractors, topped up to 5 from the letter group.
  const letterBank = useMemo(() => {
    if (!currentChallenge || currentChallenge.taskType !== 'spell-word') return [];
    const all = new Set<string>();
    (currentChallenge.targetLetters ?? currentChallenge.targetWord.split('')).forEach(l => all.add(l.toLowerCase()));
    (currentChallenge.distractorLetters ?? []).forEach(l => all.add(l.toLowerCase()));
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
  }, [currentChallenge?.id]);

  // ── The BUILD commit (spell-word): the third letter IS the commit ────
  const commitBuild = useCallback((placed: (string | null)[]) => {
    if (!currentChallenge || !item) return;
    const correct = spellingMatches(currentChallenge, placed);
    const stats = soundStatsRef.current;
    placed.forEach((letter, i) => {
      const ok = (letter ?? '').toLowerCase() === item.letters[i];
      if (i === 1) { stats.vowelTried += 1; if (ok) stats.vowelOk += 1; }
      else { stats.consonantTried += 1; if (ok) stats.consonantOk += 1; }
    });
    if (!correct) errorPatternsRef.current.push(placed.map(l => l ?? '_').join(''));
    runner.commitGesture({ response: describeSpelling(placed), correct, cue: () => '' });
  }, [currentChallenge, item, runner]);

  const handleSelectLetter = useCallback((letter: string) => {
    if (!boardOpen) return;
    const target = activeSlotIndex ?? slotsRef.current.findIndex(s => s === null);
    if (target < 0) return;
    SoundManager.tap();
    const next = [...slotsRef.current];
    next[target] = letter;
    setBoard(next);
    if (next.every(s => s !== null)) commitBuild(next);
  }, [activeSlotIndex, boardOpen, commitBuild]);

  const handleSlotTap = useCallback((index: number) => {
    if (!boardOpen) return;
    const next = [...slotsRef.current];
    next[index] = null;
    setBoard(next);
    setActiveSlotIndex(index);
  }, [boardOpen]);

  // ── Hear It — never withdrawn by band or tier ─────────────────────
  // Asks for the WORD and stops: isolating the middle sound is the answer on two modes.
  // Silent, so it is not a learner turn.
  const handleHearWord = useCallback(() => {
    if (!item) return;
    SoundManager.tap();
    hearTapsRef.current += 1;
    setWordTapped(true);
    ctx.sendText(hearWordRequest(item.word), { silent: true, author: 'host' });
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    tapTimerRef.current = setTimeout(() => setWordTapped(false), 1200);
  }, [ctx, item]);

  // What the tutor and the observer are shown, republished every render.
  // W1 offers no demonstration targets and no presentation.
  useLayoutEffect(() => {
    if (!currentChallenge) return;
    workspace.current = { ...cvcScene(currentChallenge, { boxes: slotsRef.current }), demonstration: [], canDemonstrate: false,
      canPresent: false, readyForResponse: true, mark: () => {}, clearPresentation: () => {} };
    runner.publishWorkspace();
  });

  // ── Pip shared surface ───────────────────────────────────────────
  // A projection of the workspace's committed state and the child's own box moves; Pip never
  // places a letter, commits a build, or moves to the next item.
  const judging = !!item && item.task === 'spell-word' && runner.isAwaitingGesture();
  const pip = usePipTargets(currentChallenge?.id ?? null,
    runner.running && !judging && currentChallenge?.taskType === 'spell-word');
  const pipStore = usePipSurface(() => {
    if (!pip.dock.current || !currentChallenge || showSummary) return null;
    const targets = pip.targets(undefined, (id) => (id.startsWith('box-') ? `Box ${Number(id.slice(4)) + 1}` : id));
    const pose = cvcSpellerPipPose({
      running: runner.running, preparing: false,
      stage: runner.revealHeld ? 'affirmed' : judging ? 'judging' : runner.running ? 'asking' : 'done',
      task: currentChallenge.taskType,
      // Audio belongs to this block only while the lesson is pointed at it.
      tutorSpeaking: ctx.isAudioPlaying && (ctx.sessionMode !== 'lesson' || ctx.activePrimitiveId === resolvedInstanceId),
      cueOnItem: runner.cuedItemId === currentChallenge.id && !runner.revealHeld,
      visibleIds: targets.map((target) => target.id),
      lastTouchedId: pip.lastTouchedId,
    });
    return {
      instanceId: resolvedInstanceId, scopeId: currentChallenge.id, label: 'Sounds and letters',
      dock: pip.dock.current, targets, pose,
    };
  });

  const phaseResults = useMemo(() => phaseResultsFromSummary(challenges, runner.practiceSummary, (challenge) => ({
    label: challenge.targetWord,
    icon: challenge.emoji || '🔤',
  })), [runner.practiceSummary, challenges]);

  // ============================================================================
  // Render
  // ============================================================================

  if (!currentChallenge || !item) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-6">
          <p className="text-slate-400 text-center">No spelling challenges available.</p>
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  const credited = runner.revealHeld;
  const showPicture = currentChallenge.showPictureCue !== false && !!currentChallenge.emoji;
  const boardFlash: 'correct' | 'incorrect' | null = item.task !== 'spell-word' ? null
    : credited ? 'correct'
      // A checked miss stays on the board until Try again reopens it.
      : slots.every(s => s !== null) && !runner.canAttempt ? 'incorrect' : null;
  const stageWord = credited ? 'yes!' : judging ? 'let’s see…'
    : item.task === 'spell-word' ? 'fill the boxes' : 'middle sound?';

  // ── fill-vowel: the consonant frame. The blank stays a blank until credited.
  const renderFillVowel = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-2">
        <div className="w-20 h-20 rounded-xl bg-blue-500/15 border-2 border-blue-500/30 flex items-center justify-center text-3xl font-bold uppercase text-blue-300">
          {item.letters[0]}
        </div>
        <div
          ref={pip.ref('gap')}
          data-pip-object="gap"
          data-cvc-reward={credited ? 'true' : undefined}
          className={`w-20 h-20 rounded-xl border-2 border-dashed flex items-center justify-center text-3xl font-bold uppercase transition-all ${
            credited
              ? 'bg-emerald-500/30 border-emerald-400/60 text-emerald-200 animate-bounce'
              : 'bg-slate-800/40 border-slate-500/40 text-slate-500 animate-pulse'
          }`}
        >
          {credited ? item.vowelLetter : '?'}
        </div>
        <div className="w-20 h-20 rounded-xl bg-blue-500/15 border-2 border-blue-500/30 flex items-center justify-center text-3xl font-bold uppercase text-blue-300">
          {item.letters[2]}
        </div>
      </div>
      {credited && vowelKeyword(item.vowelLetter) && (
        <p className="text-center text-emerald-300 text-sm">like {vowelKeyword(item.vowelLetter)}</p>
      )}
    </div>
  );

  // ── spell-word: Elkonin boxes + letter bank. The third letter landing is the commit.
  const renderSpellWord = () => (
    <div className="space-y-5">
      {showPicture && (
        <LuminaPanel className="flex items-center justify-center px-5 py-3">
          <span
            ref={pip.ref('picture')}
            data-pip-object="picture"
            className="text-4xl"
            role="img"
            aria-label={currentChallenge.imageDescription || currentChallenge.targetWord}
          >
            {currentChallenge.emoji}
          </span>
        </LuminaPanel>
      )}

      <div ref={pip.ref('boxes')} data-pip-object="boxes" className="flex items-center justify-center gap-3">
        {slots.map((letter, index) => {
          const isActive = activeSlotIndex === index && boardOpen;
          const slotState: DropZoneState = boardFlash
            ?? (letter !== null ? 'filled' : isActive ? 'dragOver' : 'idle');
          return (
            <button
              key={index}
              ref={pip.ref(`box-${index}`)}
              data-pip-object={`box-${index}`}
              onClick={() => { pip.look(`box-${index}`); handleSlotTap(index); }}
              disabled={!boardOpen}
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
              aria-label={`letter ${letter}`}
              onClick={() => {
                // Pip watches the box the letter lands in, never the bank letter.
                const target = activeSlotIndex ?? slots.findIndex((s) => s === null);
                if (target >= 0) pip.look(`box-${target}`);
                handleSelectLetter(letter);
              }}
              disabled={!boardOpen || activeSlotIndex === null}
              className={`
                w-12 h-12 rounded-lg border-2 flex items-center justify-center
                text-xl font-bold uppercase transition-all duration-150
                cursor-pointer select-none hover:scale-110
                ${VOWELS.has(letter)
                  ? 'bg-red-500/15 border-red-500/30 text-red-300 hover:bg-red-500/25'
                  : 'bg-blue-500/15 border-blue-500/30 text-blue-300 hover:bg-blue-500/25'
                }
                ${(!boardOpen || activeSlotIndex === null) ? 'opacity-40 cursor-not-allowed hover:scale-100' : ''}
              `}
            >
              {letter}
            </button>
          ))}
        </div>
      </LuminaPanel>
    </div>
  );

  // ── word-sort: the current word's picture, plus the columns built out of answers ALREADY
  //    credited. A column is labelled the moment its first word is credited, never before.
  const renderWordSort = () => {
    const columns = Array.from(new Set(sorted.map((s) => s.vowel)));
    return (
      <div className="space-y-5">
        {showPicture && (
          <div className="flex justify-center">
            <span ref={pip.ref('picture')} data-pip-object="picture"
              className="text-5xl" role="img" aria-label={currentChallenge.imageDescription || currentChallenge.targetWord}>
              {currentChallenge.emoji}
            </span>
          </div>
        )}
        {credited && (
          <p className="text-center text-emerald-300 text-lg font-black" data-cvc-reward="true">
            {item.vowelLetter.toUpperCase()}
            {vowelKeyword(item.vowelLetter) ? <span className="text-sm font-normal text-emerald-300/80"> — like {vowelKeyword(item.vowelLetter)}</span> : null}
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
                {/* The vowel badge appears only when the objective NAMED a vowel: labelling an
                    unscoped session "Short A" would be both wrong and a hint. */}
                {vowelFocus && (
                  <LuminaBadge className="text-xs">{VOWEL_LABELS[vowelFocus] || vowelFocus}</LuminaBadge>
                )}
                <LuminaBadge accent="emerald" className="text-xs">{TASK_BADGE[item.task as CvcTask]}</LuminaBadge>
              </div>
            )}
          </div>
          <LuminaBadge accent="cyan" className="text-xs">
            {item.task === 'spell-word' ? 'Build it' : 'Say it out loud'}
          </LuminaBadge>
        </div>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {!showSummary && (
          <>
            {!isPreReader && challenges.length > 0 && (
              <div className="mb-2 flex justify-center">
                <LuminaChallengeCounter current={currentIndex + 1} total={challenges.length} variant="dots" />
              </div>
            )}

            {/* One audio affordance, all modes: hear the word again. It never stretches and
                never isolates a sound — that is the answer. */}
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

            {/* Pip's dock sits above the stage: a pointer to the gap, picture or boxes never
                crosses the letter bank below them. */}
            {pipStore && (
              <div ref={pip.dock} data-pip-dock={resolvedInstanceId}
                className="mx-auto flex min-h-28 w-full max-w-xl items-center rounded-2xl border border-cyan-300/10 bg-cyan-950/10 px-2" />
            )}

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
          </>
        )}

        {showSummary && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={evaluation.submittedResult?.score ?? runner.teachingResult?.accuracy}
            durationMs={evaluation.elapsedMs}
            heading="Sounds and Letters Complete!"
            celebrationMessage={`You got ${runner.practiceSummary?.solvedCount ?? 0} word${runner.practiceSummary?.solvedCount === 1 ? '' : 's'}!`}
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
}

// The teaching workspace is the only path: an unbound mount shows the "needs the tutor" card.
const CvcSpeller = withWorkspaceOnly<CvcSpellerProps>('cvc-speller', CvcSpellerSurface, props => props.data.title);

export default CvcSpeller;
