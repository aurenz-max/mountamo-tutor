import React from 'react';
import { Room } from '../types';

interface RoomDetailViewProps {
  room: Room;
}

export const RoomDetailView: React.FC<RoomDetailViewProps> = ({ room }) => {
  const padding = 10;
  // Room coordinates are 0-100 relative to room dimensions
  const viewBox = `-${padding} -${padding} ${100 + padding * 2} ${100 + padding * 2}`;

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-6">
      <div className="relative w-full aspect-square max-h-[600px] border-4 border-indigo-400 bg-indigo-900 shadow-[0_0_30px_rgba(79,70,229,0.3)] blueprint-grid overflow-hidden rounded-sm">
        
        {/* Title Block */}
        <div className="absolute top-4 right-4 bg-indigo-950/90 border-2 border-indigo-300 p-2 text-xs text-indigo-100 z-10 font-mono">
          <div className="border-b border-indigo-300/50 mb-1 pb-1 font-bold">ROOM: {room.name.toUpperCase()}</div>
          <div className="grid grid-cols-1 gap-x-4">
            <span>ITEMS: {room.interior?.length || 0}</span>
            <span>VIEW: INTERIOR</span>
          </div>
        </div>

        <svg viewBox={viewBox} className="w-full h-full text-white drop-shadow-md p-4">
          
          {/* Room Boundary */}
          <rect 
            x="0" 
            y="0" 
            width="100" 
            height="100" 
            fill="rgba(255,255,255,0.05)" 
            stroke="white" 
            strokeWidth="3" 
          />

          {/* Furniture */}
          {room.interior?.map((item, i) => {
             // Calculate top-left from center x,y
             const x = item.x - item.width / 2;
             const y = item.y - item.height / 2;
             
             return (
               <g key={item.id || i} transform={`rotate(${item.rotation || 0}, ${item.x}, ${item.y})`}>
                 {/* Furniture Base Shape */}
                 <rect
                   x={x}
                   y={y}
                   width={item.width}
                   height={item.height}
                   fill="rgba(255,255,255,0.2)"
                   stroke="white"
                   strokeWidth="1"
                   rx="1"
                 />
                 
                 {/* Furniture Details based on type */}
                 {item.type === 'bed' && (
                    <line x1={x} y1={y + item.height * 0.2} x2={x + item.width} y2={y + item.height * 0.2} stroke="white" strokeWidth="0.5" />
                 )}
                 {item.type === 'sofa' && (
                   <path d={`M${x},${y} v${item.height} h${item.width} v-${item.height}`} fill="none" stroke="white" strokeWidth="0.5" strokeDasharray="2,2"/>
                 )}
                 {item.type === 'table' && (
                   <circle cx={item.x} cy={item.y} r={Math.min(item.width, item.height)/4} stroke="white" strokeWidth="0.5" fill="none" />
                 )}
                 
                 {/* Label */}
                 <text 
                    x={item.x} 
                    y={item.y} 
                    fontSize="3" 
                    fill="white" 
                    textAnchor="middle" 
                    dominantBaseline="middle"
                    style={{ textShadow: '0px 0px 2px #000' }}
                 >
                   {item.name}
                 </text>
               </g>
             );
          })}
          
          {/* Fallback empty state */}
          {(!room.interior || room.interior.length === 0) && (
             <text x="50" y="50" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="5">NO FURNITURE LAYOUT</text>
          )}

        </svg>
      </div>
    </div>
  );
};