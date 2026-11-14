function Display({ params, lumina }) {
  const mode = params.mode === 'design' ? 'design' : 'pack';
  const L = Number(params.length) || 3, Wd = Number(params.width) || 2, Hh = Number(params.height) || 2;
  const maxLayers = Math.max(1, Math.min(Hh, Number(params.cubeLayers) || Hh));
  const target = Number(params.target) || 24;
  const fixedH = params.fixedHeight ? Number(params.fixedHeight) : 0;
  const ref = params.ref || null; // [l, w, h] of a grey reference box
  const start = params.start || [1, 1, fixedH || 1];

  const [base, setBase] = useState([]); // 'i-j' keys of floor cells with a cube (pack)
  const [layers, setLayers] = useState(1);
  const [sign, setSign] = useState(0);
  const [dims, setDims] = useState(() => ({ l: start[0], w: start[1], h: fixedH || start[2] }));

  useEffect(() => {
    if (mode === 'pack') {
      lumina.goal(sign === L * Wd * Hh);
      lumina.scene({
        crate: `${L} long, ${Wd} wide, ${Hh} tall (unit marks on its edges)`,
        cubesOnTheFloor: base.length,
        layersStacked: base.length ? layers : 0,
        mostLayersTheCubesMake: maxLayers,
        volumeSign: sign === 0 ? 'not set' : sign + ' cubic units',
      });
    } else {
      lumina.goal(dims.l * dims.w * dims.h === target && (!fixedH || dims.h === fixedH));
      lumina.scene({
        boxTheChildBuilt: `${dims.l} long, ${dims.w} wide, ${dims.h} tall`,
        ...(ref ? { greyBox: `${ref[0]} long, ${ref[1]} wide, ${ref[2]} tall` } : {}),
        ...(fixedH ? { heightIsSetTo: fixedH } : {}),
      });
    }
  }, [base, layers, sign, dims]);

  const W = 680, H = 470;
  const S = 26, C = S * 0.866, OX = 228, OY = 190;
  const P = (i, j, k, s = S, ox = OX, oy = OY) => [ox + (i - j) * s * 0.866, oy + (i + j) * s * 0.5 - k * s];
  const poly = pts => pts.map(p => p.join(',')).join(' ');

  const cube = (i, j, k, key, extra, s, ox, oy, grey) => {
    const p = (a, b, c) => P(a, b, c, s, ox, oy);
    return (
      <g key={key} {...extra}>
        <polygon points={poly([p(i, j + 1, k), p(i + 1, j + 1, k), p(i + 1, j + 1, k + 1), p(i, j + 1, k + 1)])} fill={grey ? '#64748b' : '#0891b2'} stroke="#0f172a" strokeWidth="1.5" />
        <polygon points={poly([p(i + 1, j, k), p(i + 1, j + 1, k), p(i + 1, j + 1, k + 1), p(i + 1, j, k + 1)])} fill={grey ? '#475569' : '#0e7490'} stroke="#0f172a" strokeWidth="1.5" />
        <polygon points={poly([p(i, j, k + 1), p(i + 1, j, k + 1), p(i + 1, j + 1, k + 1), p(i, j + 1, k + 1)])} fill={grey ? '#94a3b8' : '#67e8f9'} stroke="#0f172a" strokeWidth="1.5" />
      </g>
    );
  };
  const sorted = list => list.slice().sort((a, b) => (a[0] + a[1]) - (b[0] + b[1]) || a[2] - b[2]);
  const boxEdges = (l, w, h, key, marksOnly) => {
    const c = [[0, 0], [l, 0], [l, w], [0, w]];
    const e = [];
    for (let q = 0; q < 4; q++) {
      const [a, b] = c[q], [a2, b2] = c[(q + 1) % 4];
      e.push([P(a, b, 0), P(a2, b2, 0)], [P(a, b, h), P(a2, b2, h)], [P(a, b, 0), P(a, b, h)]);
    }
    return (
      <g key={key} pointerEvents="none">
        {!marksOnly && e.map(([p1, p2], n) => <line key={n} x1={p1[0]} y1={p1[1]} x2={p2[0]} y2={p2[1]} stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="6 5" opacity="0.8" />)}
        {/* unit marks on the three front edges */}
        {Array.from({ length: h + 1 }, (_, k) => { const p = P(l, w, k); return <line key={'h' + k} x1={p[0] - 5} y1={p[1]} x2={p[0] + 5} y2={p[1]} stroke="#fbbf24" strokeWidth="2" />; })}
        {Array.from({ length: l + 1 }, (_, i) => { const p = P(i, w, 0); return <circle key={'l' + i} cx={p[0]} cy={p[1]} r="2.5" fill="#fbbf24" />; })}
        {Array.from({ length: w + 1 }, (_, j) => { const p = P(l, j, 0); return <circle key={'w' + j} cx={p[0]} cy={p[1]} r="2.5" fill="#fbbf24" />; })}
      </g>
    );
  };

  const btn = (id, x, y, label, onClick, dim, w = 52) => (
    <g id={id} onClick={dim ? undefined : onClick} style={{ cursor: dim ? 'default' : 'pointer' }} opacity={dim ? 0.35 : 1}>
      <rect x={x} y={y} width={w} height="44" rx="10" fill="#334155" stroke="#64748b" strokeWidth="2" />
      <text x={x + w / 2} y={y + 29} textAnchor="middle" fontSize="18" fill="#e2e8f0">{label}</text>
    </g>
  );
  const PX = 452; // right-hand control column
  const card = (y, h) => <rect x={PX - 12} y={y} width={W - PX - 2} height={h} rx="14" fill="#1e293b" stroke="#475569" strokeWidth="2" />;

  if (mode === 'pack') {
    const cubes = [];
    base.forEach(key => { const [i, j] = key.split('-').map(Number); for (let k = 0; k < layers; k++) cubes.push([i, j, k]); });
    const toggle = key => setBase(b => (b.includes(key) ? b.filter(x => x !== key) : [...b, key]));
    return (
      <Panel title="Cube Crate" caption="Tap a floor square to put a cube on it. Tap − or + to stack layers or set the sign.">
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', userSelect: 'none' }}>
          <rect width={W} height={H} fill="#0f172a" />
          {Array.from({ length: L }, (_, i) => Array.from({ length: Wd }, (_, j) => {
            const key = i + '-' + j;
            return <polygon key={'c' + key} id={'cell-' + key} points={poly([P(i, j, 0), P(i + 1, j, 0), P(i + 1, j + 1, 0), P(i, j + 1, 0)])} fill="#1e293b" stroke="#475569" strokeWidth="1.5" onClick={() => toggle(key)} style={{ cursor: 'pointer' }} />;
          }))}
          {sorted(cubes).map(([i, j, k]) => cube(i, j, k, `q${i}-${j}-${k}`, { onClick: () => toggle(i + '-' + j), style: { cursor: 'pointer' } }))}
          {boxEdges(L, Wd, Hh, 'box')}

          {card(30, 122)}
          <text x={PX + 6} y={60} fontSize="16" fill="#cbd5e1">Layers of cubes</text>
          {btn('layer-minus', PX + 6, 78, '−', () => setLayers(n => Math.max(1, n - 1)), layers <= 1 || !base.length)}
          <text x={PX + 104} y={107} textAnchor="middle" fontSize="22" fontWeight="700" fill="#e2e8f0">{base.length ? layers : 0}</text>
          {btn('layer-plus', PX + 146, 78, '+', () => setLayers(n => Math.min(maxLayers, n + 1)), layers >= maxLayers || !base.length)}
          {maxLayers < Hh && <text x={PX + 6} y={142} fontSize="13" fill="#94a3b8">{`Only enough cubes for ${maxLayers} layer${maxLayers > 1 ? 's' : ''}.`}</text>}

          {card(160, 190)}
          <text x={PX + 6} y={192} fontSize="16" fill="#cbd5e1">Volume of the crate</text>
          <rect x={PX + 50} y={206} width="110" height="52" rx="10" fill="none" stroke="#475569" strokeWidth="2" strokeDasharray="6 5" />
          <text x={PX + 105} y={242} textAnchor="middle" fontSize="28" fontWeight="700" fill="#22d3ee">{sign === 0 ? '?' : sign}</text>
          <text x={PX + 105} y={278} textAnchor="middle" fontSize="14" fill="#94a3b8">cubic units</text>
          {btn('sign-minus10', PX - 2, 290, '−10', () => setSign(s => Math.max(0, s - 10)), sign < 10, 48)}
          {btn('sign-minus', PX + 50, 290, '−1', () => setSign(s => Math.max(0, s - 1)), sign < 1, 48)}
          {btn('sign-plus', PX + 102, 290, '+1', () => setSign(s => Math.min(400, s + 1)), false, 48)}
          {btn('sign-plus10', PX + 154, 290, '+10', () => setSign(s => Math.min(400, s + 10)), false, 48)}
        </svg>
      </Panel>
    );
  }

  // design: the child sets the box's length, width and height and it fills with cubes
  const cubes = [];
  for (let i = 0; i < dims.l; i++) for (let j = 0; j < dims.w; j++) for (let k = 0; k < dims.h; k++) cubes.push([i, j, k]);
  const set = (key, d, max) => setDims(x => ({ ...x, [key]: Math.max(1, Math.min(max, x[key] + d)) }));
  const rows = [['l', 'Length', 8], ['w', 'Width', 8], ['h', 'Height', 6]].filter(r => !(fixedH && r[0] === 'h'));
  const refTop = 30, refH = ref ? 150 : 0;
  return (
    <Panel title="Cube Crate" caption="Tap − or + to make the crate longer, wider or taller.">
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', userSelect: 'none' }}>
        <rect width={W} height={H} fill="#0f172a" />
        {Array.from({ length: dims.l }, (_, i) => Array.from({ length: dims.w }, (_, j) => (
          <polygon key={'f' + i + j} points={poly([P(i, j, 0), P(i + 1, j, 0), P(i + 1, j + 1, 0), P(i, j + 1, 0)])} fill="#1e293b" stroke="#475569" strokeWidth="1.5" />
        )))}
        {sorted(cubes).map(([i, j, k]) => cube(i, j, k, `d${i}-${j}-${k}`))}
        {boxEdges(dims.l, dims.w, dims.h, "box", true)}

        {ref && (
          <g>
            {card(refTop, refH)}
            <text x={PX + 6} y={refTop + 26} fontSize="16" fill="#cbd5e1">Grey crate</text>
            {(() => {
              const s = 16, ox = PX + 92, oy = refTop + 70 + ref[2] * 4;
              const list = [];
              for (let i = 0; i < ref[0]; i++) for (let j = 0; j < ref[1]; j++) for (let k = 0; k < ref[2]; k++) list.push([i, j, k]);
              return sorted(list).map(([i, j, k]) => cube(i, j, k, `r${i}-${j}-${k}`, {}, s, ox, oy, true));
            })()}
          </g>
        )}
        {card(refTop + refH + (ref ? 14 : 0), rows.length * 64 + 24 + (fixedH ? 30 : 0))}
        {rows.map(([key, name, max], r) => {
          const y = refTop + refH + (ref ? 14 : 0) + 18 + r * 64;
          return (
            <g key={key}>
              <text x={PX + 6} y={y + 28} fontSize="16" fill="#cbd5e1">{name}</text>
              {btn(key + '-minus', PX + 70, y, '−', () => set(key, -1, max), dims[key] <= 1, 44)}
              <text x={PX + 140} y={y + 30} textAnchor="middle" fontSize="22" fontWeight="700" fill="#e2e8f0">{dims[key]}</text>
              {btn(key + '-plus', PX + 162, y, '+', () => set(key, 1, max), dims[key] >= max, 44)}
            </g>
          );
        })}
        {fixedH ? <text x={PX + 6} y={refTop + refH + (ref ? 14 : 0) + 18 + rows.length * 64 + 18} fontSize="15" fill="#94a3b8">{`Height is set: ${fixedH}`}</text> : null}
      </svg>
    </Panel>
  );
}
