function Display({ params, lumina }) {
  // A tool dropped on the material does what it really does there: scissors on a dashed line cut; glue or tape on an
  // overlap joins; a punch makes a hole; crayon and pencil mark; a ruler lies there. Freed parts move by hand.
  // Nothing says whether the made thing is right: the child compares it with the picture.
  // params.project: 'card' | 'star' | 'tag' | 'crown'. params.tools: tray order. params.steps: false = finished picture only.
  const project = ['card', 'star', 'tag', 'crown'].includes(params.project) ? params.project : 'card';
  const showSteps = params.steps !== false;
  const TOOLS = { scissors: 'scissors', ruler: 'ruler', glue: 'glue stick', tape: 'tape', crayon: 'crayon', pencil: 'pencil', punch: 'hole punch' };
  const tools = (Array.isArray(params.tools) ? params.tools : ['scissors', 'ruler', 'glue']).filter(k => TOOLS[k]).slice(0, 7);

  const W = 680, MAT_Y = 104, MAT_B = 408, TRAY_Y = 416, H = 526;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const distSeg = (p, a, b) => {
    const vx = b.x - a.x, vy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / (vx * vx + vy * vy || 1)));
    return Math.hypot(p.x - a.x - t * vx, p.y - a.y - t * vy);
  };
  const inRect = (p, r, pad = 0) => p.x >= r.x - pad && p.x <= r.x + r.w + pad && p.y >= r.y - pad && p.y <= r.y + r.h + pad;
  const ptsStr = pts => pts.map(q => q.x.toFixed(1) + ',' + q.y.toFixed(1)).join(' ');
  const starPts = (cx, cy, R, r) => Array.from({ length: 10 }, (_, i) => {
    const a = (-90 + 36 * i) * Math.PI / 180, d = i % 2 ? r : R;
    return { x: cx + d * Math.cos(a), y: cy + d * Math.sin(a) };
  });

  const CARD = { x: 220, y: 150, w: 240, h: 210 };
  const YELLOW = { x: 60, y: 130, w: 240, h: 250 }, STAR0 = { x: 180, y: 255 }, BLUE = { x: 400, y: 150, w: 220, h: 210 };
  const TAG_SHEET = { x: 60, y: 122, w: 300, h: 270 }, TAG = { x: 100, y: 170, w: 220, h: 170 }, DOT = { x: 210, y: 198 }, ANCHOR = { x: 620, y: 372 };
  const CROWN_SHEET = { x: 40, y: 118, w: 600, h: 146 }, RING = { x: 205, y: 232, w: 270, h: 132 }, SEAM = { x: 312, y: 240, w: 56, h: 110 };
  const zigzag = (xR, w, n, peak, valley) => {
    const out = [];
    for (let k = 0; k < n; k++) { out.push({ x: xR - w * k - w / 2, y: peak }); out.push({ x: xR - w * (k + 1), y: valley }); }
    return out;
  };
  const crownStrip = [{ x: 70, y: 250 }, { x: 610, y: 250 }, { x: 610, y: 200 }, ...zigzag(610, 90, 6, 140, 200)];
  const corners = r => [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h }];
  const LINES = {
    card: { pts: [{ x: 340, y: 150 }, { x: 340, y: 360 }], start: { x: 340, y: 157 } },
    star: { pts: starPts(180, 255, 78, 34), closed: true, start: { x: 180, y: 177 } },
    tag: { pts: corners(TAG), closed: true, start: { x: 100, y: 255 } },
    crown: { pts: crownStrip, closed: true, start: { x: 70, y: 225 } },
  };
  const line = LINES[project];
  const segs = line.pts.slice(0, line.closed ? undefined : -1).map((a, i) => [a, line.pts[(i + 1) % line.pts.length]]);
  const nearSeg = p => segs.reduce((b, s) => (distSeg(p, s[0], s[1]) < distSeg(p, b[0], b[1]) ? s : b), segs[0]);

  // What has been done to the material.
  const [cut, setCut] = useState(false);
  const [marks, setMarks] = useState([]); // { kind, x, y, on }
  const [piece, setPiece] = useState(STAR0);
  const [joined, setJoined] = useState(null); // 'glue' | 'tape'
  const [ring, setRing] = useState(false);
  const [stringEnd, setStringEnd] = useState({ x: 450, y: 210 });
  const [threaded, setThreaded] = useState(false);
  const [ruler, setRuler] = useState(null); // { x, y, angle } when it lies on the mat
  const [drag, setDrag] = useState(null);
  const svgRef = useRef(null);

  const onCard = cut && inRect(piece, BLUE, -30);
  const goalMet = project === 'card' ? cut
    : project === 'star' ? cut && onCard && !!joined
    : project === 'tag' ? cut && threaded && marks.some(m => m.kind === 'hole' && m.on === 'tag')
    : cut && ring && !!joined;

  const onLine = p => !cut && distSeg(p, ...nearSeg(p)) <= 18;
  const onSeam = p => (project === 'star' ? onCard && dist(p, piece) <= 52 : project === 'crown' && ring && inRect(p, SEAM, 8));
  const onDot = p => project === 'tag' && dist(p, DOT) <= 22;
  const partAt = p => {
    if (project === 'card') return inRect(p, CARD) ? 'card' : null;
    if (project === 'star') {
      if (cut && dist(p, piece) <= 60) return 'star';
      if (inRect(p, BLUE)) return 'blue card';
      if (cut && dist(p, STAR0) <= 34) return null;
      return inRect(p, YELLOW) ? (!cut && dist(p, STAR0) <= 60 ? 'star' : 'yellow paper') : null;
    }
    if (project === 'tag') return inRect(p, TAG) ? 'tag' : !cut && inRect(p, TAG_SHEET) ? 'paper' : null;
    if (ring) return inRect(p, RING) ? 'crown' : null;
    if (p.y >= 140 && p.y <= 250 && p.x >= 70 && p.x <= 610) return 'crown';
    return !cut && inRect(p, CROWN_SHEET) ? 'paper' : null;
  };
  const addMark = (kind, p, on) => setMarks(ms => (ms.some(m => m.kind === kind && dist(m, p) < 4) ? ms : [...ms, { kind, x: p.x, y: p.y, on }]));

  const applyTool = (tool, p) => {
    const onMat = p.y >= MAT_Y && p.y <= MAT_B;
    if (tool === 'ruler') {
      const s = nearSeg(p);
      setRuler(!onMat ? null : { x: p.x, y: p.y, angle: onLine(p) ? Math.atan2(s[1].y - s[0].y, s[1].x - s[0].x) * 180 / Math.PI : 0 });
      return;
    }
    if (!onMat) return;
    const seam = onSeam(p);
    const part = seam ? (project === 'star' ? 'star' : 'crown') : partAt(p);
    if (tool === 'scissors') { if (onLine(p)) setCut(true); else if (part) addMark('snip', p, part); }
    else if (tool === 'glue' || tool === 'tape') { if (seam && !joined) setJoined(tool); else if (part) addMark(tool, p, part); }
    else if (tool === 'crayon') { if (part) addMark('crayon', p, part); }
    else if (onDot(p)) addMark(tool === 'punch' ? 'hole' : 'pencil-dot', DOT, 'tag');
    else if (part) addMark(tool === 'punch' ? 'hole' : 'pencil', p, part);
  };

  const pointOf = e => svgPoint(svgRef.current, e);
  const grab = (key, e) => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); setDrag({ key }); };
  const onMove = e => {
    if (!drag || !svgRef.current) return;
    const p = pointOf(e);
    setDrag(d => (d ? { ...d, x: p.x, y: p.y } : null));
  };
  const clampMat = p => ({ x: Math.max(40, Math.min(W - 40, p.x)), y: Math.max(MAT_Y + 40, Math.min(MAT_B - 40, p.y)) });
  const onUp = e => {
    if (!drag || !svgRef.current) return;
    const p = pointOf(e), key = drag.key;
    setDrag(null);
    if (key.startsWith('tool:')) applyTool(key.slice(5), p);
    else if (key === 'piece') {
      const to = clampMat(p);
      setMarks(ms => ms.map(m => (m.on === 'star' ? { ...m, x: m.x + to.x - piece.x, y: m.y + to.y - piece.y } : m)));
      setPiece(to);
    } else if (key === 'string') {
      const hole = marks.find(m => m.kind === 'hole' && dist(m, p) <= 24);
      setThreaded(!!hole);
      setStringEnd(hole ? { x: hole.x, y: hole.y } : clampMat(p));
    } else if (key.startsWith('crown-') && (key === 'crown-end' ? p.x <= 170 : p.x >= 510) && p.y >= 110 && p.y <= 290) {
      setMarks(ms => ms.map(m => (m.on === 'crown' ? { ...m, x: 215 + (m.x - 70) * 250 / 540, y: 312 } : m)));
      setRing(true);
    }
  };
  const handlers = key => ({ style: { cursor: 'grab', touchAction: 'none' }, onPointerDown: e => grab(key, e), onPointerUp: onUp, onPointerCancel: () => setDrag(null) });
  const held = key => (drag && drag.key === key && drag.x !== undefined ? { x: drag.x, y: drag.y } : null);

  const PROJECT_NAMES = { card: 'a card with a dashed line', star: 'a star on a card', tag: 'a name tag', crown: 'a paper crown' };
  const STEP_NAMES = {
    card: ['the card cut in two on its dashed line'],
    star: ['the star cut out of the yellow paper', 'the star stuck on the blue card'],
    tag: ['the tag cut out', 'a hole at the top of the tag', 'a string through the hole'],
    crown: ['the crown strip cut out', 'the strip made into a ring with its ends joined'],
  };
  const MARK_NAMES = { snip: 'a small snip', glue: 'a glue smear', tape: 'a piece of tape', crayon: 'a crayon scribble', pencil: 'a pencil line', 'pencil-dot': 'a pencil dot on the printed circle', hole: 'a punched hole' };
  const facts = {
    card: [cut ? 'the card is cut into two pieces along the dashed line' : 'the card is in one piece with a dashed line down the middle'],
    star: [cut ? 'the star is cut out; the yellow paper has a star-shaped hole' : 'a star is drawn with a dashed line on the yellow paper',
      cut && (onCard ? 'the star is lying on the blue card' : 'the star is off the blue card'),
      joined && 'the star is joined to the blue card with ' + TOOLS[joined]],
    tag: [cut ? 'the tag is cut out of the paper' : 'a tag is drawn with a dashed line on the paper, with a small printed circle near its top',
      threaded ? 'the string goes through the hole and is tied' : 'the end of the string is lying loose'],
    crown: [cut ? 'the crown strip is cut out' : 'a long crown strip with points is drawn with a dashed line on the paper',
      cut && (ring ? 'the strip is bent into a ring with its two ends overlapping' : 'the strip lies flat'),
      joined && 'the overlapping ends are joined with ' + TOOLS[joined]],
  }[project].filter(Boolean);
  useEffect(() => {
    lumina.goal(goalMet);
    lumina.scene({
      project: PROJECT_NAMES[project],
      picture: showSteps ? 'step pictures, in order: ' + STEP_NAMES[project].join('; then ') : 'only the finished picture: ' + PROJECT_NAMES[project],
      tray: tools.filter(k => !(k === 'ruler' && ruler)).map(k => TOOLS[k]),
      onMat: ruler ? ['the ruler, lying on the mat'] : [],
      material: facts,
      marks: marks.map(m => MARK_NAMES[m.kind] + ' on the ' + m.on),
    });
  }, [goalMet, cut, marks, piece, joined, ring, stringEnd, threaded, ruler]);

  // Tool pictures, centred on 0,0.
  const TOOL_PICS = {
    scissors: <g>
      <path d="M -12 -5 L 32 7" stroke="#e2e8f0" strokeWidth="5" strokeLinecap="round" />
      <path d="M -12 7 L 32 -5" stroke="#cbd5e1" strokeWidth="5" strokeLinecap="round" />
      <circle cx="-22" cy="-9" r="9" fill="none" stroke="#ef4444" strokeWidth="5" />
      <circle cx="-22" cy="11" r="9" fill="none" stroke="#ef4444" strokeWidth="5" />
    </g>,
    ruler: <g>
      <rect x="-38" y="-10" width="76" height="20" rx="2" fill="#facc15" stroke="#a16207" strokeWidth="1.5" />
      {Array.from({ length: 12 }, (_, i) => <line key={i} x1={-33 + i * 6} y1="-10" x2={-33 + i * 6} y2={i % 2 ? -5 : -1} stroke="#713f12" />)}
    </g>,
    glue: <g>
      <rect x="-36" y="-8" width="9" height="16" rx="3" fill="#f8fafc" />
      <rect x="-29" y="-12" width="46" height="24" rx="4" fill="#a855f7" stroke="#581c87" strokeWidth="1.5" />
      <rect x="-18" y="-12" width="18" height="24" fill="#f3e8ff" opacity="0.85" />
      <rect x="17" y="-13" width="17" height="26" rx="4" fill="#7e22ce" stroke="#581c87" strokeWidth="1.5" />
    </g>,
    crayon: <g stroke="#7f1d1d" strokeWidth="1.2">
      <rect x="-30" y="-6" width="48" height="12" rx="2" fill="#dc2626" />
      <rect x="-20" y="-6" width="28" height="12" fill="#fca5a5" stroke="none" />
      <path d="M 18 -6 L 32 0 L 18 6 Z" fill="#dc2626" />
    </g>,
    pencil: <g stroke="#92400e">
      <rect x="-36" y="-5" width="8" height="10" rx="2" fill="#f472b6" stroke="none" />
      <rect x="-28" y="-5" width="46" height="10" fill="#fbbf24" />
      <path d="M 18 -5 L 31 0 L 18 5 Z" fill="#fde68a" />
      <path d="M 27 -1.6 L 31 0 L 27 1.6 Z" fill="#1e293b" stroke="none" />
    </g>,
    tape: <g>
      <path d="M 10 14 L 34 20 L 32 26 L 8 20 Z" fill="rgba(226,232,240,0.7)" stroke="#94a3b8" />
      <circle r="19" fill="rgba(226,232,240,0.55)" stroke="#cbd5e1" strokeWidth="2" />
      <circle r="9" fill="#1e293b" stroke="#94a3b8" strokeWidth="2" />
    </g>,
    punch: <g stroke="#334155" strokeWidth="1.5">
      <rect x="-32" y="2" width="64" height="15" rx="4" fill="#475569" />
      <rect x="-30" y="-14" width="56" height="13" rx="6" fill="#94a3b8" />
      <rect x="-6" y="-3" width="8" height="7" fill="#334155" />
      <circle cx="20" cy="10" r="3.5" fill="#0f172a" stroke="none" />
    </g>,
  };

  const mark = (m, i) => {
    const { x, y } = m, k = 'm' + i;
    if (m.kind === 'snip') return <path key={k} d={`M ${x - 7} ${y - 8} L ${x} ${y + 4} L ${x + 7} ${y - 8} Z`} fill="#14532d" stroke="#0f172a" />;
    if (m.kind === 'glue') return <ellipse key={k} cx={x} cy={y} rx="17" ry="10" fill="rgba(255,255,255,0.45)" stroke="rgba(255,255,255,0.85)" strokeWidth="1.5" />;
    if (m.kind === 'tape') return <rect key={k} x={x - 18} y={y - 8} width="36" height="16" fill="rgba(226,232,240,0.6)" stroke="#94a3b8" transform={`rotate(-14 ${x} ${y})`} />;
    if (m.kind === 'crayon') return <path key={k} d={`M ${x - 18} ${y - 2} l 6 8 l 6 -12 l 6 12 l 6 -12 l 6 8`} fill="none" stroke="#dc2626" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />;
    if (m.kind === 'pencil') return <path key={k} d={`M ${x - 11} ${y + 4} L ${x + 11} ${y - 4}`} stroke="#475569" strokeWidth="2.5" strokeLinecap="round" />;
    if (m.kind === 'pencil-dot') return <circle key={k} cx={x} cy={y} r="7" fill="#334155" />;
    return <circle key={k} cx={x} cy={y} r="8" fill="#14532d" stroke="#0f172a" strokeWidth="1.5" />;
  };
  const marksOn = on => marks.map((m, i) => (m.on === on ? mark(m, i) : null));

  const dashedLine = <g>
    <polyline points={ptsStr(line.closed ? [...line.pts, line.pts[0]] : line.pts)} fill="none" stroke="#475569" strokeWidth="2.5" strokeDasharray="8 6" />
    <circle id="cut-start" cx={line.start.x} cy={line.start.y} r="5" fill="#475569" />
  </g>;
  const shadow = node => <g opacity="0.4" transform="translate(4, 5)" style={{ filter: 'brightness(0)' }}>{node}</g>;
  const sheet = (r, fill, stroke) => <rect x={r.x} y={r.y} width={r.w} height={r.h} rx="4" fill={fill} stroke={stroke} strokeWidth="1.5" opacity={cut ? 0.22 : 1} />;
  const tapeStrip = (x, y) => <rect x={x - 22} y={y - 8} width="44" height="16" fill="rgba(226,232,240,0.6)" stroke="#94a3b8" transform={`rotate(-30 ${x} ${y})`} />;

  const cardProject = () => {
    const half = (x, cx, t) => <g transform={t}>
      <rect x={x} y={CARD.y} width={cut ? 120 : 240} height={CARD.h} rx="6" fill="#fce7f3" stroke="#be185d" strokeWidth="2" />
      <polygon points={ptsStr(starPts(cx, 255, 26, 11))} fill="#f472b6" />
      {!cut && <polygon points={ptsStr(starPts(400, 255, 26, 11))} fill="#f472b6" />}
    </g>;
    return <g id="card">
      {cut ? <g>{half(220, 280, 'translate(-14, 4) rotate(-3 280 255)')}{half(340, 400, 'translate(14, 4) rotate(3 400 255)')}</g>
        : <g>{half(220, 280, '')}{dashedLine}</g>}
      {marksOn('card')}
    </g>;
  };

  const starProject = () => {
    const at = held('piece') || piece;
    const star = (c, fill, R = 78, r = 34) => <polygon points={ptsStr(starPts(c.x, c.y, R, r))} fill={fill} stroke="#a16207" strokeWidth="2" />;
    return <g>
      <rect id="blue-card" x={BLUE.x} y={BLUE.y} width={BLUE.w} height={BLUE.h} rx="6" fill="#93c5fd" stroke="#1d4ed8" strokeWidth="2" />
      {marksOn('blue card')}
      <rect x={YELLOW.x} y={YELLOW.y} width={YELLOW.w} height={YELLOW.h} rx="4" fill="#fde68a" stroke="#ca8a04" strokeWidth="1.5" />
      {cut ? star(STAR0, '#14532d') : dashedLine}
      {marksOn('yellow paper')}
      {!cut && marksOn('star')}
      {cut && <g id="piece" {...handlers('piece')} onPointerDown={e => { if (!joined) grab('piece', e); }}>
        {joined === 'glue' && <polygon points={ptsStr(starPts(at.x, at.y, 84, 38))} fill="rgba(255,255,255,0.35)" stroke="rgba(255,255,255,0.8)" strokeWidth="2" />}
        {shadow(star(at, '#000'))}
        {star(at, '#fde68a')}
        {!held('piece') && marksOn('star')}
        {joined === 'tape' && <g>{tapeStrip(at.x - 30, at.y - 32)}{tapeStrip(at.x + 32, at.y + 30)}</g>}
      </g>}
    </g>;
  };

  const tagProject = () => {
    const h = held('string'), end = h || stringEnd, tied = threaded && !h;
    const mid = { x: (end.x + ANCHOR.x) / 2 + 30, y: (end.y + ANCHOR.y) / 2 + 40 };
    return <g>
      {sheet(TAG_SHEET, '#e0f2fe', '#0369a1')}
      {!cut && marksOn('paper')}
      {cut && shadow(<rect x={TAG.x} y={TAG.y} width={TAG.w} height={TAG.h} />)}
      <rect id="tag" x={TAG.x} y={TAG.y} width={TAG.w} height={TAG.h} fill="#e0f2fe" stroke={cut ? '#0369a1' : 'none'} strokeWidth="2" />
      <circle cx="160" cy="272" r="26" fill="#fde047" stroke="#a16207" strokeWidth="2" />
      <circle cx="151" cy="266" r="3" fill="#422006" /><circle cx="169" cy="266" r="3" fill="#422006" />
      <path d="M 148 280 Q 160 290 172 280" fill="none" stroke="#422006" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="200" y1="290" x2="296" y2="290" stroke="#7dd3fc" strokeWidth="3" />
      <circle id="hole-dot" cx={DOT.x} cy={DOT.y} r="8" fill="none" stroke="#64748b" strokeWidth="1.5" />
      {!cut && dashedLine}
      {marksOn('tag')}
      <g fill="none" stroke="#ec4899" strokeWidth="4" strokeLinecap="round">
        {tied ? <path d={`M ${end.x - 2} ${end.y} C ${end.x - 80} ${MAT_Y + 4}, ${end.x + 80} ${MAT_Y + 4}, ${end.x + 2} ${end.y}`} />
          : <g>
            <path d={`M ${ANCHOR.x} ${ANCHOR.y} Q ${mid.x} ${mid.y} ${end.x} ${end.y}`} />
            <path d={`M ${ANCHOR.x} ${ANCHOR.y} q 30 -6 40 -26`} />
          </g>}
      </g>
      <g id="string-end" {...handlers('string')}>
        <circle cx={end.x} cy={tied ? end.y - 16 : end.y} r="22" fill="transparent" />
        <circle cx={end.x} cy={tied ? end.y - 16 : end.y} r={tied ? 5 : 6} fill="#be185d" />
      </g>
    </g>;
  };

  const crownProject = () => {
    if (ring) {
      const back = [{ x: 228, y: 300 }, { x: 452, y: 300 }, ...zigzag(452, 44.8, 5, 248, 284)];
      const d = 'M 210 290 L 210 322 Q 340 364 470 322 L 470 290 ' + zigzag(470, 43.33, 6, 236, 290).map(q => `L ${q.x.toFixed(1)} ${q.y}`).join(' ') + ' Z';
      return <g id="crown">
        <polygon points={ptsStr(back)} fill="#a16207" stroke="#713f12" strokeWidth="2" />
        <path d={d} fill="#facc15" stroke="#a16207" strokeWidth="2" />
        <rect x="330" y="291" width="22" height="49" fill="#eab308" opacity="0.6" />
        <path d="M 330 290 L 330 341" stroke="#a16207" strokeWidth="1.5" />
        {marksOn('crown')}
        {joined === 'tape' && <rect x="318" y="282" width="46" height="30" fill="rgba(226,232,240,0.6)" stroke="#94a3b8" />}
        {joined === 'glue' && <path d="M 327 262 L 327 338" stroke="rgba(255,255,255,0.85)" strokeWidth="4" strokeLinecap="round" />}
        <rect id="seam" x={SEAM.x} y={SEAM.y} width={SEAM.w} height={SEAM.h} fill="transparent" />
      </g>;
    }
    const h = held('crown-end') || held('crown-start');
    const strip = fill => <polygon points={ptsStr(crownStrip)} fill={fill} stroke="#a16207" strokeWidth="2" />;
    return <g>
      {sheet(CROWN_SHEET, '#fef9c3', '#ca8a04')}
      {!cut && marksOn('paper')}
      {cut ? <g>{shadow(strip('#000'))}{strip('#facc15')}</g> : dashedLine}
      {marksOn('crown')}
      {cut && ['crown-start', 'crown-end'].map((k, i) => <g key={k} id={k} {...handlers(k)}>
        <rect x={i ? 540 : 68} y="140" width="72" height="112" fill="transparent" />
      </g>)}
      {h && <rect x={h.x - 22} y={h.y - 26} width="44" height="52" fill="#facc15" stroke="#a16207" strokeWidth="2" opacity="0.85" />}
    </g>;
  };

  // The pictures: results only, never a tool.
  const miniStar = (cx, cy, s) => <polygon points={ptsStr(starPts(cx, cy, 26 * s, 11 * s))} fill="#fde68a" stroke="#a16207" strokeWidth="1.5" />;
  const miniTag = n => <g>
    <rect x="22" y="22" width="60" height="46" fill="#e0f2fe" stroke="#0369a1" strokeWidth="1.5" />
    <circle cx="40" cy="48" r="8" fill="#fde047" />
    {n >= 2 && <circle cx="52" cy="30" r="4" fill="#0f172a" />}
    {n >= 3 && <path d="M 50 30 C 30 2, 74 2, 54 30" fill="none" stroke="#ec4899" strokeWidth="3" />}
  </g>;
  const PICS = {
    card: [() => <g fill="#fce7f3" stroke="#be185d" strokeWidth="1.5">
      <rect x="14" y="16" width="34" height="50" rx="3" transform="rotate(-4 31 41)" />
      <rect x="56" y="16" width="34" height="50" rx="3" transform="rotate(4 73 41)" />
      <polygon points={ptsStr(starPts(31, 41, 9, 4))} fill="#f472b6" stroke="none" />
      <polygon points={ptsStr(starPts(73, 41, 9, 4))} fill="#f472b6" stroke="none" />
    </g>],
    star: [() => <g>
      <rect x="8" y="14" width="46" height="54" rx="2" fill="#fde68a" />
      <polygon points={ptsStr(starPts(31, 42, 18, 8))} fill="#1e293b" />
      {miniStar(78, 42, 0.75)}
    </g>, () => <g>
      <rect x="18" y="12" width="68" height="58" rx="3" fill="#93c5fd" stroke="#1d4ed8" strokeWidth="1.5" />
      {miniStar(52, 41, 0.9)}
    </g>],
    tag: [() => miniTag(1), () => miniTag(2), () => miniTag(3)],
    crown: [() => <polygon points={ptsStr([{ x: 10, y: 58 }, { x: 94, y: 58 }, { x: 94, y: 48 }, ...zigzag(94, 14, 6, 32, 48)])} fill="#facc15" stroke="#a16207" strokeWidth="1.5" />,
      () => <g stroke="#a16207" strokeWidth="1.5">
        <path d="M 24 54 L 24 64 Q 52 76 80 64 L 80 54 L 73 36 L 66 54 L 59 36 L 52 54 L 45 36 L 38 54 L 31 36 Z" fill="#facc15" />
        <path d="M 52 50 L 52 70" strokeWidth="1" />
      </g>],
  };
  const pics = showSteps ? PICS[project] : PICS[project].slice(-1);
  const BOX = 104, GAP = 34, x0 = (W - (pics.length * BOX + (pics.length - 1) * GAP)) / 2;

  const slot = i => ({ x: (W / (tools.length + 1)) * (i + 1), y: TRAY_Y + 40 });
  const toolItem = (key, i) => {
    const h = held('tool:' + key), lying = key === 'ruler' && ruler && !h;
    const at = h || (lying ? ruler : slot(i));
    return <g key={key} id={'tool-' + key} transform={`translate(${at.x}, ${at.y}) rotate(${lying ? ruler.angle : 0}) scale(${h ? 1.12 : 1})`} {...handlers('tool:' + key)}>
      <rect x="-40" y="-26" width="80" height="52" fill="transparent" />
      {TOOL_PICS[key]}
    </g>;
  };

  return (
    <Panel>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} onPointerMove={onMove}
        style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        {pics.map((pic, i) => <g key={'pic' + i} transform={`translate(${x0 + i * (BOX + GAP)}, 6)`}>
          <rect width={BOX} height="84" rx="10" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />
          {pic()}
          {i < pics.length - 1 && <path d={`M ${BOX + 9} 42 h ${GAP - 18} m -6 -7 l 6 7 l -6 7`} fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" />}
        </g>)}
        <rect y={MAT_Y} width={W} height={MAT_B - MAT_Y} rx="12" fill="#14532d" />
        <g stroke="#166534">
          {Array.from({ length: 16 }, (_, i) => <line key={'x' + i} x1={20 + i * 40} y1={MAT_Y} x2={20 + i * 40} y2={MAT_B} />)}
          {Array.from({ length: 7 }, (_, i) => <line key={'y' + i} x1="0" y1={MAT_Y + 24 + i * 40} x2={W} y2={MAT_Y + 24 + i * 40} />)}
        </g>
        {{ card: cardProject, star: starProject, tag: tagProject, crown: crownProject }[project]()}
        <rect y={TRAY_Y} width={W} height={H - TRAY_Y - 2} rx="12" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />
        {tools.map((k, i) => (k === 'ruler' && ruler ? null
          : <text key={'l-' + k} x={slot(i).x} y={TRAY_Y + 92} textAnchor="middle" fill="#94a3b8" fontSize="12">{TOOLS[k]}</text>))}
        {tools.map(toolItem)}
      </svg>
    </Panel>
  );
}
