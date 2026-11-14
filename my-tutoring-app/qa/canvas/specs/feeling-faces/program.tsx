function Display({ params, lumina }) {
  // Children stand in a small scene with blank faces. A row of face stamps waits in the tray. Drag a face onto a child's
  // head to give the child that face; drag it to another child to move it, or off the child to take it away. A stamp
  // never runs out, so two children can wear the same face.
  // params.people: [{ id, shirt, shirtName, skin, x, dir, pose, does, want }] pose: stand | reach | back | slump.
  //   want: the face kinds that fit (the key, for code only; never drawn or reported).
  // params.faces: face kinds in tray order. params.props: [{ pic, name, x, y, size, rot }] or [{ puddle: colour, x, y, size }].
  const FACE = {
    happy: { pic: '😀', name: 'happy face' },
    sad: { pic: '😢', name: 'sad face' },
    mad: { pic: '😠', name: 'mad face' },
    scared: { pic: '😨', name: 'scared face' },
    surprised: { pic: '😮', name: 'surprised face' },
    worried: { pic: '😟', name: 'worried face' },
  };
  const people = (Array.isArray(params.people) ? params.people : [
    { id: 'kid', shirt: '#3b82f6', shirtName: 'blue', skin: '#e0ac69', x: 340, dir: 1, pose: 'stand', does: 'standing', want: ['happy'] },
  ]).slice(0, 3);
  const faces = (Array.isArray(params.faces) ? params.faces : ['happy', 'sad']).filter(k => FACE[k]).slice(0, 6);
  const props = Array.isArray(params.props) ? params.props : [];
  const W = 680, H = 470, GROUND = 300, HEAD_Y = 110, TRAY_Y = 400;

  const [worn, setWorn] = useState(() => ({}));
  const [drag, setDrag] = useState(null);
  const svgRef = useRef(null);
  const goalMet = people.every(p => (Array.isArray(p.want) ? p.want : []).includes(worn[p.id]));

  useEffect(() => {
    lumina.goal(goalMet);
    lumina.scene({
      children: people.map(p => 'child in the ' + (p.shirtName || 'plain') + ' shirt, ' + (p.does || 'standing') + ': ' +
        (worn[p.id] ? FACE[worn[p.id]].name : 'no face yet')),
      things: props.map(t => t.name).filter(Boolean),
      faceStamps: faces.map(k => FACE[k].name),
    });
  }, [worn, goalMet]);

  const pointOf = e => svgPoint(svgRef.current, e);
  const grab = (kind, from, e) => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); setDrag({ kind, from }); };
  const onMove = e => { if (drag && svgRef.current) { const p = pointOf(e); setDrag(d => (d ? { ...d, x: p.x, y: p.y } : null)); } };
  const headAt = p => {
    const lean = p.pose === 'back' ? -14 * (p.dir || 1) : 0;
    const r = lean * Math.PI / 180, dy = HEAD_Y - GROUND;
    return { x: p.x - Math.sin(r) * dy, y: GROUND + Math.cos(r) * dy };
  };
  const onUp = e => {
    if (!drag || !svgRef.current) return;
    const pt = pointOf(e), d = drag;
    setDrag(null);
    if (d.x === undefined) return;
    const hit = people.find(p => { const h = headAt(p); return Math.hypot(pt.x - h.x, pt.y - h.y) < 70; });
    setWorn(w => {
      const n = { ...w };
      if (d.from !== 'tray') delete n[d.from];
      if (hit) n[hit.id] = d.kind;
      return n;
    });
  };

  const SKIN_LINE = '#0f172a';
  const person = p => {
    const dir = p.dir || 1, x = p.x, skin = p.skin || '#e0ac69', shirt = p.shirt || '#3b82f6';
    const lean = p.pose === 'back' ? -14 * dir : 0;
    const sh = { l: x - 30, r: x + 30, y: 178 };
    let hands;
    if (p.pose === 'reach') hands = [[x + dir * 92, 182], [x + dir * 84, 204]];
    else if (p.pose === 'back') hands = [[x + dir * 66, 146], [x + dir * 60, 182]];
    else if (p.pose === 'slump') hands = [[x - 38, 254], [x + 38, 254]];
    else hands = [[x - 40, 236], [x + 40, 236]];
    const fromL = p.pose === 'reach' || p.pose === 'back' ? (dir > 0 ? sh.r : sh.l) : sh.l;
    const fromR = p.pose === 'reach' || p.pose === 'back' ? (dir > 0 ? sh.l : sh.r) : sh.r;
    const headY = HEAD_Y + (p.pose === 'slump' ? 10 : 0);
    return <g key={p.id} transform={`rotate(${lean} ${x} ${GROUND})`}>
      <line x1={x - 14} y1={250} x2={x - 18} y2={GROUND} stroke="#334155" strokeWidth="14" strokeLinecap="round" />
      <line x1={x + 14} y1={250} x2={x + 18} y2={GROUND} stroke="#334155" strokeWidth="14" strokeLinecap="round" />
      {[fromL, fromR].map((sx, i) => <g key={i}>
        <line x1={sx} y1={sh.y} x2={hands[i][0]} y2={hands[i][1]} stroke={shirt} strokeWidth="13" strokeLinecap="round" />
        <circle cx={hands[i][0]} cy={hands[i][1]} r="9" fill={skin} stroke={SKIN_LINE} strokeWidth="1" />
      </g>)}
      <rect x={x - 34} y={162} width="68" height="94" rx="22" fill={shirt} />
      <rect x={x - 7} y={146} width="14" height="20" fill={skin} />
      <circle id={'head-' + p.id} cx={x} cy={headY} r="44" fill={skin} stroke="#475569" strokeWidth="2.5" strokeDasharray="6 5" />
    </g>;
  };

  const faceAt = (kind, at, key, from, idAttr, opacity = 1) => (
    <g key={key} id={idAttr} opacity={opacity} transform={`translate(${at.x}, ${at.y})`} style={{ cursor: 'grab', touchAction: 'none' }}
      onPointerDown={e => grab(kind, from, e)} onPointerUp={onUp} onPointerCancel={() => setDrag(null)}>
      {from === 'tray'
        ? <rect x="-44" y="-44" width="88" height="88" rx="14" fill="#1e293b" stroke="#64748b" strokeWidth="2" />
        : <circle r="46" fill="transparent" />}
      <text y="4" textAnchor="middle" dominantBaseline="middle" fontSize={from === 'tray' ? 56 : 82}>{FACE[kind].pic}</text>
    </g>
  );

  const trayW = Math.min(104, (W - 60) / Math.max(1, faces.length)), tx0 = (W - faces.length * trayW) / 2;
  const held = drag && drag.x !== undefined;

  return (
    <Panel title="Feeling Faces" caption="Drag a face onto a child. Drag it off to take it away.">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} onPointerMove={onMove}
        style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <rect x="0" y="0" width={W} height={H} fill="#0f172a" />
        <rect x="16" y={GROUND} width={W - 32} height="18" rx="9" fill="#14532d" />
        {props.filter(t => t.puddle).map((t, i) => <ellipse key={'pd' + i} cx={t.x} cy={t.y} rx={t.size || 40} ry={(t.size || 40) * 0.32} fill={t.puddle} />)}
        {props.filter(t => !t.puddle).map((t, i) => <text key={i} x={t.x} y={t.y} textAnchor="middle" dominantBaseline="middle" fontSize={t.size || 48}
          transform={t.rot ? `rotate(${t.rot} ${t.x} ${t.y})` : undefined}>{t.pic}</text>)}
        {people.map(person)}
        {people.filter(p => worn[p.id]).map(p => {
          const h = headAt(p);
          return faceAt(worn[p.id], { x: h.x, y: h.y + (p.pose === 'slump' ? 10 : 0) }, 'on-' + p.id, p.id, 'on-' + p.id, held && drag.from === p.id ? 0 : 1);
        })}
        <rect x="16" y={TRAY_Y - 58} width={W - 32} height="116" rx="18" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        {faces.map((k, i) => faceAt(k, { x: tx0 + i * trayW + trayW / 2, y: TRAY_Y }, 'tray-' + k, 'tray', 'face-' + k))}
        {held ? <g style={{ pointerEvents: 'none' }} transform={`translate(${drag.x}, ${drag.y})`}>
          <text y="4" textAnchor="middle" dominantBaseline="middle" fontSize="76">{FACE[drag.kind].pic}</text>
        </g> : null}
      </svg>
    </Panel>
  );
}
