'use client';

import React from 'react';
import { ExhibitManifest, ComponentId } from '../types';

interface ManifestViewerProps {
  manifest: ExhibitManifest | null;
  isLoading: boolean;
}

// Icon mapping for visual representation
const componentIcons: Record<ComponentId, string> = {
  'curator-brief': '📖',
  'concept-card-grid': '🃏',
  'feature-exhibit': '🎨',
  'detail-drawer': '🗂️',
  'comparison-panel': '⚖️',
  'generative-table': '📊',
  'sentence-analyzer': '📝',
  'formula-card': '🔢',
  'math-visual': '🧮',
  'custom-visual': '🎭',
  'knowledge-check': '✅'
};

export const ManifestViewer: React.FC<ManifestViewerProps> = ({ manifest, isLoading }) => {
  if (isLoading) {
    return (
      <div className="w-full max-w-4xl mx-auto mt-8 p-8 bg-slate-800/30 backdrop-blur-sm border border-slate-700 rounded-2xl">
        <div className="flex items-center justify-center gap-4">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 text-lg">Generating manifest...</p>
        </div>
      </div>
    );
  }

  if (!manifest) {
    return null;
  }

  return (
    <div className="w-full max-w-5xl mx-auto mt-8 animate-fade-in-up">
      {/* Header */}
      <div className="mb-6 text-center">
        <h2 className="text-3xl font-bold text-white mb-2">📋 Exhibit Manifest</h2>
        <p className="text-slate-400">Blueprint generated for the exhibit architecture</p>
      </div>

      {/* Manifest Overview Card */}
      <div className="mb-6 p-6 bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Topic</p>
            <p className="text-white font-semibold text-lg">{manifest.topic}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Grade Level</p>
            <p className="text-white font-semibold capitalize">{manifest.gradeLevel.replace('-', ' ')}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Theme Color</p>
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-lg border border-white/20 shadow-lg"
                style={{ backgroundColor: manifest.themeColor }}
              />
              <p className="text-white font-mono text-sm">{manifest.themeColor}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Layout Components */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-slate-400 text-sm font-mono uppercase tracking-widest">
            Component Layout ({manifest.layout.length} components)
          </span>
          <div className="h-px flex-1 bg-gradient-to-r from-slate-700 to-transparent"></div>
        </div>

        {manifest.layout.map((item, index) => (
          <div
            key={item.instanceId}
            className="group relative p-6 bg-slate-800/40 backdrop-blur-sm border border-slate-700 rounded-xl hover:border-blue-500/30 transition-all duration-300"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            {/* Step Number Badge */}
            <div className="absolute -left-3 -top-3 w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center shadow-lg">
              <span className="text-white text-sm font-bold">{index + 1}</span>
            </div>

            <div className="flex items-start gap-4">
              {/* Component Icon */}
              <div className="text-4xl flex-shrink-0">
                {componentIcons[item.componentId] || '📦'}
              </div>

              {/* Component Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <h3 className="text-xl font-bold text-white mb-1">{item.title}</h3>
                    <div className="flex items-center gap-2">
                      <span className="inline-block px-2 py-1 text-xs font-mono bg-blue-500/20 text-blue-300 rounded border border-blue-500/30">
                        {item.componentId}
                      </span>
                      <span className="text-xs text-slate-500 font-mono">
                        ID: {item.instanceId}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Intent */}
                <div className="mb-3">
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Intent</p>
                  <p className="text-slate-300 text-sm leading-relaxed">{item.intent}</p>
                </div>

                {/* Config (if present) */}
                {item.config && Object.keys(item.config).length > 0 && (
                  <div className="mt-3 p-3 bg-slate-900/50 rounded-lg border border-slate-600">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Configuration</p>
                    <pre className="text-xs text-green-400 font-mono overflow-x-auto">
                      {JSON.stringify(item.config, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* JSON View (Collapsible) */}
      <details className="mt-8 p-6 bg-slate-900/50 backdrop-blur-sm border border-slate-700 rounded-2xl">
        <summary className="cursor-pointer text-slate-400 hover:text-white transition-colors font-mono text-sm uppercase tracking-wider">
          View Raw JSON
        </summary>
        <pre className="mt-4 p-4 bg-black/50 rounded-lg overflow-x-auto text-xs text-green-400 font-mono border border-slate-600">
          {JSON.stringify(manifest, null, 2)}
        </pre>
      </details>
    </div>
  );
};
