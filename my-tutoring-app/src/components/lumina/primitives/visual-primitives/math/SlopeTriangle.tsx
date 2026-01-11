'use client';

import React, { useState, useRef, useEffect } from 'react';

export interface Point {
  x: number;
  y: number;
  label?: string;
}

export interface SlopeTriangleConfig {
  position: Point; // Triangle location (base point)
  size: number; // Scale of triangle (run distance)
  showMeasurements: boolean; // Display rise/run values
  showSlope: boolean; // Display calculated ratio
  showAngle: boolean; // Display angle measurement
  notation: 'riseRun' | 'deltaNotation'; // Display format
  color?: string; // Triangle color
}

export interface AttachedLine {
  equation: string; // Line equation (e.g., "y = 2*x + 1")
  color?: string; // Line color
  label?: string; // Line label
}

export interface SlopeTriangleData {
  title: string;
  description: string;
  xRange: [number, number]; // [min, max]
  yRange: [number, number]; // [min, max]
  gridSpacing?: { x: number; y: number };
  showAxes?: boolean;
  showGrid?: boolean;
  attachedLine: AttachedLine; // Line to attach triangle to
  triangles: SlopeTriangleConfig[]; // Multiple triangles can be shown
  allowDrag?: boolean; // Allow dragging triangles
  allowResize?: boolean; // Allow resizing triangles
}

interface SlopeTriangleProps {
  data: SlopeTriangleData;
  className?: string;
}

const SlopeTriangle: React.FC<SlopeTriangleProps> = ({ data, className }) => {
  const {
    xRange,
    yRange,
    gridSpacing = { x: 1, y: 1 },
    showAxes = true,
    showGrid = true,
    attachedLine,
    allowDrag = true,
    allowResize = true,
  } = data;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [triangles, setTriangles] = useState<SlopeTriangleConfig[]>(data.triangles);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [resizingIndex, setResizingIndex] = useState<number | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const padding = 50;
  const canvasWidth = 800;
  const canvasHeight = 600;

  // Convert graph coordinates to canvas coordinates
  const graphToCanvas = (x: number, y: number): { x: number; y: number } => {
    const graphWidth = xRange[1] - xRange[0];
    const graphHeight = yRange[1] - yRange[0];
    const effectiveWidth = canvasWidth - 2 * padding;
    const effectiveHeight = canvasHeight - 2 * padding;

    const canvasX = padding + ((x - xRange[0]) / graphWidth) * effectiveWidth;
    const canvasY = canvasHeight - padding - ((y - yRange[0]) / graphHeight) * effectiveHeight;

    return { x: canvasX, y: canvasY };
  };

  // Convert canvas coordinates to graph coordinates
  const canvasToGraph = (canvasX: number, canvasY: number): { x: number; y: number } => {
    const graphWidth = xRange[1] - xRange[0];
    const graphHeight = yRange[1] - yRange[0];
    const effectiveWidth = canvasWidth - 2 * padding;
    const effectiveHeight = canvasHeight - 2 * padding;

    const x = xRange[0] + ((canvasX - padding) / effectiveWidth) * graphWidth;
    const y = yRange[0] + ((canvasHeight - padding - canvasY) / effectiveHeight) * graphHeight;

    return { x, y };
  };

  // Evaluate equation at x
  const evaluateEquation = (equation: string, x: number): number | null => {
    try {
      let expr = equation
        .replace(/\s/g, '')
        .replace(/\^/g, '**')
        .replace(/y=/gi, '')
        .replace(/x/g, `(${x})`);

      if (!/^[\d\s\+\-\*\/\.\(\)]+$/.test(expr)) {
        return null;
      }

      return eval(expr);
    } catch {
      return null;
    }
  };

  // Calculate slope from equation or two points
  const calculateSlope = (x1: number, x2: number): number | null => {
    const y1 = evaluateEquation(attachedLine.equation, x1);
    const y2 = evaluateEquation(attachedLine.equation, x2);

    if (y1 === null || y2 === null) return null;

    const rise = y2 - y1;
    const run = x2 - x1;

    return run !== 0 ? rise / run : null;
  };

  // Calculate angle from slope (in degrees)
  const calculateAngle = (slope: number): number => {
    return Math.atan(slope) * (180 / Math.PI);
  };

  // Draw the graph
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Draw grid
    if (showGrid) {
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.3)';
      ctx.lineWidth = 0.5;

      // Vertical grid lines
      for (let x = Math.ceil(xRange[0] / gridSpacing.x) * gridSpacing.x; x <= xRange[1]; x += gridSpacing.x) {
        const { x: canvasX } = graphToCanvas(x, 0);
        ctx.beginPath();
        ctx.moveTo(canvasX, padding);
        ctx.lineTo(canvasX, canvasHeight - padding);
        ctx.stroke();
      }

      // Horizontal grid lines
      for (let y = Math.ceil(yRange[0] / gridSpacing.y) * gridSpacing.y; y <= yRange[1]; y += gridSpacing.y) {
        const { y: canvasY } = graphToCanvas(0, y);
        ctx.beginPath();
        ctx.moveTo(padding, canvasY);
        ctx.lineTo(canvasWidth - padding, canvasY);
        ctx.stroke();
      }
    }

    // Draw axes
    if (showAxes) {
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.8)';
      ctx.lineWidth = 2;

      // X-axis
      const { y: xAxisY } = graphToCanvas(0, 0);
      ctx.beginPath();
      ctx.moveTo(padding, xAxisY);
      ctx.lineTo(canvasWidth - padding, xAxisY);
      ctx.stroke();

      // Y-axis
      const { x: yAxisX } = graphToCanvas(0, 0);
      ctx.beginPath();
      ctx.moveTo(yAxisX, padding);
      ctx.lineTo(yAxisX, canvasHeight - padding);
      ctx.stroke();

      // Axis labels
      ctx.fillStyle = 'rgba(226, 232, 240, 0.9)';
      ctx.font = '14px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // X-axis numbers
      for (let x = Math.ceil(xRange[0]); x <= xRange[1]; x += gridSpacing.x) {
        if (x === 0) continue;
        const { x: canvasX, y: canvasY } = graphToCanvas(x, 0);
        ctx.fillText(x.toString(), canvasX, canvasY + 20);
      }

      // Y-axis numbers
      for (let y = Math.ceil(yRange[0]); y <= yRange[1]; y += gridSpacing.y) {
        if (y === 0) continue;
        const { x: canvasX, y: canvasY } = graphToCanvas(0, y);
        ctx.fillText(y.toString(), canvasX - 25, canvasY);
      }

      // Origin
      ctx.fillText('0', yAxisX - 15, xAxisY + 20);
    }

    // Draw the attached line
    ctx.strokeStyle = attachedLine.color || '#3b82f6';
    ctx.lineWidth = 3;
    ctx.beginPath();

    let firstPoint = true;
    const step = (xRange[1] - xRange[0]) / 500;

    for (let x = xRange[0]; x <= xRange[1]; x += step) {
      const y = evaluateEquation(attachedLine.equation, x);
      if (y === null || y < yRange[0] || y > yRange[1]) continue;

      const { x: canvasX, y: canvasY } = graphToCanvas(x, y);

      if (firstPoint) {
        ctx.moveTo(canvasX, canvasY);
        firstPoint = false;
      } else {
        ctx.lineTo(canvasX, canvasY);
      }
    }

    ctx.stroke();

    // Draw slope triangles
    triangles.forEach((triangle, index) => {
      const { position, size, showMeasurements, showSlope, showAngle, notation, color } = triangle;

      const x1 = position.x;
      const x2 = position.x + size;
      const y1 = evaluateEquation(attachedLine.equation, x1);
      const y2 = evaluateEquation(attachedLine.equation, x2);

      if (y1 === null || y2 === null) return;

      const rise = y2 - y1;
      const run = size;

      // Convert to canvas coordinates
      const basePoint = graphToCanvas(x1, y1);
      const topPoint = graphToCanvas(x2, y2);
      const rightPoint = graphToCanvas(x2, y1);

      const isHovered = hoveredIndex === index;
      const triangleColor = color || '#10b981';

      // Draw triangle
      ctx.strokeStyle = triangleColor;
      ctx.fillStyle = isHovered ? `${triangleColor}33` : `${triangleColor}22`;
      ctx.lineWidth = isHovered ? 3 : 2;

      ctx.beginPath();
      ctx.moveTo(basePoint.x, basePoint.y);
      ctx.lineTo(rightPoint.x, rightPoint.y);
      ctx.lineTo(topPoint.x, topPoint.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Draw right angle indicator
      const angleSize = 12;
      ctx.strokeStyle = triangleColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(rightPoint.x - angleSize, rightPoint.y);
      ctx.lineTo(rightPoint.x - angleSize, rightPoint.y - angleSize);
      ctx.lineTo(rightPoint.x, rightPoint.y - angleSize);
      ctx.stroke();

      // Draw measurements
      if (showMeasurements) {
        ctx.fillStyle = '#ffffff';
        ctx.font = '14px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Run label (horizontal)
        const runLabel = notation === 'deltaNotation' ? `Δx = ${run.toFixed(1)}` : `run = ${run.toFixed(1)}`;
        ctx.fillText(runLabel, (basePoint.x + rightPoint.x) / 2, rightPoint.y + 20);

        // Rise label (vertical)
        const riseLabel = notation === 'deltaNotation' ? `Δy = ${rise.toFixed(1)}` : `rise = ${rise.toFixed(1)}`;
        ctx.save();
        ctx.translate(rightPoint.x + 30, (rightPoint.y + topPoint.y) / 2);
        ctx.fillText(riseLabel, 0, 0);
        ctx.restore();
      }

      // Draw slope calculation
      if (showSlope) {
        const slope = calculateSlope(x1, x2);
        if (slope !== null) {
          const slopeText = `m = ${slope.toFixed(2)}`;

          // Draw background box
          ctx.font = '16px monospace';
          const metrics = ctx.measureText(slopeText);
          const boxWidth = metrics.width + 20;
          const boxHeight = 30;
          const boxX = (basePoint.x + topPoint.x) / 2 - boxWidth / 2;
          const boxY = Math.min(basePoint.y, topPoint.y) - 40;

          ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
          ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

          ctx.strokeStyle = triangleColor;
          ctx.lineWidth = 2;
          ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.fillText(slopeText, boxX + boxWidth / 2, boxY + boxHeight / 2);
        }
      }

      // Draw angle arc and measurement
      if (showAngle) {
        const slope = calculateSlope(x1, x2);
        if (slope !== null) {
          const angle = calculateAngle(slope);
          const angleRad = Math.atan(slope);

          // Draw angle arc
          const arcRadius = 30;
          ctx.strokeStyle = triangleColor;
          ctx.fillStyle = `${triangleColor}22`;
          ctx.lineWidth = 2;

          ctx.beginPath();
          ctx.moveTo(basePoint.x, basePoint.y);
          ctx.arc(basePoint.x, basePoint.y, arcRadius, 0, -angleRad, true);
          ctx.lineTo(basePoint.x, basePoint.y);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Draw angle label
          const labelAngle = -angleRad / 2;
          const labelRadius = arcRadius + 20;
          const labelX = basePoint.x + labelRadius * Math.cos(labelAngle);
          const labelY = basePoint.y - labelRadius * Math.sin(labelAngle);

          const angleText = `${Math.abs(angle).toFixed(1)}°`;
          ctx.font = '14px monospace';
          const angleMetrics = ctx.measureText(angleText);
          const angleBoxWidth = angleMetrics.width + 12;
          const angleBoxHeight = 24;

          ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
          ctx.fillRect(labelX - angleBoxWidth / 2, labelY - angleBoxHeight / 2, angleBoxWidth, angleBoxHeight);

          ctx.strokeStyle = triangleColor;
          ctx.lineWidth = 1;
          ctx.strokeRect(labelX - angleBoxWidth / 2, labelY - angleBoxHeight / 2, angleBoxWidth, angleBoxHeight);

          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(angleText, labelX, labelY);
        }
      }

      // Draw drag handle if dragging is enabled
      if (allowDrag) {
        ctx.fillStyle = isHovered ? triangleColor : `${triangleColor}88`;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(basePoint.x, basePoint.y, 6, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
      }

      // Draw resize handle if resizing is enabled
      if (allowResize) {
        ctx.fillStyle = isHovered ? triangleColor : `${triangleColor}88`;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(rightPoint.x, rightPoint.y, 6, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
      }
    });
  }, [triangles, hoveredIndex, xRange, yRange, gridSpacing, showAxes, showGrid, attachedLine]);

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    const graphCoords = canvasToGraph(canvasX, canvasY);

    // Check if clicking on a triangle's drag or resize handle
    for (let i = 0; i < triangles.length; i++) {
      const triangle = triangles[i];
      const { position, size } = triangle;

      // Check drag handle (base point)
      const distToDrag = Math.sqrt(
        (graphCoords.x - position.x) ** 2 +
        (graphCoords.y - (evaluateEquation(attachedLine.equation, position.x) || 0)) ** 2
      );

      if (allowDrag && distToDrag < 0.5) {
        setDraggingIndex(i);
        return;
      }

      // Check resize handle (right point)
      const x2 = position.x + size;
      const y1 = evaluateEquation(attachedLine.equation, position.x) || 0;
      const distToResize = Math.sqrt((graphCoords.x - x2) ** 2 + (graphCoords.y - y1) ** 2);

      if (allowResize && distToResize < 0.5) {
        setResizingIndex(i);
        return;
      }
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    const graphCoords = canvasToGraph(canvasX, canvasY);

    // Handle dragging
    if (draggingIndex !== null) {
      const newTriangles = [...triangles];
      const roundedX = Math.round(graphCoords.x / gridSpacing.x) * gridSpacing.x;
      newTriangles[draggingIndex] = {
        ...newTriangles[draggingIndex],
        position: { x: roundedX, y: 0 }, // y is calculated from line
      };
      setTriangles(newTriangles);
      return;
    }

    // Handle resizing
    if (resizingIndex !== null) {
      const newTriangles = [...triangles];
      const triangle = newTriangles[resizingIndex];
      const newSize = Math.max(1, graphCoords.x - triangle.position.x);
      const roundedSize = Math.round(newSize / gridSpacing.x) * gridSpacing.x;
      newTriangles[resizingIndex] = {
        ...newTriangles[resizingIndex],
        size: roundedSize,
      };
      setTriangles(newTriangles);
      return;
    }

    // Check for hover
    let foundHover = false;
    for (let i = 0; i < triangles.length; i++) {
      const triangle = triangles[i];
      const { position, size } = triangle;
      const x1 = position.x;
      const x2 = position.x + size;
      const y1 = evaluateEquation(attachedLine.equation, x1) || 0;

      // Check if mouse is near the triangle
      if (graphCoords.x >= x1 - 0.5 && graphCoords.x <= x2 + 0.5) {
        const lineY = evaluateEquation(attachedLine.equation, graphCoords.x) || 0;
        if (Math.abs(graphCoords.y - lineY) < 2 || Math.abs(graphCoords.y - y1) < 0.5) {
          setHoveredIndex(i);
          foundHover = true;
          break;
        }
      }
    }

    if (!foundHover) {
      setHoveredIndex(null);
    }
  };

  const handleCanvasMouseUp = () => {
    setDraggingIndex(null);
    setResizingIndex(null);
  };

  const handleCanvasMouseLeave = () => {
    setDraggingIndex(null);
    setResizingIndex(null);
    setHoveredIndex(null);
  };

  const toggleNotation = (index: number) => {
    const newTriangles = [...triangles];
    newTriangles[index] = {
      ...newTriangles[index],
      notation: newTriangles[index].notation === 'riseRun' ? 'deltaNotation' : 'riseRun',
    };
    setTriangles(newTriangles);
  };

  return (
    <div className={`w-full max-w-6xl mx-auto my-16 animate-fade-in ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8 justify-center">
        <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center border border-green-500/30 text-green-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
          </svg>
        </div>
        <div className="text-left">
          <h2 className="text-2xl font-bold text-white tracking-tight">Slope Triangle</h2>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
            <p className="text-xs text-green-400 font-mono uppercase tracking-wider">Rise over Run Visualizer</p>
          </div>
        </div>
      </div>

      <div className="glass-panel p-8 md:p-12 rounded-3xl border border-green-500/20 relative overflow-hidden">
        {/* Background Texture */}
        <div
          className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(#10b981 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        ></div>

        <div className="relative z-10 w-full">
          <div className="mb-8 text-center max-w-3xl mx-auto">
            <h3 className="text-xl font-bold text-white mb-2">{data.title}</h3>
            <p className="text-slate-300 font-light">{data.description}</p>
          </div>

          {/* Canvas */}
          <div className="mb-6 p-4 bg-slate-800/30 backdrop-blur-sm rounded-2xl border border-green-500/20 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent pointer-events-none rounded-2xl"></div>
            <div className="relative z-10 flex justify-center">
              <canvas
                ref={canvasRef}
                width={canvasWidth}
                height={canvasHeight}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseLeave}
                className="rounded-lg cursor-move"
                style={{ maxWidth: '100%', height: 'auto' }}
              />
            </div>
          </div>

          {/* Triangle Controls */}
          {triangles.length > 0 && (
            <div className="mb-4">
              <div className="p-6 bg-slate-800/40 backdrop-blur-sm rounded-2xl border border-slate-600/50 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
                <div className="relative z-10">
                  <h4 className="text-sm font-mono uppercase tracking-wider text-green-400 mb-5 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    Slope Triangles
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {triangles.map((triangle, idx) => {
                      const slope = calculateSlope(triangle.position.x, triangle.position.x + triangle.size);
                      const rise = slope !== null ? slope * triangle.size : 0;
                      const run = triangle.size;

                      // Calculate triangle corners
                      const x1 = triangle.position.x;
                      const x2 = triangle.position.x + triangle.size;
                      const y1 = evaluateEquation(attachedLine.equation, x1) || 0;
                      const y2 = evaluateEquation(attachedLine.equation, x2) || 0;

                      const basePoint = { x: x1, y: y1 };
                      const rightPoint = { x: x2, y: y1 };
                      const topPoint = { x: x2, y: y2 };

                      return (
                        <div
                          key={idx}
                          onMouseEnter={() => setHoveredIndex(idx)}
                          onMouseLeave={() => setHoveredIndex(null)}
                          className={`group relative w-full p-5 rounded-2xl transition-all duration-300 border-2 cursor-pointer ${
                            hoveredIndex === idx
                              ? 'bg-gradient-to-br from-green-500/25 via-green-500/15 to-transparent border-green-400/60 shadow-[0_0_30px_rgba(16,185,129,0.3)] scale-[1.02]'
                              : 'bg-slate-800/30 border-slate-600/40 hover:border-slate-500/60 hover:bg-slate-700/40'
                          }`}
                        >
                          {/* Glow Effect */}
                          {hoveredIndex === idx && (
                            <div className="absolute inset-0 bg-gradient-to-br from-green-500/20 to-transparent rounded-2xl blur-xl"></div>
                          )}

                          <div className="relative z-10">
                            {/* Header */}
                            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-600/30">
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-5 h-5 rounded-full flex-shrink-0 ring-2 ring-offset-2 ring-offset-slate-800 transition-all ${
                                    hoveredIndex === idx ? 'ring-green-400/60 scale-110' : 'ring-transparent'
                                  }`}
                                  style={{ backgroundColor: triangle.color || '#10b981' }}
                                ></div>
                                <span className="font-mono font-bold text-lg text-white">
                                  Triangle {idx + 1}
                                </span>
                              </div>
                              <button
                                onClick={() => toggleNotation(idx)}
                                className="px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-300 text-xs font-mono rounded-lg transition-all border border-green-500/30 hover:border-green-400/50"
                              >
                                {triangle.notation === 'riseRun' ? 'rise/run' : 'Δy/Δx'}
                              </button>
                            </div>

                            {slope !== null && (
                              <div className="space-y-3">
                                {/* Main Slope Display */}
                                <div className="relative p-4 bg-gradient-to-br from-slate-900/60 to-slate-800/40 rounded-xl border border-slate-600/30 overflow-hidden">
                                  <div className="absolute top-0 right-0 w-20 h-20 bg-green-500/10 rounded-full blur-2xl"></div>
                                  <div className="relative z-10 text-center">
                                    <div className="text-xs font-mono text-green-400 mb-1 uppercase tracking-wider">Slope</div>
                                    <div className="text-3xl font-bold text-white mb-1">{slope.toFixed(2)}</div>
                                    <div className="text-xs text-slate-400 font-mono">
                                      {triangle.notation === 'riseRun' ? 'rise/run' : 'Δy/Δx'}
                                    </div>
                                  </div>
                                </div>

                                {/* Rise and Run Metrics */}
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="p-3 bg-slate-900/40 rounded-xl border border-slate-600/20">
                                    <div className="text-xs font-mono text-green-300 mb-1 uppercase tracking-wide">
                                      {triangle.notation === 'riseRun' ? 'Rise' : 'Δy'}
                                    </div>
                                    <div className="text-xl font-bold text-white">{rise.toFixed(1)}</div>
                                  </div>
                                  <div className="p-3 bg-slate-900/40 rounded-xl border border-slate-600/20">
                                    <div className="text-xs font-mono text-green-300 mb-1 uppercase tracking-wide">
                                      {triangle.notation === 'riseRun' ? 'Run' : 'Δx'}
                                    </div>
                                    <div className="text-xl font-bold text-white">{run.toFixed(1)}</div>
                                  </div>
                                </div>

                                {/* Angle Display */}
                                {triangle.showAngle && (
                                  <div className="p-3 bg-slate-900/40 rounded-xl border border-slate-600/20">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-baseline gap-2">
                                        <span className="text-xs font-mono text-green-300 uppercase tracking-wide">Angle:</span>
                                        <span className="text-lg font-bold text-white">{Math.abs(calculateAngle(slope)).toFixed(1)}°</span>
                                      </div>
                                      <svg className="w-5 h-5 text-green-400/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
                                      </svg>
                                    </div>
                                  </div>
                                )}

                                {/* Triangle Coordinates */}
                                <div className="space-y-2">
                                  <div className="text-xs font-mono text-green-300 mb-2 uppercase tracking-wide">Triangle Corners</div>
                                  <div className="grid grid-cols-3 gap-2">
                                    {/* Base Point */}
                                    <div className="relative p-2.5 bg-gradient-to-br from-blue-500/20 to-blue-600/10 rounded-lg border border-blue-400/30 overflow-hidden group/corner hover:border-blue-400/60 transition-all">
                                      <div className="absolute top-0 left-0 w-8 h-8 bg-blue-400/20 rounded-full blur-lg"></div>
                                      <div className="relative z-10">
                                        <div className="text-[10px] font-mono text-blue-300 mb-0.5 uppercase tracking-wide">Base</div>
                                        <div className="text-xs font-bold text-white font-mono">
                                          ({basePoint.x.toFixed(1)}, {basePoint.y.toFixed(1)})
                                        </div>
                                      </div>
                                      {/* Corner indicator */}
                                      <div className="absolute bottom-1 right-1 w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
                                    </div>

                                    {/* Right Point */}
                                    <div className="relative p-2.5 bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 rounded-lg border border-yellow-400/30 overflow-hidden group/corner hover:border-yellow-400/60 transition-all">
                                      <div className="absolute top-0 left-0 w-8 h-8 bg-yellow-400/20 rounded-full blur-lg"></div>
                                      <div className="relative z-10">
                                        <div className="text-[10px] font-mono text-yellow-300 mb-0.5 uppercase tracking-wide">Right</div>
                                        <div className="text-xs font-bold text-white font-mono">
                                          ({rightPoint.x.toFixed(1)}, {rightPoint.y.toFixed(1)})
                                        </div>
                                      </div>
                                      {/* Corner indicator */}
                                      <div className="absolute bottom-1 right-1 w-1.5 h-1.5 bg-yellow-400 rounded-full"></div>
                                    </div>

                                    {/* Top Point */}
                                    <div className="relative p-2.5 bg-gradient-to-br from-purple-500/20 to-purple-600/10 rounded-lg border border-purple-400/30 overflow-hidden group/corner hover:border-purple-400/60 transition-all">
                                      <div className="absolute top-0 left-0 w-8 h-8 bg-purple-400/20 rounded-full blur-lg"></div>
                                      <div className="relative z-10">
                                        <div className="text-[10px] font-mono text-purple-300 mb-0.5 uppercase tracking-wide">Top</div>
                                        <div className="text-xs font-bold text-white font-mono">
                                          ({topPoint.x.toFixed(1)}, {topPoint.y.toFixed(1)})
                                        </div>
                                      </div>
                                      {/* Corner indicator */}
                                      <div className="absolute bottom-1 right-1 w-1.5 h-1.5 bg-purple-400 rounded-full"></div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="mt-4 p-6 bg-slate-800/40 backdrop-blur-sm rounded-xl border border-slate-600/50 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
            <div className="relative z-10">
              <h4 className="text-sm font-mono uppercase tracking-wider text-green-400 mb-4">How to Use</h4>
              <ul className="text-sm text-slate-200 space-y-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                {allowDrag && (
                  <li className="flex items-start gap-2">
                    <span className="text-green-400 mt-1">▸</span>
                    <span>Drag the base point to reposition triangle along the line</span>
                  </li>
                )}
                {allowResize && (
                  <li className="flex items-start gap-2">
                    <span className="text-green-400 mt-1">▸</span>
                    <span>Drag the right corner to resize the triangle</span>
                  </li>
                )}
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-1">▸</span>
                  <span>Click notation toggle to switch between rise/run and Δy/Δx</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-1">▸</span>
                  <span>Hover over triangles to highlight them</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SlopeTriangle;
