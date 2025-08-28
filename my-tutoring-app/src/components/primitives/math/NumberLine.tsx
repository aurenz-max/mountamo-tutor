import React, { useState, useRef, useCallback, useEffect } from 'react';
import { usePrimitive } from '../core/PrimitiveBase';
import { NumberLineProps } from '../core/PrimitiveTypes';

interface NumberLineAnswer {
  selected_value: number;
  position_x: number;
}

export function NumberLine({
  id,
  params,
  disabled = false,
  onChange,
  initialAnswer
}: NumberLineProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragValue, setDragValue] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const {
    answer,
    updateAnswer,
    clearAnswer,
    isValid,
    hasAnswer
  } = usePrimitive<NumberLineAnswer>(
    id,
    initialAnswer,
    onChange,
    (answer) => answer?.value?.selected_value !== undefined && answer?.value?.selected_value !== null
  );

  const {
    min,
    max,
    step,
    tick_density = 'normal',
    target_value,
    show_labels = true,
    highlight_zones = []
  } = params;

  // Calculate dimensions and positions
  const width = 600;
  const height = 120;
  const lineY = height / 2;
  const padding = 40;
  const lineWidth = width - (padding * 2);
  const range = max - min;

  // Calculate tick positions based on density
  const getTickPositions = () => {
    const ticks: Array<{ value: number; x: number; isMain: boolean }> = [];
    let tickStep = step;

    if (tick_density === 'sparse') {
      tickStep = step * 4;
    } else if (tick_density === 'dense') {
      tickStep = step / 2;
    }

    for (let value = min; value <= max; value += tickStep) {
      const x = padding + ((value - min) / range) * lineWidth;
      const isMain = value % step === 0;
      ticks.push({ value, x, isMain });
    }

    return ticks;
  };

  const ticks = getTickPositions();

  // Convert value to x coordinate
  const valueToX = (value: number): number => {
    return padding + ((value - min) / range) * lineWidth;
  };

  // Convert x coordinate to value
  const xToValue = (x: number): number => {
    const relativeX = x - padding;
    const value = (relativeX / lineWidth) * range + min;
    
    // Snap to nearest step
    const snappedValue = Math.round(value / step) * step;
    return Math.max(min, Math.min(max, snappedValue));
  };

  // Handle mouse/touch interactions
  const handlePointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (disabled) return;

    setIsDragging(true);
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const value = xToValue(x);
    setDragValue(value);
    updateAnswer({ selected_value: value, position_x: valueToX(value) });
  }, [disabled, updateAnswer]);

  const handlePointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDragging || disabled) return;

    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const value = xToValue(x);
    setDragValue(value);
    updateAnswer({ selected_value: value, position_x: valueToX(value) });
  }, [isDragging, disabled, updateAnswer]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Initialize from existing answer
  useEffect(() => {
    if (answer?.value?.selected_value !== undefined) {
      setDragValue(answer.value.selected_value);
    }
  }, [answer]);

  // Get current marker position
  const getCurrentValue = (): number | null => {
    if (answer?.value?.selected_value !== undefined) {
      return answer.value.selected_value;
    }
    if (dragValue !== null) {
      return dragValue;
    }
    if (target_value !== undefined) {
      return target_value;
    }
    return null;
  };

  const currentValue = getCurrentValue();
  const markerX = currentValue !== null ? valueToX(currentValue) : null;

  return (
    <div className="number-line-container">
      <div className="mb-4">
        <div className="text-sm font-medium text-gray-700 mb-2">
          Select a value on the number line:
        </div>
        {currentValue !== null && (
          <div className="text-lg font-bold text-blue-600">
            Selected: {currentValue}
          </div>
        )}
      </div>

      <svg
        ref={svgRef}
        width={width}
        height={height}
        className={`border border-gray-300 rounded-lg bg-white ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{ touchAction: 'none' }}
      >
        {/* Highlight zones */}
        {highlight_zones.map((zone, idx) => {
          const startX = valueToX(Math.max(zone.start, min));
          const endX = valueToX(Math.min(zone.end, max));
          const zoneWidth = endX - startX;
          
          return (
            <rect
              key={idx}
              x={startX}
              y={lineY - 8}
              width={zoneWidth}
              height={16}
              fill={zone.color}
              opacity={0.3}
              rx={2}
            />
          );
        })}

        {/* Main number line */}
        <line
          x1={padding}
          y1={lineY}
          x2={width - padding}
          y2={lineY}
          stroke="#374151"
          strokeWidth={2}
          markerEnd="url(#arrowhead)"
        />

        {/* Arrow head definition */}
        <defs>
          <marker
            id="arrowhead"
            markerWidth={10}
            markerHeight={7}
            refX={9}
            refY={3.5}
            orient="auto"
          >
            <polygon
              points="0 0, 10 3.5, 0 7"
              fill="#374151"
            />
          </marker>
        </defs>

        {/* Ticks and labels */}
        {ticks.map(({ value, x, isMain }, idx) => (
          <g key={idx}>
            <line
              x1={x}
              y1={lineY - (isMain ? 8 : 4)}
              x2={x}
              y2={lineY + (isMain ? 8 : 4)}
              stroke="#374151"
              strokeWidth={isMain ? 2 : 1}
            />
            {show_labels && isMain && (
              <text
                x={x}
                y={lineY + 25}
                textAnchor="middle"
                className="text-sm font-medium fill-gray-700"
              >
                {value}
              </text>
            )}
          </g>
        ))}

        {/* Selected value marker */}
        {markerX !== null && (
          <g>
            {/* Vertical line from marker to number line */}
            <line
              x1={markerX}
              y1={lineY - 20}
              x2={markerX}
              y2={lineY + 20}
              stroke="#3B82F6"
              strokeWidth={2}
              strokeDasharray="4,2"
            />
            
            {/* Marker circle */}
            <circle
              cx={markerX}
              cy={lineY - 25}
              r={8}
              fill="#3B82F6"
              stroke="white"
              strokeWidth={2}
              className={isDragging ? 'opacity-80' : ''}
            />
            
            {/* Value label above marker */}
            <rect
              x={markerX - 20}
              y={lineY - 50}
              width={40}
              height={20}
              fill="#3B82F6"
              rx={4}
            />
            <text
              x={markerX}
              y={lineY - 37}
              textAnchor="middle"
              className="text-sm font-bold fill-white"
            >
              {currentValue}
            </text>
          </g>
        )}
      </svg>

      {/* Action buttons */}
      <div className="mt-4 flex items-center justify-between">
        <div className="text-xs text-gray-500">
          Range: {min} to {max} • Step: {step}
        </div>
        <div className="flex gap-2">
          {hasAnswer && (
            <button
              onClick={clearAnswer}
              disabled={disabled}
              className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Validation feedback */}
      {hasAnswer && !isValid && (
        <div className="mt-2 text-sm text-red-600">
          Please select a value on the number line.
        </div>
      )}
      
      {hasAnswer && isValid && (
        <div className="mt-2 text-sm text-green-600">
          ✓ Value selected: {currentValue}
        </div>
      )}
    </div>
  );
}