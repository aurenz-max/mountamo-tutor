/**
 * The canvas style guide (USER 2026-11-14): one written look for every canvas, whoever writes it. Gemini reads
 * CANVAS_STYLE and CANVAS_EXAMPLE in its prompt (`canvasAuthor.ts`); Claude Code reads this file through
 * `/canvas-primitive`; `scripts/canvas-check.mjs` and the author's play result report `styleNotes` for both.
 *
 * Before this, the prompt said only "dark page, light text, 720px, 44px targets", and Gemini runs differed from each
 * other and from the canvases Claude wrote (which copied an existing spec): instruction captions that said what to make, tip lines, kit
 * buttons and readouts under the picture, and a new colour set and gradients on each run.
 */

/** Colours for the canvas's own surfaces and words. Things in the world (wood, water, a red apple) keep natural colours. */
export const CANVAS_COLORS = {
  stage: '#0f172a', // the background of the whole picture
  card: '#1e293b', // a card, tray, shelf or panel the child's things sit on
  cardRaised: '#334155', // a card the child has picked or is holding
  line: '#475569', // card borders, dashed places where a thing can go
  lineStrong: '#64748b', // borders of things the child can grab
  text: '#e2e8f0', // names and numbers the child must read
  textSoft: '#cbd5e1', // labels under things
  textMuted: '#94a3b8', // small marks: tick numbers, step numbers
  // Accents, the same names as the kit's colours: cyan, amber, emerald, pink, indigo, rose.
  cyan: '#22d3ee', amber: '#fbbf24', emerald: '#34d399', pink: '#f472b6', indigo: '#818cf8', rose: '#fb7185',
} as const;

export const CANVAS_STYLE = `## How a Lumina canvas looks
All Lumina canvases share one look, so a child moving between them sees one world. Follow it unless the objective needs otherwise.
- <Panel title caption> holding one <svg> with a viewBox about 680 wide (style width 100%, height auto) whose first shape is a rect filling it with the stage colour ${CANVAS_COLORS.stage}. Do not wrap the picture in your own boxes, borders or extra backgrounds.
- Surfaces: cards, trays and shelves ${CANVAS_COLORS.card} with a ${CANVAS_COLORS.line} border (rounded, rx 10-16); a card the child is holding or has picked ${CANVAS_COLORS.cardRaised}; a thing the child can grab has a ${CANVAS_COLORS.lineStrong} border.
- A place where something can go is a dashed outline (${CANVAS_COLORS.line}, strokeDasharray "6 5"), empty until the child fills it.
- Words: ${CANVAS_COLORS.text} for what the child must read, ${CANVAS_COLORS.textSoft} for labels, ${CANVAS_COLORS.textMuted} for small marks. Labels 14px or more, never under 12px.
- Accents for the child's own work (a path walked, a wire, a mark placed): cyan ${CANVAS_COLORS.cyan}, amber ${CANVAS_COLORS.amber}, emerald ${CANVAS_COLORS.emerald}, pink ${CANVAS_COLORS.pink}, indigo ${CANVAS_COLORS.indigo}, rose ${CANVAS_COLORS.rose}. Things in the world keep their natural colours (wood brown, water blue, grass green).
- Objects are emoji at 30px or more, or simple flat shapes. Use a gradient only for a material that needs it (glass, metal, a glow) and keep them few.
- Panel title: a short name for the world ("Circuit Workshop"). Panel caption: one line on how to work the controls ("Tap a sound to hear it. Drag it into a box."), never what to make or how to solve it: the lesson shows the ask above the canvas. No other instruction text, no "Tip:" lines.
- No row of buttons under the picture, no Reset or Clear (the lesson has Start over), and no live readout of the quantity the goal checks. A Test or Launch button inside the picture is welcome when the world must run before the child sees the result.
- Nothing changes colour, shows a tick, turns green or says "Correct" when the goal is met: the lesson's Check does that.`;

/** A short canvas in the house style. It shows the look and the idioms, not a task to copy. */
export const CANVAS_EXAMPLE = `// Style example only (a jar to fill with counters): copy the look and the idioms, not the task.
function Display({ params, lumina }) {
  const want = Number(params.want) || 4;
  const [inJar, setInJar] = useState([]);
  const [drag, setDrag] = useState(null);
  const svgRef = useRef(null);
  const ids = Array.from({ length: 7 }, (_, i) => 'c' + i);
  useEffect(() => {
    lumina.goal(inJar.length === want);
    lumina.scene({ countersInJar: inJar.length, countersOnTray: ids.length - inJar.length, jarLabel: want });
  }, [inJar]);
  const JAR = { x: 400, y: 60, w: 220, h: 230 };
  const grab = (id, e) => { e.currentTarget.setPointerCapture(e.pointerId); setDrag({ id }); };
  const move = e => { if (drag) { const p = svgPoint(svgRef.current, e); setDrag({ ...drag, x: p.x, y: p.y }); } };
  const drop = e => {
    if (!drag) return;
    const p = svgPoint(svgRef.current, e), id = drag.id, inside = p.x > JAR.x && p.x < JAR.x + JAR.w && p.y > JAR.y && p.y < JAR.y + JAR.h;
    setDrag(null);
    setInJar(j => (inside ? (j.includes(id) ? j : [...j, id]) : j.filter(x => x !== id)));
  };
  const at = id => {
    if (drag && drag.id === id && drag.x !== undefined) return { x: drag.x, y: drag.y };
    const k = inJar.indexOf(id), i = ids.indexOf(id);
    return k >= 0 ? { x: JAR.x + 50 + (k % 3) * 60, y: JAR.y + 190 - Math.floor(k / 3) * 56 } : { x: 70 + (i % 4) * 76, y: 120 + Math.floor(i / 4) * 90 };
  };
  return (
    <Panel title="Strawberry Jar" caption="Drag a strawberry into the jar or back out.">
    <svg ref={svgRef} viewBox="0 0 680 310" onPointerMove={move} style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
      <rect width="680" height="310" fill="#0f172a" />
      <rect x="24" y="60" width="300" height="230" rx="14" fill="#1e293b" stroke="#475569" strokeWidth="2" />
      <rect id="jar" x={JAR.x} y={JAR.y} width={JAR.w} height={JAR.h} rx="16" fill="none" stroke="#475569" strokeWidth="2.5" strokeDasharray="6 5" />
      <text x={JAR.x + JAR.w / 2} y="44" textAnchor="middle" fontSize="22" fill="#e2e8f0">{want}</text>
      {ids.map(id => { const p = at(id); return (
        <g key={id} id={'counter-' + id} transform={\`translate(\${p.x}, \${p.y})\`} onPointerDown={e => grab(id, e)} onPointerUp={drop} style={{ cursor: 'grab', touchAction: 'none' }}>
          <circle r="26" fill="#334155" stroke="#64748b" strokeWidth="2" />
          <text y="2" textAnchor="middle" dominantBaseline="middle" fontSize="30">🍓</text>
        </g>); })}
    </svg>
    </Panel>
  );
}`;

/** Advisory notes on a program's look against the guide. Never blocking: a canvas may need what the guide avoids. */
export function styleNotes(source: string): string[] {
  const notes: string[] = [];
  if (/<Readout\b/.test(source)) notes.push('it shows a live Readout: a readout of the quantity the goal checks lets the child wiggle until it matches; keep it only if the relation is the lesson, and hide it on later problems');
  const buttons = (source.match(/<Button\b/g) ?? []).length;
  if (buttons > 1) notes.push(`it has ${buttons} kit Buttons: keep only a Test or Launch the world needs; the lesson has Start over, and the child acts on the picture itself`);
  const gradients = (source.match(/<(linear|radial)Gradient\b/g) ?? []).length;
  if (gradients > 4) notes.push(`it defines ${gradients} gradients: use them only for a material that needs one (glass, metal, a glow)`);
  if (/\bTip:/.test(source)) notes.push('it has a "Tip:" line: at most one short line on how to operate a control');
  if (/(Correct|Well done|Great job|You did it)/i.test(source)) notes.push('it has praise or a verdict in its words: the lesson\'s Check gives the verdict');
  return notes;
}
