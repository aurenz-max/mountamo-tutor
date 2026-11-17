// Energy arrows (5-LS2-1). A food chain or web drawn as living things (and the sun) joined by arrows. Every arrow
// starts pointing one way or the other, mixed: some toward the one that gets the energy, some toward its food. The
// child taps an arrow to turn it around. Check is met when every arrow points to the one that gets the energy (the
// eater, or the plant from the sun). All arrows are drawn the same colour in either direction: no arrow shows a verdict.
// The said answer names a living thing: who gets the energy between two of them (`about`), or who loses energy when one
// is gone (`removed`, with `choices`).
// Params: at ({ name: [x, y] }, the sun included), links ([food, eater, fact?] pairs), wrong (indexes of links that
// start pointing to the food), about ([a, b]) or removed (a name) with choices (names).
function Display({ params, lumina }) {
  const EMOJI = {
    sun: '☀️', grass: '🌿', rabbit: '🐇', fox: '🦊', grasshopper: '🦗', frog: '🐸', snake: '🐍', hawk: '🦅',
    'oak tree': '🌳', caterpillar: '🐛', bird: '🐦', mushroom: '🍄', mouse: '🐭', owl: '🦉',
  };
  const at = params.at && typeof params.at === 'object' ? params.at : { sun: [110, 100], grass: [340, 100], rabbit: [570, 100] };
  const names = Object.keys(at);
  const links = (Array.isArray(params.links) ? params.links : [['sun', 'grass'], ['grass', 'rabbit']])
    .filter(l => Array.isArray(l) && at[l[0]] && at[l[1]])
    .map(l => ({ food: l[0], eater: l[1], fact: l[2] || (l[0] === 'sun' ? `the ${l[1]} grows in sunlight` : `the ${l[1]} eats the ${l[0]}`) }));
  const wrong = Array.isArray(params.wrong) ? params.wrong : [1];

  // The said answer, from params only.
  useEffect(() => {
    if (params.removed) {
      const gone = String(params.removed);
      const choices = Array.isArray(params.choices) ? params.choices.map(String) : [];
      const key = (links.find(l => l.food === gone && choices.includes(l.eater)) || {}).eater || '';
      const food = (links.find(l => l.eater === gone && choices.includes(l.food)) || {}).food;
      const misrules = [{ says: food, because: `reads each arrow as pointing from the eater to its food, so follows the ${gone}'s arrow to its food` }]
        .filter(m => m.says && m.says !== key);
      lumina.answer(key, misrules, choices);
    } else {
      const about = Array.isArray(params.about) ? params.about.map(String) : ['grass', 'rabbit'];
      const l = links.find(k => about.includes(k.food) && about.includes(k.eater));
      if (!l) return;
      const misrules = [{ says: l.food, because: 'thinks the arrow points from the eater to what it eats, so names the food' }]
        .filter(m => m.says !== l.eater);
      lumina.answer(l.eater, misrules, about);
    }
  }, []);

  // true: the arrow points to the eater (the one that gets the energy).
  const [toEater, setToEater] = useState(() => links.map((_, i) => !wrong.includes(i)));
  const met = toEater.every(Boolean);

  useEffect(() => {
    lumina.goal(met);
    lumina.scene({
      livingThings: names.filter(n => n !== 'sun'),
      ...(names.includes('sun') ? { alsoDrawn: 'the sun' } : {}),
      whoEatsWhat: links.map(l => l.fact),
      arrows: links.map((l, i) => ({ between: `the ${l.food} and the ${l.eater}`, pointsTo: `the ${toEater[i] ? l.eater : l.food}` })),
      ...(params.removed ? { question: `what happens if every ${params.removed} were gone` } : {}),
    });
  }, [toEater]);

  const flip = i => setToEater(s => s.map((v, j) => (j === i ? !v : v)));

  // ---------- layout ----------
  const R = 38;
  const W = 680;
  const ys = names.map(n => at[n][1]);
  const twoRows = Math.min(...ys) < Math.max(...ys);
  const Y0 = Math.min(...ys) - (twoRows ? 80 : 52);
  const H = Math.max(...ys) + 78 - Y0;
  // On a picture with more than one row, the top row's names sit above it, clear of the slanted arrows.
  const labelAbove = n => twoRows && at[n][1] === Math.min(...ys);

  const arrowView = (l, i) => {
    const [x1, y1] = at[l.food], [x2, y2] = at[l.eater];
    const dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy);
    const L = d - 2 * (R + 10);
    const deg = (Math.atan2(dy, dx) * 180) / Math.PI + (toEater[i] ? 0 : 180);
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    return (
      <g key={'a' + i} id={`arrow-${i + 1}`} onClick={() => flip(i)}
        style={{ cursor: 'pointer', transform: `translate(${mx}px, ${my}px) rotate(${deg}deg)`, transition: 'transform 0.3s ease-out' }}>
        <rect x={-L / 2} y={-28} width={L} height={56} fill="transparent" />
        <line x1={-L / 2} y1={0} x2={L / 2 - 16} y2={0} stroke="#fbbf24" strokeWidth="6" strokeLinecap="round" />
        <path d={`M ${L / 2} 0 L ${L / 2 - 22} -13 L ${L / 2 - 22} 13 Z`} fill="#fbbf24" stroke="#fbbf24" strokeWidth="2" strokeLinejoin="round" />
      </g>
    );
  };

  const nodeView = n => {
    const [x, y] = at[n];
    const sun = n === 'sun';
    return (
      <g key={n} id={`thing-${n.replace(/\s+/g, '-')}`}>
        <circle cx={x} cy={y} r={R} fill={sun ? '#422006' : '#1e293b'} stroke={sun ? '#f59e0b' : '#475569'} strokeWidth="2" />
        <text x={x} y={y + 2} textAnchor="middle" dominantBaseline="middle" fontSize="38">{EMOJI[n] || '🌱'}</text>
        {n === 'mushroom' && <text x={x + 30} y={y + 26} textAnchor="middle" dominantBaseline="middle" fontSize="24">🍂</text>}
        <text x={x} y={labelAbove(n) ? y - R - 12 : y + R + 22} textAnchor="middle" fontSize="17" fill="#e2e8f0">{n}</text>
      </g>
    );
  };

  return (
    <Panel title="Food Chain" caption="Tap an arrow to turn it around.">
      <svg viewBox={`0 ${Y0} ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <rect y={Y0} width={W} height={H} fill="#0f172a" />
        {names.map(nodeView)}
        {links.map(arrowView)}
      </svg>
    </Panel>
  );
}
