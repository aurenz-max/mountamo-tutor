function Display({ params, lumina }) {
  const labels = (Array.isArray(params.plots) && params.plots.length ? params.plots : ['0.6']).map(String);
  const task = ['build', 'pick', 'order'].includes(params.task) ? params.task : 'build';
  const tool = params.tool !== false; // the hundred-square plots the child paints
  const val = s => Math.round(Number(s) * 100);

  const [cells, setCells] = useState(() => labels.map(() => [])); // painted cell keys 'c-r' per plot
  const [picked, setPicked] = useState(-1);
  const [order, setOrder] = useState([]);
  const paint = useRef(null); // { plot, fill } while a finger is down

  const shaded = i => cells[i].length;
  useEffect(() => {
    const shadeOk = !tool || labels.every((s, i) => shaded(i) === val(s));
    let met = false;
    if (task === 'build') met = shadeOk;
    if (task === 'pick') {
      const best = labels.reduce((b, s, i) => (val(s) > val(labels[b]) ? i : b), 0);
      met = shadeOk && picked === best;
    }
    if (task === 'order') {
      const want = labels.map((s, i) => i).sort((a, b) => val(labels[a]) - val(labels[b]));
      met = shadeOk && order.length === labels.length && order.every((v, k) => v === want[k]);
    }
    lumina.goal(met);
    lumina.scene({
      plots: labels.map((s, i) => ({ label: s, ...(tool ? { squaresPainted: shaded(i), of: 100 } : {}) })),
      ...(task === 'pick' ? { trophyOn: picked < 0 ? 'none' : labels[picked] } : {}),
      ...(task === 'order' ? { tappedInOrder: order.map(i => labels[i]) } : {}),
    });
  }, [cells, picked, order]);

  const setCell = (p, key, fill) => setCells(cs => cs.map((list, i) => {
    if (i !== p) return list;
    const has = list.includes(key);
    if (fill && !has) return [...list, key];
    if (!fill && has) return list.filter(k => k !== key);
    return list;
  }));
  const toggleCol = (p, c) => setCells(cs => cs.map((list, i) => {
    if (i !== p) return list;
    const col = Array.from({ length: 10 }, (_, r) => c + '-' + r);
    const full = col.every(k => list.includes(k));
    return full ? list.filter(k => !col.includes(k)) : [...list.filter(k => !col.includes(k)), ...col];
  }));
  const tapCard = i => {
    if (task === 'pick') setPicked(p => (p === i ? -1 : i));
    if (task === 'order') setOrder(o => (o.includes(i) ? o.filter(x => x !== i) : [...o, i]));
  };

  const W = 680, n = labels.length;
  const S = tool ? (n === 1 ? 300 : n === 2 ? 250 : 190) : 0;
  const CELL = S / 10;
  const H = tool ? S + 200 : 260;
  const slotW = (W - 40) / n;
  const px = i => 20 + slotW * i + (slotW - S) / 2;
  const PY = 100;

  const plot = i => {
    const x = px(i), list = cells[i];
    return (
      <g key={'plot' + i}>
        {Array.from({ length: 10 }, (_, c) => (
          <g key={'tab' + c} id={`col-${i}-${c}`} onClick={() => toggleCol(i, c)} style={{ cursor: 'pointer' }}>
            <rect x={x + c * CELL + 1} y={PY - 34} width={CELL - 2} height="28" rx="5" fill="#334155" stroke="#64748b" strokeWidth="1.5" />
            <path d={`M ${x + c * CELL + CELL / 2 - 5} ${PY - 24} l 5 8 l 5 -8`} stroke="#cbd5e1" strokeWidth="2" fill="none" />
          </g>
        ))}
        <rect x={x - 3} y={PY - 3} width={S + 6} height={S + 6} rx="6" fill="#3f2a14" />
        {Array.from({ length: 100 }, (_, k) => {
          const c = Math.floor(k / 10), r = k % 10, key = c + '-' + r, on = list.includes(key);
          return (
            <rect key={key} id={`cell-${i}-${c}-${r}`} x={x + c * CELL} y={PY + r * CELL} width={CELL} height={CELL}
              fill={on ? '#34d399' : '#5b3a1a'} stroke="#2a1a0a" strokeWidth="1"
              onPointerDown={e => { e.currentTarget.releasePointerCapture && e.currentTarget.releasePointerCapture(e.pointerId); paint.current = { plot: i, fill: !on }; setCell(i, key, !on); }}
              onPointerEnter={e => { if (paint.current && paint.current.plot === i && e.buttons) setCell(i, key, paint.current.fill); }}
              style={{ cursor: 'pointer' }} />
          );
        })}
        {cardTop(i, x + S / 2, PY + S + 46, 120)}
      </g>
    );
  };
  const cardTop = (i, cx, cy, w) => {
    const pick = task === 'pick' && picked === i;
    const rank = task === 'order' ? order.indexOf(i) : -1;
    const tappable = task !== 'build';
    return (
      <g key={'card' + i} id={'card-' + i} onClick={tappable ? () => tapCard(i) : undefined} style={{ cursor: tappable ? 'pointer' : 'default' }}>
        <rect x={cx - w / 2} y={cy - 30} width={w} height="60" rx="12" fill={pick || rank >= 0 ? '#334155' : '#1e293b'} stroke={tappable ? '#64748b' : '#475569'} strokeWidth="2" />
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize="28" fontWeight="700" fill="#e2e8f0">{labels[i]}</text>
        {pick && <text x={cx + w / 2 - 4} y={cy - 22} textAnchor="middle" fontSize="28">🏆</text>}
        {rank >= 0 && (
          <g>
            <circle cx={cx - w / 2 + 4} cy={cy - 28} r="15" fill="#818cf8" />
            <text x={cx - w / 2 + 4} y={cy - 22} textAnchor="middle" fontSize="16" fontWeight="700" fill="#0f172a">{rank + 1}</text>
          </g>
        )}
      </g>
    );
  };

  const caption = (tool ? 'Tap or drag across squares to plant them; tap the arrow over a column to plant the whole column. ' : '')
    + (task === 'pick' ? 'Tap a sign to give it the trophy.' : task === 'order' ? 'Tap the signs in order; tap again to undo.' : '');
  return (
    <Panel title="Decimal Garden" caption={caption}>
      <svg viewBox={`0 0 ${W} ${H}`} onPointerUp={() => { paint.current = null; }} onPointerLeave={() => { paint.current = null; }}
        style={{ width: '100%', height: 'auto', display: 'block', userSelect: 'none', touchAction: 'none' }}>
        <rect width={W} height={H} fill="#0f172a" />
        {tool && labels.map((_, i) => plot(i))}
        {!tool && labels.map((_, i) => cardTop(i, 20 + slotW * i + slotW / 2, 130, Math.min(170, slotW - 30)))}
        {tool && <text x={W / 2} y={H - 14} textAnchor="middle" fontSize="14" fill="#94a3b8">Each plot is 1 whole garden.</text>}
      </svg>
    </Panel>
  );
}
