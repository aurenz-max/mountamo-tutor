'use client';

import React from 'react';

interface ComponentStatus {
  id: string;
  name: string;
  status: 'pending' | 'building' | 'completed';
  index: number;
  total: number;
  // Learning-specific metadata
  title?: string;
  intent?: string;
  objectiveId?: string;
  objectiveText?: string;
  objectiveVerb?: string;
}

interface ComponentViewerProps {
  components: ComponentStatus[];
}

export const ComponentViewer: React.FC<ComponentViewerProps> = ({ components }) => {
  if (!components || components.length === 0) {
    return null;
  }

  const completedCount = components.filter(c => c.status === 'completed').length;
  const totalCount = components.length;

  return (
    <div className="w-full max-w-5xl mx-auto animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
          <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
            Component Assembly
          </span>
        </div>
        <span className="text-xs text-slate-500 font-mono">
          {completedCount}/{totalCount}
        </span>
      </div>

      {/* Component Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {components.map((component, index) => (
          <div
            key={component.id}
            className={`relative overflow-hidden rounded-xl border transition-all duration-500 ${
              component.status === 'completed'
                ? 'bg-emerald-950/20 border-emerald-500/30'
                : component.status === 'building'
                ? 'bg-blue-950/20 border-blue-500/30'
                : 'bg-slate-900/20 border-slate-700/30'
            }`}
            style={{
              animationDelay: `${index * 50}ms`,
              animation: 'fade-in-up 0.4s ease-out backwards'
            }}
          >
            {/* Shimmer effect for building */}
            {component.status === 'building' && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-500/10 to-transparent animate-shimmer"></div>
            )}

            <div className="relative p-5 flex items-center gap-4">
              {/* Status Icon */}
              <div
                className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-300 ${
                  component.status === 'completed'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : component.status === 'building'
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'bg-slate-700/20 text-slate-500'
                }`}
              >
                {component.status === 'completed' ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                ) : component.status === 'building' ? (
                  <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <div className="w-2 h-2 bg-slate-600 rounded-full"></div>
                )}
              </div>

              {/* Component Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-xs font-mono font-bold ${
                      component.status === 'completed' ? 'text-emerald-400' : 'text-slate-500'
                    }`}
                  >
                    [{component.index}/{component.total}]
                  </span>
                  <span
                    className={`text-sm font-medium truncate ${
                      component.status === 'completed' ? 'text-white' : 'text-slate-400'
                    }`}
                  >
                    {component.title || component.name}
                  </span>
                </div>

                {/* Objective Badge */}
                {component.objectiveVerb && (
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      {component.objectiveVerb}
                    </span>
                    {component.objectiveId && (
                      <span className="text-[10px] font-mono text-slate-600">
                        {component.objectiveId}
                      </span>
                    )}
                  </div>
                )}

                {/* Intent/Purpose Description */}
                {component.intent && (
                  <div className={`text-xs leading-relaxed line-clamp-2 ${
                    component.status === 'completed'
                      ? 'text-emerald-500/70'
                      : component.status === 'building'
                      ? 'text-blue-400/70'
                      : 'text-slate-600'
                  }`}>
                    {component.intent}
                  </div>
                )}

                {/* Status Text */}
                {!component.intent && (
                  <div
                    className={`text-xs ${
                      component.status === 'completed'
                        ? 'text-emerald-500/70'
                        : component.status === 'building'
                        ? 'text-blue-400/70'
                        : 'text-slate-600'
                    }`}
                  >
                    {component.status === 'completed' ? 'Completed' : component.status === 'building' ? 'Building...' : 'Pending'}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Progress Bar */}
      {completedCount < totalCount && (
        <div className="mt-6">
          <div className="w-full h-2 bg-slate-800/50 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-500 ease-out"
              style={{
                width: `${(completedCount / totalCount) * 100}%`
              }}
            >
              <div className="w-full h-full bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
            </div>
          </div>
          <div className="mt-2 text-center">
            <span className="text-xs text-slate-500">
              Building components... {Math.round((completedCount / totalCount) * 100)}% complete
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComponentViewer;
