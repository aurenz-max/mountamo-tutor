'use client';

import React from 'react';

export interface GeometricShapeData {
  title: string;
  description: string;
  shapeName: string;
  attributes: { label: string; value: string }[];
}

interface GeometricShapeProps {
  data: GeometricShapeData;
  className?: string;
}

const GeometricShape: React.FC<GeometricShapeProps> = ({ data, className }) => {
  const shapeName = data.shapeName?.toLowerCase() || 'shape';
  const attrs = data.attributes || [];

  // Basic shape mapping to SVG paths
  let shapePath = "";
  const viewBox = "0 0 100 100";

  if (shapeName.includes('triangle')) shapePath = "50,10 90,90 10,90";
  else if (shapeName.includes('square')) shapePath = "10,10 90,10 90,90 10,90";
  else if (shapeName.includes('rectangle')) { shapePath = "5,25 95,25 95,75 5,75"; }
  else if (shapeName.includes('pentagon')) shapePath = "50,5 95,35 80,90 20,90 5,35";
  else if (shapeName.includes('hexagon')) shapePath = "25,5 75,5 95,50 75,95 25,95 5,50";
  else {
    // Fallback polygon (octagon)
    shapePath = "30,5 70,5 95,30 95,70 70,95 30,95 5,70 5,30";
  }

  return (
    <div className={`w-full max-w-5xl mx-auto my-16 animate-fade-in ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8 justify-center">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"></path>
          </svg>
        </div>
        <div className="text-left">
          <h2 className="text-2xl font-bold text-white tracking-tight">Geometric Shape</h2>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <p className="text-xs text-emerald-400 font-mono uppercase tracking-wider">Shape Properties</p>
          </div>
        </div>
      </div>

      <div className="glass-panel p-8 md:p-16 rounded-3xl border border-emerald-500/20 relative overflow-hidden flex flex-col items-center">
        {/* Background Texture */}
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(#10b981 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        ></div>

        <div className="relative z-10 w-full flex flex-col items-center">
          <div className="mb-12 text-center max-w-2xl">
            <h3 className="text-xl font-bold text-white mb-2">{data.title}</h3>
            <p className="text-slate-300 font-light">{data.description}</p>
          </div>

          {/* Geometric Shape Visualization */}
          <div className="flex flex-col md:flex-row items-center gap-12">
            <div className="w-64 h-64 relative drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">
              <svg viewBox={viewBox} className="w-full h-full stroke-blue-400 stroke-2 fill-blue-500/20 overflow-visible">
                {shapeName.includes('circle') ? (
                  <circle cx="50" cy="50" r="45" />
                ) : (
                  <polygon points={shapePath} />
                )}
                {/* Vertex dots */}
                {!shapeName.includes('circle') && shapePath.split(' ').map((point, i) => {
                  const [x, y] = point.split(',');
                  return <circle key={i} cx={x} cy={y} r="2" className="fill-white" />
                })}
              </svg>
            </div>
            <div className="bg-slate-800/50 p-6 rounded-xl border border-white/5 w-full max-w-sm">
              <h4 className="text-blue-300 font-bold uppercase tracking-widest mb-4 border-b border-white/5 pb-2">{shapeName}</h4>
              <div className="space-y-3">
                {attrs.map((attr, i) => (
                  <div key={i} className="flex justify-between items-center text-sm">
                    <span className="text-slate-400">{attr.label}</span>
                    <span className="text-white font-mono bg-white/5 px-2 py-0.5 rounded">{attr.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GeometricShape;
