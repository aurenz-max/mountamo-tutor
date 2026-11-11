function Display({ params, lumina }) {
  // A hill is a centre, a height in metres, a reach in map units to the east, west, north and south, and a profile:
  // [distance from the centre as a share of the reach, height as a share of the top], from [0, 1] down to [1, 0].
  const hills = params?.hills ?? [{ name: 'the hill', cx: 340, cy: 205, height: 60, e: 200, w: 170, n: 150, s: 150, profile: [[0, 1], [1, 0]] }];
  const find = params?.find ?? 'top'; // 'top' | 'steepest' | 'flat'
  const interval = params?.interval ?? 10;
  const labelEvery = params?.labelEvery ?? 1;
  const markerKind = params?.marker ?? 'flag';
  const minHeight = params?.minHeight ?? 0;

  const W = 680, H = 420, START = { x: 36, y: 392 };
  const [pos, setPos] = useState(START);
  const [placed, setPlaced] = useState(false);

  const shareOf = (hl, x, y) => {
    const dx = x - hl.cx, dy = y - hl.cy;
    const rx = dx >= 0 ? hl.e : hl.w, ry = dy <= 0 ? hl.n : hl.s;
    return Math.sqrt((dx / rx) * (dx / rx) + (dy / ry) * (dy / ry));
  };
  const heightShare = (profile, t) => {
    if (t >= 1) return 0;
    for (let i = 0; i < profile.length - 1; i++) {
      const a = profile[i], b = profile[i + 1];
      if (t <= b[0]) return a[1] + ((b[1] - a[1]) * (t - a[0])) / (b[0] - a[0]);
    }
    return 0;
  };
  const shareAtHeight = (profile, f) => {
    for (let i = 0; i < profile.length - 1; i++) {
      const a = profile[i], b = profile[i + 1];
      if (f <= a[1] && f >= b[1]) return a[1] === b[1] ? a[0] : a[0] + ((b[0] - a[0]) * (a[1] - f)) / (a[1] - b[1]);
    }
    return 1;
  };
  const hillHeight = (hl, x, y) => hl.height * heightShare(hl.profile, shareOf(hl, x, y));
  const heightAt = (x, y) => Math.max(0, ...hills.map((hl) => hillHeight(hl, x, y)));
  // Steepness: the largest change in height over a short step in any of 16 directions.
  const slopeAt = (x, y) => {
    const here = heightAt(x, y), d = 3;
    let most = 0;
    for (let k = 0; k < 16; k++) {
      const a = (k * Math.PI) / 8;
      most = Math.max(most, Math.abs(heightAt(x + d * Math.cos(a), y + d * Math.sin(a)) - here) / d);
    }
    return most;
  };

  const map = useMemo(() => {
    let steepest = 0, flattest = Infinity, topLine = 0;
    for (const hl of hills) for (let L = interval; L < hl.height; L += interval) topLine = Math.max(topLine, L);
    for (let x = 6; x < W; x += 6) for (let y = 6; y < H; y += 6) {
      const h = heightAt(x, y);
      if (h <= 0) continue;
      const s = slopeAt(x, y);
      steepest = Math.max(steepest, s);
      if (h > minHeight) flattest = Math.min(flattest, s);
    }
    return { steepest, flattest, topLine };
  }, [hills, interval, minHeight]);

  const lines = useMemo(() => hills.flatMap((hl, hi) => {
    const widest = [['e', 1, 0], ['w', -1, 0], ['n', 0, -1], ['s', 0, 1]].sort((a, b) => hl[b[0]] - hl[a[0]])[0];
    const out = [];
    for (let L = interval; L < hl.height; L += interval) {
      const t = shareAtHeight(hl.profile, L / hl.height);
      const pts = [];
      for (let k = 0; k < 96; k++) {
        const a = (k * Math.PI) / 48, c = Math.cos(a), s = Math.sin(a);
        pts.push((hl.cx + t * (c >= 0 ? hl.e : hl.w) * c).toFixed(1) + ',' + (hl.cy + t * (s <= 0 ? hl.n : hl.s) * s).toFixed(1));
      }
      const index = Math.round(L / interval) % labelEvery === 0;
      out.push({ key: hi + '-' + L, L, index, points: pts.join(' '), lx: hl.cx + t * hl[widest[0]] * widest[1], ly: hl.cy + t * hl[widest[0]] * widest[2] });
    }
    return out;
  }), [hills, interval, labelEvery]);

  const spots = useMemo(() => {
    const out = [];
    for (let x = 20; x < W; x += 20) for (let y = 20; y < H; y += 20) out.push({ x, y });
    return out;
  }, []);

  const here = heightAt(pos.x, pos.y);
  const onHill = hills.find((hl) => hillHeight(hl, pos.x, pos.y) > 0 && hillHeight(hl, pos.x, pos.y) === here);

  useEffect(() => {
    const steep = slopeAt(pos.x, pos.y);
    const met = !placed ? false
      : find === 'top' ? here >= map.topLine
      : find === 'steepest' ? steep >= 0.9 * map.steepest
      : here > minHeight && steep <= 1.5 * map.flattest;
    lumina.goal(met);
    let side = null;
    if (onHill) {
      const dx = (pos.x - onHill.cx) / (pos.x >= onHill.cx ? onHill.e : onHill.w), dy = (pos.y - onHill.cy) / (pos.y <= onHill.cy ? onHill.n : onHill.s);
      side = Math.abs(dx) < 0.12 && Math.abs(dy) < 0.12 ? 'middle' : Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'east side' : 'west side') : (dy < 0 ? 'north side' : 'south side');
    }
    lumina.scene({
      hillsOnMap: hills.length,
      metresBetweenLines: interval,
      linesLabelled: labelEvery === 1 ? 'every line' : 'every ' + labelEvery + ' lines',
      hills: hills.map((hl) => ({ name: hl.name, lines: Math.ceil(hl.height / interval) - 1 })),
      marker: markerKind,
      markerIsOnTheMap: placed,
      markerOn: !placed ? 'the corner, not placed yet' : onHill ? onHill.name : 'ground outside the lines',
      markerSide: side,
      linesAroundMarker: onHill ? Math.floor(here / interval) : 0,
    });
  }, [pos, placed, find, hills, interval, labelEvery, minHeight, map]);

  const move = ({ x, y }) => {
    setPos({ x: Math.max(14, Math.min(W - 14, x)), y: Math.max(14, Math.min(H - 14, y)) });
    setPlaced(true);
  };

  return (
    <Panel title="Contour Map" caption={'Drag the ' + markerKind + ' onto the map.'}>
      <Stack gap={10}>
        <div style={{ width: '100%', background: '#1e293b', borderRadius: 12, overflow: 'hidden' }}>
          <svg viewBox={'0 0 ' + W + ' ' + H} style={{ width: '100%', display: 'block', userSelect: 'none', touchAction: 'none' }}>
            {lines.map((ln) => (
              <polygon key={ln.key} points={ln.points} fill="none" stroke="#d6b88a" strokeWidth={ln.index && labelEvery > 1 ? 2.6 : 1.4} />
            ))}
            {lines.filter((ln) => ln.index).map((ln) => (
              <g key={'t' + ln.key}>
                <rect x={ln.lx - 13} y={ln.ly - 8} width={26} height={16} rx={3} fill="#1e293b" />
                <text x={ln.lx} y={ln.ly + 4} fill="#f1f5f9" fontSize="12" fontWeight="600" textAnchor="middle">{ln.L}</text>
              </g>
            ))}
            {spots.map((p) => (
              <circle key={p.x + '-' + p.y} id={'spot-' + p.x + '-' + p.y} cx={p.x} cy={p.y} r="1" fill="transparent" pointerEvents="none" />
            ))}
            <Handle id="marker" x={pos.x} y={pos.y} r={24} onDrag={move} onDrop={move}>
              {markerKind === 'tent' ? (
                <g>
                  <path d="M -16 8 L 0 -18 L 16 8 Z" fill="#fbbf24" stroke="#f8fafc" strokeWidth="2" strokeLinejoin="round" />
                  <path d="M 0 -18 L 0 8" stroke="#0f172a" strokeWidth="2" />
                  <circle cx="0" cy="0" r="3" fill="#f8fafc" />
                </g>
              ) : (
                <g>
                  <line x1="0" y1="0" x2="0" y2="-26" stroke="#f8fafc" strokeWidth="3" strokeLinecap="round" />
                  <path d="M 0 -26 L 20 -19 L 0 -12 Z" fill="#22d3ee" stroke="#f8fafc" strokeWidth="1.5" strokeLinejoin="round" />
                  <circle cx="0" cy="0" r="4" fill="#f8fafc" />
                </g>
              )}
            </Handle>
          </svg>
        </div>
        <div style={{ color: '#cbd5e1', fontSize: 14, lineHeight: 1.4 }}>
          <b style={{ color: '#d6b88a' }}>Key:</b> each line joins ground at one height. The number on a line is its height in metres. From one line to the next, the height changes by {interval} m.
          {labelEvery > 1 ? ' Only the thick lines have numbers.' : ''}
        </div>
      </Stack>
    </Panel>
  );
}
