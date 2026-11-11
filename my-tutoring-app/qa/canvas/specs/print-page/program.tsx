function Display({ params, lumina }) {
  // A page (or a two-page spread) of a picture book. The child taps the words in the order we read them.
  // params.pages: [{ picture, lines: [[word, ...], ...] }] - one or two pages, left page first.
  // params.task: 'first' (tap the first word only) or 'all' (tap every word in reading order).
  // params.count: true shows number buttons for "how many words".
  const pages = Array.isArray(params?.pages) && params.pages.length
    ? params.pages
    : [{ picture: '🐶', lines: [['The', 'dog', 'ran']] }];
  const task = params?.task ?? 'all';
  const count = params?.count ?? false;
  const two = pages.length > 1;

  const [taps, setTaps] = useState([]); // keys: 'p-l-i' for a word, 'pic-p' for a picture
  const [chosen, setChosen] = useState(null);

  const order = [];
  pages.forEach((pg, p) => pg.lines.forEach((ln, l) => ln.forEach((w, i) => order.push(p + '-' + l + '-' + i))));
  const wordAt = (key) => {
    if (key.startsWith('pic-')) return '(picture on page ' + (Number(key.slice(4)) + 1) + ')';
    const [p, l, i] = key.split('-').map(Number);
    return pages[p].lines[l][i];
  };

  useEffect(() => {
    let met;
    if (task === 'first') met = taps.length === 1 && taps[0] === order[0];
    else met = taps.length === order.length && taps.every((k, n) => k === order[n]);
    if (count) met = met && chosen === order.length;
    lumina.goal(met);
    lumina.scene({
      pages: pages.map((pg, p) => ({
        page: two ? (p === 0 ? 'left page' : 'right page') : 'the page',
        picture: pg.picture,
        linesTopToBottom: pg.lines.map((ln) => ln.join(' ')),
      })),
      tapsInOrder: taps.map(wordAt),
      numberChosen: count ? chosen : undefined,
    });
  }, [taps, chosen]);

  const tap = (key) => setTaps((t) => t.concat(key));
  const marks = (key) => taps.filter((k) => k === key).length;

  const dots = (n) => (
    <div style={{ height: 14, marginTop: 4, display: 'flex', gap: 4, justifyContent: 'center' }}>
      {Array.from({ length: n }).map((_, j) => (
        <div key={j} style={{ width: 12, height: 12, borderRadius: 6, background: '#475569' }} />
      ))}
    </div>
  );

  const fontSize = two ? 28 : 34;
  const page = (pg, p) => (
    <div
      key={p}
      id={'page-' + p}
      style={{
        width: two ? 324 : 600, minHeight: two ? 380 : 320, boxSizing: 'border-box', padding: '16px 14px',
        background: '#fdf6e3', borderRadius: two ? (p === 0 ? '12px 2px 2px 12px' : '2px 12px 12px 2px') : 12,
        boxShadow: '0 4px 14px rgba(0,0,0,0.35)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
      }}
    >
      <button
        id={'pic-' + p}
        type="button"
        onClick={() => tap('pic-' + p)}
        style={{ border: 'none', background: '#f3e7c4', borderRadius: 12, width: two ? 180 : 220, height: two ? 120 : 130, fontSize: two ? 72 : 84, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 0 }}
      >
        <span>{pg.picture}</span>
      </button>
      {dots(marks('pic-' + p))}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, width: '100%' }}>
        {pg.lines.map((ln, l) => (
          <div key={l} style={{ display: 'flex', gap: two ? 22 : 30, flexWrap: 'nowrap' }}>
            {ln.map((w, i) => {
              const key = p + '-' + l + '-' + i;
              return (
                <button
                  key={key}
                  id={'word-' + key}
                  type="button"
                  onClick={() => tap(key)}
                  style={{ border: 'none', background: 'transparent', padding: '6px 2px 0', minHeight: 56, minWidth: 44, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                >
                  <span style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontSize, color: '#1e293b', lineHeight: 1.1 }}>{w}</span>
                  {dots(marks(key))}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );

  const numStyle = (n) => ({
    width: 56, height: 56, borderRadius: 12, fontSize: 26, fontWeight: 800, cursor: 'pointer',
    border: chosen === n ? '3px solid #e2e8f0' : '1px solid #475569',
    background: chosen === n ? '#334155' : '#1e293b', color: '#f1f5f9',
  });

  return (
    <Panel title="Print Page">
      <Stack gap={14}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 0 }}>
          {pages.map(page)}
        </div>
        {count && (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
              <button key={n} id={'num-' + n} type="button" style={numStyle(n)} onClick={() => setChosen(n)}>{n}</button>
            ))}
          </div>
        )}
      </Stack>
    </Panel>
  );
}
