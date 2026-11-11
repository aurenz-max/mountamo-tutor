'use client';

import React from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import type { ChartInset } from '../../../types';
import { chartView } from '../../../service/insets/chartView';

interface ChartInsetRendererProps {
  data: ChartInset;
}

const COLORS = [
  '#60a5fa', '#34d399', '#fbbf24', '#f87171', '#a78bfa',
  '#2dd4bf', '#fb923c', '#e879f9',
];

/** Each line of a multi-series chart also has its own dash, so the lines can be told apart without color. */
const DASHES = [undefined, '7 4', '2 4', '10 4 2 4'];

const tooltipStyle = {
  backgroundColor: 'rgba(15, 23, 42, 0.95)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '8px',
  color: '#e2e8f0',
  fontSize: '0.8rem',
};

const legendStyle = { fontSize: '0.75rem', color: '#94a3b8' };

export const ChartInsetRenderer: React.FC<ChartInsetRendererProps> = ({ data }) => {
  const view = chartView(data);
  const multi = view.series.length > 1;
  const margin = { top: 5, right: 10, left: 0, bottom: 5 };
  const tick = { fill: '#94a3b8', fontSize: 11 };
  const axisLine = { stroke: 'rgba(255,255,255,0.1)' };
  const grid = <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />;
  const yAxis = (
    <YAxis tick={tick} axisLine={axisLine} label={data.yLabel ? { value: data.yLabel, angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 11 } : undefined} />
  );
  const tooltip = <Tooltip contentStyle={tooltipStyle} />;
  const legend = multi ? <Legend wrapperStyle={legendStyle} /> : null;

  return (
    <div>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
        {data.title}
      </p>
      <div className="w-full h-52">
        <ResponsiveContainer width="100%" height="100%">
          {data.chartType === 'bar' ? (
            <BarChart data={view.rows} margin={margin}>
              {grid}
              <XAxis dataKey="name" tick={tick} axisLine={axisLine} />
              {yAxis}
              {tooltip}
              {legend}
              {view.series.map((name, s) => (
                <Bar key={s} dataKey={`s${s}`} name={name} radius={[4, 4, 0, 0]} fill={COLORS[s % COLORS.length]} fillOpacity={0.85}>
                  {!multi && view.rows.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.85} />
                  ))}
                </Bar>
              ))}
            </BarChart>
          ) : data.chartType === 'line' ? (
            <LineChart data={view.rows} margin={margin}>
              {grid}
              {view.numericX ? (
                <XAxis
                  dataKey="x"
                  type="number"
                  scale="linear"
                  domain={['dataMin', 'dataMax']}
                  ticks={view.rows.map(r => r.x as number)}
                  padding={{ left: 16, right: 16 }}
                  tick={tick}
                  axisLine={axisLine}
                />
              ) : (
                <XAxis dataKey="name" tick={tick} axisLine={axisLine} />
              )}
              {yAxis}
              {tooltip}
              {legend}
              {view.series.map((name, s) => {
                const color = COLORS[s % COLORS.length];
                return (
                  <Line
                    key={s}
                    type="monotone"
                    dataKey={`s${s}`}
                    name={name}
                    connectNulls
                    stroke={color}
                    strokeWidth={2}
                    strokeDasharray={multi ? DASHES[s % DASHES.length] : undefined}
                    dot={{ fill: color, r: 4 }}
                    activeDot={{ r: 6, fill: color }}
                  />
                );
              })}
            </LineChart>
          ) : (
            <PieChart>
              <Pie data={view.rows} cx="50%" cy="50%" outerRadius={80} dataKey="s0" nameKey="name" label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`} labelLine={{ stroke: 'rgba(255,255,255,0.2)' }} fontSize={11}>
                {view.rows.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.85} />
                ))}
              </Pie>
              {tooltip}
              <Legend wrapperStyle={legendStyle} />
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>
      {data.xLabel && data.chartType !== 'pie' && (
        <p className="text-[10px] text-slate-500 text-center mt-1">{data.xLabel}</p>
      )}
    </div>
  );
};
