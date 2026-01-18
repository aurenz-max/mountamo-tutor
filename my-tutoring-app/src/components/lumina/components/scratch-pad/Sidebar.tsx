'use client';

import React, { useEffect, useRef } from 'react';
import { AIAnalysisResult } from './types';

interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
  analysis: AIAnalysisResult | null;
  isLoading: boolean;
  isLiveMode: boolean;
  progressMessage?: string;
}

// Icons
const BrainIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
    <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
  </svg>
);

const BookIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
);

const CalculatorIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="2" width="16" height="20" rx="2" />
    <line x1="8" y1="6" x2="16" y2="6" />
    <line x1="8" y1="10" x2="8" y2="10.01" />
    <line x1="12" y1="10" x2="12" y2="10.01" />
    <line x1="16" y1="10" x2="16" y2="10.01" />
    <line x1="8" y1="14" x2="8" y2="14.01" />
    <line x1="12" y1="14" x2="12" y2="14.01" />
    <line x1="16" y1="14" x2="16" y2="14.01" />
    <line x1="8" y1="18" x2="8" y2="18.01" />
    <line x1="12" y1="18" x2="12" y2="18.01" />
    <line x1="16" y1="18" x2="16" y2="18.01" />
  </svg>
);

const MessageIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const LightbulbIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18h6" />
    <path d="M10 22h4" />
    <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12,5 19,12 12,19" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9,18 15,12 9,6" />
  </svg>
);

const ChevronLeftIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15,18 9,12 15,6" />
  </svg>
);

const ZapIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13,2 3,14 12,14 11,22 21,10 12,10 13,2" />
  </svg>
);

const SparkleIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
    <path d="M5 19l.5 1.5L7 21l-1.5.5L5 23l-.5-1.5L3 21l1.5-.5L5 19z" />
    <path d="M19 11l.5 1.5L21 13l-1.5.5L19 15l-.5-1.5L17 13l1.5-.5L19 11z" />
  </svg>
);

// Simple KaTeX-style rendering for common LaTeX
const renderMath = (latex: string): string => {
  if (!latex) return '';

  // Basic LaTeX to HTML conversion for common patterns
  let html = latex
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '<span class="frac"><span class="num">$1</span><span class="denom">$2</span></span>')
    .replace(/\^(\d+)/g, '<sup>$1</sup>')
    .replace(/\^{([^}]+)}/g, '<sup>$1</sup>')
    .replace(/_(\d+)/g, '<sub>$1</sub>')
    .replace(/_{([^}]+)}/g, '<sub>$1</sub>')
    .replace(/\\sqrt\{([^}]+)\}/g, '√<span class="sqrt-content">$1</span>')
    .replace(/\\pm/g, '±')
    .replace(/\\times/g, '×')
    .replace(/\\div/g, '÷')
    .replace(/\\pi/g, 'π')
    .replace(/\\alpha/g, 'α')
    .replace(/\\beta/g, 'β')
    .replace(/\\theta/g, 'θ')
    .replace(/\\sum/g, '∑')
    .replace(/\\int/g, '∫')
    .replace(/\\infty/g, '∞')
    .replace(/\\neq/g, '≠')
    .replace(/\\leq/g, '≤')
    .replace(/\\geq/g, '≥')
    .replace(/\\cdot/g, '·')
    .replace(/\\\\/g, '<br/>');

  return html;
};

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  toggleSidebar,
  analysis,
  isLoading,
  isLiveMode,
  progressMessage
}) => {
  const contentRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    if (contentRef.current && analysis) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [analysis]);

  return (
    <div
      className={`fixed right-0 top-0 h-full transition-all duration-300 ease-in-out z-20 flex flex-col ${
        isOpen ? 'w-96 translate-x-0' : 'w-96 translate-x-full'
      }`}
    >
      {/* Glassmorphism background */}
      <div className="absolute inset-0 bg-slate-900/95 backdrop-blur-xl border-l border-slate-700/50" />

      {/* Toggle Button */}
      <button
        onClick={toggleSidebar}
        className="absolute -left-12 top-1/2 -translate-y-1/2 bg-slate-800/90 backdrop-blur-md shadow-xl border border-slate-600/50 p-3 rounded-l-xl text-slate-400 hover:text-purple-400 transition-colors"
      >
        {isOpen ? <ChevronRightIcon /> : <ChevronLeftIcon />}
      </button>

      {/* Header */}
      <div className="relative p-6 border-b border-slate-700/50">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-blue-500/5" />
        <div className="relative flex justify-between items-start">
          <h2 className="text-xl font-bold text-white flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-lg shadow-purple-500/25">
              <BrainIcon />
            </div>
            <span>AI Tutor</span>
          </h2>
          {isLiveMode && (
            <span className="flex items-center gap-1.5 text-xs font-bold text-green-400 bg-green-500/10 px-2.5 py-1.5 rounded-full border border-green-500/20">
              <ZapIcon />
              LIVE
            </span>
          )}
        </div>
        <p className="text-sm text-slate-400 mt-2 ml-14">Real-time analysis & feedback</p>
      </div>

      {/* Content */}
      <div ref={contentRef} className="relative flex-1 overflow-y-auto p-6 space-y-6">
        {/* Empty State */}
        {!analysis && !isLoading && (
          <div className="text-center text-slate-400 mt-16">
            <div className="w-20 h-20 bg-slate-800/50 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-slate-700/50">
              <SparkleIcon />
            </div>
            <p className="text-lg font-medium text-slate-300 mb-2">Ready to help!</p>
            <p className="text-sm text-slate-500 leading-relaxed max-w-xs mx-auto">
              {isLiveMode
                ? "AI is watching your work and will provide feedback automatically..."
                : "Draw or write on the scratch pad, then click 'Check Work' for feedback."}
            </p>
          </div>
        )}

        {/* Loading State */}
        {isLoading && !analysis && (
          <div className="text-center mt-16">
            {/* Animated progress indicator */}
            <div className="w-20 h-20 bg-gradient-to-br from-purple-500/20 to-indigo-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-purple-500/30 relative">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-purple-500/10 to-indigo-500/10 animate-pulse" />
              <div className="w-8 h-8 border-3 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
            </div>
            <p className="text-lg font-medium text-slate-300 mb-2">
              {progressMessage || 'Analyzing...'}
            </p>
            <div className="flex justify-center gap-1 mt-4">
              <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}

        {/* Analysis Results */}
        {analysis && (
          <div className={`space-y-6 transition-opacity duration-500 ${isLoading ? 'opacity-50' : 'opacity-100'}`}>
            {/* Summary Section */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <BookIcon />
                Summary
              </h3>
              <div className="p-4 bg-slate-800/50 rounded-xl text-slate-200 text-sm leading-relaxed border border-slate-700/50">
                {analysis.summary}
              </div>
            </div>

            {/* LaTeX / Math Section */}
            {analysis.latex && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <CalculatorIcon />
                  Recognized Math
                </h3>
                <div className="p-4 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-xl text-indigo-200 text-lg overflow-x-auto border border-indigo-500/20 flex justify-center items-center min-h-[60px]">
                  <div
                    className="math-display"
                    dangerouslySetInnerHTML={{ __html: renderMath(analysis.latex) }}
                  />
                </div>
              </div>
            )}

            {/* Feedback Section */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <MessageIcon />
                Feedback
              </h3>
              <div
                className={`p-4 rounded-xl text-sm leading-relaxed border ${
                  analysis.feedback.toLowerCase().includes('correct') ||
                  analysis.feedback.toLowerCase().includes('great') ||
                  analysis.feedback.toLowerCase().includes('excellent')
                    ? 'bg-green-500/10 text-green-200 border-green-500/20'
                    : 'bg-purple-500/10 text-purple-200 border-purple-500/20'
                }`}
              >
                {analysis.feedback}
              </div>
            </div>

            {/* Encouragement */}
            {analysis.encouragement && (
              <div className="p-4 bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-xl border border-amber-500/20">
                <p className="text-amber-200 text-sm font-medium flex items-start gap-2">
                  <span className="text-lg">✨</span>
                  {analysis.encouragement}
                </p>
              </div>
            )}

            {/* Next Steps Section */}
            {analysis.nextSteps && analysis.nextSteps.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <LightbulbIcon />
                  Next Steps
                </h3>
                <div className="space-y-2">
                  {analysis.nextSteps.map((step, index) => (
                    <div
                      key={index}
                      className="p-3 bg-slate-800/50 border border-slate-700/50 rounded-xl flex gap-3 items-start group hover:border-blue-500/30 hover:bg-slate-800/80 transition-all cursor-default"
                    >
                      <div className="bg-blue-500/20 text-blue-400 p-1.5 rounded-lg shrink-0 mt-0.5">
                        <ArrowRightIcon />
                      </div>
                      <span className="text-slate-300 text-sm leading-relaxed">{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="relative p-4 border-t border-slate-700/50 text-xs text-slate-500 text-center">
        <span className="flex items-center justify-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          Powered by Gemini AI
        </span>
      </div>

      {/* CSS for math rendering */}
      <style jsx global>{`
        .math-display .frac {
          display: inline-flex;
          flex-direction: column;
          align-items: center;
          vertical-align: middle;
          margin: 0 0.2em;
        }
        .math-display .frac .num {
          border-bottom: 1px solid currentColor;
          padding: 0 0.3em 0.1em;
        }
        .math-display .frac .denom {
          padding: 0.1em 0.3em 0;
        }
        .math-display .sqrt-content {
          border-top: 1px solid currentColor;
          padding: 0 0.2em;
        }
        .math-display sup {
          font-size: 0.7em;
          vertical-align: super;
        }
        .math-display sub {
          font-size: 0.7em;
          vertical-align: sub;
        }
      `}</style>
    </div>
  );
};
