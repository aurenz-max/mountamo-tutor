'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GeneratedPrimitive } from '../types';
import { PrimitiveRenderer } from './PrimitiveRenderer';

interface PrimitiveViewerProps {
  primitive: GeneratedPrimitive;
  onClose: () => void;
  onMinimize?: () => void;
}

const CloseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const MinimizeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

export const PrimitiveViewer: React.FC<PrimitiveViewerProps> = ({
  primitive,
  onClose,
  onMinimize
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  return (
    <div className={`flex flex-col h-full bg-slate-900 rounded-2xl border border-slate-700/50 overflow-hidden ${
      isFullscreen ? 'fixed inset-4 z-50' : ''
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800/50 border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-400">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </div>
          <div>
            <h3 className="text-white font-medium text-sm">
              Interactive Visual
            </h3>
            <p className="text-slate-400 text-xs">
              {primitive.componentId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {onMinimize && (
            <button
              onClick={onMinimize}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              title="Minimize"
            >
              <MinimizeIcon />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors"
            title="Close"
          >
            <CloseIcon />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        <PrimitiveRenderer
          componentId={primitive.componentId}
          data={primitive.data}
        />
      </div>

      {/* Footer hint */}
      <div className="px-4 py-2 bg-slate-800/30 border-t border-slate-700/50">
        <p className="text-xs text-slate-500 text-center">
          Interact with this visual while you work on your scratch pad
        </p>
      </div>
    </div>
  );
};

/**
 * Resizable split panel container
 */
interface SplitPanelContainerProps {
  leftPanel: React.ReactNode;
  rightPanel: React.ReactNode;
  defaultSplit?: number; // 0-100, percentage of left panel
  minLeftWidth?: number; // pixels
  minRightWidth?: number; // pixels
}

export const SplitPanelContainer: React.FC<SplitPanelContainerProps> = ({
  leftPanel,
  rightPanel,
  defaultSplit = 50,
  minLeftWidth = 300,
  minRightWidth = 350
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [splitPosition, setSplitPosition] = useState(defaultSplit);
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const mouseX = e.clientX - containerRect.left;

    // Calculate percentage
    let newSplit = (mouseX / containerWidth) * 100;

    // Apply min width constraints
    const minLeftPercent = (minLeftWidth / containerWidth) * 100;
    const minRightPercent = (minRightWidth / containerWidth) * 100;
    const maxLeftPercent = 100 - minRightPercent;

    newSplit = Math.max(minLeftPercent, Math.min(maxLeftPercent, newSplit));

    setSplitPosition(newSplit);
  }, [isDragging, minLeftWidth, minRightWidth]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div ref={containerRef} className="flex h-full w-full">
      {/* Left panel */}
      <div
        className="h-full overflow-hidden"
        style={{ width: `${splitPosition}%` }}
      >
        {leftPanel}
      </div>

      {/* Resizable divider */}
      <div
        className={`w-2 bg-slate-800 hover:bg-purple-500/50 cursor-col-resize flex items-center justify-center transition-colors ${
          isDragging ? 'bg-purple-500/50' : ''
        }`}
        onMouseDown={handleMouseDown}
      >
        <div className="w-1 h-8 bg-slate-600 rounded-full" />
      </div>

      {/* Right panel */}
      <div
        className="h-full overflow-hidden"
        style={{ width: `${100 - splitPosition}%` }}
      >
        {rightPanel}
      </div>
    </div>
  );
};

export default PrimitiveViewer;
