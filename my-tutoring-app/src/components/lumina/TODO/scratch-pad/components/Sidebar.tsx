import React from 'react';
import { BrainCircuit, BookOpen, MessageSquareQuote, Calculator, ChevronRight, ChevronLeft, Zap, Lightbulb, ArrowRight } from 'lucide-react';
import katex from 'katex';
import { AIAnalysisResult } from '../types';

interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
  analysis: AIAnalysisResult | null;
  isLoading: boolean;
  isLiveMode: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, toggleSidebar, analysis, isLoading, isLiveMode }) => {
  const renderMath = (latex: string) => {
    try {
      return katex.renderToString(latex, {
        throwOnError: false,
        displayMode: true,
      });
    } catch (e) {
      return latex;
    }
  };

  return (
    <div 
      className={`fixed right-0 top-0 h-full bg-white shadow-2xl transition-all duration-300 ease-in-out z-20 flex flex-col border-l border-slate-200
        ${isOpen ? 'w-80 translate-x-0' : 'w-80 translate-x-full'}`}
    >
      {/* Toggle Button */}
      <button
        onClick={toggleSidebar}
        className="absolute -left-10 top-1/2 -translate-y-1/2 bg-white shadow-md border border-slate-200 p-2 rounded-l-xl text-slate-600 hover:text-purple-600"
      >
        {isOpen ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
      </button>

      {/* Header */}
      <div className="p-6 border-b border-slate-100 bg-gradient-to-br from-purple-50 to-white">
        <div className="flex justify-between items-start">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <BrainCircuit className="text-purple-600" />
            AI Tutor
          </h2>
          {isLiveMode && (
            <span className="flex items-center gap-1 text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full border border-green-100">
              <Zap size={10} className="fill-current" />
              LIVE
            </span>
          )}
        </div>
        <p className="text-sm text-slate-500 mt-1">Real-time analysis & feedback</p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 relative">
        {!analysis && !isLoading && (
          <div className="text-center text-slate-400 mt-10">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageSquareQuote size={32} />
            </div>
            <p>Write or draw on the whiteboard. {isLiveMode ? "AI is watching..." : "Click 'Check' for feedback."}</p>
          </div>
        )}

        {isLoading && !analysis && (
          <div className="space-y-4 animate-pulse">
            <div className="h-4 bg-slate-200 rounded w-3/4"></div>
            <div className="h-20 bg-slate-100 rounded-lg"></div>
            <div className="h-4 bg-slate-200 rounded w-1/2"></div>
            <div className="h-32 bg-slate-100 rounded-lg"></div>
          </div>
        )}

        {analysis && (
          <div className={`transition-opacity duration-500 ${isLoading ? 'opacity-50' : 'opacity-100'}`}>
            {/* Summary Section */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <BookOpen size={14} />
                Summary
              </h3>
              <div className="p-4 bg-slate-50 rounded-lg text-slate-700 text-sm leading-relaxed border border-slate-100">
                {analysis.summary}
              </div>
            </div>

            {/* LaTeX / Math Section */}
            {analysis.latex && (
              <div className="space-y-2 mt-6">
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <Calculator size={14} />
                  Recognized Math
                </h3>
                <div 
                  className="p-4 bg-indigo-50 rounded-lg text-indigo-900 text-sm overflow-x-auto border border-indigo-100 flex justify-center items-center min-h-[60px]"
                  dangerouslySetInnerHTML={{ __html: renderMath(analysis.latex) }}
                />
              </div>
            )}

            {/* Feedback Section */}
            <div className="space-y-2 mt-6">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <MessageSquareQuote size={14} />
                Feedback
              </h3>
              <div className={`p-4 rounded-lg text-sm leading-relaxed border ${
                analysis.feedback.toLowerCase().includes('correct') 
                  ? 'bg-green-50 text-green-800 border-green-100' 
                  : 'bg-purple-50 text-purple-900 border-purple-100'
              }`}>
                {analysis.feedback}
              </div>
            </div>

            {/* Next Steps Section */}
            {analysis.nextSteps && analysis.nextSteps.length > 0 && (
              <div className="space-y-3 mt-6">
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <Lightbulb size={14} />
                  Suggested Next Steps
                </h3>
                <div className="space-y-2">
                  {analysis.nextSteps.map((step, index) => (
                    <div key={index} className="p-3 bg-white border border-slate-200 rounded-lg shadow-sm flex gap-3 items-start group hover:border-blue-300 transition-colors">
                      <div className="bg-blue-50 text-blue-600 p-1.5 rounded mt-0.5 shrink-0">
                         <ArrowRight size={14} />
                      </div>
                      <span className="text-slate-700 text-sm leading-relaxed">{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Footer */}
      <div className="p-4 border-t border-slate-100 text-xs text-slate-400 text-center">
        Powered by Gemini 1.5 Flash Lite
      </div>
    </div>
  );
};