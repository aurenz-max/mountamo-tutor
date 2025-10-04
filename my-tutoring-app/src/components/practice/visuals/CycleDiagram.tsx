'use client';

import React from 'react';
import { ArrowRight } from 'lucide-react';

interface Stage {
  name: string;
  icon?: string;
  description: string;
}

interface CycleDiagramData {
  stages: Stage[];
  arrangement?: 'circular' | 'linear';
}

interface CycleDiagramProps {
  data: CycleDiagramData;
  className?: string;
}

/**
 * CycleDiagram - Renders lifecycle or cyclical process diagrams
 * Used for butterfly life cycle, water cycle, rock cycle, etc.
 * Matches backend CYCLE_DIAGRAM_SCHEMA
 */
export const CycleDiagram: React.FC<CycleDiagramProps> = ({ data, className = '' }) => {
  const { stages = [], arrangement = 'circular' } = data;

  if (!stages || stages.length === 0) {
    return null;
  }

  if (arrangement === 'linear') {
    return (
      <div className={`flex items-center gap-2 flex-wrap ${className}`}>
        {stages.map((stage, index) => (
          <React.Fragment key={index}>
            <div className="flex flex-col items-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-300 rounded-lg min-w-[140px]">
              {stage.icon && (
                <div className="text-4xl mb-2" role="img" aria-label={stage.name}>
                  {stage.icon}
                </div>
              )}
              <h4 className="font-bold text-blue-900 text-sm mb-1">{stage.name}</h4>
              <p className="text-xs text-blue-700 text-center">{stage.description}</p>
            </div>
            {index < stages.length - 1 && (
              <ArrowRight className="text-blue-500 flex-shrink-0" size={24} />
            )}
          </React.Fragment>
        ))}
      </div>
    );
  }

  // Circular arrangement
  const angleStep = (2 * Math.PI) / stages.length;
  const radius = 120;
  const centerX = 150;
  const centerY = 150;

  return (
    <div className={`cycle-diagram ${className}`}>
      <svg width="300" height="300" viewBox="0 0 300 300" className="mx-auto">
        <defs>
          <marker
            id="arrowhead-cycle"
            markerWidth="10"
            markerHeight="10"
            refX="8"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 10 3, 0 6" fill="#3B82F6" />
          </marker>
        </defs>

        {/* Draw connecting arrows in a circle */}
        {stages.map((_, index) => {
          const angle1 = index * angleStep - Math.PI / 2;
          const angle2 = ((index + 1) % stages.length) * angleStep - Math.PI / 2;

          const x1 = centerX + radius * Math.cos(angle1);
          const y1 = centerY + radius * Math.sin(angle1);
          const x2 = centerX + radius * Math.cos(angle2);
          const y2 = centerY + radius * Math.sin(angle2);

          // Calculate control point for curved arrow
          const midAngle = (angle1 + angle2) / 2;
          const controlRadius = radius + 20;
          const cx = centerX + controlRadius * Math.cos(midAngle);
          const cy = centerY + controlRadius * Math.sin(midAngle);

          return (
            <path
              key={`arrow-${index}`}
              d={`M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`}
              fill="none"
              stroke="#3B82F6"
              strokeWidth="2"
              markerEnd="url(#arrowhead-cycle)"
            />
          );
        })}

        {/* Draw stage circles */}
        {stages.map((stage, index) => {
          const angle = index * angleStep - Math.PI / 2;
          const x = centerX + radius * Math.cos(angle);
          const y = centerY + radius * Math.sin(angle);

          return (
            <g key={index}>
              <circle
                cx={x}
                cy={y}
                r="35"
                fill="white"
                stroke="#3B82F6"
                strokeWidth="3"
              />
              <text
                x={x}
                y={y - 10}
                textAnchor="middle"
                className="font-bold text-xs"
                fill="#1E40AF"
              >
                {stage.icon || `${index + 1}`}
              </text>
              <text
                x={x}
                y={y + 5}
                textAnchor="middle"
                className="text-xs"
                fill="#1E40AF"
                fontSize="10"
              >
                {stage.name}
              </text>
            </g>
          );
        })}

        {/* Center label */}
        <text
          x={centerX}
          y={centerY}
          textAnchor="middle"
          className="text-sm font-bold"
          fill="#6B7280"
        >
          Cycle
        </text>
      </svg>

      {/* Stage descriptions below */}
      <div className="mt-4 space-y-2">
        {stages.map((stage, index) => (
          <div key={index} className="flex items-start gap-2 p-2 bg-blue-50 rounded border border-blue-200">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center font-bold">
              {index + 1}
            </div>
            <div className="flex-1">
              <h5 className="font-semibold text-sm text-blue-900">{stage.name}</h5>
              <p className="text-xs text-blue-700">{stage.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CycleDiagram;
