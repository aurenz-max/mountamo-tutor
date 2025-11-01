'use client';

import React from 'react';
// Foundational primitives (USE FIRST for K-1)
import { ObjectCollection } from './ObjectCollection';
import { ComparisonPanel } from './ComparisonPanel';
import { CardGrid } from './CardGrid';

// Math primitives
import { BarModel } from './BarModel';
import { NumberLine } from './NumberLine';
import { BaseTenBlocks } from './BaseTenBlocks';
import { FractionCircles } from './FractionCircles';
import { GeometricShape } from './GeometricShape';

// Science primitives
import { LabeledDiagram } from './LabeledDiagram';
import { CycleDiagram } from './CycleDiagram';
import { TreeDiagram } from './TreeDiagram';
import { LineGraph } from './LineGraph';
import { Thermometer } from './Thermometer';

// Language Arts primitives
import { SentenceDiagram } from './SentenceDiagram';
import { StorySequence } from './StorySequence';
import { WordWeb } from './WordWeb';
import { CharacterWeb } from './CharacterWeb';
import { VennDiagram } from './VennDiagram';

// ABCs/Phonics primitives
import { LetterTracing } from './LetterTracing';
import { LetterPicture } from './LetterPicture';
import { AlphabetSequence } from './AlphabetSequence';
import { RhymingPairs } from './RhymingPairs';
import { SightWordCard } from './SightWordCard';
import { SoundSort } from './SoundSort';

interface VisualData {
  type: string;
  data: any;
}

interface VisualPrimitiveRendererProps {
  visualData: VisualData | null;
  className?: string;
  // Pass-through props for interactive visuals
  interactionConfig?: {
    mode: string;
    targets: Array<{ id: string; is_correct: boolean; description?: string }>;
  };
  selectedTargetId?: string | null;
  onTargetClick?: (targetId: string) => void;
  isSubmitted?: boolean;
  getTargetState?: (targetId: string) => 'default' | 'selected' | 'correct' | 'incorrect';
}

/**
 * VisualPrimitiveRenderer - Central router for visual primitives
 *
 * This component renders the appropriate visual component based on the type.
 * It provides graceful error handling and fallback behavior.
 */
export const VisualPrimitiveRenderer: React.FC<VisualPrimitiveRendererProps> = ({
  visualData,
  className = '',
  interactionConfig,
  selectedTargetId,
  onTargetClick,
  isSubmitted,
  getTargetState
}) => {
  // Null check
  if (!visualData) {
    return null;
  }

  // Validate structure
  if (!visualData.type || !visualData.data) {
    console.warn('Invalid visual data structure:', visualData);
    return null;
  }

  try {
    switch (visualData.type) {
      // Foundational primitives (K-1 priority)
      case 'object-collection':
        return <ObjectCollection data={visualData.data} className={className} />;

      case 'comparison-panel':
        return <ComparisonPanel data={visualData.data} className={className} />;

      case 'card-grid':
        return (
          <CardGrid
            data={visualData.data}
            className={className}
            selectedTargetId={selectedTargetId}
            onTargetClick={onTargetClick}
            isSubmitted={isSubmitted}
            getTargetState={getTargetState}
          />
        );

      // Math primitives
      case 'bar-model':
        return <BarModel data={visualData.data} className={className} />;

      case 'number-line':
        return <NumberLine data={visualData.data} className={className} />;

      case 'base-ten-blocks':
        return <BaseTenBlocks data={visualData.data} className={className} />;

      case 'fraction-circles':
        return <FractionCircles data={visualData.data} className={className} />;

      case 'geometric-shape':
        return <GeometricShape data={visualData.data} className={className} />;

      // Science primitives
      case 'labeled-diagram':
        return <LabeledDiagram data={visualData.data} className={className} />;

      case 'cycle-diagram':
        return <CycleDiagram data={visualData.data} className={className} />;

      case 'tree-diagram':
        return <TreeDiagram data={visualData.data} className={className} />;

      case 'line-graph':
        return <LineGraph data={visualData.data} className={className} />;

      case 'thermometer':
        return <Thermometer data={visualData.data} className={className} />;

      // Language Arts primitives
      case 'sentence-diagram':
        return <SentenceDiagram data={visualData.data} className={className} />;

      case 'story-sequence':
        return <StorySequence data={visualData.data} className={className} />;

      case 'word-web':
        return <WordWeb data={visualData.data} className={className} />;

      case 'character-web':
        return <CharacterWeb data={visualData.data} className={className} />;

      case 'venn-diagram':
        return <VennDiagram data={visualData.data} className={className} />;

      // ABCs/Phonics primitives
      case 'letter-tracing':
        return <LetterTracing data={visualData.data} className={className} />;

      case 'letter-picture':
        return <LetterPicture data={visualData.data} className={className} />;

      case 'alphabet-sequence':
        return <AlphabetSequence data={visualData.data} className={className} />;

      case 'rhyming-pairs':
        return (
          <RhymingPairs
            data={visualData.data}
            className={className}
            interactionConfig={interactionConfig}
            selectedTargetId={selectedTargetId}
            onTargetClick={onTargetClick}
            isSubmitted={isSubmitted}
            getTargetState={getTargetState}
          />
        );

      case 'sight-word-card':
        return <SightWordCard data={visualData.data} className={className} />;

      case 'sound-sort':
        return <SoundSort data={visualData.data} className={className} />;

      default:
        console.warn(`Unknown visual type: ${visualData.type}`);
        return (
          <div className={`p-4 bg-yellow-50 border border-yellow-300 rounded-lg ${className}`}>
            <p className="text-sm text-yellow-800">
              Unknown visual type: {visualData.type}
            </p>
          </div>
        );
    }
  } catch (error) {
    console.error('Error rendering visual:', error);
    // Graceful degradation - don't crash the whole problem
    return (
      <div className={`p-4 bg-red-50 border border-red-300 rounded-lg ${className}`}>
        <p className="text-sm text-red-800">
          Error rendering visual. Please try again.
        </p>
      </div>
    );
  }
};

export default VisualPrimitiveRenderer;
