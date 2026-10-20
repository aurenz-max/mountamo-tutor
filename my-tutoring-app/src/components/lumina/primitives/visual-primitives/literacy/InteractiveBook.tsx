'use client';

/**
 * InteractiveBook, taught on the shared teaching workspace only (the boss: `interactiveBook.card.ts` +
 * `interactiveBook.boss.ts`). A mount with no tutor shows the shared "needs the tutor" card (`withWorkspaceOnly`).
 *
 * WHAT THE CHILD DOES, PER MODE.
 *  - read-focus-word: the tutor reads a real book sentence up to one glowing word and stops; the child READS that word
 *    out loud, and the tutor judges it against the key. Nothing in a paragraph is a button: tapping the word would
 *    complete an oral-reading task without reading anything.
 *  - find-feature: the tutor names a printed book part (title, author, heading, caption, page number); the child TAPS
 *    it on the page. The tap IS the commit, checked by the activity (`commitGesture`); the tutor never sees the key.
 * The screen follows the lesson: each item shows its own view (cover or page); there is no free page navigation, no
 * advance timer and no Next button, and no answer is on screen before it is credited.
 *
 * The domain (build gates, ask, key, misses, scene) is `interactiveBookDomain.ts`; the levers
 * `interactiveBookLevers.ts`. Nothing in this file writes a spoken line.
 */

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, ImageIcon, Sparkles } from 'lucide-react';
import {
  LuminaBadge,
  LuminaButton,
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaChallengeCounter,
  LuminaPrintSupport,
  answerStateClass,
  type AnswerChoiceState,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { InteractiveBookMetrics } from '../../../evaluation/types';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { commitGesture, useWorkspaceRunner, type TeachingEvaluationResult }
  from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { leverScene } from '../../../components/live-activity/bossLevers';
import type { SupportTier } from '../../../components/live-activity/supportFact';
import { judgedAnswerMix } from '../../../hooks/judgedScriptContract';
import { phaseResultsFromSummary, practiceScore } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel, { type PhaseResult } from '../../../components/PhaseSummaryPanel';
import { PipDock, PipWorkspace } from '../../../pip/WorkspacePip';
import {
  describeBookTap,
  hearQuestionRequest,
  interactiveBookMiss,
  interactiveBookScene,
  partsOf,
  tapMatches,
  type BookHotspot,
  type InteractiveBookItem,
} from './interactiveBookDomain';
import { interactiveBookBoss, interactiveBookItems } from './interactiveBook.boss';
import { FOCUS_DOTS_LEVER, INTERACTIVE_BOOK_LEVERS, MODEL_LEVER, modelFor } from './interactiveBookLevers';
import { generateConceptImage } from '../../../service/geminiClient-api';
import { SoundManager } from '../../../utils/SoundManager';

export type InteractiveBookMode = 'text-features' | 'focus-word-reading' | 'mixed';
export type InteractiveBookChallengeType = 'find-feature' | 'read-focus-word';
export type BookWordDifficulty = 'easy' | 'medium' | 'hard';
export type BookFeatureKind = 'title' | 'author' | 'heading' | 'caption' | 'page-number' | 'focus-word';
export type BookCoverColor = 'blue' | 'emerald' | 'amber' | 'purple' | 'rose';

export interface InteractiveBookFocusWord {
  word: string;
  difficulty: BookWordDifficulty;
  definition: string;
  pictureCue: string;
}

export interface InteractiveBookPage {
  id: string;
  pageNumber: number;
  heading: string;
  paragraphs: string[];
  imagePrompt: string;
  imageAlt: string;
  imageUrl?: string | null;
  caption: string;
  focusWords: InteractiveBookFocusWord[];
}

export interface InteractiveBookVolume {
  id: string;
  bookTitle: string;
  author: string;
  coverColor: BookCoverColor;
  coverImagePrompt: string;
  coverImageAlt: string;
  coverImageUrl?: string | null;
  pages: InteractiveBookPage[];
}

export interface InteractiveBookChallenge {
  id: string;
  type: InteractiveBookChallengeType;
  prompt: string;
  targetPageId: string;
  targetFeature: BookFeatureKind;
  /** Literal visible text of the target — the CODE-COMPUTED match key. */
  targetText: string;
  /** All short feature texts visible on the target page (build-gate material). */
  optionTexts: string[];
  hint: string;
  /** `read-focus-word`: exact text the tutor reads before stopping at the target. */
  readLead?: string;
  /** `read-focus-word`: visible continuation after the target word. */
  readTail?: string;
}

export interface InteractiveBookData {
  title: string;
  description: string;
  gradeLevel: string;
  mode: InteractiveBookMode;
  challengeType: InteractiveBookChallengeType | 'mixed';
  wordDifficulty: BookWordDifficulty;
  /** The lesson's support tier (config.difficulty): when the model lever comes. Absent: medium. */
  supportTier?: SupportTier;
  /** V1 contains one book. The array shape preserves the PRD's story/compare expansion seam. */
  books: [InteractiveBookVolume, ...InteractiveBookVolume[]];
  /** 4-6 required challenges, synthesized from the generated book. */
  challenges: InteractiveBookChallenge[];

  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<InteractiveBookMetrics>) => void;
}

interface InteractiveBookProps {
  data: InteractiveBookData;
  className?: string;
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted. */
  runtimeEvalMode?: string;
}

const PHASE_CONFIG = {
  'read-focus-word': { label: 'Read Together', icon: '🎙️' },
  'find-feature': { label: 'Book Detective', icon: '📖' },
} as const;

const COVER_GRADIENTS: Record<BookCoverColor, string> = {
  blue: 'from-blue-950 via-blue-800 to-cyan-700',
  emerald: 'from-emerald-950 via-emerald-800 to-teal-600',
  amber: 'from-amber-950 via-orange-800 to-amber-600',
  purple: 'from-purple-950 via-violet-800 to-fuchsia-700',
  rose: 'from-rose-950 via-rose-800 to-pink-600',
};

const normalizeText = (value: string) => value.trim().toLowerCase();

function InteractiveBookSurface({ data, className, runtimePlanItemId }: InteractiveBookProps) {
  const {
    title,
    challenges,
    supportTier,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;
  const book = data.books[0];
  const workspace = useRef<TeachingWorkspace | null>(null);

  const stableInstanceIdRef = useRef(instanceId || `interactive-book-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  /** The boss's builder: the component, the boss and the journey drop the same unaskable items. */
  const items = useMemo<InteractiveBookItem[]>(
    () => interactiveBookItems({ challenges, supportTier }),
    [challenges, supportTier],
  );

  // ── Per-item stage state ───────────────────────────────────────────────────
  /** The tapped feature text (find-feature) — cleared on retry and item open. */
  const [tapped, setTapped] = useState<string | null>(null);
  // In-item levers (`interactiveBookLevers.ts`), keyed by the session item they were pulled on, and the practice
  // item (a page with its own parts, or a sentence) a simplify lever put on screen in place of the book view.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPracticeState] = useState<InteractiveBookItem | null>(null);
  const practiceRef = useRef<InteractiveBookItem | null>(null);
  const [practiceSolved, setPracticeSolved] = useState(false);
  const setPractice = (next: InteractiveBookItem | null) => { practiceRef.current = next; setPracticeState(next); setPracticeSolved(false); };

  // ── Generated pictures (stimulus-side; prompts forbid printed text) ────────
  const [generatedImages, setGeneratedImages] = useState<Record<string, string>>({});
  const [imageLoading, setImageLoading] = useState<Set<string>>(new Set());
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const imageRequestsRef = useRef(new Set<string>());

  const ensureImage = useCallback(async (key: string, prompt: string) => {
    if (!prompt || imageRequestsRef.current.has(key)) return;
    imageRequestsRef.current.add(key);
    setImageLoading((current) => new Set(current).add(key));
    try {
      const imageUrl = await generateConceptImage(
        `${prompt}. Early-literacy picture-book illustration, warm expressive shapes, high visual clarity, child-safe, no printed words, no letters, no labels.`,
        '4:3',
      );
      if (imageUrl) {
        setGeneratedImages((current) => ({ ...current, [key]: imageUrl }));
      } else {
        setImageErrors((current) => new Set(current).add(key));
      }
    } catch (error) {
      console.warn('[InteractiveBook] image generation failed:', error);
      setImageErrors((current) => new Set(current).add(key));
    } finally {
      setImageLoading((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
  }, []);

  // ── Evaluation ─────────────────────────────────────────────────────────────
  const evaluation = usePrimitiveEvaluation<InteractiveBookMetrics>({
    primitiveType: 'interactive-book',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const finish = (summary: TeachingEvaluationResult) => {
    const solvedIds = new Set(
      summary.outcomes.filter((outcome) => outcome.solved).map((outcome) => outcome.id),
    );
    const voiceItems = items.filter((item) => item.answerKind === 'voice');
    const solvedVoice = voiceItems.filter((item) => solvedIds.has(item.id)).length;
    const total = items.length;

    // The metrics keep their pre-port shape; fields whose channels the port
    // deleted (hints, browse-around exploration, neutral capture misses) are
    // stated as zero rather than repurposed.
    const metrics: InteractiveBookMetrics = {
      type: 'interactive-book',
      challengeType: data.challengeType,
      totalChallenges: total,
      correctCount: summary.solvedCount,
      attemptsCount: summary.attemptsCount,
      firstTryCount: summary.firstTryCount,
      hintsViewed: 0,
      overallAccuracy: summary.accuracy,
      averageAttemptsPerChallenge: total > 0 ? summary.attemptsCount / total : 0,
      pagesVisited: new Set(items.map((item) => item.targetPageId)).size,
      focusWordsExplored: 0,
      voiceAnswers: solvedVoice,
      spokenWords: solvedVoice,
      spokenMisses: 0,
    };

    evaluation.submitResult(
      summary.passed,
      summary.accuracy,
      metrics,
      { challengeResults: summary.outcomes, hearTaps: 0, learningResponses: summary.learningResponses,
        ...(summary.teachingAttempts ? { teachingAttempts: summary.teachingAttempts, assistanceProvenance: summary.assistanceProvenance } : {}) },
      undefined,
      summary.diagnosisEvidence,
    );
  };

  const runner = useWorkspaceRunner<InteractiveBookItem>({
    primitiveId: 'interactive-book',
    assignment: interactiveBookBoss.assignment,
    items,
    workspace,
    objectiveId,
    planItemId: runtimePlanItemId,
    // The SESSION's mode, from the mount: a mount's identity must not change while the workspace owns it.
    instanceId: resolvedInstanceId,
    onFinished: finish,
    onItemOpened: () => {
      setTapped(null);
      setPractice(null);
    },
    onCorrectionRetry: () => {
      // Try again frees the page for another go.
      setTapped(null);
    },
  });

  const sessionItem = runner.currentItem;
  /** What is on screen: the practice item while a simplify lever holds it, else the session item. */
  const currentItem = practice ?? sessionItem;
  const pulledLevers = leverState.item === sessionItem?.id ? leverState.pulled : [];
  const leverCtx = useMemo(() => ({ book }), [book]);
  const model = !practice && pulledLevers.includes(MODEL_LEVER) && sessionItem && book ? modelFor(sessionItem, book) : null;
  const focusDots = !practice && pulledLevers.includes(FOCUS_DOTS_LEVER);
  /** Credited: the first moment the answer may appear on screen. */
  const revealed = runner.currentSolved || practiceSolved;
  const showSummary = evaluation.hasSubmitted || !!runner.practiceSummary;

  /** The view the lesson is on — the screen follows the current item. */
  const currentPageId = currentItem?.targetPageId ?? 'cover';
  const currentPage = currentPageId === 'cover'
    ? null
    : book?.pages.find((page) => page.id === currentPageId) ?? null;
  const hotspots = useMemo(
    () => (book && currentItem ? partsOf(currentItem, book) : []),
    [book, currentItem],
  );

  const currentImage = useMemo(() => {
    if (!book) return null;
    if (!currentPage) {
      return {
        key: 'cover',
        prompt: book.coverImagePrompt,
        alt: book.coverImageAlt,
        providedUrl: book.coverImageUrl ?? null,
      };
    }
    return {
      key: currentPage.id,
      prompt: currentPage.imagePrompt,
      alt: currentPage.imageAlt,
      providedUrl: currentPage.imageUrl ?? null,
    };
  }, [book, currentPage]);

  useEffect(() => {
    if (currentImage && !currentImage.providedUrl && currentImage.prompt) {
      void ensureImage(currentImage.key, currentImage.prompt);
    }
  }, [currentImage, ensureImage]);

  // What the tutor and the observer are shown, republished every render. The lever set writes the support and
  // on-screen facts; a practice item carries no levers.
  useLayoutEffect(() => {
    if (!currentItem || !sessionItem) return;
    const levers = practice ? [] : INTERACTIVE_BOOK_LEVERS.declare(sessionItem, leverCtx, pulledLevers);
    workspace.current = {
      ...leverScene(interactiveBookScene(currentItem), {
        support: practice ? '' : INTERACTIVE_BOOK_LEVERS.support(sessionItem, leverCtx),
        onScreen: practice ? '' : INTERACTIVE_BOOK_LEVERS.onScreen(sessionItem, leverCtx, pulledLevers) }),
      levers,
      // A synchronous commit (the workspace runs it inside flushSync): the screen changes before this returns.
      pullLever: id => {
        const lever = levers.find(l => l.id === id);
        if (!lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled.`;
        if (lever.kind === 'simplify') {
          const simpler = INTERACTIVE_BOOK_LEVERS.simpler(sessionItem, leverCtx, id);
          if (!simpler) return 'There is no easier item here.';
          setLeverState({ item: sessionItem.id, pulled: [...pulledLevers, id] });
          setPractice(simpler);
          setTapped(null);
          return { practice: interactiveBookBoss.assignment(simpler) };
        }
        setLeverState({ item: sessionItem.id, pulled: [...pulledLevers, id] });
        return true;
      },
      endPractice: () => { setPractice(null); setTapped(null); },
    };
  });

  /** Asks the tutor for the question again: a silent host request, never the answer. */
  const hearQuestion = useCallback(() => {
    if (!currentItem) return;
    runner.requestHear(hearQuestionRequest(currentItem));
  }, [runner, currentItem]);

  // ── The tap IS the commit (find-feature), checked by the activity ─────────
  const handleHotspotTap = useCallback((hotspot: BookHotspot) => {
    const item = practiceRef.current ?? runner.currentItem;
    if (!item || item.mode !== 'find-feature') return;
    if (!runner.canAttempt || showSummary) return;
    // `canAttempt` closes the pending window through batched React state; this
    // ref flips synchronously and stops a second tap in the same tick.
    if (runner.isAwaitingGesture()) return;
    SoundManager.tap();
    setTapped(hotspot.text);
    // The practice page is ungraded: its success is local and never affirms the book item.
    if (practiceRef.current && tapMatches(item, hotspot.text)) setPracticeSolved(true);
    commitGesture(runner, { response: describeBookTap(hotspot.text), correct: tapMatches(item, hotspot.text),
      cue: () => describeBookTap(hotspot.text), miss: interactiveBookMiss(item, hotspot) });
  }, [runner, showSummary]);

  // ── Phase summary ─────────────────────────────────────────────────────────
  const phaseResults = useMemo<PhaseResult[]>(() => {
    if (!runner.practiceSummary) return [];
    return phaseResultsFromSummary(items, runner.practiceSummary, (item) => PHASE_CONFIG[item.mode]);
  }, [runner.practiceSummary, items]);

  const celebrationFor = (): string => {
    switch (judgedAnswerMix(items)) {
      case 'voice':
        return 'You read the glowing words out loud, like a real reader!';
      case 'gesture':
        return 'You found the parts of a book — title, headings, captions and all!';
      default:
        return 'You found book parts and read glowing words out loud!';
    }
  };

  // ============================================================================
  // Render helpers
  // ============================================================================

  const hotspotState = (hotspot: BookHotspot): AnswerChoiceState => {
    if (!currentItem || currentItem.mode !== 'find-feature') return 'idle';
    const isTarget = normalizeText(hotspot.text) === normalizeText(currentItem.targetText);
    if (revealed) {
      if (isTarget) return 'correct';
      if (tapped === hotspot.text) return 'incorrect';
      return 'dimmed';
    }
    if (tapped === hotspot.text && !isTarget) return 'incorrect';
    return 'idle';
  };

  const renderHotspot = (hotspot: BookHotspot | undefined, extraClass = '') => {
    if (!hotspot) return null;
    const tappable = currentItem?.mode === 'find-feature';
    return (
      <button
        key={hotspot.id}
        data-pip-object={`part-${hotspot.id}`}
        type="button"
        onClick={() => handleHotspotTap(hotspot)}
        disabled={!tappable || !runner.canAttempt}
        aria-label="A printed part of the book"
        className={`rounded-xl border px-3 py-2 text-left transition-all ${answerStateClass(hotspotState(hotspot))} ${extraClass}`}
      >
        {hotspot.text}
      </button>
    );
  };

  const renderImage = () => {
    if (!currentImage) return null;
    const renderedUrl = currentImage.providedUrl || generatedImages[currentImage.key];
    const isLoading = imageLoading.has(currentImage.key);
    const hasError = imageErrors.has(currentImage.key);
    return (
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-white/10 bg-slate-950/60">
        {renderedUrl && !hasError ? (
          <img
            src={renderedUrl}
            alt={currentImage.alt}
            className="h-full w-full object-cover"
            onError={() => setImageErrors((current) => new Set(current).add(currentImage.key))}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-slate-400">
            {isLoading ? (
              <Sparkles className="h-10 w-10 animate-pulse text-cyan-300" />
            ) : (
              <ImageIcon className="h-10 w-10 text-slate-500" />
            )}
            <p className="max-w-sm text-sm leading-relaxed">
              {isLoading ? 'Painting this page…' : currentImage.alt}
            </p>
            {hasError && currentImage.prompt && (
              <LuminaButton
                tone="ghost"
                onClick={() => {
                  imageRequestsRef.current.delete(currentImage.key);
                  setImageErrors((current) => {
                    const next = new Set(current);
                    next.delete(currentImage.key);
                    return next;
                  });
                  void ensureImage(currentImage.key, currentImage.prompt);
                }}
              >
                Try picture again
              </LuminaButton>
            )}
          </div>
        )}
      </div>
    );
  };

  /**
   * A page paragraph. During a read-focus-word item on this page, the target
   * word GLOWS in place — the print is the stimulus and the child reads it out
   * loud. On credit it turns emerald (a state change, not new information: the
   * word was always visible, reading it is the task). Nothing in a paragraph is
   * a button: the answer leaves the mouth.
   */
  const renderParagraph = (paragraph: string, paragraphIndex: number) => {
    const isReadItem = currentItem?.mode === 'read-focus-word'
      && (currentPage?.id === currentItem.targetPageId || !!practice?.line);
    return (
      <p key={`${currentPageId}-paragraph-${paragraphIndex}`} className="text-lg leading-9 text-slate-100">
        {paragraph.split(/([A-Za-z][A-Za-z'-]*)/g).map((token, tokenIndex) => {
          const isGlowTarget = isReadItem
            && normalizeText(token) === normalizeText(currentItem?.targetText ?? '');
          if (!isGlowTarget) return <React.Fragment key={tokenIndex}>{token}</React.Fragment>;
          return (
            <span
              key={tokenIndex}
              data-pip-object="glow"
              className={`rounded px-0.5 font-semibold underline decoration-2 underline-offset-4 transition-all ${
                revealed
                  ? 'bg-emerald-400/15 text-emerald-200 decoration-emerald-300'
                  : 'animate-pulse bg-amber-400/15 text-amber-100 decoration-amber-400 ring-2 ring-amber-300/70 ring-offset-2 ring-offset-slate-900'
              }`}
            >
              {focusDots ? <LuminaPrintSupport text={token} soundDots /> : token}
            </span>
          );
        })}
      </p>
    );
  };

  // ============================================================================
  // Main render
  // ============================================================================

  if (!book || items.length === 0 || !currentItem) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-8 text-center text-slate-400">
          This book is still being made. Try generating it again.
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <LuminaCardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-cyan-300" />
            {title}
          </LuminaCardTitle>
          {!showSummary && (
            <LuminaBadge accent="blue">K–2 book skills</LuminaBadge>
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
              {/* Tap-to-hear — the question again, never the answer. Never
                  withdrawn by band or tier. */}
              <button
                type="button"
                onClick={hearQuestion}
                className="
                  flex h-11 w-11 items-center justify-center rounded-full
                  bg-amber-500/15 border-2 border-amber-500/30
                  hover:bg-amber-500/25 hover:scale-105 active:scale-95 transition-all
                "
                aria-label="Hear the question again"
              >
                <span className="text-xl">🔊</span>
              </button>
            </div>

            {/* Pip's dock sits above the book; Pip watches the book as a whole and never singles out a part. */}
            <PipDock />

            <PipWorkspace className="space-y-4">
            {/* model_page: a model outside the book, the asked kind of part outlined. Its parts are not tappable. */}
            {model && (
              <div data-lever="model-page" className="mx-auto max-w-xs rounded-2xl border border-dashed border-cyan-300/40 bg-cyan-950/20 p-3 text-sm text-slate-200">
                <div className="mb-1 text-[10px] uppercase tracking-widest text-cyan-300/80">model</div>
                <div className={`space-y-1 ${model.kind === 'cover' ? '' : 'grid grid-cols-2 gap-1'}`}>
                  {model.parts.map(part => (
                    <div key={part.feature} data-model-part={part.feature} data-model-lit={part.lit || undefined}
                      className={`rounded-lg px-2 py-1 ${part.feature === 'title' || part.feature === 'heading' ? 'font-black text-base' : 'text-xs'} ${
                        part.lit ? 'ring-2 ring-amber-300 bg-amber-400/10' : 'opacity-70'}`}>
                      {part.lit && <span aria-hidden="true" className="mr-1">👉</span>}{part.text}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {practice?.line ? (
              // cvc_focus: a practice sentence, not from the book, its short word glowing. Read aloud by the learner.
              <div data-pip-object="page" data-lever="practice-line" className="mx-auto max-w-md rounded-[2rem] border border-white/10 bg-slate-900/75 p-6 text-center shadow-2xl">
                {renderParagraph(practice.line, 0)}
              </div>
            ) : practice?.parts ? (
              // two_part_page: a practice page, not from the book, with two tappable parts in the page's own places.
              <div data-pip-object="page" data-lever="practice-page" className="mx-auto max-w-md rounded-[2rem] border border-white/10 bg-slate-900/75 p-5 shadow-2xl">
                {practice.parts.filter(part => part.feature !== 'caption').map(part => renderHotspot(part,
                  part.feature === 'heading' ? 'text-2xl font-black text-cyan-50' : 'float-right text-sm font-bold'))}
                <div className="clear-both my-4 flex h-24 items-center justify-center rounded-xl bg-white/5 text-4xl" aria-hidden="true">🖼️</div>
                {practice.parts.filter(part => part.feature === 'caption').map(part => renderHotspot(part, 'w-full text-center italic'))}
              </div>
            ) : currentPageId === 'cover' ? (
              <div data-pip-object="page" className={`mx-auto max-w-xl rounded-r-[2rem] rounded-l-lg bg-gradient-to-br ${COVER_GRADIENTS[book.coverColor]} p-5 shadow-2xl ring-1 ring-white/15`}>
                {renderImage()}
                <div className="mt-5 space-y-3 text-white">
                  {renderHotspot(hotspots[0], 'w-full text-3xl font-black tracking-tight')}
                  {renderHotspot(hotspots[1], 'text-sm font-semibold')}
                </div>
              </div>
            ) : currentPage ? (
              <div data-pip-object="page" className="rounded-[2rem] border border-white/10 bg-slate-900/75 p-5 shadow-2xl">
                <div className="mb-4 flex items-start justify-between gap-3">
                  {renderHotspot(hotspots[0], 'text-2xl font-black text-cyan-50')}
                  {renderHotspot(hotspots[2], 'shrink-0 text-sm font-bold')}
                </div>
                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    {renderImage()}
                    <div className="mt-2 text-sm italic text-slate-300">
                      {renderHotspot(hotspots[1], 'w-full text-center italic')}
                    </div>
                  </div>
                  <div className="space-y-4">
                    {currentPage.paragraphs.map((paragraph, index) => renderParagraph(paragraph, index))}
                  </div>
                </div>
              </div>
            ) : null}
            </PipWorkspace>
          </>
        )}

        {showSummary && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={practiceScore(runner.practiceSummary) ?? (evaluation.submittedResult?.score ?? runner.teachingResult?.accuracy)}
            durationMs={evaluation.elapsedMs}
            heading="Interactive Book Complete!"
            celebrationMessage={celebrationFor()}
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
}

// The teaching workspace is the only path: an unbound mount shows the "needs the tutor" card.
const InteractiveBook = withWorkspaceOnly<InteractiveBookProps>('interactive-book', InteractiveBookSurface, props => props.data.title);

export default InteractiveBook;
