/**
 * The display kit: the components a generated display composes from, as TSX source compiled once
 * by sucrase and inlined into every display page. It runs inside the sandboxed iframe, so it uses
 * only React and the DOM. Every control registers itself in `__lumina.controls` by label, which is
 * how the harness drives a display (probes) and why a display should build its controls from the kit.
 *
 * Source is a String.raw literal: no backticks and no dollar-brace in it.
 */
export const SDK_SOURCE = String.raw`
const PALETTE = { cyan: '#22d3ee', amber: '#fbbf24', emerald: '#34d399', pink: '#f472b6', indigo: '#818cf8', rose: '#fb7185', slate: '#94a3b8', white: '#f1f5f9' };
const colorOf = (c, i) => PALETTE[c] || c || Object.values(PALETTE)[(i || 0) % 6];
const fmt = (v, digits) => (typeof v === 'number' ? Number(v.toFixed(digits == null ? 2 : digits)).toString() : String(v));

function useControl(label, entry) {
  React.useEffect(() => {
    window.__lumina.controls[label] = entry;
    return () => { delete window.__lumina.controls[label]; };
  });
}

function Panel({ title, caption, children }) {
  return (
    <div className="lx-panel">
      {title && <div className="lx-title">{title}</div>}
      {caption && <div className="lx-caption">{caption}</div>}
      <div className="lx-body">{children}</div>
    </div>
  );
}

function Row({ children, gap }) { return <div className="lx-row" style={{ gap: gap == null ? 16 : gap }}>{children}</div>; }
function Stack({ children, gap }) { return <div className="lx-stack" style={{ gap: gap == null ? 12 : gap }}>{children}</div>; }
function Text({ children, tone }) { return <p className={'lx-text' + (tone ? ' lx-' + tone : '')}>{children}</p>; }

function Slider({ label, min, max, step, value, onChange, unit, digits }) {
  const clamp = (v) => Math.min(max, Math.max(min, Number(v)));
  useControl(label, { kind: 'slider', min, max, set: (v) => onChange(clamp(v)) });
  return (
    <label className="lx-slider">
      <span className="lx-slider-head"><span>{label}</span><b>{fmt(value, digits)}{unit ? ' ' + unit : ''}</b></span>
      <input type="range" min={min} max={max} step={step || 1} value={value} aria-label={label}
        onChange={(e) => onChange(clamp(e.target.value))} />
    </label>
  );
}

function Choice({ label, options, value, onChange }) {
  useControl(label, { kind: 'choice', options, set: (v) => onChange(v) });
  return (
    <div className="lx-choice" role="group" aria-label={label}>
      {label && <span className="lx-choice-label">{label}</span>}
      <div className="lx-choice-row">
        {options.map((o) => (
          <button key={String(o)} type="button" className={'lx-btn' + (o === value ? ' lx-on' : '')} onClick={() => onChange(o)}>{String(o)}</button>
        ))}
      </div>
    </div>
  );
}

function Button({ label, onClick }) {
  useControl(label, { kind: 'button', set: () => onClick() });
  return <button type="button" className="lx-btn lx-primary" onClick={onClick}>{label}</button>;
}

function Readout({ label, value, unit, digits, color }) {
  return (
    <div className="lx-readout">
      <span>{label}</span>
      <b style={{ color: colorOf(color, 0) }}>{fmt(value, digits)}{unit ? ' ' + unit : ''}</b>
    </div>
  );
}

/** Coordinate plane: lines (slope, intercept), functions (fn: x => y), points, and shaded vertical bands. */
function Plane({ xMin, xMax, yMin, yMax, lines, functions, points, xLabel, yLabel, width, height }) {
  const W = width || 420, H = height || 320, P = 28;
  const sx = (x) => P + ((x - xMin) / (xMax - xMin)) * (W - 2 * P);
  const sy = (y) => H - P - ((y - yMin) / (yMax - yMin)) * (H - 2 * P);
  const ticks = (a, b) => { const span = b - a; const step = span > 40 ? 10 : span > 16 ? 5 : span > 8 ? 2 : 1; const out = []; for (let t = Math.ceil(a / step) * step; t <= b; t += step) out.push(t); return out; };
  const curve = (fn) => { const pts = []; for (let i = 0; i <= 200; i++) { const x = xMin + ((xMax - xMin) * i) / 200; const y = fn(x); if (Number.isFinite(y) && y >= yMin - (yMax - yMin) && y <= yMax + (yMax - yMin)) pts.push(sx(x).toFixed(1) + ',' + sy(y).toFixed(1)); } return pts.join(' '); };
  return (
    <svg className="lx-plane" viewBox={'0 0 ' + W + ' ' + H} role="img" aria-label="coordinate plane">
      <defs><clipPath id="lx-clip"><rect x={P} y={P} width={W - 2 * P} height={H - 2 * P} /></clipPath></defs>
      {ticks(xMin, xMax).map((t) => <line key={'gx' + t} x1={sx(t)} x2={sx(t)} y1={P} y2={H - P} className="lx-grid" />)}
      {ticks(yMin, yMax).map((t) => <line key={'gy' + t} y1={sy(t)} y2={sy(t)} x1={P} x2={W - P} className="lx-grid" />)}
      {yMin <= 0 && yMax >= 0 && <line x1={P} x2={W - P} y1={sy(0)} y2={sy(0)} className="lx-axis" />}
      {xMin <= 0 && xMax >= 0 && <line y1={P} y2={H - P} x1={sx(0)} x2={sx(0)} className="lx-axis" />}
      {ticks(xMin, xMax).map((t) => <text key={'tx' + t} x={sx(t)} y={H - P + 14} className="lx-tick" textAnchor="middle">{t}</text>)}
      {ticks(yMin, yMax).map((t) => <text key={'ty' + t} x={P - 6} y={sy(t) + 4} className="lx-tick" textAnchor="end">{t}</text>)}
      <g clipPath="url(#lx-clip)">
        {(lines || []).map((l, i) => <polyline key={'l' + i} points={curve((x) => l.slope * x + l.intercept)} fill="none" stroke={colorOf(l.color, i)} strokeWidth="2.5" />)}
        {(functions || []).map((f, i) => <polyline key={'f' + i} points={curve(f.fn)} fill="none" stroke={colorOf(f.color, i + 2)} strokeWidth="2.5" />)}
        {(points || []).map((p, i) => <circle key={'p' + i} cx={sx(p.x)} cy={sy(p.y)} r="5" fill={colorOf(p.color, i + 1)} />)}
      </g>
      {(points || []).filter((p) => p.label).map((p, i) => <text key={'pl' + i} x={sx(p.x) + 8} y={sy(p.y) - 8} className="lx-label">{p.label}</text>)}
      {(lines || []).filter((l) => l.label).map((l, i) => <text key={'ll' + i} x={W - P - 4} y={P + 14 + i * 16} className="lx-label" textAnchor="end" style={{ fill: colorOf(l.color, i) }}>{l.label}</text>)}
      {xLabel && <text x={W - P} y={H - 4} className="lx-tick" textAnchor="end">{xLabel}</text>}
      {yLabel && <text x={4} y={P - 10} className="lx-tick">{yLabel}</text>}
    </svg>
  );
}

function NumberLine({ min, max, step, marks, width }) {
  const W = width || 420, H = 70, P = 20;
  const sx = (v) => P + ((v - min) / (max - min)) * (W - 2 * P);
  const ticks = []; for (let t = min; t <= max + 1e-9; t += step || 1) ticks.push(Number(t.toFixed(6)));
  return (
    <svg className="lx-plane" viewBox={'0 0 ' + W + ' ' + H} role="img" aria-label="number line">
      <line x1={P} x2={W - P} y1={30} y2={30} className="lx-axis" />
      {ticks.map((t) => <g key={t}><line x1={sx(t)} x2={sx(t)} y1={24} y2={36} className="lx-axis" /><text x={sx(t)} y={52} className="lx-tick" textAnchor="middle">{t}</text></g>)}
      {(marks || []).map((m, i) => <g key={'m' + i}><circle cx={sx(m.value)} cy={30} r="6" fill={colorOf(m.color, i)} />{m.label && <text x={sx(m.value)} y={14} className="lx-label" textAnchor="middle">{m.label}</text>}</g>)}
    </svg>
  );
}

function Bars({ items, max, unit, digits }) {
  const top = max || Math.max(1, ...items.map((it) => it.value));
  return (
    <div className="lx-bars">
      {items.map((it, i) => (
        <div key={it.label} className="lx-bar-row">
          <span className="lx-bar-label">{it.label}</span>
          <div className="lx-bar-track"><div className="lx-bar-fill" style={{ width: Math.max(0, Math.min(100, (it.value / top) * 100)) + '%', background: colorOf(it.color, i) }} /></div>
          <b className="lx-bar-value">{fmt(it.value, digits)}{unit ? ' ' + unit : ''}</b>
        </div>
      ))}
    </div>
  );
}

function Table({ headers, rows }) {
  return (
    <table className="lx-table">
      <thead><tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{String(c)}</td>)}</tr>)}</tbody>
    </table>
  );
}

function Formula({ tex, display }) {
  const html = React.useMemo(() => {
    try { return window.katex ? window.katex.renderToString(String(tex), { displayMode: !!display, throwOnError: false, output: 'mathml' }) : ''; } catch (e) { return ''; }
  }, [tex, display]);
  if (!html) return <span className="lx-formula">{String(tex)}</span>;
  return <span className={display ? 'lx-formula lx-formula-block' : 'lx-formula'} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** A pointer event's position in an svg's own viewBox units. */
function svgPoint(svg, e) {
  const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
  const m = svg.getScreenCTM();
  const p = m ? pt.matrixTransform(m.inverse()) : pt;
  return { x: p.x, y: p.y };
}

/** A thing the child drags inside an svg. Children are drawn at (x, y); with none it is a round handle. */
function Handle({ id, x, y, r, color, label, onDrag, onDrop, children }) {
  const [held, setHeld] = React.useState(false);
  const at = (e) => svgPoint(e.currentTarget.ownerSVGElement, e);
  const R = r || 16;
  return (
    <g id={id} style={{ cursor: held ? 'grabbing' : 'grab', touchAction: 'none' }}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setHeld(true); }}
      onPointerMove={(e) => { if (held && onDrag) onDrag(at(e)); }}
      onPointerUp={(e) => { if (held) { setHeld(false); if (onDrop) onDrop(at(e)); } }}
      onPointerCancel={() => setHeld(false)}>
      <circle cx={x} cy={y} r={R + 10} fill="transparent" />
      {children ? <g transform={'translate(' + x + ' ' + y + ')'}>{children}</g>
        : <circle cx={x} cy={y} r={R} fill={colorOf(color, 0)} stroke="#f8fafc" strokeWidth={held ? 3 : 1.5} />}
      {label && <text x={x} y={y - R - 6} className="lx-label" textAnchor="middle">{label}</text>}
    </g>
  );
}

window.LuminaDisplay = { svgPoint, Handle, Panel, Row, Stack, Text, Slider, Choice, Button, Readout, Plane, NumberLine, Bars, Table, Formula, PALETTE };
`;

/** The names a display may use without declaring them, in the order the page destructures them. */
export const SDK_NAMES = ['svgPoint', 'Handle', 'Panel', 'Row', 'Stack', 'Text', 'Slider', 'Choice', 'Button', 'Readout', 'Plane', 'NumberLine', 'Bars', 'Table', 'Formula', 'PALETTE'];

/** What the authoring agent is told about the kit: one line per component. */
export const SDK_REFERENCE = `- Panel({ title, caption, children }): the frame every display starts with.
- Row({ children, gap }), Stack({ children, gap }), Text({ children, tone: 'muted'|'good'|'bad' }).
- Slider({ label, min, max, step, value, onChange, unit, digits }): controlled; the label must be unique.
- Choice({ label, options: (string|number)[], value, onChange }): segmented buttons; the label must be unique.
- Button({ label, onClick }).
- Readout({ label, value, unit, digits, color }): a live value.
- Plane({ xMin, xMax, yMin, yMax, lines: [{ slope, intercept, color, label }], functions: [{ fn: (x) => y, color }], points: [{ x, y, label, color }], xLabel, yLabel }): coordinate plane.
- NumberLine({ min, max, step, marks: [{ value, label, color }] }).
- Bars({ items: [{ label, value, color }], max, unit, digits }): horizontal bar chart.
- Table({ headers: string[], rows: (string|number)[][] }).
- Formula({ tex, display }): typeset math from a LaTeX string, inline or as its own line ('display'); build tex from live values, e.g. tex={'y = ' + m + 'x + ' + b}. Use it for every equation, fraction, exponent or matrix; never type math as plain text.
- Handle({ id, x, y, r, color, label, onDrag: ({x, y}) => void, onDrop: ({x, y}) => void, children }): inside an <svg>, a thing the child drags; positions are in the svg's viewBox units. With children it draws them at (x, y) instead of a round handle.
- svgPoint(svgElement, pointerEvent): the event's position in the svg's viewBox units, for your own pointer handlers.
- Colors: 'cyan' | 'amber' | 'emerald' | 'pink' | 'indigo' | 'rose' | 'slate' | 'white'.`;
