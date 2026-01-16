'use client';

import React, { useState, useMemo, useCallback } from 'react';

export interface HistogramData {
  title: string;
  description: string;
  data: number[];
  binWidth: number;
  binStart: number;
  showFrequency: boolean;
  showCurve: boolean;
  editable: boolean;
  xAxisLabel?: string;
  yAxisLabel?: string;
}

interface HistogramProps {
  data: HistogramData;
  className?: string;
}

interface Bin {
  start: number;
  end: number;
  count: number;
  values: number[];
}

type StatType = 'count' | 'mean' | 'stdDev' | 'min' | 'max' | 'shape' | null;

interface StatCardInfo {
  title: string;
  description: string;
  example: string;
  icon: React.ReactNode;
}

const statExplanations: Record<Exclude<StatType, null>, StatCardInfo> = {
  count: {
    title: 'Count',
    description: 'The total number of data points in the dataset. More data points generally give more reliable statistics.',
    example: 'If you measured the heights of 25 students, the count is 25.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
      </svg>
    ),
  },
  mean: {
    title: 'Mean (Average)',
    description: 'Add up all the values and divide by the count. The mean shows the "balance point" of your data and is sensitive to outliers.',
    example: 'For values 10, 20, 30: Mean = (10+20+30) / 3 = 20',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
  },
  stdDev: {
    title: 'Standard Deviation',
    description: 'Measures how spread out the data is from the mean. A low value means data points are clustered near the mean; a high value means they are more spread out.',
    example: 'Test scores of 70, 70, 70 have std dev = 0 (no spread). Scores of 50, 70, 90 have a higher std dev.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    ),
  },
  min: {
    title: 'Minimum',
    description: 'The smallest value in the dataset. Together with the maximum, it defines the range of your data.',
    example: 'For values 5, 12, 8, 3, 15: Min = 3 (the smallest)',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
      </svg>
    ),
  },
  max: {
    title: 'Maximum',
    description: 'The largest value in the dataset. Together with the minimum, it defines the range of your data.',
    example: 'For values 5, 12, 8, 3, 15: Max = 15 (the largest)',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
      </svg>
    ),
  },
  shape: {
    title: 'Shape (Skewness)',
    description: 'Describes the asymmetry of the distribution. Symmetric means data is evenly distributed around the mean. Right-skewed has a longer tail on the right (more high outliers). Left-skewed has a longer tail on the left (more low outliers).',
    example: 'Income data is often right-skewed (most people earn moderate amounts, few earn very high).',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
      </svg>
    ),
  },
};

const Histogram: React.FC<HistogramProps> = ({ data, className }) => {
  const {
    title,
    description,
    data: initialData = [],
    binWidth: initialBinWidth = 10,
    binStart: initialBinStart = 0,
    showFrequency,
    showCurve,
    editable,
    xAxisLabel = 'Value',
    yAxisLabel = 'Frequency',
  } = data;

  const [dataPoints, setDataPoints] = useState<number[]>(initialData);
  const [binWidth, setBinWidth] = useState<number>(initialBinWidth);
  const [binStart, setBinStart] = useState<number>(initialBinStart);
  const [hoveredBin, setHoveredBin] = useState<number | null>(null);
  const [newValue, setNewValue] = useState<string>('');
  const [showDistributionInfo, setShowDistributionInfo] = useState<boolean>(false);
  const [hoveredStat, setHoveredStat] = useState<StatType>(null);

  // Calculate bins from data
  const bins = useMemo<Bin[]>(() => {
    if (dataPoints.length === 0) return [];

    const min = Math.min(...dataPoints);
    const max = Math.max(...dataPoints);

    // Adjust binStart if necessary
    const effectiveBinStart = binStart <= min ? binStart : Math.floor(min / binWidth) * binWidth;
    const binEnd = Math.ceil((max - effectiveBinStart) / binWidth) * binWidth + effectiveBinStart;

    const numBins = Math.ceil((binEnd - effectiveBinStart) / binWidth);
    const result: Bin[] = [];

    for (let i = 0; i < numBins; i++) {
      const start = effectiveBinStart + i * binWidth;
      const end = start + binWidth;
      const values = dataPoints.filter(v => v >= start && v < end);
      result.push({
        start,
        end,
        count: values.length,
        values,
      });
    }

    return result;
  }, [dataPoints, binWidth, binStart]);

  // Calculate statistics
  const stats = useMemo(() => {
    if (dataPoints.length === 0) {
      return { mean: 0, stdDev: 0, min: 0, max: 0, count: 0, skew: 'N/A' };
    }

    const n = dataPoints.length;
    const mean = dataPoints.reduce((a, b) => a + b, 0) / n;
    const variance = dataPoints.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);
    const min = Math.min(...dataPoints);
    const max = Math.max(...dataPoints);

    // Calculate skewness
    let skew = 'Symmetric';
    if (n >= 3 && stdDev > 0) {
      const skewness = dataPoints.reduce((sum, x) => sum + Math.pow((x - mean) / stdDev, 3), 0) / n;
      if (skewness > 0.5) skew = 'Right-skewed';
      else if (skewness < -0.5) skew = 'Left-skewed';
    }

    return { mean, stdDev, min, max, count: n, skew };
  }, [dataPoints]);

  // Maximum frequency for scaling
  const maxFrequency = useMemo(() => {
    if (bins.length === 0) return 1;
    return Math.max(...bins.map(b => b.count), 1);
  }, [bins]);

  // Normal curve points for overlay
  const normalCurvePoints = useMemo(() => {
    if (!showCurve || dataPoints.length < 2 || stats.stdDev === 0) return [];

    const points: { x: number; y: number }[] = [];
    const { mean, stdDev } = stats;

    // Generate points across the range
    const rangeMin = bins.length > 0 ? bins[0].start : mean - 3 * stdDev;
    const rangeMax = bins.length > 0 ? bins[bins.length - 1].end : mean + 3 * stdDev;
    const step = (rangeMax - rangeMin) / 100;

    for (let x = rangeMin; x <= rangeMax; x += step) {
      // Normal distribution PDF scaled to match histogram
      const exponent = -0.5 * Math.pow((x - mean) / stdDev, 2);
      const pdf = (1 / (stdDev * Math.sqrt(2 * Math.PI))) * Math.exp(exponent);
      // Scale to match histogram area
      const y = pdf * dataPoints.length * binWidth;
      points.push({ x, y });
    }

    return points;
  }, [showCurve, dataPoints, stats, bins, binWidth]);

  // Handle adding new data point
  const handleAddValue = useCallback(() => {
    const value = parseFloat(newValue);
    if (!isNaN(value)) {
      setDataPoints(prev => [...prev, value]);
      setNewValue('');
    }
  }, [newValue]);

  // Handle removing a data point from a bin
  const handleRemoveFromBin = useCallback((binIndex: number) => {
    if (!editable || bins[binIndex].count === 0) return;

    const bin = bins[binIndex];
    const valueToRemove = bin.values[bin.values.length - 1];
    const index = dataPoints.lastIndexOf(valueToRemove);
    if (index !== -1) {
      const newData = [...dataPoints];
      newData.splice(index, 1);
      setDataPoints(newData);
    }
  }, [editable, bins, dataPoints]);

  // Generate SVG path for normal curve
  const getCurvePath = useCallback(() => {
    if (normalCurvePoints.length === 0 || bins.length === 0) return '';

    const chartWidth = 600;
    const chartHeight = 300;
    const padding = 40;
    const availableWidth = chartWidth - 2 * padding;
    const availableHeight = chartHeight - 2 * padding;

    const xMin = bins[0].start;
    const xMax = bins[bins.length - 1].end;
    const xScale = availableWidth / (xMax - xMin);
    const yScale = availableHeight / (maxFrequency * 1.1);

    const pathPoints = normalCurvePoints.map(p => {
      const x = padding + (p.x - xMin) * xScale;
      const y = chartHeight - padding - p.y * yScale;
      return `${x},${y}`;
    });

    return `M ${pathPoints.join(' L ')}`;
  }, [normalCurvePoints, bins, maxFrequency]);

  return (
    <div className={`w-full max-w-5xl mx-auto my-16 animate-fade-in ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8 justify-center">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <div className="text-left">
          <h2 className="text-2xl font-bold text-white tracking-tight">Histogram</h2>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <p className="text-xs text-emerald-400 font-mono uppercase tracking-wider">Data Distribution</p>
          </div>
        </div>
      </div>

      <div className="glass-panel p-8 md:p-12 rounded-3xl border border-emerald-500/20 relative overflow-hidden">
        {/* Background Texture */}
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(#10b981 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        ></div>

        <div className="relative z-10">
          {/* Title and Description */}
          <div className="mb-8 text-center max-w-2xl mx-auto">
            <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
            <p className="text-slate-300 font-light">{description}</p>
          </div>

          {/* Bin Width Control */}
          {editable && (
            <div className="flex flex-wrap justify-center gap-6 mb-6">
              <div className="flex items-center gap-3">
                <label className="text-sm text-slate-400">Bin Width:</label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setBinWidth(prev => Math.max(1, prev - 1))}
                    className="w-8 h-8 rounded-lg bg-slate-700/50 border border-slate-600 text-slate-300 hover:bg-slate-600 transition-colors flex items-center justify-center"
                  >
                    −
                  </button>
                  <span className="w-12 text-center text-white font-mono">{binWidth}</span>
                  <button
                    onClick={() => setBinWidth(prev => prev + 1)}
                    className="w-8 h-8 rounded-lg bg-slate-700/50 border border-slate-600 text-slate-300 hover:bg-slate-600 transition-colors flex items-center justify-center"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Add Data Point */}
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder="Enter value"
                  className="w-28 px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:border-emerald-500 focus:outline-none"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddValue()}
                />
                <button
                  onClick={handleAddValue}
                  className="px-4 py-2 bg-emerald-600/50 hover:bg-emerald-600/70 border border-emerald-500/50 text-emerald-300 rounded-lg text-sm font-medium transition-colors"
                >
                  Add
                </button>
              </div>
            </div>
          )}

          {/* Histogram Chart */}
          <div className="relative bg-slate-800/30 rounded-xl p-6 mb-6">
            {dataPoints.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-slate-500">
                <p>No data points yet. {editable ? 'Add some values above!' : ''}</p>
              </div>
            ) : (
              <svg viewBox="0 0 600 340" className="w-full h-auto">
                {/* Y-axis label */}
                <text x="15" y="160" fill="#94a3b8" fontSize="12" transform="rotate(-90 15 160)" textAnchor="middle">
                  {yAxisLabel}
                </text>

                {/* X-axis label */}
                <text x="330" y="330" fill="#94a3b8" fontSize="12" textAnchor="middle">
                  {xAxisLabel}
                </text>

                {/* Y-axis */}
                <line x1="40" y1="40" x2="40" y2="280" stroke="#475569" strokeWidth="2" />

                {/* X-axis */}
                <line x1="40" y1="280" x2="560" y2="280" stroke="#475569" strokeWidth="2" />

                {/* Y-axis ticks and labels */}
                {Array.from({ length: 6 }).map((_, i) => {
                  const y = 280 - (i * 240 / 5);
                  const value = Math.round((maxFrequency * 1.1 * i) / 5);
                  return (
                    <g key={`y-tick-${i}`}>
                      <line x1="35" y1={y} x2="40" y2={y} stroke="#475569" strokeWidth="1" />
                      <text x="30" y={y + 4} fill="#94a3b8" fontSize="10" textAnchor="end">
                        {value}
                      </text>
                      {/* Grid line */}
                      <line x1="40" y1={y} x2="560" y2={y} stroke="#334155" strokeWidth="1" strokeDasharray="4" opacity="0.5" />
                    </g>
                  );
                })}

                {/* Bars */}
                {bins.map((bin, index) => {
                  const barWidth = 520 / bins.length - 4;
                  const barHeight = (bin.count / (maxFrequency * 1.1)) * 240;
                  const x = 40 + index * (520 / bins.length) + 2;
                  const y = 280 - barHeight;
                  const isHovered = hoveredBin === index;

                  return (
                    <g key={`bin-${index}`}>
                      {/* Bar */}
                      <rect
                        x={x}
                        y={y}
                        width={barWidth}
                        height={barHeight}
                        fill={isHovered ? '#34d399' : '#10b981'}
                        fillOpacity={isHovered ? 0.9 : 0.7}
                        stroke={isHovered ? '#6ee7b7' : '#10b981'}
                        strokeWidth={isHovered ? 2 : 1}
                        rx="2"
                        className="transition-all duration-200 cursor-pointer"
                        onMouseEnter={() => setHoveredBin(index)}
                        onMouseLeave={() => setHoveredBin(null)}
                        onClick={() => handleRemoveFromBin(index)}
                      />

                      {/* Frequency label on bar */}
                      {showFrequency && bin.count > 0 && (
                        <text
                          x={x + barWidth / 2}
                          y={y - 8}
                          fill="#a7f3d0"
                          fontSize="12"
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          {bin.count}
                        </text>
                      )}

                      {/* X-axis tick label */}
                      <text
                        x={x + barWidth / 2}
                        y="295"
                        fill="#94a3b8"
                        fontSize="10"
                        textAnchor="middle"
                      >
                        {bin.start}
                      </text>
                    </g>
                  );
                })}

                {/* Last x-axis label */}
                {bins.length > 0 && (
                  <text
                    x={40 + 520 - 2}
                    y="295"
                    fill="#94a3b8"
                    fontSize="10"
                    textAnchor="middle"
                  >
                    {bins[bins.length - 1].end}
                  </text>
                )}

                {/* Normal curve overlay */}
                {showCurve && normalCurvePoints.length > 0 && (
                  <path
                    d={getCurvePath()}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="3"
                    strokeLinecap="round"
                    opacity="0.8"
                  />
                )}
              </svg>
            )}

            {/* Hover tooltip */}
            {hoveredBin !== null && bins[hoveredBin] && (
              <div className="absolute top-4 right-4 p-3 bg-slate-800 rounded-lg border border-emerald-500/30 shadow-lg">
                <div className="text-xs text-slate-400 mb-1">Bin Range</div>
                <div className="text-sm text-emerald-400 font-mono">
                  [{bins[hoveredBin].start}, {bins[hoveredBin].end})
                </div>
                <div className="text-xs text-slate-400 mt-2 mb-1">Frequency</div>
                <div className="text-lg text-white font-bold">{bins[hoveredBin].count}</div>
                {editable && bins[hoveredBin].count > 0 && (
                  <div className="text-xs text-slate-500 mt-2 italic">Click to remove one</div>
                )}
              </div>
            )}
          </div>

          {/* Statistics Panel */}
          <div className="mt-6">
            <button
              onClick={() => setShowDistributionInfo(!showDistributionInfo)}
              className="flex items-center gap-2 mb-4 text-sm text-slate-400 hover:text-emerald-400 transition-colors"
            >
              <svg className={`w-4 h-4 transition-transform ${showDistributionInfo ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
              Distribution Statistics
            </button>

            {showDistributionInfo && (
              <div className="relative">
                {/* Explanation tooltip (appears above cards when hovering) */}
                {hoveredStat && (
                  <div className="absolute bottom-full left-0 right-0 mb-4 p-4 bg-slate-800/90 backdrop-blur-sm rounded-xl border border-emerald-500/30 pointer-events-none z-20 animate-fade-in">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                        {statExplanations[hoveredStat].icon}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-emerald-400 mb-1">
                          {statExplanations[hoveredStat].title}
                        </h4>
                        <p className="text-sm text-slate-300 mb-2">
                          {statExplanations[hoveredStat].description}
                        </p>
                        <p className="text-xs text-slate-400 italic">
                          {statExplanations[hoveredStat].example}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 animate-fade-in">
                  {/* Count */}
                  <div
                    className={`relative p-4 rounded-xl border transition-all duration-300 cursor-help group ${
                      hoveredStat === 'count'
                        ? 'bg-slate-700/80 border-emerald-400/50 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                        : 'bg-slate-800/50 border-slate-700/50 hover:border-emerald-500/30'
                    }`}
                    onMouseEnter={() => setHoveredStat('count')}
                    onMouseLeave={() => setHoveredStat(null)}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`p-1.5 rounded-lg transition-colors ${
                        hoveredStat === 'count' ? 'bg-emerald-500/30 text-emerald-300' : 'bg-slate-700/50 text-slate-400'
                      }`}>
                        {statExplanations.count.icon}
                      </div>
                      <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">Count</span>
                      <svg className="w-3.5 h-3.5 text-slate-500 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="text-2xl font-bold text-white">{stats.count}</div>
                    <div className="text-xs text-slate-500 mt-1">data points</div>
                  </div>

                  {/* Mean */}
                  <div
                    className={`relative p-4 rounded-xl border transition-all duration-300 cursor-help group ${
                      hoveredStat === 'mean'
                        ? 'bg-slate-700/80 border-emerald-400/50 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                        : 'bg-slate-800/50 border-slate-700/50 hover:border-emerald-500/30'
                    }`}
                    onMouseEnter={() => setHoveredStat('mean')}
                    onMouseLeave={() => setHoveredStat(null)}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`p-1.5 rounded-lg transition-colors ${
                        hoveredStat === 'mean' ? 'bg-emerald-500/30 text-emerald-300' : 'bg-slate-700/50 text-slate-400'
                      }`}>
                        {statExplanations.mean.icon}
                      </div>
                      <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">Mean</span>
                      <svg className="w-3.5 h-3.5 text-slate-500 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="text-2xl font-bold text-emerald-400">
                      {stats.count > 0 ? stats.mean.toFixed(2) : '—'}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">average value</div>
                  </div>

                  {/* Std Dev */}
                  <div
                    className={`relative p-4 rounded-xl border transition-all duration-300 cursor-help group ${
                      hoveredStat === 'stdDev'
                        ? 'bg-slate-700/80 border-emerald-400/50 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                        : 'bg-slate-800/50 border-slate-700/50 hover:border-emerald-500/30'
                    }`}
                    onMouseEnter={() => setHoveredStat('stdDev')}
                    onMouseLeave={() => setHoveredStat(null)}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`p-1.5 rounded-lg transition-colors ${
                        hoveredStat === 'stdDev' ? 'bg-emerald-500/30 text-emerald-300' : 'bg-slate-700/50 text-slate-400'
                      }`}>
                        {statExplanations.stdDev.icon}
                      </div>
                      <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">Std Dev</span>
                      <svg className="w-3.5 h-3.5 text-slate-500 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="text-2xl font-bold text-emerald-400">
                      {stats.count > 0 ? stats.stdDev.toFixed(2) : '—'}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">spread</div>
                  </div>

                  {/* Min */}
                  <div
                    className={`relative p-4 rounded-xl border transition-all duration-300 cursor-help group ${
                      hoveredStat === 'min'
                        ? 'bg-slate-700/80 border-emerald-400/50 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                        : 'bg-slate-800/50 border-slate-700/50 hover:border-emerald-500/30'
                    }`}
                    onMouseEnter={() => setHoveredStat('min')}
                    onMouseLeave={() => setHoveredStat(null)}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`p-1.5 rounded-lg transition-colors ${
                        hoveredStat === 'min' ? 'bg-emerald-500/30 text-emerald-300' : 'bg-slate-700/50 text-slate-400'
                      }`}>
                        {statExplanations.min.icon}
                      </div>
                      <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">Min</span>
                      <svg className="w-3.5 h-3.5 text-slate-500 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {stats.count > 0 ? stats.min : '—'}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">smallest</div>
                  </div>

                  {/* Max */}
                  <div
                    className={`relative p-4 rounded-xl border transition-all duration-300 cursor-help group ${
                      hoveredStat === 'max'
                        ? 'bg-slate-700/80 border-emerald-400/50 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                        : 'bg-slate-800/50 border-slate-700/50 hover:border-emerald-500/30'
                    }`}
                    onMouseEnter={() => setHoveredStat('max')}
                    onMouseLeave={() => setHoveredStat(null)}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`p-1.5 rounded-lg transition-colors ${
                        hoveredStat === 'max' ? 'bg-emerald-500/30 text-emerald-300' : 'bg-slate-700/50 text-slate-400'
                      }`}>
                        {statExplanations.max.icon}
                      </div>
                      <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">Max</span>
                      <svg className="w-3.5 h-3.5 text-slate-500 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {stats.count > 0 ? stats.max : '—'}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">largest</div>
                  </div>

                  {/* Shape */}
                  <div
                    className={`relative p-4 rounded-xl border transition-all duration-300 cursor-help group ${
                      hoveredStat === 'shape'
                        ? 'bg-slate-700/80 border-emerald-400/50 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                        : 'bg-slate-800/50 border-slate-700/50 hover:border-emerald-500/30'
                    }`}
                    onMouseEnter={() => setHoveredStat('shape')}
                    onMouseLeave={() => setHoveredStat(null)}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`p-1.5 rounded-lg transition-colors ${
                        hoveredStat === 'shape' ? 'bg-emerald-500/30 text-emerald-300' : 'bg-slate-700/50 text-slate-400'
                      }`}>
                        {statExplanations.shape.icon}
                      </div>
                      <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">Shape</span>
                      <svg className="w-3.5 h-3.5 text-slate-500 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="text-xl font-bold text-amber-400">{stats.skew}</div>
                    <div className="text-xs text-slate-500 mt-1">distribution</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="mt-6 flex justify-center gap-6 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-emerald-500/70"></div>
              <span>Frequency bars</span>
            </div>
            {showCurve && (
              <div className="flex items-center gap-2">
                <div className="w-6 h-0.5 bg-amber-500 rounded"></div>
                <span>Normal curve overlay</span>
              </div>
            )}
          </div>

          {/* Instructions */}
          {editable && (
            <div className="mt-4 text-center">
              <p className="text-xs text-slate-500 italic">
                Adjust bin width to see how the distribution shape changes. Click bars to remove data points.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Histogram;
