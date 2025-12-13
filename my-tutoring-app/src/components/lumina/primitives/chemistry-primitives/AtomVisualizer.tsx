import React from 'react';

interface AtomVisualizerProps {
  symbol: string;
  atomicNumber: number;
  shells: number[];
  category: string;
}

// Map category to a core color
const getCategoryHex = (category: string) => {
   if (category.includes('alkali') && !category.includes('earth')) return '#ef4444'; // red
   if (category.includes('alkaline earth')) return '#f97316'; // orange
   if (category.includes('transition')) return '#eab308'; // yellow
   if (category.includes('noble')) return '#a855f7'; // purple
   return '#3b82f6'; // blue default
};

export const AtomVisualizer: React.FC<AtomVisualizerProps> = ({ symbol, atomicNumber, shells, category }) => {
  const coreColor = getCategoryHex(category);

  return (
    <div className="relative w-full aspect-square flex items-center justify-center overflow-hidden bg-slate-900/50 rounded-xl border border-white/5 backdrop-blur-sm">
      {/* Background Glow */}
      <div
        className="absolute w-1/2 h-1/2 rounded-full blur-[60px] opacity-20"
        style={{ backgroundColor: coreColor }}
      />

      <svg viewBox="-150 -150 300 300" className="w-full h-full p-4">
        {/* Nucleus */}
        <circle cx="0" cy="0" r="12" fill={coreColor} className="animate-pulse-fast">
          <title>Nucleus: {atomicNumber} Protons</title>
        </circle>
        <text
          x="0" y="2"
          textAnchor="middle"
          alignmentBaseline="middle"
          fill="white"
          fontSize="10"
          fontWeight="bold"
          className="pointer-events-none"
        >
          {symbol}
        </text>

        {/* Electron Shells */}
        {shells.map((electronCount, shellIndex) => {
          const radius = 30 + (shellIndex * 18);
          const speed = 3 + shellIndex * 2;

          return (
            <g key={shellIndex} className="origin-center" style={{ animation: `spin ${speed}s linear infinite` }}>
               {/* Orbit Ring */}
              <circle
                cx="0"
                cy="0"
                r={radius}
                fill="none"
                stroke="rgba(255,255,255,0.15)"
                strokeWidth="1"
                strokeDasharray="4 4"
              />

              {/* Electrons */}
              {Array.from({ length: electronCount }).map((_, electronIndex) => {
                // Distribute electrons evenly
                const angle = (electronIndex / electronCount) * 2 * Math.PI;
                const ex = radius * Math.cos(angle);
                const ey = radius * Math.sin(angle);

                return (
                  <circle
                    key={electronIndex}
                    cx={ex}
                    cy={ey}
                    r="3"
                    fill={coreColor}
                    className="shadow-[0_0_5px_currentColor]"
                  />
                );
              })}
            </g>
          );
        })}
      </svg>

      <div className="absolute bottom-2 right-2 text-xs text-slate-400 font-mono">
         Bohr Model
      </div>
    </div>
  );
};
