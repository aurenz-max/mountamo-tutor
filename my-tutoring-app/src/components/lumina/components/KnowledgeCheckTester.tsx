'use client';

import React, { useState } from 'react';
import { KnowledgeCheck } from '../primitives/KnowledgeCheck';
import { ProblemData, ProblemType, InsetType } from '../types';
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

const PROBLEM_TYPES: { value: ProblemType | ''; label: string }[] = [
  { value: '', label: 'Orchestrated (AI chooses)' },
  { value: 'multiple_choice', label: 'Multiple Choice' },
  { value: 'true_false', label: 'True / False' },
  { value: 'fill_in_blanks', label: 'Fill in Blanks' },
  { value: 'categorization_activity', label: 'Categorization' },
  { value: 'sequencing_activity', label: 'Sequencing' },
  { value: 'matching_activity', label: 'Matching' },
];

const INSET_TYPES: { value: InsetType | ''; label: string; desc: string }[] = [
  { value: '', label: 'Orchestrated', desc: 'AI chooses best inset' },
  { value: 'katex', label: 'KaTeX', desc: 'Math equations' },
  { value: 'data-table', label: 'Table', desc: 'Data tables' },
  { value: 'passage', label: 'Passage', desc: 'Text excerpts' },
  { value: 'chart', label: 'Chart', desc: 'Bar/line/pie' },
  { value: 'code', label: 'Code', desc: 'Code blocks' },
  { value: 'number-line', label: 'Number Line', desc: 'Math visual' },
  { value: 'definition-box', label: 'Definition', desc: 'Vocabulary' },
];


interface KnowledgeCheckTesterProps {
  onBack: () => void;
}

export const KnowledgeCheckTester: React.FC<KnowledgeCheckTesterProps> = ({ onBack }) => {
  const [problems, setProblems] = useState<ProblemData[]>([]);

  // Generation controls — only topic, grade, count, bloom's tier are primary.
  // Problem type and inset are optional overrides (orchestrator decides by default).
  const [topic, setTopic] = useState('');
  const [context, setContext] = useState('');
  const [gradeLevel, setGradeLevel] = useState<string>('elementary');
  const [problemCount, setProblemCount] = useState<number>(3);
  const [bloomsTier, setBloomsTier] = useState<BloomsTier | ''>('');

  // Optional overrides — empty means orchestrator decides
  const [selectedProblemType, setSelectedProblemType] = useState<ProblemType | ''>('');
  const [insetType, setInsetType] = useState<InsetType | ''>('');
  const [showOverrides, setShowOverrides] = useState(false);

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generationKey, setGenerationKey] = useState(0);


  const isOrchestrated = !selectedProblemType;

  const handleGenerate = async (append = false) => {
    if (!topic.trim()) {
      setError('Please enter a topic');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const generatedProblems = await generateKnowledgeCheckProblems(
        topic,
        gradeLevel,
        problemCount,
        {
          problemType: selectedProblemType || undefined,
          bloomsTier: bloomsTier || undefined,
          insetType: insetType || undefined,
        }
      );

      const typedProblems = generatedProblems.map(p => ({
        ...p,
        gradeLevel: gradeLevel,
      }));

      if (append) {
        setProblems(prev => [...prev, ...typedProblems]);
      } else {
        setProblems(typedProblems);
        setGenerationKey(k => k + 1);
      }
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
        <h2 className="text-4xl font-bold text-white mb-2">Knowledge Check Tester</h2>
        <p className="text-slate-400">
          The orchestrator plans the optimal problem mix, insets, and difficulty progression
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-8 max-w-7xl mx-auto">
        {/* Left Column: Generation Controls */}
        <div className="bg-slate-800/50 rounded-2xl p-5 border border-slate-700">
          <h3 className="text-xl font-bold text-white mb-4">AI Problem Generator</h3>

          {/* Topic Input */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Topic</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
              placeholder="e.g., Photosynthesis, Fractions, The Solar System"
            />
          </div>

          {/* Context (Optional) */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Context (Optional)</label>
            <input
              type="text"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
              placeholder="e.g., Unit on plant biology, Chapter 5 homework"
            />
          </div>

          {/* Common Fields Grid */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Grade Level</label>
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
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Count</label>
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

          {/* Bloom's Taxonomy Tier */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Bloom&apos;s Cognitive Tier
              <span className="ml-1 text-[10px] text-slate-500 font-normal">(IRT adaptive difficulty)</span>
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

          {/* Optional Overrides Toggle */}
          <div className="mb-4">
            <button
              onClick={() => setShowOverrides(!showOverrides)}
              className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-300 transition-colors"
            >
              <svg
                className={`w-4 h-4 transition-transform ${showOverrides ? 'rotate-90' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
              Override orchestrator choices
              <span className="text-xs text-slate-600">(optional)</span>
            </button>

            {showOverrides && (
              <div className="mt-3 p-4 bg-slate-900/50 rounded-lg border border-slate-700/50 space-y-4">
                {/* Problem Type Override */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Problem Type</label>
                  <select
                    value={selectedProblemType}
                    onChange={(e) => setSelectedProblemType(e.target.value as ProblemType | '')}
                    className="w-full px-3 py-1.5 bg-slate-800 text-white text-sm rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
                  >
                    {PROBLEM_TYPES.map(pt => (
                      <option key={pt.value || 'orchestrated'} value={pt.value}>
                        {pt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Inset Type Override */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Inset Content</label>
                  <div className="grid grid-cols-4 gap-1">
                    {INSET_TYPES.map((opt) => (
                      <button
                        key={opt.value || 'orchestrated'}
                        onClick={() => setInsetType(opt.value as InsetType | '')}
                        className={`px-2 py-1.5 rounded text-[11px] font-medium transition-all border ${
                          insetType === opt.value
                            ? 'bg-purple-600/30 border-purple-500/60 text-purple-300'
                            : 'bg-slate-800/50 border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-300'
                        }`}
                        title={opt.desc}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-4 p-3 bg-red-900/20 border border-red-500/50 rounded-lg">
              <p className="text-red-400 text-xs">{error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => handleGenerate(false)}
              disabled={isGenerating}
              className="flex-1 px-3 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:opacity-50 text-white rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  {isOrchestrated ? 'Orchestrating...' : 'Generating...'}
                </>
              ) : (
                isOrchestrated ? 'Orchestrate & Preview' : 'Generate & Preview'
              )}
            </button>
            <button
              onClick={() => handleGenerate(true)}
              disabled={isGenerating}
              className="flex-1 px-3 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:opacity-50 text-white rounded-lg font-semibold text-sm transition-all"
            >
              Add to List
            </button>
            {problems.length > 0 && (
              <button
                onClick={handleClearAll}
                disabled={isGenerating}
                className="px-3 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg font-semibold text-sm transition-all"
              >
                Clear
              </button>
            )}
          </div>

          {/* Quick Examples */}
          <div className="mt-4 pt-4 border-t border-slate-700">
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
            {problems.length > 0 && isOrchestrated && (
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-purple-600/20 text-purple-400 border border-purple-500/30">
                orchestrated
              </span>
            )}
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

          {/* Problem type summary when orchestrated */}
          {problems.length > 0 && isOrchestrated && (
            <div className="mb-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
              <p className="text-xs text-slate-400 mb-1.5">Orchestrator selected:</p>
              <div className="flex flex-wrap gap-1.5">
                {problems.map((p, i) => (
                  <span key={i} className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-700/50 text-slate-300 border border-slate-600/50">
                    {(p as any).type?.replace(/_/g, ' ')}
                    {(p as any).inset && ` + ${(p as any).inset.insetType}`}
                  </span>
                ))}
              </div>
            </div>
          )}

          {problems.length === 0 ? (
            <div className="flex items-center justify-center h-96 text-slate-500">
              <div className="text-center max-w-sm">
                <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
                </svg>
                <p className="text-lg mb-2">No problems generated yet</p>
                <p className="text-sm text-slate-600">Enter a topic and click &quot;Orchestrate &amp; Preview&quot;</p>
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
              <h4 className="text-blue-300 font-semibold mb-2">How It Works</h4>
              <ul className="text-slate-300 text-sm space-y-1">
                <li>The <strong>orchestrator</strong> plans the optimal problem mix, inset types, and difficulty progression for your topic and grade level.</li>
                <li>You only need to provide a <strong>topic</strong>, <strong>grade</strong>, and <strong>count</strong> — the AI decides the rest.</li>
                <li>Use <strong>Bloom&apos;s tiers</strong> to constrain cognitive level (recall, apply, analyze, evaluate).</li>
                <li>Expand <strong>&quot;Override orchestrator choices&quot;</strong> to force a specific problem type or inset.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
