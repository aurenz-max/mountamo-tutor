// InfiniteScrollCanvas.tsx - A specialized canvas component for infinite scroll problem sets
import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eraser, Pencil } from 'lucide-react';

interface InfiniteScrollCanvasProps {
  problemId: string;
  isActive: boolean;
  savedData?: string;
  onDataUpdate?: (data: string) => void;
  loading?: boolean;
}

const InfiniteScrollCanvas = forwardRef<any, InfiniteScrollCanvasProps>(({
  problemId,
  isActive,
  savedData,
  onDataUpdate,
  loading = false
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [context, setContext] = useState<CanvasRenderingContext2D | null>(null);
  const [tool, setTool] = useState('pen');
  
  // Setup canvas context when component mounts
  useEffect(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;
    
    // Set canvas size to match display size
    const resize = () => {
      if (!canvas || !ctx) return;
      
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (!rect) return;
      
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
  
  // Restore saved canvas data when available
  useEffect(() => {
    if (savedData && canvasRef.current && context) {
      restoreCanvas(savedData);
    }
  }, [savedData, context]);
  
  // Clear the canvas
  const clearCanvas = () => {
    if (!canvasRef.current || !context) return;
    
    context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    
    // Notify parent component about the cleared canvas
    if (onDataUpdate) {
      onDataUpdate('');
    }
  };
  
  // Capture canvas data as base64 string
  const getCanvasData = (): string => {
    if (!canvasRef.current) return '';
    
    return canvasRef.current.toDataURL('image/png');
  };
  
  // Restore canvas from saved data
  const restoreCanvas = (dataUrl: string) => {
    if (!dataUrl || !canvasRef.current || !context) return;
    
    // Create a new image to load the data URL
    const img = new Image();
    
    img.onload = () => {
      if (canvasRef.current && context) {
        // Clear the canvas first
        context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        
        // Draw the image onto the canvas
        context.drawImage(img, 0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    };
    
    // Handle data URL with or without the prefix
    if (dataUrl.startsWith('data:')) {
      img.src = dataUrl;
    } else {
      img.src = `data:image/png;base64,${dataUrl}`;
    }
  };
  
  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    clearCanvas,
    getCanvasData,
    restoreCanvas
  }));
  
  // Drawing event handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isActive || !context || !canvasRef.current) return;
    
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

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !isActive || !context || !canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    context.lineTo(x, y);
    context.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing && context) {
      context.closePath();
      setIsDrawing(false);
      
      // Notify parent component about the updated canvas
      if (onDataUpdate) {
        onDataUpdate(getCanvasData());
      }
    }
  };
  
  // Touch event handlers for mobile/tablet support
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isActive || !context || !canvasRef.current) return;
    
    // Prevent scrolling while drawing
    e.preventDefault();
    
    const rect = canvasRef.current.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    
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
  
  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !isActive || !context || !canvasRef.current) return;
    
    // Prevent scrolling while drawing
    e.preventDefault();
    
    const rect = canvasRef.current.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    
    context.lineTo(x, y);
    context.stroke();
  };
  
  const handleTouchEnd = () => {
    if (isDrawing && context) {
      context.closePath();
      setIsDrawing(false);
      
      // Notify parent component about the updated canvas
      if (onDataUpdate) {
        onDataUpdate(getCanvasData());
      }
    }
  };

  return (
    <Card className={`p-4 space-y-4 transition-opacity duration-200 ${!isActive ? 'opacity-70' : ''}`}>
      <div className="flex gap-2">
        <Button
          variant={tool === 'pen' ? 'default' : 'outline'}
          size="icon"
          onClick={() => setTool('pen')}
          disabled={!isActive || loading}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant={tool === 'eraser' ? 'default' : 'outline'}
          size="icon"
          onClick={() => setTool('eraser')}
          disabled={!isActive || loading}
        >
          <Eraser className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          onClick={clearCanvas}
          className="ml-auto"
          disabled={!isActive || loading}
        >
          Clear
        </Button>
      </div>

      <div 
        className={`relative w-full h-96 bg-white rounded-lg overflow-hidden border
          ${!isActive ? 'cursor-not-allowed' : 'cursor-crosshair'} 
          ${isActive ? 'ring-2 ring-blue-500' : ''}`}
      >
        <canvas
          ref={canvasRef}
          className="touch-none w-full h-full"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseOut={stopDrawing}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />
        
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80">
            <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div>
          </div>
        )}
        
        {!isActive && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/40">
            <div className="bg-white/90 px-4 py-2 rounded-lg shadow-sm">
              <p className="text-sm text-gray-600">Scroll to this problem to edit</p>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
});

InfiniteScrollCanvas.displayName = 'InfiniteScrollCanvas';

export default InfiniteScrollCanvas;