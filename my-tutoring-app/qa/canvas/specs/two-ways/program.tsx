function Display({ params, lumina }) {
  const nums = params?.numbers ?? [2, 3, 4];
  const given = params?.given ?? null; // a pair of indices already chosen for Way 1, or null
  const predict = params?.predict ?? false; // Way 2 asks for the total before the first node
  const showDots = params?.showDots ?? true;

  const total = nums[0] + nums[1] + nums[2];
  const blank = (pair) => ({ pair: pair ? pair.slice() : [], pairSum: '', whole: '' });

  const [ways, setWays] = useState([blank(given)]);
  const [typed, setTyped] = useState('');

  const w = ways.length - 1;
  const cur = ways[w];
  const stepOf = (way, idx) => {
    if (way.pair.length < 2) return 'pick';
    const o = predict && idx === 1 ? ['whole', 'pairSum'] : ['pairSum', 'whole'];
    return o.find((k) => way[k] === '') ?? 'done';
  };
  const step = stepOf(cur, w);
  const compare = w === 1 && step === 'done';
  const third = (pair) => [0, 1, 2].find((i) => !pair.includes(i));
  const sumOf = (pair) => nums[pair[0]] + nums[pair[1]];

  useEffect(() => {
    const ok = (way) => way.pair.length === 2 && way.pairSum === String(sumOf(way.pair)) && way.whole === String(total);
    const samePair = ways.length === 2 && ways[0].pair.length === 2 && ways[1].pair.length === 2
      && ways[0].pair.slice().sort().join() === ways[1].pair.slice().sort().join();
    lumina.goal(ways.length === 2 && ok(ways[0]) && ok(ways[1]) && !samePair);
    lumina.scene({
      numbers: nums,
      ways: ways.map((way) => ({
        addedFirst: way.pair.map((i) => nums[i]),
        addedLast: way.pair.length === 2 ? nums[third(way.pair)] : null,
        firstTyped: way.pairSum,
        inAllTyped: way.whole,
      })),
      wayBeingBuilt: w + 1,
      showing: compare ? 'both ways side by side' : 'way ' + (w + 1),
      numberBeingTyped: typed,
    });
  }, [ways, typed]);

  const pick = (i) => {
    if (step !== 'pick' && !(cur.pair.includes(i) && cur.pairSum === '' && cur.whole === '')) return;
    if (w === 0 && given) return;
    setWays((ws) => {
      const c = ws[ws.length - 1];
      const pair = c.pair.includes(i) ? c.pair.filter((x) => x !== i) : c.pair.length < 2 ? c.pair.concat(i) : c.pair;
      return ws.slice(0, -1).concat({ ...c, pair });
    });
  };
  const typing = step === 'pairSum' || step === 'whole';
  const press = (d) => { if (typing) setTyped((t) => (t.length < 2 ? t + d : t)); };
  const erase = () => setTyped((t) => t.slice(0, -1));
  const ok = () => {
    if (typed === '' || !typing) return;
    setWays((ws) => {
      const c = { ...ws[ws.length - 1], [step]: typed };
      const next = ws.slice(0, -1).concat(c);
      return stepOf(c, ws.length - 1) === 'done' && ws.length === 1 ? next.concat(blank(null)) : next;
    });
    setTyped('');
  };
  const redo = () => {
    setWays((ws) => ws.slice(0, -1).concat(blank(w === 0 ? given : null)));
    setTyped('');
  };

  const COLORS = ['#f87171', '#60a5fa', '#fbbf24'];
  const pairDone = cur.pair.length === 2;

  // Tree geometry. Before two piles are chosen they sit in their own order; once chosen, the pair
  // slides left above the "first" node and the third pile stays right, above "in all".
  const PILE_W = 112;
  const PILE_H = 86;
  const pileX = (() => {
    if (!pairDone) return [140, 340, 540];
    const [a, b] = cur.pair.slice().sort((p, q) => p - q);
    const pos = [];
    pos[a] = 120; pos[b] = 290; pos[third(cur.pair)] = 550;
    return pos;
  })();
  const BOX_X = 205;
  const BOX_Y = 150;
  const BOX_H = 70;
  const ALL_X = 400;
  const ALL_Y = 268;

  const dots = (i, size) => (
    <div key={'d' + i} style={{ display: 'grid', gridTemplateColumns: 'repeat(' + Math.max(1, Math.min(5, nums[i])) + ', ' + size + 'px)', gap: 3, justifyContent: 'center' }}>
      {Array.from({ length: nums[i] }, (_, k) => <div key={k} style={{ width: size, height: size, borderRadius: size / 2, background: COLORS[i] }} />)}
    </div>
  );

  const slot = (id, value, active) => (
    <div id={id} style={{ width: 66, height: 48, borderRadius: 10, border: '2px solid ' + (active ? '#38bdf8' : '#475569'), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 800, color: '#f1f5f9', background: '#0f172a' }}>{value}</div>
  );

  const pile = (i) => {
    const inPair = cur.pair.includes(i);
    const moved = inPair && pairDone; // its dots now sit in the "first" node
    return (
      <button key={'pile-' + i} id={'pile-' + i} type="button" onClick={() => pick(i)}
        style={{ position: 'absolute', left: pileX[i] - PILE_W / 2, top: 0, width: PILE_W, height: PILE_H, transition: 'left 320ms ease', padding: '8px 6px', borderRadius: 12, cursor: 'pointer', background: '#1e293b', border: (inPair ? 3 : 2) + 'px solid ' + (inPair ? '#e2e8f0' : COLORS[i]), display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 30, fontWeight: 800, color: COLORS[i], lineHeight: 1 }}>{nums[i]}</span>
        {showDots ? <div style={{ visibility: moved ? 'hidden' : 'visible' }}>{dots(i, 10)}</div> : null}
      </button>
    );
  };

  const line = (x1, y1, x2, y2, k) => <line key={k} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#64748b" strokeWidth={3} strokeLinecap="round" />;

  const tree = () => {
    const t = pairDone ? third(cur.pair) : null;
    return (
      <div style={{ position: 'relative', width: 680, height: 330, margin: '0 auto' }}>
        {pairDone ? (
          <svg width={680} height={330} style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}>
            {cur.pair.map((i) => line(pileX[i], PILE_H, BOX_X, BOX_Y, 'p' + i))}
            {line(BOX_X, BOX_Y + BOX_H, ALL_X, ALL_Y, 'b')}
            {line(pileX[t], PILE_H, ALL_X, ALL_Y, 't')}
          </svg>
        ) : null}
        {[0, 1, 2].map(pile)}
        {pairDone ? (
          <div id="first-box" style={{ position: 'absolute', left: BOX_X - (showDots ? 130 : 50), top: BOX_Y, width: showDots ? 260 : 100, height: BOX_H, borderRadius: 14, border: '2px dashed #e2e8f0', background: '#0b1324', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            {showDots ? cur.pair.map((i) => dots(i, 11)) : null}
            {slot('first-box-count', step === 'pairSum' ? typed : cur.pairSum, step === 'pairSum')}
          </div>
        ) : null}
        {pairDone ? (
          <div style={{ position: 'absolute', left: ALL_X - 50, top: ALL_Y, width: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            {slot('in-all', step === 'whole' ? typed : cur.whole, step === 'whole')}
            <span style={{ color: '#94a3b8', fontSize: 14 }}>in all</span>
          </div>
        ) : null}
      </div>
    );
  };

  // A small, read-only tree of a finished way, for the side-by-side look at the end.
  const miniTree = (way, idx) => {
    const [a, b] = way.pair.slice().sort((p, q) => p - q);
    const t = third(way.pair);
    const X = []; X[a] = 50; X[b] = 130; X[t] = 250;
    const bx = 90; const ax = 170;
    const node = (x, y, text, color, k) => (
      <g key={k}>
        <rect x={x - 28} y={y - 20} width={56} height={40} rx={10} fill="#1e293b" stroke={color} strokeWidth={2} />
        <text x={x} y={y + 9} textAnchor="middle" fontSize={24} fontWeight={800} fill={color === '#475569' ? '#f1f5f9' : color}>{text}</text>
      </g>
    );
    return (
      <div id={'way-' + (idx + 1)} key={idx} style={{ flex: 1, padding: 10, borderRadius: 14, background: '#111c30', border: '2px solid #334155' }}>
        <div style={{ color: '#94a3b8', fontSize: 15, marginBottom: 4 }}>Way {idx + 1}</div>
        <svg width={300} height={200} style={{ display: 'block', margin: '0 auto' }}>
          {line(X[a], 44, bx, 96, 'a')}
          {line(X[b], 44, bx, 96, 'b')}
          {line(bx, 136, ax, 156, 'c')}
          {line(X[t], 44, ax, 156, 'd')}
          {[a, b, t].map((i) => node(X[i], 24, nums[i], COLORS[i], 'n' + i))}
          {node(bx, 116, way.pairSum, '#475569', 'f')}
          {node(ax, 176, way.whole, '#475569', 'w')}
        </svg>
      </div>
    );
  };

  const caption = {
    pick: cur.pair.length === 0 ? 'Tap two piles to put together first.' : 'Tap one more pile.',
    pairSum: 'How many when those two go together?',
    whole: predict && w === 1 && cur.pairSum === '' ? 'Before you add: how many will there be in all?' : 'Now the last pile joins. How many in all?',
    done: 'Here are your two ways.',
  }[step];

  const keyStyle = { width: 44, height: 46, borderRadius: 10, border: '1px solid #475569', background: '#1e293b', color: '#f1f5f9', fontSize: 21, fontWeight: 700, cursor: 'pointer' };
  const pill = (idx) => {
    const on = idx === w;
    return (
      <div key={idx} style={{ padding: '6px 14px', borderRadius: 999, fontSize: 15, fontWeight: 700, color: on ? '#f1f5f9' : '#64748b', border: '2px solid ' + (on ? '#38bdf8' : '#334155') }}>Way {idx + 1}</div>
    );
  };

  return (
    <Panel title={'Two Ways: ' + nums.join(' + ')} caption={caption}>
      <Stack gap={12}>
        {compare ? (
          <div style={{ display: 'flex', gap: 12 }}>
            {miniTree(ways[0], 0)}
            {miniTree(ways[1], 1)}
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {pill(0)}
              {pill(1)}
              <div style={{ flex: 1 }} />
              <button id="start-over" type="button" onClick={redo} style={{ ...keyStyle, width: 'auto', height: 40, padding: '0 14px', fontSize: 14 }}>Redo this way</button>
            </div>
            {tree()}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 5, opacity: typing ? 1 : 0.35 }}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d) => (
                <button key={d} id={'key-' + d} type="button" style={keyStyle} onClick={() => press(String(d))}>{d}</button>
              ))}
              <button id="key-erase" type="button" style={{ ...keyStyle, width: 62, fontSize: 14 }} onClick={erase}>Erase</button>
              <button id="key-ok" type="button" style={{ ...keyStyle, width: 52, fontSize: 16, borderColor: '#38bdf8' }} onClick={ok}>OK</button>
            </div>
          </>
        )}
      </Stack>
    </Panel>
  );
}
