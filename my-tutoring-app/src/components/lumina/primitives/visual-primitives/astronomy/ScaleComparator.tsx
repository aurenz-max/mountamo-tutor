'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import * as d3 from 'd3';

// ============================================================================
// DATA INTERFACES (Single Source of Truth)
// ============================================================================

export interface CelestialObject {
  id: string;
  name: string;
  type: 'planet' | 'moon' | 'star' | 'asteroid' | 'dwarf_planet' | 'comet' | 'galaxy' | 'nebula' | 'star_cluster' | 'black_hole' | 'exoplanet' | 'pulsar' | 'quasar';
  diameterKm: number;
  massKg: number;
  distanceFromSunAu?: number;
  // For objects outside solar system, use light years or other units
  distanceLightYears?: number;
  color: string;
  textureGradient: string;
  description: string;
  funFact?: string;
  // Category for grouping (e.g., "Solar System", "Milky Way", "Local Group", "Observable Universe")
  category?: string;
}

export interface ReferenceObject {
  id: string;
  name: string;
  category: 'everyday' | 'building' | 'vehicle' | 'geography';
  size?: number;        // meters (for size comparisons)
  length?: number;      // meters (for distance comparisons)
  emoji?: string;
  color: string;
  description: string;
}

export interface ScaleComparatorData {
  title: string;
  description: string;

  // Comparison configuration
  compareType: 'size' | 'distance' | 'mass' | 'time';
  objects: CelestialObject[];
  referenceObjects: ReferenceObject[];

  // Scope determines what types of objects can be compared
  // Gemini chooses appropriate objects based on scope and topic
  scope?: 'solar_system' | 'milky_way' | 'local_group' | 'observable_universe' | 'custom';

  // Display options
  showRatios: boolean;
  showFamiliarEquivalent: boolean;
  interactiveWalk: boolean;
  units: 'km' | 'miles' | 'AU' | 'light_seconds' | 'light_years' | 'parsecs';
  useLogarithmicScale?: boolean; // Default true for size comparisons

  // Optional features
  scaleModelBase?: { objectId: string; referenceId: string };
  defaultComparison?: { object1: string; object2: string };

  // Grade level
  gradeLevel: 'K' | '1' | '2' | '3' | '4' | '5';
}

interface ScaleComparatorProps {
  data: ScaleComparatorData;
  className?: string;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const lighten = (color: string, amount: number = 40): string => {
  const hex = color.replace('#', '');
  const r = Math.min(255, parseInt(hex.substring(0, 2), 16) + amount);
  const g = Math.min(255, parseInt(hex.substring(2, 4), 16) + amount);
  const b = Math.min(255, parseInt(hex.substring(4, 6), 16) + amount);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};

const darken = (color: string, amount: number = 40): string => {
  const hex = color.replace('#', '');
  const r = Math.max(0, parseInt(hex.substring(0, 2), 16) - amount);
  const g = Math.max(0, parseInt(hex.substring(2, 4), 16) - amount);
  const b = Math.max(0, parseInt(hex.substring(4, 6), 16) - amount);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};

const formatNumber = (num: number, gradeLevel: string): string => {
  if (gradeLevel === 'K' || gradeLevel === '1') {
    return Math.round(num).toLocaleString();
  } else if (gradeLevel === '2' || gradeLevel === '3') {
    return num.toLocaleString(undefined, { maximumFractionDigits: 0 });
  } else {
    // Grades 4-5: Show scientific notation for very large numbers
    if (num >= 1e6) {
      return num.toExponential(2);
    }
    return num.toLocaleString(undefined, { maximumFractionDigits: 1 });
  }
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const ScaleComparator: React.FC<ScaleComparatorProps> = ({ data, className }) => {
  // State: Selected objects for comparison
  const [selectedObjectIds, setSelectedObjectIds] = useState<string[]>(
    data.defaultComparison
      ? [data.defaultComparison.object1, data.defaultComparison.object2]
      : [data.objects[0]?.id, data.objects[1]?.id].filter(Boolean)
  );

  // State: UI controls
  const [mode, setMode] = useState<'comparison' | 'scale-model' | 'walk'>('comparison');
  const [useLogScale, setUseLogScale] = useState(data.useLogarithmicScale !== false);

  // Refs for D3
  const svgRef = useRef<SVGSVGElement>(null);
  const transformGroupRef = useRef<SVGGElement>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  // Get selected objects
  const selectedObjects = selectedObjectIds
    .map(id => data.objects.find(obj => obj.id === id))
    .filter((obj): obj is CelestialObject => obj !== undefined);

  // Calculate visual sizes and positions using logarithmic or linear scale
  // (Must be before useEffect that depends on it)
  const visualData = useMemo(() => {
    if (selectedObjects.length === 0) return [];

    const svgWidth = 2400; // Wide canvas for logarithmic spacing
    const padding = 100;
    const availableWidth = svgWidth - (2 * padding);

    if (data.compareType === 'distance') {
      // Distance comparison - position by orbital distance, size by diameter
      const objectsWithDistance = selectedObjects.filter(obj => obj.distanceFromSunAu !== undefined);

      if (objectsWithDistance.length === 0) {
        // Fallback if no distance data
        const spacing = availableWidth / (selectedObjects.length + 1);
        return selectedObjects.map((obj, i) => ({
          obj,
          x: padding + spacing * (i + 1),
          radius: 50,
        }));
      }

      const distances = objectsWithDistance.map(o => o.distanceFromSunAu!);
      const diameters = objectsWithDistance.map(o => o.diameterKm);
      const minDistance = Math.min(...distances);
      const maxDistance = Math.max(...distances);
      const maxDiameter = Math.max(...diameters);

      if (useLogScale) {
        // Logarithmic scale for distance positioning
        const logDistanceScale = d3.scaleLog()
          .domain([minDistance, maxDistance])
          .range([padding, padding + availableWidth]);

        // Linear scale for visual size (proportional to actual size)
        const maxRadius = 60;

        return objectsWithDistance.map(obj => ({
          obj,
          x: logDistanceScale(obj.distanceFromSunAu!),
          radius: Math.max(8, (obj.diameterKm / maxDiameter) * maxRadius), // Min 8px
        }));
      } else {
        // Linear scale for distance
        const linearDistanceScale = d3.scaleLinear()
          .domain([minDistance, maxDistance])
          .range([padding, padding + availableWidth]);

        const maxRadius = 60;

        return objectsWithDistance.map(obj => ({
          obj,
          x: linearDistanceScale(obj.distanceFromSunAu!),
          radius: Math.max(8, (obj.diameterKm / maxDiameter) * maxRadius),
        }));
      }
    } else if (data.compareType === 'size') {
      if (useLogScale) {
        // Logarithmic scale for size - shows vast differences accurately
        const diameters = selectedObjects.map(o => o.diameterKm);
        const minDiameter = Math.min(...diameters);
        const maxDiameter = Math.max(...diameters);

        // Visual size scale - logarithmic but constrained for visibility
        const logSizeScale = d3.scaleLog()
          .domain([minDiameter, maxDiameter])
          .range([15, 80]); // Min 15px, max 80px radius

        // Use even spacing for positions (preserve order)
        const spacing = availableWidth / (selectedObjects.length + 1);

        return selectedObjects.map((obj, i) => ({
          obj,
          x: padding + spacing * (i + 1), // Even spacing to preserve order
          radius: logSizeScale(obj.diameterKm), // Logarithmic size scaling
        }));
      } else {
        // Linear scale for size
        const maxDiameter = Math.max(...selectedObjects.map(o => o.diameterKm));
        const spacing = availableWidth / (selectedObjects.length + 1);

        return selectedObjects.map((obj, i) => ({
          obj,
          x: padding + spacing * (i + 1),
          radius: (obj.diameterKm / maxDiameter) * 100,
        }));
      }
    }

    // Default spacing for other comparison types
    const spacing = availableWidth / (selectedObjects.length + 1);
    return selectedObjects.map((obj, i) => ({
      obj,
      x: padding + spacing * (i + 1),
      radius: 50,
    }));
  }, [selectedObjects, data.compareType, useLogScale]);

  // Initialize D3 zoom - recalculate when selected objects or scale changes
  useEffect(() => {
    if (!svgRef.current || !transformGroupRef.current || selectedObjects.length === 0) return;

    const svg = d3.select(svgRef.current);
    const transformGroup = transformGroupRef.current;

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 20])
      .on('zoom', (event) => {
        transformGroup.setAttribute(
          'transform',
          `translate(${event.transform.x},${event.transform.y}) scale(${event.transform.k})`
        );
      });

    svg.call(zoom);
    zoomBehaviorRef.current = zoom;

    // Calculate bounding box of all selected objects to fit them in view
    if (visualData.length > 0) {
      const svgWidth = 1200; // viewBox width
      const svgHeight = 500; // viewBox height
      const padding = 60; // Padding around objects

      // Find the bounding box of all objects
      const minX = Math.min(...visualData.map(d => d.x - d.radius));
      const maxX = Math.max(...visualData.map(d => d.x + d.radius));
      const maxRadius = Math.max(...visualData.map(d => d.radius));

      // Calculate width needed to show all objects
      const contentWidth = maxX - minX + padding * 2;
      const contentHeight = maxRadius * 2 + 100; // Height for objects + labels

      // Calculate scale to fit all objects
      const scaleX = svgWidth / contentWidth;
      const scaleY = svgHeight / contentHeight;
      const scale = Math.min(scaleX, scaleY, 2); // Cap at 2x to avoid too much zoom

      // Calculate center of all objects
      const centerX = (minX + maxX) / 2;
      const centerY = 250; // Objects are always at y=250

      // Calculate translation to center the content
      const translateX = (svgWidth / 2) - (centerX * scale);
      const translateY = (svgHeight / 2) - (centerY * scale);

      const initialTransform = d3.zoomIdentity
        .translate(translateX, translateY)
        .scale(scale);

      svg.transition().duration(500).call(zoom.transform, initialTransform);
    } else {
      // Fallback to default view
      const initialTransform = d3.zoomIdentity.translate(0, 250).scale(1);
      svg.call(zoom.transform, initialTransform);
    }

    return () => {
      svg.on('.zoom', null);
    };
  }, [selectedObjects.length, useLogScale, visualData]);

  // Toggle object selection
  const toggleObjectSelection = (objectId: string) => {
    setSelectedObjectIds(prev => {
      if (prev.includes(objectId)) {
        // Don't allow deselecting if it's the last one
        return prev.length > 1 ? prev.filter(id => id !== objectId) : prev;
      } else {
        return [...prev, objectId];
      }
    });
  };

  // Reset zoom - fit all objects in view
  const handleResetZoom = () => {
    if (!svgRef.current || !zoomBehaviorRef.current || visualData.length === 0) return;

    const svg = d3.select(svgRef.current);
    const svgWidth = 1200;
    const svgHeight = 500;
    const padding = 60;

    const minX = Math.min(...visualData.map(d => d.x - d.radius));
    const maxX = Math.max(...visualData.map(d => d.x + d.radius));
    const maxRadius = Math.max(...visualData.map(d => d.radius));

    const contentWidth = maxX - minX + padding * 2;
    const contentHeight = maxRadius * 2 + 100;

    const scaleX = svgWidth / contentWidth;
    const scaleY = svgHeight / contentHeight;
    const scale = Math.min(scaleX, scaleY, 2);

    const centerX = (minX + maxX) / 2;
    const centerY = 250;

    const translateX = (svgWidth / 2) - (centerX * scale);
    const translateY = (svgHeight / 2) - (centerY * scale);

    const resetTransform = d3.zoomIdentity
      .translate(translateX, translateY)
      .scale(scale);

    svg.transition().duration(750).call(zoomBehaviorRef.current.transform, resetTransform);
  };

  if (selectedObjects.length === 0) {
    return (
      <div className={className}>
        <p className="text-red-400">No objects available for comparison.</p>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Title and Description */}
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-white mb-2">{data.title}</h2>
        <p className="text-slate-300">{data.description}</p>
      </div>

      {/* Card-based Object Selector */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-white">Select Objects to Compare</h3>
          <span className="text-sm text-slate-400">{selectedObjectIds.length} selected</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {data.objects.map((obj) => {
            const isSelected = selectedObjectIds.includes(obj.id);
            return (
              <button
                key={obj.id}
                onClick={() => toggleObjectSelection(obj.id)}
                className={`
                  relative p-4 rounded-xl transition-all duration-200
                  border-2 ${
                    isSelected
                      ? 'border-orange-500 bg-orange-500/20 shadow-lg shadow-orange-500/30'
                      : 'border-slate-600 bg-slate-800 hover:border-slate-500 hover:bg-slate-750'
                  }
                `}
              >
                {/* Selection indicator */}
                {isSelected && (
                  <div className="absolute top-2 right-2 w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}

                {/* Planet visualization */}
                <div className="flex justify-center mb-3">
                  <div
                    className="w-16 h-16 rounded-full"
                    style={{
                      background: `radial-gradient(circle at 30% 30%, ${lighten(obj.color, 40)}, ${obj.color}, ${darken(obj.color, 20)})`,
                      boxShadow: `0 4px 20px ${obj.color}40`,
                    }}
                  />
                </div>

                {/* Name and size */}
                <div className="text-center">
                  <p className="font-semibold text-white text-sm mb-1">{obj.name}</p>
                  <p className="text-xs text-slate-400">
                    {formatNumber(obj.diameterKm, data.gradeLevel)} km
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Scale Toggle */}
      {(data.compareType === 'size' || data.compareType === 'distance') && (
        <div className="mb-4 flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={useLogScale}
              onChange={(e) => setUseLogScale(e.target.checked)}
              className="w-4 h-4 text-orange-500 bg-slate-700 border-slate-600 rounded focus:ring-orange-500 focus:ring-2"
            />
            <span className="text-sm text-slate-300">
              Use logarithmic scale (better for huge {data.compareType === 'distance' ? 'distance' : 'size'} differences)
            </span>
          </label>
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-2 flex-wrap mb-6">
        <button
          onClick={handleResetZoom}
          className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg font-medium hover:bg-slate-600 transition-all"
        >
          Reset Zoom
        </button>
      </div>

      {/* SVG Visualization */}
      <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
        <svg
          ref={svgRef}
          width="100%"
          height="500"
          viewBox="0 0 1200 500"
          className="w-full"
          style={{ cursor: 'grab' }}
        >
          <defs>
            {/* Gradients for celestial objects */}
            {visualData.map(({ obj }) => (
              <radialGradient key={`gradient-${obj.id}`} id={`gradient-${obj.id}`}>
                <stop offset="0%" stopColor={lighten(obj.color, 60)} />
                <stop offset="50%" stopColor={obj.color} />
                <stop offset="100%" stopColor={darken(obj.color, 40)} />
              </radialGradient>
            ))}
          </defs>

          <g ref={transformGroupRef}>
            {/* Grid background */}
            <g opacity="0.05">
              {(() => {
                const svgWidth = 2400;
                const padding = 100;
                const availableWidth = svgWidth - (2 * padding);

                if (useLogScale && data.compareType === 'distance' && selectedObjects.length > 0) {
                  // Logarithmic grid spacing for distance scale
                  const objectsWithDistance = selectedObjects.filter(obj => obj.distanceFromSunAu !== undefined);
                  if (objectsWithDistance.length === 0) {
                    return Array.from({ length: 50 }).map((_, i) => (
                      <line key={i} x1={i * 50} y1={0} x2={i * 50} y2={500} stroke="#fff" strokeWidth="1" />
                    ));
                  }

                  const distances = objectsWithDistance.map(o => o.distanceFromSunAu!);
                  const minDistance = Math.min(...distances);
                  const maxDistance = Math.max(...distances);

                  // Create a broader logarithmic scale to show context
                  const scaleMin = Math.pow(10, Math.floor(Math.log10(minDistance)));
                  const scaleMax = Math.pow(10, Math.ceil(Math.log10(maxDistance)));

                  const logScale = d3.scaleLog()
                    .domain([scaleMin, scaleMax])
                    .range([padding, padding + availableWidth]);

                  // Create tick marks at many intervals to show logarithmic compression
                  const minLog = Math.floor(Math.log10(scaleMin));
                  const maxLog = Math.ceil(Math.log10(scaleMax));
                  const ticks: number[] = [];

                  for (let exp = minLog; exp <= maxLog; exp++) {
                    const base = Math.pow(10, exp);
                    // Add ticks at 1, 2, 3, 4, 5, 6, 7, 8, 9 times each power of 10
                    for (let mult = 1; mult <= 9; mult++) {
                      ticks.push(base * mult);
                    }
                  }

                  return ticks
                    .filter(t => t >= scaleMin && t <= scaleMax)
                    .map((tick, i) => (
                      <line
                        key={i}
                        x1={logScale(tick)}
                        y1={0}
                        x2={logScale(tick)}
                        y2={500}
                        stroke="#fff"
                        strokeWidth="1"
                      />
                    ));
                } else if (useLogScale && data.compareType === 'size' && selectedObjects.length > 0) {
                  // Logarithmic grid spacing based on size scale
                  const diameters = selectedObjects.map(o => o.diameterKm);
                  const minDiameter = Math.min(...diameters);
                  const maxDiameter = Math.max(...diameters);

                  // Create a broader logarithmic scale to show more context
                  const scaleMin = Math.pow(10, Math.floor(Math.log10(minDiameter)));
                  const scaleMax = Math.pow(10, Math.ceil(Math.log10(maxDiameter)));

                  const logScale = d3.scaleLog()
                    .domain([scaleMin, scaleMax])
                    .range([0, svgWidth]);

                  // Create tick marks at many intervals to show logarithmic compression
                  const minLog = Math.floor(Math.log10(scaleMin));
                  const maxLog = Math.ceil(Math.log10(scaleMax));
                  const ticks: number[] = [];

                  for (let exp = minLog; exp <= maxLog; exp++) {
                    const base = Math.pow(10, exp);
                    // Add ticks at 1, 2, 3, 4, 5, 6, 7, 8, 9 times each power of 10
                    for (let mult = 1; mult <= 9; mult++) {
                      ticks.push(base * mult);
                    }
                  }

                  return ticks
                    .filter(t => t >= scaleMin && t <= scaleMax)
                    .map((tick, i) => (
                      <line
                        key={i}
                        x1={logScale(tick)}
                        y1={0}
                        x2={logScale(tick)}
                        y2={500}
                        stroke="#fff"
                        strokeWidth="1"
                      />
                    ));
                } else {
                  // Linear grid spacing
                  return Array.from({ length: 50 }).map((_, i) => (
                    <line
                      key={i}
                      x1={i * 50}
                      y1={0}
                      x2={i * 50}
                      y2={500}
                      stroke="#fff"
                      strokeWidth="1"
                    />
                  ));
                }
              })()}
            </g>

            {/* Render celestial objects */}
            {visualData.map(({ obj, x, radius }) => (
              <g key={obj.id} transform={`translate(${x}, 250)`}>
                {/* Planet circle */}
                <circle
                  r={radius}
                  fill={`url(#gradient-${obj.id})`}
                  stroke={obj.color}
                  strokeWidth="2"
                  opacity="0.95"
                />

                {/* Name label */}
                <text
                  y={radius + 25}
                  textAnchor="middle"
                  fill="white"
                  fontSize="16"
                  fontWeight="700"
                >
                  {obj.name}
                </text>

                {/* Distance or Size label */}
                <text
                  y={radius + 42}
                  textAnchor="middle"
                  fill="#94A3B8"
                  fontSize="13"
                >
                  {data.compareType === 'distance' && obj.distanceFromSunAu !== undefined
                    ? `${formatNumber(obj.distanceFromSunAu, data.gradeLevel)} AU`
                    : `${formatNumber(obj.diameterKm, data.gradeLevel)} km`}
                </text>
              </g>
            ))}
          </g>
        </svg>
      </div>

      {/* Info Panel - Show comparison ratios */}
      {selectedObjects.length >= 2 && data.showRatios && (
        <div className="mt-6 bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-slate-700">
          <h3 className="text-lg font-bold text-white mb-4">
            {data.compareType === 'distance' ? 'Distance Comparisons' : 'Size Comparisons'}
          </h3>
          <div className="space-y-3">
            {selectedObjects.map((obj, i) => {
              if (i === 0) return null; // Skip first object
              const firstObj = selectedObjects[0];

              if (data.compareType === 'distance' && obj.distanceFromSunAu && firstObj.distanceFromSunAu) {
                const ratio = obj.distanceFromSunAu / firstObj.distanceFromSunAu;
                return (
                  <div key={obj.id} className="flex justify-between items-center">
                    <span className="text-slate-400">
                      {obj.name} vs {firstObj.name}:
                    </span>
                    <span className="text-white font-semibold">
                      {ratio >= 1
                        ? `${formatNumber(ratio, data.gradeLevel)}× farther from Sun`
                        : `${formatNumber(1 / ratio, data.gradeLevel)}× closer to Sun`}
                    </span>
                  </div>
                );
              } else {
                const ratio = obj.diameterKm / firstObj.diameterKm;
                return (
                  <div key={obj.id} className="flex justify-between items-center">
                    <span className="text-slate-400">
                      {obj.name} vs {firstObj.name}:
                    </span>
                    <span className="text-white font-semibold">
                      {ratio >= 1
                        ? `${formatNumber(ratio, data.gradeLevel)}× larger`
                        : `${formatNumber(1 / ratio, data.gradeLevel)}× smaller`}
                    </span>
                  </div>
                );
              }
            })}
          </div>
        </div>
      )}

      {/* Fun Facts */}
      {selectedObjects.length > 0 && selectedObjects[0].funFact && (
        <div className="mt-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
          <p className="text-sm text-slate-300">
            <span className="text-yellow-400 mr-2">✨</span>
            {selectedObjects[0].funFact}
          </p>
        </div>
      )}
    </div>
  );
};

export default ScaleComparator;
