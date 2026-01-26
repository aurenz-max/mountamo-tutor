'use client';

import React, { useEffect, useState } from 'react';
import { FeatureExhibitData } from '../service/feature-exhibit/gemini-feature-exhibit';
import { generateConceptImage } from '../service/geminiClient-api';
import {
  usePrimitiveEvaluation,
  type FeatureExhibitMetrics,
  type PrimitiveEvaluationResult,
} from '../evaluation';

/**
 * Feature Exhibit - Interactive deep-dive editorial with 3-phase comprehension evaluation
 *
 * EDUCATIONAL DESIGN:
 * - Phase 1 (Explore): True/False knowledge check activates prior knowledge
 * - Phase 2 (Practice): Evidence matching teaches close reading and text structure
 * - Phase 3 (Apply): Multiple choice synthesis question requires higher-order thinking
 *
 * EVALUATION INTEGRATION:
 * - Tracks comprehension across all three phases
 * - Submits evaluation metrics on Phase 3 completion
 * - Supports competency tracking via skillId/subskillId/objectiveId
 */

interface FeatureExhibitProps {
  data: FeatureExhibitData;
  onTermClick: (term: string) => void;
}

type LearningPhase = 'reading' | 'explore' | 'practice' | 'apply';

interface ClaimMatch {
  claimIndex: number;
  selectedSectionIndex: number | null;
}

export const FeatureExhibit: React.FC<FeatureExhibitProps> = ({ data, onTermClick }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);

  // Learning phases
  const [currentPhase, setCurrentPhase] = useState<LearningPhase>('reading');
  const [startTime] = useState(Date.now());
  const [phaseStartTime, setPhaseStartTime] = useState(Date.now());
  const [timePerSection, setTimePerSection] = useState<number[]>([]);
  const [pagesNavigated, setPagesNavigated] = useState(0);
  const [relatedTermsExplored, setRelatedTermsExplored] = useState(0);

  // Phase 1: Explore (True/False)
  const [exploreAnswer, setExploreAnswer] = useState<boolean | null>(null);
  const [exploreSubmitted, setExploreSubmitted] = useState(false);

  // Phase 2: Practice (Evidence Matching)
  const [claimMatches, setClaimMatches] = useState<ClaimMatch[]>(
    data.evidenceClaims.map((_, i) => ({ claimIndex: i, selectedSectionIndex: null }))
  );
  const [practiceSubmitted, setPracticeSubmitted] = useState(false);
  const [practiceAttempts, setPracticeAttempts] = useState(0);
  const [practiceViewTab, setPracticeViewTab] = useState<'practice' | number>('practice');

  // Phase 3: Apply (Multiple Choice)
  const [synthesisAnswer, setSynthesisAnswer] = useState<string | null>(null);
  const [synthesisSubmitted, setSynthesisSubmitted] = useState(false);
  const [synthesisStartTime, setSynthesisStartTime] = useState<number | null>(null);

  // Pages = Sections + 1 (The "Artifacts/Context" page at the end)
  const totalPages = data.sections.length + 1;
  const isArtifactPage = currentPage === data.sections.length;

  // Destructure evaluation props
  const {
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // Initialize evaluation hook
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    resetAttempt: resetEvaluationAttempt,
  } = usePrimitiveEvaluation<FeatureExhibitMetrics>({
    primitiveType: 'feature-exhibit',
    instanceId: instanceId || `feature-exhibit-${Date.now()}`,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  useEffect(() => {
    let mounted = true;
    const fetchImage = async () => {
      if (!data.visualPrompt) return;
      setLoading(true);
      const url = await generateConceptImage(`Cinematic, wide-angle, highly detailed educational illustration for a museum exhibit about: ${data.visualPrompt}. Atmospheric lighting, photorealistic textures, dark minimalist background.`);
      if (mounted && url) {
        setImageUrl(url);
      }
      if (mounted) setLoading(false);
    };

    fetchImage();
    return () => { mounted = false; };
  }, [data.visualPrompt]);

  const handleNext = () => {
    if (currentPage < totalPages - 1) {
      const timeOnPage = Date.now() - phaseStartTime;
      setTimePerSection(prev => [...prev, timeOnPage]);
      setPagesNavigated(prev => prev + 1);
      setPhaseStartTime(Date.now());
      setCurrentPage(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentPage > 0) {
      setPagesNavigated(prev => prev + 1);
      setCurrentPage(prev => prev - 1);
    }
  };

  const handleTermClick = (term: string) => {
    setRelatedTermsExplored(prev => prev + 1);
    onTermClick(term);
  };

  // After reading, move to Phase 1
  const handleStartAssessment = () => {
    setCurrentPhase('explore');
    setPhaseStartTime(Date.now());
  };

  // Phase 1: Explore - True/False submission
  const handleExploreSubmit = () => {
    if (exploreAnswer === null || exploreSubmitted) return;
    setExploreSubmitted(true);

    // Auto-advance to Phase 2 after showing feedback
    setTimeout(() => {
      setCurrentPhase('practice');
      setPhaseStartTime(Date.now());
    }, 3000);
  };

  // Phase 2: Practice - Evidence matching submission
  const handlePracticeSubmit = () => {
    if (practiceSubmitted) return;

    const allMatched = claimMatches.every(m => m.selectedSectionIndex !== null);
    if (!allMatched) return;

    setPracticeAttempts(prev => prev + 1);

    const correctCount = claimMatches.filter((match, i) =>
      match.selectedSectionIndex === data.evidenceClaims[i].correctSectionIndex
    ).length;

    if (correctCount === data.evidenceClaims.length) {
      setPracticeSubmitted(true);

      // Auto-advance to Phase 3 after showing success
      setTimeout(() => {
        setCurrentPhase('apply');
        setPhaseStartTime(Date.now());
        setSynthesisStartTime(Date.now());
      }, 2000);
    } else {
      // Allow retry - don't mark as submitted
      alert(`${correctCount} of ${data.evidenceClaims.length} matches correct. Review the sections and try again!`);
    }
  };

  // Phase 3: Apply - Multiple choice submission
  const handleSynthesisSubmit = () => {
    if (synthesisAnswer === null || synthesisSubmitted || hasSubmittedEvaluation) return;

    setSynthesisSubmitted(true);

    const timeToAnswer = synthesisStartTime ? Date.now() - synthesisStartTime : 0;
    const totalTime = Date.now() - startTime;

    // Calculate metrics
    const exploreCorrect = exploreAnswer === data.exploreCorrectAnswer;
    const practiceCorrect = claimMatches.every((match, i) =>
      match.selectedSectionIndex === data.evidenceClaims[i].correctSectionIndex
    );
    const synthesisCorrect = synthesisAnswer === data.synthesisCorrectId;

    const correctMatches = claimMatches.filter((match, i) =>
      match.selectedSectionIndex === data.evidenceClaims[i].correctSectionIndex
    ).length;

    const evidenceAccuracy = (correctMatches / data.evidenceClaims.length) * 100;

    const claimMatchResults = claimMatches.map((match, i) => ({
      claimIndex: i,
      claimText: data.evidenceClaims[i].claimText,
      correctSectionIndex: data.evidenceClaims[i].correctSectionIndex,
      studentSectionIndex: match.selectedSectionIndex,
      isCorrect: match.selectedSectionIndex === data.evidenceClaims[i].correctSectionIndex,
    }));

    // Calculate overall accuracy (weighted: 20% explore, 30% practice, 50% synthesis)
    const overallAccuracy = (
      (exploreCorrect ? 20 : 0) +
      (evidenceAccuracy * 0.3) +
      (synthesisCorrect ? 50 : 0)
    );

    // Comprehension score is same as overall accuracy
    const comprehensionScore = overallAccuracy;

    const metrics: FeatureExhibitMetrics = {
      type: 'feature-exhibit',

      // Overall completion
      allPhasesCompleted: true,
      finalSuccess: synthesisCorrect,

      // Phase completion
      explorePhaseCompleted: exploreSubmitted,
      practicePhaseCompleted: practiceSubmitted,
      applyPhaseCompleted: synthesisSubmitted,

      // Phase 1: Explore
      exploreQuestion: data.exploreStatement,
      exploreCorrectAnswer: data.exploreCorrectAnswer,
      exploreStudentAnswer: exploreAnswer,
      exploreIsCorrect: exploreCorrect,
      exploreAttempts: 1,

      // Phase 2: Practice
      totalClaims: data.evidenceClaims.length,
      correctMatches,
      evidenceMatchingAccuracy: evidenceAccuracy,
      matchAttempts: practiceAttempts,
      claimMatchResults,

      // Phase 3: Apply
      synthesisQuestion: data.synthesisQuestion,
      synthesisCorrectOptionId: data.synthesisCorrectId,
      synthesisStudentOptionId: synthesisAnswer,
      synthesisIsCorrect: synthesisCorrect,
      synthesisAttempts: 1,
      timeToAnswerSynthesis: timeToAnswer,

      // Overall performance
      totalAttempts: 1 + practiceAttempts + 1,
      overallAccuracy,
      comprehensionScore,

      // Engagement
      totalTimeSpent: totalTime,
      sectionsRead: currentPage + 1,
      relatedTermsExplored,
      pagesNavigated,
      timePerSection,

      // Efficiency
      completedWithoutErrors: exploreCorrect && practiceCorrect && synthesisCorrect,
      phaseProgressionSmooth: practiceAttempts === 1,
    };

    const score = overallAccuracy;
    const success = synthesisCorrect && overallAccuracy >= 70;

    submitEvaluation(success, score, metrics, {
      studentWork: {
        exploreAnswer,
        claimMatches,
        synthesisAnswer,
      },
    });
  };

  const handleReset = () => {
    setCurrentPage(0);
    setCurrentPhase('reading');
    setExploreAnswer(null);
    setExploreSubmitted(false);
    setClaimMatches(data.evidenceClaims.map((_, i) => ({ claimIndex: i, selectedSectionIndex: null })));
    setPracticeSubmitted(false);
    setPracticeAttempts(0);
    setPracticeViewTab('practice');
    setSynthesisAnswer(null);
    setSynthesisSubmitted(false);
    setSynthesisStartTime(null);
    setTimePerSection([]);
    setPagesNavigated(0);
    setRelatedTermsExplored(0);
    resetEvaluationAttempt();
  };

  const progressPercentage = ((currentPage + 1) / totalPages) * 100;

  const exploreCorrect = exploreAnswer === data.exploreCorrectAnswer;
  const synthesisCorrect = synthesisAnswer === data.synthesisCorrectId;

  return (
    <div className="w-full max-w-6xl mx-auto my-20 animate-fade-in">
      {/* Section Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-2 h-8 bg-blue-500 rounded-full"></div>
        <h2 className="text-3xl font-bold text-white tracking-tight">Deep Dive Analysis</h2>
      </div>

      {/* Phase Progress Indicator */}
      {currentPhase !== 'reading' && (
        <div className="mb-8 flex justify-center">
          <div className="flex items-center gap-2 bg-slate-800/60 px-6 py-3 rounded-full border border-slate-700/50">
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full transition-all ${currentPhase === 'explore' ? 'bg-blue-500/20 border border-blue-500/50' : exploreSubmitted ? 'bg-green-500/20 border border-green-500/50' : 'opacity-50'}`}>
              <span className={`w-2 h-2 rounded-full ${currentPhase === 'explore' ? 'bg-blue-400' : exploreSubmitted ? 'bg-green-400' : 'bg-slate-500'}`}></span>
              <span className="text-xs font-semibold">1. Explore</span>
            </div>
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full transition-all ${currentPhase === 'practice' ? 'bg-yellow-500/20 border border-yellow-500/50' : currentPhase === 'apply' || hasSubmittedEvaluation ? 'bg-green-500/20 border border-green-500/50' : 'opacity-50'}`}>
              <span className={`w-2 h-2 rounded-full ${currentPhase === 'practice' ? 'bg-yellow-400' : practiceSubmitted ? 'bg-green-400' : 'bg-slate-500'}`}></span>
              <span className="text-xs font-semibold">2. Practice</span>
            </div>
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full transition-all ${currentPhase === 'apply' ? 'bg-purple-500/20 border border-purple-500/50' : hasSubmittedEvaluation ? 'bg-green-500/20 border border-green-500/50' : 'opacity-50'}`}>
              <span className={`w-2 h-2 rounded-full ${currentPhase === 'apply' ? 'bg-purple-400' : hasSubmittedEvaluation ? 'bg-green-400' : 'bg-slate-500'}`}></span>
              <span className="text-xs font-semibold">3. Apply</span>
            </div>
          </div>
        </div>
      )}

      <div className="glass-panel rounded-3xl overflow-hidden border border-white/10 grid grid-cols-1 lg:grid-cols-2 min-h-[600px] shadow-2xl relative">

        {/* Left: Visual & Title (Sticky Context) */}
        <div className="relative bg-slate-900 p-8 flex flex-col justify-end lg:h-auto h-[300px] overflow-hidden group">
          {/* Background Image Layer */}
          <div className="absolute inset-0 z-0 transition-transform duration-[20s] ease-linear transform scale-100 group-hover:scale-110">
             {imageUrl ? (
               <img src={imageUrl} alt={data.title} className="w-full h-full object-cover opacity-60 transition-opacity duration-1000" />
             ) : (
               <div className="w-full h-full bg-slate-800 animate-pulse"></div>
             )}
             <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent"></div>
             <div className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-900/20 to-slate-900/80 lg:bg-gradient-to-r lg:from-slate-900/10 lg:via-slate-900/40 lg:to-slate-900"></div>
          </div>

          <div className="relative z-10 lg:pr-12">
            <span className="inline-block px-3 py-1 mb-4 text-[10px] font-bold tracking-widest text-blue-300 uppercase bg-blue-900/40 border border-blue-500/30 rounded-full backdrop-blur-sm">
                Interactive Exhibit
            </span>
            <h3 className="text-3xl md:text-5xl font-bold text-white leading-tight mb-4 drop-shadow-xl">
              {data.title}
            </h3>
            <div className="w-20 h-1 bg-blue-500 rounded-full mb-4"></div>
            <p className="text-sm text-slate-300 font-light opacity-80 hidden lg:block">
                Read the exhibit, then complete three comprehension phases to demonstrate your understanding.
            </p>
          </div>
        </div>

        {/* Right: Interactive Content Area */}
        <div className="relative bg-slate-900/80 backdrop-blur-md flex flex-col h-full border-l border-white/5">

            {/* Progress Bar */}
            {currentPhase === 'reading' && (
              <div className="h-1 bg-white/5 w-full">
                  <div
                      className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-500 ease-out"
                      style={{ width: `${progressPercentage}%` }}
                  ></div>
              </div>
            )}

            {/* Content Area */}
            <div className="flex-1 p-8 md:p-12 overflow-y-auto relative">

                {/* READING PHASE: Navigate through exhibit sections */}
                {currentPhase === 'reading' && (
                  <>
                    <div className="p-6 border-b border-white/5 flex justify-between items-center text-xs font-mono text-slate-400 uppercase tracking-widest mb-6">
                        <span>
                            {isArtifactPage ? 'Appendix' : `Section ${String(currentPage + 1).padStart(2, '0')}`}
                        </span>
                        <span>
                            {currentPage + 1} / {totalPages}
                        </span>
                    </div>

                    <div key={currentPage} className="animate-fade-in">
                        {!isArtifactPage ? (
                            <>
                                <h4 className="text-2xl font-bold text-blue-100 mb-6 flex items-center gap-3">
                                    <span className="text-blue-500 opacity-50 text-sm font-mono">{String(currentPage + 1).padStart(2, '0')}.</span>
                                    {data.sections[currentPage].heading}
                                </h4>
                                <p className="text-lg md:text-xl text-slate-300 leading-relaxed font-light">
                                    {data.sections[currentPage].content}
                                </p>
                            </>
                        ) : (
                            <div className="h-full flex flex-col">
                                <div className="mb-8">
                                    <h4 className="text-2xl font-bold text-white mb-2">Related Topics</h4>
                                    <p className="text-slate-400 text-sm">
                                        Explore these related concepts for deeper understanding.
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 gap-3 mb-8">
                                    {data.relatedTerms && data.relatedTerms.map((term, i) => (
                                        <button
                                            key={i}
                                            onClick={() => handleTermClick(term)}
                                            className="group relative p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-blue-500/50 transition-all duration-300 text-left flex items-center justify-between"
                                            style={{ animationDelay: `${i * 100}ms` }}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-300 flex items-center justify-center border border-blue-500/20 group-hover:scale-110 transition-transform">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                                                </div>
                                                <span className="text-lg font-medium text-slate-200 group-hover:text-white">{term}</span>
                                            </div>
                                            <span className="text-xs font-bold uppercase tracking-wider text-blue-500 opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all">
                                                Explore
                                            </span>
                                        </button>
                                    ))}
                                </div>

                                <div className="mt-auto pt-8 border-t border-white/5">
                                  <button
                                    onClick={handleStartAssessment}
                                    className="group w-full px-6 py-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-blue-500/50 text-white rounded-xl font-medium tracking-wide transition-all relative overflow-hidden"
                                  >
                                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/10 to-blue-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                                    <div className="relative flex items-center justify-center gap-2">
                                      <span>Begin Comprehension Assessment</span>
                                      <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                                      </svg>
                                    </div>
                                  </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Navigation Controls (only if not on final page) */}
                    {!isArtifactPage && (
                      <div className="mt-12 pt-6 border-t border-white/5 flex justify-between items-center gap-4">
                          <button
                              onClick={handlePrev}
                              disabled={currentPage === 0}
                              className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                          >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                              Previous
                          </button>

                          <div className="flex gap-1.5">
                              {Array.from({ length: totalPages }).map((_, i) => (
                                  <div
                                      key={i}
                                      className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${i === currentPage ? 'bg-blue-400 scale-125' : 'bg-slate-700'}`}
                                  />
                              ))}
                          </div>

                          <button
                              onClick={handleNext}
                              disabled={currentPage === totalPages - 1}
                              className="flex items-center gap-2 px-6 py-2 rounded-full text-sm font-bold bg-white text-slate-900 hover:bg-blue-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                              Next Page
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                          </button>
                      </div>
                    )}
                  </>
                )}

                {/* PHASE 1: EXPLORE - True/False Knowledge Check */}
                {currentPhase === 'explore' && (
                  <div className="animate-fade-in">
                    <div className="mb-8">
                      <h4 className="text-2xl font-bold text-white mb-2">Phase 1: Explore</h4>
                      <p className="text-slate-400 text-sm">Based on what you read, determine if this statement is true or false.</p>
                    </div>

                    <div className="p-6 bg-blue-500/10 border border-blue-500/30 rounded-xl mb-8">
                      <p className="text-xl text-white font-medium leading-relaxed">
                        {data.exploreStatement}
                      </p>
                    </div>

                    {/* True/False Buttons */}
                    <div className="grid grid-cols-2 gap-4 mb-8">
                      {[
                        { value: true, label: 'True', icon: '✓' },
                        { value: false, label: 'False', icon: '✗' }
                      ].map(({ value, label, icon }) => {
                        let statusClass = "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20";

                        if (exploreAnswer === value) {
                          statusClass = "border-blue-500 bg-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.3)]";
                        }

                        if (exploreSubmitted) {
                          if (value === data.exploreCorrectAnswer) {
                            statusClass = "border-emerald-500 bg-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.3)]";
                          } else if (exploreAnswer === value && value !== data.exploreCorrectAnswer) {
                            statusClass = "border-red-500 bg-red-500/20 opacity-60";
                          } else {
                            statusClass = "opacity-40 border-transparent bg-black/20";
                          }
                        }

                        return (
                          <button
                            key={label}
                            onClick={() => setExploreAnswer(value)}
                            disabled={exploreSubmitted}
                            className={`relative p-8 rounded-xl border transition-all duration-300 group ${statusClass}`}
                          >
                            <div className="flex flex-col items-center gap-3">
                              <span className={`text-4xl transition-colors ${exploreAnswer === value || (exploreSubmitted && value === data.exploreCorrectAnswer) ? 'text-white' : 'text-slate-400'}`}>
                                {icon}
                              </span>
                              <span className="text-xl font-bold text-slate-200 group-hover:text-white transition-colors">{label}</span>
                            </div>

                            {exploreSubmitted && value === data.exploreCorrectAnswer && (
                              <div className="absolute top-2 right-2 text-emerald-400">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Submit or Feedback */}
                    {!exploreSubmitted ? (
                      <button
                        onClick={handleExploreSubmit}
                        disabled={exploreAnswer === null}
                        className="w-full px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-bold tracking-wide transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-600/20 hover:shadow-blue-500/40"
                      >
                        Check Answer
                      </button>
                    ) : (
                      <div className="animate-fade-in bg-black/20 rounded-2xl p-6 border border-white/5">
                        <div className={`flex items-center gap-3 mb-2 font-bold uppercase tracking-wider ${exploreCorrect ? 'text-emerald-400' : 'text-slate-300'}`}>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {exploreCorrect ?
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path> :
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            }
                          </svg>
                          <span>{exploreCorrect ? 'Correct!' : 'Learning Moment'}</span>
                        </div>
                        <p className="text-slate-300 leading-relaxed text-lg font-light">
                          {data.exploreRationale}
                        </p>
                        <p className="text-slate-400 text-sm mt-4 italic">
                          Moving to Phase 2...
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* PHASE 2: PRACTICE - Evidence Matching */}
                {currentPhase === 'practice' && (
                  <div className="animate-fade-in h-full flex flex-col">
                    <div className="mb-6">
                      <h4 className="text-2xl font-bold text-white mb-2">Phase 2: Practice</h4>
                      <p className="text-slate-400 text-sm">{data.evidenceInstructions}</p>
                    </div>

                    {/* Tab Navigation */}
                    <div className="flex gap-1 mb-6 border-b border-white/10 overflow-x-auto">
                      <button
                        onClick={() => setPracticeViewTab('practice')}
                        className={`px-4 py-2 text-sm font-medium transition-all whitespace-nowrap ${
                          practiceViewTab === 'practice'
                            ? 'text-blue-400 border-b-2 border-blue-400'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Practice
                      </button>
                      {data.sections.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={() => setPracticeViewTab(idx)}
                          className={`px-4 py-2 text-sm font-medium transition-all whitespace-nowrap ${
                            practiceViewTab === idx
                              ? 'text-blue-400 border-b-2 border-blue-400'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          Section {idx + 1}
                        </button>
                      ))}
                    </div>

                    {/* Tab Content */}
                    <div className="flex-1 overflow-y-auto">
                      {/* Practice Tab */}
                      {practiceViewTab === 'practice' && (
                        <div className="space-y-6 mb-8">
                          {data.evidenceClaims.map((claim, i) => {
                            const match = claimMatches[i];
                            const isCorrect = practiceSubmitted && match.selectedSectionIndex === claim.correctSectionIndex;
                            const isIncorrect = practiceSubmitted && match.selectedSectionIndex !== claim.correctSectionIndex;

                            return (
                              <div key={i} className={`p-6 rounded-xl border-2 transition-all ${
                                isCorrect ? 'bg-green-500/10 border-green-500/50' :
                                isIncorrect ? 'bg-red-500/10 border-red-500/50' :
                                'bg-slate-800/40 border-slate-700/50'
                              }`}>
                                <div className="flex items-start gap-4">
                                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                                    isCorrect ? 'bg-green-500 text-white' :
                                    isIncorrect ? 'bg-red-500 text-white' :
                                    'bg-slate-700 text-slate-400'
                                  }`}>
                                    {isCorrect ? '✓' : i + 1}
                                  </div>
                                  <div className="flex-1">
                                    <p className="text-white font-medium mb-4">{claim.claimText}</p>
                                    <div className="grid grid-cols-2 gap-2">
                                      {data.sections.map((section, sectionIndex) => (
                                        <button
                                          key={sectionIndex}
                                          onClick={() => {
                                            if (!practiceSubmitted) {
                                              const newMatches = [...claimMatches];
                                              newMatches[i].selectedSectionIndex = sectionIndex;
                                              setClaimMatches(newMatches);
                                            }
                                          }}
                                          disabled={practiceSubmitted}
                                          className={`relative p-3 rounded-lg text-left text-sm transition-all ${
                                            match.selectedSectionIndex === sectionIndex
                                              ? 'bg-blue-500/20 border-2 border-blue-500/50 text-white'
                                              : 'bg-white/5 border-2 border-white/10 text-slate-400 hover:bg-white/10 hover:border-white/20'
                                          } ${practiceSubmitted ? 'cursor-not-allowed' : ''}`}
                                        >
                                          <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1">
                                              <div className="font-semibold text-xs uppercase tracking-wider mb-1 opacity-70">
                                                Section {sectionIndex + 1}
                                              </div>
                                              <div className="font-medium">
                                                {section.heading}
                                              </div>
                                            </div>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setPracticeViewTab(sectionIndex);
                                              }}
                                              className="flex-shrink-0 text-slate-500 hover:text-blue-400 transition-colors p-1"
                                              title="View section"
                                            >
                                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                                              </svg>
                                            </button>
                                          </div>
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Section Tabs */}
                      {typeof practiceViewTab === 'number' && (
                        <div className="animate-fade-in">
                          <div className="mb-6 p-6 bg-slate-800/40 rounded-xl border border-white/10">
                            <div className="flex items-center justify-between mb-4">
                              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                Section {practiceViewTab + 1}
                              </span>
                              <button
                                onClick={() => setPracticeViewTab('practice')}
                                className="text-sm text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                                </svg>
                                Back to Practice
                              </button>
                            </div>
                            <h5 className="text-2xl font-bold text-white mb-4">
                              {data.sections[practiceViewTab].heading}
                            </h5>
                            <p className="text-slate-300 text-lg leading-relaxed">
                              {data.sections[practiceViewTab].content}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {!practiceSubmitted ? (
                      <button
                        onClick={handlePracticeSubmit}
                        disabled={claimMatches.some(m => m.selectedSectionIndex === null)}
                        className="w-full px-8 py-3 bg-yellow-600 hover:bg-yellow-500 text-white rounded-full font-bold tracking-wide transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                      >
                        Check Matches
                      </button>
                    ) : (
                      <div className="animate-fade-in bg-green-500/10 rounded-2xl p-6 border border-green-500/30">
                        <div className="flex items-center gap-3 mb-2 font-bold uppercase tracking-wider text-green-400">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                          </svg>
                          <span>All Matches Correct!</span>
                        </div>
                        <p className="text-slate-300 leading-relaxed">
                          Excellent! You've identified the supporting evidence for each claim. Moving to Phase 3...
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* PHASE 3: APPLY - Multiple Choice Synthesis */}
                {currentPhase === 'apply' && (
                  <div className="animate-fade-in">
                    <div className="mb-8">
                      <h4 className="text-2xl font-bold text-white mb-2">Phase 3: Apply</h4>
                      <p className="text-slate-400 text-sm">Synthesize your understanding to answer this question.</p>
                    </div>

                    <div className="p-6 bg-purple-500/10 border border-purple-500/30 rounded-xl mb-8">
                      <p className="text-xl text-white font-medium leading-relaxed">
                        {data.synthesisQuestion}
                      </p>
                    </div>

                    {/* Multiple Choice Options */}
                    <div className="space-y-3 mb-8">
                      {data.synthesisOptions.map((option) => {
                        let statusClass = "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20";

                        if (synthesisAnswer === option.id) {
                          statusClass = "border-purple-500 bg-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.3)]";
                        }

                        if (synthesisSubmitted) {
                          if (option.id === data.synthesisCorrectId) {
                            statusClass = "border-emerald-500 bg-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.3)]";
                          } else if (synthesisAnswer === option.id && option.id !== data.synthesisCorrectId) {
                            statusClass = "border-red-500 bg-red-500/20 opacity-60";
                          } else {
                            statusClass = "opacity-40 border-transparent bg-black/20";
                          }
                        }

                        return (
                          <button
                            key={option.id}
                            onClick={() => setSynthesisAnswer(option.id)}
                            disabled={synthesisSubmitted}
                            className={`relative w-full p-4 rounded-xl border transition-all duration-300 text-left ${statusClass}`}
                          >
                            <div className="flex items-start gap-4">
                              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                                synthesisAnswer === option.id || (synthesisSubmitted && option.id === data.synthesisCorrectId)
                                  ? 'bg-white text-slate-900'
                                  : 'bg-slate-700 text-slate-400'
                              }`}>
                                {option.id.toUpperCase()}
                              </div>
                              <p className="flex-1 text-slate-200 leading-relaxed">
                                {option.text}
                              </p>
                              {synthesisSubmitted && option.id === data.synthesisCorrectId && (
                                <div className="flex-shrink-0 text-emerald-400">
                                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                                  </svg>
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Submit or Feedback */}
                    {!synthesisSubmitted ? (
                      <button
                        onClick={handleSynthesisSubmit}
                        disabled={synthesisAnswer === null}
                        className="w-full px-8 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-full font-bold tracking-wide transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-600/20 hover:shadow-purple-500/40"
                      >
                        Submit Final Answer
                      </button>
                    ) : (
                      <div className="space-y-4">
                        <div className={`animate-fade-in rounded-2xl p-6 border ${
                          synthesisCorrect
                            ? 'bg-green-500/10 border-green-500/30'
                            : 'bg-slate-800/60 border-slate-700/50'
                        }`}>
                          <div className={`flex items-center gap-3 mb-2 font-bold uppercase tracking-wider ${
                            synthesisCorrect ? 'text-emerald-400' : 'text-slate-300'
                          }`}>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              {synthesisCorrect ?
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path> :
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                              }
                            </svg>
                            <span>{synthesisCorrect ? 'Excellent Analysis!' : 'Insight'}</span>
                          </div>
                          <p className="text-slate-300 leading-relaxed text-lg font-light">
                            {data.synthesisRationale}
                          </p>
                        </div>

                        <button
                          onClick={handleReset}
                          className="w-full px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-full font-medium tracking-wide transition-all shadow-lg"
                        >
                          Try Again
                        </button>
                      </div>
                    )}
                  </div>
                )}

            </div>
        </div>
      </div>
    </div>
  );
};
