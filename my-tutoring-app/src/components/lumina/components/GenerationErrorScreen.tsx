'use client';

import React from 'react';

interface GenerationErrorScreenProps {
  topic: string;
  canRetry: boolean;
  backLabel: string;
  onRetry: () => void;
  onBack: () => void;
}

/**
 * Shown when exhibit generation fails. Offers a retry that preserves all
 * session state (daily-session progress, curriculum context) instead of
 * dumping the student back to the home screen.
 */
export const GenerationErrorScreen: React.FC<GenerationErrorScreenProps> = ({
  topic,
  canRetry,
  backLabel,
  onRetry,
  onBack,
}) => (
  <div className="flex-1 flex flex-col justify-center items-center text-center animate-fade-in">
    <div className="max-w-md w-full px-8 py-10 rounded-2xl backdrop-blur-xl bg-slate-900/40 border border-white/10">
      <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
        <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M10.29 3.86l-8.4 14.52A1.5 1.5 0 003.18 21h17.64a1.5 1.5 0 001.29-2.62l-8.4-14.52a1.5 1.5 0 00-2.58 0z" />
        </svg>
      </div>
      <h3 className="text-2xl font-bold text-white mb-2">Hmm, that didn&apos;t work</h3>
      <p className="text-slate-400 text-sm leading-relaxed mb-8">
        {topic
          ? <>We couldn&apos;t build &ldquo;{topic}&rdquo; this time. This is usually temporary.</>
          : <>We couldn&apos;t build this exhibit. This is usually temporary.</>}
      </p>
      <div className="flex flex-col gap-3">
        {canRetry && (
          <button
            onClick={onRetry}
            className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-all"
          >
            Try Again
          </button>
        )}
        <button
          onClick={onBack}
          className="w-full px-6 py-3 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl border border-white/20 transition-all"
        >
          {backLabel}
        </button>
      </div>
    </div>
  </div>
);
