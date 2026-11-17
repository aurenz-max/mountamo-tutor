// Equal parts (3.G.A.2, 3.NF.A.1). Four shapes, each cut into parts with one part shaded. The child taps every shape
// whose shaded part is one of `parts` EQUAL parts. Say and show: how many shapes that is is one sayable number.
// A shape is written as text: "grid:<down cuts>|<across cuts>" (cut positions from 0 to 1), "strips:<cuts>", "diag",
// "pie:<slices>", "chords:<straight cuts across a circle>".
function Display({ params, lumina }) {
  const want = Number(params.parts) || 4;
  const specs = String(params.shapes || 'grid:0.5|0.5;strips:0.15,0.4,0.7;strips:0.25,0.5,0.75;grid:0.3|0.7').split(';');
  const [picked, setPicked] = useState([]);

  const nums = s => (s ? s.split(',').map(Number) : []);
  const even = cuts => cuts.every((c, i) => Math.abs(c - (i + 1) / (cuts.length + 1)) < 0.02);
  const pct = cuts => cuts.map(c => Math.round(c * 100)).join(', ');
  const read = spec => {
    const [kind, arg = ''] = spec.split(':');
    if (kind === 'diag') return { kind, round: false, parts: 4, equal: true, usual: false, cut: 'two lines from corner to corner' };
    if (kind === 'pie') return { kind, round: true, slices: Number(arg), parts: Number(arg), equal: true, usual: false, cut: arg + ' slices from the centre' };
    if (kind === 'chords') {
      const k = Number(arg), v = Array.from({ length: k }, (_, i) => (i + 1) / (k + 1));
      return { kind: 'grid', round: true, v, h: [], parts: k + 1, equal: k === 1, usual: false, cut: k + ' straight lines, evenly spaced across the circle' };
    }
    const [v, h] = kind === 'strips' ? [nums(arg), []] : arg.split('|').map(nums);
    return { kind: 'grid', round: false, v, h, parts: (v.length + 1) * (h.length + 1), equal: even(v) && even(h),
      usual: v.length === 1 && h.length === 1 && even(v) && even(h),
      cut: 'lines at ' + (v.length ? pct(v) + ' of 100 across' : '') + (v.length && h.length ? ' and ' : '') + (h.length ? pct(h) + ' of 100 down' : '') };
  };
  const shapes = specs.map(read);
  const right = shapes.map((s, i) => (s.equal && s.parts === want ? i : -1)).filter(i => i >= 0);

  useEffect(() => {
    const byCount = shapes.filter(s => s.parts === want).length, usual = shapes.filter(s => s.usual && s.parts === want).length;
    const misrules = [
      { says: byCount, because: 'counted ' + want + ' parts and did not check that the parts are the same size' },
      { says: usual, because: 'only counted the shapes cut the usual way, and missed equal parts that look different' },
    ].filter((m, i, all) => m.says > 0 && m.says !== right.length && all.findIndex(x => x.says === m.says) === i);
    lumina.answer(right.length, misrules);
  }, []);
  useEffect(() => {
    lumina.goal(picked.length === right.length && right.every(i => picked.includes(i)));
    lumina.scene({ shapes: shapes.map((s, i) => ({ shape: s.round ? 'circle' : 'square', parts: s.parts, cut: s.cut, tapped: picked.includes(i) })) });
  }, [picked]);

  const S = 130, TOP = 78, GAP = 30, X0 = (680 - (specs.length * S + (specs.length - 1) * GAP)) / 2;
  const toggle = i => setPicked(p => (p.includes(i) ? p.filter(x => x !== i) : [...p, i]));
  const SHADE = '#94a3b8', PLAIN = '#1e293b', LINE = '#cbd5e1';

  const body = (s, i, x) => {
    if (s.kind === 'diag') {
      const c = [x + S / 2, TOP + S / 2], k = [[x, TOP], [x + S, TOP], [x + S, TOP + S], [x, TOP + S]];
      return k.map((p, j) => <polygon key={j} points={[p, k[(j + 1) % 4], c].map(q => q.join(',')).join(' ')} fill={j === 0 ? SHADE : PLAIN} stroke={LINE} strokeWidth="2" />);
    }
    if (s.kind === 'pie') {
      const cx = x + S / 2, cy = TOP + S / 2, r = S / 2, at = a => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
      return Array.from({ length: s.slices }, (_, j) => {
        const a0 = -Math.PI / 2 + (j * 2 * Math.PI) / s.slices, a1 = a0 + (2 * Math.PI) / s.slices, p0 = at(a0), p1 = at(a1);
        return <path key={j} d={'M ' + cx + ' ' + cy + ' L ' + p0[0] + ' ' + p0[1] + ' A ' + r + ' ' + r + ' 0 0 1 ' + p1[0] + ' ' + p1[1] + ' Z'} fill={j === 0 ? SHADE : PLAIN} stroke={LINE} strokeWidth="2" />;
      });
    }
    const xs = [0, ...s.v, 1], ys = [0, ...s.h, 1], cells = [];
    for (let a = 0; a < xs.length - 1; a++) for (let b = 0; b < ys.length - 1; b++)
      cells.push(<rect key={a + '-' + b} x={x + xs[a] * S} y={TOP + ys[b] * S} width={(xs[a + 1] - xs[a]) * S} height={(ys[b + 1] - ys[b]) * S} fill={a === 0 && b === 0 ? SHADE : PLAIN} stroke={LINE} strokeWidth="2" />);
    if (!s.round) return cells;
    return (
      <g>
        <clipPath id={'round-' + i}><circle cx={x + S / 2} cy={TOP + S / 2} r={S / 2} /></clipPath>
        <g clipPath={'url(#round-' + i + ')'}>{cells}</g>
        <circle cx={x + S / 2} cy={TOP + S / 2} r={S / 2} fill="none" stroke={LINE} strokeWidth="2" />
      </g>
    );
  };

  return (
    <Panel title="Equal Parts" caption="Tap a shape to pick it. Tap it again to let it go.">
      <svg viewBox="0 0 680 290" style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <rect width="680" height="290" fill="#0f172a" />
        {shapes.map((s, i) => {
          const x = X0 + i * (S + GAP), on = picked.includes(i);
          return (
            <g key={i}>
              <rect x={x - 12} y={TOP - 12} width={S + 24} height={S + 24} rx="14" fill={on ? '#334155' : '#1e293b'} stroke={on ? '#22d3ee' : '#475569'} strokeWidth={on ? 4 : 2} />
              {body(s, i, x)}
              <rect id={'shape-' + i} x={x - 12} y={TOP - 12} width={S + 24} height={S + 24} rx="14" fill="transparent" onPointerDown={() => toggle(i)} style={{ cursor: 'pointer' }} />
            </g>
          );
        })}
      </svg>
    </Panel>
  );
}
