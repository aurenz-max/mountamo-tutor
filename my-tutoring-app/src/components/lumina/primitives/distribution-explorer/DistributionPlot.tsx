'use client';

import React from 'react';
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
} from 'recharts';
import type { EvaluatedDistribution } from './types';

interface DistributionPlotProps {
  evaluated: EvaluatedDistribution;
  /** When 'cdf', plots the cumulative function instead of the density. */
  view: 'pdf' | 'cdf';
  /** Optional title above the chart. */
  title?: string;
}

/**
 * Renders a discrete PMF as a bar chart and a continuous PDF as a line
 * chart. Same component handles CDF view — the engine produces a parallel
 * `cdf` array so we just swap the data source.
 */
export const DistributionPlot: React.FC<DistributionPlotProps> = ({ evaluated, view, title }) => {
  const yLabel = view === 'pdf'
    ? (evaluated.kind === 'discrete' ? 'P(X = x)' : 'f(x)')
    : 'F(x)';

  if (evaluated.kind === 'discrete') {
    const data = view === 'pdf'
      ? evaluated.pmf.map((d) => ({ x: d.x, y: d.p }))
      : evaluated.cdf.map((d) => ({ x: d.x, y: d.p }));

    return (
      <div className="w-full h-72">
        {title && <p className="text-xs text-slate-400 mb-1 text-center">{title}</p>}
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis
              dataKey="x"
              type="number"
              domain={['dataMin', 'dataMax']}
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              label={{ value: 'x', position: 'insideBottom', offset: -2, fill: '#94a3b8', fontSize: 11 }}
            />
            <YAxis
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              label={{ value: yLabel, angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 11 }}
              tickFormatter={(v) => v.toFixed(view === 'cdf' ? 2 : 3)}
            />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 6, fontSize: 12 }}
              labelStyle={{ color: '#cbd5e1' }}
              formatter={(v: number) => [v.toFixed(4), yLabel]}
              labelFormatter={(x) => `x = ${x}`}
            />
            <Bar dataKey="y" fill="#6366f1" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  const data = view === 'pdf'
    ? evaluated.pdf.map((d) => ({ x: d.x, y: d.density }))
    : evaluated.cdf.map((d) => ({ x: d.x, y: d.density }));

  return (
    <div className="w-full h-72">
      {title && <p className="text-xs text-slate-400 mb-1 text-center">{title}</p>}
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis
            dataKey="x"
            type="number"
            domain={['dataMin', 'dataMax']}
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            tickFormatter={(v: number) => v.toFixed(1)}
            label={{ value: 'x', position: 'insideBottom', offset: -2, fill: '#94a3b8', fontSize: 11 }}
          />
          <YAxis
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            label={{ value: yLabel, angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 11 }}
            tickFormatter={(v) => v.toFixed(view === 'cdf' ? 2 : 3)}
          />
          <Tooltip
            contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 6, fontSize: 12 }}
            labelStyle={{ color: '#cbd5e1' }}
            formatter={(v: number) => [v.toFixed(4), yLabel]}
            labelFormatter={(x: number) => `x = ${x.toFixed(2)}`}
          />
          <Line
            type="monotone"
            dataKey="y"
            stroke="#6366f1"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
