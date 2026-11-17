// Push the Crate (3-PS2-1). A crate sits on smooth ice, still or already sliding. Pushers stand at its two sides:
// a pusher on the left pushes it to the right, a pusher on the right pushes it to the left. The pushers differ in
// body size (a mouse, a kid, a robot, a bear), and body size is not how hard they push. Above the crate each pusher
// has a push arrow on a track marked 1 to 8; the child drags the arrow's end to set how hard that pusher pushes.
// The rule: balanced pushes do not change the crate's motion (still stays still, sliding keeps sliding at the same
// speed); unbalanced pushes change it toward the stronger side. Nothing moves on screen: the child commits from the
// rule, then says what happens. Check judges the pushes set; the tutor judges the said motion.
// Named misrules, computed per problem: a moving thing needs a push to keep moving (a sliding crate with balanced
// pushes "stops"), and the bigger pusher always wins (the direction the biggest body pushes).
function Display({ params, lumina }) {
  const KINDS = {
    mouse: { emoji: '🐭', size: 44, rank: 1, body: 'small' },
    kid: { emoji: '🧒', size: 56, rank: 2, body: 'medium' },
    robot: { emoji: '🤖', size: 66, rank: 3, body: 'large' },
    bear: { emoji: '🐻', size: 92, rank: 4, body: 'very large' },
  };
  const MAX = 8;
  const sliding = ['left', 'right'].includes(params.sliding) ? params.sliding : 'none';
  const pushers = (Array.isArray(params.pushers) ? params.pushers : [
    { id: 'bear', side: 'left', push: 3 }, { id: 'kid', side: 'right', push: 3 },
  ]).filter(p => KINDS[p.kind || p.id] && (p.side === 'left' || p.side === 'right')).map(p => ({
    id: p.id, kind: p.kind || p.id, side: p.side, push: Math.max(0, Math.min(MAX, Number(p.push) || 0)), fixed: !!p.fixed,
  }));
  const say = params.say !== false;

  const [L, setL] = useState(() => Object.fromEntries(pushers.map(p => [p.id, p.fixed ? p.push : 0])));
  const [held, setHeld] = useState(null);
  const svgRef = useRef(null);

  // A pusher on the left pushes to the right.
  const dirOf = p => (p.side === 'left' ? 'right' : 'left');
  useEffect(() => {
    if (!say) return;
    const net = pushers.reduce((s, p) => s + (p.side === 'left' ? p.push : -p.push), 0);
    // A sliding crate: the net push along the slide speeds it up, against the slide slows it down.
    const along = sliding === 'right' ? net : -net;
    const moveWord = dir => (sliding === 'none' ? dir : dir === sliding ? 'faster' : 'slower');
    const key = sliding === 'none'
      ? (net > 0 ? 'right' : net < 0 ? 'left' : 'stays the same')
      : (along > 0 ? 'faster' : along < 0 ? 'slower' : 'stays the same');
    const top = Math.max(...pushers.map(p => KINDS[p.kind].rank));
    const biggest = pushers.filter(p => KINDS[p.kind].rank === top);
    const bigDir = biggest.every(p => dirOf(p) === dirOf(biggest[0])) ? dirOf(biggest[0]) : null;
    // A moving thing needs a push to keep moving: with no net push along the slide, the sliding crate stops.
    const needsPush = sliding === 'none' ? null : along > 0 ? 'faster' : 'stops';
    const misrules = [
      needsPush ? { says: needsPush, because: 'thinks a moving thing needs a push to keep moving, so with no push left along the slide the crate stops' } : null,
      bigDir ? { says: moveWord(bigDir), because: 'thinks the bigger pusher always wins, so the crate goes the way the ' + biggest[0].kind + ' pushes' } : null,
    ].filter((m, i, all) => m && m.says !== key && all.findIndex(x => x && x.says === m.says) === i);
    const choices = sliding !== 'none' ? ['faster', 'slower', 'stays the same', 'stops'] : ['left', 'right', 'stays the same'];
    lumina.answer(key, misrules, choices);
  }, []);

  useEffect(() => {
    lumina.goal(pushers.every(p => L[p.id] === p.push));
    lumina.scene({
      floor: 'smooth ice',
      crate: sliding === 'none' ? 'still' : 'already sliding to the ' + sliding,
      pushers: pushers.map(p => ({
        who: p.kind, bodySize: KINDS[p.kind].body, standsOn: 'the ' + p.side + ' side',
        pushesToward: dirOf(p), pushStrength: L[p.id], setBy: p.fixed ? 'already set' : 'the child',
      })),
    });
  }, [L]);

  // Layout: push lanes above, the crate on the ice below. Arrow heads end on the crate's edges (BL, BR).
  const U = 27, BL = 290, BR = 390, TOP = 16, GAP = 74;
  const lanesOf = side => pushers.filter(p => p.side === side);
  const nLanes = Math.max(1, lanesOf('left').length, lanesOf('right').length);
  const laneY = i => TOP + 30 + i * GAP;
  const boxTop = laneY(nLanes - 1) + 70, BOX_H = 96, floorY = boxTop + BOX_H;
  const H = floorY + (sliding === 'none' ? 34 : 70);

  const setFrom = e => {
    if (!held) return;
    const p = pushers.find(q => q.id === held);
    const pt = svgPoint(svgRef.current, e);
    const raw = p.side === 'left' ? (BL - pt.x) / U : (pt.x - BR) / U;
    const v = Math.max(0, Math.min(MAX, Math.round(raw)));
    if (v !== L[p.id]) setL(s => ({ ...s, [p.id]: v }));
  };
  const grab = (p, e) => { if (p.fixed) return; e.currentTarget.setPointerCapture(e.pointerId); setHeld(p.id); };
  const release = e => { if (held) { setFrom(e); setHeld(null); } };

  const lane = (p, i) => {
    const y = laneY(i), left = p.side === 'left', edge = left ? BL : BR, s = left ? -1 : 1;
    const len = L[p.id] * U, tail = edge + s * len, end = edge + s * MAX * U;
    const col = p.fixed ? '#cbd5e1' : '#fbbf24';
    const ticks = [];
    for (let k = 1; k <= MAX; k++) {
      const x = edge + s * k * U;
      ticks.push(
        <g key={k}>
          <line id={i === 0 ? 'tick-' + p.side + '-' + k : undefined} x1={x} y1={y - 6} x2={x} y2={y + 6} stroke="#64748b" strokeWidth="2" />
          <text x={x} y={y + 44} textAnchor="middle" fontSize="15" fill="#94a3b8">{k}</text>
        </g>
      );
    }
    return (
      <g key={p.id}>
        <line x1={edge} y1={y} x2={end} y2={y} stroke="#475569" strokeWidth="3" strokeLinecap="round" />
        {ticks}
        <text x={left ? 30 : 650} y={y + 2} textAnchor="middle" dominantBaseline="middle" fontSize="32">{KINDS[p.kind].emoji}</text>
        {len > 0 ? (
          <g pointerEvents="none">
            <line x1={tail} y1={y} x2={edge - s * 14} y2={y} stroke={col} strokeWidth="9" strokeLinecap="round" />
            <path d={`M ${edge} ${y} L ${edge - s * 20} ${y - 13} L ${edge - s * 20} ${y + 13} Z`} fill={col} />
          </g>
        ) : null}
        {p.fixed ? null : (
          <g id={'push-' + p.id} onPointerDown={e => grab(p, e)} style={{ cursor: 'grab', touchAction: 'none' }}>
            <circle cx={tail} cy={y} r="23" fill={held === p.id ? '#334155' : '#1e293b'} stroke="#64748b" strokeWidth="2.5" />
            <path d={`M ${tail - 7} ${y - 8} L ${tail - 7} ${y + 8} M ${tail} ${y - 8} L ${tail} ${y + 8} M ${tail + 7} ${y - 8} L ${tail + 7} ${y + 8}`} stroke="#e2e8f0" strokeWidth="2.5" strokeLinecap="round" />
          </g>
        )}
      </g>
    );
  };

  // Pushers stand on the ice against the crate, the first one touching it.
  const bodies = side => {
    let edge = side === 'left' ? BL : BR;
    return lanesOf(side).map(p => {
      const k = KINDS[p.kind], w = k.size * 1.02;
      const cx = side === 'left' ? edge - w / 2 - 2 : edge + w / 2 + 2;
      edge = side === 'left' ? edge - w : edge + w;
      return <text key={'body-' + p.id} x={cx} y={floorY - k.size * 0.1} textAnchor="middle" fontSize={k.size}>{k.emoji}</text>;
    });
  };

  const chev = sliding === 'right' ? '›' : '‹';
  return (
    <Panel title="Push the Crate" caption="Drag the end of a push arrow to make that push longer or shorter.">
      <svg ref={svgRef} viewBox={`0 0 680 ${H}`} onPointerMove={setFrom} onPointerUp={release} onPointerCancel={release}
        style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <rect width="680" height={H} fill="#0f172a" />

        <line x1={BL} y1={TOP} x2={BL} y2={boxTop} stroke="#475569" strokeWidth="2" strokeDasharray="6 5" />
        <line x1={BR} y1={TOP} x2={BR} y2={boxTop} stroke="#475569" strokeWidth="2" strokeDasharray="6 5" />

        <rect x="0" y={floorY} width="680" height="26" fill="#bae6fd" opacity="0.85" />
        <path d={`M 40 ${floorY + 9} l 30 0 M 160 ${floorY + 16} l 44 0 M 470 ${floorY + 10} l 36 0 M 590 ${floorY + 17} l 28 0`} stroke="#f0f9ff" strokeWidth="2.5" strokeLinecap="round" />

        <g>
          <rect x={BL} y={boxTop} width={BR - BL} height={BOX_H} rx="4" fill="#a16207" stroke="#713f12" strokeWidth="3" />
          <rect x={BL + 8} y={boxTop + 8} width={BR - BL - 16} height={BOX_H - 16} fill="none" stroke="#713f12" strokeWidth="2.5" />
          <line x1={BL + 8} y1={boxTop + 8} x2={BR - 8} y2={boxTop + BOX_H - 8} stroke="#713f12" strokeWidth="3" />
          <line x1={BR - 8} y1={boxTop + 8} x2={BL + 8} y2={boxTop + BOX_H - 8} stroke="#713f12" strokeWidth="3" />
        </g>
        {bodies('left')}
        {bodies('right')}

        {lanesOf('left').map((p, i) => lane(p, i))}
        {lanesOf('right').map((p, i) => lane(p, i))}

        {sliding !== 'none' ? (
          <text x="340" y={floorY + 52} textAnchor="middle" fontSize="17" fill="#e2e8f0">
            {sliding === 'left' ? chev + chev + chev + '  Already sliding to the left' : 'Already sliding to the right  ' + chev + chev + chev}
          </text>
        ) : null}
      </svg>
    </Panel>
  );
}
