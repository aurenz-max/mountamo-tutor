'use client';

import React from 'react';

interface BaseTenBlocksData {
  hundreds: number;
  tens: number;
  ones: number;
  showLabels?: boolean;
}

interface BaseTenBlocksProps {
  data: BaseTenBlocksData;
  className?: string;
}

/**
 * BaseTenBlocks - Visual component for displaying base-ten blocks
 * Used for teaching place value and number sense
 */
export const BaseTenBlocks: React.FC<BaseTenBlocksProps> = ({ data, className = '' }) => {
  const { hundreds, tens, ones, showLabels = true } = data;

  if (hundreds === undefined || tens === undefined || ones === undefined) {
    return null;
  }

  // Render a single unit block (1)
  const UnitBlock = () => (
    <div className="w-4 h-4 bg-yellow-400 border border-yellow-600 rounded-sm" />
  );

  // Render a ten rod (10 units in a line)
  const TenRod = () => (
    <div className="flex gap-0.5">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="w-4 h-10 bg-green-400 border border-green-600 rounded-sm" />
      ))}
    </div>
  );

  // Render a hundred flat (10x10 grid)
  const HundredFlat = () => (
    <div className="grid grid-cols-10 gap-0.5 p-1 bg-blue-400 border-2 border-blue-600 rounded">
      {Array.from({ length: 100 }).map((_, i) => (
        <div key={i} className="w-2 h-2 bg-blue-300 border border-blue-500" />
      ))}
    </div>
  );

  return (
    <div className={`flex flex-col gap-6 ${className}`}>
      {/* Hundreds */}
      {hundreds > 0 && (
        <div className="flex flex-col gap-2">
          {showLabels && (
            <div className="text-sm font-bold text-blue-700">
              Hundreds: {hundreds}
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            {Array.from({ length: hundreds }).map((_, i) => (
              <HundredFlat key={`h-${i}`} />
            ))}
          </div>
        </div>
      )}

      {/* Tens */}
      {tens > 0 && (
        <div className="flex flex-col gap-2">
          {showLabels && (
            <div className="text-sm font-bold text-green-700">
              Tens: {tens}
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            {Array.from({ length: tens }).map((_, i) => (
              <TenRod key={`t-${i}`} />
            ))}
          </div>
        </div>
      )}

      {/* Ones */}
      {ones > 0 && (
        <div className="flex flex-col gap-2">
          {showLabels && (
            <div className="text-sm font-bold text-yellow-700">
              Ones: {ones}
            </div>
          )}
          <div className="flex flex-wrap gap-1">
            {Array.from({ length: ones }).map((_, i) => (
              <UnitBlock key={`o-${i}`} />
            ))}
          </div>
        </div>
      )}

      {/* Total */}
      {showLabels && (
        <div className="mt-4 p-3 bg-gray-100 rounded-lg border-2 border-gray-300">
          <div className="text-lg font-bold text-gray-800">
            Total: {hundreds * 100 + tens * 10 + ones}
          </div>
        </div>
      )}
    </div>
  );
};
