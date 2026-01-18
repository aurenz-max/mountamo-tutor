import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { Stroke, Point, BackgroundType, ToolType } from '../types';

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
  setStrokes,
  addToHistory
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<Point[]>([]);

  // Function to draw grid/lines
  const drawBackground = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#e2e8f0'; // slate-200
    ctx.lineWidth = 1;

    if (background === BackgroundType.GRID) {
      const gridSize = 40;
      ctx.beginPath();
      for (let x = 0; x <= width; x += gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y = 0; y <= height; y += gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();
    } else if (background === BackgroundType.LINED) {
      const lineHeight = 40;
      ctx.beginPath();
      for (let y = lineHeight; y < height; y += lineHeight) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();
    } else if (background === BackgroundType.DOTTED) {
      const gridSize = 40;
      ctx.fillStyle = '#cbd5e1'; // slate-300
      for (let x = gridSize/2; x < width; x += gridSize) {
        for (let y = gridSize/2; y < height; y += gridSize) {
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

    for (let i = 1; i < stroke.points.length; i++) {
      // Basic smoothing using quadratic curves could go here, but lineTo is faster for raw input
      ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }

    ctx.strokeStyle = stroke.tool === 'eraser' ? '#ffffff' : stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
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
    
    // Check if canvas size matches display size (avoids clearing unnecessarily if size hasn't changed, 
    // but here we usually redraw everything on state change anyway)
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
  }, [strokes, currentStroke, background]);

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
    <div ref={containerRef} className="w-full h-full bg-gray-100 cursor-crosshair touch-none">
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
