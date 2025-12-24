'use client';

import React from 'react';
import { SpotlightCard } from './SpotlightCard';

interface LearningObjective {
  id: string;
  text: string;
  verb: string;
  icon: string;
}

interface ObjectivesViewerProps {
  objectives: LearningObjective[];
  topic?: string;
}

// Verb to color mapping (RGB format for SpotlightCard)
const verbColorMap: Record<string, string> = {
  'identify': '59, 130, 246',     // Blue
  'explain': '168, 85, 247',      // Purple
  'apply': '34, 197, 94',         // Green
  'analyze': '251, 146, 60',      // Orange
  'evaluate': '239, 68, 68',      // Red
  'create': '236, 72, 153',       // Pink
  'understand': '14, 165, 233',   // Sky
  'remember': '132, 204, 22',     // Lime
  'default': '120, 119, 198'      // Default purple
};

// Icon mapping for common verbs
const verbIconMap: Record<string, string> = {
  'identify': '🔍',
  'explain': '💬',
  'apply': '✏️',
  'analyze': '🧪',
  'evaluate': '⚖️',
  'create': '🎨',
  'understand': '💡',
  'remember': '🧠',
  'search': '🔎',
  'message': '💬',
  'pencil': '✏️',
  'default': '🎯'
};

const getVerbColor = (verb: string): string => {
  const normalizedVerb = verb.toLowerCase();
  return verbColorMap[normalizedVerb] || verbColorMap['default'];
};

const getVerbIcon = (iconHint: string, verb: string): string => {
  // First try the icon hint
  if (verbIconMap[iconHint]) {
    return verbIconMap[iconHint];
  }
  // Fall back to verb
  const normalizedVerb = verb.toLowerCase();
  return verbIconMap[normalizedVerb] || verbIconMap['default'];
};

export const ObjectivesViewer: React.FC<ObjectivesViewerProps> = ({ objectives, topic }) => {
  if (!objectives || objectives.length === 0) {
    return null;
  }

  return (
    <div className="w-full max-w-5xl mx-auto animate-fade-in-up">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 rounded-full border border-white/10 backdrop-blur-sm mb-4">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
          <span className="text-xs font-bold uppercase tracking-widest text-slate-300">
            Learning Objectives Defined
          </span>
          <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
        </div>

        {topic && (
          <h3 className="text-2xl font-bold text-white mb-2">
            What You'll Master: <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">{topic}</span>
          </h3>
        )}
        <p className="text-slate-400 text-sm">
          These objectives will guide the entire learning experience
        </p>
      </div>

      {/* Objectives Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {objectives.map((objective, index) => {
          const color = getVerbColor(objective.verb);
          const icon = getVerbIcon(objective.icon, objective.verb);

          return (
            <SpotlightCard
              key={objective.id}
              color={color}
              className="bg-slate-900/40 backdrop-blur-sm"
            >
              <div
                className="p-6 h-full flex flex-col"
                style={{
                  animationDelay: `${index * 150}ms`,
                  animation: 'fade-in-up 0.6s ease-out backwards'
                }}
              >
                {/* Objective Number Badge */}
                <div className="flex items-start justify-between mb-4">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300"
                    style={{
                      backgroundColor: `rgba(${color}, 0.15)`,
                      border: `1px solid rgba(${color}, 0.3)`
                    }}
                  >
                    <span className="text-2xl">{icon}</span>
                  </div>
                  <div
                    className="text-xs font-bold px-2 py-1 rounded-full"
                    style={{
                      backgroundColor: `rgba(${color}, 0.2)`,
                      color: `rgb(${color})`
                    }}
                  >
                    {index + 1}/{objectives.length}
                  </div>
                </div>

                {/* Verb Label */}
                <div className="mb-3">
                  <span
                    className="inline-block text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full"
                    style={{
                      backgroundColor: `rgba(${color}, 0.15)`,
                      color: `rgb(${color})`,
                      border: `1px solid rgba(${color}, 0.3)`
                    }}
                  >
                    {objective.verb}
                  </span>
                </div>

                {/* Objective Text */}
                <p className="text-slate-200 text-sm leading-relaxed flex-1">
                  {objective.text}
                </p>

                {/* Hover Indicator */}
                <div className="mt-4 flex items-center gap-2 text-slate-500 group-hover:text-slate-300 transition-colors text-xs">
                  <div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: `rgb(${color})` }}
                  ></div>
                  <span>Bloom's Taxonomy: {objective.verb}</span>
                </div>
              </div>
            </SpotlightCard>
          );
        })}
      </div>

      {/* Progress Indicator */}
      <div className="mt-8 text-center">
        <div className="inline-flex items-center gap-2 text-xs text-slate-500">
          <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Generating curriculum aligned to these objectives...</span>
        </div>
      </div>
    </div>
  );
};

export default ObjectivesViewer;
