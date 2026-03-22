'use client';

import React, { useState } from 'react';
import { KnowledgeCheck } from '../primitives/KnowledgeCheck';
import { ProblemData, ProblemType, ProblemDifficulty } from '../types';
import { PROBLEM_TYPE_REGISTRY, getAllProblemTypes } from '../config/problemTypeRegistry';
import { generateKnowledgeCheckProblems } from '../service/geminiClient-api';
import { LuminaAIProvider } from '@/contexts/LuminaAIContext';

// ---------------------------------------------------------------------------
// Bloom's Taxonomy Tiers (IRT §6.8)
// ---------------------------------------------------------------------------

type BloomsTier = 'recall' | 'apply' | 'analyze' | 'evaluate';

const BLOOMS_TIERS: { value: BloomsTier | ''; label: string; beta: number | null; a: number | null; c: number | null; description: string }[] = [
  { value: '',         label: 'Auto (no tier)',   beta: null, a: null, c: null, description: 'Generic difficulty — no Bloom\'s constraint applied.' },
  { value: 'recall',   label: 'Recall (Tier 1)',  beta: 1.5,  a: 1.6, c: 0.25, description: '"What is X?" — fact retrieval, obvious distractors, 4 options.' },
  { value: 'apply',    label: 'Apply (Tier 2)',   beta: 3.0,  a: 1.4, c: 0.25, description: '"Use X to solve Y" — standard application, procedural-error distractors, 4 options.' },
  { value: 'analyze',  label: 'Analyze (Tier 3)', beta: 4.5,  a: 1.6, c: 0.20, description: '"Why does X happen?" — multi-step reasoning, highly plausible distractors, 4-5 options.' },
  { value: 'evaluate', label: 'Evaluate (Tier 4)', beta: 6.0, a: 1.8, c: 0.15, description: '"Which approach is best?" — expert reasoning, defensible-but-inferior distractors, 5 options.' },
];

interface KnowledgeCheckTesterProps {
  onBack: () => void;
}

export const KnowledgeCheckTester: React.FC<KnowledgeCheckTesterProps> = ({ onBack }) => {
  const [problems, setProblems] = useState<ProblemData[]>([]);

  // Generation controls
  const [topic, setTopic] = useState('');
  const [context, setContext] = useState('');
  const [selectedProblemType, setSelectedProblemType] = useState<ProblemType>('multiple_choice');
  const [difficulty, setDifficulty] = useState<ProblemDifficulty>('medium');
  const [gradeLevel, setGradeLevel] = useState<string>('elementary');
  const [problemCount, setProblemCount] = useState<number>(3);
  const [bloomsTier, setBloomsTier] = useState<BloomsTier | ''>('');

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generationKey, setGenerationKey] = useState(0);

  // Use universal generateKnowledgeCheckProblems for all problem types
  const generateProblemsForType = async (
    problemType: ProblemType,
    topic: string,
    gradeLevel: string,
    count: number,
    bloomsTier?: BloomsTier
  ): Promise<any[]> => {
    return generateKnowledgeCheckProblems(topic, gradeLevel, problemType, count, bloomsTier);
  };

  // Map problem types to their generator functions
  const generatorMap: Partial<Record<ProblemType, (topic: string, gradeLevel: string, count: number, context?: string, bloomsTier?: BloomsTier) => Promise<any[]>>> = {
    'multiple_choice': (topic, gradeLevel, count, _ctx, bt) => generateProblemsForType('multiple_choice', topic, gradeLevel, count, bt),
    'true_false': (topic, gradeLevel, count, _ctx, bt) => generateProblemsForType('true_false', topic, gradeLevel, count, bt),
    'fill_in_blanks': (topic, gradeLevel, count, _ctx, bt) => generateProblemsForType('fill_in_blanks', topic, gradeLevel, count, bt),
    'categorization_activity': (topic, gradeLevel, count, _ctx, bt) => generateProblemsForType('categorization_activity', topic, gradeLevel, count, bt),
    'sequencing_activity': (topic, gradeLevel, count, _ctx, bt) => generateProblemsForType('sequencing_activity', topic, gradeLevel, count, bt),
    'matching_activity': (topic, gradeLevel, count, _ctx, bt) => generateProblemsForType('matching_activity', topic, gradeLevel, count, bt),
  };

  const handleGenerate = async () => {
    if (!topic.trim()) {
      setError('Please enter a topic');
      return;
    }

    const generator = generatorMap[selectedProblemType];
    if (!generator) {
      setError(`Generator for ${selectedProblemType} is not yet available. Try Multiple Choice, True/False, Categorization, or Sequencing.`);
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const generatedProblems = await generator(
        topic,
        gradeLevel,
        problemCount,
        context || undefined,
        bloomsTier || undefined
      );

      // Add type discriminator if not present
      const typedProblems = generatedProblems.map(p => ({
        ...p,
        type: selectedProblemType,
        gradeLevel: gradeLevel
      }));

      setProblems(typedProblems);
      setGenerationKey(k => k + 1);
    } catch (err) {
      console.error('Generation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate problems');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePreview = async () => {
    await handleGenerate();
  };

  const handleAddToList = async () => {
    if (!topic.trim()) {
      setError('Please enter a topic');
      return;
    }

    const generator = generatorMap[selectedProblemType];
    if (!generator) {
      setError(`Generator for ${selectedProblemType} is not yet available.`);
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const generatedProblems = await generator(
        topic,
        gradeLevel,
        problemCount,
        context || undefined,
        bloomsTier || undefined
      );

      // Add type discriminator if not present
      const typedProblems = generatedProblems.map(p => ({
        ...p,
        type: selectedProblemType,
        gradeLevel: gradeLevel
      }));

      setProblems([...problems, ...typedProblems]);
    } catch (err) {
      console.error('Generation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate problems');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClearAll = () => {
    setProblems([]);
    setError(null);
  };

  const config = PROBLEM_TYPE_REGISTRY[selectedProblemType];
  const isGeneratorAvailable = !!generatorMap[selectedProblemType];
  const selectedTierInfo = BLOOMS_TIERS.find(t => t.value === bloomsTier) || BLOOMS_TIERS[0];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="mb-8 text-center">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-6 py-3 bg-slate-800/50 hover:bg-slate-700/50 text-white rounded-full border border-slate-600 transition-all"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
          </svg>
          Back to Home
        </button>
      </div>

      {/* Title */}
      <div className="text-center mb-8">
        <h2 className="text-4xl font-bold text-white mb-2">Knowledge Check Problem Tester</h2>
        <p className="text-slate-400">Generate and test problem types using AI</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-7xl mx-auto">
        {/* Left Column: Generation Controls */}
        <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
          <h3 className="text-2xl font-bold text-white mb-6">AI Problem Generator</h3>

          {/* Topic Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-300 mb-2">Topic</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
              placeholder="e.g., Photosynthesis, Fractions, The Solar System"
            />
          </div>

          {/* Context (Optional) */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-300 mb-2">Context (Optional)</label>
            <input
              type="text"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
              placeholder="e.g., Unit on plant biology, Chapter 5 homework"
            />
          </div>

          {/* Problem Type Selector */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-300 mb-2">Problem Type</label>
            <select
              value={selectedProblemType}
              onChange={(e) => setSelectedProblemType(e.target.value as ProblemType)}
              className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
            >
              {getAllProblemTypes().map(type => {
                const hasGenerator = !!generatorMap[type];
                return (
                  <option key={type} value={type}>
                    {type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                    {!hasGenerator && ' (Coming Soon)'}
                  </option>
                );
              })}
            </select>
            {config && (
              <div className="mt-2 p-3 bg-slate-900/50 rounded-lg">
                <p className="text-xs text-slate-400">{config.description}</p>
                <p className="text-xs text-blue-400 mt-1">
                  <span className="font-medium">Best for:</span> {config.bestFor}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  <span className="font-medium">Complexity:</span> {config.complexity}
                </p>
                {!isGeneratorAvailable && (
                  <p className="text-xs text-amber-500 mt-2 font-medium">
                    ⚠️ AI generator not yet implemented for this type
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Bloom's Taxonomy Tier (IRT §6.8) */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Bloom&apos;s Cognitive Tier
              <span className="ml-2 text-xs text-slate-500 font-normal">(IRT adaptive difficulty)</span>
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {BLOOMS_TIERS.map((tier) => (
                <button
                  key={tier.value || 'auto'}
                  onClick={() => setBloomsTier(tier.value as BloomsTier | '')}
                  className={`px-2 py-2 rounded-lg text-xs font-medium transition-all border ${
                    bloomsTier === tier.value
                      ? tier.value === 'recall'
                        ? 'bg-green-600/30 border-green-500/60 text-green-300'
                        : tier.value === 'apply'
                        ? 'bg-blue-600/30 border-blue-500/60 text-blue-300'
                        : tier.value === 'analyze'
                        ? 'bg-amber-600/30 border-amber-500/60 text-amber-300'
                        : tier.value === 'evaluate'
                        ? 'bg-red-600/30 border-red-500/60 text-red-300'
                        : 'bg-slate-600/30 border-slate-500/60 text-slate-300'
                      : 'bg-slate-800/50 border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-300'
                  }`}
                >
                  {tier.label}
                </button>
              ))}
            </div>
            <div className="mt-2 p-3 bg-slate-900/50 rounded-lg">
              <p className="text-xs text-slate-400">{selectedTierInfo.description}</p>
              {selectedTierInfo.beta !== null && (
                <div className="flex gap-4 mt-1.5">
                  <span className="text-[10px] font-mono text-slate-500">
                    <span className="text-slate-400">beta</span>={selectedTierInfo.beta}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    <span className="text-slate-400">a</span>={selectedTierInfo.a}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    <span className="text-slate-400">c</span>={selectedTierInfo.c}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    <span className="text-slate-400">I(peak)</span>=
                    {selectedTierInfo.value === 'recall' ? '0.396' :
                     selectedTierInfo.value === 'apply' ? '0.303' :
                     selectedTierInfo.value === 'analyze' ? '0.436' : '0.710'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Common Fields Grid */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Grade Level</label>
              <select
                value={gradeLevel}
                onChange={(e) => setGradeLevel(e.target.value)}
                className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
              >
                <option value="toddler">Toddler</option>
                <option value="preschool">Preschool</option>
                <option value="kindergarten">Kindergarten</option>
                <option value="elementary">Elementary</option>
                <option value="middle-school">Middle School</option>
                <option value="high-school">High School</option>
                <option value="undergraduate">Undergraduate</option>
                <option value="graduate">Graduate</option>
                <option value="phd">PhD</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Count</label>
              <input
                type="number"
                min="1"
                max="10"
                value={problemCount}
                onChange={(e) => setProblemCount(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-6 p-4 bg-red-900/20 border border-red-500/50 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handlePreview}
              disabled={isGenerating || !isGeneratorAvailable}
              className="flex-1 px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:opacity-50 text-white rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Generating...
                </>
              ) : (
                'Generate & Preview'
              )}
            </button>
            <button
              onClick={handleAddToList}
              disabled={isGenerating || !isGeneratorAvailable}
              className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:opacity-50 text-white rounded-lg font-semibold transition-all"
            >
              Add to List
            </button>
            {problems.length > 0 && (
              <button
                onClick={handleClearAll}
                disabled={isGenerating}
                className="px-6 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg font-semibold transition-all"
              >
                Clear
              </button>
            )}
          </div>

          {/* Quick Examples */}
          <div className="mt-6 pt-6 border-t border-slate-700">
            <p className="text-xs text-slate-500 mb-3 uppercase tracking-wider">Quick Topics</p>
            <div className="flex flex-wrap gap-2">
              {['Photosynthesis', 'Fractions', 'Solar System', 'Water Cycle', 'Grammar Rules', 'Cell Structure'].map(exampleTopic => (
                <button
                  key={exampleTopic}
                  onClick={() => setTopic(exampleTopic)}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full text-xs transition-colors"
                >
                  {exampleTopic}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Preview */}
        <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-700">
          <div className="flex items-center gap-3 mb-6">
            <h3 className="text-2xl font-bold text-white">
              Live Preview {problems.length > 0 && `(${problems.length} problem${problems.length > 1 ? 's' : ''})`}
            </h3>
            {problems.length > 0 && bloomsTier && (
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                bloomsTier === 'recall' ? 'bg-green-600/20 text-green-400 border border-green-500/30' :
                bloomsTier === 'apply' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' :
                bloomsTier === 'analyze' ? 'bg-amber-600/20 text-amber-400 border border-amber-500/30' :
                'bg-red-600/20 text-red-400 border border-red-500/30'
              }`}>
                {bloomsTier.charAt(0).toUpperCase() + bloomsTier.slice(1)}
              </span>
            )}
          </div>
          {problems.length === 0 ? (
            <div className="flex items-center justify-center h-96 text-slate-500">
              <div className="text-center max-w-sm">
                <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
                </svg>
                <p className="text-lg mb-2">No problems generated yet</p>
                <p className="text-sm text-slate-600">Enter a topic and click "Generate & Preview"</p>
              </div>
            </div>
          ) : (
            <div className="overflow-y-auto max-h-[600px]">
              <LuminaAIProvider>
                <KnowledgeCheck key={generationKey} data={{ problems }} />
              </LuminaAIProvider>
            </div>
          )}
        </div>
      </div>

      {/* Info Panel */}
      <div className="mt-8 max-w-7xl mx-auto">
        <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <svg className="w-6 h-6 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <div className="flex-1">
              <h4 className="text-blue-300 font-semibold mb-2">How to Use</h4>
              <ul className="text-slate-300 text-sm space-y-1">
                <li>• <strong>Generate & Preview:</strong> Replace current preview with newly generated problems</li>
                <li>• <strong>Add to List:</strong> Add new problems to existing collection for multi-problem testing</li>
                <li>• <strong>Bloom&apos;s Tiers:</strong> Select a cognitive tier to control question difficulty via IRT parameters (a, c, beta)</li>
                <li>• <strong>Recall:</strong> Fact retrieval, 4 options &middot; <strong>Apply:</strong> Use knowledge, 4 options &middot; <strong>Analyze:</strong> Multi-step, 4-5 options &middot; <strong>Evaluate:</strong> Expert, 5 options</li>
                <li>• <strong>Available Generators:</strong> Multiple Choice, True/False, Fill in Blanks, Categorization, Sequencing, Matching</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
