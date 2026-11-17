// Hour hand (1.MD.B.3). A clock face with numbers, ticks and two hands, and no digital readout. The child turns the
// long hand (drag its knob, or tap an arrow for five minutes) and the short hand creeps along with it. The ask names a
// place for the long hand, never the hour. The rule: the hour is the number the short hand has passed, not the number
// it is nearest. Say and show: the hour is one sayable number; Check judges that the clock shows the target time.
// Transfer (`oldClock`): an old clock beside the child's has lost its long hand; the child sets their own clock to the
// same time (within five minutes) by turning the long hand until the short hands agree, then names the hour.
function Display({ params, lumina }) {
  const parse = (s, d) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(s ?? ''));
    return m ? (Number(m[1]) % 12) * 60 + Number(m[2]) : d;
  };
  const start = parse(params.start, 240), target = parse(params.target, 270);
  const oldClock = params.oldClock === true || params.oldClock === 'true';
  const DAY = 720, mod = (v, n) => ((v % n) + n) % n;

  const [total, setTotal] = useState(start);
  const [held, setHeld] = useState(false);
  const last = useRef(0);
  const svgRef = useRef(null);

  const hourName = (h) => (h === 0 ? 12 : h);
  const passed = (t) => hourName(Math.floor(mod(t, DAY) / 60));

  useEffect(() => {
    const key = passed(target), min = mod(target, 60);
    const nearest = hourName(mod(Math.round(mod(target, DAY) / 60), 12));
    const misrules = [
      { says: nearest, because: 'named the number the short hand is nearest or heading to, not the one it has passed' },
      !oldClock && min % 5 === 0 ? { says: min === 0 ? 12 : min / 5, because: 'read the number the long hand points to' } : null,
      min > 0 && min < 30 ? { says: hourName(mod(key - 1, 12)), because: 'took the number before the one the short hand has just passed' } : null,
    ].filter((m, i, all) => m && m.says !== key && all.findIndex(x => x && x.says === m.says) === i).slice(0, 3);
    lumina.answer(key, misrules);
  }, []);

  const shown = Math.round(total);
  useEffect(() => {
    const diff = Math.abs(mod(shown - target + DAY / 2, DAY) - DAY / 2);
    lumina.goal(!held && (oldClock ? diff <= 5 : diff === 0));
    const handFacts = (t) => {
      const min = mod(t, 60), h = Math.floor(mod(t, DAY) / 60);
      return min === 0 ? { shortHandOn: hourName(h) } : { shortHandBetween: [hourName(h), hourName(mod(h + 1, 12))] };
    };
    const min = mod(shown, 60);
    lumina.scene({
      yourClockLongHandPointsAt: min % 5 === 0 ? (min === 0 ? 12 : min / 5) : 'between two numbers',
      yourClock: handFacts(shown),
      ...(oldClock ? { oldClockHasLongHand: false, oldClock: handFacts(target) } : {}),
      digitalReadout: false,
    });
  }, [shown, held]);

  // Layout: one clock in the middle, or the child's clock on the left and the old clock on the right.
  const C = oldClock ? { x: 210, y: 200, r: 145 } : { x: 340, y: 200, r: 150 };
  const O = { x: 520, y: 200, r: 120 };
  const polar = (c, minutes, len) => {
    const a = (minutes / 60) * 2 * Math.PI;
    return { x: c.x + Math.sin(a) * len, y: c.y - Math.cos(a) * len };
  };
  const angleMin = (p) => {
    const a = Math.atan2(p.x - C.x, -(p.y - C.y));
    return mod((a * 180) / Math.PI, 360) / 6;
  };

  const down = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    last.current = angleMin(svgPoint(svgRef.current, e));
    setHeld(true);
  };
  const move = (e) => {
    if (!held) return;
    const m = angleMin(svgPoint(svgRef.current, e));
    let d = m - last.current;
    if (d > 30) d -= 60;
    if (d <= -30) d += 60;
    last.current = m;
    setTotal((t) => t + d);
  };
  const up = () => {
    if (!held) return;
    setHeld(false);
    setTotal((t) => Math.round(t / 5) * 5);
  };
  const turn = (by) => setTotal((t) => Math.round(t / 5) * 5 + by);

  const face = (c) => (
    <g>
      <circle cx={c.x} cy={c.y} r={c.r + 8} fill="#334155" stroke="#64748b" strokeWidth="3" />
      <circle cx={c.x} cy={c.y} r={c.r} fill="#f1f5f9" />
      {Array.from({ length: 60 }, (_, i) => {
        const big = i % 5 === 0, a = polar(c, i, c.r - 3), b = polar(c, i, c.r - (big ? 16 : 9));
        return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#334155" strokeWidth={big ? 3.5 : 1.5} />;
      })}
    </g>
  );
  const numerals = (c, idPrefix) => (
    <g pointerEvents="none">
      {Array.from({ length: 12 }, (_, i) => {
        const n = i + 1, p = polar(c, n * 5, c.r * 0.7);
        return (
          <text key={n} id={idPrefix ? idPrefix + n : undefined} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central"
            fontSize={c.r > 130 ? 27 : 23} fontWeight="700" fill="#0f172a">{n}</text>
        );
      })}
    </g>
  );
  const shortHand = (c, t) => {
    const tip = polar(c, (mod(t, DAY) / DAY) * 60, c.r * 0.5);
    return <line x1={c.x} y1={c.y} x2={tip.x} y2={tip.y} stroke="#0f172a" strokeWidth="11" strokeLinecap="round" pointerEvents="none" />;
  };

  const longLen = C.r * 0.97;
  const longTip = polar(C, mod(total, 60), longLen);
  const arrow = (id, x, sign, label, by, anchor, lx) => (
    <g>
      <g id={id} onPointerDown={() => turn(by)} style={{ cursor: 'pointer' }}>
        <circle cx={x} cy="392" r="26" fill="#1e293b" stroke="#64748b" strokeWidth="2" />
        <text x={x} y="393" textAnchor="middle" dominantBaseline="central" fontSize="30" fill="#e2e8f0">{sign}</text>
      </g>
      <text x={lx} y="393" textAnchor={anchor} dominantBaseline="central" fontSize="16" fill="#cbd5e1">{label}</text>
    </g>
  );

  return (
    <Panel title="Turn the Clock" caption="Drag the long hand around the clock, or tap an arrow to turn it.">
      <svg ref={svgRef} viewBox="0 0 680 424" style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <rect width="680" height="424" fill="#0f172a" />

        {oldClock && <text x={C.x} y="24" textAnchor="middle" fontSize="17" fill="#cbd5e1">Your clock</text>}
        {face(C)}
        {shortHand(C, shown)}
        <line x1={C.x} y1={C.y} x2={longTip.x} y2={longTip.y} stroke="#0e7490" strokeWidth="6" strokeLinecap="round" pointerEvents="none" />
        <circle cx={C.x} cy={C.y} r="9" fill="#0f172a" pointerEvents="none" />
        {numerals(C, 'num-')}
        <g id="minute-tip" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} style={{ cursor: held ? 'grabbing' : 'grab', touchAction: 'none' }}>
          <circle cx={longTip.x} cy={longTip.y} r="28" fill="transparent" />
          <circle cx={longTip.x} cy={longTip.y} r="13" fill="#22d3ee" stroke="#0e7490" strokeWidth="3" />
        </g>

        {arrow('back', C.x - 62, '↺', 'back', -5, 'end', C.x - 98)}
        {arrow('forward', C.x + 62, '↻', 'forward', 5, 'start', C.x + 98)}

        {oldClock && (
          <g pointerEvents="none">
            <text x={O.x} y="54" textAnchor="middle" fontSize="17" fill="#cbd5e1">Old clock</text>
            {face(O)}
            {shortHand(O, target)}
            {numerals(O, null)}
            <circle cx={O.x} cy={O.y} r="8" fill="#0f172a" />
          </g>
        )}
      </svg>
    </Panel>
  );
}
