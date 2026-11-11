function Display({ params, lumina }) {
  const rule = params?.rule ?? 0;
  const cards = params?.cards ?? [3, 6, 8, 1];
  const minTests = params?.minTests ?? 3;
  const predict = params?.predict ?? null;

  const [fed, setFed] = useState([]);
  const [last, setLast] = useState(null);
  const [adds, setAdds] = useState(null);
  const [typed, setTyped] = useState('');

  useEffect(() => {
    const distinct = new Set(fed).size;
    const predicted = predict === null || typed === String(predict + rule);
    lumina.goal(distinct >= minTests && adds === rule && predicted);
    lumina.scene({ numberCards: cards, numbersFedIn: fed, cameOut: fed.map((v) => v + rule), machineAddsChosen: adds, askedForNumber: predict, numberTyped: typed });
  }, [fed, adds, typed, cards, rule, predict, minTests]);

  const feed = (v) => {
    setFed((list) => list.concat(v));
    setLast(v);
  };

  const pressDigit = (d) => setTyped((t) => (t.length < 3 ? t + d : t));
  const erase = () => setTyped((t) => t.slice(0, -1));

  const box = { width: 96, height: 76, borderRadius: 14, border: '2px solid #475569', background: '#1e293b', color: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, fontWeight: 800 };
  const label = { color: '#94a3b8', fontSize: 15, marginBottom: 4, textAlign: 'center' };
  const chip = (on) => ({ width: 56, height: 52, borderRadius: 10, border: '2px solid ' + (on ? '#38bdf8' : '#475569'), background: on ? '#0c4a6e' : '#1e293b', color: '#f1f5f9', fontSize: 23, fontWeight: 700, cursor: 'pointer' });
  const keyStyle = { width: 50, height: 46, borderRadius: 10, border: '1px solid #475569', background: '#1e293b', color: '#f1f5f9', fontSize: 21, fontWeight: 700, cursor: 'pointer' };

  return (
    <Panel title="Mystery Machine" caption="Tap a number to send it through the machine.">
      <Stack gap={12}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
          {cards.map((v, i) => (
            <button key={i} id={'card-' + i} type="button" onClick={() => feed(v)} style={{ width: 72, height: 58, borderRadius: 12, border: '2px solid #a78bfa', background: '#1e293b', color: '#f1f5f9', fontSize: 26, fontWeight: 800, cursor: 'pointer' }}>{v}</button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div>
              <div style={label}>In</div>
              <div id="in-box" style={box}>{last === null ? '' : last}</div>
            </div>
            <span style={{ color: '#94a3b8', fontSize: 26, paddingTop: 20 }}>{'→'}</span>
            <div>
              <div style={label}>Machine</div>
              <div style={{ ...box, width: 110, background: '#312e81', borderColor: '#818cf8' }}>?</div>
            </div>
            <span style={{ color: '#94a3b8', fontSize: 26, paddingTop: 20 }}>{'→'}</span>
            <div>
              <div style={label}>Out</div>
              <div id="out-box" style={box}>{last === null ? '' : last + rule}</div>
            </div>
          </div>
          <div style={{ width: 150 }}>
            <div style={label}>What you tried</div>
            <div id="log" style={{ minHeight: 76, maxHeight: 112, overflow: 'hidden', padding: '6px 10px', borderRadius: 12, background: '#1e293b', color: '#cbd5e1', fontSize: 18, fontWeight: 700 }}>
              {fed.slice(-4).map((v, i) => (
                <div key={i} style={{ textAlign: 'center' }}>{v} {'→'} {v + rule}</div>
              ))}
            </div>
          </div>
        </div>

        <div>
          <div style={label}>This machine adds:</div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <button key={n} id={'adds-' + n} type="button" style={chip(adds === n)} onClick={() => setAdds(n)}>{n}</button>
            ))}
          </div>
        </div>

        {predict !== null ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
            <div>
              <div style={label}>If {predict} goes in, what comes out?</div>
              <div id="typed" style={{ ...box, width: 200, height: 54, fontSize: 30, margin: '0 auto' }}>{typed}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 50px)', gap: 5 }}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d) => (
                <button key={d} id={'key-' + d} type="button" style={keyStyle} onClick={() => pressDigit(String(d))}>{d}</button>
              ))}
              <button id="key-erase" type="button" style={{ ...keyStyle, gridColumn: 'span 2', width: 105, fontSize: 15 }} onClick={erase}>Erase</button>
            </div>
          </div>
        ) : null}
      </Stack>
    </Panel>
  );
}
