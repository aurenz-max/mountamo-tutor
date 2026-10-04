'use client';

/**
 * GenreExplorer — runs only on the shared tutor/JEV teaching workspace (workspace
 * rollout C7; the scripted runner was retired, LA-14, user ruling 09-23: one path).
 * The observer judges each spoken answer and the runtime owns progression. There
 * is no Next button, no mic panel, and no answer on screen before credit. An
 * unbound mount shows the shared "needs the tutor" card.
 *
 * THE MODALITY, in one sitting:
 *
 *   "Listen to the first one. A fox saw some grapes hanging high …
 *    Your turn. Does the first one have animals that talk?"     → "yes"
 *   "Yes, that is right — the first one does have animals that talk."
 *   "Your turn. What kind of writing is the first one?
 *    Fable, Poem, or Informational?"                            → "Fable"
 *   "Does the first one teach a lesson at the end, or does the
 *    second one?"                                               → "the first one"
 *
 * WHAT WENT, AND WHY:
 *  - **The feature CHECKLIST.** Six to eight toggle rows, each a 1-in-2 coin flip,
 *    every one of which a child who cannot tell a fable from a news report clicks
 *    perfectly. The rows survive as the evidence step — SPOKEN, one judged yes/no
 *    each, which is the DISTAR discrimination question the checklist was pretending
 *    to be.
 *  - **The genre tap.** `LuminaAnswerChoice` cards over `genreOptions`. Saying the
 *    genre is production; tapping it is recognition at 1/N.
 *  - **The Read/Features/Classify/Review rail, the phase chips, the excerpt tabs,
 *    the "Compare Excerpts Side by Side" button and Submit.** Corrections cap in
 *    the runner; `PhaseSummaryPanel` reports.
 *  - **The Review phase**, which printed each excerpt's correct genre beside a
 *    right/wrong chip — the click era's answer key, rendered.
 *
 * WHAT STAYED — the PAGE, never the voice:
 *  - The texts. They are the reading material.
 *  - The printed genre menu with its kid-friendly glosses. A genre question whose
 *    candidates are unknowable is a broken task, not a harder one.
 *  - (Tap-to-hear is gone: with the tutor present, the learner asks it to repeat.)
 *
 * ⚠️ THE TUTOR READS THE TEXT AT GRADES K-2, WHICH IS THE OPPOSITE OF THE PORT
 * BEFORE IT. text-structure-analyzer's tutor may never read the passage, because
 * its answer is a word IN the passage. Genre's answer is a CATEGORY NAME that is
 * not in the text at all (`namesAGenre` drops any excerpt that says one), so
 * reading a fable aloud gives nothing away — and `identify_basic` is grades 1-2,
 * where a child cannot decode four sentences unaided. The rule is a property of
 * the answer material, not a family constant.
 *
 * Asks and build gates live in `genreExplorerScript.ts`; the assignment and scene
 * the tutor receives live in `genreExplorerWorkspace.ts`.
 */

import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  LuminaBadge,
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaChallengeCounter,
  LuminaPanel,
  LuminaReadAloudGlyph,
} from '../../../ui';
import { useStimulusPipSurface } from '../../../pip/useStimulusPipSurface';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { GenreExplorerMetrics } from '../../../evaluation/types';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceRunner, type TeachingEvaluationResult }
  from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { phaseResultsFromSummary } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel, { type PhaseResult } from '../../../components/PhaseSummaryPanel';
import {
  itemsFromPayload,
  type GenreAction,
  type GenreExplorerItem,
  type GenreTier,
} from './genreExplorerScript';
import { genreAssignment, genreScene } from './genreExplorerWorkspace';
import { FAR_KINDS_LEVER, GLOSSES_LEVER, KIND_PAIR_LEVER, PAIR_MODEL_LEVER, READ_AGAIN_LEVER, ROWS_LEVER, TEXT_MODEL_LEVER,
  TWO_CHECKS_LEVER, farKindsFor, genreExplorerLevers, kindPairFor, leversOnScreen, pairModelFor, sentenceRows,
  startingLevers, textModelFor, type FarKindsPractice, type GenreSession } from './genreExplorerLevers';
import { GENRE_LABEL } from './genreExplorerScript';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface GenreExcerpt {
  /** EXACTLY 'e1' | 'e2' | 'e3', in order — `presentIn` points at these. */
  excerptId: string;
  text: string;
  /** A canonical `GenreId` from `genreExplorerScript`. */
  genre: string;
}

/**
 * One row of evidence, shared across the whole activity.
 *
 * ⚠️ `predicate` REPLACES the click era's `label`, and it is not a rename. The
 * child hears "Does this one ___?", so the field must be a BASE-VERB phrase that
 * completes it: "have animals that talk", not "Has characters". A heading form
 * produces "Does this one has characters?" and is DROPPED by the build gates
 * rather than conjugated — the schema owns the grammar, not a regex on our side.
 *
 * `presentIn` replaces a per-excerpt `present` boolean because the entire
 * `compare_genres` question is "true of THIS one but not that one", which was a
 * cross-reference between two sibling arrays and is now one field.
 */
export interface GenreFeature {
  featureId: string;
  predicate: string;
  /** The excerptIds this is TRUE of. `[]` = true of none. */
  presentIn: string[];
}

export interface GenreExplorerData {
  title: string;
  gradeLevel: string;
  /**
   * Classification task identity (eval mode). The judged pack branches on it in
   * exactly ONE place: `compare_genres` builds contrast questions across two
   * texts, the other two build evidence-then-verdict per text.
   */
  mode?: 'identify_basic' | 'classify_genre' | 'compare_genres';
  excerpts: GenreExcerpt[];
  features: GenreFeature[];
  /** Canonical `GenreId`s. Labels and glosses are owned by the script module —
   *  the child SAYS one out loud, so it may not be authored per generation. */
  genreOptions: string[];

  // ──────────────────────────────────────────────────────────────────────
  // Within-mode support tier (config.difficulty) — scaffolding only. These
  // NEVER change an excerpt, its genre, or any presentIn value.
  // ──────────────────────────────────────────────────────────────────────

  /** easy/medium: the ASK names the genre menu aloud; hard prints it only (the
   *  band floor forces it on at every tier). Consumed by the script module. */
  supportTier?: GenreTier;
  /** easy: fewer genres in the spoken menu. Never trims a correct answer, and
   *  saturates at 2 in `identify_basic`, which is a real ceiling. */
  maxGenreOptions?: number;

  /** @deprecated Click-era side-by-side toggle. `mode` decides the shape now. */
  comparisonEnabled?: boolean;

  // Evaluation props
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<GenreExplorerMetrics>) => void;
}

interface GenreExplorerProps {
  data: GenreExplorerData;
  className?: string;
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted. */
  runtimeEvalMode?: string;
}

// ============================================================================
// Constants
// ============================================================================

type GenreAccent = NonNullable<PhaseResult['accentColor']>;

const ACTION_META: Record<GenreAction, { label: string; icon: string; accent: GenreAccent }> = {
  'check-feature': { label: 'What Is In It', icon: '🔍', accent: 'amber' },
  'name-genre': { label: 'What Kind Of Writing', icon: '📚', accent: 'blue' },
  'pick-excerpt': { label: 'Which One', icon: '⚖️', accent: 'emerald' },
};

// ============================================================================
// Component
// ============================================================================

const GenreExplorerSurface: React.FC<GenreExplorerProps> = ({ data, className, runtimePlanItemId }) => {
  const {
    title,
    gradeLevel = '3',
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const stableInstanceIdRef = useRef(instanceId || `genre-explorer-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;
  const workspace = useRef<TeachingWorkspace | null>(null);

  /** Build gates drop what cannot be asked. */
  const { items, excerpts, menu, menuNotes, readsAloud } = useMemo(() => itemsFromPayload(data), [data]);

  /** The credited item's reveal payload, rendered behind `runner.revealHeld`. */
  const [reveal, setReveal] = useState<{ action: GenreAction; answer: string } | null>(null);
  /** Items credited so far: the only route by which a finding or a genre name reaches the screen. */
  const [solvedIds, setSolvedIds] = useState<ReadonlySet<string>>(() => new Set());
  // In-item levers, keyed by the session item they were pulled on, and the practice text a simplify lever put on
  // screen in its place (ungraded; the full item comes back after it).
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<FarKindsPractice | null>(null);

  // ── Evaluation ─────────────────────────────────────────────────────────────
  const evaluation = usePrimitiveEvaluation<GenreExplorerMetrics>({
    primitiveType: 'genre-explorer',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const finish = (summary: TeachingEvaluationResult) => {
    const solvedOf = (...actions: GenreAction[]) => {
      const ids = new Set(items.filter((i) => actions.includes(i.action)).map((i) => i.id));
      return summary.outcomes.filter((o) => ids.has(o.id) && o.solved).length;
    };
    const totalOf = (...actions: GenreAction[]) =>
      items.filter((i) => actions.includes(i.action)).length;

    const metrics: GenreExplorerMetrics = {
      type: 'genre-explorer',
      genresIdentifiedCorrectly: solvedOf('name-genre'),
      genresTotal: totalOf('name-genre'),
      // The evidence step, whichever shape this mode gave it: a yes/no about one
      // text, or a contrast across two.
      featuresCheckedCorrectly: solvedOf('check-feature', 'pick-excerpt'),
      featuresTotal: totalOf('check-feature', 'pick-excerpt'),
      // EARNED, NOT OFFERED: the child answered a contrast question correctly.
      comparisonMade: solvedOf('pick-excerpt') > 0,
      attemptsCount: summary.attemptsCount,
    };
    evaluation.submitResult(
      summary.passed,
      summary.accuracy,
      metrics,
      { itemResults: summary.outcomes, learningResponses: summary.learningResponses,
        teachingAttempts: summary.teachingAttempts, assistanceProvenance: summary.assistanceProvenance },
      undefined,
      summary.diagnosisEvidence,
    );
  };

  const runner = useWorkspaceRunner<GenreExplorerItem>({
    primitiveId: 'genre-explorer',
    assignment: genreAssignment,
    items,
    workspace,
    objectiveId,
    planItemId: runtimePlanItemId,
    // The SESSION's mode, from the mount: a mount's identity must not change while the workspace owns it.
    instanceId: resolvedInstanceId,
    onFinished: finish,
    onAffirmed: (item) => {
      setReveal({ action: item.action, answer: item.answer });
      setSolvedIds((prev) => new Set(prev).add(item.id));
    },
  });
  const showSummary = evaluation.hasSubmitted || !!runner.practiceSummary;

  const sessionItem = runner.currentItem;
  /** What is on screen: the practice item while a simplify lever holds it, else the session item. */
  const currentItem = practice?.item ?? sessionItem;
  const actionMeta = ACTION_META[currentItem?.action ?? 'check-feature'];
  const session: GenreSession = { items, excerpts, menu, readsAloud };
  const starting = practice ? [] : startingLevers(data.supportTier, sessionItem);
  const pulledLevers = practice || leverState.item !== sessionItem?.id ? [] : leverState.pulled;
  const leverOn = (id: string) => starting.includes(id) || pulledLevers.includes(id);
  const textModel = sessionItem && leverOn(TEXT_MODEL_LEVER) ? textModelFor(sessionItem, session) : null;
  const pairModel = sessionItem && leverOn(PAIR_MODEL_LEVER) ? pairModelFor(sessionItem, session) : null;
  const kindPair = sessionItem && leverOn(KIND_PAIR_LEVER) ? kindPairFor(sessionItem, session) : null;
  /** The menu on screen: the practice item's two kinds while one is open. */
  const shownMenu = practice ? practice.item.choices : menu;
  const shownNotes = practice ? practice.item.choiceNotes : menuNotes;

  // What the tutor and the observer are shown, republished every render. W1 offers no
  // demonstration targets and no presentation; every item is answerable once it opens.
  useLayoutEffect(() => {
    if (!currentItem || !sessionItem) return;
    const levers = practice ? [] : genreExplorerLevers(sessionItem, session, pulledLevers, starting);
    const scene = practice
      ? genreScene(practice.item, [{ index: -1, excerptId: 'practice', text: practice.text, spokenText: '', genre: null, ordinal: 'this one' }],
        practice.item.choices, readsAloud)
      : genreScene(currentItem, excerpts, currentItem.action === 'name-genre' ? menu : [], readsAloud);
    const onScreen = practice ? null : leversOnScreen([...starting, ...pulledLevers], sessionItem, session);
    workspace.current = { ...scene,
      facts: { ...scene.facts, ...(onScreen ? { levers_on_screen: onScreen } : {}),
        ...(practice ? { practice: 'An easier practice text named from two kinds, ungraded. The full item comes back after it.' } : {}) },
      levers,
      // A synchronous commit (the workspace runs it inside flushSync): the screen changes before this returns.
      pullLever: id => {
        const lever = levers.find(l => l.id === id);
        if (!lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled.`;
        if (id === FAR_KINDS_LEVER) {
          const simpler = farKindsFor(sessionItem, session);
          if (!simpler) return 'There is no easier text for this item.';
          setLeverState({ item: sessionItem.id, pulled: [...pulledLevers, id] });
          setPractice(simpler);
          return { practice: genreAssignment(simpler.item) };
        }
        setLeverState({ item: sessionItem.id, pulled: [...pulledLevers, id] });
        return true;
      },
      endPractice: () => setPractice(null),
    };
  });

  // Pip: the texts are the question side and the genre menu is the answer, so
  // Pip outlines the texts as a region during the ask and never the menu.
  const pip = useStimulusPipSurface({
    run: runner, instanceId: resolvedInstanceId, label: 'The texts', finished: showSummary,
  });

  /** The evidence this run has already EARNED, in the order it was earned. */
  const findings = useMemo(() => {
    const rows: Array<{ id: string; text: string; positive: boolean }> = [];
    for (const item of items) {
      if (!solvedIds.has(item.id)) continue;
      if (item.action === 'check-feature') {
        rows.push({
          id: item.id,
          text: `${item.excerptOrdinal} ${item.answer === 'yes' ? 'does' : 'does not'} ${item.predicate}`,
          positive: item.answer === 'yes',
        });
      } else if (item.action === 'pick-excerpt') {
        rows.push({ id: item.id, text: `${item.answer} does ${item.predicate}`, positive: true });
      }
    }
    return rows;
  }, [items, solvedIds]);

  /** Genres already credited, by excerpt index — the only route by which a genre name reaches the screen. */
  const affirmedGenreByExcerpt = useMemo(() => {
    const map = new Map<number, string>();
    for (const item of items) {
      if (item.action !== 'name-genre' || !solvedIds.has(item.id)) continue;
      map.set(item.excerptIndex, item.answer);
    }
    return map;
  }, [items, solvedIds]);

  /** What was just credited, for the reveal ring. Guarded on the ACTION. */
  const revealed =
    runner.revealHeld && reveal && reveal.action === currentItem?.action ? reveal.answer : null;

  /**
   * Which texts are on screen. A contrast item is about BOTH, so both are shown;
   * every other item shows the one it is about.
   */
  const shownExcerpts = useMemo(() => {
    if (practice) return [{ index: -1, excerptId: 'practice', text: practice.text, spokenText: '', genre: null, ordinal: 'this one' }];
    if (!currentItem || currentItem.excerptIndex < 0) return excerpts;
    return excerpts.filter((e) => e.index === currentItem.excerptIndex);
  }, [currentItem, excerpts, practice]);

  // ── Phase summary ─────────────────────────────────────────────────────────
  const phaseResults = useMemo<PhaseResult[]>(() => {
    if (!runner.practiceSummary) return [];
    return phaseResultsFromSummary(items, runner.practiceSummary, (item) => ({
      label: ACTION_META[item.action].label,
      icon: ACTION_META[item.action].icon,
      accentColor: ACTION_META[item.action].accent,
    }));
  }, [runner.practiceSummary, items]);

  // ============================================================================
  // Render
  // ============================================================================

  if (items.length === 0) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-8 text-center text-slate-400">
          This reading activity is still being written. Try generating it again.
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  /**
   * The texts — printed material, never an answer surface and never clickable.
   * A genre label appears here only once the tutor has affirmed it, which is what
   * the click era's Review phase was doing four phases too early.
   */
  const renderExcerpts = () => (
    <div className={`grid gap-3 ${shownExcerpts.length > 1 ? 'md:grid-cols-2' : ''}`}>
      {shownExcerpts.map((excerpt) => {
        const affirmedGenre = affirmedGenreByExcerpt.get(excerpt.index);
        const isRevealed = revealed === excerpt.ordinal;
        return (
          <LuminaPanel
            key={excerpt.excerptId}
            className={`p-4 transition-colors ${
              isRevealed ? 'ring-2 ring-emerald-400/50 bg-emerald-500/10' : ''
            }`}
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-400">
                {practice ? 'practice text' : excerpts.length > 1 ? excerpt.ordinal : 'the text'}
              </span>
              {/* read_again: the speaker mark; the tutor reads the whole text once more. */}
              {leverOn(READ_AGAIN_LEVER) && <span data-lever="read-again" aria-label="Read again" className="text-sm">🔊</span>}
              {affirmedGenre && (
                <LuminaBadge accent="emerald" className="text-xs">{affirmedGenre}</LuminaBadge>
              )}
            </div>
            {/* sentence_rows: one sentence per row, every row marked the same; no row is styled from the key. */}
            {leverOn(ROWS_LEVER) && !practice ? (
              <ul data-lever="sentence-rows" className="space-y-1 text-sm leading-relaxed text-slate-200">
                {sentenceRows(excerpt.text).map((row, i) => (
                  <li key={i} className="flex gap-2"><span className="text-slate-500">•</span><span>{row}</span></li>
                ))}
              </ul>
            ) : (
              <p className="whitespace-pre-line text-sm leading-relaxed text-slate-200">
                {excerpt.text}
              </p>
            )}
            {/* two_checks: an empty check under each text; nothing fills it. */}
            {leverOn(TWO_CHECKS_LEVER) && !practice && (
              <p data-lever="two-checks" className="mt-2 text-xs text-slate-400">☐ Does it {currentItem?.predicate}?</p>
            )}
          </LuminaPanel>
        );
      })}
    </div>
  );

  /** What the child has established out loud, so far. Nothing lands here that the
   *  tutor has not affirmed. */
  const renderFindings = () => (
    <div className="space-y-1">
      {findings.map((finding) => (
        <p key={finding.id} className="text-xs text-slate-400">
          <span className={finding.positive ? 'text-emerald-300' : 'text-slate-500'}>
            {finding.positive ? '✓' : '✗'}
          </span>{' '}
          {finding.text}
        </p>
      ))}
    </div>
  );

  /** The genre menu — printed, glossed, and not a button. The child says which
   *  one it is; the ring appears only when the tutor affirms. */
  const renderMenu = () => (
    <div className="grid gap-2 sm:grid-cols-2">
      {shownMenu.map((label, idx) => {
        const isRevealed = revealed === label;
        return (
          <div
            key={label}
            className={`rounded-xl border p-3 transition-colors ${
              isRevealed
                ? 'border-emerald-400/40 bg-emerald-500/15'
                : 'border-white/10 bg-white/5'
            }`}
          >
            <p className={`text-sm font-medium ${isRevealed ? 'text-emerald-200' : 'text-slate-100'}`}>
              {label}
              {/* read_glosses: a speaker mark on every card; the tutor reads them all, in order. */}
              {leverOn(GLOSSES_LEVER) && !practice && <span data-lever="read-glosses" aria-hidden="true" className="ml-1 text-xs">🔊</span>}
            </p>
            {shownNotes[idx] && (
              <p className="mt-0.5 text-xs text-slate-400">{shownNotes[idx]}</p>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
            <LuminaBadge className="text-xs">Grade {gradeLevel}</LuminaBadge>
          </div>
          {/* NO GENRE BADGE ANYWHERE. The click era's Review phase printed each
              excerpt's correct genre beside a right/wrong chip. */}
          {!showSummary && (
            <LuminaBadge accent={actionMeta.accent} className="text-xs">
              {actionMeta.icon} {actionMeta.label}
            </LuminaBadge>
          )}
        </div>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {!showSummary && (
          <>
            <div className="flex items-center justify-center gap-4">
              <LuminaChallengeCounter
                current={Math.min(runner.currentIndex + 1, items.length)}
                total={items.length}
                variant="dots"
              />
              <LuminaReadAloudGlyph size={22} speaking={runner.tutorSpeaking} />
            </div>

            {pip.store && <div {...pip.dock} />}
            <div {...pip.target('stimulus')}>{renderExcerpts()}</div>

            {/* The model cards: other texts, never the learner's. */}
            {(textModel || pairModel || kindPair) && (
              <LuminaPanel data-lever={textModel ? 'text-model' : pairModel ? 'pair-model' : 'kind-pair-model'}
                className="p-3 border-cyan-300/20 bg-cyan-950/10">
                <p className="mb-2 text-center text-[10px] font-mono uppercase tracking-widest text-cyan-300">
                  {textModel ? `Another text: this one does ${textModel.predicate}.` : pairModel
                    ? `Two other texts: only one does ${pairModel[0].predicate}.` : 'Two other texts, two close kinds'}
                </p>
                <div className={`grid gap-2 ${textModel ? '' : 'md:grid-cols-2'}`}>
                  {(textModel ? [textModel] : (pairModel ?? kindPair)!).map((model, i) => (
                    <div key={i} className="rounded-lg border border-white/10 bg-white/5 p-2 text-xs text-slate-200">
                      {kindPair && <p className="mb-1 font-semibold text-cyan-200">{GENRE_LABEL[model.kind]}</p>}
                      {(!pairModel || i === 0) && model.text.includes(model.evidence) ? (
                        <p>{model.text.split(model.evidence)[0]}<u className="decoration-cyan-300">{model.evidence}</u>{model.text.split(model.evidence).slice(1).join(model.evidence)}</p>
                      ) : <p>{model.text}</p>}
                    </div>
                  ))}
                </div>
              </LuminaPanel>
            )}

            {findings.length > 0 && renderFindings()}

            {shownMenu.length > 0 && renderMenu()}

          </>
        )}

        {showSummary && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={evaluation.submittedResult?.score ?? runner.teachingResult?.accuracy}
            durationMs={evaluation.elapsedMs}
            heading="Genre Work Complete!"
            celebrationMessage="Great reading — you told me every answer out loud!"
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

/** Runs only on the teaching workspace; an unbound mount shows the "needs the tutor" card. */
const GenreExplorer = withWorkspaceOnly<GenreExplorerProps>('genre-explorer', GenreExplorerSurface, (props) => props.data.title);

export default GenreExplorer;
