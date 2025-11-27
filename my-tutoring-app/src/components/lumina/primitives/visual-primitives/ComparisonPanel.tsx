'use client';

import React from 'react';
import { ObjectCollection, ObjectCollectionData } from './ObjectCollection';

export interface ComparisonPanelItem {
  label: string;
  collection: ObjectCollectionData;
}

export interface ComparisonPanelData {
  panels: [ComparisonPanelItem, ComparisonPanelItem]; // Exactly 2 panels
}

interface ComparisonPanelProps {
  data: ComparisonPanelData;
}

export const ComparisonPanel: React.FC<ComparisonPanelProps> = ({ data }) => {
  const { panels } = data;

  return (
    <div className="w-full my-8 animate-fade-in-up">
      <div className="glass-panel rounded-3xl overflow-hidden border border-white/10">
        {/* Comparison Header */}
        <div className="bg-slate-900/80 p-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></span>
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" style={{ animationDelay: '150ms' }}></span>
            </div>
            <span className="text-xs font-mono uppercase tracking-widest text-purple-400">
              Comparison View
            </span>
          </div>
        </div>

        {/* Two-panel comparison layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
          {panels.map((panel, idx) => (
            <div
              key={idx}
              className={`p-6 ${idx === 0 ? 'md:border-r border-white/10' : ''}`}
            >
              {/* Panel Label */}
              <div className="mb-4 text-center">
                <h4 className="text-xl font-bold text-white bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                  {panel.label}
                </h4>
              </div>

              {/* Panel Collection - Remove outer glass-panel styling since we're already in a panel */}
              <div className="my-2">
                {panel.collection.instruction && (
                  <div className="mb-4 text-center">
                    <p className="text-sm text-slate-300 font-light">
                      {panel.collection.instruction}
                    </p>
                  </div>
                )}

                {/* Objects display */}
                <div className={
                  panel.collection.layout === 'grid' ? 'grid grid-cols-3 gap-3 justify-items-center' :
                  panel.collection.layout === 'row' ? 'flex flex-wrap gap-3 justify-center' :
                  'flex flex-wrap gap-4 justify-center items-center'
                }>
                  {panel.collection.items.map((item, itemIdx) => {
                    const objects = [];
                    for (let i = 0; i < item.count; i++) {
                      const key = `${item.name}-${i}`;
                      objects.push(
                        <div
                          key={key}
                          className="flex flex-col items-center gap-1 p-2 animate-fade-in"
                          style={{ animationDelay: `${i * 50}ms` }}
                        >
                          <div className="text-4xl drop-shadow-lg transform transition-transform hover:scale-110">
                            {item.icon || '●'}
                          </div>
                          {item.attributes && item.attributes.length > 0 && (
                            <div className="text-xs text-slate-400 text-center">
                              {item.attributes.join(', ')}
                            </div>
                          )}
                        </div>
                      );
                    }
                    return <React.Fragment key={itemIdx}>{objects}</React.Fragment>;
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Optional comparison footer */}
        <div className="bg-slate-900/40 p-4 border-t border-white/5 text-center">
          <p className="text-sm text-slate-400 font-mono">
            Compare the two collections above
          </p>
        </div>
      </div>
    </div>
  );
};
