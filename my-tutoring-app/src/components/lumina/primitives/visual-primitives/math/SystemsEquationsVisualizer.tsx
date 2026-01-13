'use client';

import React, { useState, useRef, useEffect } from 'react';

export interface SystemEquation {
  expression: string; // e.g., "y = 2x + 1"
  color?: string;
  label?: string;
  slope?: number;
  yIntercept?: number;
}

export interface IntersectionPoint {
  x: number;
  y: number;
  label?: string;
}

export interface AlgebraicStep {
  method: 'substitution' | 'elimination' | 'graphing';
  stepNumber: number;
  description: string;
  equation?: string;
}

export interface SystemsEquationsVisualizerData {
  title: string;
  description: string;
  equations: SystemEquation[];
  xRange: [number, number];
  yRange: [number, number];
  gridSpacing?: { x: number; y: number };
  showGraph?: boolean;
  showAlgebraic?: boolean;
  solutionMethod?: 'graphing' | 'substitution' | 'elimination';
  highlightIntersection?: boolean;
  stepByStep?: boolean;
  intersectionPoint?: IntersectionPoint;
  algebraicSteps?: AlgebraicStep[];
  systemType?: 'one-solution' | 'no-solution' | 'infinite-solutions';
}

interface SystemsEquationsVisualizerProps {
  data: SystemsEquationsVisualizerData;
  className?: string;
}

const SystemsEquationsVisualizer: React.FC<SystemsEquationsVisualizerProps> = ({ data, className }) => {
  const {
    title,
    description,
    equations,
    xRange,
    yRange,
    gridSpacing = { x: 1, y: 1 },
    showGraph = true,
    showAlgebraic = true,
    solutionMethod = 'graphing',
    highlightIntersection = true,
    stepByStep = false,
    intersectionPoint,
    algebraicSteps = [],
    systemType = 'one-solution',
  } = data;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [showingSolution, setShowingSolution] = useState(!stepByStep);
  const [hoveredEquation, setHoveredEquation] = useState<number | null>(null);

  const padding = 50;
  const canvasWidth = 600;
  const canvasHeight = 600;

  // Helper function to convert graph coordinates to canvas coordinates
  const graphToCanvas = (x: number, y: number) => {
    const xScale = (canvasWidth - 2 * padding) / (xRange[1] - xRange[0]);
    const yScale = (canvasHeight - 2 * padding) / (yRange[1] - yRange[0]);

    const canvasX = padding + (x - xRange[0]) * xScale;
    const canvasY = canvasHeight - padding - (y - yRange[0]) * yScale;

    return { x: canvasX, y: canvasY };
  };

  // Evaluate equation at a given x value
  const evaluateEquation = (expression: string, x: number): number | null => {
    try {
      // Parse simple linear equations: y = mx + b
      const match = expression.match(/y\s*=\s*([+-]?\d*\.?\d*)\s*\*?\s*x\s*([+-]\s*\d+\.?\d*)?/i);
      if (match) {
        const m = match[1] === '' || match[1] === '+' ? 1 : match[1] === '-' ? -1 : parseFloat(match[1]);
        const b = match[2] ? parseFloat(match[2].replace(/\s/g, '')) : 0;
        return m * x + b;
      }

      // Try to evaluate as JavaScript expression (sanitized)
      const sanitized = expression
        .replace(/y\s*=\s*/i, '')
        .replace(/\^/g, '**')
        .replace(/x/gi, `(${x})`);

      return eval(sanitized);
    } catch (error) {
      console.error('Error evaluating equation:', expression, error);
      return null;
    }
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
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;

    for (let x = Math.ceil(xRange[0] / gridSpacing.x) * gridSpacing.x; x <= xRange[1]; x += gridSpacing.x) {
      const canvasPos = graphToCanvas(x, 0);
      ctx.beginPath();
      ctx.moveTo(canvasPos.x, padding);
      ctx.lineTo(canvasPos.x, canvasHeight - padding);
      ctx.stroke();
    }

    for (let y = Math.ceil(yRange[0] / gridSpacing.y) * gridSpacing.y; y <= yRange[1]; y += gridSpacing.y) {
      const canvasPos = graphToCanvas(0, y);
      ctx.beginPath();
      ctx.moveTo(padding, canvasPos.y);
      ctx.lineTo(canvasWidth - padding, canvasPos.y);
      ctx.stroke();
    }

    // Draw axes
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 2;

    // X-axis
    const xAxisY = graphToCanvas(0, 0).y;
    ctx.beginPath();
    ctx.moveTo(padding, xAxisY);
    ctx.lineTo(canvasWidth - padding, xAxisY);
    ctx.stroke();

    // Y-axis
    const yAxisX = graphToCanvas(0, 0).x;
    ctx.beginPath();
    ctx.moveTo(yAxisX, padding);
    ctx.lineTo(yAxisX, canvasHeight - padding);
    ctx.stroke();

    // Draw axis labels
    ctx.fillStyle = '#374151';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';

    // X-axis labels
    for (let x = Math.ceil(xRange[0]); x <= xRange[1]; x += gridSpacing.x) {
      if (x === 0) continue;
      const pos = graphToCanvas(x, 0);
      ctx.fillText(x.toString(), pos.x, pos.y + 20);
    }

    // Y-axis labels
    ctx.textAlign = 'right';
    for (let y = Math.ceil(yRange[0]); y <= yRange[1]; y += gridSpacing.y) {
      if (y === 0) continue;
      const pos = graphToCanvas(0, y);
      ctx.fillText(y.toString(), pos.x - 10, pos.y + 4);
    }

    // Draw equations
    equations.forEach((equation, index) => {
      const isHovered = hoveredEquation === index;
      const color = equation.color || ['#3b82f6', '#10b981', '#f59e0b'][index % 3];

      ctx.strokeStyle = color;
      ctx.lineWidth = isHovered ? 4 : 3;
      ctx.beginPath();

      let firstPoint = true;
      for (let x = xRange[0]; x <= xRange[1]; x += 0.1) {
        const y = evaluateEquation(equation.expression, x);
        if (y !== null && y >= yRange[0] && y <= yRange[1]) {
          const canvasPos = graphToCanvas(x, y);
          if (firstPoint) {
            ctx.moveTo(canvasPos.x, canvasPos.y);
            firstPoint = false;
          } else {
            ctx.lineTo(canvasPos.x, canvasPos.y);
          }
        }
      }
      ctx.stroke();

      // Draw equation label
      if (equation.label) {
        const labelX = xRange[1] - 1;
        const labelY = evaluateEquation(equation.expression, labelX);
        if (labelY !== null) {
          const labelPos = graphToCanvas(labelX, labelY);
          ctx.fillStyle = color;
          ctx.font = 'bold 14px sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText(equation.label, labelPos.x + 10, labelPos.y);
        }
      }
    });

    // Draw intersection point
    if (highlightIntersection && intersectionPoint && showingSolution) {
      const pos = graphToCanvas(intersectionPoint.x, intersectionPoint.y);

      // Draw outer circle
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 8, 0, 2 * Math.PI);
      ctx.fill();

      // Draw inner circle
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 4, 0, 2 * Math.PI);
      ctx.fill();

      // Draw label
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        intersectionPoint.label || `(${intersectionPoint.x.toFixed(1)}, ${intersectionPoint.y.toFixed(1)})`,
        pos.x,
        pos.y - 15
      );
    }
  }, [equations, xRange, yRange, gridSpacing, hoveredEquation, highlightIntersection, intersectionPoint, showingSolution]);

  const getSystemTypeText = () => {
    switch (systemType) {
      case 'one-solution':
        return 'This system has one unique solution (the lines intersect at one point).';
      case 'no-solution':
        return 'This system has no solution (the lines are parallel and never intersect).';
      case 'infinite-solutions':
        return 'This system has infinitely many solutions (the lines are identical).';
      default:
        return '';
    }
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
          <h2 className="text-2xl font-bold text-white tracking-tight">Systems of Equations</h2>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
            <p className="text-xs text-blue-400 font-mono uppercase tracking-wider">Graphical & Algebraic Solutions</p>
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
            <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
            <p className="text-slate-300 font-light">{description}</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Graph Panel */}
            {showGraph && (
              <div className="p-6 bg-slate-800/40 backdrop-blur-sm rounded-2xl border border-slate-600/50 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent pointer-events-none"></div>
                <div className="relative z-10">
                  <h4 className="text-sm font-mono uppercase tracking-wider text-blue-400 mb-5 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                    </svg>
                    Graphical Solution
                  </h4>
                  <div className="mb-6 p-4 bg-slate-800/30 backdrop-blur-sm rounded-2xl border border-blue-500/20 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent pointer-events-none rounded-2xl"></div>
                    <div className="relative z-10 flex justify-center">
                      <canvas
                        ref={canvasRef}
                        width={canvasWidth}
                        height={canvasHeight}
                        className="rounded-lg w-full"
                        style={{ maxWidth: '100%', height: 'auto', backgroundColor: 'rgba(15, 23, 42, 0.6)' }}
                      />
                    </div>
                  </div>

                  {/* Equation Legend */}
                  <div className="space-y-2 mb-4">
                    {equations.map((eq, index) => (
                      <div
                        key={index}
                        className={`group relative flex items-center gap-3 p-3 rounded-xl transition-all duration-300 border-2 cursor-pointer ${
                          hoveredEquation === index
                            ? 'bg-gradient-to-br from-blue-500/25 via-blue-500/15 to-transparent border-blue-400/60 shadow-[0_0_30px_rgba(59,130,246,0.3)] scale-[1.02]'
                            : 'bg-slate-800/30 border-slate-600/40 hover:border-slate-500/60 hover:bg-slate-700/40'
                        }`}
                        onMouseEnter={() => setHoveredEquation(index)}
                        onMouseLeave={() => setHoveredEquation(null)}
                      >
                        {/* Glow Effect */}
                        {hoveredEquation === index && (
                          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-transparent rounded-xl blur-xl"></div>
                        )}
                        <div className="relative z-10 flex items-center gap-3 w-full">
                          <div
                            className={`w-5 h-5 rounded-full flex-shrink-0 ring-2 ring-offset-2 ring-offset-slate-800 transition-all ${
                              hoveredEquation === index ? 'ring-blue-400/60 scale-110' : 'ring-transparent'
                            }`}
                            style={{ backgroundColor: eq.color || ['#3b82f6', '#10b981', '#f59e0b'][index % 3] }}
                          />
                          <span className="text-sm font-mono text-white">{eq.expression}</span>
                          {eq.label && <span className="text-xs text-slate-400 ml-auto">{eq.label}</span>}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* System Type Information */}
                  <div className="p-4 bg-gradient-to-br from-slate-900/60 to-slate-800/40 rounded-xl border border-slate-600/30 overflow-hidden">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/10 rounded-full blur-2xl"></div>
                    <div className="relative z-10">
                      <p className="text-sm text-slate-300">{getSystemTypeText()}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Algebraic Solution Panel */}
            {showAlgebraic && (
              <div className="p-6 bg-slate-800/40 backdrop-blur-sm rounded-2xl border border-slate-600/50 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent pointer-events-none"></div>
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-5">
                    <h4 className="text-sm font-mono uppercase tracking-wider text-green-400 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
                      </svg>
                      Algebraic Solution ({solutionMethod})
                    </h4>
                    {stepByStep && (
                      <button
                        onClick={() => setShowingSolution(!showingSolution)}
                        className="px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-xs font-mono rounded-lg transition-all border border-blue-500/30 hover:border-blue-400/50"
                      >
                        {showingSolution ? 'Reset' : 'Show Solution'}
                      </button>
                    )}
                  </div>

                  {/* Method Selector */}
                  <div className="mb-4 flex gap-2">
                    {['graphing', 'substitution', 'elimination'].map((method) => (
                      <button
                        key={method}
                        className={`px-3 py-2 rounded-lg text-xs font-mono transition-all ${
                          solutionMethod === method
                            ? 'bg-blue-500/30 text-blue-300 border border-blue-400/50'
                            : 'bg-slate-800/50 text-slate-400 border border-slate-600/40 hover:border-slate-500/60'
                        }`}
                      >
                        {method.charAt(0).toUpperCase() + method.slice(1)}
                      </button>
                    ))}
                  </div>

                  {/* Solution Steps */}
                  <div className="space-y-3">
                    {algebraicSteps.length > 0 ? (
                      algebraicSteps.map((step, index) => (
                        <div
                          key={index}
                          className={`p-4 rounded-xl border-2 transition-all ${
                            !stepByStep || index <= currentStep
                              ? 'bg-slate-900/40 border-slate-600/40 opacity-100'
                              : 'bg-slate-800/20 border-slate-700/30 opacity-50'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-7 h-7 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold shadow-lg">
                              {step.stepNumber}
                            </div>
                            <div className="flex-1">
                              <p className="text-sm text-slate-300 mb-2">{step.description}</p>
                              {step.equation && (
                                <code className="text-sm font-mono text-blue-300 bg-slate-900/60 px-3 py-1.5 rounded-lg inline-block border border-blue-500/30">
                                  {step.equation}
                                </code>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                        <p className="text-sm text-amber-300">
                          Use the graph to find the intersection point, or select a method above to see algebraic steps.
                        </p>
                      </div>
                    )}

                    {stepByStep && currentStep < algebraicSteps.length - 1 && (
                      <button
                        onClick={() => setCurrentStep(currentStep + 1)}
                        className="w-full px-4 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl hover:from-green-600 hover:to-green-700 font-medium shadow-lg transition-all"
                      >
                        Next Step
                      </button>
                    )}
                  </div>

                  {/* Final Solution */}
                  {showingSolution && intersectionPoint && (
                    <div className="mt-4 p-5 bg-gradient-to-br from-green-500/20 to-green-600/10 border-2 border-green-500/50 rounded-xl overflow-hidden relative">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/20 rounded-full blur-3xl"></div>
                      <div className="relative z-10">
                        <h5 className="font-bold text-green-400 mb-3 text-sm uppercase tracking-wider flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                          </svg>
                          Solution
                        </h5>
                        <p className="text-slate-200 mb-2">
                          The lines intersect at point{' '}
                          <span className="font-mono font-bold text-white bg-slate-900/50 px-2 py-1 rounded border border-green-500/30">
                            ({intersectionPoint.x.toFixed(2)}, {intersectionPoint.y.toFixed(2)})
                          </span>
                        </p>
                        <p className="text-sm text-slate-400">
                          This means x = {intersectionPoint.x.toFixed(2)} and y = {intersectionPoint.y.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Educational Context */}
          {systemType === 'one-solution' && intersectionPoint && (
            <div className="mt-6 p-6 bg-purple-500/10 border border-purple-500/30 rounded-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-32 h-32 bg-purple-500/20 rounded-full blur-3xl"></div>
              <div className="relative z-10">
                <h5 className="font-semibold text-purple-400 mb-3 text-sm uppercase tracking-wider flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
                  </svg>
                  Understanding the Solution
                </h5>
                <p className="text-sm text-slate-300">
                  The intersection point represents values of x and y that satisfy <strong className="text-white">both</strong> equations
                  simultaneously. You can verify this by substituting x = {intersectionPoint.x.toFixed(2)} and
                  y = {intersectionPoint.y.toFixed(2)} into each original equation.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SystemsEquationsVisualizer;
