function Display({ params, lumina }) {
  const target = Number(params?.target ?? 7);
  const pushLimit = Number(params?.pushLimit ?? 1);
  const start = params?.start ?? [0, 0];
  const topTen = params?.topTen ?? false;
  const showCard = params?.showCard ?? true;
  const flashMs = Number(params?.flashMs ?? 0);
  const flashRows = params?.flashRows ?? [0, 0];

  // left[r] = how many beads of row r sit on the left of the wire. Bead i (0 = leftmost) is on the left when i < left[r].
  const [left, setLeft] = useState([Number(start[0]) || 0, Number(start[1]) || 0]);
  const [pushes, setPushes] = useState(0);
  const [flashUp, setFlashUp] = useState(flashMs > 0);

  useEffect(() => {
    if (flashMs <= 0) return undefined;
    const t = setTimeout(() => setFlashUp(false), flashMs);
    return () => clearTimeout(t);
  }, [flashMs]);

  useEffect(() => {
    const total = left[0] + left[1];
    lumina.goal(total === target && pushes <= pushLimit && (!topTen || left[0] === 10));
    const scene = {
      beadsOnLeftTopRow: left[0],
      beadsOnLeftBottomRow: left[1],
      pushesUsed: pushes,
      pushesAllowed: pushLimit,
    };
    if (showCard && flashMs <= 0) scene.numberCard = target;
    if (flashMs > 0) {
      scene.picturedRackCard = flashUp ? 'showing' : 'turned over';
      if (flashUp) { scene.cardTopRow = flashRows[0]; scene.cardBottomRow = flashRows[1]; }
    }
    lumina.scene(scene);
  }, [left, pushes, flashUp]);

  const tap = (r, i) => {
    const next = i >= left[r] ? i + 1 : i;
    if (next === left[r]) return;
    setLeft((l) => (r === 0 ? [next, l[1]] : [l[0], next]));
    setPushes((p) => p + 1);
  };

  const D = 44; // bead spacing: beads touch within a group
  const R = 22; // bead radius: 44px target
  const WIRE_L = 60;
  const WIRE_R = 620;
  const ROW_Y = [172, 262];
  const beadX = (r, i) => (i < left[r] ? WIRE_L + R + 2 + i * D : WIRE_R - R - 2 - (9 - i) * D);

  const bead = (r, i) => {
    const red = i < 5;
    return (
      <g
        key={r + '-' + i}
        id={'bead-' + r + '-' + i}
        onClick={() => tap(r, i)}
        style={{ cursor: 'pointer', transform: 'translate(' + beadX(r, i) + 'px,' + ROW_Y[r] + 'px)', transition: 'transform .25s ease' }}
      >
        <circle r={R} fill={red ? '#dc2626' : '#f1f5f9'} stroke={red ? '#7f1d1d' : '#94a3b8'} strokeWidth="2" />
        <ellipse cx="-7" cy="-8" rx="7" ry="4" fill="#ffffff" opacity={red ? 0.35 : 0.8} />
      </g>
    );
  };

  const miniRack = (x, y) => (
    <g>
      <rect x={x} y={y} width="270" height="70" rx="12" fill="#1e293b" stroke="#475569" strokeWidth="2" />
      {flashUp ? [0, 1].map((r) => (
        <g key={r}>
          <line x1={x + 12} x2={x + 258} y1={y + 23 + r * 24} y2={y + 23 + r * 24} stroke="#64748b" strokeWidth="2" />
          {Array.from({ length: 10 }, (_, i) => {
            const on = i < flashRows[r];
            const cx = on ? x + 22 + i * 15 : x + 248 - (9 - i) * 15;
            return <circle key={i} cx={cx} cy={y + 23 + r * 24} r="7" fill={i < 5 ? '#dc2626' : '#f1f5f9'} />;
          })}
        </g>
      )) : (
        <text x={x + 135} y={y + 45} textAnchor="middle" fontSize="30" fill="#94a3b8">?</text>
      )}
    </g>
  );

  return (
    <Panel title="Bead Rack" caption="Tap a bead to slide it, with the beads beside it, along the wire.">
      <svg viewBox="0 0 680 320" style={{ width: '100%', height: 'auto', display: 'block', userSelect: 'none' }}>
        <rect width="680" height="320" fill="#0f172a" />

        {flashMs > 0 ? miniRack(30, 16) : showCard ? (
          <g id="number-card">
            <rect x="30" y="16" width="110" height="80" rx="12" fill="#1e293b" stroke="#475569" strokeWidth="2" />
            <text x="85" y="72" textAnchor="middle" fontSize="44" fontWeight="800" fill="#e2e8f0">{target}</text>
          </g>
        ) : null}

        <g id="pushes">
          <text x={650} y="34" textAnchor="end" fontSize="14" fill="#94a3b8">pushes</text>
          {Array.from({ length: pushLimit }, (_, k) => (
            <text key={k} x={650 - (pushLimit - 1 - k) * 40 - 16} y="80" textAnchor="middle" fontSize="32" opacity={k < pushes ? 0.22 : 1}>✋</text>
          ))}
        </g>

        <rect x="40" y="122" width="600" height="190" rx="14" fill="#7c4a24" stroke="#4a2c14" strokeWidth="3" />
        <rect x="58" y="136" width="564" height="162" rx="8" fill="#1e293b" />
        {ROW_Y.map((y) => <line key={y} x1={WIRE_L - 12} x2={WIRE_R + 12} y1={y} y2={y} stroke="#94a3b8" strokeWidth="4" />)}
        {[0, 1].map((r) => Array.from({ length: 10 }, (_, i) => bead(r, i)))}
      </svg>
    </Panel>
  );
}
