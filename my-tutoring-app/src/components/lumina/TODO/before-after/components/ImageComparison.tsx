import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { GlassCard } from './GlassCard';

interface ImageComparisonProps {
  beforeImage: string;
  afterImage: string;
  beforeLabel?: string;
  afterLabel?: string;
  isLoading?: boolean;
}

export const ImageComparison: React.FC<ImageComparisonProps> = ({ 
  beforeImage, 
  afterImage,
  beforeLabel = "BEFORE",
  afterLabel = "AFTER",
  isLoading = false
}) => {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback(() => {
    setIsResizing(true);
  }, []);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isResizing || !containerRef.current) return;

    let clientX;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
    } else {
      clientX = (e as MouseEvent).clientX;
    }

    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percentage = (x / rect.width) * 100;
    
    setSliderPosition(percentage);
  }, [isResizing]);

  useEffect(() => {
    const handleUp = () => setIsResizing(false);
    
    document.addEventListener('mouseup', handleUp);
    document.addEventListener('touchend', handleUp);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('touchmove', handleMouseMove);

    return () => {
      document.removeEventListener('mouseup', handleUp);
      document.removeEventListener('touchend', handleUp);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('touchmove', handleMouseMove);
    };
  }, [handleMouseMove]);


  if (isLoading) {
    return (
      <GlassCard className="w-full aspect-square md:aspect-[16/9] flex items-center justify-center relative overflow-hidden group">
         <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" style={{ backgroundSize: '200% 100%' }}></div>
         <div className="flex flex-col items-center gap-4 z-10">
            <div className="w-12 h-12 border-4 border-t-purple-400 border-white/20 rounded-full animate-spin"></div>
            <p className="text-white/80 font-medium animate-pulse">Generating realities...</p>
         </div>
      </GlassCard>
    );
  }

  if (!beforeImage || !afterImage) {
    return (
      <GlassCard className="w-full aspect-video flex flex-col items-center justify-center text-center p-8 text-white/50 border-dashed border-2 border-white/10">
        <ArrowLeftRight className="w-16 h-16 mb-4 opacity-50" />
        <p>Enter a topic above to generate a comparison</p>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="relative w-full aspect-square md:aspect-[16/9] overflow-hidden select-none group border-0">
      <div 
        ref={containerRef}
        className="relative w-full h-full cursor-ew-resize"
        onMouseDown={handleMouseDown}
        onTouchStart={handleMouseDown}
      >
        {/* AFTER Image (Background) */}
        <img 
          src={afterImage} 
          alt={afterLabel} 
          className="absolute inset-0 w-full h-full object-cover pointer-events-none" 
        />
        
        {/* Labels - After */}
        <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold tracking-widest text-white border border-white/10 z-10 pointer-events-none uppercase">
          {afterLabel}
        </div>

        {/* BEFORE Image (Foreground - Clipped) */}
        <div 
          className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none"
          style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
        >
          <img 
            src={beforeImage} 
            alt={beforeLabel} 
            className="absolute inset-0 w-full h-full object-cover" 
          />
           {/* Labels - Before */}
          <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold tracking-widest text-white border border-white/10 z-10 uppercase">
            {beforeLabel}
          </div>
        </div>

        {/* Slider Handle */}
        <div 
          className="absolute top-0 bottom-0 w-1 bg-white cursor-ew-resize shadow-[0_0_20px_rgba(0,0,0,0.5)] z-20"
          style={{ left: `${sliderPosition}%` }}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg transform transition-transform group-hover:scale-110 active:scale-95 text-indigo-900">
            <ArrowLeftRight size={14} strokeWidth={3} />
          </div>
        </div>
      </div>
      
      {/* Instructional Tooltip (fades out on interaction) */}
      <div className={`absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full text-sm text-white/90 pointer-events-none transition-opacity duration-500 border border-white/10 ${isResizing ? 'opacity-0' : 'opacity-100'}`}>
        Drag slider to compare
      </div>
    </GlassCard>
  );
};
