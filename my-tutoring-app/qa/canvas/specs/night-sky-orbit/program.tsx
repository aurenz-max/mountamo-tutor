function Display({ params, lumina }) {
  // A top-down model: the Sun in the middle, Earth on a round path, star patterns far out around the edge.
  // Angles are degrees clockwise from the top of the picture (12 o'clock = 0, 3 o'clock = 90).
  // params.patterns: [{ name, at }] where at is the pattern's angle; params.earthStart: Earth's angle at rest;
  // params.earthSize: Earth's radius in px; params.find: 'night' (every target in the night sky) or 'day'
  // (every target up in the daytime sky, on the Sun side); params.targets: pattern names the ask names.
  const patterns = (Array.isArray(params?.patterns) && params.patterns.length ? params.patterns : [
    { name: 'Lion', at: 0 }, { name: 'Swan', at: 90 }, { name: 'Horse', at: 180 }, { name: 'Hunter', at: 270 },
  ]).slice(0, 4);
  const earthStart = typeof params?.earthStart === 'number' ? params.earthStart : 210;
  const earthSize = typeof params?.earthSize === 'number' ? params.earthSize : 22;
  const find = params?.find === 'day' ? 'day' : 'night';
  const targets = Array.isArray(params?.targets) && params.targets.length ? params.targets : [patterns[0].name];

  // A pattern is in the night sky when its direction is within TOL degrees of straight out from Earth's dark side
  // (the stars are treated as very far away, so only the directions matter). It is up in the daytime sky when it
  // is within TOL degrees of the direction to the Sun.
  const TOL = 45;
  const W = 680, H = 520, CX = 340, CY = 260, ORBIT = 120, FAR = 190;

  const [deg, setDeg] = useState(((earthStart % 360) + 360) % 360);

  const norm = (a) => ((a % 360) + 360) % 360;
  const apart = (a, b) => { const d = Math.abs(norm(a) - norm(b)); return d > 180 ? 360 - d : d; };
  const pointAt = (a, r) => ({ x: CX + r * Math.sin((a * Math.PI) / 180), y: CY - r * Math.cos((a * Math.PI) / 180) });
  const clock = (a) => {
    const h = norm(a) / 30;
    const near = Math.round(h);
    const name = (n) => String(((n + 11) % 12) + 1);
    if (Math.abs(h - near) * 30 <= 7.5) return name(near) + " o'clock";
    return 'between ' + name(Math.floor(h)) + ' and ' + name(Math.floor(h) + 1) + " o'clock";
  };

  const earth = pointAt(deg, ORBIT);

  useEffect(() => {
    const byName = Object.fromEntries(patterns.map((p) => [p.name, p]));
    const met = targets.every((n) => {
      const p = byName[n];
      if (!p) return false;
      return find === 'night' ? apart(p.at, deg) <= TOL : apart(p.at, deg + 180) <= TOL;
    });
    lumina.goal(met);
    lumina.scene({
      view: 'from above: the Sun in the middle, Earth on a round path around it, star patterns far out around the edge',
      earthOnPath: clock(deg),
      earthBrightHalf: 'faces the Sun',
      earthDarkHalf: 'faces away from the Sun, out toward ' + clock(deg),
      starPatterns: patterns.map((p) => ({ name: p.name, at: clock(p.at) })),
    });
  }, [deg]);

  const move = ({ x, y }) => {
    const a = (Math.atan2(x - CX, -(y - CY)) * 180) / Math.PI;
    setDeg(norm(a));
  };

  // Star pictures, stars as [x, y] and lines as [i, j], drawn about the pattern's centre.
  const SHAPES = {
    Hunter: { stars: [[-12, -20], [12, -18], [-5, 0], [0, 1], [5, 2], [-14, 22], [14, 20], [0, -30]], lines: [[0, 1], [0, 2], [1, 4], [2, 3], [3, 4], [2, 5], [4, 6], [0, 7], [1, 7]] },
    Lion: { stars: [[-24, -10], [-18, -20], [-10, -12], [4, -8], [20, -6], [28, 4], [-10, 14], [18, 14]], lines: [[0, 1], [1, 2], [0, 2], [2, 3], [3, 4], [4, 5], [2, 6], [4, 7]] },
    Swan: { stars: [[0, -26], [0, -10], [0, 4], [0, 22], [-24, -6], [-11, -4], [11, -4], [24, -6]], lines: [[0, 1], [1, 2], [2, 3], [4, 5], [5, 2], [2, 6], [6, 7]] },
    Horse: { stars: [[-12, -4], [14, -4], [14, 12], [-12, 12], [-20, -18], [-30, -12], [-12, 26], [14, 26]], lines: [[0, 1], [1, 2], [2, 3], [3, 0], [0, 4], [4, 5], [3, 6], [2, 7]] },
  };
  const fallback = { stars: [[-16, -10], [0, -18], [16, -8], [8, 12], [-10, 14]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0]] };

  // Earth: a dark disc with the half that faces the Sun lit. The lit half is the right half of the disc, turned
  // so that its right points at the Sun.
  const sunward = (Math.atan2(CY - earth.y, CX - earth.x) * 180) / Math.PI;
  const R = earthSize;

  const spots = [];
  for (let a = 0; a < 360; a += 15) spots.push({ a, ...pointAt(a, ORBIT) });

  return (
    <Panel title="Night Sky" caption="Drag Earth along its path.">
      <div style={{ width: '100%', background: '#0b1226', borderRadius: 12, overflow: 'hidden' }}>
        <svg viewBox={'0 0 ' + W + ' ' + H} style={{ width: '100%', display: 'block', userSelect: 'none', touchAction: 'none' }}>
          <circle cx={CX} cy={CY} r={ORBIT} fill="none" stroke="#475569" strokeWidth="2.5" strokeDasharray="6 8" />

          <g>
            {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
              const p1 = pointAt(a, 38), p2 = pointAt(a, 52);
              return <line key={a} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#fbbf24" strokeWidth="4" strokeLinecap="round" />;
            })}
            <circle cx={CX} cy={CY} r="30" fill="#fbbf24" stroke="#fde68a" strokeWidth="3" />
            <text x={CX} y={CY + 6} fill="#78350f" fontSize="17" fontWeight="700" textAnchor="middle">Sun</text>
          </g>

          {patterns.map((p) => {
            const c = pointAt(p.at, FAR);
            const shape = SHAPES[p.name] || fallback;
            return (
              <g key={p.name} id={'pattern-' + p.name.toLowerCase()}>
                {shape.lines.map(([i, j], k) => (
                  <line key={k} x1={c.x + shape.stars[i][0]} y1={c.y + shape.stars[i][1]} x2={c.x + shape.stars[j][0]} y2={c.y + shape.stars[j][1]} stroke="#64748b" strokeWidth="1.6" />
                ))}
                {shape.stars.map(([x, y], k) => (
                  <circle key={k} cx={c.x + x} cy={c.y + y} r={k % 3 === 0 ? 3.2 : 2.5} fill="#f1f5f9" />
                ))}
                <text x={c.x} y={c.y < CY - FAR / 2 ? c.y - 34 : c.y + 46} fill="#e2e8f0" fontSize="17" fontWeight="600" textAnchor="middle">{p.name}</text>
              </g>
            );
          })}

          {spots.map((s) => (
            <circle key={s.a} id={'spot-' + s.a} cx={s.x} cy={s.y} r="1" fill="transparent" pointerEvents="none" />
          ))}

          <Handle id="earth" x={earth.x} y={earth.y} r={Math.max(R, 22)} onDrag={move} onDrop={move}>
            <g transform={'rotate(' + sunward + ')'}>
              <circle cx="0" cy="0" r={R} fill="#111827" stroke="#94a3b8" strokeWidth="2" />
              <path d={'M 0 ' + -R + ' A ' + R + ' ' + R + ' 0 0 1 0 ' + R + ' Z'} fill="#60a5fa" />
              <path d={'M ' + R * 0.15 + ' ' + -R * 0.45 + ' q ' + R * 0.35 + ' ' + R * 0.1 + ' ' + R * 0.4 + ' ' + R * 0.5 + ' q ' + -R * 0.2 + ' ' + R * 0.3 + ' ' + -R * 0.4 + ' ' + R * 0.15 + ' Z'} fill="#4ade80" />
              <line x1="0" y1={-R} x2="0" y2={R} stroke="#cbd5e1" strokeWidth="1.5" />
            </g>
          </Handle>
        </svg>
      </div>
    </Panel>
  );
}
