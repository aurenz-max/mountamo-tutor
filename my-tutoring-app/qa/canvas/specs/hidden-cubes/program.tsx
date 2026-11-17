// Hidden cubes (5.MD.C.4). A stack of unit cubes, drawn in isometric view, length by width by height. From this view
// only the cubes on the top, the front-left face and the front-right face can be seen. The child lifts the stack apart
// one layer at a time (each lifted layer goes onto the shelf beside it, top layer first) and taps every cube that
// could not be seen in the closed stack to mark it. The rule: volume counts every cube, including the hidden ones.
// The misrule counts only the cubes in view (2 x 2 x 2 is "seven") or the squares on the faces in view.
// With `box`, the cubes are inside a closed cardboard box that shows only its three sizes: every cube is hidden, and
// the bottom layer must come out of the box too.
// Say and show: the number of cubes is one sayable value; Check judges that exactly the hidden cubes are marked.
function Display({ params, lumina }) {
  const L = Math.max(1, Number(params.length) || 2);
  const W = Math.max(1, Number(params.width) || 2);
  const H = Math.max(1, Number(params.height) || 2);
  const box = !!params.box;
  const maxLift = box ? H : H - 1;

  const [lifted, setLifted] = useState(0);
  const [marked, setMarked] = useState([]);

  const key = (i, j, k) => i + '-' + j + '-' + k;
  const hidden = (i, j, k) => box || (i < L - 1 && j < W - 1 && k < H - 1);

  useEffect(() => {
    const total = L * W * H;
    const seen = total - (box ? total : (L - 1) * (W - 1) * (H - 1));
    const raw = box
      ? [
          { says: L + W + H, because: 'added the three sizes instead of counting every cube' },
          { says: L * W + L * H + W * H, because: 'counted the squares on the three outside faces in view' },
          { says: L * W, because: 'counted one layer and not the layers under it' },
        ]
      : [
          { says: seen, because: 'counted only the cubes that can be seen, not the hidden ones' },
          { says: L * W + L * H + W * H, because: 'counted the squares on the faces in view' },
          { says: L * W, because: 'counted one layer and not the layers under it' },
        ];
    const misrules = raw.filter((m, n, all) => m.says > 0 && m.says !== total && all.findIndex(x => x.says === m.says) === n);
    lumina.answer(total, misrules);
  }, []);

  useEffect(() => {
    let ok = true;
    for (let i = 0; i < L; i++) for (let j = 0; j < W; j++) for (let k = 0; k < H; k++)
      if (hidden(i, j, k) !== marked.includes(key(i, j, k))) ok = false;
    lumina.goal(ok);
    lumina.scene({
      stack: `${L} long, ${W} wide, ${H} tall`,
      ...(box ? { cubesAreInAClosedBox: true } : {}),
      layersLiftedOntoTheShelf: lifted,
      layersStillInTheStack: H - lifted,
      cubesTheChildMarked: marked.length,
    });
  }, [lifted, marked]);

  // Layout: the stack (or box) in the first column, one shelf place per layer that can be lifted.
  const cols = maxLift + 1;
  const GAP = 28, VW = 680, VH = 430;
  const S = Math.max(30, Math.min(44, Math.floor((650 - cols * GAP) / (cols * (L + W) * 0.866))));
  const colW = (L + W) * 0.866 * S + GAP;
  const left0 = (VW - cols * colW) / 2 + GAP / 2;
  const FLOOR = 330; // y of the lowest corner of every footprint
  const origin = c => [left0 + c * colW + W * 0.866 * S, FLOOR - (L + W) * 0.5 * S];
  const P = (i, j, k, o) => [o[0] + (i - j) * S * 0.866, o[1] + (i + j) * S * 0.5 - k * S];
  const poly = pts => pts.map(p => p.map(v => Math.round(v * 10) / 10).join(',')).join(' ');
  const foot = (o, z) => poly([P(0, 0, z, o), P(L, 0, z, o), P(L, W, z, o), P(0, W, z, o)]);

  const toggle = id => setMarked(m => (m.includes(id) ? m.filter(x => x !== id) : [...m, id]));

  // One cube. `z` is the level it is drawn at; `tappable` when its top is open to view.
  const cube = (i, j, k, z, o, tappable) => {
    const id = key(i, j, k), on = marked.includes(id);
    const p = (a, b, c) => P(a, b, c, o);
    const fills = on ? ['#d97706', '#b45309', '#fbbf24'] : ['#0891b2', '#0e7490', '#67e8f9'];
    return (
      <g key={'c' + id} onClick={tappable ? () => toggle(id) : undefined} style={{ cursor: tappable ? 'pointer' : 'default' }}>
        <polygon points={poly([p(i, j + 1, z), p(i + 1, j + 1, z), p(i + 1, j + 1, z + 1), p(i, j + 1, z + 1)])} fill={fills[0]} stroke="#0f172a" strokeWidth="1.5" />
        <polygon points={poly([p(i + 1, j, z), p(i + 1, j + 1, z), p(i + 1, j + 1, z + 1), p(i + 1, j, z + 1)])} fill={fills[1]} stroke="#0f172a" strokeWidth="1.5" />
        <polygon id={tappable ? 'cube-' + id : undefined} points={poly([p(i, j, z + 1), p(i + 1, j, z + 1), p(i + 1, j + 1, z + 1), p(i, j + 1, z + 1)])} fill={fills[2]} stroke="#0f172a" strokeWidth="1.5" />
      </g>
    );
  };
  const layerCubes = (k, z, o, tappable) => {
    const list = [];
    for (let i = 0; i < L; i++) for (let j = 0; j < W; j++) list.push([i, j]);
    list.sort((a, b) => (a[0] + a[1]) - (b[0] + b[1]));
    return list.map(([i, j]) => cube(i, j, k, z, o, tappable));
  };

  // The stack: layers 0 .. H-1-lifted stay; the top one of them is open to view unless it is in the box.
  const left = H - lifted;
  const o0 = origin(0);
  const stack = [];
  if (!box) for (let k = 0; k < left; k++) stack.push(...layerCubes(k, k, o0, k === left - 1));
  const cardboard = () => {
    if (left <= 0) return <polygon points={foot(o0, 0)} fill="none" stroke="#a16207" strokeWidth="2" strokeDasharray="6 5" />;
    const p = (a, b, c) => P(a, b, c, o0);
    return (
      <g pointerEvents="none">
        <polygon points={poly([p(0, W, 0), p(L, W, 0), p(L, W, left), p(0, W, left)])} fill="#a0703f" stroke="#5b3a1e" strokeWidth="2" />
        <polygon points={poly([p(L, 0, 0), p(L, W, 0), p(L, W, left), p(L, 0, left)])} fill="#8a5f34" stroke="#5b3a1e" strokeWidth="2" />
        <polygon points={poly([p(0, 0, left), p(L, 0, left), p(L, W, left), p(0, W, left)])} fill="#c08a52" stroke="#5b3a1e" strokeWidth="2" />
        <line x1={p(L / 2, 0, left)[0]} y1={p(L / 2, 0, left)[1]} x2={p(L / 2, W, left)[0]} y2={p(L / 2, W, left)[1]} stroke="#5b3a1e" strokeWidth="2" />
      </g>
    );
  };

  // Shelf places, left to right in the stack's own order from the bottom: the top layer, lifted first, goes furthest
  // right, so the shelf reads bottom, middle, top.
  const shelf = [];
  for (let k = H - maxLift; k < H; k++) {
    const o = origin(box ? k + 1 : k);
    shelf.push(<polygon key={'slot' + k} points={foot(o, 0)} fill="none" stroke="#475569" strokeWidth="2" strokeDasharray="6 5" />);
    if (k >= H - lifted) shelf.push(...layerCubes(k, 0, o, true));
  }

  const btn = (id, x, label, act, can) => (
    <g id={id} onClick={can ? act : undefined} style={{ cursor: can ? 'pointer' : 'default' }} opacity={can ? 1 : 0.35}>
      <rect x={x} y={360} width="130" height="50" rx="12" fill="#334155" stroke="#64748b" strokeWidth="2" />
      <text x={x + 65} y={391} textAnchor="middle" fontSize="18" fill="#e2e8f0">{label}</text>
    </g>
  );
  const bx = Math.max(16, o0[0] - 135);

  return (
    <Panel title="Hidden Cubes" caption="Tap Lift to take the top layer off, or Put back to return it. Tap a cube to mark it; tap again to clear.">
      <svg viewBox={`0 0 ${VW} ${VH}`} style={{ width: '100%', height: 'auto', display: 'block', userSelect: 'none' }}>
        <rect width={VW} height={VH} fill="#0f172a" />
        <polygon points={foot(o0, 0)} fill="#1e293b" stroke="#475569" strokeWidth="2" />
        {stack}
        {box && cardboard()}
        {box && (
          <g pointerEvents="none">
            <rect x={Math.max(12, o0[0] - 120)} y="16" width="240" height="40" rx="10" fill="#1e293b" stroke="#475569" strokeWidth="2" />
            <text x={Math.max(12, o0[0] - 120) + 120} y="42" textAnchor="middle" fontSize="17" fill="#e2e8f0">{`${L} long · ${W} wide · ${H} tall`}</text>
          </g>
        )}
        {shelf}
        {btn('lift', bx, 'Lift', () => setLifted(n => Math.min(maxLift, n + 1)), lifted < maxLift)}
        {btn('put-back', bx + 140, 'Put back', () => setLifted(n => Math.max(0, n - 1)), lifted > 0)}
      </svg>
    </Panel>
  );
}
