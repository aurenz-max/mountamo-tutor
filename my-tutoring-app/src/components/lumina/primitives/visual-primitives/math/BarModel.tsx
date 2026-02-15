'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { useLuminaAI } from '../../../hooks/useLuminaAI';

export interface BarModelData {
  title: string;
  description: string;
  values: { label: string; value: number; color?: string }[];

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
}

interface BarModelProps {
  data: BarModelData;
  className?: string;
}

const BarModel: React.FC<BarModelProps> = ({ data, className }) => {
  const maxVal = Math.max(...data.values.map(i => i.value));
  const resolvedInstanceId = data.instanceId ?? 'bar-model-default';

  // ---- AI Tutoring Context ----
  const aiPrimitiveData = useMemo(() => ({
    values: data.values.map(v => `${v.label}: ${v.value}`).join(', '),
    value1: data.values[0]?.value,
    value2: data.values[1]?.value,
    barCount: data.values.length,
    title: data.title,
  }), [data.values, data.title]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'bar-model',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: 'K-5',
  });

  // ---- Pedagogical Moment: Activity Start ----
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current || data.values.length === 0) return;
    hasIntroducedRef.current = true;

    const labels = data.values.map(v => `${v.label} (${v.value})`).join(', ');
    sendText(
      `[ACTIVITY_START] A bar model is showing: ${data.title}. `
      + `Bars: ${labels}. `
      + `Introduce the comparison warmly. Ask the student which bar is tallest `
      + `and what that tells us. Use comparison language coaching.`,
      { silent: true }
    );
  }, [isConnected, data.values, data.title, sendText]);

  return (
    <div className={`w-full max-w-5xl mx-auto my-16 animate-fade-in ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8 justify-center">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
          </svg>
        </div>
        <div className="text-left">
          <h2 className="text-2xl font-bold text-white tracking-tight">Bar Model</h2>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <p className="text-xs text-emerald-400 font-mono uppercase tracking-wider">Comparative Visualization</p>
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

          {/* Bar Model Visualization */}
          <div className="w-full max-w-lg space-y-4">
            {data.values.map((item, i) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between text-xs font-mono text-slate-400">
                  <span>{item.label}</span>
                  <span>{item.value}</span>
                </div>
                <div className="h-10 bg-slate-800 rounded-lg overflow-hidden border border-white/5 relative group">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 relative transition-all duration-1000 ease-out"
                    style={{
                      width: `${(item.value / maxVal) * 100}%`,
                      backgroundColor: item.color
                    }}
                  >
                    <div className="absolute right-0 top-0 h-full w-1 bg-white/20"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BarModel;
