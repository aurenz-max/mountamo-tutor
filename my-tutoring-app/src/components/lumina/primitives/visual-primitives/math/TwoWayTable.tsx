'use client';

import React, { useState, useMemo, useCallback } from 'react';

export interface TwoWayTableData {
  title: string;
  description: string;
  rowCategories: string[];
  columnCategories: string[];
  frequencies: number[][];
  showTotals: boolean;
  displayMode: 'table' | 'venn' | 'both';
  showProbabilities: boolean;
  editable: boolean;
  highlightedCells?: { row: number; col: number }[];
  questionPrompt?: string;
}

interface TwoWayTableProps {
  data: TwoWayTableData;
  className?: string;
}

type InfoType = 'joint' | 'marginal' | 'conditional' | 'total' | null;

interface StatCardInfo {
  title: string;
  description: string;
  example: string;
  icon: React.ReactNode;
}

const statExplanations: Record<Exclude<InfoType, null>, StatCardInfo> = {
  joint: {
    title: 'Joint Frequency',
    description: 'The count or probability of two events occurring together. Found in the inner cells of the table where a row and column category intersect.',
    example: 'P(Male AND Prefers Dogs) = count in that cell / total count',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
  },
  marginal: {
    title: 'Marginal Frequency',
    description: 'The total count or probability for a single category, regardless of the other category. Found in the row and column totals.',
    example: 'P(Male) = total males / grand total',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
      </svg>
    ),
  },
  conditional: {
    title: 'Conditional Probability',
    description: 'The probability of one event given that another event has occurred. Calculated by dividing a joint frequency by a marginal frequency.',
    example: 'P(Prefers Dogs | Male) = P(Male AND Dogs) / P(Male)',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  total: {
    title: 'Grand Total',
    description: 'The sum of all observations in the entire dataset. This is used as the denominator when calculating relative frequencies.',
    example: 'Grand Total = sum of all cells = sum of row totals = sum of column totals',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
      </svg>
    ),
  },
};

const TwoWayTable: React.FC<TwoWayTableProps> = ({ data, className }) => {
  const {
    title,
    description,
    rowCategories = ['Category A', 'Category B'],
    columnCategories = ['Group 1', 'Group 2'],
    frequencies: initialFrequencies = [[10, 15], [20, 25]],
    showTotals = true,
    displayMode: initialDisplayMode = 'table',
    showProbabilities: initialShowProbabilities = false,
    editable = true,
    highlightedCells = [],
    questionPrompt,
  } = data;

  const [frequencies, setFrequencies] = useState<number[][]>(initialFrequencies);
  const [displayMode, setDisplayMode] = useState<'table' | 'venn' | 'both'>(initialDisplayMode);
  const [showProbabilities, setShowProbabilities] = useState<boolean>(initialShowProbabilities);
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [hoveredInfo, setHoveredInfo] = useState<InfoType>(null);
  const [showConceptsPanel, setShowConceptsPanel] = useState<boolean>(false);
  const [shadedVennRegion, setShadedVennRegion] = useState<'A' | 'B' | 'both' | 'neither' | null>(null);

  // Calculate totals
  const rowTotals = useMemo(() => {
    return frequencies.map(row => row.reduce((sum, val) => sum + val, 0));
  }, [frequencies]);

  const columnTotals = useMemo(() => {
    return frequencies[0]?.map((_, colIndex) =>
      frequencies.reduce((sum, row) => sum + (row[colIndex] || 0), 0)
    ) || [];
  }, [frequencies]);

  const grandTotal = useMemo(() => {
    return rowTotals.reduce((sum, val) => sum + val, 0);
  }, [rowTotals]);

  // Calculate probabilities
  const getProbability = useCallback((value: number) => {
    if (grandTotal === 0) return '0%';
    return `${((value / grandTotal) * 100).toFixed(1)}%`;
  }, [grandTotal]);

  // Handle cell value change
  const handleCellChange = useCallback((rowIndex: number, colIndex: number, value: string) => {
    const numValue = parseInt(value, 10) || 0;
    setFrequencies(prev => {
      const newFreqs = prev.map(row => [...row]);
      newFreqs[rowIndex][colIndex] = Math.max(0, numValue);
      return newFreqs;
    });
  }, []);

  // Check if cell is highlighted
  const isCellHighlighted = useCallback((row: number, col: number) => {
    return highlightedCells.some(cell => cell.row === row && cell.col === col);
  }, [highlightedCells]);

  // Get conditional probability
  const getConditionalProbability = useCallback((row: number, col: number, givenRow: boolean) => {
    if (givenRow) {
      const rowTotal = rowTotals[row];
      if (rowTotal === 0) return '0%';
      return `${((frequencies[row][col] / rowTotal) * 100).toFixed(1)}%`;
    } else {
      const colTotal = columnTotals[col];
      if (colTotal === 0) return '0%';
      return `${((frequencies[row][col] / colTotal) * 100).toFixed(1)}%`;
    }
  }, [frequencies, rowTotals, columnTotals]);

  // Calculate Venn diagram values for 2x2 table
  const vennData = useMemo(() => {
    if (frequencies.length !== 2 || frequencies[0]?.length !== 2) {
      return null;
    }

    // Interpretation for 2x2 table as sets A and B:
    // A = first row category (e.g., "Male")
    // B = first column category (e.g., "Prefers Dogs")
    //
    // Cell mapping:
    // frequencies[0][0] = A ∩ B (both)
    // frequencies[0][1] = A ∩ B' (A only, not B)
    // frequencies[1][0] = A' ∩ B (B only, not A)
    // frequencies[1][1] = A' ∩ B' (neither)

    const both = frequencies[0][0];           // A and B
    const aOnly = frequencies[0][1];          // A only (not B)
    const bOnly = frequencies[1][0];          // B only (not A)
    const neither = frequencies[1][1];        // Neither A nor B

    const totalA = both + aOnly;              // Total in set A
    const totalB = both + bOnly;              // Total in set B
    const total = both + aOnly + bOnly + neither;

    return {
      both,
      aOnly,
      bOnly,
      neither,
      totalA,
      totalB,
      total,
    };
  }, [frequencies]);

  // Calculate circle sizes and positions dynamically based on data
  const vennGeometry = useMemo(() => {
    if (!vennData || vennData.total === 0) {
      return {
        radiusA: 80,
        radiusB: 80,
        centerAx: 160,
        centerBx: 240,
        centerY: 150,
        overlap: 40,
      };
    }

    const { totalA, totalB, both, total } = vennData;

    // Base dimensions
    const viewWidth = 400;
    const viewHeight = 300;
    const centerY = viewHeight / 2;
    const maxRadius = 100;
    const minRadius = 40;

    // Calculate radii proportional to set sizes (using sqrt for area proportion)
    const proportionA = totalA / total;
    const proportionB = totalB / total;

    const radiusA = minRadius + (maxRadius - minRadius) * Math.sqrt(proportionA);
    const radiusB = minRadius + (maxRadius - minRadius) * Math.sqrt(proportionB);

    // Calculate overlap based on intersection
    // The overlap distance determines how much the circles overlap
    // When both = 0, circles should not overlap
    // When both = min(totalA, totalB), maximum overlap
    const minSet = Math.min(totalA, totalB);
    const overlapRatio = minSet > 0 ? both / minSet : 0;

    // Calculate distance between centers
    // When overlapRatio = 0, circles just touch (distance = radiusA + radiusB)
    // When overlapRatio = 1, maximum overlap
    const maxSeparation = radiusA + radiusB;
    const minSeparation = Math.abs(radiusA - radiusB); // One inside the other

    // Linear interpolation between no overlap and maximum overlap
    const separation = maxSeparation - (maxSeparation - minSeparation * 0.5) * overlapRatio;

    // Center positions
    const totalWidth = separation + radiusA + radiusB;
    const startX = (viewWidth - totalWidth) / 2 + radiusA;

    const centerAx = startX;
    const centerBx = startX + separation;

    return {
      radiusA,
      radiusB,
      centerAx,
      centerBx,
      centerY,
      overlap: (radiusA + radiusB) - separation, // Actual pixel overlap
    };
  }, [vennData]);

  // Render Venn Diagram with dynamic sizing
  const renderVennDiagram = () => {
    if (!vennData) {
      return (
        <div className="flex items-center justify-center p-6 text-slate-400">
          <p>Venn diagram requires a 2x2 table</p>
        </div>
      );
    }

    const { both, aOnly, bOnly, neither } = vennData;
    const { radiusA, radiusB, centerAx, centerBx, centerY } = vennGeometry;

    // Calculate label positions
    // A-only label: to the left of center A, away from intersection
    const aOnlyLabelX = centerAx - radiusA * 0.5;
    // B-only label: to the right of center B, away from intersection
    const bOnlyLabelX = centerBx + radiusB * 0.5;
    // Both label: midpoint between centers
    const bothLabelX = (centerAx + centerBx) / 2;

    return (
      <div className="flex justify-center items-center p-6">
        <svg viewBox="0 0 400 300" className="w-full max-w-lg h-auto">
          <defs>
            {/* Clip path for intersection */}
            <clipPath id="clipCircleA">
              <circle cx={centerAx} cy={centerY} r={radiusA} />
            </clipPath>
            <clipPath id="clipCircleB">
              <circle cx={centerBx} cy={centerY} r={radiusB} />
            </clipPath>
          </defs>

          {/* Background rectangle for "neither" */}
          <rect
            x="20"
            y="20"
            width="360"
            height="260"
            fill={shadedVennRegion === 'neither' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(51, 65, 85, 0.3)'}
            stroke="#475569"
            strokeWidth="2"
            rx="8"
            className="cursor-pointer transition-all duration-300"
            onClick={() => setShadedVennRegion(prev => prev === 'neither' ? null : 'neither')}
          />

          {/* Circle A (left) - base fill */}
          <circle
            cx={centerAx}
            cy={centerY}
            r={radiusA}
            fill={shadedVennRegion === 'A' ? 'rgba(59, 130, 246, 0.5)' : 'rgba(59, 130, 246, 0.25)'}
            stroke="#3b82f6"
            strokeWidth="3"
            className="cursor-pointer transition-all duration-300"
            onClick={() => setShadedVennRegion(prev => prev === 'A' ? null : 'A')}
          />

          {/* Circle B (right) - base fill */}
          <circle
            cx={centerBx}
            cy={centerY}
            r={radiusB}
            fill={shadedVennRegion === 'B' ? 'rgba(16, 185, 129, 0.5)' : 'rgba(16, 185, 129, 0.25)'}
            stroke="#10b981"
            strokeWidth="3"
            className="cursor-pointer transition-all duration-300"
            onClick={() => setShadedVennRegion(prev => prev === 'B' ? null : 'B')}
          />

          {/* Intersection (clipped circle B inside circle A) */}
          {both > 0 && (
            <circle
              cx={centerBx}
              cy={centerY}
              r={radiusB}
              clipPath="url(#clipCircleA)"
              fill={shadedVennRegion === 'both' ? 'rgba(139, 92, 246, 0.6)' : 'rgba(139, 92, 246, 0.35)'}
              className="cursor-pointer transition-all duration-300"
              onClick={() => setShadedVennRegion(prev => prev === 'both' ? null : 'both')}
            />
          )}

          {/* Re-draw circle borders on top for cleaner appearance */}
          <circle
            cx={centerAx}
            cy={centerY}
            r={radiusA}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="3"
          />
          <circle
            cx={centerBx}
            cy={centerY}
            r={radiusB}
            fill="none"
            stroke="#10b981"
            strokeWidth="3"
          />

          {/* Labels for values */}
          {aOnly > 0 && (
            <text
              x={aOnlyLabelX}
              y={centerY}
              fill="#93c5fd"
              fontSize="22"
              fontWeight="bold"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {aOnly}
            </text>
          )}

          {both > 0 && (
            <text
              x={bothLabelX}
              y={centerY}
              fill="#c4b5fd"
              fontSize="22"
              fontWeight="bold"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {both}
            </text>
          )}

          {bOnly > 0 && (
            <text
              x={bOnlyLabelX}
              y={centerY}
              fill="#6ee7b7"
              fontSize="22"
              fontWeight="bold"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {bOnly}
            </text>
          )}

          {neither > 0 && (
            <text
              x="360"
              y="260"
              fill="#94a3b8"
              fontSize="16"
              textAnchor="end"
            >
              {neither}
            </text>
          )}

          {/* Category labels above circles */}
          <text
            x={centerAx}
            y={centerY - radiusA - 15}
            fill="#3b82f6"
            fontSize="14"
            fontWeight="bold"
            textAnchor="middle"
          >
            {rowCategories[0] || 'Set A'}
          </text>
          <text
            x={centerBx}
            y={centerY - radiusB - 15}
            fill="#10b981"
            fontSize="14"
            fontWeight="bold"
            textAnchor="middle"
          >
            {columnCategories[0] || 'Set B'}
          </text>

          {/* Set size annotations */}
          <text
            x={centerAx}
            y={centerY + radiusA + 20}
            fill="#94a3b8"
            fontSize="11"
            textAnchor="middle"
          >
            n = {vennData.totalA}
          </text>
          <text
            x={centerBx}
            y={centerY + radiusB + 20}
            fill="#94a3b8"
            fontSize="11"
            textAnchor="middle"
          >
            n = {vennData.totalB}
          </text>

          {/* Neither label */}
          <text x="360" y="40" fill="#94a3b8" fontSize="12" textAnchor="end">
            Neither
          </text>
        </svg>
      </div>
    );
  };

  return (
    <div className={`w-full max-w-5xl mx-auto my-16 animate-fade-in ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8 justify-center">
        <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center border border-purple-500/30 text-purple-400 shadow-[0_0_20px_rgba(139,92,246,0.2)]">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
        </div>
        <div className="text-left">
          <h2 className="text-2xl font-bold text-white tracking-tight">Two-Way Table</h2>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse"></span>
            <p className="text-xs text-purple-400 font-mono uppercase tracking-wider">Categorical Data Analysis</p>
          </div>
        </div>
      </div>

      <div className="glass-panel p-8 md:p-12 rounded-3xl border border-purple-500/20 relative overflow-hidden">
        {/* Background Texture */}
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(#8b5cf6 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        ></div>

        <div className="relative z-10">
          {/* Title and Description */}
          <div className="mb-8 text-center max-w-2xl mx-auto">
            <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
            <p className="text-slate-300 font-light">{description}</p>
            {questionPrompt && (
              <p className="mt-4 text-purple-300 italic bg-purple-500/10 px-4 py-2 rounded-lg border border-purple-500/20">
                {questionPrompt}
              </p>
            )}
          </div>

          {/* Display Mode Toggle */}
          <div className="flex flex-wrap justify-center gap-4 mb-6">
            <div className="flex items-center gap-2 bg-slate-800/50 rounded-lg p-1">
              <button
                onClick={() => setDisplayMode('table')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  displayMode === 'table'
                    ? 'bg-purple-600/50 text-purple-200 border border-purple-500/50'
                    : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                Table View
              </button>
              <button
                onClick={() => setDisplayMode('venn')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  displayMode === 'venn'
                    ? 'bg-purple-600/50 text-purple-200 border border-purple-500/50'
                    : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                Venn Diagram
              </button>
              <button
                onClick={() => setDisplayMode('both')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  displayMode === 'both'
                    ? 'bg-purple-600/50 text-purple-200 border border-purple-500/50'
                    : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                Both
              </button>
            </div>

            <button
              onClick={() => setShowProbabilities(!showProbabilities)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                showProbabilities
                  ? 'bg-amber-600/50 text-amber-200 border border-amber-500/50'
                  : 'bg-slate-700/50 text-slate-400 border border-slate-600 hover:text-slate-300'
              }`}
            >
              {showProbabilities ? 'Show Frequencies' : 'Show Probabilities'}
            </button>
          </div>

          {/* Table View */}
          {(displayMode === 'table' || displayMode === 'both') && (
            <div className="relative bg-slate-800/30 rounded-xl p-6 mb-6 overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="p-3 text-slate-500 font-medium"></th>
                    {columnCategories.map((col, index) => (
                      <th key={index} className="p-3 text-purple-300 font-bold text-center border-b border-slate-700">
                        {col}
                      </th>
                    ))}
                    {showTotals && (
                      <th className="p-3 text-amber-400 font-bold text-center border-b border-slate-700 border-l-2 border-l-slate-600">
                        Total
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {frequencies.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      <td className="p-3 text-blue-300 font-bold border-r border-slate-700">
                        {rowCategories[rowIndex] || `Row ${rowIndex + 1}`}
                      </td>
                      {row.map((cell, colIndex) => {
                        const isHovered = hoveredCell?.row === rowIndex && hoveredCell?.col === colIndex;
                        const isSelected = selectedCell?.row === rowIndex && selectedCell?.col === colIndex;
                        const isHighlighted = isCellHighlighted(rowIndex, colIndex);

                        return (
                          <td
                            key={colIndex}
                            className={`p-3 text-center border border-slate-700 transition-all duration-200 ${
                              isHighlighted
                                ? 'bg-purple-500/30 border-purple-400'
                                : isHovered
                                ? 'bg-slate-700/80'
                                : isSelected
                                ? 'bg-purple-500/20 border-purple-500'
                                : 'hover:bg-slate-700/50'
                            }`}
                            onMouseEnter={() => setHoveredCell({ row: rowIndex, col: colIndex })}
                            onMouseLeave={() => setHoveredCell(null)}
                            onClick={() => setSelectedCell(prev =>
                              prev?.row === rowIndex && prev?.col === colIndex
                                ? null
                                : { row: rowIndex, col: colIndex }
                            )}
                          >
                            {editable ? (
                              <input
                                type="number"
                                value={cell}
                                onChange={(e) => handleCellChange(rowIndex, colIndex, e.target.value)}
                                className="w-16 text-center bg-transparent text-white text-lg font-mono focus:outline-none focus:ring-2 focus:ring-purple-500 rounded"
                                min="0"
                              />
                            ) : (
                              <span className="text-white text-lg font-mono">
                                {showProbabilities ? getProbability(cell) : cell}
                              </span>
                            )}
                            {showProbabilities && !editable && (
                              <div className="text-xs text-slate-400 mt-1">({cell})</div>
                            )}
                          </td>
                        );
                      })}
                      {showTotals && (
                        <td className="p-3 text-center border-l-2 border-l-slate-600 bg-slate-800/50">
                          <span className="text-amber-400 font-bold font-mono">
                            {showProbabilities ? getProbability(rowTotals[rowIndex]) : rowTotals[rowIndex]}
                          </span>
                        </td>
                      )}
                    </tr>
                  ))}
                  {showTotals && (
                    <tr className="border-t-2 border-t-slate-600">
                      <td className="p-3 text-amber-400 font-bold border-r border-slate-700">Total</td>
                      {columnTotals.map((total, index) => (
                        <td key={index} className="p-3 text-center bg-slate-800/50">
                          <span className="text-amber-400 font-bold font-mono">
                            {showProbabilities ? getProbability(total) : total}
                          </span>
                        </td>
                      ))}
                      <td className="p-3 text-center bg-purple-500/20 border-l-2 border-l-slate-600">
                        <span className="text-purple-300 font-bold text-xl font-mono">
                          {showProbabilities ? '100%' : grandTotal}
                        </span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Selected Cell Info */}
              {selectedCell && (
                <div className="mt-4 p-4 bg-slate-800 rounded-lg border border-purple-500/30">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="text-slate-400 mb-1">Joint Frequency</div>
                      <div className="text-purple-300 font-mono text-lg">
                        P({rowCategories[selectedCell.row]} ∩ {columnCategories[selectedCell.col]}) = {getProbability(frequencies[selectedCell.row][selectedCell.col])}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400 mb-1">Conditional (Given Row)</div>
                      <div className="text-blue-300 font-mono text-lg">
                        P({columnCategories[selectedCell.col]} | {rowCategories[selectedCell.row]}) = {getConditionalProbability(selectedCell.row, selectedCell.col, true)}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400 mb-1">Conditional (Given Column)</div>
                      <div className="text-emerald-300 font-mono text-lg">
                        P({rowCategories[selectedCell.row]} | {columnCategories[selectedCell.col]}) = {getConditionalProbability(selectedCell.row, selectedCell.col, false)}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Venn Diagram View */}
          {(displayMode === 'venn' || displayMode === 'both') && (
            <div className="relative bg-slate-800/30 rounded-xl p-6 mb-6">
              <div className="text-center mb-4">
                <p className="text-sm text-slate-400">
                  Click on regions to highlight them. Circle sizes are proportional to set sizes.
                </p>
              </div>
              {renderVennDiagram()}
              <div className="flex flex-wrap justify-center gap-4 mt-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-blue-500/50 border border-blue-500"></div>
                  <span className="text-blue-300">{rowCategories[0]} only</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-purple-500/50 border border-purple-500"></div>
                  <span className="text-purple-300">Both</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-emerald-500/50 border border-emerald-500"></div>
                  <span className="text-emerald-300">{columnCategories[0]} only</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-slate-600/50 border border-slate-500"></div>
                  <span className="text-slate-300">Neither</span>
                </div>
              </div>
            </div>
          )}

          {/* Concepts Panel */}
          <div className="mt-6">
            <button
              onClick={() => setShowConceptsPanel(!showConceptsPanel)}
              className="flex items-center gap-2 mb-4 text-sm text-slate-400 hover:text-purple-400 transition-colors"
            >
              <svg className={`w-4 h-4 transition-transform ${showConceptsPanel ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
              Probability Concepts
            </button>

            {showConceptsPanel && (
              <div className="relative">
                {/* Explanation tooltip */}
                {hoveredInfo && (
                  <div className="absolute bottom-full left-0 right-0 mb-4 p-4 bg-slate-800/90 backdrop-blur-sm rounded-xl border border-purple-500/30 pointer-events-none z-20 animate-fade-in">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400">
                        {statExplanations[hoveredInfo].icon}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-purple-400 mb-1">
                          {statExplanations[hoveredInfo].title}
                        </h4>
                        <p className="text-sm text-slate-300 mb-2">
                          {statExplanations[hoveredInfo].description}
                        </p>
                        <p className="text-xs text-slate-400 italic">
                          {statExplanations[hoveredInfo].example}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in">
                  {/* Joint */}
                  <div
                    className={`relative p-4 rounded-xl border transition-all duration-300 cursor-help group ${
                      hoveredInfo === 'joint'
                        ? 'bg-slate-700/80 border-purple-400/50 shadow-[0_0_20px_rgba(139,92,246,0.2)]'
                        : 'bg-slate-800/50 border-slate-700/50 hover:border-purple-500/30'
                    }`}
                    onMouseEnter={() => setHoveredInfo('joint')}
                    onMouseLeave={() => setHoveredInfo(null)}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`p-1.5 rounded-lg transition-colors ${
                        hoveredInfo === 'joint' ? 'bg-purple-500/30 text-purple-300' : 'bg-slate-700/50 text-slate-400'
                      }`}>
                        {statExplanations.joint.icon}
                      </div>
                      <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">Joint</span>
                    </div>
                    <div className="text-sm text-purple-300 font-mono">P(A ∩ B)</div>
                    <div className="text-xs text-slate-500 mt-1">Cell values</div>
                  </div>

                  {/* Marginal */}
                  <div
                    className={`relative p-4 rounded-xl border transition-all duration-300 cursor-help group ${
                      hoveredInfo === 'marginal'
                        ? 'bg-slate-700/80 border-purple-400/50 shadow-[0_0_20px_rgba(139,92,246,0.2)]'
                        : 'bg-slate-800/50 border-slate-700/50 hover:border-purple-500/30'
                    }`}
                    onMouseEnter={() => setHoveredInfo('marginal')}
                    onMouseLeave={() => setHoveredInfo(null)}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`p-1.5 rounded-lg transition-colors ${
                        hoveredInfo === 'marginal' ? 'bg-purple-500/30 text-purple-300' : 'bg-slate-700/50 text-slate-400'
                      }`}>
                        {statExplanations.marginal.icon}
                      </div>
                      <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">Marginal</span>
                    </div>
                    <div className="text-sm text-amber-300 font-mono">P(A) or P(B)</div>
                    <div className="text-xs text-slate-500 mt-1">Row/Col totals</div>
                  </div>

                  {/* Conditional */}
                  <div
                    className={`relative p-4 rounded-xl border transition-all duration-300 cursor-help group ${
                      hoveredInfo === 'conditional'
                        ? 'bg-slate-700/80 border-purple-400/50 shadow-[0_0_20px_rgba(139,92,246,0.2)]'
                        : 'bg-slate-800/50 border-slate-700/50 hover:border-purple-500/30'
                    }`}
                    onMouseEnter={() => setHoveredInfo('conditional')}
                    onMouseLeave={() => setHoveredInfo(null)}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`p-1.5 rounded-lg transition-colors ${
                        hoveredInfo === 'conditional' ? 'bg-purple-500/30 text-purple-300' : 'bg-slate-700/50 text-slate-400'
                      }`}>
                        {statExplanations.conditional.icon}
                      </div>
                      <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">Conditional</span>
                    </div>
                    <div className="text-sm text-blue-300 font-mono">P(A | B)</div>
                    <div className="text-xs text-slate-500 mt-1">Click cell to see</div>
                  </div>

                  {/* Total */}
                  <div
                    className={`relative p-4 rounded-xl border transition-all duration-300 cursor-help group ${
                      hoveredInfo === 'total'
                        ? 'bg-slate-700/80 border-purple-400/50 shadow-[0_0_20px_rgba(139,92,246,0.2)]'
                        : 'bg-slate-800/50 border-slate-700/50 hover:border-purple-500/30'
                    }`}
                    onMouseEnter={() => setHoveredInfo('total')}
                    onMouseLeave={() => setHoveredInfo(null)}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`p-1.5 rounded-lg transition-colors ${
                        hoveredInfo === 'total' ? 'bg-purple-500/30 text-purple-300' : 'bg-slate-700/50 text-slate-400'
                      }`}>
                        {statExplanations.total.icon}
                      </div>
                      <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">Grand Total</span>
                    </div>
                    <div className="text-2xl font-bold text-white">{grandTotal}</div>
                    <div className="text-xs text-slate-500 mt-1">observations</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Instructions */}
          {editable && (
            <div className="mt-4 text-center">
              <p className="text-xs text-slate-500 italic">
                Click cells to view conditional probabilities. Edit values to explore how frequencies affect the analysis.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TwoWayTable;
