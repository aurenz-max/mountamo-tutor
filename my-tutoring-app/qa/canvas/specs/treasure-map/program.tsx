function Display({ params, lumina }) {
  // A treasure map on a grid. The explorer stands on the start square. Tap a square next to the end of the path to
  // walk there; tap a square already on the path to go back to it. The clues are spoken in the ask (next to, between,
  // around, through, across) and drawn as numbered picture cards above the map; the map never marks which squares a
  // clue means.
  // params.rows, params.cols, params.start [r,c], params.treasure [r,c],
  // params.landmarks [{ id, name, pic, cells: [[r,c]], ground: 'water' | 'hill' | null, picEach }] (a many-square landmark
  // draws its picture once unless picEach),
  // params.clues [{ rel: 'next'|'between'|'around'|'through'|'across', ref: [landmarkId, ...] }] (the key, for code only).
  const R = Math.max(3, Math.min(5, Number(params.rows) || 5));
  const C = Math.max(4, Math.min(8, Number(params.cols) || 8));
  const start = Array.isArray(params.start) ? params.start : [2, 0];
  const treasure = Array.isArray(params.treasure) ? params.treasure : [2, C - 1];
  const lms = Array.isArray(params.landmarks) ? params.landmarks : [{ id: 'rock', name: 'big rock', pic: '🪨', cells: [[0, 3]] }];
  const clues = Array.isArray(params.clues) ? params.clues : [{ rel: 'next', ref: ['rock'] }];
  const CELL = 80, OX = (680 - C * CELL) / 2, OY = 92, W = 680, H = R * CELL + 108;

  const key = (r, c) => r + ',' + c;
  const lmAt = {};
  lms.forEach(l => l.cells.forEach(([r, c]) => { lmAt[key(r, c)] = l; }));
  const [path, setPath] = useState([start]);
  const end = path[path.length - 1];
  const onPath = (r, c) => path.findIndex(p => p[0] === r && p[1] === c);
  const adj = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1;

  // Squares each clue means, computed from the landmarks.
  const cellsOf = id => (lms.find(l => l.id === id) || { cells: [] }).cells;
  const isIn = (cells, p) => cells.some(q => q[0] === p[0] && q[1] === p[1]);
  const meets = (clue, p) => {
    const a = cellsOf(clue.ref[0]);
    if (clue.rel === 'through' || clue.rel === 'across') return isIn(a, p);
    if (clue.rel === 'next' || clue.rel === 'around') return !isIn(a, p) && a.some(q => adj(q, p));
    if (clue.rel === 'between') {
      const b = cellsOf(clue.ref[1]);
      return a.some(x => b.some(y => (x[0] === y[0] && p[0] === x[0] && (p[1] - x[1]) * (p[1] - y[1]) < 0) ||
        (x[1] === y[1] && p[1] === x[1] && (p[0] - x[0]) * (p[0] - y[0]) < 0)));
    }
    return false;
  };
  let at = 0, cluesInOrder = true;
  clues.forEach(cl => {
    let k = -1;
    for (let i = at; i < path.length; i++) if (meets(cl, path[i])) { k = i; break; }
    if (k < 0) cluesInOrder = false; else at = k;
  });
  const wet = path.some(p => { const l = lmAt[key(p[0], p[1])]; return l && l.ground === 'water'; });
  const avoided = clues.filter(c => c.rel === 'around').every(c => !path.some(p => isIn(cellsOf(c.ref[0]), p)));
  const goalMet = path.length > 1 && end[0] === treasure[0] && end[1] === treasure[1] && cluesInOrder && !wet && avoided;

  const describe = p => {
    const here = lmAt[key(p[0], p[1])];
    if (here) return 'on the ' + here.name;
    const near = lms.filter(l => l.cells.some(q => adj(q, p))).map(l => l.name);
    return near.length ? 'next to the ' + Array.from(new Set(near)).join(' and the ') : 'open grass';
  };
  useEffect(() => {
    lumina.goal(goalMet);
    lumina.scene({
      map: lms.map(l => l.name),
      steps: path.length - 1,
      route: path.slice(1).map(describe),
      explorerAtTreasure: end[0] === treasure[0] && end[1] === treasure[1],
    });
  }, [path, goalMet]);

  const tap = (r, c) => {
    const i = onPath(r, c);
    if (i >= 0) { setPath(p => p.slice(0, i + 1)); return; }
    if (adj(end, [r, c])) setPath(p => [...p, [r, c]]);
  };
  const cx = c => OX + c * CELL + CELL / 2, cy = r => OY + r * CELL + CELL / 2;
  const fillOf = (r, c) => {
    const l = lmAt[key(r, c)];
    if (l && l.ground === 'water') return '#1d4ed8';
    if (l && l.ground === 'hill') return '#78350f';
    return (r + c) % 2 ? '#166534' : '#15803d';
  };

  // The clues as picture cards, in order, so a child who cannot read keeps them in view after the ask is spoken.
  const picOf = id => (lms.find(l => l.id === id) || { pic: '?' }).pic;
  const clueCard = (cl, i) => {
    const w = 132, x = (W - clues.length * (w + 12) + 12) / 2 + i * (w + 12);
    const t = (dx, s, fs) => <text x={x + dx} y={46} textAnchor="middle" dominantBaseline="middle" fontSize={fs || 30}>{s}</text>;
    let body;
    if (cl.rel === 'next') body = [t(44, '🧒'), t(88, picOf(cl.ref[0]))];
    else if (cl.rel === 'between') body = [t(30, picOf(cl.ref[0])), t(66, '🧒'), t(102, picOf(cl.ref[1]))];
    else if (cl.rel === 'around') body = [t(66, picOf(cl.ref[0])), <path key="a" d={`M ${x + 30} ${62} Q ${x + 66} ${-4} ${x + 104} ${62}`} fill="none" stroke="#fde68a" strokeWidth="3" strokeDasharray="4 5" />];
    else body = [t(36, '🧒', 26), <line key="l" x1={x + 54} y1={46} x2={x + 74} y2={46} stroke="#fde68a" strokeWidth="3" />, <path key="h" d={`M ${x + 74} 40 L ${x + 82} 46 L ${x + 74} 52 Z`} fill="#fde68a" />, t(102, picOf(cl.ref[0]))];
    return <g key={i} id={'clue-' + i}>
      <rect x={x} y={12} width={w} height={68} rx="12" fill="#1e293b" stroke="#475569" strokeWidth="2" />
      <circle cx={x + 2} cy={14} r="13" fill="#334155" stroke="#94a3b8" strokeWidth="1.5" />
      <text x={x + 2} y={15} textAnchor="middle" dominantBaseline="middle" fontSize="14" fill="#e2e8f0">{i + 1}</text>
      {body}
    </g>;
  };

  return (
    <Panel>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <rect x="0" y="0" width={W} height={H} fill="#0f172a" />
        {clues.map(clueCard)}
        {Array.from({ length: R }, (_, r) => Array.from({ length: C }, (_, c) => (
          <rect key={key(r, c)} id={`cell-${r}-${c}`} x={OX + c * CELL} y={OY + r * CELL} width={CELL} height={CELL}
            fill={fillOf(r, c)} stroke="#0f172a" strokeWidth="1.5" style={{ cursor: 'pointer' }} onClick={() => tap(r, c)} />)))}
        {lms.map(l => (l.picEach || l.cells.length === 1 ? l.cells : [l.cells[0]]).map(([r, c]) => (
          <text key={l.id + r + c} x={cx(c)} y={cy(r) + 2} textAnchor="middle" dominantBaseline="middle" fontSize="44" pointerEvents="none">{l.pic}</text>)))}
        <text x={cx(treasure[1])} y={cy(treasure[0]) + 2} textAnchor="middle" dominantBaseline="middle" fontSize="44" pointerEvents="none">💰</text>
        <polyline points={path.map(p => cx(p[1]) + ',' + cy(p[0])).join(' ')} fill="none" stroke="#fde68a" strokeWidth="6" strokeDasharray="2 12" strokeLinecap="round" pointerEvents="none" />
        {path.slice(1, -1).map((p, i) => <circle key={i} cx={cx(p[1])} cy={cy(p[0])} r="7" fill="#fde68a" pointerEvents="none" />)}
        <text x={cx(start[1])} y={cy(start[0]) + 30} textAnchor="middle" fontSize="14" fill="#fde68a" pointerEvents="none">start</text>
        <text x={cx(end[1])} y={cy(end[0])} textAnchor="middle" dominantBaseline="middle" fontSize="42" pointerEvents="none">🧒</text>
      </svg>
    </Panel>
  );
}
