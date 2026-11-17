// Spread Out (K.CC.B.4, K.CC.B.5). A row of ladybugs sits on a leaf; the child's shells sit on a strip of sand below.
// Rule: moving things apart (or together) does not change how many. Misrule: a longer row is more, so a row as long as
// the ladybug row has as many as the ladybug row.
// Two goals (params.mode):
//   'match' (default): drag every shell into one row on the sand whose two ends line up under the ladybug row's ends.
//          Key: the number of shells (the moves cannot change it). The misrule says the ladybug count.
//   'same': shells start in a basket; put as many shells on the sand as there are ladybugs. Key: the ladybug count.
//          The misrule lays shells close together until the row is as long as the ladybug row (a different count).
// params.cover hides the ladybugs under a leaf; the ask then says how many are under it.
// Nothing prints a count. The row is not checked for even spacing, only that its ends line up and no shell sits on another.
function Display({ params, lumina }) {
  const mode = params.mode === 'same' ? 'same' : 'match';
  const cover = params.cover === true;
  const topN = Number(params.topCount) || 5;
  const topGap = Number(params.topGap) || 110;
  const topX0 = Number(params.topX) || 100;
  const myN = Number(params.myCount) || 5;
  const myGap = Number(params.myGap) || 50;
  const myX0 = Number(params.myX) || 60;
  const start = mode === 'same' ? 'basket' : (params.start === 'ring' ? 'ring' : 'row');
  const ringX = Number(params.ringX) || 520;

  const R = 24, ROWY = 178, TOPY = 72, CLOSE = 50;
  // Under a leaf the child lines up with the leaf's edges, which reach 34 past the hidden end ladybugs.
  const TOL = cover ? 36 : 20;
  const ringY = 300, ringR = 66;
  const H = start === 'ring' ? 392 : start === 'basket' ? 372 : 236;
  const topXs = Array.from({ length: topN }, (_, i) => topX0 + i * topGap);
  const topMin = topXs[0], topMax = topXs[topN - 1];
  const veins = Math.max(2, Math.round((topMax - topMin) / 70));

  // Where each shell starts: on the row (x), in a ring, or in a basket slot.
  const home = (i) => {
    if (start === 'ring') { const a = -Math.PI / 2 + (2 * Math.PI * i) / myN; return { x: ringX + ringR * Math.cos(a), y: ringY + ringR * Math.sin(a) }; }
    if (start === 'basket') return { x: 196 + (i % 6) * 58, y: 276 + Math.floor(i / 6) * 54 };
    return { x: myX0 + i * myGap, y: ROWY };
  };
  // A shell is { row: true, x } on the sand row, or { row: false } at its start place.
  const [shells, setShells] = useState(() => Array.from({ length: myN }, (_, i) => (start === 'row' ? { row: true, x: home(i).x } : { row: false })));
  const [moves, setMoves] = useState(0);
  const [drag, setDrag] = useState(null);
  const svgRef = useRef(null);

  const onRow = shells.map((s, i) => (s.row ? s.x : null)).filter(x => x !== null);
  const sorted = [...onRow].sort((a, b) => a - b);
  const apart = sorted.every((x, k) => k === 0 || x - sorted[k - 1] >= 2 * R - 6);

  useEffect(() => {
    if (mode === 'same') {
      const span = topMax - topMin;
      const lengthMatched = Math.floor(span / CLOSE) + 1;
      const misrules = [
        { says: lengthMatched, because: 'thinks a longer row is more, so laid shells close together until the row was as long as the ladybug row' },
      ].filter(m => m.says !== topN);
      lumina.answer(topN, misrules);
    } else {
      const misrules = [
        { says: topN, because: 'thinks a longer row is more, so a row as long as the ladybug row must have as many as the ladybugs' },
      ].filter(m => m.says !== myN);
      lumina.answer(myN, misrules);
    }
  }, []);

  useEffect(() => {
    const met = mode === 'same'
      ? onRow.length === topN && apart
      : onRow.length === myN && apart && Math.abs(sorted[0] - topMin) <= TOL && Math.abs(sorted[sorted.length - 1] - topMax) <= TOL;
    lumina.goal(met);
    const startWords = start === 'ring' ? 'in a ring' : start === 'basket' ? 'in a basket below the sand'
      : (myGap >= 80 ? 'in a row, spread far apart' : 'in a row, close together') + (myX0 < 150 ? ', at the left' : myX0 > 300 ? ', at the right' : ', in the middle');
    lumina.scene({
      ladybugs: cover ? 'hidden under a big leaf; only the leaf shows' : (topGap >= 80 ? 'a row on a leaf, spread far apart' : 'a row on a leaf, close together') + (topX0 > 180 ? ', toward the right' : ', from near the left'),
      yourShellsStarted: startWords,
      shellsMovedSoFar: moves,
      ...(mode === 'same' ? { anyShellsOnTheSand: onRow.length > 0 } : { allShellsInTheRow: onRow.length === myN }),
      shellsSittingOnEachOther: !apart,
    });
  }, [shells, moves]);

  const clampX = (x) => Math.max(R + 6, Math.min(680 - R - 6, x));
  const grab = (i, e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = svgPoint(svgRef.current, e);
    setDrag({ i, sx: p.x, sy: p.y, x: p.x, y: p.y });
  };
  const move = (e) => { if (drag) { const p = svgPoint(svgRef.current, e); setDrag({ ...drag, x: p.x, y: p.y }); } };
  const drop = (e) => {
    if (!drag) return;
    const p = svgPoint(svgRef.current, e), i = drag.i;
    setDrag(null);
    if (Math.hypot(p.x - drag.sx, p.y - drag.sy) < 8) return; // a tap is not a move
    const toBasket = start === 'basket' && p.y > 236;
    setShells(all => all.map((s, k) => (k !== i ? s : toBasket ? { row: false } : { row: true, x: clampX(p.x) })));
    setMoves(m => m + 1);
  };
  const where = (i) => {
    if (drag && drag.i === i) return { x: drag.x, y: drag.y };
    const s = shells[i];
    return s.row ? { x: s.x, y: ROWY } : home(i);
  };

  const shell = (i) => {
    const p = where(i), held = drag && drag.i === i;
    return (
      <g key={'s' + i} id={'shell-' + i} transform={`translate(${p.x}, ${p.y})`}
        onPointerDown={e => grab(i, e)} style={{ cursor: held ? 'grabbing' : 'grab', touchAction: 'none' }}>
        <circle r={R} fill={held ? '#334155' : '#1e293b'} stroke="#64748b" strokeWidth="2" />
        <text y="2" textAnchor="middle" dominantBaseline="middle" fontSize="30">🐚</text>
      </g>
    );
  };
  const order = Array.from({ length: myN }, (_, i) => i).sort((a, b) => (drag && drag.i === a ? 1 : 0) - (drag && drag.i === b ? 1 : 0));

  return (
    <Panel title="Spread Out" caption="Drag a shell to move it.">
      <svg ref={svgRef} viewBox={`0 0 680 ${H}`} onPointerMove={move} onPointerUp={drop}
        style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <rect width="680" height={H} fill="#0f172a" />

        <rect x="16" y="36" width="648" height="72" rx="16" fill="#14532d" stroke="#166534" strokeWidth="2" />
        {!cover && topXs.map((x, i) => (
          <text key={'l' + i} x={x} y={TOPY + 2} textAnchor="middle" dominantBaseline="middle" fontSize="34">🐞</text>
        ))}
        {cover && (
          <g pointerEvents="none">
            <rect x={topMin - 34} y="30" width={topMax - topMin + 68} height="84" rx="40" fill="#15803d" stroke="#4ade80" strokeWidth="2.5" />
            <line x1={topMin - 20} y1={TOPY} x2={topMax + 20} y2={TOPY} stroke="#4ade80" strokeWidth="2.5" />
            {Array.from({ length: veins }, (_, k) => {
              const x = topMin + ((k + 0.5) * (topMax - topMin)) / veins;
              return (
                <g key={'v' + k}>
                  <line x1={x} y1={TOPY} x2={x + 22} y2={TOPY - 28} stroke="#4ade80" strokeWidth="1.5" />
                  <line x1={x} y1={TOPY} x2={x + 22} y2={TOPY + 28} stroke="#4ade80" strokeWidth="1.5" />
                </g>
              );
            })}
          </g>
        )}

        <rect x="16" y="142" width="648" height="72" rx="16" fill="#78552b" stroke="#a16207" strokeWidth="2" />
        {start === 'basket' && (
          <g pointerEvents="none">
            <rect x="160" y="246" width="356" height="116" rx="22" fill="#5b3a1a" stroke="#a16207" strokeWidth="2.5" />
            <path d="M 172 262 L 504 262 M 172 304 L 504 304 M 172 346 L 504 346" stroke="#7c4a1e" strokeWidth="2" />
          </g>
        )}
        {order.map(i => shell(i))}
      </svg>
    </Panel>
  );
}
