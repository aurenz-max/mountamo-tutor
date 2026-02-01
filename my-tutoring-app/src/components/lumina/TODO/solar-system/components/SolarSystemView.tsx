import React, { useRef, useEffect, useState, useMemo } from 'react';
import { CelestialBody, SimulationState } from '../types';
import * as d3 from 'd3';

interface SolarSystemViewProps {
  bodies: CelestialBody[];
  state: SimulationState;
  onBodyClick: (bodyId: string) => void;
}

export const SolarSystemView: React.FC<SolarSystemViewProps> = ({ bodies, state, onBodyClick }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [transform, setTransform] = useState({ k: 1, x: 0, y: 0 }); // Zoom/Pan state
  
  // Base scale: 1 AU = 200 pixels in un-zoomed view
  const AU_TO_PIXELS = 200;

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return;
    
    const updateSize = () => {
      if(containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // D3 Zoom Behavior
  useEffect(() => {
    if (!svgRef.current) return;

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 50]) // Min zoom 0.1x, Max zoom 50x
      .on('zoom', (event) => {
        setTransform(event.transform);
      });

    const svg = d3.select(svgRef.current);
    svg.call(zoom);
    
    // Initial center
    if (dimensions.width > 0) {
      const initialTransform = d3.zoomIdentity
        .translate(dimensions.width / 2, dimensions.height / 2)
        .scale(0.4); // Start zoomed out to see outer planets
      svg.call(zoom.transform, initialTransform);
    }
    
  }, [dimensions.width, dimensions.height]);


  // Helper to calculate position based on time
  const getPosition = (body: CelestialBody, date: Date) => {
    if (body.distanceAu === 0) return { x: 0, y: 0 }; // Sun

    // Simple circular orbit approximation
    // Period in ms
    const periodMs = body.orbitalPeriodDays * 24 * 60 * 60 * 1000;
    const time = date.getTime();
    
    // Angle in radians
    const angle = (time % periodMs) / periodMs * 2 * Math.PI;

    const r = body.distanceAu * AU_TO_PIXELS;
    return {
      x: r * Math.cos(angle),
      y: r * Math.sin(angle)
    };
  };

  // Determine visual radius of body
  const getVisualRadius = (body: CelestialBody) => {
    if (body.type === 'star') return state.viewMode === 'schematic' ? 40 : 20;
    
    if (state.viewMode === 'schematic') {
      // Logarithmic-ish scale for visibility
      return Math.log(body.radiusKm) * 1.5;
    } else {
      // "Realistic" scale - still exaggerated or you wouldn't see them at all
      // If 1 AU = 200px, Earth (radius 6371km) vs 1AU (150,000,000km) is tiny.
      // So even 'realistic' needs a boost for UI, but keeps relative sizes somewhat better.
      const scaleFactor = 0.0005; 
      return Math.max(2, body.radiusKm * scaleFactor); 
    }
  };

  return (
    <div ref={containerRef} className="w-full h-full bg-slate-950 relative overflow-hidden cursor-move">
      <StarBackground width={dimensions.width} height={dimensions.height} transform={transform} />
      
      <svg 
        ref={svgRef} 
        width={dimensions.width} 
        height={dimensions.height}
        className="absolute top-0 left-0"
      >
        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
          
          {/* Orbits */}
          {state.showOrbits && bodies.map(body => {
            if (body.distanceAu === 0) return null;
            return (
              <circle
                key={`orbit-${body.id}`}
                cx={0}
                cy={0}
                r={body.distanceAu * AU_TO_PIXELS}
                fill="none"
                stroke="rgba(255, 255, 255, 0.1)"
                strokeWidth={1 / transform.k} // Keep stroke width constant visually
              />
            );
          })}

          {/* Bodies */}
          {bodies.map(body => {
            const pos = getPosition(body, state.date);
            const r = getVisualRadius(body);
            const isSelected = state.selectedBodyId === body.id;

            return (
              <g 
                key={body.id} 
                transform={`translate(${pos.x}, ${pos.y})`}
                onClick={(e) => {
                  e.stopPropagation();
                  onBodyClick(body.id);
                }}
                style={{ cursor: 'pointer' }}
              >
                {/* Glow for Sun */}
                {body.type === 'star' && (
                  <circle r={r * 3} fill="url(#sunGlow)" opacity={0.5} />
                )}

                {/* Selection Indicator */}
                {isSelected && (
                  <circle 
                    r={r * 1.5 + 5} 
                    fill="none" 
                    stroke="white" 
                    strokeWidth={2 / transform.k} 
                    strokeDasharray="4 2"
                    className="animate-spin-slow"
                  />
                )}

                {/* The Body itself */}
                <circle
                  r={r}
                  fill={body.color}
                  stroke={isSelected ? 'white' : 'rgba(255,255,255,0.2)'}
                  strokeWidth={1 / transform.k}
                />
                
                {/* Gradient Overlay for 3D effect */}
                <circle r={r} fill={`url(#planetGradient-${body.id})`} opacity={0.8} />

                {/* Label (only show if zoomed in enough or schematic mode) */}
                {(transform.k > 0.6 || state.viewMode === 'schematic' || isSelected) && (
                  <text
                    y={r + 15 / transform.k}
                    textAnchor="middle"
                    fill="white"
                    fontSize={12 / transform.k}
                    className="select-none pointer-events-none font-sans font-medium drop-shadow-md"
                    style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}
                  >
                    {body.name}
                  </text>
                )}
              </g>
            );
          })}
        </g>
        
        {/* Definitions for gradients */}
        <defs>
          <radialGradient id="sunGlow">
            <stop offset="0%" stopColor="#FDB813" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#FDB813" stopOpacity="0" />
          </radialGradient>
          {bodies.map(body => (
             <radialGradient id={`planetGradient-${body.id}`} key={`grad-${body.id}`} cx="30%" cy="30%">
                <stop offset="0%" stopColor="white" stopOpacity="0.1" />
                <stop offset="80%" stopColor="black" stopOpacity="0.4" />
                <stop offset="100%" stopColor="black" stopOpacity="0.7" />
             </radialGradient>
          ))}
        </defs>
      </svg>
    </div>
  );
};

// Simple visual background
const StarBackground = ({ width, height, transform }: { width: number, height: number, transform: {x:number, y:number, k:number} }) => {
  // Generate static stars once
  const stars = useMemo(() => {
    const s = [];
    for(let i=0; i<300; i++) {
      s.push({
        x: Math.random() * 2000 - 1000,
        y: Math.random() * 2000 - 1000,
        r: Math.random() * 1.5,
        opacity: Math.random()
      });
    }
    return s;
  }, []);

  return (
    <svg 
        width={width} 
        height={height} 
        className="absolute top-0 left-0 pointer-events-none"
    >
       {/* Parallax effect: Move stars slightly slower than the foreground */}
       <g transform={`translate(${transform.x * 0.1 + width/2}, ${transform.y * 0.1 + height/2}) scale(${Math.max(0.5, transform.k * 0.1)})`}>
          {stars.map((star, i) => (
             <circle 
                key={i} 
                cx={star.x} 
                cy={star.y} 
                r={star.r} 
                fill="white" 
                opacity={star.opacity} 
             />
          ))}
       </g>
    </svg>
  );
};
