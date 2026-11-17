// Fold line (4.G.A.3, lines of symmetry). A paper shape lies on the table with a line through its middle. The child
// turns the line (it stops at each line through the middle and a corner or the middle of a side) and presses Fold:
// the far half flips over the line and lies on the near half, so the child sees whether the halves match. After a
// fold the child may keep the crease or unfold. The rule: a line of symmetry folds the shape exactly onto itself.
// The misrule: any line that cuts the shape in half counts, so a rectangle has "four".
// Say and show: the number of lines of symmetry is one sayable number. Check judges that the child folded along every
// line the paper can be turned to and kept the crease of exactly the lines that fold the shape onto itself. Folding
// never keeps a crease by itself, and nothing on screen marks a line as right: only the folded paper shows the match.
function Display({ params, lumina }) {
  const num = (v, d) => (v === undefined || v === null || v === '' || isNaN(Number(v)) ? d : Number(v));
  const shape = String(params.shape || 'square');
  const w = num(params.w, 180), h = num(params.h, 180), t = num(params.t, 34), slant = num(params.slant, 80);
  const start = num(params.start, 0);
  const CX = 230, CY = 214;

  // The shape as a polygon around (0, 0), its centre (the centroid for the triangle), plus the points the line can
  // be turned to pass through: corners and side middles for a polygon, the box's corners and side middles for a letter.
  const geo = useMemo(() => {
    let pts, anchors, letter = false;
    if (shape === 'rectangle' || shape === 'square') {
      const W = w, H = shape === 'square' ? w : h;
      pts = [[-W / 2, -H / 2], [W / 2, -H / 2], [W / 2, H / 2], [-W / 2, H / 2]];
    } else if (shape === 'triangle') {
      // Two equal sides: apex above the middle of the base; centred on the centroid.
      pts = [[0, -2 * h / 3], [w / 2, h / 3], [-w / 2, h / 3]];
    } else if (shape === 'parallelogram') {
      pts = [[-w / 2 + slant / 2, -h / 2], [w / 2 + slant / 2, -h / 2], [w / 2 - slant / 2, h / 2], [-w / 2 - slant / 2, h / 2]];
    } else if (shape === 'H') {
      const b = num(params.bar, 30), x0 = -w / 2, y0 = -h / 2, y1 = -b / 2, y2 = b / 2;
      pts = [[x0, y0], [x0 + t, y0], [x0 + t, y1], [w / 2 - t, y1], [w / 2 - t, y0], [w / 2, y0], [w / 2, h / 2], [w / 2 - t, h / 2], [w / 2 - t, y2], [x0 + t, y2], [x0 + t, h / 2], [x0, h / 2]];
      letter = true;
    } else { // 'N'
      const x0 = -w / 2, y0 = -h / 2, i1 = h * (w - 2 * t) / (w - t), i2 = h * t / (w - t);
      pts = [[x0, y0], [x0 + t, y0], [w / 2 - t, y0 + i1], [w / 2 - t, y0], [w / 2, y0], [w / 2, h / 2], [w / 2 - t, h / 2], [x0 + t, y0 + i2], [x0 + t, h / 2], [x0, h / 2]];
      letter = true;
    }
    if (letter) {
      const W = w / 2, H = h / 2;
      anchors = [[W, 0], [W, H], [0, H], [-W, H]];
    } else {
      anchors = pts.concat(pts.map((p, i) => { const q = pts[(i + 1) % pts.length]; return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; }));
    }
    // Lines through the centre and each anchor, as angles in [0, 180), one per direction.
    const angs = [];
    for (const [x, y] of anchors) {
      if (Math.hypot(x, y) < 1) continue;
      let a = Math.atan2(y, x) * 180 / Math.PI;
      a = ((a % 180) + 180) % 180;
      if (a > 179.5) a = 0;
      if (!angs.some(b => Math.abs(b - a) < 0.5)) angs.push(a);
    }
    angs.sort((a, b) => a - b);
    const reflect = ([x, y], a) => { const r = a * Math.PI / 90; const c = Math.cos(r), s = Math.sin(r); return [c * x + s * y, s * x - c * y]; };
    const folds = (a) => pts.every(p => { const q = reflect(p, a); return pts.some(r => Math.hypot(r[0] - q[0], r[1] - q[1]) < 0.5); });
    const truth = angs.map(folds);
    return { pts, angs, truth };
  }, []);

  const { pts, angs, truth } = geo;
  const [at, setAt] = useState(((start % angs.length) + angs.length) % angs.length);
  const [folded, setFolded] = useState(false);
  const [kept, setKept] = useState([]);
  const [tried, setTried] = useState([]);

  useEffect(() => {
    const key = truth.filter(Boolean).length;
    const straight = angs.filter((a, i) => truth[i] && (Math.abs(a) < 0.5 || Math.abs(a - 90) < 0.5)).length;
    const misrules = [
      { says: angs.length, because: 'counted every line that cuts the shape in half, not only the lines that fold it exactly onto itself' },
      { says: straight, because: 'counted only the lines straight across and straight up and down, not the slanted ones' },
    ].filter((m, i, all) => m.says !== key && all.findIndex(x => x.says === m.says) === i);
    lumina.answer(key, misrules);
  }, []);

  useEffect(() => {
    const met = angs.every((_, i) => tried.includes(i)) && angs.every((_, i) => kept.includes(i) === truth[i]);
    lumina.goal(met);
    const a = angs[at];
    const dir = Math.abs(a) < 0.5 ? 'straight across' : Math.abs(a - 90) < 0.5 ? 'straight up and down' : a < 90 ? 'slanted, down to the right' : 'slanted, up to the right';
    lumina.scene({ paperShape: shape === 'H' || shape === 'N' ? 'capital letter ' + shape : shape, lineThroughMiddle: dir, paperFolded: folded, creasesKept: kept.length });
  }, [at, folded, kept, tried]);

  const turn = (d) => { setFolded(false); setAt(i => (i + d + angs.length) % angs.length); };
  const fold = () => {
    if (folded) { setFolded(false); return; }
    setFolded(true);
    setTried(v => (v.includes(at) ? v : [...v, at]));
  };
  const keep = () => {
    setKept(v => (v.includes(at) ? v.filter(x => x !== at) : [...v, at]));
    setFolded(false);
  };

  const ang = angs[at], rad = ang * Math.PI / 180;
  const dx = Math.cos(rad), dy = Math.sin(rad), nx = -dy, ny = dx, L = 600;
  const halfPoly = (side) => [[-dx * L, -dy * L], [dx * L, dy * L], [dx * L + side * nx * L, dy * L + side * ny * L], [-dx * L + side * nx * L, -dy * L + side * ny * L]]
    .map(([x, y]) => (CX + x) + ',' + (CY + y)).join(' ');
  const poly = pts.map(([x, y]) => (CX + x) + ',' + (CY + y)).join(' ');
  const flip = 'translate(' + CX + 'px, ' + CY + 'px) rotate(' + ang + 'deg) scale(1, ' + (folded ? -1 : 1) + ') rotate(' + (-ang) + 'deg) translate(' + (-CX) + 'px, ' + (-CY) + 'px)';
  const lineAt = (a, len) => { const r = a * Math.PI / 180; return { x1: CX - Math.cos(r) * len, y1: CY - Math.sin(r) * len, x2: CX + Math.cos(r) * len, y2: CY + Math.sin(r) * len }; };
  const cur = lineAt(ang, 186);
  const PAPER = '#e2e8f0', EDGE = '#94a3b8';
  // Kept creases run the whole way across the paper. Unfolded, they are drawn above both halves (the far half's paper
  // used to cover them, so a crease read as a half-line from the centre); folded, only the near half's part shows.
  const creases = kept.map(i => { const k = lineAt(angs[i], 186); return <line key={'k' + i} {...k} stroke="#f472b6" strokeWidth="4" strokeLinecap="round" />; });

  const roundBtn = (id, x, y, glyph, act) => (
    <g id={id} onClick={act} style={{ cursor: 'pointer' }}>
      <circle cx={x} cy={y} r="32" fill="#1e293b" stroke="#64748b" strokeWidth="2" />
      <text x={x} y={y + 11} textAnchor="middle" fontSize="32" fill="#e2e8f0">{glyph}</text>
    </g>
  );
  const wideBtn = (id, y, label, act) => (
    <g id={id} onClick={act} style={{ cursor: 'pointer' }}>
      <rect x="486" y={y} width="168" height="58" rx="14" fill="#1e293b" stroke="#64748b" strokeWidth="2" />
      <text x="570" y={y + 37} textAnchor="middle" fontSize="20" fill="#e2e8f0">{label}</text>
    </g>
  );

  return (
    <Panel title="Paper Folding" caption="Tap an arrow to turn the line. Tap Fold to fold the paper along it.">
      <svg viewBox="0 0 680 430" style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <rect width="680" height="430" fill="#0f172a" />
        <defs>
          <clipPath id="near"><polygon points={halfPoly(-1)} /></clipPath>
          <clipPath id="far"><polygon points={halfPoly(1)} /></clipPath>
          <clipPath id="paper"><polygon points={poly} /></clipPath>
          <clipPath id="table"><rect x="24" y="16" width="412" height="398" rx="14" /></clipPath>
        </defs>
        <rect x="24" y="16" width="412" height="398" rx="14" fill="#1e293b" stroke="#475569" strokeWidth="2" />

        <g clipPath="url(#table)">
          {folded && <polygon points={poly} fill="none" stroke="#475569" strokeWidth="2" strokeDasharray="6 5" />}
          <g clipPath="url(#near)"><polygon points={poly} fill={PAPER} stroke={EDGE} strokeWidth="2" /></g>
          {folded && (
            <g clipPath="url(#near)">
              <g clipPath="url(#paper)">{creases}</g>
            </g>
          )}
          <g style={{ transform: flip, transformBox: 'view-box', transformOrigin: '0 0', transition: 'transform 0.45s ease' }}>
            <g clipPath="url(#far)">
              <polygon points={poly} fill={folded ? '#fbbf24' : PAPER} fillOpacity={folded ? 0.55 : 1} stroke={folded ? '#fbbf24' : EDGE} strokeWidth="2" />
            </g>
          </g>
          {!folded && <g clipPath="url(#paper)">{creases}</g>}
          <line {...cur} stroke="#22d3ee" strokeWidth="3" strokeDasharray="10 7" strokeLinecap="round" pointerEvents="none" />
          <circle cx={CX} cy={CY} r="6" fill="#22d3ee" pointerEvents="none" />
        </g>

        {roundBtn('turn-left', 528, 92, '⟲', () => turn(-1))}
        {roundBtn('turn-right', 612, 92, '⟳', () => turn(1))}
        <text x="570" y="152" textAnchor="middle" fontSize="16" fill="#cbd5e1">turn the line</text>
        {wideBtn('fold', 196, folded ? 'Unfold' : 'Fold', fold)}
        {folded && wideBtn('keep', 276, kept.includes(at) ? 'Remove crease' : 'Keep crease', keep)}
      </svg>
    </Panel>
  );
}
