// Turned shapes (K.G.A.2, 1.G.A.1). A tray holds shapes drawn as outlines: some are the shape the lesson names
// (triangles, squares or hexagons), turned, stretched, big or small; the rest are close non-examples (an open
// triangle, one with a curved side, four sides; a long rectangle or a slanted diamond; five or eight sides). The child
// taps every shape of the named kind. The rule: a shape keeps its name when it is turned, stretched or resized.
// Say and show: the count of named shapes is one sayable number; Check judges that the tapped shapes are exactly the
// named ones, so tapping every shape never meets the goal. Every shape is an outline in one stroke style and the
// colours cycle by place, so neither fill nor colour tells a shape's kind.
// A shape is written "kind rotation scale", e.g. "eq 180 0.9".
function Display({ params, lumina }) {
  const target = String(params.target || 'triangle');
  const list = Array.isArray(params.shapes) && params.shapes.length ? params.shapes : ['eq 0 1', 'sq 0 0.9', 'eq 180 0.9', 'circle 0 0.8'];
  const shapes = list.map((s, i) => {
    const [kind, rot, scale] = String(s).trim().split(/\s+/);
    return { i, kind, rot: Number(rot) || 0, scale: Number(scale) || 1 };
  });
  const [tapped, setTapped] = useState([]);

  // Which kinds carry the lesson's name, which one look counts as "the real one" under the misrule, and which
  // non-examples a child who goes by a loose look would also count.
  const KINDS = {
    triangle: { is: ['eq', 'thin', 'right', 'wide'], near: ['open', 'curve'], canon: s => s.kind === 'eq' && ((s.rot % 360) + 360) % 360 === 0 },
    square: { is: ['sq'], near: ['rhombus'], canon: s => s.kind === 'sq' && ((s.rot % 90) + 90) % 90 === 0 },
    hexagon: { is: ['hex', 'hexlong'], near: ['pent', 'oct'], canon: s => s.kind === 'hex' && ((s.rot % 60) + 60) % 60 === 0 },
  };
  const rule = KINDS[target] || KINDS.triangle;
  const isTarget = s => rule.is.includes(s.kind);
  const WHY = {
    triangle: ['counted only the triangle that points up with equal sides; a turned, thin or wide one was not a triangle to them', 'counted shapes that only nearly look like triangles: an open one or one with a curved side'],
    square: ['called a turned square a diamond, so counted only the squares sitting flat', 'called every diamond a square, the slanted one with no square corners too'],
    hexagon: ['counted only the hexagon sitting flat with equal sides; a turned, small or stretched one was not a hexagon to them', 'counted every shape with many sides: the five-sided and eight-sided ones too'],
  }[target] || [];

  useEffect(() => {
    const key = shapes.filter(isTarget).length;
    const misrules = [
      { says: shapes.filter(rule.canon).length, because: WHY[0] },
      shapes.some(s => rule.near.includes(s.kind)) ? { says: shapes.filter(s => isTarget(s) || rule.near.includes(s.kind)).length, because: WHY[1] } : null,
    ].filter((m, k, all) => m && Number.isInteger(m.says) && m.says > 0 && m.says !== key && all.findIndex(x => x && x.says === m.says) === k);
    lumina.answer(key, misrules);
  }, []);

  const COLS = 4, CW = 160, CH = 150, X0 = 20, Y0 = 16;
  // What a child can see of each shape, in plain words and without its name, for the tutor's scene.
  const LOOK = {
    eq: '3 straight sides, closed', thin: '3 straight sides, closed, long and thin', right: '3 straight sides, closed, one square corner',
    wide: '3 straight sides, closed, wide and flat', open: '3 straight sides with a gap, not closed', curve: '2 straight sides and 1 curved side',
    quad: '4 straight sides, the top cut short', sq: '4 equal sides, square corners', rect: '4 sides, two long and two short',
    rhombus: '4 equal sides, slanted, no square corners', hex: '6 equal sides', hexlong: '6 sides, stretched wide', pent: '5 sides', oct: '8 sides', circle: 'round, no corners',
  };
  const looks = s => (LOOK[s.kind] || s.kind) + (s.rot % 360 && s.kind !== 'circle' ? ', turned' : '') + (s.scale < 0.75 ? ', small' : s.scale > 1.05 ? ', big' : '');
  const place = i => (i < COLS ? 'top row, ' : 'bottom row, ') + ['first', 'second', 'third', 'fourth'][i % COLS] + ' from the left';
  useEffect(() => {
    const want = shapes.filter(isTarget).map(s => s.i);
    lumina.goal(tapped.length === want.length && want.every(i => tapped.includes(i)));
    lumina.scene({ lookingFor: target + 's', shapesOnTray: shapes.map(s => place(s.i) + ': ' + looks(s)), shapesTapped: tapped.length, tappedPlaces: [...tapped].sort((a, b) => a - b).map(place) });
  }, [tapped]);

  const toggle = i => setTapped(t => (t.includes(i) ? t.filter(x => x !== i) : [...t, i]));

  // Outline paths around (0, 0), about R across from the middle. Open paths stay open; fill is none for every shape.
  const R = 44;
  const pts = a => 'M ' + a.map(p => (p[0] * R).toFixed(1) + ' ' + (p[1] * R).toFixed(1)).join(' L ');
  const regular = (n, start) => Array.from({ length: n }, (_, k) => { const t = ((start + (360 * k) / n) * Math.PI) / 180; return [0.95 * Math.cos(t), 0.95 * Math.sin(t)]; });
  const A = [0, -1], B = [0.866, 0.5], C = [-0.866, 0.5];
  const path = kind => {
    switch (kind) {
      case 'eq': return pts([A, B, C]) + ' Z';
      case 'thin': return pts([[0, -1.25], [0.27, 0.95], [-0.27, 0.95]]) + ' Z';
      case 'right': return pts([[-0.75, -0.8], [0.85, 0.7], [-0.75, 0.7]]) + ' Z';
      case 'wide': return pts([[0.25, -0.45], [1.2, 0.4], [-1.2, 0.4]]) + ' Z';
      case 'open': { const g = [B[0] + 0.62 * (A[0] - B[0]), B[1] + 0.62 * (A[1] - B[1])]; return pts([A, C, B, g]); }
      case 'curve': return 'M ' + (A[0] * R) + ' ' + (A[1] * R) + ' L ' + (B[0] * R).toFixed(1) + ' ' + (B[1] * R) + ' Q 0 ' + (1.35 * R).toFixed(1) + ' ' + (C[0] * R).toFixed(1) + ' ' + (C[1] * R) + ' Z';
      case 'quad': return pts([[-0.3, -0.75], [0.3, -0.75], [0.9, 0.55], [-0.9, 0.55]]) + ' Z';
      case 'sq': return pts([[-0.68, -0.68], [0.68, -0.68], [0.68, 0.68], [-0.68, 0.68]]) + ' Z';
      case 'rect': return pts([[-1.15, -0.42], [1.15, -0.42], [1.15, 0.42], [-1.15, 0.42]]) + ' Z';
      case 'rhombus': return pts([[0, -0.95], [0.5, 0], [0, 0.95], [-0.5, 0]]) + ' Z';
      case 'hex': return pts(regular(6, 0)) + ' Z';
      case 'hexlong': return pts(regular(6, 0).map(p => [p[0] * 1.3, p[1] * 0.62])) + ' Z';
      case 'pent': return pts(regular(5, -90)) + ' Z';
      case 'oct': return pts(regular(8, 22.5)) + ' Z';
      default: return '';
    }
  };
  const INK = ['#fbbf24', '#f472b6', '#34d399', '#818cf8', '#fb7185'];

  const card = s => {
    const col = s.i % COLS, row = Math.floor(s.i / COLS);
    const x = X0 + col * CW, y = Y0 + row * CH, on = tapped.includes(s.i);
    const cx = x + CW / 2, cy = y + CH / 2;
    return (
      <g key={s.i} id={'shape-' + s.i} onPointerDown={() => toggle(s.i)} style={{ cursor: 'pointer' }}>
        <rect x={x + 6} y={y + 6} width={CW - 12} height={CH - 12} rx="14" fill={on ? '#334155' : '#1e293b'} stroke={on ? '#22d3ee' : '#475569'} strokeWidth={on ? 4 : 2} />
        {s.kind === 'circle'
          ? <circle cx={cx} cy={cy} r={R * 0.8 * s.scale} fill="none" stroke={INK[s.i % INK.length]} strokeWidth="5" />
          : <path d={path(s.kind)} transform={`translate(${cx} ${cy}) rotate(${s.rot}) scale(${s.scale})`} fill="none" stroke={INK[s.i % INK.length]} strokeWidth="5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />}
        {on ? <circle cx={x + 24} cy={y + 24} r="8" fill="#22d3ee" /> : null}
      </g>
    );
  };

  const rows = Math.ceil(shapes.length / COLS), H = Y0 * 2 + rows * CH;
  return (
    <Panel title="Shape Tray" caption="Tap a shape to pick it. Tap it again to put it back.">
      <svg viewBox={`0 0 680 ${H}`} style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <rect width="680" height={H} fill="#0f172a" />
        {shapes.map(card)}
      </svg>
    </Panel>
  );
}
