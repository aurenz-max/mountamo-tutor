function Display({ params, lumina }) {
  const mode = params?.mode ?? 'read';
  const zones = params?.zones ?? 2;
  const levels = params?.levels ?? [18];
  const days = params?.days ?? ['cold', 'hot'];
  const target = params?.target ?? 'cold';
  const start = params?.start ?? 50;
  const showPictures = params?.showPictures ?? true;

  const W = 670;
  const H = 440;
  const TUBE_TOP = 10;
  const TUBE_ZERO = 280;
  const PER = (TUBE_ZERO - TUBE_TOP) / 100;
  const yOf = (level) => TUBE_ZERO - level * PER;
  const zoneOf = (level) => (zones === 2 ? (level >= 50 ? 'hot' : 'cold') : level < 34 ? 'cold' : level < 67 ? 'warm' : 'hot');
  const DAY_WORDS = { cold: 'a snowy day', warm: 'a spring day with flowers', hot: 'a sunny day at the beach' };
  const marksOf = (level) => Math.round(level / 10);

  const [hung, setHung] = useState(() => levels.map(() => null));
  const [level, setLevel] = useState(start);
  const [sunOn, setSunOn] = useState(null);
  const [drag, setDrag] = useState(null);
  const dragRef = useRef(null);
  const svgRef = useRef(null);

  useEffect(() => {
    let met = false;
    if (mode === 'read') met = levels.every((lv, i) => hung[i] === zoneOf(lv));
    else if (mode === 'set') met = zoneOf(level) === target;
    else met = sunOn != null && levels.every((lv, i) => i === sunOn || lv < levels[sunOn]);
    lumina.goal(met);
    const zoneFacts = { zoneLines: zones === 2 ? 'one line across the middle of the thermometer' : 'two lines that cut the thermometer into three parts', zonePicturesBesideThermometer: showPictures ? (zones === 2 ? 'a sun at the top, a snowflake at the bottom' : 'a sun at the top, a flower in the middle, a snowflake at the bottom') : 'none' };
    if (mode === 'read') {
      lumina.scene({ task: 'hang each thermometer by the window of its day', windows: days.map((d) => DAY_WORDS[d]), thermometers: levels.map((lv, i) => ({ redLiquidUpTo: 'about ' + marksOf(lv) + ' of 10 marks', hungBy: hung[i] ? DAY_WORDS[hung[i]] : 'not hung yet' })), ...zoneFacts });
    } else if (mode === 'set') {
      lumina.scene({ task: 'move the red liquid to show the day in the window', window: DAY_WORDS[target], redLiquidUpTo: 'about ' + marksOf(level) + ' of 10 marks', ...zoneFacts });
    } else {
      lumina.scene({ task: 'put the sun on the warmer day', windows: days.map((d, i) => 'day ' + (i + 1) + ': ' + DAY_WORDS[d]), thermometers: levels.map((lv, i) => ({ day: i + 1, redLiquidUpTo: 'about ' + marksOf(lv) + ' of 10 marks' })), sunIsOn: sunOn == null ? 'not placed yet' : 'day ' + (sunOn + 1), ...zoneFacts });
    }
  }, [hung, level, sunOn]);

  // ---- layout ----
  const nWin = days.length;
  const WIN_W = nWin === 3 ? 130 : 180;
  const WIN_GAP = nWin === 3 ? 12 : 24;
  const WIN_X0 = W - 16 - (nWin * WIN_W + (nWin - 1) * WIN_GAP);
  const winX = (j) => WIN_X0 + j * (WIN_W + WIN_GAP);
  const WIN_Y = 24;
  const WIN_H = 120;
  const homeX = (i) => 70 + i * 110;
  const SET_X = 170;
  const SET_TOP = 60;
  const CMP_X = [120, 380];
  const CMP_TOP = 86;
  const SUN_HOME = { x: 600, y: 330 };

  const local = (e) => {
    const box = svgRef.current.getBoundingClientRect();
    return { x: e.clientX - box.left, y: e.clientY - box.top };
  };
  const begin = (e, what, from) => {
    e.stopPropagation();
    svgRef.current.setPointerCapture(e.pointerId);
    const p = local(e);
    const d = { what, p, off: { x: from.x - p.x, y: from.y - p.y } };
    dragRef.current = d;
    setDrag(d);
    if (what === 'level') setLevel(levelAt(p));
  };
  const levelAt = (p) => Math.round(Math.max(0, Math.min(100, (TUBE_ZERO - (p.y - SET_TOP)) / PER)));
  const onMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const p = local(e);
    const next = { ...d, p };
    dragRef.current = next;
    setDrag(next);
    if (d.what === 'level') setLevel(levelAt(p));
  };
  const onUp = (e) => {
    const d = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (!d) return;
    const p = local(e);
    if (typeof d.what === 'number') {
      let to = null;
      for (let j = 0; j < nWin; j += 1) if (p.x >= winX(j) - 6 && p.x <= winX(j) + WIN_W + 6) to = days[j];
      setHung((h) => h.map((v, i) => (i === d.what ? to : v)));
    } else if (d.what === 'sun') {
      const k = CMP_X.findIndex((x) => Math.abs(p.x - x) < 90 && p.y > CMP_TOP - 70);
      setSunOn(k >= 0 ? k : null);
    }
  };

  // ---- drawing ----
  const sunIcon = (x, y, r) => (
    <g transform={`translate(${x} ${y})`}>
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => <line key={a} x1={0} y1={-r - 3} x2={0} y2={-r - 9} stroke="#facc15" strokeWidth={3} strokeLinecap="round" transform={`rotate(${a})`} />)}
      <circle r={r} fill="#facc15" />
    </g>
  );
  const flakeIcon = (x, y, r) => (
    <g transform={`translate(${x} ${y})`} stroke="#e0f2fe" strokeWidth={3} strokeLinecap="round">
      {[0, 60, 120].map((a) => <line key={a} x1={0} y1={-r} x2={0} y2={r} transform={`rotate(${a})`} />)}
    </g>
  );
  const flowerIcon = (x, y, r) => (
    <g transform={`translate(${x} ${y})`}>
      <line x1={0} y1={r * 0.4} x2={0} y2={r * 1.6} stroke="#4ade80" strokeWidth={3} />
      {[0, 72, 144, 216, 288].map((a) => <circle key={a} cx={0} cy={-r * 0.55} r={r * 0.45} fill="#f9a8d4" transform={`rotate(${a})`} />)}
      <circle r={r * 0.35} fill="#fde047" />
    </g>
  );

  // A thermometer whose tube top is at (x, top); the bulb hangs below. Nothing on it changes colour with the answer.
  const thermo = (key, x, top, lv, scale, extra) => {
    const bounds = zones === 2 ? [50] : [34, 67];
    const centres = zones === 2 ? { hot: 75, cold: 25 } : { hot: 84, warm: 50, cold: 17 };
    return (
      <g key={key} transform={`translate(${x} ${top}) scale(${scale})`}>
        <rect x={-34} y={-6} width={110} height={TUBE_ZERO + 50} rx={14} fill="#1e293b" stroke="#475569" strokeWidth={1.5} />
        {Array.from({ length: 11 }, (_, k) => <line key={'t' + k} x1={-24} y1={yOf(k * 10)} x2={-14} y2={yOf(k * 10)} stroke="#94a3b8" strokeWidth={2} />)}
        <rect x={-12} y={TUBE_TOP - 6} width={24} height={TUBE_ZERO - TUBE_TOP + 20} rx={12} fill="#0f172a" stroke="#cbd5e1" strokeWidth={2} />
        <rect x={-6} y={yOf(lv)} width={12} height={TUBE_ZERO + 14 - yOf(lv)} fill="#ef4444" />
        <circle cx={0} cy={TUBE_ZERO + 22} r={20} fill="#ef4444" stroke="#cbd5e1" strokeWidth={2} />
        {bounds.map((b) => <line key={'z' + b} x1={-28} y1={yOf(b)} x2={30} y2={yOf(b)} stroke="#e2e8f0" strokeWidth={2.5} strokeDasharray="6 4" />)}
        {showPictures ? (
          <g>
            {sunIcon(50, yOf(centres.hot), 9)}
            {zones === 3 ? flowerIcon(50, yOf(centres.warm) - 6, 10) : null}
            {flakeIcon(50, yOf(centres.cold), 11)}
          </g>
        ) : null}
        {extra}
      </g>
    );
  };

  const scenePic = (kind, x, y, w, h, id) => {
    const sky = kind === 'cold' ? '#94a3b8' : kind === 'warm' ? '#7dd3fc' : '#fdba74';
    const ground = kind === 'cold' ? '#f8fafc' : kind === 'warm' ? '#4ade80' : '#fde68a';
    const g = y + h * 0.68;
    const parts = [];
    if (kind === 'cold') {
      for (let k = 0; k < 14; k += 1) parts.push(<circle key={'s' + k} cx={x + 6 + ((k * 0.618 + 0.1) % 1) * (w - 12)} cy={y + 8 + ((k * 0.414 + 0.2) % 1) * (h * 0.58)} r={2.6} fill="#fff" />);
      parts.push(<circle key="m1" cx={x + w * 0.72} cy={g - 12} r={13} fill="#fff" />, <circle key="m2" cx={x + w * 0.72} cy={g - 32} r={9} fill="#fff" />, <circle key="m3" cx={x + w * 0.72 + 3} cy={g - 34} r={1.6} fill="#0f172a" />);
    } else if (kind === 'warm') {
      parts.push(<circle key="sun" cx={x + w * 0.2} cy={y + 24} r={11} fill="#fde047" />, <ellipse key="c1" cx={x + w * 0.62} cy={y + 30} rx={24} ry={10} fill="#f8fafc" />, <ellipse key="c2" cx={x + w * 0.54} cy={y + 24} rx={14} ry={9} fill="#f8fafc" />);
      for (let k = 0; k < 4; k += 1) parts.push(<g key={'f' + k}>{flowerIcon(x + 18 + k * (w - 36) / 3, g + 10, 6)}</g>);
    } else {
      parts.push(<g key="sun">{sunIcon(x + w * 0.75, y + 28, 15)}</g>, <rect key="sea" x={x} y={g - 14} width={w} height={14} fill="#38bdf8" />);
      parts.push(<path key="um" d={`M ${x + w * 0.22 - 22} ${g + 4} Q ${x + w * 0.22} ${g - 26} ${x + w * 0.22 + 22} ${g + 4} Z`} fill="#f43f5e" />, <line key="pole" x1={x + w * 0.22} y1={g + 4} x2={x + w * 0.22} y2={g + 26} stroke="#78350f" strokeWidth={3} />);
    }
    return (
      <g key={id} id={id}>
        <rect x={x} y={y} width={w} height={h} rx={10} fill={sky} />
        <rect x={x} y={g} width={w} height={y + h - g} fill={ground} />
        {parts}
        <rect x={x} y={y} width={w} height={h} rx={10} fill="none" stroke="#e2e8f0" strokeWidth={4} />
        <line x1={x + w / 2} y1={y} x2={x + w / 2} y2={y + h} stroke="#e2e8f0" strokeWidth={3} />
      </g>
    );
  };

  const caption = mode === 'read' ? 'Drag a thermometer to hang it under a window.' : mode === 'set' ? 'Drag the handle up or down to move the red liquid.' : 'Drag the sun onto one of the thermometers.';
  let body = null;

  if (mode === 'read') {
    const drawn = levels.map((lv, i) => {
      const isDrag = drag && drag.what === i;
      if (isDrag) return null;
      let x = homeX(i);
      let top = 60;
      let scale = 1;
      if (hung[i]) {
        const j = days.indexOf(hung[i]);
        const mates = levels.map((_, k) => k).filter((k) => hung[k] === hung[i]);
        const m = mates.indexOf(i);
        x = winX(j) + WIN_W / 2 - 8 + (m - (mates.length - 1) / 2) * 44;
        top = WIN_Y + WIN_H + 26;
        scale = 0.68;
      }
      return (
        <g key={'th' + i} id={'thermo-' + i} style={{ cursor: 'grab' }} onPointerDown={(e) => begin(e, i, { x, y: top })}>
          {thermo('t', x, top, lv, scale, null)}
        </g>
      );
    });
    const dragged = drag && typeof drag.what === 'number' ? thermo('drag', drag.p.x + drag.off.x, drag.p.y + drag.off.y, levels[drag.what], 0.85, null) : null;
    body = (
      <g>
        {days.map((d, j) => (
          <g key={d}>
            {scenePic(d, winX(j), WIN_Y, WIN_W, WIN_H, 'day-' + d)}
            <line x1={winX(j) + WIN_W / 2} y1={WIN_Y + WIN_H} x2={winX(j) + WIN_W / 2} y2={WIN_Y + WIN_H + 16} stroke="#94a3b8" strokeWidth={3} />
            <circle cx={winX(j) + WIN_W / 2} cy={WIN_Y + WIN_H + 18} r={5} fill="none" stroke="#94a3b8" strokeWidth={3} />
          </g>
        ))}
        {drawn}
        {dragged}
      </g>
    );
  } else if (mode === 'set') {
    const hy = SET_TOP + yOf(level);
    body = (
      <g>
        <g id="thermo-set" onPointerDown={(e) => begin(e, 'level', { x: SET_X, y: hy })} style={{ cursor: 'ns-resize' }}>
          {thermo('t', SET_X, SET_TOP, level, 1, null)}
        </g>
        <g id="level-handle" onPointerDown={(e) => begin(e, 'level', { x: SET_X, y: hy })} style={{ cursor: 'ns-resize' }} transform={`translate(${SET_X - 70} ${hy})`}>
          <rect x={-26} y={-24} width={52} height={48} fill="transparent" />
          <polygon points="-20,-16 12,0 -20,16" fill="#f8fafc" stroke="#0f172a" strokeWidth={2} />
          <line x1={12} y1={0} x2={44} y2={0} stroke="#f8fafc" strokeWidth={2} />
        </g>
        {scenePic(target, 300, 70, 330, 250, 'day-' + target)}
      </g>
    );
  } else {
    const sunPos = drag && drag.what === 'sun' ? { x: drag.p.x + drag.off.x, y: drag.p.y + drag.off.y } : sunOn != null ? { x: CMP_X[sunOn], y: CMP_TOP - 42 } : SUN_HOME;
    body = (
      <g>
        {levels.map((lv, i) => (
          <g key={'c' + i}>
            {scenePic(days[i] ?? 'warm', CMP_X[i] + 88, CMP_TOP, 120, 92, 'day-' + (i + 1))}
            <text x={CMP_X[i] + 148} y={CMP_TOP + 120} textAnchor="middle" fill="#f1f5f9" fontSize={18} fontWeight={700}>{'Day ' + (i + 1)}</text>
            <g id={'thermo-' + i}>{thermo('t', CMP_X[i], CMP_TOP, lv, 1, null)}</g>
          </g>
        ))}
        <g id="sun" style={{ cursor: 'grab' }} onPointerDown={(e) => begin(e, 'sun', sunPos)}>
          <circle cx={sunPos.x} cy={sunPos.y} r={30} fill="transparent" />
          {sunIcon(sunPos.x, sunPos.y, 18)}
        </g>
      </g>
    );
  }

  return (
    <Panel title="Thermometer" caption={caption}>
      <svg ref={svgRef} id="world" width={W} height={H} style={{ display: 'block', touchAction: 'none', userSelect: 'none' }} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => { dragRef.current = null; setDrag(null); }}>
        {body}
      </svg>
    </Panel>
  );
}
