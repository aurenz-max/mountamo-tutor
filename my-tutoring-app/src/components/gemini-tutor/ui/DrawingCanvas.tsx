import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { Pencil, Eraser, Trash2, Download, Save } from 'lucide-react';

interface DrawingCanvasProps {
  onSubmit?: (canvasData: string) => void;
  loading?: boolean;
  captureImagesCallback?: (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => void;
}

const DrawingCanvas = forwardRef<any, DrawingCanvasProps>(({ 
  onSubmit, 
  loading = false, 
  captureImagesCallback 
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [context, setContext] = useState<CanvasRenderingContext2D | null>(null);
  const [tool, setTool] = useState('pen');
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(2);
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

  // Download canvas as image
  const downloadCanvas = () => {
    if (canvasRef.current) {
      const dataUrl = canvasRef.current.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = 'drawing.png';
      link.href = dataUrl;
      link.click();
    }
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
      context.lineWidth = 20;
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
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      {/* Top Toolbar */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          {/* Drawing Tools */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1 gap-1">
            <button
              onClick={() => setTool('pen')}
              className={`p-2 rounded transition-all ${
                tool === 'pen' 
                  ? 'bg-white dark:bg-gray-700 shadow-sm' 
                  : 'hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <Pencil className="w-5 h-5" />
            </button>
            <button
              onClick={() => setTool('eraser')}
              className={`p-2 rounded transition-all ${
                tool === 'eraser' 
                  ? 'bg-white dark:bg-gray-700 shadow-sm' 
                  : 'hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <Eraser className="w-5 h-5" />
            </button>
          </div>

          {/* Color Picker */}
          <input
            type="color"
            value={strokeColor}
            onChange={(e) => setStrokeColor(e.target.value)}
            className="w-10 h-10 rounded cursor-pointer"
            disabled={tool === 'eraser'}
          />

          {/* Stroke Width */}
          <select
            value={strokeWidth}
            onChange={(e) => setStrokeWidth(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
            disabled={tool === 'eraser'}
          >
            <option value={2}>Thin</option>
            <option value={4}>Medium</option>
            <option value={8}>Thick</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          {/* Clear Canvas */}
          <button
            onClick={clearCanvas}
            className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title="Clear canvas"
          >
            <Trash2 className="w-5 h-5" />
          </button>

          {/* Download */}
          <button
            onClick={downloadCanvas}
            className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title="Download drawing"
          >
            <Download className="w-5 h-5" />
          </button>

          {/* Save/Submit */}
          {onSubmit && (
            <button
              onClick={() => {
                const canvasData = captureCanvasWithImages();
                if (canvasData) onSubmit(canvasData);
              }}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{loading ? 'Saving...' : 'Submit'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 overflow-hidden bg-gray-50 dark:bg-gray-800 p-4">
        <div className="w-full h-full bg-white dark:bg-gray-900 rounded-lg shadow-inner overflow-hidden">
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
    </div>
  );
});

DrawingCanvas.displayName = 'DrawingCanvas';

export default DrawingCanvas;