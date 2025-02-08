'use client';
import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eraser, Pencil } from 'lucide-react';

const DrawingWorkspace = forwardRef(({ onSubmit, loading = false }, ref) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [context, setContext] = useState(null);
  const [tool, setTool] = useState('pen');

  const clearCanvas = () => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  // Expose clearCanvas method to parent component
  useImperativeHandle(ref, () => ({
    clearCanvas
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Set canvas size to match display size
    const resize = () => {
      const rect = canvas.parentElement.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      
      ctx.scale(dpr, dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    };

    resize();
    window.addEventListener('resize', resize);
    setContext(ctx);

    return () => window.removeEventListener('resize', resize);
  }, []);

  const startDrawing = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    context.beginPath();
    context.moveTo(x, y);
    setIsDrawing(true);
    
    if (tool === 'pen') {
      context.strokeStyle = '#000000';
      context.lineWidth = 2;
    } else {
      context.strokeStyle = '#FFFFFF';
      context.lineWidth = 20;
    }
  };

  const draw = (e) => {
    if (!isDrawing) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    context.lineTo(x, y);
    context.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing) {
      context.closePath();
      setIsDrawing(false);
    }
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="flex gap-2">
        <Button
          variant={tool === 'pen' ? 'default' : 'outline'}
          size="icon"
          onClick={() => setTool('pen')}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant={tool === 'eraser' ? 'default' : 'outline'}
          size="icon"
          onClick={() => setTool('eraser')}
        >
          <Eraser className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          onClick={clearCanvas}
          className="ml-auto"
        >
          Clear
        </Button>
      </div>

      <div className="w-full h-96 bg-white rounded-lg overflow-hidden border">
        <canvas
          ref={canvasRef}
          className="touch-none"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseOut={stopDrawing}
        />
      </div>

      <Button 
        onClick={() => {
          const canvas = canvasRef.current;
          const imageData = canvas.toDataURL('image/png').split(',')[1];
          onSubmit(imageData);
        }}
        disabled={loading}
        className="w-full"
      >
        Submit Answer
      </Button>
    </Card>
  );
});

DrawingWorkspace.displayName = 'DrawingWorkspace';

export default DrawingWorkspace;