function Display({ params, lumina }) {
  // A stream of five stretches that ends in a lake. Each stretch has ground (steep or gentle, from params) and a width
  // (narrow, middle or wide) the child sets by dragging its bank. The water's speed in a stretch is
  // ground + width + the day's flow. A grain comes to rest in the first stretch where the water is too slow to carry
  // it: pebbles need the fastest water, sand less, silt the least. Everything that is still carried ends in the lake.
  const N = 5;
  const terrain = Array.isArray(params?.terrain) ? params.terrain : ['gentle', 'gentle', 'gentle', 'gentle', 'gentle'];
  const startWidths = Array.isArray(params?.startWidths) ? params.startWidths : ['middle', 'middle', 'middle', 'middle', 'middle'];
  const grains = Array.isArray(params?.grains) ? params.grains : ['sand'];
  const marks = Array.isArray(params?.marks) ? params.marks : [{ at: 3, grain: 'sand' }];
  const banksFixed = params?.banksFixed === true;
  const days = Math.max(1, Math.min(3, params?.days ?? 1));
  const layerOrder = Array.isArray(params?.layerOrder) ? params.layerOrder : null;

  const WIDTHS = ['narrow', 'middle', 'wide'];
  const HALF = { narrow: 14, middle: 28, wide: 48 };
  const WIDTH_PUSH = { narrow: 2, middle: 1, wide: 0 };
  const GROUND_PUSH = { steep: 2, gentle: 1 };
  const FLOWS = ['low', 'normal', 'high', 'flood'];
  const FLOW_PUSH = { low: -1, normal: 0, high: 1, flood: 2 };
  // The slowest water that still carries each grain size: below it, the grain settles.
  const CARRY = { pebbles: 4, sand: 3, silt: 2 };
  const LOOK = {
    pebbles: { color: '#94a3b8', r: 6, n: 6, dx: -24 },
    sand: { color: '#fcd34d', r: 3.5, n: 10, dx: 0 },
    silt: { color: '#e0c29c', r: 2.7, n: 14, dx: 24 },
  };

  const [widths, setWidths] = useState(() => Array.from({ length: N }, (_, i) => (WIDTHS.includes(startWidths[i]) ? startWidths[i] : 'middle')));
  const [flows, setFlows] = useState(() => Array.from({ length: days }, () => 'normal'));
  const [run, setRun] = useState(null);
  const [progress, setProgress] = useState(0);

  const speedAt = (i, flow) => GROUND_PUSH[terrain[i] === 'steep' ? 'steep' : 'gentle'] + WIDTH_PUSH[widths[i]] + FLOW_PUSH[flow];
  const restOf = (grain, flow) => {
    for (let i = 0; i < N; i++) if (speedAt(i, flow) < CARRY[grain]) return i;
    return N; // the lake
  };

  const runWater = () => {
    const perDay = flows.map(flow => {
      const rest = {};
      grains.forEach(g => { rest[g] = restOf(g, flow); });
      return rest;
    });
    setRun({ perDay, id: Date.now() });
    setProgress(0);
  };

  // Settle animation: about 0.8 s per day.
  useEffect(() => {
    if (!run) return undefined;
    let raf = 0;
    const start = performance.now();
    const step = now => {
      const p = Math.min(days, (now - start) / 800);
      setProgress(p);
      if (p < days) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [run]);

  const changeWidth = (i, w) => {
    if (w === widths[i]) return;
    setWidths(prev => prev.map((v, j) => (j === i ? w : v)));
    setRun(null);
  };
  const changeFlow = (d, f) => {
    if (f === flows[d]) return;
    setFlows(prev => prev.map((v, j) => (j === d ? f : v)));
    setRun(null);
  };

  const flagAt = layerOrder ? (marks[0]?.at ?? 4) - 1 : -1;
  const layers = run && layerOrder ? run.perDay.flatMap(rest => grains.filter(g => rest[g] === flagAt)) : [];

  const met = useMemo(() => {
    if (!run) return false;
    if (layerOrder) return layers.length === layerOrder.length && layers.every((g, k) => g === layerOrder[k]);
    const rest = run.perDay[0];
    const named = marks.filter(m => m.grain);
    if (!named.every(m => rest[m.grain] === m.at - 1)) return false;
    const open = marks.filter(m => !m.grain).map(m => m.at - 1).sort();
    const left = grains.filter(g => !named.some(m => m.grain === g)).map(g => rest[g]).sort();
    return open.length === left.length && open.every((v, k) => v === left[k]);
  }, [run, layers]);

  const settled = run && progress >= days;
  const placeName = i => (i >= N ? 'the lake' : `stretch ${i + 1}`);
  const speedWord = s => (s >= 5 ? 'rushing' : s === 4 ? 'very fast' : s === 3 ? 'fast' : s === 2 ? 'slow' : 'very slow');

  useEffect(() => {
    lumina.goal(met);
    const scene = {
      stretches: widths.map((w, i) => {
        const fact = { stretch: i + 1, ground: terrain[i] === 'steep' ? 'steep' : 'gentle', width: w };
        fact[days > 1 ? 'waterOnDay1' : 'water'] = speedWord(speedAt(i, flows[0]));
        const m = marks.find(mk => mk.at === i + 1);
        if (m) fact.flag = m.label || m.grain || 'flag';
        return fact;
      }),
      grainsPoured: grains,
    };
    if (days > 1) scene.flowByDay = flows;
    if (!run) scene.lastRun = 'not run since the last change';
    else if (!settled) scene.lastRun = 'the water is running';
    else if (layerOrder) {
      scene.lastRun = run.perDay.map((rest, d) => `day ${d + 1}: ` + grains.map(g => `${g} in ${placeName(rest[g])}`).join(', '));
      scene.layersAtFlagBottomToTop = layers;
    } else {
      const rest = run.perDay[0];
      scene.lastRun = grains.map(g => `${g} came to rest in ${placeName(rest[g])}`);
    }
    lumina.scene(scene);
  }, [met, widths, flows, run, settled]);

  // --- drawing ---
  const X0 = 60, SW = 100, CY = 100, LAKE_X = X0 + N * SW;
  const midX = i => (i >= N ? LAKE_X + 60 : X0 + i * SW + SW / 2);
  const halfOf = i => HALF[widths[i]];

  const bankPath = sign => {
    const pts = [];
    for (let i = 0; i < N; i++) {
      const y = CY + sign * halfOf(i);
      pts.push(`${X0 + i * SW + 10},${y}`, `${X0 + (i + 1) * SW - 10},${y}`);
    }
    return pts;
  };
  const top = bankPath(-1), bottom = bankPath(1).reverse();
  const channel = [`${X0 - 40},${CY - 16}`, `${X0},${CY - halfOf(0)}`, ...top, `${LAKE_X + 4},${CY - halfOf(N - 1)}`, `${LAKE_X + 4},${CY + halfOf(N - 1)}`, ...bottom, `${X0},${CY + halfOf(0)}`, `${X0 - 40},${CY + 16}`].join(' ');

  const cluster = (grain, cx, cy, spreadY, seed) => {
    const look = LOOK[grain];
    const out = [];
    for (let k = 0; k < look.n; k++) {
      const a = Math.sin(seed * 12.9 + k * 78.2) * 43758.5;
      const b = Math.sin(seed * 39.3 + k * 11.7) * 24634.6;
      const fx = (a - Math.floor(a)) * 2 - 1, fy = (b - Math.floor(b)) * 2 - 1;
      out.push(<circle key={`${grain}-${seed}-${k}`} cx={cx + fx * 12} cy={cy + fy * spreadY} r={look.r} fill={look.color} stroke="#0f172a" strokeWidth="0.8" />);
    }
    return out;
  };

  const grainDots = [];
  if (run) {
    run.perDay.forEach((rest, d) => {
      const f = progress - d;
      if (f <= 0) return;
      grains.forEach((g, gi) => {
        const restX = midX(rest[g]) + LOOK[g].dx;
        const t = Math.min(1, f);
        const ease = 1 - Math.pow(1 - t, 3);
        const x = 20 + (restX - 20) * ease;
        const spread = rest[g] >= N ? 26 : Math.max(5, halfOf(Math.min(rest[g], N - 1)) - 7);
        const y = rest[g] >= N ? CY + (d - 1) * 10 : CY + (d - 1) * 4;
        grainDots.push(...cluster(g, x, y, t < 1 ? 4 : spread, d * 7 + gi + 1));
      });
    });
  }

  // The arrows show the water of the day that is running, or of day 1 before a run.
  const flowNow = run && progress < days ? flows[Math.min(days - 1, Math.floor(progress))] : flows[0];
  const chevrons = [];
  for (let i = 0; i < N; i++) {
    const s = Math.max(1, speedAt(i, flowNow));
    for (let k = 0; k < s; k++) {
      const x = X0 + i * SW + SW / 2 + (k - (s - 1) / 2) * 13;
      chevrons.push(<path key={`ch-${i}-${k}`} d={`M ${x - 4} ${CY - 6} L ${x + 3} ${CY} L ${x - 4} ${CY + 6}`} fill="none" stroke="#bae6fd" strokeWidth="2" opacity="0.55" />);
    }
  }

  // Side view: the ground drops more on a steep stretch.
  const units = terrain.slice(0, N).reduce((a, t) => a + (t === 'steep' ? 2 : 1), 0);
  const ground = [];
  let gy = 205;
  ground.push(`${X0},${gy}`);
  for (let i = 0; i < N; i++) {
    gy += ((terrain[i] === 'steep' ? 2 : 1) / units) * 34;
    ground.push(`${X0 + (i + 1) * SW},${gy}`);
  }
  const groundEnd = gy;

  const LEVEL_Y = { flood: 26, high: 54, normal: 82, low: 110 };
  const dayX = d => 150 + d * 110;
  const snapFlow = y => FLOWS.reduce((best, f) => (Math.abs(LEVEL_Y[f] - y) < Math.abs(LEVEL_Y[best] - y) ? f : best), 'normal');
  const snapWidth = (i, y) => {
    const half = CY - y;
    return half < 21 ? 'narrow' : half < 38 ? 'middle' : 'wide';
  };

  const shownLayers = run && layerOrder ? run.perDay.slice(0, Math.floor(progress + 1e-6)).flatMap(rest => grains.filter(g => rest[g] === flagAt)) : [];

  return (
    <Panel
      title="Stream Table"
      caption={banksFixed ? 'Drag each day’s dot to set how much water flows that day. Then run the water.' : 'Drag a bank to make that part of the stream wider or narrower. Then run the water.'}
    >
      <Stack gap={10}>
        <svg viewBox="0 0 680 255" style={{ width: '100%', height: 'auto', background: '#13261a', borderRadius: 12, touchAction: 'none', userSelect: 'none' }}>
          {Array.from({ length: N }).map((_, i) => (
            <text key={`n-${i}`} x={midX(i)} y={22} fill="#94a3b8" fontSize="13" textAnchor="middle">{`stretch ${i + 1}`}</text>
          ))}
          <rect x={LAKE_X} y={34} width={680 - LAKE_X - 6} height={132} rx={30} fill="#075985" />
          <text x={LAKE_X + 60} y={50} fill="#e0f2fe" fontSize="14" textAnchor="middle" fontWeight="600">lake</text>
          <polygon points={channel} fill="#0369a1" />
          {chevrons}
          <rect x={4} y={CY - 22} width={44} height={44} rx={8} fill="#57534e" stroke="#a8a29e" />
          <text x={26} y={CY + 40} fill="#e7e5e4" fontSize="12" textAnchor="middle">grains</text>
          <text x={26} y={CY + 54} fill="#e7e5e4" fontSize="12" textAnchor="middle">pour in</text>
          {marks.map((m, k) => {
            const i = m.at - 1;
            const x = midX(i) + 30;
            const yTop = CY + halfOf(i) + 4;
            const label = m.label || (m.grain ? m.grain : String.fromCharCode(65 + k));
            return (
              <g key={`flag-${k}`}>
                <line x1={x} y1={yTop} x2={x} y2={yTop + 40} stroke="#e2e8f0" strokeWidth="2" />
                <path d={`M ${x} ${yTop} L ${x - 34} ${yTop + 8} L ${x} ${yTop + 16} Z`} fill="#f472b6" />
                <text x={x - 6} y={yTop + 36} fill="#fbcfe8" fontSize="14" fontWeight="700" textAnchor="end">{label}</text>
              </g>
            );
          })}
          {grainDots}
          {!banksFixed && widths.map((w, i) => (
            <Handle key={`bank-${i}`} id={`bank-${i + 1}`} x={midX(i) - 18} y={CY - halfOf(i)} r={13}
              onDrag={p => changeWidth(i, snapWidth(i, p.y))} onDrop={p => changeWidth(i, snapWidth(i, p.y))}>
              <g>
                <circle r="13" fill="#a16207" stroke="#fef3c7" strokeWidth="2" />
                <path d="M -5 -3 L 0 -8 L 5 -3 M -5 3 L 0 8 L 5 3" fill="none" stroke="#fef3c7" strokeWidth="2" />
              </g>
            </Handle>
          ))}
          <text x={8} y={196} fill="#94a3b8" fontSize="12">side view</text>
          <polygon points={`${X0},255 ${ground.join(' ')} 676,${groundEnd} 676,255`} fill="#3f3a2e" />
          <polyline points={ground.join(' ')} fill="none" stroke="#7dd3fc" strokeWidth="3" />
          <line x1={LAKE_X} y1={groundEnd} x2={676} y2={groundEnd} stroke="#7dd3fc" strokeWidth="3" />
          {terrain.slice(0, N).map((t, i) => (
            <text key={`t-${i}`} x={midX(i)} y={248} fill="#e7e5e4" fontSize="13" textAnchor="middle">{t === 'steep' ? 'steep' : 'gentle'}</text>
          ))}
        </svg>

        {days > 1 && (
          <svg viewBox="0 0 680 150" style={{ width: '100%', height: 'auto', background: '#111c2e', borderRadius: 12, touchAction: 'none', userSelect: 'none' }}>
            <text x={16} y={16} fill="#94a3b8" fontSize="12">water flow each day</text>
            {FLOWS.map(f => (
              <g key={`lv-${f}`}>
                <line x1={88} y1={LEVEL_Y[f]} x2={400} y2={LEVEL_Y[f]} stroke="#1e3a5f" strokeWidth="1" />
                <text x={80} y={LEVEL_Y[f] + 5} fill="#cbd5e1" fontSize="13" textAnchor="end">{f}</text>
              </g>
            ))}
            <polyline points={flows.map((f, d) => `${dayX(d)},${LEVEL_Y[f]}`).join(' ')} fill="none" stroke="#38bdf8" strokeWidth="3" />
            {flows.map((f, d) => (
              <g key={`day-${d}`}>
                <text x={dayX(d)} y={140} fill="#cbd5e1" fontSize="13" textAnchor="middle">{`Day ${d + 1}`}</text>
                <Handle id={`flow-day-${d + 1}`} x={dayX(d)} y={LEVEL_Y[f]} r={13} color="cyan"
                  onDrag={p => changeFlow(d, snapFlow(p.y))} onDrop={p => changeFlow(d, snapFlow(p.y))} />
              </g>
            ))}
            <text x={560} y={16} fill="#94a3b8" fontSize="12" textAnchor="middle">at the flag, side view</text>
            <rect x={470} y={24} width={180} height={116} rx={6} fill="#0b1324" stroke="#334155" />
            {shownLayers.map((g, k) => (
              <g key={`layer-${k}`}>
                <rect x={472} y={138 - (k + 1) * 34} width={176} height={33} fill={LOOK[g].color} opacity="0.85" />
                <text x={560} y={138 - k * 34 - 12} fill="#0f172a" fontSize="14" fontWeight="700" textAnchor="middle">{g}</text>
              </g>
            ))}
          </svg>
        )}

        <Row gap={14}>
          <button id="run-water" type="button" onClick={runWater}
            style={{ minHeight: 44, minWidth: 150, padding: '8px 18px', borderRadius: 10, border: '1px solid #38bdf8', background: '#0c4a6e', color: '#f0f9ff', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>
            Run the water
          </button>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 18 }}>
            {grains.map(g => (
              <span key={`key-${g}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#e2e8f0', fontSize: 15 }}>
                <svg width="18" height="18" viewBox="-9 -9 18 18"><circle r={Math.min(8, LOOK[g].r + 1.5)} fill={LOOK[g].color} /></svg>
                {g}
              </span>
            ))}
          </span>
        </Row>
      </Stack>
    </Panel>
  );
}
