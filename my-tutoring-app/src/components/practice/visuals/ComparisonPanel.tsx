'use client';

import React from 'react';
import { ObjectCollection } from './ObjectCollection';

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

interface Panel {
  label: string;
  collection: ObjectCollectionData;
}

interface ComparisonPanelData {
  panels: [Panel, Panel]; // Exactly 2 panels
}

interface ComparisonPanelProps {
  data: ComparisonPanelData;
  className?: string;
}

/**
 * ComparisonPanel - Foundational visual primitive for K-1
 * Displays two side-by-side collections for direct comparison
 *
 * Use Cases:
 * - "Who has more cookies? Maya has 3, Tom has 5"
 * - "Which group has fewer stars?"
 * - Direct visual comparison of countable items
 */
export const ComparisonPanel: React.FC<ComparisonPanelProps> = ({
  data,
  className = ''
}) => {
  const { panels } = data;

  if (!panels || panels.length !== 2) {
    console.warn('ComparisonPanel requires exactly 2 panels');
    return null;
  }

  const [leftPanel, rightPanel] = panels;

  return (
    <div className={`relative p-6 bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl ${className}`}>
      {/* Main comparison area */}
      <div className="grid grid-cols-2 gap-6">
        {/* Left Panel */}
        <div className="relative">
          {/* Panel Label */}
          <div className="mb-4 text-center">
            <div className="inline-block bg-blue-600 text-white px-6 py-2 rounded-full shadow-md">
              <h3 className="font-bold text-lg">{leftPanel.label}</h3>
            </div>
          </div>

          {/* Collection Display */}
          <div className="bg-white rounded-xl p-4 shadow-lg border-4 border-blue-200">
            <ObjectCollection
              data={leftPanel.collection}
              className="bg-transparent"
            />
          </div>
        </div>

        {/* Right Panel */}
        <div className="relative">
          {/* Panel Label */}
          <div className="mb-4 text-center">
            <div className="inline-block bg-purple-600 text-white px-6 py-2 rounded-full shadow-md">
              <h3 className="font-bold text-lg">{rightPanel.label}</h3>
            </div>
          </div>

          {/* Collection Display */}
          <div className="bg-white rounded-xl p-4 shadow-lg border-4 border-purple-200">
            <ObjectCollection
              data={rightPanel.collection}
              className="bg-transparent"
            />
          </div>
        </div>
      </div>

      {/* VS divider */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white w-16 h-16 rounded-full flex items-center justify-center shadow-xl font-bold text-xl">
          VS
        </div>
      </div>
    </div>
  );
};

export default ComparisonPanel;
