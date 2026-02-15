'use client';

import React, { useState, useMemo } from 'react';
import { ObjectiveData } from '../types';
import { ManifestItem } from '../types';

interface ObjectiveComponentMapProps {
  objectives: ObjectiveData[];
  manifestItems: ManifestItem[];
  themeColor?: string;
}

/**
 * ObjectiveComponentMap - Visualizes the connection between learning objectives and components
 *
 * Features:
 * - Interactive filtering by objective
 * - Visual connections showing which components address each objective
 * - Lumina-themed design with gradients and animations
 * - Responsive grid layout
 */
export const ObjectiveComponentMap: React.FC<ObjectiveComponentMapProps> = ({
  objectives,
  manifestItems,
  themeColor = '#3b82f6'
}) => {
  const [selectedObjectiveId, setSelectedObjectiveId] = useState<string | null>(null);
  const [hoveredComponentId, setHoveredComponentId] = useState<string | null>(null);

  // Filter out curator-brief from the list since it's the intro
  const componentItems = useMemo(() =>
    manifestItems.filter(item => item.componentId !== 'curator-brief'),
    [manifestItems]
  );

  // Build objective-to-component mapping
  const objectiveMap = useMemo(() => {
    const map: Record<string, ManifestItem[]> = {};
    objectives.forEach(obj => {
      map[obj.id] = componentItems.filter(item =>
        item.objectiveIds?.includes(obj.id)
      );
    });
    return map;
  }, [objectives, componentItems]);

  // Build component-to-objective mapping
  const componentMap = useMemo(() => {
    const map: Record<string, ObjectiveData[]> = {};
    componentItems.forEach(item => {
      map[item.instanceId] = objectives.filter(obj =>
        item.objectiveIds?.includes(obj.id)
      );
    });
    return map;
  }, [objectives, componentItems]);

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

  // Get component icon based on componentId
  const getComponentIcon = (componentId: string) => {
    const iconMap: Record<string, string> = {
      'concept-card-grid': '🗂️',
      'number-line': '📊',
      'bar-model': '📊',
      'base-ten-blocks': '🧮',
      'fraction-circles': '🥧',
      'shape-builder': '📐',
      'custom-visual': '🎨',
      'graph-board': '📈',
      'comparison-panel': '⚖️',
      'generative-table': '📋',
      'formula-card': '🔢',
      'annotated-example': '📝',
      'knowledge-check': '✅',
      'take-home-activity': '🏠',
      'image-panel': '🖼️',
      'media-player': '🎬',
      'flashcard-deck': '🗂️',
      'scale-spectrum': '📏',
      'nested-hierarchy': '🌳',
      'word-builder': '🔤',
      'molecule-viewer': '⚛️',
      'periodic-table': '🧪',
      'image-comparison': '🔄',
      'interactive-passage': '📖',
      'sentence-analyzer': '📝',
      'feature-exhibit': '🎪'
    };
    return iconMap[componentId] || '📦';
  };

  // Determine if an objective or component should be highlighted
  const isObjectiveHighlighted = (objId: string) => {
    if (!selectedObjectiveId && !hoveredComponentId) return false;
    if (selectedObjectiveId) return objId === selectedObjectiveId;
    if (hoveredComponentId) {
      return componentMap[hoveredComponentId]?.some(obj => obj.id === objId);
    }
    return false;
  };

  const isComponentHighlighted = (instanceId: string) => {
    if (!selectedObjectiveId && !hoveredComponentId) return false;
    if (hoveredComponentId) return instanceId === hoveredComponentId;
    if (selectedObjectiveId) {
      return objectiveMap[selectedObjectiveId]?.some(item => item.instanceId === instanceId);
    }
    return false;
  };

  const filteredComponents = selectedObjectiveId
    ? objectiveMap[selectedObjectiveId] || []
    : componentItems;

  return (
    <div className="max-w-7xl mx-auto mb-20">
      {/* Section Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent to-slate-700"></div>
        <span className="text-slate-400 text-sm font-mono uppercase tracking-widest">
          Learning Map
        </span>
        <div className="h-px flex-1 bg-gradient-to-l from-transparent to-slate-700"></div>
      </div>

      {/* Main Title */}
      <div className="text-center mb-8">
        <h3 className="text-3xl font-bold text-white mb-3">
          Objective → Component Connections
        </h3>
        <p className="text-slate-400 text-sm max-w-2xl mx-auto">
          See how each learning objective is addressed by specific components in this exhibit.
          Click an objective to filter components, or hover over components to see their objectives.
        </p>
      </div>

      {/* Objectives Grid */}
      <div className="mb-12">
        <h4 className="text-sm font-mono uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
          <span className="text-xl">🎯</span>
          Learning Objectives
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {objectives.map((objective) => {
            const componentCount = objectiveMap[objective.id]?.length || 0;
            const isHighlighted = isObjectiveHighlighted(objective.id);
            const isSelected = selectedObjectiveId === objective.id;

            return (
              <button
                key={objective.id}
                onClick={() => setSelectedObjectiveId(
                  isSelected ? null : objective.id
                )}
                className={`
                  group relative p-5 rounded-xl border-2 transition-all duration-300
                  ${isSelected
                    ? 'bg-blue-500/20 border-blue-400 shadow-lg shadow-blue-500/20'
                    : isHighlighted
                      ? 'bg-blue-500/10 border-blue-500/50'
                      : 'bg-slate-900/40 border-slate-700/50 hover:border-slate-600'
                  }
                  ${!isHighlighted && !isSelected ? 'opacity-70 hover:opacity-100' : ''}
                `}
              >
                {/* Objective Header */}
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-2xl flex-shrink-0">
                    {getVerbIcon(objective.icon)}
                  </span>
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-slate-500 uppercase">
                        {objective.verb}
                      </span>
                      <span className={`
                        text-xs px-2 py-0.5 rounded-full font-bold
                        ${isSelected || isHighlighted
                          ? 'bg-blue-400/30 text-blue-300'
                          : 'bg-slate-700/50 text-slate-400'
                        }
                      `}>
                        {componentCount} component{componentCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <p className={`
                      text-sm leading-relaxed transition-colors
                      ${isSelected || isHighlighted ? 'text-white' : 'text-slate-300'}
                    `}>
                      {objective.text}
                    </p>
                  </div>
                </div>

                {/* Selected Indicator */}
                {isSelected && (
                  <div className="absolute top-2 right-2">
                    <div className="w-3 h-3 bg-blue-400 rounded-full animate-pulse"></div>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Clear Filter Button */}
        {selectedObjectiveId && (
          <div className="mt-4 text-center">
            <button
              onClick={() => setSelectedObjectiveId(null)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 hover:text-white rounded-lg border border-slate-600 transition-all text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
              Clear Filter
            </button>
          </div>
        )}
      </div>

      {/* Components Grid */}
      <div>
        <h4 className="text-sm font-mono uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
          <span className="text-xl">🧩</span>
          Exhibit Components
          {selectedObjectiveId && (
            <span className="text-blue-400 font-normal normal-case">
              ({filteredComponents.length} matching)
            </span>
          )}
        </h4>

        {filteredComponents.length === 0 ? (
          <div className="text-center py-12 bg-slate-900/40 rounded-xl border border-slate-700/50">
            <p className="text-slate-500">No components found for this objective.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredComponents.map((item) => {
              const relatedObjectives = componentMap[item.instanceId] || [];
              const isHighlighted = isComponentHighlighted(item.instanceId);
              const isHovered = hoveredComponentId === item.instanceId;

              return (
                <div
                  key={item.instanceId}
                  onMouseEnter={() => setHoveredComponentId(item.instanceId)}
                  onMouseLeave={() => setHoveredComponentId(null)}
                  className={`
                    group relative p-5 rounded-xl border transition-all duration-300
                    ${isHovered
                      ? 'bg-purple-500/20 border-purple-400 shadow-lg shadow-purple-500/20'
                      : isHighlighted
                        ? 'bg-purple-500/10 border-purple-500/50'
                        : 'bg-slate-900/40 border-slate-700/50 hover:border-slate-600'
                    }
                    ${!isHighlighted && !isHovered ? 'opacity-80 hover:opacity-100' : ''}
                  `}
                >
                  {/* Component Header */}
                  <div className="flex items-start gap-3 mb-3">
                    <span className="text-3xl flex-shrink-0">
                      {getComponentIcon(item.componentId)}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-slate-500 uppercase">
                          {item.componentId.replace(/-/g, ' ')}
                        </span>
                      </div>
                      <h5 className={`
                        font-bold mb-2 transition-colors
                        ${isHovered || isHighlighted ? 'text-white' : 'text-slate-200'}
                      `}>
                        {item.title}
                      </h5>
                      <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                        {item.intent}
                      </p>
                    </div>
                  </div>

                  {/* Objective Tags */}
                  <div className="flex flex-wrap gap-2 mt-3">
                    {relatedObjectives.map((obj) => (
                      <span
                        key={obj.id}
                        className={`
                          inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium
                          ${isHighlighted || isHovered
                            ? 'bg-blue-400/30 text-blue-200 border border-blue-400/50'
                            : 'bg-slate-700/50 text-slate-400 border border-slate-600/50'
                          }
                        `}
                      >
                        <span>{getVerbIcon(obj.icon)}</span>
                        <span className="uppercase text-[10px] tracking-wider">
                          {obj.verb}
                        </span>
                      </span>
                    ))}
                  </div>

                  {/* Hover Indicator */}
                  {isHovered && (
                    <div className="absolute -top-1 -right-1">
                      <div className="w-4 h-4 bg-purple-400 rounded-full animate-pulse"></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Stats Summary */}
      <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-900/20 to-blue-800/10 rounded-xl p-6 border border-blue-700/30">
          <div className="text-4xl mb-2">🎯</div>
          <div className="text-3xl font-bold text-white mb-1">{objectives.length}</div>
          <div className="text-sm text-slate-400">Learning Objectives</div>
        </div>
        <div className="bg-gradient-to-br from-purple-900/20 to-purple-800/10 rounded-xl p-6 border border-purple-700/30">
          <div className="text-4xl mb-2">🧩</div>
          <div className="text-3xl font-bold text-white mb-1">{componentItems.length}</div>
          <div className="text-sm text-slate-400">Exhibit Components</div>
        </div>
        <div className="bg-gradient-to-br from-green-900/20 to-green-800/10 rounded-xl p-6 border border-green-700/30">
          <div className="text-4xl mb-2">🔗</div>
          <div className="text-3xl font-bold text-white mb-1">
            {componentItems.reduce((sum, item) => sum + (item.objectiveIds?.length || 0), 0)}
          </div>
          <div className="text-sm text-slate-400">Total Connections</div>
        </div>
      </div>
    </div>
  );
};
