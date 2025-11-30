'use client';

import React, { useState } from 'react';
import { ShortAnswerProblemData } from '../../types';

interface ShortAnswerProblemProps {
  data: ShortAnswerProblemData;
}

export const ShortAnswerProblem: React.FC<ShortAnswerProblemProps> = ({ data }) => {
  const [userAnswer, setUserAnswer] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = () => {
    if (userAnswer.trim()) setIsSubmitted(true);
  };

  return (
    <div className="w-full">
      {/* Question */}
      <h3 className="text-2xl md:text-3xl font-bold text-white mb-8 leading-tight">
        {data.question}
      </h3>

      {/* Answer Input */}
      <div className="mb-8">
        <textarea
          value={userAnswer}
          onChange={(e) => setUserAnswer(e.target.value)}
          disabled={isSubmitted}
          rows={4}
          placeholder="Type your answer here..."
          className="w-full p-4 rounded-xl border-2 border-white/20 bg-white/5 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none transition-all resize-none disabled:opacity-60 disabled:cursor-not-allowed"
        />
      </div>

      {/* Action Area */}
      <div className="flex flex-col items-center">
        {!isSubmitted ? (
          <button
            onClick={handleSubmit}
            disabled={!userAnswer.trim()}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-bold tracking-wide transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-600/20 hover:shadow-blue-500/40 hover:-translate-y-0.5"
          >
            Submit Answer
          </button>
        ) : (
          <div className="w-full animate-fade-in space-y-6">
            {/* User's Answer */}
            <div className="bg-black/20 rounded-2xl p-6 border border-white/5">
              <div className="flex items-center gap-3 mb-3 font-bold uppercase tracking-wider text-blue-400 text-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                </svg>
                <span>Your Response</span>
              </div>
              <p className="text-slate-300 leading-relaxed font-light">
                {userAnswer}
              </p>
            </div>

            {/* Feedback */}
            <div className="bg-emerald-900/10 rounded-2xl p-6 border border-emerald-500/20">
              <div className="flex items-center gap-3 mb-3 font-bold uppercase tracking-wider text-emerald-400 text-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <span>Guidance</span>
              </div>
              <p className="text-slate-300 leading-relaxed font-light mb-3">
                {data.rationale}
              </p>
              {data.successCriteria && data.successCriteria.length > 0 && (
                <div className="mt-4 pt-4 border-t border-white/5">
                  <div className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-2">Success Criteria</div>
                  <ul className="space-y-1">
                    {data.successCriteria.map((criterion, idx) => (
                      <li key={idx} className="text-sm text-slate-400 flex items-start gap-2">
                        <span className="text-emerald-400 mt-0.5">✓</span>
                        <span>{criterion}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {data.teachingNote && (
              <div className="bg-black/20 rounded-2xl p-6 border border-white/5">
                <p className="text-sm text-slate-400 italic">
                  💡 {data.teachingNote}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
