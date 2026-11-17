// Same Factor (6.RP.A.3). A sample paint was mixed from a cups of one colour and b cups of another (the recipe card).
// The child's bucket already holds A cups of the first colour (fixed by the problem). The child pours the second colour
// one cup at a time with the scoop, then taps Stir. Stir locks the counts and only then shows the mixed colour, computed
// from the ratio in the bucket, so it matches the sample only when second / first = b / a. Before Stir the cups sit
// unmixed as separate dollops, so the child cannot match colours by eye while pouring.
// Rule: equivalent ratios multiply both amounts by the same number. Key: the cups of the second colour, B = b * A / a.
// Misrules: adds the same number to both (b + A - a), or copies the recipe's second amount (b).
function Display({ params, lumina }) {
  const a = Number(params.a) || 2, b = Number(params.b) || 3, A = Number(params.first) || 4;
  const c1 = params.c1 && typeof params.c1 === 'object' ? params.c1 : { name: 'red', hex: '#dc2626' };
  const c2 = params.c2 && typeof params.c2 === 'object' ? params.c2 : { name: 'yellow', hex: '#facc15' };
  const flip = params.flip === true;
  const key = (b * A) / a;

  const COLS = 7, ROWS = 5, CELL = 44, CAP = COLS * ROWS;
  const [added, setAdded] = useState(0);
  const [stirred, setStirred] = useState(false);
  const [drag, setDrag] = useState(null);
  const svgRef = useRef(null);

  useEffect(() => {
    const seen = new Set([key]);
    const misrules = [
      { says: b + (A - a), because: 'added the same number of cups to both colours instead of multiplying both amounts by the same number' },
      { says: b, because: 'used the recipe\'s cups of ' + c2.name + ' without changing them for the bigger or smaller batch' },
    ].filter(m => Number.isInteger(m.says) && m.says > 0 && !seen.has(m.says) && (seen.add(m.says), true));
    lumina.answer(key, misrules);
  }, []);

  useEffect(() => {
    lumina.goal(stirred && added > 0 && added * a === b * A);
    lumina.scene({
      sampleRecipe: a + ' cups of ' + c1.name + ' and ' + b + ' cups of ' + c2.name,
      sampleColour: 'a swatch of the sample paint on the recipe card',
      bucket: A + ' cups of ' + c1.name + ' already in',
      cupsOf2ndColourPouredByChild: added,
      secondColour: c2.name,
      stirred,
      bucketLooks: stirred ? 'stirred: one mixed colour, locked' : 'not stirred: separate dollops of ' + c1.name + ' and ' + c2.name,
    });
  }, [added, stirred]);

  // Layout. The sample card and the paint tin swap sides on flip, so no answer sits on one side.
  const BKT = { x: 190, y: 66, w: 320, h: 240 };
  const L = 97, R = 595;
  const cardX = flip ? R : L, tinX = flip ? L : R;
  const TIN = { x: tinX - 46, y: 96, w: 92, h: 104 };
  const SCOOP = { x: tinX - 34, y: 222, w: 68, h: 64 };
  const STIR = { x: 280, y: 318, w: 140, h: 52 };

  const mix = (() => {
    const h = s => [1, 3, 5].map(i => parseInt(String(s).slice(i, i + 2), 16));
    const p = h(c1.hex), q = h(c2.hex);
    return (u => '#' + p.map((v, i) => Math.round(v + (q[i] - v) * u).toString(16).padStart(2, '0')).join(''));
  })();
  // The share of the second colour sets the mix. Real paint 5:4 and 6:4 look almost alike, so the drawn mix moves
  // three times as far from the sample as the share does: equal shares give the sample's exact colour, any other is plain.
  const ts = b / (a + b);
  const sampleHex = mix(ts);
  const total = A + added;
  const mixHex = mix(Math.max(0, Math.min(1, ts + 3 * (added / total - ts))));
  const cups = n => n + (n === 1 ? ' cup ' : ' cups ');

  const inBucket = p => p.x > BKT.x - 20 && p.x < BKT.x + BKT.w + 20 && p.y > BKT.y - 30 && p.y < BKT.y + BKT.h + 10;
  const grab = e => {
    if (stirred) return;
    svgRef.current.setPointerCapture(e.pointerId);
    const p = svgPoint(svgRef.current, e);
    setDrag({ gx: p.x, gy: p.y, x: p.x, y: p.y });
  };
  const move = e => { if (drag) { const p = svgPoint(svgRef.current, e); setDrag({ ...drag, x: p.x, y: p.y }); } };
  const drop = e => {
    if (!drag) return;
    const p = svgPoint(svgRef.current, e);
    setDrag(null);
    if (inBucket(p)) setAdded(n => (A + n < CAP ? n + 1 : n));
  };
  const takeOut = () => { if (!stirred) setAdded(n => Math.max(0, n - 1)); };

  const cellAt = k => {
    const col = k % COLS, row = Math.floor(k / COLS);
    return { x: BKT.x + 6 + col * CELL + CELL / 2, y: BKT.y + BKT.h - 8 - row * CELL - CELL / 2 };
  };
  const dollop = k => {
    const pt = cellAt(k), mine = k >= A, idx = k - A;
    if (!mine) return <circle key={'d' + k} cx={pt.x} cy={pt.y} r="17" fill={c1.hex} stroke="#0f172a" strokeWidth="2" />;
    return (
      <g key={'d' + k} id={'poured-' + idx} onPointerDown={takeOut} style={{ cursor: 'pointer' }}>
        <rect x={pt.x - CELL / 2} y={pt.y - CELL / 2} width={CELL} height={CELL} fill="transparent" />
        <circle cx={pt.x} cy={pt.y} r="17" fill={c2.hex} stroke="#0f172a" strokeWidth="2" />
      </g>
    );
  };

  const o = drag ? { dx: drag.x - drag.gx, dy: drag.y - drag.gy } : { dx: 0, dy: 0 };
  const level = BKT.h * Math.min(1, total / CAP);

  return (
    <Panel title="Paint Shop" caption="Drag the cup from the tin to the bucket to pour one cup. Tap a poured cup to take it out. Tap Stir to mix.">
      <svg ref={svgRef} viewBox="0 0 680 384" onPointerMove={move} onPointerUp={drop} onPointerCancel={() => setDrag(null)}
        style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <rect width="680" height="384" fill="#0f172a" />

        <g>
          <rect x={cardX - 76} y={BKT.y} width="152" height={BKT.h} rx="14" fill="#1e293b" stroke="#475569" strokeWidth="2" />
          <text x={cardX} y={BKT.y + 30} textAnchor="middle" fontSize="18" fill="#e2e8f0">Sample</text>
          <circle cx={cardX} cy={BKT.y + 92} r="42" fill={sampleHex} stroke="#cbd5e1" strokeWidth="2" />
          <circle cx={cardX - 56} cy={BKT.y + 170} r="8" fill={c1.hex} />
          <text x={cardX - 42} y={BKT.y + 176} fontSize="16" fill="#e2e8f0">{cups(a) + c1.name}</text>
          <circle cx={cardX - 56} cy={BKT.y + 204} r="8" fill={c2.hex} />
          <text x={cardX - 42} y={BKT.y + 210} fontSize="16" fill="#e2e8f0">{cups(b) + c2.name}</text>
        </g>

        <text x={BKT.x + BKT.w / 2} y={BKT.y - 14} textAnchor="middle" fontSize="16" fill="#cbd5e1">{'In the bucket: ' + A + ' cups ' + c1.name}</text>
        <rect id="bucket" x={BKT.x} y={BKT.y} width={BKT.w} height={BKT.h} rx="16" fill="#1e293b" stroke="#64748b" strokeWidth="3" />
        {stirred
          ? <rect x={BKT.x + 4} y={BKT.y + BKT.h - level + 2} width={BKT.w - 8} height={Math.max(0, level - 6)} rx="12" fill={mixHex} />
          : Array.from({ length: total }, (_, k) => dollop(k))}

        <g>
          <rect x={TIN.x} y={TIN.y} width={TIN.w} height={TIN.h} rx="10" fill="#334155" stroke="#94a3b8" strokeWidth="2.5" />
          <ellipse cx={tinX} cy={TIN.y + 4} rx={TIN.w / 2 - 6} ry="10" fill={c2.hex} stroke="#94a3b8" strokeWidth="2" />
          <text x={tinX} y={TIN.y + 66} textAnchor="middle" fontSize="18" fill="#e2e8f0">{c2.name}</text>
        </g>
        {!stirred && (
          <g id="scoop" transform={`translate(${o.dx}, ${o.dy})`} onPointerDown={grab} style={{ cursor: 'grab', touchAction: 'none' }}>
            <rect x={SCOOP.x - 6} y={SCOOP.y - 6} width={SCOOP.w + 12} height={SCOOP.h + 12} fill="transparent" />
            <path d={`M ${SCOOP.x + 10} ${SCOOP.y + 22} L ${SCOOP.x + 50} ${SCOOP.y + 22} L ${SCOOP.x + 46} ${SCOOP.y + 58} L ${SCOOP.x + 14} ${SCOOP.y + 58} Z`} fill={c2.hex} />
            <path d={`M ${SCOOP.x + 6} ${SCOOP.y + 10} L ${SCOOP.x + 54} ${SCOOP.y + 10} L ${SCOOP.x + 48} ${SCOOP.y + 60} L ${SCOOP.x + 12} ${SCOOP.y + 60} Z`} fill="none" stroke="#cbd5e1" strokeWidth="3" strokeLinejoin="round" />
            <path d={`M ${SCOOP.x + 54} ${SCOOP.y + 18} q 16 6 0 30`} fill="none" stroke="#cbd5e1" strokeWidth="4" strokeLinecap="round" />
          </g>
        )}

        {added > 0 && !stirred && (
          <g id="stir" onPointerDown={() => setStirred(true)} style={{ cursor: 'pointer' }}>
            <rect x={STIR.x} y={STIR.y} width={STIR.w} height={STIR.h} rx="14" fill="#334155" stroke="#64748b" strokeWidth="2" />
            <text x={STIR.x + STIR.w / 2} y={STIR.y + 33} textAnchor="middle" fontSize="20" fill="#e2e8f0">🥄 Stir</text>
          </g>
        )}
        {stirred && <text x={STIR.x + STIR.w / 2} y={STIR.y + 33} textAnchor="middle" fontSize="18" fill="#cbd5e1">Stirred</text>}
      </svg>
    </Panel>
  );
}
