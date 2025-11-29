import React, { useState } from 'react';
import { ScaleSpectrumData } from '../types';
import { BookOpen } from 'lucide-react';

interface ScaleSpectrumProps {
  data: ScaleSpectrumData;
  className?: string;
}

export default function ScaleSpectrum({ data, className = '' }: ScaleSpectrumProps) {
  const [expandedItem, setExpandedItem] = useState<number | null>(null);

  const getSpectrumColor = (position: number) => {
    // Interpolate between left and right colors
    const leftRGB = hexToRgb(data.spectrum.leftColor);
    const rightRGB = hexToRgb(data.spectrum.rightColor);

    const r = Math.round(leftRGB.r + (rightRGB.r - leftRGB.r) * (position / 100));
    const g = Math.round(leftRGB.g + (rightRGB.g - leftRGB.g) * (position / 100));
    const b = Math.round(leftRGB.b + (rightRGB.b - leftRGB.b) * (position / 100));

    return `rgb(${r}, ${g}, ${b})`;
  };

  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  };

  // Sort items by position for vertical display
  const sortedItems = [...data.items].sort((a, b) => a.correctPosition - b.correctPosition);

  return (
    <div className={className}>
      {/* Header */}
      <div className="text-center mb-12">
        <h2 className="text-3xl font-serif font-bold text-slate-100 mb-3">{data.title}</h2>
      </div>

      {/* Timeline-style vertical layout */}
      <div className="relative max-w-6xl mx-auto">
        {/* Center vertical line */}
        <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-0.5 bg-slate-700 transform -translate-x-1/2"></div>

        {/* Items in vertical timeline */}
        {sortedItems.map((item, index) => {
          const isLeft = index % 2 === 0;
          const isExpanded = expandedItem === item.id;
          const position = item.correctPosition;
          const itemColor = getSpectrumColor(position);

          return (
            <div
              key={item.id}
              className="relative flex items-center justify-between md:justify-normal w-full mb-8 animate-slide-up opacity-100"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {/* Center dot on timeline */}
              <div
                className="absolute left-4 md:left-1/2 w-5 h-5 rounded-full border-4 border-slate-900 z-10 transform -translate-x-1/2 shadow-lg"
                style={{ backgroundColor: itemColor }}
              ></div>

              {/* Content Container */}
              <div className={`w-full pl-12 md:pl-0 flex flex-col md:flex-row ${isLeft ? 'md:flex-row-reverse' : ''} md:items-center`}>

                {/* Spacer for the other side on desktop */}
                <div className="hidden md:block md:w-5/12"></div>

                {/* The Card */}
                <div className={`relative w-full md:w-5/12 bg-slate-800/80 backdrop-blur-sm border border-slate-700 p-6 rounded-lg shadow-xl hover:border-amber-500/50 transition-all duration-300 group ${isExpanded ? 'ring-2 ring-blue-400 border-blue-500' : ''}`}>

                  {/* Connector Line to timeline */}
                  <div
                    className={`hidden md:block absolute top-1/2 -translate-y-1/2 h-[2px] w-8 group-hover:opacity-100 transition-opacity`}
                    style={{
                      backgroundColor: itemColor,
                      [isLeft ? 'right' : 'left']: '-2rem',
                      opacity: 0.3
                    }}
                  ></div>

                  <div className="flex justify-between items-start mb-3">
                    <span
                      className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border-2 shadow-sm"
                      style={{
                        backgroundColor: `${itemColor}22`,
                        borderColor: itemColor,
                        color: '#e2e8f0'
                      }}
                    >
                      {position}%
                    </span>

                    {/* Metadata in top-right */}
                    {item.metadata && (
                      <span className="text-xs text-slate-400 font-medium">
                        {item.metadata}
                      </span>
                    )}
                  </div>

                  <h3 className="text-xl font-serif font-bold text-slate-100 mb-2 leading-tight">
                    {item.title}
                  </h3>

                  <p className="text-slate-400 text-sm leading-relaxed mb-4">
                    {item.description}
                  </p>

                  {/* Expand/Collapse Button */}
                  <button
                    onClick={() => setExpandedItem(isExpanded ? null : item.id)}
                    className="text-sm text-blue-400 hover:text-blue-300 font-medium transition-colors flex items-center gap-1"
                  >
                    {isExpanded ? '← Hide significance' : 'Why here? →'}
                  </button>

                  {/* Expanded Explanation */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-slate-700/50 animate-slide-down">
                      <p className="text-xs text-slate-500 italic mb-2">
                        <span className="font-semibold text-amber-500/80">Significance: </span>
                      </p>
                      <p className="text-sm text-slate-300 bg-slate-900/50 p-4 rounded-lg leading-relaxed">
                        {item.explanation}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary Stats at bottom */}
      <div className="mt-16 max-w-4xl mx-auto bg-slate-900/50 border border-slate-700 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-slate-400" />
            <span className="text-slate-300 font-medium">
              {data.items.length} items positioned on the spectrum
            </span>
          </div>
          <div className="text-xs text-slate-500">
            Click any card to see significance
          </div>
        </div>
      </div>
    </div>
  );
}
