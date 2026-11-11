function Display({ params, lumina }) {
  const lanes = params?.lanes ?? [
    { name: 'frog', who: '🐸', move: 'hop', steps: 3, ms: 4200, reach: 1, pad: 'green' },
  ];
  const timerMs = params?.timerMs ?? 3000;
  const answer = params?.answer ?? 'first';
  const predict = params?.predict ?? false;
  const inTurn = params?.inTurn ?? false;
  const refill = params?.refill ?? false;
  const flagWord = params?.flagWord ?? 'Done first';

  const n = lanes.length;
  const TIMER_W = answer === 'first' ? 150 : 96;
  const TRACK_W = 646 - TIMER_W;
  const LANE_H = answer === 'count' ? 170 : answer === 'first' ? 200 : 140;
  const GROUND = LANE_H - 26;

  const [start, setStart] = useState(() => lanes.map(() => null));
  const [flips, setFlips] = useState(() => lanes.map(() => []));
  const [now, setNow] = useState(() => performance.now());
  const [zone, setZone] = useState(null);
  const [zoneAtFirstFlip, setZoneAtFirstFlip] = useState(undefined);
  const [drag, setDrag] = useState(null);
  const [chosen, setChosen] = useState(null);
  const worldRef = useRef(null);
  const zoneRefs = useRef({});

  useEffect(() => {
    let id = 0;
    const tick = () => { setNow(performance.now()); id = requestAnimationFrame(tick); };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, []);

  const dur = lanes.map((l) => l.ms ?? 3000);
  const doneAt = start.map((s, i) => (s == null ? null : s + dur[i]));
  const done = doneAt.map((d) => d != null && now >= d);
  const allDone = done.every(Boolean);

  // Sand left in the top bulb (0..1). Before the first flip all the sand sits in the bottom.
  // When the lane's activity is done its timer stops (a hand shows on it), so the sand stays where it was.
  const sandAt = (i) => {
    const f = flips[i];
    if (!f.length) return 0;
    const stopAt = done[i] ? doneAt[i] : now;
    const last = f[f.length - 1];
    return Math.max(0, Math.min(1, 1 - (stopAt - last) / timerMs));
  };
  const sand = lanes.map((_, i) => sandAt(i));

  const canStart = (i) => start[i] == null && (!predict || zone != null) && (!inTurn || i === 0 || done[i - 1]);
  const canRefill = (i) => refill && start[i] != null && !done[i] && sand[i] <= 0;
  const timerLive = (i) => canStart(i) || canRefill(i);

  const tapTimer = (i) => {
    const t = performance.now();
    if (start[i] == null) {
      if (!canStart(i)) return;
      if (zoneAtFirstFlip === undefined) setZoneAtFirstFlip(zone);
      setStart((s) => s.map((v, k) => (k === i ? t : v)));
      setFlips((f) => f.map((v, k) => (k === i ? [t] : v)));
      return;
    }
    // Flip again only when the sand has run out and the activity is still going.
    const f = flips[i];
    const left = 1 - (t - f[f.length - 1]) / timerMs;
    if (!refill || left > 0 || t >= doneAt[i]) return;
    setFlips((fl) => fl.map((v, k) => (k === i ? v.concat([t]) : v)));
  };

  // What the child can see, in words. Sand amounts are coarse, the way an eye reads a timer.
  const sandWords = (i) => {
    if (!flips[i].length) return 'not flipped yet';
    const r = sand[i];
    if (!done[i]) return r > 0 ? 'sand falling' : 'sand ran out';
    if (r <= 0) return 'stopped, top empty';
    if (r < 0.34) return 'stopped, a little sand left on top';
    if (r < 0.67) return 'stopped, about half the sand left on top';
    return 'stopped, a lot of sand left on top';
  };
  const zoneName = (z) => {
    if (z == null) return null;
    const [kind, k] = z.split('-');
    if (kind === 'timer' && answer === 'first') return 'the sand timer';
    return lanes[Number(k)].name;
  };
  const facts = JSON.stringify({
    lanes: lanes.map((l, i) => ({ who: l.name, started: start[i] != null, finished: done[i], timer: sandWords(i), timersFlipped: flips[i].length })),
    flag: zoneName(zone),
    guess: zoneAtFirstFlip === undefined ? null : zoneName(zoneAtFirstFlip),
    chosen,
  });

  useEffect(() => {
    const f = JSON.parse(facts);
    let met = false;
    if (answer === 'first') {
      const right = dur[0] < timerMs ? 'lane-0' : 'timer-0';
      met = allDone && zone === right;
    } else if (answer === 'longer') {
      let best = 0;
      dur.forEach((d, i) => { if (d > dur[best]) best = i; });
      met = allDone && zone != null && Number(zone.split('-')[1]) === best;
    } else {
      const needed = Math.ceil(dur[0] / timerMs);
      met = allDone && flips[0].length === needed && chosen === needed;
    }
    lumina.goal(met);
    const scene = {
      oneSandTimer: 'each sand timer is the same size',
      activities: f.lanes,
      flagWord: answer === 'count' ? null : flagWord,
      flagIsOn: f.flag,
    };
    if (predict) scene.flagPlacedBeforeTiming = f.guess;
    if (answer === 'count') scene.numberTapped = chosen;
    if (inTurn) scene.order = 'the ' + lanes[0].name + ' goes first, the others wait their turn';
    lumina.scene(scene);
  }, [facts]);

  const flagVisible = answer !== 'count' && (predict || allDone);

  // Drag the flag: it follows the pointer and lands on whatever spot is under it.
  const local = (e) => {
    const b = worldRef.current.getBoundingClientRect();
    return { x: e.clientX - b.left, y: e.clientY - b.top };
  };
  const zoneUnder = (e) => {
    const keys = Object.keys(zoneRefs.current);
    for (const key of keys.filter((k) => k.startsWith('timer')).concat(keys.filter((k) => k.startsWith('lane')))) {
      const el = zoneRefs.current[key];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
        if (key.startsWith('timer') && answer !== 'first') return 'lane-' + key.split('-')[1];
        return key;
      }
    }
    return null;
  };
  const onFlagDown = (e) => { e.currentTarget.setPointerCapture(e.pointerId); setDrag(local(e)); };
  const onFlagMove = (e) => { if (drag) setDrag(local(e)); };
  const onFlagUp = (e) => { if (!drag) return; setDrag(null); setZone(zoneUnder(e)); };

  const flag = (ghost) => (
    <div
      id={ghost ? undefined : 'flag'}
      onPointerDown={ghost ? undefined : onFlagDown}
      onPointerMove={ghost ? undefined : onFlagMove}
      onPointerUp={ghost ? undefined : onFlagUp}
      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', minHeight: 44, borderRadius: 22, background: '#fbbf24', color: '#1e293b', fontWeight: 800, fontSize: 17, cursor: 'grab', touchAction: 'none', userSelect: 'none', boxShadow: '0 2px 8px rgba(0,0,0,.4)', opacity: drag && !ghost ? 0.25 : 1, whiteSpace: 'nowrap' }}
    >
      <span style={{ fontSize: 20 }}>🏅</span>{flagWord}
    </div>
  );
  const flagHere = (z) => (flagVisible && zone === z ? flag(false) : null);

  const hourglass = (i) => {
    const r = sand[i];
    const laid = done[i];
    const running = flips[i].length > 0 && !laid && r > 0;
    const topY = 45 - 35 * r;
    const halfTop = (y) => 2 + (24 * (45 - y)) / 37;
    const halfBot = (y) => 2 + (24 * (y - 45)) / 37;
    const botY = 82 - 35 * (1 - r);
    const live = timerLive(i);
    return (
      <div
        id={'timer-' + i}
        ref={(el) => { zoneRefs.current['timer-' + i] = el; }}
        onClick={() => tapTimer(i)}
        style={{ position: 'relative', width: TIMER_W, height: LANE_H, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: answer === 'first' ? 'flex-start' : 'center', paddingTop: answer === 'first' ? 12 : 0, boxSizing: 'border-box', cursor: live ? 'pointer' : 'default', opacity: live || flips[i].length ? 1 : 0.4, borderRadius: 14, border: live ? '2px dashed #fbbf24' : '2px solid transparent' }}
      >
        <svg width="64" height="90" viewBox="0 0 64 90">
          <rect x="6" y="2" width="52" height="6" rx="2" fill="#a16207" />
          <rect x="6" y="82" width="52" height="6" rx="2" fill="#a16207" />
          <path d="M8 8 L56 8 L34 45 L56 82 L8 82 L30 45 Z" fill="rgba(186,230,253,0.12)" stroke="#bae6fd" strokeWidth="2" strokeLinejoin="round" />
          {r > 0 ? <polygon points={(32 - halfTop(topY)) + ',' + topY + ' ' + (32 + halfTop(topY)) + ',' + topY + ' 33,45 31,45'} fill="#fcd34d" /> : null}
          {r < 1 ? <polygon points={(32 - halfBot(botY)) + ',' + botY + ' ' + (32 + halfBot(botY)) + ',' + botY + ' ' + (32 + halfBot(82)) + ',82 ' + (32 - halfBot(82)) + ',82'} fill="#fcd34d" /> : null}
          {running ? <line x1="32" y1="45" x2="32" y2={botY} stroke="#fcd34d" strokeWidth="1.5" /> : null}
        </svg>
        {laid && r > 0 ? <div style={{ position: 'absolute', top: 10, right: answer === 'first' ? 32 : 2, fontSize: 24 }}>✋</div> : null}
        {refill && flips[i].length ? (
          <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
            {flips[i].map((_, k) => <div key={k} style={{ width: 10, height: 10, borderRadius: 5, background: '#fcd34d' }} />)}
          </div>
        ) : null}
        {answer === 'first' ? <div style={{ marginTop: 10, minHeight: 48, display: 'flex', justifyContent: 'center' }}>{flagHere('timer-' + i)}</div> : null}
      </div>
    );
  };

  const actor = (i) => {
    const l = lanes[i];
    const s = start[i];
    const p = s == null ? 0 : Math.max(0, Math.min(1, (now - s) / dur[i]));
    const x0 = 40;
    const dist = (l.reach ?? 1) * (TRACK_W - 110);
    const mirror = l.mirror ? 'scale(-1,1)' : '';
    if (l.move === 'stack') {
      const steps = l.steps ?? 10;
      const placed = Math.floor(p * steps + 1e-9);
      const bh = Math.min(11, (GROUND - 10) / steps);
      return (
        <g>
          <text x={x0} y={GROUND} textAnchor="middle" fontSize="38">{l.who}</text>
          {Array.from({ length: placed }, (_, k) => (
            <rect key={k} x={x0 + 50 + (k % 2) * 3} y={GROUND - (k + 1) * bh} width="34" height={bh - 1} rx="2" fill={['#f87171', '#60a5fa', '#4ade80', '#facc15'][k % 4]} />
          ))}
          <rect x={x0 + 40} y={GROUND} width="60" height="3" fill="#64748b" />
        </g>
      );
    }
    let x = x0 + dist * p;
    let y = GROUND;
    if (l.move === 'hop') {
      const steps = l.steps ?? 3;
      const k = p * steps;
      const frac = p >= 1 ? 0 : k - Math.floor(k);
      const hopLen = dist / steps;
      y = GROUND - Math.min(70, 8 + hopLen * 0.45) * Math.sin(Math.PI * frac);
    } else if (l.move === 'fly') {
      y = GROUND - (40 + 8 * Math.sin(p * Math.PI * 6)) * Math.sin(p * Math.PI);
    }
    const padColor = l.pad === 'blue' ? '#38bdf8' : '#22c55e';
    return (
      <g>
        <ellipse cx={x0 + dist} cy={GROUND + 4} rx="34" ry="9" fill={padColor} opacity="0.75" />
        <g transform={'translate(' + x + ',' + y + ') ' + mirror}>
          <text x="0" y="0" textAnchor="middle" fontSize={l.size ?? 38}>{l.who}</text>
        </g>
      </g>
    );
  };

  const lane = (i) => (
    <div key={i} style={{ display: 'flex', alignItems: 'stretch', gap: 10 }}>
      {hourglass(i)}
      <div
        id={'lane-' + i}
        ref={(el) => { zoneRefs.current['lane-' + i] = el; }}
        style={{ position: 'relative', width: TRACK_W, height: LANE_H, borderRadius: 14, background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.2)' }}
      >
        <svg width={TRACK_W} height={LANE_H} style={{ position: 'absolute', left: 0, top: 0 }}>
          <line x1="12" y1={GROUND + 8} x2={TRACK_W - 12} y2={GROUND + 8} stroke="#334155" strokeWidth="2" />
          {actor(i)}
        </svg>
        <div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)' }}>{flagHere('lane-' + i)}</div>
      </div>
    </div>
  );

  const keyStyle = (d) => ({ width: 56, height: 52, borderRadius: 12, border: '2px solid ' + (chosen === d ? '#fbbf24' : '#475569'), background: chosen === d ? 'rgba(251,191,36,0.15)' : '#1e293b', color: '#f1f5f9', fontSize: 24, fontWeight: 800, cursor: 'pointer' });

  return (
    <Panel title="Sand Timer Race" caption={refill ? 'Tap a sand timer to flip it. When the sand runs out, you can flip it again.' : 'Tap a sand timer to flip it. The sand falls while the animal goes. When the animal is done, its timer stops.'}>
      <div ref={worldRef} id="world" style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
        {lanes.map((_, i) => lane(i))}
        {answer === 'count' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 60, opacity: allDone ? 1 : 0.3, pointerEvents: allDone ? 'auto' : 'none' }}>
            <span style={{ color: '#cbd5e1', fontSize: 17, marginRight: 6 }}>Sand timers:</span>
            {[1, 2, 3, 4, 5].map((d) => (
              <button key={d} id={'num-' + d} type="button" style={keyStyle(d)} onClick={() => setChosen(d)}>{d}</button>
            ))}
          </div>
        ) : (
          <div style={{ minHeight: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', borderRadius: 14, border: flagVisible && zone == null ? '2px dashed #475569' : '2px solid transparent' }}>
            {flagVisible && zone == null ? flag(false) : null}
          </div>
        )}
        {drag ? (
          <div style={{ position: 'absolute', left: drag.x - 60, top: drag.y - 22, pointerEvents: 'none', zIndex: 5 }}>{flag(true)}</div>
        ) : null}
      </div>
    </Panel>
  );
}
