'use client';

import React, { useState } from 'react';
import { CategorizationActivityProblemData } from '../../types';

interface CategorizationActivityProblemProps {
  data: CategorizationActivityProblemData;
}

export const CategorizationActivityProblem: React.FC<CategorizationActivityProblemProps> = ({ data }) => {
  const [itemCategories, setItemCategories] = useState<{ [itemText: string]: string }>({});
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleDragStart = (itemText: string) => {
    if (isSubmitted) return;
    setDraggedItem(itemText);
  };

  const handleDrop = (category: string) => {
    if (isSubmitted || !draggedItem) return;
    setItemCategories(prev => ({ ...prev, [draggedItem]: category }));
    setDraggedItem(null);
  };

  const handleSubmit = () => {
    if (data.categorizationItems.every(item => itemCategories[item.itemText])) {
      setIsSubmitted(true);
    }
  };

  const checkItemCategory = (itemText: string): boolean | null => {
    if (!isSubmitted) return null;
    const item = data.categorizationItems.find(i => i.itemText === itemText);
    if (!item) return null;
    return itemCategories[itemText] === item.correctCategory;
  };

  const getUncategorizedItems = () => {
    return data.categorizationItems.filter(item => !itemCategories[item.itemText]);
  };

  const getItemsInCategory = (category: string) => {
    return data.categorizationItems.filter(item => itemCategories[item.itemText] === category);
  };

  const allCorrect = isSubmitted && data.categorizationItems.every(item => checkItemCategory(item.itemText));

  return (
    <div className="w-full">
      {/* Instruction */}
      <h3 className="text-xl md:text-2xl font-bold text-white mb-6 leading-tight">
        {data.instruction}
      </h3>

      <p className="text-slate-400 mb-6 text-sm">
        Drag items into the correct category.
      </p>

      {/* Uncategorized Items */}
      {getUncategorizedItems().length > 0 && (
        <div className="mb-6 p-4 rounded-xl border border-dashed border-white/20 bg-black/10">
          <div className="text-sm text-slate-400 mb-3 font-mono uppercase tracking-wider">Items to Categorize</div>
          <div className="flex flex-wrap gap-2">
            {getUncategorizedItems().map((item) => (
              <div
                key={item.itemText}
                draggable={!isSubmitted}
                onDragStart={() => handleDragStart(item.itemText)}
                className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg cursor-move hover:bg-white/10 hover:border-white/20 transition-all"
              >
                <span className="text-slate-200 font-medium">{item.itemText}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {data.categories.map((category) => {
          const itemsInCategory = getItemsInCategory(category);

          return (
            <div
              key={category}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(category)}
              className="p-4 rounded-xl border border-white/10 bg-white/5 min-h-[200px]"
            >
              <h4 className="text-lg font-bold text-blue-400 mb-4">{category}</h4>
              <div className="space-y-2">
                {itemsInCategory.map((item) => {
                  const isCorrect = checkItemCategory(item.itemText);
                  let statusClass = "bg-black/20 border-white/10";

                  if (isSubmitted && isCorrect !== null) {
                    statusClass = isCorrect
                      ? "bg-emerald-500/20 border-emerald-500"
                      : "bg-red-500/20 border-red-500";
                  }

                  return (
                    <div
                      key={item.itemText}
                      draggable={!isSubmitted}
                      onDragStart={() => handleDragStart(item.itemText)}
                      className={`px-3 py-2 rounded-lg border transition-all ${statusClass} ${!isSubmitted && 'cursor-move hover:bg-black/30'}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-slate-200 text-sm">{item.itemText}</span>
                        {isSubmitted && isCorrect !== null && (
                          <span className={isCorrect ? 'text-emerald-400' : 'text-red-400'}>
                            {isCorrect ? '✓' : '✗'}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Action Area */}
      <div className="flex flex-col items-center">
        {!isSubmitted ? (
          <button
            onClick={handleSubmit}
            disabled={getUncategorizedItems().length > 0}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-bold tracking-wide transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-600/20 hover:shadow-blue-500/40 hover:-translate-y-0.5"
          >
            Verify Categories
          </button>
        ) : (
          <div className="w-full animate-fade-in bg-black/20 rounded-2xl p-6 border border-white/5">
            <div className={`flex items-center gap-3 mb-2 font-bold uppercase tracking-wider ${allCorrect ? 'text-emerald-400' : 'text-slate-300'}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {allCorrect ?
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path> :
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                }
              </svg>
              <span>{allCorrect ? 'All Correct!' : 'Review Your Categories'}</span>
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
