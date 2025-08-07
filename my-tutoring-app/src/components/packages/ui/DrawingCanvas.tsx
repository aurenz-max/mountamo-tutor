import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { Pencil, Eraser, Trash2 } from 'lucide-react';

interface DrawingCanvasProps {
  loading?: boolean;
  captureImagesCallback?: (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => void;
}

const DrawingCanvas = forwardRef<any, DrawingCanvasProps>(({ 
  loading = false, 
  captureImagesCallback 
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [context, setContext] = useState<CanvasRenderingContext2D | null>(null);
  const [tool, setTool] = useState('pen');
  const [strokeColor] = useState('#000000');
  const [strokeWidth] = useState(3);
  const [canvasData, setCanvasData] = useState<ImageData | null>(null);

  // Clear the canvas
  const clearCanvas = () => {
    if (canvasRef.current && context) {
      const canvas = canvasRef.current;
      context.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  // Save current state
  const saveCanvasState = () => {
    if (canvasRef.current && context) {
      const imageData = context.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
      setCanvasData(imageData);
    }
  };

  // Restore canvas state
  const restoreCanvasState = () => {
    if (canvasRef.current && context && canvasData) {
      context.putImageData(canvasData, 0, 0);
    }
  };

  // Capture both canvas and images
  const captureCanvasWithImages = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    
    // Create a new canvas for the combined image
    const combinedCanvas = document.createElement('canvas');
    const combinedCtx = combinedCanvas.getContext('2d');
    
    if (!combinedCtx) return null;
    
    // Set dimensions to match the original canvas
    combinedCanvas.width = canvas.width;
    combinedCanvas.height = canvas.height;
    
    // First, draw the original canvas content
    combinedCtx.drawImage(canvas, 0, 0);
    
    // Check if we have an image capture callback and use it
    if (typeof captureImagesCallback === 'function') {
      captureImagesCallback(combinedCanvas, combinedCtx);
    }
    
    // Return the data URL of the combined canvas
    return combinedCanvas.toDataURL('image/png').split(',')[1];
  };


  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    clearCanvas,
    getCanvasData: captureCanvasWithImages,
    saveCanvasState,
    restoreCanvasState
  }));

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas size to match display size
    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (!rect) return;
      
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      
      ctx.scale(dpr, dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    };

    resize();
    window.addEventListener('resize', resize);
    setContext(ctx);

    return () => window.removeEventListener('resize', resize);
  }, [strokeColor, strokeWidth]);

  // Get coordinates relative to canvas
  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    
    const rect = canvasRef.current.getBoundingClientRect();
    
    if ('touches' in e) {
      // Touch event
      const touch = e.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
      };
    } else {
      // Mouse event
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }
  };

  // Drawing functions
  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (!context) return;
    
    e.preventDefault();
    const { x, y } = getCoordinates(e);
    
    context.beginPath();
    context.moveTo(x, y);
    setIsDrawing(true);
    
    // Save state before starting new stroke
    saveCanvasState();
    
    if (tool === 'pen') {
      context.globalCompositeOperation = 'source-over';
      context.strokeStyle = strokeColor;
      context.lineWidth = strokeWidth;
    } else {
      context.globalCompositeOperation = 'destination-out';
      context.lineWidth = 15;
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !context) return;
    
    e.preventDefault();
    const { x, y } = getCoordinates(e);
    
    context.lineTo(x, y);
    context.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing && context) {
      context.closePath();
      setIsDrawing(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Simple Toolbar */}
      <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          {/* Drawing Tools */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1 gap-1">
            <button
              onClick={() => setTool('pen')}
              className={`p-2 rounded transition-all ${
                tool === 'pen' 
                  ? 'bg-white shadow-sm' 
                  : 'hover:bg-gray-200'
              }`}
              title="Draw"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTool('eraser')}
              className={`p-2 rounded transition-all ${
                tool === 'eraser' 
                  ? 'bg-white shadow-sm' 
                  : 'hover:bg-gray-200'
              }`}
              title="Erase"
            >
              <Eraser className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Clear Canvas */}
        <button
          onClick={clearCanvas}
          className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
          title="Clear all"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 overflow-hidden bg-gray-50 p-2">
        <div className="w-full h-full bg-white rounded-lg border-2 border-dashed border-gray-200 overflow-hidden">
          <canvas
            ref={canvasRef}
            className="touch-none cursor-crosshair"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            style={{ display: 'block' }}
          />
        </div>
      </div>
      
      {/* Helper Text */}
      <div className="px-3 py-2 text-xs text-gray-500 text-center border-t border-gray-200">
        Use the drawing tools above to show your work
      </div>
    </div>
  );
});

DrawingCanvas.displayName = 'DrawingCanvas';

export default DrawingCanvas;