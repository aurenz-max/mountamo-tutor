'use client';

/**
 * DecodableReader: the child reads a decodable story aloud, one printed line at a time, then answers comprehension
 * questions out loud. It is a boss (`decodableReader.card.ts` + `decodableReader.boss.ts`) on the spoken preset,
 * taught only on the shared tutor/JEV teaching workspace; an unbound mount shows the shared "needs the tutor" card.
 * The observer judges each spoken read or answer and the runtime owns progression: no advance timer, no "Done
 * Reading" button, no Check button and no Next.
 *
 * Why the reading is read: the click-era reading phase measured nothing (its only signal was how often the child
 * tapped a word, and it ended on an "I read it!" button a non-reader can press). Now one passage sentence at a time is
 * read aloud and judged word by word.
 *
 * Every answer is spoken (2026-08-13 user ruling): a literal or read-along question by one word from the story, a
 * sequence, inference or main-idea question by saying which printed choice it is. The choice cards stay on screen
 * because they close the set and their pictures let a pre-reader hold it, but they are a menu, not buttons.
 *
 * There is no per-word tap-to-hear: a channel that speaks any word on demand lets a child hear a line and echo it.
 * "Say that again" asks the tutor for the question only.
 *
 * The domain (build gates, ask, key, scene) is `decodableReaderDomain.ts`; the levers `decodableReaderLevers.ts`.
 * Nothing in this file writes a spoken line.
 */

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaBadge,
  LuminaPanel,
  LuminaChallengeCounter,
  LuminaPrintSupport,
  LuminaReadAloudGlyph,
  motion,
  type LuminaAccent,
} from '../../../ui';
import type { PrimitiveEvaluationResult } from '../../../evaluation';
import type { DecodableReaderMetrics } from '../../../evaluation/types';
import { useTeachingWorkspace, type TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { useTeachingEvaluation } from '../../../components/live-activity/runtime/useTeachingEvaluation';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { leverScene } from '../../../components/live-activity/bossLevers';
import { PipDock, PipWorkspace, useRunnerPip } from '../../../pip/WorkspacePip';
import PhaseSummaryPanel, { type PhaseResult } from '../../../components/PhaseSummaryPanel';
import {
  decodableReaderScene,
  hearAgainRequest,
  itemsFromChallenges,
  passageTextFrom,
  type DecodableOption,
  type DecodableReaderItem,
  type DecodableReaderMode,
} from './decodableReaderDomain';
import { DECODABLE_LEVERS, DOTS_LEVER, REGION_LEVER, TRACK_LEVER, storyRegion, type DecodableLeverContext } from './decodableReaderLevers';
import { decodableReaderBoss } from './decodableReader.boss';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface DecodableComprehensionQuestion {
  question: string;
  /** The ONE-WORD answer, for a question whose answer is a word stated in the
   *  story (literal / read-along). Present = the question is answered ALOUD. */
  answerWord?: string;
  /** The choices, for a question whose answer is a whole proposition — said
   *  aloud, not tapped. `emoji` is the picture stand-in so a pre/emerging
   *  reader can hold the set in mind by picture. */
  options?: DecodableOption[];
  correctOptionId?: string;
}

export interface DecodableReaderData {
  title: string;
  gradeLevel: string;

  // Reading mode. 'decode' (default) = the child reads the passage themselves,
  // one judged sentence at a time. 'read_along' = the TUTOR reads the whole
  // story aloud (the shared-reading stimulus for a true pre-reader) and the
  // child answers questions about it — there are no judged read items at all.
  // The generator sets this from the resolved eval mode.
  // NB: named readingMode, NOT `mode` — `mode` is the eval-test/challenge-type
  // field-name convention for literacy generators and collides with the validator.
  readingMode?: 'decode' | 'read_along';

  // The passage
  passage: {
    sentences: Array<{
      id: string;
      words: Array<{
        id: string;
        text: string;                         // The word as displayed AND as read
        phonicsPattern: 'cvc' | 'cvce' | 'sight' | 'blend' | 'digraph' | 'r-controlled' | 'diphthong' | 'other';
        phonemes?: string[];                  // Legacy; nothing renders these
      }>;
    }>;
    imageDescription?: string;
  };

  // Phonics patterns present in this passage
  phonicsPatternsInPassage: string[];

  // Comprehension SKILL the questions demand (eval-mode task identity). Drives
  // the answer-material fork with `readingMode`.
  comprehensionType?: 'literal' | 'sequence' | 'inference' | 'main_idea';

  /** The judged comprehension questions, asked after the reading. */
  comprehensionQuestions?: DecodableComprehensionQuestion[];
  /** Legacy single-question shape — still built, so pre-port content runs. */
  comprehensionQuestion?: DecodableComprehensionQuestion;

  /** The support tier's sentence window (decodableReaderLadder.ts), stamped by the generator; absent = benched 3-8. */
  sentenceWindow?: { min: number; max: number };
  supportTier?: 'easy' | 'medium' | 'hard';

  // Evaluation props (optional, auto-injected)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<DecodableReaderMetrics>) => void;
}

interface DecodableReaderProps {
  data: DecodableReaderData;
  className?: string;
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted. */
  runtimeEvalMode?: string;
}

// ============================================================================
// Constants
// ============================================================================

// Pattern colours are part of the decodable-text SURFACE — they tint each word
// by phonics pattern, which is what makes this a phonics reader rather than a
// passage. Kept bespoke; suppressed at the early band (reader-fit rule 6).
const PATTERN_COLORS: Record<string, string> = {
  cvc: 'text-blue-300',
  cvce: 'text-violet-300',
  sight: 'text-amber-300',
  blend: 'text-cyan-300',
  digraph: 'text-emerald-300',
  'r-controlled': 'text-rose-300',
  diphthong: 'text-orange-300',
  other: 'text-slate-100',
};

const PATTERN_LABELS: Record<string, string> = {
  cvc: 'CVC',
  cvce: 'Silent-E',
  sight: 'Sight Word',
  blend: 'Blend',
  digraph: 'Digraph',
  'r-controlled': 'R-Controlled',
  diphthong: 'Diphthong',
  other: 'Other',
};

const PATTERN_ACCENTS: Record<string, LuminaAccent> = {
  cvc: 'blue',
  cvce: 'purple',
  sight: 'amber',
  blend: 'cyan',
  digraph: 'emerald',
  'r-controlled': 'rose',
  diphthong: 'orange',
  other: 'cyan',
};

const MODE_META: Record<DecodableReaderMode, { badge: string; icon: string; accent: LuminaAccent }> = {
  read_along: { badge: 'Story Time', icon: '📚', accent: 'purple' },
  literal: { badge: 'Read & Tell', icon: '📖', accent: 'blue' },
  sequence: { badge: 'What Happened', icon: '🔗', accent: 'cyan' },
  inference: { badge: 'Think It Through', icon: '🔍', accent: 'amber' },
  main_idea: { badge: 'The Big Idea', icon: '💡', accent: 'emerald' },
};

/** Summary-row icons, by what the child actually DID on that item. */
const ITEM_ICONS: Record<DecodableReaderItem['kind'], string> = {
  read_line: '📖',
  answer_spoken: '🗣️',
  answer_choice: '🤔',
};

/** Print size for a reader: as large as the line allows without wrapping into
 *  a wall. Length is the only variable that matters here. */
const lineSizeClass = (wordCount: number): string =>
  wordCount <= 4 ? 'text-5xl' : wordCount <= 6 ? 'text-4xl' : 'text-3xl';
// ============================================================================
// Component
// ============================================================================

function DecodableReaderSurface({ data, className, runtimePlanItemId }: DecodableReaderProps) {
  const instance = useRef(data.instanceId || `decodable-reader-${Date.now()}`);
  // The mode fork, the legacy single-question coalesce and the build gates live at one boundary, the one the boss
  // and the journey read too.
  const built = useMemo(() => itemsFromChallenges(data), [data]);
  useEffect(() => {
    if (built.dropped > 0) {
      console.warn(`[DecodableReader] dropped ${built.dropped} unaskable item(s) (word-window / sentinel / `
        + 'answer-material / ear-separability / repeated-answer gates)');
    }
  }, [built.dropped]);
  if (!built.items.length) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-6">
          <p className="text-slate-400 text-center">No story available.</p>
        </LuminaCardContent>
      </LuminaCard>
    );
  }
  return <ReaderWorkspace key={data.instanceId} data={data} items={built.items} mode={built.mode}
    instanceId={instance.current} className={className} runtimePlanItemId={runtimePlanItemId} />;
}

function ReaderWorkspace({ data, items, mode, instanceId, className, runtimePlanItemId }: DecodableReaderProps
  & { items: DecodableReaderItem[]; mode: DecodableReaderMode; instanceId: string }) {
  const { title, gradeLevel, readingMode = 'decode', phonicsPatternsInPassage = [] } = data;
  // K/PRE and Grade-1 readers cannot decode adult chrome (legend, pattern names), so it is suppressed there:
  // reader-fit contract rules 2-7.
  const isEarlyBand = gradeLevel === 'K' || gradeLevel === '1';
  const sentences = useMemo(() => data.passage?.sentences ?? [], [data.passage]);
  const passageText = useMemo(() => passageTextFrom(sentences), [sentences]);
  const workspace = useRef<TeachingWorkspace | null>(null);
  // Levers pulled, keyed by the session item they were pulled on; the easier practice item a simplify lever put on
  // screen in its place.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<DecodableReaderItem | null>(null);
  const openedIndex = useRef(-1);

  const assignments = useMemo(() => items.map(item => ({ ...decodableReaderBoss.assignment(item), checkResponse: () => null })), [items]);
  const lesson = useTeachingWorkspace({ instanceId, primitiveId: 'decodable-reader',
    objectiveId: data.objectiveId, planItemId: runtimePlanItemId, items: assignments, workspace,
    onItemOpened: opened => {
      if (opened !== openedIndex.current) setPractice(null);
      openedIndex.current = opened;
    } });
  useTeachingEvaluation<DecodableReaderMetrics>({ primitiveType: 'decodable-reader', instanceId, data, assignments, lesson,
    metrics: result => {
      const lines = items.filter(i => i.kind === 'read_line');
      const answers = items.filter(i => i.kind !== 'read_line');
      const solved = new Set(result.outcomes.filter(o => o.solved).map(o => o.id));
      return { type: 'decodable-reader', evalMode: mode, gradeLevel, readingMode,
        linesTotal: lines.length, linesRead: lines.filter(i => solved.has(i.id)).length,
        questionsTotal: answers.length, questionsCorrect: answers.filter(i => solved.has(i.id)).length,
        firstTryCount: result.firstTryCount, attemptsCount: result.attemptsCount, accuracy: result.accuracy,
        // Line length is this reader's structural axis; without it the metrics cannot tell a 3-word passage from an
        // 8-word one.
        meanLineWords: lines.length
          ? Math.round((lines.reduce((sum, it) => sum + it.wordCount, 0) / lines.length) * 10) / 10 : 0,
        phonicsPatternsInPassage };
    } });

  const sessionItem = items[lesson.state.index];
  /** What is on screen: the practice item while a simplify lever holds it, else the session item. */
  const currentItem = practice ?? sessionItem;
  const pulledLevers = !practice && leverState.item === sessionItem.id ? leverState.pulled : [];
  const on = (id: string) => pulledLevers.includes(id);
  const leverCtx: DecodableLeverContext = { sentences, items };
  /** Credited: the first moment the answer may appear on screen. A credit that also advances never shows the next
   *  item solved. */
  const revealed = lesson.state.phase === 'checked' && !!lesson.state.lastResponse?.correct && !lesson.state.practice && !practice;
  useRunnerPip({ instanceId, itemId: currentItem.id, running: lesson.state.phase !== 'completed', solved: revealed });
  /** The story region waits for a wrong answer on this item. */
  const missed = lesson.state.attempts.some(a => a.itemId === sessionItem.id && !a.correct);

  useLayoutEffect(() => {
    // No lever on a practice item: the full item's levers come back with it.
    const levers = practice ? [] : DECODABLE_LEVERS.declare(sessionItem, leverCtx, pulledLevers);
    workspace.current = {
      ...leverScene(decodableReaderScene(currentItem, !!practice), {
        support: practice ? '' : DECODABLE_LEVERS.support(sessionItem, leverCtx),
        onScreen: practice ? '' : DECODABLE_LEVERS.onScreen(sessionItem, leverCtx, pulledLevers) }),
      levers,
      // A synchronous commit (the workspace runs it inside flushSync): the screen changes before this returns.
      pullLever: id => {
        const lever = levers.find(l => l.id === id);
        if (!lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled.`;
        if (id === REGION_LEVER && !missed) return 'The story sentences come back only after a wrong answer: let the learner try first.';
        const next = { item: sessionItem.id, pulled: [...pulledLevers, id] };
        const easier = DECODABLE_LEVERS.simpler(sessionItem, leverCtx, id);
        if (lever.kind === 'simplify') {
          if (!easier) return 'There is no easier item here.';
          setLeverState(next); setPractice(easier);
          return { practice: decodableReaderBoss.assignment(easier) };
        }
        setLeverState(next);
        return true;
      },
      endPractice: () => setPractice(null),
    };
  });

  const summary = lesson.summary;
  const firstTryCount = summary?.outcomes.filter(o => o.solved && o.corrections === 0).length ?? 0;
  const phaseResults: PhaseResult[] = summary?.outcomes.map(outcome => {
    const item = items.find(i => i.id === outcome.id);
    const label = item ? (item.kind === 'read_line' ? item.text : (item.question ?? '')) : outcome.id;
    return { label: outcome.assisted ? `${label} (with help)` : label, icon: ITEM_ICONS[item?.kind ?? 'read_line'],
      score: outcome.score, attempts: outcome.attempts, firstTry: outcome.solved && outcome.corrections === 0 };
  }) ?? [];

  // ============================================================================
  // Render
  // ============================================================================

  const meta = MODE_META[mode];

  /** The printed line, word by word: the phonics tint is the decodable-text surface. No word is tappable: audio on
   *  demand is an echo route through the measurement (see the header). */
  const wordTint = (item: DecodableReaderItem, i: number) => revealed
    ? 'text-emerald-300'
    : isEarlyBand ? 'text-white' : PATTERN_COLORS[item.words?.[i]?.phonicsPattern ?? 'other'] ?? 'text-slate-100';
  const renderLine = (item: DecodableReaderItem) => (
    <p data-pip-object="line" className={`font-bold leading-snug tracking-wide ${lineSizeClass(item.wordCount)}`}>
      {on(TRACK_LEVER) || on(DOTS_LEVER) ? (
        // The pulled print marks, drawn by the shared overlay. Visual only: nothing is said.
        <LuminaPrintSupport text={item.text} trackingUnderline={on(TRACK_LEVER)} soundDots={on(DOTS_LEVER)}
          wordClassName={(_w, i) => wordTint(item, i)} />
      ) : (item.words ?? []).map((word, i) => (
        <React.Fragment key={word.id}>
          <span className={wordTint(item, i)}>{word.text}</span>
          {i < (item.words?.length ?? 0) - 1 && ' '}
        </React.Fragment>
      ))}
    </p>
  );

  /** The choice menu. NOT buttons: the child says which one, and nothing here commits an answer (2026-08-13 ruling).
   *  It is on screen because it closes the set, in the order the ask says the choices. */
  const renderChoices = (item: DecodableReaderItem) => (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {(item.options ?? []).map((option: DecodableOption) => {
        const isTarget = option.id === item.correctOptionId;
        return (
          <li
            key={option.id}
            className={`
              flex min-h-[7rem] flex-col items-center justify-center gap-2 rounded-xl border-2 p-4
              text-center transition-all duration-200
              ${revealed && isTarget
                ? 'border-emerald-400/60 bg-emerald-500/15 ring-2 ring-emerald-400/40'
                : 'border-white/10 bg-slate-800/40'}
            `}
          >
            <span className="text-5xl leading-none" aria-hidden>{option.emoji || '🔊'}</span>
            <span className="text-sm text-slate-100">{option.text}</span>
          </li>
        );
      })}
    </ul>
  );

  const renderStage = (item: DecodableReaderItem) => {
    if (item.kind === 'read_line') {
      return (
        <div className="flex min-h-56 flex-col items-center justify-center gap-4 rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 to-slate-900/50 p-8 text-center">
          <div key={`${item.id}-${revealed}`} className={revealed ? motion.pop : motion.reveal}>
            {renderLine(item)}
          </div>
          <div className="text-xs uppercase tracking-[0.25em] text-cyan-300">
            {revealed ? 'yes!' : 'read it'}
          </div>
        </div>
      );
    }
    const region = on(REGION_LEVER) ? storyRegion(item, sentences) : null;
    return (
      <div className="space-y-4">
        {region && (
          // story_region: two whole story sentences, nothing inside them marked.
          <LuminaPanel accent="cyan" className="p-5" data-lever="story-region">
            {region.map((line) => (
              <p key={line} className="text-center text-2xl leading-relaxed text-slate-100">{line}</p>
            ))}
          </LuminaPanel>
        )}
        {/* read-along keeps the story on screen while the tutor reads it: a pre-reader following print IS the
            shared-reading task. */}
        {item.storyText && (
          <LuminaPanel accent="purple" className="p-5">
            <p data-pip-object="story" className="text-center text-2xl leading-relaxed text-slate-100">{item.storyText}</p>
          </LuminaPanel>
        )}
        <div className="rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 to-slate-900/50 p-6 text-center">
          <p data-pip-object="question" className="text-xl font-semibold leading-snug text-white">{item.question}</p>
          <div className="mt-3 text-xs uppercase tracking-[0.25em] text-cyan-300">
            {revealed ? 'yes!' : 'say your answer'}
          </div>
          {/* The answer appears for the first time when it is credited. */}
          {item.kind === 'answer_spoken' && revealed && (
            <div className={`mt-2 text-3xl font-black text-emerald-300 ${motion.pop}`}>{item.answerWord}</div>
          )}
        </div>
        {item.kind === 'answer_choice' && renderChoices(item)}
      </div>
    );
  };

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <LuminaCardTitle className={isEarlyBand ? 'text-xl' : 'text-lg'}>{title}</LuminaCardTitle>
            {!isEarlyBand && (
              <div className="flex items-center gap-2">
                <LuminaBadge className="text-xs">Grade {gradeLevel}</LuminaBadge>
                {phonicsPatternsInPassage.slice(0, 4).map((pattern) => (
                  <LuminaBadge key={pattern} accent={PATTERN_ACCENTS[pattern] ?? 'cyan'} className="text-xs">
                    {PATTERN_LABELS[pattern] ?? pattern}
                  </LuminaBadge>
                ))}
              </div>
            )}
          </div>
          {!summary && (
            <LuminaBadge accent={meta.accent} className="text-xs">
              {meta.icon} {meta.badge}
            </LuminaBadge>
          )}
        </div>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {summary ? (
          // The family panel (score, attempts, first-try star), then the story whole, which for a decode run is the
          // first time the child sees what they read as one piece.
          <div className="space-y-4">
            <PhaseSummaryPanel
              phases={phaseResults}
              heading={mode === 'read_along' ? 'Great story time!' : 'Great reading today!'}
              celebrationMessage={
                mode === 'read_along'
                  ? `You listened to the whole story — ${firstTryCount} of ${items.length} answered on the first try.`
                  : `You read the whole story — ${firstTryCount} of ${items.length} on the first try.`
              }
            />
            <LuminaPanel className="p-4">
              <p className="mb-2 text-[11px] uppercase tracking-widest text-slate-500">The whole story</p>
              <p className="text-base leading-relaxed text-slate-200">{passageText}</p>
            </LuminaPanel>
          </div>
        ) : (
          <>
            <div className="flex justify-center">
              <LuminaChallengeCounter current={lesson.state.index + 1} total={items.length} variant="dots" />
            </div>
            {practice && <div className="text-center text-xs text-amber-300" data-practice-item>Practice</div>}
            {/* Pip's dock sits above the stage, so a pointer never crosses a choice card. */}
            <PipDock />
            <PipWorkspace className="space-y-4">
              {renderStage(currentItem)}
            </PipWorkspace>
            {/* Every item is answered out loud; the tutor repeats the question on request. On a read line the line
                itself stays unspoken: that is the mode. */}
            <div className="flex items-center justify-center gap-3">
              <LuminaReadAloudGlyph size={22} speaking={lesson.tutorSpeaking} />
              <button
                onClick={() => lesson.requestHear(hearAgainRequest(currentItem))}
                className="text-xs text-cyan-300/80 underline underline-offset-4"
              >
                Say that again
              </button>
            </div>
          </>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
}

// The teaching workspace is the only path: an unbound mount shows the "needs the tutor" card.
const DecodableReader = withWorkspaceOnly<DecodableReaderProps>('decodable-reader', DecodableReaderSurface, props => props.data.title);

export default DecodableReader;
