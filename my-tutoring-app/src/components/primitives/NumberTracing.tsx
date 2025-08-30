import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, RotateCcw } from 'lucide-react';

interface NumberTracingProps {
  parameters: {
    prompt: string;
    number_to_trace: number;
    show_stroke_guides?: boolean;
    allow_multiple_attempts?: boolean;
  };
  disabled?: boolean;
  initialValue?: any;
  onUpdate?: (value: any, isComplete?: boolean) => void;
  showValidation?: boolean;
}

export default function NumberTracing({ 
  parameters,
  disabled = false,
  initialValue,
  onUpdate,
  showValidation = false
}: NumberTracingProps) {
  const {
    prompt,
    number_to_trace,
    show_stroke_guides = true,
    allow_multiple_attempts = true
  } = parameters;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(!!initialValue);
  const [traceCompleted, setTraceCompleted] = useState(false);
  const [pathData, setPathData] = useState<Array<{x: number, y: number}>>([]);

  // Canvas dimensions
  const CANVAS_WIDTH = 300;
  const CANVAS_HEIGHT = 200;

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set up canvas
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    
    drawNumber(ctx);
  }, [number_to_trace, show_stroke_guides]);

  // Draw the number outline and guides
  const drawNumber = useCallback((ctx: CanvasRenderingContext2D) => {
    // Clear canvas
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Set up styles
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Draw background grid (light)
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 1;
    for (let i = 0; i <= CANVAS_WIDTH; i += 20) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, CANVAS_HEIGHT);
      ctx.stroke();
    }
    for (let i = 0; i <= CANVAS_HEIGHT; i += 20) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(CANVAS_WIDTH, i);
      ctx.stroke();
    }
    
    // Draw number outline
    ctx.strokeStyle = show_stroke_guides ? '#e0e0e0' : '#d0d0d0';
    ctx.lineWidth = 4;
    ctx.font = 'bold 120px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Draw the number outline
    ctx.strokeText(number_to_trace.toString(), CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    
    // Add stroke direction guides for common numbers
    if (show_stroke_guides) {
      drawStrokeGuides(ctx, number_to_trace);
    }
  }, [number_to_trace, show_stroke_guides]);

  // Draw stroke direction guides
  const drawStrokeGuides = useCallback((ctx: CanvasRenderingContext2D, num: number) => {
    ctx.strokeStyle = '#a0a0ff';
    ctx.lineWidth = 2;
    
    const centerX = CANVAS_WIDTH / 2;
    const centerY = CANVAS_HEIGHT / 2;
    
    // Simple stroke guides for numbers 0-9
    switch (num) {
      case 1:
        // Vertical line from top to bottom
        drawArrow(ctx, centerX, centerY - 60, centerX, centerY + 60);
        break;
      case 2:
        // Curved top, horizontal middle, horizontal bottom
        drawArrow(ctx, centerX - 40, centerY - 40, centerX + 40, centerY - 40);
        drawArrow(ctx, centerX + 40, centerY - 40, centerX + 40, centerY);
        drawArrow(ctx, centerX + 40, centerY, centerX - 40, centerY + 40);
        break;
      case 3:
        // Top curve, middle curve, bottom curve
        drawArrow(ctx, centerX - 30, centerY - 40, centerX + 30, centerY - 40);
        drawArrow(ctx, centerX + 30, centerY - 40, centerX + 30, centerY);
        drawArrow(ctx, centerX + 30, centerY, centerX + 30, centerY + 40);
        break;
      // Add more numbers as needed
    }
  }, []);

  // Draw arrow helper
  const drawArrow = useCallback((ctx: CanvasRenderingContext2D, startX: number, startY: number, endX: number, endY: number) => {
    // Draw line
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    
    // Draw arrowhead
    const angle = Math.atan2(endY - startY, endX - startX);
    const arrowLength = 10;
    
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(
      endX - arrowLength * Math.cos(angle - Math.PI / 6),
      endY - arrowLength * Math.sin(angle - Math.PI / 6)
    );
    ctx.moveTo(endX, endY);
    ctx.lineTo(
      endX - arrowLength * Math.cos(angle + Math.PI / 6),
      endY - arrowLength * Math.sin(angle + Math.PI / 6)
    );
    ctx.stroke();
  }, []);

  // Get mouse/touch position relative to canvas
  const getPointerPos = useCallback((canvas: HTMLCanvasElement, e: React.MouseEvent | React.TouchEvent) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  }, []);

  // Start drawing
  const startDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    setIsDrawing(true);
    setHasDrawn(true);
    
    const pos = getPointerPos(canvas, e);
    setPathData([pos]);
  }, [disabled, getPointerPos]);

  // Continue drawing
  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || disabled) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const pos = getPointerPos(canvas, e);
    
    // Add to path
    setPathData(prev => [...prev, pos]);
    
    // Draw the stroke
    ctx.strokeStyle = '#4f46e5';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    if (pathData.length > 0) {
      const lastPos = pathData[pathData.length - 1];
      ctx.beginPath();
      ctx.moveTo(lastPos.x, lastPos.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    }
  }, [isDrawing, disabled, pathData, getPointerPos]);

  // Stop drawing
  const stopDrawing = useCallback(() => {
    if (!isDrawing) return;
    
    setIsDrawing(false);
    
    // Simple completion check - if they've drawn a reasonable amount
    if (pathData.length > 10) {
      setTraceCompleted(true);
      if (onUpdate) {
        onUpdate({ completed: true, pathLength: pathData.length }, true);
      }
    }
  }, [isDrawing, pathData.length, onUpdate]);

  // Clear and restart
  const handleClear = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    setPathData([]);
    setHasDrawn(false);
    setTraceCompleted(false);
    drawNumber(ctx);
    
    if (onUpdate) {
      onUpdate(null, false);
    }
  }, [drawNumber, onUpdate]);

  return (
    <Card className={`${disabled ? 'opacity-50' : ''}`}>
      <CardContent className="p-6 space-y-4">
        {/* Prompt */}
        <div className="text-center">
          <p className="text-lg font-medium text-gray-800">{prompt}</p>
          {showValidation && traceCompleted && (
            <div className="mt-2 flex items-center justify-center gap-2 text-green-600">
              <CheckCircle className="w-5 h-5" />
              <span className="font-medium">Great job tracing!</span>
            </div>
          )}
        </div>

        {/* Canvas */}
        <div className="flex justify-center">
          <div className="relative border-2 border-gray-200 rounded-lg overflow-hidden bg-white">
            <canvas
              ref={canvasRef}
              className="cursor-crosshair"
              style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
            {!hasDrawn && (
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-10 text-gray-600 text-sm">
                Trace the number with your finger or mouse
              </div>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="text-center text-sm text-gray-600">
          {show_stroke_guides ? (
            <p>Follow the blue arrows to trace the number correctly</p>
          ) : (
            <p>Trace over the gray outline of the number</p>
          )}
        </div>

        {/* Controls */}
        {(hasDrawn || traceCompleted) && allow_multiple_attempts && (
          <div className="flex justify-center">
            <Button onClick={handleClear} variant="outline" disabled={disabled}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}