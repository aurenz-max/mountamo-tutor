'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Compass, Layout, Layers, Download, Pen, Eraser, Trash2 } from 'lucide-react';
import {
  usePrimitiveEvaluation,
  type BlueprintCanvasMetrics,
} from '../../../evaluation';

/**
 * Blueprint Canvas - Grid-based drawing surface for creating technical drawings
 *
 * K-5 Engineering Primitive for understanding:
 * - Bird's eye view concept (K-1)
 * - Drawing simple floor plans (1-2)
 * - Adding measurements (2-3)
 * - Multiple view correspondence (3-4)
 * - Scale drawings (4-5)
 *
 * Real-world connections: architecture, engineering drawings, building design
 *
 * EVALUATION INTEGRATION:
 * - Tracks blueprint completion, room identification, and measurement accuracy
 * - Submits evaluation metrics on blueprint submission
 * - Supports competency tracking via skillId/subskillId/objectiveId
 */

export interface Room {
  id: string;
  name: string;
  x: number; // Percentage 0-100
  y: number; // Percentage 0-100
  width: number; // Percentage 0-100
  height: number; // Percentage 0-100
}

export interface Wall {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  type: 'outer' | 'inner';
}

export interface BlueprintCanvasData {
  title: string;
  description: string;
  gridSize: [number, number];           // Canvas dimensions [rows, cols]
  gridScale: number;                    // Units per grid square (e.g., 1 = 1 meter)
  showGrid: boolean;                    // Display grid lines
  snapToGrid: boolean;                  // Constrain to intersections
  viewType: 'plan' | 'elevation' | 'section'; // View type
  targetRoomCount?: number;             // Optional: Expected number of rooms
  showMeasurements: boolean;            // Show dimension labels
  theme: 'blueprint' | 'technical' | 'sketch';

  // Evaluation integration (optional)
  instanceId?: string;                  // Unique instance ID for tracking
  skillId?: string;                     // Associated skill for competency tracking
  subskillId?: string;                  // Associated subskill
  objectiveId?: string;                 // Learning objective this primitive addresses
  exhibitId?: string;                   // Parent exhibit ID
  onEvaluationSubmit?: (result: import('../../../evaluation').PrimitiveEvaluationResult<BlueprintCanvasMetrics>) => void;
}

interface BlueprintCanvasProps {
  data: BlueprintCanvasData;
  className?: string;
}

const BlueprintCanvas: React.FC<BlueprintCanvasProps> = ({ data, className }) => {
  const {
    title,
    description,
    gridSize = [20, 20],
    gridScale = 1,
    showGrid = true,
    snapToGrid = true,
    viewType = 'plan',
    targetRoomCount,
    showMeasurements = true,
    theme = 'blueprint',
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [hasDrawings, setHasDrawings] = useState(false);
  const [detectedRooms, setDetectedRooms] = useState<Room[]>([]);
  const [drawingStartTime] = useState(Date.now());
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationProgress, setEvaluationProgress] = useState<string>('');
  const [fullEvaluation, setFullEvaluation] = useState<any>(null);

  // Initialize evaluation hook
  const {
    submitResult,
    hasSubmitted,
    submittedResult,
    resetAttempt,
  } = usePrimitiveEvaluation<BlueprintCanvasMetrics>({
    primitiveType: 'blueprint-canvas',
    instanceId: instanceId || `blueprint-canvas-${Date.now()}`,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit,
  });

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
      clearCanvas();
    }
  }, []);

  const drawGrid = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    if (!showGrid) return;

    const bgColor = theme === 'blueprint' ? '#1e3a8a' : theme === 'technical' ? '#ffffff' : '#f1f5f9';
    const gridColor = theme === 'blueprint' ? '#3b82f6' : theme === 'technical' ? '#e2e8f0' : '#cbd5e1';

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 0.5;
    const step = Math.min(w, h) / Math.max(gridSize[0], gridSize[1]);

    ctx.beginPath();
    for (let x = 0; x <= w; x += step) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    for (let y = 0; y <= h; y += step) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();
  };

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { offsetX: 0, offsetY: 0 };

    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let offsetX = (clientX - rect.left) * scaleX;
    let offsetY = (clientY - rect.top) * scaleY;

    // Snap to grid if enabled
    if (snapToGrid && showGrid) {
      const step = Math.min(canvas.width, canvas.height) / Math.max(gridSize[0], gridSize[1]);
      offsetX = Math.round(offsetX / step) * step;
      offsetY = Math.round(offsetY / step) * step;
    }

    return { offsetX, offsetY };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    const { offsetX, offsetY } = getCoordinates(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(offsetX, offsetY);

      const lineColor = theme === 'blueprint' ? '#ffffff' : '#000000';
      ctx.strokeStyle = tool === 'pen' ? lineColor : (theme === 'blueprint' ? '#1e3a8a' : '#ffffff');
      ctx.lineWidth = tool === 'pen' ? 3 : 20;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const { offsetX, offsetY } = getCoordinates(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.lineTo(offsetX, offsetY);
      ctx.stroke();
      if (!hasDrawings) setHasDrawings(true);
    }
  };

  const stopDrawing = () => {
    if (isDrawing) {
      const ctx = canvasRef.current?.getContext('2d');
      ctx?.closePath();
      setIsDrawing(false);
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    drawGrid(ctx, canvas.width, canvas.height);
    setHasDrawings(false);
    setDetectedRooms([]);
  };

  const downloadBlueprint = () => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `blueprint_${viewType}_${Date.now()}.png`;
    a.click();
  };

  const handleSubmit = async () => {
    if (hasSubmitted || !hasDrawings || !canvasRef.current) return;

    setIsEvaluating(true);
    setEvaluationProgress('Preparing your blueprint...');

    try {
      const canvasImage = canvasRef.current.toDataURL('image/png');
      const timeSpent = Date.now() - drawingStartTime;

      // Call API to evaluate the blueprint drawing with Gemini
      setEvaluationProgress('AI is analyzing your blueprint...');
      const response = await fetch('/api/lumina', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'evaluateBlueprintCanvas',
          params: {
            canvasImageBase64: canvasImage,
            assignment: description,
            targetRoomCount: targetRoomCount || 0,
            viewType,
            gradeLevel: 'Grade 3', // TODO: Get actual grade level from context if available
          }
        }),
      });

      if (!response.ok) {
        throw new Error('Evaluation request failed');
      }

      const evaluation = await response.json();
      setEvaluationProgress('Processing feedback...');

      // Update detected rooms with AI results
      const detectedRoomData: Room[] = evaluation.roomsDetected.map((room: { name: string }, idx: number) => ({
        id: `room-${idx}`,
        name: room.name,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
      }));
      setDetectedRooms(detectedRoomData);

      const roomsDrawn = evaluation.totalRoomsFound;
      const targetMet = evaluation.targetMet;

      // Calculate overall score based on AI evaluation
      const roomScore = targetRoomCount
        ? Math.min(100, (roomsDrawn / targetRoomCount) * 100)
        : (hasDrawings ? 100 : 0);
      const qualityScore = (evaluation.technicalQuality + evaluation.spatialPlanning) / 2;
      const score = (roomScore * 0.6) + (qualityScore * 0.4); // 60% completion, 40% quality

      const metrics: BlueprintCanvasMetrics = {
        type: 'blueprint-canvas',
        viewType,
        gridSize,
        roomsDrawn,
        targetRoomCount: targetRoomCount || 0,
        targetMet,
        timeSpent,
        measurementsAdded: showMeasurements,
        gridUsed: snapToGrid,
        completionScore: score,
      };

      submitResult(
        targetMet,
        score,
        metrics,
        {
          studentWork: {
            canvasImage,
            detectedRooms: detectedRoomData,
            aiEvaluation: evaluation,
          },
        }
      );

      // Store evaluation feedback for display AFTER submitResult
      // This ensures hasSubmitted is updated before fullEvaluation
      console.log('Setting fullEvaluation:', evaluation);
      setFullEvaluation(evaluation);
    } catch (error) {
      console.error('Blueprint evaluation error:', error);
      setEvaluationProgress('Evaluation failed. Please try again.');
      // Still allow re-submission
      setIsEvaluating(false);
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleReset = () => {
    clearCanvas();
    resetAttempt();
    setEvaluationProgress('');
    setFullEvaluation(null);
  };

  // Theme-specific colors
  const themeColors = {
    blueprint: {
      bg: 'bg-blue-900',
      border: 'border-blue-500',
      text: 'text-white',
      accent: 'text-blue-300',
    },
    technical: {
      bg: 'bg-white',
      border: 'border-gray-300',
      text: 'text-gray-900',
      accent: 'text-gray-600',
    },
    sketch: {
      bg: 'bg-slate-100',
      border: 'border-slate-400',
      text: 'text-slate-900',
      accent: 'text-slate-600',
    },
  };

  const colors = themeColors[theme];

  return (
    <div className={`${className || ''}`}>
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Compass size={24} className="text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">{title}</h3>
            <p className="text-sm text-slate-400">{description}</p>
          </div>
        </div>
        {targetRoomCount && (
          <p className="text-sm text-slate-300 mt-2">
            Challenge: Draw a floor plan with at least {targetRoomCount} rooms
          </p>
        )}
      </div>

      {/* Main Canvas Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Drawing Canvas */}
        <div className={`${colors.bg} rounded-xl overflow-hidden shadow-2xl border-2 ${colors.border}`}>
          <div className="p-3 flex items-center justify-between border-b border-slate-700 bg-slate-900">
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-wider text-sm uppercase text-blue-400">
                {viewType === 'plan' ? 'Floor Plan' : viewType === 'elevation' ? 'Elevation View' : 'Section View'}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setTool('pen')}
                className={`p-2 rounded-lg transition-colors ${
                  tool === 'pen' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
                title="Pen"
              >
                <Pen size={18} />
              </button>
              <button
                onClick={() => setTool('eraser')}
                className={`p-2 rounded-lg transition-colors ${
                  tool === 'eraser' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
                title="Eraser"
              >
                <Eraser size={18} />
              </button>
              <button
                onClick={clearCanvas}
                className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-red-400 transition-colors"
                title="Clear"
                disabled={hasSubmitted}
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>

          <div className="relative cursor-crosshair h-96 overflow-hidden">
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              className="w-full h-full touch-none"
            />

            {!hasDrawings && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-white/70">
                <div className="text-center p-6">
                  <p className="text-2xl mb-2">Sketch your {viewType} here</p>
                  <p className="text-sm">Outline walls and spaces on the grid</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Info Panel */}
        <div className="space-y-4">
          {/* View Type Info */}
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <h4 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <Layout size={20} />
              Drawing Info
            </h4>
            <div className="space-y-2 text-sm text-slate-300">
              <div className="flex justify-between">
                <span>View Type:</span>
                <span className="font-mono text-blue-400">{viewType.toUpperCase()}</span>
              </div>
              <div className="flex justify-between">
                <span>Grid Scale:</span>
                <span className="font-mono text-blue-400">{gridScale} unit{gridScale !== 1 ? 's' : ''}/square</span>
              </div>
              <div className="flex justify-between">
                <span>Grid Size:</span>
                <span className="font-mono text-blue-400">{gridSize[0]} × {gridSize[1]}</span>
              </div>
              <div className="flex justify-between">
                <span>Snap to Grid:</span>
                <span className="font-mono text-blue-400">{snapToGrid ? 'ON' : 'OFF'}</span>
              </div>
            </div>
          </div>

          {/* Progress */}
          {targetRoomCount && (
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <h4 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <Layers size={20} />
                Progress
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-slate-300">
                  <span>Rooms Detected:</span>
                  <span className="font-bold text-blue-400">{detectedRooms.length} / {targetRoomCount}</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (detectedRooms.length / targetRoomCount) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <h4 className="text-lg font-semibold text-white mb-3">Actions</h4>
            <div className="space-y-2">
              <button
                onClick={downloadBlueprint}
                disabled={!hasDrawings}
                className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all flex items-center justify-center gap-2"
              >
                <Download size={18} />
                Download Blueprint
              </button>

              <button
                onClick={handleSubmit}
                disabled={hasSubmitted || !hasDrawings || isEvaluating}
                className={`w-full px-4 py-3 rounded-lg font-bold transition-all ${
                  hasSubmitted || !hasDrawings || isEvaluating
                    ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white'
                }`}
              >
                {isEvaluating ? evaluationProgress : hasSubmitted ? 'Submitted!' : 'Submit Blueprint'}
              </button>

              {hasSubmitted && (
                <button
                  onClick={handleReset}
                  className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-all"
                >
                  Start New Drawing
                </button>
              )}
            </div>
          </div>

          {/* AI Feedback (after submission) */}
          {(() => {
            // Use fullEvaluation if available, otherwise get from submittedResult
            const evalData = fullEvaluation || (submittedResult?.studentWork as any)?.aiEvaluation;
            if (!evalData) return null;

            return (
            <div className="space-y-3">
              {/* Overall Feedback Card */}
              {evalData.overallFeedback && (
                <div className="group relative bg-gradient-to-br from-cyan-500/10 to-blue-500/10 backdrop-blur-sm rounded-xl p-4 border border-cyan-500/30 hover:border-cyan-400/50 transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/20">
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/0 via-cyan-500/5 to-cyan-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 rounded-xl"></div>
                  <h4 className="text-sm font-bold text-cyan-300 mb-2 flex items-center gap-2">
                    <span className="text-lg">💡</span>
                    AI Feedback
                  </h4>
                  <p className="text-sm text-slate-200 leading-relaxed relative z-10">{evalData.overallFeedback}</p>
                </div>
              )}

              {/* Quality Scores */}
              {(evalData.technicalQuality !== undefined || evalData.spatialPlanning !== undefined) && (
                <div className="grid grid-cols-2 gap-3">
                  {/* Technical Quality */}
                  {evalData.technicalQuality !== undefined && (
                    <div className="group relative bg-gradient-to-br from-purple-500/10 to-indigo-500/10 backdrop-blur-sm rounded-xl p-3 border border-purple-500/30 hover:border-purple-400/50 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/20">
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-500/0 via-purple-500/5 to-purple-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 rounded-xl"></div>
                  <div className="relative z-10">
                    <p className="text-xs font-semibold text-purple-300 mb-1">Technical Quality</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold text-white">{evalData.technicalQuality}</span>
                      <span className="text-xs text-slate-400">/100</span>
                    </div>
                    <div className="mt-2 w-full bg-slate-700/50 rounded-full h-1.5">
                      <div
                        className="bg-gradient-to-r from-purple-500 to-indigo-500 h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${evalData.technicalQuality}%` }}
                      />
                    </div>
                  </div>
                    </div>
                  )}

                  {/* Spatial Planning */}
                  {evalData.spatialPlanning !== undefined && (
                    <div className="group relative bg-gradient-to-br from-emerald-500/10 to-green-500/10 backdrop-blur-sm rounded-xl p-3 border border-emerald-500/30 hover:border-emerald-400/50 transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/20">
                      <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 via-emerald-500/5 to-emerald-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 rounded-xl"></div>
                      <div className="relative z-10">
                        <p className="text-xs font-semibold text-emerald-300 mb-1">Spatial Planning</p>
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-bold text-white">{evalData.spatialPlanning}</span>
                          <span className="text-xs text-slate-400">/100</span>
                        </div>
                        <div className="mt-2 w-full bg-slate-700/50 rounded-full h-1.5">
                          <div
                            className="bg-gradient-to-r from-emerald-500 to-green-500 h-1.5 rounded-full transition-all duration-500"
                            style={{ width: `${evalData.spatialPlanning}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Rooms Detected */}
              {evalData.roomsDetected && evalData.roomsDetected.length > 0 && (
                <div className="group relative bg-gradient-to-br from-amber-500/10 to-orange-500/10 backdrop-blur-sm rounded-xl p-4 border border-amber-500/30 hover:border-amber-400/50 transition-all duration-300 hover:shadow-lg hover:shadow-amber-500/20">
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-500/0 via-amber-500/5 to-amber-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 rounded-xl"></div>
                  <div className="relative z-10">
                    <h4 className="text-sm font-bold text-amber-300 mb-3 flex items-center gap-2">
                      <span className="text-lg">🏠</span>
                      Rooms Detected ({evalData.totalRoomsFound})
                    </h4>
                    <div className="space-y-2">
                      {evalData.roomsDetected.map((room: any, idx: number) => (
                        <div
                          key={idx}
                          className="group/room bg-slate-800/50 rounded-lg p-2 border border-slate-700 hover:border-amber-400/40 transition-all duration-200 hover:bg-slate-800/80"
                        >
                          <div className="flex items-start gap-2">
                            <span className="text-xs mt-0.5">{room.identified ? '✅' : '❓'}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-white capitalize">{room.name}</p>
                              <p className="text-xs text-slate-400 mt-0.5">{room.feedback}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Target Achievement Badge */}
              {targetRoomCount && (
                <div className={`group relative backdrop-blur-sm rounded-xl p-3 border transition-all duration-300 ${
                  evalData.targetMet
                    ? 'bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/30 hover:border-green-400/50 hover:shadow-lg hover:shadow-green-500/20'
                    : 'bg-gradient-to-br from-yellow-500/10 to-amber-500/10 border-yellow-500/30 hover:border-yellow-400/50 hover:shadow-lg hover:shadow-yellow-500/20'
                }`}>
                  <div className={`absolute inset-0 bg-gradient-to-r translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 rounded-xl ${
                    evalData.targetMet
                      ? 'from-green-500/0 via-green-500/5 to-green-500/0'
                      : 'from-yellow-500/0 via-yellow-500/5 to-yellow-500/0'
                  }`}></div>
                  <div className="relative z-10 flex items-center gap-2">
                    <span className="text-2xl">{evalData.targetMet ? '🎯' : '📝'}</span>
                    <div>
                      <p className={`text-sm font-bold ${evalData.targetMet ? 'text-green-300' : 'text-yellow-300'}`}>
                        {evalData.targetMet ? 'Target Achieved!' : 'Keep Going!'}
                      </p>
                      <p className="text-xs text-slate-400">
                        {evalData.totalRoomsFound} of {targetRoomCount} rooms drawn
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
          })()}

          {/* Instructions */}
          <div className="bg-blue-900/20 rounded-xl p-4 border border-blue-500/30">
            <h4 className="text-sm font-semibold text-blue-300 mb-2">Tips:</h4>
            <ul className="text-xs text-slate-300 space-y-1">
              <li>• Use the grid to keep your drawing aligned</li>
              <li>• Draw walls as connected lines</li>
              <li>• Label rooms and add measurements</li>
              <li>• Use the eraser to refine your design</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BlueprintCanvas;
