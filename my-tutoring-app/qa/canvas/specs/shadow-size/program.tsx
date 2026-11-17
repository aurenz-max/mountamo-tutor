// Shadow size (1-PS4-3). A side view of a small shadow stage: a lamp on the left, a puppet on a stick on a floor
// track, and a wall (screen) on the right drawn face-on so its shadow can be seen. The child drags the puppet (or the
// lamp) along the track and taps the switch to light the lamp. The shadow on the wall is the puppet's shape, scaled
// by where the lamp and the puppet stand: S = h * (wall - lamp) / (puppet - lamp). Nothing on screen names a size.
// Goal: the light is on and the moving thing stands where the shadow fills the dashed frame on the wall (or, on the
// two-stage problem, where the two shadows are the same height).
// Said answer: what the shadow does under the move the ask names, worked out by the program from the same formula.
// params.lanes: 1-2 of { kind: 'bunny'|'tree'|'house'|'duck', h, lamp, obj (stop indices 0-14), moves:
// 'object'|'lamp'|'none', target (the mover's stop where the shadow fills the frame; omit for no frame) }.
// params.live: true keeps the light on while something moves (the shadow grows and shrinks as you drag); false turns
// the light off when anything moves, so where to stop is a prediction tested with the switch.
// params.said: { thing: 'object'|'lamp', toward: 'lamp'|'wall'|'object'|'away' } or 'match' (the second stage's
// shadow against the first's).
function Display({ params, lumina }) {
  const KINDS = {
    bunny: { name: 'bunny', aspect: 0.46 },
    tree: { name: 'tree', aspect: 0.6 },
    house: { name: 'house', aspect: 0.7 },
    duck: { name: 'duck', aspect: 0.78 },
  };
  const LAST = 14;
  const lanesIn = Array.isArray(params.lanes) && params.lanes.length ? params.lanes.slice(0, 2) : [
    { kind: 'bunny', h: 60, lamp: 0, obj: 13, moves: 'object', target: 5 },
  ];
  const lanes = lanesIn.map(l => {
    const lamp = Math.max(0, Math.min(LAST - 1, Number(l.lamp) || 0));
    const obj = Math.max(lamp + 1, Math.min(LAST, Number(l.obj) || 10));
    return {
      kind: KINDS[l.kind] ? l.kind : 'bunny',
      h: Number(l.h) || 60,
      lamp, obj,
      moves: l.moves === 'lamp' || l.moves === 'none' ? l.moves : 'object',
      target: l.target === undefined || l.target === null ? null : Number(l.target),
    };
  });
  const live = params.live === true;
  const said = params.said || { thing: 'object', toward: 'lamp' };

  const W = 680;
  const LANE_H = lanes.length === 1 ? 392 : 236;
  const H = LANE_H * lanes.length;
  const WALL_X = 520, WALL_R = 668;
  const stopX = k => 60 + 30 * k;
  const top = i => i * LANE_H;
  const floorY = i => top(i) + LANE_H - 34;
  const lampY = i => top(i) + (LANE_H - 34) / 2 + 8;
  const shadowOf = (h, lx, ox) => (h * (WALL_X - lx)) / Math.max(1, ox - lx);

  const [spots, setSpots] = useState(() => lanes.map(l => ({ lamp: l.lamp, obj: l.obj })));
  const [on, setOn] = useState(false);
  // On a prediction problem (live false) the switch does nothing until something has been slid: lit at rest, the
  // start shadow beside the frame would show whether the shadow must grow or shrink, which is the said answer.
  const [slid, setSlid] = useState(false);
  const canSwitch = live || slid;
  const [drag, setDrag] = useState(null); // { lane, what, x, moved }
  const svgRef = useRef(null);

  // The key, from the same formula the picture uses.
  useEffect(() => {
    const cmp = (a, b) => (Math.abs(a - b) < 0.5 ? 'same' : a > b ? 'bigger' : 'smaller');
    let key, misrules;
    if (said === 'match' && lanes.length > 1) {
      const a = lanes[0], b = lanes[1];
      const want = shadowOf(a.h, stopX(a.lamp), stopX(a.obj));
      const now = shadowOf(b.h, stopX(b.lamp), stopX(b.obj));
      key = cmp(want, now);
      const bySize = b.h < a.h ? 'bigger' : b.h > a.h ? 'smaller' : 'same';
      misrules = [
        { says: bySize, because: `thinks each shadow is the size of its object, so the ${KINDS[b.kind].name}'s shadow must match the ${KINDS[a.kind].name}'s by size alone` },
        { says: 'same', because: 'thinks a shadow is always the size of its object, so it cannot change' },
      ];
    } else {
      const l = lanes[0];
      const thing = said.thing === 'lamp' ? 'lamp' : 'object';
      let lamp = l.lamp, obj = l.obj;
      if (thing === 'object') obj += said.toward === 'wall' ? 1 : -1;
      else lamp += said.toward === 'away' ? -1 : 1;
      if (lamp < 0 || obj > LAST || obj <= lamp) { lamp = l.lamp; obj = l.obj; }
      key = cmp(shadowOf(l.h, stopX(lamp), stopX(obj)), shadowOf(l.h, stopX(l.lamp), stopX(l.obj)));
      const flip = key === 'bigger' ? 'smaller' : 'bigger';
      misrules = thing === 'object'
        ? [
          { says: 'same', because: 'thinks a shadow is always the size of its object' },
          { says: flip, because: 'thinks a shadow grows as the object gets nearer the wall' },
        ]
        : [
          { says: 'same', because: 'thinks the shadow cannot change when the object itself does not move' },
          { says: flip, because: 'thinks a nearer light makes a shadow shrink' },
        ];
    }
    misrules = misrules.filter((m, i, all) => m.says !== key && all.findIndex(x => x.says === m.says) === i);
    lumina.answer(key, misrules, ['bigger', 'smaller', 'same']);
  }, []);

  const shadowAt = (l, s) => shadowOf(l.h, stopX(s.lamp), stopX(s.obj));
  const goalMet = on && (said === 'match' && lanes.length > 1
    ? Math.abs(shadowAt(lanes[0], spots[0]) - shadowAt(lanes[1], spots[1])) < 0.5
    : lanes.every((l, i) => l.target === null || (l.moves === 'lamp' ? spots[i].lamp : spots[i].obj) === l.target));

  useEffect(() => {
    lumina.goal(goalMet);
    lumina.scene({
      lamps: lanes.length === 1 ? 'one lamp' : 'two stages, each with a lamp; one switch lights both',
      light: on ? 'on' : 'off',
      wall: on ? 'the shadow is on the wall' : 'no shadow: the lamp is off',
      lightWhileMoving: live ? 'stays on while something slides' : 'goes off when something slides',
      stages: lanes.map((l, i) => ({
        object: KINDS[l.kind].name,
        slides: l.moves === 'lamp' ? 'the lamp' : l.moves === 'none' ? 'nothing: it stays put' : `the ${KINDS[l.kind].name}`,
        stepsFromLampToObject: spots[i].obj - spots[i].lamp,
        stepsFromObjectToWall: LAST + 1 - spots[i].obj,
        frame: l.target === null ? 'no frame' : 'a dashed frame on the wall',
      })),
    });
  }, [goalMet, on, spots]);

  // ---------- dragging ----------
  const xNow = (i, what) => {
    if (drag && drag.lane === i && drag.what === what && drag.x !== undefined) return drag.x;
    return stopX(spots[i][what]);
  };
  const clampX = (i, what, x) => what === 'obj'
    ? Math.max(stopX(spots[i].lamp + 1), Math.min(stopX(LAST), x))
    : Math.max(stopX(0), Math.min(stopX(spots[i].obj - 1), x));
  const grab = (i, what, e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ lane: i, what });
  };
  const move = e => {
    if (!drag || !svgRef.current) return;
    const p = svgPoint(svgRef.current, e);
    const x = clampX(drag.lane, drag.what, p.x);
    const moved = drag.moved || Math.abs(x - stopX(spots[drag.lane][drag.what])) > 4;
    if (moved && !live && on) setOn(false);
    setDrag(d => (d ? { ...d, x, moved } : null));
  };
  const drop = e => {
    if (!drag || !svgRef.current) return;
    const p = svgPoint(svgRef.current, e);
    const x = clampX(drag.lane, drag.what, p.x);
    const k = Math.round((x - 60) / 30);
    const { lane, what, moved } = drag;
    setDrag(null);
    if (!moved && Math.abs(x - stopX(spots[lane][what])) <= 4) return;
    setSpots(prev => prev.map((s, i) => {
      if (i !== lane) return s;
      const k2 = what === 'obj' ? Math.max(s.lamp + 1, Math.min(LAST, k)) : Math.max(0, Math.min(s.obj - 1, k));
      return { ...s, [what]: k2 };
    }));
    setSlid(true);
    if (!live) setOn(false);
  };

  // ---------- pictures ----------
  // Each shape is drawn in a box of height 1 centred on (0, 0), then scaled.
  const shape = (kind, fill, detail) => {
    if (kind === 'tree') return (
      <g>
        <rect x="-0.06" y="0.18" width="0.12" height="0.32" fill={detail ? '#92400e' : fill} />
        <path d="M 0 -0.5 L 0.3 0.22 L -0.3 0.22 Z" fill={fill} />
      </g>
    );
    if (kind === 'house') return (
      <g>
        <rect x="-0.28" y="-0.1" width="0.56" height="0.6" fill={fill} />
        <path d="M 0 -0.5 L 0.35 -0.08 L -0.35 -0.08 Z" fill={detail ? '#b91c1c' : fill} />
        {detail && <rect x="-0.08" y="0.2" width="0.16" height="0.3" fill="#78350f" />}
      </g>
    );
    if (kind === 'duck') return (
      <g>
        <ellipse cx="0.06" cy="0.18" rx="0.33" ry="0.3" fill={fill} />
        <circle cx="-0.16" cy="-0.22" r="0.22" fill={fill} />
        <path d="M -0.36 -0.26 L -0.5 -0.18 L -0.36 -0.12 Z" fill={detail ? '#f97316' : fill} />
        {detail && <circle cx="-0.2" cy="-0.28" r="0.04" fill="#0f172a" />}
      </g>
    );
    return (
      <g>
        <ellipse cx="-0.07" cy="-0.34" rx="0.05" ry="0.16" fill={fill} />
        <ellipse cx="0.07" cy="-0.34" rx="0.05" ry="0.16" fill={fill} />
        <circle cx="0" cy="-0.1" r="0.15" fill={fill} />
        <ellipse cx="0" cy="0.22" rx="0.22" ry="0.28" fill={fill} />
        {detail && <circle cx="-0.05" cy="-0.12" r="0.025" fill="#0f172a" />}
      </g>
    );
  };
  const colourOf = { bunny: '#e2e8f0', tree: '#22c55e', house: '#f59e0b', duck: '#facc15' };

  const lane = (l, i) => {
    const t = top(i), fy = floorY(i), ly = lampY(i);
    const lx = xNow(i, 'lamp'), ox = xNow(i, 'obj');
    const S = shadowOf(l.h, lx, ox);
    const wallMid = (WALL_X + WALL_R) / 2;
    const frameS = l.target === null ? null
      : l.moves === 'lamp' ? shadowOf(l.h, stopX(l.target), stopX(spots[i].obj)) : shadowOf(l.h, stopX(spots[i].lamp), stopX(l.target));
    const aspect = KINDS[l.kind].aspect;
    const canObj = l.moves === 'object', canLamp = l.moves === 'lamp';
    return (
      <g key={i}>
        <defs>
          <clipPath id={`wall-${i}`}><rect x={WALL_X} y={t + 10} width={WALL_R - WALL_X} height={fy - t - 10} /></clipPath>
        </defs>
        {/* floor and track */}
        <rect x="16" y={fy} width={WALL_R - 16} height="6" rx="3" fill="#334155" />
        {Array.from({ length: LAST + 1 }, (_, k) => (
          <rect key={k} id={`stop-${i}-${k}`} x={stopX(k) - 1.5} y={fy - 7} width="3" height="7" fill="#64748b" pointerEvents="none" />
        ))}
        {/* the wall, face-on */}
        <rect x={WALL_X} y={t + 10} width={WALL_R - WALL_X} height={fy - t - 10} rx="4" fill={on ? '#fef3c7' : '#44403c'} stroke="#78716c" strokeWidth="2" />
        <text x={wallMid} y={fy + 24} textAnchor="middle" fontSize="15" fill="#cbd5e1">wall</text>
        {/* the beam */}
        {on && <path d={`M ${lx + 6} ${ly} L ${WALL_X} ${t + 10} L ${WALL_X} ${fy} Z`} fill="#fde68a" opacity="0.13" pointerEvents="none" />}
        {/* the shadow and the frame, on the wall */}
        <g clipPath={`url(#wall-${i})`} pointerEvents="none">
          {on && (
            <g transform={`translate(${wallMid}, ${ly}) scale(${S})`}>{shape(l.kind, '#292524', false)}</g>
          )}
          {frameS !== null && (
            <rect x={wallMid - (frameS * aspect) / 2} y={ly - frameS / 2} width={frameS * aspect} height={frameS}
              fill="none" stroke={on ? '#57534e' : '#e7e5e4'} strokeWidth="2.5" strokeDasharray="7 5" />
          )}
        </g>
        {/* the object on its stick */}
        <g id={`obj-${i}`} onPointerDown={canObj ? e => grab(i, 'obj', e) : undefined} onPointerUp={canObj ? drop : undefined}
          onPointerCancel={() => setDrag(null)} style={{ cursor: canObj ? 'grab' : 'default', touchAction: 'none' }}>
          <rect x={ox - 30} y={ly - Math.max(l.h / 2, 22) - 6} width="60" height={fy - ly + Math.max(l.h / 2, 22) + 6} fill="transparent" />
          <line x1={ox} y1={ly + l.h / 2 - 2} x2={ox} y2={fy} stroke="#a16207" strokeWidth="4" />
          {l.moves === 'none' && <rect x={ox - 14} y={fy - 6} width="28" height="8" rx="2" fill="#475569" />}
          <g transform={`translate(${ox}, ${ly}) scale(${l.h})`}>{shape(l.kind, colourOf[l.kind], true)}</g>
          {canObj && <path d={`M ${ox - 22} ${fy - 16} l -7 5 l 7 5 M ${ox + 22} ${fy - 16} l 7 5 l -7 5`} fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" />}
        </g>
        <text x={ox} y={fy + 24} textAnchor="middle" fontSize="15" fill="#cbd5e1" pointerEvents="none">{KINDS[l.kind].name}</text>
        {/* the lamp */}
        <g id={`lamp-${i}`} onPointerDown={canLamp ? e => grab(i, 'lamp', e) : undefined} onPointerUp={canLamp ? drop : undefined}
          onPointerCancel={() => setDrag(null)} style={{ cursor: canLamp ? 'grab' : 'default', touchAction: 'none' }}>
          <rect x={lx - 30} y={ly - 24} width="48" height={fy - ly + 28} fill="transparent" />
          <ellipse cx={lx - 6} cy={fy} rx="20" ry="5" fill="#475569" />
          <line x1={lx - 6} y1={fy} x2={lx - 6} y2={ly + 10} stroke="#94a3b8" strokeWidth="4" />
          <path d={`M ${lx - 26} ${ly - 8} L ${lx + 2} ${ly - 18} L ${lx + 2} ${ly + 18} L ${lx - 26} ${ly + 8} Z`} fill="#334155" stroke="#94a3b8" strokeWidth="2" />
          {on && <circle cx={lx + 4} cy={ly} r="16" fill="#fde047" opacity="0.35" />}
          <circle cx={lx + 4} cy={ly} r="7" fill={on ? '#fef08a' : '#57534e'} />
          {canLamp && <path d={`M ${lx - 30} ${fy - 16} l -7 5 l 7 5 M ${lx + 18} ${fy - 16} l 7 5 l -7 5`} fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" />}
        </g>
        <text x={lx - 6} y={fy + 24} textAnchor="middle" fontSize="15" fill="#cbd5e1" pointerEvents="none">lamp</text>
      </g>
    );
  };

  const mover = lanes.find(l => l.moves !== 'none') || lanes[0];
  const moverName = mover.moves === 'lamp' ? 'the lamp' : `the ${KINDS[mover.kind].name}`;
  const caption = live
    ? `Drag ${moverName} along the floor. Tap the switch to turn the light on or off.`
    : `Drag ${moverName} along the floor, then tap the switch to light the lamp. Sliding turns the light off.`;

  return (
    <Panel title="Shadow Stage" caption={caption}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} onPointerMove={move}
        style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <rect width={W} height={H} fill="#0f172a" />
        {lanes.map(lane)}
        {/* the switch, on the back wall */}
        <g id="switch" onClick={() => { if (canSwitch) setOn(v => !v); }} opacity={canSwitch ? 1 : 0.4}
          style={{ cursor: canSwitch ? 'pointer' : 'default' }}>
          <rect x="10" y="14" width="50" height="64" rx="8" fill="#1e293b" stroke="#64748b" strokeWidth="2" />
          <rect x="25" y="26" width="20" height="40" rx="5" fill="#0f172a" stroke="#475569" strokeWidth="1.5" />
          <rect x="27" y={on ? 28 : 46} width="16" height="18" rx="4" fill={on ? '#fde047' : '#94a3b8'} />
        </g>
      </svg>
    </Panel>
  );
}
