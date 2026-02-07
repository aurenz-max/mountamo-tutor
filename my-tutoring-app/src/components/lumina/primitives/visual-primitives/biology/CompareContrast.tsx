import React, { useState } from 'react';
import { CheckCircle, XCircle, Info, ArrowLeftRight, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
// Entity Image Component (shared between views)
// ============================================================================

const EntityImage: React.FC<{
  entity: EntityInfo;
  colorScheme: 'blue' | 'purple';
  generatedUrl: string | null;
  isLoading: boolean;
  hasError: boolean;
  onGenerate: () => void;
  loadingAny: boolean;
}> = ({ entity, colorScheme, generatedUrl, isLoading, hasError, onGenerate, loadingAny }) => {
  const borderColor = colorScheme === 'blue' ? 'border-blue-400/30' : 'border-purple-400/30';
  const textColor = colorScheme === 'blue' ? 'text-blue-300' : 'text-purple-300';
  const accentColor = colorScheme === 'blue' ? '#60a5fa' : '#c084fc';
  const bgColor = colorScheme === 'blue' ? 'rgba(96, 165, 250, 0.05)' : 'rgba(192, 132, 252, 0.05)';
  const borderDashed = colorScheme === 'blue' ? 'border-blue-400/20' : 'border-purple-400/20';

  const displayUrl = entity.imageUrl || generatedUrl;

  // Loading state
  if (isLoading) {
    return (
      <div
        className={`mt-4 rounded-xl flex flex-col items-center justify-center min-h-[200px] border-2 ${borderDashed}`}
        style={{ backgroundColor: bgColor }}
      >
        <div
          className="w-10 h-10 border-4 border-white/10 border-t-current rounded-full animate-spin mb-3"
          style={{ color: accentColor }}
        />
        <p className="text-sm font-medium" style={{ color: accentColor }}>
          Generating visualization...
        </p>
        <p className="text-xs text-slate-500 text-center italic max-w-xs mt-2 px-4">
          "{entity.imagePrompt}"
        </p>
      </div>
    );
  }

  // Generated or provided image
  if (displayUrl) {
    return (
      <div className={`mt-4 rounded-xl overflow-hidden border ${borderColor} relative`}>
        <img
          src={displayUrl}
          alt={entity.name}
          className="w-full h-48 object-cover"
        />
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-900 via-slate-900/80 to-transparent p-3">
          <p className="text-xs text-slate-400 italic">{entity.imagePrompt}</p>
        </div>
      </div>
    );
  }

  // Placeholder with generate button
  return (
    <div
      className={`mt-4 rounded-xl flex flex-col items-center justify-center min-h-[200px] border-2 border-dashed ${borderDashed} p-6`}
      style={{ backgroundColor: bgColor }}
    >
      <p className="text-sm text-slate-400 italic text-center mb-4">{entity.imagePrompt}</p>
      {!hasError && (
        <Button
          onClick={onGenerate}
          disabled={loadingAny}
          variant="ghost"
          className={`bg-white/5 border border-white/20 hover:bg-white/10 ${textColor}`}
        >
          <ImageIcon className="w-4 h-4 mr-2" />
          Generate Visual
        </Button>
      )}
      <p className="text-xs text-slate-500 text-center mt-3 italic">
        {hasError ? 'Image generation failed. Try again later.' : 'Click to generate an AI visualization'}
      </p>
    </div>
  );
};

// ============================================================================
// Helper Components
// ============================================================================

/**
 * Side-by-side comparison mode
 * Shows both entities with aligned attributes, highlighting differences
 */
const SideBySideView: React.FC<{ data: CompareContrastData }> = ({ data }) => {
  const { entityA, entityB, sharedAttributes } = data;

  // Image generation state
  const [generatedImages, setGeneratedImages] = useState<Record<string, string>>({});
  const [loadingEntity, setLoadingEntity] = useState<string | null>(null);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  const handleGenerateImage = async (entity: EntityInfo, entityKey: string) => {
    if (!entity.imagePrompt || loadingEntity || generatedImages[entityKey] || entity.imageUrl) return;

    setLoadingEntity(entityKey);
    setImageErrors(prev => ({ ...prev, [entityKey]: false }));

    try {
      const response = await fetch('/api/lumina', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generateSpeciesImage',
          params: {
            imagePrompt: entity.imagePrompt,
          }
        })
      });

      if (!response.ok) {
        throw new Error('Image generation request failed');
      }

      const result = await response.json();
      if (result.imageUrl) {
        setGeneratedImages(prev => ({ ...prev, [entityKey]: result.imageUrl }));
      } else {
        setImageErrors(prev => ({ ...prev, [entityKey]: true }));
      }
    } catch (error) {
      console.error('Failed to generate entity image:', error);
      setImageErrors(prev => ({ ...prev, [entityKey]: true }));
    } finally {
      setLoadingEntity(null);
    }
  };

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
          <EntityImage
            entity={entityA}
            colorScheme="blue"
            generatedUrl={generatedImages['entityA'] || null}
            isLoading={loadingEntity === 'entityA'}
            hasError={imageErrors['entityA'] || false}
            onGenerate={() => handleGenerateImage(entityA, 'entityA')}
            loadingAny={!!loadingEntity}
          />
        </div>

        {/* Entity B */}
        <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 backdrop-blur-sm rounded-2xl border border-purple-400/20 p-6">
          <h3 className="text-2xl font-bold text-purple-300 mb-2">{entityB.name}</h3>
          <EntityImage
            entity={entityB}
            colorScheme="purple"
            generatedUrl={generatedImages['entityB'] || null}
            isLoading={loadingEntity === 'entityB'}
            hasError={imageErrors['entityB'] || false}
            onGenerate={() => handleGenerateImage(entityB, 'entityB')}
            loadingAny={!!loadingEntity}
          />
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
