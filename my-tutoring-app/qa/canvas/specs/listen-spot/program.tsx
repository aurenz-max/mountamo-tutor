function Display({ params, lumina }) {
  // A friend far away makes a sound: in the air, under the water of a pond, or by tapping a post that bars run from.
  // The child drags an ear from the tray to a spot on their side of the scene. Whether the sound arrives there is
  // computed from what the sound travels through and how far, and nothing on screen shows it before Check.
  //
  // params.source: 'air' | 'water' | 'post'   where the sound is made
  // params.strength: 'soft' | 'loud'           a tap or click is soft, a call is loud
  // params.pond: boolean                       a pond across the scene (needed for source 'water')
  // params.bars: [{ material: 'metal' | 'wood' | 'hay' }], 0-2 bars lying from the tapped post across the scene
  const source = ['air', 'water', 'post'].includes(params.source) ? params.source : 'post';
  const strength = params.strength === 'loud' ? 'loud' : 'soft';
  const pond = params.pond === undefined ? source === 'water' : !!params.pond;
  const bars = (Array.isArray(params.bars) ? params.bars : (source === 'post' ? [{ material: 'metal' }] : []))
    .filter(b => b && ['metal', 'wood', 'hay'].includes(b.material)).slice(0, 2);

  // ---------- layout ----------
  const W = 680, GROUND = 250, H = 470;
  // A friend who is not in the water stands on the bank, so the pond starts after them.
  const POND = { x1: source === 'water' ? 30 : 170, x2: 650, top: GROUND, bottom: GROUND + 120 };
  const SRC_X = 80;
  const ZONE_X = 330; // the child's side starts here
  const TRAY = { x: W / 2, y: 430 };
  // Metal and hay lie on the ground; a wooden rail is a fence rail on legs. A second bar on the same level sits above.
  const level = m => (m === 'wood' ? 1 : 0);
  const barY = i => {
    const base = level(bars[i].material) ? GROUND - 66 : GROUND - 15;
    return base - (bars.slice(0, i).some(b => level(b.material) === level(bars[i].material)) ? 46 : 0);
  };
  const BAR_X1 = SRC_X + 16, BAR_X2 = 655;
  const srcY = source === 'water' ? GROUND + 70 : source === 'air' ? GROUND - 22 : GROUND - 40;

  // ---------- the model ----------
  // Loss per 100 px of travel in each material, and a big loss where sound passes from one material into another
  // (water into air, a bar into air). A sound is heard where what arrives is at least HEARD.
  const LOSS = { air: 0.25, water: 0.06, metal: 0.02, wood: 0.07, hay: 0.6 };
  const START = { soft: 1.0, loud: 2.0 };
  const BOUNDARY = 1.2, HEARD = 0.5;
  const MAT_WORD = { metal: 'metal rail', wood: 'wooden fence rail', hay: 'row of hay bales' };

  const [ear, setEar] = useState(null); // { x, y } or null when in the tray
  const [drag, setDrag] = useState(null); // { x, y } while dragging
  const svgRef = useRef(null);

  const mediumAt = p => {
    if (!p) return null;
    const bi = bars.findIndex((b, i) => p.x >= BAR_X1 && p.x <= BAR_X2 && Math.abs(p.y - barY(i)) <= 18);
    if (bi >= 0) return { kind: 'bar', index: bi, material: bars[bi].material };
    if (pond && p.y > POND.top + 4 && p.x >= POND.x1 && p.x <= POND.x2) return { kind: 'water', material: 'water' };
    return { kind: 'air', material: 'air' };
  };
  const arrives = p => {
    const m = mediumAt(p);
    if (!m) return 0;
    const d = Math.max(0, p.x - SRC_X) / 100;
    const same = (source === 'air' && m.kind === 'air') || (source === 'water' && m.kind === 'water')
      || (source === 'post' && m.kind === 'bar');
    return same ? START[strength] - LOSS[m.material] * d : START[strength] - BOUNDARY - LOSS.air * d;
  };
  const goalMet = !!ear && arrives(ear) >= HEARD;

  const earMedium = mediumAt(ear);
  useEffect(() => {
    lumina.goal(goalMet);
    lumina.scene({
      friend: source === 'water' ? 'under the water of the pond, clicking two stones'
        : source === 'air' ? 'standing in the air across the pond, calling out'
          : 'tapping a post with a stone',
      sound: strength === 'loud' ? 'a loud call' : 'a soft tap',
      pond: pond ? 'a pond runs across the scene' : 'no pond',
      bars: bars.map(b => `a ${MAT_WORD[b.material]} lying from the post across the scene`),
      ear: !ear ? 'in the tray'
        : earMedium.kind === 'bar' ? `pressed to the ${MAT_WORD[earMedium.material]}`
          : earMedium.kind === 'water' ? 'under the water' : 'in the air',
      earDistance: ear ? (ear.x > 500 ? 'far from the friend' : 'on the near edge of your side') : 'not placed',
    });
  }, [goalMet, ear && ear.x, ear && ear.y]);

  const clampToSide = pt => {
    const maxY = pond && pt.x >= POND.x1 && pt.x <= POND.x2 ? POND.bottom - 20 : GROUND - 8;
    return { x: Math.min(W - 26, Math.max(ZONE_X + 24, pt.x)), y: Math.min(maxY, Math.max(40, pt.y)) };
  };
  const onDown = e => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = svgPoint(svgRef.current, e);
    setDrag({ x: pt.x, y: pt.y });
  };
  const onMove = e => {
    if (!drag || !svgRef.current) return;
    const pt = svgPoint(svgRef.current, e);
    setDrag({ x: pt.x, y: pt.y });
  };
  const onUp = e => {
    if (!drag || !svgRef.current) return;
    const pt = svgPoint(svgRef.current, e);
    setDrag(null);
    if (pt.y > GROUND + 140 && !(pond && pt.y < POND.bottom)) { setEar(null); return; } // back to the tray
    if (pt.x < ZONE_X - 10) { setEar(null); return; }
    setEar(clampToSide(pt));
  };

  // ---------- pictures ----------
  const barPic = (b, i) => {
    const y = barY(i);
    const len = BAR_X2 - BAR_X1;
    if (b.material === 'metal') return (
      <g key={`bar-${i}`} id={`bar-${i + 1}`}>
        <rect x={BAR_X1} y={y - 7} width={len} height="14" rx="2" fill="url(#steel)" stroke="#334155" strokeWidth="2" />
        {Array.from({ length: 9 }, (_, j) => <rect key={j} x={BAR_X1 + 20 + j * 62} y={y + 7} width="26" height="6" fill="#57534e" />)}
      </g>
    );
    if (b.material === 'wood') return (
      <g key={`bar-${i}`}>
        {Array.from({ length: 6 }, (_, j) => <rect key={j} x={BAR_X1 + 40 + j * 100} y={y + 9} width="10" height={GROUND - y - 9} fill="#92400e" />)}
        <g id={`bar-${i + 1}`}>
          <rect x={BAR_X1} y={y - 9} width={len} height="18" rx="3" fill="#b45309" stroke="#78350f" strokeWidth="2" />
          <path d={`M ${BAR_X1 + 10} ${y - 2} H ${BAR_X2 - 10}`} stroke="#92400e" strokeWidth="2" />
        </g>
      </g>
    );
    const n = Math.round(len / 46);
    return (
      <g key={`bar-${i}`} id={`bar-${i + 1}`}>
        {Array.from({ length: n }, (_, j) => (
          <g key={j}>
            <rect x={BAR_X1 + j * (len / n) + 2} y={y - 14} width={len / n - 4} height="28" rx="9" fill="#eab308" stroke="#a16207" strokeWidth="2" />
            <path d={`M ${BAR_X1 + j * (len / n) + 10} ${y - 5} h ${len / n - 20} M ${BAR_X1 + j * (len / n) + 10} ${y + 5} h ${len / n - 20}`}
              stroke="#a16207" strokeWidth="1.5" />
          </g>
        ))}
      </g>
    );
  };

  const friend = () => {
    if (source === 'water') return (
      <g>
        <text x={SRC_X} y={srcY + 16} textAnchor="middle" fontSize="42">🧒</text>
        <text x={SRC_X + 2} y={srcY - 6} textAnchor="middle" fontSize="22">🤿</text>
        <text x={SRC_X + 36} y={srcY + 24} textAnchor="middle" fontSize="20">🪨</text>
        {[0, 1, 2].map(j => <circle key={j} cx={SRC_X + 8 + j * 6} cy={srcY - 30 - j * 14} r={3 + j} fill="none" stroke="#bfdbfe" strokeWidth="1.5" />)}
      </g>
    );
    if (source === 'air') return (
      <g>
        <text x={SRC_X} y={srcY + 16} textAnchor="middle" fontSize="46">🧒</text>
        <path d={`M ${SRC_X + 26} ${srcY - 22} q 10 -8 20 0 M ${SRC_X + 30} ${srcY - 32} q 14 -12 28 0`} stroke="#fde68a" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      </g>
    );
    return (
      <g>
        <rect x={SRC_X - 8} y={GROUND - 110} width="16" height="110" rx="3" fill="#78716c" stroke="#d6d3d1" strokeWidth="2" />
        <text x={SRC_X - 36} y={GROUND - 66} textAnchor="middle" fontSize="40">🧒</text>
        <text x={SRC_X - 14} y={GROUND - 92} textAnchor="middle" fontSize="18">🪨</text>
      </g>
    );
  };

  const earPic = (p, key) => (
    <g key={key} id="ear" transform={`translate(${p.x}, ${p.y})`} style={{ cursor: 'grab', touchAction: 'none' }}
      onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={() => setDrag(null)}>
      <circle r="26" fill="rgba(15,23,42,0.75)" stroke="#e2e8f0" strokeWidth="2.5" />
      <text y="10" textAnchor="middle" fontSize="28">👂</text>
    </g>
  );
  const earAt = drag ? drag : ear ? ear : TRAY;

  return (
    <Panel>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} onPointerMove={onMove}
        style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <defs>
          <linearGradient id="steel" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#e2e8f0" />
            <stop offset="0.5" stopColor="#94a3b8" />
            <stop offset="1" stopColor="#64748b" />
          </linearGradient>
        </defs>
        {/* sky and ground */}
        <rect id="sky" x="0" y="0" width={W} height={GROUND} rx="12" fill="#0b1224" />
        <rect x="0" y={GROUND} width={W} height={150} fill="#3f2d1d" />
        <rect x="0" y={GROUND} width={W} height="8" fill="#166534" />
        {pond && (
          <g>
            <rect id="pond" x={POND.x1} y={POND.top} width={POND.x2 - POND.x1} height={POND.bottom - POND.top} rx="10" fill="#1d4ed8" opacity="0.85" />
            <path d={`M ${POND.x1 + 10} ${POND.top + 6} q 20 -6 40 0` + ' t 40 0'.repeat(Math.max(0, Math.floor((POND.x2 - POND.x1 - 20) / 40) - 1))}
              stroke="#93c5fd" strokeWidth="2" fill="none" />
          </g>
        )}
        {bars.map(barPic)}
        {friend()}
        {/* the child's side */}
        <line x1={ZONE_X} y1="14" x2={ZONE_X} y2={GROUND + 136} stroke="#fbbf24" strokeWidth="2" strokeDasharray="8 6" />
        <text id="side-label" x={ZONE_X + 12} y="34" fill="#fde68a" fontSize="16" fontWeight="600">your side →</text>
        {/* the tray */}
        <rect x="0" y={GROUND + 150} width={W} height={H - GROUND - 156} rx="12" fill="rgba(30,41,59,0.6)" stroke="#334155" strokeDasharray="5 5" />
        {!ear && !drag && <text x={TRAY.x + 40} y={TRAY.y + 6} fill="#e2e8f0" fontSize="15" fontWeight="600">your ear</text>}
        {earPic(earAt, 'ear')}
      </svg>
    </Panel>
  );
}
