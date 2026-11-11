function Display({ params, lumina }) {
  const n = params?.n ?? 42;
  const cols = params?.cols ?? 10;
  const holes = params?.holes ?? [];
  const shape = params?.shape ?? 'dot';
  const showRingCount = params?.showRingCount ?? false;

  const CELL = 34;
  const holeSet = useMemo(() => new Set(holes.map(([r, c]) => r + '-' + c)), [holes]);

  // Objects fill row by row, skipping the gaps, until there are n of them.
  const objects = useMemo(() => {
    const out = [];
    for (let r = 0; out.length < n && r < 40; r += 1) {
      for (let c = 0; c < cols && out.length < n; c += 1) {
        if (!holeSet.has(r + '-' + c)) out.push(r + '-' + c);
      }
    }
    return new Set(out);
  }, [n, cols, holeSet]);

  const rows = useMemo(() => {
    let max = 0;
    objects.forEach((k) => { max = Math.max(max, Number(k.split('-')[0])); });
    return max + 1;
  }, [objects]);

  // A ring is the objects the child's strokes went through, in order.
  const [rings, setRings] = useState([]);
  const ringsRef = useRef([]);
  const commit = (next) => { ringsRef.current = next; setRings(next); };
  const stroke = useRef(null);
  const fieldRef = useRef(null);
  const [typed, setTyped] = useState('');

  useEffect(() => {
    const ringed = rings.reduce((sum, ring) => sum + ring.length, 0);
    const allTens = rings.length > 0 && rings.every((ring) => ring.length === 10);
    lumina.goal(allTens && n - ringed < 10 && typed === String(n));
    lumina.scene({ objectShape: shape, objectsAcrossEachRow: cols, rowsDown: rows, emptySpotsInTheRows: holes.length, ringsDrawn: rings.length, objectsInEachRing: rings.map((ring) => ring.length), numberTyped: typed });
  }, [rings, typed, n, shape, cols, rows, holes]);

  const local = (e) => {
    const box = fieldRef.current.getBoundingClientRect();
    return { x: e.clientX - box.left, y: e.clientY - box.top };
  };
  const cellOf = (p) => Math.floor(p.y / CELL) + '-' + Math.floor(p.x / CELL);
  const objectAt = (p) => {
    const r = Math.floor(p.y / CELL);
    const c = Math.floor(p.x / CELL);
    const key = r + '-' + c;
    if (!objects.has(key)) return null;
    const dx = p.x - (c + 0.5) * CELL;
    const dy = p.y - (r + 0.5) * CELL;
    return Math.sqrt(dx * dx + dy * dy) <= CELL * 0.46 ? key : null;
  };
  const ringOf = (key) => ringsRef.current.findIndex((ring) => ring.includes(key));

  const gather = (key) => {
    const s = stroke.current;
    if (!key || !s || ringOf(key) >= 0) return;
    if (s.ring < 0) {
      s.ring = ringsRef.current.length;
      commit(ringsRef.current.concat([[key]]));
    } else {
      commit(ringsRef.current.map((ring, i) => (i === s.ring ? ring.concat(key) : ring)));
    }
  };

  const onDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = local(e);
    const key = objectAt(p);
    const owner = key ? ringOf(key) : -1;
    stroke.current = { ring: owner, tappedRinged: owner >= 0 ? key : null, startCell: cellOf(p), moved: false, last: p };
    if (owner < 0) gather(key);
  };

  const onMove = (e) => {
    const s = stroke.current;
    if (!s) return;
    const p = local(e);
    if (cellOf(p) !== s.startCell) s.moved = true;
    // Sample along the segment so a fast stroke still passes through every object under it.
    const dist = Math.sqrt((p.x - s.last.x) ** 2 + (p.y - s.last.y) ** 2);
    const steps = Math.max(1, Math.ceil(dist / (CELL / 4)));
    for (let i = 1; i <= steps; i += 1) {
      const t = i / steps;
      gather(objectAt({ x: s.last.x + (p.x - s.last.x) * t, y: s.last.y + (p.y - s.last.y) * t }));
    }
    s.last = p;
  };

  const onUp = () => {
    const s = stroke.current;
    stroke.current = null;
    if (!s || s.moved) return;
    // A tap, not a stroke: a tap on a ringed object takes that one out; a tap on a loose one does nothing.
    const drop = s.tappedRinged;
    const ring = s.ring;
    const next = ringsRef.current
      .map((list, i) => {
        if (drop) return list.filter((k) => k !== drop);
        return i === ring ? [] : list;
      })
      .filter((list) => list.length > 0);
    commit(next);
  };

  const pressDigit = (d) => setTyped((t) => (t.length < 4 ? t + d : t));
  const erase = () => setTyped((t) => t.slice(0, -1));

  const RING_COLORS = ['#fbbf24', '#38bdf8', '#f472b6', '#4ade80', '#a78bfa'];
  const LOOSE = '#e2e8f0';
  const colorByKey = {};
  rings.forEach((ring, i) => ring.forEach((k) => { colorByKey[k] = RING_COLORS[i % RING_COLORS.length]; }));

  const Mark = ({ fill }) => {
    if (shape === 'square') return <div style={{ width: 16, height: 16, borderRadius: 3, background: fill }} />;
    if (shape === 'star') {
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" style={{ display: 'block' }}>
          <polygon points="10,1.5 12.6,7.2 18.8,7.9 14.2,12.1 15.5,18.3 10,15.2 4.5,18.3 5.8,12.1 1.2,7.9 7.4,7.2" fill={fill} />
        </svg>
      );
    }
    return <div style={{ width: 17, height: 17, borderRadius: 9, background: fill }} />;
  };

  const centre = (key) => {
    const [r, c] = key.split('-').map(Number);
    return { x: (c + 0.5) * CELL, y: (r + 0.5) * CELL };
  };

  const keyStyle = { width: 62, height: 52, borderRadius: 10, border: '1px solid #475569', background: '#1e293b', color: '#f1f5f9', fontSize: 23, fontWeight: 700, cursor: 'pointer' };

  return (
    <Panel title="Ring the Tens" caption="Drag through the objects to gather them into a group. Drag from a group to add more. Tap one to take it out.">
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', justifyContent: 'center' }}>
        <div
          id="field"
          ref={fieldRef}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={() => { stroke.current = null; }}
          style={{ position: 'relative', width: cols * CELL, height: rows * CELL, touchAction: 'none', cursor: 'crosshair', userSelect: 'none', flex: '0 0 auto' }}
        >
          <svg width={cols * CELL} height={rows * CELL} style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}>
            {rings.map((ring, i) => {
              const pts = ring.map(centre);
              const line = (pts.length === 1 ? [pts[0], pts[0]] : pts).map((p) => p.x + ',' + p.y).join(' ');
              return <polyline key={i} points={line} fill="none" stroke={RING_COLORS[i % RING_COLORS.length]} strokeOpacity={0.35} strokeWidth={28} strokeLinecap="round" strokeLinejoin="round" />;
            })}
          </svg>
          {Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (__, c) => {
            const key = r + '-' + c;
            return (
              <div key={key} id={'cell-' + key} style={{ position: 'absolute', left: c * CELL, top: r * CELL, width: CELL, height: CELL, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {objects.has(key) ? <Mark fill={colorByKey[key] || LOOSE} /> : null}
              </div>
            );
          }))}
          {showRingCount ? rings.map((ring, i) => {
            const end = centre(ring[ring.length - 1]);
            return (
              <div key={'count-' + i} style={{ position: 'absolute', left: end.x + 2, top: end.y - 22, minWidth: 20, height: 20, borderRadius: 10, background: '#0f172a', border: '1px solid #94a3b8', color: '#f1f5f9', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                {ring.length}
              </div>
            );
          }) : null}
        </div>

        <Stack gap={12}>
          <div>
            <div style={{ color: '#94a3b8', fontSize: 15, marginBottom: 4, textAlign: 'center' }}>How many in all?</div>
            <div id="typed" style={{ width: 200, height: 60, borderRadius: 12, border: '2px solid #475569', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, fontWeight: 800, color: '#f1f5f9' }}>{typed}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 62px)', gap: 7 }}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
              <button key={d} id={'key-' + d} type="button" style={keyStyle} onClick={() => pressDigit(String(d))}>{d}</button>
            ))}
            <button id="key-0" type="button" style={keyStyle} onClick={() => pressDigit('0')}>0</button>
            <button id="key-erase" type="button" style={{ ...keyStyle, gridColumn: 'span 2', width: 131, fontSize: 17 }} onClick={erase}>Erase</button>
          </div>
        </Stack>
      </div>
    </Panel>
  );
}
