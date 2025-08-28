import React, { useState, useRef, useCallback, useEffect } from 'react';
import { usePrimitive } from '../core/PrimitiveBase';
import { DiagramLabelerProps } from '../core/PrimitiveTypes';

interface DiagramLabelerAnswer {
  labels: Record<string, string>; // hotspot_id -> label
  completed_hotspots: string[];
}

interface DragState {
  isDragging: boolean;
  draggedLabel: string | null;
  startPosition: { x: number; y: number };
  currentPosition: { x: number; y: number };
}

export function DiagramLabeler({
  id,
  params,
  disabled = false,
  onChange,
  initialAnswer
}: DiagramLabelerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    draggedLabel: null,
    startPosition: { x: 0, y: 0 },
    currentPosition: { x: 0, y: 0 }
  });
  const [hoveredHotspot, setHoveredHotspot] = useState<string | null>(null);

  const {
    answer,
    updateAnswer,
    clearAnswer,
    isValid,
    hasAnswer
  } = usePrimitive<DiagramLabelerAnswer>(
    id,
    initialAnswer,
    onChange,
    (answer) => {
      if (!answer?.value) return false;
      // Check that all hotspots are labeled
      const requiredLabels = params.hotspots.length;
      const providedLabels = Object.keys(answer.value.labels || {}).length;
      return providedLabels >= requiredLabels;
    }
  );

  const {
    diagram_id,
    hotspots,
    label_options,
    svg_content = '' // Fallback for now - in production this would come from a domain pack
  } = params;

  // Get current labels state
  const currentLabels = answer?.value?.labels || {};
  const usedLabels = new Set(Object.values(currentLabels));
  const availableLabels = label_options.filter(label => !usedLabels.has(label));

  // Handle drag start
  const handleDragStart = useCallback((e: React.PointerEvent, label: string) => {
    if (disabled) return;

    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    setDragState({
      isDragging: true,
      draggedLabel: label,
      startPosition: { x: e.clientX - rect.left, y: e.clientY - rect.top },
      currentPosition: { x: e.clientX - rect.left, y: e.clientY - rect.top }
    });
  }, [disabled]);

  // Handle drag move
  const handleDragMove = useCallback((e: React.PointerEvent) => {
    if (!dragState.isDragging || disabled) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    setDragState(prev => ({
      ...prev,
      currentPosition: { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }));

    // Check if we're over a hotspot
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const hoveredSpot = hotspots.find(hotspot => {
      return x >= hotspot.x && 
             x <= hotspot.x + hotspot.width &&
             y >= hotspot.y && 
             y <= hotspot.y + hotspot.height;
    });

    setHoveredHotspot(hoveredSpot?.id || null);
  }, [dragState.isDragging, disabled, hotspots]);

  // Handle drag end
  const handleDragEnd = useCallback((e: React.PointerEvent) => {
    if (!dragState.isDragging || !dragState.draggedLabel || disabled) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Find the hotspot we're dropping on
    const targetHotspot = hotspots.find(hotspot => {
      return x >= hotspot.x && 
             x <= hotspot.x + hotspot.width &&
             y >= hotspot.y && 
             y <= hotspot.y + hotspot.height;
    });

    if (targetHotspot) {
      // Remove the label from its previous position (if any)
      const newLabels = { ...currentLabels };
      
      // Remove this label from any previous hotspot
      Object.keys(newLabels).forEach(hotspotId => {
        if (newLabels[hotspotId] === dragState.draggedLabel) {
          delete newLabels[hotspotId];
        }
      });

      // Add the label to the new hotspot
      newLabels[targetHotspot.id] = dragState.draggedLabel;

      updateAnswer({
        labels: newLabels,
        completed_hotspots: Object.keys(newLabels)
      });
    }

    // Reset drag state
    setDragState({
      isDragging: false,
      draggedLabel: null,
      startPosition: { x: 0, y: 0 },
      currentPosition: { x: 0, y: 0 }
    });
    setHoveredHotspot(null);
  }, [dragState, currentLabels, hotspots, disabled, updateAnswer]);

  // Handle removing a label from a hotspot
  const handleRemoveLabel = useCallback((hotspotId: string) => {
    if (disabled) return;

    const newLabels = { ...currentLabels };
    delete newLabels[hotspotId];

    updateAnswer({
      labels: newLabels,
      completed_hotspots: Object.keys(newLabels)
    });
  }, [currentLabels, disabled, updateAnswer]);

  // Sample SVG content for cell diagram (this would come from domain packs in production)
  const getSampleDiagram = () => {
    if (diagram_id === 'plant_cell') {
      return (
        <svg viewBox="0 0 400 300" className="w-full h-full">
          {/* Cell wall */}
          <rect x="20" y="20" width="360" height="260" 
                fill="none" stroke="#2D7D32" strokeWidth="3" rx="10" />
          
          {/* Cell membrane */}
          <rect x="30" y="30" width="340" height="240" 
                fill="#E8F5E8" stroke="#4CAF50" strokeWidth="2" rx="8" />
          
          {/* Nucleus */}
          <circle cx="200" cy="150" r="40" 
                  fill="#FFE0B2" stroke="#FF9800" strokeWidth="2" />
          
          {/* Chloroplasts */}
          <ellipse cx="120" cy="100" rx="25" ry="15" 
                   fill="#C8E6C9" stroke="#4CAF50" strokeWidth="1" />
          <ellipse cx="280" cy="200" rx="25" ry="15" 
                   fill="#C8E6C9" stroke="#4CAF50" strokeWidth="1" />
          
          {/* Vacuole */}
          <ellipse cx="300" cy="120" rx="50" ry="35" 
                   fill="#E3F2FD" stroke="#2196F3" strokeWidth="2" />
          
          {/* Mitochondria */}
          <ellipse cx="150" cy="220" rx="20" ry="12" 
                   fill="#FFCDD2" stroke="#F44336" strokeWidth="1" />
        </svg>
      );
    }
    
    return (
      <div className="w-full h-64 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
        <span className="text-gray-500">Diagram: {diagram_id}</span>
      </div>
    );
  };

  return (
    <div className="diagram-labeler-container">
      <div className="mb-4">
        <div className="text-sm font-medium text-gray-700 mb-2">
          Drag the labels to the correct parts of the diagram:
        </div>
        <div className="text-sm text-gray-600">
          Progress: {Object.keys(currentLabels).length} / {hotspots.length} labeled
        </div>
      </div>

      <div 
        ref={containerRef}
        className="relative bg-white border border-gray-300 rounded-lg p-4"
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
        style={{ touchAction: 'none' }}
      >
        {/* Diagram */}
        <div className="relative">
          {getSampleDiagram()}
          
          {/* Hotspots - invisible clickable areas */}
          {hotspots.map(hotspot => (
            <div
              key={hotspot.id}
              className={`absolute border-2 border-dashed transition-all ${
                hoveredHotspot === hotspot.id 
                  ? 'border-blue-400 bg-blue-100/30' 
                  : currentLabels[hotspot.id]
                    ? 'border-green-400 bg-green-100/30'
                    : 'border-transparent hover:border-gray-400 hover:bg-gray-100/20'
              }`}
              style={{
                left: hotspot.x,
                top: hotspot.y,
                width: hotspot.width,
                height: hotspot.height,
                borderRadius: '4px'
              }}
            >
              {/* Show placed label */}
              {currentLabels[hotspot.id] && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-green-600 text-white text-xs px-2 py-1 rounded shadow-lg relative">
                    {currentLabels[hotspot.id]}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveLabel(hotspot.id);
                      }}
                      disabled={disabled}
                      className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600 disabled:opacity-50"
                    >
                      ×
                    </button>
                  </div>
                </div>
              )}
              
              {/* Show hotspot indicator when dragging */}
              {dragState.isDragging && hoveredHotspot === hotspot.id && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-blue-500 text-white text-xs px-2 py-1 rounded shadow-lg">
                    Drop here
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Dragged label ghost */}
        {dragState.isDragging && dragState.draggedLabel && (
          <div
            className="absolute pointer-events-none z-50 bg-blue-600 text-white text-sm px-3 py-1 rounded shadow-lg opacity-80"
            style={{
              left: dragState.currentPosition.x - 20,
              top: dragState.currentPosition.y - 15,
              transform: 'translate(-50%, -50%)'
            }}
          >
            {dragState.draggedLabel}
          </div>
        )}
      </div>

      {/* Label bank */}
      <div className="mt-4">
        <div className="text-sm font-medium text-gray-700 mb-2">
          Available Labels:
        </div>
        <div className="flex flex-wrap gap-2">
          {availableLabels.map(label => (
            <div
              key={label}
              onPointerDown={(e) => handleDragStart(e, label)}
              className={`px-3 py-2 bg-blue-100 text-blue-800 rounded-lg border border-blue-200 text-sm font-medium select-none ${
                disabled 
                  ? 'opacity-50 cursor-not-allowed' 
                  : 'cursor-grab hover:bg-blue-200 active:cursor-grabbing'
              }`}
              style={{ touchAction: 'none' }}
            >
              {label}
            </div>
          ))}
          
          {/* Show used labels in different style */}
          {label_options.filter(label => usedLabels.has(label)).map(label => (
            <div
              key={`used-${label}`}
              className="px-3 py-2 bg-green-100 text-green-800 rounded-lg border border-green-200 text-sm font-medium opacity-60"
            >
              {label} ✓
            </div>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div className="mt-4 flex items-center justify-between">
        <div className="text-xs text-gray-500">
          {hotspots.length} parts to label
        </div>
        <div className="flex gap-2">
          {hasAnswer && (
            <button
              onClick={clearAnswer}
              disabled={disabled}
              className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Validation feedback */}
      {hasAnswer && !isValid && (
        <div className="mt-2 text-sm text-orange-600">
          Please label all {hotspots.length} parts of the diagram.
        </div>
      )}
      
      {hasAnswer && isValid && (
        <div className="mt-2 text-sm text-green-600">
          ✓ All parts labeled correctly!
        </div>
      )}
    </div>
  );
}