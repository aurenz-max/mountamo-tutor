'use client';

import React, { useState, useRef, useEffect } from 'react';

export interface Point {
  x: number;
  y: number;
  label?: string;
}

export interface Line {
  type: 'line' | 'segment' | 'ray';
  point1: Point;
  point2: Point;
  color?: string;
  label?: string;
}

export interface GraphAnnotation {
  x: number;
  y: number;
  text: string;
  type: 'intercept' | 'vertex' | 'intersection' | 'feature' | 'point-of-interest';
  color?: string;
}

export interface Equation {
  expression: string; // e.g., "y = 2x + 1", "y = x^2"
  color?: string;
  label?: string;

  // Educational enhancements
  slope?: number;
  yIntercept?: number;
  conceptFocus?: 'slope' | 'intercept' | 'intersection' | 'transformation' | 'general';
  realWorldContext?: string;
  slopeInterpretation?: string; // e.g., "For every 1 unit right, go up 2 units"
  interceptInterpretation?: string; // e.g., "Starting point when x = 0"
  annotations?: GraphAnnotation[];
}

export interface Region {
  inequality: string; // e.g., "y > 2x + 1"
  color?: string;
  fillOpacity?: number;
}

export interface CoordinateGraphData {
  title: string;
  description: string;
  xRange: [number, number]; // [min, max]
  yRange: [number, number]; // [min, max]
  gridSpacing?: { x: number; y: number };
  showAxes?: boolean;
  showGrid?: boolean;
  plotMode?: 'points' | 'freehand' | 'equation';
  equations?: Equation[];
  points?: Point[];
  lines?: Line[];
  regions?: Region[];
  traceEnabled?: boolean;
  showIntercepts?: boolean;
  allowZoom?: boolean;
}

interface CoordinateGraphProps {
  data: CoordinateGraphData;
  className?: string;
}

const CoordinateGraph: React.FC<CoordinateGraphProps> = ({ data, className }) => {
  const {
    xRange,
    yRange,
    gridSpacing = { x: 1, y: 1 },
    showAxes = true,
    showGrid = true,
    plotMode = 'points',
    equations = [],
    points: initialPoints = [],
    lines: initialLines = [],
    traceEnabled = true,
    showIntercepts = false,
    allowZoom = true,
  } = data;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [points, setPoints] = useState<Point[]>(initialPoints);
  const [lines] = useState<Line[]>(initialLines);
  const [hoveredPoint, setHoveredPoint] = useState<Point | null>(null);
  const [tracePoint, setTracePoint] = useState<{ x: number; y: number } | null>(null);
  const [currentEquationIndex, setCurrentEquationIndex] = useState<number>(0);
  const [zoom, setZoom] = useState(1);
  const [viewCenter, setViewCenter] = useState({ x: 0, y: 0 }); // Center of the view in graph coordinates
  const [detectedIntersections, setDetectedIntersections] = useState<GraphAnnotation[]>([]);

  const padding = 50;
  const canvasWidth = 800;
  const canvasHeight = 600;

  // Convert graph coordinates to canvas coordinates
  const graphToCanvas = (x: number, y: number, currentZoom = zoom, center = viewCenter): { x: number; y: number } => {
    const effectiveWidth = canvasWidth - 2 * padding;
    const effectiveHeight = canvasHeight - 2 * padding;

    // Calculate position relative to center
    const relativeX = (x - center.x) * currentZoom;
    const relativeY = (y - center.y) * currentZoom;

    // Convert to canvas coordinates (center of canvas + relative position)
    const canvasX = canvasWidth / 2 + relativeX * (effectiveWidth / (xRange[1] - xRange[0]));
    const canvasY = canvasHeight / 2 - relativeY * (effectiveHeight / (yRange[1] - yRange[0]));

    return { x: canvasX, y: canvasY };
  };

  // Convert canvas coordinates to graph coordinates
  const canvasToGraph = (canvasX: number, canvasY: number): { x: number; y: number } => {
    const graphWidth = xRange[1] - xRange[0];
    const graphHeight = yRange[1] - yRange[0];
    const effectiveWidth = canvasWidth - 2 * padding;
    const effectiveHeight = canvasHeight - 2 * padding;

    // Calculate position relative to canvas center
    const relativeCanvasX = canvasX - canvasWidth / 2;
    const relativeCanvasY = canvasHeight / 2 - canvasY;

    // Convert to graph coordinates
    const x = viewCenter.x + (relativeCanvasX / (effectiveWidth / graphWidth)) / zoom;
    const y = viewCenter.y + (relativeCanvasY / (effectiveHeight / graphHeight)) / zoom;

    return { x, y };
  };

  // Evaluate equation at x
  const evaluateEquation = (equation: string, x: number): number | null => {
    try {
      // Replace common math notation with JavaScript
      let expr = equation
        .replace(/\s/g, '')
        .replace(/\^/g, '**')
        .replace(/y=/gi, '')
        .replace(/x/g, `(${x})`);

      // Basic safety check - only allow numbers, operators, and parentheses
      if (!/^[\d\s\+\-\*\/\.\(\)]+$/.test(expr)) {
        return null;
      }

      return eval(expr);
    } catch {
      return null;
    }
  };

  // Detect intersections between equations
  useEffect(() => {
    if (equations.length < 2) {
      setDetectedIntersections([]);
      return;
    }

    const intersections: GraphAnnotation[] = [];
    const step = (xRange[1] - xRange[0]) / 1000;

    // Check each pair of equations
    for (let i = 0; i < equations.length; i++) {
      for (let j = i + 1; j < equations.length; j++) {
        const eq1 = equations[i];
        const eq2 = equations[j];

        // Sample points to find sign changes (indicating intersection)
        let prevDiff: number | null = null;
        for (let x = xRange[0]; x <= xRange[1]; x += step) {
          const y1 = evaluateEquation(eq1.expression, x);
          const y2 = evaluateEquation(eq2.expression, x);

          if (y1 === null || y2 === null) continue;

          const diff = y1 - y2;

          // Check for sign change (intersection detected)
          if (prevDiff !== null && prevDiff * diff < 0) {
            // Refine the intersection point
            const intersectionX = x - step / 2;
            const intersectionY = evaluateEquation(eq1.expression, intersectionX);

            if (intersectionY !== null && intersectionY >= yRange[0] && intersectionY <= yRange[1]) {
              // Check if this annotation is already provided manually
              const hasManualAnnotation =
                eq1.annotations?.some(a => Math.abs(a.x - intersectionX) < 0.5 && a.type === 'intersection') ||
                eq2.annotations?.some(a => Math.abs(a.x - intersectionX) < 0.5 && a.type === 'intersection');

              if (!hasManualAnnotation) {
                intersections.push({
                  x: intersectionX,
                  y: intersectionY,
                  text: `Intersection: (${intersectionX.toFixed(2)}, ${intersectionY.toFixed(2)})`,
                  type: 'intersection',
                  color: '#a855f7' // Purple for auto-detected intersections
                });
              }
            }
          }

          prevDiff = diff;
        }
      }
    }

    setDetectedIntersections(intersections);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equations, xRange, yRange]);

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

    // Draw equations
    equations.forEach((eq, idx) => {
      ctx.strokeStyle = eq.color || '#3b82f6';
      // Make the current equation thicker
      ctx.lineWidth = currentEquationIndex === idx ? 4 : 2.5;
      ctx.beginPath();

      let firstPoint = true;
      const step = (xRange[1] - xRange[0]) / 500;

      for (let x = xRange[0]; x <= xRange[1]; x += step) {
        const y = evaluateEquation(eq.expression, x);
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

      // Draw intercepts if enabled
      if (showIntercepts) {
        // Y-intercept (x=0)
        const yIntercept = evaluateEquation(eq.expression, 0);
        if (yIntercept !== null && yIntercept >= yRange[0] && yIntercept <= yRange[1]) {
          const { x: canvasX, y: canvasY } = graphToCanvas(0, yIntercept);
          ctx.fillStyle = eq.color || '#3b82f6';
          ctx.beginPath();
          ctx.arc(canvasX, canvasY, 5, 0, 2 * Math.PI);
          ctx.fill();
        }

        // X-intercepts (approximate by sampling)
        let prevY = evaluateEquation(eq.expression, xRange[0]);
        for (let x = xRange[0] + step; x <= xRange[1]; x += step) {
          const y = evaluateEquation(eq.expression, x);
          if (prevY !== null && y !== null && prevY * y < 0) {
            // Sign change detected - intercept nearby
            const { x: canvasX, y: canvasY } = graphToCanvas(x, 0);
            ctx.fillStyle = eq.color || '#3b82f6';
            ctx.beginPath();
            ctx.arc(canvasX, canvasY, 5, 0, 2 * Math.PI);
            ctx.fill();
          }
          prevY = y;
        }
      }
    });

    // Draw lines
    lines.forEach((line) => {
      ctx.strokeStyle = line.color || '#10b981';
      ctx.lineWidth = 2;

      const { x: x1, y: y1 } = graphToCanvas(line.point1.x, line.point1.y);
      const { x: x2, y: y2 } = graphToCanvas(line.point2.x, line.point2.y);

      ctx.beginPath();
      if (line.type === 'line') {
        // Extend line infinitely
        const dx = x2 - x1;
        const dy = y2 - y1;
        const length = Math.sqrt(dx * dx + dy * dy);
        const extendX = (dx / length) * 1000;
        const extendY = (dy / length) * 1000;
        ctx.moveTo(x1 - extendX, y1 - extendY);
        ctx.lineTo(x2 + extendX, y2 + extendY);
      } else if (line.type === 'segment') {
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
      } else if (line.type === 'ray') {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const length = Math.sqrt(dx * dx + dy * dy);
        const extendX = (dx / length) * 1000;
        const extendY = (dy / length) * 1000;
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2 + extendX, y2 + extendY);
      }
      ctx.stroke();
    });

    // Draw points
    points.forEach((point) => {
      const { x: canvasX, y: canvasY } = graphToCanvas(point.x, point.y);

      ctx.fillStyle = '#f59e0b';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.arc(canvasX, canvasY, 6, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();

      // Draw label
      if (point.label) {
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(point.label, canvasX, canvasY - 12);
      }
    });

    // Draw trace point
    if (tracePoint && equations.length > 0) {
      const y = evaluateEquation(equations[currentEquationIndex].expression, tracePoint.x);
      if (y !== null) {
        const { x: canvasX, y: canvasY } = graphToCanvas(tracePoint.x, y);

        ctx.fillStyle = '#a855f7';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.arc(canvasX, canvasY, 8, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();

        // Draw coordinates
        ctx.fillStyle = '#ffffff';
        ctx.font = '14px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`(${tracePoint.x.toFixed(2)}, ${y.toFixed(2)})`, canvasX, canvasY - 15);
      }
    }

    // Draw hovered point coordinates
    if (hoveredPoint) {
      const { x: canvasX, y: canvasY } = graphToCanvas(hoveredPoint.x, hoveredPoint.y);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(canvasX + 10, canvasY - 25, 100, 20);
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`(${hoveredPoint.x.toFixed(2)}, ${hoveredPoint.y.toFixed(2)})`, canvasX + 15, canvasY - 12);
    }

    // Collect all annotations (manual + auto-detected intersections)
    const allAnnotations: (GraphAnnotation & { equationColor?: string })[] = [];

    // Add manual annotations from equations
    equations.forEach((eq) => {
      if (eq.annotations) {
        eq.annotations.forEach((annotation) => {
          allAnnotations.push({ ...annotation, equationColor: eq.color });
        });
      }
    });

    // Add auto-detected intersections
    allAnnotations.push(...detectedIntersections);

    // Draw all annotations
    allAnnotations.forEach((annotation) => {
        const { x: canvasX, y: canvasY } = graphToCanvas(annotation.x, annotation.y);

        // Draw annotation point
        const annotationColor = annotation.color || annotation.equationColor || '#f59e0b';
        ctx.fillStyle = annotationColor;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;

        // Different shapes for different annotation types
        ctx.beginPath();
        if (annotation.type === 'intercept') {
          // Diamond shape for intercepts
          ctx.moveTo(canvasX, canvasY - 6);
          ctx.lineTo(canvasX + 6, canvasY);
          ctx.lineTo(canvasX, canvasY + 6);
          ctx.lineTo(canvasX - 6, canvasY);
          ctx.closePath();
        } else if (annotation.type === 'intersection') {
          // Star shape for intersections
          const spikes = 5;
          const outerRadius = 8;
          const innerRadius = 4;
          for (let i = 0; i < spikes * 2; i++) {
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const angle = (i * Math.PI) / spikes - Math.PI / 2;
            const x = canvasX + radius * Math.cos(angle);
            const y = canvasY + radius * Math.sin(angle);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
        } else {
          // Circle for other types
          ctx.arc(canvasX, canvasY, 6, 0, 2 * Math.PI);
        }
        ctx.fill();
        ctx.stroke();

        // Draw annotation text with background
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        const textMetrics = ctx.measureText(annotation.text);
        const textWidth = textMetrics.width;
        const textHeight = 16;
        const padding = 6;
        const boxX = canvasX + 12;
        const boxY = canvasY - textHeight / 2;

        // Draw text background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(boxX - padding / 2, boxY - padding / 2, textWidth + padding, textHeight + padding);

        // Draw text border
        ctx.strokeStyle = annotationColor;
        ctx.lineWidth = 1;
        ctx.strokeRect(boxX - padding / 2, boxY - padding / 2, textWidth + padding, textHeight + padding);

        // Draw text
        ctx.fillStyle = '#ffffff';
        ctx.fillText(annotation.text, boxX, canvasY);
    });
  }, [points, lines, equations, tracePoint, hoveredPoint, zoom, viewCenter, xRange, yRange, gridSpacing, showAxes, showGrid, showIntercepts, currentEquationIndex, detectedIntersections]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (plotMode !== 'points') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;

    const graphCoords = canvasToGraph(canvasX, canvasY);

    // Round to nearest grid spacing
    const roundedX = Math.round(graphCoords.x / gridSpacing.x) * gridSpacing.x;
    const roundedY = Math.round(graphCoords.y / gridSpacing.y) * gridSpacing.y;

    // Check if clicking near an existing point to remove it
    const clickRadius = 10;
    const clickedPointIndex = points.findIndex((p) => {
      const { x: pCanvasX, y: pCanvasY } = graphToCanvas(p.x, p.y);
      const dist = Math.sqrt((canvasX - pCanvasX) ** 2 + (canvasY - pCanvasY) ** 2);
      return dist < clickRadius;
    });

    if (clickedPointIndex !== -1) {
      // Remove point
      setPoints(points.filter((_, i) => i !== clickedPointIndex));
    } else {
      // Add point
      setPoints([...points, { x: roundedX, y: roundedY }]);
    }
  };

  const handleCanvasMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;

    const graphCoords = canvasToGraph(canvasX, canvasY);
    setHoveredPoint(graphCoords);

    // Update trace point if tracing is enabled
    if (traceEnabled && equations.length > 0) {
      const roundedX = Math.round(graphCoords.x / (gridSpacing.x * 0.1)) * (gridSpacing.x * 0.1);
      setTracePoint({ x: roundedX, y: 0 });
    }
  };

  const handleCanvasLeave = () => {
    setHoveredPoint(null);
    setTracePoint(null);
  };

  const handleZoomIn = () => {
    if (allowZoom) {
      setZoom((prev) => Math.min(prev * 1.2, 3));
      // Keep centered on origin (0,0)
      setViewCenter({ x: 0, y: 0 });
    }
  };

  const handleZoomOut = () => {
    if (allowZoom) {
      setZoom((prev) => Math.max(prev / 1.2, 0.5));
      // Keep centered on origin (0,0)
      setViewCenter({ x: 0, y: 0 });
    }
  };

  const handleResetZoom = () => {
    setZoom(1);
    setViewCenter({ x: 0, y: 0 });
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (!allowZoom) return;

    e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();

    // Account for canvas scaling (displayed size vs actual size)
    const scaleX = canvasWidth / rect.width;
    const scaleY = canvasHeight / rect.height;

    // Convert mouse position from displayed coordinates to actual canvas coordinates
    const canvasX = (e.clientX - rect.left) * scaleX;
    const canvasY = (e.clientY - rect.top) * scaleY;

    // Get the graph coordinate at cursor before zoom
    const graphCoordBeforeZoom = canvasToGraph(canvasX, canvasY);

    // Determine zoom direction
    const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.5, Math.min(zoom * zoomDelta, 3));

    // Calculate new center to keep cursor position stable
    const graphCoordAfterZoom = {
      x: viewCenter.x + (graphCoordBeforeZoom.x - viewCenter.x) * (zoom / newZoom),
      y: viewCenter.y + (graphCoordBeforeZoom.y - viewCenter.y) * (zoom / newZoom)
    };

    setZoom(newZoom);
    setViewCenter(graphCoordAfterZoom);
  };

  const clearPoints = () => {
    setPoints([]);
  };

  return (
    <div className={`w-full max-w-6xl mx-auto my-16 animate-fade-in ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8 justify-center">
        <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center border border-blue-500/30 text-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.2)]">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"></path>
          </svg>
        </div>
        <div className="text-left">
          <h2 className="text-2xl font-bold text-white tracking-tight">Coordinate Graph</h2>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
            <p className="text-xs text-blue-400 font-mono uppercase tracking-wider">2D Graphing Tool</p>
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

          {/* Canvas */}
          <div className="mb-6 p-4 bg-slate-800/30 backdrop-blur-sm rounded-2xl border border-blue-500/20 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent pointer-events-none rounded-2xl"></div>
            <div className="relative z-10 flex justify-center">
              <div className="relative">
                <canvas
                  ref={canvasRef}
                  width={canvasWidth}
                  height={canvasHeight}
                  onClick={handleCanvasClick}
                  onMouseMove={handleCanvasMove}
                  onMouseLeave={handleCanvasLeave}
                  onWheel={handleWheel}
                  className="rounded-lg cursor-crosshair"
                  style={{ maxWidth: '100%', height: 'auto' }}
                />

                {/* Zoom controls overlaid on graph */}
                {allowZoom && (
                  <div className="absolute top-4 right-4 flex flex-col gap-2">
                    <button
                      onClick={handleZoomIn}
                      className="w-10 h-10 bg-slate-800/90 hover:bg-blue-500/50 text-white rounded-lg transition-all border border-slate-600/50 hover:border-blue-400/60 flex items-center justify-center backdrop-blur-sm shadow-lg"
                      title="Zoom In"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                    <button
                      onClick={handleZoomOut}
                      className="w-10 h-10 bg-slate-800/90 hover:bg-blue-500/50 text-white rounded-lg transition-all border border-slate-600/50 hover:border-blue-400/60 flex items-center justify-center backdrop-blur-sm shadow-lg"
                      title="Zoom Out"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4" />
                      </svg>
                    </button>
                    <button
                      onClick={handleResetZoom}
                      className="w-10 h-10 bg-slate-800/90 hover:bg-blue-500/50 text-white rounded-lg transition-all border border-slate-600/50 hover:border-blue-400/60 flex items-center justify-center backdrop-blur-sm shadow-lg text-xs"
                      title="Reset Zoom"
                    >
                      1:1
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Controls */}
          {equations.length > 0 && (
            <div className="mb-4">
              <div className="p-6 bg-slate-800/40 backdrop-blur-sm rounded-2xl border border-slate-600/50 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
                <div className="relative z-10">
                  <h4 className="text-sm font-mono uppercase tracking-wider text-blue-400 mb-5 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    Equations
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {equations.map((eq, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentEquationIndex(idx)}
                        className={`group relative w-full p-4 rounded-2xl text-left transition-all duration-300 border-2 ${
                          currentEquationIndex === idx
                            ? 'bg-gradient-to-br from-blue-500/25 via-blue-500/15 to-transparent border-blue-400/60 shadow-[0_0_30px_rgba(59,130,246,0.3)] scale-[1.02]'
                            : 'bg-slate-800/30 border-slate-600/40 hover:border-slate-500/60 hover:bg-slate-700/40 hover:scale-[1.01] hover:shadow-lg'
                        }`}
                      >
                        {/* Animated gradient background for selected */}
                        {currentEquationIndex === idx && (
                          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-500/10 via-transparent to-purple-500/10 animate-pulse pointer-events-none"></div>
                        )}

                        <div className="relative z-10">
                          {/* Equation header */}
                          <div className="flex items-center gap-3 mb-3">
                            <div
                              className={`w-4 h-4 rounded-full flex-shrink-0 transition-all ${
                                currentEquationIndex === idx ? 'ring-2 ring-white/50 ring-offset-2 ring-offset-slate-800' : ''
                              }`}
                              style={{ backgroundColor: eq.color || '#3b82f6' }}
                            ></div>
                            <span className="font-mono font-bold text-lg text-white">{eq.expression}</span>
                          </div>

                          {eq.label && (
                            <div className="mb-3 px-3 py-1.5 bg-slate-700/50 rounded-lg border border-slate-600/30">
                              <p className="text-xs text-slate-300">{eq.label}</p>
                            </div>
                          )}

                          {/* Enhanced Educational Info with inner cards */}
                          {(eq.slope !== undefined || eq.yIntercept !== undefined) && (
                            <div className="space-y-2 mb-3">
                              {eq.slope !== undefined && (
                                <div className="p-3 bg-slate-900/40 rounded-xl border border-slate-600/20">
                                  <div className="flex items-baseline gap-2 mb-1">
                                    <span className="text-xs font-semibold text-blue-300">Slope:</span>
                                    <span className="text-sm text-white font-bold">{eq.slope}</span>
                                  </div>
                                  {eq.slopeInterpretation && (
                                    <p className="text-xs text-slate-400 italic leading-relaxed">{eq.slopeInterpretation}</p>
                                  )}
                                </div>
                              )}
                              {eq.yIntercept !== undefined && (
                                <div className="p-3 bg-slate-900/40 rounded-xl border border-slate-600/20">
                                  <div className="flex items-baseline gap-2 mb-1">
                                    <span className="text-xs font-semibold text-blue-300">Y-intercept:</span>
                                    <span className="text-sm text-white font-bold">{eq.yIntercept}</span>
                                  </div>
                                  {eq.interceptInterpretation && (
                                    <p className="text-xs text-slate-400 italic leading-relaxed">{eq.interceptInterpretation}</p>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Real-World Context with enhanced styling */}
                          {eq.realWorldContext && (
                            <div className="p-3 bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-xl border border-amber-500/30">
                              <div className="flex items-start gap-2">
                                <svg className="w-4 h-4 mt-0.5 text-amber-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                                </svg>
                                <p className="text-xs text-amber-100 leading-relaxed">{eq.realWorldContext}</p>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Hover indicator */}
                        <div className={`absolute top-2 right-2 w-2 h-2 rounded-full transition-all ${
                          currentEquationIndex === idx ? 'bg-blue-400' : 'bg-slate-600 opacity-0 group-hover:opacity-100'
                        }`}></div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="mt-4 p-6 bg-slate-800/40 backdrop-blur-sm rounded-xl border border-slate-600/50 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
            <div className="relative z-10">
              <h4 className="text-sm font-mono uppercase tracking-wider text-blue-400 mb-4">How to Use</h4>
              <ul className="text-sm text-slate-200 space-y-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                {plotMode === 'points' && (
                  <>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 mt-1">▸</span>
                      <span>Click on the graph to plot points</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 mt-1">▸</span>
                      <span>Click on existing points to remove them</span>
                    </li>
                  </>
                )}
                {equations.length > 0 && (
                  <>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 mt-1">▸</span>
                      <span>Equations are automatically graphed</span>
                    </li>
                    {traceEnabled && (
                      <li className="flex items-start gap-2">
                        <span className="text-blue-400 mt-1">▸</span>
                        <span>Hover over curves to see coordinates</span>
                      </li>
                    )}
                    {showIntercepts && (
                      <li className="flex items-start gap-2">
                        <span className="text-blue-400 mt-1">▸</span>
                        <span>Intercepts are marked with dots</span>
                      </li>
                    )}
                  </>
                )}
                {allowZoom && (
                  <>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 mt-1">▸</span>
                      <span>Scroll wheel to zoom at cursor position</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 mt-1">▸</span>
                      <span>Use +/- buttons to zoom centered on origin</span>
                    </li>
                  </>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CoordinateGraph;
