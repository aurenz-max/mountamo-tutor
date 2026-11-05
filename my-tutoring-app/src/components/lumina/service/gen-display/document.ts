/**
 * The page a generated display runs in: React (UMD), the kit, the display, and a small bootstrap
 * that renders it with its params and carries `lumina.scene` / `lumina.event` to the parent by
 * postMessage. The parent mounts it with `sandbox="allow-scripts"` only (an opaque origin: no
 * cookies, no app state) and the CSP below allows no network at all.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { compiledSdk } from './compile';
import { SDK_NAMES } from './sdkSource';

let reactJs: string | undefined;
let katexJs: string | undefined;
/** KaTeX (~270 KB) rides only in pages whose display uses Formula; it renders MathML, so no fonts or stylesheet. */
function katexRuntime(): string {
  katexJs ??= readFileSync(join(process.cwd(), 'node_modules', 'katex', 'dist', 'katex.min.js'), 'utf8');
  return katexJs;
}
function reactRuntime(): string {
  const umd = (pkg: string, file: string) => readFileSync(join(process.cwd(), 'node_modules', pkg, 'umd', file), 'utf8');
  reactJs ??= `${umd('react', 'react.production.min.js')}\n${umd('react-dom', 'react-dom.production.min.js')}`;
  return reactJs;
}

const CSS = `
:root { color-scheme: dark; }
* { box-sizing: border-box; }
body { margin: 0; padding: 4px; background: transparent; color: #e2e8f0; font: 14px/1.45 system-ui, -apple-system, Segoe UI, sans-serif; }
.lx-panel { background: rgba(15,23,42,.72); border: 1px solid rgba(255,255,255,.1); border-radius: 16px; padding: 18px; }
.lx-title { font-size: 17px; font-weight: 600; color: #f8fafc; }
.lx-caption { color: #94a3b8; margin-top: 4px; }
.lx-body { margin-top: 14px; display: flex; flex-direction: column; gap: 14px; }
.lx-row { display: flex; flex-wrap: wrap; align-items: flex-start; }
.lx-row > * { flex: 1 1 200px; min-width: 0; }
.lx-stack { display: flex; flex-direction: column; }
.lx-text { margin: 0; color: #cbd5e1; } .lx-muted { color: #94a3b8; } .lx-good { color: #6ee7b7; } .lx-bad { color: #fda4af; }
.lx-slider { display: flex; flex-direction: column; gap: 6px; }
.lx-slider-head { display: flex; justify-content: space-between; color: #cbd5e1; } .lx-slider-head b { color: #67e8f9; }
.lx-slider input { width: 100%; accent-color: #22d3ee; }
.lx-choice-label { display: block; color: #cbd5e1; margin-bottom: 6px; }
.lx-choice-row { display: flex; flex-wrap: wrap; gap: 6px; }
.lx-btn { background: rgba(255,255,255,.06); color: #e2e8f0; border: 1px solid rgba(255,255,255,.14); border-radius: 10px; padding: 7px 12px; font: inherit; cursor: pointer; }
.lx-btn.lx-on { background: rgba(34,211,238,.18); border-color: #22d3ee; color: #a5f3fc; }
.lx-btn.lx-primary { background: rgba(34,211,238,.2); border-color: rgba(34,211,238,.6); }
.lx-readout { display: flex; justify-content: space-between; gap: 12px; padding: 8px 12px; border-radius: 10px; background: rgba(255,255,255,.04); }
.lx-plane { width: 100%; height: auto; display: block; }
.lx-grid { stroke: rgba(255,255,255,.07); } .lx-axis { stroke: rgba(255,255,255,.45); stroke-width: 1.5; }
.lx-tick { fill: #94a3b8; font-size: 11px; } .lx-label { fill: #e2e8f0; font-size: 12px; }
.lx-bars { display: flex; flex-direction: column; gap: 8px; }
.lx-bar-row { display: grid; grid-template-columns: minmax(70px, 30%) 1fr auto; gap: 10px; align-items: center; }
.lx-bar-track { height: 14px; border-radius: 7px; background: rgba(255,255,255,.06); overflow: hidden; }
.lx-bar-fill { height: 100%; border-radius: 7px; transition: width .2s; }
.lx-table { width: 100%; border-collapse: collapse; } .lx-table th, .lx-table td { text-align: left; padding: 6px 8px; border-bottom: 1px solid rgba(255,255,255,.08); }
.lx-table th { color: #94a3b8; font-weight: 600; }
.lx-error { color: #fda4af; padding: 12px; }
.lx-formula math { font-size: 1.15em; color: #f1f5f9; } .lx-formula-block { display: block; text-align: center; margin: 4px 0; overflow-x: auto; }
`;

/** Closes the inline script safely: a display's source never ends the tag early. */
const safe = (js: string) => js.replace(/<\/script/gi, '<\\/script');

export function displayDocument(js: string, params: Record<string, unknown>): string {
  const bootstrap = `
window.__lumina = { errors: [], scene: null, events: [], controls: {} };
function __post(kind, data) {
  try { var s = JSON.stringify(data); if (s.length > 4000) return; parent.postMessage({ source: 'lumina-display', kind: kind, data: data }, '*'); } catch (e) {}
}
window.addEventListener('error', function (e) { window.__lumina.errors.push(String(e.message || e)); __post('error', String(e.message || e)); });
var lumina = {
  scene: function (facts) { window.__lumina.scene = facts; __post('scene', facts); },
  event: function (type, payload) { window.__lumina.events.push({ type: type, payload: payload }); __post('event', { type: type, payload: payload }); }
};`;
  const mount = `
(function () {
  var useState = React.useState, useMemo = React.useMemo, useEffect = React.useEffect, useRef = React.useRef, useCallback = React.useCallback;
  var ${SDK_NAMES.map((n) => `${n} = LuminaDisplay.${n}`).join(', ')};
  ${js}
  class Boundary extends React.Component {
    constructor(p) { super(p); this.state = { error: null }; }
    static getDerivedStateFromError(error) { return { error: error }; }
    componentDidCatch(error) { var m = 'render: ' + String(error && error.message || error); window.__lumina.errors.push(m); __post('error', m); }
    render() { return this.state.error ? React.createElement('div', { className: 'lx-error' }, 'This display could not run.') : this.props.children; }
  }
  var root = document.getElementById('root');
  ReactDOM.createRoot(root).render(React.createElement(Boundary, null, React.createElement(Display, { params: ${JSON.stringify(params)}, lumina: lumina })));
  new ResizeObserver(function () { __post('height', document.documentElement.scrollHeight); }).observe(document.body);
})();`;
  return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:">
<meta name="viewport" content="width=device-width, initial-scale=1"><style>${CSS}</style></head>
<body><div id="root"></div>
<script>${safe(reactRuntime())}</script>
${/\bFormula\b/.test(js) ? `<script>${safe(katexRuntime())}</script>` : ''}
<script>${safe(bootstrap)}</script>
<script>${safe(compiledSdk())}</script>
<script>${safe(mount)}</script>
</body></html>`;
}
