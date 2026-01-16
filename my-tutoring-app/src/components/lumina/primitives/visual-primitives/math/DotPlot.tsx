'use client';

import React, { useState, useMemo, useCallback } from 'react';

export interface DotPlotData {
  title: string;
  description: string;
  range: [number, number];
  dataPoints: number[];
  showStatistics: boolean;
  editable: boolean;
  parallel?: boolean;
  secondaryDataPoints?: number[];
  secondaryLabel?: string;
  primaryLabel?: string;
  stackStyle: 'dots' | 'x' | 'icons';
  iconEmoji?: string;
}

interface DotPlotProps {
  data: DotPlotData;
  className?: string;
}

type StatType = 'count' | 'mean' | 'median' | 'mode' | null;

interface StatCardInfo {
  title: string;
  description: string;
  example: string;
  icon: React.ReactNode;
}

const statExplanations: Record<Exclude<StatType, null>, StatCardInfo> = {
  count: {
    title: 'Count',
    description: 'The total number of data points in the dataset. This tells you how many values were collected or measured.',
    example: 'If 15 students reported how many books they read, the count is 15.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
      </svg>
    ),
  },
  mean: {
    title: 'Mean (Average)',
    description: 'Add up all the values and divide by the count. The mean shows the "balance point" of your data.',
    example: 'For values 2, 3, 4: Mean = (2+3+4) ÷ 3 = 3',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
  },
  median: {
    title: 'Median (Middle)',
    description: 'The middle value when all data points are arranged in order. Half the values are below and half are above.',
    example: 'For values 1, 3, 7: Median = 3 (the middle value)',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7" />
      </svg>
    ),
  },
  mode: {
    title: 'Mode (Most Common)',
    description: 'The value that appears most frequently. A dataset can have one mode, multiple modes, or no mode at all.',
    example: 'For values 2, 2, 3, 4, 2: Mode = 2 (appears 3 times)',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
    ),
  },
};

const DotPlot: React.FC<DotPlotProps> = ({ data, className }) => {
  const {
    title,
    description,
    range: [min, max],
    showStatistics,
    editable,
    parallel = false,
    secondaryDataPoints: initialSecondaryPoints = [],
    secondaryLabel = 'Dataset B',
    primaryLabel = 'Dataset A',
    stackStyle = 'dots',
    iconEmoji = '●',
  } = data;

  const [dataPoints, setDataPoints] = useState<number[]>(data.dataPoints || []);
  const [secondaryDataPoints, setSecondaryDataPoints] = useState<number[]>(initialSecondaryPoints);
  const [hoveredValue, setHoveredValue] = useState<number | null>(null);
  const [activeDataset, setActiveDataset] = useState<'primary' | 'secondary'>('primary');
  const [hoveredStat, setHoveredStat] = useState<StatType>(null);

  const totalRange = max - min;
  const tickCount = Math.min(totalRange + 1, 21); // Limit ticks for large ranges
  const tickInterval = totalRange / (tickCount - 1);

  // Calculate frequency for each value
  const getFrequencyMap = useCallback((points: number[]) => {
    const freq: Record<number, number> = {};
    points.forEach(point => {
      freq[point] = (freq[point] || 0) + 1;
    });
    return freq;
  }, []);

  const primaryFrequency = useMemo(() => getFrequencyMap(dataPoints), [dataPoints, getFrequencyMap]);
  const secondaryFrequency = useMemo(() => getFrequencyMap(secondaryDataPoints), [secondaryDataPoints, getFrequencyMap]);

  // Calculate statistics
  const calculateStats = useCallback((points: number[]) => {
    if (points.length === 0) {
      return { mean: 0, median: 0, mode: [], count: 0 };
    }

    const sorted = [...points].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    const mean = sum / sorted.length;

    // Median
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 !== 0
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;

    // Mode
    const freq = getFrequencyMap(points);
    const maxFreq = Math.max(...Object.values(freq));
    const mode = Object.entries(freq)
      .filter(([, f]) => f === maxFreq)
      .map(([v]) => parseFloat(v));

    return { mean, median, mode, count: points.length };
  }, [getFrequencyMap]);

  const primaryStats = useMemo(() => calculateStats(dataPoints), [dataPoints, calculateStats]);
  const secondaryStats = useMemo(() => calculateStats(secondaryDataPoints), [secondaryDataPoints, calculateStats]);

  // Handle click on number line to add/remove points
  const handleNumberLineClick = useCallback((value: number) => {
    if (!editable) return;

    const currentPoints = activeDataset === 'primary' ? dataPoints : secondaryDataPoints;
    const setPoints = activeDataset === 'primary' ? setDataPoints : setSecondaryDataPoints;

    // Check if this value already exists
    const index = currentPoints.findIndex(p => p === value);

    if (index !== -1) {
      // Remove the point (remove last occurrence)
      const newPoints = [...currentPoints];
      const lastIndex = currentPoints.lastIndexOf(value);
      newPoints.splice(lastIndex, 1);
      setPoints(newPoints);
    } else {
      // Add the point
      setPoints([...currentPoints, value]);
    }
  }, [editable, activeDataset, dataPoints, secondaryDataPoints]);

  // Render dot/marker based on style
  const renderMarker = useCallback((index: number, isPrimary: boolean) => {
    const baseColor = isPrimary ? 'bg-cyan-500' : 'bg-amber-500';
    const baseColorText = isPrimary ? 'text-cyan-500' : 'text-amber-500';

    if (stackStyle === 'dots') {
      return (
        <div
          key={index}
          className={`w-4 h-4 rounded-full ${baseColor} border-2 border-white/50 shadow-lg transition-transform hover:scale-110`}
          style={{
            boxShadow: isPrimary
              ? '0 0 10px rgba(6, 182, 212, 0.5)'
              : '0 0 10px rgba(245, 158, 11, 0.5)'
          }}
        />
      );
    } else if (stackStyle === 'x') {
      return (
        <div
          key={index}
          className={`w-4 h-4 flex items-center justify-center ${baseColorText} font-bold text-sm`}
        >
          ×
        </div>
      );
    } else {
      return (
        <div
          key={index}
          className={`w-4 h-4 flex items-center justify-center text-sm ${baseColorText}`}
        >
          {iconEmoji}
        </div>
      );
    }
  }, [stackStyle, iconEmoji]);

  // Get max frequency for scaling
  const maxFrequency = useMemo(() => {
    const allFreqs = [
      ...Object.values(primaryFrequency),
      ...Object.values(secondaryFrequency)
    ];
    return Math.max(...allFreqs, 1);
  }, [primaryFrequency, secondaryFrequency]);

  return (
    <div className={`w-full max-w-5xl mx-auto my-16 animate-fade-in ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8 justify-center">
        <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center border border-cyan-500/30 text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.2)]">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="8" cy="16" r="2" fill="currentColor" />
            <circle cx="8" cy="12" r="2" fill="currentColor" />
            <circle cx="12" cy="16" r="2" fill="currentColor" />
            <circle cx="16" cy="16" r="2" fill="currentColor" />
            <circle cx="16" cy="12" r="2" fill="currentColor" />
            <circle cx="16" cy="8" r="2" fill="currentColor" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 20h16" />
          </svg>
        </div>
        <div className="text-left">
          <h2 className="text-2xl font-bold text-white tracking-tight">Dot Plot</h2>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse"></span>
            <p className="text-xs text-cyan-400 font-mono uppercase tracking-wider">Data Visualization</p>
          </div>
        </div>
      </div>

      <div className="glass-panel p-8 md:p-12 rounded-3xl border border-cyan-500/20 relative overflow-hidden">
        {/* Background Texture */}
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(#06b6d4 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        ></div>

        <div className="relative z-10">
          {/* Title and Description */}
          <div className="mb-8 text-center max-w-2xl mx-auto">
            <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
            <p className="text-slate-300 font-light">{description}</p>
          </div>

          {/* Dataset Toggle (if parallel mode) */}
          {parallel && editable && (
            <div className="flex justify-center gap-4 mb-6">
              <button
                onClick={() => setActiveDataset('primary')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeDataset === 'primary'
                    ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-500/50'
                    : 'bg-slate-700/50 text-slate-400 border border-slate-600 hover:bg-slate-700'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-cyan-500 inline-block mr-2"></span>
                {primaryLabel}
              </button>
              <button
                onClick={() => setActiveDataset('secondary')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeDataset === 'secondary'
                    ? 'bg-amber-500/30 text-amber-300 border border-amber-500/50'
                    : 'bg-slate-700/50 text-slate-400 border border-slate-600 hover:bg-slate-700'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-500 inline-block mr-2"></span>
                {secondaryLabel}
              </button>
            </div>
          )}

          {/* Dot Plot Visualization */}
          <div className="relative px-4 py-8">
            {/* Primary Dataset */}
            <div className="mb-2">
              {parallel && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
                  <span className="text-xs text-cyan-400 font-medium">{primaryLabel}</span>
                </div>
              )}

              <div className="relative h-32">
                {/* Visual Overlays for Statistics */}
                {hoveredStat && primaryStats.count > 0 && (
                  <>
                    {/* Mean indicator - vertical line with triangle balance */}
                    {hoveredStat === 'mean' && (
                      <div
                        className="absolute bottom-4 z-10 transition-all duration-300"
                        style={{
                          left: `${((primaryStats.mean - min) / (max - min)) * 100}%`,
                          transform: 'translateX(-50%)',
                        }}
                      >
                        {/* Vertical line */}
                        <div className="absolute bottom-0 w-0.5 h-28 bg-gradient-to-t from-green-500 to-green-400/50"></div>
                        {/* Balance triangle at bottom */}
                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-2">
                          <div className="w-0 h-0 border-l-[8px] border-r-[8px] border-b-[12px] border-l-transparent border-r-transparent border-b-green-500"></div>
                        </div>
                        {/* Label */}
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-green-500/20 border border-green-500/50 rounded-md whitespace-nowrap">
                          <span className="text-xs font-bold text-green-400">Mean: {primaryStats.mean.toFixed(2)}</span>
                        </div>
                      </div>
                    )}

                    {/* Median indicator - vertical line showing middle */}
                    {hoveredStat === 'median' && (
                      <div
                        className="absolute bottom-4 z-10 transition-all duration-300"
                        style={{
                          left: `${((primaryStats.median - min) / (max - min)) * 100}%`,
                          transform: 'translateX(-50%)',
                        }}
                      >
                        {/* Vertical line */}
                        <div className="absolute bottom-0 w-0.5 h-28 bg-gradient-to-t from-purple-500 to-purple-400/50"></div>
                        {/* Arrow pointing to median */}
                        <div className="absolute bottom-14 left-1/2 -translate-x-1/2">
                          <div className="w-0 h-0 border-t-[6px] border-b-[6px] border-l-[10px] border-t-transparent border-b-transparent border-l-purple-500 rotate-90"></div>
                        </div>
                        {/* Label */}
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-purple-500/20 border border-purple-500/50 rounded-md whitespace-nowrap">
                          <span className="text-xs font-bold text-purple-400">Median: {primaryStats.median}</span>
                        </div>
                        {/* Split indicator text */}
                        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex gap-8">
                          <span className="text-[10px] text-purple-400/70 -translate-x-4">← 50%</span>
                          <span className="text-[10px] text-purple-400/70 translate-x-4">50% →</span>
                        </div>
                      </div>
                    )}

                    {/* Mode indicator - highlights the most common value(s) */}
                    {hoveredStat === 'mode' && primaryStats.mode.map((modeValue) => {
                      const modePercent = ((modeValue - min) / (max - min)) * 100;
                      const modeFreq = primaryFrequency[modeValue] || 0;
                      return (
                        <div
                          key={`mode-${modeValue}`}
                          className="absolute bottom-4 z-10 transition-all duration-300"
                          style={{
                            left: `${modePercent}%`,
                            transform: 'translateX(-50%)',
                          }}
                        >
                          {/* Highlight circle around the stack */}
                          <div
                            className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-full border-2 border-amber-400 bg-amber-400/10 animate-pulse"
                            style={{
                              width: '32px',
                              height: `${Math.max(modeFreq * 20 + 16, 32)}px`,
                            }}
                          ></div>
                          {/* Star indicator */}
                          <div className="absolute -top-8 left-1/2 -translate-x-1/2">
                            <div className="px-2 py-1 bg-amber-500/20 border border-amber-500/50 rounded-md whitespace-nowrap flex items-center gap-1">
                              <svg className="w-3 h-3 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                              </svg>
                              <span className="text-xs font-bold text-amber-400">{modeFreq}×</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Count indicator - shows all dots highlighted */}
                    {hoveredStat === 'count' && (
                      <div className="absolute inset-0 pointer-events-none">
                        {/* Animated counting effect - pulse all dots */}
                        <div className="absolute inset-0 bg-cyan-500/5 rounded-lg animate-pulse"></div>
                        {/* Count badge */}
                        <div className="absolute top-0 right-0 px-3 py-1.5 bg-cyan-500/20 border border-cyan-500/50 rounded-lg">
                          <span className="text-sm font-bold text-cyan-400">Total: {primaryStats.count} points</span>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Dots stacked above number line */}
                <div className="absolute inset-x-0 bottom-4 flex">
                  {Array.from({ length: tickCount }).map((_, i) => {
                    const value = Math.round(min + i * tickInterval);
                    const freq = primaryFrequency[value] || 0;
                    const percent = (i / (tickCount - 1)) * 100;

                    // Determine if this stack should be highlighted based on hovered stat
                    const isHighlighted = hoveredStat === 'mode' && primaryStats.mode.includes(value);

                    return (
                      <div
                        key={`primary-stack-${value}`}
                        className={`absolute bottom-0 flex flex-col-reverse items-center gap-0.5 transition-all duration-300 ${
                          hoveredStat === 'count' ? 'scale-110' : ''
                        } ${isHighlighted ? 'scale-125 z-20' : ''}`}
                        style={{ left: `${percent}%`, transform: 'translateX(-50%)' }}
                      >
                        {Array.from({ length: freq }).map((_, dotIndex) =>
                          renderMarker(dotIndex, true)
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Secondary Dataset (if parallel mode) */}
            {parallel && (
              <div className="mt-8 mb-2">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  <span className="text-xs text-amber-400 font-medium">{secondaryLabel}</span>
                </div>

                <div className="relative h-32">
                  {/* Dots stacked above number line */}
                  <div className="absolute inset-x-0 bottom-4 flex">
                    {Array.from({ length: tickCount }).map((_, i) => {
                      const value = Math.round(min + i * tickInterval);
                      const freq = secondaryFrequency[value] || 0;
                      const percent = (i / (tickCount - 1)) * 100;

                      return (
                        <div
                          key={`secondary-stack-${value}`}
                          className="absolute bottom-0 flex flex-col-reverse items-center gap-0.5"
                          style={{ left: `${percent}%`, transform: 'translateX(-50%)' }}
                        >
                          {Array.from({ length: freq }).map((_, dotIndex) =>
                            renderMarker(dotIndex, false)
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Number Line */}
            <div className="relative h-12 mt-4">
              {/* Line */}
              <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 bg-slate-600 rounded-full"></div>

              {/* Ticks and Labels */}
              {Array.from({ length: tickCount }).map((_, i) => {
                const value = Math.round(min + i * tickInterval);
                const percent = (i / (tickCount - 1)) * 100;
                const isHovered = hoveredValue === value;
                const primaryFreq = primaryFrequency[value] || 0;
                const secondaryFreq = secondaryFrequency[value] || 0;
                const totalFreq = primaryFreq + (parallel ? secondaryFreq : 0);

                return (
                  <div
                    key={`tick-${value}`}
                    className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 cursor-pointer transition-all ${
                      editable ? 'hover:scale-125' : ''
                    }`}
                    style={{ left: `${percent}%` }}
                    onClick={() => handleNumberLineClick(value)}
                    onMouseEnter={() => setHoveredValue(value)}
                    onMouseLeave={() => setHoveredValue(null)}
                  >
                    {/* Tick mark */}
                    <div className={`w-0.5 h-4 bg-slate-500 mx-auto transition-all ${
                      isHovered ? 'bg-cyan-400 h-5' : ''
                    }`}></div>

                    {/* Value label */}
                    <div className={`mt-2 text-xs font-mono font-semibold transition-all ${
                      isHovered ? 'text-cyan-400 scale-110' : 'text-slate-400'
                    }`}>
                      {value}
                    </div>

                    {/* Frequency tooltip */}
                    {isHovered && totalFreq > 0 && (
                      <div className="absolute bottom-full mb-16 left-1/2 -translate-x-1/2 px-3 py-2 bg-slate-800 rounded-lg border border-cyan-500/30 shadow-lg whitespace-nowrap z-20">
                        <div className="text-cyan-400 text-xs font-medium">
                          {parallel ? (
                            <>
                              <div>{primaryLabel}: {primaryFreq}</div>
                              <div>{secondaryLabel}: {secondaryFreq}</div>
                            </>
                          ) : (
                            <>Count: {primaryFreq}</>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Click instruction */}
            {editable && (
              <div className="text-center mt-4">
                <p className="text-xs text-slate-500 italic">
                  Click on a number to add/remove data points
                </p>
              </div>
            )}
          </div>

          {/* Statistics Panel */}
          {showStatistics && (
            <div className="mt-8">
              {/* Primary Dataset Stats Label (parallel mode only) */}
              {parallel && (
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
                  <span className="text-sm text-cyan-400 font-medium">{primaryLabel}</span>
                </div>
              )}

              {/* Stat Cards Grid */}
              <div className="relative">
                {/* Explanation tooltip (appears above cards when hovering) - positioned absolutely */}
                {hoveredStat && (
                  <div className="absolute bottom-full left-0 right-0 mb-4 p-4 bg-slate-800/90 backdrop-blur-sm rounded-xl border border-cyan-500/30 pointer-events-none z-20">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400">
                        {statExplanations[hoveredStat].icon}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-cyan-400 mb-1">
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

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

                {/* Count Card */}
                <div
                  className={`relative p-4 rounded-xl border transition-all duration-300 cursor-help group ${
                    hoveredStat === 'count'
                      ? 'bg-slate-700/80 border-cyan-400/50 shadow-[0_0_20px_rgba(6,182,212,0.2)]'
                      : 'bg-slate-800/50 border-slate-700/50 hover:border-cyan-500/30'
                  }`}
                  onMouseEnter={() => setHoveredStat('count')}
                  onMouseLeave={() => setHoveredStat(null)}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`p-1.5 rounded-lg transition-colors ${
                      hoveredStat === 'count' ? 'bg-cyan-500/30 text-cyan-300' : 'bg-slate-700/50 text-slate-400'
                    }`}>
                      {statExplanations.count.icon}
                    </div>
                    <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">Count</span>
                    <svg className="w-3.5 h-3.5 text-slate-500 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="text-2xl font-bold text-white">{primaryStats.count}</div>
                  <div className="text-xs text-slate-500 mt-1">data points</div>
                </div>

                {/* Mean Card */}
                <div
                  className={`relative p-4 rounded-xl border transition-all duration-300 cursor-help group ${
                    hoveredStat === 'mean'
                      ? 'bg-slate-700/80 border-cyan-400/50 shadow-[0_0_20px_rgba(6,182,212,0.2)]'
                      : 'bg-slate-800/50 border-slate-700/50 hover:border-cyan-500/30'
                  }`}
                  onMouseEnter={() => setHoveredStat('mean')}
                  onMouseLeave={() => setHoveredStat(null)}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`p-1.5 rounded-lg transition-colors ${
                      hoveredStat === 'mean' ? 'bg-cyan-500/30 text-cyan-300' : 'bg-slate-700/50 text-slate-400'
                    }`}>
                      {statExplanations.mean.icon}
                    </div>
                    <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">Mean</span>
                    <svg className="w-3.5 h-3.5 text-slate-500 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="text-2xl font-bold text-cyan-400">
                    {primaryStats.count > 0 ? primaryStats.mean.toFixed(2) : '—'}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">average value</div>
                </div>

                {/* Median Card */}
                <div
                  className={`relative p-4 rounded-xl border transition-all duration-300 cursor-help group ${
                    hoveredStat === 'median'
                      ? 'bg-slate-700/80 border-cyan-400/50 shadow-[0_0_20px_rgba(6,182,212,0.2)]'
                      : 'bg-slate-800/50 border-slate-700/50 hover:border-cyan-500/30'
                  }`}
                  onMouseEnter={() => setHoveredStat('median')}
                  onMouseLeave={() => setHoveredStat(null)}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`p-1.5 rounded-lg transition-colors ${
                      hoveredStat === 'median' ? 'bg-cyan-500/30 text-cyan-300' : 'bg-slate-700/50 text-slate-400'
                    }`}>
                      {statExplanations.median.icon}
                    </div>
                    <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">Median</span>
                    <svg className="w-3.5 h-3.5 text-slate-500 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="text-2xl font-bold text-cyan-400">
                    {primaryStats.count > 0 ? primaryStats.median : '—'}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">middle value</div>
                </div>

                {/* Mode Card */}
                <div
                  className={`relative p-4 rounded-xl border transition-all duration-300 cursor-help group ${
                    hoveredStat === 'mode'
                      ? 'bg-slate-700/80 border-cyan-400/50 shadow-[0_0_20px_rgba(6,182,212,0.2)]'
                      : 'bg-slate-800/50 border-slate-700/50 hover:border-cyan-500/30'
                  }`}
                  onMouseEnter={() => setHoveredStat('mode')}
                  onMouseLeave={() => setHoveredStat(null)}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`p-1.5 rounded-lg transition-colors ${
                      hoveredStat === 'mode' ? 'bg-cyan-500/30 text-cyan-300' : 'bg-slate-700/50 text-slate-400'
                    }`}>
                      {statExplanations.mode.icon}
                    </div>
                    <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">Mode</span>
                    <svg className="w-3.5 h-3.5 text-slate-500 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="text-2xl font-bold text-cyan-400">
                    {primaryStats.count > 0 ? primaryStats.mode.join(', ') : '—'}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">most common</div>
                </div>
                </div>
              </div>

              {/* Secondary Stats (if parallel) */}
              {parallel && (
                <div className="mt-6">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    <span className="text-sm text-amber-400 font-medium">{secondaryLabel}</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {/* Secondary Count */}
                    <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 rounded-lg bg-slate-700/50 text-slate-400">
                          {statExplanations.count.icon}
                        </div>
                        <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">Count</span>
                      </div>
                      <div className="text-2xl font-bold text-white">{secondaryStats.count}</div>
                    </div>
                    {/* Secondary Mean */}
                    <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 rounded-lg bg-slate-700/50 text-slate-400">
                          {statExplanations.mean.icon}
                        </div>
                        <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">Mean</span>
                      </div>
                      <div className="text-2xl font-bold text-amber-400">
                        {secondaryStats.count > 0 ? secondaryStats.mean.toFixed(2) : '—'}
                      </div>
                    </div>
                    {/* Secondary Median */}
                    <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 rounded-lg bg-slate-700/50 text-slate-400">
                          {statExplanations.median.icon}
                        </div>
                        <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">Median</span>
                      </div>
                      <div className="text-2xl font-bold text-amber-400">
                        {secondaryStats.count > 0 ? secondaryStats.median : '—'}
                      </div>
                    </div>
                    {/* Secondary Mode */}
                    <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 rounded-lg bg-slate-700/50 text-slate-400">
                          {statExplanations.mode.icon}
                        </div>
                        <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">Mode</span>
                      </div>
                      <div className="text-2xl font-bold text-amber-400">
                        {secondaryStats.count > 0 ? secondaryStats.mode.join(', ') : '—'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Legend */}
          <div className="mt-6 flex justify-center gap-6 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              {stackStyle === 'dots' && <div className="w-3 h-3 rounded-full bg-cyan-500"></div>}
              {stackStyle === 'x' && <span className="text-cyan-500 font-bold">×</span>}
              {stackStyle === 'icons' && <span className="text-cyan-500">{iconEmoji}</span>}
              <span>= 1 data point</span>
            </div>
            {parallel && (
              <>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-cyan-500"></div>
                  <span>{primaryLabel}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                  <span>{secondaryLabel}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DotPlot;
