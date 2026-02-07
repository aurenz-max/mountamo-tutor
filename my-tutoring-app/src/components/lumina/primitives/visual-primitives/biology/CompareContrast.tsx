import React, { useState } from 'react';
import { CheckCircle, XCircle, Info, ArrowLeftRight } from 'lucide-react';
import { usePrimitiveEvaluation, PrimitiveEvaluationResult } from '../../../evaluation';
import type { CompareContrastMetrics } from '../../../evaluation/types';

/**
 * Compare & Contrast Viewer - Biology primitive for comparing entities
 *
 * Purpose: Side-by-side (or Venn) comparison of two biological entities—organisms,
 * cells, organs, processes, biomes. The essential "how are these alike and different?" primitive.
 *
 * Grade Band: K-8
 * Cognitive Operation: Compare, contrast, analyze shared vs unique properties
 *
 * Design: Two modes—side-by-side card comparison with aligned attribute rows
 * (highlighted matching/differing values), or interactive Venn diagram where students
 * drag attributes into correct regions (shared, unique-A, unique-B).
 */

// ============================================================================
// Type Definitions (Single Source of Truth)
// ============================================================================

export interface EntityAttribute {
  category: string;
  value: string;
  isShared: boolean;
}

export interface EntityInfo {
  name: string;
  imagePrompt: string;
  imageUrl?: string; // Generated or provided image URL
  attributes: EntityAttribute[];
}

export interface SharedAttribute {
  category: string;
  value: string;
}

export interface CompareContrastData {
  title: string;
  mode: 'side-by-side' | 'venn-interactive';
  entityA: EntityInfo;
  entityB: EntityInfo;
  sharedAttributes: SharedAttribute[];
  keyInsight: string; // The 'so what' — why this comparison matters
  gradeBand: 'K-2' | '3-5' | '6-8';

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<CompareContrastMetrics>) => void;
}

// ============================================================================
// Component Props
// ============================================================================

interface CompareContrastProps {
  data: CompareContrastData;
  className?: string;
}

// ============================================================================
// Helper Components
// ============================================================================

/**
 * Side-by-side comparison mode
 * Shows both entities with aligned attributes, highlighting differences
 */
const SideBySideView: React.FC<{ data: CompareContrastData }> = ({ data }) => {
  const { entityA, entityB, sharedAttributes } = data;

  // Get all unique category names
  const allCategories = Array.from(
    new Set([
      ...entityA.attributes.map(a => a.category),
      ...entityB.attributes.map(a => a.category),
      ...sharedAttributes.map(a => a.category)
    ])
  );

  return (
    <div className="space-y-6">
      {/* Entity Headers */}
      <div className="grid grid-cols-2 gap-6">
        {/* Entity A */}
        <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 backdrop-blur-sm rounded-2xl border border-blue-400/20 p-6">
          <h3 className="text-2xl font-bold text-blue-300 mb-2">{entityA.name}</h3>
          {entityA.imageUrl ? (
            <div className="mt-4 rounded-xl overflow-hidden border border-blue-400/30">
              <img
                src={entityA.imageUrl}
                alt={entityA.name}
                className="w-full h-48 object-cover"
              />
            </div>
          ) : (
            <div className="text-sm text-slate-400 italic mt-2">{entityA.imagePrompt}</div>
          )}
        </div>

        {/* Entity B */}
        <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 backdrop-blur-sm rounded-2xl border border-purple-400/20 p-6">
          <h3 className="text-2xl font-bold text-purple-300 mb-2">{entityB.name}</h3>
          {entityB.imageUrl ? (
            <div className="mt-4 rounded-xl overflow-hidden border border-purple-400/30">
              <img
                src={entityB.imageUrl}
                alt={entityB.name}
                className="w-full h-48 object-cover"
              />
            </div>
          ) : (
            <div className="text-sm text-slate-400 italic mt-2">{entityB.imagePrompt}</div>
          )}
        </div>
      </div>

      {/* Attribute Comparison */}
      <div className="space-y-3">
        {allCategories.map((category) => {
          const attrA = entityA.attributes.find(a => a.category === category);
          const attrB = entityB.attributes.find(a => a.category === category);
          const shared = sharedAttributes.find(a => a.category === category);

          const isShared = shared || (attrA && attrB && attrA.value === attrB.value);

          return (
            <div
              key={category}
              className={`grid grid-cols-[200px_1fr_1fr] gap-4 p-4 rounded-xl border ${
                isShared
                  ? 'bg-emerald-500/10 border-emerald-400/30'
                  : 'bg-slate-800/30 border-slate-700/50'
              }`}
            >
              {/* Category Label */}
              <div className="font-semibold text-slate-300 flex items-center gap-2">
                {isShared && <CheckCircle className="w-4 h-4 text-emerald-400" />}
                {category}
              </div>

              {/* Entity A Value */}
              <div className={`${isShared ? 'text-emerald-200' : 'text-blue-200'}`}>
                {shared?.value || attrA?.value || '—'}
              </div>

              {/* Entity B Value */}
              <div className={`${isShared ? 'text-emerald-200' : 'text-purple-200'}`}>
                {shared?.value || attrB?.value || '—'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Shared Attributes Summary */}
      {sharedAttributes.length > 0 && (
        <div className="bg-emerald-500/10 backdrop-blur-sm rounded-xl border border-emerald-400/30 p-6">
          <h4 className="text-lg font-semibold text-emerald-300 mb-3 flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            Shared Characteristics
          </h4>
          <ul className="space-y-2">
            {sharedAttributes.map((attr, idx) => (
              <li key={idx} className="flex items-start gap-3 text-slate-300">
                <span className="text-emerald-400 mt-1">•</span>
                <span>
                  <span className="font-medium">{attr.category}:</span> {attr.value}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

/**
 * Interactive Venn diagram mode
 * Students drag attributes into correct regions
 */
const VennInteractiveView: React.FC<{
  data: CompareContrastData;
  onEvaluate: (placements: Array<{ attributeValue: string; placedRegion: string; correctRegion: string; isCorrect: boolean }>) => void;
}> = ({ data, onEvaluate }) => {
  const { entityA, entityB, sharedAttributes } = data;

  // Prepare all attributes for dragging
  const allAttributes = [
    ...entityA.attributes.map(a => ({ ...a, correctRegion: 'A-only' })),
    ...entityB.attributes.filter(b => !entityA.attributes.some(a => a.category === b.category)).map(b => ({ ...b, correctRegion: 'B-only' })),
    ...sharedAttributes.map(s => ({ category: s.category, value: s.value, isShared: true, correctRegion: 'shared' }))
  ];

  // Student placements: { attributeValue: string, region: 'A-only' | 'B-only' | 'shared' }
  const [placements, setPlacements] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, attrValue: string) => {
    e.dataTransfer.setData('attributeValue', attrValue);
  };

  const handleDrop = (e: React.DragEvent, region: string) => {
    e.preventDefault();
    const attrValue = e.dataTransfer.getData('attributeValue');
    setPlacements(prev => ({ ...prev, [attrValue]: region }));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleSubmit = () => {
    const results = allAttributes.map(attr => {
      const attributeKey = `${attr.category}: ${attr.value}`;
      const placedRegion = placements[attributeKey] || 'unplaced';
      const correctRegion = attr.correctRegion;
      return {
        attributeValue: attributeKey,
        placedRegion,
        correctRegion,
        isCorrect: placedRegion === correctRegion
      };
    });

    onEvaluate(results);
    setSubmitted(true);
  };

  const handleReset = () => {
    setPlacements({});
    setSubmitted(false);
  };

  // Get attributes by placement
  const getAttributesForRegion = (region: string) => {
    return allAttributes.filter(attr => {
      const key = `${attr.category}: ${attr.value}`;
      return placements[key] === region;
    });
  };

  const unplacedAttributes = allAttributes.filter(attr => {
    const key = `${attr.category}: ${attr.value}`;
    return !placements[key];
  });

  return (
    <div className="space-y-6">
      {/* Instructions */}
      <div className="bg-blue-500/10 backdrop-blur-sm rounded-xl border border-blue-400/30 p-4">
        <p className="text-slate-300 flex items-start gap-2">
          <Info className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
          <span>
            Drag each characteristic into the correct region of the Venn diagram:
            <strong className="text-blue-300"> {entityA.name} only</strong>,
            <strong className="text-purple-300"> {entityB.name} only</strong>, or
            <strong className="text-emerald-300"> Both</strong>.
          </span>
        </p>
      </div>

      {/* Venn Diagram */}
      <div className="grid grid-cols-3 gap-4">
        {/* Left Circle (A-only) */}
        <div
          onDrop={(e) => handleDrop(e, 'A-only')}
          onDragOver={handleDragOver}
          className="bg-blue-500/10 backdrop-blur-sm rounded-2xl border-2 border-dashed border-blue-400/40 p-6 min-h-[300px]"
        >
          <h4 className="text-lg font-semibold text-blue-300 mb-4 text-center">{entityA.name} Only</h4>
          <div className="space-y-2">
            {getAttributesForRegion('A-only').map((attr, idx) => {
              const key = `${attr.category}: ${attr.value}`;
              const isCorrect = attr.correctRegion === 'A-only';
              return (
                <div
                  key={idx}
                  draggable={!submitted}
                  onDragStart={(e) => handleDragStart(e, key)}
                  className={`p-3 rounded-lg cursor-move ${
                    submitted
                      ? isCorrect
                        ? 'bg-emerald-500/20 border border-emerald-400/50'
                        : 'bg-red-500/20 border border-red-400/50'
                      : 'bg-slate-700/50 border border-slate-600'
                  }`}
                >
                  <div className="text-sm font-medium text-slate-200">{attr.category}</div>
                  <div className="text-xs text-slate-400">{attr.value}</div>
                  {submitted && !isCorrect && (
                    <div className="text-xs text-red-300 mt-1">✗ Should be in {attr.correctRegion}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Center Overlap (shared) */}
        <div
          onDrop={(e) => handleDrop(e, 'shared')}
          onDragOver={handleDragOver}
          className="bg-emerald-500/10 backdrop-blur-sm rounded-2xl border-2 border-dashed border-emerald-400/40 p-6 min-h-[300px]"
        >
          <h4 className="text-lg font-semibold text-emerald-300 mb-4 text-center">Both</h4>
          <div className="space-y-2">
            {getAttributesForRegion('shared').map((attr, idx) => {
              const key = `${attr.category}: ${attr.value}`;
              const isCorrect = attr.correctRegion === 'shared';
              return (
                <div
                  key={idx}
                  draggable={!submitted}
                  onDragStart={(e) => handleDragStart(e, key)}
                  className={`p-3 rounded-lg cursor-move ${
                    submitted
                      ? isCorrect
                        ? 'bg-emerald-500/20 border border-emerald-400/50'
                        : 'bg-red-500/20 border border-red-400/50'
                      : 'bg-slate-700/50 border border-slate-600'
                  }`}
                >
                  <div className="text-sm font-medium text-slate-200">{attr.category}</div>
                  <div className="text-xs text-slate-400">{attr.value}</div>
                  {submitted && !isCorrect && (
                    <div className="text-xs text-red-300 mt-1">✗ Should be in {attr.correctRegion}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Circle (B-only) */}
        <div
          onDrop={(e) => handleDrop(e, 'B-only')}
          onDragOver={handleDragOver}
          className="bg-purple-500/10 backdrop-blur-sm rounded-2xl border-2 border-dashed border-purple-400/40 p-6 min-h-[300px]"
        >
          <h4 className="text-lg font-semibold text-purple-300 mb-4 text-center">{entityB.name} Only</h4>
          <div className="space-y-2">
            {getAttributesForRegion('B-only').map((attr, idx) => {
              const key = `${attr.category}: ${attr.value}`;
              const isCorrect = attr.correctRegion === 'B-only';
              return (
                <div
                  key={idx}
                  draggable={!submitted}
                  onDragStart={(e) => handleDragStart(e, key)}
                  className={`p-3 rounded-lg cursor-move ${
                    submitted
                      ? isCorrect
                        ? 'bg-emerald-500/20 border border-emerald-400/50'
                        : 'bg-red-500/20 border border-red-400/50'
                      : 'bg-slate-700/50 border border-slate-600'
                  }`}
                >
                  <div className="text-sm font-medium text-slate-200">{attr.category}</div>
                  <div className="text-xs text-slate-400">{attr.value}</div>
                  {submitted && !isCorrect && (
                    <div className="text-xs text-red-300 mt-1">✗ Should be in {attr.correctRegion}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Unplaced Attributes */}
      {unplacedAttributes.length > 0 && (
        <div className="bg-slate-800/30 backdrop-blur-sm rounded-xl border border-slate-700 p-4">
          <h4 className="text-sm font-semibold text-slate-400 mb-3">Drag these attributes to the correct region:</h4>
          <div className="flex flex-wrap gap-2">
            {unplacedAttributes.map((attr, idx) => {
              const key = `${attr.category}: ${attr.value}`;
              return (
                <div
                  key={idx}
                  draggable
                  onDragStart={(e) => handleDragStart(e, key)}
                  className="p-2 rounded-lg bg-slate-700/50 border border-slate-600 cursor-move hover:bg-slate-700/70 transition"
                >
                  <div className="text-sm font-medium text-slate-200">{attr.category}</div>
                  <div className="text-xs text-slate-400">{attr.value}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Submit Button */}
      <div className="flex gap-3">
        <button
          onClick={handleSubmit}
          disabled={submitted || unplacedAttributes.length > 0}
          className="px-6 py-3 bg-blue-500 text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-600 transition"
        >
          {submitted ? 'Submitted' : 'Check My Work'}
        </button>
        {submitted && (
          <button
            onClick={handleReset}
            className="px-6 py-3 bg-slate-600 text-white rounded-lg font-semibold hover:bg-slate-700 transition"
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

const CompareContrast: React.FC<CompareContrastProps> = ({ data, className = '' }) => {
  const {
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // Initialize evaluation hook (only for venn-interactive mode)
  const {
    submitResult,
    hasSubmitted,
    resetAttempt,
  } = usePrimitiveEvaluation<CompareContrastMetrics>({
    primitiveType: 'bio-compare-contrast',
    instanceId: instanceId || `compare-contrast-${Date.now()}`,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit,
  });

  const handleEvaluate = (placements: Array<{ attributeValue: string; placedRegion: string; correctRegion: string; isCorrect: boolean }>) => {
    const correctCount = placements.filter(p => p.isCorrect).length;
    const totalCount = placements.length;
    const accuracy = (correctCount / totalCount) * 100;
    const success = accuracy >= 70; // 70% threshold for success

    const metrics: CompareContrastMetrics = {
      type: 'bio-compare-contrast',
      mode: data.mode,
      totalAttributes: totalCount,
      correctPlacements: correctCount,
      accuracy,
      placements,
    };

    submitResult(success, accuracy, metrics, {
      studentWork: { placements },
    });
  };

  return (
    <div className={`${className}`}>
      {/* Title */}
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
          <ArrowLeftRight className="w-8 h-8 text-blue-400" />
          {data.title}
        </h2>
        <div className="text-sm text-slate-400">
          Grade {data.gradeBand} • {data.mode === 'side-by-side' ? 'Visual Comparison' : 'Interactive Activity'}
        </div>
      </div>

      {/* Content */}
      {data.mode === 'side-by-side' ? (
        <SideBySideView data={data} />
      ) : (
        <VennInteractiveView data={data} onEvaluate={handleEvaluate} />
      )}

      {/* Key Insight */}
      <div className="mt-6 bg-gradient-to-r from-blue-500/10 to-purple-500/10 backdrop-blur-sm rounded-xl border border-blue-400/30 p-6">
        <h4 className="text-lg font-semibold text-blue-300 mb-2 flex items-center gap-2">
          <Info className="w-5 h-5" />
          Why This Comparison Matters
        </h4>
        <p className="text-slate-300 leading-relaxed">{data.keyInsight}</p>
      </div>
    </div>
  );
};

export default CompareContrast;
