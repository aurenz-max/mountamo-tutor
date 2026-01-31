import React from 'react';
import { BuildingData } from '../types';

interface PlanViewProps {
  data: BuildingData;
  onRoomSelect?: (roomId: string) => void;
  selectedRoomId?: string | null;
}

export const PlanView: React.FC<PlanViewProps> = ({ data, onRoomSelect, selectedRoomId }) => {
  const { rooms, walls, totalWidthMeters, totalDepthMeters } = data;
  const padding = 10;
  const viewBox = `-${padding} -${padding} ${100 + padding * 2} ${100 + padding * 2}`;

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-6">
      <div className="relative w-full aspect-square max-h-[600px] border-4 border-white bg-blue-600 shadow-[0_0_30px_rgba(0,0,0,0.3)] blueprint-grid overflow-hidden rounded-sm">
        
        {/* Title Block */}
        <div className="absolute bottom-4 right-4 bg-blue-900/90 border-2 border-white p-2 text-xs text-white z-10 font-mono">
          <div className="border-b border-white/50 mb-1 pb-1 font-bold">PROJECT: {data.name.toUpperCase()}</div>
          <div className="grid grid-cols-2 gap-x-4">
            <span>WIDTH: {totalWidthMeters}m</span>
            <span>DEPTH: {totalDepthMeters}m</span>
            <span>SCALE: 1:100</span>
            <span>VIEW: PLAN</span>
          </div>
        </div>
        
        {/* Helper Hint */}
        <div className="absolute top-4 left-4 bg-black/40 backdrop-blur-sm border border-white/30 p-2 rounded text-[10px] text-white/80 z-10 font-mono">
          Click a room to design interior
        </div>

        <svg viewBox={viewBox} className="w-full h-full text-white drop-shadow-md">
           <defs>
            <pattern id="hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line stroke="#ffffff" strokeWidth="1" y2="4"/>
            </pattern>
          </defs>

          {/* Rooms Fills & Interactive Areas */}
          {rooms.map((room) => {
            const isSelected = selectedRoomId === room.id;
            return (
              <g 
                key={`room-group-${room.id}`} 
                onClick={() => onRoomSelect && onRoomSelect(room.id)}
                className="cursor-pointer transition-opacity hover:opacity-80"
              >
                <rect
                  x={room.x}
                  y={room.y}
                  width={room.width}
                  height={room.height}
                  fill={isSelected ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.1)"}
                  stroke={isSelected ? "#fbbf24" : "none"}
                  strokeWidth={isSelected ? "1" : "0"}
                />
                
                {/* Visual indicator for interior data */}
                {room.interior && room.interior.length > 0 && (
                  <circle cx={room.x + 2} cy={room.y + 2} r="1" fill="#4ade80" />
                )}
              </g>
            );
          })}

          {/* Walls */}
          {walls.map((wall, i) => (
            <line
              key={`wall-${i}`}
              x1={wall.x1}
              y1={wall.y1}
              x2={wall.x2}
              y2={wall.y2}
              stroke="white"
              strokeWidth={wall.type === 'outer' ? 2 : 1}
              strokeLinecap="square"
              pointerEvents="none"
            />
          ))}

          {/* Room Labels & Dimensions */}
          {rooms.map((room) => (
            <g key={`label-${room.id}`} pointerEvents="none">
               <text
                x={room.x + room.width / 2}
                y={room.y + room.height / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                className={`text-[3px] font-bold ${selectedRoomId === room.id ? 'fill-amber-300' : 'fill-white'}`}
                style={{ fontSize: '3px' }}
              >
                {room.name.toUpperCase()}
              </text>
              <text
                 x={room.x + room.width / 2}
                 y={room.y + room.height / 2 + 4}
                 textAnchor="middle"
                 dominantBaseline="middle"
                 className="fill-blue-200"
                 style={{ fontSize: '2px' }}
              >
                {((room.width / 100) * totalWidthMeters).toFixed(1)}m x {((room.height / 100) * totalDepthMeters).toFixed(1)}m
              </text>
            </g>
          ))}

          {/* Exterior Dimensions */}
          <line x1="0" y1="-5" x2="100" y2="-5" stroke="white" strokeWidth="0.5" markerEnd="url(#arrow)" markerStart="url(#arrow)" />
          <text x="50" y="-7" textAnchor="middle" fill="white" fontSize="3">{totalWidthMeters}m</text>
          <line x1="-5" y1="0" x2="-5" y2="100" stroke="white" strokeWidth="0.5" />
          <text x="-7" y="50" textAnchor="middle" fill="white" fontSize="3" transform="rotate(-90, -7, 50)">{totalDepthMeters}m</text>
        </svg>
      </div>
    </div>
  );
};