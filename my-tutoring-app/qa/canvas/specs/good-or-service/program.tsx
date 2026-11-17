// Good or service (K social studies). A street of shops and workers on both sides of a road. Each place is drawn
// as pictures only: a good is a thing on a shelf (bread, apples, a pizza); a service is a worker doing a job for
// someone (cutting hair, driving a bus, bringing a pizza to a house). No word, label or colour says which is which:
// awning colours go by position, and every place has one big and one small picture.
// The child taps every service; a tapped place gets a cyan outline (their own mark) and a second tap takes it off.
// Goal: exactly the services are picked. The said answer is how many services the street has.
// Params: places (6 or 7 kinds from KINDS, top row first; 6 = 3 + 3, 7 = 4 + 3).
function Display({ params, lumina }) {
  const KINDS = {
    // goods: things on a shelf you take home
    bread: { good: true, big: '🍞', small: '🥖', says: 'loaves of bread on a shelf' },
    apples: { good: true, big: '🍎', small: '🍏', says: 'a crate of apples' },
    teddy: { good: true, big: '🧸', small: '🧸', says: 'teddy bears on a shelf' },
    balloons: { good: true, big: '🎈', small: '🎈', says: 'balloons on strings' },
    shoes: { good: true, big: '👟', small: '👞', says: 'shoes on a rack' },
    flowers: { good: true, big: '💐', small: '🌷', says: 'flowers in buckets' },
    books: { good: true, big: '📚', small: '📕', says: 'a pile of books' },
    carrots: { good: true, big: '🥕', small: '🥬', says: 'carrots and lettuce in a box' },
    icecream: { good: true, big: '🍦', small: '🍨', says: 'ice cream cones' },
    pizza: { good: true, big: '🍕', small: '📦', says: 'a pizza on the counter, with a pizza box' },
    medicine: { good: true, big: '💊', small: '🧴', says: 'medicine bottles and pills on a shelf' },
    // services: a worker doing a job for someone
    haircut: { good: false, big: '💇', small: '✂️', says: 'a barber cutting a child’s hair with scissors' },
    carwash: { good: false, big: '🚗', small: '🧽', who: '🧑', says: 'a worker washing a car with a sponge' },
    busride: { good: false, big: '🚌', small: '🧒', says: 'a bus driver giving a child a ride' },
    shoerepair: { good: false, big: '👞', small: '🔨', who: '🧑‍🔧', says: 'a worker fixing a shoe with a hammer' },
    painter: { good: false, big: '🏠', small: '🖌️', who: '🧑‍🎨', says: 'a painter painting a house with a paintbrush' },
    delivery: { good: false, big: '🛵', small: '🍕', who: '🧑', says: 'a scooter rider bringing a pizza to someone' },
    doctor: { good: false, big: '🧑‍⚕️', small: '🩺', says: 'a doctor checking a sick child with a stethoscope' },
  };
  const DEFAULT = ['bread', 'haircut', 'apples', 'teddy', 'balloons', 'carwash'];
  const places = (Array.isArray(params.places) ? params.places : DEFAULT).filter(k => KINDS[k]).slice(0, 7);
  const list = places.length >= 6 ? places : DEFAULT;
  const n = list.length;
  const topCount = n === 7 ? 4 : 3;

  const services = list.filter(k => !KINDS[k].good).length;
  const goods = n - services;

  // The said answer: how many services. Same whatever the child taps.
  useEffect(() => {
    const misrules = [
      { says: goods, because: 'thinks only things you can hold are bought, so counts the goods' },
      { says: n, because: 'counts every shop on the street, goods and services alike' },
    ].filter((m, i, a) => m.says !== services && a.findIndex(x => x.says === m.says) === i);
    lumina.answer(services, misrules);
  }, []);

  const [picked, setPicked] = useState(() => list.map(() => false));
  const met = list.every((k, i) => picked[i] === !KINDS[k].good);

  const whereOf = i => {
    const top = i < topCount;
    const col = top ? i : i - topCount;
    const ord = ['first', 'second', 'third', 'fourth'][col];
    return `${top ? 'top' : 'bottom'} row, ${ord} from the left`;
  };

  useEffect(() => {
    lumina.goal(met);
    lumina.scene({
      street: 'a street with shops and workers on both sides of a road',
      places: list.map((k, i) => ({ where: whereOf(i), picture: KINDS[k].says, tapped: picked[i] })),
    });
  }, [picked]);

  // ---------- layout ----------
  const W = 680, H = 420;
  const CW = 150, CH = 146, GAP = 14;
  const rowX = count => (W - (count * CW + (count - 1) * GAP)) / 2;
  const TOP_Y = 26, BOT_Y = 252;
  const pos = i => {
    const top = i < topCount;
    const col = top ? i : i - topCount;
    const count = top ? topCount : n - topCount;
    return { x: rowX(count) + col * (CW + GAP), y: top ? TOP_Y : BOT_Y };
  };
  const AWNING = ['#b91c1c', '#1d4ed8', '#15803d', '#c2410c', '#7c3aed', '#0e7490', '#a16207'];

  const toggle = i => setPicked(p => p.map((v, j) => (j === i ? !v : v)));

  const place = (k, i) => {
    const { x, y } = pos(i);
    const kind = KINDS[k];
    const on = picked[i];
    const stripes = [0, 1, 2, 3].map(s => (
      <rect key={s} x={x + 8 + s * 28 + 14} y={y} width="14" height="24" fill="#f1f5f9" opacity="0.85" />
    ));
    return (
      <g key={i} id={`place-${i + 1}`} onClick={() => toggle(i)} style={{ cursor: 'pointer' }}>
        <rect x={x} y={y} width={CW} height={CH} rx="12" fill={on ? '#334155' : '#1e293b'} stroke="#64748b" strokeWidth="2" />
        <rect x={x + 8} y={y} width={CW - 16} height="24" rx="4" fill={AWNING[i % AWNING.length]} />
        {stripes}
        <path d={`M ${x + 8} ${y + 24} ${[0, 1, 2, 3, 4, 5, 6, 7, 8].map(s => `q 7.4 10 14.9 0`).join(' ')}`} fill={AWNING[i % AWNING.length]} />
        {kind.who && <text x={x + 26} y={y + 106} textAnchor="middle" dominantBaseline="middle" fontSize="32">{kind.who}</text>}
        <text x={x + (kind.who ? 74 : 62)} y={y + 92} textAnchor="middle" dominantBaseline="middle" fontSize="58">{kind.big}</text>
        <text x={x + (kind.who ? 124 : 116)} y={y + 112} textAnchor="middle" dominantBaseline="middle" fontSize="34">{kind.small}</text>
        <rect x={x + 10} y={y + CH - 10} width={CW - 20} height="4" rx="2" fill="#475569" />
        {on && <rect x={x - 5} y={y - 5} width={CW + 10} height={CH + 10} rx="16" fill="none" stroke="#22d3ee" strokeWidth="5" />}
      </g>
    );
  };

  return (
    <Panel title="Main Street" caption="Tap a picture to pick it. Tap it again to put it back.">
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <rect width={W} height={H} fill="#0f172a" />
        {/* the road between the two rows */}
        <rect x="0" y="186" width={W} height="54" fill="#1f2937" />
        <line x1="0" y1="213" x2={W} y2="213" stroke="#fbbf24" strokeWidth="3" strokeDasharray="22 16" opacity="0.7" />
        <rect x="0" y="180" width={W} height="6" fill="#475569" />
        <rect x="0" y="240" width={W} height="6" fill="#475569" />
        {list.map((k, i) => place(k, i))}
      </svg>
    </Panel>
  );
}
