/**
 * The canvas stage on a hand-written canvas, with no model: real drags and clicks reach the page, the page's goal and
 * scene come back, and the ship checks read them. Skipped on a host with no Chromium.
 */
import { existsSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { compileDisplay } from '../../gen-display/compile';
import { displayDocument } from '../../gen-display/document';
import { canvasHostPage, canvasIssues } from './canvasAuthor';
import { CanvasStage } from './stage';

const CHROME = process.env.LUMINA_CHROME_PATH || 'C:/Users/xbox3/AppData/Local/ms-playwright/chromium-1169/chrome-win/chrome.exe';

/** A weight to drag onto a pan, and a Test button that commits. The goal is met only after Test with the weight on the pan. */
const SOURCE = `function Display({ params, lumina }) {
  const [at, setAt] = useState({ x: 80, y: 80 });
  const [tested, setTested] = useState(false);
  const onPan = Math.abs(at.x - 300) < 50 && Math.abs(at.y - 200) < 40;
  useEffect(() => { lumina.goal(tested && onPan); lumina.scene({ weightOnPan: onPan, tested }); }, [onPan, tested]);
  return (
    <Panel title="Balance">
      <svg viewBox="0 0 400 260" style={{ width: '100%' }}>
        <rect id="pan" x={250} y={180} width={100} height={40} rx={8} fill="#334155" />
        <Handle id="weight" x={at.x} y={at.y} onDrag={(p) => { setAt(p); setTested(false); }} />
      </svg>
      <Button label="Test" onClick={() => setTested(true)} />
    </Panel>
  );
}`;

describe.skipIf(!existsSync(CHROME))('canvas stage', () => {
  const stage = new CanvasStage();
  afterAll(() => stage.close());
  const compiled = compileDisplay(SOURCE);
  if (!compiled.ok) throw new Error(compiled.errors.join());
  const html = displayDocument(compiled.js, {});

  it('reports the canvas at rest: goal false, scene, no errors, where its ids are', async () => {
    const run = await stage.play(html);
    expect(run.rest.errors).toEqual([]);
    expect(run.rest.goal).toBe(false);
    expect(run.rest.scene).toEqual({ weightOnPan: false, tested: false });
    expect(run.boxes.map(b => b.id).sort()).toEqual(['pan', 'weight']);
    expect(run.png.length).toBeGreaterThan(1000);
  }, 30_000);

  it('a real drag and a click reach the goal; a short drag does not', async () => {
    const win = await stage.play(html, [{ do: 'drag', target: '#weight', to: '#pan' }, { do: 'click', target: 'text=Test' }]);
    expect(win.stepErrors).toEqual([]);
    expect(win.after.goal).toBe(true);
    const miss = await stage.play(html, [{ do: 'drag', target: '#weight', dx: 30, dy: 10 }, { do: 'set', label: 'Test' }]);
    expect(miss.stepErrors).toEqual([]);
    expect(miss.after.scene).toEqual({ weightOnPan: false, tested: true });
    expect(miss.after.goal).toBe(false);
    expect(canvasIssues({ rest: win.rest, proof: { steps: [], after: win.after }, miss: { steps: [], after: miss.after } })).toEqual([]);
  }, 30_000);

  it('a step that cannot be done is reported in words', async () => {
    const run = await stage.play(html, [{ do: 'click', target: '#nothing' }, { do: 'set', label: 'Launch' }]);
    expect(run.stepErrors.join(' | ')).toMatch(/step 1 \(click #nothing\).*step 2 \(set "Launch"\): no kit control labelled "Launch"; the controls are: Test/);
  }, 30_000);
});

describe('canvas ship checks', () => {
  const rest = { goal: false, scene: {}, text: '', errors: [] };
  it('names what a canvas still needs', () => {
    expect(canvasIssues({})).toEqual(['no one has run this canvas: call play']);
    expect(canvasIssues({ rest: { ...rest, errors: ['x is not defined'] } })[0]).toMatch(/does not run clean: x is not defined/);
    expect(canvasIssues({ rest: { ...rest, goal: true } }).join()).toMatch(/met at rest/);
    expect(canvasIssues({ rest: { ...rest, goal: null, scene: null } }).join()).toMatch(/never calls lumina.goal.*never calls lumina.scene/);
    expect(canvasIssues({ rest })).toHaveLength(2);
  });

  it('the host page cannot be ended early by the canvas it carries', () => {
    const page = canvasHostPage({ title: 'T', ask: 'Make it balance.', html: '<script>1</script>' });
    expect(page).toContain('sandbox="allow-scripts"');
    expect(page.match(/<\/script>/g)?.length).toBe(2);
  });
});

describe('canvas style guide', () => {
  it('the example in the prompt compiles and meets its own guide', async () => {
    const { CANVAS_EXAMPLE, styleNotes } = await import('./canvasStyle');
    expect(compileDisplay(CANVAS_EXAMPLE).ok).toBe(true);
    expect(styleNotes(CANVAS_EXAMPLE)).toEqual([]);
  });
  it('notes readouts, a row of buttons and praise, not an operating caption', async () => {
    const { styleNotes } = await import('./canvasStyle');
    const notes = styleNotes('<Panel title="Lab" caption="Drag the wires"><Readout label="x" value={1} /><Button label="A" /><Button label="B" /><text>Correct!</text></Panel>');
    expect(notes.length).toBe(3);
  });
});
