'use client';

import React from 'react';
import { ObjectiveData } from '../types';

interface ObjectiveBadgeProps {
  objectives: ObjectiveData[];
  compact?: boolean;
}

/**
 * ObjectiveBadge - Inline badges showing which learning objectives a component addresses
 *
 * Features:
 * - Compact mode for inline display
 * - Icon + verb display
 * - Tooltip with full objective text on hover
 * - Lumina-themed styling
 */
export const ObjectiveBadge: React.FC<ObjectiveBadgeProps> = ({
  objectives,
  compact = false
}) => {
  // Get icon emoji for objective verb
  const getVerbIcon = (icon: string) => {
    const iconMap: Record<string, string> = {
      'search': '🔍',
      'message': '💬',
      'pencil': '✏️',
      'lightbulb': '💡',
      'scale': '⚖️',
      'puzzle': '🧩',
      'check': '✓'
    };
    return iconMap[icon] || '🎯';
  };

  if (objectives.length === 0) return null;

  if (compact) {
    // Compact mode: just icons with tooltips
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
          Learning:
        </span>
        {objectives.map((obj) => (
          <div
            key={obj.id}
            className="group relative"
            title={obj.text}
          >
            <div className="flex items-center gap-1 px-2 py-1 bg-blue-500/20 border border-blue-400/30 rounded-md text-xs hover:bg-blue-500/30 transition-colors cursor-help">
              <span className="text-sm">{getVerbIcon(obj.icon)}</span>
              <span className="uppercase text-[10px] font-bold text-blue-300 tracking-wider">
                {obj.verb}
              </span>
            </div>

            {/* Tooltip */}
            <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-50 w-64">
              <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-xl">
                <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-1">
                  {obj.verb} Objective
                </div>
                <p className="text-xs text-white leading-relaxed">
                  {obj.text}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Full mode: expanded view
  return (
    <div className="space-y-2">
      <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500 flex items-center gap-2">
        <span className="text-sm">🎯</span>
        Learning Objectives
      </div>
      <div className="flex flex-wrap gap-2">
        {objectives.map((obj) => (
          <div
            key={obj.id}
            className="flex items-start gap-2 px-3 py-2 bg-blue-500/10 border border-blue-400/30 rounded-lg hover:bg-blue-500/20 transition-colors"
          >
            <span className="text-lg flex-shrink-0">{getVerbIcon(obj.icon)}</span>
            <div className="flex-1">
              <div className="text-[10px] font-mono uppercase tracking-widest text-blue-400 mb-1">
                {obj.verb}
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {obj.text}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
