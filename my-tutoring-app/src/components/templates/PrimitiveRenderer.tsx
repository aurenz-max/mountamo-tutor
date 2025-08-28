import React from 'react';
import { PrimitiveConfig, PrimitiveAnswer } from '../primitives/core/PrimitiveTypes';

// Import all primitive components
import { NumberLine } from '../primitives/math/NumberLine';
import { DiagramLabeler } from '../primitives/biology/DiagramLabeler';

interface PrimitiveRendererProps {
  primitiveConfig: PrimitiveConfig;
  templateId: string;
  disabled?: boolean;
  initialAnswer?: PrimitiveAnswer;
  onChange?: (answer: PrimitiveAnswer) => void;
}

/**
 * Central renderer that dynamically selects and renders the appropriate primitive component
 * based on the primitive configuration in the problem template.
 */
export function PrimitiveRenderer({
  primitiveConfig,
  templateId,
  disabled = false,
  initialAnswer,
  onChange
}: PrimitiveRendererProps) {
  // Create unique ID for this primitive instance
  const primitiveId = `${templateId}-${primitiveConfig.component}`;

  // Component mapping - maps component names to actual React components
  const componentMap: Record<string, React.ComponentType<any>> = {
    // Math primitives
    'NumberLine': NumberLine,
    'number_line': NumberLine,
    'numberline': NumberLine,
    
    // Biology primitives
    'DiagramLabeler': DiagramLabeler,
    'diagram_labeler': DiagramLabeler,
    'diagramlabeler': DiagramLabeler,
    
    // Future primitives will be added here as they're implemented
    // 'FractionBars': FractionBars,
    // 'AreaModel': AreaModel,
    // 'MoonPhaseSelector': MoonPhaseSelector,
    // 'EvidenceHighlighter': EvidenceHighlighter,
    // 'MapLabeler': MapLabeler,
    // 'TimelineBuilder': TimelineBuilder,
  };

  // Find the component to render
  const ComponentToRender = componentMap[primitiveConfig.component];

  if (!ComponentToRender) {
    // Graceful fallback for unknown primitive types
    return (
      <div className="primitive-error border-2 border-red-300 bg-red-50 rounded-lg p-6 text-center">
        <div className="text-red-600 font-semibold mb-2">
          Unknown Primitive: {primitiveConfig.component}
        </div>
        <div className="text-sm text-red-500">
          This problem type is not yet supported. Available primitives: {Object.keys(componentMap).join(', ')}
        </div>
        <div className="mt-4 text-xs text-gray-600">
          Template ID: {templateId}
        </div>
      </div>
    );
  }

  // Render the primitive with its props
  try {
    return (
      <div className="primitive-wrapper">
        <ComponentToRender
          id={primitiveId}
          params={primitiveConfig.props}
          disabled={disabled}
          initialAnswer={initialAnswer}
          onChange={onChange}
        />
      </div>
    );
  } catch (error) {
    // Error boundary for primitive rendering
    console.error('Error rendering primitive:', error, {
      component: primitiveConfig.component,
      templateId,
      props: primitiveConfig.props
    });

    return (
      <div className="primitive-error border-2 border-red-300 bg-red-50 rounded-lg p-6 text-center">
        <div className="text-red-600 font-semibold mb-2">
          Error Rendering {primitiveConfig.component}
        </div>
        <div className="text-sm text-red-500 mb-2">
          {error instanceof Error ? error.message : 'Unknown error occurred'}
        </div>
        <details className="text-xs text-gray-600">
          <summary className="cursor-pointer">Debug Info</summary>
          <pre className="mt-2 text-left bg-gray-100 p-2 rounded overflow-auto">
            {JSON.stringify({ primitiveConfig, templateId, error: error?.toString() }, null, 2)}
          </pre>
        </details>
      </div>
    );
  }
}

/**
 * Helper function to validate a primitive configuration
 */
export function validatePrimitiveConfig(config: PrimitiveConfig): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.component) {
    errors.push('Missing component name');
  }

  if (!config.props || typeof config.props !== 'object') {
    errors.push('Missing or invalid props object');
  }

  // Component-specific validation
  const componentMap: Record<string, React.ComponentType<any>> = {
    'NumberLine': NumberLine,
    'number_line': NumberLine,
    'DiagramLabeler': DiagramLabeler,
    'diagram_labeler': DiagramLabeler,
  };

  if (config.component && !componentMap[config.component]) {
    errors.push(`Unknown component: ${config.component}. Available: ${Object.keys(componentMap).join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Helper to get available primitive components
 */
export function getAvailablePrimitives(): Array<{ name: string; category: string; description: string }> {
  return [
    {
      name: 'NumberLine',
      category: 'Math',
      description: 'Interactive number line with draggable marker and customizable range'
    },
    {
      name: 'DiagramLabeler',
      category: 'Biology',
      description: 'Drag-and-drop labeling for biological diagrams and anatomical structures'
    },
    // Future primitives will be documented here
  ];
}