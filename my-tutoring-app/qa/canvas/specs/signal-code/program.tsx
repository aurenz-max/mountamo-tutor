function Display({ params, lumina }) {
  const mode = params?.mode ?? 'decode';
  const code = params?.code ?? 'morse';
  const word = String(params?.word ?? 'SUN').toUpperCase();
  const key = params?.key ?? { E: '.', K: '-.-', M: '--', N: '-.', O: '---', R: '.-.', S: '...', T: '-', U: '..-' };

  const binary = code === 'binary';
  const letters = useMemo(() => Object.keys(key).sort(), [key]);
  const received = useMemo(() => word.split('').map((ch) => key[ch] ?? ''), [word, key]);

  // Decode: the letters the child has spelled. Encode: the signal groups the child has tapped.
  const [spelled, setSpelled] = useState('');
  const [groups, setGroups] = useState([[]]);

  const tapped = useMemo(() => groups.map((g) => g.join('')).filter((g) => g.length > 0), [groups]);

  useEffect(() => {
    const met = mode === 'encode'
      ? tapped.length === received.length && tapped.every((g, i) => g === received[i])
      : spelled.length > 0 && spelled === word;
    lumina.goal(met);
    if (mode === 'encode') {
      lumina.scene({ task: 'send a word', code: binary ? '0 and 1' : 'dots and dashes', wordToSend: word, keyLetters: letters, signalsTappedByLetter: tapped });
    } else {
      lumina.scene({ task: 'read a message', code: binary ? '0 and 1' : 'dots and dashes', receivedByLetter: received, keyLetters: letters, lettersSpelled: spelled });
    }
  }, [mode, spelled, tapped, received, word, letters, binary]);

  const addSignal = (s) => setGroups((gs) => { const next = gs.slice(); next[next.length - 1] = next[next.length - 1].concat(s); return next; });
  const addGap = () => setGroups((gs) => (gs[gs.length - 1].length === 0 ? gs : gs.concat([[]])));
  const eraseSignal = () => setGroups((gs) => {
    const last = gs[gs.length - 1];
    if (last.length > 0) { const next = gs.slice(); next[next.length - 1] = last.slice(0, -1); return next; }
    if (gs.length > 1) return gs.slice(0, -1);
    return gs;
  });

  const AMBER = '#fbbf24';

  // One letter's signals, drawn: a dot is a short flash, a dash a long one; in binary, a lit or dark lamp.
  const Marks = ({ pattern, scale }) => {
    const k = scale || 1;
    const items = String(pattern).split('');
    if (binary) {
      const box = 18 * k, gap = 2.5 * k;
      const w = items.length * box + (items.length - 1) * gap;
      return (
        <svg width={w} height={box} viewBox={'0 0 ' + w + ' ' + box} style={{ display: 'block' }}>
          {items.map((c, i) => (
            <g key={i}>
              <rect x={i * (box + gap)} y={0} width={box} height={box} rx={3 * k} fill={c === '1' ? AMBER : '#0f172a'} stroke={c === '1' ? AMBER : '#64748b'} strokeWidth={1.5} />
              <text x={i * (box + gap) + box / 2} y={box * 0.72} textAnchor="middle" fontSize={13 * k} fontWeight="700" fill={c === '1' ? '#0f172a' : '#cbd5e1'}>{c}</text>
            </g>
          ))}
        </svg>
      );
    }
    const dot = 12 * k, dash = 32 * k, gap = 7 * k, h = 12 * k;
    let x = 0;
    const shapes = items.map((c, i) => {
      const w = c === '-' ? dash : dot;
      const el = c === '-'
        ? <rect key={i} x={x} y={0} width={w} height={h} rx={h / 2} fill={AMBER} />
        : <circle key={i} cx={x + dot / 2} cy={h / 2} r={dot / 2} fill={AMBER} />;
      x += w + gap;
      return el;
    });
    const w = Math.max(1, x - gap);
    return <svg width={w} height={h} viewBox={'0 0 ' + w + ' ' + h} style={{ display: 'block' }}>{shapes}</svg>;
  };

  // A message: letter groups with a wide gap between letters and no letter names.
  const Strip = ({ list, id, cursor }) => (
    <div id={id} style={{ minHeight: 64, background: '#1e293b', borderRadius: 12, padding: '14px 18px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: binary ? 30 : 40 }}>
      {list.map((g, i) => {
        const bar = <div style={{ width: 3, height: 26, background: '#94a3b8', borderRadius: 2 }} />;
        const last = cursor && i === list.length - 1;
        // The cursor sits right after the last signal, or a letter gap away once the child has tapped a gap.
        if (last && g.length === 0) return <div key={i}>{bar}</div>;
        const marks = g.length > 0 ? <Marks pattern={g} scale={binary ? 1.4 : 1.3} /> : null;
        return last
          ? <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>{marks}{bar}</div>
          : <div key={i}>{marks}</div>;
      })}
    </div>
  );

  const label = { color: '#94a3b8', fontSize: 14, marginBottom: 6 };
  const btn = { flex: '0 0 auto', minWidth: 120, minHeight: 48, padding: '8px 16px', borderRadius: 10, border: '1px solid #475569', background: '#1e293b', color: '#f1f5f9', fontSize: 17, fontWeight: 700, cursor: 'pointer' };

  const keyGrid = (
    <div>
      <div style={label}>Code key{mode === 'decode' ? ' (tap a letter to add it)' : ''}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 8 }}>
        {letters.map((ch) => {
          const inner = (
            <>
              <span style={{ fontSize: 22, fontWeight: 800, color: '#f1f5f9', width: 22, textAlign: 'center' }}>{ch}</span>
              <Marks pattern={key[ch]} scale={binary ? 1 : 0.8} />
            </>
          );
          const tile = { minHeight: 48, display: 'flex', flexDirection: binary ? 'column' : 'row', alignItems: binary ? 'flex-start' : 'center', gap: binary ? 4 : 8, padding: '6px 8px', borderRadius: 10, border: '1px solid #475569', background: '#1e293b' };
          return mode === 'decode'
            ? <button key={ch} id={'key-' + ch} type="button" onClick={() => setSpelled((s) => (s.length < 12 ? s + ch : s))} style={{ ...tile, cursor: 'pointer' }}>{inner}</button>
            : <div key={ch} id={'key-' + ch} style={tile}>{inner}</div>;
        })}
      </div>
    </div>
  );

  if (mode === 'encode') {
    return (
      <Panel title="Signal Code" caption={binary ? 'Send the word as 0s and 1s.' : 'Send the word as short and long flashes.'}>
        <Stack gap={14}>
          <div>
            <div style={label}>Word to send</div>
            <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: 10, color: '#f1f5f9' }}>{word}</div>
          </div>
          <div>
            <div style={label}>Your message</div>
            <Strip id="sent-strip" list={groups.map((g) => g.join(''))} cursor />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button id="btn-short" type="button" style={btn} onClick={() => addSignal(binary ? '0' : '.')}>{binary ? '0' : 'Short'}</button>
            <button id="btn-long" type="button" style={btn} onClick={() => addSignal(binary ? '1' : '-')}>{binary ? '1' : 'Long'}</button>
            <button id="btn-gap" type="button" style={btn} onClick={addGap}>Letter gap</button>
            <button id="btn-erase" type="button" style={{ ...btn, color: '#cbd5e1' }} onClick={eraseSignal}>Erase</button>
          </div>
          {keyGrid}
        </Stack>
      </Panel>
    );
  }

  return (
    <Panel title="Signal Code" caption={binary ? 'A message came in as 0s and 1s.' : 'A message came in as short and long flashes.'}>
      <Stack gap={14}>
        <div>
          <div style={label}>Message received</div>
          <Strip id="received-strip" list={received} />
        </div>
        <div>
          <div style={label}>Your word</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
            <div id="spelled-word" style={{ flex: 1, minHeight: 52, display: 'flex', alignItems: 'center', padding: '0 16px', borderRadius: 10, border: '1px dashed #475569', fontSize: 30, fontWeight: 800, letterSpacing: 10, color: '#f1f5f9' }}>
              {spelled || <span style={{ fontSize: 15, letterSpacing: 0, fontWeight: 400, color: '#64748b' }}>no letters yet</span>}
            </div>
            <button id="btn-erase" type="button" style={{ ...btn, color: '#cbd5e1' }} onClick={() => setSpelled((s) => s.slice(0, -1))}>Erase</button>
          </div>
        </div>
        {keyGrid}
      </Stack>
    </Panel>
  );
}
