'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  usePrimitiveEvaluation,
  type ParagraphArchitectMetrics,
} from '../../../evaluation';

// =============================================================================
// Data Interface
// =============================================================================

export interface ParagraphArchitectData {
  title: string;
  paragraphType: 'informational' | 'narrative' | 'opinion';
  gradeLevel: string;
  topic: string;

  // Scaffolding
  topicSentenceFrames: string[];      // e.g., "The most important thing about ___ is..."
  detailSentenceFrames: string[];     // e.g., "For example, ___"
  concludingSentenceFrames: string[]; // e.g., "In conclusion, ___"
  linkingWords: string[];             // e.g., ["because", "also", "for example"]

  // Example/model paragraph
  modelParagraph?: {
    topicSentence: string;
    detailSentences: string[];
    concludingSentence: string;
  };

  // Evaluation props (optional, auto-injected)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: any) => void;
}

// =============================================================================
// Props
// =============================================================================

interface ParagraphArchitectProps {
  data: ParagraphArchitectData;
  className?: string;
}

// =============================================================================
// Types
// =============================================================================

type LearningPhase = 'explore' | 'practice' | 'apply';

interface SentencePart {
  text: string;
  role: 'topic' | 'detail' | 'conclusion';
}

// =============================================================================
// Hamburger Layer Component
// =============================================================================

function HamburgerLayer({
  role,
  label,
  children,
  highlight = false,
}: {
  role: 'topic' | 'detail' | 'conclusion';
  label: string;
  children: React.ReactNode;
  highlight?: boolean;
}) {
  const isBun = role === 'topic' || role === 'conclusion';
  const baseClasses = isBun
    ? 'bg-amber-500/20 border-amber-500/30'
    : 'bg-emerald-500/20 border-emerald-500/30';
  const textClasses = isBun ? 'text-amber-200' : 'text-emerald-200';
  const highlightRing = highlight ? 'ring-2 ring-amber-400/50' : '';

  return (
    <div
      className={`rounded-lg border p-3 transition-all duration-300 ${baseClasses} ${highlightRing}`}
    >
      <div className="flex items-center gap-2 mb-1">
        <Badge
          variant="outline"
          className={`text-xs ${textClasses} border-current/30`}
        >
          {label}
        </Badge>
      </div>
      <div className={`${textClasses} text-sm leading-relaxed`}>{children}</div>
    </div>
  );
}

// =============================================================================
// Sentence Frame Selector
// =============================================================================

function SentenceFrameSelector({
  frames,
  selectedFrame,
  onSelect,
  label,
}: {
  frames: string[];
  selectedFrame: string | null;
  onSelect: (frame: string) => void;
  label: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-400 font-medium">{label}</p>
      <div className="flex flex-wrap gap-2">
        {frames.map((frame, idx) => (
          <Button
            key={idx}
            variant="ghost"
            size="sm"
            className={`text-xs border transition-all ${
              selectedFrame === frame
                ? 'bg-white/15 border-white/30 text-slate-100'
                : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-slate-200'
            }`}
            onClick={() => onSelect(frame)}
          >
            {frame}
          </Button>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// Linking Word Chips
// =============================================================================

function LinkingWordChips({
  words,
  onInsert,
}: {
  words: string[];
  onInsert: (word: string) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-400 font-medium">Linking Words (click to insert)</p>
      <div className="flex flex-wrap gap-1.5">
        {words.map((word, idx) => (
          <Button
            key={idx}
            variant="ghost"
            size="sm"
            className="text-xs bg-sky-500/15 border border-sky-500/30 text-sky-200 hover:bg-sky-500/25 px-2 py-1 h-auto"
            onClick={() => onInsert(word)}
          >
            {word}
          </Button>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// Paragraph Preview Panel
// =============================================================================

function ParagraphPreview({
  topicSentence,
  detailSentences,
  concludingSentence,
}: {
  topicSentence: string;
  detailSentences: string[];
  concludingSentence: string;
}) {
  const hasContent = topicSentence || detailSentences.some(d => d) || concludingSentence;

  if (!hasContent) {
    return (
      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
        <CardContent className="p-4">
          <p className="text-slate-600 text-sm italic text-center">
            Your paragraph will appear here as you write...
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-sm text-slate-400 font-medium">
          Your Paragraph
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="space-y-1">
          {topicSentence && (
            <span className="text-amber-200">{topicSentence} </span>
          )}
          {detailSentences.filter(d => d).map((d, idx) => (
            <span key={idx} className="text-emerald-200">{d} </span>
          ))}
          {concludingSentence && (
            <span className="text-amber-200">{concludingSentence}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Main Component
// =============================================================================

const ParagraphArchitect: React.FC<ParagraphArchitectProps> = ({
  data,
  className,
}) => {
  const {
    title,
    paragraphType,
    gradeLevel,
    topic,
    topicSentenceFrames = [],
    detailSentenceFrames = [],
    concludingSentenceFrames = [],
    linkingWords = [],
    modelParagraph,
    // Evaluation props
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------

  const [currentPhase, setCurrentPhase] = useState<LearningPhase>('explore');
  const [feedback, setFeedback] = useState<string>('');

  // Phase 1: Explore -- identify model parts
  const [selectedModelPart, setSelectedModelPart] = useState<string | null>(null);
  const [exploreCorrect, setExploreCorrect] = useState(false);
  const [exploreAttempts, setExploreAttempts] = useState(0);

  // Phase 2: Practice -- fill sentence frames
  const [practiceTopicFrame, setPracticeTopicFrame] = useState<string | null>(null);
  const [practiceTopicFill, setPracticeTopicFill] = useState('');
  const [practiceDetails, setPracticeDetails] = useState<string[]>(['', '']);
  const [practiceDetailFrames, setPracticeDetailFrames] = useState<(string | null)[]>([null, null]);
  const [practiceConclusionFrame, setPracticeConclusionFrame] = useState<string | null>(null);
  const [practiceConclusionFill, setPracticeConclusionFill] = useState('');
  const [practiceLinkingWordsUsed, setPracticeLinkingWordsUsed] = useState<string[]>([]);
  const [practiceSubmitted, setPracticeSubmitted] = useState(false);
  const [practiceFramesUsed, setPracticeFramesUsed] = useState(0);

  // Phase 3: Apply -- free write
  const [applyTopicSentence, setApplyTopicSentence] = useState('');
  const [applyDetails, setApplyDetails] = useState<string[]>(['', '', '']);
  const [applyConclusionSentence, setApplyConclusionSentence] = useState('');
  const [applyLinkingWordsUsed, setApplyLinkingWordsUsed] = useState<string[]>([]);
  const [applySubmitted, setApplySubmitted] = useState(false);

  // Active textarea ref for linking word insertion
  const [activeField, setActiveField] = useState<
    | { type: 'topic' }
    | { type: 'detail'; index: number }
    | { type: 'conclusion' }
    | null
  >(null);

  // -------------------------------------------------------------------------
  // Evaluation
  // -------------------------------------------------------------------------

  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
  } = usePrimitiveEvaluation<ParagraphArchitectMetrics>({
    primitiveType: 'paragraph-architect',
    instanceId: instanceId || `paragraph-architect-${Date.now()}`,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as
      | ((result: import('../../../evaluation').PrimitiveEvaluationResult) => void)
      | undefined,
  });

  // -------------------------------------------------------------------------
  // Model paragraph parts for Explore phase
  // -------------------------------------------------------------------------

  const modelParts: SentencePart[] = useMemo(() => {
    if (!modelParagraph) return [];
    const parts: SentencePart[] = [
      { text: modelParagraph.topicSentence, role: 'topic' },
      ...modelParagraph.detailSentences.map((s) => ({
        text: s,
        role: 'detail' as const,
      })),
      { text: modelParagraph.concludingSentence, role: 'conclusion' },
    ];
    return parts;
  }, [modelParagraph]);

  // -------------------------------------------------------------------------
  // Phase 1: Explore handlers
  // -------------------------------------------------------------------------

  const handleIdentifyTopicSentence = useCallback(
    (sentence: string) => {
      setSelectedModelPart(sentence);
      setExploreAttempts((a) => a + 1);

      if (modelParagraph && sentence === modelParagraph.topicSentence) {
        setExploreCorrect(true);
        setFeedback('Correct! That is the topic sentence -- it tells the reader what the paragraph is about.');
      } else {
        setExploreCorrect(false);
        setFeedback(
          'Not quite. The topic sentence is the first sentence that tells the main idea. Try again!'
        );
      }
    },
    [modelParagraph]
  );

  const handleMoveToPhase2 = useCallback(() => {
    setCurrentPhase('practice');
    setFeedback('');
    setSelectedModelPart(null);
  }, []);

  // -------------------------------------------------------------------------
  // Phase 2: Practice handlers
  // -------------------------------------------------------------------------

  const handleInsertLinkingWordPractice = useCallback(
    (word: string) => {
      if (!activeField) return;
      setPracticeLinkingWordsUsed((prev) =>
        prev.includes(word) ? prev : [...prev, word]
      );

      if (activeField.type === 'topic') {
        setPracticeTopicFill((prev) => prev + (prev ? ' ' : '') + word + ' ');
      } else if (activeField.type === 'detail') {
        const idx = activeField.index;
        setPracticeDetails((prev) => {
          const updated = [...prev];
          updated[idx] = updated[idx] + (updated[idx] ? ' ' : '') + word + ' ';
          return updated;
        });
      } else if (activeField.type === 'conclusion') {
        setPracticeConclusionFill((prev) => prev + (prev ? ' ' : '') + word + ' ');
      }
    },
    [activeField]
  );

  const handleAddPracticeDetail = useCallback(() => {
    setPracticeDetails((prev) => [...prev, '']);
    setPracticeDetailFrames((prev) => [...prev, null]);
  }, []);

  const handleSubmitPractice = useCallback(() => {
    // Count frames used
    let framesUsed = 0;
    if (practiceTopicFrame) framesUsed++;
    practiceDetailFrames.forEach((f) => {
      if (f) framesUsed++;
    });
    if (practiceConclusionFrame) framesUsed++;
    setPracticeFramesUsed(framesUsed);

    const hasTopicContent = practiceTopicFill.trim().length > 0 || (practiceTopicFrame && practiceTopicFrame.length > 0);
    const hasDetailContent = practiceDetails.some((d) => d.trim().length > 0);
    const hasConclusionContent =
      practiceConclusionFill.trim().length > 0 || (practiceConclusionFrame && practiceConclusionFrame.length > 0);

    if (hasTopicContent && hasDetailContent && hasConclusionContent) {
      setPracticeSubmitted(true);
      setFeedback(
        'Great job building your practice paragraph! Now move to the Apply phase to write your own paragraph from scratch.'
      );
    } else {
      setFeedback(
        'Make sure you have a topic sentence, at least one detail, and a concluding sentence before submitting.'
      );
    }
  }, [
    practiceTopicFrame,
    practiceTopicFill,
    practiceDetails,
    practiceDetailFrames,
    practiceConclusionFrame,
    practiceConclusionFill,
  ]);

  const handleMoveToPhase3 = useCallback(() => {
    setCurrentPhase('apply');
    setFeedback('');
  }, []);

  // -------------------------------------------------------------------------
  // Phase 3: Apply handlers
  // -------------------------------------------------------------------------

  const handleInsertLinkingWordApply = useCallback(
    (word: string) => {
      if (!activeField) return;
      setApplyLinkingWordsUsed((prev) =>
        prev.includes(word) ? prev : [...prev, word]
      );

      if (activeField.type === 'topic') {
        setApplyTopicSentence((prev) => prev + (prev ? ' ' : '') + word + ' ');
      } else if (activeField.type === 'detail') {
        const idx = activeField.index;
        setApplyDetails((prev) => {
          const updated = [...prev];
          updated[idx] = updated[idx] + (updated[idx] ? ' ' : '') + word + ' ';
          return updated;
        });
      } else if (activeField.type === 'conclusion') {
        setApplyConclusionSentence((prev) => prev + (prev ? ' ' : '') + word + ' ');
      }
    },
    [activeField]
  );

  const handleAddApplyDetail = useCallback(() => {
    setApplyDetails((prev) => [...prev, '']);
  }, []);

  const handleSubmitApply = useCallback(() => {
    const hasTopicContent = applyTopicSentence.trim().length > 0;
    const filledDetails = applyDetails.filter((d) => d.trim().length > 0);
    const hasConclusionContent = applyConclusionSentence.trim().length > 0;

    if (!hasTopicContent || filledDetails.length === 0 || !hasConclusionContent) {
      setFeedback(
        'Make sure you have a topic sentence, at least one detail sentence, and a concluding sentence.'
      );
      return;
    }

    setApplySubmitted(true);
    setFeedback('Wonderful work! You wrote a complete paragraph on your own!');

    // Submit evaluation
    if (!hasSubmittedEvaluation) {
      const totalFramesAvailable =
        topicSentenceFrames.length +
        detailSentenceFrames.length +
        concludingSentenceFrames.length;

      const totalLinkingWords = [
        ...practiceLinkingWordsUsed,
        ...applyLinkingWordsUsed,
      ];
      const uniqueLinkingWords = Array.from(new Set(totalLinkingWords));

      const detailCount = filledDetails.length;
      const structureComplete = hasTopicContent && detailCount >= 2 && hasConclusionContent;

      // Compute accuracy: structure score
      let score = 0;
      if (hasTopicContent) score += 25;
      score += Math.min(detailCount * 15, 45); // up to 45 for 3 details
      if (hasConclusionContent) score += 15;
      if (uniqueLinkingWords.length > 0) score += Math.min(uniqueLinkingWords.length * 5, 15);

      const metrics: ParagraphArchitectMetrics = {
        type: 'paragraph-architect',
        paragraphType,
        structureComplete,
        topicSentencePresent: hasTopicContent,
        detailSentencesCount: detailCount,
        concludingSentencePresent: hasConclusionContent,
        linkingWordsUsed: uniqueLinkingWords.length,
        sentenceFramesUsed: practiceFramesUsed,
        sentenceFramesAvailable: totalFramesAvailable,
        explorePhaseCompleted: exploreCorrect,
        practicePhaseCompleted: practiceSubmitted,
        applyPhaseCompleted: true,
        allPhasesCompleted: exploreCorrect && practiceSubmitted,
        revisionsAfterReadBack: 0,
        accuracy: Math.min(score, 100),
        attemptsCount: exploreAttempts,
      };

      submitEvaluation(
        structureComplete,
        Math.min(score, 100),
        metrics,
        {
          topicSentence: applyTopicSentence,
          detailSentences: filledDetails,
          concludingSentence: applyConclusionSentence,
          linkingWordsUsed: uniqueLinkingWords,
        }
      );
    }
  }, [
    applyTopicSentence,
    applyDetails,
    applyConclusionSentence,
    applyLinkingWordsUsed,
    practiceLinkingWordsUsed,
    practiceFramesUsed,
    exploreCorrect,
    practiceSubmitted,
    exploreAttempts,
    paragraphType,
    topicSentenceFrames,
    detailSentenceFrames,
    concludingSentenceFrames,
    hasSubmittedEvaluation,
    submitEvaluation,
  ]);

  // -------------------------------------------------------------------------
  // Phase label helpers
  // -------------------------------------------------------------------------

  const phaseLabel: Record<LearningPhase, string> = {
    explore: 'Explore',
    practice: 'Practice',
    apply: 'Apply',
  };

  const phaseDescription: Record<LearningPhase, string> = {
    explore: 'Study the model paragraph and identify its parts',
    practice: 'Build a paragraph using sentence frames',
    apply: 'Write your own paragraph from scratch',
  };

  const paragraphTypeLabel: Record<string, string> = {
    informational: 'Informational',
    narrative: 'Narrative',
    opinion: 'Opinion',
  };

  // -------------------------------------------------------------------------
  // Practice paragraph assembled text
  // -------------------------------------------------------------------------

  const practiceTopicText = practiceTopicFrame
    ? practiceTopicFrame.replace('___', practiceTopicFill || '___')
    : practiceTopicFill;

  const practiceDetailTexts = practiceDetails.map((d, idx) => {
    const frame = practiceDetailFrames[idx];
    return frame ? frame.replace('___', d || '___') : d;
  });

  const practiceConclusionText = practiceConclusionFrame
    ? practiceConclusionFrame.replace('___', practiceConclusionFill || '___')
    : practiceConclusionFill;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className={`space-y-4 ${className || ''}`}>
      {/* Header */}
      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-lg text-slate-100">{title}</CardTitle>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="text-xs text-amber-200 border-amber-500/30"
              >
                {paragraphTypeLabel[paragraphType] || paragraphType}
              </Badge>
              <Badge
                variant="outline"
                className="text-xs text-slate-400 border-white/20"
              >
                Grade {gradeLevel}
              </Badge>
            </div>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Topic: <span className="text-slate-200">{topic}</span>
          </p>
        </CardHeader>
      </Card>

      {/* Phase Navigation */}
      <Tabs
        value={currentPhase}
        onValueChange={(val) => setCurrentPhase(val as LearningPhase)}
      >
        <TabsList className="bg-slate-900/60 border border-white/10 w-full">
          <TabsTrigger
            value="explore"
            className="flex-1 data-[state=active]:bg-white/10 data-[state=active]:text-slate-100 text-slate-400"
          >
            1. Explore
          </TabsTrigger>
          <TabsTrigger
            value="practice"
            disabled={!exploreCorrect}
            className="flex-1 data-[state=active]:bg-white/10 data-[state=active]:text-slate-100 text-slate-400 disabled:opacity-40"
          >
            2. Practice
          </TabsTrigger>
          <TabsTrigger
            value="apply"
            disabled={!practiceSubmitted}
            className="flex-1 data-[state=active]:bg-white/10 data-[state=active]:text-slate-100 text-slate-400 disabled:opacity-40"
          >
            3. Apply
          </TabsTrigger>
        </TabsList>

        {/* Phase Description */}
        <p className="text-xs text-slate-400 mt-2 mb-3 text-center">
          {phaseDescription[currentPhase]}
        </p>

        {/* ============================== PHASE 1: EXPLORE ============================== */}
        <TabsContent value="explore" className="space-y-4 mt-0">
          {modelParagraph ? (
            <>
              {/* Hamburger model view */}
              <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
                <CardHeader className="pb-2 pt-3 px-4">
                  <CardTitle className="text-sm text-slate-400 font-medium">
                    Model Paragraph -- The Hamburger
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2">
                  {/* Hamburger visualization */}
                  <div className="space-y-1.5">
                    <HamburgerLayer role="topic" label="Top Bun (Topic)">
                      {modelParagraph.topicSentence}
                    </HamburgerLayer>
                    {modelParagraph.detailSentences.map((sentence, idx) => (
                      <HamburgerLayer
                        key={idx}
                        role="detail"
                        label={`Filling ${idx + 1} (Detail)`}
                      >
                        {sentence}
                      </HamburgerLayer>
                    ))}
                    <HamburgerLayer role="conclusion" label="Bottom Bun (Conclusion)">
                      {modelParagraph.concludingSentence}
                    </HamburgerLayer>
                  </div>
                </CardContent>
              </Card>

              {/* Identification challenge */}
              <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
                <CardHeader className="pb-2 pt-3 px-4">
                  <CardTitle className="text-sm text-slate-100 font-medium">
                    Which sentence is the topic sentence?
                  </CardTitle>
                  <p className="text-xs text-slate-400">
                    Click the sentence that tells the reader what the paragraph is about.
                  </p>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2">
                  {modelParts.map((part, idx) => (
                    <Button
                      key={idx}
                      variant="ghost"
                      className={`w-full text-left justify-start h-auto py-2 px-3 text-sm whitespace-normal transition-all ${
                        selectedModelPart === part.text
                          ? exploreCorrect
                            ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-200'
                            : 'bg-red-500/20 border border-red-500/30 text-red-200'
                          : 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10'
                      }`}
                      onClick={() => handleIdentifyTopicSentence(part.text)}
                      disabled={exploreCorrect}
                    >
                      {part.text}
                    </Button>
                  ))}

                  {feedback && currentPhase === 'explore' && (
                    <div
                      className={`p-3 rounded-lg text-sm ${
                        exploreCorrect
                          ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-200'
                          : 'bg-red-500/15 border border-red-500/30 text-red-200'
                      }`}
                    >
                      {feedback}
                    </div>
                  )}

                  {exploreCorrect && (
                    <Button
                      variant="ghost"
                      className="w-full bg-white/5 border border-white/20 hover:bg-white/10 text-slate-100 mt-2"
                      onClick={handleMoveToPhase2}
                    >
                      Continue to Practice
                    </Button>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
              <CardContent className="p-6 text-center">
                <p className="text-slate-400 text-sm">
                  No model paragraph available. Move directly to Practice.
                </p>
                <Button
                  variant="ghost"
                  className="mt-3 bg-white/5 border border-white/20 hover:bg-white/10 text-slate-100"
                  onClick={() => {
                    setExploreCorrect(true);
                    handleMoveToPhase2();
                  }}
                >
                  Start Building
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ============================== PHASE 2: PRACTICE ============================== */}
        <TabsContent value="practice" className="space-y-4 mt-0">
          {/* Sentence frame selectors */}
          <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm text-slate-100 font-medium">
                Build Your Paragraph with Sentence Frames
              </CardTitle>
              <p className="text-xs text-slate-400">
                Choose a sentence frame, then fill in the blank with your own ideas.
              </p>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-5">
              {/* Topic Sentence */}
              <div className="space-y-2">
                <HamburgerLayer role="topic" label="Topic Sentence">
                  <div className="space-y-2">
                    <SentenceFrameSelector
                      frames={topicSentenceFrames}
                      selectedFrame={practiceTopicFrame}
                      onSelect={setPracticeTopicFrame}
                      label="Choose a sentence starter:"
                    />
                    <textarea
                      className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500/50 resize-none"
                      rows={2}
                      placeholder={
                        practiceTopicFrame
                          ? 'Fill in the blank...'
                          : 'Or write your own topic sentence...'
                      }
                      value={practiceTopicFill}
                      onChange={(e) => setPracticeTopicFill(e.target.value)}
                      onFocus={() => setActiveField({ type: 'topic' })}
                      disabled={practiceSubmitted}
                    />
                  </div>
                </HamburgerLayer>
              </div>

              {/* Detail Sentences */}
              {practiceDetails.map((detail, idx) => (
                <div key={idx} className="space-y-2">
                  <HamburgerLayer
                    role="detail"
                    label={`Detail ${idx + 1}`}
                  >
                    <div className="space-y-2">
                      <SentenceFrameSelector
                        frames={detailSentenceFrames}
                        selectedFrame={practiceDetailFrames[idx]}
                        onSelect={(frame) =>
                          setPracticeDetailFrames((prev) => {
                            const updated = [...prev];
                            updated[idx] = frame;
                            return updated;
                          })
                        }
                        label="Choose a detail starter:"
                      />
                      <textarea
                        className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
                        rows={2}
                        placeholder={
                          practiceDetailFrames[idx]
                            ? 'Fill in the blank...'
                            : 'Or write your own detail...'
                        }
                        value={detail}
                        onChange={(e) =>
                          setPracticeDetails((prev) => {
                            const updated = [...prev];
                            updated[idx] = e.target.value;
                            return updated;
                          })
                        }
                        onFocus={() => setActiveField({ type: 'detail', index: idx })}
                        disabled={practiceSubmitted}
                      />
                    </div>
                  </HamburgerLayer>
                </div>
              ))}

              {!practiceSubmitted && practiceDetails.length < 5 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 hover:bg-emerald-500/20 text-xs"
                  onClick={handleAddPracticeDetail}
                >
                  + Add Another Detail
                </Button>
              )}

              {/* Concluding Sentence */}
              <div className="space-y-2">
                <HamburgerLayer role="conclusion" label="Concluding Sentence">
                  <div className="space-y-2">
                    <SentenceFrameSelector
                      frames={concludingSentenceFrames}
                      selectedFrame={practiceConclusionFrame}
                      onSelect={setPracticeConclusionFrame}
                      label="Choose a conclusion starter:"
                    />
                    <textarea
                      className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500/50 resize-none"
                      rows={2}
                      placeholder={
                        practiceConclusionFrame
                          ? 'Fill in the blank...'
                          : 'Or write your own conclusion...'
                      }
                      value={practiceConclusionFill}
                      onChange={(e) => setPracticeConclusionFill(e.target.value)}
                      onFocus={() => setActiveField({ type: 'conclusion' })}
                      disabled={practiceSubmitted}
                    />
                  </div>
                </HamburgerLayer>
              </div>

              {/* Linking Words */}
              {!practiceSubmitted && (
                <LinkingWordChips
                  words={linkingWords}
                  onInsert={handleInsertLinkingWordPractice}
                />
              )}

              {feedback && currentPhase === 'practice' && (
                <div
                  className={`p-3 rounded-lg text-sm ${
                    practiceSubmitted
                      ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-200'
                      : 'bg-amber-500/15 border border-amber-500/30 text-amber-200'
                  }`}
                >
                  {feedback}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Practice paragraph preview */}
          <ParagraphPreview
            topicSentence={practiceTopicText}
            detailSentences={practiceDetailTexts}
            concludingSentence={practiceConclusionText}
          />

          {/* Actions */}
          <div className="flex gap-2">
            {!practiceSubmitted ? (
              <Button
                variant="ghost"
                className="flex-1 bg-white/5 border border-white/20 hover:bg-white/10 text-slate-100"
                onClick={handleSubmitPractice}
              >
                Submit Practice Paragraph
              </Button>
            ) : (
              <Button
                variant="ghost"
                className="flex-1 bg-white/5 border border-white/20 hover:bg-white/10 text-slate-100"
                onClick={handleMoveToPhase3}
              >
                Continue to Apply
              </Button>
            )}
          </div>
        </TabsContent>

        {/* ============================== PHASE 3: APPLY ============================== */}
        <TabsContent value="apply" className="space-y-4 mt-0">
          <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm text-slate-100 font-medium">
                Write Your Own Paragraph
              </CardTitle>
              <p className="text-xs text-slate-400">
                Now write a{' '}
                <span className="text-slate-200 font-medium">
                  {paragraphTypeLabel[paragraphType]?.toLowerCase() || paragraphType}
                </span>{' '}
                paragraph about{' '}
                <span className="text-slate-200 font-medium">{topic}</span>. Use
                the hamburger structure you practiced.
              </p>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-4">
              {/* Topic Sentence */}
              <HamburgerLayer role="topic" label="Topic Sentence">
                <textarea
                  className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500/50 resize-none"
                  rows={2}
                  placeholder="Write your topic sentence here..."
                  value={applyTopicSentence}
                  onChange={(e) => setApplyTopicSentence(e.target.value)}
                  onFocus={() => setActiveField({ type: 'topic' })}
                  disabled={applySubmitted}
                />
              </HamburgerLayer>

              {/* Detail Sentences */}
              {applyDetails.map((detail, idx) => (
                <HamburgerLayer
                  key={idx}
                  role="detail"
                  label={`Detail ${idx + 1}`}
                >
                  <textarea
                    className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
                    rows={2}
                    placeholder={`Write detail sentence ${idx + 1}...`}
                    value={detail}
                    onChange={(e) =>
                      setApplyDetails((prev) => {
                        const updated = [...prev];
                        updated[idx] = e.target.value;
                        return updated;
                      })
                    }
                    onFocus={() => setActiveField({ type: 'detail', index: idx })}
                    disabled={applySubmitted}
                  />
                </HamburgerLayer>
              ))}

              {!applySubmitted && applyDetails.length < 6 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 hover:bg-emerald-500/20 text-xs"
                  onClick={handleAddApplyDetail}
                >
                  + Add Another Detail
                </Button>
              )}

              {/* Concluding Sentence */}
              <HamburgerLayer role="conclusion" label="Concluding Sentence">
                <textarea
                  className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500/50 resize-none"
                  rows={2}
                  placeholder="Write your concluding sentence here..."
                  value={applyConclusionSentence}
                  onChange={(e) => setApplyConclusionSentence(e.target.value)}
                  onFocus={() => setActiveField({ type: 'conclusion' })}
                  disabled={applySubmitted}
                />
              </HamburgerLayer>

              {/* Linking Words */}
              {!applySubmitted && (
                <LinkingWordChips
                  words={linkingWords}
                  onInsert={handleInsertLinkingWordApply}
                />
              )}

              {feedback && currentPhase === 'apply' && (
                <div
                  className={`p-3 rounded-lg text-sm ${
                    applySubmitted
                      ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-200'
                      : 'bg-amber-500/15 border border-amber-500/30 text-amber-200'
                  }`}
                >
                  {feedback}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Live paragraph preview */}
          <ParagraphPreview
            topicSentence={applyTopicSentence}
            detailSentences={applyDetails}
            concludingSentence={applyConclusionSentence}
          />

          {/* Submit */}
          {!applySubmitted && (
            <Button
              variant="ghost"
              className="w-full bg-white/5 border border-white/20 hover:bg-white/10 text-slate-100"
              onClick={handleSubmitApply}
            >
              Submit My Paragraph
            </Button>
          )}

          {applySubmitted && (
            <Card className="backdrop-blur-xl bg-emerald-900/30 border-emerald-500/20">
              <CardContent className="p-4 text-center">
                <p className="text-emerald-200 text-sm font-medium mb-1">
                  Paragraph Complete!
                </p>
                <p className="text-slate-400 text-xs">
                  You successfully wrote a {paragraphTypeLabel[paragraphType]?.toLowerCase()} paragraph
                  about {topic}.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ParagraphArchitect;
