/**
 * Hand-written displays that exercise the kit, the page and the harness without a model:
 * one that works, and one per failure the authoring loop must see.
 */
import type { DisplayParam, DisplayProbe } from './types';

export const LINES_SOURCE = `
function Display({ params, lumina }) {
  const [slope, setSlope] = useState(params.startSlope);
  const fixed = { slope: params.fixedSlope, intercept: params.fixedIntercept };
  const moving = { slope, intercept: params.movingIntercept };
  const parallel = Math.abs(slope - fixed.slope) < 1e-9;
  const x = parallel ? null : (fixed.intercept - moving.intercept) / (slope - fixed.slope);
  const y = x === null ? null : fixed.slope * x + fixed.intercept;
  const verdict = parallel ? (fixed.intercept === moving.intercept ? 'The lines are the same line.' : 'The lines never meet.') : 'The lines meet at one point.';
  useEffect(() => { lumina.scene({ slope, parallel, meets: x === null ? null : { x: +x.toFixed(2), y: +y.toFixed(2) } }); }, [slope]);
  return (
    <Panel title="When do two lines meet?" caption="Change the slope of the cyan line and watch where it crosses the amber one.">
      <Plane xMin={-10} xMax={10} yMin={-10} yMax={10}
        lines={[{ ...fixed, color: 'amber', label: 'y = ' + fixed.slope + 'x + ' + fixed.intercept }, { ...moving, color: 'cyan', label: 'y = ' + slope + 'x + ' + moving.intercept }]}
        points={x === null ? [] : [{ x, y, color: 'white', label: '(' + x.toFixed(1) + ', ' + y.toFixed(1) + ')' }]} />
      <Slider label="Slope of the cyan line" min={-3} max={5} step={0.5} value={slope} onChange={setSlope} />
      <Text tone={parallel ? 'bad' : 'good'}>{verdict}</Text>
    </Panel>
  );
}`;

export const LINES_PARAMS: Record<string, DisplayParam> = {
  fixedSlope: { type: 'number', description: 'Slope of the fixed line', default: 2 },
  fixedIntercept: { type: 'number', description: 'Intercept of the fixed line', default: -1 },
  movingIntercept: { type: 'number', description: 'Intercept of the line the student turns', default: 5 },
  startSlope: { type: 'number', description: 'Starting slope of the turning line', default: 0.5 },
};

export const LINES_PROBES: DisplayProbe[] = [
  { name: 'equal slopes never meet', set: { 'Slope of the cyan line': 2 }, expect: { includes: ['never meet'], excludes: ['one point'] } },
  { name: 'slope 0 meets at (3, 5)', set: { 'Slope of the cyan line': 0 }, expect: { includes: ['one point', '(3.0, 5.0)'] } },
];

/** Typesets an equation built from a slider's live value (the kit's Formula). */
export const FORMULA_SOURCE = String.raw`function Display({ params }) {
  const [m, setM] = useState(2);
  return (
    <Panel title="Slope">
      <Slider label="Slope" min={-3} max={3} step={1} value={m} onChange={setM} />
      <Formula tex={'y = ' + m + 'x + \\frac{1}{4}'} display />
      <Formula tex={'\\begin{bmatrix} ' + m + ' & 1 \\\\ 1 & -1 \\end{bmatrix}'} />
    </Panel>
  );
}`;

export const FORMULA_PROBES: DisplayProbe[] = [
  // The start slope 2 appears nowhere else on the page, so its absence after the move means the formula re-rendered.
  { name: 'equation follows the slider', set: { Slope: 3 }, expect: { includes: ['𝑥', '3'], excludes: ['2'] } },
];

/** Compiles, then throws on first render. */
export const THROWS_SOURCE = `function Display({ params }) { return <Panel title={params.missing.name} />; }`;

/** Fails the static checks. */
export const FORBIDDEN_SOURCE = `import x from 'y';\nfunction Display() { fetch('/api'); return <div />; }`;
