import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { ImageComparisonData } from '../types';

interface ImageComparisonProps {
  data: ImageComparisonData;
  className?: string;
}

const ImageComparison: React.FC<ImageComparisonProps> = ({ data, className = '' }) => {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isResizing, setIsResizing] = useState(false);
  const [imagesLoaded, setImagesLoaded] = useState(false);
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

  // Check if both images are loaded
  useEffect(() => {
    if (!data.beforeImage || !data.afterImage) {
      setImagesLoaded(false);
      return;
    }

    const beforeImg = new Image();
    const afterImg = new Image();
    let beforeLoaded = false;
    let afterLoaded = false;

    const checkBothLoaded = () => {
      if (beforeLoaded && afterLoaded) {
        setImagesLoaded(true);
      }
    };

    beforeImg.onload = () => {
      beforeLoaded = true;
      checkBothLoaded();
    };

    afterImg.onload = () => {
      afterLoaded = true;
      checkBothLoaded();
    };

    beforeImg.src = data.beforeImage;
    afterImg.src = data.afterImage;
  }, [data.beforeImage, data.afterImage]);

  if (!data.beforeImage || !data.afterImage) {
    return (
      <div className={`w-full aspect-video flex flex-col items-center justify-center text-center p-8 bg-slate-800/30 backdrop-blur-sm rounded-2xl border-2 border-dashed border-slate-700 ${className}`}>
        <ArrowLeftRight className="w-16 h-16 mb-4 text-slate-600" />
        <p className="text-slate-500">No comparison images available</p>
      </div>
    );
  }

  const beforeLabel = data.beforeLabel || 'BEFORE';
  const afterLabel = data.afterLabel || 'AFTER';

  return (
    <div className={className}>
      {/* Title */}
      {data.title && (
        <h3 className="text-2xl font-bold text-white mb-4">{data.title}</h3>
      )}

      {/* Description */}
      {data.description && (
        <p className="text-slate-300 mb-6 leading-relaxed">{data.description}</p>
      )}

      {/* Image Comparison Slider */}
      <div className="relative w-full aspect-square md:aspect-[16/9] overflow-hidden select-none group border border-white/10 rounded-2xl bg-slate-900/50 backdrop-blur-sm shadow-2xl">
        <div
          ref={containerRef}
          className="relative w-full h-full cursor-ew-resize"
          onMouseDown={handleMouseDown}
          onTouchStart={handleMouseDown}
        >
          {/* Loading State */}
          {!imagesLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-800/50 backdrop-blur-sm z-30">
              <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-t-purple-400 border-white/20 rounded-full animate-spin"></div>
                <p className="text-white/80 font-medium">Loading comparison...</p>
              </div>
            </div>
          )}

          {/* AFTER Image (Background) */}
          <img
            src={data.afterImage}
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
              src={data.beforeImage}
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
      </div>

      {/* Detailed Explanation */}
      {data.detailedExplanation && (
        <div className="mt-6 p-6 bg-slate-800/30 backdrop-blur-sm rounded-xl border border-slate-700">
          <h4 className="text-lg font-semibold text-white mb-3">Understanding the Change</h4>
          <p className="text-slate-300 leading-relaxed">{data.detailedExplanation}</p>
        </div>
      )}

      {/* Key Takeaways */}
      {data.keyTakeaways && data.keyTakeaways.length > 0 && (
        <div className="mt-4 p-6 bg-slate-800/30 backdrop-blur-sm rounded-xl border border-slate-700">
          <h4 className="text-lg font-semibold text-white mb-3">Key Takeaways</h4>
          <ul className="space-y-2">
            {data.keyTakeaways.map((takeaway, index) => (
              <li key={index} className="flex items-start gap-3 text-slate-300">
                <span className="text-purple-400 mt-1">•</span>
                <span className="leading-relaxed">{takeaway}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ImageComparison;
