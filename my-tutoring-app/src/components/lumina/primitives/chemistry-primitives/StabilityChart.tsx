import React from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { ChemicalElement } from './types';

interface StabilityChartProps {
  currentElement: ChemicalElement;
  allElements: ChemicalElement[];
}

export const StabilityChart: React.FC<StabilityChartProps> = ({ currentElement, allElements }) => {
  const data = allElements.map(el => {
    const neutrons = Math.round(el.atomic_mass - el.number);
    return {
      z: el.number,
      n: neutrons,
      symbol: el.symbol,
      name: el.name,
      isCurrent: el.number === currentElement.number
    };
  });

  const domainMax = 120;
  const rangeMax = 180;

  return (
    <div className="w-full h-64 bg-slate-900/50 rounded-xl border border-white/5 backdrop-blur-sm p-4 flex flex-col">
      <h3 className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
        Band of Stability (Neutrons vs Protons)
      </h3>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
          <XAxis
            type="number"
            dataKey="z"
            name="Protons"
            domain={[0, domainMax]}
            stroke="#475569"
            tick={{fontSize: 10}}
            label={{ value: 'Protons (Z)', position: 'insideBottom', offset: -5, fill: '#94a3b8', fontSize: 10 }}
          />
          <YAxis
            type="number"
            dataKey="n"
            name="Neutrons"
            domain={[0, rangeMax]}
            stroke="#475569"
            tick={{fontSize: 10}}
            label={{ value: 'Neutrons (N)', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 10 }}
          />
          <Tooltip
            cursor={{ strokeDasharray: '3 3' }}
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const d = payload[0].payload;
                return (
                  <div className="bg-slate-800 border border-slate-700 p-2 rounded shadow-xl text-xs">
                    <p className="font-bold text-white">{d.name} ({d.symbol})</p>
                    <p className="text-slate-400">Protons: {d.z}</p>
                    <p className="text-slate-400">Neutrons: {d.n}</p>
                  </div>
                );
              }
              return null;
            }}
          />
          <ReferenceLine
            segment={[{ x: 0, y: 0 }, { x: 80, y: 80 }]}
            stroke="#334155"
            strokeDasharray="5 5"
            label={{ value: "N=Z", fill: "#475569", fontSize: 10, position: 'insideTopRight' }}
          />

          <Scatter name="Stable Isotopes" data={data} fill="#8884d8">
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.isCurrent ? '#fff' : (entry.n / entry.z > 1.5 ? '#f43f5e' : '#3b82f6')}
                stroke={entry.isCurrent ? '#ec4899' : 'none'}
                strokeWidth={entry.isCurrent ? 2 : 0}
                r={entry.isCurrent ? 6 : 2}
                className={entry.isCurrent ? 'animate-pulse' : ''}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
};
