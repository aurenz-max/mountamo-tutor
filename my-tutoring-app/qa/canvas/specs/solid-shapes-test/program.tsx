function Display({ params, lumina }) {
  const shapeList = params?.shapes ?? [{ shape: 'sphere' }, { shape: 'cube' }];
  const canTurn = params?.canTurn ?? false;
  const tests = params?.tests ?? ['ramp'];
  const bins = params?.bins ?? [{ id: 'rolls', label: 'Rolls', roll: true }, { id: 'slides', label: 'Slides', roll: false }];

  const W = 670;
  const H = 450;
  const FLOOR = 300;
  const hasRamp = tests.includes('ramp');
  const hasStack = tests.includes('stack');
  const TABLE_X = hasRamp ? 575 : 335;
  const TABLE_TOP = 236;
  const BLOCK_HOME = { x: 618, y: 104 };
  const SHELF_Y = 104;
  const RAMP_A = { x: 28, y: 186 };
  const RAMP_B = { x: 290, y: FLOOR };
  const RAMP_LEN = Math.hypot(RAMP_B.x - RAMP_A.x, RAMP_B.y - RAMP_A.y);
  const RAMP_DEG = (Math.atan2(RAMP_B.y - RAMP_A.y, RAMP_B.x - RAMP_A.x) * 180) / Math.PI;
  const S_START = 46;
  const ROLL_END = RAMP_LEN + 150;
  const SLIDE_END = RAMP_LEN + 20;
  const RAMP_MS = 1200;
  const FALL_MS = 800;

  const ORIENTS = { sphere: ['any'], cube: ['face'], box: ['long', 'tall'], cylinder: ['up', 'side'], cone: ['base', 'side'] };
  const SITS = { any: 'curved surface', face: 'flat face', long: 'long flat face', tall: 'small flat face', up: 'flat face', side: 'curved side', base: 'flat face' };
  const rolls = (shape, o) => shape === 'sphere' || ((shape === 'cylinder' || shape === 'cone') && o === 'side');
  const holds = (shape, o) => shape === 'cube' || shape === 'box' || (shape === 'cylinder' && o === 'up');
  const RADIUS = { sphere: 28, cylinder: 26, cone: 26 };
  const TOP = { sphere: { any: 56 }, cube: { face: 58 }, box: { long: 42, tall: 82 }, cylinder: { up: 60, side: 52 }, cone: { base: 64, side: 52 } };

  const startOrient = (s) => s.sits ?? ORIENTS[s.shape][0];
  const allowed = (s) => (canTurn ? ORIENTS[s.shape] : [startOrient(s)]);

  const fresh = () => {
    const solids = {};
    const record = {};
    shapeList.forEach((s, i) => {
      solids[s.shape] = { shape: s.shape, orient: startOrient(s), where: 'shelf', slot: i, s: 0, rot: 0, bin: null, order: 0 };
      record[s.shape] = { rolled: false, slid: false, held: false, fell: false };
    });
    return { solids, block: 'home', rampAnim: null, fallAnim: null, record, log: [], order: 0 };
  };
  const [world, setWorld] = useState(fresh);
  const worldRef = useRef(world);
  const put = (fn) => { const next = fn(worldRef.current); worldRef.current = next; setWorld(next); };
  const [now, setNow] = useState(0);
  const [drag, setDrag] = useState(null);
  const dragRef = useRef(null);
  const svgRef = useRef(null);

  // Ticks while something is moving, so the picture follows the clock.
  useEffect(() => {
    if (!world.rampAnim && !world.fallAnim) return undefined;
    const id = setInterval(() => setNow(performance.now()), 30);
    return () => clearInterval(id);
  }, [world.rampAnim, world.fallAnim]);

  const binOf = (id) => bins.find((b) => b.id === id);
  const canRoll = (s) => allowed(s).some((o) => rolls(s.shape, o));
  const canStack = (s) => allowed(s).some((o) => holds(s.shape, o));

  useEffect(() => {
    const list = shapeList.map((s) => ({ spec: s, now: world.solids[s.shape], rec: world.record[s.shape] }));
    const met = list.every(({ spec, now: n, rec }) => {
      if (n.where !== 'bin') return false;
      const b = binOf(n.bin);
      if (!b) return false;
      const rollOk = b.roll == null || (b.roll ? canRoll(spec) && rec.rolled : !canRoll(spec) && (rec.rolled || rec.slid));
      const stackOk = b.stack == null || (b.stack ? canStack(spec) && rec.held : !canStack(spec) && (rec.held || rec.fell));
      return rollOk && stackOk;
    });
    lumina.goal(met);
    const placeName = (n) => (n.where === 'bin' ? 'in the box "' + (binOf(n.bin)?.label ?? '') + '"' : n.where === 'ramp' ? 'on the ramp' : n.where === 'table' ? 'on the table' : 'on the shelf');
    lumina.scene({
      shapes: list.map(({ now: n }) => ({ shape: n.shape, sittingOn: SITS[n.orient], place: placeName(n) })),
      testPlaces: tests.map((t) => (t === 'ramp' ? 'a ramp' : 'a table with a block to put on top')),
      shapesCanBeTurned: canTurn,
      sortingBoxes: bins.map((b) => b.label),
      testsWatched: world.log,
      blockIs: world.block === 'top' ? 'on top of the shape on the table' : world.block === 'fall' ? 'falling off' : 'beside the table',
    });
  }, [world]);

  // ---- geometry ----
  const rampPoint = (s) => {
    if (s <= RAMP_LEN) {
      const t = s / RAMP_LEN;
      return { x: RAMP_A.x + (RAMP_B.x - RAMP_A.x) * t, y: RAMP_A.y + (RAMP_B.y - RAMP_A.y) * t, angle: RAMP_DEG };
    }
    return { x: RAMP_B.x + (s - RAMP_LEN), y: FLOOR, angle: 0 };
  };
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const nBins = bins.length;
  const BIN_GAP = 14;
  const BIN_W = (W - 20 - BIN_GAP * (nBins - 1)) / nBins;
  const BIN_Y = 326;
  const BIN_H = 118;
  const binX = (j) => 10 + j * (BIN_W + BIN_GAP);

  const placeOf = (n, w) => {
    if (n.where === 'shelf') return { x: 56 + n.slot * 84, y: SHELF_Y, angle: 0, scale: 1, rot: n.rot };
    if (n.where === 'table') return { x: TABLE_X, y: TABLE_TOP, angle: 0, scale: 1, rot: n.rot };
    if (n.where === 'ramp') {
      const a = w.rampAnim;
      if (a && a.shape === n.shape) {
        const t = Math.min(1, Math.max(0, (now - a.t0) / RAMP_MS));
        const s = a.s0 + (a.s1 - a.s0) * ease(t);
        const p = rampPoint(s);
        const rot = a.roll ? n.rot + ((s - a.s0) / RADIUS[n.shape]) * (180 / Math.PI) : n.rot;
        return { ...p, scale: 1, rot };
      }
      return { ...rampPoint(n.s), scale: 1, rot: n.rot };
    }
    const j = bins.findIndex((b) => b.id === n.bin);
    const mates = Object.values(w.solids).filter((m) => m.where === 'bin' && m.bin === n.bin).sort((a, b) => a.order - b.order);
    const k = mates.findIndex((m) => m.shape === n.shape);
    return { x: binX(j) + 34 + k * 52, y: BIN_Y + BIN_H - 8, angle: 0, scale: 0.6, rot: n.rot };
  };

  // ---- actions ----
  const finishRamp = (token) => put((w) => {
    const a = w.rampAnim;
    if (!a || a.token !== token) return w;
    const n = w.solids[a.shape];
    const rot = a.roll ? n.rot + ((a.s1 - a.s0) / RADIUS[a.shape]) * (180 / Math.PI) : n.rot;
    const rec = { ...w.record[a.shape], [a.roll ? 'rolled' : 'slid']: true };
    const line = a.shape + ' on its ' + SITS[n.orient] + ', on the ramp: ' + (a.roll ? 'rolled' : 'slid');
    return { ...w, rampAnim: null, solids: { ...w.solids, [a.shape]: { ...n, s: a.s1, rot } }, record: { ...w.record, [a.shape]: rec }, log: w.log.concat(line) };
  });

  const finishFall = (token) => put((w) => {
    if (!w.fallAnim || w.fallAnim.token !== token) return w;
    const shape = w.fallAnim.shape;
    const n = w.solids[shape];
    const line = 'block on top of the ' + shape + ' on its ' + SITS[n.orient] + ': fell off';
    return { ...w, fallAnim: null, block: 'home', record: { ...w.record, [shape]: { ...w.record[shape], fell: true } }, log: w.log.concat(line) };
  });

  const inRamp = (p) => hasRamp && p.x < 320 && p.y > 128 && p.y < 318;
  const inTable = (p) => hasStack && Math.abs(p.x - TABLE_X) < 110 && p.y > 128 && p.y < 318;
  const binAt = (p) => {
    if (p.y < BIN_Y - 6) return null;
    for (let j = 0; j < nBins; j += 1) if (p.x >= binX(j) - 6 && p.x <= binX(j) + BIN_W + 6) return bins[j].id;
    return null;
  };

  const dropSolid = (shape, p) => {
    let token = null;
    put((w) => {
      const solids = { ...w.solids };
      let block = w.block;
      let rampAnim = w.rampAnim;
      let order = w.order;
      const me = { ...solids[shape] };
      if (me.where === 'table' && block === 'top') block = 'home';
      if (inRamp(p)) {
        Object.values(solids).forEach((m) => { if (m.shape !== shape && m.where === 'ramp') solids[m.shape] = { ...m, where: 'shelf' }; });
        const roll = rolls(shape, me.orient);
        token = Math.random();
        me.where = 'ramp';
        me.s = S_START;
        rampAnim = { shape, token, t0: performance.now(), s0: S_START, s1: roll ? ROLL_END : SLIDE_END, roll };
      } else if (inTable(p)) {
        Object.values(solids).forEach((m) => { if (m.shape !== shape && m.where === 'table') solids[m.shape] = { ...m, where: 'shelf' }; });
        if (block === 'top') block = 'home';
        me.where = 'table';
      } else {
        const b = binAt(p);
        if (b) { order += 1; me.where = 'bin'; me.bin = b; me.order = order; } else me.where = 'shelf';
      }
      solids[shape] = me;
      return { ...w, solids, block, rampAnim, order };
    });
    if (token != null) { setNow(performance.now()); setTimeout(() => finishRamp(token), RAMP_MS + 40); }
  };

  const dropBlock = (p) => {
    const w = worldRef.current;
    const onTable = Object.values(w.solids).find((m) => m.where === 'table');
    if (!inTable(p) || !onTable) { put((x) => ({ ...x, block: 'home' })); return; }
    if (holds(onTable.shape, onTable.orient)) {
      const line = 'block on top of the ' + onTable.shape + ' on its ' + SITS[onTable.orient] + ': stayed on';
      put((x) => ({ ...x, block: 'top', record: { ...x.record, [onTable.shape]: { ...x.record[onTable.shape], held: true } }, log: x.log.concat(line) }));
      return;
    }
    const token = Math.random();
    put((x) => ({ ...x, block: 'fall', fallAnim: { token, shape: onTable.shape, t0: performance.now() } }));
    setNow(performance.now());
    setTimeout(() => finishFall(token), FALL_MS + 40);
  };

  const turn = (shape) => {
    if (!canTurn) return;
    put((w) => {
      const n = w.solids[shape];
      const list = ORIENTS[shape];
      if (list.length < 2 || (w.rampAnim && w.rampAnim.shape === shape)) return w;
      const next = list[(list.indexOf(n.orient) + 1) % list.length];
      const block = n.where === 'table' && w.block === 'top' ? 'home' : w.block;
      return { ...w, block, solids: { ...w.solids, [shape]: { ...n, orient: next } } };
    });
  };

  const local = (e) => {
    const box = svgRef.current.getBoundingClientRect();
    return { x: e.clientX - box.left, y: e.clientY - box.top };
  };

  const grab = (e, what, contact) => {
    const w = worldRef.current;
    if (what === 'block' && w.block === 'fall') return;
    if (what !== 'block' && w.rampAnim && w.rampAnim.shape === what) return;
    e.stopPropagation();
    svgRef.current.setPointerCapture(e.pointerId);
    const p = local(e);
    const d = { what, start: p, p, off: { x: contact.x - p.x, y: contact.y - p.y }, moved: false };
    dragRef.current = d;
    setDrag(d);
  };
  const onMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const p = local(e);
    const moved = d.moved || Math.hypot(p.x - d.start.x, p.y - d.start.y) > 6;
    const next = { ...d, p, moved };
    dragRef.current = next;
    setDrag(next);
  };
  const onUp = (e) => {
    const d = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (!d) return;
    const p = local(e);
    if (!d.moved) { if (d.what !== 'block') turn(d.what); return; }
    if (d.what === 'block') dropBlock(p); else dropSolid(d.what, p);
  };

  // ---- drawing ----
  const COLORS = { sphere: ['#f472b6', '#9d174d'], cube: ['#fbbf24', '#a16207'], box: ['#fb923c', '#9a3412'], cylinder: ['#38bdf8', '#075985'], cone: ['#a78bfa', '#5b21b6'] };
  const HIT = { sphere: { any: [-28, -56, 56, 56] }, cube: { face: [-26, -62, 64, 62] }, box: { long: [-40, -46, 92, 46], tall: [-20, -86, 52, 86] }, cylinder: { up: [-24, -63, 48, 63], side: [-26, -72, 86, 72] }, cone: { base: [-28, -64, 56, 64], side: [-26, -52, 94, 52] } };

  const stripe = (cx, cy, r, rot) => {
    const a = (rot * Math.PI) / 180;
    const dx = Math.cos(a) * r * 0.8;
    const dy = Math.sin(a) * r * 0.8;
    return [
      <line key="st" x1={cx - dx} y1={cy - dy} x2={cx + dx} y2={cy + dy} stroke="#f8fafc" strokeWidth={5} strokeLinecap="round" opacity={0.85} />,
      <circle key="dt" cx={cx + dx} cy={cy + dy} r={5} fill="#0f172a" />,
    ];
  };

  const art = (shape, o, rot) => {
    const [c, d] = COLORS[shape];
    if (shape === 'sphere') return [<circle key="b" cx={0} cy={-28} r={28} fill={c} />, <circle key="h" cx={-10} cy={-39} r={7} fill="#fff" opacity={0.3} />, ...stripe(0, -28, 28, rot)];
    if (shape === 'cube') return [<rect key="f" x={-26} y={-52} width={52} height={52} fill={c} />, <polygon key="t" points="-26,-52 -14,-62 38,-62 26,-52" fill={c} />, <polygon key="t2" points="-26,-52 -14,-62 38,-62 26,-52" fill="#fff" opacity={0.3} />, <polygon key="s" points="26,0 38,-10 38,-62 26,-52" fill={d} />];
    if (shape === 'box') {
      const fw = o === 'long' ? 40 : 20;
      const fh = o === 'long' ? 36 : 76;
      return [<rect key="f" x={-fw} y={-fh} width={fw * 2} height={fh} fill={c} />, <polygon key="t" points={`${-fw},${-fh} ${-fw + 12},${-fh - 10} ${fw + 12},${-fh - 10} ${fw},${-fh}`} fill={c} />, <polygon key="t2" points={`${-fw},${-fh} ${-fw + 12},${-fh - 10} ${fw + 12},${-fh - 10} ${fw},${-fh}`} fill="#fff" opacity={0.3} />, <polygon key="s" points={`${fw},0 ${fw + 12},-10 ${fw + 12},${-fh - 10} ${fw},${-fh}`} fill={d} />];
    }
    if (shape === 'cylinder' && o === 'up') return [<path key="b" d="M -24 -56 L -24 -7 A 24 7 0 0 0 24 -7 L 24 -56 Z" fill={c} />, <path key="sh" d="M 12 -56 L 12 -1 A 24 7 0 0 0 24 -7 L 24 -56 Z" fill={d} opacity={0.6} />, <ellipse key="t" cx={0} cy={-56} rx={24} ry={7} fill={c} />, <ellipse key="t2" cx={0} cy={-56} rx={24} ry={7} fill="#fff" opacity={0.3} />];
    if (shape === 'cylinder') return [<circle key="bk" cx={34} cy={-46} r={26} fill={d} />, <polygon key="bd" points="13.2,-3.6 47.2,-23.6 20.8,-68.4 -13.2,-48.4" fill={d} />, <line key="hl" x1={-13.2} y1={-48.4} x2={20.8} y2={-68.4} stroke={c} strokeWidth={3} opacity={0.7} />, <circle key="f" cx={0} cy={-26} r={26} fill={c} />, <circle key="f2" cx={0} cy={-26} r={26} fill="#fff" opacity={0.18} />, ...stripe(0, -26, 26, rot)];
    if (shape === 'cone' && o === 'base') return [<ellipse key="b" cx={0} cy={-6} rx={28} ry={7} fill={d} />, <polygon key="t" points="0,-64 -28,-6 28,-6" fill={c} />, <polygon key="sh" points="0,-64 10,-6 28,-6" fill={d} opacity={0.5} />];
    return [<polygon key="bd" points="66,-36 3.9,-0.3 -3.9,-51.7" fill={d} />, <line key="hl" x1={-3.9} y1={-51.7} x2={66} y2={-36} stroke={c} strokeWidth={3} opacity={0.7} />, <circle key="f" cx={0} cy={-26} r={26} fill={c} />, <circle key="f2" cx={0} cy={-26} r={26} fill="#fff" opacity={0.18} />, ...stripe(0, -26, 26, rot)];
  };

  const solidAt = (n, place, isDragged) => {
    const hb = HIT[n.shape][n.orient];
    return (
      <g key={n.shape} id={'solid-' + n.shape} transform={`translate(${place.x} ${place.y}) rotate(${place.angle}) scale(${place.scale})`} style={{ cursor: 'grab', touchAction: 'none' }} opacity={isDragged ? 0.92 : 1}
        onPointerDown={(e) => grab(e, n.shape, { x: place.x, y: place.y })}>
        <rect x={hb[0] - 6} y={hb[1] - 6} width={hb[2] + 12} height={hb[3] + 8} fill="transparent" />
        {art(n.shape, n.orient, place.rot)}
      </g>
    );
  };

  const blockPlace = () => {
    const w = world;
    const onTable = Object.values(w.solids).find((m) => m.where === 'table');
    if (w.block === 'top' && onTable) return { x: TABLE_X, y: TABLE_TOP - TOP[onTable.shape][onTable.orient], angle: 0 };
    if (w.block === 'fall' && w.fallAnim && onTable) {
      const t = Math.min(1, Math.max(0, (now - w.fallAnim.t0) / FALL_MS));
      const y0 = TABLE_TOP - TOP[onTable.shape][onTable.orient];
      const x = TABLE_X - 95 * t;
      const y = y0 + (FLOOR - y0) * t * t - 30 * Math.sin(Math.PI * t) * (1 - t);
      return { x, y, angle: -85 * t };
    }
    return { ...BLOCK_HOME, angle: 0 };
  };

  const binIcon = (b, x, y) => {
    const parts = [];
    let cx = x;
    if (b.roll != null) {
      parts.push(
        <g key="r" transform={`translate(${cx} ${y})`}>
          <circle cx={0} cy={0} r={9} fill="none" stroke="#cbd5e1" strokeWidth={2} />
          {b.roll ? <path d="M 12 -6 A 13 13 0 0 1 4 12" fill="none" stroke="#cbd5e1" strokeWidth={2.5} /> : <line x1={-14} y1={13} x2={14} y2={13} stroke="#cbd5e1" strokeWidth={2.5} />}
          {b.roll ? <polygon points="0,12 7,7 7,16" fill="#cbd5e1" /> : null}
          {!b.roll ? <line x1={-10} y1={-10} x2={10} y2={10} stroke="#f87171" strokeWidth={3} /> : null}
        </g>,
      );
      cx += 34;
    }
    if (b.stack != null) {
      parts.push(
        <g key="s" transform={`translate(${cx} ${y})`}>
          <rect x={-9} y={0} width={18} height={11} fill="none" stroke="#cbd5e1" strokeWidth={2} />
          {b.stack ? <rect x={-9} y={-12} width={18} height={11} fill="none" stroke="#cbd5e1" strokeWidth={2} /> : <rect x={4} y={-14} width={18} height={11} fill="none" stroke="#cbd5e1" strokeWidth={2} transform="rotate(35 13 -8)" />}
        </g>,
      );
    }
    return parts;
  };

  const solids = Object.values(world.solids);
  const dragged = drag && drag.moved && drag.what !== 'block' ? drag.what : null;
  const bp = drag && drag.moved && drag.what === 'block' ? { x: drag.p.x + drag.off.x, y: drag.p.y + drag.off.y, angle: 0 } : blockPlace();

  const caption = (hasRamp && hasStack ? 'Drag a shape onto the ramp or the table to test it. On the table, put the block on top.' : hasRamp ? 'Drag a shape onto the ramp to test it.' : 'Drag a shape onto the table, then put the block on top of it.')
    + (canTurn ? ' Tap a shape to turn it onto another side.' : '') + ' Drag each shape into a box.';

  return (
    <Panel title="Shape Test" caption={caption}>
      <svg ref={svgRef} id="world" width={W} height={H} style={{ display: 'block', touchAction: 'none', userSelect: 'none' }} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => { dragRef.current = null; setDrag(null); }}>
        <rect x={10} y={SHELF_Y} width={Math.max(200, shapeList.length * 84 + 10)} height={8} rx={3} fill="#64748b" />
        {hasRamp ? (
          <g>
            <polygon points={`${RAMP_A.x},${RAMP_A.y} ${RAMP_B.x},${RAMP_B.y} ${RAMP_A.x},${RAMP_B.y}`} fill="#334155" stroke="#94a3b8" strokeWidth={2} />
            <circle cx={rampPoint(S_START).x + 11} cy={rampPoint(S_START).y - 30} r={32} fill="none" stroke="#64748b" strokeWidth={2} strokeDasharray="5 5" />
            <rect id="ramp-top" x={40} y={122} width={110} height={70} fill="transparent" pointerEvents="none" />
          </g>
        ) : null}
        <line x1={10} y1={FLOOR} x2={W - 10} y2={FLOOR} stroke="#94a3b8" strokeWidth={2} />
        {hasStack ? (
          <g>
            <rect x={TABLE_X - 62} y={TABLE_TOP} width={124} height={10} rx={2} fill="#a8a29e" />
            <rect x={TABLE_X - 54} y={TABLE_TOP + 10} width={8} height={FLOOR - TABLE_TOP - 10} fill="#78716c" />
            <rect x={TABLE_X + 46} y={TABLE_TOP + 10} width={8} height={FLOOR - TABLE_TOP - 10} fill="#78716c" />
            <rect id="table-top" x={TABLE_X - 60} y={150} width={120} height={84} fill="transparent" pointerEvents="none" />
            <rect x={BLOCK_HOME.x - 40} y={BLOCK_HOME.y} width={80} height={8} rx={3} fill="#64748b" />
          </g>
        ) : null}

        {bins.map((b, j) => (
          <g key={b.id}>
            <rect id={'bin-' + b.id} x={binX(j)} y={BIN_Y} width={BIN_W} height={BIN_H} rx={12} fill="#1e293b" stroke="#64748b" strokeWidth={2} strokeDasharray="6 5" />
            <text x={binX(j) + 14} y={BIN_Y + 26} fill="#f1f5f9" fontSize={18} fontWeight={700}>{b.label}</text>
            {binIcon(b, binX(j) + 24, BIN_Y + 48)}
          </g>
        ))}

        {solids.filter((n) => n.shape !== dragged).map((n) => solidAt(n, placeOf(n, world), false))}

        {hasStack ? (
          <g id="block" transform={`translate(${bp.x} ${bp.y}) rotate(${bp.angle})`} style={{ cursor: 'grab' }} onPointerDown={(e) => grab(e, 'block', { x: bp.x, y: bp.y })}>
            <rect x={-30} y={-26} width={60} height={30} fill="transparent" />
            <rect x={-24} y={-20} width={48} height={20} rx={2} fill="#ef4444" stroke="#7f1d1d" strokeWidth={2} />
          </g>
        ) : null}

        {dragged ? solidAt(world.solids[dragged], { x: drag.p.x + drag.off.x, y: drag.p.y + drag.off.y, angle: 0, scale: 1, rot: world.solids[dragged].rot }, true) : null}
      </svg>
    </Panel>
  );
}
