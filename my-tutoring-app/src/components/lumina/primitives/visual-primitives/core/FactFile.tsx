'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { FactFileMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface FactFileData {
  title: string;
  category: string;
  description: string;

  /** Headline stats shown prominently at the top. */
  keyStats: Array<{
    value: string;
    unit: string;
    label: string;
  }>;

  /** Bullet-point essentials. */
  quickFacts: Array<{
    fact: string;
    icon?: string;
  }>;

  /** Expandable detail sections. */
  deepDive: Array<{
    heading: string;
    body: string;
    detail?: string;
  }>;

  /** Records & superlatives. */
  records: Array<{
    label: string;
    value: string;
  }>;

  /** "Did You Know?" callouts. */
  didYouKnow: Array<{
    text: string;
    source?: string;
  }>;

  /** Self-check questions (for eval modes). */
  selfChecks?: Array<{
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
    difficulty: 'easy' | 'medium' | 'hard';
    relatedSection: 'quickFacts' | 'deepDive' | 'records' | 'didYouKnow';
  }>;

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<FactFileMetrics>) => void;
}

// ============================================================================
// Tab definitions
// ============================================================================

type TabKey = 'quickFacts' | 'deepDive' | 'records' | 'didYouKnow';

const TAB_CONFIG: Array<{ key: TabKey; label: string; icon: string }> = [
  { key: 'quickFacts', label: 'Quick Facts', icon: '⚡' },
  { key: 'deepDive', label: 'Deep Dive', icon: '🔍' },
  { key: 'records', label: 'Records', icon: '🏆' },
  { key: 'didYouKnow', label: 'Did You Know?', icon: '💡' },
];

// ============================================================================
// Props
// ============================================================================

interface FactFileProps {
  data: FactFileData;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

const FactFile: React.FC<FactFileProps> = ({ data, className }) => {
  const {
    title,
    category,
    description,
    keyStats = [],
    quickFacts = [],
    deepDive = [],
    records = [],
    didYouKnow = [],
    selfChecks = [],
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
  const [activeTab, setActiveTab] = useState<TabKey>('quickFacts');
  const [visitedTabs, setVisitedTabs] = useState<Set<TabKey>>(new Set<TabKey>(['quickFacts']));
  const [tappedStats, setTappedStats] = useState<Set<number>>(new Set());

  // Self-check state
  const [showSelfChecks, setShowSelfChecks] = useState(false);
  const [currentCheckIndex, setCurrentCheckIndex] = useState(0);
  const [checkAnswers, setCheckAnswers] = useState<Array<{ selected: number; correct: boolean }>>([]);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showCheckFeedback, setShowCheckFeedback] = useState(false);
  const [allChecksComplete, setAllChecksComplete] = useState(false);

  // Timing
  const [tabVisitTimes, setTabVisitTimes] = useState<Record<TabKey, number>>({
    quickFacts: 0,
    deepDive: 0,
    records: 0,
    didYouKnow: 0,
  });
  const tabEntryTimeRef = useRef(Date.now());

  // Stable instance ID
  const stableInstanceIdRef = useRef(instanceId || `fact-file-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // All tabs (only those with content)
  const availableTabs = useMemo(() => {
    return TAB_CONFIG.filter(t => {
      switch (t.key) {
        case 'quickFacts': return quickFacts.length > 0;
        case 'deepDive': return deepDive.length > 0;
        case 'records': return records.length > 0;
        case 'didYouKnow': return didYouKnow.length > 0;
        default: return false;
      }
    });
  }, [quickFacts, deepDive, records, didYouKnow]);

  const totalSections = availableTabs.length;
  const sectionsExplored = availableTabs.filter(t => visitedTabs.has(t.key)).length;
  const allSectionsExplored = sectionsExplored >= totalSections;

  // -------------------------------------------------------------------------
  // Evaluation Hook
  // -------------------------------------------------------------------------
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<FactFileMetrics>({
    primitiveType: 'fact-file',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // -------------------------------------------------------------------------
  // AI Tutoring Integration
  // -------------------------------------------------------------------------
  const aiPrimitiveData = useMemo(() => ({
    title,
    category,
    activeTab,
    sectionsExplored,
    totalSections,
    checksCompleted: checkAnswers.length,
    totalChecks: selfChecks.length,
    currentKeyStats: keyStats.map(s => `${s.label}: ${s.value} ${s.unit}`).join(', '),
  }), [title, category, activeTab, sectionsExplored, totalSections, checkAnswers.length, selfChecks.length, keyStats]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'fact-file',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: 'Elementary',
  });

  // Introduce on connect
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current) return;
    hasIntroducedRef.current = true;
    sendText(
      `[ACTIVITY_START] Fact File about "${title}" (${category}). `
      + `Key stats: ${keyStats.map(s => `${s.label}: ${s.value} ${s.unit}`).join(', ')}. `
      + `${totalSections} sections to explore. ${selfChecks.length > 0 ? `${selfChecks.length} self-check questions after exploration.` : ''} `
      + `Introduce the topic warmly and encourage exploration.`,
      { silent: true }
    );
  }, [isConnected, title, category, keyStats, totalSections, selfChecks.length, sendText]);

  // -------------------------------------------------------------------------
  // Tab switching
  // -------------------------------------------------------------------------
  const handleTabChange = useCallback((tab: TabKey) => {
    // Record time on previous tab
    const now = Date.now();
    const elapsed = now - tabEntryTimeRef.current;
    setTabVisitTimes(prev => ({
      ...prev,
      [activeTab]: prev[activeTab] + elapsed,
    }));
    tabEntryTimeRef.current = now;

    setActiveTab(tab);
    setVisitedTabs(prev => {
      const next = new Set(prev);
      next.add(tab);
      return next;
    });

    if (isConnected) {
      sendText(
        `[TAB_OPENED] Student opened the "${TAB_CONFIG.find(t => t.key === tab)?.label}" section. `
        + `Sections explored: ${visitedTabs.has(tab) ? sectionsExplored : sectionsExplored + 1} of ${totalSections}. `
        + `Briefly introduce this section and highlight one interesting detail to look for.`,
        { silent: true }
      );
    }
  }, [activeTab, visitedTabs, sectionsExplored, totalSections, isConnected, sendText]);

  // Track all-sections-explored
  const hasNotifiedAllExploredRef = useRef(false);
  useEffect(() => {
    if (allSectionsExplored && !hasNotifiedAllExploredRef.current && isConnected) {
      hasNotifiedAllExploredRef.current = true;
      sendText(
        `[ALL_SECTIONS_EXPLORED] Student has explored all ${totalSections} sections! `
        + `${selfChecks.length > 0 ? `${selfChecks.length} self-check questions are coming up.` : 'Congratulate them!'} `
        + `Ask what their favorite fact was.`,
        { silent: true }
      );
    }
  }, [allSectionsExplored, totalSections, selfChecks.length, isConnected, sendText]);

  // -------------------------------------------------------------------------
  // Key stat tap
  // -------------------------------------------------------------------------
  const handleStatTap = useCallback((index: number) => {
    setTappedStats(prev => {
      const next = new Set(prev);
      next.add(index);
      return next;
    });

    const stat = keyStats[index];
    if (isConnected && stat) {
      sendText(
        `[STAT_TAPPED] Student tapped the "${stat.label}" stat: ${stat.value} ${stat.unit}. `
        + `React to this specific stat with a relatable comparison. Keep to 1-2 sentences.`,
        { silent: true }
      );
    }
  }, [keyStats, isConnected, sendText]);

  // -------------------------------------------------------------------------
  // Self-check handling
  // -------------------------------------------------------------------------
  const handleStartChecks = useCallback(() => {
    setShowSelfChecks(true);
    setCurrentCheckIndex(0);
  }, []);

  const currentCheck = selfChecks[currentCheckIndex] ?? null;

  const handleCheckAnswer = useCallback((optionIndex: number) => {
    if (!currentCheck || showCheckFeedback) return;

    setSelectedOption(optionIndex);
    setShowCheckFeedback(true);

    const correct = optionIndex === currentCheck.correctIndex;
    setCheckAnswers(prev => [...prev, { selected: optionIndex, correct }]);

    if (isConnected) {
      const tag = correct ? '[CHECK_CORRECT]' : '[CHECK_INCORRECT]';
      sendText(
        `${tag} Self-check ${currentCheckIndex + 1}/${selfChecks.length}: "${currentCheck.question}" `
        + `Student chose "${currentCheck.options[optionIndex]}". `
        + `${correct
          ? 'Correct! Celebrate briefly and reinforce the fact.'
          : `Incorrect. Correct answer: "${currentCheck.options[currentCheck.correctIndex]}". Hint at which section (${currentCheck.relatedSection}) contains the answer without revealing it.`
        }`,
        { silent: true }
      );
    }
  }, [currentCheck, currentCheckIndex, selfChecks, showCheckFeedback, isConnected, sendText]);

  const handleNextCheck = useCallback(() => {
    setSelectedOption(null);
    setShowCheckFeedback(false);

    if (currentCheckIndex + 1 >= selfChecks.length) {
      // All checks done
      setAllChecksComplete(true);

      const correctCount = checkAnswers.filter(a => a.correct).length + (
        // Include the answer we just recorded (the last one might not be in state yet)
        0
      );
      const accuracy = selfChecks.length > 0 ? Math.round((correctCount / selfChecks.length) * 100) : 0;

      if (isConnected) {
        sendText(
          `[ALL_COMPLETE] Student finished all ${selfChecks.length} self-checks. `
          + `Accuracy: ${accuracy}%. Sections explored: ${sectionsExplored}/${totalSections}. `
          + `Celebrate and give section-specific feedback.`,
          { silent: true }
        );
      }

      // Submit evaluation
      if (!hasSubmittedEvaluation) {
        const avgTimePerSection = totalSections > 0
          ? Math.round(Object.values(tabVisitTimes).reduce((a, b) => a + b, 0) / totalSections)
          : 0;

        const metrics: FactFileMetrics = {
          type: 'fact-file',
          sectionsExplored,
          totalSections,
          explorationCompleteness: totalSections > 0 ? Math.round((sectionsExplored / totalSections) * 100) : 0,
          selfCheckAccuracy: accuracy,
          selfCheckAttempts: selfChecks.length,
          averageTimePerSection: avgTimePerSection,
          tabsVisitedOrder: Array.from(visitedTabs),
        };

        const overallScore = Math.round(
          (sectionsExplored / Math.max(totalSections, 1)) * 40 + accuracy * 0.6
        );

        submitEvaluation(
          accuracy >= 70 && sectionsExplored >= totalSections,
          overallScore,
          metrics,
          { checkAnswers: [...checkAnswers] }
        );
      }
    } else {
      setCurrentCheckIndex(prev => prev + 1);
    }
  }, [
    currentCheckIndex, selfChecks, checkAnswers, sectionsExplored, totalSections,
    tabVisitTimes, visitedTabs, isConnected, sendText, hasSubmittedEvaluation, submitEvaluation,
  ]);

  // Auto-submit for display-only mode (no self-checks)
  const hasAutoSubmittedRef = useRef(false);
  useEffect(() => {
    if (selfChecks.length === 0 && allSectionsExplored && !hasSubmittedEvaluation && !hasAutoSubmittedRef.current) {
      hasAutoSubmittedRef.current = true;
      const avgTimePerSection = totalSections > 0
        ? Math.round(Object.values(tabVisitTimes).reduce((a, b) => a + b, 0) / totalSections)
        : 0;

      const metrics: FactFileMetrics = {
        type: 'fact-file',
        sectionsExplored,
        totalSections,
        explorationCompleteness: 100,
        selfCheckAccuracy: 100,
        selfCheckAttempts: 0,
        averageTimePerSection: avgTimePerSection,
        tabsVisitedOrder: Array.from(visitedTabs),
      };

      submitEvaluation(true, 100, metrics, {});
    }
  }, [selfChecks.length, allSectionsExplored, hasSubmittedEvaluation, sectionsExplored, totalSections, tabVisitTimes, visitedTabs, submitEvaluation]);

  // -------------------------------------------------------------------------
  // Render: Tab Content
  // -------------------------------------------------------------------------
  const renderTabContent = () => {
    switch (activeTab) {
      case 'quickFacts':
        return (
          <div className="space-y-3">
            {quickFacts.map((item, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/5">
                {item.icon && <span className="text-lg shrink-0 mt-0.5">{item.icon}</span>}
                <p className="text-slate-200 text-sm leading-relaxed">{item.fact}</p>
              </div>
            ))}
          </div>
        );

      case 'deepDive':
        return (
          <Accordion type="multiple" className="space-y-2">
            {deepDive.map((section, i) => (
              <AccordionItem key={i} value={`dd-${i}`} className="border-white/10">
                <AccordionTrigger className="text-slate-200 text-sm font-medium hover:text-slate-100 py-3">
                  {section.heading}
                </AccordionTrigger>
                <AccordionContent className="text-slate-300 text-sm leading-relaxed pb-4">
                  <p>{section.body}</p>
                  {section.detail && (
                    <p className="mt-2 text-slate-400 text-xs italic border-l-2 border-white/10 pl-3">
                      {section.detail}
                    </p>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        );

      case 'records':
        return (
          <div className="space-y-3">
            {records.map((record, i) => (
              <div key={i} className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
                <div className="text-amber-300 text-xs font-semibold uppercase tracking-wider mb-1">
                  {record.label}
                </div>
                <p className="text-slate-200 text-sm">{record.value}</p>
              </div>
            ))}
          </div>
        );

      case 'didYouKnow':
        return (
          <div className="space-y-3">
            {didYouKnow.map((item, i) => (
              <div key={i} className="p-4 rounded-lg bg-purple-500/5 border border-purple-500/10">
                <p className="text-slate-200 text-sm leading-relaxed">{item.text}</p>
                {item.source && (
                  <p className="text-slate-500 text-xs mt-2">— {item.source}</p>
                )}
              </div>
            ))}
          </div>
        );

      default:
        return null;
    }
  };

  // -------------------------------------------------------------------------
  // Render: Self-Check
  // -------------------------------------------------------------------------
  const renderSelfCheck = () => {
    if (!currentCheck) return null;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-slate-400 text-xs">
            Question {currentCheckIndex + 1} of {selfChecks.length}
          </p>
          <Badge className="bg-slate-800/50 border-slate-700/50 text-slate-400 text-xs">
            {currentCheck.difficulty}
          </Badge>
        </div>

        <p className="text-slate-100 text-sm font-medium">{currentCheck.question}</p>

        <div className="space-y-2">
          {currentCheck.options.map((opt, i) => {
            const isSelected = selectedOption === i;
            const isCorrectOption = i === currentCheck.correctIndex;
            const showAsCorrect = showCheckFeedback && isCorrectOption;
            const showAsWrong = showCheckFeedback && isSelected && !isCorrectOption;

            return (
              <Button
                key={i}
                variant="ghost"
                className={`w-full justify-start text-left h-auto py-3 px-4 text-sm transition-all duration-200 ${
                  showAsCorrect
                    ? 'bg-emerald-500/20 border border-emerald-400/50 text-emerald-300'
                    : showAsWrong
                      ? 'bg-red-500/20 border border-red-400/50 text-red-300'
                      : isSelected
                        ? 'bg-blue-500/20 border border-blue-400/50 text-blue-300'
                        : 'bg-white/5 border border-white/10 hover:bg-white/10 text-slate-200'
                }`}
                onClick={() => handleCheckAnswer(i)}
                disabled={showCheckFeedback}
              >
                {opt}
              </Button>
            );
          })}
        </div>

        {showCheckFeedback && (
          <div className="space-y-3">
            <p className={`text-sm font-medium ${
              selectedOption === currentCheck.correctIndex ? 'text-emerald-400' : 'text-red-400'
            }`}>
              {selectedOption === currentCheck.correctIndex ? 'Correct!' : 'Not quite.'}
            </p>
            <p className="text-slate-400 text-xs">{currentCheck.explanation}</p>
            <div className="flex justify-center">
              <Button
                variant="ghost"
                className="bg-emerald-500/10 border border-emerald-400/30 hover:bg-emerald-500/20 text-emerald-300"
                onClick={handleNextCheck}
              >
                {currentCheckIndex + 1 >= selfChecks.length ? 'See Results' : 'Next Question'}
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // -------------------------------------------------------------------------
  // Render: Results Summary
  // -------------------------------------------------------------------------
  const renderResults = () => {
    const correctCount = checkAnswers.filter(a => a.correct).length;
    const accuracy = selfChecks.length > 0 ? Math.round((correctCount / selfChecks.length) * 100) : 0;
    const score = submittedResult?.score ?? accuracy;

    return (
      <div className="text-center space-y-4 py-4">
        <div className="text-3xl font-bold text-emerald-400">{score}%</div>
        <p className="text-slate-200 text-sm font-medium">Fact File Complete!</p>
        <div className="flex justify-center gap-4 text-xs text-slate-400">
          <span>{sectionsExplored}/{totalSections} sections explored</span>
          <span>{correctCount}/{selfChecks.length} questions correct</span>
          {elapsedMs > 0 && <span>{Math.round(elapsedMs / 1000)}s total</span>}
        </div>
      </div>
    );
  };

  // -------------------------------------------------------------------------
  // Main Render
  // -------------------------------------------------------------------------
  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-2xl ${className || ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">🗂️</span>
            <CardTitle className="text-slate-100 text-lg">Fact File: {title}</CardTitle>
          </div>
          <Badge className="bg-slate-800/50 border-slate-700/50 text-blue-300 text-xs">
            {category}
          </Badge>
        </div>
        <p className="text-slate-400 text-sm mt-1">{description}</p>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Key Stats */}
        {keyStats.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {keyStats.map((stat, i) => (
              <button
                key={i}
                onClick={() => handleStatTap(i)}
                className={`p-3 rounded-xl text-center transition-all duration-200 cursor-pointer
                  ${tappedStats.has(i)
                    ? 'bg-blue-500/10 border border-blue-400/20 scale-[1.02]'
                    : 'bg-white/5 border border-white/10 hover:bg-white/10 hover:scale-[1.02]'
                  }`}
              >
                <div className="text-xl font-bold text-slate-100">{stat.value}</div>
                <div className="text-xs text-slate-400">{stat.unit}</div>
                <div className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">{stat.label}</div>
              </button>
            ))}
          </div>
        )}

        {/* Show self-check phase or exploration phase */}
        {allChecksComplete ? (
          renderResults()
        ) : showSelfChecks ? (
          <>
            <div className="border-t border-white/10 pt-4">
              <p className="text-slate-300 text-xs font-medium mb-3 uppercase tracking-wider">
                Self-Check
              </p>
              {renderSelfCheck()}
            </div>
          </>
        ) : (
          <>
            {/* Tab Bar */}
            <div className="flex gap-1 overflow-x-auto pb-1">
              {availableTabs.map((tab) => {
                const isActive = activeTab === tab.key;
                const isVisited = visitedTabs.has(tab.key);

                return (
                  <Button
                    key={tab.key}
                    variant="ghost"
                    className={`shrink-0 text-xs px-3 py-2 h-auto transition-all duration-200 ${
                      isActive
                        ? 'bg-white/10 border border-white/20 text-slate-100'
                        : isVisited
                          ? 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10'
                          : 'bg-transparent border border-transparent text-slate-500 hover:bg-white/5 hover:text-slate-300'
                    }`}
                    onClick={() => handleTabChange(tab.key)}
                  >
                    <span className="mr-1">{tab.icon}</span>
                    {tab.label}
                    {isVisited && !isActive && <span className="ml-1 text-emerald-400">✓</span>}
                  </Button>
                );
              })}
            </div>

            {/* Tab Content */}
            <div className="min-h-[120px]">{renderTabContent()}</div>

            {/* Exploration Progress */}
            <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-white/5">
              <span>{sectionsExplored} of {totalSections} sections explored</span>
              {allSectionsExplored && selfChecks.length > 0 && !showSelfChecks && (
                <Button
                  variant="ghost"
                  className="bg-emerald-500/10 border border-emerald-400/30 hover:bg-emerald-500/20 text-emerald-300 text-xs h-8"
                  onClick={handleStartChecks}
                >
                  Start Self-Check ({selfChecks.length} questions)
                </Button>
              )}
              {!allSectionsExplored && (
                <span className="text-slate-600">Explore all sections to unlock self-check</span>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default FactFile;
