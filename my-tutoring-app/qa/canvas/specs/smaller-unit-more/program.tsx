// Tile the Ribbon (2.MD.A.2). One ribbon, two rows of tiles under it. The child lays long tiles end to end along the
// ribbon, says with two buttons whether the short tiles will take more or fewer, then lays the short tiles. Rule: a
// smaller unit gives a bigger count for the same length. The named misrule (a bigger unit gives a bigger number)
// predicts fewer short tiles and stops the short row early. Nothing prints a count; the rows run past the end line
// when too many tiles are laid, so the child sees the end, not a verdict.
// Transfer (params.names): the rows belong to two children who counted the same ribbon; each row takes either tile,
// and the child lays the row each child must have laid. The said answer is whose tile is bigger.
function Display({ params, lumina }) {
  const num = (v, d) => Number(v) || d;
  const ribbon = num(params.ribbon, 6), long = num(params.long, 2), short = num(params.short, 1);
  const names = Array.isArray(params.names) && params.names.length === 2 ? params.names : null;
  const predict = !names && params.predict !== false;
  const U = 52, X0 = 24, CAP = 12;
  const size = { long, short };

  const [rowA, setRowA] = useState([]);
  const [rowB, setRowB] = useState([]);
  const [guess, setGuess] = useState(null);

  const span = (row) => row.reduce((s, k) => s + size[k], 0);
  const reach = (row) => (row.length === 0 ? 'empty' : span(row) < ribbon ? 'short of the end line' : span(row) === ribbon ? 'at the end line' : 'past the end line');

  useEffect(() => {
    if (names) {
      lumina.answer(names[0], [{ says: names[1], because: 'thinks a bigger number means a bigger tile, but the smaller tile is the one that fits more times' }], names);
      return;
    }
    const longCount = ribbon / long, key = ribbon / short;
    const misrules = [
      { says: longCount - 1, because: 'thinks a bigger tile gives a bigger number, so expects fewer short tiles than long ones' },
      { says: longCount, because: 'thinks the count stays the same when the tile changes size' },
    ].filter((m, i, all) => m.says > 0 && m.says !== key && all.findIndex(x => x.says === m.says) === i);
    lumina.answer(key, misrules);
  }, []);

  useEffect(() => {
    const exact = (row, kind) => row.length > 0 && row.every(k => k === kind) && span(row) === ribbon;
    const okGuess = predict ? guess === 'more' : true;
    lumina.goal(exact(rowA, 'long') && exact(rowB, 'short') && okGuess);
    lumina.scene({
      ribbonIs: 'one ribbon with a start line and an end line',
      ribbonWidthInPixels: ribbon * U, longTileWidthInPixels: long * U, shortTileWidthInPixels: short * U,
      topRow: names ? names[0] + "'s row" : 'long tiles',
      topRowTiles: rowA.map(k => k + ' tile'),
      topRowReaches: reach(rowA),
      ...(predict ? { prediction: guess ? guess + ' short tiles than long tiles' : 'not chosen yet' } : {}),
      bottomRow: names ? names[1] + "'s row" : 'short tiles',
      bottomRowTiles: rowB.map(k => k + ' tile'),
      bottomRowReaches: reach(rowB),
    });
  }, [rowA, rowB, guess]);

  const canAdd = (row, kind) => span(row) + size[kind] <= CAP;
  const add = (set, kind) => set(r => (span(r) + size[kind] <= CAP ? [...r, kind] : r));
  const take = (set) => set(r => r.slice(0, -1));

  const FILL = { long: '#818cf8', short: '#fbbf24' }, EDGE = { long: '#312e81', short: '#78350f' };
  const tiles = (row, y, tag) => {
    let x = X0;
    return row.map((k, i) => {
      const w = size[k] * U, el = <rect key={tag + i} x={x + 1.5} y={y} width={w - 3} height="44" rx="6" fill={FILL[k]} stroke={EDGE[k]} strokeWidth="3" />;
      x += w;
      return el;
    });
  };
  const END = X0 + ribbon * U;
  const RA = 106, RB = 196;

  const longOn = true;
  const shortOn = !predict || guess !== null;
  const guessOn = rowA.length > 0;

  const tileIcon = (kind) => <span style={{ display: 'inline-block', width: size[kind] * U * 0.5, height: 22, borderRadius: 4, background: FILL[kind], border: '2px solid ' + EDGE[kind], boxSizing: 'border-box' }} />;
  const btn = (on, extra) => ({ minWidth: 64, height: 56, padding: '0 14px', borderRadius: 12, border: '2px solid #64748b', background: '#1e293b', color: '#e2e8f0', fontSize: 17, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: on ? 'pointer' : 'default', opacity: on ? 1 : 0.35, ...extra });
  const addBtn = (id, row, set, kind, on) => {
    const live = on && canAdd(row, kind);
    return <button key={id} id={id} type="button" disabled={!live} onClick={() => add(set, kind)} style={btn(live)}>+ {tileIcon(kind)}</button>;
  };
  const takeBtn = (id, row, set, on) => {
    const live = on && row.length > 0;
    return <button key={id} id={id} type="button" disabled={!live} onClick={() => take(set)} style={btn(live)}>Take one off</button>;
  };
  const group = (label, children) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{ color: '#cbd5e1', fontSize: 15 }}>{label}</div>
      <div style={{ display: 'flex', gap: 8 }}>{children}</div>
    </div>
  );
  const guessBtn = (word) => {
    const picked = guess === word;
    return <button key={word} id={'predict-' + word} type="button" disabled={!guessOn} onClick={() => setGuess(word)} style={btn(guessOn, { minWidth: 92, background: picked ? '#334155' : '#1e293b', border: picked ? '3px solid #22d3ee' : '2px solid #64748b' })}>{word}</button>;
  };

  const topLabel = names ? names[0] + "'s row" : 'Long tiles';
  const bottomLabel = names ? names[1] + "'s row" : 'Short tiles';

  return (
    <Panel title="Tile the Ribbon" caption="Tap + to lay a tile at the end of a row. Tap Take one off to lift the last tile.">
      <Stack gap={12}>
        <svg viewBox="0 0 720 256" style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
          <rect width="720" height="256" fill="#0f172a" />
          <rect x={X0} y="34" width={ribbon * U} height="26" rx="5" fill="#f472b6" />
          <line x1={X0} y1="24" x2={X0} y2="248" stroke="#e2e8f0" strokeWidth="2.5" strokeDasharray="6 5" />
          <line x1={END} y1="24" x2={END} y2="248" stroke="#e2e8f0" strokeWidth="2.5" strokeDasharray="6 5" />
          <text x={X0 + 6} y="96" fontSize="16" fill="#cbd5e1">{topLabel}</text>
          <rect x={X0} y={RA} width={CAP * U} height="44" rx="8" fill="#1e293b" stroke="#475569" strokeWidth="1.5" strokeDasharray="6 5" />
          {tiles(rowA, RA, 'a')}
          <text x={X0 + 6} y="186" fontSize="16" fill="#cbd5e1">{bottomLabel}</text>
          <rect x={X0} y={RB} width={CAP * U} height="44" rx="8" fill="#1e293b" stroke="#475569" strokeWidth="1.5" strokeDasharray="6 5" opacity={shortOn ? 1 : 0.4} />
          {tiles(rowB, RB, 'b')}
        </svg>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 22, flexWrap: 'wrap' }}>
          {names
            ? group(topLabel, [addBtn('add-1-long', rowA, setRowA, 'long', true), addBtn('add-1-short', rowA, setRowA, 'short', true), takeBtn('take-1', rowA, setRowA, true)])
            : group(topLabel, [addBtn('add-1-long', rowA, setRowA, 'long', longOn), takeBtn('take-1', rowA, setRowA, longOn)])}
          {predict && group('Short tiles: more or fewer?', [guessBtn('more'), guessBtn('fewer')])}
          {names
            ? group(bottomLabel, [addBtn('add-2-long', rowB, setRowB, 'long', true), addBtn('add-2-short', rowB, setRowB, 'short', true), takeBtn('take-2', rowB, setRowB, true)])
            : group(bottomLabel, [addBtn('add-2-short', rowB, setRowB, 'short', shortOn), takeBtn('take-2', rowB, setRowB, shortOn)])}
        </div>
      </Stack>
    </Panel>
  );
}
