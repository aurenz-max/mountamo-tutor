import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eraser, Pencil } from 'lucide-react';

const DrawingWorkspace = forwardRef(({ onSubmit, loading = false, captureImagesCallback, isTheaterMode = false }, ref) => {
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

  const getDirectCanvasData = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    
    return canvas.toDataURL('image/png').split(',')[1];
  };
  
  const captureImagesForCanvas = (combinedCanvas, combinedCtx) => {
    // Only proceed if we have images to capture
    if (workspaceImages.length === 0) return;
    
    console.log(`Stamping ${workspaceImages.length} images onto canvas...`);
    
    // Get the canvas scale factor (device pixel ratio)
    const dpr = window.devicePixelRatio || 1;
    
    // Stamp each image onto the canvas
    workspaceImages.forEach(item => {
      if (!item.image.data_uri) return;
      
      // Create a new Image object
      const img = new Image();
      
      // Set up onload handler to draw the image
      img.onload = () => {
        // Calculate position with device pixel ratio adjustment
        const x = item.position.x * dpr;
        const y = item.position.y * dpr;
        
        // Calculate dimensions
        let width, height;
        
        if (item.image._previewSize) {
          width = item.image._previewSize.width * dpr;
          height = item.image._previewSize.height * dpr;
        } else if (item.image.type === 'svg') {
          width = 60 * dpr;
          height = 60 * dpr;
        } else {
          // Use image's natural dimensions with scaling
          const maxSize = 80 * dpr;
          const ratio = Math.min(maxSize / img.width, maxSize / img.height);
          width = img.width * ratio;
          height = img.height * ratio;
        }
        
        // Draw the image on the canvas
        console.log(`Drawing image at ${x},${y} with size ${width}x${height}`);
        combinedCtx.drawImage(img, x, y, width, height);
      };
      
      // Set the source to load the image
      img.src = item.image.data_uri;
    });
    
    // Return a promise that resolves after a reasonable time to ensure images are drawn
    return new Promise(resolve => setTimeout(resolve, 100));
  };

  const captureCanvasWithImages = async () => {
    // Get the current canvas
    const canvas = canvasRef.current;
    if (!canvas) return null;
    
    // Create a new canvas for the combined result
    const combinedCanvas = document.createElement('canvas');
    const combinedCtx = combinedCanvas.getContext('2d');
    
    // Set dimensions to match the original canvas
    combinedCanvas.width = canvas.width;
    combinedCanvas.height = canvas.height;
    
    // Draw the original canvas content (pencil strokes)
    combinedCtx.drawImage(canvas, 0, 0);
    
    // Use the callback for adding images if provided
    if (typeof captureImagesCallback === 'function') {
      // Wait for images to be added
      await captureImagesCallback(combinedCanvas, combinedCtx);
    }
    
    // Return the data URL
    return combinedCanvas.toDataURL('image/png').split(',')[1];
  };

  // Enhance resize function - MOVED OUTSIDE USEEFFECT
  const resize = () => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const container = canvas.parentElement;
    
    // Get the actual dimensions after any DOM updates
    const containerRect = container.getBoundingClientRect();
    
    // Log dimensions for debugging
    console.log(`Theater mode: ${isTheaterMode}, Container size: ${containerRect.width}x${containerRect.height}`);
    
    const dpr = window.devicePixelRatio || 1;
    
    // Apply dimensions with a small buffer to ensure we cover all available space
    canvas.width = (containerRect.width + 10) * dpr; // Add small buffer
    canvas.height = (containerRect.height + 10) * dpr; // Add small buffer
    
    // Apply CSS dimensions that stretch slightly beyond container
    canvas.style.width = `${containerRect.width + 10}px`; 
    canvas.style.height = `${containerRect.height + 10}px`;
    
    // Scale context to account for pixel ratio
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
    ctx.scale(dpr, dpr);
    
    // Restore drawing settings
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  useImperativeHandle(ref, () => ({
    clearCanvas,
    getCanvasData: captureCanvasWithImages,
    getDirectCanvasData,
    canvasRef, // Expose the canvas ref directly
    forceCanvasResize: () => {
      if (canvasRef.current) {
        console.log("Forcing canvas resize due to theater mode change");
        resize();
      }
    }    
  }));


  useEffect(() => {
    if (canvasRef.current && context) {
      console.log("Theater mode changed, resizing canvas");
      // Add a more robust resize approach
      const resizeWithRetry = () => {
        resize();
        // Check if resize was successful by verifying canvas dimensions
        const container = canvasRef.current.parentElement;
        const containerRect = container.getBoundingClientRect();
        const canvas = canvasRef.current;
        
        // If canvas size doesn't match container, retry
        if (Math.abs(canvas.width / (window.devicePixelRatio || 1) - containerRect.width - 10) > 10 ||
            Math.abs(canvas.height / (window.devicePixelRatio || 1) - containerRect.height - 10) > 10) {
          console.log("Canvas size mismatch, retrying resize...");
          setTimeout(resizeWithRetry, 100);
        }
      };
      
      // Delay to ensure container has updated its dimensions
      setTimeout(resizeWithRetry, 100);
    }
  }, [isTheaterMode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    resize();
    window.addEventListener('resize', resize);
    setContext(ctx);
  
    return () => window.removeEventListener('resize', resize);
  }, []);

  const startDrawing = (e) => {
    if (!context) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    // Calculate coordinates with proper scaling
    const x = (e.clientX - rect.left);
    const y = (e.clientY - rect.top);
    
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
    if (!isDrawing || !context) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left);
    const y = (e.clientY - rect.top);
    
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
    <div className="w-full h-full" style={{position: 'relative', overflow: 'hidden'}}>
      <div className="flex gap-2 p-2" style={{position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10}}>
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
  
      <div 
        className="canvas-container" 
        style={{
          position: 'absolute',
          top: '50px', /* Slightly reduced from 60px to give more space */
          left: 0, 
          right: 0, 
          bottom: 0,
          height: isTheaterMode ? 'calc(100vh - 110px)' : 'calc(100% - 50px)'
        }}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full touch-none"
          style={{position: 'absolute', top: 0, left: 0, width: '100%', height: '100%'}}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseOut={stopDrawing}
          onTouchStart={(e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousedown', {
              clientX: touch.clientX,
              clientY: touch.clientY
            });
            canvasRef.current.dispatchEvent(mouseEvent);
          }}
          onTouchMove={(e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousemove', {
              clientX: touch.clientX,
              clientY: touch.clientY
            });
            canvasRef.current.dispatchEvent(mouseEvent);
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            const mouseEvent = new MouseEvent('mouseup');
            canvasRef.current.dispatchEvent(mouseEvent);
          }}
        />
      </div>
      
      {loading && (
        <div className="absolute inset-0 bg-white bg-opacity-70 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  );
});

DrawingWorkspace.displayName = 'DrawingWorkspace';

export default DrawingWorkspace;