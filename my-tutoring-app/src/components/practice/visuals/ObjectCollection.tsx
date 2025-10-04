'use client';

import React, { useId } from 'react';

interface ObjectItem {
  name: string;
  count: number;
  icon?: string;
  attributes?: string[];
}

interface ObjectCollectionData {
  instruction?: string;
  items: ObjectItem[];
  layout?: 'grid' | 'scattered' | 'row';
}

interface ObjectCollectionProps {
  data: ObjectCollectionData;
  className?: string;
}

/**
 * ObjectCollection - Foundational visual primitive for K-1
 * Displays collections of countable objects for basic counting and identification tasks
 *
 * Use Cases:
 * - "Count the apples" (show 5 apple emojis)
 * - "How many stars?" (display 8 stars)
 * - Simple object identification and grouping
 */
export const ObjectCollection: React.FC<ObjectCollectionProps> = ({
  data,
  className = ''
}) => {
  // Generate a unique ID for this component instance to prevent key collisions
  // across different problems/instances
  const instanceId = useId();

  const { instruction, items, layout = 'grid' } = data;

  if (!items || items.length === 0) {
    return null;
  }

  // Generate array of objects to render
  // Use instanceId to ensure keys are globally unique across different component instances
  const renderObjects = items.flatMap((item) => {
    return Array.from({ length: item.count }, (_, i) => ({
      ...item,
      uniqueKey: `${instanceId}-${item.name}-${i}`
    }));
  });

  // Layout styles
  const layoutClass = {
    grid: 'grid grid-cols-5 gap-4 justify-items-center',
    scattered: 'flex flex-wrap gap-6 justify-center items-center',
    row: 'flex flex-row gap-4 justify-center items-center flex-wrap'
  }[layout];

  // Random rotation for scattered layout (adds playfulness)
  const getScatteredStyle = (index: number) => {
    if (layout !== 'scattered') return {};
    const rotations = [-8, -4, 0, 4, 8, -6, 6, -3, 3];
    return {
      transform: `rotate(${rotations[index % rotations.length]}deg)`
    };
  };

  return (
    <div className={`p-6 bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl ${className}`}>
      {/* Optional instruction */}
      {instruction && (
        <div className="text-center mb-6">
          <p className="text-lg font-semibold text-gray-800">{instruction}</p>
        </div>
      )}

      {/* Object display area */}
      <div className={layoutClass}>
        {renderObjects.map((obj, index) => (
          <div
            key={obj.uniqueKey}
            className="flex flex-col items-center transition-transform hover:scale-110"
            style={getScatteredStyle(index)}
          >
            {/* Icon/Emoji */}
            <div className="text-5xl mb-1 select-none">
              {obj.icon || '🔵'}
            </div>

            {/* Object name label */}
            <div className="text-xs text-gray-600 text-center">
              {obj.name}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ObjectCollection;
