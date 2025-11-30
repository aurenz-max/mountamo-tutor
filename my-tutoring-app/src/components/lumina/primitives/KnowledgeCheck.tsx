'use client';

import React from 'react';
import { KnowledgeCheckData, ProblemData } from '../types';
import { ProblemRenderer } from '../config/problemTypeRegistry';

/**
 * KnowledgeCheck Component
 *
 * Supports two modes:
 * 1. Legacy mode: Single multiple-choice question (backwards compatible)
 * 2. Problem Registry mode: Single or multiple problems of various types
 *
 * The component automatically detects which mode to use based on the data structure.
 */

interface KnowledgeCheckProps {
  data: KnowledgeCheckData | { problems: ProblemData[] };
}

// Type guard to check if using legacy format
function isLegacyKnowledgeCheck(data: any): data is KnowledgeCheckData {
  return 'question' in data && 'options' in data && 'correctAnswerId' in data;
}

// Type guard to check if using problem registry format
function isProblemRegistryFormat(data: any): data is { problems: ProblemData[] } {
  return 'problems' in data && Array.isArray(data.problems);
}

export const KnowledgeCheck: React.FC<KnowledgeCheckProps> = ({ data }) => {
  // Legacy format - convert to problem registry format
  if (isLegacyKnowledgeCheck(data)) {
    const legacyProblem: ProblemData = {
      type: 'multiple_choice',
      id: 'legacy_mc_1',
      difficulty: 'medium',
      gradeLevel: 'elementary',
      question: data.question,
      visual: data.visual,
      options: data.options,
      correctOptionId: data.correctAnswerId,
      rationale: data.explanation,
      teachingNote: '',
      successCriteria: []
    };

    return (
      <div className="w-full max-w-4xl mx-auto my-12 animate-fade-in-up">
        <div className="glass-panel rounded-3xl overflow-hidden border border-blue-500/20 relative">
          {/* Header */}
          <div className="bg-slate-900/80 p-4 flex items-center justify-between border-b border-white/5">
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-slate-600 animate-pulse"></span>
                <span className="w-2 h-2 rounded-full bg-slate-600"></span>
              </div>
              <span className="text-xs font-mono uppercase tracking-widest text-blue-400">
                Concept Verification Terminal
              </span>
            </div>
          </div>

          <div className="p-8 md:p-12">
            <ProblemRenderer problemData={legacyProblem} />
          </div>
        </div>
      </div>
    );
  }

  // Problem Registry format - render multiple problems
  if (isProblemRegistryFormat(data)) {
    const problemCount = data.problems.length;

    return (
      <div className="w-full max-w-4xl mx-auto my-12 animate-fade-in-up">
        <div className="glass-panel rounded-3xl overflow-hidden border border-blue-500/20 relative">
          {/* Header */}
          <div className="bg-slate-900/80 p-4 flex items-center justify-between border-b border-white/5">
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-slate-600 animate-pulse"></span>
                <span className="w-2 h-2 rounded-full bg-slate-600"></span>
              </div>
              <span className="text-xs font-mono uppercase tracking-widest text-blue-400">
                Knowledge Assessment Terminal
              </span>
            </div>
            <div className="text-xs text-slate-500 font-mono">
              {problemCount} {problemCount === 1 ? 'PROBLEM' : 'PROBLEMS'}
            </div>
          </div>

          <div className="p-8 md:p-12">
            {/* Problem Collection */}
            <div className="space-y-16">
              {data.problems.map((problem, index) => (
                <div key={problem.id} className="relative">
                  {/* Problem Number Badge */}
                  {problemCount > 1 && (
                    <div className="absolute -left-6 md:-left-8 top-0 flex items-center justify-center w-10 h-10 rounded-full bg-blue-500/20 border border-blue-500/40 text-blue-400 font-mono text-sm">
                      {index + 1}
                    </div>
                  )}

                  {/* Problem Content */}
                  <div className={problemCount > 1 ? 'ml-4 md:ml-6' : ''}>
                    <ProblemRenderer problemData={problem} />
                  </div>

                  {/* Divider between problems */}
                  {index < problemCount - 1 && (
                    <div className="mt-16 mb-0 h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Fallback for unknown format
  return (
    <div className="w-full max-w-4xl mx-auto my-12">
      <div className="p-4 bg-red-900/20 border border-red-500/50 rounded-lg text-red-400">
        Invalid KnowledgeCheck data format
      </div>
    </div>
  );
};
