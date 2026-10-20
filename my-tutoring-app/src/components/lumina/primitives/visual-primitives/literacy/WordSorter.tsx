'use client';

/**
 * WordSorter: the tutor says a word and the child says which group it belongs with, or its partner from the printed
 * bank. It is a boss (`wordSorter.card.ts` + `wordSorter.boss.ts`) on the spoken preset, taught only on the shared
 * tutor/JEV teaching workspace; an unbound mount shows the shared "needs the tutor" card. The observer judges each
 * spoken answer and the runtime owns progression: no advance timer, no Next button, and no answer on screen before it
 * is credited.
 *
 * What stays on the page: the mats, their labels and picture cues (a sort whose groups are not knowable is broken, not
 * harder); the word card and its emoji (the stimulus, and the pre-reader's way in); the word bank, which never
 * shrinks, with the tier decoys and the filed-word badges; and tap-to-hear, which asks for the QUESTION again.
 *
 * The domain (build gates, ask, key, scene) is `wordSorterDomain.ts`; the levers `wordSorterLevers.ts`. Nothing in
 * this file writes a spoken line.
 */

import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  LuminaBadge,
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaChallengeCounter,
  LuminaDropZone,
  LuminaReadAloudGlyph,
  type DropZoneState,
} from '../../../ui';
import type { PrimitiveEvaluationResult } from '../../../evaluation';
import type { WordSorterMetrics } from '../../../evaluation/types';
import { useTeachingWorkspace, type TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { useTeachingEvaluation } from '../../../components/live-activity/runtime/useTeachingEvaluation';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { leverScene } from '../../../components/live-activity/bossLevers';
import { PipDock, PipWorkspace, useRunnerPip } from '../../../pip/WorkspacePip';
import PhaseSummaryPanel, { type PhaseResult } from '../../../components/PhaseSummaryPanel';
import { hearQuestionRequest, wordSorterScene, type WordSorterItem, type WordSorterMode, type WordSorterTier } from './wordSorterDomain';
import { aidsOnScreen, WORD_SORTER_LEVERS } from './wordSorterLevers';
import { wordSorterBoss, wordSorterItems } from './wordSorter.boss';

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

/** A non-answer entry in the word bank (support-tier answer-form lever). Under
 *  the judged loop it raises DISCRIMINATION load only: the bank never shrinks,
 *  so a decoy can neither shorten the challenge nor be eliminated by counting. */
export interface DistractorMatch {
  id: string;
  text: string;
  emoji?: string;
}

export interface WordSorterChallenge {
  id: string;
  /** Word-space calibration stamp (service/wordSpace); never rendered, never sent to the tutor. */
  wordSpace?: import('../../../service/wordSpace/pick').WordSpaceStamp;
  type: WordSorterMode;
  instruction: string;
  bucketLabels?: string[];
  /** Optional emoji per bucket, index-aligned with bucketLabels. */
  bucketEmojis?: string[];
  words?: WordCard[];
  pairs?: MatchPair[];
  /** match_pairs: how the partner relates to the term ("opposite", "plural"…).
   *  It is what lets the ask be a question rather than a shrug. */
  relationLabel?: string;

  // ── Within-mode support tier scaffolds (stamped by the generator from
  //    config.difficulty). ALL OPTIONAL: absent ⇒ the full-help render. ──
  /** #1 perception — the picture cue on each mat. Forced on at K (band floor). */
  showBucketEmojis?: boolean;
  /** #1 perception — the badges of words already placed. Withdrawn at hard,
   *  which is also what withdraws the elimination information from a match. */
  showFiledWords?: boolean;
  /** #2 instruction — whether the ASK names the groups aloud. Forced true at K:
   *  a pre-reader cannot read a mat, so an unnamed group is unanswerable. */
  namesSortCriterion?: boolean;
  /** #5 answer-form (match_pairs) — extra non-answer entries in the bank. */
  distractorMatches?: DistractorMatch[];
}

export interface WordSorterData {
  title: string;
  description?: string;
  gradeLevel: string;
  sortingTopic: string;
  /** Within-mode support tier from the manifest. Drives the DISTAR lead-in and
   *  whether the ask names the groups. */
  supportTier?: WordSorterTier;
  challenges: WordSorterChallenge[];

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<WordSorterMetrics>) => void;
}

interface WordSorterProps {
  data: WordSorterData;
  className?: string;
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted. */
  runtimeEvalMode?: string;
}

// ============================================================================
// Constants
// ============================================================================

type WordSorterAccent = NonNullable<PhaseResult['accentColor']>;

const MODE_META: Record<
  WordSorterMode,
  { label: string; icon: string; accent: WordSorterAccent }
> = {
  binary_sort: { label: 'Two Groups', icon: '📂', accent: 'purple' },
  ternary_sort: { label: 'Three Groups', icon: '🗂️', accent: 'blue' },
  match_pairs: { label: 'Find the Partner', icon: '🔗', accent: 'emerald' },
};

const MAT_COLORS = ['text-violet-300', 'text-sky-300', 'text-emerald-300'];

// ============================================================================
// Component
// ============================================================================

function WordSorterSurface({ data, className, runtimePlanItemId }: WordSorterProps) {
  const items = useMemo(() => wordSorterItems(data), [data]);
  if (items.length === 0) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-8 text-center text-slate-400">
          These sorting words are still being written. Try generating them again.
        </LuminaCardContent>
      </LuminaCard>
    );
  }
  return <SorterWorkspace key={data.instanceId} data={data} items={items} className={className}
    runtimePlanItemId={runtimePlanItemId} />;
}

function SorterWorkspace({ data, items, className, runtimePlanItemId }: WordSorterProps & { items: WordSorterItem[] }) {
  const { title, gradeLevel = 'K' } = data;
  const isPreReader = gradeLevel === 'K';
  const instance = useRef(data.instanceId || `word-sorter-${Date.now()}`);
  const workspace = useRef<TeachingWorkspace | null>(null);
  // In-item levers (`wordSorterLevers.ts`), keyed by the item they were pulled on.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });

  const assignments = useMemo(() => items.map(item => ({ ...wordSorterBoss.assignment(item), checkResponse: () => null })), [items]);
  const lesson = useTeachingWorkspace({ instanceId: instance.current, primitiveId: 'word-sorter',
    objectiveId: data.objectiveId, planItemId: runtimePlanItemId, items: assignments, workspace });
  useTeachingEvaluation<WordSorterMetrics>({ primitiveType: 'word-sorter', instanceId: instance.current,
    data, assignments, lesson,
    metrics: result => ({ type: 'word-sorter', sortingAccuracy: result.accuracy, attemptsCount: result.attemptsCount,
      wordsProcessed: items.length }) });

  const currentItem = items[lesson.state.index];
  const modeMeta = MODE_META[currentItem.mode];
  const pulledLevers = leverState.item === currentItem.id ? leverState.pulled : [];
  /** The item's answer is credited: the reveal ring may paint. A credit that also advances opens the next item in the
   *  same dispatch, so it never paints there. */
  const solved = lesson.state.phase === 'checked' && !!lesson.state.lastResponse?.correct;
  useRunnerPip({ instanceId: instance.current, itemId: currentItem.id, running: lesson.state.phase !== 'completed', solved });

  /** Every credited item: the only thing that can put a word on a mat. Read off the session's own attempts. */
  const solvedIds = useMemo(() => new Set(lesson.state.attempts.filter(a => a.correct).map(a => a.itemId)),
    [lesson.state.attempts]);
  const filedCount = items.filter(i => i.challengeId === currentItem.challengeId && solvedIds.has(i.id)).length;
  const leverCtx = { filed: filedCount };

  // What the tutor and the observer are shown, republished every render.
  useLayoutEffect(() => {
    const levers = WORD_SORTER_LEVERS.declare(currentItem, leverCtx, pulledLevers);
    workspace.current = {
      ...leverScene(wordSorterScene(currentItem), {
        support: WORD_SORTER_LEVERS.support(currentItem, leverCtx),
        onScreen: WORD_SORTER_LEVERS.onScreen(currentItem, leverCtx, pulledLevers) }),
      levers,
      // A synchronous commit (the workspace runs it inside flushSync): the screen changes before this returns.
      pullLever: id => {
        const lever = levers.find(l => l.id === id);
        if (!lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled.`;
        setLeverState({ item: currentItem.id, pulled: [...pulledLevers, id] });
        return true;
      },
    };
  });

  /**
   * The words this challenge has already placed: the `showFiledWords` aid. Read off the credited ledger, so the only
   * thing that can put a word on a mat is a committed credit.
   */
  const placedByChoice = useMemo(() => {
    const map = new Map<string, WordSorterItem[]>();
    for (const item of items) {
      if (item.challengeId !== currentItem.challengeId || !solvedIds.has(item.id)) continue;
      map.set(item.answer, [...(map.get(item.answer) ?? []), item]);
    }
    return map;
  }, [items, currentItem, solvedIds]);

  /** The mat or bank entry just credited, for the reveal ring. */
  const revealedChoice = solved ? currentItem.answer : null;

  // ── Phase summary ─────────────────────────────────────────────────────────
  const summary = lesson.summary;
  const phaseResults: PhaseResult[] = summary?.outcomes.map(outcome => {
    const meta = MODE_META[items.find(i => i.id === outcome.id)?.mode ?? 'binary_sort'];
    return { label: outcome.assisted ? `${meta.label} (with help)` : meta.label, icon: meta.icon, score: outcome.score,
      attempts: outcome.attempts, firstTry: outcome.solved && outcome.attempts === 1, accentColor: meta.accent };
  }) ?? [];

  // ============================================================================
  // Render
  // ============================================================================

  /** The mats — printed material, never an answer surface. Nothing here is
   *  clickable: the child says the group out loud. */
  // The tier's aids plus the pulled levers.
  const aids = aidsOnScreen(currentItem, pulledLevers);

  const renderMats = (item: WordSorterItem) => (
    <div className={`grid gap-4 ${item.choices.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
      {item.choices.map((label, idx) => {
        const placed = placedByChoice.get(label) ?? [];
        const isRevealed = revealedChoice === label;
        const zoneState: DropZoneState = isRevealed
          ? 'correct'
          : placed.length > 0
            ? 'filled'
            : 'idle';
        return (
          <div key={label} className="w-full">
            <div className="mb-3 flex flex-col items-center gap-1">
              {aids.showChoiceEmojis && item.choiceEmojis[idx] && (
                <span data-lever="group-picture" className="text-4xl leading-none">{item.choiceEmojis[idx]}</span>
              )}
              <h3
                className={`font-bold text-center ${MAT_COLORS[idx] ?? MAT_COLORS[0]} ${
                  isPreReader ? 'text-lg' : 'text-sm'
                }`}
              >
                {label}
              </h3>
            </div>
            <LuminaDropZone
              state={zoneState}
              className="min-h-[104px] pointer-events-none content-center justify-center"
            >
              {aids.showFiledWords
                ? placed.map((p) => (
                  <LuminaBadge
                    key={p.id}
                    data-lever="filed-word"
                    className={`bg-white/10 border-white/10 text-slate-200 ${
                      isPreReader ? 'text-base' : 'text-xs'
                    }`}
                  >
                    {p.emoji && <span className="mr-1">{p.emoji}</span>}
                    {p.word}
                  </LuminaBadge>
                ))
                // Hard tier: the exemplars are withheld so the criterion cannot
                // be read off what is already placed. PROGRESS is not — an
                // anonymous count keeps the "words landed here" feedback.
                : placed.length > 0 && (
                  <LuminaBadge
                    aria-label={`${placed.length} words placed here`}
                    className="bg-white/10 border-white/10 text-slate-300 text-xs"
                  >
                    {placed.length}
                  </LuminaBadge>
                )}
            </LuminaDropZone>
          </div>
        );
      })}
    </div>
  );

  /**
   * The word bank — printed WHOLE for the whole challenge and never consumed.
   * A shrinking bank made the last pair of every challenge answerable with no
   * reading at all; keeping every entry keeps the discrimination constant, and
   * the tier decoys sit in the same list, indistinguishable from real partners.
   */
  const renderBank = (item: WordSorterItem) => (
    <div className="flex flex-wrap justify-center gap-2 rounded-xl border border-white/5 bg-white/[0.02] p-4">
      {item.choices.map((text, idx) => (
        <span
          key={text}
          className={`
            inline-flex items-center rounded-xl border px-4 py-2 text-sm font-medium transition-colors
            ${revealedChoice === text
              ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200'
              : 'bg-white/5 border-white/15 text-slate-200'}
          `}
        >
          {item.choiceEmojis[idx] && <span className="mr-1.5">{item.choiceEmojis[idx]}</span>}
          {text}
        </span>
      ))}
    </div>
  );

  /** What has already been paired. Gated on the same tier lever as the mat
   *  badges: at hard it goes, which is what withdraws the elimination
   *  information from a bank that deliberately never shrinks. */
  const renderPaired = (item: WordSorterItem) => {
    const paired = items.filter(
      (i) => i.challengeId === item.challengeId && solvedIds.has(i.id),
    );
    if (!aids.showFiledWords || paired.length === 0) return null;
    return (
      <div data-lever="filed-pairs" className="flex flex-wrap justify-center gap-2">
        {paired.map((p) => (
          <LuminaBadge key={p.id} accent="emerald" className="text-xs">
            {p.word} → {p.answer}
          </LuminaBadge>
        ))}
      </div>
    );
  };

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
          {!summary && !isPreReader && (
            <LuminaBadge accent={modeMeta.accent} className="text-xs">
              {modeMeta.icon} {modeMeta.label}
            </LuminaBadge>
          )}
        </div>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-5">
        {summary ? (
          <PhaseSummaryPanel
            phases={phaseResults}
            heading="Word Sorting Complete!"
            celebrationMessage="Great sorting — you told me every answer out loud!"
          />
        ) : (
          <>
            <div className="flex items-center justify-center gap-4">
              <LuminaChallengeCounter current={lesson.state.index + 1} total={items.length} variant="dots" />
              {/* Tap-to-hear: the question again, never a hint ladder, and never withdrawn by band or tier. */}
              <button
                type="button"
                onClick={() => lesson.requestHear(hearQuestionRequest(currentItem))}
                className="flex h-11 w-11 items-center justify-center rounded-full
                  bg-amber-500/15 border-2 border-amber-500/30
                  hover:bg-amber-500/25 hover:scale-105 active:scale-95 transition-all"
                aria-label="Hear the question again"
              >
                <span className="text-xl">🔁</span>
              </button>
            </div>

            {/* The stimulus card. The word is the QUESTION in every mode (the answer is a group name or a bank word),
                so printing it leaks nothing, and its picture is the pre-reader's way in. */}
            <div className="flex justify-center">
              <div data-pip-object="word"
                className="flex flex-col items-center gap-2 rounded-3xl border-2 border-white/15 bg-white/5 px-10 py-6">
                {currentItem.emoji && <span className="text-7xl leading-none">{currentItem.emoji}</span>}
                <span className={`font-bold text-slate-100 ${currentItem.emoji ? 'text-2xl' : 'text-4xl'}`}>
                  {currentItem.word}
                </span>
                <LuminaReadAloudGlyph size={22} speaking={lesson.tutorSpeaking} />
              </div>
            </div>

            {/* Pip's dock sits between the word card and the mats or bank, so a pointer to the card never crosses an
                answer. */}
            <PipDock />

            <PipWorkspace className="space-y-3">
              {currentItem.mode === 'match_pairs' ? (
                <>
                  {renderBank(currentItem)}
                  {renderPaired(currentItem)}
                </>
              ) : (
                renderMats(currentItem)
              )}
            </PipWorkspace>
          </>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
}

// The teaching workspace is the only path: an unbound mount shows the "needs the tutor" card.
const WordSorter = withWorkspaceOnly<WordSorterProps>('word-sorter', WordSorterSurface, props => props.data.title);

export default WordSorter;
