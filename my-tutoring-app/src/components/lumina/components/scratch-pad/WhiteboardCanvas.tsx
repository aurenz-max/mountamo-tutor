'use client';

import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { Stroke, Point, BackgroundType, ToolType } from './types';

interface WhiteboardCanvasProps {
  tool: ToolType;
  color: string;
  width: number;
  background: BackgroundType;
  strokes: Stroke[];
  setStrokes: React.Dispatch<React.SetStateAction<Stroke[]>>;
  addToHistory: (stroke: Stroke) => void;
}

export interface WhiteboardRef {
  exportImage: () => string;
}

export const WhiteboardCanvas = forwardRef<WhiteboardRef, WhiteboardCanvasProps>(({
  tool,
  color,
  width,
  background,
  strokes,
  addToHistory
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<Point[]>([]);

  // Function to draw grid/lines with Lumina dark theme
  const drawBackground = (ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number) => {
    // Dark slate background matching Lumina theme
    ctx.fillStyle = '#0f172a'; // slate-900
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    ctx.lineWidth = 1;

    if (background === BackgroundType.GRID) {
      const gridSize = 40;
      ctx.strokeStyle = 'rgba(71, 85, 105, 0.3)'; // slate-600 with opacity
      ctx.beginPath();
      for (let x = 0; x <= canvasWidth; x += gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvasHeight);
      }
      for (let y = 0; y <= canvasHeight; y += gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(canvasWidth, y);
      }
      ctx.stroke();
    } else if (background === BackgroundType.LINED) {
      const lineHeight = 40;
      ctx.strokeStyle = 'rgba(71, 85, 105, 0.3)';
      ctx.beginPath();
      for (let y = lineHeight; y < canvasHeight; y += lineHeight) {
        ctx.moveTo(0, y);
        ctx.lineTo(canvasWidth, y);
      }
      ctx.stroke();
    } else if (background === BackgroundType.DOTTED) {
      const gridSize = 40;
      ctx.fillStyle = 'rgba(100, 116, 139, 0.4)'; // slate-500 with opacity
      for (let x = gridSize / 2; x < canvasWidth; x += gridSize) {
        for (let y = gridSize / 2; y < canvasHeight; y += gridSize) {
          ctx.beginPath();
          ctx.arc(x, y, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  };

  // Helper to draw a single stroke
  const drawStroke = (ctx: CanvasRenderingContext2D, stroke: Stroke) => {
    if (stroke.points.length < 2) return;

    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

    // Smooth curve using quadratic bezier
    for (let i = 1; i < stroke.points.length - 1; i++) {
      const xc = (stroke.points[i].x + stroke.points[i + 1].x) / 2;
      const yc = (stroke.points[i].y + stroke.points[i + 1].y) / 2;
      ctx.quadraticCurveTo(stroke.points[i].x, stroke.points[i].y, xc, yc);
    }

    // Last point
    if (stroke.points.length > 1) {
      const lastPoint = stroke.points[stroke.points.length - 1];
      ctx.lineTo(lastPoint.x, lastPoint.y);
    }

    if (stroke.tool === 'eraser') {
      ctx.strokeStyle = '#0f172a'; // Match background for eraser
      ctx.globalAlpha = 1;
    } else if (stroke.tool === 'highlighter') {
      ctx.strokeStyle = stroke.color;
      ctx.globalAlpha = 0.3;
    } else {
      ctx.strokeStyle = stroke.color;
      ctx.globalAlpha = 1;
    }

    ctx.lineWidth = stroke.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.globalAlpha = 1;
  };

  // Main render function
  const render = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    // Draw background
    drawBackground(ctx, rect.width, rect.height);

    // Draw all saved strokes
    strokes.forEach(stroke => drawStroke(ctx, stroke));

    // Draw current stroke being drawn
    if (currentStroke.length > 0) {
      drawStroke(ctx, {
        points: currentStroke,
        color: color,
        width: width,
        tool: tool
      });
    }
  };

  // Re-render when strokes or background changes
  useEffect(() => {
    render();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strokes, currentStroke, background, color, width, tool]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      requestAnimationFrame(render);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Expose export method
  useImperativeHandle(ref, () => ({
    exportImage: () => {
      if (canvasRef.current) {
        return canvasRef.current.toDataURL('image/png');
      }
      return '';
    }
  }));

  // Event Handlers
  const getPoint = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault(); // Prevent scrolling on touch
    setIsDrawing(true);
    const point = getPoint(e);
    setCurrentStroke([point]);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const point = getPoint(e);
    setCurrentStroke(prev => [...prev, point]);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (currentStroke.length > 0) {
      const newStroke: Stroke = {
        points: currentStroke,
        color: color,
        width: width,
        tool: tool
      };
      addToHistory(newStroke);
      setCurrentStroke([]);
    }
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-slate-900 cursor-crosshair touch-none rounded-xl overflow-hidden border border-slate-700/50"
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block touch-none"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
      />
    </div>
  );
});

WhiteboardCanvas.displayName = 'WhiteboardCanvas';
