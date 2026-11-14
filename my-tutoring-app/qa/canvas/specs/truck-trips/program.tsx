function Display({ params, lumina }) {
  // A pile of dirt scoops on the left, a dump on the right and a truck between them. Every trip the truck takes one
  // full load (or what is left) from the pile to the dump, so the pile shrinks by a load and a part load left over is
  // still sitting there after the full loads.
  // params.pile: scoops in the pile (1-18).
  // params.mode: 'trips' (the truck is given, the child decides the trips) or 'truck' (the trips are given, the child picks the truck).
  // params.holds: scoops in one load (trips mode).
  // params.book: false = each tap on the truck drives one trip now; true = the child books trips first, then sends the truck.
  // params.rows: draw the pile in rows one load wide (a support); false draws a heap six wide.
  // params.count: show how many scoops are in the pile.
  // params.trips, params.sizes: truck mode only: the trips allowed and the truck sizes offered.
  const pile = Math.max(1, Math.min(18, params.pile ?? 8));
  const mode = params.mode === 'truck' ? 'truck' : 'trips';
  const givenHolds = params.holds ?? 4;
  const fixedTrips = params.trips ?? 3;
  const sizes = Array.isArray(params.sizes) && params.sizes.length ? params.sizes.slice(0, 5) : [2, 3, 4, 5, 6];
  const book = mode === 'truck' ? true : params.book ?? false;
  const rows = params.rows ?? false;
  const count = params.count ?? false;
  const MAX_TRIPS = 6, T = 1000;

  const [holds, setHolds] = useState(mode === 'truck' ? null : givenHolds);
  const [booked, setBooked] = useState(mode === 'truck' ? fixedTrips : 0);
  const [runs, setRuns] = useState([]); // one per trip: { t0, load }
  const [now, setNow] = useState(() => performance.now());

  const lastEnd = runs.length ? runs[runs.length - 1].t0 + T : 0;
  const moving = runs.length > 0 && now < lastEnd;

  useEffect(() => {
    if (!runs.length) return;
    let id = 0;
    const tick = () => {
      const t = performance.now();
      setNow(t);
      if (t < lastEnd) id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [lastEnd]);

  // Everything on screen is worked out from the trips and the clock.
  const sum = list => list.reduce((s, r) => s + r.load, 0);
  const taken = sum(runs.filter(r => now >= r.t0 + 0.15 * T));
  const dumped = sum(runs.filter(r => now >= r.t0 + 0.6 * T));
  const remaining = pile - taken;
  const finished = runs.filter(r => now >= r.t0 + T);
  const driven = finished.length;
  const emptyTrips = finished.filter(r => r.load === 0).length;
  const current = runs.filter(r => now >= r.t0 && now < r.t0 + T).pop() || null;
  const f = current ? (now - current.t0) / T : 0;
  const carrying = current && f >= 0.15 && f < 0.6 ? current.load : 0;
  const along = !current || f < 0.2 ? 0 : f < 0.55 ? (f - 0.2) / 0.35 : f < 0.7 ? 1 : 1 - (f - 0.7) / 0.3;

  const settled = runs.length > 0 && !moving;
  const goalMet = settled && sum(runs) === pile && runs.every(r => r.load > 0)
    && (mode !== 'truck' || holds === Math.ceil(pile / fixedTrips));

  const facts = JSON.stringify({ remaining, dumped, carrying, driven, emptyTrips, moving, booked, holds, goalMet });
  useEffect(() => {
    lumina.goal(goalMet);
    const scene = {
      pile: { scoopsAtStart: pile, scoopsLeftNow: remaining },
      truck: holds == null ? 'no truck picked yet' : { oneLoadIsScoops: holds, carryingNow: carrying, moving },
      dump: { scoops: dumped },
      trips: { driven, drivenWithEmptyTruck: emptyTrips },
    };
    if (book) scene.trips.booked = booked;
    if (mode === 'truck') { scene.truckSizesOffered = sizes; scene.tripsAllowed = fixedTrips; }
    lumina.scene(scene);
  }, [facts]);

  // ---------- what the child does ----------
  const driveOne = () => {
    if (book || moving || holds == null) return;
    const t = performance.now();
    setRuns(prev => prev.concat([{ t0: t, load: Math.min(holds, pile - sum(prev)) }]));
    setNow(t);
  };
  const go = () => {
    if (!book || moving || runs.length || booked < 1 || holds == null) return;
    const t = performance.now();
    let left = pile;
    const next = [];
    for (let i = 0; i < booked; i++) {
      const load = Math.min(holds, left);
      left -= load;
      next.push({ t0: t + i * T, load });
    }
    setRuns(next);
    setNow(t);
  };
  // Changing the plan after a run brings the dirt back, so the new plan is run from a full pile.
  const changeBooked = d => {
    if (moving) return;
    setBooked(b => Math.max(0, Math.min(MAX_TRIPS, b + d)));
    setRuns([]);
  };
  const pickTruck = s => {
    if (moving) return;
    setHolds(s);
    setRuns([]);
  };

  // ---------- the drawing ----------
  const W = 720, GROUND = 300, H = 326;
  const DIRT = '#b45309', DIRT_D = '#78350f';
  const scoop = (x, y, key) => (
    <g key={key}>
      <circle cx={x} cy={y} r="10.5" fill={DIRT} stroke={DIRT_D} strokeWidth="2" />
      <circle cx={x - 3} cy={y - 3} r="2.5" fill="#d97706" />
    </g>
  );

  const pileCols = rows && holds != null ? holds : 6;
  const pileScoops = Array.from({ length: remaining }, (_, i) =>
    scoop(44 + (i % pileCols) * 25, GROUND - 12 - Math.floor(i / pileCols) * 23, 'p' + i));

  const dumpCols = holds != null ? holds : 6;
  const dumpScoops = Array.from({ length: dumped }, (_, i) =>
    scoop(574 + (i % dumpCols) * 23, GROUND - 12 - Math.floor(i / dumpCols) * 23, 'd' + i));

  const slots = holds != null ? holds : 0;
  const bedW = slots * 24 + 10, cabW = 42, truckW = bedW + cabW;
  const tx = 214 + along * (548 - truckW - 214);
  const truck = (
    <g id="truck" onClick={driveOne} style={{ cursor: !book && !moving ? 'pointer' : 'default' }}>
      <rect x={tx - 4} y={GROUND - 72} width={truckW + 8} height="72" fill="transparent" />
      <rect x={tx} y={GROUND - 48} width={bedW} height="32" rx="4" fill="#f59e0b" stroke="#b45309" strokeWidth="2" />
      {Array.from({ length: slots }, (_, i) => (
        i < carrying
          ? scoop(tx + 17 + i * 24, GROUND - 32, 't' + i)
          : <circle key={'t' + i} cx={tx + 17 + i * 24} cy={GROUND - 32} r="10" fill="rgba(15,23,42,0.35)" stroke="#78350f" strokeWidth="1.5" strokeDasharray="3 3" />
      ))}
      <rect x={tx + bedW} y={GROUND - 62} width={cabW} height="46" rx="6" fill="#2563eb" stroke="#1e3a8a" strokeWidth="2" />
      <rect x={tx + bedW + 16} y={GROUND - 55} width="20" height="16" rx="3" fill="#bae6fd" />
      <circle cx={tx + 18} cy={GROUND - 10} r="10" fill="#111827" stroke="#6b7280" strokeWidth="2" />
      <circle cx={tx + bedW + 22} cy={GROUND - 10} r="10" fill="#111827" stroke="#6b7280" strokeWidth="2" />
    </g>
  );

  // The trip board: one small truck per trip. Booked trips are outlines; a trip that has been driven is filled in.
  const boardN = book ? booked : driven;
  const tripMark = i => {
    const x = 26 + i * 58, y = 14, done = i < driven;
    return (
      <g key={'trip' + i} opacity={done ? 1 : 0.9}>
        <rect x={x} y={y + 6} width="28" height="16" rx="3" fill={done ? '#f59e0b' : 'none'} stroke="#f59e0b" strokeWidth="2" strokeDasharray={done ? undefined : '4 3'} />
        <rect x={x + 28} y={y} width="14" height="22" rx="3" fill={done ? '#2563eb' : 'none'} stroke="#60a5fa" strokeWidth="2" strokeDasharray={done ? undefined : '4 3'} />
        <circle cx={x + 8} cy={y + 26} r="4.5" fill={done ? '#cbd5e1' : 'none'} stroke="#cbd5e1" strokeWidth="1.5" />
        <circle cx={x + 34} cy={y + 26} r="4.5" fill={done ? '#cbd5e1' : 'none'} stroke="#cbd5e1" strokeWidth="1.5" />
      </g>
    );
  };

  const btn = (live, wide) => ({
    minWidth: wide ? 110 : 52, height: 52, borderRadius: 12, border: '2px solid ' + (live ? '#fbbf24' : '#334155'),
    background: live ? 'rgba(251,191,36,0.14)' : '#1e293b', color: live ? '#f8fafc' : '#64748b', fontSize: 24, fontWeight: 800,
    cursor: live ? 'pointer' : 'default', padding: '0 12px',
  });
  const canChange = !moving;
  const canGo = book && !moving && !runs.length && booked >= 1 && holds != null;

  const truckChoice = s => {
    const on = holds === s;
    return (
      <button key={s} id={'truck-' + s} type="button" onClick={() => pickTruck(s)}
        style={{ height: 56, borderRadius: 12, border: '2px solid ' + (on ? '#fbbf24' : '#475569'), background: on ? 'rgba(251,191,36,0.14)' : '#1e293b', padding: '0 8px', cursor: canChange ? 'pointer' : 'default', opacity: canChange ? 1 : 0.5 }}>
        <svg width={s * 15 + 26} height="36" viewBox={'0 0 ' + (s * 15 + 26) + ' 36'}>
          <rect x="1" y="6" width={s * 15 + 4} height="18" rx="3" fill="#f59e0b" />
          {Array.from({ length: s }, (_, i) => <circle key={i} cx={10 + i * 15} cy="15" r="5.5" fill="rgba(15,23,42,0.45)" />)}
          <rect x={s * 15 + 5} y="1" width="19" height="23" rx="3" fill="#2563eb" />
          <circle cx="10" cy="29" r="5" fill="#cbd5e1" />
          <circle cx={s * 15 + 14} cy="29" r="5" fill="#cbd5e1" />
        </svg>
      </button>
    );
  };

  return (
    <Panel>
      <svg viewBox={'0 0 ' + W + ' ' + H} style={{ width: '100%', height: 'auto', display: 'block', userSelect: 'none' }}>
        <rect x="0" y="0" width={W} height={GROUND} rx="12" fill="#0b1224" />
        <rect x="0" y={GROUND} width={W} height={H - GROUND} fill="#44403c" />
        <g id="trip-board">{Array.from({ length: boardN }, (_, i) => tripMark(i))}</g>
        <g id="pile">
          {pileScoops}
          {count ? <text id="pile-count" x="106" y={GROUND + 20} textAnchor="middle" fill="#f1f5f9" fontSize="18" fontWeight="700">{remaining}</text> : null}
        </g>
        <g id="dump">
          <path d={'M 558 ' + (GROUND - 150) + ' L 558 ' + GROUND + ' L 712 ' + GROUND + ' L 712 ' + (GROUND - 150)} fill="rgba(148,163,184,0.06)" stroke="#64748b" strokeWidth="3" />
          {dumpScoops}
        </g>
        {holds != null ? truck : null}
      </svg>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, minHeight: 64, marginTop: 10, flexWrap: 'wrap' }}>
        {mode === 'truck' ? sizes.map(s => truckChoice(s)) : null}
        {mode === 'trips' && book ? (
          <button id="fewer" type="button" onClick={() => changeBooked(-1)} style={btn(canChange && booked > 0)}>−</button>
        ) : null}
        {mode === 'trips' && book ? (
          <button id="more" type="button" onClick={() => changeBooked(1)} style={btn(canChange && booked < MAX_TRIPS)}>+</button>
        ) : null}
        {canGo ? <button id="go" type="button" onClick={go} style={btn(true, true)}>Go ▶</button> : null}
      </div>
    </Panel>
  );
}
