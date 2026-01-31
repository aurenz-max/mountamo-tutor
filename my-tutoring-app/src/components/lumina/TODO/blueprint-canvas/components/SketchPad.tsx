import React, { useRef, useState, useEffect } from 'react';
import { Eraser, Pen, Trash2 } from 'lucide-react';

interface SketchPadProps {
  onGenerate: (imageData: string) => void;
  isGenerating: boolean;
  selectedRoomName?: string | null;
}

export const SketchPad: React.FC<SketchPadProps> = ({ onGenerate, isGenerating, selectedRoomName }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [hasDrawings, setHasDrawings] = useState(false);

  // Initialize and clear canvas when room changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
      clearCanvas(); // Clear when mounting or when room selection changes
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoomName]);

  const drawGrid = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 0.5;
    const step = 40;
    
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

    return {
      offsetX: (clientX - rect.left) * scaleX,
      offsetY: (clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    const { offsetX, offsetY } = getCoordinates(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(offsetX, offsetY);
      ctx.strokeStyle = tool === 'pen' ? '#000000' : '#ffffff';
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
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawGrid(ctx, canvas.width, canvas.height);
    setHasDrawings(false);
  };

  const handleGenerate = () => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL('image/png');
    onGenerate(dataUrl);
  };

  return (
    <div className="flex flex-col h-full bg-slate-800 rounded-xl overflow-hidden shadow-2xl border border-slate-700">
      <div className={`p-3 flex items-center justify-between border-b border-slate-700 ${selectedRoomName ? 'bg-indigo-900/50' : 'bg-slate-900'}`}>
        <div className="flex items-center gap-2">
          <span className={`font-bold tracking-wider text-sm uppercase ${selectedRoomName ? 'text-indigo-300' : 'text-blue-400'}`}>
            {selectedRoomName ? `Detailing: ${selectedRoomName}` : 'Input: Floor Plan'}
          </span>
        </div>
        <div className="flex gap-2">
           <button
            onClick={() => setTool('pen')}
            className={`p-2 rounded-lg transition-colors ${tool === 'pen' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
            title="Pen"
          >
            <Pen size={18} />
          </button>
          <button
            onClick={() => setTool('eraser')}
            className={`p-2 rounded-lg transition-colors ${tool === 'eraser' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
            title="Eraser"
          >
            <Eraser size={18} />
          </button>
           <button
            onClick={clearCanvas}
            className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-red-400 transition-colors"
            title="Clear"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 relative cursor-crosshair bg-slate-500 overflow-hidden">
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
           <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-slate-300 opacity-50">
             <div className="text-center p-6">
               <p className="font-hand-drawn text-2xl mb-2">
                 {selectedRoomName ? `Sketch interior for ${selectedRoomName}` : 'Sketch your floor plan here'}
               </p>
               <p className="text-sm font-mono">
                 {selectedRoomName ? 'Draw furniture, fixtures, and layout' : 'Outline the walls and main rooms'}
               </p>
             </div>
           </div>
        )}
      </div>

      <div className={`p-4 border-t border-slate-700 ${selectedRoomName ? 'bg-indigo-950' : 'bg-slate-900'}`}>
        <button
          onClick={handleGenerate}
          disabled={!hasDrawings || isGenerating}
          className={`w-full py-3 rounded-lg font-bold tracking-wider transition-all flex items-center justify-center gap-2
            ${!hasDrawings || isGenerating 
              ? 'bg-slate-700 text-slate-500 cursor-not-allowed' 
              : selectedRoomName 
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_15px_rgba(79,70,229,0.5)]'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)]'}`}
        >
          {isGenerating ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Processing...
            </>
          ) : (
             selectedRoomName ? 'GENERATE INTERIOR' : 'CONVERT TO BLUEPRINT'
          )}
        </button>
      </div>
    </div>
  );
};