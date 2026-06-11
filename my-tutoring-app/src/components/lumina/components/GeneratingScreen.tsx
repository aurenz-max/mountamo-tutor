'use client';

import React from 'react';
import type { IntroBriefingData } from '../types';
import type { GradeLevel } from './GradeLevelSelector';
import type { ExhibitProgress } from '../hooks/useExhibitSession';
import { ObjectivesViewer } from './ObjectivesViewer';
import { ComponentViewer } from './ComponentViewer';

interface GeneratingScreenProps {
  progress: ExhibitProgress;
  brief: IntroBriefingData | null;
  gradeLevel: GradeLevel;
}

export const GeneratingScreen: React.FC<GeneratingScreenProps> = ({
  progress,
  brief,
  gradeLevel,
}) => (
  <div className="flex-1 flex flex-col justify-center items-center text-center">
    <div className="relative w-32 h-32 mb-8">
      <div className="absolute inset-0 border-4 border-slate-800 rounded-full"></div>
      <div className="absolute inset-0 border-t-4 border-blue-500 rounded-full animate-spin shadow-[0_0_30px_rgba(59,130,246,0.5)]"></div>
      <div className="absolute inset-4 border-t-4 border-purple-500 rounded-full animate-spin direction-reverse shadow-[0_0_30px_rgba(168,85,247,0.5)]" style={{ animationDirection: 'reverse', animationDuration: '2s' }}></div>
    </div>
    <h3 className="text-2xl font-bold text-white animate-pulse">{progress.message}</h3>
    <p className="text-slate-500 mt-2 font-mono text-sm">Generative AI is curating...</p>
    <div className="mt-4 px-4 py-2 bg-slate-800/50 rounded-full border border-slate-700">
      <span className="text-xs text-slate-400">
        Tailoring for: <span className="text-blue-400 font-medium capitalize">{gradeLevel.replace('-', ' ')}</span>
      </span>
    </div>

    {/* Objectives Display - Show after curator brief is generated */}
    {brief && brief.objectives && (
      <div className="mt-12 w-full px-4">
        <ObjectivesViewer objectives={brief.objectives} topic={brief.topic} />
      </div>
    )}

    {/* Component Build Progress */}
    {progress.componentStatuses.length > 0 && (
      <div className="mt-8 w-full px-4">
        <ComponentViewer components={progress.componentStatuses} />
      </div>
    )}

    {/* AI Thinking Display */}
    {progress.thoughts.length > 0 && (
      <div className="mt-8 max-w-2xl w-full px-4">
        <div className="bg-slate-800/30 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">AI Thinking</span>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {progress.thoughts.map((thought, index) => (
              <div
                key={index}
                className="text-sm text-slate-300 bg-slate-900/40 rounded-lg p-3 animate-fade-in"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {thought}
              </div>
            ))}
          </div>
        </div>
      </div>
    )}
  </div>
);
