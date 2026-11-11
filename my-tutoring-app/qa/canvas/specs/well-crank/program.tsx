function Display({ params, lumina }) {
  // One or two wells. Each well: a roller (the axle) with a rope down to a bucket, and an animal on a step beside the
  // axle's end. The child drags a wheel from the tray onto the axle's end; the animal then pushes the peg on that
  // wheel's rim. Nothing moves when a wheel is placed. With params.testTurn the child can tap a placed wheel: the animal
  // pushes, and the bucket comes up only if the push is enough (the world reacting; the goal never reads it).
  // params.wells: [{ animal: 'mouse' | 'bear', bucket: 'water' | 'half' | 'rocks' }], 1-2 of them.
  // params.tray: wheel keys ('knob' | 'mid' | 'big' | 'metal'), 2-4 of them. params.testTurn: boolean.

  // The model. Strength is the animal, the load is the bucket, every axle has radius 1. A well's bucket comes up when
  // push x wheel radius >= load x axle radius.
  const ANIMALS = { mouse: { push: 1, name: 'a mouse' }, bear: { push: 4, name: 'a bear' } };
  const BUCKETS = {
    water: { load: 3, name: 'a bucket full of water' },
    half: { load: 2, name: 'a bucket half full of water' },
    rocks: { load: 4, name: 'a bucket full of rocks' },
  };
  const WHEELS = {
    knob: { r: 1, px: 18, name: 'small wooden knob' },
    mid: { r: 2, px: 36, name: 'middle-size wooden wheel' },
    big: { r: 4, px: 72, name: 'big thin wooden wheel' },
    metal: { r: 1.5, px: 27, name: 'small thick metal wheel' },
  };
  const AXLE_R = 1;

  const wells = (Array.isArray(params.wells) && params.wells.length ? params.wells : [{ animal: 'mouse', bucket: 'water' }])
    .slice(0, 2)
    .map(w => ({
      animal: w && ANIMALS[w.animal] ? w.animal : 'mouse',
      bucket: w && BUCKETS[w.bucket] ? w.bucket : 'water',
    }));
  const tray = (Array.isArray(params.tray) ? params.tray : ['knob', 'mid', 'big']).filter(k => WHEELS[k]).slice(0, 4);
  const testTurn = params.testTurn === true;

  const [onAxle, setOnAxle] = useState(() => wells.map(() => null));
  const [drag, setDrag] = useState(null); // { key, x, y }
  const dragRef = useRef(null); // { key, sx, sy, moved }
  const [tries, setTries] = useState(() => wells.map(() => null)); // { lifts, n } per well, test turn only
  const svgRef = useRef(null);

  const lifts = i => {
    const k = onAxle[i];
    if (!k) return false;
    return ANIMALS[wells[i].animal].push * WHEELS[k].r >= BUCKETS[wells[i].bucket].load * AXLE_R;
  };
  const goalMet = wells.every((_, i) => lifts(i));
  const wellName = i => (wells.length === 1 ? 'the well' : ['left well', 'right well'][i]);

  useEffect(() => {
    lumina.goal(goalMet);
    lumina.scene({
      wells: wells.map((w, i) => ({
        well: wellName(i),
        animal: ANIMALS[w.animal].name,
        bucket: BUCKETS[w.bucket].name,
        onAxle: onAxle[i] ? WHEELS[onAxle[i]].name : 'nothing',
      })),
      tray: tray.filter(k => !onAxle.includes(k)).map(k => WHEELS[k].name),
      tryTurn: testTurn ? 'tapping a wheel on a well lets the animal try to turn it' : 'no try turn',
    });
  }, [goalMet, onAxle]);

  // ---------- layout ----------
  const W = 680, LANE_W = 340, LANE_H = 345, TRAY_Y = 345, TRAY_H = 175, H = TRAY_Y + TRAY_H;
  const GROUND = 232, HUB = { x: 175, y: 110 };
  const laneX = i => (wells.length === 1 ? (W - LANE_W) / 2 : i * LANE_W);
  const hubAt = i => ({ x: laneX(i) + HUB.x, y: HUB.y });
  const slot = i => ({ x: (W / (tray.length + 1)) * (i + 1), y: TRAY_Y + TRAY_H / 2 });

  const where = key => {
    if (drag && drag.key === key && drag.x !== undefined) return { x: drag.x, y: drag.y };
    const a = onAxle.indexOf(key);
    return a >= 0 ? hubAt(a) : slot(tray.indexOf(key));
  };

  const onDown = (key, e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = svgRef.current ? svgPoint(svgRef.current, e) : { x: 0, y: 0 };
    dragRef.current = { key, sx: pt.x, sy: pt.y, moved: false };
    setDrag({ key });
  };
  const onMove = e => {
    const d = dragRef.current;
    if (!d || !svgRef.current) return;
    const pt = svgPoint(svgRef.current, e);
    if (Math.hypot(pt.x - d.sx, pt.y - d.sy) > 6) d.moved = true;
    if (d.moved) setDrag({ key: d.key, x: pt.x, y: pt.y });
  };
  const onUp = e => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d || !svgRef.current) { setDrag(null); return; }
    if (!d.moved) {
      // A tap. On a wheel that sits on an axle, with a test turn allowed, the animal tries to turn it.
      const a = onAxle.indexOf(d.key);
      if (testTurn && a >= 0) {
        const up = lifts(a);
        setTries(prev => prev.map((t, i) => (i === a ? { lifts: up, n: (t ? t.n : 0) + 1 } : t)));
      }
      setDrag(null);
      return;
    }
    const pt = svgPoint(svgRef.current, e);
    let target = -1, best = 90;
    wells.forEach((_, i) => {
      const h = hubAt(i);
      const dist = Math.hypot(h.x - pt.x, h.y - pt.y);
      if (dist < best) { best = dist; target = i; }
    });
    const next = onAxle.map(k => (k === d.key ? null : k));
    if (target >= 0) next[target] = d.key;
    setOnAxle(next);
    // A well whose wheel changed goes back to its first state: bucket down, no try shown.
    setTries(prev => prev.map((t, i) => (next[i] === onAxle[i] ? t : null)));
    setDrag(null);
  };

  // ---------- pictures ----------
  const woodWheel = px => {
    if (px <= 20) return (
      <g>
        <circle r={px} fill="#b45309" stroke="#fbbf24" strokeWidth="3" />
        <circle r={px * 0.45} fill="#78350f" />
        <circle cx={px} cy="0" r="6" fill="#fde68a" stroke="#78350f" strokeWidth="2" />
      </g>
    );
    const spokes = px > 50 ? 8 : 6;
    return (
      <g>
        <circle r={px} fill="rgba(251,191,36,0.06)" />
        {Array.from({ length: spokes }, (_, s) => {
          const a = (Math.PI * 2 * s) / spokes;
          return <line key={s} x1={Math.cos(a) * 8} y1={Math.sin(a) * 8} x2={Math.cos(a) * (px - 3)} y2={Math.sin(a) * (px - 3)} stroke="#d97706" strokeWidth="4" strokeLinecap="round" />;
        })}
        <circle r={px - 3} fill="none" stroke="#f59e0b" strokeWidth="6" />
        <circle r="10" fill="#78350f" stroke="#f59e0b" strokeWidth="2" />
        <circle cx={px} cy="0" r="7" fill="#fde68a" stroke="#78350f" strokeWidth="2" />
      </g>
    );
  };
  const metalWheel = px => (
    <g>
      {[12, 9, 6, 3].map(o => <circle key={o} cx={o} cy={o} r={px} fill="#334155" stroke="#1e293b" strokeWidth="1" />)}
      <circle r={px} fill="url(#steel)" stroke="#e2e8f0" strokeWidth="2.5" />
      {[0, 1, 2, 3, 4].map(b => {
        const a = (Math.PI * 2 * b) / 5 - Math.PI / 2;
        return <circle key={b} cx={Math.cos(a) * px * 0.6} cy={Math.sin(a) * px * 0.6} r="3" fill="#f8fafc" />;
      })}
      <circle r="6" fill="#0f172a" stroke="#cbd5e1" strokeWidth="1.5" />
      <circle cx={px} cy="0" r="6" fill="#cbd5e1" stroke="#1e293b" strokeWidth="2" />
    </g>
  );
  const wheelPic = key => (key === 'metal' ? metalWheel(WHEELS[key].px) : woodWheel(WHEELS[key].px));

  // Animals are drawn with their feet at (0, 0), facing left; PAW is where their paws are, so they rest on the peg.
  const PAW = { mouse: { x: -30, y: -20 }, bear: { x: -40, y: -46 } };
  const mouse = () => (
    <g transform="scale(1.3)">
      <path d="M 16 -6 Q 28 -6 27 -18 Q 26 -27 32 -30" fill="none" stroke="#f9a8d4" strokeWidth="2.5" strokeLinecap="round" />
      <ellipse cx="4" cy="-13" rx="16" ry="12" fill="#a8a29e" />
      <ellipse cx="-4" cy="-1" rx="6" ry="2.5" fill="#f9a8d4" />
      <ellipse cx="10" cy="-1" rx="6" ry="2.5" fill="#f9a8d4" />
      <circle cx="-10" cy="-24" r="9" fill="#a8a29e" />
      <circle cx="-6" cy="-33" r="6.5" fill="#a8a29e" />
      <circle cx="-6" cy="-33" r="3.5" fill="#f9a8d4" />
      <circle cx="-14" cy="-26" r="1.8" fill="#0f172a" />
      <circle cx="-19" cy="-22" r="2.2" fill="#f472b6" />
      <line x1="-4" y1="-15" x2="-21" y2="-15" stroke="#a8a29e" strokeWidth="4" strokeLinecap="round" />
    </g>
  );
  const bear = () => (
    <g>
      <rect x="-8" y="-12" width="14" height="12" rx="4" fill="#78350f" />
      <rect x="14" y="-12" width="14" height="12" rx="4" fill="#78350f" />
      <ellipse cx="8" cy="-42" rx="30" ry="34" fill="#92400e" />
      <ellipse cx="2" cy="-36" rx="17" ry="22" fill="#d6a36a" />
      <circle cx="-26" cy="-102" r="8" fill="#92400e" />
      <circle cx="2" cy="-104" r="8" fill="#92400e" />
      <circle cx="-12" cy="-86" r="21" fill="#92400e" />
      <ellipse cx="-28" cy="-80" rx="10" ry="8" fill="#d6a36a" />
      <circle cx="-35" cy="-82" r="3.5" fill="#0f172a" />
      <circle cx="-18" cy="-92" r="2.5" fill="#0f172a" />
      <line x1="-8" y1="-54" x2="-38" y2="-46" stroke="#92400e" strokeWidth="13" strokeLinecap="round" />
    </g>
  );

  const bucketPic = kind => (
    <g>
      <path d="M -24 -4 Q 0 -76 24 -4" fill="none" stroke="#cbd5e1" strokeWidth="2.5" />
      {kind === 'rocks' && (
        <g>
          {[[-13, -10, 9], [3, -16, 10], [15, -8, 8], [-4, -4, 9], [10, -2, 8], [-17, -2, 7]].map(([x, y, r], s) =>
            <circle key={s} cx={x} cy={y} r={r} fill={s % 2 ? '#a8a29e' : '#d6d3d1'} stroke="#292524" strokeWidth="2" />)}
        </g>
      )}
      <path d="M -24 -4 L 24 -4 L 19 36 L -19 36 Z" fill="#475569" stroke="#cbd5e1" strokeWidth="2.5" />
      {kind === 'water' && <path d="M -22 0 L 22 0 L 19 34 L -19 34 Z" fill="#3b82f6" />}
      {kind === 'half' && <path d="M -20.6 17 L 20.6 17 L 19 34 L -19 34 Z" fill="#3b82f6" />}
      {kind === 'rocks' && (
        <g>
          <path d="M -22 0 L 22 0 L 19 34 L -19 34 Z" fill="#57534e" />
          {[[-10, 9], [8, 12], [-4, 24], [12, 26], [-14, 28]].map(([x, y], s) =>
            <circle key={s} cx={x} cy={y} r="6" fill="#a8a29e" stroke="#292524" strokeWidth="1.5" />)}
        </g>
      )}
    </g>
  );

  const lane = (w, i) => {
    const x0 = laneX(i);
    const t = tries[i];
    const BUCKET_REST = 270, BUCKET_UP = 160;
    const by = t && t.lifts ? BUCKET_UP : BUCKET_REST;
    return (
      <g key={i} transform={`translate(${x0}, 0)`}>
        <clipPath id={`lane-${i}`}><rect x="0" y="0" width={LANE_W - 6} height={LANE_H - 6} rx="12" /></clipPath>
        <g clipPath={`url(#lane-${i})`}>
          <rect x="0" y="0" width={LANE_W - 6} height={LANE_H - 6} fill="#0b1224" />
          {/* the ground, cut away to show the well shaft */}
          <rect x="0" y={GROUND} width={LANE_W} height={LANE_H - GROUND} fill="#44301c" />
          <rect x="0" y={GROUND - 3} width={LANE_W} height="6" fill="#16a34a" />
          <rect x="52" y={GROUND} width="86" height={LANE_H - GROUND} fill="#0f172a" />
          <rect x="52" y="306" width="86" height="40" fill="#1d4ed8" opacity="0.7" />
        </g>
        {/* the well ring */}
        <rect x="44" y="198" width="102" height="34" rx="3" fill="#78716c" stroke="#a8a29e" strokeWidth="2" />
        <line x1="44" y1="215" x2="146" y2="215" stroke="#57534e" strokeWidth="2" />
        {[70, 95, 120].map(x => <line key={x} x1={x} y1="198" x2={x} y2="215" stroke="#57534e" strokeWidth="2" />)}
        {[58, 83, 108, 133].map(x => <line key={x} x1={x} y1="215" x2={x} y2="232" stroke="#57534e" strokeWidth="2" />)}
        {/* posts */}
        <rect x="36" y="92" width="11" height="108" fill="#a16207" stroke="#713f12" strokeWidth="1.5" />
        <rect x="143" y="92" width="11" height="108" fill="#a16207" stroke="#713f12" strokeWidth="1.5" />
        {/* the bucket and its rope, below the roller */}
        <g clipPath={`url(#below-${i})`}>
          <g style={{ transform: `translateY(${by}px)`, transition: 'transform 1.2s ease-in-out' }}>
            <line x1="95" y1="-200" x2="95" y2="-40" stroke="#e7e5e4" strokeWidth="2.5" />
            <g transform="translate(95, 0)">{bucketPic(w.bucket)}</g>
          </g>
        </g>
        <clipPath id={`below-${i}`}><rect x="0" y={HUB.y} width={LANE_W} height={LANE_H} /></clipPath>
        {/* the roller (the axle), running out past the post to its end */}
        <rect x="32" y={HUB.y - 8} width={HUB.x - 32} height="16" rx="8" fill="#b45309" stroke="#78350f" strokeWidth="2" />
        <rect x="84" y={HUB.y - 9} width="22" height="18" rx="3" fill="#e7e5e4" opacity="0.85" />
        {!onAxle[i] && <circle cx={HUB.x} cy={HUB.y} r="34" fill="none" stroke="#fbbf24" strokeWidth="2" strokeDasharray="6 5" />}
        <circle id={`axle-${i + 1}`} cx={HUB.x} cy={HUB.y} r="10" fill="#e5e7eb" stroke="#475569" strokeWidth="2" />
      </g>
    );
  };

  const animalAt = (w, i) => {
    const h = hubAt(i);
    const k = onAxle[i];
    const R = k ? WHEELS[k].px : 26;
    const paw = PAW[w.animal];
    const ax = h.x + R + 2 - paw.x, ay = h.y - paw.y;
    return (
      <g key={`animal-${i}`} style={{ pointerEvents: 'none' }}>
        <rect x={ax - 22} y={ay} width="50" height={GROUND - ay} fill="#a16207" stroke="#713f12" strokeWidth="1.5" />
        <line x1={ax - 22} y1={ay + 12} x2={ax + 28} y2={ay + 12} stroke="#713f12" strokeWidth="1.5" />
        <g transform={`translate(${ax}, ${ay})`}>{w.animal === 'bear' ? bear() : mouse()}</g>
      </g>
    );
  };

  const item = key => {
    const at = where(key);
    const px = WHEELS[key].px;
    const a = onAxle.indexOf(key);
    const t = a >= 0 ? tries[a] : null;
    return (
      <g key={key} id={`wheel-${key}`} transform={`translate(${at.x}, ${at.y})`} style={{ cursor: 'grab', touchAction: 'none' }}
        onPointerDown={e => onDown(key, e)} onPointerCancel={() => { dragRef.current = null; setDrag(null); }}>
        <circle r={Math.max(px + 4, 26)} fill="transparent" />
        <g key={t ? t.n : 0}>
          {t && t.lifts && <animateTransform attributeName="transform" type="rotate" from="0" to="720" dur="1.2s" fill="freeze" />}
          {t && !t.lifts && <animateTransform attributeName="transform" type="rotate" values="0;14;0;14;0" dur="1s" fill="freeze" />}
          {wheelPic(key)}
        </g>
      </g>
    );
  };

  const dragging = drag && drag.x !== undefined ? drag.key : null;
  return (
    <Panel>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} onPointerMove={onMove} onPointerUp={onUp}
        style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <defs>
          <radialGradient id="steel" cx="0.35" cy="0.35" r="0.8">
            <stop offset="0" stopColor="#e2e8f0" />
            <stop offset="0.5" stopColor="#94a3b8" />
            <stop offset="1" stopColor="#475569" />
          </radialGradient>
        </defs>
        {wells.map(lane)}
        <rect x="0" y={TRAY_Y} width={W} height={TRAY_H - 6} rx="12" fill="rgba(30,41,59,0.6)" stroke="#334155" strokeDasharray="5 5" />
        {tray.map((k, i) => onAxle.includes(k) || dragging === k
          ? <circle key={`slot-${k}`} cx={slot(i).x} cy={slot(i).y} r={WHEELS[k].px} fill="none" stroke="#475569" strokeWidth="2" strokeDasharray="5 5" />
          : null)}
        {wells.map(animalAt)}
        {tray.map(k => item(k))}
      </svg>
    </Panel>
  );
}
