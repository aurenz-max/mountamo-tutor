'use client';

/**
 * SortingStation — spoken sorting and classifying on the live tutor's workspace (boss: `sortingStation.boss.ts`,
 * card: `sortingStation.card.ts`). The child says which group a picture card belongs with, how to sort the cards,
 * which card does not belong, how many are in a group, which group has more, or whether one card matches two things.
 * The tutor teaches and judges; the workspace commits outcomes and owns progression. This file draws the page (the
 * cards and the trays) and the levers the tutor pulls.
 *
 * Nothing here decides an answer, and nothing on the page may give one away before it is credited:
 *  - the per-tray count badge is the answer on a count or compare ask, so `hidesCounts` withholds it until then;
 *  - a sort card files into its tray only once its answer is credited, and the odd card lights up only then;
 *  - the easy-tier worked example sits solved in its tray and is never asked (the domain drops it).
 * R4 (contract): at Kindergarten the trays are PICTURE-primary (`bucketEmoji`, else a colour-coded circle) with the
 * word as a caption, and adult chrome (progress dots, badges, description, helper prose) is hidden.
 *
 * Workspace-only: an unbound mount shows the shared "needs the tutor" card (`withWorkspaceOnly`).
 */

import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { LuminaBadge, LuminaCard, LuminaCardContent, LuminaCardHeader, LuminaCardTitle, LuminaChallengeCounter,
  LuminaPanel, LuminaReadAloudGlyph } from '../../../ui';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import type { PrimitiveEvaluationResult } from '../../../evaluation';
import type { SortingStationMetrics } from '../../../evaluation/types';
import { useTeachingWorkspace, type TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { useTeachingEvaluation } from '../../../components/live-activity/runtime/useTeachingEvaluation';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { leverScene } from '../../../components/live-activity/bossLevers';
import { PipDock, PipWorkspace, useRunnerPip } from '../../../pip/WorkspacePip';
import { SoundManager } from '../../../utils/SoundManager';
import { workspaceScene, type SortingItemKind, type SortingStationItem } from './sortingStationDomain';
import { CHECKS_LEVER, EXAMPLES_LEVER, FOCUS_LEVER, LINE_UP_LEVER, ODD_MODEL_LEVER, PICTURES_LEVER, SHOW_TRAYS_LEVER,
  SORTING_LEVERS, TAP_LEVER, TRY_EACH_LEVER, trayExamples, type CreditedCard } from './sortingStationLevers';
import { sortingStationBoss, sortingStationItems } from './sortingStation.boss';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface SortingObject {
  id: string;
  label: string;
  emoji: string;
  attributes: Record<string, string>;
}

export interface SortingCategory {
  label: string;
  rule: Record<string, string>;
  /** Picture-primary tray icon for the pre-reader (K) render — a single emoji that stands for the whole group
   *  (e.g. Need → 🏠, Want → 🎁). Non-load-bearing: correctness is by `rule`, never by the icon. Missing → the K
   *  render falls back to a colour-coded circle (R4). */
  bucketEmoji?: string;
}

export interface SortingStationChallenge {
  id: string;
  type: 'sort-by-one' | 'sort-by-attribute' | 'count-and-compare' | 'two-attributes' | 'odd-one-out' | 'tally-record' | 'sort-variety';
  instruction: string;
  objects: SortingObject[];
  sortingAttribute?: string;
  categories?: SortingCategory[];
  oddOneOut?: string;
  oddOneOutReason?: string;
  comparisonQuestion?: string;
  correctComparison?: 'more' | 'fewer' | 'equal';
  /** two-attributes: the compound criteria, asked one object at a time as a spoken yes/no rather than read as one
   *  written instruction (contract G2 — "what exceeds a pre-reader is the medium, not the cognition"). */
  targetCategory?: string;
  secondaryAttribute?: string;
  secondaryValue?: string;
  /** Easy-tier worked example: ONE object pre-placed in its correct tray as a model, never asked (its answer is on
   *  screen) but still on the page and inside every count. */
  modelItemId?: string;
  /** Tray index the model item is pre-placed into (its correct category). */
  modelItemBin?: number;
  /** Support-tier render levers. `namesSortCriterion: false` is the `hard` rung — the ask stops naming the groups
   *  aloud (readers only; the K band floor beats it). */
  showBucketEmojis?: boolean;
  namesSortCriterion?: boolean;
}

export interface SortingStationData {
  title: string;
  description?: string;
  challenges: SortingStationChallenge[];
  maxCategories: number;
  /** Easy-tier self-check aid: per-tray count badges, overridden per item — on a `count_group` or `compare` ask the
   *  badge IS the answer, so `item.hidesCounts` wins until the answer is credited. */
  showCounts: boolean;
  showTallyChart: boolean;
  gradeBand: 'K' | '1';
  /** Within-mode support tier ('easy' = max scaffolding). Sets whether the ask names the groups. */
  supportTier?: 'easy' | 'medium' | 'hard';

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<SortingStationMetrics>) => void;
}

interface SortingStationProps {
  data: SortingStationData;
  className?: string;
  /** The live host opts in only after its correlated mount handoff. */
  autoStart?: boolean;
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted rather than rebuilt from the item. */
  runtimeEvalMode?: string;
}

// ============================================================================
// Constants
// ============================================================================

const PHASE_TYPE_CONFIG: Record<SortingItemKind, { label: string; icon: string }> = {
  sort:          { label: 'Sort It',       icon: '🎨' },
  pick_rule:     { label: 'Pick the Rule', icon: '🔍' },
  odd_one:       { label: 'Odd One Out',   icon: '🤔' },
  count_group:   { label: 'Count It',      icon: '🔢' },
  compare:       { label: 'Compare',       icon: '📊' },
  both_criteria: { label: 'Both Things',   icon: '🔗' },
};

const BIN_COLORS = [
  { bg: 'bg-red-500/10', border: 'border-red-400/30', text: 'text-red-300' },
  { bg: 'bg-blue-500/10', border: 'border-blue-400/30', text: 'text-blue-300' },
  { bg: 'bg-emerald-500/10', border: 'border-emerald-400/30', text: 'text-emerald-300' },
  { bg: 'bg-amber-500/10', border: 'border-amber-400/30', text: 'text-amber-300' },
];

/** Guaranteed picture-primary tray icon for the pre-reader render when the generator supplied no `bucketEmoji` —
 *  colour-coded, aligned to BIN_COLORS order. K trays are NEVER text-only (R4). */
const FALLBACK_BIN_EMOJI = ['🔴', '🔵', '🟢', '🟡'];

/** What lights up once an answer is credited: the first moment it may appear on screen. */
const rewardFor = (item: SortingStationItem) =>
  item.kind === 'count_group' ? String(item.answerValue ?? item.answer)
    : item.kind === 'both_criteria' ? (item.answer === 'yes' ? 'Yes — both!' : 'No — not both')
      : item.answer;

// ============================================================================
// Component
// ============================================================================

function SortingStationSurface({ data, className, runtimePlanItemId }: SortingStationProps) {
  const items = useMemo(() => sortingStationItems(data), [data]);
  if (!items.length) {
    return <LuminaCard className={className}><LuminaCardContent className="p-6">
      <p className="text-slate-400 text-center">No sorting challenges available.</p></LuminaCardContent></LuminaCard>;
  }
  return <StationWorkspace key={data.instanceId} data={data} items={items} className={className}
    runtimePlanItemId={runtimePlanItemId} />;
}

function StationWorkspace({ data, items, className, runtimePlanItemId }: SortingStationProps & { items: SortingStationItem[] }) {
  const { title, description, challenges = [], showCounts = true, gradeBand = 'K' } = data;
  // Pre-reader (Kindergarten) presentation gate (R4): picture-primary trays, adult chrome hidden.
  const isPreReader = gradeBand === 'K';
  const instance = useRef(data.instanceId || `sorting-station-${Date.now()}`);
  const workspace = useRef<TeachingWorkspace | null>(null);
  // Levers pulled, keyed by the session item they were pulled on; the easier item a simplify lever put on screen in
  // its place (with its own page); the learner's taps on the tap_marks pictures and the check_boxes, keyed by the
  // item on screen.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<SortingStationItem | null>(null);
  const [marks, setMarks] = useState<{ item: string; ids: string[] }>({ item: '', ids: [] });
  const [checks, setChecks] = useState<{ item: string; values: Record<string, 'yes' | 'no'> }>({ item: '', values: {} });
  const openedIndex = useRef(-1);

  const assignments = useMemo(() => items.map(item => ({ ...sortingStationBoss.assignment(item), checkResponse: () => null })), [items]);
  const lesson = useTeachingWorkspace({ instanceId: instance.current, primitiveId: 'sorting-station',
    objectiveId: data.objectiveId, planItemId: runtimePlanItemId, items: assignments, workspace,
    onItemOpened: opened => {
      if (opened !== openedIndex.current) setPractice(null);
      openedIndex.current = opened;
    } });
  useTeachingEvaluation<SortingStationMetrics>({ primitiveType: 'sorting-station', instanceId: instance.current,
    data, assignments, lesson,
    metrics: result => ({ type: 'sorting-station', sortingAccuracy: result.accuracy,
      categoriesUsed: new Set(items.flatMap(i => (i.kind === 'sort' ? i.choices : []))).size,
      attemptsCount: result.attemptsCount }) });

  const challengeById = useMemo(() => new Map(challenges.map(ch => [ch.id, ch])), [challenges]);
  const sessionItem = items[lesson.state.index];
  const sessionChallenge = challengeById.get(sessionItem.challengeId) ?? null;
  /** What is on screen: the easier item while a simplify lever holds it, else the session item. */
  const currentItem = practice ?? sessionItem;
  const currentChallenge = (practice?.practiceChallenge as SortingStationChallenge | undefined)
    ?? challengeById.get(currentItem.challengeId) ?? null;
  const pulled = !practice && leverState.item === sessionItem.id ? leverState.pulled : [];
  const on = (id: string) => pulled.includes(id);
  const markedIds = marks.item === currentItem.id ? marks.ids : [];
  const checkValues = checks.item === currentItem.id ? checks.values : {};

  /** The session item's answer is credited: the reveal may paint. */
  const solved = lesson.state.phase === 'checked' && !!lesson.state.lastResponse?.correct && !lesson.state.practice;
  useRunnerPip({ instanceId: instance.current, itemId: currentItem.id, running: lesson.state.phase !== 'completed', solved });

  /** Sort cards whose answer has been credited, item id → group: read off the session's own attempts. */
  const filed = useMemo(() => {
    const map = new Map<string, string>();
    for (const attempt of lesson.state.attempts) {
      const done = attempt.correct ? items.find(i => i.id === attempt.itemId) : undefined;
      if (done?.kind === 'sort') map.set(done.id, done.answer);
    }
    return map;
  }, [items, lesson.state.attempts]);
  /** Every card credited on a sort so far, for `tray_examples`. */
  const credited = useMemo<CreditedCard[]>(() => Array.from(filed, ([id, group]) => {
    const item = items.find(i => i.id === id)!, ch = challengeById.get(item.challengeId);
    const obj = ch?.objects.find(o => id === `${ch.id}::${o.id}`);
    return ch && obj && ch.sortingAttribute ? [{ challengeId: ch.id, label: obj.label, emoji: obj.emoji, group, rule: ch.sortingAttribute }] : [];
  }).flat(), [filed, items, challengeById]);
  const leverCtx = { challenge: sessionChallenge, preReader: isPreReader, credited };
  const examples = on(EXAMPLES_LEVER) ? trayExamples(sessionItem, leverCtx) : new Map<string, CreditedCard>();

  useLayoutEffect(() => {
    // No lever on an easier item: it is practice, and the full item's levers come back with it.
    const levers = practice ? [] : SORTING_LEVERS.declare(sessionItem, leverCtx, pulled);
    workspace.current = {
      ...leverScene(workspaceScene(currentItem), {
        support: practice ? '' : SORTING_LEVERS.support(sessionItem, leverCtx),
        onScreen: practice ? '' : SORTING_LEVERS.onScreen(sessionItem, leverCtx, pulled) }),
      levers,
      // A synchronous commit (the workspace runs it inside flushSync): the screen changes before this returns.
      pullLever: id => {
        const lever = levers.find(l => l.id === id);
        if (!lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already on screen.`;
        const next = { item: sessionItem.id, pulled: [...pulled, id] };
        const easier = SORTING_LEVERS.simpler(sessionItem, leverCtx, id);
        if (easier) {
          setLeverState(next); setPractice(easier);
          return { practice: sortingStationBoss.assignment(easier) };
        }
        setLeverState(next);
        return true;
      },
      endPractice: () => { setPractice(null); },
    };
  });

  /** Every object of the current challenge, in generated order. The bank stays WHOLE for the whole challenge — no
   *  elimination — so the last ask is as hard as the first (word-sorter's elimination-leak lesson). */
  const boardObjects = currentChallenge?.objects ?? [];
  const trays = currentItem.kind === 'sort'
    ? (currentChallenge?.categories ?? []).filter(c => currentItem.choices.some(l => l.toLowerCase() === c.label.toLowerCase()))
    // show_trays: the empty trays under the cards on a pick-the-rule ask.
    : currentItem.kind === 'count_group' || currentItem.kind === 'compare' || (currentItem.kind === 'pick_rule' && on(SHOW_TRAYS_LEVER))
      ? currentChallenge?.categories ?? [] : [];
  /** Which objects belong to a tray, for the count/compare board. */
  const objectsInTray = (label: string) => {
    const attr = currentItem.ruleName;
    return attr ? boardObjects.filter(o => (o.attributes?.[attr] ?? '').toLowerCase() === label.toLowerCase()) : [];
  };
  /** The card the ask is ABOUT, enlarged and centred so a pre-reader knows what the tutor named without reading. */
  const focusObject = currentItem.kind === 'sort' || currentItem.kind === 'both_criteria'
    ? boardObjects.find(o => currentItem.id.endsWith(`::${o.id}`)) ?? null : null;
  const reveal = solved && !practice;

  const summary = lesson.summary;
  const phases = summary?.outcomes.map(outcome => {
    const item = items.find(i => i.id === outcome.id);
    const config = (item && PHASE_TYPE_CONFIG[item.kind]) ?? { label: 'Sort It', icon: '🎨' };
    return { label: outcome.assisted ? `${config.label} (with help)` : config.label, icon: config.icon, score: outcome.score,
      attempts: outcome.attempts, firstTry: outcome.solved && outcome.attempts === 1, accentColor: 'emerald' as const };
  }) ?? [];

  return (
    <LuminaCard className={`shadow-2xl ${className || ''}`}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
            {/* Mode badges are adult chrome — hidden for pre-readers (R4). */}
            {!isPreReader && !summary && (
              <div className="flex items-center gap-2">
                <LuminaBadge accent="emerald" className="text-xs">
                  {PHASE_TYPE_CONFIG[currentItem.kind]?.icon} {PHASE_TYPE_CONFIG[currentItem.kind]?.label}
                </LuminaBadge>
                {currentItem.ruleName && currentItem.kind !== 'pick_rule' && (
                  <LuminaBadge accent="purple" className="text-xs capitalize">by {currentItem.ruleName}</LuminaBadge>
                )}
              </div>
            )}
          </div>
          <LuminaBadge accent="cyan" className="text-xs">Say it out loud</LuminaBadge>
        </div>
        {!isPreReader && description && <p className="text-slate-400 text-sm mt-1">{description}</p>}
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {summary ? (
          <PhaseSummaryPanel phases={phases} heading="Sorting Complete!" celebrationMessage="You said every answer out loud!" className="mt-4" />
        ) : (
          <div data-station-page className="space-y-4">
            {!isPreReader && (
              <div className="flex justify-center">
                <LuminaChallengeCounter current={lesson.state.index + 1} total={items.length} variant="dots" />
              </div>
            )}
            {practice && <div className="text-center text-xs text-amber-300" data-practice-item>Practice round</div>}

            {/* ── The focus card: what the tutor just named ─────────────── */}
            {focusObject && (
              <div className="flex justify-center">
                <LuminaPanel data-pip-object="focus" className="px-8 py-5 flex flex-col items-center gap-2">
                  <span className={isPreReader ? 'text-7xl' : 'text-5xl'}>{focusObject.emoji}</span>
                  {/* The label is a caption, never the gate — the tutor said it. */}
                  <span className={`text-slate-300 ${isPreReader ? 'text-base' : 'text-sm'}`}>{focusObject.label}</span>
                </LuminaPanel>
              </div>
            )}

            {/* Pip's dock sits between the named card and the answer surfaces. */}
            <PipDock />

            <PipWorkspace className="space-y-4">
              {/* ── The row of cards: odd-one-out and pick-the-rule look at all of them at once. No card is tappable —
                     the answer is said. */}
              {(currentItem.kind === 'odd_one' || currentItem.kind === 'pick_rule') && (
                <div data-pip-object="cards" className={`flex flex-wrap justify-center ${isPreReader ? 'gap-4' : 'gap-3'}`}>
                  {boardObjects.map(obj => {
                    const isAnswer = reveal && currentItem.kind === 'odd_one' && obj.label.toLowerCase() === currentItem.answer.toLowerCase();
                    return (
                      <div key={obj.id} className={`flex flex-col items-center gap-1 rounded-2xl border transition-all duration-200 ${
                        isPreReader ? 'px-6 py-5 min-w-[128px]' : 'px-3 py-2'} ${
                        isAnswer ? 'bg-emerald-500/20 border-emerald-400 scale-110' : 'bg-white/5 border-white/10'}`}>
                        <span className={isPreReader ? 'text-6xl' : 'text-3xl'}>{obj.emoji}</span>
                        <span className={`leading-tight text-center break-words ${
                          isPreReader ? 'text-sm text-slate-300 max-w-[120px]' : 'text-[11px] text-slate-400 max-w-[80px]'}`}>
                          {obj.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* odd_model lever: a fixed model row beside the cards, never the cards themselves. */}
              {currentItem.kind === 'odd_one' && on(ODD_MODEL_LEVER) && (
                <div data-lever="odd-model" className="flex items-center justify-center gap-3 py-2" aria-label="a model row">
                  {['circle', 'circle', 'circle', 'square'].map((shape, i) => (
                    <span key={i} data-model-shape={shape}
                      className={shape === 'circle' ? 'h-8 w-8 rounded-full bg-blue-400/80' : 'h-8 w-8 rounded-md bg-red-400/80'} />
                  ))}
                </div>
              )}

              {/* ── The trays. R4: at K a tray is a PICTURE with the word as a small caption; the word never gates,
                     the tutor names each one. */}
              {trays.length > 0 && (
                <div data-pip-object="trays" className={`grid ${isPreReader ? 'gap-5 max-w-[840px] mx-auto' : 'gap-3'} ${
                  trays.length <= 2 ? 'grid-cols-2' : trays.length === 3 ? 'grid-cols-3' : 'grid-cols-4'}`}>
                  {trays.map((cat, idx) => {
                    const color = BIN_COLORS[idx % BIN_COLORS.length];
                    // A sort tray shows what has been CREDITED into it, plus the easy-tier worked example, which was
                    // pre-placed before the run began and is never asked about.
                    const modelHere = currentChallenge?.modelItemId && currentChallenge.modelItemBin === idx
                      ? boardObjects.filter(o => o.id === currentChallenge.modelItemId) : [];
                    const inTray = currentItem.kind === 'sort'
                      ? [...modelHere, ...boardObjects.filter(o => filed.get(`${currentItem.challengeId}::${o.id}`) === cat.label)]
                      // show_trays on a pick-the-rule ask: the trays stay EMPTY (filled, they are the next asks' answers).
                      : currentItem.kind === 'pick_rule' ? [] : objectsInTray(cat.label);
                    const isRevealedTray = reveal && currentItem.kind === 'sort' && cat.label.toLowerCase() === currentItem.answer.toLowerCase();
                    const example = currentItem.kind === 'sort' ? examples.get(cat.label.toLowerCase()) : undefined;
                    // focus_tray: every tray but the counted one dims. tap_marks: the counted tray's pictures take a ring.
                    const counted = currentItem.kind === 'count_group' && cat.label.toLowerCase() === currentItem.stimulus.toLowerCase();
                    const dimmed = currentItem.kind === 'count_group' && on(FOCUS_LEVER) && !counted;
                    const tappable = counted && on(TAP_LEVER);
                    return (
                      <LuminaPanel key={cat.label} data-pip-object={`tray-${cat.label.toLowerCase()}`} data-dimmed={dimmed ? 'true' : undefined}
                        className={`transition-all duration-200 ${color.bg} ${isRevealedTray ? 'ring-2 ring-emerald-400 scale-105' : ''} ${
                          dimmed ? 'opacity-25' : ''} ${isPreReader ? 'min-h-[168px] p-3' : 'min-h-[100px] p-2'}`}>
                        {/* try_each lever: the card's picture with a question mark on EVERY tray; no tray is marked. */}
                        {currentItem.kind === 'sort' && on(TRY_EACH_LEVER) && focusObject && (
                          <div data-lever="try-each" className="mb-1 flex items-center justify-center gap-1 opacity-70">
                            <span className="text-2xl">{focusObject.emoji || focusObject.label}</span><span className="text-lg">❓</span>
                          </div>
                        )}
                        {isPreReader ? (
                          <div className="flex flex-col items-center gap-1 mb-2">
                            <span className="text-5xl leading-none" aria-hidden>
                              {cat.bucketEmoji || FALLBACK_BIN_EMOJI[idx % FALLBACK_BIN_EMOJI.length]}
                            </span>
                            <span className={`text-sm font-semibold ${color.text}`}>{cat.label}</span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between mb-2">
                            <span className={`text-sm font-medium ${color.text}`}>
                              {/* tray_pictures lever (readers; the pre-reader render always shows it), and show_trays. */}
                              {((currentItem.kind === 'sort' && on(PICTURES_LEVER)) || currentItem.kind === 'pick_rule') && cat.bucketEmoji && (
                                <span data-lever="tray-picture" className="mr-1 text-xl">{cat.bucketEmoji}</span>
                              )}
                              {cat.label}
                            </span>
                            {/* ⭐ The count badge is the ANSWER on a count ask: `hidesCounts` withholds it until credited. */}
                            {showCounts && currentItem.kind !== 'pick_rule' && (!currentItem.hidesCounts || reveal) && (
                              <LuminaBadge accent="cyan" className="text-xs">{inTray.length}</LuminaBadge>
                            )}
                          </div>
                        )}
                        <div className="flex flex-wrap justify-center gap-2">
                          {inTray.map(obj => tappable ? (
                            <button key={obj.id} type="button" data-tap-mark={obj.id}
                              data-ringed={markedIds.includes(obj.id) ? 'true' : 'false'}
                              onClick={() => {
                                SoundManager.tap();
                                setMarks(prev => {
                                  const ids = prev.item === currentItem.id ? prev.ids : [];
                                  return { item: currentItem.id, ids: ids.includes(obj.id) ? ids.filter(i => i !== obj.id) : [...ids, obj.id] };
                                });
                              }}
                              className={`flex flex-col items-center gap-0.5 rounded-full p-1 ${markedIds.includes(obj.id) ? 'ring-2 ring-amber-300' : ''}`}>
                              <span className={isPreReader ? 'text-4xl' : 'text-xl'}>{obj.emoji}</span>
                            </button>
                          ) : (
                            <div key={obj.id} className="flex flex-col items-center gap-0.5">
                              <span className={isPreReader ? 'text-4xl' : 'text-xl'}>{obj.emoji}</span>
                            </div>
                          ))}
                          {/* tray_examples lever: a card credited in an earlier round, on the tray it went to. */}
                          {example && (
                            <div data-lever="tray-example" className="flex flex-col items-center gap-0.5 opacity-60">
                              <span className={isPreReader ? 'text-4xl' : 'text-xl'}>{example.emoji}</span>
                            </div>
                          )}
                        </div>
                      </LuminaPanel>
                    );
                  })}
                </div>
              )}

              {/* line_up lever: each group's pictures in a row, one per column, from the same left edge. No numbers. */}
              {currentItem.kind === 'compare' && on(LINE_UP_LEVER) && (
                <div data-lever="line-up" className="mx-auto flex w-fit flex-col gap-2 rounded-2xl border border-white/10 p-3">
                  {trays.map((cat, idx) => (
                    <div key={cat.label} data-line-row={cat.label.toLowerCase()} className="flex items-center gap-2">
                      <span className="w-10 text-center text-2xl">{cat.bucketEmoji || FALLBACK_BIN_EMOJI[idx % FALLBACK_BIN_EMOJI.length]}</span>
                      {objectsInTray(cat.label).map(obj => (
                        <span key={obj.id} data-line-cell className="w-10 text-center text-3xl">{obj.emoji}</span>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {/* ── two-attributes: the two criteria as picture-free word cues. The question is spoken; these only
                     anchor what "both" means. check_boxes lever: an empty box beside each; only the learner's taps fill it. */}
              {currentItem.kind === 'both_criteria' && currentItem.criteria && (
                <div className="flex justify-center gap-3">
                  {(['primary', 'secondary'] as const).map((part, i) => (
                    <React.Fragment key={part}>
                      {i === 1 && <span className="text-slate-500 self-center text-sm">and</span>}
                      <LuminaBadge accent={part === 'primary' ? 'purple' : 'cyan'} className="text-sm capitalize">
                        {currentItem.criteria![part]}
                      </LuminaBadge>
                      {on(CHECKS_LEVER) && (
                        <button type="button" data-lever="check-box" data-check={part} data-value={checkValues[part] ?? ''}
                          aria-label={`mark ${currentItem.criteria![part]}`}
                          onClick={() => setChecks(prev => {
                            const values = prev.item === currentItem.id ? prev.values : {};
                            const now = values[part], nextValue = now === undefined ? 'yes' : now === 'yes' ? 'no' : undefined;
                            const { [part]: _drop, ...rest } = values;
                            return { item: currentItem.id, values: nextValue ? { ...rest, [part]: nextValue } : rest };
                          })}
                          className="h-9 w-9 self-center rounded-lg border-2 border-white/40 text-xl leading-none">
                          {checkValues[part] === 'yes' ? '✓' : checkValues[part] === 'no' ? '✗' : ''}
                        </button>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              )}
            </PipWorkspace>

            {/* The reward — the first moment an answer may appear: once it is credited. */}
            {reveal && (
              <LuminaPanel className="p-3 text-center">
                <span className="text-emerald-300 text-lg font-black animate-bounce inline-block">{rewardFor(currentItem)}</span>
              </LuminaPanel>
            )}

            <div className="flex justify-center"><LuminaReadAloudGlyph size={22} speaking={lesson.tutorSpeaking} /></div>
            {!isPreReader && <p className="text-center text-xs text-slate-500">Say your answer out loud, or ask for help.</p>}
          </div>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
}

const SortingStation = withWorkspaceOnly<SortingStationProps>('sorting-station', SortingStationSurface, props => props.data.title);
export default SortingStation;
