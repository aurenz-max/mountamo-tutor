// Flag the Line (6.NS.C.7). A number line with a mark at every whole number, but only two numbers written under it
// (0 and 1 on most problems). The child drags number flags from a tray onto the marks where those numbers go, then says
// the smaller (or smallest) number. Placing is the rule: a negative goes left of 0, and the bigger its digit the
// further left it goes. A child who reads -7 as more than -3 (the bigger digit is the bigger number) places the
// negatives on the wrong side and says the wrong number. Say and show: the smallest number is one sayable value.
function Display({ params, lumina }) {
  const nums = (Array.isArray(params.nums) ? params.nums : [3, 7]).map(Number);
  const from = Number(params.from ?? -8), to = Number(params.to ?? 8);
  const labels = (Array.isArray(params.labels) ? params.labels : [0, 1]).map(Number);
  const [pos, setPos] = useState(nums.map(() => null)); // the mark each flag sits on, or null in the tray
  const [drag, setDrag] = useState(null); // { k, x, y }
  const svgRef = useRef(null);

  const key = Math.min(...nums);
  useEffect(() => {
    // The misrule reads the bigger digit as the bigger number, sign ignored: its "smallest" is the number nearest 0.
    const byDigit = nums.reduce((a, b) => (Math.abs(b) < Math.abs(a) ? b : a));
    const misrules = [
      { says: byDigit, because: 'took the bigger digit as the bigger number and ignored the minus sign, so a negative with a big digit seemed big (-7 more than -3)' },
    ].filter(m => m.says !== key);
    lumina.answer(key, misrules);
  }, []);

  const spaces = to - from, X0 = 34, X1 = 646, Y = 172;
  const tickX = v => X0 + ((X1 - X0) * (v - from)) / spaces;
  const where = v => {
    if (v === null) return 'in the tray';
    const near = labels.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
    const d = v - near;
    return d === 0 ? 'on the mark written ' + near : Math.abs(d) + (Math.abs(d) === 1 ? ' mark ' : ' marks ') + (d < 0 ? 'left' : 'right') + ' of the mark written ' + near;
  };

  useEffect(() => {
    lumina.goal(nums.every((n, k) => pos[k] === n));
    lumina.scene({
      lineRunsFromMarkToMark: 'a mark for every whole number, ' + (spaces + 1) + ' marks',
      numbersWrittenUnderTheLine: labels,
      flags: nums.map((n, k) => ({ number: n, sits: where(pos[k]) })),
    });
  }, [pos]);

  const grab = (k, e) => { e.currentTarget.setPointerCapture(e.pointerId); const p = svgPoint(svgRef.current, e); setDrag({ k, x: p.x, y: p.y }); };
  const move = e => { if (drag) { const p = svgPoint(svgRef.current, e); setDrag({ ...drag, x: p.x, y: p.y }); } };
  const drop = e => {
    if (!drag) return;
    const p = svgPoint(svgRef.current, e), k = drag.k;
    setDrag(null);
    const onLine = p.y > Y - 175 && p.y < Y + 45 && p.x > X0 - 24 && p.x < X1 + 24;
    const v = Math.max(from, Math.min(to, Math.round(from + ((p.x - X0) / (X1 - X0)) * spaces)));
    setPos(s => s.map((x, i) => (i === k ? (onLine ? v : null) : x)));
  };

  // A flag on a mark next to (or on) another placed flag's mark is raised a level, so the cards never cover each other.
  const levels = (() => {
    const placed = nums.map((_, k) => k).filter(k => pos[k] !== null).sort((a, b) => pos[a] - pos[b] || a - b);
    const lv = {};
    placed.forEach((k, i) => { const prev = placed[i - 1]; lv[k] = prev !== undefined && pos[k] - pos[prev] <= 1 && lv[prev] === 0 ? 1 : 0; });
    return lv;
  })();

  const TRAY = { y: 236, h: 76 }, CW = 46, CH = 46;
  const trayX = k => 340 + (k - (nums.length - 1) / 2) * 96;
  const flag = (n, k) => {
    const dragging = drag && drag.k === k;
    const placed = pos[k] !== null && !dragging;
    const cx = dragging ? drag.x : placed ? tickX(pos[k]) : trayX(k);
    const top = dragging ? drag.y - CH / 2 : placed ? Y - 98 - levels[k] * 56 : TRAY.y + (TRAY.h - CH) / 2;
    return (
      <g key={k} id={'flag-' + k} onPointerDown={e => grab(k, e)} onPointerUp={drop} style={{ cursor: 'grab', touchAction: 'none' }}>
        {placed && <line x1={cx} y1={top + CH} x2={cx} y2={Y} stroke="#fbbf24" strokeWidth="3" />}
        {placed && <circle cx={cx} cy={Y} r="6" fill="#fbbf24" />}
        <rect x={cx - CW / 2} y={top} width={CW} height={CH} rx="10" fill={dragging ? '#334155' : '#1e293b'} stroke="#64748b" strokeWidth="2" />
        <text x={cx} y={top + CH / 2 + 8} textAnchor="middle" fontSize="23" fontWeight="700" fill="#e2e8f0">{n}</text>
      </g>
    );
  };

  const markId = v => 'mark-' + (v < 0 ? 'm' + -v : v);
  return (
    <Panel title="Flag the Line" caption="Drag a flag onto a mark of the number line. Drag it off to move it back.">
      <svg ref={svgRef} viewBox="0 0 680 324" onPointerMove={move} style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <rect width="680" height="324" fill="#0f172a" />
        <line x1={X0 - 22} y1={Y} x2={X1 + 22} y2={Y} stroke="#64748b" strokeWidth="4" />
        <path d={`M ${X0 - 30} ${Y} l 12 -8 l 0 16 z`} fill="#64748b" />
        <path d={`M ${X1 + 30} ${Y} l -12 -8 l 0 16 z`} fill="#64748b" />
        {Array.from({ length: spaces + 1 }, (_, i) => {
          const v = from + i, written = labels.includes(v);
          return (
            <g key={v}>
              <line id={markId(v)} x1={tickX(v)} y1={Y - 13} x2={tickX(v)} y2={Y + 13} stroke="#cbd5e1" strokeWidth={written ? 4 : 2} />
              {written && <text x={tickX(v)} y={Y + 42} textAnchor="middle" fontSize="21" fontWeight="700" fill="#e2e8f0">{v}</text>}
            </g>
          );
        })}
        <rect x="140" y={TRAY.y} width="400" height={TRAY.h} rx="14" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        {nums.map((_, k) => pos[k] === null && !(drag && drag.k === k) && (
          <rect key={'slot' + k} x={trayX(k) - CW / 2 - 4} y={TRAY.y + (TRAY.h - CH) / 2 - 4} width={CW + 8} height={CH + 8} rx="12" fill="none" stroke="#475569" strokeDasharray="6 5" />
        ))}
        {nums.map(flag)}
      </svg>
    </Panel>
  );
}
