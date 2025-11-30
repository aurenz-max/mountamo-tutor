'use client';

import React, { useState } from 'react';
import { MultipleChoiceProblemData, VisualObjectCollection, VisualComparisonData, LetterTracingData, LetterPictureData, AlphabetSequenceData, RhymingPairsData, SightWordCardData, SoundSortData } from '../../types';
import { ObjectCollection, ComparisonPanel, LetterPicture, AlphabetSequence, RhymingPairs, SightWordCard, SoundSort } from '../visual-primitives';
import { LetterTracing } from '../LetterTracing';

interface MultipleChoiceProblemProps {
  data: MultipleChoiceProblemData;
}

export const MultipleChoiceProblem: React.FC<MultipleChoiceProblemProps> = ({ data }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSelect = (id: string) => {
    if (isSubmitted) return;
    setSelectedId(id);
  };

  const handleSubmit = () => {
    if (selectedId) setIsSubmitted(true);
  };

  const isCorrect = selectedId === data.correctOptionId;

  return (
    <div className="w-full">
      {/* Question */}
      <h3 className="text-2xl md:text-3xl font-bold text-white mb-8 leading-tight">
        {data.question}
      </h3>

      {/* Visual Primitive (if present) */}
      {data.visual && (
        <div className="mb-8">
          {data.visual.type === 'object-collection' && (
            <ObjectCollection data={data.visual.data as VisualObjectCollection} />
          )}
          {data.visual.type === 'comparison-panel' && (
            <ComparisonPanel data={data.visual.data as VisualComparisonData} />
          )}
          {data.visual.type === 'letter-tracing' && (
            <LetterTracing data={data.visual.data as LetterTracingData} />
          )}
          {data.visual.type === 'letter-picture' && (
            <LetterPicture data={data.visual.data as LetterPictureData} />
          )}
          {data.visual.type === 'alphabet-sequence' && (
            <AlphabetSequence data={data.visual.data as AlphabetSequenceData} />
          )}
          {data.visual.type === 'rhyming-pairs' && (
            <RhymingPairs data={data.visual.data as RhymingPairsData} />
          )}
          {data.visual.type === 'sight-word-card' && (
            <SightWordCard data={data.visual.data as SightWordCardData} />
          )}
          {data.visual.type === 'sound-sort' && (
            <SoundSort data={data.visual.data as SoundSortData} />
          )}
        </div>
      )}

      {/* Options Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {data.options.map((option) => {
          let statusClass = "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20";

          if (selectedId === option.id) {
            statusClass = "border-blue-500 bg-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.3)]";
          }

          if (isSubmitted) {
            if (option.id === data.correctOptionId) {
              statusClass = "border-emerald-500 bg-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.3)]";
            } else if (selectedId === option.id && option.id !== data.correctOptionId) {
              statusClass = "border-red-500 bg-red-500/20 opacity-60";
            } else {
              statusClass = "opacity-40 border-transparent bg-black/20";
            }
          }

          return (
            <button
              key={option.id}
              onClick={() => handleSelect(option.id)}
              disabled={isSubmitted}
              className={`relative text-left p-6 rounded-xl border transition-all duration-300 group ${statusClass}`}
            >
              <div className="flex items-center gap-4">
                <span className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold font-mono border transition-colors
                  ${selectedId === option.id || (isSubmitted && option.id === data.correctOptionId) ? 'bg-white text-slate-900 border-white' : 'bg-black/30 text-slate-400 border-white/10'}
                `}>
                  {option.id}
                </span>
                <span className="text-lg text-slate-200 font-light group-hover:text-white transition-colors">{option.text}</span>
              </div>

              {isSubmitted && option.id === data.correctOptionId && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-400">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Action Area */}
      <div className="flex flex-col items-center">
        {!isSubmitted ? (
          <button
            onClick={handleSubmit}
            disabled={!selectedId}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-bold tracking-wide transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-600/20 hover:shadow-blue-500/40 hover:-translate-y-0.5"
          >
            Verify Answer
          </button>
        ) : (
          <div className="w-full animate-fade-in bg-black/20 rounded-2xl p-6 border border-white/5">
            <div className={`flex items-center gap-3 mb-2 font-bold uppercase tracking-wider ${isCorrect ? 'text-emerald-400' : 'text-slate-300'}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isCorrect ?
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path> :
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                }
              </svg>
              <span>{isCorrect ? 'Correct Analysis' : 'Insight'}</span>
            </div>
            <p className="text-slate-300 leading-relaxed text-lg font-light mb-3">
              {data.rationale}
            </p>
            {data.teachingNote && (
              <div className="mt-3 pt-3 border-t border-white/5">
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
