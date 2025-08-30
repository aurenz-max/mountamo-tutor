import React from 'react';

// Import all primitive components
import MultipleChoice from './MultipleChoice';
import ObjectCounter from './ObjectCounter';
import DragAndDropZone from './DragAndDropZone';
import NumberTracing from './NumberTracing';
// TODO: Add other primitive imports as they become available
// import NumberInput from './NumberInput';
// import NumberLine from './NumberLine';

interface DynamicPrimitiveRendererProps {
  interaction: {
    type: string;
    parameters: any;
  };
  disabled?: boolean;
  onUpdate: (value: any) => void;
  showValidation?: boolean;
  initialValue?: any;
}

export default function DynamicPrimitiveRenderer({ 
  interaction, 
  disabled = false,
  onUpdate,
  showValidation = false,
  initialValue
}: DynamicPrimitiveRendererProps) {
  if (!interaction) {
    return (
      <div className="p-4 bg-yellow-100 text-yellow-800 rounded">
        No interaction defined for this problem
      </div>
    );
  }

  const commonProps = {
    parameters: interaction.parameters,
    disabled,
    initialValue,
    onUpdate: (value: any, isComplete?: boolean) => onUpdate(value),
    showValidation
  };

  switch (interaction.type) {
    case 'MultipleChoice':
      return <MultipleChoice {...commonProps} />;
    
    case 'ObjectCounter':
      return <ObjectCounter {...commonProps} />;
    
    case 'DragAndDropZone':
      return <DragAndDropZone {...commonProps} />;
    
    case 'NumberTracing':
      return <NumberTracing {...commonProps} />;
    
    // TODO: Add cases for other primitives as they become available
    // case 'NumberInput':
    //   return <NumberInput {...commonProps} />;
    // 
    // case 'NumberLine':
    //   return <NumberLine {...commonProps} />;
    
    default:
      return (
        <div className="p-4 bg-red-100 text-red-800 rounded">
          Error: Unknown interaction type "{interaction.type}"
          <div className="text-sm mt-2 text-gray-600">
            Available types: MultipleChoice, ObjectCounter, DragAndDropZone, NumberTracing
          </div>
        </div>
      );
  }
}