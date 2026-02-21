'use client';

import React, { useCallback, useRef, useState } from 'react';
import { getPrimitive } from '../config/primitiveRegistry';
import { HydratedPracticeItem, PracticeItemResult, ComponentId } from '../types';
import { KnowledgeCheck } from '../primitives/KnowledgeCheck';
import { PrimitiveEvaluationResult } from '../evaluation/types';
import { Card, CardContent } from '@/components/ui/card';

interface PracticeManifestRendererProps {
  item: HydratedPracticeItem;
  itemIndex: number;
  onItemComplete: (result: PracticeItemResult) => void;
}

/**
 * PracticeManifestRenderer — Renders a single practice item as either:
 * - A visual primitive with a problem-text header (the visual IS the answer)
 * - A standard KnowledgeCheck problem (traditional text-based)
 *
 * Follows the same primitive registry lookup pattern as ManifestOrderRenderer.
 */
export const PracticeManifestRenderer: React.FC<PracticeManifestRendererProps> = ({
  item,
  itemIndex,
  onItemComplete,
}) => {
  const startTimeRef = useRef(Date.now());
  const [hasSubmitted, setHasSubmitted] = useState(false);

  // Reset timer when item changes
  React.useEffect(() => {
    startTimeRef.current = Date.now();
    setHasSubmitted(false);
  }, [item.manifestItem.instanceId]);

  // Handle evaluation result from visual primitive
  const handleVisualEvaluation = useCallback((result: PrimitiveEvaluationResult) => {
    if (hasSubmitted) return;
    setHasSubmitted(true);

    onItemComplete({
      instanceId: item.manifestItem.instanceId,
      itemIndex,
      mode: 'visual-primitive',
      visualComponentId: item.manifestItem.visualPrimitive?.componentId as ComponentId,
      success: result.success,
      score: result.score,
      durationMs: Date.now() - startTimeRef.current,
      evaluationResult: result,
    });
  }, [item, itemIndex, onItemComplete, hasSubmitted]);

  // Handle evaluation result from standard KnowledgeCheck problem
  const handleStandardEvaluation = useCallback((result: PrimitiveEvaluationResult) => {
    if (hasSubmitted) return;
    setHasSubmitted(true);

    onItemComplete({
      instanceId: item.manifestItem.instanceId,
      itemIndex,
      mode: 'standard-problem',
      problemType: item.manifestItem.standardProblem?.problemType,
      success: result.success,
      score: result.score,
      durationMs: Date.now() - startTimeRef.current,
      evaluationResult: result,
    });
  }, [item, itemIndex, onItemComplete, hasSubmitted]);

  const { manifestItem, visualData, problemData } = item;

  // === VISUAL PRIMITIVE MODE ===
  if (manifestItem.visualPrimitive && visualData) {
    const { componentId } = manifestItem.visualPrimitive;
    const primitiveConfig = getPrimitive(componentId as ComponentId);

    if (!primitiveConfig) {
      console.warn(`[PracticeManifestRenderer] No primitive config for: ${componentId}`);
      return renderFallback(manifestItem.problemText);
    }

    const Component = primitiveConfig.component;
    if (!Component) return renderFallback(manifestItem.problemText);

    // Generator returns { type, instanceId, data: {...} } — unwrap the inner data
    const innerData = visualData.data ?? visualData;
    const mergedData = {
      ...innerData,
      // Evaluation props
      instanceId: manifestItem.instanceId,
      onEvaluationSubmit: handleVisualEvaluation,
      allowInteraction: true,
    };

    // Visual primitives contain their own title, description, and challenge
    // instructions — no separate problem statement card needed.
    return (
      <div className="max-w-5xl mx-auto">
        <Component data={mergedData} index={itemIndex} />
      </div>
    );
  }

  // === STANDARD PROBLEM MODE ===
  if (problemData) {
    return (
      <KnowledgeCheck
        data={{
          problems: [problemData],
          instanceId: manifestItem.instanceId,
          onEvaluationSubmit: handleStandardEvaluation,
        }}
      />
    );
  }

  // === FALLBACK ===
  return renderFallback(manifestItem.problemText);
};

function renderFallback(problemText: string) {
  return (
    <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
      <CardContent className="p-6">
        <p className="text-white text-lg">{problemText}</p>
        <p className="text-slate-500 text-sm mt-2">This problem could not be loaded.</p>
      </CardContent>
    </Card>
  );
}

export default PracticeManifestRenderer;
