// Parts and whole (K.OA.A.3, 1.OA.B.4). A number bond the child works with real counters: the whole is printed on
// top, the part to leave out on the left, a cup on the right. Tapping a counter hides it under the cup; tapping the
// cup takes one back out. No counter is ever made or lost, so the whole stays while the parts trade. The child makes
// the left part, then says how many are under the cup. Nothing shows that number: the tray packs its counters with no
// cells (an empty cell would count the hidden ones) and the cup looks the same full or empty.
function Display({ params, lumina }) {
  const whole = Number(params.whole) || 5;
  const part = Number.isFinite(Number(params.part)) ? Number(params.part) : 4;
  const startOut = Number.isFinite(Number(params.startOut)) ? Number(params.startOut) : whole;
  const ids = Array.from({ length: whole }, (_, i) => i);
  // Counters outside the cup, in tray order; the rest are under the cup, last hidden on top.
  const [out, setOut] = useState(() => ids.slice(0, startOut));
  const [under, setUnder] = useState(() => ids.slice(startOut));

  const answer = whole - part;
  useEffect(() => {
    const startUnder = whole - startOut;
    const candidates = [
      { says: whole, because: 'said how many in all, not how many are under the cup' },
      { says: part, because: 'said how many can be seen, not how many are under the cup' },
      ...(startUnder > 0 ? [{ says: startUnder, because: 'kept the number under the cup from the start: when the seen part changes, the hidden part changes by the same amount' }] : []),
    ];
    const misrules = candidates.filter((m, i) => m.says !== answer && candidates.findIndex(c => c.says === m.says) === i);
    lumina.answer(answer, misrules);
  }, []);
  useEffect(() => {
    lumina.goal(out.length === part);
    lumina.scene({ countersInAll: whole, numberOnTheLeft: part, countersYouCanSee: out.length, cup: 'covers the rest of the counters' });
  }, [out]);

  const hide = id => {
    if (!out.includes(id)) return;
    setOut(o => o.filter(x => x !== id));
    setUnder(u => [...u, id]);
  };
  const takeOut = () => {
    if (!under.length) return;
    const id = under[under.length - 1];
    setUnder(u => u.slice(0, -1));
    setOut(o => [...o, id]);
  };

  const TRAY = { x: 30, y: 188, w: 340, h: 136 };
  const CUP = { cx: 515, top: 196, bottom: 318 };
  const at = id => {
    const k = out.indexOf(id);
    if (k < 0) return { x: CUP.cx, y: 280 };
    return { x: TRAY.x + 50 + (k % 5) * 60, y: TRAY.y + 38 + Math.floor(k / 5) * 60 };
  };
  const bondNode = (x, y, r, text, size) => (
    <g>
      <circle cx={x} cy={y} r={r} fill="#1e293b" stroke="#64748b" strokeWidth="3" />
      <text x={x} y={y + 2} textAnchor="middle" dominantBaseline="middle" fontSize={size} fontWeight="800" fill="#e2e8f0">{text}</text>
    </g>
  );

  return (
    <Panel title="Cup and Counters" caption="Tap a counter to hide it under the cup. Tap the cup to take one out.">
      <svg viewBox="0 0 680 340" style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <rect width="680" height="340" fill="#0f172a" />
        <line x1="340" y1="60" x2="200" y2="130" stroke="#64748b" strokeWidth="4" />
        <line x1="340" y1="60" x2="515" y2="130" stroke="#64748b" strokeWidth="4" />
        {bondNode(340, 56, 42, whole, 44)}
        {bondNode(200, 140, 34, part, 36)}
        {bondNode(515, 140, 34, '?', 36)}
        <rect x={TRAY.x} y={TRAY.y} width={TRAY.w} height={TRAY.h} rx="16" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        {ids.map(id => {
          const p = at(id), isOut = out.includes(id);
          return (
            <g key={id} id={isOut ? 'counter-' + id : undefined} onPointerDown={() => hide(id)}
              style={{ transform: 'translate(' + p.x + 'px, ' + p.y + 'px)', transition: 'transform 320ms ease', cursor: isOut ? 'pointer' : 'default', pointerEvents: isOut ? 'auto' : 'none' }}>
              <circle r="25" fill="#fb7185" stroke="#fecdd3" strokeWidth="3" />
            </g>
          );
        })}
        <g id="cup" onPointerDown={takeOut} style={{ cursor: 'pointer' }}>
          <path d={'M ' + (CUP.cx - 62) + ' ' + CUP.top + ' L ' + (CUP.cx + 62) + ' ' + CUP.top + ' L ' + (CUP.cx + 92) + ' ' + CUP.bottom + ' L ' + (CUP.cx - 92) + ' ' + CUP.bottom + ' Z'}
            fill="#818cf8" stroke="#c7d2fe" strokeWidth="3" strokeLinejoin="round" />
          <rect x={CUP.cx - 98} y={CUP.bottom - 8} width="196" height="16" rx="8" fill="#a5b4fc" stroke="#c7d2fe" strokeWidth="2" />
          <rect x={CUP.cx - 22} y={CUP.top - 18} width="44" height="20" rx="8" fill="#a5b4fc" stroke="#c7d2fe" strokeWidth="2" />
        </g>
      </svg>
    </Panel>
  );
}
