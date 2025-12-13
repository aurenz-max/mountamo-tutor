'use client';

import React, { useState, useEffect } from 'react';
import { KnowledgeCheck } from '../primitives/KnowledgeCheck';
import { ProblemData, ProblemType } from '../types';
import { GradeLevelSelector, GradeLevel } from './GradeLevelSelector';
import { SubjectSelector, Subject } from './SubjectSelector';
import { AIHelper } from './AIHelper';
import { SpotlightCard } from './SpotlightCard';
import {
  generateMultipleChoiceProblems,
  generateTrueFalseProblems,
  generateFillInBlanksProblems,
  generateCategorizationProblems,
  generateSequencingProblems,
  generateMatchingProblems,
  generateProblemHint,
  generatePracticeAssessment,
  generateQuests,
  generateWarmUpQuestion,
  Quest,
  WarmUpQuestion
} from '../service/geminiClient-api';

interface PracticeModeProps {
  onBack: () => void;
  onLearnMore?: (subject: Subject, gradeLevel: GradeLevel) => void;
}

type PracticeStep = 'setup' | 'quest-selection' | 'practicing' | 'results';

// Icon mapping for dynamic icon rendering
const getIconForQuest = (iconName: string) => {
  const iconMap: Record<string, string> = {
    'Dna': '🧬',
    'Rocket': '🚀',
    'FlaskConical': '🧪',
    'Leaf': '🌿',
    'Calculator': '🔢',
    'Layers': '📐',
    'Search': '🔍',
    'Database': '📊',
    'Sparkles': '✨',
    'BrainCircuit': '🧠',
    'Zap': '⚡',
    'Atom': '⚛️',
    'Microscope': '🔬'
  };
  return iconMap[iconName] || '🎯';
};

// Subject color mapping (RGB format for SpotlightCard)
const getSubjectColor = (subject: Subject): string => {
  const colorMap: Record<Subject, string> = {
    'mathematics': '56, 189, 248', // sky-400
    'science': '74, 222, 128', // green-400
    'language-arts': '192, 132, 252', // purple-400
    'social-studies': '250, 204, 21', // yellow-400
    'reading': '248, 113, 113', // red-400
    'writing': '167, 139, 250' // violet-400
  };
  return colorMap[subject] || '120, 119, 198';
};

export const PracticeMode: React.FC<PracticeModeProps> = ({ onBack, onLearnMore }) => {
  // Setup state
  const [step, setStep] = useState<PracticeStep>('setup');
  const [subject, setSubject] = useState<Subject | null>(null);
  const [gradeLevel, setGradeLevel] = useState<GradeLevel>('elementary');
  const [problemCount, setProblemCount] = useState<number>(5);

  // Quest selection state
  const [quests, setQuests] = useState<Quest[]>([]);
  const [selectedQuest, setSelectedQuest] = useState<Quest | null>(null);
  const [isLoadingQuests, setIsLoadingQuests] = useState(false);
  const [warmUp, setWarmUp] = useState<WarmUpQuestion | null>(null);
  const [isLoadingWarmUp, setIsLoadingWarmUp] = useState(false);
  const [selectedWarmUpAnswer, setSelectedWarmUpAnswer] = useState<number | null>(null);

  // Practice state
  const [problems, setProblems] = useState<ProblemData[]>([]);
  const [currentProblemIndex, setCurrentProblemIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<string, any>>(new Map());
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Assessment state
  const [assessment, setAssessment] = useState<{
    summary: string;
    strengths: string[];
    areasForGrowth: string[];
    recommendedTopics: Array<{
      topic: string;
      reason: string;
      subject: string;
    }>;
  } | null>(null);
  const [isGeneratingAssessment, setIsGeneratingAssessment] = useState(false);

  // Problem type distribution for variety
  const problemTypeDistribution: ProblemType[] = [
    'multiple_choice',
    'true_false',
    'fill_in_blanks',
    'categorization_activity',
    'sequencing_activity',
    'matching_activity'
  ];

  const generatorMap: Record<ProblemType, (topic: string, gradeLevel: string, count: number, context?: string) => Promise<any[]>> = {
    'multiple_choice': generateMultipleChoiceProblems,
    'true_false': generateTrueFalseProblems,
    'fill_in_blanks': generateFillInBlanksProblems,
    'categorization_activity': generateCategorizationProblems,
    'sequencing_activity': generateSequencingProblems,
    'matching_activity': generateMatchingProblems,
    'scenario_problem': async () => [], // Not implemented
    'short_answer': async () => [], // Not implemented
  };

  // Load quests and warm-up when subject is selected
  useEffect(() => {
    if (subject && step === 'quest-selection') {
      setIsLoadingQuests(true);
      setIsLoadingWarmUp(true);
      setQuests([]);
      setWarmUp(null);
      setSelectedWarmUpAnswer(null);

      Promise.all([
        generateQuests(subject, gradeLevel, 4),
        generateWarmUpQuestion(subject, gradeLevel)
      ])
        .then(([questsData, warmUpData]) => {
          setQuests(questsData);
          setWarmUp(warmUpData);
        })
        .catch((err) => {
          console.error('Failed to load quests:', err);
          setError('Failed to generate quest options. Please try again.');
        })
        .finally(() => {
          setIsLoadingQuests(false);
          setIsLoadingWarmUp(false);
        });
    }
  }, [subject, gradeLevel, step]);

  const handleSubjectSelect = (newSubject: Subject) => {
    setSubject(newSubject);
    setStep('quest-selection');
    setSelectedQuest(null);
  };

  const handleQuestSelect = async (quest: Quest) => {
    setSelectedQuest(quest);
    await handleStartPractice(quest);
  };

  const handleStartPractice = async (quest?: Quest) => {
    if (!subject) {
      setError('Please select a subject');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setStep('practicing');

    try {
      // Generate a mix of problem types
      const allProblems: ProblemData[] = [];
      const typesToGenerate = problemTypeDistribution.slice(0, 3); // Use first 3 types for variety
      const perType = Math.ceil(problemCount / typesToGenerate.length);

      const topicContext = quest
        ? `${quest.title}: ${quest.description}. Focus on ${quest.focusArea}.`
        : subject.replace('-', ' ');

      for (const problemType of typesToGenerate) {
        const generator = generatorMap[problemType];
        if (generator) {
          try {
            const generatedProblems = await generator(
              topicContext,
              gradeLevel,
              perType,
              `Practice problems for ${topicContext}`
            );

            const typedProblems = generatedProblems.map(p => ({
              ...p,
              type: problemType,
              gradeLevel: gradeLevel
            }));

            allProblems.push(...typedProblems);
          } catch (err) {
            console.warn(`Failed to generate ${problemType} problems:`, err);
          }
        }
      }

      // Shuffle and limit to requested count
      const shuffled = allProblems.sort(() => Math.random() - 0.5);
      const finalProblems = shuffled.slice(0, problemCount);

      if (finalProblems.length === 0) {
        throw new Error('Failed to generate any problems. Please try again.');
      }

      setProblems(finalProblems);
      setCurrentProblemIndex(0);
      setAnswers(new Map());
    } catch (err) {
      console.error('Generation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate problems');
      setStep('quest-selection');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleNext = async () => {
    if (currentProblemIndex < problems.length - 1) {
      setCurrentProblemIndex(currentProblemIndex + 1);
    } else {
      setStep('results');
      // Generate AI assessment
      if (subject) {
        setIsGeneratingAssessment(true);
        try {
          const assessmentResult = await generatePracticeAssessment(
            subject,
            gradeLevel,
            problems.length,
            problems
          );
          setAssessment(assessmentResult);
        } catch (err) {
          console.error('Failed to generate assessment:', err);
        } finally {
          setIsGeneratingAssessment(false);
        }
      }
    }
  };

  const handlePrevious = () => {
    if (currentProblemIndex > 0) {
      setCurrentProblemIndex(currentProblemIndex - 1);
    }
  };

  const handleRestart = () => {
    setStep('setup');
    setSubject(null);
    setProblems([]);
    setCurrentProblemIndex(0);
    setAnswers(new Map());
    setError(null);
    setAssessment(null);
    setQuests([]);
    setSelectedQuest(null);
  };

  const handleMorePractice = async () => {
    if (!subject) return;

    // Go directly to practice, skip quest selection
    setProblems([]);
    setCurrentProblemIndex(0);
    setAnswers(new Map());
    setAssessment(null);
    setError(null);

    await handleStartPractice();
  };

  const handleLearnMore = () => {
    if (!subject || !onLearnMore) return;
    onLearnMore(subject, gradeLevel);
  };

  const handleBackToQuests = () => {
    setStep('quest-selection');
    setProblems([]);
    setCurrentProblemIndex(0);
    setAnswers(new Map());
    setError(null);
    setSelectedQuest(null);
  };

  const handleExploreTopicFromAssessment = (recommendedSubject: string) => {
    const subjectMapping: Record<string, Subject> = {
      'mathematics': 'mathematics',
      'math': 'mathematics',
      'science': 'science',
      'language-arts': 'language-arts',
      'language arts': 'language-arts',
      'reading': 'reading',
      'writing': 'writing',
      'social-studies': 'social-studies',
      'social studies': 'social-studies',
      'history': 'social-studies',
    };

    const normalizedSubject = recommendedSubject.toLowerCase();
    const mappedSubject = subjectMapping[normalizedSubject] || subject;

    setSubject(mappedSubject as Subject);
    setStep('quest-selection');
    setProblems([]);
    setCurrentProblemIndex(0);
    setAnswers(new Map());
    setAssessment(null);
  };

  const handleRequestHint = async (hintLevel: number): Promise<string> => {
    if (!currentProblem) {
      throw new Error('No current problem');
    }
    return await generateProblemHint(currentProblem, hintLevel);
  };

  const currentProblem = problems[currentProblemIndex];
  const progress = problems.length > 0 ? ((currentProblemIndex + 1) / problems.length) * 100 : 0;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="mb-8 text-center">
        <button
          onClick={step === 'quest-selection' ? () => setStep('setup') : step === 'practicing' || step === 'results' ? handleBackToQuests : onBack}
          className="inline-flex items-center gap-2 px-6 py-3 bg-slate-800/50 hover:bg-slate-700/50 text-white rounded-full border border-slate-600 transition-all"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
          </svg>
          {step === 'quest-selection' ? 'Back to Subjects' : step === 'practicing' || step === 'results' ? 'Back to Quests' : 'Back to Home'}
        </button>
      </div>

      {/* Setup Step - Subject Selection */}
      {step === 'setup' && (
        <div className="max-w-5xl mx-auto animate-fade-in">
          <div className="text-center mb-12">
            <h2 className="text-5xl font-bold text-white mb-4 tracking-tight">
              Ready to Practice?
            </h2>
            <p className="text-slate-400 text-xl">
              Choose a subject to explore personalized learning quests
            </p>
          </div>

          <div className="mb-12">
            <label className="block text-lg font-semibold text-white mb-4 text-center">
              What would you like to practice?
            </label>
            <SubjectSelector value={subject} onChange={handleSubjectSelect} />
          </div>

          <div className="mb-12 max-w-md mx-auto">
            <label className="block text-lg font-semibold text-white mb-4 text-center">
              Learning Level
            </label>
            <GradeLevelSelector value={gradeLevel} onChange={setGradeLevel} />
          </div>

          <div className="mb-12 max-w-md mx-auto">
            <label className="block text-lg font-semibold text-white mb-4 text-center">
              How many questions?
            </label>
            <div className="flex items-center gap-4 justify-center">
              {[3, 5, 10, 20].map((count) => (
                <button
                  key={count}
                  onClick={() => setProblemCount(count)}
                  className={`px-8 py-4 rounded-xl font-bold text-lg transition-all ${
                    problemCount === count
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 scale-110'
                      : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700 border border-slate-700'
                  }`}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Quest Selection Step */}
      {step === 'quest-selection' && subject && (
        <div className="max-w-6xl mx-auto animate-fade-in">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-white mb-4">
              {subject.replace('-', ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
            </h2>
            <p className="text-slate-400 text-lg">
              Choose a quest to begin your learning adventure
            </p>
          </div>

          {/* Warm-up Question */}
          {warmUp && !isLoadingWarmUp && (
            <div className="mb-8 max-w-2xl mx-auto">
              <div className="p-6 bg-gradient-to-br from-blue-900/20 to-purple-900/20 rounded-2xl border border-blue-500/30">
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
                  </svg>
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-300">Quick Warm-up</span>
                </div>
                <p className="text-white mb-4">{warmUp.question}</p>
                <div className="space-y-2">
                  {warmUp.options.map((option, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedWarmUpAnswer(idx)}
                      className={`w-full text-left text-sm p-3 rounded-lg border transition-all ${
                        selectedWarmUpAnswer === idx
                          ? option === warmUp.correctAnswer
                            ? 'border-green-500/50 bg-green-500/20 text-green-100'
                            : 'border-red-500/50 bg-red-500/20 text-red-100'
                          : 'border-white/10 bg-white/5 hover:bg-white/10 text-slate-300'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
                {selectedWarmUpAnswer !== null && (
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <p className="text-xs text-blue-200 italic">{warmUp.funFact}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Quests Grid */}
          <div>
            <div className="flex items-center gap-2 mb-6">
              <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"></path>
              </svg>
              <h3 className="text-lg font-semibold text-white">Recommended Quests</h3>
            </div>

            {isLoadingQuests ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-40 rounded-xl border border-white/5 bg-white/5 animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {quests.map((quest, idx) => (
                  <SpotlightCard
                    key={idx}
                    color={getSubjectColor(subject)}
                    onClick={() => handleQuestSelect(quest)}
                    className="bg-slate-900/40"
                  >
                    <div className="p-6 flex items-start gap-4">
                      <div className="text-4xl flex-shrink-0">
                        {getIconForQuest(quest.icon)}
                      </div>
                      <div className="flex-1">
                        <div className="text-xs font-bold text-indigo-400 mb-1 uppercase tracking-wide">
                          {quest.focusArea}
                        </div>
                        <h4 className="text-xl font-bold text-white mb-2 group-hover:text-indigo-200 transition-colors">
                          {quest.title}
                        </h4>
                        <p className="text-sm text-slate-400 leading-relaxed mb-3">
                          {quest.description}
                        </p>
                        {quest.difficulty && (
                          <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                            quest.difficulty === 'beginner' ? 'bg-green-500/20 text-green-300' :
                            quest.difficulty === 'intermediate' ? 'bg-yellow-500/20 text-yellow-300' :
                            'bg-red-500/20 text-red-300'
                          }`}>
                            {quest.difficulty}
                          </span>
                        )}
                      </div>
                    </div>
                  </SpotlightCard>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="mt-6 p-4 bg-red-900/20 border border-red-500/50 rounded-lg">
              <p className="text-red-400 text-sm text-center">{error}</p>
            </div>
          )}
        </div>
      )}

      {/* Practice Step */}
      {step === 'practicing' && currentProblem && !isGenerating && (
        <div className="max-w-5xl mx-auto animate-fade-in">
          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-400">
                Question {currentProblemIndex + 1} of {problems.length}
              </span>
              <span className="text-sm font-medium text-blue-400">
                {Math.round(progress)}% Complete
              </span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Current Problem */}
          <div className="mb-8">
            <KnowledgeCheck data={{ problems: [currentProblem] }} />
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={handlePrevious}
              disabled={currentProblemIndex === 0}
              className="px-6 py-3 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 disabled:opacity-50 text-white rounded-lg font-semibold transition-all disabled:cursor-not-allowed flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
              </svg>
              Previous
            </button>

            <button
              onClick={handleBackToQuests}
              className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium transition-all"
            >
              Exit Practice
            </button>

            <button
              onClick={handleNext}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-all flex items-center gap-2"
            >
              {currentProblemIndex === problems.length - 1 ? 'Finish' : 'Next'}
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
              </svg>
            </button>
          </div>

          {/* AI Helper - Fixed Position */}
          <AIHelper problem={currentProblem} onRequestHint={handleRequestHint} />
        </div>
      )}

      {/* Loading State for Practice Generation */}
      {step === 'practicing' && isGenerating && (
        <div className="max-w-3xl mx-auto animate-fade-in">
          <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
            <div className="relative">
              <div className="absolute inset-0 bg-indigo-500 blur-xl opacity-20 animate-pulse rounded-full"></div>
              <div className="w-16 h-16 border-4 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin relative z-10"></div>
            </div>
            <h2 className="text-2xl font-bold text-white">Generating your quest...</h2>
            <p className="text-slate-400">Our AI is crafting unique problems for you</p>
          </div>
        </div>
      )}

      {/* Results Step - Same as original */}
      {step === 'results' && (
        <div className="max-w-5xl mx-auto animate-fade-in">
          {/* Success Header */}
          <div className="mb-12 text-center">
            <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center shadow-2xl shadow-green-500/30 animate-bounce-in">
              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <h2 className="text-5xl font-bold text-white mb-4">Quest Complete!</h2>
            <p className="text-slate-400 text-xl">
              You've completed {problems.length} questions
            </p>
          </div>

          {/* Session Stats */}
          <div className="mb-10 p-8 bg-slate-800/50 rounded-2xl border border-slate-700">
            <div className="grid grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-4xl font-bold text-white mb-2">{problems.length}</div>
                <div className="text-sm text-slate-400 uppercase tracking-wider">Questions</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-blue-400 mb-2 capitalize">{subject?.replace('-', ' ')}</div>
                <div className="text-sm text-slate-400 uppercase tracking-wider">Subject</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-purple-400 mb-2 capitalize">{gradeLevel.replace('-', ' ')}</div>
                <div className="text-sm text-slate-400 uppercase tracking-wider">Level</div>
              </div>
            </div>
          </div>

          {/* AI Assessment Section */}
          {isGeneratingAssessment && (
            <div className="mb-10 p-8 bg-gradient-to-br from-blue-900/20 to-purple-900/20 rounded-2xl border border-blue-500/30">
              <div className="flex items-center justify-center gap-4">
                <div className="w-6 h-6 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin"></div>
                <p className="text-blue-300 font-medium">AI is analyzing your performance...</p>
              </div>
            </div>
          )}

          {assessment && !isGeneratingAssessment && (
            <div className="mb-10 space-y-6">
              {/* AI Summary */}
              <div className="p-8 bg-gradient-to-br from-blue-900/20 to-purple-900/20 rounded-2xl border border-blue-500/30">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-white mb-2">AI Performance Insights</h3>
                    <p className="text-slate-300 leading-relaxed">{assessment.summary}</p>
                  </div>
                </div>
              </div>

              {/* Strengths & Growth Areas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Strengths */}
                {assessment.strengths.length > 0 && (
                  <div className="p-6 bg-green-900/10 rounded-2xl border border-green-500/30">
                    <div className="flex items-center gap-2 mb-4">
                      <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
                      </svg>
                      <h4 className="font-bold text-green-300">Strengths</h4>
                    </div>
                    <ul className="space-y-2">
                      {assessment.strengths.map((strength, idx) => (
                        <li key={idx} className="text-sm text-slate-300 flex items-start gap-2">
                          <span className="text-green-400 mt-1">•</span>
                          <span>{strength}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Areas for Growth */}
                {assessment.areasForGrowth.length > 0 && (
                  <div className="p-6 bg-amber-900/10 rounded-2xl border border-amber-500/30">
                    <div className="flex items-center gap-2 mb-4">
                      <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"></path>
                        <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"></path>
                      </svg>
                      <h4 className="font-bold text-amber-300">Areas to Explore</h4>
                    </div>
                    <ul className="space-y-2">
                      {assessment.areasForGrowth.map((area, idx) => (
                        <li key={idx} className="text-sm text-slate-300 flex items-start gap-2">
                          <span className="text-amber-400 mt-1">•</span>
                          <span>{area}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Recommended Topics */}
              {assessment.recommendedTopics.length > 0 && (
                <div>
                  <div className="flex items-center gap-4 mb-6">
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent to-slate-700"></div>
                    <h4 className="text-lg font-bold text-white">Recommended Learning Paths</h4>
                    <div className="h-px flex-1 bg-gradient-to-l from-transparent to-slate-700"></div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {assessment.recommendedTopics.map((rec, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleExploreTopicFromAssessment(rec.topic)}
                        className="group p-6 bg-gradient-to-br from-slate-800/50 to-slate-900/50 hover:from-blue-900/30 hover:to-purple-900/30 rounded-2xl border border-slate-700 hover:border-blue-500/50 transition-all duration-300 text-left hover:scale-105 active:scale-95"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <span className="text-xs font-bold uppercase tracking-wider px-2 py-1 rounded bg-white/5 text-slate-400 group-hover:bg-blue-500/20 group-hover:text-blue-300 transition-colors">
                            {rec.subject}
                          </span>
                          <svg className="w-5 h-5 text-slate-600 group-hover:text-blue-400 transition-all group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
                          </svg>
                        </div>
                        <h5 className="text-lg font-bold text-white mb-2 group-hover:text-blue-200 transition-colors">
                          {rec.topic}
                        </h5>
                        <p className="text-sm text-slate-400 leading-relaxed">
                          {rec.reason}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Next Steps Section */}
          <div className="space-y-6 pt-6">
            <div className="flex items-center gap-4">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent to-slate-700"></div>
              <span className="text-slate-400 text-sm font-mono uppercase tracking-widest">What's Next?</span>
              <div className="h-px flex-1 bg-gradient-to-l from-transparent to-slate-700"></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {/* More Practice Option */}
              <div className="group relative p-8 bg-gradient-to-br from-green-900/20 to-emerald-900/20 rounded-2xl border border-green-500/30 hover:border-green-400/50 transition-all duration-300 hover:scale-105">
                <div className="mb-4">
                  <div className="w-16 h-16 bg-green-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path>
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">Keep Practicing</h3>
                  <p className="text-slate-300 text-sm leading-relaxed mb-6">
                    Jump right into more practice problems on {subject?.replace('-', ' ')}. No quests, just questions.
                  </p>
                </div>
                <button
                  onClick={handleMorePractice}
                  className="w-full px-6 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-green-500/30 transition-all hover:scale-105 active:scale-95"
                >
                  <span className="flex items-center justify-center gap-2">
                    More Practice
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
                    </svg>
                  </span>
                </button>
              </div>

              {/* Learn More Option */}
              <div className="group relative p-8 bg-gradient-to-br from-blue-900/20 to-purple-900/20 rounded-2xl border border-blue-500/30 hover:border-blue-400/50 transition-all duration-300 hover:scale-105">
                <div className="mb-4">
                  <div className="w-16 h-16 bg-blue-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">Learn & Explore</h3>
                  <p className="text-slate-300 text-sm leading-relaxed mb-6">
                    Dive into an interactive learning exhibit about {subject?.replace('-', ' ')} with visual guides and deep dives.
                  </p>
                </div>
                <button
                  onClick={handleLearnMore}
                  disabled={!onLearnMore}
                  className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-blue-500/30 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  <span className="flex items-center justify-center gap-2">
                    Learn More
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
                    </svg>
                  </span>
                </button>
              </div>
            </div>

            {/* Secondary Actions */}
            <div className="flex gap-4 justify-center pt-4">
              <button
                onClick={handleRestart}
                className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-full font-medium transition-all hover:scale-105 active:scale-95"
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                  </svg>
                  Start Over
                </span>
              </button>
              <button
                onClick={onBack}
                className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-full font-medium transition-all hover:scale-105 active:scale-95"
              >
                Back to Home
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PracticeMode;
