'use client';

import React from 'react';

interface ThermometerData {
  min: number;
  max: number;
  unit: '°F' | '°C';
  currentValue: number;
  markers?: number[];
  markerLabels?: string[];
}

interface ThermometerProps {
  data: ThermometerData;
  className?: string;
}

/**
 * Thermometer - Renders a thermometer scale with current reading
 * Used for temperature, measurements, scales
 * Matches backend THERMOMETER_SCHEMA
 */
export const Thermometer: React.FC<ThermometerProps> = ({ data, className = '' }) => {
  const {
    min,
    max,
    unit,
    currentValue,
    markers = [],
    markerLabels = []
  } = data;

  if (min === undefined || max === undefined || currentValue === undefined) {
    return null;
  }

  const range = max - min;
  const fillPercent = Math.min(100, Math.max(0, ((currentValue - min) / range) * 100));

  // Determine color based on temperature
  const getColor = () => {
    if (unit === '°F') {
      if (currentValue <= 32) return '#3B82F6'; // Blue - freezing
      if (currentValue >= 90) return '#EF4444'; // Red - hot
      return '#F97316'; // Orange - warm
    } else {
      // Celsius
      if (currentValue <= 0) return '#3B82F6'; // Blue - freezing
      if (currentValue >= 32) return '#EF4444'; // Red - hot
      return '#F97316'; // Orange - warm
    }
  };

  const color = getColor();

  return (
    <div className={`thermometer flex items-center gap-6 ${className}`}>
      {/* Thermometer visual */}
      <div className="flex flex-col items-center">
        {/* Scale tube */}
        <div className="relative w-16 h-64 bg-gray-200 rounded-full border-2 border-gray-300 overflow-hidden">
          {/* Mercury/filling */}
          <div
            className="absolute bottom-0 w-full transition-all duration-500 ease-out rounded-full"
            style={{
              height: `${fillPercent}%`,
              backgroundColor: color
            }}
          />

          {/* Tick marks */}
          <div className="absolute inset-0 flex flex-col justify-between py-2">
            {Array.from({ length: 5 }).map((_, i) => {
              const value = min + (i / 4) * range;
              return (
                <div key={i} className="relative flex items-center">
                  <div className="w-3 h-0.5 bg-gray-600 ml-1" />
                  <span className="absolute left-5 text-xs font-medium text-gray-700 bg-white px-1 rounded">
                    {Math.round(value)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bulb at bottom */}
        <div
          className="w-12 h-12 rounded-full border-2 border-gray-300 -mt-4 flex items-center justify-center font-bold text-white text-sm"
          style={{ backgroundColor: color }}
        >
          {Math.round(currentValue)}
          {unit}
        </div>
      </div>

      {/* Labels and markers */}
      <div className="flex-1 space-y-3">
        {/* Current reading */}
        <div className="p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg border-2 border-blue-300">
          <p className="text-xs text-blue-700 font-medium">Current Temperature</p>
          <p className="text-3xl font-bold text-blue-900">
            {currentValue}{unit}
          </p>
        </div>

        {/* Range info */}
        <div className="p-3 bg-gray-50 rounded border border-gray-300">
          <p className="text-xs text-gray-600">
            <strong>Range:</strong> {min}{unit} to {max}{unit}
          </p>
        </div>

        {/* Important markers */}
        {markers.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-700">Important Points:</p>
            {markers.map((marker, i) => (
              <div key={i} className="flex items-center gap-2 p-2 bg-yellow-50 rounded border border-yellow-300">
                <div className="w-6 h-6 rounded-full bg-yellow-400 flex items-center justify-center text-xs font-bold text-yellow-900">
                  {i + 1}
                </div>
                <div className="flex-1">
                  <span className="font-semibold text-sm text-gray-800">
                    {marker}{unit}
                  </span>
                  {markerLabels[i] && (
                    <span className="text-xs text-gray-600 ml-2">
                      - {markerLabels[i]}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Thermometer;
