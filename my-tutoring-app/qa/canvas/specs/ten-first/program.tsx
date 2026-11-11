function Display({ params, lumina }) {
  const numbers = params?.numbers ?? [7, 5, 3];
  const showDots = params?.showDots ?? true;
  const showCounters = params?.showCounters ?? true;

  // The child's order: indices into `numbers`, first placed first.
  const [order, setOrder] = useState([]);
  const [typed, setTyped] = useState('');

  const total = numbers.reduce((a, b) => a + b, 0);
  const placedValues = order.map((i) => numbers[i]);

  useEffect(() => {
    const allPlaced = order.length === numbers.length;
    const tenFirst = allPlaced && placedValues[0] + placedValues[1] === 10;
    lumina.goal(tenFirst && typed === String(total));
    lumina.scene({
      numbers,
      numbersPutInFirstThenNext: placedValues,
      numberTyped: typed,
    });
  }, [order, typed, numbers]);

  const place = (i) => setOrder((o) => (o.includes(i) || o.length >= numbers.length ? o : o.concat(i)));
  const unplace = (i) => setOrder((o) => o.filter((x) => x !== i));
  const pressDigit = (d) => setTyped((t) => (t.length < 3 ? t + d : t));
  const erase = () => setTyped((t) => t.slice(0, -1));

  const COLORS = ['#f87171', '#60a5fa', '#fbbf24'];

  // Counters fill the first frame and run over into the second, in the order the child placed the numbers.
  const cellColors = [];
  order.forEach((i) => {
    for (let n = 0; n < numbers[i]; n += 1) cellColors.push(COLORS[i]);
  });

  const CELL = 44;
  const GAP = 5;
  const Frame = ({ id, start }) => (
    <div id={id} style={{ display: 'grid', gridTemplateColumns: 'repeat(5, ' + CELL + 'px)', gap: GAP, padding: 8, background: '#1e293b', borderRadius: 12 }}>
      {Array.from({ length: 10 }, (_, c) => {
        const color = showCounters ? cellColors[start + c] : undefined;
        return (
          <div key={c} style={{ width: CELL, height: CELL, borderRadius: 8, border: '2px solid #475569', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {color ? <div style={{ width: 32, height: 32, borderRadius: 16, background: color }} /> : null}
          </div>
        );
      })}
    </div>
  );

  const Dots = ({ n, color }) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 9px)', gap: 3, justifyContent: 'center', minHeight: 21 }}>
      {Array.from({ length: n }, (_, k) => <div key={k} style={{ width: 9, height: 9, borderRadius: 5, background: color }} />)}
    </div>
  );

  const Tile = ({ i, inTray }) => {
    const here = order.includes(i);
    const gone = inTray ? here : false;
    return (
      <button
        id={'tile-' + i}
        type="button"
        onClick={() => (here ? unplace(i) : place(i))}
        style={{
          width: 96, minHeight: 84, borderRadius: 14, cursor: 'pointer',
          border: '2px solid ' + (gone ? '#334155' : COLORS[i]),
          background: gone ? '#0f172a' : '#1e293b',
          color: gone ? '#334155' : '#f1f5f9',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
        }}
      >
        <span style={{ fontSize: 38, fontWeight: 800, lineHeight: 1 }}>{numbers[i]}</span>
        {showDots && !gone ? <Dots n={numbers[i]} color={COLORS[i]} /> : null}
      </button>
    );
  };

  const Slot = ({ place: p, label }) => {
    const i = order[p];
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ color: '#94a3b8', fontSize: 15, marginBottom: 4 }}>{label}</div>
        <div id={'slot-' + p} style={{ width: 72, height: 60, borderRadius: 12, border: '2px dashed #475569', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 800, color: '#f1f5f9', background: i === undefined ? 'transparent' : '#1e293b' }}>
          {i === undefined ? '' : numbers[i]}
        </div>
      </div>
    );
  };

  const keyStyle = { width: 52, height: 48, borderRadius: 10, border: '1px solid #475569', background: '#1e293b', color: '#f1f5f9', fontSize: 22, fontWeight: 700, cursor: 'pointer' };

  return (
    <Panel title="Ten First" caption={(showCounters ? 'Tap a number to put it on the frames.' : 'Tap a number to put it in the row.') + ' Tap it again to take it back.'}>
      <Stack gap={12}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
          {numbers.map((_, i) => (
            <React.Fragment key={i}>
              {i > 0 ? <span style={{ fontSize: 32, color: '#94a3b8', fontWeight: 700 }}>+</span> : null}
              <Tile i={i} inTray />
            </React.Fragment>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 16 }}>
          <Slot place={0} label="first" />
          <span style={{ fontSize: 26, color: '#94a3b8', paddingBottom: 12 }}>+</span>
          <Slot place={1} label="next" />
          <span style={{ fontSize: 26, color: '#94a3b8', paddingBottom: 12 }}>+</span>
          <Slot place={2} label="last" />
        </div>

        {showCounters ? (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 18 }}>
            <Frame id="frame-a" start={0} />
            <Frame id="frame-b" start={10} />
          </div>
        ) : null}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <div>
            <div style={{ color: '#94a3b8', fontSize: 15, marginBottom: 4, textAlign: 'center' }}>How many in all?</div>
            <div id="typed" style={{ width: 110, height: 56, borderRadius: 12, border: '2px solid #475569', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, fontWeight: 800, color: '#f1f5f9' }}>{typed}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 52px)', gap: 5 }}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d) => (
              <button key={d} id={'key-' + d} type="button" style={keyStyle} onClick={() => pressDigit(String(d))}>{d}</button>
            ))}
            <button id="key-erase" type="button" style={{ ...keyStyle, gridColumn: 'span 2', width: 109, fontSize: 16 }} onClick={erase}>Erase</button>
          </div>
        </div>
      </Stack>
    </Panel>
  );
}
