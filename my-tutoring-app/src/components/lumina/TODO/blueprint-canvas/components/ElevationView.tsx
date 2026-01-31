import React from 'react';
import { BuildingData } from '../types';

interface ElevationViewProps {
  data: BuildingData;
}

export const ElevationView: React.FC<ElevationViewProps> = ({ data }) => {
  const { elevation, totalWidthMeters, totalHeightMeters } = data;
  
  const padding = 20;
  // Viewbox: X: -padding to 100+padding, Y: -height-padding to padding (since Y goes down in SVG, we build up from 0)
  // Let's normalize coordinate system where Bottom Left is 0,100 visually.
  
  // We will map 0-100 to the facade width.
  // The height needs to be calculated proportional to the width in meters.
  
  const aspectRatio = totalHeightMeters / totalWidthMeters;
  const normalizedHeight = 100 * aspectRatio;
  const roofHeightNormalized = (elevation.roof.height / 100) * normalizedHeight;
  const buildingBodyHeight = normalizedHeight - roofHeightNormalized;

  // Viewbox setup
  const viewBoxHeight = normalizedHeight + 40;
  const viewBox = `-10 -${viewBoxHeight - 20} 120 ${viewBoxHeight}`;

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-6">
      <div className="relative w-full aspect-square max-h-[600px] border-4 border-white bg-blue-600 shadow-[0_0_30px_rgba(0,0,0,0.3)] blueprint-grid overflow-hidden rounded-sm">
        
         {/* Title Block */}
         <div className="absolute top-4 right-4 bg-blue-900/90 border-2 border-white p-2 text-xs text-white z-10 font-mono">
          <div className="border-b border-white/50 mb-1 pb-1 font-bold">PROJECT: {data.name.toUpperCase()}</div>
          <div className="grid grid-cols-2 gap-x-4">
             <span>HEIGHT: {totalHeightMeters}m</span>
             <span>ROOF: {elevation.roof.type.toUpperCase()}</span>
             <span>SCALE: 1:100</span>
             <span>VIEW: ELEVATION</span>
          </div>
        </div>

        <svg viewBox={viewBox} className="w-full h-full text-white drop-shadow-md p-4">
          {/* Ground Line */}
          <line x1="-20" y1="0" x2="120" y2="0" stroke="white" strokeWidth="2" />

          {/* Building Body */}
          <rect 
            x="0" 
            y={-buildingBodyHeight} 
            width="100" 
            height={buildingBodyHeight} 
            fill="none" 
            stroke="white" 
            strokeWidth="2" 
          />

          {/* Roof */}
          {elevation.roof.type === 'gable' && (
            <path d={`M0,-${buildingBodyHeight} L50,-${normalizedHeight} L100,-${buildingBodyHeight}`} fill="none" stroke="white" strokeWidth="2" />
          )}
          {elevation.roof.type === 'flat' && (
            <rect x="-2" y={-normalizedHeight} width="104" height={roofHeightNormalized} fill="none" stroke="white" strokeWidth="2" />
          )}
          {elevation.roof.type === 'shed' && (
             <path d={`M0,-${buildingBodyHeight} L100,-${normalizedHeight} L100,-${buildingBodyHeight}`} fill="none" stroke="white" strokeWidth="2" />
          )}

          {/* Features (Windows/Doors) */}
          {elevation.features.map((feature, i) => {
             // In our data, y is 0-100 from bottom. 
             // We need to map this to SVG Y.
             // feature.y is % of total height from bottom.
             const featY = -((feature.y / 100) * normalizedHeight);
             const featH = (feature.height / 100) * normalizedHeight;
             const featW = feature.width; // Already 0-100 relative to width

             return (
               <g key={i}>
                 <rect
                   x={feature.x}
                   y={featY - featH} // SVG draws down, so we subtract height from bottom-y
                   width={featW}
                   height={featH}
                   fill="rgba(255,255,255,0.1)"
                   stroke="white"
                   strokeWidth="1"
                 />
                 {/* Detail lines inside features */}
                 {feature.type === 'window' && (
                    <>
                      <line x1={feature.x + featW/2} y1={featY - featH} x2={feature.x + featW/2} y2={featY} stroke="white" strokeWidth="0.5" />
                      <line x1={feature.x} y1={featY - featH/2} x2={feature.x + featW} y2={featY - featH/2} stroke="white" strokeWidth="0.5" />
                    </>
                 )}
                 {feature.type === 'door' && (
                    <circle cx={feature.x + featW * 0.8} cy={featY - featH * 0.5} r={1} fill="white" />
                 )}
               </g>
             );
          })}

           {/* Dimensions */}
           <line x1="-5" y1="0" x2="-5" y2={-normalizedHeight} stroke="white" strokeWidth="0.5" />
           <text x="-8" y={-normalizedHeight/2} textAnchor="middle" fill="white" fontSize="3" transform={`rotate(-90, -8, ${-normalizedHeight/2})`}>{totalHeightMeters}m</text>

        </svg>
      </div>
    </div>
  );
};