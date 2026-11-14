function Display({ params, lumina }) {
  const story = ['vans', 'eggs', 'cookies'].includes(params.story) ? params.story : 'vans';
  const N = Math.max(1, Math.min(60, Number(params.items) || 23));
  const d = Math.max(2, Math.min(12, Number(params.per) || 5));
  const tool = params.tool !== false; // containers the child can add
  const signLabel = params.sign || ''; // when set, the answer is given on a sign
  const answer = params.answer || (story === 'vans' ? 'containers-up' : story === 'eggs' ? 'containers-full' : 'leftover');

  const LOOK = {
    vans: { item: '🧒', box: 'van', icon: '🚐', name: 'Vans' },
    eggs: { item: '🥚', box: 'carton', icon: '📦', name: 'Cartons' },
    cookies: { item: '🍪', box: 'bag', icon: '🛍️', name: 'Bags' },
  }[story];

  const [boxes, setBoxes] = useState(0);
  const [sign, setSign] = useState(0);
  const maxBoxes = 10; // a fixed cap: a cap tied to the answer would give it away
  const placed = Math.min(N, boxes * d);
  const waiting = N - placed;

  useEffect(() => {
    let met = false;
    if (answer === 'containers-up') met = boxes === Math.ceil(N / d);
    if (answer === 'containers-full') met = boxes === Math.floor(N / d);
    if (answer === 'sign-up') met = sign === Math.ceil(N / d);
    if (answer === 'sign-full') met = sign === Math.floor(N / d);
    if (answer === 'leftover') met = sign === N % d;
    lumina.goal(met);
    lumina.scene({
      story,
      [story === 'vans' ? 'kids' : story]: N,
      [`each${LOOK.box[0].toUpperCase() + LOOK.box.slice(1)}Holds`]: d,
      ...(tool ? {
        [LOOK.box + 's']: boxes,
        fullOnes: Math.floor(placed / d),
        lastOneHolds: boxes && placed % d ? placed % d : 'full or none',
        stillWaitingOutside: waiting,
      } : { containersOnScreen: 'none: only the crowd is shown' }),
      ...(signLabel ? { sign: sign === 0 ? 'not set' : sign } : {}),
    });
  }, [boxes, sign]);

  const W = 680;
  const cols = Math.ceil(d / 2), SEAT = 24;
  const BW = cols * SEAT + 18, BH = 2 * SEAT + 30;
  const perRow = Math.max(1, Math.floor((W - 40) / (BW + 10)));
  const shown = Math.min(boxes + 1, maxBoxes);
  const boxRows = tool ? Math.ceil(shown / perRow) : 0;
  const CURB_Y = 20, perLine = 17, IT = 36;
  const curbRows = Math.ceil(N / perLine);
  const CURB_H = Math.max(70, curbRows * IT + 26);
  const CTRL_Y = CURB_Y + CURB_H + 16;
  const SIGN_Y = CTRL_Y + (tool ? 62 : 0);
  const BOX_Y = CTRL_Y + 70 + (tool && signLabel ? 62 : 0);
  const H = BOX_Y + boxRows * (BH + 12) + 12;

  const btn = (id, x, y, label, onClick, dim) => (
    <g id={id} onClick={dim ? undefined : onClick} style={{ cursor: dim ? 'default' : 'pointer' }} opacity={dim ? 0.35 : 1}>
      <rect x={x} y={y} width="48" height="44" rx="10" fill="#334155" stroke="#64748b" strokeWidth="2" />
      <text x={x + 24} y={y + 29} textAnchor="middle" fontSize="18" fill="#e2e8f0">{label}</text>
    </g>
  );

  // the items still outside, in reading order; seated ones are drawn in their container
  const curbItems = [];
  for (let k = placed; k < N; k++) {
    const idx = k - placed;
    curbItems.push(<text key={'w' + k} x={34 + (idx % perLine) * IT + IT / 2} y={CURB_Y + 40 + Math.floor(idx / perLine) * IT} textAnchor="middle" fontSize="26">{LOOK.item}</text>);
  }

  return (
    <Panel title={story === 'vans' ? 'Field Trip Depot' : story === 'eggs' ? 'Egg Farm' : 'Cookie Stand'} caption={tool ? `Tap − or + to bring or send back a ${LOOK.box}. They fill in order.` : 'Tap the sign buttons to set your answer.'}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', userSelect: 'none' }}>
        <rect width={W} height={H} fill="#0f172a" />
        <rect x="20" y={CURB_Y} width={W - 40} height={CURB_H} rx="14" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        {curbItems}

        {tool && (
          <g>
            <text x="28" y={CTRL_Y + 29} fontSize="18" fill="#cbd5e1">{LOOK.icon} {LOOK.name}</text>
            {btn('box-minus', 150, CTRL_Y, '−', () => setBoxes(b => b - 1), boxes <= 0)}
            <text x="224" y={CTRL_Y + 30} textAnchor="middle" fontSize="22" fontWeight="700" fill="#e2e8f0">{boxes}</text>
            {btn('box-plus', 250, CTRL_Y, '+', () => setBoxes(b => b + 1), boxes >= maxBoxes)}
          </g>
        )}
        {signLabel && (
          <g>
            <rect x={20} y={SIGN_Y - 6} width={W - 40} height="56" rx="12" fill="#1e293b" stroke="#475569" strokeWidth="2" />
            <text x={40} y={SIGN_Y + 29} fontSize="16" fill="#e2e8f0">{signLabel}</text>
            {btn('sign-minus', 420, SIGN_Y, '−', () => setSign(s => s - 1), sign <= 0)}
            <rect x={474} y={SIGN_Y - 2} width="58" height="48" rx="10" fill="none" stroke="#475569" strokeWidth="2" strokeDasharray="6 5" />
            <text x={503} y={SIGN_Y + 31} textAnchor="middle" fontSize="24" fontWeight="700" fill="#22d3ee">{sign === 0 ? '?' : sign}</text>
            {btn('sign-plus', 540, SIGN_Y, '+', () => setSign(s => s + 1), sign >= 99)}
          </g>
        )}

        {tool && Array.from({ length: shown }, (_, b) => {
          const x = 20 + (b % perRow) * (BW + 10), y = BOX_Y + Math.floor(b / perRow) * (BH + 12);
          const here = b < boxes;
          return (
            <g key={'box' + b}>
              <rect x={x} y={y} width={BW} height={BH} rx="12" fill={here ? '#334155' : 'none'} stroke="#475569" strokeWidth="2" strokeDasharray={here ? undefined : '6 5'} opacity={here ? 1 : 0.5} />
              {here && <text x={x + 8} y={y + 20} fontSize="16">{LOOK.icon}</text>}
              {here && Array.from({ length: d }, (_, s) => {
                const sx = x + 9 + (s % cols) * SEAT, sy = y + 26 + Math.floor(s / cols) * SEAT;
                const k = b * d + s;
                return (
                  <g key={s}>
                    <rect x={sx} y={sy} width={SEAT - 3} height={SEAT - 3} rx="5" fill="#0f172a" stroke="#475569" strokeWidth="1" />
                    {k < N && <text x={sx + (SEAT - 3) / 2} y={sy + SEAT - 8} textAnchor="middle" fontSize="16">{LOOK.item}</text>}
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
    </Panel>
  );
}
