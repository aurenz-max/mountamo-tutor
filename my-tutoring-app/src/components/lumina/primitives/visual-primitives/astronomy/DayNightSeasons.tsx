'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import * as d3 from 'd3';
import { usePrimitiveEvaluation, PrimitiveEvaluationResult } from '../../../evaluation';
import type { DayNightSeasonsMetrics } from '../../../evaluation/types';

// ============================================================================
// DATA INTERFACES (Single Source of Truth)
// ============================================================================

export interface LocationMarker {
  id: string;
  name: string;
  latitude: number; // -90 to 90 (negative = south)
  longitude: number; // -180 to 180 (for rotation positioning)
  emoji?: string;
  color: string;
}

export interface DayNightSeasonsData {
  title: string;
  description: string;

  // Learning focus configuration
  focusMode: 'day-night' | 'seasons' | 'both';

  // Earth orbital position (for seasons)
  initialEarthPosition: 'march_equinox' | 'june_solstice' | 'sept_equinox' | 'dec_solstice' | 'custom';
  customPositionAngle?: number; // 0-360 degrees in orbit

  // View configuration
  viewPerspective: 'space_north' | 'space_side' | 'surface' | 'sun_view';

  // Visual elements
  showTiltAxis: boolean;
  showSunRays: boolean;
  showTerminator: boolean; // Day/night boundary
  showDaylightHours: boolean;
  showTemperatureZones: boolean;

  // Animation controls
  animationMode: 'rotation' | 'orbit' | 'both' | 'manual';
  timeSpeed: number; // Multiplier for animation speed (1 = real-time, 10 = 10x faster)

  // Location markers for tracking
  markerLatitudes: LocationMarker[];

  // Grade level for appropriate complexity
  gradeLevel: 'K' | '1' | '2' | '3' | '4' | '5';

  // Learning objectives (for targeted questions)
  learningObjectives?: string[];

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<DayNightSeasonsMetrics>) => void;
}

interface DayNightSeasonsProps {
  data: DayNightSeasonsData;
  className?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const EARTH_TILT_DEGREES = 23.5;
const ORBITAL_POSITIONS = {
  march_equinox: 0,
  june_solstice: 90,
  sept_equinox: 180,
  dec_solstice: 270,
};

const EARTH_RADIUS = 80;
const SUN_RADIUS = 30;
const ORBIT_RADIUS_X = 280;
const ORBIT_RADIUS_Y = 150;

// Month labels for the temperature graph
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const calculateDaylightHours = (latitude: number, earthPositionAngle: number): number => {
  const tiltRadians = (EARTH_TILT_DEGREES * Math.PI) / 180;
  const positionRadians = (earthPositionAngle * Math.PI) / 180;
  const latRadians = (latitude * Math.PI) / 180;

  // Solar declination based on orbital position
  const declination = Math.asin(Math.sin(tiltRadians) * Math.sin(positionRadians));

  // Hour angle calculation
  const tanLat = Math.tan(latRadians);
  const tanDec = Math.tan(declination);
  const cosHourAngle = -tanLat * tanDec;

  // Handle polar day/night
  if (cosHourAngle > 1) return 0; // Polar night
  if (cosHourAngle < -1) return 24; // Polar day

  // Calculate daylight hours
  const hourAngle = Math.acos(cosHourAngle);
  return (24 * hourAngle) / Math.PI;
};

const getSeasonName = (latitude: number, earthPositionAngle: number): string => {
  const isNorthern = latitude >= 0;
  const angle = ((earthPositionAngle % 360) + 360) % 360;

  if (angle >= 315 || angle < 45) {
    return isNorthern ? 'Winter' : 'Summer';
  } else if (angle >= 45 && angle < 135) {
    return isNorthern ? 'Spring' : 'Fall';
  } else if (angle >= 135 && angle < 225) {
    return isNorthern ? 'Summer' : 'Winter';
  } else {
    return isNorthern ? 'Fall' : 'Spring';
  }
};

const formatGradeAppropriate = (hours: number, gradeLevel: string): string => {
  if (gradeLevel === 'K' || gradeLevel === '1') {
    return Math.round(hours).toString();
  } else if (gradeLevel === '2' || gradeLevel === '3') {
    return hours.toFixed(0);
  } else {
    return hours.toFixed(1);
  }
};

// Calculate the sun angle (altitude) at solar noon for a given latitude and orbital position
const calculateSunAngle = (latitude: number, earthPositionAngle: number): number => {
  const tiltRadians = (EARTH_TILT_DEGREES * Math.PI) / 180;
  const positionRadians = (earthPositionAngle * Math.PI) / 180;

  // Solar declination based on orbital position
  const declination = Math.asin(Math.sin(tiltRadians) * Math.sin(positionRadians));
  const declinationDegrees = (declination * 180) / Math.PI;

  // Sun angle at solar noon = 90 - |latitude - declination|
  const sunAngle = 90 - Math.abs(latitude - declinationDegrees);

  // Clamp to valid range (can go negative in polar regions during winter)
  return Math.max(0, Math.min(90, sunAngle));
};

// Calculate relative temperature based on sun angle (simplified model)
// Returns a value from 0-100 representing relative warmth
const calculateRelativeTemperature = (sunAngle: number, daylightHours: number): number => {
  // Temperature is influenced by both sun angle (intensity) and daylight hours (duration)
  const angleContribution = sunAngle / 90; // 0-1
  const daylightContribution = daylightHours / 24; // 0-1

  // Weighted combination: angle matters more than duration
  const temp = (angleContribution * 0.7 + daylightContribution * 0.3) * 100;
  return Math.max(0, Math.min(100, temp));
};

// Get yearly data for a location (12 months)
const getYearlyData = (latitude: number): Array<{
  month: string;
  angle: number;
  daylight: number;
  temperature: number;
  orbitalAngle: number;
}> => {
  return MONTHS.map((month, index) => {
    // Convert month index to orbital angle (Jan = ~270°, Mar = 0°, Jun = 90°, etc.)
    const orbitalAngle = ((index - 2) * 30 + 360) % 360;
    const angle = calculateSunAngle(latitude, orbitalAngle);
    const daylight = calculateDaylightHours(latitude, orbitalAngle);
    const temperature = calculateRelativeTemperature(angle, daylight);

    return { month, angle, daylight, temperature, orbitalAngle };
  });
};

// Get dynamic annotation based on orbital position
const getDynamicAnnotation = (earthPositionAngle: number): {
  title: string;
  description: string;
  northStatus: string;
  southStatus: string;
} => {
  const angle = ((earthPositionAngle % 360) + 360) % 360;

  if (angle >= 315 || angle < 45) {
    return {
      title: 'March Equinox',
      description: 'Sun shines equally on both hemispheres',
      northStatus: 'Spring begins - days getting longer',
      southStatus: 'Fall begins - days getting shorter',
    };
  } else if (angle >= 45 && angle < 135) {
    return {
      title: 'June Solstice',
      description: 'Northern hemisphere tilted toward Sun',
      northStatus: 'Summer - longest days, most direct sunlight',
      southStatus: 'Winter - shortest days, least direct sunlight',
    };
  } else if (angle >= 135 && angle < 225) {
    return {
      title: 'September Equinox',
      description: 'Sun shines equally on both hemispheres',
      northStatus: 'Fall begins - days getting shorter',
      southStatus: 'Spring begins - days getting longer',
    };
  } else {
    return {
      title: 'December Solstice',
      description: 'Southern hemisphere tilted toward Sun',
      northStatus: 'Winter - shortest days, least direct sunlight',
      southStatus: 'Summer - longest days, most direct sunlight',
    };
  }
};

// Convert 3D spherical coordinates to 2D projection
const project3DTo2D = (
  lat: number,
  lon: number,
  rotation: number,
  earthX: number,
  earthY: number,
  radius: number
): { x: number; y: number; visible: boolean } => {
  const latRad = (lat * Math.PI) / 180;
  const lonRad = ((lon + rotation) * Math.PI) / 180;

  // 3D coordinates on sphere
  const x3d = Math.cos(latRad) * Math.sin(lonRad);
  const y3d = Math.sin(latRad);
  const z3d = Math.cos(latRad) * Math.cos(lonRad);

  // Simple orthographic projection
  const x = earthX + x3d * radius;
  const y = earthY - y3d * radius; // Negative because SVG y grows downward

  // Point is visible if it's on the front hemisphere
  const visible = z3d > 0;

  return { x, y, visible };
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

// Sun Angle Diagram - Shows how sunlight hits the surface at the selected location
interface SunAngleDiagramProps {
  sunAngle: number;
  locationName: string;
  latitude: number;
}

const SunAngleDiagram: React.FC<SunAngleDiagramProps> = ({ sunAngle, locationName, latitude }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 280;
    const height = 180;
    const groundY = 140;
    const personX = 140;

    // Background gradient (sky)
    const defs = svg.append('defs');
    const skyGradient = defs.append('linearGradient')
      .attr('id', 'skyGradient-angle')
      .attr('x1', '0%').attr('y1', '0%')
      .attr('x2', '0%').attr('y2', '100%');
    skyGradient.append('stop').attr('offset', '0%').attr('stop-color', '#1e3a5f');
    skyGradient.append('stop').attr('offset', '100%').attr('stop-color', '#3b82f6');

    // Sky background
    svg.append('rect')
      .attr('width', width)
      .attr('height', groundY)
      .attr('fill', 'url(#skyGradient-angle)');

    // Ground
    svg.append('rect')
      .attr('y', groundY)
      .attr('width', width)
      .attr('height', height - groundY)
      .attr('fill', '#4a7c59');

    // Calculate sun position based on angle
    const angleRad = (sunAngle * Math.PI) / 180;
    const sunDistance = 100;
    const sunX = personX + Math.cos(angleRad) * sunDistance * (latitude >= 0 ? -1 : 1);
    const sunY = groundY - Math.sin(angleRad) * sunDistance;

    // Sun rays hitting the ground
    const rayGroup = svg.append('g');
    for (let i = -2; i <= 2; i++) {
      const rayEndX = personX + i * 20;
      rayGroup.append('line')
        .attr('x1', sunX + i * 5)
        .attr('y1', sunY)
        .attr('x2', rayEndX)
        .attr('y2', groundY)
        .attr('stroke', '#fbbf24')
        .attr('stroke-width', 2)
        .attr('opacity', 0.6);
    }

    // Sun
    svg.append('circle')
      .attr('cx', sunX)
      .attr('cy', sunY)
      .attr('r', 20)
      .attr('fill', '#fbbf24');

    // Person/marker on ground
    svg.append('circle')
      .attr('cx', personX)
      .attr('cy', groundY - 15)
      .attr('r', 8)
      .attr('fill', '#ef4444');
    svg.append('line')
      .attr('x1', personX)
      .attr('y1', groundY - 7)
      .attr('x2', personX)
      .attr('y2', groundY)
      .attr('stroke', '#ef4444')
      .attr('stroke-width', 3);

    // Angle arc
    const arcRadius = 40;
    const arc = d3.arc<unknown>()
      .innerRadius(arcRadius - 2)
      .outerRadius(arcRadius)
      .startAngle(-Math.PI / 2)
      .endAngle(-Math.PI / 2 + angleRad);

    svg.append('path')
      .attr('d', arc({}) || '')
      .attr('transform', `translate(${personX}, ${groundY})`)
      .attr('fill', '#fbbf24');

    // Angle label
    svg.append('text')
      .attr('x', personX + 50)
      .attr('y', groundY - 30)
      .attr('fill', '#fbbf24')
      .attr('font-size', 14)
      .attr('font-weight', 'bold')
      .text(`${Math.round(sunAngle)}°`);

    // Horizon line
    svg.append('line')
      .attr('x1', 20)
      .attr('y1', groundY)
      .attr('x2', width - 20)
      .attr('y2', groundY)
      .attr('stroke', '#94a3b8')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4,2');

    // Labels
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', 20)
      .attr('text-anchor', 'middle')
      .attr('fill', 'white')
      .attr('font-size', 12)
      .text(locationName);

    svg.append('text')
      .attr('x', 20)
      .attr('y', groundY - 5)
      .attr('fill', '#94a3b8')
      .attr('font-size', 10)
      .text('Horizon');

  }, [sunAngle, locationName, latitude]);

  return (
    <svg
      ref={svgRef}
      width="280"
      height="180"
      className="rounded-lg"
      style={{ maxWidth: '100%', height: 'auto' }}
    />
  );
};

// Temperature/Sun Angle Graph - Shows yearly variation
interface YearlyGraphProps {
  latitude: number;
  currentOrbitalAngle: number;
  locationName: string;
}

const YearlyGraph: React.FC<YearlyGraphProps> = ({ latitude, currentOrbitalAngle, locationName }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const yearlyData = useMemo(() => getYearlyData(latitude), [latitude]);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 400;
    const height = 200;
    const margin = { top: 30, right: 20, bottom: 40, left: 45 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Background
    svg.append('rect')
      .attr('width', width)
      .attr('height', height)
      .attr('fill', '#1e293b')
      .attr('rx', 8);

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // Scales
    const xScale = d3.scaleBand()
      .domain(MONTHS)
      .range([0, innerWidth])
      .padding(0.1);

    const yScaleAngle = d3.scaleLinear()
      .domain([0, 90])
      .range([innerHeight, 0]);

    const yScaleTemp = d3.scaleLinear()
      .domain([0, 100])
      .range([innerHeight, 0]);

    // Grid lines
    g.append('g')
      .attr('class', 'grid')
      .selectAll('line')
      .data([0, 30, 60, 90])
      .enter()
      .append('line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', d => yScaleAngle(d))
      .attr('y2', d => yScaleAngle(d))
      .attr('stroke', '#334155')
      .attr('stroke-dasharray', '2,2');

    // Temperature area fill
    const tempArea = d3.area<typeof yearlyData[0]>()
      .x(d => (xScale(d.month) || 0) + xScale.bandwidth() / 2)
      .y0(innerHeight)
      .y1(d => yScaleTemp(d.temperature))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(yearlyData)
      .attr('fill', 'url(#tempGradient)')
      .attr('opacity', 0.3)
      .attr('d', tempArea);

    // Gradient for temperature area
    const defs = svg.append('defs');
    const tempGradient = defs.append('linearGradient')
      .attr('id', 'tempGradient')
      .attr('x1', '0%').attr('y1', '100%')
      .attr('x2', '0%').attr('y2', '0%');
    tempGradient.append('stop').attr('offset', '0%').attr('stop-color', '#3b82f6');
    tempGradient.append('stop').attr('offset', '100%').attr('stop-color', '#ef4444');

    // Sun angle line
    const angleLine = d3.line<typeof yearlyData[0]>()
      .x(d => (xScale(d.month) || 0) + xScale.bandwidth() / 2)
      .y(d => yScaleAngle(d.angle))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(yearlyData)
      .attr('fill', 'none')
      .attr('stroke', '#fbbf24')
      .attr('stroke-width', 3)
      .attr('d', angleLine);

    // Temperature line
    const tempLine = d3.line<typeof yearlyData[0]>()
      .x(d => (xScale(d.month) || 0) + xScale.bandwidth() / 2)
      .y(d => yScaleTemp(d.temperature))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(yearlyData)
      .attr('fill', 'none')
      .attr('stroke', '#ef4444')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '4,2')
      .attr('d', tempLine);

    // Current position marker
    const currentMonth = MONTHS[Math.floor(((currentOrbitalAngle + 60) % 360) / 30)];
    const currentData = yearlyData.find(d => d.month === currentMonth);
    if (currentData) {
      const cx = (xScale(currentMonth) || 0) + xScale.bandwidth() / 2;

      // Vertical line
      g.append('line')
        .attr('x1', cx)
        .attr('x2', cx)
        .attr('y1', 0)
        .attr('y2', innerHeight)
        .attr('stroke', '#22c55e')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '4,4');

      // Angle dot
      g.append('circle')
        .attr('cx', cx)
        .attr('cy', yScaleAngle(currentData.angle))
        .attr('r', 6)
        .attr('fill', '#fbbf24')
        .attr('stroke', 'white')
        .attr('stroke-width', 2);

      // Temp dot
      g.append('circle')
        .attr('cx', cx)
        .attr('cy', yScaleTemp(currentData.temperature))
        .attr('r', 5)
        .attr('fill', '#ef4444')
        .attr('stroke', 'white')
        .attr('stroke-width', 2);
    }

    // X axis
    g.append('g')
      .attr('transform', `translate(0, ${innerHeight})`)
      .call(d3.axisBottom(xScale).tickSize(0))
      .selectAll('text')
      .attr('fill', '#94a3b8')
      .attr('font-size', 9);

    g.select('.domain').attr('stroke', '#475569');

    // Y axis (angle)
    g.append('g')
      .call(d3.axisLeft(yScaleAngle).ticks(4).tickFormat(d => `${d}°`))
      .selectAll('text')
      .attr('fill', '#fbbf24')
      .attr('font-size', 10);

    g.select('.domain').attr('stroke', '#475569');

    // Title
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', 18)
      .attr('text-anchor', 'middle')
      .attr('fill', 'white')
      .attr('font-size', 12)
      .attr('font-weight', 'bold')
      .text(`Yearly Sun Angle & Temperature - ${locationName}`);

    // Legend
    const legend = svg.append('g')
      .attr('transform', `translate(${width - 120}, ${margin.top + 5})`);

    legend.append('line')
      .attr('x1', 0).attr('x2', 20)
      .attr('y1', 0).attr('y2', 0)
      .attr('stroke', '#fbbf24')
      .attr('stroke-width', 3);
    legend.append('text')
      .attr('x', 25).attr('y', 4)
      .attr('fill', '#fbbf24')
      .attr('font-size', 10)
      .text('Sun Angle');

    legend.append('line')
      .attr('x1', 0).attr('x2', 20)
      .attr('y1', 15).attr('y2', 15)
      .attr('stroke', '#ef4444')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '4,2');
    legend.append('text')
      .attr('x', 25).attr('y', 19)
      .attr('fill', '#ef4444')
      .attr('font-size', 10)
      .text('Rel. Temp');

  }, [yearlyData, currentOrbitalAngle, locationName]);

  return (
    <svg
      ref={svgRef}
      width="400"
      height="200"
      className="rounded-lg"
      style={{ maxWidth: '100%', height: 'auto' }}
    />
  );
};

// Sunlight Intensity Inset - Shows why angled light = less heat
const SunlightIntensityInset: React.FC<{ sunAngle: number }> = ({ sunAngle }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 300;
    const height = 160;

    // Background
    svg.append('rect')
      .attr('width', width)
      .attr('height', height)
      .attr('fill', '#0f172a')
      .attr('rx', 8);

    // Title
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', 20)
      .attr('text-anchor', 'middle')
      .attr('fill', 'white')
      .attr('font-size', 11)
      .attr('font-weight', 'bold')
      .text('Why Angle Matters');

    // Direct sunlight (left side)
    const leftCenterX = 80;
    const groundY = 130;
    const beamWidth = 30;

    // Direct rays
    svg.append('rect')
      .attr('x', leftCenterX - beamWidth / 2)
      .attr('y', 40)
      .attr('width', beamWidth)
      .attr('height', 80)
      .attr('fill', '#fbbf24')
      .attr('opacity', 0.4);

    // Ground spot (concentrated)
    svg.append('rect')
      .attr('x', leftCenterX - beamWidth / 2)
      .attr('y', groundY - 10)
      .attr('width', beamWidth)
      .attr('height', 10)
      .attr('fill', '#ef4444');

    svg.append('text')
      .attr('x', leftCenterX)
      .attr('y', groundY + 15)
      .attr('text-anchor', 'middle')
      .attr('fill', '#ef4444')
      .attr('font-size', 9)
      .attr('font-weight', 'bold')
      .text('CONCENTRATED');

    svg.append('text')
      .attr('x', leftCenterX)
      .attr('y', groundY + 26)
      .attr('text-anchor', 'middle')
      .attr('fill', '#94a3b8')
      .attr('font-size', 8)
      .text('More heat!');

    // Angled sunlight (right side)
    const rightCenterX = 220;
    const angleRad = ((90 - sunAngle) * Math.PI) / 180;
    const spreadFactor = Math.max(1.5, 1 / Math.sin((sunAngle * Math.PI) / 180));
    const spreadWidth = Math.min(beamWidth * spreadFactor, 80);

    // Angled rays (parallelogram)
    const offsetX = Math.cos(angleRad) * 80;
    const points = [
      [rightCenterX - beamWidth / 2 + offsetX, 40],
      [rightCenterX + beamWidth / 2 + offsetX, 40],
      [rightCenterX + spreadWidth / 2, groundY - 10],
      [rightCenterX - spreadWidth / 2, groundY - 10],
    ];

    svg.append('polygon')
      .attr('points', points.map(p => p.join(',')).join(' '))
      .attr('fill', '#fbbf24')
      .attr('opacity', 0.3);

    // Ground spot (spread out)
    svg.append('rect')
      .attr('x', rightCenterX - spreadWidth / 2)
      .attr('y', groundY - 10)
      .attr('width', spreadWidth)
      .attr('height', 10)
      .attr('fill', '#60a5fa');

    svg.append('text')
      .attr('x', rightCenterX)
      .attr('y', groundY + 15)
      .attr('text-anchor', 'middle')
      .attr('fill', '#60a5fa')
      .attr('font-size', 9)
      .attr('font-weight', 'bold')
      .text('SPREAD OUT');

    svg.append('text')
      .attr('x', rightCenterX)
      .attr('y', groundY + 26)
      .attr('text-anchor', 'middle')
      .attr('fill', '#94a3b8')
      .attr('font-size', 8)
      .text('Less heat');

    // Labels above
    svg.append('text')
      .attr('x', leftCenterX)
      .attr('y', 35)
      .attr('text-anchor', 'middle')
      .attr('fill', '#fbbf24')
      .attr('font-size', 10)
      .text('Direct (90°)');

    svg.append('text')
      .attr('x', rightCenterX)
      .attr('y', 35)
      .attr('text-anchor', 'middle')
      .attr('fill', '#fbbf24')
      .attr('font-size', 10)
      .text(`Angled (${Math.round(sunAngle)}°)`);

    // Arrow showing comparison
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', 85)
      .attr('text-anchor', 'middle')
      .attr('fill', '#64748b')
      .attr('font-size', 16)
      .text('→');

    svg.append('text')
      .attr('x', width / 2)
      .attr('y', 100)
      .attr('text-anchor', 'middle')
      .attr('fill', '#64748b')
      .attr('font-size', 9)
      .text('Same light');

  }, [sunAngle]);

  return (
    <svg
      ref={svgRef}
      width="300"
      height="160"
      className="rounded-lg"
      style={{ maxWidth: '100%', height: 'auto' }}
    />
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const DayNightSeasons: React.FC<DayNightSeasonsProps> = ({ data, className }) => {
  const {
    title,
    description,
    focusMode,
    initialEarthPosition,
    customPositionAngle,
    viewPerspective,
    showTiltAxis,
    showSunRays,
    showTerminator,
    showDaylightHours,
    showTemperatureZones,
    animationMode,
    timeSpeed,
    markerLatitudes,
    gradeLevel,
    learningObjectives,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // State management
  const [earthRotation, setEarthRotation] = useState(0); // 0-360 degrees
  const [earthOrbitPosition, setEarthOrbitPosition] = useState(() => {
    if (customPositionAngle !== undefined) return customPositionAngle;
    if (initialEarthPosition === 'custom') return 0;
    return ORBITAL_POSITIONS[initialEarthPosition];
  });
  const [isAnimating, setIsAnimating] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(
    markerLatitudes.length > 0 ? markerLatitudes[0].id : null
  );
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [showExplanation, setShowExplanation] = useState(false);

  const svgRef = useRef<SVGSVGElement>(null);
  const animationFrameRef = useRef<number>();
  const lastUpdateRef = useRef<number>(Date.now());

  // Evaluation hook
  const {
    submitResult,
    hasSubmitted,
    resetAttempt,
  } = usePrimitiveEvaluation<DayNightSeasonsMetrics>({
    primitiveType: 'day-night-seasons',
    instanceId: instanceId || `day-night-seasons-${Date.now()}`,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit,
  });

  // Calculate Earth position in orbit
  const earthOrbitX = useMemo(() => {
    if (viewPerspective === 'sun_view') return 600;
    const angleRad = (earthOrbitPosition * Math.PI) / 180;
    return 350 + Math.cos(angleRad) * ORBIT_RADIUS_X;
  }, [earthOrbitPosition, viewPerspective]);

  const earthOrbitY = useMemo(() => {
    if (viewPerspective === 'sun_view') return 200;
    const angleRad = (earthOrbitPosition * Math.PI) / 180;
    return 200 + Math.sin(angleRad) * ORBIT_RADIUS_Y;
  }, [earthOrbitPosition, viewPerspective]);

  const sunX = viewPerspective === 'sun_view' ? 200 : 350;
  const sunY = 200;

  // Animation loop
  useEffect(() => {
    if (!isAnimating) return;

    const animate = () => {
      const now = Date.now();
      const deltaTime = now - lastUpdateRef.current;
      lastUpdateRef.current = now;

      if (animationMode === 'rotation' || animationMode === 'both') {
        setEarthRotation((prev) => (prev + (0.5 * timeSpeed * deltaTime / 16.67)) % 360);
      }

      if (animationMode === 'orbit' || animationMode === 'both') {
        setEarthOrbitPosition((prev) => (prev + (0.02 * timeSpeed * deltaTime / 16.67)) % 360);
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isAnimating, animationMode, timeSpeed]);

  // D3 Visualization
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Background
    svg
      .append('rect')
      .attr('width', 800)
      .attr('height', 500)
      .attr('fill', '#0a0a1a');

    // Define gradients
    const defs = svg.append('defs');

    // Sun gradient
    const sunGradient = defs
      .append('radialGradient')
      .attr('id', 'sunGradient');
    sunGradient.append('stop').attr('offset', '0%').attr('stop-color', '#FFF9E3');
    sunGradient.append('stop').attr('offset', '50%').attr('stop-color', '#FFD700');
    sunGradient.append('stop').attr('offset', '100%').attr('stop-color', '#FFA500');

    // Earth gradient
    const earthGradient = defs
      .append('radialGradient')
      .attr('id', 'earthGradient');
    earthGradient.append('stop').attr('offset', '0%').attr('stop-color', '#60A5FA');
    earthGradient.append('stop').attr('offset', '70%').attr('stop-color', '#3B82F6');
    earthGradient.append('stop').attr('offset', '100%').attr('stop-color', '#1E40AF');

    // Orbit path
    if ((focusMode === 'seasons' || focusMode === 'both') && viewPerspective !== 'surface') {
      svg
        .append('ellipse')
        .attr('cx', 350)
        .attr('cy', 200)
        .attr('rx', ORBIT_RADIUS_X)
        .attr('ry', ORBIT_RADIUS_Y)
        .attr('fill', 'none')
        .attr('stroke', '#4A5568')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '4,4');

      // Orbital position markers
      const positions = [
        { angle: 0, label: 'Mar', x: 350 + ORBIT_RADIUS_X, y: 200 },
        { angle: 90, label: 'Jun', x: 350, y: 200 + ORBIT_RADIUS_Y },
        { angle: 180, label: 'Sep', x: 350 - ORBIT_RADIUS_X, y: 200 },
        { angle: 270, label: 'Dec', x: 350, y: 200 - ORBIT_RADIUS_Y },
      ];

      positions.forEach((pos) => {
        svg
          .append('text')
          .attr('x', pos.x)
          .attr('y', pos.y)
          .attr('text-anchor', 'middle')
          .attr('fill', '#9CA3AF')
          .attr('font-size', 12)
          .text(pos.label);
      });
    }

    // Sun
    const sunGroup = svg.append('g');

    // Sun glow
    sunGroup
      .append('circle')
      .attr('cx', sunX)
      .attr('cy', sunY)
      .attr('r', SUN_RADIUS + 10)
      .attr('fill', '#FFD700')
      .attr('opacity', 0.2);

    sunGroup
      .append('circle')
      .attr('cx', sunX)
      .attr('cy', sunY)
      .attr('r', SUN_RADIUS + 5)
      .attr('fill', '#FFD700')
      .attr('opacity', 0.3);

    // Sun body
    sunGroup
      .append('circle')
      .attr('cx', sunX)
      .attr('cy', sunY)
      .attr('r', SUN_RADIUS)
      .attr('fill', 'url(#sunGradient)');

    // Sun rays
    if (showSunRays) {
      const rayGroup = svg.append('g').attr('opacity', 0.4);
      const numRays = 16;

      for (let i = 0; i < numRays; i++) {
        const angle = (i * 360) / numRays;
        const angleRad = (angle * Math.PI) / 180;
        const x1 = sunX + Math.cos(angleRad) * (SUN_RADIUS + 5);
        const y1 = sunY + Math.sin(angleRad) * (SUN_RADIUS + 5);
        const x2 = sunX + Math.cos(angleRad) * 700;
        const y2 = sunY + Math.sin(angleRad) * 700;

        rayGroup
          .append('line')
          .attr('x1', x1)
          .attr('y1', y1)
          .attr('x2', x2)
          .attr('y2', y2)
          .attr('stroke', '#FFD700')
          .attr('stroke-width', 0.5);
      }
    }

    // Earth group with tilt
    const earthGroup = svg
      .append('g')
      .attr('transform', `translate(${earthOrbitX}, ${earthOrbitY}) rotate(${EARTH_TILT_DEGREES})`);

    // Earth shadow (back hemisphere)
    earthGroup
      .append('circle')
      .attr('r', EARTH_RADIUS)
      .attr('fill', '#1E293B')
      .attr('opacity', 0.3);

    // Earth sphere
    earthGroup
      .append('circle')
      .attr('r', EARTH_RADIUS)
      .attr('fill', 'url(#earthGradient)');

    // Hemisphere shading (shows which hemisphere gets more direct sunlight)
    if (focusMode === 'seasons' || focusMode === 'both') {
      // Calculate which hemisphere is tilted toward the sun
      // At June solstice (90°), north is toward sun
      // At December solstice (270°), south is toward sun
      const normalizedAngle = ((earthOrbitPosition % 360) + 360) % 360;
      const northWarmth = Math.sin((normalizedAngle * Math.PI) / 180); // +1 at June, -1 at Dec

      // Northern hemisphere warm overlay
      if (northWarmth > 0.1) {
        const northClipPath = defs.append('clipPath').attr('id', 'northHemisphere');
        northClipPath.append('rect')
          .attr('x', -EARTH_RADIUS)
          .attr('y', -EARTH_RADIUS)
          .attr('width', EARTH_RADIUS * 2)
          .attr('height', EARTH_RADIUS);

        earthGroup.append('circle')
          .attr('r', EARTH_RADIUS - 1)
          .attr('fill', '#ef4444')
          .attr('opacity', northWarmth * 0.25)
          .attr('clip-path', 'url(#northHemisphere)');

        // Cold southern hemisphere
        const southClipPath = defs.append('clipPath').attr('id', 'southHemisphere');
        southClipPath.append('rect')
          .attr('x', -EARTH_RADIUS)
          .attr('y', 0)
          .attr('width', EARTH_RADIUS * 2)
          .attr('height', EARTH_RADIUS);

        earthGroup.append('circle')
          .attr('r', EARTH_RADIUS - 1)
          .attr('fill', '#3b82f6')
          .attr('opacity', northWarmth * 0.2)
          .attr('clip-path', 'url(#southHemisphere)');
      }

      // Southern hemisphere warm overlay (December)
      if (northWarmth < -0.1) {
        const southWarmClip = defs.append('clipPath').attr('id', 'southHemisphereWarm');
        southWarmClip.append('rect')
          .attr('x', -EARTH_RADIUS)
          .attr('y', 0)
          .attr('width', EARTH_RADIUS * 2)
          .attr('height', EARTH_RADIUS);

        earthGroup.append('circle')
          .attr('r', EARTH_RADIUS - 1)
          .attr('fill', '#ef4444')
          .attr('opacity', Math.abs(northWarmth) * 0.25)
          .attr('clip-path', 'url(#southHemisphereWarm)');

        // Cold northern hemisphere
        const northColdClip = defs.append('clipPath').attr('id', 'northHemisphereCold');
        northColdClip.append('rect')
          .attr('x', -EARTH_RADIUS)
          .attr('y', -EARTH_RADIUS)
          .attr('width', EARTH_RADIUS * 2)
          .attr('height', EARTH_RADIUS);

        earthGroup.append('circle')
          .attr('r', EARTH_RADIUS - 1)
          .attr('fill', '#3b82f6')
          .attr('opacity', Math.abs(northWarmth) * 0.2)
          .attr('clip-path', 'url(#northHemisphereCold)');
      }
    }

    // Continents (simplified, decorative)
    const continentData = [
      { cx: -20, cy: -30, rx: 25, ry: 20 }, // North America/Europe
      { cx: 10, cy: 10, rx: 30, ry: 15 },   // Africa
      { cx: -15, cy: 35, rx: 20, ry: 12 },  // South America
    ];

    continentData.forEach((continent) => {
      earthGroup
        .append('ellipse')
        .attr('cx', continent.cx)
        .attr('cy', continent.cy)
        .attr('rx', continent.rx)
        .attr('ry', continent.ry)
        .attr('fill', '#10B981')
        .attr('opacity', 0.6);
    });

    // Terminator (day/night boundary)
    if (showTerminator) {
      // Calculate terminator based on Earth rotation and Sun position
      const angleToSun = Math.atan2(sunY - earthOrbitY, sunX - earthOrbitX) * (180 / Math.PI);
      const terminatorAngle = angleToSun - earthRotation - EARTH_TILT_DEGREES;

      // Create night shadow as a semi-circle
      const nightPath = d3.path();
      nightPath.arc(0, 0, EARTH_RADIUS, (terminatorAngle * Math.PI) / 180, ((terminatorAngle + 180) * Math.PI) / 180);
      nightPath.closePath();

      earthGroup
        .append('path')
        .attr('d', nightPath.toString())
        .attr('fill', 'rgba(0, 0, 0, 0.6)');
    }

    // Temperature zones
    if (showTemperatureZones) {
      const zoneGroup = earthGroup.append('g').attr('opacity', 0.25);

      // Tropical zone (red/orange)
      zoneGroup
        .append('rect')
        .attr('x', -EARTH_RADIUS)
        .attr('y', -EARTH_RADIUS * 0.4)
        .attr('width', EARTH_RADIUS * 2)
        .attr('height', EARTH_RADIUS * 0.8)
        .attr('fill', '#F59E0B');

      // Temperate zones (yellow/green)
      zoneGroup
        .append('rect')
        .attr('x', -EARTH_RADIUS)
        .attr('y', -EARTH_RADIUS * 0.8)
        .attr('width', EARTH_RADIUS * 2)
        .attr('height', EARTH_RADIUS * 0.4)
        .attr('fill', '#10B981');

      zoneGroup
        .append('rect')
        .attr('x', -EARTH_RADIUS)
        .attr('y', EARTH_RADIUS * 0.4)
        .attr('width', EARTH_RADIUS * 2)
        .attr('height', EARTH_RADIUS * 0.4)
        .attr('fill', '#10B981');
    }

    // Location markers
    markerLatitudes.forEach((location) => {
      const projected = project3DTo2D(
        location.latitude,
        location.longitude,
        earthRotation,
        0,
        0,
        EARTH_RADIUS
      );

      if (projected.visible || true) { // Always show for simplicity
        const marker = earthGroup
          .append('circle')
          .attr('cx', projected.x)
          .attr('cy', projected.y)
          .attr('r', 5)
          .attr('fill', location.color)
          .attr('stroke', 'white')
          .attr('stroke-width', 1.5)
          .attr('cursor', 'pointer')
          .attr('opacity', projected.visible ? 1 : 0.3);

        marker.on('click', () => {
          setSelectedLocation(location.id);
          setUserAnswers((prev) => ({ ...prev, [`explored_${location.id}`]: 'yes' }));
        });

        // Highlight selected location
        if (selectedLocation === location.id) {
          earthGroup
            .append('circle')
            .attr('cx', projected.x)
            .attr('cy', projected.y)
            .attr('r', 8)
            .attr('fill', 'none')
            .attr('stroke', location.color)
            .attr('stroke-width', 2)
            .attr('opacity', 0.8);
        }
      }
    });

    // Tilt axis
    if (showTiltAxis) {
      earthGroup
        .append('line')
        .attr('x1', 0)
        .attr('y1', -EARTH_RADIUS - 30)
        .attr('x2', 0)
        .attr('y2', EARTH_RADIUS + 30)
        .attr('stroke', '#FBBF24')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '4,2');

      earthGroup
        .append('text')
        .attr('x', 10)
        .attr('y', -EARTH_RADIUS - 35)
        .attr('fill', '#FBBF24')
        .attr('font-size', 12)
        .attr('font-weight', 'bold')
        .text('23.5° tilt');
    }

  }, [
    earthRotation,
    earthOrbitPosition,
    earthOrbitX,
    earthOrbitY,
    sunX,
    sunY,
    focusMode,
    viewPerspective,
    showTiltAxis,
    showSunRays,
    showTerminator,
    showTemperatureZones,
    markerLatitudes,
    selectedLocation,
  ]);

  // Calculate daylight hours for selected location
  const selectedLocationData = markerLatitudes.find((m) => m.id === selectedLocation);
  const daylightHours = selectedLocationData
    ? calculateDaylightHours(selectedLocationData.latitude, earthOrbitPosition)
    : 12;
  const seasonName = selectedLocationData
    ? getSeasonName(selectedLocationData.latitude, earthOrbitPosition)
    : '';

  // Calculate sun angle for selected location
  const sunAngle = selectedLocationData
    ? calculateSunAngle(selectedLocationData.latitude, earthOrbitPosition)
    : 90;

  // Get dynamic annotation based on current orbital position
  const dynamicAnnotation = useMemo(
    () => getDynamicAnnotation(earthOrbitPosition),
    [earthOrbitPosition]
  );

  // Evaluation handlers
  const handleCheckUnderstanding = () => {
    if (hasSubmitted) return;

    let correctAnswers = 0;
    let totalQuestions = 0;

    if (learningObjectives && learningObjectives.length > 0) {
      totalQuestions = learningObjectives.length;
      learningObjectives.forEach((_, index) => {
        if (userAnswers[`q${index}`] && userAnswers[`q${index}`].trim().length > 0) {
          correctAnswers++;
        }
      });
    } else {
      totalQuestions = 2;
      if (userAnswers['rotation']) correctAnswers++;
      if (userAnswers['tilt']) correctAnswers++;
    }

    const score = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 100;
    const success = score >= 70;

    const metrics: DayNightSeasonsMetrics = {
      type: 'day-night-seasons',
      focusMode,
      questionsAnswered: correctAnswers,
      totalQuestions,
      understandingScore: score,
      locationsExplored: markerLatitudes.filter((m) => userAnswers[`explored_${m.id}`]).length,
      animationsViewed: isAnimating || userAnswers['viewed_animation'] === 'yes',
      conceptsMastered: success,
    };

    submitResult(success, score, metrics, {
      studentWork: { answers: userAnswers },
    });
  };

  const handleReset = () => {
    setUserAnswers({});
    setEarthRotation(0);
    setEarthOrbitPosition(() => {
      if (customPositionAngle !== undefined) return customPositionAngle;
      if (initialEarthPosition === 'custom') return 0;
      return ORBITAL_POSITIONS[initialEarthPosition];
    });
    setIsAnimating(false);
    setShowExplanation(false);
    resetAttempt();
  };

  const handleLocationSelect = (locationId: string) => {
    setSelectedLocation(locationId);
    setUserAnswers((prev) => ({ ...prev, [`explored_${locationId}`]: 'yes' }));
  };

  return (
    <div className={`bg-slate-900 rounded-xl p-6 ${className}`}>
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-2xl font-bold text-white mb-2">{title}</h3>
        <p className="text-slate-300">{description}</p>
      </div>

      {/* D3 Visualization */}
      <div className="bg-slate-950 rounded-lg p-4 mb-4 flex justify-center">
        <svg
          ref={svgRef}
          width="800"
          height="500"
          className="rounded-lg"
          style={{ maxWidth: '100%', height: 'auto' }}
        />
      </div>

      {/* Dynamic Annotation - Shows what's happening right now */}
      {(focusMode === 'seasons' || focusMode === 'both') && (
        <div className="bg-gradient-to-r from-amber-900/30 to-orange-900/30 border border-amber-700/50 rounded-lg p-4 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h4 className="text-amber-300 font-bold text-lg flex items-center gap-2">
                <span>🌍</span>
                <span>{dynamicAnnotation.title}</span>
              </h4>
              <p className="text-amber-100/80 text-sm mt-1">{dynamicAnnotation.description}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="bg-red-900/40 rounded-lg px-4 py-2 border border-red-700/50">
                <div className="text-red-300 text-xs font-medium">Northern Hemisphere</div>
                <div className="text-white text-sm">{dynamicAnnotation.northStatus}</div>
              </div>
              <div className="bg-blue-900/40 rounded-lg px-4 py-2 border border-blue-700/50">
                <div className="text-blue-300 text-xs font-medium">Southern Hemisphere</div>
                <div className="text-white text-sm">{dynamicAnnotation.southStatus}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Controls Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Animation Controls */}
        <div className="bg-slate-800 rounded-lg p-4">
          <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
            <span>🎬</span>
            <span>Animation Controls</span>
          </h4>
          <div className="space-y-3">
            <button
              onClick={() => {
                setIsAnimating(!isAnimating);
                setUserAnswers((prev) => ({ ...prev, viewed_animation: 'yes' }));
              }}
              className={`w-full px-4 py-2 rounded-lg font-medium transition-colors ${
                isAnimating
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {isAnimating ? '⏸️ Pause' : '▶️ Play'} Animation
            </button>

            {(focusMode === 'day-night' || focusMode === 'both') && (
              <div>
                <label className="text-slate-300 text-sm mb-2 block">
                  Earth Rotation: {Math.round(earthRotation)}°
                </label>
                <input
                  type="range"
                  min="0"
                  max="360"
                  step="1"
                  value={earthRotation}
                  onChange={(e) => setEarthRotation(Number(e.target.value))}
                  className="w-full"
                  disabled={isAnimating && (animationMode === 'rotation' || animationMode === 'both')}
                />
              </div>
            )}

            {(focusMode === 'seasons' || focusMode === 'both') && (
              <div>
                <label className="text-slate-300 text-sm mb-2 block">
                  Earth Position in Orbit
                </label>
                <select
                  value={
                    Object.entries(ORBITAL_POSITIONS).find(
                      ([_, angle]) => Math.abs(angle - earthOrbitPosition) < 45
                    )?.[0] || 'custom'
                  }
                  onChange={(e) => {
                    const position = e.target.value as keyof typeof ORBITAL_POSITIONS;
                    if (position !== 'custom') {
                      setEarthOrbitPosition(ORBITAL_POSITIONS[position]);
                    }
                  }}
                  className="w-full bg-slate-700 text-white border border-slate-600 rounded px-3 py-2 text-sm"
                  disabled={isAnimating && (animationMode === 'orbit' || animationMode === 'both')}
                >
                  <option value="march_equinox">March Equinox (Spring)</option>
                  <option value="june_solstice">June Solstice (Summer NH)</option>
                  <option value="sept_equinox">September Equinox (Fall)</option>
                  <option value="dec_solstice">December Solstice (Winter NH)</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Location Data */}
        {markerLatitudes.length > 0 && (
          <div className="bg-slate-800 rounded-lg p-4">
            <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
              <span>📍</span>
              <span>Location Data</span>
            </h4>
            <div className="space-y-3">
              <div>
                <label className="text-slate-300 text-sm mb-2 block">Select Location</label>
                <select
                  value={selectedLocation || ''}
                  onChange={(e) => handleLocationSelect(e.target.value)}
                  className="w-full bg-slate-700 text-white border border-slate-600 rounded px-3 py-2 text-sm"
                >
                  {markerLatitudes.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.emoji} {location.name} ({location.latitude}°{location.latitude >= 0 ? 'N' : 'S'})
                    </option>
                  ))}
                </select>
              </div>

              {selectedLocationData && (
                <div className="space-y-2">
                  {showDaylightHours && (
                    <div className="bg-slate-700 rounded-lg p-3">
                      <div className="text-slate-400 text-xs mb-1">☀️ Daylight Hours</div>
                      <div className="text-white text-2xl font-bold">
                        {formatGradeAppropriate(daylightHours, gradeLevel)} hours
                      </div>
                    </div>
                  )}

                  {(focusMode === 'seasons' || focusMode === 'both') && (
                    <>
                      <div className="bg-slate-700 rounded-lg p-3">
                        <div className="text-slate-400 text-xs mb-1">🍂 Current Season</div>
                        <div className="text-white text-2xl font-bold">{seasonName}</div>
                      </div>
                      <div className="bg-slate-700 rounded-lg p-3">
                        <div className="text-slate-400 text-xs mb-1">☀️ Sun Angle at Noon</div>
                        <div className="text-white text-2xl font-bold">{Math.round(sunAngle)}°</div>
                        <div className="text-slate-400 text-xs mt-1">
                          {sunAngle >= 70 ? 'Very direct - intense heat' :
                           sunAngle >= 45 ? 'Moderate angle - mild heat' :
                           sunAngle >= 20 ? 'Low angle - weak heat' :
                           'Very low - minimal heat'}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sun Angle Visualization Section */}
      {(focusMode === 'seasons' || focusMode === 'both') && selectedLocationData && (
        <div className="mb-6">
          <h4 className="text-white font-semibold mb-4 flex items-center gap-2">
            <span>🔬</span>
            <span>Understanding Sun Angle & Temperature</span>
          </h4>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Why Angle Matters - Sunlight Intensity Inset */}
            <div className="bg-slate-800 rounded-lg p-4">
              <h5 className="text-slate-300 text-sm font-medium mb-3 text-center">Why Angle Matters</h5>
              <div className="flex justify-center">
                <SunlightIntensityInset sunAngle={sunAngle} />
              </div>
              <p className="text-slate-400 text-xs mt-3 text-center">
                The same sunlight spreads over more area when it hits at an angle, making it less intense.
              </p>
            </div>

            {/* Sun Angle Diagram for Selected Location */}
            <div className="bg-slate-800 rounded-lg p-4">
              <h5 className="text-slate-300 text-sm font-medium mb-3 text-center">Sun Position at {selectedLocationData.name}</h5>
              <div className="flex justify-center">
                <SunAngleDiagram
                  sunAngle={sunAngle}
                  locationName={selectedLocationData.name}
                  latitude={selectedLocationData.latitude}
                />
              </div>
              <p className="text-slate-400 text-xs mt-3 text-center">
                At {Math.round(sunAngle)}°, the sun is {sunAngle >= 60 ? 'high in the sky' : sunAngle >= 30 ? 'at a moderate height' : 'low on the horizon'}.
              </p>
            </div>

            {/* Yearly Temperature Graph */}
            <div className="bg-slate-800 rounded-lg p-4">
              <h5 className="text-slate-300 text-sm font-medium mb-3 text-center">Year-Round Pattern</h5>
              <div className="flex justify-center">
                <YearlyGraph
                  latitude={selectedLocationData.latitude}
                  currentOrbitalAngle={earthOrbitPosition}
                  locationName={selectedLocationData.name}
                />
              </div>
              <p className="text-slate-400 text-xs mt-3 text-center">
                Sun angle and temperature follow the same pattern throughout the year.
              </p>
            </div>
          </div>

          {/* Key Insight Box */}
          <div className="mt-4 bg-gradient-to-r from-green-900/30 to-emerald-900/30 border border-green-700/50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">💡</span>
              <div>
                <h5 className="text-green-300 font-semibold">Key Insight</h5>
                <p className="text-green-100/80 text-sm mt-1">
                  {selectedLocationData.latitude >= 0 ? (
                    // Northern hemisphere
                    earthOrbitPosition >= 45 && earthOrbitPosition < 135 ? (
                      `In summer, ${selectedLocationData.name} is tilted TOWARD the sun. The sun appears high in the sky (${Math.round(sunAngle)}°), so sunlight hits more directly and brings more heat.`
                    ) : earthOrbitPosition >= 225 && earthOrbitPosition < 315 ? (
                      `In winter, ${selectedLocationData.name} is tilted AWAY from the sun. The sun appears low in the sky (${Math.round(sunAngle)}°), so sunlight spreads out and brings less heat.`
                    ) : (
                      `At the equinox, neither hemisphere is tilted toward the sun. Day and night are roughly equal, and temperatures are moderate.`
                    )
                  ) : (
                    // Southern hemisphere
                    earthOrbitPosition >= 225 && earthOrbitPosition < 315 ? (
                      `In summer, ${selectedLocationData.name} is tilted TOWARD the sun. The sun appears high in the sky (${Math.round(sunAngle)}°), so sunlight hits more directly and brings more heat.`
                    ) : earthOrbitPosition >= 45 && earthOrbitPosition < 135 ? (
                      `In winter, ${selectedLocationData.name} is tilted AWAY from the sun. The sun appears low in the sky (${Math.round(sunAngle)}°), so sunlight spreads out and brings less heat.`
                    ) : (
                      `At the equinox, neither hemisphere is tilted toward the sun. Day and night are roughly equal, and temperatures are moderate.`
                    )
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Learning Questions */}
      {!hasSubmitted && learningObjectives && learningObjectives.length > 0 && (
        <div className="bg-slate-800 rounded-lg p-4 mb-4">
          <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
            <span>✏️</span>
            <span>Check Your Understanding</span>
          </h4>
          <div className="space-y-3">
            {learningObjectives.map((objective, index) => (
              <div key={index}>
                <label className="text-slate-300 text-sm mb-2 block">
                  {index + 1}. {objective}
                </label>
                <input
                  type="text"
                  value={userAnswers[`q${index}`] || ''}
                  onChange={(e) =>
                    setUserAnswers((prev) => ({ ...prev, [`q${index}`]: e.target.value }))
                  }
                  className="w-full bg-slate-700 text-white border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Type your answer..."
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleCheckUnderstanding}
          disabled={hasSubmitted}
          className="flex-1 min-w-[200px] bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:cursor-not-allowed"
        >
          {hasSubmitted ? '✓ Submitted' : 'Check Understanding'}
        </button>

        {hasSubmitted && (
          <button
            onClick={handleReset}
            className="bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            🔄 Try Again
          </button>
        )}

        <button
          onClick={() => setShowExplanation(!showExplanation)}
          className="bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          {showExplanation ? '👁️ Hide' : '💡 Show'} Explanation
        </button>
      </div>

      {/* Explanation Panel */}
      {showExplanation && (
        <div className="mt-4 bg-gradient-to-r from-blue-900/40 to-purple-900/40 border border-blue-700/50 rounded-lg p-4">
          <h5 className="text-white font-semibold mb-3 flex items-center gap-2">
            <span>💡</span>
            <span>Key Concepts</span>
          </h5>
          <div className="text-slate-200 text-sm space-y-3">
            {(focusMode === 'day-night' || focusMode === 'both') && (
              <div className="bg-slate-800/50 rounded p-3">
                <strong className="text-blue-300">Day and Night:</strong>
                <p className="mt-1">
                  Earth spins (rotates) on its axis once every 24 hours. When your location faces
                  the Sun, it's daytime. When it faces away from the Sun, it's nighttime. The Sun
                  doesn't move across the sky—we do!
                </p>
              </div>
            )}
            {(focusMode === 'seasons' || focusMode === 'both') && (
              <>
                <div className="bg-slate-800/50 rounded p-3">
                  <strong className="text-purple-300">Seasons:</strong>
                  <p className="mt-1">
                    Earth's axis is tilted 23.5 degrees. As Earth orbits the Sun, different parts
                    get more direct sunlight at different times of year. This creates the seasons!
                  </p>
                </div>
                <div className="bg-amber-900/30 border border-amber-700/50 rounded p-3">
                  <strong className="text-amber-300">⚠️ Common Misconception:</strong>
                  <p className="mt-1">
                    Seasons are NOT caused by Earth's distance from the Sun! Earth's distance from
                    the Sun changes very little. The tilt of Earth's axis is what creates seasons.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DayNightSeasons;
