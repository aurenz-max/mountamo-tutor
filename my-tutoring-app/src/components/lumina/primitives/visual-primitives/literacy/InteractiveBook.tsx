'use client';

/**
 * InteractiveBook — DI modality (FOURTEENTH literacy port, 2026-08-14). The Live
 * tutor owns the clock in both modes: it asks ONCE, waits, judges (in-band for
 * the spoken word; from a code-computed verdict for a tapped book part), and its
 * OWN line is the advance. There is no advance timer, no Next button, no
 * push-to-talk mic, and no answer anywhere on screen before the tutor affirms.
 *
 * WHAT WENT, AND WHY:
 *  - **The push-to-talk capture and the tap-to-choose voice hook.** This was the
 *    last literacy surface where the child tapped a mic before answering — the
 *    open-mic doctrine violation this port discharges. The mic is now open for
 *    the whole run and the runner brackets every turn.
 *  - **The tap-the-glowing-word fallback.** Tapping the word completed an ORAL
 *    READING task without reading anything — the costume test kills it. The
 *    glowing word is read out loud or it is corrected out loud; there is no
 *    third path. (Tap only ever earned partial credit here, which was the tell.)
 *  - **The read-advance delay timer and the whole voice-mode fork.** Progression
 *    now has exactly one cause: the tutor's verdict.
 *  - **The three-attempt reveal-and-lock ladder and its printed reveal.**
 *    Corrections cap in the runner and the lesson moves on; the moveOn line
 *    names the answer so a capped item never ends with the link unmade.
 *  - **Free page navigation during the run.** The arrows let a child wander off
 *    the target page mid-question — the click-era catalog had a struggle entry
 *    for exactly that state. The screen now follows the lesson: each item shows
 *    its own page, which is what "the tutor owns the clock, the screen only
 *    follows" means for a book.
 *  - **The hint disclosure, the focus-word exploration side-quest, and seven
 *    improvised tutor sends.** The cues carry the entire spoken surface;
 *    tap-to-hear (🔊) re-speaks the question and is never withdrawn.
 *
 * WHAT STAYED:
 *  - **The book itself** — generated cover, pages, paragraphs, pictures. It is
 *    the page on the table; find-feature items tap its real printed parts (no
 *    menu is ever added), and read-focus-word items read its real sentence with
 *    the target glowing in place.
 *  - **The answer-leak architecture**: the manifest supplies no book text, no
 *    answers, no challenges; the generator derives every scored contract from
 *    the visible book, and the script's build gates re-check each item at the
 *    seam (interactiveBookScript.ts, one address for both sides of the wire).
 *
 * Cue lines, judging contracts and build gates live in `interactiveBookScript.ts`
 * (hand-authored, DISTAR). Nothing in this file writes a spoken line.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, ImageIcon, Sparkles } from 'lucide-react';
import {
  LuminaBadge,
  LuminaButton,
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaChallengeCounter,
  answerStateClass,
  type AnswerChoiceState,
} from '../../../ui';
import JudgedMicPanel from '../../../components/JudgedMicPanel';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { InteractiveBookMetrics } from '../../../evaluation/types';
import {
  useJudgedScriptRunner,
  type JudgedRunSummary,
} from '../../../hooks/useJudgedScriptRunner';
import type { JudgedScriptPack } from '../../../hooks/judgedScriptContract';
import { judgedAnswerMix } from '../../../hooks/judgedScriptContract';
import { phaseResultsFromSummary } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel, { type PhaseResult } from '../../../components/PhaseSummaryPanel';
import {
  interactiveBookPackBase,
  itemsFromChallenges,
  tapVerdictCue,
  type InteractiveBookItem,
} from './interactiveBookScript';
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
}

interface BookHotspot {
  id: string;
  feature: BookFeatureKind;
  text: string;
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

function hotspotsFor(book: InteractiveBookVolume, pageId: string): BookHotspot[] {
  if (pageId === 'cover') {
    return [
      { id: 'cover-title', feature: 'title', text: book.bookTitle },
      { id: 'cover-author', feature: 'author', text: book.author },
    ];
  }
  const page = book.pages.find((candidate) => candidate.id === pageId);
  if (!page) return [];
  return [
    { id: `${page.id}-heading`, feature: 'heading', text: page.heading },
    { id: `${page.id}-caption`, feature: 'caption', text: page.caption },
    { id: `${page.id}-number`, feature: 'page-number', text: `Page ${page.pageNumber}` },
  ];
}

const InteractiveBook: React.FC<InteractiveBookProps> = ({ data, className }) => {
  const {
    title,
    gradeLevel,
    challenges,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;
  const book = data.books[0];

  const stableInstanceIdRef = useRef(instanceId || `interactive-book-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  /** Build gates drop what cannot be asked — a placeholder in a judged loop
   *  becomes a spoken ask the tutor has to stand behind. */
  const items = useMemo<InteractiveBookItem[]>(
    () => itemsFromChallenges(challenges),
    [challenges],
  );

  // ── Per-item stage state ───────────────────────────────────────────────────
  /** The tapped feature text (find-feature) — cleared on retry and item open. */
  const [tapped, setTapped] = useState<string | null>(null);
  const tappedRef = useRef<string | null>(null);

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

  const handleFinished = useCallback((summary: JudgedRunSummary) => {
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
      { challengeResults: summary.outcomes, hearTaps: summary.hearTaps },
      undefined,
      summary.diagnosisEvidence,
    );
  }, [items, data.challengeType, evaluation]);

  // ── The pack — wording lives in interactiveBookScript.ts ──────────────────
  const pack = useMemo<JudgedScriptPack<InteractiveBookItem>>(() => ({
    ...interactiveBookPackBase(items),
    statusLines: {
      ready: (item) => (item.answerKind === 'voice'
        ? 'Listen — then read the glowing word out loud.'
        : 'Listen — then tap the book part.'),
      retry: (item) => (item.answerKind === 'voice'
        ? 'Listen again — then read the glowing word.'
        : 'Listen again — then tap the book part.'),
      noVerdict: () => 'One more time — read the glowing word.',
      done: 'Great book work today!',
    },
    diagnosisObservation: (item, { lastHeard }) => {
      if (item.mode === 'find-feature') {
        return {
          challenge: `Find the ${item.feature ?? 'book part'} on the page.`,
          expected: `The printed ${item.feature ?? 'part'}: "${item.targetText}".`,
          observed: tappedRef.current
            ? `Tapped the printed words "${tappedRef.current}".`
            : 'Tapped a different part of the page.',
        };
      }
      const heard = lastHeard?.trim() ?? '';
      return {
        challenge: `Hear "${item.readLead ?? ''}" stop, and read the glowing word.`,
        expected: `"${item.targetText}" read aloud.`,
        observed: heard ? `Said "${heard}".` : 'Said something that did not match.',
      };
    },
  }), [items]);

  const runner = useJudgedScriptRunner<InteractiveBookItem>({
    pack,
    instanceId: resolvedInstanceId,
    gradeLevel,
    exhibitId,
    onFinished: handleFinished,
    onItemOpened: () => {
      setTapped(null);
      tappedRef.current = null;
    },
    onCorrectionRetry: () => {
      // The tutor's correction re-modelled in-band; free the page for another go.
      setTapped(null);
      tappedRef.current = null;
    },
  });

  const currentItem = runner.currentItem;
  /** Affirmed: the first moment the answer may appear on screen. */
  const revealed = runner.currentSolved;

  /** The view the lesson is on — the screen follows the current item. */
  const currentPageId = currentItem?.targetPageId ?? 'cover';
  const currentPage = currentPageId === 'cover'
    ? null
    : book?.pages.find((page) => page.id === currentPageId) ?? null;
  const hotspots = useMemo(
    () => (book ? hotspotsFor(book, currentPageId) : []),
    [book, currentPageId],
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

  // ── The tap IS the commit (find-feature) ──────────────────────────────────
  const handleHotspotTap = useCallback((hotspot: BookHotspot) => {
    const item = runner.currentItem;
    if (!item || item.mode !== 'find-feature') return;
    if (!runner.canAttempt || evaluation.hasSubmitted) return;
    // `canAttempt` closes the pending window through batched React state; this
    // ref flips synchronously and stops a second tap in the same tick.
    if (runner.isAwaitingGesture()) return;
    SoundManager.tap();
    setTapped(hotspot.text);
    tappedRef.current = hotspot.text;
    runner.submitGestureAttempt(tapVerdictCue(item, hotspot.text));
  }, [runner, evaluation.hasSubmitted]);

  // ── Phase summary ─────────────────────────────────────────────────────────
  const phaseResults = useMemo<PhaseResult[]>(() => {
    if (!evaluation.hasSubmitted) return [];
    return phaseResultsFromSummary(items, runner.summary, (item) => PHASE_CONFIG[item.mode]);
  }, [evaluation.hasSubmitted, runner.summary, items]);

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
   * loud. On affirm it turns emerald (reveal-on-affirm is a state change, not
   * new information: the word was always visible, reading it is the task).
   * Nothing in a paragraph is a button: the answer leaves the mouth.
   */
  const renderParagraph = (paragraph: string, paragraphIndex: number) => {
    const isReadItem = currentItem?.mode === 'read-focus-word'
      && currentPage?.id === currentItem.targetPageId;
    return (
      <p key={`${currentPageId}-paragraph-${paragraphIndex}`} className="text-lg leading-9 text-slate-100">
        {paragraph.split(/([A-Za-z][A-Za-z'-]*)/g).map((token, tokenIndex) => {
          const isGlowTarget = isReadItem
            && normalizeText(token) === normalizeText(currentItem?.targetText ?? '');
          if (!isGlowTarget) return <React.Fragment key={tokenIndex}>{token}</React.Fragment>;
          return (
            <span
              key={tokenIndex}
              className={`rounded px-0.5 font-semibold underline decoration-2 underline-offset-4 transition-all ${
                revealed
                  ? 'bg-emerald-400/15 text-emerald-200 decoration-emerald-300'
                  : 'animate-pulse bg-amber-400/15 text-amber-100 decoration-amber-400 ring-2 ring-amber-300/70 ring-offset-2 ring-offset-slate-900'
              }`}
            >
              {token}
            </span>
          );
        })}
      </p>
    );
  };

  // ============================================================================
  // Main render
  // ============================================================================

  if (!book || items.length === 0) {
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
          {!evaluation.hasSubmitted && (
            <LuminaBadge accent="blue">K–2 book skills</LuminaBadge>
          )}
        </div>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {!evaluation.hasSubmitted && (
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
                onClick={runner.hearStimulus}
                className={`
                  flex h-11 w-11 items-center justify-center rounded-full
                  bg-amber-500/15 border-2 border-amber-500/30
                  hover:bg-amber-500/25 hover:scale-105 active:scale-95 transition-all
                  ${runner.stimulusTapped ? 'ring-2 ring-cyan-300/60' : ''}
                `}
                aria-label="Hear the question again"
              >
                <span className="text-xl">🔊</span>
              </button>
            </div>

            {currentPageId === 'cover' ? (
              <div className={`mx-auto max-w-xl rounded-r-[2rem] rounded-l-lg bg-gradient-to-br ${COVER_GRADIENTS[book.coverColor]} p-5 shadow-2xl ring-1 ring-white/15`}>
                {renderImage()}
                <div className="mt-5 space-y-3 text-white">
                  {renderHotspot(hotspots[0], 'w-full text-3xl font-black tracking-tight')}
                  {renderHotspot(hotspots[1], 'text-sm font-semibold')}
                </div>
              </div>
            ) : currentPage ? (
              <div className="rounded-[2rem] border border-white/10 bg-slate-900/75 p-5 shadow-2xl">
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

            {/* The orb reads `answerKind` off the runner: on find-feature the
                mic stays open (the tutor is audible, the child may talk) but
                the answer is the tap, so it must not claim to be listening for
                one. */}
            <JudgedMicPanel run={runner} gestureLabel="Your turn — tap it on the page" />
          </>
        )}

        {evaluation.hasSubmitted && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={evaluation.submittedResult?.score}
            durationMs={evaluation.elapsedMs}
            heading="Interactive Book Complete!"
            celebrationMessage={celebrationFor()}
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default InteractiveBook;
