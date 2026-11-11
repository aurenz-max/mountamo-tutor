function Display({ params, lumina }) {
  const ribbon = params?.ribbon ?? 320;
  const laid = params?.laid ?? [];
  const tray = params?.tray ?? ['block'];
  const WIDTH = { block: 80, clip: 40 };
  const NAME = { block: 'block', clip: 'clip' };
  const SNAP = 16;
  const ORIGIN = 24;

  const [units, setUnits] = useState(() => laid.map((u, i) => ({ id: 'unit-' + i, kind: u.kind, x: u.x })));
  const nextId = useRef(laid.length);
  const [typed, setTyped] = useState('');
  const drag = useRef(null);

  const widthOf = (u) => WIDTH[u.kind];

  useEffect(() => {
    const row = units.slice().sort((a, b) => a.x - b.x);
    const oneKind = row.length > 0 && row.every((u) => u.kind === row[0].kind);
    const touching = row.every((u, i) => (i === 0 ? u.x === 0 : u.x === row[i - 1].x + widthOf(row[i - 1])));
    const last = row[row.length - 1];
    const reaches = !!last && last.x + widthOf(last) === ribbon;
    lumina.goal(oneKind && touching && reaches && typed === String(row.length));
    lumina.scene({ ribbonLengthInPixels: ribbon, unitsOnTheRibbonLeftToRight: row.map((u) => NAME[u.kind]), trayOffers: tray.map((k) => NAME[k]), numberTyped: typed });
  }, [units, typed, ribbon]);

  const add = (kind) => {
    setUnits((list) => {
      const w = WIDTH[kind];
      const row = list.slice().sort((a, b) => a.x - b.x);
      let x = 0;
      for (const u of row) {
        if (u.x - x >= w) break;
        x = Math.max(x, u.x + widthOf(u));
      }
      const id = 'unit-' + nextId.current;
      nextId.current += 1;
      return list.concat({ id, kind, x });
    });
  };

  const settle = (id, rawX) => {
    setUnits((list) => {
      const me = list.find((u) => u.id === id);
      const w = widthOf(me);
      let best = Math.max(0, Math.round(rawX / 10) * 10);
      let bestDist = SNAP + 1;
      const edges = [0];
      list.forEach((u) => {
        if (u.id === id) return;
        edges.push(u.x + widthOf(u));
        edges.push(u.x - w);
      });
      edges.forEach((e) => {
        const d = Math.abs(e - rawX);
        if (e >= 0 && d <= SNAP && d < bestDist) { best = e; bestDist = d; }
      });
      return list.map((u) => (u.id === id ? { ...u, x: best } : u));
    });
  };

  const onDown = (e, u) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: u.id, startClient: e.clientX, startX: u.x, moved: false };
  };
  const onMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.startClient;
    if (Math.abs(dx) > 5) d.moved = true;
    if (!d.moved) return;
    const x = Math.max(0, d.startX + dx);
    setUnits((list) => list.map((u) => (u.id === d.id ? { ...u, x } : u)));
  };
  const onUp = (e) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (!d.moved) {
      setUnits((list) => list.filter((u) => u.id !== d.id));
      return;
    }
    settle(d.id, Math.max(0, d.startX + (e.clientX - d.startClient)));
  };

  const pressDigit = (c) => setTyped((t) => (t.length < 2 ? t + c : t));
  const erase = () => setTyped((t) => t.slice(0, -1));

  const Unit = ({ kind, h }) => {
    const w = WIDTH[kind];
    if (kind === 'block') {
      return <div style={{ width: w - 2, height: h, boxSizing: 'border-box', borderRadius: 7, background: '#3b82f6', border: '2px solid #bfdbfe' }} />;
    }
    return (
      <div style={{ width: w - 2, height: h, boxSizing: 'border-box', borderRadius: 7, background: '#f59e0b', border: '2px solid #fde68a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: w - 18, height: h - 18, borderRadius: 8, border: '2px solid #78350f' }} />
      </div>
    );
  };

  const line = (x) => ({ position: 'absolute', left: ORIGIN + x - 1, top: 0, width: 2, height: 112, background: '#94a3b8' });
  const keyStyle = { width: 50, height: 46, borderRadius: 10, border: '1px solid #475569', background: '#1e293b', color: '#f1f5f9', fontSize: 21, fontWeight: 700, cursor: 'pointer' };

  return (
    <Panel title="Fair Measure" caption="Drag a unit to slide it. Tap a unit to take it away. Tap the tray to add one.">
      <Stack gap={14}>
        <div id="track" style={{ position: 'relative', height: 116, width: 660, touchAction: 'none', userSelect: 'none', overflow: 'hidden' }}>
          <div style={line(0)} />
          <div style={line(ribbon)} />
          <div id="ribbon" style={{ position: 'absolute', left: ORIGIN, top: 10, width: ribbon, height: 26, borderRadius: 5, background: '#ec4899' }} />
          {units.map((u) => (
            <div
              key={u.id}
              id={u.id}
              onPointerDown={(e) => onDown(e, u)}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={() => { drag.current = null; }}
              style={{ position: 'absolute', left: ORIGIN + u.x + 1, top: 56, cursor: 'grab', touchAction: 'none' }}
            >
              <Unit kind={u.kind} h={46} />
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 22 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            {tray.map((kind) => (
              <button key={kind} id={'add-' + kind} type="button" onClick={() => add(kind)} style={{ width: 116, height: 76, borderRadius: 12, border: '1px solid #475569', background: '#1e293b', color: '#cbd5e1', fontSize: 15, fontWeight: 600, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer' }}>
                <Unit kind={kind} h={32} />
                <span>Add a {NAME[kind]}</span>
              </button>
            ))}
          </div>
          <div>
            <div style={{ color: '#94a3b8', fontSize: 15, marginBottom: 4, textAlign: 'center' }}>How long is the ribbon?</div>
            <div id="typed" style={{ width: 150, height: 54, borderRadius: 12, border: '2px solid #475569', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 800, color: '#f1f5f9' }}>{typed}</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 50px)', gap: 5, justifyContent: 'center' }}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d) => (
            <button key={d} id={'key-' + d} type="button" style={keyStyle} onClick={() => pressDigit(String(d))}>{d}</button>
          ))}
          <button id="key-erase" type="button" style={{ ...keyStyle, gridColumn: 'span 2', width: 105, fontSize: 15 }} onClick={erase}>Erase</button>
        </div>
      </Stack>
    </Panel>
  );
}
