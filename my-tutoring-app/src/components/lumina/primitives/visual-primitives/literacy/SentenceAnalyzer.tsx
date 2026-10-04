'use client';

/**
 * SentenceAnalyzer — runs only on the shared tutor/JEV teaching workspace (workspace
 * rollout C7; the scripted runner was retired, LA-14, user ruling 09-23: one path).
 * The observer judges each spoken label and the runtime owns progression. There is
 * no Next or Check button, no mic panel, and no answer on screen before credit. An
 * unbound mount shows the shared "needs the tutor" card.
 *
 * THE MODALITY, in one sitting:
 *
 *   "I name one word, and you tell me what part of speech it is.
 *    Your turn. What part of speech is the word clever?"        → "adjective"
 *   "Yes, clever is an Adjective."
 *   "Your turn. What part of speech is the word jumped?"        → "verb"
 *   "Your turn. Is the word The in the subject or in the
 *    predicate?"                                                → "subject"
 *
 * WHAT WENT, AND WHY:
 *  - **The four-option menus.** `posOptions`, `roleOptions` and
 *    `sentenceTypeOptions` — one right answer plus three model-written
 *    distractors, per item, at a 1-in-4 guess floor. Saying the label is
 *    production; tapping it is recognition.
 *  - **The label_all chip bank**, which was `new Set(words.map(w => w.partOfSpeech))`
 *    — it printed EXACTLY the labels the sentence used, so the bank could be
 *    counted against the words. Defect class 3 with a different surface.
 *  - **The parse_structure toggle rail** (click a word to cycle none → S → P →
 *    none), its "Check Groups"/"Check Type" two-step, and the reveal-the-correct-
 *    grouping-after-two-tries ladder.
 *  - **Check / Next / Finish, `showExplanation`, `attemptsCount`**, the improvised
 *    tutor channel and its six hand-written control messages. Corrections cap in
 *    the runner; `PhaseSummaryPanel` reports.
 *    (The deleted hook names are deliberately NOT written out here: the §1 census
 *    grep is a plain substring scan, so a docblock naming what it removed reads
 *    as the thing still being present.)
 *
 * WHAT STAYED — the PAGE, never the voice:
 *  - The printed sentence with the asked-about word highlighted. That is the
 *    stimulus, not the answer: it is how the child knows WHICH word.
 *  - A word wall of the grammar vocabulary in scope — GRADE-scoped, glossed,
 *    identical on every item, and not tappable. A teacher has one on the wall.
 *  - (Tap-to-hear is gone: with the tutor present, the learner asks it to repeat.)
 *
 * ⚠️ NO WORD IS EVER COLOURED BY ITS OWN PART OF SPEECH BEFORE IT IS EARNED. The
 * click era had a `POS_COLORS` map; a coloured word is a printed answer wearing a
 * different medium, and no string gate in this family would have caught it (the
 * pixel-leak walk, ten-frame's running counter). Colour arrives on the tutor's
 * credit and not one frame earlier.
 *
 * Asks and build gates live in `sentenceAnalyzerScript.ts`; the assignment and
 * scene the tutor receives live in `sentenceAnalyzerWorkspace.ts`.
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
import type { SentenceAnalyzerMetrics } from '../../../evaluation/types';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceRunner, type TeachingEvaluationResult }
  from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { phaseResultsFromSummary } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel, { type PhaseResult } from '../../../components/PhaseSummaryPanel';
import {
  gradeNumberOf,
  itemsFromPayload,
  posWallFor,
  type SentenceAction,
  type SentenceAnalyzerItem,
  type SentenceTier,
} from './sentenceAnalyzerScript';
import { sentenceAssignment, sentenceScene } from './sentenceAnalyzerWorkspace';
import { EXAMPLES_LEVER, MODEL_LEVER, SPLIT_LEVER, TWO_ROW_LEVER, leversOnScreen, modelSentenceFor, practiceFor,
  sentenceAnalyzerLevers, sessionWords, splitModelFor, startingLevers, twoRowModelFor, wallExamplesFor,
  type LeverContext, type Practice } from './sentenceAnalyzerLevers';
import type { PoolSentence } from './sentenceModels';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface SentenceWord {
  id: string;
  text: string;
  /** A canonical `PosLabel` from `sentenceAnalyzerScript`. */
  partOfSpeech: string;
  /** A canonical `RoleLabel`. `Conjunction` and `Determiner` are NO LONGER roles
   *  — they are parts of speech, and a word keyed to one has no clean answer to
   *  "what job does it do in this sentence?" (it drops as a role target). */
  grammaticalRole: string;
}

export interface SentenceAnalyzerChallenge {
  id: string;
  type: 'identify_pos' | 'identify_role' | 'label_all' | 'parse_structure';

  /** The full sentence text. Printed; read aloud at the band floor. */
  sentence: string;

  /** Every word with its grammar labels — the whole answer key. */
  words: SentenceWord[];

  /** parse_structure: the sentence's kind, a canonical `SentenceTypeLabel`. */
  sentenceType?: string;

  /**
   * ⭐ parse_structure: index of the LAST word of the COMPLETE subject.
   *
   * The explicit key that replaces the click era's derivation
   * (`role.includes('subject') ? 'subject' : 'predicate'`), which put every
   * determiner and every subject-side modifier in the PREDICATE — "The" and
   * "clever" in "The clever fox jumped quickly". Under a button that silently
   * marked correct children wrong; under a judged loop the tutor refuses a
   * correct child out loud. Omitted when the sentence has no contiguous leading
   * subject (an imperative has no subject word at all), and its side items then
   * drop rather than being guessed.
   */
  subjectEndIndex?: number;

  /** Shown after the tutor affirms — never before. */
  explanation: string;
}

export interface SentenceAnalyzerData {
  title: string;
  description: string;
  /** The grade the generator actually RESOLVED and prompted with — not a label
   *  the model wrote. The band-floor read-aloud hangs off this. */
  gradeLevel: string;

  challenges: SentenceAnalyzerChallenge[];

  // ──────────────────────────────────────────────────────────────────────
  // Within-mode support tier (config.difficulty) — scaffolding only. Never
  // changes a sentence, a label, or the subject boundary.
  // ──────────────────────────────────────────────────────────────────────

  /** easy: model + guide + the wall read aloud. medium: model. hard: neither.
   *  The band floor forces the wall reading on at every tier — a tier withdraws
   *  scaffolding, never access. */
  supportTier?: SentenceTier;

  // Evaluation props (optional, auto-injected)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<SentenceAnalyzerMetrics>) => void;
}

interface SentenceAnalyzerProps {
  data: SentenceAnalyzerData;
  className?: string;
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted. */
  runtimeEvalMode?: string;
}

// ============================================================================
// Constants
// ============================================================================

type SentenceAccent = NonNullable<PhaseResult['accentColor']>;

const ACTION_META: Record<SentenceAction, { label: string; icon: string; accent: SentenceAccent }> = {
  'name-pos': { label: 'Part Of Speech', icon: 'Aa', accent: 'blue' },
  'name-role': { label: 'Sentence Job', icon: 'Rr', accent: 'purple' },
  'name-side': { label: 'Subject Or Predicate', icon: '⇔', accent: 'emerald' },
  'name-type': { label: 'Kind Of Sentence', icon: 'Ps', accent: 'amber' },
};

const WALL_HEADING: Record<string, string> = {
  pos: 'Parts of speech',
  role: 'Jobs in a sentence',
  type: 'Kinds of sentence',
};

// ============================================================================
// Component
// ============================================================================

const SentenceAnalyzerSurface: React.FC<SentenceAnalyzerProps> = ({ data, className, runtimePlanItemId }) => {
  const {
    title,
    description,
    gradeLevel = '4',
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const stableInstanceIdRef = useRef(instanceId || `sentence-analyzer-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;
  const workspace = useRef<TeachingWorkspace | null>(null);

  /** Build gates drop what cannot be asked. */
  const { items, sentences, wall, wallNotes, wallKind, readsAloud } = useMemo(
    () => itemsFromPayload(data),
    [data],
  );

  /** The credited item's reveal payload, rendered behind `runner.revealHeld`. */
  const [reveal, setReveal] = useState<{ action: SentenceAction; answer: string } | null>(null);
  /** Items credited so far: the only route by which a grammar label reaches the screen. */
  const [solvedIds, setSolvedIds] = useState<ReadonlySet<string>>(() => new Set());
  // In-item levers, keyed by the session item they were pulled on, and the practice sentence a simplify lever put on
  // screen in its place (ungraded; the full item comes back after it).
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<Practice | null>(null);

  // ── Evaluation ─────────────────────────────────────────────────────────────
  const evaluation = usePrimitiveEvaluation<SentenceAnalyzerMetrics>({
    primitiveType: 'sentence-analyzer',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const finish = (summary: TeachingEvaluationResult) => {
    const idsOf = (...actions: SentenceAction[]) =>
      new Set(items.filter((i) => actions.includes(i.action)).map((i) => i.id));
    const solvedOf = (...actions: SentenceAction[]) => {
      const ids = idsOf(...actions);
      return summary.outcomes.filter((o) => ids.has(o.id) && o.solved).length;
    };
    const totalOf = (...actions: SentenceAction[]) =>
      items.filter((i) => actions.includes(i.action)).length;

    const posTotal = totalOf('name-pos');
    const metrics: SentenceAnalyzerMetrics = {
      type: 'sentence-analyzer',
      gradeLevel,
      totalChallenges: items.length,
      challengesCorrect: summary.outcomes.filter((o) => o.solved).length,
      posIdentifyCorrect: solvedOf('name-pos'),
      roleIdentifyCorrect: solvedOf('name-role'),
      // EARNED, NOT THRESHOLDED: every word is its own judged ask.
      labelAllAccuracy: posTotal > 0 ? Math.round((solvedOf('name-pos') / posTotal) * 100) : 0,
      parseStructureCorrect: solvedOf('name-side', 'name-type'),
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

  const runner = useWorkspaceRunner<SentenceAnalyzerItem>({
    primitiveId: 'sentence-analyzer',
    assignment: sentenceAssignment,
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
  const session = useMemo(() => sessionWords(items), [items]);
  const leverCtx: LeverContext = {
    items, posWall: posWallFor(gradeNumberOf(gradeLevel)), readsAloud,
    subjectWords: (sentences.find((x) => x.index === sessionItem?.sentenceIndex)?.subjectEndIndex ?? -1) + 1,
  };
  const starting = practice ? [] : startingLevers(data.supportTier);
  const pulledLevers = practice || leverState.item !== sessionItem?.id ? [] : leverState.pulled;
  const leverOn = (id: string) => starting.includes(id) || pulledLevers.includes(id);
  const model = !sessionItem || practice ? null
    : leverOn(MODEL_LEVER) && sessionItem.action === 'name-pos' ? wrapModel(modelSentenceFor(sessionItem, session), 'pos')
      : leverOn(TWO_ROW_LEVER) && sessionItem.action === 'name-role' ? wrapModel(twoRowModelFor(sessionItem, session, leverCtx.posWall), 'both')
        : leverOn(SPLIT_LEVER) && sessionItem.action === 'name-side' ? wrapModel(splitModelFor(sessionItem, session), 'split') : null;
  const examples = currentItem && leverOn(EXAMPLES_LEVER) ? wallExamplesFor(currentItem, session) : null;
  const actionMeta = ACTION_META[currentItem?.action ?? 'name-pos'];

  // What the tutor and the observer are shown, republished every render. W1 offers no
  // demonstration targets and no presentation; every item is answerable once it opens.
  useLayoutEffect(() => {
    if (!currentItem || !sessionItem) return;
    const levers = practice ? [] : sentenceAnalyzerLevers(sessionItem, leverCtx, pulledLevers, starting);
    const scene = sentenceScene(currentItem, readsAloud);
    const onScreen = practice ? null : leversOnScreen([...starting, ...pulledLevers], sessionItem, leverCtx);
    workspace.current = { ...scene,
      facts: { ...scene.facts, ...(onScreen ? { levers_on_screen: onScreen } : {}),
        ...(practice ? { practice: 'An easier practice sentence, ungraded. The full item comes back after it.' } : {}) },
      levers,
      // A synchronous commit (the workspace runs it inside flushSync): the screen changes before this returns.
      pullLever: id => {
        const lever = levers.find(l => l.id === id);
        if (!lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled.`;
        if (lever.kind === 'simplify') {
          const simpler = practiceFor(sessionItem, session, leverCtx);
          if (!simpler) return 'There is no easier sentence for this item.';
          setLeverState({ item: sessionItem.id, pulled: [...pulledLevers, id] });
          setPractice(simpler);
          return { practice: sentenceAssignment(simpler.item) };
        }
        setLeverState({ item: sessionItem.id, pulled: [...pulledLevers, id] });
        return true;
      },
      endPractice: () => setPractice(null),
    };
  });

  // Pip: the sentence is the question side (its highlight already marks the word);
  // the label wall is the answer, so Pip outlines only the sentence.
  const pip = useStimulusPipSurface({
    run: runner, instanceId: resolvedInstanceId, label: 'The sentence', finished: showSummary,
  });

  /** What was just credited, for the reveal. Guarded on the ACTION. */
  const revealed =
    runner.revealHeld && reveal && reveal.action === currentItem?.action ? reveal.answer : null;

  /** The sentence this item is about — one on screen at a time (the practice sentence while one is open). */
  const shownSentence = useMemo(
    () => (practice ? { index: -1, words: practice.words.map((text, i) => ({ id: `practice-${i}`, text })) }
      : sentences.find((s) => s.index === (currentItem?.sentenceIndex ?? 0)) ?? sentences[0]),
    [sentences, currentItem, practice],
  );

  /** Labels already credited on THIS sentence, by word index. */
  const affirmedByWord = useMemo(() => {
    const map = new Map<number, string>();
    for (const item of items) {
      if (!solvedIds.has(item.id)) continue;
      if (item.sentenceIndex !== shownSentence?.index) continue;
      if (item.targetIndex < 0) continue;
      map.set(item.targetIndex, item.answer);
    }
    return map;
  }, [items, solvedIds, shownSentence]);

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

  if (items.length === 0 || !shownSentence) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-8 text-center text-slate-400">
          This grammar activity is still being written. Try generating it again.
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  /**
   * The sentence — printed material, never an answer surface and never clickable.
   * The asked-about word is highlighted because that is HOW THE CHILD KNOWS WHICH
   * WORD; nothing about the highlight names its label. A label appears under a
   * word only once the tutor has affirmed it.
   */
  const renderSentence = () => (
    <LuminaPanel className="p-5">
      <div className="flex flex-wrap justify-center gap-2">
        {shownSentence.words.map((word, idx) => {
          const isTarget = currentItem?.targetIndex === idx;
          const affirmed = affirmedByWord.get(idx);
          const isRevealing = isTarget && !!revealed;
          return (
            <div key={word.id} className="flex flex-col items-center gap-1">
              <span
                className={`rounded px-2 py-1 font-serif text-xl transition-all ${
                  isRevealing
                    ? 'border border-emerald-400/50 bg-emerald-500/20 font-bold text-emerald-200'
                    : isTarget
                      ? 'border border-amber-500/40 bg-amber-500/20 font-bold text-amber-300'
                      : 'text-slate-100'
                }`}
              >
                {word.text}
              </span>
              {affirmed && (
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                  {affirmed}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </LuminaPanel>
  );

  /**
   * The word wall — printed, glossed, and not a button. GRADE-scoped, so it
   * carries labels this sentence does not use and narrows nothing (the click
   * era's session-scoped chip bank could be counted against the words). The ring
   * appears only when the tutor affirms.
   */
  const renderWall = () => (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {WALL_HEADING[wallKind] ?? 'Your choices'}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {wall.map((label, idx) => {
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
              </p>
              {wallNotes[idx] && (
                <p className="mt-0.5 text-xs text-slate-400">{wallNotes[idx]}</p>
              )}
              {/* wall_examples: one fixed example per label, all labels at once; marks no label. */}
              {examples?.[label] && (
                <p data-lever="wall-example" className="mt-1 text-xs italic text-cyan-200/80">
                  {examples[label].phrase.split(' ').map((w, i) => (
                    <React.Fragment key={i}>{i > 0 && ' '}
                      {w.replace(/[.,!?]/g, '') === examples[label].word ? <u>{w}</u> : w}
                    </React.Fragment>
                  ))}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
            <p className="text-sm text-slate-400">{description}</p>
            <LuminaBadge className="text-xs">Grade {gradeLevel}</LuminaBadge>
          </div>
          {/* The ACTION, never the label being asked for. */}
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
            <div {...pip.target('stimulus')}>{renderSentence()}</div>
            {practice && <p className="text-center text-xs text-amber-300">Practice sentence</p>}

            {/* The model card: a different sentence, labelled. Nothing on the item's sentence changes. */}
            {model && (
              <LuminaPanel data-lever={model.row === 'pos' ? 'model-sentence' : model.row === 'both' ? 'two-row-model' : 'split-model'}
                className="p-3 border-cyan-300/20 bg-cyan-950/10">
                <p className="mb-2 text-center text-[10px] font-mono uppercase tracking-widest text-cyan-300">Another sentence</p>
                <div className="flex flex-wrap items-start justify-center gap-2">
                  {model.card.words.map((w, i) => {
                    const end = model.card.subjectEnd ?? -1;
                    return (
                      <div key={i} className={`flex flex-col items-center gap-0.5 ${model.row === 'split'
                        ? `border-b-2 px-1 ${i <= end ? 'border-sky-400/70' : 'border-violet-400/70'}` : ''}`}>
                        <span className="font-serif text-base text-slate-100">{w.text}</span>
                        {model.row !== 'split' && <span className="text-[10px] text-cyan-200">{w.pos}</span>}
                        {model.row === 'both' && <span className="text-[10px] text-violet-200">{w.role}</span>}
                        {model.row === 'split' && (i === 0 || i === end + 1) && (
                          <span className="text-[10px] text-slate-300">{i === 0 ? 'subject' : 'predicate'}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </LuminaPanel>
            )}

            {wall.length > 0 && renderWall()}

          </>
        )}

        {showSummary && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={evaluation.submittedResult?.score ?? runner.teachingResult?.accuracy}
            durationMs={evaluation.elapsedMs}
            heading="Grammar Work Complete!"
            celebrationMessage="Great work — you told me every answer out loud!"
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

function wrapModel(card: PoolSentence | null, row: 'pos' | 'both' | 'split') {
  return card ? { card, row } : null;
}

/** Runs only on the teaching workspace; an unbound mount shows the "needs the tutor" card. */
const SentenceAnalyzer = withWorkspaceOnly<SentenceAnalyzerProps>('sentence-analyzer', SentenceAnalyzerSurface,
  (props) => props.data.title);

export default SentenceAnalyzer;
