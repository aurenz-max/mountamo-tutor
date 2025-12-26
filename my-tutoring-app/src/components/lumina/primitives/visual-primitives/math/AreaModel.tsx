'use client';

import React, { useState } from 'react';

export interface AreaModelData {
  title: string;
  description: string;
  factor1Parts: number[]; // Decomposition of first factor (e.g., [20, 3] for 23)
  factor2Parts: number[]; // Decomposition of second factor (e.g., [10, 5] for 15)
  showPartialProducts?: boolean; // Display products in cells
  showDimensions?: boolean; // Label side lengths
  algebraicMode?: boolean; // Allow variable terms
  highlightCell?: [number, number] | null; // Emphasize specific cell [row, col]
  showAnimation?: boolean; // Animate assembly of final product
  labels?: {
    factor1?: string[]; // Custom labels for factor1Parts (e.g., ["2x", "3"])
    factor2?: string[]; // Custom labels for factor2Parts
  };
}

interface AreaModelProps {
  data: AreaModelData;
  className?: string;
}

const AreaModel: React.FC<AreaModelProps> = ({ data, className }) => {
  const {
    factor1Parts = [10, 2],
    factor2Parts = [10, 3],
    showPartialProducts = true,
    showDimensions = true,
    algebraicMode = false,
    highlightCell = null,
    showAnimation = false,
    labels,
  } = data;

  const [hoveredCell, setHoveredCell] = useState<[number, number] | null>(null);
  const [animationComplete, setAnimationComplete] = useState(!showAnimation);

  // Calculate partial products
  const getPartialProduct = (row: number, col: number): number | string => {
    const factor1 = factor1Parts[col];
    const factor2 = factor2Parts[row];

    if (algebraicMode && labels) {
      const label1 = labels.factor1?.[col] || String(factor1);
      const label2 = labels.factor2?.[row] || String(factor2);

      // Handle algebraic multiplication
      return `${label1} × ${label2}`;
    }

    return factor1 * factor2;
  };

  // Calculate totals
  const factor1Total = factor1Parts.reduce((sum, val) => sum + val, 0);
  const factor2Total = factor2Parts.reduce((sum, val) => sum + val, 0);
  const totalProduct = factor1Total * factor2Total;

  // Get cell color based on position
  const getCellColor = (row: number, col: number): string => {
    if (highlightCell && highlightCell[0] === row && highlightCell[1] === col) {
      return 'bg-yellow-500/40 border-yellow-400';
    }
    if (hoveredCell && hoveredCell[0] === row && hoveredCell[1] === col) {
      return 'bg-purple-500/30 border-purple-400';
    }

    // Alternate colors for visual clarity
    const colorIndex = (row + col) % 4;
    const colors = [
      'bg-blue-500/20 border-blue-400/50',
      'bg-purple-500/20 border-purple-400/50',
      'bg-pink-500/20 border-pink-400/50',
      'bg-indigo-500/20 border-indigo-400/50',
    ];
    return colors[colorIndex];
  };

  // Format label (handles both numeric and algebraic)
  const formatLabel = (value: number, labelArray?: string[], index?: number): string => {
    if (labelArray && index !== undefined) {
      return labelArray[index];
    }
    return String(value);
  };

  // Start animation on mount
  React.useEffect(() => {
    if (showAnimation && !animationComplete) {
      const timer = setTimeout(() => setAnimationComplete(true), 500);
      return () => clearTimeout(timer);
    }
  }, [showAnimation, animationComplete]);

  return (
    <div className={`w-full max-w-6xl mx-auto my-16 animate-fade-in ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8 justify-center">
        <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center border border-blue-500/30 text-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.2)]">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1v-3z"></path>
          </svg>
        </div>
        <div className="text-left">
          <h2 className="text-2xl font-bold text-white tracking-tight">Area Model</h2>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
            <p className="text-xs text-blue-400 font-mono uppercase tracking-wider">
              {algebraicMode ? 'Algebraic Multiplication' : 'Visual Multiplication'}
            </p>
          </div>
        </div>
      </div>

      <div className="glass-panel p-8 md:p-12 rounded-3xl border border-blue-500/20 relative overflow-hidden">
        {/* Background Texture */}
        <div
          className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(#3b82f6 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        ></div>

        <div className="relative z-10 w-full">
          <div className="mb-8 text-center max-w-3xl mx-auto">
            <h3 className="text-xl font-bold text-white mb-2">{data.title}</h3>
            <p className="text-slate-300 font-light">{data.description}</p>
          </div>

          {/* Equation Display */}
          <div className="mb-6 text-center">
            <div className="inline-flex items-center gap-3 text-2xl font-bold font-mono">
              {(algebraicMode || factor1Parts.length > 1) && <span className="text-slate-500">(</span>}
              <span className="text-blue-300">
                {labels?.factor1
                  ? labels.factor1.join(' + ')
                  : factor1Parts.length > 1
                    ? factor1Parts.join(' + ')
                    : factor1Parts[0]
                }
              </span>
              {(algebraicMode || factor1Parts.length > 1) && <span className="text-slate-500">)</span>}
              <span className="text-slate-500">×</span>
              {(algebraicMode || factor2Parts.length > 1) && <span className="text-slate-500">(</span>}
              <span className="text-purple-300">
                {labels?.factor2
                  ? labels.factor2.join(' + ')
                  : factor2Parts.length > 1
                    ? factor2Parts.join(' + ')
                    : factor2Parts[0]
                }
              </span>
              {(algebraicMode || factor2Parts.length > 1) && <span className="text-slate-500">)</span>}
              <span className="text-slate-500">=</span>
              <span className="text-pink-300">{algebraicMode ? '?' : totalProduct}</span>
            </div>
          </div>

          {/* Area Model Grid */}
          <div className="flex justify-center items-center">
            <div className="relative inline-block">
              {/* Top dimension labels */}
              {showDimensions && (
                <div className="flex mb-2 ml-16">
                  {factor1Parts.map((part, index) => (
                    <div
                      key={`top-${index}`}
                      className="flex items-center justify-center text-blue-300 font-mono font-bold text-sm"
                      style={{ width: `${Math.max(100, part * 8)}px` }}
                    >
                      {formatLabel(part, labels?.factor1, index)}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex">
                {/* Left dimension labels */}
                {showDimensions && (
                  <div className="flex flex-col mr-2 justify-start">
                    {factor2Parts.map((part, index) => (
                      <div
                        key={`left-${index}`}
                        className="flex items-center justify-center text-purple-300 font-mono font-bold text-sm"
                        style={{ height: `${Math.max(80, part * 6)}px` }}
                      >
                        {formatLabel(part, labels?.factor2, index)}
                      </div>
                    ))}
                  </div>
                )}

                {/* Grid */}
                <div
                  className={`grid gap-2 transition-all duration-500 ${
                    animationComplete ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
                  }`}
                  style={{
                    gridTemplateColumns: `repeat(${factor1Parts.length}, minmax(100px, 1fr))`,
                  }}
                >
                  {factor2Parts.map((_, rowIndex) =>
                    factor1Parts.map((_, colIndex) => {
                      const product = getPartialProduct(rowIndex, colIndex);
                      const isHighlighted = highlightCell && highlightCell[0] === rowIndex && highlightCell[1] === colIndex;

                      return (
                        <div
                          key={`cell-${rowIndex}-${colIndex}`}
                          className={`
                            border-2 rounded-lg flex items-center justify-center p-4
                            transition-all duration-300 cursor-pointer
                            ${getCellColor(rowIndex, colIndex)}
                            ${isHighlighted ? 'ring-4 ring-yellow-400 scale-105' : 'hover:scale-105'}
                          `}
                          style={{
                            minHeight: `${Math.max(80, factor2Parts[rowIndex] * 6)}px`,
                            minWidth: `${Math.max(100, factor1Parts[colIndex] * 8)}px`,
                          }}
                          onMouseEnter={() => setHoveredCell([rowIndex, colIndex])}
                          onMouseLeave={() => setHoveredCell(null)}
                        >
                          {showPartialProducts && (
                            <div className="text-center">
                              <div className="text-white font-mono font-bold text-lg">
                                {product}
                              </div>
                              {!algebraicMode && (
                                <div className="text-xs text-slate-400 mt-1">
                                  {factor1Parts[colIndex]} × {factor2Parts[rowIndex]}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Partial Products Breakdown */}
          {showPartialProducts && !algebraicMode && (
            <div className="mt-8 p-6 bg-slate-800/30 rounded-xl border border-slate-700">
              <h4 className="text-sm font-mono uppercase tracking-wider text-slate-400 mb-3">
                Partial Products
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {factor2Parts.map((f2, rowIndex) =>
                  factor1Parts.map((f1, colIndex) => (
                    <div
                      key={`breakdown-${rowIndex}-${colIndex}`}
                      className="flex items-center gap-2 text-sm text-slate-300"
                    >
                      <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                      <span className="font-mono">
                        {f1} × {f2} = <span className="text-white font-bold">{f1 * f2}</span>
                      </span>
                    </div>
                  ))
                )}
              </div>

              {/* Sum of Partial Products */}
              <div className="mt-4 pt-4 border-t border-slate-600">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-slate-400 text-sm">Sum of Partial Products:</span>
                </div>
                <div className="text-center font-mono">
                  <span className="text-white text-lg">
                    {factor2Parts.flatMap((f2, rowIndex) =>
                      factor1Parts.map((f1, colIndex) => f1 * f2)
                    ).join(' + ')}
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-600 flex items-center justify-between">
                <span className="text-slate-400 text-sm">Total Product:</span>
                <span className="text-2xl font-bold text-pink-300 font-mono">{totalProduct}</span>
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="mt-8 p-6 bg-slate-800/30 rounded-xl border border-slate-700">
            <h4 className="text-sm font-mono uppercase tracking-wider text-slate-400 mb-3">
              Interactive Controls
            </h4>
            <ul className="text-sm text-slate-300 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1">▸</span>
                <span>Hover over cells to highlight individual partial products</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1">▸</span>
                <span>Each cell represents the product of its row and column dimensions</span>
              </li>
              {algebraicMode && (
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-1">▸</span>
                  <span>Algebraic mode: multiply variable terms using distributive property</span>
                </li>
              )}
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1">▸</span>
                <span>The total area equals the sum of all partial products</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AreaModel;
