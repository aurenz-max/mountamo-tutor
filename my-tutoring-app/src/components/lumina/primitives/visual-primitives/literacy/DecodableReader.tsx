'use client';

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaBadge,
  LuminaButton,
  LuminaPanel,
  LuminaActionButton,
  LuminaAnswerChoice,
  LuminaFeedbackCard,
  LuminaInput,
  LuminaStat,
  type AnswerChoiceState,
  type LuminaAccent,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { DecodableReaderMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { SoundManager } from '../../../utils/SoundManager';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface DecodableReaderData {
  title: string;
  gradeLevel: string;

  // Reading mode. 'decode' (default) = the student decodes the passage themselves
  // (the classic K-2 decoding task; legitimate at EMERGING+). 'read_along' = the
  // TUTOR reads the passage aloud while the child follows, then answers a
  // picture-based question — a shared-reading task for true pre-readers (K/PRE),
  // where decoding connected text is not yet a skill. The generator sets this
  // from the resolved eval mode; the component branches the reading phase on it.
  // NB: named readingMode, NOT `mode` — `mode` is the eval-test/challenge-type
  // field-name convention for literacy generators and collides with the validator.
  readingMode?: 'decode' | 'read_along';

  // The passage
  passage: {
    sentences: Array<{
      id: string;
      words: Array<{
        id: string;
        text: string;                         // The word as displayed
        phonicsPattern: 'cvc' | 'cvce' | 'sight' | 'blend' | 'digraph' | 'r-controlled' | 'diphthong' | 'other';
        phonemes?: string[];                  // Optional phoneme breakdown (e.g., ["/k/", "/a/", "/t/"])
      }>;
    }>;
    imageDescription?: string;                // AI image prompt for the passage scene
  };

  // Phonics patterns present in this passage
  phonicsPatternsInPassage: string[];

  // Comprehension SKILL the embedded question demands (eval-mode task identity).
  // Optional / back-compatible: the component does not branch on it — it only
  // pins which reading-comprehension skill the generator authored for.
  comprehensionType?: 'literal' | 'sequence' | 'inference' | 'main_idea';

  // Comprehension question after reading
  comprehensionQuestion: {
    question: string;
    type: 'multiple-choice' | 'short-answer';
    // MC options with stable IDs. `emoji` is a picture stand-in for the option so a
    // pre/emerging reader answers by picture, not by decoding the label (reader-fit
    // rule 3). Optional / back-compatible: absent for older content.
    options?: Array<{ id: string; text: string; emoji?: string }>;
    correctOptionId?: string;                        // MC: matches one option.id
    correctAnswer?: string;                          // Short-answer: the correct text
    acceptableAnswers?: string[];                    // Short-answer: alternatives
  };

  // Evaluation props (optional, auto-injected)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<DecodableReaderMetrics>) => void;
}

// ============================================================================
// Props Interface
// ============================================================================

interface DecodableReaderProps {
  data: DecodableReaderData;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

type ReadingPhase = 'reading' | 'comprehension' | 'review';

// Pattern colors are part of the decodable-text INTERACTION SURFACE — they tint
// each word in the passage body by phonics pattern. Kept bespoke.
const PATTERN_COLORS: Record<string, string> = {
  cvc: 'text-blue-300',
  cvce: 'text-violet-300',
  sight: 'text-amber-300',
  blend: 'text-cyan-300',
  digraph: 'text-emerald-300',
  'r-controlled': 'text-rose-300',
  diphthong: 'text-orange-300',
  other: 'text-slate-300',
};

const PATTERN_BG: Record<string, string> = {
  cvc: 'bg-blue-500/10',
  cvce: 'bg-violet-500/10',
  sight: 'bg-amber-500/10',
  blend: 'bg-cyan-500/10',
  digraph: 'bg-emerald-500/10',
  'r-controlled': 'bg-rose-500/10',
  diphthong: 'bg-orange-500/10',
  other: '',
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

// Pattern → kit accent for the legend badges (chrome). Maps off-union colors.
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

// ============================================================================
// Component
// ============================================================================

const DecodableReader: React.FC<DecodableReaderProps> = ({ data, className }) => {
  const {
    title,
    gradeLevel,
    readingMode = 'decode',
    passage,
    phonicsPatternsInPassage = [],
    comprehensionQuestion,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // Reading band. K/PRE and Grade-1/EMERGING readers cannot decode the adult
  // chrome (stepper, legend, counters, score ledger) and cannot read text-only
  // answer choices — so at this band the child's field is stripped to pictures +
  // audio and answering is single-tap = choose (reader-fit contract rules 2-7).
  // Grade 2+ keeps the richer decoding-fluency UI.
  const isEarlyBand = gradeLevel === 'K' || gradeLevel === '1';
  const isReadAlong = readingMode === 'read_along';

  // Phase state
  const [currentPhase, setCurrentPhase] = useState<ReadingPhase>('reading');

  // Reading tracking
  const [tappedWordIds, setTappedWordIds] = useState<Set<string>>(new Set());
  const [activeWordId, setActiveWordId] = useState<string | null>(null);
  const [showPhonemes, setShowPhonemes] = useState<string | null>(null);
  const [readingStartTime] = useState(Date.now());
  const [readingEndTime, setReadingEndTime] = useState<number | null>(null);
  const [showPatternColors, setShowPatternColors] = useState(true);

  // Comprehension state
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [shortAnswer, setShortAnswer] = useState('');
  const [comprehensionAttempts, setComprehensionAttempts] = useState(0);
  const [comprehensionCorrect, setComprehensionCorrect] = useState<boolean | null>(null);
  const [showTextInReview, setShowTextInReview] = useState(true);

  // Evaluation hook
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
  } = usePrimitiveEvaluation<DecodableReaderMetrics>({
    primitiveType: 'decodable-reader',
    instanceId: instanceId || `decodable-reader-${Date.now()}`,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // Stable instance ID for AI context
  const resolvedInstanceId = useMemo(
    () => instanceId || `decodable-reader-${Date.now()}`,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Total words in passage
  const totalWords = useMemo(() => {
    return passage.sentences.reduce((sum, s) => sum + s.words.length, 0);
  }, [passage]);

  // Sight words count
  const sightWordCount = useMemo(() => {
    return passage.sentences.reduce(
      (sum, s) => sum + s.words.filter(w => w.phonicsPattern === 'sight').length,
      0
    );
  }, [passage]);

  // Sight words not tapped (read independently)
  const sightWordsIndependent = useMemo(() => {
    let count = 0;
    passage.sentences.forEach(s => {
      s.words.forEach(w => {
        if (w.phonicsPattern === 'sight' && !tappedWordIds.has(w.id)) {
          count++;
        }
      });
    });
    return count;
  }, [passage, tappedWordIds]);

  // ── Legible, help-positive score ────────────────────────────────────────
  // Comprehension is the judged act, so it is the BASE (and the pass gate).
  // Independent reading is a POSITIVE bonus you earn on top — tapping a word
  // for help only earns a smaller bonus, it NEVER subtracts from the base.
  // Both parts are shown by name in the review so the number is never a mystery.
  const scoreBreakdown = useMemo(() => {
    const independentWords = Math.max(0, totalWords - tappedWordIds.size);
    const decodingRate = totalWords > 0 ? independentWords / totalWords : 1;
    const comprehensionPoints = comprehensionCorrect === true ? 70 : 0;
    const readingBonus = Math.round(30 * decodingRate);
    return {
      independentWords,
      comprehensionPoints,
      readingBonus,
      total: comprehensionPoints + readingBonus,
      passed: comprehensionCorrect === true,
    };
  }, [totalWords, tappedWordIds.size, comprehensionCorrect]);

  // The answer choices spelled out for the tutor to READ ALOUD to a non-reader.
  // Letter + text only — NEVER the correctOptionId (that would be an answer leak
  // into a spoken line). Forwarded into the bag so the STIMULUS aiDirective's
  // {{comprehensionChoices}} resolves from the component (generator-only keys
  // render as "(not set)").
  const comprehensionChoices = useMemo(() => {
    if (comprehensionQuestion.type === 'multiple-choice' && comprehensionQuestion.options) {
      return comprehensionQuestion.options.map(o => `${o.id}: ${o.text}`).join('   ');
    }
    return '';
  }, [comprehensionQuestion]);

  // The full passage text, sentence by sentence — read aloud by the tutor in
  // read_along mode (the shared-reading STIMULUS). Reading the passage aloud is
  // correct ONLY in read_along; in decode mode it would trivialize the assessed
  // decoding skill, so it is never sent there.
  const passageText = useMemo(
    () => passage.sentences.map(s => s.words.map(w => w.text).join(' ')).join(' '),
    [passage]
  );

  // AI tutoring context
  const aiPrimitiveData = useMemo(() => ({
    title,
    gradeLevel,
    readingMode,
    currentPhase,
    totalWords,
    wordsTapped: tappedWordIds.size,
    wordsReadIndependently: totalWords - tappedWordIds.size,
    phonicsPatternsInPassage: phonicsPatternsInPassage.join(', '),
    passageText,
    comprehensionQuestion: comprehensionQuestion.question,
    comprehensionChoices,
    comprehensionAttempts,
    comprehensionCorrect,
  }), [
    title, gradeLevel, readingMode, currentPhase, totalWords,
    tappedWordIds.size, phonicsPatternsInPassage, passageText,
    comprehensionQuestion.question, comprehensionChoices, comprehensionAttempts,
    comprehensionCorrect,
  ]);

  const { sendText } = useLuminaAI({
    primitiveType: 'decodable-reader',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel,
  });

  // ORIENT beat — a non-reader sees only a passage and on-screen instruction text
  // they cannot read. Fire one spoken frame when the activity opens so the tutor
  // states the task in child terms. In read_along mode this same beat carries the
  // STIMULUS: the tutor reads the whole passage aloud. Once-only (ref-guarded
  // against strict-mode double-invoke); quiet-tutor doctrine allows the
  // frame-at-start beat.
  const orientedRef = useRef(false);
  useEffect(() => {
    if (orientedRef.current) return;
    orientedRef.current = true;
    if (isReadAlong) {
      sendText(
        `[READ_ALONG_START] The read-along story "${title}" just opened. Read the WHOLE story aloud to the `
        + `student now, clearly and warmly, word for word: "${passageText}". Then invite them to tap any word `
        + `to hear it again.`,
        { silent: true }
      );
    } else {
      sendText(
        `[READING_START] The reading activity "${title}" just opened for the student. `
        + `Warmly welcome them and tell them what to do in ONE short, simple sentence.`,
        { silent: true }
      );
    }
  }, [sendText, title, isReadAlong, passageText]);

  // Handle tapping a word
  const handleTapWord = useCallback((wordId: string, wordText: string) => {
    setTappedWordIds(prev => new Set(Array.from(prev).concat(wordId)));
    setActiveWordId(wordId);
    // Pronounce the word via AI
    sendText(`[PRONOUNCE_SOUND] The word is "${wordText}". ${wordText}.`, { silent: true });
    // Show "playing" state briefly
    setTimeout(() => {
      if (activeWordId === wordId) setActiveWordId(null);
    }, 800);
  }, [activeWordId, sendText]);

  // Toggle phoneme breakdown for a word
  const handleTogglePhonemes = useCallback((wordId: string) => {
    setShowPhonemes(prev => prev === wordId ? null : wordId);
  }, []);

  // Move to comprehension
  const handleDoneReading = useCallback(() => {
    SoundManager.navigate();
    setReadingEndTime(Date.now());
    setCurrentPhase('comprehension');
    sendText(
      `[READING_DONE] The student finished reading "${title}". `
      + `They tapped ${tappedWordIds.size} of ${totalWords} words for help and read ${totalWords - tappedWordIds.size} independently. `
      + `Now READ the comprehension question aloud, then READ each answer choice aloud with its letter `
      + `(the child cannot read them), then ask which one. `
      + `Question: "${comprehensionQuestion.question}". Choices: ${comprehensionChoices}`,
      { silent: true }
    );
  }, [sendText, title, tappedWordIds.size, totalWords, comprehensionQuestion.question, comprehensionChoices]);

  // Shared comprehension judge — used by both the deliberate Check flow
  // (grade 2+) and the single-tap = choose flow (early band).
  const judgeComprehension = useCallback((answerId: string, answerText: string) => {
    setComprehensionAttempts(prev => prev + 1);
    const isCorrect = answerId === comprehensionQuestion.correctOptionId;
    setComprehensionCorrect(isCorrect);
    if (isCorrect) {
      SoundManager.playCorrect();
      sendText(
        `[COMPREHENSION_CORRECT] The student answered the comprehension question correctly`
        + `${comprehensionAttempts > 0 ? ` after ${comprehensionAttempts + 1} attempts` : ' on the first try'}! `
        + `Celebrate briefly and let them know we're moving to the review.`,
        { silent: true }
      );
      setTimeout(() => setCurrentPhase('review'), 1200);
    } else {
      SoundManager.playIncorrect();
      sendText(
        `[COMPREHENSION_INCORRECT] The student chose "${answerText}" but that's not correct. `
        + `The question was: "${comprehensionQuestion.question}". `
        + `This is attempt ${comprehensionAttempts + 1}. Give a brief spoken hint without revealing the answer, `
        + `and invite them to try another picture.`,
        { silent: true }
      );
    }
  }, [comprehensionQuestion, comprehensionAttempts, sendText]);

  // Check comprehension answer (deliberate Check button — grade 2+)
  const handleCheckComprehension = useCallback(() => {
    if (comprehensionQuestion.type === 'multiple-choice') {
      const text = comprehensionQuestion.options?.find(o => o.id === selectedAnswer)?.text ?? selectedAnswer;
      judgeComprehension(selectedAnswer, text);
    } else {
      setComprehensionAttempts(prev => prev + 1);
      const answer = shortAnswer.trim().toLowerCase();
      const correct = (comprehensionQuestion.correctAnswer ?? '').toLowerCase();
      const acceptable = comprehensionQuestion.acceptableAnswers?.map(a => a.toLowerCase()) || [];
      const isCorrect = answer === correct || acceptable.includes(answer);
      setComprehensionCorrect(isCorrect);
      if (isCorrect) {
        SoundManager.playCorrect();
        sendText(`[COMPREHENSION_CORRECT] The student answered correctly! Celebrate briefly.`, { silent: true });
        setTimeout(() => setCurrentPhase('review'), 1200);
      } else {
        SoundManager.playIncorrect();
        sendText(
          `[COMPREHENSION_INCORRECT] The student answered "${shortAnswer.trim()}" but that's not correct. `
          + `The question was: "${comprehensionQuestion.question}". Give a brief hint without revealing the answer.`,
          { silent: true }
        );
      }
    }
  }, [comprehensionQuestion, selectedAnswer, shortAnswer, judgeComprehension, sendText]);

  // Single tap = choose (early band) — one tap on a picture answers immediately;
  // feedback lands on the tapped choice. No Check button, no two-tap protocol.
  const handleChooseOption = useCallback((optionId: string, optionText: string) => {
    if (comprehensionCorrect === true) return; // already solved — ignore further taps
    setSelectedAnswer(optionId);
    judgeComprehension(optionId, optionText);
  }, [comprehensionCorrect, judgeComprehension]);

  // Skip to review (if they want to move on after wrong answer)
  const handleContinueToReview = useCallback(() => {
    setCurrentPhase('review');
  }, []);

  // Submit final evaluation
  const submitFinalEvaluation = useCallback(() => {
    if (hasSubmittedEvaluation) return;

    const endTime = readingEndTime || Date.now();
    const readingTimeSeconds = Math.round((endTime - readingStartTime) / 1000);
    const wordsTapped = tappedWordIds.size;
    const accuracy = totalWords > 0
      ? Math.round(((totalWords - wordsTapped) / totalWords) * 100)
      : 100;

    const metrics: DecodableReaderMetrics = {
      type: 'decodable-reader',
      gradeLevel,
      wordsTapped,
      wordsTotal: totalWords,
      comprehensionCorrect: comprehensionCorrect === true,
      phonicsPatternsInPassage,
      sightWordsIdentified: sightWordsIndependent,
      readingTimeSeconds,
      attemptsOnComprehension: comprehensionAttempts,
    };

    // Comprehension (the judged act) is the base and the pass gate; independent
    // reading is a positive bonus that help can never subtract from. See the
    // scoreBreakdown memo — the review shows these exact named parts.
    const score = scoreBreakdown.total;

    submitEvaluation(
      scoreBreakdown.passed,
      score,
      metrics,
      {
        tappedWordIds: Array.from(tappedWordIds),
        readingTimeSeconds,
        selectedAnswer: selectedAnswer || shortAnswer,
      }
    );

    sendText(
      `[SESSION_COMPLETE] The student finished reading "${title}"! `
      + `They read ${totalWords - wordsTapped} of ${totalWords} words independently. `
      + `Comprehension: ${comprehensionCorrect ? 'correct' : 'incorrect'}. `
      + `Score: ${score}%. Celebrate their reading accomplishment!`,
      { silent: true }
    );
  }, [
    hasSubmittedEvaluation,
    readingEndTime,
    readingStartTime,
    tappedWordIds,
    totalWords,
    comprehensionCorrect,
    comprehensionAttempts,
    phonicsPatternsInPassage,
    sightWordsIndependent,
    scoreBreakdown,
    gradeLevel,
    selectedAnswer,
    shortAnswer,
    submitEvaluation,
    sendText,
    title,
  ]);

  // Auto-submit when entering review phase
  const handleFinish = useCallback(() => {
    submitFinalEvaluation();
  }, [submitFinalEvaluation]);

  // Early band has no "Finish" button to read — auto-submit on entering review
  // so the child just sees the celebration.
  useEffect(() => {
    if (isEarlyBand && currentPhase === 'review' && !hasSubmittedEvaluation) {
      submitFinalEvaluation();
    }
  }, [isEarlyBand, currentPhase, hasSubmittedEvaluation, submitFinalEvaluation]);

  // ============================================================================
  // Render Helpers
  // ============================================================================

  // Phase indicator
  const renderPhaseIndicator = () => {
    const phases: { key: ReadingPhase; label: string }[] = [
      { key: 'reading', label: 'Read' },
      { key: 'comprehension', label: 'Answer' },
      { key: 'review', label: 'Review' },
    ];
    return (
      <div className="flex items-center gap-2 mb-4">
        {phases.map((phase, index) => {
          const isActive = phase.key === currentPhase;
          const isCompleted =
            (phase.key === 'reading' && currentPhase !== 'reading') ||
            (phase.key === 'comprehension' && currentPhase === 'review');
          return (
            <React.Fragment key={phase.key}>
              {index > 0 && (
                <div className={`h-0.5 w-8 ${isCompleted || isActive ? 'bg-emerald-500/60' : 'bg-slate-600/40'}`} />
              )}
              <div className="flex items-center gap-1.5">
                <div
                  className={`
                    w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border
                    ${isCompleted
                      ? 'bg-emerald-500/30 border-emerald-500/50 text-emerald-300'
                      : isActive
                        ? 'bg-blue-500/30 border-blue-500/50 text-blue-300'
                        : 'bg-slate-700/30 border-slate-600/40 text-slate-500'
                    }
                  `}
                >
                  {isCompleted ? '✓' : index + 1}
                </div>
                <span
                  className={`text-xs font-medium ${
                    isActive ? 'text-blue-300' : isCompleted ? 'text-emerald-400' : 'text-slate-500'
                  }`}
                >
                  {phase.label}
                </span>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  // Pattern legend
  const renderPatternLegend = () => {
    const patterns = Array.from(new Set(
      passage.sentences.flatMap(s => s.words.map(w => w.phonicsPattern))
    ));
    return (
      <div className="flex flex-wrap gap-1.5 mb-3">
        {patterns.map(pattern => (
          <LuminaBadge
            key={pattern}
            accent={PATTERN_ACCENTS[pattern]}
            className="text-xs"
          >
            {PATTERN_LABELS[pattern] || pattern}
          </LuminaBadge>
        ))}
      </div>
    );
  };

  // Render a single word — part of the decodable-text interaction surface.
  // At early band the words are larger and warmer (bigger tap targets, no
  // pattern tinting) so the child sees a story, not a color-coded worksheet.
  const renderWord = (
    word: { id: string; text: string; phonicsPattern: string; phonemes?: string[] },
    isInteractive: boolean
  ) => {
    const isTapped = tappedWordIds.has(word.id);
    const isActive = activeWordId === word.id;
    const isShowingPhonemes = showPhonemes === word.id;
    const useColors = showPatternColors && !isEarlyBand;
    const colorClass = useColors ? PATTERN_COLORS[word.phonicsPattern] || 'text-slate-200' : 'text-slate-100';
    const bgClass = useColors ? PATTERN_BG[word.phonicsPattern] || '' : '';
    const sizeClass = isEarlyBand ? 'text-3xl px-1.5 py-1 leading-relaxed' : 'text-lg px-1 py-0.5 leading-relaxed';

    return (
      <span key={word.id} className="inline-block relative">
        <button
          onClick={() => {
            if (isInteractive) {
              handleTapWord(word.id, word.text);
              // Phoneme popup is phonics chrome — suppress at early band (rule 6).
              if (!isEarlyBand && word.phonemes && word.phonemes.length > 0) {
                handleTogglePhonemes(word.id);
              }
            }
          }}
          disabled={!isInteractive}
          className={`
            inline-block rounded transition-all
            ${sizeClass}
            ${isInteractive ? 'cursor-pointer hover:bg-white/10' : 'cursor-default'}
            ${isActive ? 'bg-amber-500/20 scale-105' : ''}
            ${isTapped && !isActive ? 'underline decoration-dotted decoration-slate-500 underline-offset-4' : ''}
            ${bgClass}
            ${colorClass}
          `}
        >
          {word.text}
        </button>
        {/* Phoneme popup (grade 2+ only) */}
        {isShowingPhonemes && word.phonemes && word.phonemes.length > 0 && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-10">
            <div className="bg-slate-800 border border-white/20 rounded-lg px-2 py-1 flex gap-1 shadow-xl whitespace-nowrap">
              {word.phonemes.map((p, i) => (
                <span key={i} className="text-amber-300 text-sm font-mono">{p}</span>
              ))}
            </div>
          </div>
        )}
      </span>
    );
  };

  // The passage body — shared by both bands, sized up at early band.
  const renderPassageBody = (interactive: boolean) => (
    <div className={`rounded-xl bg-slate-800/40 border border-white/5 ${isEarlyBand ? 'p-6 space-y-4' : 'p-5 space-y-3'}`}>
      {passage.sentences.map(sentence => (
        <p key={sentence.id} className={isEarlyBand ? 'leading-loose text-center' : 'leading-loose'}>
          {sentence.words.map((word, i) => (
            <React.Fragment key={word.id}>
              {renderWord(word, interactive)}
              {i < sentence.words.length - 1 && <span className="text-slate-200"> </span>}
            </React.Fragment>
          ))}
        </p>
      ))}
    </div>
  );

  // Reading phase
  const renderReadingPhase = () => (
    <div className="space-y-4">
      {/* Instruction — spoken via the ORIENT beat at early band, so the text
          panel (which a non-reader can't read) is suppressed there. */}
      {!isEarlyBand && (
        <LuminaPanel>
          <p className="text-slate-400 text-sm">
            {isReadAlong
              ? <>Listen as I read. <span className="text-amber-300">Tap any word</span> to hear it again.</>
              : <>Read the passage below. <span className="text-amber-300">Tap any word</span> to hear it pronounced.</>}
          </p>
        </LuminaPanel>
      )}

      {/* Pattern legend — phonics chrome, grade 2+ only */}
      {!isEarlyBand && showPatternColors && renderPatternLegend()}

      {/* Passage — the decodable-text interaction surface (bespoke) */}
      {renderPassageBody(true)}

      {/* Reading stats + colors toggle — chrome, grade 2+ only */}
      {!isEarlyBand && (
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>
            Words tapped: {tappedWordIds.size} / {totalWords}
          </span>
          <LuminaButton
            size="sm"
            onClick={() => setShowPatternColors(prev => !prev)}
            className="text-slate-400 text-xs h-7 px-2"
          >
            {showPatternColors ? 'Hide Colors' : 'Show Colors'}
          </LuminaButton>
        </div>
      )}

      {/* Done reading button */}
      <div className="flex justify-center pt-2">
        <LuminaActionButton action="next" onClick={handleDoneReading}>
          {isEarlyBand ? 'I read it!' : 'Done Reading'}
        </LuminaActionButton>
      </div>
    </div>
  );

  // Early-band comprehension — picture-first, single tap = choose, no Check
  // button, no typing. The tutor has already read the question and every choice
  // aloud (READ-ALOUD directive), so a tap is a confident pick, and feedback
  // lands on the tapped picture (color + sound + a spoken tutor response).
  const renderComprehensionEarly = () => {
    const options = comprehensionQuestion.options ?? [];
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {options.map((option) => {
            const isSelected = selectedAnswer === option.id;
            let state: AnswerChoiceState = 'idle';
            if (isSelected) {
              if (comprehensionCorrect === true) state = 'correct';
              else if (comprehensionCorrect === false) state = 'incorrect';
              else state = 'selected';
            }
            return (
              <LuminaAnswerChoice
                key={option.id}
                state={state}
                onClick={() => handleChooseOption(option.id, option.text)}
                disabled={comprehensionCorrect === true}
                className="p-5 flex flex-col items-center justify-center gap-2 text-center min-h-[7rem]"
              >
                <span className="text-5xl leading-none" aria-hidden>
                  {option.emoji || '🔊'}
                </span>
                <span className="text-base text-slate-100">{option.text}</span>
              </LuminaAnswerChoice>
            );
          })}
        </div>
        {comprehensionCorrect === true && (
          <LuminaPanel accent="emerald" className="text-center">
            <span className="text-3xl" aria-hidden>🎉</span>
          </LuminaPanel>
        )}
      </div>
    );
  };

  // Comprehension phase
  const renderComprehensionPhase = () => {
    if (isEarlyBand) return renderComprehensionEarly();
    return (
      <div className="space-y-4">
        <LuminaPanel accent="blue" className="space-y-4">
          <p className="text-slate-200 font-medium">{comprehensionQuestion.question}</p>

          {comprehensionQuestion.type === 'multiple-choice' && comprehensionQuestion.options ? (
            <div className="space-y-2">
              {comprehensionQuestion.options.map((option) => {
                const isSelected = selectedAnswer === option.id;
                let state: AnswerChoiceState = 'idle';
                if (isSelected) {
                  if (comprehensionCorrect === true) state = 'correct';
                  else if (comprehensionCorrect === false && comprehensionAttempts > 0) state = 'incorrect';
                  else state = 'selected';
                }
                return (
                  <LuminaAnswerChoice
                    key={option.id}
                    state={state}
                    onClick={() => setSelectedAnswer(option.id)}
                    disabled={comprehensionCorrect === true}
                    className="p-4"
                  >
                    <span className="text-sm">{option.id}. {option.text}</span>
                  </LuminaAnswerChoice>
                );
              })}
            </div>
          ) : (
            <LuminaInput
              type="text"
              value={shortAnswer}
              onChange={(e) => setShortAnswer(e.target.value)}
              disabled={comprehensionCorrect === true}
              placeholder="Type your answer..."
              className="w-full py-3 text-sm"
            />
          )}

          {/* Feedback */}
          {comprehensionCorrect === true && (
            <LuminaFeedbackCard status="correct" label="Correct! Great comprehension!">
              You answered the question correctly.
            </LuminaFeedbackCard>
          )}
          {comprehensionCorrect === false && (
            <LuminaFeedbackCard status="incorrect">
              Not quite. Try again or continue to review.
            </LuminaFeedbackCard>
          )}
        </LuminaPanel>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {comprehensionCorrect !== true && (
            <>
              <LuminaActionButton
                action="check"
                onClick={handleCheckComprehension}
                disabled={
                  (comprehensionQuestion.type === 'multiple-choice' && !selectedAnswer) ||
                  (comprehensionQuestion.type === 'short-answer' && !shortAnswer.trim())
                }
                className="ml-auto"
              >
                Check
              </LuminaActionButton>
              {comprehensionAttempts > 0 && (
                <LuminaButton onClick={handleContinueToReview} className="text-slate-400">
                  Skip to Review
                </LuminaButton>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  // Early-band review — a warm celebration, no ledger/stat chrome (rule 7).
  const renderReviewEarly = () => (
    <div className="space-y-4">
      <LuminaPanel accent="emerald" className="text-center space-y-2 py-6">
        <div className="text-5xl" aria-hidden>🌟</div>
        <p className="text-emerald-300 font-semibold text-xl">Great reading!</p>
      </LuminaPanel>
    </div>
  );

  // Review phase
  const renderReviewPhase = () => {
    if (isEarlyBand) return renderReviewEarly();
    return (
      <div className="space-y-4">
        {/* Summary stats */}
        <div className="grid grid-cols-2 gap-3">
          <LuminaStat label="Words Tapped" value={tappedWordIds.size} />
          <LuminaStat label="Read Independently" value={totalWords - tappedWordIds.size} />
        </div>

        {/* Score breakdown — the number shown by name, no hidden math */}
        <LuminaPanel accent={scoreBreakdown.passed ? 'emerald' : 'amber'} className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-300">Comprehension</span>
            <span className={`text-sm font-medium ${comprehensionCorrect ? 'text-emerald-300' : 'text-slate-400'}`}>
              {comprehensionCorrect ? 'Answered correctly' : 'Not answered'} · +{scoreBreakdown.comprehensionPoints}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-300">Reading</span>
            <span className="text-sm font-medium text-slate-200">
              Read {scoreBreakdown.independentWords} of {totalWords} on your own · +{scoreBreakdown.readingBonus}
            </span>
          </div>
          <div className="h-px bg-white/10 my-1" />
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-100">Score</span>
            <span className="text-lg font-bold text-slate-100">{scoreBreakdown.total}%</span>
          </div>
          <p className="text-xs text-slate-500 pt-1">
            Tapping a word for help is free — it never lowers your score below your comprehension result.
          </p>
        </LuminaPanel>

        {/* Tapped words indicator */}
        <LuminaPanel>
          <p className="text-xs text-slate-500 mb-2">
            Words you tapped for help (these are your practice words):
          </p>
          <div className="flex flex-wrap gap-1.5">
            {tappedWordIds.size > 0 ? (
              passage.sentences.flatMap(s =>
                s.words.filter(w => tappedWordIds.has(w.id))
              ).map(word => (
                <LuminaBadge
                  key={word.id}
                  accent={PATTERN_ACCENTS[word.phonicsPattern]}
                  className="text-xs"
                >
                  {word.text}
                </LuminaBadge>
              ))
            ) : (
              <span className="text-emerald-400 text-sm">
                Amazing! You read every word independently!
              </span>
            )}
          </div>
        </LuminaPanel>

        {/* Show passage in review if desired — the decodable text (bespoke) */}
        {showTextInReview && (
          <div className="rounded-xl bg-slate-800/40 border border-white/5 p-4">
            <p className="text-xs text-slate-500 mb-2">Passage text:</p>
            {passage.sentences.map(sentence => (
              <p key={sentence.id} className="leading-relaxed text-sm text-slate-300">
                {sentence.words.map((word, i) => (
                  <React.Fragment key={word.id}>
                    <span className={tappedWordIds.has(word.id) ? 'text-amber-300 underline underline-offset-2' : ''}>
                      {word.text}
                    </span>
                    {i < sentence.words.length - 1 && ' '}
                  </React.Fragment>
                ))}
              </p>
            ))}
          </div>
        )}

        {/* Comprehension result */}
        <LuminaPanel accent={comprehensionCorrect ? 'emerald' : 'amber'}>
          <p className="text-xs text-slate-500 mb-1">Comprehension:</p>
          <p className={`text-sm ${comprehensionCorrect ? 'text-emerald-300' : 'text-amber-300'}`}>
            {comprehensionCorrect ? 'Answered correctly' : `Answer: ${
              comprehensionQuestion.type === 'multiple-choice'
                ? comprehensionQuestion.options?.find(o => o.id === comprehensionQuestion.correctOptionId)?.text ?? comprehensionQuestion.correctAnswer
                : comprehensionQuestion.correctAnswer
            }`}
            {comprehensionAttempts > 1 && ` (${comprehensionAttempts} attempts)`}
          </p>
        </LuminaPanel>

        {/* Finish button */}
        <div className="flex justify-center">
          {!hasSubmittedEvaluation ? (
            <LuminaActionButton action="next" onClick={handleFinish}>
              Finish
            </LuminaActionButton>
          ) : (
            <LuminaPanel accent="emerald" className="text-center space-y-2 w-full">
              <p className="text-emerald-300 font-semibold text-lg">Session Complete! — {scoreBreakdown.total}%</p>
              <p className="text-slate-400 text-sm">
                You read {scoreBreakdown.independentWords} of {totalWords} words on your own
                {comprehensionCorrect ? ' and understood the story.' : '.'}
              </p>
            </LuminaPanel>
          )}
        </div>
      </div>
    );
  };

  // ============================================================================
  // Main Render
  // ============================================================================

  if (!passage || passage.sentences.length === 0) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-6">
          <p className="text-slate-400 text-center">No passage available.</p>
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        {isEarlyBand ? (
          // Early band: just the warm title, no grade/word-count/phase chrome.
          <LuminaCardTitle className="text-xl text-center">{title}</LuminaCardTitle>
        ) : (
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
              <div className="flex items-center gap-2">
                <LuminaBadge className="text-xs">Grade {gradeLevel}</LuminaBadge>
                <LuminaBadge className="text-xs">{totalWords} words</LuminaBadge>
              </div>
            </div>
            <LuminaBadge
              accent={
                currentPhase === 'reading'
                  ? 'blue'
                  : currentPhase === 'comprehension'
                    ? 'purple'
                    : 'emerald'
              }
              className="text-xs"
            >
              {currentPhase === 'reading' ? 'Reading' : currentPhase === 'comprehension' ? 'Comprehension' : 'Review'}
            </LuminaBadge>
          </div>
        )}
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {!isEarlyBand && renderPhaseIndicator()}

        {currentPhase === 'reading' && renderReadingPhase()}
        {currentPhase === 'comprehension' && renderComprehensionPhase()}
        {currentPhase === 'review' && renderReviewPhase()}
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default DecodableReader;
