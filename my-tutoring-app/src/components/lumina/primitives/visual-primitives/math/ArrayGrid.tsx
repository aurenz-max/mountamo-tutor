'use client';

import React, { useState } from 'react';

export interface ArrayGridData {
  title: string;
  description: string;
  rows: number; // Number of rows
  columns: number; // Number of columns
  iconType?: 'dot' | 'square' | 'star' | 'custom'; // Type of icon to display
  showRowLabels?: boolean; // Number the rows
  showColumnLabels?: boolean; // Number the columns
  partitionLines?: Array<{ type: 'row' | 'column'; index: number }>; // Dividing lines
  highlightMode?: 'row' | 'column' | 'cell' | 'region'; // What can be highlighted
  animateSkipCounting?: boolean; // Animate skip counting by row
}

interface ArrayGridProps {
  data: ArrayGridData;
  className?: string;
}

type HighlightState = {
  rows: Set<number>;
  columns: Set<number>;
  cells: Set<string>; // Format: "row-col"
};

const ArrayGrid: React.FC<ArrayGridProps> = ({ data, className }) => {
  const {
    rows: rowCount = 3,
    columns: colCount = 4,
    iconType = 'dot',
    showRowLabels = true,
    showColumnLabels = true,
    partitionLines = [],
    highlightMode = 'cell',
    animateSkipCounting = false,
  } = data;

  const [highlighted, setHighlighted] = useState<HighlightState>({
    rows: new Set(),
    columns: new Set(),
    cells: new Set(),
  });

  const [isAnimating, setIsAnimating] = useState(false);
  const [animatedCells, setAnimatedCells] = useState<Set<string>>(new Set());

  // Handle click based on highlight mode
  const handleClick = (rowIndex: number, colIndex: number) => {
    const cellKey = `${rowIndex}-${colIndex}`;

    setHighlighted((prev) => {
      const newState = { ...prev };

      switch (highlightMode) {
        case 'row':
          if (prev.rows.has(rowIndex)) {
            newState.rows = new Set([...prev.rows].filter((r) => r !== rowIndex));
          } else {
            newState.rows = new Set([...prev.rows, rowIndex]);
          }
          break;

        case 'column':
          if (prev.columns.has(colIndex)) {
            newState.columns = new Set([...prev.columns].filter((c) => c !== colIndex));
          } else {
            newState.columns = new Set([...prev.columns, colIndex]);
          }
          break;

        case 'cell':
          if (prev.cells.has(cellKey)) {
            newState.cells = new Set([...prev.cells].filter((c) => c !== cellKey));
          } else {
            newState.cells = new Set([...prev.cells, cellKey]);
          }
          break;

        case 'region':
          // Toggle entire region (simple implementation: toggle all cells)
          const allCells = new Set<string>();
          for (let r = 0; r < rowCount; r++) {
            for (let c = 0; c < colCount; c++) {
              allCells.add(`${r}-${c}`);
            }
          }
          newState.cells = prev.cells.size > 0 ? new Set() : allCells;
          break;
      }

      return newState;
    });
  };

  // Check if a cell is highlighted
  const isCellHighlighted = (rowIndex: number, colIndex: number): boolean => {
    const cellKey = `${rowIndex}-${colIndex}`;
    return (
      highlighted.rows.has(rowIndex) ||
      highlighted.columns.has(colIndex) ||
      highlighted.cells.has(cellKey) ||
      animatedCells.has(cellKey)
    );
  };

  // Render icon based on type
  const renderIcon = (rowIndex: number, colIndex: number) => {
    const isHighlighted = isCellHighlighted(rowIndex, colIndex);
    const baseClass = `transition-all duration-200 ${
      isHighlighted ? 'fill-purple-400 scale-110' : 'fill-blue-400/60'
    }`;

    switch (iconType) {
      case 'dot':
        return (
          <svg className="w-6 h-6" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="8" className={baseClass} />
          </svg>
        );

      case 'square':
        return (
          <svg className="w-6 h-6" viewBox="0 0 24 24">
            <rect x="6" y="6" width="12" height="12" className={baseClass} />
          </svg>
        );

      case 'star':
        return (
          <svg className="w-6 h-6" viewBox="0 0 24 24">
            <path
              d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
              className={baseClass}
            />
          </svg>
        );

      case 'custom':
      default:
        return (
          <svg className="w-6 h-6" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="8" className={baseClass} />
          </svg>
        );
    }
  };

  // Animate skip counting
  const startSkipCountingAnimation = () => {
    if (isAnimating) return;

    setIsAnimating(true);
    setAnimatedCells(new Set());

    let currentCell = 0;
    const totalCells = rowCount * colCount;

    const interval = setInterval(() => {
      if (currentCell >= totalCells) {
        clearInterval(interval);
        setIsAnimating(false);
        setTimeout(() => setAnimatedCells(new Set()), 1000);
        return;
      }

      const row = Math.floor(currentCell / colCount);
      const col = currentCell % colCount;
      const cellKey = `${row}-${col}`;

      setAnimatedCells((prev) => new Set([...prev, cellKey]));
      currentCell++;
    }, 300);
  };

  // Calculate totals
  const totalItems = rowCount * colCount;
  const highlightedCount = highlighted.cells.size;

  return (
    <div className={`w-full max-w-6xl mx-auto my-16 animate-fade-in ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8 justify-center">
        <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center border border-green-500/30 text-green-400 shadow-[0_0_20px_rgba(34,197,94,0.2)]">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
            />
          </svg>
        </div>
        <div className="text-left">
          <h2 className="text-2xl font-bold text-white tracking-tight">Array / Grid</h2>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
            <p className="text-xs text-green-400 font-mono uppercase tracking-wider">
              Multiplication & Combinatorics
            </p>
          </div>
        </div>
      </div>

      <div className="glass-panel p-8 md:p-12 rounded-3xl border border-green-500/20 relative overflow-hidden">
        {/* Background Texture */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'radial-gradient(#22c55e 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        ></div>

        <div className="relative z-10 w-full">
          <div className="mb-8 text-center max-w-3xl mx-auto">
            <h3 className="text-xl font-bold text-white mb-2">{data.title}</h3>
            <p className="text-slate-300 font-light">{data.description}</p>
          </div>

          {/* Equation Display */}
          <div className="mb-6 text-center">
            <div className="inline-flex items-center gap-3 text-2xl font-bold font-mono">
              <span className="text-green-300">{rowCount}</span>
              <span className="text-slate-500">×</span>
              <span className="text-blue-300">{colCount}</span>
              <span className="text-slate-500">=</span>
              <span className="text-purple-300">{totalItems}</span>
            </div>
            {highlightedCount > 0 && (
              <div className="mt-2 text-sm text-slate-400">
                Selected: <span className="text-purple-300 font-bold">{highlightedCount}</span> items
              </div>
            )}
          </div>

          {/* Array Grid */}
          <div className="flex justify-center items-center">
            <div className="relative inline-block">
              {/* Column Labels */}
              {showColumnLabels && (
                <div className="flex mb-2" style={{ marginLeft: showRowLabels ? '40px' : '0' }}>
                  {Array.from({ length: colCount }).map((_, index) => (
                    <div
                      key={`col-label-${index}`}
                      className="flex items-center justify-center text-blue-300 font-mono font-bold text-sm w-16"
                    >
                      {index + 1}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex">
                {/* Row Labels */}
                {showRowLabels && (
                  <div className="flex flex-col mr-2">
                    {Array.from({ length: rowCount }).map((_, index) => (
                      <div
                        key={`row-label-${index}`}
                        className="flex items-center justify-center text-green-300 font-mono font-bold text-sm h-16 w-10"
                      >
                        {index + 1}
                      </div>
                    ))}
                  </div>
                )}

                {/* Grid */}
                <div className="relative">
                  <div
                    className="grid gap-2"
                    style={{
                      gridTemplateColumns: `repeat(${colCount}, 64px)`,
                    }}
                  >
                    {Array.from({ length: rowCount }).map((_, rowIndex) =>
                      Array.from({ length: colCount }).map((_, colIndex) => {
                        const isHighlighted = isCellHighlighted(rowIndex, colIndex);
                        const cellKey = `${rowIndex}-${colIndex}`;

                        return (
                          <button
                            key={cellKey}
                            onClick={() => handleClick(rowIndex, colIndex)}
                            className={`
                              w-16 h-16 rounded-lg flex items-center justify-center
                              transition-all duration-200 cursor-pointer
                              border-2
                              ${
                                isHighlighted
                                  ? 'bg-purple-500/30 border-purple-400 scale-105'
                                  : 'bg-slate-800/30 border-slate-600 hover:bg-slate-700/50 hover:border-slate-500'
                              }
                            `}
                            title={`Cell (${rowIndex + 1}, ${colIndex + 1})`}
                          >
                            {renderIcon(rowIndex, colIndex)}
                          </button>
                        );
                      })
                    )}
                  </div>

                  {/* Partition Lines */}
                  {partitionLines.map((line, index) => {
                    if (line.type === 'row') {
                      return (
                        <div
                          key={`partition-row-${index}`}
                          className="absolute left-0 right-0 h-0.5 bg-yellow-400/60"
                          style={{
                            top: `${line.index * 68 - 4}px`, // 64px cell + 4px gap
                          }}
                        />
                      );
                    } else {
                      return (
                        <div
                          key={`partition-col-${index}`}
                          className="absolute top-0 bottom-0 w-0.5 bg-yellow-400/60"
                          style={{
                            left: `${line.index * 68 - 4}px`,
                          }}
                        />
                      );
                    }
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Controls */}
          {animateSkipCounting && (
            <div className="mt-8 flex justify-center">
              <button
                onClick={startSkipCountingAnimation}
                disabled={isAnimating}
                className="px-6 py-3 bg-gradient-to-r from-green-500 to-blue-500 text-white font-bold rounded-lg
                  hover:from-green-600 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed
                  transition-all duration-200 shadow-lg"
              >
                {isAnimating ? 'Counting...' : 'Animate Skip Counting'}
              </button>
            </div>
          )}

          {/* Info Panel */}
          <div className="mt-8 p-6 bg-slate-800/30 rounded-xl border border-slate-700">
            <h4 className="text-sm font-mono uppercase tracking-wider text-slate-400 mb-3">Array Information</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400"></span>
                <span className="text-sm text-slate-300">
                  Rows: <span className="text-white font-bold">{rowCount}</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                <span className="text-sm text-slate-300">
                  Columns: <span className="text-white font-bold">{colCount}</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                <span className="text-sm text-slate-300">
                  Total: <span className="text-white font-bold">{totalItems}</span>
                </span>
              </div>
            </div>

            {/* Multiplication Interpretation */}
            <div className="mt-4 pt-4 border-t border-slate-600">
              <p className="text-sm text-slate-300 mb-2">
                This array shows <span className="text-green-300 font-bold">{rowCount} rows</span> of{' '}
                <span className="text-blue-300 font-bold">{colCount} {iconType}s</span> each.
              </p>
              <p className="text-sm text-slate-300">
                Total: {rowCount} × {colCount} = <span className="text-purple-300 font-bold">{totalItems}</span>
              </p>
            </div>
          </div>

          {/* Instructions */}
          <div className="mt-6 p-6 bg-slate-800/30 rounded-xl border border-slate-700">
            <h4 className="text-sm font-mono uppercase tracking-wider text-slate-400 mb-3">
              Interactive Controls
            </h4>
            <ul className="text-sm text-slate-300 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-1">▸</span>
                <span>Click on {highlightMode}s to highlight and explore the array</span>
              </li>
              {animateSkipCounting && (
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-1">▸</span>
                  <span>Use the animation button to see skip counting by rows</span>
                </li>
              )}
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-1">▸</span>
                <span>Arrays help visualize multiplication as repeated addition or equal groups</span>
              </li>
              {partitionLines.length > 0 && (
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-1">▸</span>
                  <span>Yellow lines show how the array can be partitioned into smaller groups</span>
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ArrayGrid;
